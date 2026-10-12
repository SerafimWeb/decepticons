import { describe, expect, it } from 'vitest';
import { readoutOf, viewOf, type MechLike, type TargetView } from './TargetPanel';

const MAX = { torso: 300, head: 100, leftArm: 120, rightArm: 120, leftLeg: 150, rightLeg: 150 };

function mech(over: Partial<MechLike> = {}): MechLike {
  return {
    alive: true,
    modules: { ...MAX },
    stats: { name: 'VECTOR-09', maxModuleHealth: MAX },
    heat: 0,
    heatState: 'normal',
    isDashing: false,
    ...over,
  };
}

function view(over: Partial<TargetView> = {}): TargetView {
  return { ...viewOf(mech()), ...over };
}

describe('painel do alvo (o que já vem no estado da rede)', () => {
  it('desenha uma linha por parte, na mesma ordem do HUD do próprio Mech, e o calor no fim', () => {
    const r = readoutOf(view())!;
    expect(r.lines).toHaveLength(7);
    expect(r.lines.map((l) => l.slice(0, 7))).toEqual(['CABEÇA ', 'TORSO  ', 'BRAÇO E', 'BRAÇO D', 'PERNA E', 'PERNA D', 'CALOR  ']);
    expect(r.title).toBe('VECTOR-09');
  });

  it('parte destruída fica marcada, e a barra segue a vida de cada parte', () => {
    const r = readoutOf(view({ parts: { ...MAX, torso: 150, leftLeg: 0 } }))!;
    expect(r.lines[1]).toContain('█████░░░░░'); // torso na metade
    expect(r.lines[4]).toContain('✗'); // perna esquerda arrancada
  });

  it('o calor é uma barra de dez blocos, presa ao intervalo 0..1', () => {
    expect(readoutOf(view({ heat: 0.7 }))!.lines[6]).toContain('███████░░░');
    expect(readoutOf(view({ heat: 1.5 }))!.lines[6]).toContain('██████████');
    expect(readoutOf(view({ heat: -1 }))!.lines[6]).toContain('░░░░░░░░░░');
  });

  it('superaquecido avisa que o alvo está travado (é a hora de avançar)', () => {
    expect(readoutOf(view({ heat: 1, heatState: 'overheated' }))!.warning).toBe('SUPERAQUECIDO · TRAVADO');
  });

  it('quente mas ainda atirando é só o aviso simples', () => {
    expect(readoutOf(view({ heat: 0.8, heatState: 'hot' }))!.warning).toBe('QUENTE');
  });

  it('dash entra junto das bandeiras, sem substituir o calor', () => {
    expect(readoutOf(view({ heat: 0.8, heatState: 'hot', dashing: true }))!.warning).toBe('QUENTE · EM DASH');
    expect(readoutOf(view({ dashing: true }))!.warning).toBe('EM DASH');
  });

  it('exibe bandeiras de estado elemental (EM CHAMAS, CHOCADO, ATORDOADO, GELADO, CONGELADO)', () => {
    expect(readoutOf(view({ statuses: ['queimando'] }))!.warning).toBe('EM CHAMAS');
    expect(readoutOf(view({ statuses: ['chocado', 'atordoado'] }))!.warning).toBe('CHOCADO · ATORDOADO');
    expect(
      readoutOf(view({ heatState: 'overheated', dashing: true, statuses: ['gelado', 'congelado'] }))!.warning
    ).toBe('SUPERAQUECIDO · TRAVADO · EM DASH · GELADO · CONGELADO');
  });

  it('alvo morto não tem painel', () => {
    expect(readoutOf(view({ alive: false }))).toBeNull();
  });

  it('lê o Mech na forma do painel reaproveitando o mesmo rascunho (zero alocação por quadro)', () => {
    const m = mech({ heat: 0.5, heatState: 'hot', isDashing: true, statuses: ['queimando'] });
    const first = viewOf(m);
    expect(first.name).toBe('VECTOR-09');
    expect(first.parts).toBe(m.modules);
    expect(first.maxParts).toBe(m.stats.maxModuleHealth);
    expect(first.heat).toBe(0.5);
    expect(first.heatState).toBe('hot');
    expect(first.dashing).toBe(true);
    expect(first.statuses).toEqual(['queimando']);
    expect(viewOf(mech())).toBe(first);
  });
});

