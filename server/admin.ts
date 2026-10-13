/**
 * O painel do servidor (P93): as rotas privadas `/admin/*` que o monitor SERVIDOR do console usa (contrato em `shared/net/admin.ts`).
 * Fica fora do `Server.ts` para o teste bater direto nas contas (a avaliação, o histórico, o fim do log) e nas rotas.
 *
 * **Custo de CPU:** nada no laço de 60 Hz. Uma amostra a cada 5 s (um `cpuUsage`, um histograma do laço de eventos e uma soma sobre as
 * salas), 720 amostras de ~64 bytes na memória (uma hora). As rotas só respondem a quem tem o token do dono; uma consulta custa uma
 * soma sobre as salas e a serialização de ~2 KB.
 */
import { closeSync, existsSync, openSync, readSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import {
  ADMIN_AVALIAR_PATH,
  ADMIN_ESTADO_PATH,
  ADMIN_FECHAR_SALA_PATH,
  ADMIN_HEADER,
  ADMIN_HISTORICO_PATH,
  ADMIN_LOG_PATH,
  ADMIN_REINICIAR_PATH,
  ADMIN_TESTAR_PATH,
  AMOSTRA_CADA_S,
  HISTORICO_AMOSTRAS,
  type AdminAmostra,
  type AdminAvaliacao,
  type AdminEstado,
  type AdminErro,
  type AdminHistorico,
  type AdminLog,
  type AdminReiniciar,
  type AdminSala,
  type AdminTeste,
  type Checagem,
  type Resultado,
  type Veredito,
} from '../shared/net/admin';
import { PROTOCOL_VERSION, ROOM_SIZE } from '../shared/net/constants';
import { tokenConfere } from './metricas';

/** O arquivo de log que a tarefa do Windows escreve na pasta de dados (`servidor-windows.ps1`). */
export const LOG_ARQUIVO = 'servidor.log';
/** Quanto do fim do log o painel lê (bytes) e quantas linhas devolve. */
const LOG_BYTES = 64 * 1024;
const LOG_LINHAS = 200;
/** Linhas que o servidor guarda na memória quando não há arquivo de log (rodando à mão). */
const LOG_MEMORIA = 300;
/** O código de saída do reinício pedido pelo painel: diferente de 0, para o log e o resultado da tarefa dizerem que não foi uma parada (0 é `parar.flag`). Quem religa é o ajudante (`religar.ts`). */
export const CODIGO_REINICIO = 75;
/** A resposta de `POST /admin/reiniciar` sai antes de o servidor fechar. */
export const REINICIO_EM_S = 2;

// ─── Um anel de tamanho fixo ─────────────────────────────────────────────────────────────────────────────────────────

/** Guarda as últimas `capacidade` coisas; a mais antiga sai quando enche. Sem alocar depois de cheio. */
export class Anel<T> {
  private readonly itens: T[] = [];
  private inicio = 0;
  constructor(private readonly capacidade: number) {}

  push(x: T): void {
    if (this.itens.length < this.capacidade) this.itens.push(x);
    else {
      this.itens[this.inicio] = x;
      this.inicio = (this.inicio + 1) % this.capacidade;
    }
  }

  get tamanho(): number {
    return this.itens.length;
  }

  /** Do mais antigo para o mais novo. */
  paraLista(): T[] {
    return this.inicio === 0 ? this.itens.slice() : [...this.itens.slice(this.inicio), ...this.itens.slice(0, this.inicio)];
  }
}

// ─── Amostras: o que o servidor mede de si ───────────────────────────────────────────────────────────────────────────

/** Contadores de tráfego que o `Server.ts` soma a cada mensagem (bytes), e o amostrador lê e zera. */
export interface Trafego {
  saidaBytes: number;
  entradaBytes: number;
}

export interface FonteDeSalas {
  /** As salas abertas (só o que o amostrador lê). */
  salas: () => Iterable<{ resumo(): AdminSala; readonly humanCount: number }>;
}

const RESOLUCAO_LACO_MS = 20;
const MB = 1024 * 1024;
const arredonda = (x: number, casas = 2): number => {
  const f = 10 ** casas;
  return Math.round((Number.isFinite(x) ? x : 0) * f) / f;
};

/**
 * Tira uma amostra a cada `AMOSTRA_CADA_S` e guarda a última hora. Mede o uso de CPU do processo (em % de um núcleo), o atraso do
 * laço de eventos (o que o Node percebe de travadinha: o histograma de `perf_hooks`, descontada a resolução), a memória e o tráfego.
 */
export class Amostrador {
  private readonly anel = new Anel<AdminAmostra>(HISTORICO_AMOSTRAS);
  private readonly laco = monitorEventLoopDelay({ resolution: RESOLUCAO_LACO_MS });
  private cpuAntes = process.cpuUsage();
  private quandoAntes = performance.now();
  private timer: ReturnType<typeof setInterval> | null = null;
  private ultimoLaco = { medio: 0, p99: 0, maximo: 0 };
  private ultimaCpu = 0;
  private ultimaRede = { saida: 0, entrada: 0 };

  constructor(
    private readonly fonte: FonteDeSalas,
    private readonly trafego: Trafego,
    private readonly agora: () => number = () => Date.now(),
  ) {
    this.laco.enable();
  }

  /** Liga o relógio (o servidor chama uma vez; os testes tiram as amostras à mão com `amostrar`). */
  ligar(cadaMs = AMOSTRA_CADA_S * 1000): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.amostrar(), cadaMs);
    this.timer.unref(); // a amostragem sozinha não segura o processo vivo
  }

  parar(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.laco.disable();
  }

  /** Tira uma amostra agora (e zera o que se mede por intervalo). */
  amostrar(): AdminAmostra {
    const t = performance.now();
    const dt = Math.max(1, t - this.quandoAntes);
    const cpu = process.cpuUsage(this.cpuAntes);
    this.cpuAntes = process.cpuUsage();
    this.quandoAntes = t;
    const descontado = (ns: number) => Math.max(0, ns / 1e6 - RESOLUCAO_LACO_MS);
    this.ultimoLaco = {
      medio: arredonda(descontado(this.laco.mean)),
      p99: arredonda(descontado(this.laco.percentile(99))),
      maximo: arredonda(descontado(this.laco.max)),
    };
    this.laco.reset();
    this.ultimaCpu = arredonda(((cpu.user + cpu.system) / 1000 / dt) * 100, 1);
    const seg = dt / 1000;
    this.ultimaRede = { saida: arredonda(this.trafego.saidaBytes / 1024 / seg), entrada: arredonda(this.trafego.entradaBytes / 1024 / seg) };
    this.trafego.saidaBytes = 0;
    this.trafego.entradaBytes = 0;
    let jogadores = 0;
    let salas = 0;
    let tickMs = 0;
    for (const s of this.fonte.salas()) {
      salas++;
      jogadores += s.humanCount;
      tickMs = Math.max(tickMs, s.resumo().tickMs);
    }
    const a: AdminAmostra = {
      t: Math.round(this.agora() / 1000),
      jogadores,
      salas,
      tickMs: arredonda(tickMs),
      rssMB: arredonda(process.memoryUsage.rss() / MB, 1),
      cpuPct: this.ultimaCpu,
      saidaKBs: this.ultimaRede.saida,
      lacoMs: this.ultimoLaco.p99,
    };
    this.anel.push(a);
    return a;
  }

  get lacoUltimo(): { medio: number; p99: number; maximo: number } {
    return this.ultimoLaco;
  }
  get cpuPct(): number {
    return this.ultimaCpu;
  }
  get redeKBs(): { saida: number; entrada: number } {
    return this.ultimaRede;
  }

  historico(): AdminHistorico {
    return { passoS: AMOSTRA_CADA_S, amostras: this.anel.paraLista() };
  }
}

