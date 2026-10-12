import { describe, expect, it } from 'vitest';
import { FX_BURNING, FX_FLAMING, FX_FROZEN, FX_SHOCKED, FX_SPINNING, FX_STUNNED, inflictOnHit, STATUS, StatusSet } from './StatusEffects';

const DT = 1 / 60;
/** Folga de 2 ticks: somar 1/60 duzentas e quarenta vezes não dá exatamente 4 s (ponto flutuante). */
const FOLGA = 2 * DT;
/** Passa `seconds` de simulação e devolve o dano por segundo somado. */
function run(s: StatusSet, seconds: number): number {
  let damage = 0;
  for (let i = 0, n = Math.round(seconds / DT); i < n; i++) damage += s.step(DT);
  return damage;
}

describe('estados: queimando', () => {
  it('dá dano por segundo durante o tempo, e depois some', () => {
    const s = new StatusSet();
    s.burnUp();
    expect(s.burning).toBe(true);
    expect(run(s, STATUS.burnTime + FOLGA)).toBeCloseTo(STATUS.burnDps * STATUS.burnTime, 0);
    expect(s.burning).toBe(false);
    expect(run(s, 2)).toBe(0);
    expect(s.active).toBe(false);
  });

  it('um novo contato renova o tempo em vez de somar', () => {
    const s = new StatusSet();
    s.burnUp();
    run(s, 3);
    s.burnUp();
    expect(run(s, STATUS.burnTime + FOLGA)).toBeCloseTo(STATUS.burnDps * STATUS.burnTime, 0);
  });

  it('o fogo esquenta o Mech (e só enquanto queima)', () => {
    const s = new StatusSet();
    expect(s.heatPerSecond).toBe(0);
    s.burnUp();
    expect(s.heatPerSecond).toBe(STATUS.burnHeatPerSecond);
  });
});

describe('estados: chocado e atordoado', () => {
  it('o choque deixa lento e dá dano por segundo, sem atordoar um acerto no corpo', () => {
    const s = new StatusSet();
    expect(s.shockUp(false)).toBe(false);
    expect(s.shocked).toBe(true);
    expect(s.stunned).toBe(false);
    expect(s.speedMultiplier).toBeCloseTo(STATUS.shockSpeed, 5);
    expect(run(s, STATUS.shockTime + FOLGA)).toBeCloseTo(STATUS.shockDps * STATUS.shockTime, 0);
    expect(s.speedMultiplier).toBe(1);
  });

  it('o tiro na cabeça atordoa: não anda nem atira, só pelo tempo certo', () => {
    const s = new StatusSet();
    expect(s.shockUp(true)).toBe(true);
    expect(s.stunned).toBe(true);
    expect(s.canAct).toBe(false);
    expect(s.speedMultiplier).toBe(0);
    run(s, STATUS.stunTime + 0.05);
    expect(s.canAct).toBe(true);
    expect(s.speedMultiplier).toBeCloseTo(STATUS.shockSpeed, 5); // ainda chocado, e lento
  });

  it('três acertos seguidos (cada um a menos de 1,4 s do anterior) também atordoam; dois não', () => {
    const s = new StatusSet();
    expect(s.shockUp(false)).toBe(false);
    run(s, 0.45);
    expect(s.shockUp(false)).toBe(false);
    run(s, 0.45);
    expect(s.shockUp(false)).toBe(true); // o terceiro, "pegando certinho"
  });

  it('a sequência se perde se demorar: acertos espaçados nunca atordoam', () => {
    const s = new StatusSet();
    for (let i = 0; i < 6; i++) {
      expect(s.shockUp(false)).toBe(false);
      run(s, STATUS.comboWindow + 0.1);
    }
  });

  it('depois de atordoar, fica imune por 4 s: nem a cabeça nem a sequência encadeiam', () => {
    const s = new StatusSet();
    expect(s.shockUp(true)).toBe(true);
    run(s, STATUS.stunTime + 0.1);
    expect(s.canAct).toBe(true);
    expect(s.shockUp(true)).toBe(false); // cabeça dentro da imunidade
    expect(s.canAct).toBe(true);
    run(s, 0.4);
    expect(s.shockUp(false)).toBe(false);
    run(s, 0.4);
    expect(s.shockUp(false)).toBe(false); // a "sequência" também não vale durante a imunidade
    expect(s.canAct).toBe(true);
    run(s, STATUS.stunImmune); // passou
    expect(s.shockUp(true)).toBe(true);
  });
});

