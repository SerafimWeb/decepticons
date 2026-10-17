import { describe, expect, it } from 'vitest';
import { BANK_DOOR } from '../../../shared/bank/codes';
import { ARENA_ZONES } from '../combat/Zone';
import { BARRICADES_DA_ARENA, BUILDINGS_DA_ARENA, PLATAFORMA_DA_ARENA, SPAWN_POINTS } from './Arena';
import { ARENA_QUADRO_DE_LUZ, ARENA_QUADRO_VIDA, ARENA_QUADRO_VOLUME } from './ArenaLayout';
import { QUADRO } from '../sim/QuadroDeLuz';

const meia = (v: number): number => v / 2;
/** A distância do ponto à caixa (0 se estiver dentro); a folga que sobra entre o armário e o obstáculo. */
const distanciaAoRetangulo = (px: number, pz: number, cx: number, cz: number, w: number, d: number): number => {
  const dx = Math.max(Math.abs(px - cx) - meia(w), 0);
  const dz = Math.max(Math.abs(pz - cz) - meia(d), 0);
  return Math.hypot(dx, dz);
};

describe('o layout da Cidade Neon: o transformador do Banco Vorcaris (P164, parte E)', () => {
  const { x, z } = ARENA_QUADRO_DE_LUZ;
  const raioDoArmario = Math.hypot(meia(ARENA_QUADRO_VOLUME.w), meia(ARENA_QUADRO_VOLUME.d));

  it('fica dentro da arena e perto do banco: a leste da porta, a poucos passos (o jogador socorre; o saboteiro chega por perto)', () => {
    expect(Math.abs(x)).toBeLessThan(100);
    expect(Math.abs(z)).toBeLessThan(100);
    const doBanco = Math.hypot(x - BANK_DOOR.x, z - BANK_DOOR.z);
    expect(doBanco).toBeGreaterThan(8);
    expect(doBanco).toBeLessThan(25);
    expect(x, 'a leste do banco').toBeGreaterThan(BANK_DOOR.x);
  });

  it('não encosta em prédio, barricada nem plataforma (o armário tem colisor), e deixa uma folga para passar dos dois lados', () => {
    for (const b of BUILDINGS_DA_ARENA) {
      expect(distanciaAoRetangulo(x, z, b.x, b.z, b.w, b.d) - raioDoArmario, `prédio em ${b.x},${b.z}`).toBeGreaterThan(3);
    }
    for (const b of BARRICADES_DA_ARENA) {
      expect(distanciaAoRetangulo(x, z, b.x, b.z, b.w, b.d) - raioDoArmario, `barricada em ${b.x},${b.z}`).toBeGreaterThan(3);
    }
    const p = PLATAFORMA_DA_ARENA;
    expect(distanciaAoRetangulo(x, z, p.x, p.z, p.w, p.d) - raioDoArmario).toBeGreaterThan(3);
  });

  it('não pisa nas zonas de cura e de resfriamento, e nenhum ponto de nascimento cai em cima do armário', () => {
    for (const zona of ARENA_ZONES) expect(Math.hypot(x - zona.x, z - zona.z)).toBeGreaterThan(zona.radius + raioDoArmario);
    for (const [sx, sz] of SPAWN_POINTS) expect(Math.hypot(x - sx, z - sz), `nascimento em ${sx},${sz}`).toBeGreaterThan(QUADRO.raioDeAtaque);
  });

  it('a vida é a do coração da cidade: maior que a do porto da praia, para o Colossus levar tempo (e o jogador ter o que defender)', () => {
    expect(ARENA_QUADRO_VIDA).toBeGreaterThan(QUADRO.vidaMax);
  });
});
