import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { formatarFumaca, fumacaDoServidor } from './fumaca';
import { VISIBILIDADE_ARQUIVO } from './visibilidade';

/**
 * O LANÇADOR DO SERVIDOR (21/10): `npm run server` sobe o servidor como a produção sobe, num processo à parte. Os outros testes de servidor rodam dentro do Vitest, cujo carregador de módulos
 * nunca fecha, e por isso nenhum viu o defeito: o `runnerImport` do Vite fechava o carregador assim que o `main.ts` terminava de avaliar, e o primeiro jogador a pedir uma sala de mapa de
 * carga sob demanda (Praia, Amazônia, 8 de Janeiro: `import()` em `mapasSobDemanda.ts`) matava o processo com "Vite module runner has been closed". O túnel respondia 502 até a vigia religá-lo.
 * A prova é a fumaça (`fumaca.ts`): abrir uma sala de cada mapa no processo de verdade.
 */
const RAIZ = resolve(import.meta.dirname, '..');

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
    // A pasta de dados é descartável (dentro de .tmp/, G15): nunca o banco de produção. O Comandante já liberou a Terras Raras aqui, para a sala abrir sem credencial (o 8 de Janeiro já nasce público, 24/10).
    dados = mkdtempSync(join(tmpdir(), 'cybermech-lancador-'));
    writeFileSync(join(dados, VISIBILIDADE_ARQUIVO), JSON.stringify({ versao: 1, itens: { 'mapa:amazonia': 'publico' } }));
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

  it('abre a sala de cada mapa sob demanda (Praia, Terras Raras, 8 de Janeiro) e o processo segue de pé', async () => {
    const r = await fumacaDoServidor({ base: `http://127.0.0.1:${porta}` });
    const msg = `${formatarFumaca(r)}\n${saida}`;
    expect(saiu, msg).toBeNull();
    for (const mapa of ['arena', 'praia', 'janeiro', 'amazonia']) expect(r.linhas.find((l) => l.mapa === mapa)?.obtido, msg).toBe('entrou');
    expect(r.linhas.find((l) => l.mapa === 'bunker')?.obtido, msg).toBe('recusado'); // restrito para o anônimo
    expect(r.ok, msg).toBe(true);
  }, 180_000);
});