describe('estados: gelado e congelado', () => {
  it('cada acúmulo deixa mais lento; o terceiro congela, e o congelado não anda, mas atira e leva mais dano', () => {
    const s = new StatusSet();
    s.chillUp();
    expect(s.stacks).toBe(1);
    expect(s.speedMultiplier).toBeCloseTo(1 - STATUS.chillStep, 5);
    s.chillUp();
    expect(s.speedMultiplier).toBeCloseTo(1 - 2 * STATUS.chillStep, 5);
    s.chillUp();
    expect(s.isFrozen).toBe(true);
    expect(s.stacks).toBe(0);
    expect(s.speedMultiplier).toBe(0);
    expect(s.canAct).toBe(true); // mira e atira
    expect(s.damageTaken).toBe(STATUS.frozenDamage);
    run(s, STATUS.freezeTime + 0.05);
    expect(s.isFrozen).toBe(false);
    expect(s.damageTaken).toBe(1);
  });

  it('os acúmulos se desfazem sozinhos se ninguém acertar de novo por 4 s', () => {
    const s = new StatusSet();
    s.chillUp();
    s.chillUp();
    run(s, STATUS.chillTime + 0.1);
    expect(s.stacks).toBe(0);
    expect(s.speedMultiplier).toBe(1);
  });

  it('depois de congelar, imune por 5 s: os acúmulos novos não congelam de novo', () => {
    const s = new StatusSet();
    for (let i = 0; i < 3; i++) s.chillUp();
    expect(s.isFrozen).toBe(true);
    run(s, STATUS.freezeTime + 0.1);
    for (let i = 0; i < 5; i++) s.chillUp();
    expect(s.isFrozen).toBe(false);
    expect(s.stacks).toBe(STATUS.chillMax); // fica no máximo, só lento
    run(s, STATUS.freezeImmune); // a imunidade acabou (e os acúmulos antigos se desfizeram)
    for (let i = 0; i < 3; i++) s.chillUp();
    expect(s.isFrozen).toBe(true);
  });
});

describe('estados: fogo e gelo se anulam (decisão do dono)', () => {
  it('o gelo apaga o fogo e o fogo apaga o gelo e o congelamento', () => {
    const s = new StatusSet();
    s.burnUp();
    s.chillUp();
    expect(s.burning).toBe(false);
    expect(s.stacks).toBe(1);
    s.burnUp();
    expect(s.stacks).toBe(0);
    expect(s.burning).toBe(true);
    for (let i = 0; i < 3; i++) s.chillUp();
    expect(s.isFrozen).toBe(true);
    s.burnUp();
    expect(s.isFrozen).toBe(false); // descongelou
    expect(s.speedMultiplier).toBe(1);
  });
});

describe('estados: Mech grande resiste, pequeno sofre mais', () => {
  it('a duração de todos os estados vai pelo resist do chassi', () => {
    const grande = new StatusSet();
    grande.resist = 0.5;
    grande.shockUp(true);
    expect(grande.shock).toBeCloseTo(STATUS.shockTime * 0.5, 5);
    expect(grande.stun).toBeCloseTo(STATUS.stunTime * 0.5, 5);
    grande.burnUp();
    expect(grande.burn).toBeCloseTo(STATUS.burnTime * 0.5, 5);
    const pequeno = new StatusSet();
    pequeno.resist = 1.5;
    pequeno.burnUp();
    expect(pequeno.burn).toBeCloseTo(STATUS.burnTime * 1.5, 5);
  });
});

