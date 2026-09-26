import { TIERS, weapon, type Tier, type WeaponId } from '../combat/weapons';
import { CHASSIS, type ChassisId } from '../entities/chassis';
import { Hangar } from '../hangar/Hangar';
import { armOptions, factorySpec, loadoutKey, type ArmSlot, type LoadoutSpec } from '../hangar/loadout';
import { reloadWithout } from '../core/url';
import type { Loadout } from '../combat/weapons';

/** O que a tela pede ao jogo: abrir e fechar o galpão 3D, mostrar a montagem, girar e aplicar na hora. */
export interface HangarPreview {
  open(): void;
  close(): void;
  show?(chassis: ChassisId, loadout: Loadout): void;
  rotate?(dx: number): void;
  /** Montagem do mesmo chassi aplicada: o jogo troca as armas (ou explica por que não) e devolve o aviso. */
  applied?(): string;
}

const CHASSIS_LABEL: Record<ChassisId, { title: string; className: string; detail: string }> = {
  vector09: { title: 'VECTOR-09', className: 'MÉDIO · ASSALTO', detail: 'Equilíbrio entre alcance e mobilidade.' },
  android: { title: 'ANDRÓIDE A-1', className: 'LEVE · PILOTO', detail: 'Pequeno e ágil; vence no combate próximo.' },
};

const SLOT_LABEL: Record<ArmSlot, string> = { right: 'BRAÇO DIREITO', left: 'BRAÇO ESQUERDO' };
const SLOT_SHORT: Record<ArmSlot, string> = { right: 'D', left: 'E' };
const WEAPON_HINT: Record<WeaponId, string> = {
  plasma: 'Energia · alcance médio · calor por disparo',
  rockets: 'Munição · área de impacto · recarga automática',
  blaster: 'Energia · leve · alcance curto',
  chainsaw: 'Corpo a corpo · alcance de 1,2 m',
};

/** Montagem visual do Mech; só consulta o contrato existente e nunca participa do tick de combate. */
export class HangarMenu {
  private readonly root: HTMLDivElement;
  private readonly pauseOverlay = document.getElementById('overlay');
  private draft: LoadoutSpec;
  private selectedSlot: ArmSlot = 'right';
  private message = '';
  private messageKind: 'info' | 'error' = 'info';

