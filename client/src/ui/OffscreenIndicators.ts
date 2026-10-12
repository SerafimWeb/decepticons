import * as THREE from 'three';
import type { BotSystem } from '../combat/BotSystem';
import { Android } from '../entities/Android';
import type { MechBase } from '../entities/MechBase';

/** Só mostra seta de quem está até esta distância (m): com 7 bots, a borda da tela vira poluição. */
const MAX_DIST = 120;
/** E no máximo estas setas, as dos inimigos mais perto: com um esquadrão grande (P91), 20 setas escondem a tela. */
export const MAX_ARROWS = 8;
const _pos = new THREE.Vector3();

type Kind = 'mech' | 'android' | 'technician';

interface Arrow {
  el: HTMLElement;
  kind: Kind | '';
  deg: number;
  shown: boolean;
}

/**
 * Setas na borda da tela apontando para inimigos fora da visão: vermelha para Mech, menor para andróide,
 * amarela piscando para o técnico (alvo prioritário). Feito pelo Gemini (PR #40) e concluído pelo Claude
 * com a revisão: nada alocado por quadro (G4), o DOM só é escrito quando muda (tipo, ângulo arredondado
 * a 1°, visível), some com o jogador morto e ignora quem está longe demais. Fica dentro do `#hud`: o F1
 * esconde junto.
 */
export class OffscreenIndicators {
  private readonly container = document.getElementById('offscreen-indicators');
  private readonly pool: Arrow[] = [];
  /** O tipo de cada robô não muda: calcula uma vez. */
  private readonly kinds = new Map<MechBase, Kind>();
  /** Os `MAX_ARROWS` mais perto, em ordem de distância (reaproveitados por quadro: nada alocado). */
  private readonly nearD2 = new Float64Array(MAX_ARROWS);
  private readonly nearDeg = new Float64Array(MAX_ARROWS);
  private readonly nearMech: MechBase[] = new Array<MechBase>(MAX_ARROWS);

  update(camera: THREE.Camera, bots: BotSystem, player: MechBase): void {
    let used = 0;
    if (this.container && player.alive) {
      for (const mech of bots.mechs) {
        if (!mech.alive) continue;
        const dx = mech.position.x - player.position.x;
        const dz = mech.position.z - player.position.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > MAX_DIST * MAX_DIST) continue;
        // Já há as `MAX_ARROWS` setas e esta é mais longe que todas: nem projeta.
        if (used === MAX_ARROWS && d2 >= this.nearD2[MAX_ARROWS - 1]!) continue;
        _pos.copy(mech.position);
        _pos.y += mech.stats.height / 2;
        _pos.project(camera);
        // Atrás da câmera a projeção sai espelhada: inverte a direção.
        const behind = _pos.z > 1;
        if (!behind && _pos.x >= -1 && _pos.x <= 1 && _pos.y >= -1 && _pos.y <= 1) continue;
        const sx = behind ? -_pos.x : _pos.x;
        const sy = behind ? _pos.y : -_pos.y; // tela: y cresce para baixo
        // Inserção ordenada por distância (≤ 8 lugares).
        let i = used < MAX_ARROWS ? used++ : MAX_ARROWS - 1;
        while (i > 0 && this.nearD2[i - 1]! > d2) {
          this.nearD2[i] = this.nearD2[i - 1]!;
          this.nearDeg[i] = this.nearDeg[i - 1]!;
          this.nearMech[i] = this.nearMech[i - 1]!;
          i--;
        }
        this.nearD2[i] = d2;
        this.nearDeg[i] = Math.round((Math.atan2(sy, sx) * 180) / Math.PI);
        this.nearMech[i] = mech;
      }
      for (let i = 0; i < used; i++) this.show(i, this.kindOf(this.nearMech[i]!, bots), this.nearDeg[i]!);
    }
    for (let i = used; i < this.pool.length; i++) {
      const a = this.pool[i]!;
      if (a.shown) {
        a.el.style.display = 'none';
        a.shown = false;
      }
    }
  }

  private kindOf(mech: MechBase, bots: BotSystem): Kind {
    let k = this.kinds.get(mech);
    if (!k) {
      k = bots.technicianOf(mech) ? 'technician' : mech instanceof Android ? 'android' : 'mech';
      this.kinds.set(mech, k);
    }
    return k;
  }

  private show(i: number, kind: Kind, deg: number): void {
    let a = this.pool[i];
    if (!a) {
      const el = document.createElement('div');
      this.container!.append(el);
      a = { el, kind: '', deg: NaN, shown: false };
      this.pool.push(a);
    }
    if (a.kind !== kind) {
      a.el.className = `offscreen-indicator ${kind}`;
      a.kind = kind;
    }
    if (a.deg !== deg) {
      a.el.style.transform = `rotate(${deg}deg) translateX(min(45vw, 45vh))`;
      a.deg = deg;
    }
    if (!a.shown) {
      a.el.style.display = 'block';
      a.shown = true;
    }
  }
}