// ─── Estado ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface FontesDoEstado extends FonteDeSalas {
  release: string;
  iniciadoEm: number;
  porta: number;
  supervisionado: boolean;
  conexoes: () => number;
  recusas: () => { total: number; ip: number; taxa: number };
  /** Quantas contas de piloto existem (`null` = o banco não respondeu). */
  contas: () => number | null;
  reiniciando: () => boolean;
}

export function montarEstado(f: FontesDoEstado, a: Amostrador, agora = Date.now()): AdminEstado {
  const salas = [...f.salas()].map((s) => s.resumo());
  const mem = process.memoryUsage();
  return {
    protocolo: PROTOCOL_VERSION,
    release: f.release,
    iniciadoEm: new Date(f.iniciadoEm).toISOString(),
    uptimeS: Math.max(0, Math.round((agora - f.iniciadoEm) / 1000)),
    node: process.version,
    plataforma: `${process.platform} ${process.arch}`,
    porta: f.porta,
    supervisionado: f.supervisionado,
    memoria: { rssMB: arredonda(mem.rss / MB, 1), heapMB: arredonda(mem.heapUsed / MB, 1) },
    cpuPct: a.cpuPct,
    lacoMs: a.lacoUltimo,
    conexoes: f.conexoes(),
    jogadores: salas.reduce((n, s) => n + s.jogadores, 0),
    salas,
    recusas: f.recusas(),
    redeKBs: a.redeKBs,
    contas: f.contas(),
    reiniciando: f.reiniciando(),
  };
}

