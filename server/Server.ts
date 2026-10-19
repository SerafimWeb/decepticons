import { PlayMetrics } from './PlayMetrics';
import { PLAY_PATH, parsePlayReport } from '../shared/net/playMetrics';
import { parseLoadoutKey } from '../client/src/hangar/loadout';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import { FIXED_DT } from '../client/src/physics/PhysicsWorld';
import { chaveDeConfigValida, valorDeConfigValido, CONTA_APAGAR_PATH, CONTA_CRIAR_PATH, CONTA_DADOS_PATH, CONTA_ENTRAR_PATH, CONTA_EU_PATH, CONTA_MEDICAO_PATH, CONTA_PROGRESSO_PATH, CONTA_SAIR_PATH, CONFIG_PATH, ADMIN_CONFIG_PATH, POLITICA_VERSAO, PROGRESSO_MAX_BYTES, parseCredenciais, parseCriarConta, parseMedicao, parseSenhaDeConfirmacao, SESSAO_HEADER, validarProgresso } from '../shared/net/auth';
import { CLOSE_REINICIO, REINICIO_AVISO_S, REINICIO_VOLTA_EM_S, ROOM_MAX, ROOM_SIZE } from '../shared/net/constants';
import { CONTA_ESQUECI_PATH, CONTA_REDEFINIR_PATH, parseEsqueci, parseRedefinir, urlDeRedefinicao, type IdiomaEmail } from '../shared/net/auth';
import { carregarMailer, EMAILS_POR_DIA, TetoDiario, type Mailer } from './email';
import { emailDeRedefinicao } from './emailTextos';
import { Writer } from '../shared/net/codec';
import { serverStatus, STATUS_PATH } from '../shared/net/status';
import { type EventoEnviado, type EventoServidor, EVENTO_MAX_BYTES, EVENTO_PATH, METRICAS_HEADER, METRICAS_PATH, parseEvento, RESUMO_PATH } from '../shared/net/telemetry';
import { encodeAviso, sanitizeName, type RejectReason } from '../shared/net/messages';
import { ArenaRoom, type Peer } from './ArenaRoom';
import { Contas } from './contas';
import { fazerBackup } from './backupContas';
import { Audiencia } from './Audiencia';
import { clientCountry, clientIp, clientRegion, Guard, GUARD_DEFAULTS, ipParaLog, type GuardConfig } from './guard';
import { Auditoria, AUDITORIA_PASTA, type Acao } from './auditoria';
import { FalhasPorConta, LIMITE_LOGIN_DEFAULTS, LimiteLogin } from './login';
import { corsDoPedido, origemPermitida, origensExtras } from './origem';
import { VISIBILIDADE_PATH } from '../shared/visibilidade';
import { ArmazemDeVisibilidade } from './visibilidade';
import { ArmazemDeRegras } from './regras';
import { bancoDeContas, pastaDados } from './dados';
import { carregarToken, DADOS_ARQUIVO, gravarJson, lerJson, TOKEN_ARQUIVO, tokenConfere } from './metricas';
import { Telemetria } from './telemetria';
import { ehPedidoDeMural, Mural } from './mural';
import { Admin, Amostrador, LimiteDeFalhas, lerFimDoLog, LogEmMemoria, montarEstado, type Trafego } from './admin';
import { ehSalaDeTeste, executarTeste } from './autoteste';
import { ADMIN_PREFIXO } from '../shared/net/admin';
import { ehMensagemDeVoz, VOZ_SDP_MAX } from '../shared/net/voz';

/** Maior mensagem de jogo aceita de um cliente (a maior é o JOIN, ~90 bytes). Acima disso, a conexão cai (G7). */
const MAX_MESSAGE = 1024;
/** O teto do `ws`: a sinalização de voz (um SDP de até 3 KB) passa de 1 KB; as mensagens de jogo continuam cortadas em `MAX_MESSAGE` logo abaixo (P205). */
const MAX_MESSAGE_VOZ = VOZ_SDP_MAX + 3;
/** Sala sem ninguém por este tempo fecha (a memória da partida volta). */
const EMPTY_ROOM_S = 30;
/** Sala padrão para quem entra sem código. */
export const DEFAULT_ROOM = 'ARENA';
/** Bind padrão: só localhost (o túnel da Cloudflare fala com `127.0.0.1`; nada vaza pela rede de casa nem pela internet). */
export const DEFAULT_HOST = '127.0.0.1';
const ROOM_RE = /^[A-Z0-9-]{1,12}$/;

/**
 * Lê o corpo de um `POST` pequeno com teto de tamanho (G7: nunca confiar no `content-length` anunciado).
 * `'grande'`: o chamador escreve a resposta (413) — **não destrua a conexão antes disso**: um `req.destroy()`
 * antes do `res.end()` derruba o socket e o cliente nunca vê a resposta (era exatamente isso, nessa ordem
 * errada, que fazia o teste de corpo grande falhar de vez em quando com "other side closed"). Os bytes
 * extras que ainda chegarem depois de `recusado` são só descartados, não acumulados. Compartilhado por
 * `/evento` e as rotas de conta, que têm o mesmo formato (JSON pequeno, sem streaming).
 */
function lerCorpoLimitado(req: import('node:http').IncomingMessage, maxBytes: number): Promise<Buffer | 'grande'> {
  return new Promise((resolve) => {
    let bytes = 0;
    const chunks: Buffer[] = [];
    let recusado = false;
    req.on('data', (chunk: Buffer) => {
      if (recusado) return;
      bytes += chunk.length;
      if (bytes > maxBytes) {
        recusado = true;
        resolve('grande');
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!recusado) resolve(Buffer.concat(chunks));
    });
    req.on('error', () => {
      if (!recusado) {
        recusado = true;
        resolve('grande'); // a conexão quebrou de qualquer jeito; a resposta nunca chega
      }
    });
  });
}

export interface GameServer {
  port: number;
  host: string;
  /** O painel do servidor (P93): as amostras de uma hora, para o teste tirar uma à mão. */
  readonly amostrador: Amostrador;
  /** O mural de câmeras (P88): quantos espectadores já provaram o token e quantas conexões de mural existem (para o teste). */
  readonly mural: { readonly assistindo: number; readonly conexoes: number };
  rooms: ReadonlyMap<string, ArenaRoom>;
  /** Contadores das defesas (para o teste e o log de 10 s). */
  readonly guard: {
    connections: number;
    rejected: { total: number; ip: number; flood: number; picos: number };
  };
  /**
   * Fecha o servidor para reiniciar (P204): com gente na sala, avisa `gracaS` segundos antes (a tela dela conta), corta com
   * `CLOSE_REINICIO` e o tempo previsto de volta, e então fecha de vez. Sem ninguém, não espera. É o que o painel e a
   * atualização automática chamam no lugar de `close()`.
   */
  fecharComAviso(o?: { gracaS?: number; voltaEmS?: number }): Promise<void>;
  close(): Promise<void>;
}

/** Código da sala a partir do endereço da conexão (`/?sala=K7Q2`); inválido vira null. */
export function roomCode(url: string | undefined): string | null {
  const raw = new URL(url ?? '/', 'http://x').searchParams.get('sala');
  const code = (raw ?? DEFAULT_ROOM).trim().toUpperCase().slice(0, ROOM_MAX);
  return ROOM_RE.test(code) ? code : null;
}

