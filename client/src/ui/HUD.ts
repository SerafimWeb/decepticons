import type { CameraMode } from '../camera/CameraMode';
import type { DamageResult } from '../combat/damage';
import type { MechBase, MechPart } from '../entities/MechBase';
import { KillBanner } from './KillBanner';
import { NetHud } from './NetHud';
import { pipFills } from './rocketPips';
import { RoundOverlay } from './RoundOverlay';
import { Vitals } from './Vitals';
import { WeaponReticle, reticleWeapon } from './WeaponReticle';

const $ = (id: string) => document.getElementById(id)!;

/** Anúncio quando uma parte do alvo cai (com a concordância de cada uma). */
const PART_DESTROYED: Record<MechPart, string> = {
  torso: 'TORSO DESTRUÍDO',
  head: 'CABEÇA DESTRUÍDA',
  leftArm: 'BRAÇO ESQ DESTRUÍDO',
  rightArm: 'BRAÇO DIR DESTRUÍDO',
  leftLeg: 'PERNA ESQ DESTRUÍDA',
  rightLeg: 'PERNA DIR DESTRUÍDA',
};
const HIT_S = 0.12;
const CRIT_S = 0.35;
const LABEL_S = 1.4;
const DAMAGE_FLASH_S = 0.25;

/** Integridade do próprio Mech: uma barra de 10 blocos por parte (o painel do alvo lê igual). */
export const INTEGRITY_ROWS: readonly (readonly [MechPart, string])[] = [
  ['head', 'CABEÇA '],
  ['torso', 'TORSO  '],
  ['leftArm', 'BRAÇO E'],
  ['rightArm', 'BRAÇO D'],
  ['leftLeg', 'PERNA E'],
  ['rightLeg', 'PERNA D'],
];

export function integrityBar(value: number, max: number): string {
  if (value <= 0) return '░░░░░░░░░░ ✗';
  const n = Math.max(1, Math.ceil((value / max) * 10));
  return '█'.repeat(n) + '░'.repeat(10 - n);
}

export interface SpinGaugeState {
  hidden: boolean;
  level: number;
  strokeDashoffset: number;
  circumference: number;
}

const SPIN_CIRCUMFERENCE = 2 * Math.PI * 26;

/**
 * T4 — Lógica do medidor da rotatória (sem DOM):
 * Um arco fino em volta da mira que enche com a rotação do cano (0 a 1); some em 0.
 */
export function computeSpinGauge(level: number): SpinGaugeState {
  const l = Math.max(0, Math.min(1, Number.isFinite(level) ? level : 0));
  const hidden = l <= 0.001;
  const strokeDashoffset = SPIN_CIRCUMFERENCE * (1 - l);
  return {
    hidden,
    level: l,
    strokeDashoffset,
    circumference: SPIN_CIRCUMFERENCE,
  };
}

export class HUD {

  readonly net = new NetHud();
  readonly killBanner = new KillBanner();
  readonly roundOverlay = new RoundOverlay();
  private readonly root = $('hud');
  private readonly overlay = $('overlay');
  private readonly cta = $('cta');
  private readonly crosshair = $('crosshair');
  private readonly reticle = new WeaponReticle(this.crosshair);
  private readonly dash = $('dash');
  private readonly stats = $('stats');
  private readonly vitals = new Vitals($('vitals'));
  private readonly atq1 = $('atq1');
  private readonly missionStatus = $('mission-status');
  private readonly missionSummary = $('round-summary');
  private readonly modeLabel = $('mode');
  private readonly hitmarker = $('hitmarker');
  private readonly hitLabel = $('hit-label');
  private readonly reloadLabel = $('reload-label');
  private readonly damageVignette = $('damage-vignette');
  private readonly death = $('death');
  private readonly deathTimer = $('death-timer');
  private cursorMode = false;
  private textTimer = 0;
  private hitTimer = 0;
  private labelTimer = 0;
  private damageTimer = 0;
  private shownReloading = false;
  private shownAimOpen = -1;
  private kills = 0;
  private deaths = 0;
  private shownRespawn = '';
  private shownDash = -1;
  private shownSpeed = '';
  private shownPrimaryHeld = false;
  private shownSecondaryHeld = false;
  private shownMission = '';
  /** Quantas ondas tem a missão (vem de `setMissionWave`): a barra de cima mostra "ONDA 2/6", não um 5 fixo. */
  private missionWaves = 6;
  private ctfNoticeTimer = 0;
  private ctfProgressText = '';

