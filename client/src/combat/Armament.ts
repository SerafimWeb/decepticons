import { ChargeTimer } from './ChargeTimer';
import { aimSpreadOf, aimTimeOf, settleSpread, settleStep } from './aim';
import type { MechBase } from '../entities/MechBase';
import { type MountId } from './mounts';
import { NO_SPREAD, spreadAt, type Spread } from './spread';
import { FireTimer, FuelTank, RocketLauncher, SpinUp } from './trigger';
import { weapon, type WeaponStats } from './weapons';

/** As duas mãos de gatilho (índice 0 e 1 das armas por mão: `primary` e `offhand`). */
const HAND_MOUNTS = ['rightHand', 'leftHand'] as const;

/** Até onde a mira procura onde atirar (m): sem nada no caminho, as bocas convergem nesta distância. */
export const AIM_RANGE = 400;

/**
 * Quem desenha e solta o tiro que a regra decidiu. O jogador local implementa (boca do desenho, mira da câmera, som,
 * partículas); o servidor também (boca da simulação, direção do comando de rede). A regra, não.
 */
export interface ShotSink {
  /** Saiu um projétil de energia de `mount`; `spread` é o desvio da rotatória (zero nas outras armas), a aplicar na direção da mira. */
  projectile(mount: MountId, w: WeaponStats, spread: Readonly<Spread>): void;
  /**
   * Saiu um foguete de `mount`; `volley` é a ordem dele na salva deste aperto do botão (0 = o primeiro). `spread` é o desvio do míssil do lançador leve (`Salvo`: um
   * ponto do cone, por número de míssil; zero nas outras armas), a aplicar na direção da mira.
   */
  rocket(mount: MountId, w: WeaponStats, volley: number, spread: Readonly<Spread>): void;
  /** A serra cortou (corpo a corpo): quem aplica o corte é a partida. */
  melee(w: WeaponStats): void;
  /** Um pulso do lança-chamas de `mount` (a cada `fireInterval`): quem aplica o cone de dano é a partida (`Match.flameCone`). */
  flame(mount: MountId, w: WeaponStats): void;
  /** Saiu uma onda sônica de `mount` (um cone de uma vez só, com empurrão): quem aplica é a partida (`Match.waveCone`). */
  wave(mount: MountId, w: WeaponStats): void;
  /**
   * Saiu um pulso do raio laser de `mount` (`Beam`): acerta na hora o primeiro que o feixe encontra, e quem aplica é a partida (`Match.beamPulse`). **Opcional:** quem não sabe
   * desenhar feixe (um teste, um bot) recebe o pulso como um projétil comum pelo `projectile`.
   */
  beam?(mount: MountId, w: WeaponStats): void;
}

/**
 * A regra de tiro do Mech (G14: uma só, no cliente e no servidor): cadência, carregador, calor e o que cada botão
 * aciona. Roda no tick fixo, sem 3D, sem DOM, sem relógio; nada é alocado por tick (G4).
 *
 * - **Ataque 1 (botão principal):** a mão direita atira a `primary`. Nos chassis com duas mãos no gatilho (Marauder), a esquerda
 *   atira a `offhand` junto, entrando **meio intervalo depois** quando as duas estão prontas no mesmo tick (o ritmo fica
 *   alternado e o calor não chega todo de uma vez). Cada mão depende do braço dela de pé.
 * - **Ataque 2 (botão secundário):** foguetes gastam **um** tiro do carregador e saem de **todos** os encaixes do botão que
 *   estiverem de pé (um na mão esquerda, ou um em cada ombro: a salva dobra o dano e o calor do aperto, não o carregador).
 *   Motosserra corta no ritmo dela; uma arma de energia no braço esquerdo (Arara, Onça) atira como o plasma.
 * - **Layout dividido (Marauder, `SPLIT_SHOULDER_TRIGGERS`):** a mão esquerda passa para o **Ataque 2** com a `offhand` dela, e os ombros seguem no Ataque 2 com a `secondary`:
 *   armas diferentes no mesmo botão, cada uma com o seu cronômetro, o seu giro de cano, o seu tanque e o seu calor. A mão direita fica sozinha no Ataque 1.
 * - **Calor:** cada tiro soma o calor da arma no dissipador do Mech; superaquecido, nenhum encaixe atira.
 */
