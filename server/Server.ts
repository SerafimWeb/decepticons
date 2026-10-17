import { PlayMetrics } from './PlayMetrics';
import { PLAY_PATH, parsePlayReport } from '../shared/net/playMetrics';
import { parseLoadoutKey } from '../client/src/hangar/loadout';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import { FIXED_DT } from '../client/src/physics/PhysicsWorld';
import { CONTA_CRIAR_PATH, CONTA_ENTRAR_PATH, CONTA_EU_PATH, CONTA_PROGRESSO_PATH, CONTA_SAIR_PATH, CONFIG_PATH, ADMIN_CONFIG_PATH, PROGRESSO_MAX_BYTES, parseCredenciais, SESSAO_HEADER, validarProgresso } from '../shared/net/auth';
import { ROOM_MAX, ROOM_SIZE } from '../shared/net/constants';
import { serverStatus, STATUS_PATH } from '../shared/net/status';
import { type EventoEnviado, type EventoServidor, EVENTO_MAX_BYTES, EVENTO_PATH, METRICAS_HEADER, METRICAS_PATH, parseEvento, RESUMO_PATH } from '../shared/net/telemetry';
import { sanitizeName, type RejectReason } from '../shared/net/messages';
import { ArenaRoom, type Peer } from './ArenaRoom';
import { Contas } from './contas';
import { clientCountry, clientIp, Guard, GUARD_DEFAULTS, type GuardConfig } from './guard';
import { LIMITE_LOGIN_DEFAULTS, LimiteLogin } from './login';
import { corsDoPedido, origemPermitida, origensExtras } from './origem';
import { bancoDeContas, pastaDados } from './dados';
import { carregarToken, DADOS_ARQUIVO, gravarJson, lerJson, TOKEN_ARQUIVO, tokenConfere } from './metricas';
import { Telemetria } from './telemetria';
import { ehPedidoDeMural, Mural } from './mural';
import { Admin, Amostrador, LimiteDeFalhas, lerFimDoLog, LogEmMemoria, montarEstado, type Trafego } from './admin';
import { ehSalaDeTeste, executarTeste } from './autoteste';
import { ADMIN_PREFIXO } from '../shared/net/admin';