  /** Assinatura de build no canto da pausa: versão, build e estúdio (como os jogos de estúdio mostram). */
  setBuild(text: string): void {
    const el = document.createElement('p');
    el.className = 'build-tag';
    el.textContent = text;
    (this.overlay.querySelector('.menu-foot') ?? this.overlay).append(el);
  }

  setReady(touch = false): void {
    this.cta.textContent = touch ? '[ toque para jogar ]' : '[ clique para jogar ]';
  }

  setMissionMode(enabled: boolean): void {
    this.missionStatus.hidden = !enabled;
    if (enabled) this.resetMission();
  }

  setCtfMode(enabled: boolean): void {
    this.missionStatus.hidden = !enabled;
    this.missionStatus.classList.toggle('ctf', enabled);
    if (enabled) this.resetCtf();
  }

  resetMission(): void {
    this.shownMission = '';
    this.missionSummary.hidden = true;
    this.missionSummary.textContent = '';
    this.missionStatus.classList.remove('clear');
    this.setMissionText('MISSÃO SOBREVIVÊNCIA · PREPARAÇÃO');
    this.setReady(document.documentElement.classList.contains('touch'));
  }

  resetCtf(): void {
    this.shownMission = '';
    this.missionSummary.hidden = true;
    this.missionSummary.textContent = '';
    this.missionStatus.classList.remove('clear');
    this.ctfNoticeTimer = 0;
    this.ctfProgressText = 'CTF · AZUL 0 × 0 VERMELHO · 08:00';
    this.setMissionText(this.ctfProgressText);
    this.setReady(document.documentElement.classList.contains('touch'));
  }

  setCtfProgress(timeLeft: number, blue: number, red: number): void {
    const seconds = Math.max(0, Math.ceil(timeLeft));
    const clock = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    this.ctfProgressText = `CTF · AZUL ${blue} × ${red} VERMELHO · ${clock}`;
    if (this.ctfNoticeTimer <= 0) {
      this.missionStatus.classList.remove('clear');
      this.setMissionText(this.ctfProgressText);
    }
  }

  showCtfEvent(text: string): void {
    this.missionStatus.classList.add('clear');
    this.ctfNoticeTimer = 1.5;
    this.setMissionText(text);
  }

  setCtfEnd(winner: 'blue' | 'red' | null, blue: number, red: number, blueKills: number, redKills: number): void {
    const title = winner === 'blue' ? 'VITÓRIA DO TIME AZUL' : winner === 'red' ? 'VITÓRIA DO TIME VERMELHO' : 'EMPATE';
    this.missionStatus.classList.toggle('clear', winner === 'blue');
    this.setMissionText(`CTF ENCERRADO · ${title}`);
    this.missionSummary.hidden = false;
    this.missionSummary.textContent = `${title}\nCAPTURAS ${blue} × ${red} · ABATES ${blueKills} × ${redKills}`;
    this.cta.textContent = '[ clique para jogar de novo ]';
  }

  /** Fim do Domínio: o placar final e o convite para jogar de novo (a barra de cima já mostra os pontos). */
  setDominioEnd(vencedor: 'blue' | 'red' | null, azul: number, vermelho: number): void {
    const titulo = vencedor === 'blue' ? 'VITÓRIA' : vencedor === 'red' ? 'DERROTA' : 'EMPATE';
    this.missionStatus.hidden = false;
    this.missionStatus.classList.toggle('clear', vencedor === 'blue');
    this.setMissionText(`DOMÍNIO ENCERRADO · ${titulo}`);
    this.missionSummary.hidden = false;
    this.missionSummary.textContent = `${titulo}\nAZUL ${azul} × ${vermelho} VERMELHO`;
    this.cta.textContent = '[ clique para jogar de novo ]';
  }