// ─── O fim do log ────────────────────────────────────────────────────────────────────────────────────────────────────

/** Lê o fim de um arquivo de texto (no máximo `bytes`), sem carregar o arquivo inteiro (o log da tarefa passa de 2 MB). */
export function fimDoArquivo(caminho: string, bytes = LOG_BYTES): string | null {
  try {
    const tamanho = statSync(caminho).size;
    const inicio = Math.max(0, tamanho - bytes);
    const buf = Buffer.alloc(tamanho - inicio);
    const fd = openSync(caminho, 'r');
    try {
      readSync(fd, buf, 0, buf.length, inicio);
    } finally {
      closeSync(fd);
    }
    // Começar no meio de uma linha (ou de uma letra de dois bytes) não ajuda ninguém: descarta até a primeira quebra.
    const t = buf.toString('utf8');
    return inicio > 0 ? t.slice(t.indexOf('\n') + 1) : t;
  } catch {
    return null;
  }
}

/** As últimas linhas do log da tarefa (`servidor.log`) ou, sem ele, as que o servidor guardou desde que subiu. */
export function lerFimDoLog(dirDados: string | null, memoria: readonly string[]): AdminLog {
  const arquivo = dirDados ? join(dirDados, LOG_ARQUIVO) : null;
  const texto = arquivo && existsSync(arquivo) ? fimDoArquivo(arquivo) : null;
  if (texto !== null) {
    // O Windows escreve \r\n; o aviso do SQLite do Node (experimental) é ruído que o dono não precisa ver a cada subida.
    const linhas = texto.split(/\r?\n/).filter((l) => l.length > 0 && !l.startsWith('(Use `node --trace-warnings') && !l.includes('ExperimentalWarning: SQLite'));
    return { fonte: 'arquivo', linhas: linhas.slice(-LOG_LINHAS) };
  }
  return { fonte: 'memoria', linhas: memoria.slice(-LOG_LINHAS) };
}

/** Guarda as linhas que o servidor escreve (para quando não há arquivo de log). */
export class LogEmMemoria {
  private readonly anel = new Anel<string>(LOG_MEMORIA);
  /** A hora é a do relógio da máquina (o PC do servidor está no fuso do dono): quem lê o log lê "20:01:31", não o UTC. */
  registrar(linha: string, agora: Date = new Date()): void {
    const dois = (n: number) => String(n).padStart(2, '0');
    this.anel.push(`${dois(agora.getHours())}:${dois(agora.getMinutes())}:${dois(agora.getSeconds())} ${linha}`);
  }
  linhas(): string[] {
    return this.anel.paraLista();
  }
}

// ─── Avaliar: o que a última hora diz ────────────────────────────────────────────────────────────────────────────────

/** As metas do projeto (`PROTOCOLO_UNIVERSAL.md`: G11 a G14) e os limites de aviso e de falha deste painel. */
export const METAS = {
  /** G14: tick médio de uma sala. */
  tickMs: { ok: 2, falha: 4 },
  /** O laço de eventos atrasado mais que isto (p99) faz o tick de 16,7 ms perder o compasso. */
  lacoMs: { ok: 20, falha: 50 },
  /** % de um núcleo. */
  cpuPct: { ok: 50, falha: 80 },
  /** O PC de casa tem 6 GB e divide com outros programas. */
  rssMB: { ok: 300, falha: 500 },
  /** Crescimento de memória por hora que parece vazamento. */
  crescimentoMBh: { ok: 60, falha: 200 },
  /** G11: o download de cada jogador. */
  kbsPorJogador: { ok: 8, falha: 12 },
  /** Menos que isto de amostras (1 min) e a avaliação avisa que ainda é cedo. */
  amostrasMinimas: 12,
} as const;

