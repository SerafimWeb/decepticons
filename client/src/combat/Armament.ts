import type { MechBase } from '../entities/MechBase';
import { DEFAULT_TRIGGERS, type MountId } from './mounts';
import { FireTimer, RocketLauncher } from './trigger';
import { weapon, type WeaponStats } from './weapons';

/** Até onde a mira procura onde atirar (m): sem nada no caminho, as bocas convergem nesta distância. */
export const AIM_RANGE = 400;

/**
 * Quem desenha e solta o tiro que a regra decidiu. O jogador local implementa (boca do desenho, mira da câmera, som,
 * partículas); o servidor também (boca da simulação, direção do comando de rede). A regra, não.
 */
export interface ShotSink {
  /** Saiu um projétil de energia de `mount`. */
  projectile(mount: MountId, w: WeaponStats): void;
  /** Saiu um foguete de `mount`; `volley` é a ordem dele na salva deste aperto do botão (0 = o primeiro). */
  rocket(mount: MountId, w: WeaponStats, volley: number): void;
  /** A serra cortou (corpo a corpo): quem aplica o corte é a partida. */
  melee(w: WeaponStats): void;
}

/**
 * A regra de tiro do Mech (G14: uma só, no cliente e no servidor): cadência, carregador, calor e o que cada botão
 * aciona. Roda no tick fixo, sem 3D, sem DOM, sem relógio; nada é alocado por tick (G4).
 *
 * - **Botão principal:** a mão direita atira a `primary`. Nos chassis com duas mãos no gatilho (Marauder), a esquerda
 *   atira a `offhand` junto, entrando **meio intervalo depois** quando as duas estão prontas no mesmo tick (o ritmo fica
 *   alternado e o calor não chega todo de uma vez). Cada mão depende do braço dela de pé.
 * - **Botão secundário:** foguetes gastam **um** tiro do carregador e saem de **todos** os encaixes do botão que
 *   estiverem de pé (um na mão esquerda, ou um em cada ombro: a salva dobra o dano e o calor do aperto, não o carregador).
 *   Motosserra corta no ritmo dela; uma arma de energia no braço esquerdo (Arara, Onça) atira como o plasma.
 * - **Calor:** cada tiro soma o calor da arma no dissipador do Mech; superaquecido, nenhum encaixe atira.
 */
export class Armament {
  /** Carregador do gatilho secundário (o HUD lê daqui). Refeito ao trocar de armas. */
  launcher: RocketLauncher;
  /** Cadência de cada mão do gatilho principal. */
  private readonly hands = [new FireTimer(), new FireTimer()];
  /** Cadência do gatilho secundário quando ele não é de carregador (serra, arma de energia). */
  private readonly side = new FireTimer();

  constructor(private readonly mech: MechBase) {
    this.launcher = this.newLauncher();
  }

  /** O Mech trocou de armas (Hangar): carregador novo, cheio, com o lançador montado. */
  rearm(): void {
    this.launcher = this.newLauncher();
    for (const t of this.hands) t.reset();
    this.side.reset();
  }

  /** Um tick: `fire` e `secondary` dizem quais botões estão apertados; o que sair vai para `sink`. */
  fixedUpdate(dt: number, fire: boolean, secondary: boolean, sink: ShotSink): void {
    const m = this.mech;
    const l = m.loadout;
    const triggers = m.stats.triggers ?? DEFAULT_TRIGGERS;

    const right = this.hands[0]!;
    const left = this.hands[1]!;
    right.fixedUpdate(dt);
    left.fixedUpdate(dt);
    if (fire) {
      let fired = false;
      for (let i = 0; i < triggers.primary.length; i++) {
        const w = i === 0 ? l.primary : l.offhand;
        const mount = triggers.primary[i]!;
        const timer = this.hands[i]!;
        if (!w || !timer.ready || !m.canFireMount(mount)) continue;
        if (fired) {
          timer.shot(w.fireInterval / 2);
          continue;
        }
        sink.projectile(mount, w);
        m.onFireMount(mount, w);
        timer.shot(w.fireInterval);
        fired = true;
      }
    }

    // Morto, o carregador enche (renasce pronto).
    if (!m.alive) this.launcher.refill();
    else this.launcher.fixedUpdate(dt);
    this.side.fixedUpdate(dt);
    const s = l.secondary;
    if (!s || !secondary || !m.canFireSecondary) return;
    if (s.kind === 'ammo') {
      if (!this.launcher.tryFire()) return;
      let volley = 0;
      for (const mount of triggers.secondary) {
        if (!m.canFireMount(mount)) continue;
        sink.rocket(mount, s, volley++);
        m.onFireMount(mount, s);
      }
    } else if (this.side.ready) {
      if (s.kind === 'melee') {
        sink.melee(s);
        m.onFireSecondary();
      } else {
        for (const mount of triggers.secondary) {
          if (!m.canFireMount(mount)) continue;
          sink.projectile(mount, s);
          m.onFireMount(mount, s);
        }
      }
      this.side.shot(s.fireInterval);
    }
  }

  private newLauncher(): RocketLauncher {
    return new RocketLauncher(this.mech.loadout.secondary ?? weapon('rockets'));
  }
}