export class Armament {
  /** Carregador do gatilho secundário (o HUD lê daqui). Refeito ao trocar de armas. */
  launcher: RocketLauncher;
  /** Cadência de cada mão do gatilho principal. */
  private primaryLaunchers: RocketLauncher[];
  private readonly hands = [new FireTimer(), new FireTimer()];
  /** A mão está com o botão dela apertado neste tick (o cano gira e a chama acende só então). */
  private readonly held = [false, false];
  /** Quanto a mira já assentou em cada gatilho (0 = aberta, 1 = firme): a identidade de mira da arma (ordem P121). */
  private readonly aimLevel = [0, 0, 0];
  /** Cadência do gatilho secundário quando ele não é de carregador (serra, arma de energia). */
  private readonly side = new FireTimer();
  private readonly charge = [new ChargeTimer(), new ChargeTimer(), new ChargeTimer()];
  /** Rotação do cano de cada mão (só a metralhadora rotatória gira; nas outras armas fica em 0). */
  private readonly spin = [new SpinUp(), new SpinUp()];
  /** Tanque de combustível de cada mão (só o lança-chamas tem; `null` nas outras armas). */
  private tanks: (FuelTank | null)[] = [null, null];
  /** A chama de cada mão está acesa neste tick. */
  private readonly burning = [false, false];
  /** Número do tiro da rotatória: o desvio de cada um sai dele, sem sorteio. */
  private shots = 0;
  private readonly spread: Spread = { x: 0, y: 0 };
  /** Rotação do cano da arma principal, de 0 (parado) a 1 (plena): o medidor do HUD lê daqui. */
  get spinLevel(): number { return Math.max(this.spin[0]!.level, this.spin[1]!.level); }
  /** O medidor de combustível do HUD: 0 com o tanque cheio e parado (nada a mostrar); senão, de 0 a 1 (na trava, o quanto da recarga passou). */
  get fuelLevel(): number {
    let level = 0;
    for (const t of this.tanks) if (t && (t.locked || t.fuel < t.capacity)) level = Math.max(level, Math.max(0.02, t.level));
    return level;
  }
  get primaryCharge(): number { return Math.max(this.charge[0]!.progress, this.charge[1]!.progress); }
  get secondaryCharge(): number { return this.charge[2]!.progress; }

  constructor(private readonly mech: MechBase) {
    this.launcher = this.newLauncher();
    this.primaryLaunchers = [new RocketLauncher(mech.loadout.primary), new RocketLauncher(mech.loadout.offhand ?? mech.loadout.primary)];
    this.refuel();
  }

  /** Um tanque novo para cada mão que leva lança-chamas. */
  private refuel(): void {
    const l = this.mech.loadout;
    this.tanks = [l.primary, l.offhand ?? null].map((w) => (w?.flame ? new FuelTank(w.flame.fuel, w.flame.reload) : null));
    this.burning[0] = this.burning[1] = false;
    this.mech.status.flaming = false;
  }

  /** O Mech trocou de armas (Hangar): carregador novo, cheio, com o lançador montado. */
  rearm(): void {
    this.launcher = this.newLauncher();
    this.primaryLaunchers = [new RocketLauncher(this.mech.loadout.primary), new RocketLauncher(this.mech.loadout.offhand ?? this.mech.loadout.primary)];
    for (const t of this.hands) t.reset();
    for (const s of this.spin) s.reset();
    this.aimLevel[0] = this.aimLevel[1] = this.aimLevel[2] = 0; // arma nova: a mira abre e assenta de novo (ordem P121)
    this.refuel();
    this.mech.status.spinning = false;
    this.side.reset();
    for (const c of this.charge) c.reset();
    this.mech.weaponCharging = false;
  }