const pct = (xs: number[], p: number): number => {
  if (!xs.length) return 0;
  const o = [...xs].sort((a, b) => a - b);
  return o[Math.min(o.length - 1, Math.max(0, Math.ceil((p / 100) * o.length) - 1))]!;
};
const media = (xs: number[]): number => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const f1 = (x: number): string => (Math.round(x * 10) / 10).toString().replace('.', ',');

function checar(nome: string, valor: number, unidade: string, meta: { ok: number; falha: number }, dica: string, formato = f1): Checagem {
  const resultado: Resultado = valor <= meta.ok ? 'ok' : valor <= meta.falha ? 'atencao' : 'falha';
  return { nome, valor: `${formato(valor)} ${unidade}`.trim(), limite: `até ${formato(meta.ok)} ${unidade}`.trim(), resultado, ...(resultado === 'ok' ? {} : { dica }) };
}

export interface ContextoDaAvaliacao {
  uptimeS: number;
  recusasPorTaxa: number;
}

/**
 * O veredito sobre a janela de amostras: tick, atraso do laço, CPU, memória (e a tendência dela), tráfego por jogador e cortes por
 * taxa. Pura: recebe as amostras e devolve o cartão. A capacidade é uma **estimativa de CPU** (quantas salas cabem em metade do
 * tick de 16,7 ms, pelo tick medido da pior sala): não conta a banda de casa nem a memória, e diz isso (`CAPACIDADE.md`).
 */
export function avaliar(amostras: readonly AdminAmostra[], ctx: ContextoDaAvaliacao): AdminAvaliacao {
  const janelaS = amostras.length > 1 ? amostras[amostras.length - 1]!.t - amostras[0]!.t + AMOSTRA_CADA_S : amostras.length * AMOSTRA_CADA_S;
  const checagens: Checagem[] = [];
  if (amostras.length < METAS.amostrasMinimas) {
    checagens.push({ nome: 'Tempo de observação', valor: `${Math.round(janelaS)} s`, limite: `ao menos ${METAS.amostrasMinimas * AMOSTRA_CADA_S} s`, resultado: 'atencao', dica: 'O servidor subiu há pouco: o veredito melhora com o tempo e com gente jogando.' });
  }
  const comSala = amostras.filter((a) => a.salas > 0);
  const tick = comSala.map((a) => a.tickMs);
  if (tick.length) checagens.push(checar('Tempo do tick (p95 da pior sala)', pct(tick, 95), 'ms', METAS.tickMs, 'Cada sala tem 16,7 ms por tick; acima de 4 ms o jogo perde o compasso com poucas salas. Veja a CPU e o atraso do laço.'));
  else checagens.push({ nome: 'Tempo do tick (p95 da pior sala)', valor: 'sem sala aberta na janela', limite: `até ${METAS.tickMs.ok} ms`, resultado: 'ok', dica: 'Rode TESTAR para medir com uma sala de verdade.' });
  checagens.push(checar('Atraso do laço (p99)', pct(amostras.map((a) => a.lacoMs), 99), 'ms', METAS.lacoMs, 'O Node demorou a voltar a olhar o servidor: outro programa pesado na máquina, ou a CPU saturada.'));
  checagens.push(checar('CPU (média, de um núcleo)', media(amostras.map((a) => a.cpuPct)), '%', METAS.cpuPct, 'O servidor usa metade de um núcleo ou mais: com mais salas, pede outra máquina ou menos bots por sala.', (x) => String(Math.round(x))));
  const rss = amostras.map((a) => a.rssMB);
  checagens.push(checar('Memória (RSS atual)', rss.length ? rss[rss.length - 1]! : 0, 'MB', METAS.rssMB, 'O PC de casa tem pouca memória livre: acima de 500 MB o Windows começa a trocar e o tick atrasa.', (x) => String(Math.round(x))));
  if (amostras.length >= METAS.amostrasMinimas * 2) {
    const terco = Math.floor(rss.length / 3);
    const crescimento = ((media(rss.slice(-terco)) - media(rss.slice(0, terco))) / Math.max(1, janelaS)) * 3600;
    checagens.push(checar('Crescimento da memória', Math.max(0, crescimento), 'MB/h', METAS.crescimentoMBh, 'A memória só sobe: pode ser vazamento. Reiniciar resolve por enquanto; guarde o log.', (x) => String(Math.round(x))));
  }
  const comGente = amostras.filter((a) => a.jogadores > 0);
  if (comGente.length) {
    const porJogador = comGente.map((a) => a.saidaKBs / a.jogadores);
    checagens.push(checar('Download por jogador (p95)', pct(porJogador, 95), 'KB/s', METAS.kbsPorJogador, 'A meta do jogo é 8 KB/s (G11): acima disso, o estado a 20 Hz está pesado demais para uma conexão fraca.'));
  } else {
    checagens.push({ nome: 'Download por jogador', valor: 'ninguém jogou na janela', limite: `até ${METAS.kbsPorJogador.ok} KB/s`, resultado: 'ok', dica: 'Rode TESTAR para medir com clientes de mentira.' });
  }
  if (ctx.recusasPorTaxa > 0) {
    checagens.push({ nome: 'Cortes por taxa alta', valor: String(ctx.recusasPorTaxa), limite: '0', resultado: 'atencao', dica: 'Alguém mandou mensagens rápido demais e foi cortado (`servidor.log`). Pode ser só um navegador travado.' });
  }
  const rank: Record<Resultado, number> = { ok: 0, atencao: 1, falha: 2 };
  const pior = checagens.reduce<Resultado>((p, c) => (rank[c.resultado] > rank[p] ? c.resultado : p), 'ok');
  const veredito: Veredito = pior === 'falha' ? 'problema' : pior === 'atencao' ? 'atencao' : 'apto';
  const salasPorTick = capacidadeDeSalas(tick);
  const problemas = checagens.filter((c) => c.resultado !== 'ok').map((c) => c.nome.toLowerCase());
  const resumo =
    veredito === 'apto'
      ? `Tudo dentro das metas na última ${janelaS >= 3000 ? 'hora' : `janela de ${Math.max(1, Math.round(janelaS / 60))} min`}.`
      : veredito === 'atencao'
        ? `Dentro do aceitável, mas olhe: ${problemas.join(', ')}.`
        : `Fora da meta: ${problemas.join(', ')}.`;
  return { veredito, resumo, janelaS, checagens, capacidade: { salasPorTick, jogadoresPorSala: ROOM_SIZE, jogadoresSimultaneos: salasPorTick * ROOM_SIZE } };
}

