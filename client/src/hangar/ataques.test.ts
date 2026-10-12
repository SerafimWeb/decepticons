import { describe, expect, it } from 'vitest';
import { attackOf, DEFAULT_TRIGGERS, SHOULDER_TRIGGERS } from '../combat/mounts';
import { CHASSIS, type ChassisId } from '../entities/chassis';
import { armOptions, hasShoulderSlot, SLOT_MOUNT, slotAttack, type ArmSlot } from './loadout';

const CHASSIS_IDS = Object.keys(CHASSIS) as ChassisId[];

/**
 * Dono, 12/10 (P95): *"os robôs têm ataque 1 e ataque 2: arma 1 as dos braços, arma 2 a dos ombros/costas/peitoral nos robôs maiores; nos pequenos de entrada, o braço direito e o
 * esquerdo, cada um com um botão do mouse, permitem melhores combinações"*. O jogo já atirava assim; agora o Hangar, o HUD e as dicas dizem "Ataque 1" e "Ataque 2".
 */
describe('Ataque 1 e Ataque 2: qual botão aciona cada encaixe', () => {
  it('o layout de gatilhos diz o ataque de cada encaixe; fora do layout, nenhum', () => {
    expect(attackOf(DEFAULT_TRIGGERS, 'rightHand')).toBe(1);
    expect(attackOf(DEFAULT_TRIGGERS, 'leftHand')).toBe(2);
    expect(attackOf(DEFAULT_TRIGGERS, 'rightShoulder')).toBeNull();
    expect(attackOf(DEFAULT_TRIGGERS, 'leftShoulder')).toBeNull();
    expect(attackOf(SHOULDER_TRIGGERS, 'rightHand')).toBe(1);
    expect(attackOf(SHOULDER_TRIGGERS, 'leftHand')).toBe(1);
    expect(attackOf(SHOULDER_TRIGGERS, 'rightShoulder')).toBe(2);
    expect(attackOf(SHOULDER_TRIGGERS, 'leftShoulder')).toBe(2);
  });

  it('cada ranhura do Hangar é um encaixe: as mãos pelas mãos e os dois ombros pelo ombro direito', () => {
    expect(SLOT_MOUNT).toEqual({ right: 'rightHand', left: 'leftHand', shoulders: 'rightShoulder' });
  });

  it('nos robôs pequenos de entrada (sem ombros) cada braço tem o seu botão: o direito é o Ataque 1 e o esquerdo, o Ataque 2', () => {
    const pequenos = CHASSIS_IDS.filter((id) => !hasShoulderSlot(id));
    expect(pequenos.length).toBeGreaterThanOrEqual(8); // Vector-09, Andróide, Colossus, Arara, Onça, Gênesis, Lancer, Bastion, Quadra
    for (const id of pequenos) {
      expect(slotAttack('right', id), id).toBe(1);
      expect(slotAttack('left', id), id).toBe(2);
      expect(slotAttack('shoulders', id), id).toBeNull(); // sem ombros, nada a atirar dali
    }
  });

  it('nos robôs maiores (com ombros) os braços são o Ataque 1 e os ombros, o Ataque 2', () => {
    const grandes = CHASSIS_IDS.filter((id) => hasShoulderSlot(id));
    expect(grandes).toContain('marauder');
    for (const id of grandes) {
      expect(slotAttack('right', id), id).toBe(1);
      expect(slotAttack('left', id), id).toBe(1);
      expect(slotAttack('shoulders', id), id).toBe(2);
    }
  });

  it('o braço direito é sempre o Ataque 1 (em qualquer robô), e todo encaixe que tem arma atira em algum ataque', () => {
    for (const id of CHASSIS_IDS) {
      expect(slotAttack('right', id), id).toBe(1);
      for (const slot of ['right', 'left', 'shoulders'] as ArmSlot[]) {
        if (armOptions(slot, id).length > 0) expect(slotAttack(slot, id), `${id}.${slot}`).not.toBeNull();
      }
    }
  });

  it('o braço esquerdo do Lancer (o escudo) é o Ataque 2: é o clique direito que levanta a chapa', () => {
    expect(slotAttack('left', 'lancerL1')).toBe(2);
  });

  it('o Marauder: Ataque 1 = as duas mãos; Ataque 2 = os dois ombros (o canhão sônico, o teleguiado, os foguetes e a chuva)', () => {
    expect([slotAttack('right', 'marauder'), slotAttack('left', 'marauder'), slotAttack('shoulders', 'marauder')]).toEqual([1, 1, 2]);
    expect(armOptions('shoulders', 'marauder')).toEqual(expect.arrayContaining(['sonic', 'seeker', 'rockets', 'barrage']));
  });
});
