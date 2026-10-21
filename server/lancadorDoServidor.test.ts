import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { Writer } from '../shared/net/codec';
import { PROTOCOL_VERSION } from '../shared/net/constants';
import { encodeJoin, messageType, MSG } from '../shared/net/messages';
import { VISIBILIDADE_ARQUIVO } from './visibilidade';

/**
 * O LANÇADOR DO SERVIDOR (21/10): `npm run server` sobe o servidor como a produção sobe, num processo à parte. Os outros testes de servidor rodam dentro do Vitest, cujo carregador de módulos
 * nunca fecha, e por isso nenhum viu o defeito: o `runnerImport` do Vite fechava o carregador assim que o `main.ts` terminava de avaliar, e o primeiro jogador a pedir uma sala de mapa de
 * carga sob demanda (Praia, Amazônia, 8 de Janeiro: `import()` em `mapasSobDemanda.ts`) matava o processo com "Vite module runner has been closed". O túnel respondia 502 até a vigia religá-lo.
 */
const RAIZ = resolve(import.meta.dirname, '..');
const w = new Writer(256);
const join_ = (name: string) => new Uint8Array(encodeJoin(w, { protocol: PROTOCOL_VERSION, name, build: 'v1.vector09.plasma-0.rockets-0' }));

async function ate(ok: () => boolean, ms: number, o: string) {
  const t0 = Date.now();
  while (!ok()) {
    if (Date.now() - t0 > ms) throw new Error(`tempo esgotado: ${o}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

describe('o lançador do servidor (scripts/server.mjs)', () => {
  let filho: ChildProcess;
  let dados = '';
  let porta = 0;
  let saiu: number | null = null;
  let saida = '';

  beforeAll(async () => {
    // A pasta de dados é descartável (dentro de .tmp/, G15): nunca o banco de produção. O Comandante já liberou o 8 de Janeiro aqui, para a sala abrir sem credencial.
    dados = mkdtempSync(join(tmpdir(), 'cybermech-lancador-'));
    writeFileSync(join(dados, VISIBILIDADE_ARQUIVO), JSON.stringify({ versao: 1, itens: { 'mapa:janeiro': 'publico', 'mapa:amazonia': 'publico' } }));
    filho = spawn(process.execPath, ['scripts/server.mjs'], { cwd: RAIZ, env: { ...process.env, PORT: '0', CYBERMECH_DADOS: dados }, stdio: ['ignore', 'pipe', 'pipe'] });
    const ouvir = (d: Buffer) => {
      saida += d.toString();
      porta ||= Number(/ws:\/\/127\.0\.0\.1:(\d+)\//.exec(saida)?.[1] ?? 0);
    };
    filho.stdout?.on('data', ouvir);
    filho.stderr?.on('data', ouvir);
    filho.on('exit', (code) => (saiu = code ?? -1));
    await ate(() => porta > 0 || saiu !== null, 100_000, 'o servidor subir');
    expect(saiu, saida).toBeNull();
  }, 120_000);

  afterAll(async () => {
    if (saiu === null) {
      filho.kill();
      await ate(() => saiu !== null, 10_000, 'o servidor sair').catch(() => undefined);
    }
    rmSync(dados, { recursive: true, force: true });
  });

  it.each(['praia', 'janeiro', 'amazonia'])('abre a sala do mapa %s sob demanda e o processo segue de pé', async (mapa) => {
    const ws = new WebSocket(`ws://127.0.0.1:${porta}/?sala=LANCADOR&mapa=${mapa}`);
    ws.binaryType = 'arraybuffer';
    let bemVindo = false;
    let fechou: number | null = null;
    ws.on('message', (d: ArrayBuffer) => {
      if (messageType(new Uint8Array(d)) === MSG.WELCOME) bemVindo = true;
    });
    ws.on('close', (code) => (fechou = code));
    ws.on('error', () => undefined);
    await new Promise<void>((ok) => ws.on('open', () => ok()).on('close', () => ok()));
    if (ws.readyState === ws.OPEN) ws.send(join_('Piloto'));
    await ate(() => bemVindo || fechou !== null || saiu !== null, 60_000, `as boas-vindas do mapa ${mapa}`);
    ws.terminate();
    expect(saiu, saida).toBeNull();
    expect(fechou, saida).toBeNull();
    expect(bemVindo).toBe(true);
    const status = (await (await fetch(`http://127.0.0.1:${porta}/status`)).json()) as { rooms: number };
    expect(status.rooms).toBeGreaterThanOrEqual(1);
  }, 90_000);
});
