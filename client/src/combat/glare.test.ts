import { describe, expect, it } from 'vitest';
import { GLOW } from '../core/palette';
import { LIMIAR_DO_BLOOM } from '../fx/bloomSeguro';
import { MUZZLE_FRIENDLY_SCALE } from '../fx/WeaponFx';
import { WEAPON_LOOK } from '../fx/weaponLook';

/**
 * Dono, 11/10: "os tiros normais geram muita luz na tela e prejudicam a visibilidade". A regra que ficou: o tiro do jogador acende
 * **menos** que o do inimigo (o do inimigo é o aviso e precisa saltar aos olhos; o do jogador o jogador já sabe onde está).
 *
 * Dono, 24/10 (P256): "ainda to achando que os tiros geram muita luz e atrapalha um pouco o jogo... tornar isso mais sutil e
 * elegante e gostoso de jogar". Daí o **teto** de cada efeito e o clarão do próprio cano menor que o do inimigo.
 */
const maximo = (c: { r: number; g: number; b: number }) => Math.max(c.r, c.g, c.b);

describe('brilho dos tiros', () => {
  it('cada tiro do jogador acende menos que o equivalente do inimigo', () => {
    expect(maximo(GLOW.friendlyPlasma)).toBeLessThan(maximo(GLOW.hostilePlasma));
    expect(maximo(GLOW.friendlyArc)).toBeLessThan(maximo(GLOW.hostileArc));
    expect(maximo(GLOW.friendlyIce)).toBeLessThan(maximo(GLOW.hostileIce));
    expect(maximo(GLOW.friendlySlug)).toBeLessThan(maximo(GLOW.hostileSlug));
  });

  it('o tiro do jogador ainda passa do limiar do bloom: some a luz que cega, não o rastro que mostra para onde foi', () => {
    for (const c of [GLOW.friendlyPlasma, GLOW.friendlyArc, GLOW.friendlyIce, GLOW.friendlySlug]) expect(maximo(c)).toBeGreaterThan(LIMIAR_DO_BLOOM);
  });

  it('nenhum efeito de tiro passa de 2,7 (o teto era 4,2 em 24/10): o halo não cobre mais o alvo', () => {
    for (const c of [GLOW.friendlyPlasma, GLOW.friendlyArc, GLOW.friendlyIce, GLOW.friendlyLaser, GLOW.friendlySlug, GLOW.spark, GLOW.core, GLOW.playerMuzzle]) {
      expect(maximo(c)).toBeLessThanOrEqual(2); // o que o jogador dispara
    }
    for (const c of [GLOW.hostilePlasma, GLOW.hostileArc, GLOW.hostileIce, GLOW.hostileLaser, GLOW.hostileSlug, GLOW.enemyMuzzle]) {
      expect(maximo(c)).toBeLessThanOrEqual(2.7); // o aviso de quem atira em você
    }
  });

  it('o clarão do próprio cano nasce menor que o do inimigo; nenhuma boca de arma solta cartaz maior que 2,6 m', () => {
    expect(MUZZLE_FRIENDLY_SCALE).toBeLessThan(0.8);
    for (const look of Object.values(WEAPON_LOOK)) {
      if (!look.muzzle) continue;
      expect(look.muzzle.size).toBeLessThanOrEqual(2.6);
      expect(look.muzzle.life).toBeLessThanOrEqual(0.1);
    }
  });
});