describe('estados: o que aplica quem acerta e o crédito do abate', () => {
  it('inflictOnHit escolhe o estado pela arma e usa a parte atingida (cabeça só importa para o choque)', () => {
    const s = new StatusSet();
    inflictOnHit(s, 'burn', 'head', 'A');
    expect(s.burning).toBe(true);
    expect(s.source).toBe('A');
    inflictOnHit(s, 'shock', 'torso', 'B');
    expect(s.stunned).toBe(false);
    inflictOnHit(s, 'shock', 'head', 'B');
    expect(s.stunned).toBe(true);
    expect(s.source).toBe('B');
    inflictOnHit(s, 'chill', 'torso', 'C');
    expect(s.burning).toBe(false);
    expect(s.source).toBe('C');
  });

  it('o crédito some quando nada mais está ligado, e reset limpa tudo (morreu ou renasceu)', () => {
    const s = new StatusSet();
    s.burnUp('A');
    run(s, STATUS.burnTime + 0.1);
    expect(s.source).toBeUndefined();
    s.shockUp(true, 'B');
    s.chillUp('B');
    s.flaming = true;
    s.reset();
    expect(s.active).toBe(false);
    expect(s.bits).toBe(0);
    expect(s.source).toBeUndefined();
    expect(s.shockUp(true)).toBe(true); // a imunidade também zerou: vida nova
  });
});

describe('estados na rede: o byte fx', () => {
  it('as bandeiras de cada estado, os acúmulos de gelo e as de arma contínua cabem num byte sem se misturar', () => {
    const s = new StatusSet();
    s.burnUp();
    expect(s.bits).toBe(FX_BURNING);
    s.reset();
    s.shockUp(true);
    expect(s.bits).toBe(FX_SHOCKED | FX_STUNNED);
    s.reset();
    s.chillUp();
    s.chillUp();
    expect(s.bits).toBe(2 << 3);
    s.reset();
    for (let i = 0; i < 3; i++) s.chillUp();
    expect(s.bits).toBe(FX_FROZEN);
    s.reset();
    s.flaming = true;
    s.spinning = true;
    expect(s.bits).toBe(FX_FLAMING | FX_SPINNING);
    expect(s.bits).toBeLessThanOrEqual(255);
  });

  it('o cliente espelha o que o servidor mandou, liga com prazo curto, e desliga na hora o que não veio', () => {
    const servidor = new StatusSet();
    servidor.shockUp(true);
    servidor.chillUp();
    const cliente = new StatusSet();
    cliente.applyNet(servidor.bits);
    expect(cliente.shocked).toBe(true);
    expect(cliente.stunned).toBe(true);
    expect(cliente.stacks).toBe(1);
    expect(cliente.speedMultiplier).toBe(0); // atordoado: a previsão do próprio Mech para
    expect(cliente.bits).toBe(servidor.bits);
    // Um pacote atrasado (50 ms) não apaga o estado; o próximo, sem o bit, apaga.
    run(cliente, 0.05);
    expect(cliente.stunned).toBe(true);
    cliente.applyNet(0);
    expect(cliente.active).toBe(false);
    expect(cliente.speedMultiplier).toBe(1);
  });

  it('forEachActive lista os estados ligados, sem alocar, com o tempo restante e a intensidade', () => {
    const s = new StatusSet();
    s.burnUp();
    const vistos: string[] = [];
    s.forEachActive((kind, left, level) => vistos.push(`${kind}:${left.toFixed(1)}:${level}`));
    expect(vistos).toEqual(['queimando:4.0:1']);
    s.reset();
    s.chillUp();
    s.chillUp();
    const gelo: Array<[string, number]> = [];
    s.forEachActive((kind, _left, level) => gelo.push([kind, +level.toFixed(2)]));
    expect(gelo).toEqual([['gelado', 0.67]]);
  });
});
