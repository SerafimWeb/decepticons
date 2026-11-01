import { describe, expect, it } from 'vitest';
import {
  JOGADORES_PARA_PODIO,
  recompensaDaPartida,
  SEGUNDOS_PARA_PARTICIPAR,
  TETOS_DA_PARTIDA,
  venceuARodada,
  XP_DA_PARTIDA,
  XP_POR_CREDITO,
  type DesempenhoDaPartida,
} from './recompensaDaPartida';

const NADA: DesempenhoDaPartida = { abates: 0, dano: 0, maiorSequencia: 0, posicao: null, jogadores: 1, venceu: false, segundos: 0, ondas: 0 };

describe('a recompensa da partida (P304: toda partida rende)', () => {
  it('quem entrou e saiu sem fazer nada não ganha nada (nem linha vazia)', () => {
    const r = recompensaDaPartida(NADA);
    expect(r).toEqual({ xp: 0, creditos: 0, linhas: [] });
  });

  it('a rodada comum (3 abates, 1.500 de dano, 5 min) rende ~160 XP: umas 6 rodadas por nível', () => {
    const r = recompensaDaPartida({ ...NADA, abates: 3, dano: 1500, maiorSequencia: 1, posicao: 4, jogadores: 8, segundos: 300 });
    expect(r.xp).toBe(XP_DA_PARTIDA.participacao + 3 * XP_DA_PARTIDA.porAbate + 37);
    expect(r.linhas.map((l) => l.rotulo)).toEqual(['PARTICIPAÇÃO', 'ABATES ×3', 'DANO CAUSADO 1500']);
    expect(1000 / r.xp).toBeGreaterThan(5);
    expect(1000 / r.xp).toBeLessThan(8);
  });

  it('a vitória com sequência rende bem mais que a rodada comum (o motivo de jogar melhor)', () => {
    const comum = recompensaDaPartida({ ...NADA, abates: 3, dano: 1500, posicao: 4, jogadores: 8, segundos: 300 });
    const boa = recompensaDaPartida({ ...NADA, abates: 8, dano: 4000, maiorSequencia: 4, posicao: 1, jogadores: 8, venceu: true, segundos: 300 });
    expect(boa.linhas.map((l) => l.rotulo)).toContain('VITÓRIA');
    expect(boa.linhas.map((l) => l.rotulo)).toContain('SEQUÊNCIA 4×');
    expect(boa.xp).toBeGreaterThan(comum.xp * 2.5);
  });

  it('o pódio: 2º e 3º lugar só com gente para disputar; o 4º não ganha; a vitória não soma o lugar', () => {
    const lugar = (posicao: number, jogadores: number) => recompensaDaPartida({ ...NADA, posicao, jogadores }).xp;
    expect(lugar(2, JOGADORES_PARA_PODIO)).toBe(XP_DA_PARTIDA.segundoLugar);
    expect(lugar(3, JOGADORES_PARA_PODIO)).toBe(XP_DA_PARTIDA.terceiroLugar);
    expect(lugar(4, 8)).toBe(0);
    expect(lugar(2, JOGADORES_PARA_PODIO - 1)).toBe(0);
    const venceu = recompensaDaPartida({ ...NADA, posicao: 1, jogadores: 8, venceu: true });
    expect(venceu.linhas).toEqual([{ rotulo: 'VITÓRIA', xp: XP_DA_PARTIDA.vitoria }]);
  });

  it('a participação só vale a partir do tempo mínimo', () => {
    expect(recompensaDaPartida({ ...NADA, segundos: SEGUNDOS_PARA_PARTICIPAR - 1 }).xp).toBe(0);
    expect(recompensaDaPartida({ ...NADA, segundos: SEGUNDOS_PARA_PARTICIPAR }).xp).toBe(XP_DA_PARTIDA.participacao);
  });

  it('a sequência só rende de 3 em diante', () => {
    expect(recompensaDaPartida({ ...NADA, maiorSequencia: 2 }).xp).toBe(0);
    expect(recompensaDaPartida({ ...NADA, maiorSequencia: 3 }).xp).toBe(XP_DA_PARTIDA.porSequencia);
  });

  it('as ondas da Sobrevivência rendem por onda vencida', () => {
    const r = recompensaDaPartida({ ...NADA, ondas: 4, venceu: false });
    expect(r.linhas).toEqual([{ rotulo: 'ONDAS ×4', xp: 4 * XP_DA_PARTIDA.porOnda }]);
  });

  it('os tetos: uma partida absurda contra bots fáceis não vale mais que o teto', () => {
    const r = recompensaDaPartida({ abates: 999, dano: 1e9, maiorSequencia: 999, posicao: 1, jogadores: 30, venceu: true, segundos: 1e6, ondas: 999 });
    const teto =
      XP_DA_PARTIDA.participacao +
      TETOS_DA_PARTIDA.abates * XP_DA_PARTIDA.porAbate +
      TETOS_DA_PARTIDA.xpDeDano +
      (TETOS_DA_PARTIDA.sequencia - 2) * XP_DA_PARTIDA.porSequencia +
      TETOS_DA_PARTIDA.ondas * XP_DA_PARTIDA.porOnda +
      XP_DA_PARTIDA.vitoria;
    expect(r.xp).toBe(teto);
    expect(r.linhas.find((l) => l.rotulo.startsWith('ABATES'))?.rotulo).toBe(`ABATES ×${TETOS_DA_PARTIDA.abates}`);
  });

  it('número estranho (NaN, negativo, infinito) não vira XP nem quebra a conta', () => {
    const r = recompensaDaPartida({ abates: NaN, dano: -50, maiorSequencia: Infinity, posicao: null, jogadores: NaN, venceu: false, segundos: NaN, ondas: -3 });
    expect(r).toEqual({ xp: 0, creditos: 0, linhas: [] });
  });

  it('os Créditos são uma fração do XP, sempre inteiros', () => {
    const r = recompensaDaPartida({ ...NADA, abates: 3, dano: 1500, segundos: 300 });
    expect(r.creditos).toBe(Math.floor(r.xp / XP_POR_CREDITO));
    expect(Number.isInteger(r.creditos)).toBe(true);
  });

  it('o total é a soma das linhas, e nenhuma linha é zero', () => {
    const r = recompensaDaPartida({ ...NADA, abates: 5, dano: 2222, maiorSequencia: 5, posicao: 2, jogadores: 6, segundos: 200, ondas: 0 });
    expect(r.xp).toBe(r.linhas.reduce((s, l) => s + l.xp, 0));
    for (const l of r.linhas) expect(l.xp).toBeGreaterThan(0);
  });

  it('vencer a rodada = primeiro lugar com pelo menos um abate (a regra do "VENCEDOR:" do placar)', () => {
    expect(venceuARodada(1, 1)).toBe(true);
    expect(venceuARodada(1, 0)).toBe(false);
    expect(venceuARodada(2, 9)).toBe(false);
    expect(venceuARodada(null, 9)).toBe(false);
  });
});
