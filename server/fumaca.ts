/**
 * A FUMAÇA DO SERVIDOR (P239): de fora, como um jogador anônimo, abre uma sala de **cada** mapa e confere o que importa para quem joga: os mapas públicos abrem (boas-vindas), os restritos recusam
 * (nunca abrem para um anônimo) e o processo não reiniciou no meio (o `uptimeS` do `/status` só cresce).
 *
 * Por que existe: o autoteste do painel (`autoteste.ts`) mede **desempenho** e só na Cidade Neon, de dentro do próprio servidor; e os testes de servidor rodam dentro do Vitest, com um carregador de
 * módulos que nunca fecha. Em 21/10 tudo isso estava verde com a produção caindo a cada sala da Praia, da Terras Raras ou do 8 de Janeiro. Esta fumaça é o que o jogador faz: bater na porta, por mapa.
 *
 * Roda contra qualquer servidor: o de teste (`lancadorDoServidor.test.ts`), o local logo depois de um deploy (`npm run fumaca`) e o de produção pelo túnel
 * (`npm run fumaca -- --url https://jogo.cybermech.online --origem https://cybermech.online`). As salas se chamam `TESTE-FUMACA…`: ficam fora da telemetria de produto (`autoteste.ts`) e do contador de jogadores.
 *
 * Custo: uma sala por mapa por poucos segundos (a primeira de cada mapa carrega o código dele). Nada no tick.
 */
import { WebSocket } from 'ws';
import { factorySpec, loadoutKey } from '../client/src/hangar/loadout';
import { Writer } from '../shared/net/codec';
import { PROTOCOL_VERSION } from '../shared/net/constants';
import { MAPAS_ONLINE, MAPA_PADRAO, type MapaOnline } from '../shared/net/mapa';
import { decodeReject, encodeJoin, messageType, MSG } from '../shared/net/messages';
import type { EstadoDeVisibilidade } from '../shared/visibilidade';
import { mapaRestrito } from './acessoAoMapa';
import { PREFIXO_DE_TESTE } from './autoteste';

export interface OpcoesDaFumaca {
  /** O endereço HTTP(S) do servidor, sem barra no fim: `http://127.0.0.1:2567` ou `https://jogo.cybermech.online`. */
  base: string;
  /** O `Origin` que o servidor confere (o site: `https://cybermech.online`), para falar com a produção pelo túnel. Local não precisa. */
  origem?: string;
  /** Quanto esperar a resposta de cada mapa (ms). A primeira sala de um mapa carrega o código dele: padrão 30 s. */
  esperaMs?: number;
}

export type Obtido = 'entrou' | 'recusado' | 'mudo';

export interface LinhaDaFumaca {
  mapa: MapaOnline;
  esperado: 'entra' | 'recusa';
  obtido: Obtido;
  ok: boolean;
  detalhe: string;
}

export interface ResultadoDaFumaca {
  ok: boolean;
  linhas: LinhaDaFumaca[];
  /** O `uptimeS` do servidor antes e depois (`null` = o `/status` não respondeu). */
  uptimeAntesS: number | null;
  uptimeDepoisS: number | null;
  /** Por que o conjunto falhou além das linhas (o servidor sumiu, reiniciou no meio). Vazio se nada. */
  problemas: string[];
}

interface StatusMinimo {
  uptimeS: number;
  visibilidade: { itens: Readonly<Record<string, EstadoDeVisibilidade>> };
}