/** Quantas salas cabem em metade do tick de 16,7 ms, pelo p95 do tick da pior sala (sem medida, a meta de 2 ms do G14). */
export function capacidadeDeSalas(tickMs: readonly number[]): number {
  const medido = tickMs.filter((t) => t > 0.05);
  const porSala = medido.length ? pct(medido, 95) : METAS.tickMs.ok;
  return Math.max(1, Math.floor(8.3 / porSala));
}

// ─── A régua de erros de token ───────────────────────────────────────────────────────────────────────────────────────

/** Conta só os erros de token por IP (quem acerta não gasta a régua: o painel consulta a cada poucos segundos). */
export class LimiteDeFalhas {
  private readonly falhas = new Map<string, { n: number; desde: number }>();
  constructor(
    private readonly teto = 10,
    private readonly janelaMs = 10 * 60 * 1000,
  ) {}

  bloqueado(ip: string, agora = Date.now()): boolean {
    const f = this.falhas.get(ip);
    return !!f && agora - f.desde <= this.janelaMs && f.n >= this.teto;
  }

  falhou(ip: string, agora = Date.now()): void {
    let f = this.falhas.get(ip);
    if (!f || agora - f.desde > this.janelaMs) {
      f = { n: 0, desde: agora };
      this.falhas.set(ip, f);
    }
    f.n++;
    if (this.falhas.size > 500) for (const [k, v] of this.falhas) if (agora - v.desde > this.janelaMs) this.falhas.delete(k);
  }
}