  /** Um tick: `fire` e `secondary` dizem quais botões estão apertados; o que sair vai para `sink`. */
  fixedUpdate(dt: number, fire: boolean, secondary: boolean, sink: ShotSink): void {
    const m = this.mech;
    const l = m.loadout;
    const triggers = m.triggers; // o layout que a montagem escolheu (`Loadout.layout`)
    // Escudo físico na mão esquerda: o botão 2 levanta a chapa em vez de atirar (não há arma secundária).
    m.guard(secondary && !l.secondary);

    const right = this.hands[0]!;
    const left = this.hands[1]!;
    for (const launcher of this.primaryLaunchers) {
      if (!m.alive) launcher.refill(); else launcher.fixedUpdate(dt);
    }
    right.fixedUpdate(dt);
    left.fixedUpdate(dt);
    {
      // Cada mão segue o botão que o layout põe nela: no padrão, as duas mãos do Marauder no Ataque 1; no layout dividido, a esquerda no Ataque 2. A segunda mão do mesmo botão
      // entra meio intervalo depois (`fired`); mãos em botões diferentes não se atrapalham.
      let firedOn1 = false;
      let firedOn2 = false;
      this.held[0] = this.held[1] = false;
      for (let i = 0; i < 2; i++) {
        const mount = HAND_MOUNTS[i]!;
        const w = i === 0 ? l.primary : l.offhand;
        // Só o chassi de duas mãos armadas (`offhand` declarado) tem a mão esquerda como mão de gatilho; nos outros ela é a arma do Ataque 2 (mais abaixo).
        const button = triggers.primary.includes(mount) ? 1 : i === 1 && l.offhand !== undefined && triggers.secondary.includes(mount) ? 2 : 0;
        const timer = this.hands[i]!;
        if (button === 0) {
          this.spin[i]!.reset();
          this.burning[i] = false;
          continue;
        }
        const held = button === 1 ? fire : secondary;
        this.held[i] = held;
        // A mira assenta segurando o gatilho (cada arma no seu tempo, ordem P121); soltar desassenta.
        this.aimLevel[i] = w ? settleStep(this.aimLevel[i]!, dt, held, aimTimeOf(w)) : 1;
        // O cano da rotatória gira enquanto o gatilho está apertado e a mão pode atirar; solto ou travado, vai parando.
        const spin = this.spin[i]!;
        if (w?.spin) spin.step(dt, held && m.canFireMount(mount), w.spin);
        else spin.reset();
        // Lança-chamas: a chama acende enquanto o gatilho está apertado, a mão pode atirar e há combustível; um pulso a cada `fireInterval`.
        const tank = this.tanks[i];
        if (w?.flame && tank) {
          const lit = tank.step(dt, held && m.canFireMount(mount));
          this.burning[i] = lit;
          if (lit && timer.ready) {
            sink.flame(mount, w);
            m.onFireMount(mount, w);
            timer.shot(w.fireInterval);
          }
          continue;
        }
        this.burning[i] = false;
        // A salva do lançador leve que já começou não se cancela soltando o gatilho (`RocketLauncher.committed`): o tiro segue sendo pedido até o último míssil.
        const pull = held || (w?.kind === 'ammo' && this.primaryLaunchers[i]!.committed);
        if (!w || !this.charge[i]!.step(dt, pull, timer.ready && m.canFireMount(mount), w.chargeTime, w.chargeHold)) continue;
        if (button === 1 ? firedOn1 : firedOn2) {
          timer.shot(w.fireInterval / 2);
          continue;
        }
        if (w.kind === 'ammo') {
          if (!this.primaryLaunchers[i]!.tryFire()) continue;
          sink.rocket(mount, w, i, this.salvoSpread(w));
        } else if (w.beam && sink.beam) sink.beam(mount, w);
        else sink.projectile(mount, w, this.spreadFor(w, spin, this.aimLevel[i]!));
        m.onFireMount(mount, w);
        timer.shot(spin.interval(w));
        if (button === 1) firedOn1 = true;
        else firedOn2 = true;
      }
    }

    // Cano girando e chama acesa na rede (os outros jogadores desenham o fluxo por estas bandeiras, sem um evento por tiro).
    m.status.spinning = (this.held[0]! && this.spin[0]!.level > 0.3) || (this.held[1]! && this.spin[1]!.level > 0.3);
    m.status.flaming = m.alive && (this.burning[0]! || this.burning[1]!);
    if (!m.alive) for (const t of this.tanks) t?.refill(); // renasce com o tanque cheio

    // Morto, o carregador enche (renasce pronto).
    if (!m.alive) this.launcher.refill();
    else this.launcher.fixedUpdate(dt);
    this.side.fixedUpdate(dt);
    const s = l.secondary;
    // A salva do lançador leve que já começou segue saindo com o botão solto (`RocketLauncher.committed`).
    if (!s || !(secondary || (s.kind === 'ammo' && this.launcher.committed)) || !m.canFireSecondary) {
      this.charge[2]!.reset();
      m.weaponCharging = this.primaryCharge > 0;
      return;
    }
    m.weaponCharging = this.primaryCharge > 0;
    if (s.kind === 'ammo') {
      if (!this.launcher.tryFire()) return;
      let volley = 0;
      for (const mount of triggers.secondary) {
        if (mount === 'leftHand' && l.offhand !== undefined) continue; // a mão armada do Marauder já atirou no laço das mãos
        if (!m.canFireMount(mount)) continue;
        sink.rocket(mount, s, volley++, this.salvoSpread(s));
        m.onFireMount(mount, s);
      }
    } else if (this.charge[2]!.step(dt, secondary, this.side.ready, s.chargeTime, s.chargeHold)) {
      if (s.kind === 'melee') {
        sink.melee(s);
        m.onFireSecondary();
      } else {
        for (const mount of triggers.secondary) {
          if (mount === 'leftHand' && l.offhand !== undefined) continue;
          if (!m.canFireMount(mount)) continue;
          // A onda sônica sai das duas bocas dos ombros ao mesmo tempo (como os foguetes); a rotatória só vai no gatilho principal (ARM_SLOTS).
          if (s.wave) sink.wave(mount, s);
          else if (s.beam && sink.beam) sink.beam(mount, s);
          else sink.projectile(mount, s, NO_SPREAD);
          m.onFireMount(mount, s);
        }
      }
      this.side.shot(s.fireInterval);
    }
    m.weaponCharging = this.primaryCharge > 0 || this.secondaryCharge > 0;
  }

