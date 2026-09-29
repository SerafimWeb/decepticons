import type { MechPart } from '../entities/MechBase';
import type { HeatState } from '../combat/heat';
import { INTEGRITY_ROWS, integrityBar } from './HUD';

/**
 * Painel do alvo sob a mira: o que o jogador precisa para decidir o próximo movimento — **qual parte já
 * caiu**, **quanto calor o inimigo está segurando** (travado ou prestes a travar) e se ele está em dash.
 *
 * Toda essa informação **já viaja na rede**: cada unidade leva 19 bytes com as seis partes, o calor e as
 * bandeiras `dashing`/`overheated` (`shared/net/state.ts`). O painel não pede um byte novo — ele só torna
 * legível o que o combate já decidia às cegas: "mirei na perna" passa a ser uma escolha informada.
 *
 * O mesmo módulo serve ao bot offline e à unidade remota do online: os dois chegam como `MechLike`
 * (no online, `MechBase.applyNetVitals` já escreve partes e calor vindos do servidor).
 */

const BLOCKS = 10;

/** O que o painel lê de um Mech — o bot offline e o Mech remoto satisfazem esta forma. */
export interface MechLike {
  alive: boolean;
  modules: Readonly<Record<MechPart, number>>;
  stats: { name: string; maxModuleHealth: Readonly<Record<MechPart, number>> };
  heat: number;
  heatState: HeatState;
  isDashing: boolean;
}

/** A leitura crua do alvo, pronta para virar texto. */
export interface TargetView {
  name: string;
  alive: boolean;
  parts: Readonly<Record<MechPart, number>>;
  maxParts: Readonly<Record<MechPart, number>>;
  heat: number;
  heatState: HeatState;
  dashing: boolean;
}

/** O que desenhar: título, uma linha por parte, o calor e os avisos. */
export interface TargetReadout {
  title: string;
  lines: readonly string[];
  warning: string;
}

/**
 * Rascunho do módulo: o painel lê o alvo a cada quadro e **não aloca** (G4/G5 — a mesma regra dos vetores
 * de rascunho da simulação).
 */
const _view: TargetView = {
  name: '',
  alive: false,
  parts: { torso: 0, head: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 },
  maxParts: { torso: 1, head: 1, leftArm: 1, rightArm: 1, leftLeg: 1, rightLeg: 1 },
  heat: 0,
  heatState: 'normal',
  dashing: false,
};

/** Lê um Mech na forma do painel, escrevendo em `out` (por padrão, o rascunho do módulo). */
export function viewOf(mech: MechLike, out: TargetView = _view): TargetView {
  out.name = mech.stats.name;
  out.alive = mech.alive;
  out.parts = mech.modules;
  out.maxParts = mech.stats.maxModuleHealth;
  out.heat = mech.heat;
  out.heatState = mech.heatState;
  out.dashing = mech.isDashing;
  return out;
}

function heatBar(heat: number): string {
  const n = Math.max(0, Math.min(BLOCKS, Math.ceil(heat * BLOCKS)));
  return '█'.repeat(n) + '░'.repeat(BLOCKS - n);
}

/**
 * Monta a leitura do alvo, ou `null` quando não há o que mostrar — alvo morto não tem painel (o lugar
 * dele na tela é do placar e da câmera de abate).
 */
export function readoutOf(target: TargetView): TargetReadout | null {
  if (!target.alive) return null;

  const lines: string[] = [];
  for (const [part, label] of INTEGRITY_ROWS) {
    lines.push(`${label} ${integrityBar(target.parts[part] ?? 0, target.maxParts[part] ?? 1)}`);
  }
  lines.push(`CALOR   ${heatBar(target.heat)}`);

  const flags: string[] = [];
  if (target.heatState === 'overheated') flags.push('SUPERAQUECIDO · TRAVADO');
  else if (target.heatState === 'hot') flags.push('QUENTE');
  if (target.dashing) flags.push('EM DASH');

  return { title: target.name, lines, warning: flags.join(' · ') };
}

const $ = (id: string) => document.getElementById(id)!;

/** Segundos entre remontar o texto: o alvo muda a 60 Hz, o olho lê bem mais devagar. */
const TEXT_S = 0.1;

export class TargetPanel {
  private readonly element: HTMLElement;
  private readonly name: HTMLElement;
  private readonly body: HTMLElement;
  private shown = '';
  private sinceText = 0;

  constructor(
    element: HTMLElement = $('target-panel'),
    name: HTMLElement = $('target-name'),
    body: HTMLElement = $('target-body'),
  ) {
    this.element = element;
    this.name = name;
    this.body = body;
    this.hide();
  }

  /** Alvo sob a mira neste quadro (ou null). Sem alvo vivo, o painel sai da tela. */
  update(dt: number, target: MechLike | null): void {
    this.sinceText -= dt;
    if (this.sinceText > 0) return;
    this.sinceText = TEXT_S;

    const readout = target ? readoutOf(viewOf(target)) : null;
    if (!readout) {
      this.hide();
      return;
    }

    const text = `${readout.title}\n${readout.lines.join('\n')}\n${readout.warning}`;
    if (text === this.shown) return;
    this.shown = text;
    this.name.textContent = readout.title;
    this.body.textContent = readout.lines.join('\n') + (readout.warning ? `\n${readout.warning}` : '');
    this.element.hidden = false;
  }

  hide(): void {
    if (this.shown === '') return;
    this.shown = '';
    this.name.textContent = '';
    this.body.textContent = '';
    this.element.hidden = true;
  }
}
