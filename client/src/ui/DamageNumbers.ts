import * as THREE from 'three';

/**
 * Números de dano flutuantes (frente 2 da P109, referência no MechArena §6.1): o dano que **você**
 * aplica sobe do corpo do inimigo e some. É o retorno que faltava — o marcador na mira diz "acertei",
 * o número diz **quanto**, que é a informação que transforma a escolha da arma numa decisão.
 *
 * Custo (G4/G5): pool fixo de nós no DOM, criados uma vez; por acerto só um nó é reescrito (texto,
 * posição e a classe) e a subida é uma animação de CSS — nada roda por quadro no JavaScript, exceto o
 * contador de vida de quem está vivo (≤ `DMG_POOL`). A posição é o ponto do mundo projetado **uma vez**,
 * na hora do acerto: o número sobe na tela e pronto (não fica grudado no robô que anda).
 */

/** Nós no pool: o suficiente para segurar uma rajada (rotatória, chuva) sem reaproveitar o mesmo número. */
export const DMG_POOL = 24;
/** Quanto tempo o número vive na tela (s). */
export const DMG_LIFE_S = 0.85;
/**
 * Acertos no mesmo alvo dentro desta janela (s) somam no mesmo número (P160): os nove balins de um disparo de escopeta viram **um** "54", não
 * nove "6" empilhados. Curta o bastante para a rajada da rotatória (20 tiros/s, 0,05 s) continuar mostrando cada tiro.
 */
export const DMG_MERGE_S = 0.04;

/** O texto do número: inteiro, no mínimo 1 — um acerto que passou pela defesa nunca aparece como "0". */
export function formatDamage(applied: number): string {
  const n = Math.round(applied);
  return String(Number.isFinite(n) && n > 0 ? n : 1);
}

interface Slot {
  el: HTMLElement;
  ttl: number;
  live: boolean;
}

const _p = new THREE.Vector3();

export class DamageNumbers {
  private readonly slots: Slot[] = [];
  private next = 0;
  /** O último número mostrado: de quem era o acerto e quanto já somou (para juntar os balins do mesmo disparo). */
  private lastSlot: Slot | null = null;
  private lastKey: object | null = null;
  private lastTotal = 0;

  constructor(root: HTMLElement | null = typeof document !== 'undefined' ? document.getElementById('damage-numbers') : null) {
    if (!root) return;
    for (let i = 0; i < DMG_POOL; i++) {
      const el = document.createElement('div');
      el.className = 'dmg-number';
      el.style.display = 'none';
      root.appendChild(el);
      this.slots.push({ el, ttl: 0, live: false });
    }
  }

  /**
   * Um acerto do jogador: o número nasce no ponto do mundo (`world`) e sobe sozinho. Projeta uma vez;
   * fora da tela ou atrás da câmera, não gasta um nó.
   */
  show(camera: THREE.Camera, world: THREE.Vector3, applied: number, crit = false, key: object | null = null): void {
    if (this.slots.length === 0) return;
    // O mesmo alvo acertado de novo dentro da janela (os balins de um disparo): soma no número que já está subindo.
    const last = this.lastSlot;
    if (key !== null && key === this.lastKey && last && last.live && DMG_LIFE_S - last.ttl <= DMG_MERGE_S) {
      this.lastTotal += applied;
      last.el.textContent = formatDamage(this.lastTotal);
      if (crit) last.el.classList.add('crit');
      return;
    }
    _p.copy(world).project(camera);
    if (_p.z > 1) return; // atrás da câmera: a projeção sai espelhada
    const left = (_p.x * 0.5 + 0.5) * 100;
    const top = (-_p.y * 0.5 + 0.5) * 100;
    if (left < -3 || left > 103 || top < -3 || top > 103) return;
    const slot = this.slots[this.next]!;
    this.next = (this.next + 1) % this.slots.length;
    slot.el.textContent = formatDamage(applied);
    slot.el.style.left = `${left.toFixed(2)}vw`;
    slot.el.style.top = `${top.toFixed(2)}vh`;
    slot.el.style.display = 'block';
    // Reinicia a animação de subida: tira a classe, força o reflow, devolve (com `crit` se for o caso).
    slot.el.className = 'dmg-number';
    void slot.el.offsetWidth;
    slot.el.className = crit ? 'dmg-number crit live' : 'dmg-number live';
    slot.ttl = DMG_LIFE_S;
    slot.live = true;
    this.lastSlot = slot;
    this.lastKey = key;
    this.lastTotal = applied;
  }

  /** Conta a vida de quem está na tela e esconde o que venceu. Nada mais roda por quadro. */
  update(dt: number): void {
    for (const s of this.slots) {
      if (!s.live) continue;
      s.ttl -= dt;
      if (s.ttl <= 0) {
        s.live = false;
        s.el.style.display = 'none';
      }
    }
  }
}