  /** O desvio deste tiro: o cone da rotatória cresce com a rotação do cano, e a mira aberta (P121) soma a sua amplitude; as outras armas vão retas. */
  private spreadFor(w: WeaponStats, spin: SpinUp, aimNivel: number): Readonly<Spread> {
    const cone = (w.spin ? w.spin.spread * spin.level : 0) + settleSpread(aimSpreadOf(w), aimNivel);
    if (cone <= 0) return NO_SPREAD;
    return spreadAt(this.shots++, cone, this.spread);
  }

  /** O desvio do próximo míssil da salva do lançador leve (`Salvo.cone`, por número de míssil, sem sorteio); as outras armas de munição saem sem desvio. */
  private salvoSpread(w: WeaponStats): Readonly<Spread> {
    return w.salvo ? spreadAt(this.shots++, w.salvo.cone, this.spread) : NO_SPREAD;
  }

  /** Quanto a mira principal está **aberta** (0 = firme). Arma sem tempo de mira (corte, chama, rotatória): 0. */
  get aimOpen(): number {
    return aimTimeOf(this.mech.loadout.primary) > 0 ? 1 - this.aimLevel[0]! : 0;
  }

  private newLauncher(): RocketLauncher {
    return new RocketLauncher(this.mech.loadout.secondary ?? weapon('rockets'));
  }
}
