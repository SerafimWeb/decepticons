import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { POLITICA_VERSAO } from '../shared/net/auth';
import { PRESENCA_ARQUIVO, PRESENCA_RETENCAO_DIAS } from './presenca';

const RAIZ = resolve(__dirname, '..');

/** Gera a página `/privacidade/` de verdade (o mesmo `scripts/privacidade.mjs` do site) e devolve o texto corrido. */
function textoDaPolitica(): string {
  const pasta = mkdtempSync(join(tmpdir(), 'privacidade-presenca-'));
  const saida = join(pasta, 'index.html');
  const r = spawnSync(process.execPath, [resolve(RAIZ, 'scripts/privacidade.mjs'), '--out', saida], { cwd: RAIZ, encoding: 'utf8' });
  expect(r.status, r.stderr).toBe(0);
  return readFileSync(saida, 'utf8').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

describe('a política e o inventário falam do diário de presença (P275, 29/10)', () => {
  const texto = textoDaPolitica();

  it('o diário existe no servidor, então a política o descreve: o que guarda, 30 dias, sem IP nem país, só o dono lê, e apagar a conta apaga as entradas', () => {
    expect(existsSync(resolve(RAIZ, 'server/presenca.ts'))).toBe(true);
    expect(texto).toMatch(/Você entra numa sala online \(registro de presença\)/);
    expect(texto).toMatch(/hora em que entrou e a em que saiu/);
    expect(texto).toMatch(/Nunca o IP nem o país/);
    expect(texto).toMatch(/Só o dono do jogo lê/);
    expect(texto).toContain(`${PRESENCA_RETENCAO_DIAS} dias`);
    expect(texto).toMatch(/Apagar a conta apaga as entradas dela/);
  });

  it('o resumo do topo não diz mais "o servidor só soma números" sem a exceção da sala online', () => {
    const resumo = texto.slice(texto.indexOf('Em poucas palavras'), texto.indexOf('1. Quem trata os seus dados'));
    expect(resumo).toMatch(/A única exceção é entrar numa sala online/);
  });

  it('a versão da política mudou junto (quem aceitou a de antes não aceitou isto) e o inventário de dados tem a linha do arquivo', () => {
    expect(POLITICA_VERSAO).toBe('2026-10-29.1');
    expect(texto).toContain(POLITICA_VERSAO);
    const inventario = readFileSync(resolve(RAIZ, '.decepticons/PRIVACIDADE.md'), 'utf8');
    expect(inventario).toContain(PRESENCA_ARQUIVO);
    expect(inventario).toMatch(/Nunca IP, país nem e-mail/);
  });
});
