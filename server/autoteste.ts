/**
 * A bateria do painel ("TESTAR", P93): clientes de mentira entram de verdade pela porta do jogo (WebSocket, o mesmo protocolo do
 * navegador) numa sala de teste, andam parados por alguns segundos mandando comando a 30 Hz, e o servidor confere o que importa para
 * quem joga: se todos entraram, quantos estados por segundo chegam, quantos KB/s cada um recebe (meta G11: 8), o ping, o tempo do tick
 * (meta G14: 2 ms) e o atraso do laço de eventos. Sem jogador de verdade na sala (o painel recusa o teste com gente jogando).
 *
 * **Custo de CPU:** é uma sala a mais por uns 10 s, com 4 pilotos de mentira (o mesmo que 4 jogadores entrando). Roda no mesmo processo do
 * servidor, então o que ele mede é o que o servidor faz de verdade. A sala de teste (`TESTE-…`) fica fora da telemetria e fecha no fim.
 */
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { WebSocket } from 'ws';
import { factorySpec, loadoutKey } from '../client/src/hangar/loadout';
import type { AdminTeste, Checagem, Resultado } from '../shared/net/admin';
import { Writer } from '../shared/net/codec';
import { PROTOCOL_VERSION, SIM_HZ, SNAPSHOT_HZ } from '../shared/net/constants';
import { newNetInput } from '../shared/net/input';
import { decodePong, decodeWelcome, encodeInputs, encodeJoin, encodePing, messageType, MSG } from '../shared/net/messages';

/** O prefixo das salas de teste: o servidor não conta nada delas na telemetria. */
export const PREFIXO_DE_TESTE = 'TESTE-';
export const ehSalaDeTeste = (codigo: string): boolean => codigo.startsWith(PREFIXO_DE_TESTE);

export interface OpcoesDoTeste {
  host: string;
  porta: number;
  /** Quantos pilotos de mentira (padrão 4: o teto de conexões por IP do servidor). */
  clientes?: number;
  /** Quantos segundos medem depois de entrar e do aquecimento (padrão 6). */
  duracaoS?: number;
  /** Quantos segundos de aquecimento antes de medir (padrão 1): abrir a sala (o mundo físico) é um engasgo único, que não é o dia a dia do servidor. */
  aquecimentoS?: number;
  /** O tempo médio do tick da sala de teste, lido do servidor (`null` = a sala não existe mais). */
  tickMsDaSala: (codigo: string) => number | null;
  /** Fecha a sala de teste no fim, para a memória voltar. */
  fecharSala: (codigo: string) => boolean;
}

interface Cliente {
  ws: WebSocket;
  entrou: boolean;
  recusado: boolean;
  bytes: number;
  estados: number;
  /** O que já tinha chegado quando o aquecimento acabou (a medida é o que veio depois). */
  bytes0: number;
  estados0: number;
  rtts: number[];
  proximoTick: number;
  timer: ReturnType<typeof setInterval> | null;
}

/** Metas do teste (G11 a G14); fora do ok e dentro do limite de falha vira "atenção". */
const META = {
  kbsPorJogador: { ok: 8, falha: 12 },
  tickMs: { ok: 2, falha: 4 },
  lacoMs: { ok: 20, falha: 50 },
  pingMs: { ok: 20, falha: 60 },
  memoriaMB: { ok: 50, falha: 150 },
} as const;

const mediana = (xs: number[]): number => {
  if (!xs.length) return 0;
  const o = [...xs].sort((a, b) => a - b);
  return o[Math.floor(o.length / 2)]!;
};
const f1 = (x: number): string => (Math.round(x * 10) / 10).toString().replace('.', ',');
const veredito = (valor: number, meta: { ok: number; falha: number }): Resultado => (valor <= meta.ok ? 'ok' : valor <= meta.falha ? 'atencao' : 'falha');