/** Maior mensagem aceita de um cliente (a maior é o JOIN, ~90 bytes). Acima disso, a conexão cai (G7). */
const MAX_MESSAGE = 1024;
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
    rejected: { total: number; ip: number; flood: number };
  };
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
    /** Régua de tentativas de `/conta/entrar` e `/conta/criar` (padrão: 8 a cada 10 min por IP). Testes
     * que fazem muitas chamadas do mesmo IP alargam para não confundir rate limit com o que estão testando. */
    limiteLogin?: Partial<typeof LIMITE_LOGIN_DEFAULTS>;
    /** Origens extras (além do jogo no ar e da rede local) que podem abrir o WebSocket e as rotas de conta. Padrão: `CYBERMECH_ORIGENS` (`origem.ts`). */
    origens?: string[];
    /**
     * Pasta dos números que sobrevivem ao reinício (`telemetria.json`) e do token das métricas. Padrão: `CYBERMECH_DADOS`, ou
     * `.tmp/servidor/` ao lado do código (gitignored; `server/dados.ts`).
     * Testes que passam `dbContas: ':memory:'` ficam sem pasta (nada em disco) a menos que passem esta.
     */
    dirDados?: string;
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
  const rejected = { total: 0, ip: 0, flood: 0 };
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
      p = ArenaRoom.create(code).then((room) => {
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
    statusBody = JSON.stringify(serverStatus(players, abertas, (now - startedAt) / 1000));
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
  const codigo = resolve(import.meta.dirname, '..');
  const dirDados = opts.dirDados ?? (opts.dbContas === ':memory:' ? null : pastaDados(codigo));
  if (dirDados) log(`pasta de dados (contas.db, números, token): ${dirDados}`);
  const arquivoDados = dirDados ? join(dirDados, DADOS_ARQUIVO) : null;
  if (arquivoDados) telemetria.carregar(lerJson(arquivoDados));
  const playFile = dirDados ? join(dirDados,'partidas.json') : null;
  if (playFile) playMetrics.load(lerJson(playFile));
  /** Token do dono para `GET /metricas` (origem das conexões, por país e por dia). `null` = porta desligada. */
  const metricasToken = opts.metricasToken ?? (dirDados ? carregarToken(dirDados) : null);
  // Diz ONDE está o token (nunca o token): a pasta é a de onde o código do servidor roda, e o dono precisa achar o arquivo.
  if (metricasToken && dirDados) log(`métricas privadas ligadas: o token está em ${join(dirDados, TOKEN_ARQUIVO)} (ou na variável CYBERMECH_METRICAS_TOKEN)`);
  const limiteMetricas = new LimiteLogin({ teto: 30, janelaMs: 10 * 60 * 1000 });
  const gravarDados = (): void => {
    if (!arquivoDados || (!telemetria.sujo && !playMetrics.dirty)) return;
    try {
      gravarJson(arquivoDados, telemetria.exportar());
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
  /** P106: a sessão de uma conta admin vale onde a chave do dono vale (admin, mural, métricas). Nunca lança. */
  const sessaoDeAdmin = (token: unknown): boolean => {
    if (typeof token !== 'string' || token.length < 8 || token.length > 200) return false;
    try {
      return contas.validarSessao(token)?.is_admin === true;
    } catch {
      return false;
    }
  };
  const limiteLogin = new LimiteLogin(opts.limiteLogin);
  const origens = opts.origens ?? origensExtras(process.env.CYBERMECH_ORIGENS);

  const http = createServer(async (req, res) => {
    const path = (req.url ?? '/').split('?')[0];
    // O painel do servidor (P93): só responde com o token do dono; o que não for dele segue para as rotas abaixo.
    if (admin && path.startsWith(ADMIN_PREFIXO) && (await admin.tratar(req, res, path))) return;
    if (path === PLAY_PATH) {
      res.setHeader('access-control-allow-origin','*');
      res.setHeader('cache-control','no-store');
      if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type'});res.end();return;}
      if(req.method!=='POST'){res.writeHead(405);res.end();return;}
      const body=await lerCorpoLimitado(req,1024);
      if(body==='grande'){res.writeHead(413);res.end();return;}
      let report;try{report=parsePlayReport(JSON.parse(body.toString('utf8')));}catch{report=null;}
      if(!report||!parseLoadoutKey(report.build)){res.writeHead(400);res.end();return;}
      const ip=clientIp(req.socket.remoteAddress,req.headers['cf-connecting-ip']);
      if(telemetria.registrar('partida_resumo',ip,Date.now(),clientCountry(req.socket.remoteAddress,req.headers['cf-ipcountry']),'play:'+report.id)==='taxa'){res.writeHead(429);res.end();return;}
      playMetrics.record(report);res.writeHead(204);res.end();return;
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
        res.writeHead(401, { 'access-control-allow-origin': '*', 'cache-control': 'no-store' });
        res.end();
        return;
      }
      const body = JSON.stringify({...telemetria.metricas(),play:playMetrics.snapshot(),runtime:{rssMB:process.memoryUsage().rss/1048576,rooms:rooms.size,players:jogadoresAgora()}});
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
      const ok = telemetria.registrar(evento.nome, ip, Date.now(), clientCountry(req.socket.remoteAddress, req.headers['cf-ipcountry']), evento.seq === undefined ? undefined : `${evento.aba}:${evento.seq}`) === 'ok';
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
      (path === CONTA_CRIAR_PATH || path === CONTA_ENTRAR_PATH || path === CONTA_SAIR_PATH || path === CONTA_EU_PATH || path === CONTA_PROGRESSO_PATH) &&
      !origemPermitida(req.headers.origin, origens)
    ) {
      res.writeHead(403, { 'content-type': 'application/json; charset=utf-8', ...cors });
      res.end(JSON.stringify({ erro: 'origem não permitida' }));
      return;
    }
    if (path === CONTA_CRIAR_PATH || path === CONTA_ENTRAR_PATH) {
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
      let credenciais: { email: string; senha: string } | null = null;
      try {
        credenciais = parseCredenciais(JSON.parse(corpo.toString('utf8') || '{}'));
      } catch {
        credenciais = null;
      }
      if (!credenciais) {
        enviarJson(400, { erro: 'e-mail ou senha inválidos' });
        return;
      }
      if (path === CONTA_CRIAR_PATH) {
        const r = await contas.criar(credenciais.email, credenciais.senha);
        if (!r.ok) {
          enviarJson(409, { erro: 'este e-mail já tem conta' });
          return;
        }
        const token = contas.criarSessao(r.conta.id);
        log(`conta criada: ${r.conta.email}`);
        enviarJson(201, { token, email: r.conta.email });
        return;
      }
      // CONTA_ENTRAR_PATH: a mesma mensagem para "não existe" e "senha errada" — não ajuda ninguém a
      // descobrir por tentativa se um e-mail está cadastrado.
      const conta = await contas.autenticar(credenciais.email, credenciais.senha);
      if (!conta) {
        enviarJson(401, { erro: 'e-mail ou senha incorretos' });
        return;
      }
      const token = contas.criarSessao(conta.id);
      enviarJson(200, { token, email: conta.email });
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
    if ((path === CONTA_EU_PATH || path === CONTA_PROGRESSO_PATH) && req.method === 'OPTIONS') {
      res.writeHead(204, {
        ...cors,
        'access-control-allow-methods': path === CONTA_EU_PATH ? 'GET, OPTIONS' : 'GET, PUT, OPTIONS',
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
      res.writeHead(conta ? 200 : 401, {
        'content-type': 'application/json; charset=utf-8',
        ...cors,
        'cache-control': 'no-store',
      });
      res.end(conta ? JSON.stringify({ email: conta.email, is_admin: conta.is_admin }) : JSON.stringify({ erro: 'sem sessão' }));
      return;
    }
    if (path === CONFIG_PATH && req.method === 'GET') {
      const urlParams = new URL(req.url ?? '/', 'http://localhost').searchParams;
      const configValor = contas.getConfig(urlParams.get('chave') || 'chassis_status');
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
        if (typeof payload.chave === 'string' && typeof payload.valor === 'string') {
          contas.setConfig(payload.chave, payload.valor);
          res.writeHead(200, { 'access-control-allow-origin': '*' });
          res.end('ok');
          return;
        }
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
    maxPayload: MAX_MESSAGE,
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
      log(`recusa de ${ip}: ${admit}`);
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
    ws.on('message', (data, isBinary) => {
      if (!isBinary || flooded) return;
      if (!guard.allow(bucket, performance.now())) {
        flooded = true;
        rejected.flood++;
        log(`corte de ${ip}: taxa alta demais`);
        // 4008 = corte por taxa (código de aplicação; o navegador só deixa a página usar 3000-4999).
        ws.close(4008, 'taxa');
        return;
      }
      const bytes = data instanceof Buffer ? data : Buffer.concat(Array.isArray(data) ? data : [Buffer.from(data as ArrayBuffer)]);
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
    aoReiniciar: opts.aoReiniciar,
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

  return {
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
    close: () =>
      new Promise<void>((resolve) => {
        clearInterval(loop);
        amostrador.parar();
        mural?.parar();
        if (salvarTimer) clearInterval(salvarTimer);
        gravarDados();
        for (const c of wss.clients) c.terminate();
        wss.close(() => http.close(() => resolve()));
        for (const r of rooms.values()) r.dispose();
        rooms.clear();
        contas.close();
      }),
  };
}