// ─── As rotas ────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface AdminOpcoes {
  /** O token do dono; `null` = as rotas nem existem (404), a menos que `contaAdmin` abra a porta. */
  token: string | null;
  /**
   * P106 ("unifique as contas", 13/10): a sessão de uma conta com `is_admin` vale no lugar do token do dono, no MESMO cabeçalho
   * (`ADMIN_HEADER`) e na mesma mensagem do mural. Quem entrou no jogo como admin não precisa colar chave nenhuma. Passa pela mesma régua
   * de erros do token. `undefined` = só o token do dono vale (como antes).
   */
  contaAdmin?: (sessao: string) => boolean;
  amostrador: Amostrador;
  estado: () => AdminEstado;
  lerLog: () => AdminLog;
  /** Quantos jogadores há agora, somando as salas. */
  jogadores: () => number;
  contexto: () => ContextoDaAvaliacao;
  /** Fecha uma sala (os jogadores caem e o cliente reconecta numa nova); `false` = não existe. */
  fecharSala: (codigo: string) => boolean;
  /** A bateria de clientes de mentira (`server/autoteste.ts`). */
  testar: () => Promise<AdminTeste>;
  /** Faz o servidor salvar e sair com o código de reinício; sem isto, `POST /admin/reiniciar` responde 501. */
  aoReiniciar?: (motivo: string) => void;
  /** O servidor roda sob a tarefa do Windows? */
  supervisionado: boolean;
  /** Anota no log do servidor o que o painel pediu. */
  anotar: (linha: string) => void;
  clientIp: (req: IncomingMessage) => string;
  lerCorpo: (req: IncomingMessage, max: number) => Promise<Buffer | 'grande'>;
  limite?: LimiteDeFalhas;
  /** Em quanto tempo o servidor sai depois do pedido de reinício (ms; padrão 2 s, os testes encurtam). */
  reinicioEmMs?: number;
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': `content-type, ${ADMIN_HEADER}`,
} as const;

const ROTAS_GET = new Set<string>([ADMIN_ESTADO_PATH, ADMIN_HISTORICO_PATH, ADMIN_LOG_PATH, ADMIN_AVALIAR_PATH]);
const ROTAS_POST = new Set<string>([ADMIN_TESTAR_PATH, ADMIN_FECHAR_SALA_PATH, ADMIN_REINICIAR_PATH]);

export class Admin {
  private reiniciando = false;
  private testando = false;
  private readonly limite: LimiteDeFalhas;

  constructor(private readonly o: AdminOpcoes) {
    this.limite = o.limite ?? new LimiteDeFalhas();
  }

  get estaReiniciando(): boolean {
    return this.reiniciando;
  }

  /**
   * A chave do dono, para quem não passa pelas rotas HTTP (o mural de câmeras, por WebSocket): a mesma comparação em tempo constante e a
   * **mesma régua de erros** (10 erros por IP em 10 min fecham a porta, até para o token certo). `desligado` = o servidor não tem token.
   */
  autenticar(ip: string, token: unknown): 'ok' | 'negado' | 'bloqueado' | 'desligado' {
    if (!this.o.token && !this.o.contaAdmin) return 'desligado';
    if (this.limite.bloqueado(ip)) return 'bloqueado';
    const donoOk = !!this.o.token && tokenConfere(token, this.o.token);
    if (!donoOk && !this.sessaoAdmin(token)) {
      this.limite.falhou(ip);
      return 'negado';
    }
    return 'ok';
  }

  /** A sessão de conta admin (P106). Nunca lança: banco fora do ar = não vale. */
  private sessaoAdmin(token: unknown): boolean {
    if (!this.o.contaAdmin || typeof token !== 'string' || token.length < 8 || token.length > 200) return false;
    try {
      return this.o.contaAdmin(token) === true;
    } catch {
      return false;
    }
  }

  /** `true` se a rota era do painel (e a resposta já foi escrita); `false` deixa o `Server.ts` seguir. */
  async tratar(req: IncomingMessage, res: ServerResponse, path: string): Promise<boolean> {
    const dono = ROTAS_GET.has(path) || ROTAS_POST.has(path);
    if (!dono) return false;
    const json = (codigo: number, dados: unknown) => {
      res.writeHead(codigo, { ...CORS, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify(dados));
    };
    const recusar = (codigo: number, e: AdminErro): true => {
      json(codigo, e);
      return true;
    };
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS);
      res.end();
      return true;
    }
    // Sem token configurado (e sem conta admin) a porta nem existe, como a das métricas.
    if (!this.o.token && !this.o.contaAdmin) {
      res.writeHead(404, CORS);
      res.end();
      return true;
    }
    const metodoCerto = ROTAS_GET.has(path) ? req.method === 'GET' : req.method === 'POST';
    if (!metodoCerto) {
      res.writeHead(405, { ...CORS, allow: ROTAS_GET.has(path) ? 'GET, OPTIONS' : 'POST, OPTIONS' });
      res.end();
      return true;
    }
    const auth = this.autenticar(this.o.clientIp(req), req.headers[ADMIN_HEADER]);
    if (auth === 'bloqueado') {
      res.writeHead(429, CORS);
      res.end();
      return true;
    }
    if (auth !== 'ok') {
      res.writeHead(401, { ...CORS, 'cache-control': 'no-store' });
      res.end();
      return true;
    }

