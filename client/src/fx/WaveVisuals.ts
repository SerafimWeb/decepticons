import * as THREE from 'three';
import type { WeaponStats } from '../combat/weapons';
import type { BurstOptions, ParticleSystem } from './ParticleSystem';
import { SHAPE } from './particleShapes';

/**
 * A onda sônica desenhada (dono, 11/10: "os tiros de som devem ser visivelmente diferentes dos cinéticos e metálicos"): **arcos concêntricos** que se abrem da boca do ombro
 * (a forma `wave` do atlas, que gira para a direção em que anda, então cada arco fica de través ao avanço), mais um **anel** que cresce na própria boca. Nada de faísca nem de
 * faixa de luz: o som é um pulso de pressão. Cor lilás-pálida (nem o verde do plasma, nem o laranja do aço, nem o azul do gelo).
 *
 * Quem chama é a partida (`Match.waveCone`, no jogo offline, no servidor e no cliente que atira) e o outro jogador (`OnlineSession.remoteShot`, que só desenha). 10 partículas por
 * boca por tiro, um tiro a cada 1,2 s (as duas bocas dos ombros: 20 por aperto); no servidor as partículas são vazias. Zero draw call novo.
 */
const PALE = new THREE.Color(1.15, 1.0, 1.8);
const RING = new THREE.Color(0.9, 0.8, 1.5);

/** Cada camada vai até uma fração do alcance da arma, mais devagar e mais larga a de dentro (as de fora correm à frente). */
const LAYERS = [
  { reach: 0.55, life: 0.62, size: 3.4, count: 3, spread: 0.9 },
  { reach: 0.8, life: 0.5, size: 2.7, count: 3, spread: 1.05 },
  { reach: 1.0, life: 0.4, size: 2.1, count: 3, spread: 1.2 },
] as const;

/** Criadas uma vez por arma e nível (G4): o alcance muda com o nível, então há um conjunto por `maxRange`. */
const CACHE = new Map<number, readonly BurstOptions[]>();

function optionsFor(w: WeaponStats): readonly BurstOptions[] {
  const key = w.maxRange * 100 + w.wave!.halfAngle;
  let o = CACHE.get(key);
  if (!o) {
    const half = w.wave!.halfAngle;
    o = [
      ...LAYERS.map((l): BurstOptions => ({
        count: l.count, color: PALE, speed: (w.maxRange * l.reach) / l.life, life: l.life, size: l.size, expansion: 3, spread: half * l.spread, gravity: 0, shape: SHAPE.wave,
      })),
      { count: 1, color: RING, speed: 0, life: 0.3, size: 2.2, expansion: 7, gravity: 0, shape: SHAPE.ring },
    ];
    CACHE.set(key, o);
  }
  return o;
}

/** Solta a onda de `w` em `origin`, na direção `dir`. Quantas partículas saíram (para o teste e o orçamento). */
export function drawWave(particles: Pick<ParticleSystem, 'burst'>, origin: THREE.Vector3, dir: THREE.Vector3, w: WeaponStats): number {
  if (!w.wave) return 0;
  let n = 0;
  for (const o of optionsFor(w)) {
    particles.burst(origin, dir, o);
    n += o.count;
  }
  return n;
}