  /** Nova partida do Domínio: some o fim da partida anterior. */
  resetDominio(): void {
    this.shownMission = '';
    this.missionSummary.hidden = true;
    this.missionSummary.textContent = '';
    this.missionStatus.hidden = true;
    this.missionStatus.classList.remove('clear');
    this.setReady(document.documentElement.classList.contains('touch'));
  }

  setMissionWave(wave: number, total: number, title: string, waves: number): void {
    this.missionWaves = waves;
    this.missionStatus.classList.remove('clear');
    this.setMissionText(`ONDA ${wave}/${waves} · ${title.toUpperCase()} · 0/${total}`);
  }

  setMissionProgress(wave: number, killed: number, total: number, elapsedS: number): void {
    this.missionStatus.classList.remove('clear');
    this.setMissionText(`ONDA ${wave}/${this.missionWaves} · ALVOS ${killed}/${total} · ${Math.floor(elapsedS)} s`);
  }

  showMissionClear(wave: number, elapsedS: number): void {
    this.missionStatus.classList.add('clear');
    this.setMissionText(`ONDA ${wave} ELIMINADA · ${elapsedS.toFixed(1)} s`);
  }

  setMissionEnd(survived: boolean, waveReached: number, kills: number, seconds: number, estacaoCaiu = false): void {
    this.missionStatus.classList.toggle('clear', survived);
    this.setMissionText(survived ? 'MISSÃO CONCLUÍDA' : estacaoCaiu ? `ESTAÇÃO PERDIDA · ONDA ${waveReached}` : `MISSÃO FALHOU · ONDA ${waveReached}`);
    this.missionSummary.hidden = false;
    const motivo = survived ? 'TODAS AS ONDAS ELIMINADAS' : estacaoCaiu ? 'A ESTAÇÃO DE CABOS CAIU: A REDE FOI INVADIDA' : 'UNIDADE DE COMBATE PERDIDA';
    this.missionSummary.textContent = `${motivo}\n${kills} ABATES · ${seconds.toFixed(1)} s`;
    this.cta.textContent = '[ clique para tentar de novo ]';
  }

  private setMissionText(text: string): void {
    if (text === this.shownMission) return;
    this.shownMission = text;
    this.missionStatus.textContent = text;
  }

  private readonly rockets = document.getElementById('rockets')!;
  private readonly rocketPips = [...document.querySelectorAll<HTMLElement>('#rockets .pips i')];
  private shownRockets = -1;
  private shownReload = -1;
  private shownRocketsOff = false;

  /** Carregador do braço esquerdo: pips cheios, o próximo enchendo; apagado sem o braço. Só escreve no DOM quando muda. */
  /** Nome da arma do braço esquerdo no HUD (FOGUETES no Mech, MOTOSSERRA no andróide). */
  setSecondaryLabel(text: string | null): void {
    // Sem arma no braço esquerdo (o escudo do Lancer): o bloco some em vez de escrever FOGUETES apagado.
    this.rockets.hidden = text === null;
    const nome = this.rockets.querySelector('.nome');
    if (nome && text !== null) nome.textContent = text;
  }

  /** Nome da arma do Ataque 1 (o clique) no cartão de armas, com o nível (MK). */
  setPrimaryLabel(text: string): void {
    const nome = this.atq1.querySelector('.nome');
    if (nome) nome.textContent = text;
  }

  /**
   * Os quatro marcadores do carregador do Ataque 2. `magazine` é o tamanho do carregador: acima de quatro (o lançador de mísseis leve, com 8, 16 ou 32), os marcadores mostram a
   * **fração cheia** (cada um vale um quarto do lançador) e esvaziam durante a salva; até quatro, um marcador por tiro, e o próximo enche com a recarga.
   */
  setRockets(ammo: number, reload: number, available: boolean, magazine = 4): void {
    const r = Math.round(reload * 10) / 10;
    if (ammo === this.shownRockets && r === this.shownReload && available !== this.shownRocketsOff) return;
    this.shownRockets = ammo;
    this.shownReload = r;
    this.shownRocketsOff = !available;
    this.rockets.classList.toggle('off', !available);
    const fills = pipFills(ammo, r, magazine);
    this.rocketPips.forEach((pip, i) => pip.style.setProperty('--fill', String(fills[i] ?? 0)));
  }