async function lerStatus(base: string): Promise<StatusMinimo | null> {
  try {
    const r = await fetch(`${base}/status`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const j = (await r.json()) as Partial<StatusMinimo>;
    return typeof j.uptimeS === 'number' ? { uptimeS: j.uptimeS, visibilidade: { itens: j.visibilidade?.itens ?? {} } } : null;
  } catch {
    return null;
  }
}

/** Entra na sala de teste de um mapa e diz o que o servidor respondeu primeiro: boas-vindas, recusa (REJECT ou fechamento) ou silêncio. */
async function bater(base: string, mapa: MapaOnline, origem: string | undefined, esperaMs: number): Promise<{ obtido: Obtido; detalhe: string }> {
  const url = new URL(base.replace(/^http/, 'ws'));
  url.searchParams.set('sala', `${PREFIXO_DE_TESTE}FUMACA`);
  if (mapa !== MAPA_PADRAO) url.searchParams.set('mapa', mapa);
  const ws = new WebSocket(url, origem ? { headers: { origin: origem } } : undefined);
  ws.binaryType = 'arraybuffer';
  return new Promise((resolve) => {
    let feito = false;
    const fim = (obtido: Obtido, detalhe: string) => {
      if (feito) return;
      feito = true;
      clearTimeout(espera);
      try {
        ws.terminate();
      } catch {
        // já fechado
      }
      resolve({ obtido, detalhe });
    };
    const espera = setTimeout(() => fim('mudo', `sem resposta em ${Math.round(esperaMs / 1000)} s`), esperaMs);
    ws.on('open', () => ws.send(new Uint8Array(encodeJoin(new Writer(256), { protocol: PROTOCOL_VERSION, name: 'FUMACA', build: loadoutKey(factorySpec('vector09')) }))));
    ws.on('message', (d: ArrayBuffer) => {
      const b = new Uint8Array(d);
      const tipo = messageType(b);
      if (tipo === MSG.WELCOME) fim('entrou', 'boas-vindas');
      else if (tipo === MSG.REJECT) fim('recusado', `recusa: ${decodeReject(b) ?? '?'}`);
    });
    ws.on('close', (codigo) => fim('recusado', `conexão fechada (código ${codigo})`));
    ws.on('error', (e) => fim('mudo', `erro de conexão: ${e.message}`));
  });
}

export async function fumacaDoServidor(o: OpcoesDaFumaca): Promise<ResultadoDaFumaca> {
  const esperaMs = o.esperaMs ?? 30_000;
  const antes = await lerStatus(o.base);
  const problemas: string[] = [];
  if (!antes) return { ok: false, linhas: [], uptimeAntesS: null, uptimeDepoisS: null, problemas: [`o /status de ${o.base} não respondeu: o servidor está fora do ar`] };

  const linhas: LinhaDaFumaca[] = [];
  for (const mapa of MAPAS_ONLINE) {
    const esperado = mapaRestrito(mapa, antes.visibilidade.itens) ? 'recusa' : 'entra';
    const { obtido, detalhe } = await bater(o.base, mapa, o.origem, esperaMs);
    // Anônimo: o mapa público tem de abrir; o restrito tem de recusar (abrir seria um vazamento). Silêncio nunca é resposta boa.
    const ok = esperado === 'entra' ? obtido === 'entrou' : obtido === 'recusado';
    linhas.push({ mapa, esperado, obtido, ok, detalhe });
    await new Promise((r) => setTimeout(r, 300));
  }

  const depois = await lerStatus(o.base);
  if (!depois) problemas.push('o servidor parou de responder durante a fumaça (caiu)');
  else if (depois.uptimeS < antes.uptimeS) problemas.push(`o servidor reiniciou durante a fumaça (uptime ${antes.uptimeS} s → ${depois.uptimeS} s)`);
  return { ok: linhas.every((l) => l.ok) && problemas.length === 0, linhas, uptimeAntesS: antes.uptimeS, uptimeDepoisS: depois?.uptimeS ?? null, problemas };
}

/** O resultado em texto, uma linha por mapa (o que `npm run fumaca` imprime e o log do atualizador guarda). */
export function formatarFumaca(r: ResultadoDaFumaca): string {
  const linhas = r.linhas.map((l) => `  ${l.ok ? 'ok   ' : 'FALHOU'} ${l.mapa.padEnd(9)} esperado ${l.esperado.padEnd(6)} obtido ${l.obtido.padEnd(8)} ${l.detalhe}`);
  const problemas = r.problemas.map((p) => `  FALHOU ${p}`);
  return [`fumaça do servidor: ${r.ok ? 'PASSOU' : 'REPROVOU'} (uptime ${r.uptimeAntesS ?? '?'} s → ${r.uptimeDepoisS ?? '?'} s)`, ...linhas, ...problemas].join('\n');
}
