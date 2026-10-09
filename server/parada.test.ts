import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PARADA_ARQUIVO, vigiarParada } from './parada';

/** Pasta de teste dentro do projeto (G15: nada fora de `.tmp/`). */
const dirs: string[] = [];
const pasta = (nome: string) => {
  const p = resolve('.tmp', `teste-parada-${nome}-${process.pid}`);
  rmSync(p, { recursive: true, force: true });
  mkdirSync(p, { recursive: true });
  dirs.push(p);
  return p;
};
const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
const paradas: Array<() => void> = [];
afterEach(() => {
  for (const p of paradas.splice(0)) p();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('vigiarParada: o servidor se encerra sozinho quando o arquivo de parada aparece', () => {
  it('o arquivo aparece: chama o desligamento uma vez só e apaga o pedido', async () => {
    const dir = pasta('pedido');
    let chamadas = 0;
    paradas.push(vigiarParada(dir, () => chamadas++, 10));
    expect(chamadas).toBe(0);
    writeFileSync(join(dir, PARADA_ARQUIVO), 'pare');
    await esperar(80);
    expect(chamadas).toBe(1);
    expect(existsSync(join(dir, PARADA_ARQUIVO))).toBe(false);
    // Outro arquivo logo depois (o servidor ainda está fechando) não chama de novo.
    writeFileSync(join(dir, PARADA_ARQUIVO), 'pare de novo');
    await esperar(80);
    expect(chamadas).toBe(1);
  });

  it('um pedido que já estava lá quando o servidor subiu é velho: é apagado e não derruba o servidor novo', async () => {
    const dir = pasta('velho');
    writeFileSync(join(dir, PARADA_ARQUIVO), 'pedido para o servidor anterior');
    let chamadas = 0;
    paradas.push(vigiarParada(dir, () => chamadas++, 10));
    expect(existsSync(join(dir, PARADA_ARQUIVO))).toBe(false); // apagado já na largada
    await esperar(80);
    expect(chamadas).toBe(0);
  });

  it('sem arquivo, nada acontece; parar a vigia desliga o pedido', async () => {
    const dir = pasta('quieto');
    let chamadas = 0;
    const parar = vigiarParada(dir, () => chamadas++, 10);
    await esperar(60);
    expect(chamadas).toBe(0);
    parar();
    writeFileSync(join(dir, PARADA_ARQUIVO), 'tarde demais');
    await esperar(60);
    expect(chamadas).toBe(0);
  });

  it('a pasta de dados ainda não existe: não lança, e vale quando ela nascer', async () => {
    const dir = join(pasta('depois'), 'ainda-nao');
    let chamadas = 0;
    paradas.push(vigiarParada(dir, () => chamadas++, 10));
    await esperar(40);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, PARADA_ARQUIVO), 'pare');
    await esperar(80);
    expect(chamadas).toBe(1);
  });
});