  constructor(
    private readonly hangar: Hangar,
    private readonly preview: HangarPreview,
    button = document.getElementById('btn-hangar'),
  ) {
    this.draft = copySpec(hangar.current);
    this.root = document.createElement('div');
    this.root.id = 'hangar-modal';
    this.root.className = 'hangar-screen hidden';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-label', 'Hangar de montagem');
    this.root.innerHTML = `
      <header class="hangar-header">
        <div class="hangar-brand"><span class="hangar-mark" aria-hidden="true">C</span><span><b>CYBERMECH</b><small>HANGAR · CENTRO DE MONTAGEM</small></span></div>
        <div class="hangar-header-state"><span class="hangar-live-dot"></span><span>SISTEMA LOCAL</span><b id="hangar-header-name"></b></div>
        <button class="hangar-close" type="button" data-action="close" aria-label="Voltar à pausa">×</button>
      </header>
      <div class="hangar-workspace">
        <aside class="hangar-rail hangar-chassis-rail">
          <div class="hangar-section-label"><span>01</span> CHASSI</div>
          <div id="hangar-chassis-list" class="hangar-chassis-list"></div>
          <div class="hangar-spec-card">
            <div class="hangar-section-label"><span>LEITURA DO CHASSI</span></div>
            <div class="hangar-spec-row"><span>ALTURA</span><b id="hangar-height"></b></div>
            <div class="hangar-spec-row"><span>VELOCIDADE</span><b id="hangar-speed"></b></div>
            <div class="hangar-spec-row"><span>BLINDAGEM · TORSO</span><b id="hangar-armor"></b></div>
            <div class="hangar-spec-row"><span>DISSIPADOR</span><b id="hangar-cooling"></b></div>
          </div>
          <p class="hangar-footnote">Os números vêm do chassi e do arsenal reais do jogo.</p>
        </aside>

        <section class="hangar-stage" aria-label="Prévia do Mech">
          <div class="hangar-stage-grid"></div>
          <div class="hangar-stage-top"><span id="hangar-preview-mode"></span><span id="hangar-preview-class"></span></div>
          <div class="hangar-orbit hangar-orbit-a"></div><div class="hangar-orbit hangar-orbit-b"></div>
          <div class="hangar-platform"><i></i><i></i><i></i></div>
          <div class="hangar-mech hologram-vector" id="hangar-mech">
            <svg viewBox="0 0 420 510" role="img" aria-label="Silhueta holográfica do robô selecionado">
              <defs>
                <linearGradient id="hangar-shell" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#d9f8ff" stop-opacity=".9"/><stop offset=".42" stop-color="#55b9d0" stop-opacity=".55"/><stop offset="1" stop-color="#163342" stop-opacity=".8"/></linearGradient>
                <linearGradient id="hangar-dark" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#25495a"/><stop offset="1" stop-color="#09131c"/></linearGradient>
              </defs>
              <g class="holo-back-lines"><path d="M210 20v455M56 110h308M74 400h272"/></g>
              <g class="holo-robot">
                <path class="holo-outline" d="M174 48 191 29h38l18 19v39l-12 18h-50l-11-18z"/>
                <path class="holo-glass" d="m184 65 10-8h31l10 9-4 14h-44z"/>
                <path class="holo-outline" d="m157 108 53-13 53 13 28 25-10 92-71 25-71-25-10-92z"/>
                <path class="holo-panel" d="m176 121 34-8 34 8 15 48-49 20-49-20z"/>
                <path class="holo-detail" d="M169 119 145 133v47l21 11m85-72 24 14v47l-21 11M190 210l20 8 20-8v32"/>
                <path class="holo-outline" d="m142 123-27 7-25 29 9 47 26 8 17-25-11-26 20-16zm136 0 27 7 25 29-9 47-26 8-17-25 11-26-20-16z"/>
                <path class="holo-outline" d="m103 198-20 26 8 76 22 21 26-12-7-67 15-24zm214 0 20 26-8 76-22 21-26-12 7-67-15-24z"/>
                <path class="holo-detail" d="m97 236 30-7m-33 42 31-8m168-34 30 7m-27 35 31 8"/>
                <path class="holo-outline" d="m160 238 50 11 50-11 22 55-20 75-52 15-52-15-20-75z"/>
                <path class="holo-dark" d="m155 270 55 9 55-9-13 37-42 11-42-11z"/>
                <path class="holo-outline" d="m165 375 42 10-7 57-17 30-48-3 2-21 20-21zm90 0-42 10 7 57 17 30 48-3-2-21-20-21z"/>
                <path class="holo-outline" d="m137 459 47 1 16 14 3 18h-79l3-20zm146 0-47 1-16 14-3 18h79l-3-20z"/>
                <path class="holo-detail" d="m158 388 36 8m-42 39 41 2m69-49-36 8m42 39-41 2"/>
                <path class="holo-cyan" d="M193 72h34m-17 0v25m-64 46h18m117 0h18M210 192v36m-79 33 21 3m137-3-21 3M177 314l33 9 33-9"/>
              </g>
            </svg>
          </div>
          <button class="hangar-hotspot hotspot-right" type="button" data-slot="right" aria-label="Selecionar braço direito"><b>01</b><span>BRAÇO D</span></button>
          <button class="hangar-hotspot hotspot-left" type="button" data-slot="left" aria-label="Selecionar braço esquerdo"><b>02</b><span>BRAÇO E</span></button>
          <div class="hangar-stage-caption"><b id="hangar-mech-title"></b><span id="hangar-mech-detail"></span></div>
        </section>

        <aside class="hangar-rail hangar-loadout-rail">
          <div class="hangar-section-label"><span>02</span> ENCAIXES</div>
          <div id="hangar-slot-list" class="hangar-slot-list"></div>
          <div class="hangar-section-label hangar-weapon-label"><span>03</span> CONFIGURAÇÃO</div>
          <div id="hangar-weapon-editor" class="hangar-weapon-editor"></div>
          <div class="hangar-module-stubs">
            <span>MÓDULOS</span><b>OMBROS <i>EM BREVE</i></b><b>TORSO <i>EM BREVE</i></b>
          </div>
        </aside>
      </div>

      <footer class="hangar-footer">
        <div class="hangar-metrics">
          <div class="hangar-metric hangar-mass"><span>CARGA DO CHASSI</span><b id="hangar-mass-value"></b><div class="hangar-meter"><i id="hangar-mass-fill"></i></div><small id="hangar-mass-caption"></small></div>
          <div class="hangar-metric"><span>SUPERAQUECIMENTO</span><b id="hangar-heat-value"></b><small>simulação padrão · correndo e disparando</small></div>
          <div class="hangar-metric"><span>TEMPO PARA DERRUBAR</span><b id="hangar-ttk-value"></b><small>alvo parado · acerto perfeito · padrão</small></div>
          <div class="hangar-metric"><span>DANO EM 20 S</span><b id="hangar-damage-value"></b><small>calor e recarga · configuração padrão</small></div>
        </div>
        <div class="hangar-actions">
          <div class="hangar-share"><input id="hangar-build-link" aria-label="Link da montagem" readonly><button type="button" data-action="copy">COPIAR LINK</button></div>
          <div class="hangar-action-buttons"><span id="hangar-message" role="status"></span><button class="hangar-back" type="button" data-action="close">VOLTAR</button><button class="hangar-apply" type="button" data-action="apply">APLICAR MONTAGEM <span>›</span></button></div>
        </div>
      </footer>`;
    document.body.append(this.root);
    button?.addEventListener('click', (event) => {
      event.stopPropagation();
      this.open();
    });
    this.root.addEventListener('click', (event) => this.onClick(event));
    // Arrastar no palco gira o Mech no pedestal (mouse e dedo).
    const stage = this.root.querySelector<HTMLElement>('.hangar-stage');
    let lastX: number | null = null;
    stage?.addEventListener('pointerdown', (e) => {
      if ((e.target as Element).closest('button')) return;
      lastX = e.clientX;
      stage.setPointerCapture(e.pointerId);
    });
    stage?.addEventListener('pointermove', (e) => {
      if (lastX === null) return;
      this.preview.rotate?.(e.clientX - lastX);
      lastX = e.clientX;
    });
    const release = () => (lastX = null);
    stage?.addEventListener('pointerup', release);
    stage?.addEventListener('pointercancel', release);
    this.root.addEventListener('change', (event) => this.onChange(event));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !this.root.classList.contains('hidden')) this.close();
    });
    this.render();
  }

  private open(): void {
    this.draft = copySpec(this.hangar.current);
    this.message = '';
    this.root.classList.remove('hidden');
    this.pauseOverlay?.classList.add('hidden');
    document.documentElement.classList.add('hangar-open');
    this.preview.open();
    this.render();
    this.root.querySelector<HTMLButtonElement>('[data-action="close"]')?.focus();
  }

  private close(): void {
    this.root.classList.add('hidden');
    this.pauseOverlay?.classList.remove('hidden');
    document.documentElement.classList.remove('hangar-open');
    this.preview.close();
  }

  private onClick(event: MouseEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    const slot = target?.closest<HTMLButtonElement>('[data-slot]')?.dataset.slot;
    if (slot === 'right' || slot === 'left') {
      this.selectedSlot = slot;
      this.message = '';
      this.render();
      return;
    }
    const chassis = target?.closest<HTMLButtonElement>('[data-chassis]')?.dataset.chassis;
    if (chassis === 'vector09' || chassis === 'android') {
      this.draft = factorySpec(chassis);
      this.selectedSlot = 'right';
      this.message = 'Montagem de fábrica carregada. Aplique para confirmar.';
      this.messageKind = 'info';
      this.render();
      return;
    }
    const tier = target?.closest<HTMLButtonElement>('[data-tier]')?.dataset.tier;
    if (tier === '0' || tier === '1' || tier === '2') {
      const selected = Number(tier) as Tier;
      this.draft = withArm(this.draft, this.selectedSlot, (arm) => arm ? { ...arm, tier: selected } : null);
      this.message = '';
      this.render();
      return;
    }
    const action = target?.closest<HTMLButtonElement>('[data-action]')?.dataset.action;
    if (action === 'close') {
      event.stopPropagation();
      this.close();
    } else if (action === 'apply') {
      event.stopPropagation();
      this.apply();
    } else if (action === 'copy') {
      event.stopPropagation();
      void this.copyLink();
    }
  }

  private onChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    if (target.id === 'hangar-weapon-select') {
      const selected = target.value as WeaponId | '';
      this.draft = withArm(this.draft, this.selectedSlot, () => selected ? { id: selected, tier: this.draft[this.selectedSlot]?.tier ?? 0 } : null);
      this.message = '';
      this.render();
    }
  }

  private apply(): void {
    const previousChassis = this.hangar.current.chassis;
    const result = this.hangar.apply(this.draft);
    if (!result.ok) {
      this.message = result.detail;
      this.messageKind = 'error';
      this.render();
      return;
    }
    if (previousChassis !== this.draft.chassis) {
      this.message = 'Trocando piloto…';
      this.messageKind = 'info';
      reloadWithout('build');
      return;
    }
    this.message = this.preview.applied?.() ?? 'Montagem salva · entra no próximo renascimento.';
    this.messageKind = 'info';
    this.render();
  }

  private async copyLink(): Promise<void> {
    const url = new URL(location.href);
    url.searchParams.set('build', loadoutKey(this.draft));
    const input = this.root.querySelector<HTMLInputElement>('#hangar-build-link')!;
    input.value = url.toString();
    try {
      await navigator.clipboard.writeText(input.value);
      this.message = 'Link copiado.';
    } catch {
      input.focus();
      input.select();
      this.message = 'Link selecionado · copie com Ctrl+C.';
    }
    this.messageKind = 'info';
    this.renderMessage();
  }

  private render(): void {
    const chassis = CHASSIS[this.draft.chassis];
    const label = CHASSIS_LABEL[this.draft.chassis];
    const spec = this.draft;
    const report = this.hangar.report(spec);
    const selectedArm = spec[this.selectedSlot];
    const available = armOptions(this.selectedSlot, spec.chassis);
    const selectedWeapon = selectedArm ? weapon(selectedArm.id, selectedArm.tier) : null;
    const capPct = Math.min(100, (report.mass / report.capacity) * 100);
    const name = label.title;
    // O galpão 3D mostra a montagem do rascunho (a válida; fora da carga, as armas de fábrica do chassi).
    this.root.classList.add('scene-3d');
    this.preview.show?.(spec.chassis, report.check.ok ? report.check.loadout : chassis.loadout);

    this.setText('#hangar-header-name', name);
    this.setText('#hangar-preview-mode', 'GALPÃO 3D · ARRASTE PARA GIRAR');
    this.setText('#hangar-preview-class', label.className);
    this.setText('#hangar-mech-title', name);
    this.setText('#hangar-mech-detail', label.detail);
    this.root.querySelector('#hangar-mech')?.classList.toggle('is-android', spec.chassis === 'android');
    this.setText('#hangar-height', `${chassis.height.toFixed(1).replace('.', ',')} m`);
    this.setText('#hangar-speed', `${chassis.moveSpeed.toFixed(1).replace('.', ',')} m/s`);
    this.setText('#hangar-armor', `${chassis.maxModuleHealth.torso} HP`);
    this.setText('#hangar-cooling', `${(chassis.heatCooling * 100).toFixed(0)}% / s`);

    const chassisList = this.root.querySelector<HTMLElement>('#hangar-chassis-list')!;
    chassisList.innerHTML = (Object.keys(CHASSIS) as ChassisId[]).map((id) => {
      const item = CHASSIS_LABEL[id];
      const selected = id === spec.chassis;
      return `<button class="hangar-chassis-card${selected ? ' selected' : ''}" type="button" data-chassis="${id}" aria-pressed="${selected}"><span>${item.className}</span><b>${item.title}</b><small>${CHASSIS[id].weaponCapacity} t · ${CHASSIS[id].height.toFixed(1).replace('.', ',')} m</small></button>`;
    }).join('');

    const slotList = this.root.querySelector<HTMLElement>('#hangar-slot-list')!;
    slotList.innerHTML = (['right', 'left'] as const).map((slot) => {
      const arm = spec[slot];
      const item = arm ? weapon(arm.id, arm.tier) : null;
      const selected = slot === this.selectedSlot;
      return `<button class="hangar-slot-card${selected ? ' selected' : ''}${!item ? ' empty' : ''}" type="button" data-slot="${slot}" aria-pressed="${selected}"><span class="slot-glyph">${SLOT_SHORT[slot]}</span><span class="slot-copy"><small>${SLOT_LABEL[slot]}</small><b>${item?.name ?? 'SEM ARMA'}</b></span><span class="slot-tier">${item ? `MK ${['I', 'II', 'III'][item.tier]}` : '—'}</span></button>`;
    }).join('');
    this.root.querySelector<HTMLButtonElement>('.hotspot-right')?.classList.toggle('active', this.selectedSlot === 'right');
    this.root.querySelector<HTMLButtonElement>('.hotspot-left')?.classList.toggle('active', this.selectedSlot === 'left');

    const editor = this.root.querySelector<HTMLElement>('#hangar-weapon-editor')!;
    const weaponOptions = available.map((id) => `<option value="${id}"${selectedArm?.id === id ? ' selected' : ''}>${weapon(id).name}</option>`).join('');
    editor.innerHTML = `<label class="hangar-field-label" for="hangar-weapon-select">ARMAMENTO</label><select id="hangar-weapon-select"${this.selectedSlot === 'left' ? '' : ' disabled'}>${this.selectedSlot === 'left' ? '<option value="">SEM ARMA</option>' : ''}${weaponOptions}</select><span class="hangar-weapon-hint">${selectedWeapon ? WEAPON_HINT[selectedWeapon.id] : 'Encaixe vazio · reduz o peso total.'}</span><div class="hangar-field-label tier-label">NÍVEL DE POTÊNCIA</div><div class="hangar-tier-list">${TIERS.map((tier, index) => `<button class="hangar-tier${selectedArm?.tier === index ? ' selected' : ''}" type="button" data-tier="${index}" aria-pressed="${selectedArm?.tier === index}"${selectedArm ? '' : ' disabled'}><b>${tier.label}</b><small>${index === 0 ? 'PADRÃO' : `+${Math.round((tier.damage - 1) * 100)}% DANO`}</small></button>`).join('')}</div>${selectedWeapon ? `<div class="hangar-weapon-stats"><span>DANO <b>${selectedWeapon.damage}</b></span><span>CADÊNCIA <b>${(1 / selectedWeapon.fireInterval).toFixed(1).replace('.', ',')}/s</b></span><span>CARGA <b>${selectedWeapon.mass.toFixed(1).replace('.', ',')} t</b></span></div>` : ''}`;

    this.setText('#hangar-mass-value', `${report.mass.toFixed(1).replace('.', ',')} / ${report.capacity} t`);
    this.setText('#hangar-mass-caption', `${Math.max(0, report.capacity - report.mass).toFixed(1).replace('.', ',')} t livres`);
    const fill = this.root.querySelector<HTMLElement>('#hangar-mass-fill')!;
    fill.style.width = `${capPct}%`;
    fill.classList.toggle('over', !report.check.ok && report.check.error === 'carga');
    this.setText('#hangar-heat-value', report.overheatAt === null ? 'ESTÁVEL' : `${report.overheatAt.toFixed(1).replace('.', ',')} s`);
    this.setText('#hangar-ttk-value', Number.isFinite(report.ttkTorso) ? `${report.ttkTorso.toFixed(1).replace('.', ',')} s` : '—');
    this.setText('#hangar-damage-value', `${Math.round(report.damage20)} HP`);
    const buildLink = this.root.querySelector<HTMLInputElement>('#hangar-build-link')!;
    const shareUrl = new URL(location.href);
    shareUrl.searchParams.set('build', loadoutKey(spec));
    buildLink.value = shareUrl.toString();
    const apply = this.root.querySelector<HTMLButtonElement>('[data-action="apply"]')!;
    apply.disabled = !report.check.ok;
    apply.title = report.check.ok ? 'Salvar a montagem' : report.check.detail;
    this.renderMessage();
  }

  private renderMessage(): void {
    const node = this.root.querySelector<HTMLElement>('#hangar-message');
    if (!node) return;
    node.textContent = this.message;
    node.dataset.kind = this.messageKind;
  }

  private setText(selector: string, text: string): void {
    const node = this.root.querySelector<HTMLElement>(selector);
    if (node) node.textContent = text;
  }
}

function copySpec(spec: LoadoutSpec): LoadoutSpec {
  return { v: spec.v, chassis: spec.chassis, right: { ...spec.right }, left: spec.left ? { ...spec.left } : null };
}

function withArm(spec: LoadoutSpec, slot: ArmSlot, update: (arm: LoadoutSpec[ArmSlot]) => LoadoutSpec[ArmSlot]): LoadoutSpec {
  return { ...spec, [slot]: update(spec[slot]) };
}
