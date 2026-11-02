import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { MechBase } from '../entities/MechBase';
import { MISSOES_DE_COMBATE } from '../sim/MissaoDeCombate';
import { MarcadorDeAlvo } from './MarcadorDeAlvo';

/** Um robô de mentira com só o que o marcador lê: a posição, a altura e se está vivo. */
const robo = (x: number, vivo = true): MechBase =>
  ({ alive: vivo, root: { position: new THREE.Vector3(x, 0, 2) }, stats: { height: 4 } }) as unknown as MechBase;

/** Quantas marcas estão visíveis na cena. */
const visiveis = (cena: THREE.Scene): THREE.Object3D[] => cena.children.filter((c) => c.visible);

describe('o marcador dos alvos da missão (P314, corte 2)', () => {
  it('a caça marca só o primeiro Mech, logo acima dele', () => {
    const cena = new THREE.Scene();
    const marcador = new MarcadorDeAlvo(cena);
    marcador.atualizar(MISSOES_DE_COMBATE.caca, [robo(10), robo(20), robo(30)], 0);
    const marcas = visiveis(cena);
    expect(marcas).toHaveLength(1);
    expect(marcas[0]!.position.x).toBe(10);
    expect(marcas[0]!.position.y).toBeCloseTo(4 * 1.15, 5);
  });

  it('a destruição marca os três Mechs marcados; um deles caído perde a marca', () => {
    const cena = new THREE.Scene();
    const marcador = new MarcadorDeAlvo(cena);
    marcador.atualizar(MISSOES_DE_COMBATE.destruicao, [robo(10), robo(20, false), robo(30)], 0);
    expect(visiveis(cena).map((m) => m.position.x)).toEqual([10, 30]);
  });

  it('a aniquilação não tem alvo marcado, e fora da missão também não há marca', () => {
    const cena = new THREE.Scene();
    const marcador = new MarcadorDeAlvo(cena);
    marcador.atualizar(MISSOES_DE_COMBATE.aniquilacao, [robo(10), robo(20), robo(30)], 0);
    expect(visiveis(cena)).toHaveLength(0);
    marcador.atualizar(MISSOES_DE_COMBATE.caca, [robo(10)], 0);
    marcador.atualizar(null, [robo(10)], 0);
    expect(visiveis(cena)).toHaveLength(0);
  });

  it('esconder tira todas as marcas, e a cena nunca cresce além das três marcas de uma vez', () => {
    const cena = new THREE.Scene();
    const marcador = new MarcadorDeAlvo(cena);
    const criadas = cena.children.length;
    marcador.atualizar(MISSOES_DE_COMBATE.destruicao, [robo(10), robo(20), robo(30)], 0);
    expect(visiveis(cena)).toHaveLength(3);
    marcador.esconder();
    expect(visiveis(cena)).toHaveLength(0);
    marcador.atualizar(MISSOES_DE_COMBATE.destruicao, [robo(10), robo(20), robo(30)], 1);
    expect(cena.children.length).toBe(criadas);
  });
});