    switch (path) {
      case ADMIN_ESTADO_PATH:
        json(200, this.o.estado());
        return true;
      case ADMIN_HISTORICO_PATH:
        json(200, this.o.amostrador.historico());
        return true;
      case ADMIN_LOG_PATH:
        json(200, this.o.lerLog());
        return true;
      case ADMIN_AVALIAR_PATH:
        json(200, avaliar(this.o.amostrador.historico().amostras, this.o.contexto()));
        return true;
      case ADMIN_TESTAR_PATH: {
        const n = this.o.jogadores();
        if (n > 0) return recusar(409, { erro: `há ${n} jogador${n === 1 ? '' : 'es'} na sala: o teste esperaria a sala esvaziar`, jogadores: n });
        if (this.testando) return recusar(409, { erro: 'já há um teste rodando' });
        if (this.reiniciando) return recusar(409, { erro: 'o servidor está reiniciando' });
        this.testando = true;
        this.o.anotar('painel: teste do servidor começou');
        try {
          const r = await this.o.testar();
          this.o.anotar(`painel: teste do servidor terminou (${r.ok ? 'passou' : 'falhou'})`);
          json(200, r);
        } catch (e) {
          this.o.anotar(`painel: o teste quebrou: ${e instanceof Error ? e.message : String(e)}`);
          recusar(500, { erro: 'o teste quebrou; veja o log' });
        } finally {
          this.testando = false;
        }
        return true;
      }
      case ADMIN_FECHAR_SALA_PATH: {
        const corpo = await this.corpo(req);
        const codigo = typeof corpo?.sala === 'string' ? corpo.sala.trim().toUpperCase() : '';
        if (!/^[A-Z0-9-]{1,12}$/.test(codigo)) return recusar(400, { erro: 'sala inválida' });
        if (!this.o.fecharSala(codigo)) return recusar(404, { erro: 'essa sala não está aberta' });
        this.o.anotar(`painel: sala ${codigo} fechada`);
        json(200, { ok: true });
        return true;
      }
      case ADMIN_REINICIAR_PATH: {
        const corpo = await this.corpo(req);
        const n = this.o.jogadores();
        if (this.reiniciando) return recusar(409, { erro: 'já está reiniciando' });
        if (n > 0 && corpo?.confirmar !== true) return recusar(409, { erro: `há ${n} jogador${n === 1 ? '' : 'es'} jogando: confirme para derrubá-los`, jogadores: n });
        if (!this.o.aoReiniciar) return recusar(501, { erro: 'este servidor não sabe se reiniciar' });
        this.reiniciando = true;
        const emMs = this.o.reinicioEmMs ?? REINICIO_EM_S * 1000;
        const resposta: AdminReiniciar = { ok: true, emS: Math.round(emMs / 100) / 10, religa: this.o.supervisionado ? 'supervisionado' : 'sozinho' };
        this.o.anotar(`painel: reinício pedido (${n} jogador${n === 1 ? '' : 'es'}); sai em ${resposta.emS} s`);
        json(202, resposta);
        const aoReiniciar = this.o.aoReiniciar;
        setTimeout(() => aoReiniciar('pedido do painel'), emMs).unref();
        return true;
      }
    }
    return false;
  }

  private async corpo(req: IncomingMessage): Promise<Record<string, unknown> | null> {
    const b = await this.o.lerCorpo(req, 1024);
    if (b === 'grande') return null;
    try {
      const j: unknown = JSON.parse(b.toString('utf8') || '{}');
      return typeof j === 'object' && j !== null && !Array.isArray(j) ? (j as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
}