/** Quantos estados por segundo chegam a cada piloto: até 2 abaixo do ritmo do servidor é ok; até 6 abaixo, atenção; menos que isso, o tick está atrasando. */
export const resultadoDosEstados = (porSegundo: number): Resultado => (porSegundo >= SNAPSHOT_HZ - 2 ? 'ok' : porSegundo >= SNAPSHOT_HZ - 6 ? 'atencao' : 'falha');

/** O teste passa quando nenhuma checagem falhou (atenção não reprova). */
export const passou = (checagens: readonly Checagem[]): boolean => checagens.every((c) => c.resultado !== 'falha');

function checagem(nome: string, valor: number, unidade: string, meta: { ok: number; falha: number }, dica: string): Checagem {
  const resultado = veredito(valor, meta);
  return { nome, valor: `${f1(valor)} ${unidade}`, limite: `até ${f1(meta.ok)} ${unidade}`, resultado, ...(resultado === 'ok' ? {} : { dica }) };
}

export async function executarTeste(o: OpcoesDoTeste): Promise<AdminTeste> {
  const total = o.clientes ?? 4;
  const duracaoS = o.duracaoS ?? 6;
  const codigo = `${PREFIXO_DE_TESTE}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const build = loadoutKey(factorySpec('vector09'));
  const aquecimentoS = o.aquecimentoS ?? 1;
  const w = new Writer(256);
  const laco = monitorEventLoopDelay({ resolution: 20 });
  const rssAntes = process.memoryUsage.rss();
  const inicio = performance.now();
  const clientes: Cliente[] = [];

  const abrir = (i: number): Promise<Cliente> =>
    new Promise((resolve) => {
      const ws = new WebSocket(`ws://${o.host}:${o.porta}/?sala=${codigo}`);
      ws.binaryType = 'nodebuffer';
      const c: Cliente = { ws, entrou: false, recusado: false, bytes: 0, estados: 0, bytes0: 0, estados0: 0, rtts: [], proximoTick: 0, timer: null };
      const pronto = setTimeout(() => resolve(c), 4000);
      ws.on('open', () => ws.send(new Uint8Array(encodeJoin(w, { protocol: PROTOCOL_VERSION, name: `TESTE-${i + 1}`, build }))));
      ws.on('message', (data: Buffer) => {
        c.bytes += data.length;
        switch (messageType(data)) {
          case MSG.WELCOME: {
            const m = decodeWelcome(data);
            if (!m || c.entrou) return;
            c.entrou = true;
            c.proximoTick = m.tick + 1;
            clearTimeout(pronto);
            resolve(c);
            return;
          }
          case MSG.SNAPSHOT:
            c.estados++;
            return;
          case MSG.PONG: {
            const p = decodePong(data);
            if (p) c.rtts.push(((Date.now() >>> 0) - p.clientTime) >>> 0);
            return;
          }
          case MSG.REJECT:
            c.recusado = true;
            clearTimeout(pronto);
            resolve(c);
        }
      });
      ws.on('error', () => {
        clearTimeout(pronto);
        resolve(c);
      });
    });

  try {
    for (let i = 0; i < total; i++) clientes.push(await abrir(i));
    const dentro = clientes.filter((c) => c.entrou);
    // Cada piloto de mentira manda comando parado a 30 Hz (2 ticks por pacote) e um ping por segundo, como o navegador.
    for (const c of dentro) {
      // O ping sai por relógio (um por segundo), não "a cada 30 voltas do temporizador": com o laço de eventos faminto cada volta atrasa e 30 voltas viram vários segundos.
      let ultimoPing = 0;
      c.timer = setInterval(() => {
        const a = { ...newNetInput(), tick: c.proximoTick };
        const b = { ...newNetInput(), tick: c.proximoTick + 1 };
        c.proximoTick += 2;
        c.ws.send(new Uint8Array(encodeInputs(w, [a, b], 2)));
        const agora = Date.now();
        if (agora - ultimoPing >= 1000) {
          ultimoPing = agora;
          c.ws.send(new Uint8Array(encodePing(w, agora >>> 0)));
        }
      }, 1000 / 30);
    }
    // O aquecimento: a sala acabou de nascer (o mundo físico, a primeira passada do JIT). A medida começa depois dele.
    await new Promise((r) => setTimeout(r, aquecimentoS * 1000));
    for (const c of dentro) {
      c.bytes0 = c.bytes;
      c.estados0 = c.estados;
      c.rtts.length = 0;
    }
    laco.enable();
    const comecou = performance.now();
    await new Promise((r) => setTimeout(r, duracaoS * 1000));
    const segundos = (performance.now() - comecou) / 1000;
    const tickMs = o.tickMsDaSala(codigo);
    for (const c of dentro) if (c.timer) clearInterval(c.timer);
    const checagens: Checagem[] = [];
    checagens.push({
      nome: 'Pilotos que entraram',
      valor: `${dentro.length} de ${total}`,
      limite: `${total} de ${total}`,
      resultado: dentro.length === total ? 'ok' : 'falha',
      ...(dentro.length === total ? {} : { dica: clientes.some((c) => c.recusado) ? 'O servidor recusou a entrada (sala cheia, versão ou limite por IP).' : 'Nem todos conseguiram abrir a conexão: porta, túnel ou o teto de conexões por IP.' }),
    });
    if (dentro.length > 0) {
      const estadosPorS = dentro.reduce((s, c) => s + (c.estados - c.estados0), 0) / dentro.length / segundos;
      checagens.push({
        nome: 'Estados por segundo (cada piloto)',
        valor: `${f1(estadosPorS)}`,
        limite: `perto de ${SNAPSHOT_HZ}`,
        resultado: resultadoDosEstados(estadosPorS),
        ...(resultadoDosEstados(estadosPorS) === 'ok' ? {} : { dica: `O servidor devia mandar ${SNAPSHOT_HZ} por segundo: o tick de ${SIM_HZ} Hz está atrasando (o PC estava ocupado? rode de novo com ele quieto).` }),
      });
      checagens.push(checagem('Download por piloto', dentro.reduce((s, c) => s + (c.bytes - c.bytes0), 0) / dentro.length / 1024 / segundos, 'KB/s', META.kbsPorJogador, 'A meta do jogo é 8 KB/s (G11): acima disso, uma conexão fraca não acompanha o estado.'));
      const rtts = dentro.flatMap((c) => c.rtts);
      if (rtts.length) checagens.push(checagem('Ping de ida e volta (mediana)', Math.max(0, mediana(rtts)), 'ms', META.pingMs, 'Na própria máquina o ping devia ser de poucos ms: o servidor está demorando para responder.'));
    }
    if (tickMs !== null) checagens.push(checagem('Tempo do tick da sala de teste', tickMs, 'ms', META.tickMs, 'A meta do G14 é 2 ms por sala; acima, o servidor de casa cabe em menos salas.'));
    const lacoP99 = Math.max(0, laco.percentile(99) / 1e6 - 20);
    checagens.push(checagem('Atraso do laço durante o teste (p99)', Number.isFinite(lacoP99) ? lacoP99 : 0, 'ms', META.lacoMs, 'O Node demorou a voltar ao servidor: outro programa pesado na máquina.'));
    checagens.push(checagem('Memória usada pelo teste', Math.max(0, (process.memoryUsage.rss() - rssAntes) / 1048576), 'MB', META.memoriaMB, 'A sala de teste devia custar poucos MB; se for muito, o servidor está vazando.'));
    const ok = passou(checagens);
    return { ok, duracaoS: Math.round(((performance.now() - inicio) / 1000) * 10) / 10, clientes: dentro.length, checagens };
  } finally {
    laco.disable();
    for (const c of clientes) {
      if (c.timer) clearInterval(c.timer);
      try {
        c.ws.close();
      } catch {
        // já fechado
      }
    }
    o.fecharSala(codigo);
  }
}
