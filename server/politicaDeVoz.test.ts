import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { POLITICA_VERSAO } from '../shared/net/auth';

const RAIZ = resolve(__dirname, '..');
/** O dia em que a política passou a falar do chat de voz (P205): nenhuma versão anterior a ele pode voltar. */
const VOZ_NA_POLITICA_DESDE = '2026-10-19';
/** A versão em que a política passou a falar do mês e do ano de nascimento e da voz só para maiores de 18 anos (P211). */
const IDADE_NA_POLITICA_DESDE = '2026-10-19.2';

/** Gera a página `/privacidade/` de verdade (o mesmo `scripts/privacidade.mjs` do site) e devolve o HTML. */
function paginaDaPolitica(): string {
  const pasta = mkdtempSync(join(tmpdir(), 'privacidade-'));
  const saida = join(pasta, 'index.html');
  const r = spawnSync(process.execPath, [resolve(RAIZ, 'scripts/privacidade.mjs'), '--out', saida], { cwd: RAIZ, encoding: 'utf8' });
  expect(r.status, r.stderr).toBe(0);
  return readFileSync(saida, 'utf8');
}

describe('a política de privacidade fala do chat de voz (P205, 19/10)', () => {
  const html = paginaDaPolitica();
  // O texto corrido, sem as marcas do HTML: o que a pessoa lê.
  const texto = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  it('a voz existe no jogo, então a política a descreve: o IP visto pelos outros jogadores, o STUN do Google, e que nada é gravado', () => {
    expect(existsSync(resolve(RAIZ, 'client/src/voice/VoiceChat.ts'))).toBe(true);
    expect(texto).toMatch(/chat de voz/i);
    expect(texto, 'a tabela "O que guardamos" tem a linha própria da voz').toMatch(/Você usa o chat de voz/);
    expect(texto).toMatch(/os outros jogadores da sala podem ver o seu endere[çc]o IP/i);
    expect(texto).toMatch(/Google \(STUN/);
    expect(texto).toMatch(/nada é gravado/i);
    expect(texto).toMatch(/nunca passa pelo nosso servidor/i);
  });

  it('o resumo do topo não diz só "o IP não é guardado": a voz mostra o IP aos outros jogadores logo em seguida', () => {
    const resumo = texto.slice(texto.indexOf('Em poucas palavras'), texto.indexOf('1. Quem trata os seus dados'));
    expect(resumo).toMatch(/endereço IP não é guardado/i);
    expect(resumo).toMatch(/No chat de voz, os outros jogadores da sala podem ver o seu endereço IP/i);
  });

  it('a versão da política não volta a ser anterior à que descreve a voz, e a página mostra a versão vigente', () => {
    expect(POLITICA_VERSAO >= VOZ_NA_POLITICA_DESDE, `POLITICA_VERSAO ${POLITICA_VERSAO} é anterior a ${VOZ_NA_POLITICA_DESDE}`).toBe(true);
    expect(html).toContain(POLITICA_VERSAO);
  });

  it('o inventário de fatos (PRIVACIDADE.md) tem a linha do chat de voz com o STUN e o IP', () => {
    const inventario = readFileSync(resolve(RAIZ, '.decepticons/PRIVACIDADE.md'), 'utf8');
    expect(inventario).toMatch(/\*\*Chat de voz\*\*/);
    expect(inventario).toMatch(/STUN do Google/);
    expect(inventario).toMatch(/pode ver o IP dos outros/);
  });
});

describe('a política fala da idade e da voz (P211, 19/10; fase de testes, P241, 21/10: o menor só ouve)', () => {
  const html = paginaDaPolitica();
  const texto = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  it('a tabela da conta lista o mês e o ano de nascimento, e o resumo do topo diz que o menor de 18 anos só ouve (sem microfone)', () => {
    expect(texto, 'a linha "Você cria uma conta" tem o nascimento').toMatch(/Você cria uma conta .*o mês e o ano de nascimento\*? \(sem o dia\)/);
    const resumo = texto.slice(texto.indexOf('Em poucas palavras'), texto.indexOf('1. Quem trata os seus dados'));
    expect(resumo).toMatch(/o mês e o ano do seu nascimento/);
    expect(resumo).toMatch(/contas de menores de 18 anos só ouvem/i);
    expect(resumo).toMatch(/não têm o microfone/);
    expect(resumo, 'quem joga sem conta fala e ouve, e a política diz isso com franqueza').toMatch(/Quem joga sem conta, ou ainda não informou a idade, pode falar e ouvir/);
  });

  it('a seção das crianças diz que contas de menores só ouvem o chat de voz, e o aviso de mudança cita a mudança', () => {
    const menores = texto.slice(texto.indexOf('6. Crianças e adolescentes'), texto.indexOf('7. Segurança'));
    expect(menores).toMatch(/Contas de menores de 18 anos só ouvem o chat de voz, sem microfone/);
    expect(menores).toMatch(/o jogo não sabe a idade de quem joga assim/);
    expect(menores).toMatch(/informa o mês e o ano de nascimento/);
    expect(texto).toMatch(/em relação à de 19\/10\/2026: o chat de voz deixou de ser só para maiores de 18 anos/i);
  });

  it('a versão vigente não volta a ser anterior à que descreve a idade, e o inventário (PRIVACIDADE.md) tem a linha da idade', () => {
    expect(POLITICA_VERSAO >= IDADE_NA_POLITICA_DESDE, `POLITICA_VERSAO ${POLITICA_VERSAO} é anterior a ${IDADE_NA_POLITICA_DESDE}`).toBe(true);
    const inventario = readFileSync(resolve(RAIZ, '.decepticons/PRIVACIDADE.md'), 'utf8');
    expect(inventario).toMatch(/\*\*Idade e chat de voz\*\*/);
    expect(inventario).toMatch(/mês e o ano de nascimento/);
    expect(inventario).toMatch(/nascimento_informado/);
  });

  it('a data "em vigor desde" sai do prefixo AAAA-MM-DD da versão, mesmo com o sufixo do dia', () => {
    expect(html).toMatch(/em vigor desde \d{2}\/\d{2}\/\d{4}/);
    expect(html).not.toMatch(/em vigor desde .*undefined|NaN/);
  });
});