  private readonly heatBox = document.getElementById('heat')!;
  private readonly heatFill = document.getElementById('heat-fill')!;
  private readonly heatLabel = this.heatBox.querySelector('.label')!;
  private shownHeat = -1;
  private shownOverheat = false;
  private shownCooling = false;
  private spinArcEl: SVGElement | null = null;
  private shownSpin = -1;

  /** Medidor da rotatória (T4): um arco fino em volta da mira que enche com a rotação do cano (0 a 1); some em 0. */
  setSpin(level: number): void {
    const state = computeSpinGauge(level);
    if (state.level === this.shownSpin) return;
    this.shownSpin = state.level;

    if (!this.spinArcEl && !state.hidden) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('id', 'rotary-spin-arc');
      svg.setAttribute('viewBox', '0 0 60 60');
      svg.setAttribute('class', 'rotary-spin-arc');
      svg.innerHTML = `<circle cx="30" cy="30" r="26" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="${state.circumference}" transform="rotate(-90 30 30)" />`;
      this.crosshair.appendChild(svg);
      this.spinArcEl = svg;
    }

    if (this.spinArcEl) {
      this.spinArcEl.style.display = state.hidden ? 'none' : 'block';
      if (!state.hidden) {
        const circle = this.spinArcEl.querySelector('circle');
        if (circle) {
          circle.style.strokeDashoffset = `${state.strokeDashoffset}`;
        }
      }
    }
  }

  /** Calor da arma: barra que enche, vermelha perto do limite; superaquecida, pisca. Só escreve no DOM quando muda. */

  setHeat(heat: number, overheated: boolean, coolingBoost: boolean): void {
    const h = Math.round(heat * 50) / 50;
    if (h === this.shownHeat && overheated === this.shownOverheat && coolingBoost === this.shownCooling) return;
    
    this.shownHeat = h;
    this.shownOverheat = overheated;
    this.shownCooling = coolingBoost;
    
    this.heatFill.style.transform = `scaleX(${h})`;
    this.heatBox.classList.toggle('high', h >= 0.7);
    this.heatBox.classList.toggle('over', overheated);
    
    if (overheated) {
      this.heatLabel.textContent = 'SUPERAQUECIDO · PARE';
    } else if (coolingBoost) {
      this.heatLabel.textContent = 'RESFRIANDO';
    } else {
      this.heatLabel.textContent = 'CALOR';
    }
  }

  /** Mira acesa: um inimigo vivo está sob ela. */
  setOnTarget(on: boolean): void {
    this.crosshair.classList.toggle('on-target', on);
  }

  /** Carregador vazio enchendo: "RECARREGANDO" ao lado da mira (frente 2). Só escreve no DOM quando muda. */
  setReloading(reloading: boolean): void {
    if (reloading === this.shownReloading) return;
    this.shownReloading = reloading;
    this.reloadLabel.classList.toggle('show', reloading);
  }

  /** Mira aberta (ordem P121): a mira cresce enquanto a arma ainda não assentou. Só escreve quando muda. */
  setAimOpen(open: number): void {
    const o = Math.round(Math.max(0, Math.min(1, open)) * 20) / 20;
    if (o === this.shownAimOpen) return;
    this.shownAimOpen = o;
    this.crosshair.style.setProperty('--aim-open', String(o));
  }

  setPaused(paused: boolean): void {
    this.overlay.classList.toggle('hidden', !paused);
    // O HUD da partida e o painel de desempenho ficam atrás da pausa só como ruído: o CSS os esconde com esta classe.
    document.body.classList.toggle('is-paused', paused);
  }

  toggleVisibility(): void {
    this.root.classList.toggle('hidden');
  }

  /** Marcador de acerto na mira; parte destruída ou abate ganham destaque e texto. */
  showHit(result: DamageResult): void {
    const crit = result.partDestroyed;
    this.hitmarker.classList.add('show');
    this.hitmarker.classList.toggle('crit', crit);
    this.hitTimer = crit ? CRIT_S : HIT_S;
    if (!crit) return;
    this.hitLabel.textContent = result.killed ? 'ALVO ABATIDO' : PART_DESTROYED[result.part];
    this.hitLabel.classList.add('show');
    this.labelTimer = LABEL_S;
  }

  /** Tomou dano: borda vermelha rápida. */
  showDamage(): void {
    this.damageVignette.classList.add('show');
    this.damageTimer = DAMAGE_FLASH_S;
  }

  setScore(kills: number, deaths: number): void {
    this.kills = kills;
    this.deaths = deaths;
    this.textTimer = 0;
  }

  /** Segundos até renascer, ou null se está vivo. */
  setRespawn(seconds: number | null, killCam = false): void {
    const text = seconds === null ? '' : `RENASCENDO EM ${seconds.toFixed(1)} s${killCam ? ' · CÂMERA DE ABATE [V: SAIR]' : ''}`;
    if (text === this.shownRespawn) return;
    this.shownRespawn = text;
    this.death.classList.toggle('show', seconds !== null);
    this.deathTimer.textContent = text;
  }

  setMode(mode: CameraMode): void {
    this.modeLabel.textContent = `VISTA ${mode.label}  [V]`;
    this.cursorMode = !mode.pointerLock;
    if (!this.cursorMode) {
      this.crosshair.style.left = '50%';
      this.crosshair.style.top = '50%';
    }
  }

  update(dt: number, mech: MechBase, cursorX: number, cursorY: number, primaryHeld = false, secondaryHeld = false, charge = 0): void {
    this.reticle.setWeapon(reticleWeapon(mech.loadout, primaryHeld, secondaryHeld));
    this.reticle.setCharge(charge);
    const isBlind = mech.isBlind;
    this.root.classList.toggle('blind', isBlind);

    if (this.ctfNoticeTimer > 0) {
      this.ctfNoticeTimer -= dt;
      if (this.ctfNoticeTimer <= 0 && this.ctfProgressText) {
        this.missionStatus.classList.remove('clear');
        this.setMissionText(this.ctfProgressText);
      }
    }

    if (this.cursorMode) {
      this.crosshair.style.left = `${cursorX}px`;
      this.crosshair.style.top = `${cursorY}px`;
    }

    // O anel do dash: 50 passos bastam para o olho, e o DOM só é escrito quando o passo muda. Robô sem dash (o titã) dá NaN: o anel some.
    const r = mech.dashReadiness;
    const ready = Number.isFinite(r) ? Math.round(Math.max(0, Math.min(1, r)) * 50) / 50 : -2;
    if (ready !== this.shownDash) {
      this.shownDash = ready;
      this.dash.hidden = ready === -2;
      this.dash.style.setProperty('--p', String(Math.max(0, ready)));
      this.dash.classList.toggle('ready', ready >= 1);
    }
    // O gatilho apertado acende o cartão da arma.
    if (primaryHeld !== this.shownPrimaryHeld) {
      this.shownPrimaryHeld = primaryHeld;
      this.atq1.classList.toggle('ativa', primaryHeld);
    }
    if (secondaryHeld !== this.shownSecondaryHeld) {
      this.shownSecondaryHeld = secondaryHeld;
      this.rockets.classList.toggle('ativa', secondaryHeld);
    }

    if (this.hitTimer > 0) {
      this.hitTimer -= dt;
      if (this.hitTimer <= 0) this.hitmarker.classList.remove('show');
    }
    if (this.labelTimer > 0) {
      this.labelTimer -= dt;
      if (this.labelTimer <= 0) this.hitLabel.classList.remove('show');
    }
    if (this.damageTimer > 0) {
      this.damageTimer -= dt;
      if (this.damageTimer <= 0) this.damageVignette.classList.remove('show');
    }

    this.textTimer -= dt;
    if (this.textTimer > 0) return;
    this.textTimer = 0.1;

    if (isBlind) {
      this.shownSpeed = '';
      this.stats.textContent = '';
      return;
    }

    const speed = Math.hypot(mech.velocity.x, mech.velocity.z);
    // Velocidade sob o minimapa; vida, partes e placar moram no painel de baixo (`Vitals`).
    const vel = `VEL ${speed.toFixed(1)} m/s`;
    if (vel !== this.shownSpeed) {
      this.shownSpeed = vel;
      this.stats.textContent = vel;
    }
    this.vitals.update(mech, this.kills, this.deaths);
  }
}
