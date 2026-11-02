import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { weapon, type Loadout } from '../combat/weapons';
import { BLUEPRINT_BY_CHASSIS } from './blueprintByChassis';
import { CHASSIS } from './chassis';
import { Vector09 } from './Vector09';

const CASCO = 0x1fa7b8;

function colossus(opcoes: { casco?: number; loadout?: Loadout } = {}): Vector09 {
  return new Vector09({ stats: CHASSIS.colossus01, blueprint: BLUEPRINT_BY_CHASSIS.colossus01, ...opcoes });
}

/** Quantos vértices do robô têm a cor dada (a cor de cada vértice é a do material que o desenho usou ao montar o rig). */
function vertices(m: Vector09, hex: number): { total: number; iguais: number } {
  const c = new THREE.Color(hex);
  let total = 0;
  let iguais = 0;
  m.root.traverse((o) => {
    const at = (o as THREE.Mesh).geometry?.attributes?.color;
    if (!at) return;
    for (let i = 0; i < at.count; i++) {
      total++;
      if (Math.abs(at.getX(i) - c.r) < 0.01 && Math.abs(at.getY(i) - c.g) < 0.01 && Math.abs(at.getZ(i) - c.b) < 0.01) iguais++;
    }
  });
  return { total, iguais };
}

describe('a cor do casco no Colossus-01 (P307)', () => {
  it('com a cor do casco, o aço também sai nessa cor: muito mais que antes, quando só as partes de pintura mudavam (medido: 6,4% -> 19,6% dos vértices)', () => {
    // A estrutura escura (braços, pinos, articulações) fica escura de propósito: a cor é do casco, não das juntas.
    const antes = vertices(new Vector09({ stats: CHASSIS.colossus01, blueprint: BLUEPRINT_BY_CHASSIS.colossus01, paint: CASCO }), CASCO);
    const depois = vertices(colossus({ casco: CASCO }), CASCO);
    expect(depois.iguais / depois.total).toBeGreaterThan(0.15);
    expect(depois.iguais).toBeGreaterThan(antes.iguais * 2);
  });

  it('sem a cor do casco, o visual de fábrica fica igual: nenhum vértice tem a cor da pintura', () => {
    expect(vertices(colossus(), CASCO).iguais).toBe(0);
  });

  it('a chuva de mísseis nas costas dispara de trás do robô (+Z é a costa), qualquer que seja o botão dela (P307)', () => {
    const loadout = { primary: weapon('siege'), secondary: weapon('siege'), back: weapon('barrage') } as Loadout;
    const boca = colossus({ loadout }).barrageMouth(new THREE.Vector3());
    expect(boca, 'a chuva tem boca de lançamento').toBeDefined();
    expect(boca!.z).toBeGreaterThan(0);
    expect(boca!.y).toBeGreaterThan(0);
  });
});
