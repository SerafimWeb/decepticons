import * as THREE from 'three';
import type { WeaponStats } from '../combat/weapons';
import type { BurstOptions, ParticleSystem } from './ParticleSystem';
import { SHAPE } from './particleShapes';

/**
 * A onda sônica desenhada, parte das partículas (dono, 11/10: "uma onda do som, **invisível, mas que dá pra ver quebrando as moléculas do ar**").
 * A onda em si são os **anéis que distorcem a imagem** (`fx/WaveRings.ts`); aqui ficam só as **moléculas**: pontinhos pálidos que o cone empurra
 * à frente e que somem rápido, para o ar mexido aparecer também onde o chão é liso. Nada de arco colorido nem faixa de luz: o som não tem cor.
 *
 * Quem chama é a partida (`Match.drawWave`, no jogo offline, no servidor e no cliente que atira) e o outro jogador (`OnlineSession.remoteShot`, que só
 * desenha). 6 partículas por boca por tiro, um tiro a cada 1,2 s (as duas bocas dos ombros: 12 por aperto); no servidor as partículas são vazias.
 */
const MOTE = new THREE.Color(0.7, 0.85, 1.1);

/** Quanto das moléculas anda (segundos) e que fração do alcance elas cobrem. */
const MOTE_LIFE_S = 0.5;
const MOTE_REACH = 0.95;
export const MOTES_PER_WAVE = 6;

/** Criadas uma vez por arma e nível (G4): o alcance muda com o nível, então há um conjunto por `maxRange`. */
const CACHE = new Map<number, readonly BurstOptions[]>();

function optionsFor(w: WeaponStats): readonly BurstOptions[] {
  const key = w.maxRange * 100 + w.wave!.halfAngle;
  let o = CACHE.get(key);
  if (!o) {
    o = [
      {
        count: MOTES_PER_WAVE,
        color: MOTE,
        speed: (w.maxRange * MOTE_REACH) / MOTE_LIFE_S,
        life: MOTE_LIFE_S,
        size: 0.7,
        expansion: -0.4,
        spread: w.wave!.halfAngle * 1.1,
        gravity: 0,
        shape: SHAPE.dot,
      },
    ];
    CACHE.set(key, o);
  }
  return o;
}

/** Solta as moléculas da onda de `w` em `origin`, na direção `dir`. Quantas partículas saíram (para o teste e o orçamento). */
export function drawWave(particles: Pick<ParticleSystem, 'burst'>, origin: THREE.Vector3, dir: THREE.Vector3, w: WeaponStats): number {
  if (!w.wave) return 0;
  let n = 0;
  for (const o of optionsFor(w)) {
    particles.burst(origin, dir, o);
    n += o.count;
  }
  return n;
}
