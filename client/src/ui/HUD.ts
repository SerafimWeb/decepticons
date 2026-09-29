import type { CameraMode } from '../camera/CameraMode';
import type { DamageResult } from '../combat/damage';
import type { MechBase, MechPart } from '../entities/MechBase';
import { KillBanner } from './KillBanner';
import { NetHud } from './NetHud';
import { RoundOverlay } from './RoundOverlay';

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

export class HUD {
  readonly net = new NetHud();
  readonly killBanner = new KillBanner();
  readonly roundOverlay = new RoundOverlay();
  private readonly root = $('hud');
  private readonly overlay = $('overlay');
  private readonly cta = $('cta');
  private readonly crosshair = $('crosshair');
  private readonly dash = $('dash');
  private readonly dashFill = $('dash-fill');
  private readonly stats = $('stats');
  private readonly missionStatus = $('mission-status');
  private readonly missionSummary = $('round-summary');
  private readonly modeLabel = $('mode');
  private readonly hitmarker = $('hitmarker');
  private readonly hitLabel = $('hit-label');
  private readonly damageVignette = $('damage-vignette');
  private readonly death = $('death');
  private readonly deathTimer = $('death-timer');
  private cursorMode = false;
  private textTimer = 0;
  private hitTimer = 0;
  private labelTimer = 0;
  private damageTimer = 0;
  private kills = 0;
  private deaths = 0;
  private shownRespawn = '';
  private shownMission = '';
  private ctfNoticeTimer = 0;
  private ctfProgressText = '';

  /** Assinatura de build no canto da pausa: versão, build e estúdio (como os jogos de estúdio mostram). */
  setBuild(text: string): void {
    const el = document.createElement('p');
    el.className = 'build-tag';
    el.textContent = text;
    this.overlay.append(el);
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

  setMissionWave(wave: number, total: number, title: string, waves: number): void {
    this.missionStatus.classList.remove('clear');
    this.setMissionText(`ONDA ${wave}/${waves} · ${title.toUpperCase()} · 0/${total}`);
  }

  setMissionProgress(wave: number, killed: number, total: number, elapsedS: number): void {
    this.missionStatus.classList.remove('clear');
    this.setMissionText(`ONDA ${wave}/5 · ALVOS ${killed}/${total} · ${Math.floor(elapsedS)} s`);
  }

  showMissionClear(wave: number, elapsedS: number): void {
    this.missionStatus.classList.add('clear');
    this.setMissionText(`ONDA ${wave} ELIMINADA · ${elapsedS.toFixed(1)} s`);
  }

  setMissionEnd(survived: boolean, waveReached: number, kills: number, seconds: number): void {
    this.missionStatus.classList.toggle('clear', survived);
    this.setMissionText(survived ? 'MISSÃO CONCLUÍDA' : `MISSÃO FALHOU · ONDA ${waveReached}`);
    this.missionSummary.hidden = false;
    this.missionSummary.textContent = `${survived ? 'TODAS AS ONDAS ELIMINADAS' : 'UNIDADE DE COMBATE PERDIDA'}\n${kills} ABATES · ${seconds.toFixed(1)} s`;
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
  setSecondaryLabel(text: string): void {
    const label = this.rockets.querySelector('.label');
    if (label) label.textContent = text;
  }

  setRockets(ammo: number, reload: number, available: boolean): void {
    const r = Math.round(reload * 10) / 10;
    if (ammo === this.shownRockets && r === this.shownReload && available !== this.shownRocketsOff) return;
    this.shownRockets = ammo;
    this.shownReload = r;
    this.shownRocketsOff = !available;
    this.rockets.classList.toggle('off', !available);
    this.rocketPips.forEach((pip, i) => {
      pip.style.setProperty('--fill', i < ammo ? '1' : i === ammo ? String(r) : '0');
    });
  }

  private readonly heatBox = document.getElementById('heat')!;
  private readonly heatFill = document.getElementById('heat-fill')!;
  private readonly heatLabel = this.heatBox.querySelector('.label')!;
  private shownHeat = -1;
  private shownOverheat = false;
  private shownCooling = false;

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

  setPaused(paused: boolean): void {
    this.overlay.classList.toggle('hidden', !paused);
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
    this.modeLabel.textContent = `CAM ${mode.label}  [V]`;
    this.cursorMode = !mode.pointerLock;
    if (!this.cursorMode) {
      this.crosshair.style.left = '50%';
      this.crosshair.style.top = '50%';
    }
  }

  update(dt: number, mech: MechBase, cursorX: number, cursorY: number): void {
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

    const ready = mech.dashReadiness;
    this.dashFill.style.transform = `scaleX(${ready})`;
    this.dash.classList.toggle('ready', ready >= 1);

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
    this.textTimer = 0.2;

    if (isBlind) {
      this.stats.textContent = '';
      return;
    }

    const speed = Math.hypot(mech.velocity.x, mech.velocity.z);
    let integrity = '';
    for (const [part, label] of INTEGRITY_ROWS) {
      integrity += `\n${label} ${integrityBar(mech.modules[part], mech.stats.maxModuleHealth[part])}`;
    }
    this.stats.textContent =
      `${mech.stats.name}\n` +
      `VEL    ${speed.toFixed(1).padStart(5)} m/s\n` +
      `ABATES ${this.kills.toString().padStart(5)}\n` +
      `MORTES ${this.deaths.toString().padStart(5)}\n` +
      integrity;
  }
}