/**
 * O servidor de jogo (M3): HTTP + WebSocket (\`ws\`) numa porta, salas por código (\`?sala=\`), criadas na primeira
 * entrada e fechadas depois de 30 s vazias. Um laço só roda todas as salas no tick fixo de 60 Hz, com acumulador
 * (o relógio do Windows acorda a cada ~15 ms: a sala dá 1 ou 2 passos por vez e nunca adianta nem atrasa).
 *
 * O transporte copia cada mensagem ao mandar: o socket guarda o buffer até ele sair, e as salas reaproveitam o
 * delas (G4 vale para a simulação; aqui é uma cópia de ~240 bytes por jogador, 20 vezes por segundo).
 */
export async function startServer(
  opts: {
    port?: number;
    host?: string;
    log?: (line: string) => void;
    guard?: Partial<GuardConfig>;
    /** Caminho do banco de contas. Padrão: `contas.db` na pasta de dados (`CYBERMECH_DADOS`, ou `.tmp/servidor/` ao lado do código;
     * gitignored, sobrevive à atualização automática). Testes passam `:memory:`. */
    dbContas?: string;
    /** De quanto em quanto tempo o banco de contas é copiado para `backups/` (padrão: 6 h). */
    backupCadaMs?: number;
    /** Régua de tentativas de `/conta/entrar` e `/conta/criar` (padrão: 8 a cada 10 min por IP). Testes
     * que fazem muitas chamadas do mesmo IP alargam para não confundir rate limit com o que estão testando. */
    limiteLogin?: Partial<typeof LIMITE_LOGIN_DEFAULTS>;
    /** O envio de e-mail do "esqueci a senha" (P206). Os testes passam um falso; o padrão lê `CYBERMECH_EMAIL_CHAVE` ou `email.json` na pasta de dados (`email.ts`). `null` = sem e-mail: a rota responde 503. */
    mailer?: Mailer | null;
    /** O endereço do site que vai no link do e-mail (padrão: `CYBERMECH_SITE_URL` ou https://cybermech.online). */
    siteUrl?: string;
    /** Pedidos de "esqueci a senha" por IP (padrão 5 por hora); os testes alargam. */
    limiteEsqueci?: Partial<typeof LIMITE_LOGIN_DEFAULTS>;
    /** Origens extras (além do jogo no ar e da rede local) que podem abrir o WebSocket e as rotas de conta. Padrão: `CYBERMECH_ORIGENS` (`origem.ts`). */
    origens?: string[];
    /**
     * Pasta dos números que sobrevivem ao reinício (`telemetria.json`) e do token das métricas. Padrão: `CYBERMECH_DADOS`, ou
     * `.tmp/servidor/` ao lado do código (gitignored; `server/dados.ts`).
     * Testes que passam `dbContas: ':memory:'` ficam sem pasta (nada em disco) a menos que passem esta.
     */
    dirDados?: string;
    /** As regras dos bots de quando ainda não há arquivo (os testes passam as da sala antiga); padrão: as de iniciante. */
    regrasIniciais?: import('../shared/regras').RegrasOnline;
    /** Token da porta privada `GET /metricas`. Sem ele e sem pasta de dados, a porta fica desligada (404). */
    metricasToken?: string;
    /** De quanto em quanto tempo grava os números em disco, se mudaram (padrão 60 s). */
    salvarCadaMs?: number;
    /** Pelo painel (`POST /admin/reiniciar`): o `main.ts` salva e sai com o código de reinício. Sem isto, a rota responde 501. */
    aoReiniciar?: (motivo: string) => void;
    /** A versão do código (hash curto do git) que o painel mostra. */
    release?: string;
    /** Roda sob a tarefa do Windows (que o religa se ele sair com erro)? O painel avisa quando não. */
    supervisionado?: boolean;
    /** De quanto em quanto tempo o painel tira uma amostra (padrão 5 s; os testes encurtam). */
    amostraCadaMs?: number;
    /** Em quanto tempo o servidor sai depois de `POST /admin/reiniciar` (ms; padrão 2 s) e quanto dura o TESTAR (s; padrão 6): os testes encurtam. */
    reinicioEmMs?: number;
    testeDuracaoS?: number;
    /** A régua de erros de token do painel (padrão: 10 a cada 10 min por IP); os testes que erram de propósito muitas vezes alargam. */
    limiteAdmin?: { teto: number; janelaMs?: number };
    /** O mural de câmeras: quantos espectadores (padrão 4), quanto têm para mandar o token (5 s) e de quanto em quanto tempo recebem um quadro (250 ms); os testes encurtam. */
    mural?: { max?: number; esperaMs?: number; cadaMs?: number };
  } = {},
): Promise<GameServer> {
  // O que o servidor escreve também fica na memória: sem arquivo de log (rodando à mão), o painel mostra isto.
  const logMemoria = new LogEmMemoria();
  const log = (linha: string): void => {
    opts.log?.(linha);
    logMemoria.registrar(linha);
  };
  const guard = new Guard({ ...GUARD_DEFAULTS, ...opts.guard });
  const rejected = { total: 0, ip: 0, flood: 0, picos: 0 };
  const rooms = new Map<string, ArenaRoom>();
  const creating = new Map<string, Promise<ArenaRoom>>();
  const emptyFor = new Map<string, number>();
  /** Os sockets de cada sala (para o painel fechar uma sala de verdade) e o tráfego que o amostrador lê. */
  const sockets = new Map<string, Set<WebSocket>>();
  const trafego: Trafego = { saidaBytes: 0, entradaBytes: 0 };
  const amostrador = new Amostrador({ salas: () => rooms.values() }, trafego);
  let admin: Admin | null = null;
  let mural: Mural | null = null;
  /** Conexões em cada sala (contando quem ainda não mandou o JOIN): é o que decide se a sala está cheia. */
  const occupancy = new Map<string, number>();
  /** Sala pedida cheia: a próxima (ARENA, ARENA-2, ARENA-3...). Quem clica em "Jogar online" nunca fica de fora. */
  const pickRoom = (code: string): string => {
    const base = code.replace(/-\d+$/, '');
    let n = code === base ? 1 : Number(code.slice(base.length + 1));
    let c = code;
    while ((occupancy.get(c) ?? 0) >= ROOM_SIZE && n < 99) c = `${base}-${++n}`.slice(0, ROOM_MAX);
    return c;
  };

  const roomFor = (code: string): Promise<ArenaRoom> => {
    const open = rooms.get(code);
    if (open) return Promise.resolve(open);
    let p = creating.get(code);
    if (!p) {
      p = ArenaRoom.create(code, regras.atual()).then((room) => {
        // A sala de teste do painel (`TESTE-…`) fica fora dos números de produto.
        if (!ehSalaDeTeste(code)) {
          room.onEntrou = (peer) => {
            contar('entrou_na_sala', peer.pais);
            telemetria.pico(jogadoresAgora());
          };
          room.onRecusou = (peer, motivo: RejectReason) => contar(`recusa_${motivo}` as EventoServidor, peer.pais);
        }
        rooms.set(code, room);
        creating.delete(code);
        log(`sala ${code} aberta`);
        return room;
      });
      creating.set(code, p);
    }
    return p;
  };

  /**
   * `GET /status`: o que a landing e a pausa do jogo perguntam para dizer "servidor online · 2 pilotos" sem
   * abrir conexão de jogo (contrato em `shared/net/status.ts`). Só números agregados, liberado para qualquer
   * origem (o site mora em outro endereço). A resposta é montada no máximo **uma vez por segundo**: mil
   * perguntas no mesmo segundo custam uma soma sobre as salas, e nada disso toca o laço de 60 Hz.
   */
  const startedAt = Date.now();
  const jogadoresAgora = (): number => {
    let n = 0;
    for (const r of rooms.values()) if (!ehSalaDeTeste(r.code)) n += r.humanCount;
    return n;
  };
  let statusBody = '';
  let statusAt = 0;
  const status = (): string => {
    const now = Date.now();
    if (statusBody && now - statusAt < 1000) return statusBody;
    let players = 0;
    let abertas = 0;
    for (const r of rooms.values()) {
      if (ehSalaDeTeste(r.code)) continue;
      players += r.humanCount;
      abertas++;
    }
    // A visibilidade (P191) viaja no /status, que já responde com CORS em todo servidor: um servidor antigo (sem a rota própria) não faz o navegador logar erro de CORS.
    statusBody = JSON.stringify({ ...serverStatus(players, abertas, (now - startedAt) / 1000), visibilidade: visibilidade.atual() });
    statusAt = now;
    return statusBody;
  };

  /**
   * Métricas de produto (dono, 28/09: "quero trackear o consumo, quantas pessoas clicaram, onde clicam,
   * onde saem, se jogaram tantas partidas"). `POST /evento` conta um evento da lista fechada (contrato em
   * `shared/net/telemetry.ts`); `GET /eventos/resumo` devolve só contagens agregadas — nunca um evento cru,
   * nunca um IP. A agregação em si (`Telemetria`, com teste próprio) já limita a memória sozinha; aqui só a
   * porta HTTP: corpo pequeno, decodifica ou descarta, nunca lança.
   */
  const telemetria = new Telemetria();
  const playMetrics = new PlayMetrics();
  /** A audiência (P193): de onde vêm as visitas e que aparelho joga, só em soma e por categoria (`server/Audiencia.ts`). */
  const audiencia = new Audiencia();
  const codigo = resolve(import.meta.dirname, '..');
  const dirDados = opts.dirDados ?? (opts.dbContas === ':memory:' ? null : pastaDados(codigo));
  if (dirDados) log(`pasta de dados (contas.db, números, token): ${dirDados}`);
  const arquivoDados = dirDados ? join(dirDados, DADOS_ARQUIVO) : null;
  if (arquivoDados) telemetria.carregar(lerJson(arquivoDados));
  const playFile = dirDados ? join(dirDados,'partidas.json') : null;
  if (playFile) playMetrics.load(lerJson(playFile));
  const audienciaFile = dirDados ? join(dirDados, 'audiencia.json') : null;
  if (audienciaFile) audiencia.carregar(lerJson(audienciaFile));
  /** Token do dono para `GET /metricas` (origem das conexões, por país e por dia). `null` = porta desligada. */
  const metricasToken = opts.metricasToken ?? (dirDados ? carregarToken(dirDados) : null);
  // Diz ONDE está o token (nunca o token): a pasta é a de onde o código do servidor roda, e o dono precisa achar o arquivo.
  if (metricasToken && dirDados) log(`métricas privadas ligadas: o token está em ${join(dirDados, TOKEN_ARQUIVO)} (ou na variável CYBERMECH_METRICAS_TOKEN)`);
  const limiteMetricas = new LimiteLogin({ teto: 30, janelaMs: 10 * 60 * 1000 });
  const gravarDados = (): void => {
    if (!arquivoDados || (!telemetria.sujo && !playMetrics.dirty && !audiencia.sujo)) return;
    try {
      gravarJson(arquivoDados, telemetria.exportar());
      if (audienciaFile && audiencia.sujo) gravarJson(audienciaFile, audiencia.exportar());
      if (playFile && playMetrics.dirty) { gravarJson(playFile,playMetrics.snapshot());playMetrics.dirty=false; }
    } catch (err) {
      telemetria.sujo = true;
      log(`não consegui gravar ${arquivoDados}: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  const salvarTimer = arquivoDados ? setInterval(gravarDados, opts.salvarCadaMs ?? 60_000) : null;
  /** Conta um evento do servidor com o país de quem causou. */
  const contar = (nome: EventoServidor, pais: string | undefined): void => telemetria.contar(nome, pais);

  /**
   * Contas de piloto (dono, 28/09: "partir para login?"): SQLite no próprio PC (`server/contas.ts`, contrato
   * em `shared/net/auth.ts`). Só o esqueleto por decisão do dono — criar conta, entrar, sair; sem
   * progressão migrada do `localStorage` ainda. `LimiteLogin` é a régua de tentativas, separada do `Guard`
   * do WebSocket e do balde da `Telemetria`: o risco aqui (alguém testando senha) pede um teto mais apertado.
   */
  const dbCaminho = opts.dbContas ?? bancoDeContas(pastaDados(codigo));
  if (dbCaminho !== ':memory:') mkdirSync(dirname(dbCaminho), { recursive: true });
  const contas = new Contas(dbCaminho);
  // A cópia de segurança do banco (`server/backupContas.ts`): uma ao subir e outra a cada poucas horas (a do dia é substituída pela mais nova). Sem pasta de dados (testes em memória), nada em disco.
  const fazerCopia = (): void => {
    if (!dirDados || dbCaminho === ':memory:') return;
    try {
      const r = fazerBackup(contas, dirDados, new Date());
      log(`cópia de segurança das contas: ${r.arquivo}${r.apagados.length ? ` (apaguei ${r.apagados.length} antiga${r.apagados.length === 1 ? '' : 's'})` : ''}`);
    } catch (err) {
      log(`não consegui fazer a cópia de segurança das contas: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  fazerCopia();
  const backupTimer = dirDados && dbCaminho !== ':memory:' ? setInterval(fazerCopia, opts.backupCadaMs ?? 6 * 60 * 60 * 1000) : null;
  backupTimer?.unref();
  // A faxina das sessões vencidas e da atividade de mais de 400 dias (P185): ao subir e a cada 6 horas; nada disso corre no laço de 60 Hz.
  const faxinar = (): void => {
    try {
      contas.limparExpiradas();
      auditoria.podar();
    } catch (err) {
      log(`não consegui varrer sessões e atividade vencidas: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  faxinar();
  const faxinaTimer = setInterval(faxinar, 6 * 60 * 60 * 1000);
  faxinaTimer.unref();
  // A trilha de auditoria (P196): quem fez o quê de sensível, sem e-mail nem IP (`server/auditoria.ts`). Acesso repetido ao mesmo lugar pelo mesmo ator conta uma vez a cada 10 minutos (o painel consulta a toda hora).
  const auditoria = new Auditoria(dirDados ? join(dirDados, AUDITORIA_PASTA) : null);
  auditoria.podar();
  const ultimaAuditoria = new Map<string, number>();
  const auditar = (ev: { ator: string; acao: Acao; alvo?: string; ok?: boolean }, janelaMs = 0): void => {
    if (janelaMs > 0) {
      const chave = `${ev.ator}|${ev.acao}|${ev.alvo ?? ''}|${ev.ok ?? true}`;
      const agora = Date.now();
      if (agora - (ultimaAuditoria.get(chave) ?? 0) < janelaMs) return;
      if (ultimaAuditoria.size > 2000) ultimaAuditoria.clear();
      ultimaAuditoria.set(chave, agora);
    }
    auditoria.registrar(ev);
  };
  const falhasPorConta = new FalhasPorConta();
  /** P106: a sessão de uma conta admin vale onde a chave do dono vale (admin, mural, métricas). Nunca lança. */
  const sessaoDeAdmin = (token: unknown): boolean => {
    if (typeof token !== 'string' || token.length < 8 || token.length > 200) return false;
    try {
      return contas.validarSessao(token)?.is_admin === true;
    } catch {
      return false;
    }
  };
  const visibilidade = new ArmazemDeVisibilidade(dirDados);
  const regras = new ArmazemDeRegras(dirDados, opts.regrasIniciais);
  regras.aoMudar((r) => {
    for (const sala of rooms.values()) sala.aplicarRegras(r);
    log(`regras das salas online: ${r.dificuldade}, ${r.mechs} Mech(s), ${r.androides} andróide(s), ${r.atacantes} atacante(s) ao mesmo tempo`);
  });
  /** Quem está batendo à porta do dono: o número da conta (sessão de uma conta, no cabeçalho da sessão ou no das métricas), o dono (a chave do servidor) ou ninguém conhecido. */
  const atorDoPedido = (req: { headers: Record<string, string | string[] | undefined> }): string => {
    for (const h of [SESSAO_HEADER, METRICAS_HEADER]) {
      const t = req.headers[h];
      const c = typeof t === 'string' && t.length >= 8 && t.length <= 200 ? contas.validarSessao(t) : null;
      if (c) return `conta:${c.id}`;
    }
    return metricasToken && tokenConfere(req.headers[METRICAS_HEADER], metricasToken) ? 'dono' : 'anonimo';
  };
  const limiteLogin = new LimiteLogin(opts.limiteLogin);
  // Esqueci a senha (P206): 5 pedidos por hora por IP, 3 por hora por conta (de onde vierem) e 50 e-mails por dia no total (a cota do provedor).
  const mailer: Mailer | null = opts.mailer !== undefined ? opts.mailer : carregarMailer(dirDados, process.env, log);
  const siteUrl = opts.siteUrl ?? process.env.CYBERMECH_SITE_URL ?? 'https://cybermech.online';
  const limiteEsqueci = new LimiteLogin({ teto: 5, janelaMs: 60 * 60 * 1000, ...opts.limiteEsqueci });
  const pedidosPorConta = new FalhasPorConta({ teto: 3, janelaMs: 60 * 60 * 1000 });
  const tetoEmail = new TetoDiario();
  /** O trabalho do pedido (banco e envio), DEPOIS de a resposta sair: o tempo da resposta não diz se o e-mail tem conta. Nunca lança; o log diz só o número da conta. */
  const enviarLinkDeSenha = async (email: string, lang: IdiomaEmail): Promise<void> => {
    try {
      if (!mailer || !contas.temConta(email)) return;
      if (!tetoEmail.tentar()) {
        log(`recuperação de senha: teto de ${EMAILS_POR_DIA} e-mails por dia atingido; não enviei`);
        return;
      }
      const r = contas.pedirRedefinicao(email);
      if (!r) return;
      auditar({ ator: 'anonimo', acao: 'senha_recuperacao_pedida', alvo: `conta:${r.contaId}` });
      const ok = await mailer.enviar({ para: email, ...emailDeRedefinicao(lang, urlDeRedefinicao(siteUrl, r.token, lang)) });
      log(`recuperação de senha: e-mail ${ok ? 'enviado' : 'NÃO enviado'} (conta ${r.contaId})`);
    } catch {
      log('recuperação de senha: erro inesperado ao preparar o e-mail');
    }
  };
  const origens = opts.origens ?? origensExtras(process.env.CYBERMECH_ORIGENS);

  const http = createServer(async (req, res) => {
    const path = (req.url ?? '/').split('?')[0];
    // O painel do servidor (P93): só responde com o token do dono; o que não for dele segue para as rotas abaixo.
    if (admin && path.startsWith(ADMIN_PREFIXO)) {
      const tratou = await admin.tratar(req, res, path);
      if (tratou) {
        auditar({ ator: atorDoPedido(req), acao: 'admin_acesso', alvo: 'rota:admin', ok: res.statusCode < 400 }, 10 * 60_000);
        return;
      }
    }
    if (path === PLAY_PATH) {
      res.setHeader('access-control-allow-origin','*');
      res.setHeader('cache-control','no-store');
      if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':`content-type, ${SESSAO_HEADER}`});res.end();return;}
      if(req.method!=='POST'){res.writeHead(405);res.end();return;}
      const body=await lerCorpoLimitado(req,1024);
      if(body==='grande'){res.writeHead(413);res.end();return;}
      let report;try{report=parsePlayReport(JSON.parse(body.toString('utf8')));}catch{report=null;}
      if(!report||!parseLoadoutKey(report.build)){res.writeHead(400);res.end();return;}
      const ip=clientIp(req.socket.remoteAddress,req.headers['cf-connecting-ip']);
      if(telemetria.registrar('partida_resumo',ip,Date.now(),clientCountry(req.socket.remoteAddress,req.headers['cf-ipcountry']),'play:'+report.id)==='taxa'){res.writeHead(429);res.end();return;}
      // Com a sessão de uma conta (P185), a rodada também entra na atividade do piloto; sem sessão (ou com uma vencida) ela vale como a de um convidado. O reenvio da mesma rodada não conta duas vezes.
      const sessaoDaPartida=req.headers[SESSAO_HEADER];
      const dona=typeof sessaoDaPartida==='string'?contas.validarSessao(sessaoDaPartida):null;
      const repetida=playMetrics.jaVisto(report.id);
      playMetrics.record(report,Date.now(),!!dona);
      if(dona&&!repetida)contas.registrarPartida(dona.id,{segundos:report.seconds,abates:report.kills,mortes:report.deaths});
      res.writeHead(204);res.end();return;
    }
    // O que os jogadores veem (P191): público e sem token (é o que o jogo pergunta ao abrir); só o dono grava, por `/admin/visibilidade`.
    if (path === VISIBILIDADE_PATH && (req.method === 'GET' || req.method === 'OPTIONS')) {
      const cabecalhos = { 'access-control-allow-origin': '*', 'cache-control': 'no-store' };
      if (req.method === 'OPTIONS') {
        res.writeHead(204, { ...cabecalhos, 'access-control-allow-methods': 'GET, OPTIONS' });
        res.end();
        return;
      }
      const corpoVisibilidade = JSON.stringify(visibilidade.atual());
      res.writeHead(200, { ...cabecalhos, 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(corpoVisibilidade) });
      res.end(corpoVisibilidade);
      return;
    }
    if (path === STATUS_PATH) {
      const body = status();
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'access-control-allow-origin': '*',
        'content-length': Buffer.byteLength(body),
      });
      res.end(req.method === 'HEAD' ? undefined : body);
      return;
    }
    if (path === RESUMO_PATH && req.method === 'GET') {
      const body = JSON.stringify(telemetria.resumo());
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'access-control-allow-origin': '*',
      });
      res.end(body);
      return;
    }
    if (path === METRICAS_PATH) {
      // Porta privada do dono: origem das conexões por país e por dia. Sem token configurado, ela nem existe.
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, OPTIONS',
          'access-control-allow-headers': METRICAS_HEADER,
        });
        res.end();
        return;
      }
      if (!metricasToken || req.method !== 'GET') {
        res.writeHead(404, { 'access-control-allow-origin': '*' });
        res.end();
        return;
      }
      const ip = clientIp(req.socket.remoteAddress, req.headers['cf-connecting-ip']);
      if (!limiteMetricas.permitir(ip)) {
        res.writeHead(429, { 'access-control-allow-origin': '*' });
        res.end();
        return;
      }
      if (!tokenConfere(req.headers[METRICAS_HEADER], metricasToken) && !sessaoDeAdmin(req.headers[METRICAS_HEADER])) {
        auditar({ ator: 'anonimo', acao: 'admin_acesso', alvo: 'rota:metricas', ok: false }, 10 * 60_000);
        res.writeHead(401, { 'access-control-allow-origin': '*', 'cache-control': 'no-store' });
        res.end();
        return;
      }
      auditar({ ator: atorDoPedido(req), acao: 'admin_acesso', alvo: 'rota:metricas', ok: true }, 10 * 60_000);
      const body = JSON.stringify({...telemetria.metricas(),play:playMetrics.snapshot(),usuarios:contas.metricasUsuarios(),audiencia:audiencia.resumo(),auditoria:auditoria.recentes(40),runtime:{rssMB:process.memoryUsage().rss/1048576,rooms:rooms.size,players:jogadoresAgora()}});
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'access-control-allow-origin': '*',
      });
      res.end(body);
      return;
    }
    if (path === EVENTO_PATH && req.method === 'POST') {
      const ip = clientIp(req.socket.remoteAddress, req.headers['cf-connecting-ip']);
      const corpo = await lerCorpoLimitado(req, EVENTO_MAX_BYTES);
      if (corpo === 'grande') {
        res.writeHead(413, { 'access-control-allow-origin': '*' });
        res.end();
        return;
      }
      let evento: EventoEnviado | null = null;
      try {
        evento = parseEvento(JSON.parse(corpo.toString('utf8') || '{}'));
      } catch {
        evento = null;
      }
      if (!evento) {
        res.writeHead(400, { 'access-control-allow-origin': '*' });
        res.end();
        return;
      }
      const pais = clientCountry(req.socket.remoteAddress, req.headers['cf-ipcountry']);
      const eventoId = evento.seq === undefined ? undefined : `${evento.aba}:${evento.seq}`;
      const ok = telemetria.registrar(evento.nome, ip, Date.now(), pais, eventoId) === 'ok';
      // A audiência (P193): o contexto que o evento trouxe (só categorias) e o estado do Brasil que a Cloudflare disse. Só entra o que a régua de taxa por IP deixou contar.
      if (ok && evento.ctx) audiencia.registrar(evento.nome, evento.ctx, clientRegion(req.socket.remoteAddress, pais, req.headers['cf-region-code']), Date.now(), eventoId);
      res.writeHead(ok ? 204 : 429, { 'access-control-allow-origin': '*' });
      res.end();
      return;
    }
    if (path === EVENTO_PATH && req.method === 'OPTIONS') {
      // Preflight do CORS: o navegador manda antes do POST cross-origin com content-type: application/json.
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
      });
      res.end();
      return;
    }
    // Rotas de conta: só as páginas do jogo (e a rede local) podem chamá-las; o CORS devolve a origem do pedido, nunca `*`.
    const cors = corsDoPedido(req.headers.origin, origens);
    if (
      (path === CONTA_CRIAR_PATH || path === CONTA_ENTRAR_PATH || path === CONTA_SAIR_PATH || path === CONTA_EU_PATH || path === CONTA_PROGRESSO_PATH || path === CONTA_DADOS_PATH || path === CONTA_APAGAR_PATH || path === CONTA_MEDICAO_PATH || path === CONTA_ESQUECI_PATH || path === CONTA_REDEFINIR_PATH) &&
      !origemPermitida(req.headers.origin, origens)
    ) {
      res.writeHead(403, { 'content-type': 'application/json; charset=utf-8', ...cors });
      res.end(JSON.stringify({ erro: 'origem não permitida' }));
      return;
    }
    if (path === CONTA_CRIAR_PATH || path === CONTA_ENTRAR_PATH || path === CONTA_ESQUECI_PATH || path === CONTA_REDEFINIR_PATH) {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          ...cors,
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': 'content-type',
        });
        res.end();
        return;
      }
      if (req.method !== 'POST') {
        res.writeHead(405, { ...cors });
        res.end();
        return;
      }
      const ip = clientIp(req.socket.remoteAddress, req.headers['cf-connecting-ip']);
      if (!limiteLogin.permitir(ip)) {
        res.writeHead(429, { 'content-type': 'application/json; charset=utf-8', ...cors });
        res.end(JSON.stringify({ erro: 'tentativas demais; espere um pouco' }));
        return;
      }
      const corpo = await lerCorpoLimitado(req, 1024);
      const enviarJson = (codigo: number, dados: unknown) => {
        res.writeHead(codigo, { 'content-type': 'application/json; charset=utf-8', ...cors });
        res.end(JSON.stringify(dados));
      };
      if (corpo === 'grande') {
        enviarJson(413, { erro: 'pedido grande demais' });
        return;
      }
      let json: unknown = null;
      try {
        json = JSON.parse(corpo.toString('utf8') || '{}');
      } catch {
        json = null;
      }
      const paisDaConta = clientCountry(req.socket.remoteAddress, req.headers['cf-ipcountry']);
      if (path === CONTA_ESQUECI_PATH) {
        const p = parseEsqueci(json);
        if (!p) {
          enviarJson(400, { erro: 'e-mail inválido' });
          return;
        }
        if (!mailer) {
          enviarJson(503, { erro: 'a recuperação por e-mail ainda não está ativa', codigo: 'sem-email' });
          return;
        }
        if (!limiteEsqueci.permitir(ip)) {
          enviarJson(429, { erro: 'pedidos demais; espere um pouco' });
          return;
        }
        // A mesma resposta exista a conta ou não, e ela sai ANTES do trabalho: nem o texto nem o tempo dizem se o e-mail tem conta.
        enviarJson(202, { ok: true });
        if (pedidosPorConta.bloqueada(p.email)) return;
        pedidosPorConta.falhou(p.email);
        void enviarLinkDeSenha(p.email, p.lang);
        return;
      }
      if (path === CONTA_REDEFINIR_PATH) {
        const p = parseRedefinir(json);
        const TOKEN_RUIM = { erro: 'este link não vale mais: peça outro em "Esqueci a senha"', codigo: 'token' };
        if (!p.ok) {
          enviarJson(400, p.motivo === 'senha' ? { erro: p.senha, codigo: 'senha' } : TOKEN_RUIM);
          return;
        }
        const r = await contas.redefinirSenha(p.token, p.senha);
        if (!r.ok) {
          enviarJson(400, TOKEN_RUIM);
          return;
        }
        falhasPorConta.acertou(r.conta.email); // a conta destrancada: a senha nova vale já
        log(`senha redefinida (conta ${r.conta.id}); as sessões abertas foram encerradas`);
        auditar({ ator: `conta:${r.conta.id}`, acao: 'senha_redefinida', alvo: `conta:${r.conta.id}` });
        enviarJson(200, { ok: true });
        return;
      }
      if (path === CONTA_CRIAR_PATH) {
        // Criar conta exige o aceite da política de privacidade e a declaração de idade (P192, LGPD): sem as duas caixas, ou com a política velha, não cria.
        const leitura = parseCriarConta(json);
        if (!leitura.ok) {
          if (leitura.motivo === 'aceite') enviarJson(400, { erro: 'aceite a política de privacidade e confirme a idade para criar a conta', codigo: 'aceite' });
          else if (leitura.motivo === 'versao') enviarJson(409, { erro: 'a política de privacidade mudou: recarregue a página', codigo: 'versao' });
          else enviarJson(400, { erro: 'e-mail ou senha inválidos' });
          return;
        }
        const r = await contas.criar(leitura.email, leitura.senha, Date.now(), POLITICA_VERSAO);
        if (!r.ok) {
          enviarJson(409, { erro: 'este e-mail já tem conta' });
          return;
        }
        const token = contas.criarSessao(r.conta.id);
        // O e-mail é dado pessoal e o log fica em arquivo: o log diz só que uma conta nasceu (P192).
        log(`conta criada (número ${r.conta.id})`);
        contar('conta_criada', paisDaConta);
        auditar({ ator: `conta:${r.conta.id}`, acao: 'conta_criada', alvo: `conta:${r.conta.id}` });
        enviarJson(201, { token, email: r.conta.email, medir: true });
        return;
      }
      const credenciais = parseCredenciais(json);
      if (!credenciais) {
        enviarJson(400, { erro: 'e-mail ou senha inválidos' });
        return;
      }
      // CONTA_ENTRAR_PATH: a mesma mensagem para "não existe" e "senha errada" — não ajuda ninguém a
      // descobrir por tentativa se um e-mail está cadastrado.
      // O limite por CONTA (P196): senhas demais erradas, de onde vierem, trancam a conta por 15 min (a senha certa nem é conferida).
      if (falhasPorConta.bloqueada(credenciais.email)) {
        enviarJson(429, { erro: 'tentativas demais nesta conta; espere um pouco' });
        return;
      }
      const conta = await contas.autenticar(credenciais.email, credenciais.senha);
      if (!conta) {
        falhasPorConta.falhou(credenciais.email);
        contar('login_falhou', paisDaConta);
        enviarJson(401, { erro: 'e-mail ou senha incorretos' });
        return;
      }
      falhasPorConta.acertou(credenciais.email);
      const token = contas.criarSessao(conta.id);
      contar('login_ok', paisDaConta);
      enviarJson(200, { token, email: conta.email, medir: conta.medir });
      return;
    }
    if (path === CONTA_SAIR_PATH && (req.method === 'POST' || req.method === 'OPTIONS')) {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          ...cors,
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': `content-type, ${SESSAO_HEADER}`,
        });
        res.end();
        return;
      }
      const token = req.headers[SESSAO_HEADER];
      if (typeof token === 'string') contas.encerrarSessao(token);
      res.writeHead(204, { ...cors });
      res.end();
      return;
    }
    // O navegador de outra origem (o jogo em cybermech.online, o servidor em jogo.cybermech.online) faz o preflight antes de qualquer chamada com o cabeçalho da sessão.
    if ((path === CONTA_EU_PATH || path === CONTA_PROGRESSO_PATH || path === CONTA_DADOS_PATH || path === CONTA_APAGAR_PATH || path === CONTA_MEDICAO_PATH) && req.method === 'OPTIONS') {
      res.writeHead(204, {
        ...cors,
        'access-control-allow-methods': path === CONTA_EU_PATH || path === CONTA_DADOS_PATH ? 'GET, OPTIONS' : path === CONTA_PROGRESSO_PATH ? 'GET, PUT, OPTIONS' : 'POST, OPTIONS',
        'access-control-allow-headers': `content-type, ${SESSAO_HEADER}`,
      });
      res.end();
      return;
    }
    // O progresso do piloto (P174): o que o navegador já guardava (apelido, nível, XP, créditos, montagem), por conta, para seguir entre aparelhos. Só com sessão; não vale para ranking (G13).
    if (path === CONTA_PROGRESSO_PATH && (req.method === 'GET' || req.method === 'PUT')) {
      const token = req.headers[SESSAO_HEADER];
      const conta = typeof token === 'string' ? contas.validarSessao(token) : null;
      const enviarJson = (codigo: number, dados: unknown) => {
        res.writeHead(codigo, { 'content-type': 'application/json; charset=utf-8', ...cors, 'cache-control': 'no-store' });
        res.end(JSON.stringify(dados));
      };
      if (!conta) {
        enviarJson(401, { erro: 'sem sessão' });
        return;
      }
      if (req.method === 'GET') {
        const guardado = contas.lerProgresso(conta.id);
        enviarJson(200, { progresso: guardado ? (JSON.parse(guardado) as unknown) : null });
        return;
      }
      const corpo = await lerCorpoLimitado(req, PROGRESSO_MAX_BYTES);
      if (corpo === 'grande') {
        enviarJson(413, { erro: 'pedido grande demais' });
        return;
      }
      let progresso = null;
      try {
        progresso = validarProgresso(JSON.parse(corpo.toString('utf8') || '{}'), sanitizeName);
      } catch {
        progresso = null;
      }
      if (!progresso) {
        enviarJson(400, { erro: 'progresso inválido' });
        return;
      }
      contas.gravarProgresso(conta.id, JSON.stringify(progresso));
      enviarJson(200, { progresso });
      return;
    }
    if (path === CONTA_EU_PATH && req.method === 'GET') {
      const token = req.headers[SESSAO_HEADER];
      const conta = typeof token === 'string' ? contas.validarSessao(token) : null;
      if (conta) contas.registrarVisita(conta.id);
      res.writeHead(conta ? 200 : 401, {
        'content-type': 'application/json; charset=utf-8',
        ...cors,
        'cache-control': 'no-store',
      });
      res.end(conta ? JSON.stringify({ email: conta.email, is_admin: conta.is_admin, medir: conta.medir }) : JSON.stringify({ erro: 'sem sessão' }));
      return;
    }
    // Os direitos do titular (P192, LGPD art. 18): baixar os próprios dados, apagar a conta, escolher se a atividade é medida. Todos com a sessão da própria conta.
    if (
      (path === CONTA_DADOS_PATH && req.method === 'GET') ||
      ((path === CONTA_APAGAR_PATH || path === CONTA_MEDICAO_PATH) && req.method === 'POST')
    ) {
      const token = req.headers[SESSAO_HEADER];
      const conta = typeof token === 'string' ? contas.validarSessao(token) : null;
      const enviarJson = (codigo: number, dados: unknown, extra: Record<string, string> = {}) => {
        res.writeHead(codigo, { 'content-type': 'application/json; charset=utf-8', ...cors, 'cache-control': 'no-store', ...extra });
        res.end(JSON.stringify(dados));
      };
      if (!conta) {
        enviarJson(401, { erro: 'sem sessão' });
        return;
      }
      const pais = clientCountry(req.socket.remoteAddress, req.headers['cf-ipcountry']);
      if (path === CONTA_DADOS_PATH) {
        const dados = contas.exportarDados(conta.id);
        if (!dados) {
          enviarJson(404, { erro: 'conta não encontrada' });
          return;
        }
        contar('dados_baixados', pais);
        auditar({ ator: `conta:${conta.id}`, acao: 'dados_baixados', alvo: `conta:${conta.id}` });
        enviarJson(200, dados, { 'content-disposition': 'attachment; filename="cybermech-meus-dados.json"' });
        return;
      }
      const corpo = await lerCorpoLimitado(req, 256);
      if (corpo === 'grande') {
        enviarJson(413, { erro: 'pedido grande demais' });
        return;
      }
      let json: unknown = null;
      try {
        json = JSON.parse(corpo.toString('utf8') || '{}');
      } catch {
        json = null;
      }
      if (path === CONTA_MEDICAO_PATH) {
        const ativa = parseMedicao(json);
        if (ativa === null) {
          enviarJson(400, { erro: 'pedido inválido' });
          return;
        }
        contas.definirMedicao(conta.id, ativa);
        auditar({ ator: `conta:${conta.id}`, acao: 'medicao_alterada', alvo: `medir:${ativa ? 'on' : 'off'}` });
        enviarJson(200, { ativa });
        return;
      }
      // Apagar a conta: confirma com a senha (a mesma régua de tentativas do login, por IP: uma sessão esquecida aberta não vira um jeito de adivinhar a senha) e não se desfaz.
      const ip = clientIp(req.socket.remoteAddress, req.headers['cf-connecting-ip']);
      if (!limiteLogin.permitir(ip)) {
        enviarJson(429, { erro: 'tentativas demais; espere um pouco' });
        return;
      }
      if (falhasPorConta.bloqueada(conta.email)) {
        enviarJson(429, { erro: 'tentativas demais nesta conta; espere um pouco' });
        return;
      }
      const senha = parseSenhaDeConfirmacao(json);
      const confere = senha ? await contas.autenticar(conta.email, senha) : null;
      if (!confere || confere.id !== conta.id) {
        falhasPorConta.falhou(conta.email);
        auditar({ ator: `conta:${conta.id}`, acao: 'conta_apagada', alvo: `conta:${conta.id}`, ok: false }, 10 * 60_000);
        enviarJson(401, { erro: 'senha incorreta' });
        return;
      }
      falhasPorConta.acertou(conta.email);
      auditar({ ator: `conta:${conta.id}`, acao: 'conta_apagada', alvo: `conta:${conta.id}` });
      contas.apagarConta(conta.id);
      log(`conta apagada a pedido do titular (número ${conta.id})`);
      contar('conta_apagada', pais);
      enviarJson(200, { apagada: true });
      return;
    }
    if (path === CONFIG_PATH && req.method === 'GET') {
      const urlParams = new URL(req.url ?? '/', 'http://localhost').searchParams;
      const chaveConfig = urlParams.get('chave') || 'chassis_status';
      // Só as chaves conhecidas (`CONFIG_CHAVES`): esta rota é pública e antes entregava QUALQUER nome guardado.
      if (!chaveDeConfigValida(chaveConfig)) {
        res.writeHead(400, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': 'no-store' });
        res.end('{}');
        return;
      }
      const configValor = contas.getConfig(chaveConfig);
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'access-control-allow-origin': '*',
        'cache-control': 'no-store',
      });
      res.end(configValor || '{}');
      return;
    }
    if (path === ADMIN_CONFIG_PATH) {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': `content-type, ${SESSAO_HEADER}`,
        });
        res.end();
        return;
      }
      if (req.method !== 'POST') {
        res.writeHead(405, { 'access-control-allow-origin': '*' });
        res.end();
        return;
      }
      const token = req.headers[SESSAO_HEADER];
      const conta = typeof token === 'string' ? contas.validarSessao(token) : null;
      if (!conta || !conta.is_admin) {
        auditar({ ator: conta ? `conta:${conta.id}` : 'anonimo', acao: 'admin_config', ok: false }, 10 * 60_000);
        res.writeHead(403, { 'access-control-allow-origin': '*' });
        res.end();
        return;
      }
      const corpo = await lerCorpoLimitado(req, 1024 * 10);
      if (corpo === 'grande') {
        res.writeHead(413, { 'access-control-allow-origin': '*' });
        res.end();
        return;
      }
      try {
        const payload = JSON.parse(corpo.toString('utf8'));
        if (chaveDeConfigValida(payload.chave) && valorDeConfigValido(payload.valor)) {
          contas.setConfig(payload.chave, payload.valor);
          auditar({ ator: `conta:${conta.id}`, acao: 'admin_config', alvo: `config:${payload.chave}` });
          res.writeHead(200, { 'access-control-allow-origin': '*' });
          res.end('ok');
          return;
        }
        auditar({ ator: `conta:${conta.id}`, acao: 'admin_config', ok: false }, 10 * 60_000);
      } catch {}
      res.writeHead(400, { 'access-control-allow-origin': '*' });
      res.end();
      return;
    }
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`CYBERMECH · servidor de jogo · ${rooms.size} sala(s)\n`);
  });
  // Origem de fora (outro site usando o navegador do visitante) é recusada no aperto de mão, antes de ocupar vaga (`origem.ts`).
  const wss = new WebSocketServer({
    server: http,
    maxPayload: MAX_MESSAGE_VOZ,
    verifyClient: ({ origin }: { origin: string }) => origemPermitida(origin || undefined, origens),
  });

  wss.on('connection', (ws: WebSocket, req) => {
    const ip = clientIp(req.socket.remoteAddress, req.headers['cf-connecting-ip']);
    const pais = clientCountry(req.socket.remoteAddress, req.headers['cf-ipcountry']);
    // O mural de câmeras do Comandante (`/?mural=1`): não é sala, não ocupa vaga e não entra na telemetria; só passa pelo teto por IP.
    if (ehPedidoDeMural(req.url)) {
      if (!mural || guard.admit(ip) !== 'ok') {
        ws.close(4013, 'mural');
        return;
      }
      let solto = false;
      const soltar = () => {
        if (solto) return;
        solto = true;
        guard.remove(ip);
      };
      ws.on('close', soltar);
      ws.on('error', soltar);
      mural.receber(ws, ip);
      return;
    }
    const asked = roomCode(req.url);
    if (!asked) {
      ws.close(1008, 'sala');
      return;
    }
    const admit = guard.admit(ip);
    if (admit !== 'ok') {
      if (admit === 'total') rejected.total++;
      else rejected.ip++;
      log(`recusa de ${ipParaLog(ip)}: ${admit}`);
      contar('recusa_limite', pais);
      // 4013 = "tente mais tarde" (código de aplicação, aceito no navegador e no `ws` do Node).
      ws.close(4013, admit);
      return;
    }
    if (!ehSalaDeTeste(asked)) contar('conexao_online', pais);
    const code = pickRoom(asked);
    occupancy.set(code, (occupancy.get(code) ?? 0) + 1);
    let doCodigo = sockets.get(code);
    if (!doCodigo) sockets.set(code, (doCodigo = new Set()));
    doCodigo.add(ws);
    const bucket = guard.peer(ip, performance.now());
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      guard.remove(ip);
      occupancy.set(code, Math.max(0, (occupancy.get(code) ?? 1) - 1));
      const restantes = sockets.get(code);
      restantes?.delete(ws);
      if (restantes && restantes.size === 0) sockets.delete(code);
    };
    const peer: Peer = {
      send: (bytes) => {
        if (ws.readyState !== ws.OPEN) return;
        trafego.saidaBytes += bytes.length;
        ws.send(Buffer.from(bytes));
      },
      close: () => ws.close(1000),
      pais,
    };
    // As mensagens esperam a sala ficar pronta, na ordem em que chegaram.
    const room = roomFor(code);
    let flooded = false;
    let descartando = false;
    ws.on('message', (data, isBinary) => {
      if (!isBinary || flooded) return;
      const veredito = guard.judge(bucket, performance.now());
      if (veredito === 'cut') {
        flooded = true;
        rejected.flood++;
        log(`corte de ${ipParaLog(ip)}: taxa alta demais`);
        // 4008 = corte por taxa (código de aplicação; o navegador só deixa a página usar 3000-4999).
        ws.close(4008, 'taxa');
        return;
      }
      if (veredito === 'drop') {
        // Um pico (o servidor travou por segundos e tudo chegou junto): perde-se o excesso, a conexão segue. Um aviso por pico, não por mensagem.
        if (!descartando) {
          descartando = true;
          rejected.picos++;
          log(`descarte de ${ipParaLog(ip)}: pico de mensagens (a conexão segue)`);
        }
        return;
      }
      descartando = false;
      const bytes = data instanceof Buffer ? data : Buffer.concat(Array.isArray(data) ? data : [Buffer.from(data as ArrayBuffer)]);
      // Só a voz pode passar de 1 KB; mensagem de jogo grande demais derruba a conexão, como antes (G7).
      if (bytes.length > MAX_MESSAGE && !ehMensagemDeVoz(bytes[0] ?? 0)) {
        ws.close(1009, 'tamanho');
        return;
      }
      trafego.entradaBytes += bytes.length;
      void room.then((r) => r.receive(peer, bytes));
    });
    ws.on('close', () => {
      release();
      void room.then((r) => r.leave(peer));
    });
    ws.on('error', () => {
      release();
      ws.terminate();
    });
  });

  const host = opts.host ?? DEFAULT_HOST;
  await new Promise<void>((resolve) => http.listen(opts.port ?? 2567, host, resolve));
  const port = (http.address() as AddressInfo).port;

  /** Fecha uma sala de verdade (a do teste do painel e a que o dono mandar): quem estava nela cai e o cliente reconecta numa nova. */
  const fecharSala = (codigo: string): boolean => {
    const sala = rooms.get(codigo);
    if (!sala) return false;
    for (const ws of sockets.get(codigo) ?? []) ws.close(1001, 'sala fechada');
    sockets.delete(codigo);
    rooms.delete(codigo);
    emptyFor.delete(codigo);
    occupancy.delete(codigo);
    sala.dispose();
    log(`sala ${codigo} fechada`);
    return true;
  };
  const supervisionado = opts.supervisionado ?? false;
  admin = new Admin({
    token: metricasToken,
    contaAdmin: sessaoDeAdmin,
    regras: { atual: () => regras.atual(), gravar: (x) => regras.gravar(x) },
    gravarVisibilidade: (itens) => {
      statusAt = 0; // o /status leva a visibilidade: a próxima resposta já traz a nova
      return visibilidade.gravar(itens);
    },
    amostrador,
    estado: () =>
      montarEstado(
        {
          salas: () => rooms.values(),
          release: opts.release ?? 'desconhecida',
          iniciadoEm: startedAt,
          porta: port,
          supervisionado,
          conexoes: () => wss.clients.size,
          recusas: () => ({ total: rejected.total, ip: rejected.ip, taxa: rejected.flood }),
          contas: () => {
            try {
              return contas.total();
            } catch {
              return null;
            }
          },
          reiniciando: () => admin?.estaReiniciando ?? false,
        },
        amostrador,
      ),
    lerLog: () => lerFimDoLog(dirDados, logMemoria.linhas()),
    jogadores: jogadoresAgora,
    contexto: () => ({ uptimeS: (Date.now() - startedAt) / 1000, recusasPorTaxa: rejected.flood }),
    fecharSala,
    testar: () => executarTeste({ host: '127.0.0.1', porta: port, duracaoS: opts.testeDuracaoS, tickMsDaSala: (c) => rooms.get(c)?.tickMs ?? null, fecharSala }),
    // Sem gancho de reinício a rota responde 501 (o Admin olha se o gancho existe): só embrulha quando há.
    aoReiniciar: opts.aoReiniciar
      ? (motivo) => {
          auditar({ ator: 'sistema', acao: 'servidor_reiniciado', alvo: 'motivo:' + motivo.replace(/[^A-Za-z0-9_.:+-]/g, '_').slice(0, 40) });
          opts.aoReiniciar?.(motivo);
        }
      : undefined,
    reinicioEmMs: opts.reinicioEmMs,
    ...(opts.limiteAdmin ? { limite: new LimiteDeFalhas(opts.limiteAdmin.teto, opts.limiteAdmin.janelaMs) } : {}),
    supervisionado,
    anotar: log,
    clientIp: (req) => clientIp(req.socket.remoteAddress, req.headers['cf-connecting-ip']),
    lerCorpo: lerCorpoLimitado,
  });
  amostrador.ligar(opts.amostraCadaMs);
  mural = new Mural({
    salas: () => rooms.values(),
    verificar: (ip, token) => admin?.autenticar(ip, token) ?? 'desligado',
    aoEnviar: (n) => {
      trafego.saidaBytes += n;
    },
    log,
    ...opts.mural,
  });

  // O laço: passos fixos de 1/60 s, todas as salas juntas; no máximo 4 passos por volta (engasgo não vira bola de neve).
  const stepMs = FIXED_DT * 1000;
  let last = performance.now();
  let acc = 0;
  const loop = setInterval(() => {
    const now = performance.now();
    acc += now - last;
    last = now;
    let n = 0;
    while (acc >= stepMs && n < 4) {
      for (const r of rooms.values()) r.step();
      acc -= stepMs;
      n++;
    }
    if (n === 4) acc = 0;
    for (const [code, r] of rooms) {
      if (r.humanCount > 0) {
        emptyFor.delete(code);
        continue;
      }
      const since = emptyFor.get(code) ?? now;
      emptyFor.set(code, since);
      if (now - since > EMPTY_ROOM_S * 1000) {
        rooms.delete(code);
        emptyFor.delete(code);
        r.dispose();
        log(`sala ${code} fechada (vazia)`);
      }
    }
  }, 4);

  const servidor: GameServer = {
    port,
    host,
    amostrador,
    mural: {
      get assistindo() {
        return mural?.assistindo ?? 0;
      },
      get conexoes() {
        return mural?.conexoes ?? 0;
      },
    },
    rooms,
    guard: {
      get connections() {
        return wss.clients.size;
      },
      rejected,
    },
    fecharComAviso: async ({ gracaS = REINICIO_AVISO_S, voltaEmS = REINICIO_VOLTA_EM_S } = {}) => {
      const jogando = [...sockets.values()].reduce((n, s) => n + s.size, 0);
      if (jogando > 0 && gracaS > 0) {
        const bytes = encodeAviso(new Writer(), { tipo: 'reinicio', segundos: gracaS, voltaEmS });
        for (const grupo of sockets.values()) for (const ws of grupo) if (ws.readyState === ws.OPEN) ws.send(Buffer.from(bytes));
        log(`reinício: avisei ${jogando} conexão(ões); corto em ${gracaS} s`);
        await new Promise<void>((ok) => setTimeout(ok, gracaS * 1000));
      }
      for (const c of wss.clients) if (c.readyState === c.OPEN) c.close(CLOSE_REINICIO, String(voltaEmS));
      if (wss.clients.size > 0) await new Promise<void>((ok) => setTimeout(ok, 300)); // o quadro de fechamento sai antes do `terminate`
      await servidor.close();
    },
    close: () =>
      new Promise<void>((resolve) => {
        clearInterval(loop);
        amostrador.parar();
        mural?.parar();
        if (salvarTimer) clearInterval(salvarTimer);
        if (backupTimer) clearInterval(backupTimer);
        clearInterval(faxinaTimer);
        gravarDados();
        for (const c of wss.clients) c.terminate();
        wss.close(() => http.close(() => resolve()));
        for (const r of rooms.values()) r.dispose();
        rooms.clear();
        contas.close();
      }),
  };
  return servidor;
}
