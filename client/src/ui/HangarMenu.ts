import { TIERS, weapon, WEAPON_IDS, type Loadout, type Tier, type WeaponId, type WeaponStats } from '../combat/weapons';
import { reloadWithout } from '../core/url';
import { CHASSIS, type ChassisId } from '../entities/chassis';
import type { Hangar } from '../hangar/Hangar';
import { armOptions, factorySpec, loadoutKey, type ArmSlot, type LoadoutSpec } from '../hangar/loadout';
import { PRESET_COUNT } from '../hangar/Hangar';
import { testAt, testFire, type TestFire } from '../hangar/testFire';

/** O que a tela pede ao jogo: abrir e fechar o galpão 3D, mostrar a montagem, girar e aplicar na hora. */
export interface HangarPreview {
  open(): void;
  close(): void;
  show?(chassis: ChassisId, loadout: Loadout): void;
  rotate?(dx: number): void;
  /** Montagem do mesmo chassi aplicada: o jogo troca as armas (ou explica por que não) e devolve o aviso. */
  applied?(): string;
  /** Linha de estado do topo: "OFFLINE" ou a sala online. */
  status?(): string;
  /** Teste de disparo: o galpão mostra o Mech atirando no alvo, no ritmo do teste. */
  test?(data: TestFire, arm: ArmSlot): void;
  stopTest?(): void;
  /** Treino manual no galpão: recebe a arma selecionada, sem simular dano no jogo. */
  aimPractice?(weapon: WeaponStats): void;
  stopAimPractice?(): void;
  canAimPractice?(): boolean;
}

/** Os tiros do teste começam depois que o Mech vira para o alvo (s). */
const TEST_TURN_S = 0.5;

const CHASSIS_LABEL: Record<ChassisId, { title: string; className: string; detail: string }> = {
  vector09: { title: 'VECTOR-09', className: 'MÉDIO · ASSALTO', detail: 'Equilíbrio entre alcance e mobilidade.' },
  android: { title: 'ANDRÓIDE A-1', className: 'LEVE · PILOTO', detail: 'Pequeno e ágil; vence no combate próximo.' },
};
const SLOT_LABEL: Record<ArmSlot, string> = { right: 'BRAÇO DIREITO', left: 'BRAÇO ESQUERDO' };
const SLOT_NUM: Record<ArmSlot, string> = { right: '01', left: '02' };
const WEAPON_HINT: Record<WeaponId, string> = {
  plasma: 'Energia · dano cheio até 60 m · calor por disparo',
  rockets: 'Munição · explosão em área · recarga automática',
  blaster: 'Energia · leve · alcance curto',
  chainsaw: 'Corpo a corpo · só corta encostado',
};

/** Ícones de traço (24×24) de cada arma. */
const WEAPON_ICON: Record<WeaponId, string> = {
  plasma: '<path d="M3 13h11l2-3h5v6h-5l-2-3" /><circle cx="7" cy="13" r="2.5" /><path d="M16 10v6" />',
  rockets: '<rect x="4" y="6" width="14" height="12" rx="1" /><circle cx="8" cy="10" r="1.6" /><circle cx="14" cy="10" r="1.6" /><circle cx="8" cy="14" r="1.6" /><circle cx="14" cy="14" r="1.6" /><path d="M18 9h3v6h-3" />',
  blaster: '<path d="M4 9h13l2 2v2H9l-1 5H5l1-5H4z" /><path d="M17 11h4" />',
  chainsaw: '<rect x="3" y="9" width="7" height="7" rx="1" /><path d="M10 10h9a2.5 2.5 0 0 1 0 5h-9" /><path d="M12 10l1-2M15 10l1-2M18 10l1-2M12 15l1 2M15 15l1 2M18 15l1 2" />',
};

/** Planta em traço de cada chassi (60×84), no cartão do painel da esquerda. */
const CHASSIS_ICON: Record<ChassisId, string> = {
  vector09:
    '<rect x="24" y="4" width="12" height="10" /><rect x="16" y="16" width="28" height="24" /><rect x="6" y="18" width="9" height="22" /><rect x="45" y="18" width="9" height="22" /><rect x="18" y="42" width="10" height="26" /><rect x="32" y="42" width="10" height="26" /><path d="M14 72h16M30 72h16" /><path d="M2 44h4M54 44h4" />',
  android:
    '<rect x="26" y="4" width="8" height="9" /><rect x="22" y="15" width="16" height="22" /><rect x="15" y="17" width="5" height="20" /><rect x="40" y="17" width="5" height="20" /><rect x="23" y="39" width="6" height="30" /><rect x="31" y="39" width="6" height="30" /><path d="M20 72h10M30 72h10M45 30h10" />',
};

/** Leituras de cada arma, como barras: o máximo é o maior valor do arsenal no MK III. */
interface StatRow {
  key: string;
  label: string;
  unit: string;
  get(w: WeaponStats): number;
  digits: number;
  /** Maior é pior (calor, carga): a seta de melhora inverte. */
  lowerIsBetter?: boolean;
}
const STATS: StatRow[] = [
  { key: 'dmg', label: 'DANO', unit: '', get: (w) => w.damage, digits: 0 },
  { key: 'rate', label: 'CADÊNCIA', unit: '/s', get: (w) => 1 / w.fireInterval, digits: 1 },
  { key: 'heat', label: 'CALOR', unit: '%/s', get: (w) => (w.heatPerShot / w.fireInterval) * 100, digits: 0, lowerIsBetter: true },
  { key: 'range', label: 'ALCANCE', unit: ' m', get: (w) => w.maxRange, digits: 0 },
  { key: 'mass', label: 'CARGA', unit: ' t', get: (w) => w.mass, digits: 1, lowerIsBetter: true },
];
const STAT_MAX: Record<string, number> = Object.fromEntries(STATS.map((s) => [s.key, Math.max(...WEAPON_IDS.map((id) => s.get(weapon(id, 2))))]));

const num = (x: number, digits: number) => x.toFixed(digits).replace('.', ',');

type Tab = 'chassi' | 'armas' | 'numeros';

/**
 * Hangar 2.0, camada 2 (Claude, 26/09; a primeira versão foi do Codex): a interface holográfica sobre o galpão 3D,
 * no desenho da imagem de referência do dono (\`.tmp/arte/hangar-referencia.png\`).
 * - Topo: marca, carga, piloto e o modo (offline ou a sala online).
 * - Esquerda: o chassi, com a planta de cada robô em traço, e as leituras dele.
 * - Direita: o console "caminhos de montagem" (armas; blindagem e módulos em breve), os dois braços, o nível de
 *   potência e as barras de cada arma, a nova contra a atual.
 * - Embaixo: as leituras da simulação (carga, calor, tempo para derrubar, dano) e o link da montagem.
 * - No Mech: marcadores dos braços presos a eles, que acompanham o giro do pedestal.
 * - No celular: o galpão ocupa a tela e os painéis viram abas embaixo.
 * Só consulta o contrato (\`Hangar\`) e nunca participa do tick de combate.
 */
export class HangarMenu {
  private readonly root: HTMLDivElement;
  private readonly pauseOverlay = document.getElementById('overlay');
  private draft: LoadoutSpec;
  private selectedSlot: ArmSlot = 'right';
  private tab: Tab = 'armas';
  private message = '';
  private messageKind: 'info' | 'error' = 'info';
  private readonly hotRight: HTMLElement;
  private readonly hotLeft: HTMLElement;
  /** Teste de disparo em andamento (os números da tela saem dele). */
  private testing: TestFire | null = null;
  private aimTraining = false;

  get isAimTraining(): boolean {
    return this.aimTraining;
  }

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
      <div class="hg-stage" aria-hidden="true">
        <button class="hg-hotspot" id="hg-hot-right" type="button" data-slot="right" tabindex="-1"><i></i><span><b>01</b> BRAÇO D</span></button>
        <button class="hg-hotspot" id="hg-hot-left" type="button" data-slot="left" tabindex="-1"><i></i><span><b>02</b> BRAÇO E</span></button>
        <div class="hg-caption"><b id="hangar-mech-title"></b><span id="hangar-mech-detail"></span><small>ARRASTE PARA GIRAR</small></div>
        <div class="hg-presets" id="hg-presets" aria-label="Montagens salvas nos atalhos 1 a 4"></div>
      </div>
      <div class="hg-aim-reticle" aria-hidden="true"><i></i></div>
      <div class="hg-test" id="hg-test" hidden>
        <div class="hg-test-head"><em id="hg-test-title">TESTE DE DISPARO</em><b id="hg-test-weapon"></b></div>
        <div class="hg-test-grid">
          <div><span>TEMPO</span><b id="hg-test-time"></b></div>
          <div><span id="hg-test-shots-label">TIROS</span><b id="hg-test-shots"></b></div>
          <div><span id="hg-test-dmg-label">DANO</span><b id="hg-test-dmg"></b></div>
        </div>
        <div class="hg-test-heat"><span id="hg-test-heat-label">CALOR</span><div class="hg-meter"><i id="hg-test-heatbar"></i></div><b id="hg-test-state"></b></div>
        <p id="hg-practice-help" hidden>MOVA A MIRA E SEGURE O BOTÃO ESQUERDO · ESC PARA SAIR</p>
        <button class="hg-btn" type="button" data-action="stop-test" id="hg-test-stop">PARAR</button>
      </div>
      <header class="hg-top">
        <div class="hg-brand"><svg class="hg-emblem" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2 29 9v14l-13 7L3 23V9z" /><path d="M16 8 23 12v8l-7 4-7-4v-8z" /></svg><span><b>CYBERMECH</b><small>HANGAR · CENTRO DE MONTAGEM</small></span></div>
        <div class="hg-chips">
          <span class="hg-chip"><i>CARGA</i><b id="hg-top-load"></b></span>
          <span class="hg-chip"><i>PILOTO</i><b id="hg-top-pilot"></b></span>
          <span class="hg-chip hg-mode"><em></em><b id="hg-top-mode"></b></span>
        </div>
        <button class="hg-close" type="button" data-action="close" aria-label="Voltar à pausa">×</button>
      </header>
      <aside class="hg-panel hg-chassis" data-tab="chassi">
        <div class="hg-head"><span>01</span> CHASSI <em>HGR-01</em></div>
        <div id="hangar-chassis-list" class="hg-chassis-list"></div>
        <dl class="hg-specs">
          <div><dt>ALTURA</dt><dd id="hangar-height"></dd></div>
          <div><dt>VELOCIDADE</dt><dd id="hangar-speed"></dd></div>
          <div><dt>BLINDAGEM · TORSO</dt><dd id="hangar-armor"></dd></div>
          <div><dt>DISSIPADOR</dt><dd id="hangar-cooling"></dd></div>
        </dl>
        <p class="hg-note">Números lidos do chassi e do arsenal do jogo.</p>
      </aside>
      <section class="hg-panel hg-console" data-tab="armas">
        <div class="hg-head"><span>02</span> CAMINHOS DE MONTAGEM <em>CFG-02</em></div>
        <div class="hg-paths" aria-label="Caminhos de montagem">
          <button type="button" class="hg-path selected"><svg viewBox="0 0 24 24" aria-hidden="true">${WEAPON_ICON.plasma}</svg><b>ARMAS</b><small>braços D e E</small></button>
          <button type="button" class="hg-path soon" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 6v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /></svg><b>BLINDAGEM</b><small>em breve</small></button>
          <button type="button" class="hg-path soon" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" /><path d="M9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4" /></svg><b>MÓDULOS</b><small>em breve</small></button>
        </div>
        <div id="hangar-slot-list" class="hg-slots"></div>
        <div id="hangar-weapon-editor" class="hg-editor"></div>
        <div class="hg-actions">
          <span id="hangar-message" role="status"></span>
          <button class="hg-btn hg-ghost" type="button" data-action="close">VOLTAR</button>
          <button class="hg-btn hangar-apply" type="button" data-action="apply">APLICAR MONTAGEM ›</button>
        </div>
      </section>
      <footer class="hg-panel hg-readout" data-tab="numeros">
        <div class="hg-metric hg-load"><span>CARGA DO CHASSI</span><b id="hangar-mass-value"></b><div class="hg-meter"><i id="hangar-mass-fill"></i></div><small id="hangar-mass-caption"></small></div>
        <div class="hg-metric"><span>FERVE EM</span><b id="hangar-heat-value"></b><small>correndo e disparando tudo</small></div>
        <div class="hg-metric"><span>DERRUBA UM MECH EM</span><b id="hangar-ttk-value"></b><small>torso, acerto perfeito</small></div>
        <div class="hg-metric"><span>DANO EM 20 S</span><b id="hangar-damage-value"></b><small>com calor e recarga</small></div>
        <div class="hg-share"><input id="hangar-build-link" aria-label="Link da montagem" readonly><button type="button" data-action="copy">COPIAR LINK</button></div>
      </footer>
      <nav class="hg-tabs" aria-label="Painéis do Hangar">
        <button type="button" data-tab-btn="chassi">CHASSI</button>
        <button type="button" data-tab-btn="armas">ARMAS</button>
        <button type="button" data-tab-btn="numeros">NÚMEROS</button>
        <button class="hg-tab-apply" type="button" data-action="apply">APLICAR ›</button>
      </nav>`;
    document.body.append(this.root);
    this.hotRight = this.root.querySelector<HTMLElement>('#hg-hot-right')!;
    this.hotLeft = this.root.querySelector<HTMLElement>('#hg-hot-left')!;
    button?.addEventListener('click', (event) => {
      event.stopPropagation();
      this.open();
    });
    this.root.addEventListener('click', (event) => this.onClick(event));
    this.root.addEventListener('change', (event) => this.onChange(event));
    document.addEventListener('keydown', (event) => {
      if (!this.isOpen) return;
      if (event.key === 'Escape') {
        if (this.aimTraining) this.endAimPractice(true);
        else if (this.testing) this.endTest(true);
        else this.close();
        return;
      }
      if (this.aimTraining || this.testing) return;
      // 1 a 4 carregam a montagem do atalho (fora de campo de texto).
      const n = Number(event.key);
      if (n >= 1 && n <= PRESET_COUNT && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLSelectElement)) this.loadPreset(n - 1);
    });
    // Arrastar no galpão (fora dos painéis) gira o Mech no pedestal, com mouse ou dedo.
    const stage = this.root.querySelector<HTMLElement>('.hg-stage')!;
    let lastX: number | null = null;
    stage.addEventListener('pointerdown', (e) => {
      if ((e.target as Element).closest('button')) return;
      lastX = e.clientX;
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener('pointermove', (e) => {
      if (lastX === null) return;
      this.preview.rotate?.(e.clientX - lastX);
      lastX = e.clientX;
    });
    const release = () => (lastX = null);
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);
    this.render();
  }

  get isOpen(): boolean {
    return !this.root.classList.contains('hidden');
  }

  /**
   * Por quadro, com o Hangar aberto: os marcadores dos braços na posição da tela onde cada braço está (null = fora).
   * Nada alocado além do texto do estilo.
   */
  placeHotspots(right: { x: number; y: number } | null, left: { x: number; y: number } | null): void {
    const w = window.innerWidth;
    const place = (el: HTMLElement, p: { x: number; y: number } | null) => {
      el.hidden = p === null;
      if (!p) return;
      el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
      // O rótulo aponta para fora do Mech, mas nunca sai da tela.
      // No computador, os painéis cobrem as laterais: o rótulo fica no vão entre eles.
      const minX = w > 900 ? 330 : 170;
      const maxX = w > 900 ? w - 470 : w - 170;
      let toLeft = p.x < w * 0.45;
      if (toLeft && p.x < minX) toLeft = false;
      else if (!toLeft && p.x > maxX) toLeft = true;
      el.classList.toggle('to-left', toLeft);
    };
    place(this.hotRight, right);
    place(this.hotLeft, left);
  }

  /**
   * Por quadro, com o Hangar aberto: o andamento do teste de disparo na cena (null = acabou ou não há teste). A tela
   * mostra tempo, tiros, dano e calor do próprio teste, no mesmo segundo do desenho.
   */
  testFrame(progress: { t: number; seconds: number } | null): void {
    const data = this.testing;
    if (!data) return;
    if (!progress) {
      this.endTest(false);
      return;
    }
    const t = Math.max(0, progress.t - TEST_TURN_S);
    const at = testAt(data, t);
    this.setText('hg-test-time', `${num(Math.min(t, data.seconds), 1)} / ${num(data.seconds, 0)} s`);
    this.setText('hg-test-shots', String(at.shots));
    this.setText('hg-test-dmg', String(at.damage));
    const bar = this.root.querySelector<HTMLElement>('#hg-test-heatbar')!;
    bar.style.width = `${Math.round(at.heat * 100)}%`;
    bar.classList.toggle('over', at.locked);
    this.setText('hg-test-state', at.locked ? 'SUPERAQUECEU: ARMAS TRAVADAS' : `${Math.round(at.heat * 100)}%`);
  }

  /** Atualiza a leitura do treino manual sem re-renderizar a tela a cada quadro. */
  aimPracticeFrame(seconds: number, shots: number, hits: number, accuracy: number): void {
    if (!this.aimTraining) return;
    this.setText('hg-test-time', `${num(seconds, 1)} s`);
    this.setText('hg-test-shots', String(shots));
    this.setText('hg-test-dmg', String(hits));
    this.root.querySelector<HTMLElement>('#hg-test-heatbar')!.style.width = `${accuracy}%`;
    this.setText('hg-test-state', `${accuracy}%`);
  }

  private startTest(): void {
    const arm = this.draft[this.selectedSlot];
    if (!arm) return;
    const w = weapon(arm.id, arm.tier);
    const data = testFire(CHASSIS[this.draft.chassis], w);
    this.testing = data;
    // Sem a animação de entrada: ela seguraria os painéis visíveis (o fim da animação vale mais que o estilo).
    this.root.classList.remove('hg-enter');
    this.root.classList.add('hg-testing');
    this.root.querySelector<HTMLElement>('#hg-test')!.hidden = false;
    this.setText('hg-test-weapon', `${w.name.toUpperCase()} ${TIERS[w.tier]!.label}`);
    this.testFrame({ t: 0, seconds: data.seconds });
    this.preview.test?.(data, this.selectedSlot);
  }

  private startAimPractice(): void {
    const arm = this.draft[this.selectedSlot];
    if (!arm || !this.preview.aimPractice) return;
    const selectedWeapon = weapon(arm.id, arm.tier);
    if (selectedWeapon.kind === 'melee') {
      this.message = 'O alvo móvel treina armas de tiro. Use TESTAR DISPARO para conferir a motosserra.';
      this.messageKind = 'info';
      this.renderMessage();
      return;
    }
    if (this.preview.canAimPractice && !this.preview.canAimPractice()) {
      this.message = 'O treino manual usa mouse e teclado. No toque, use TESTAR DISPARO.';
      this.messageKind = 'info';
      this.renderMessage();
      return;
    }
    this.aimTraining = true;
    this.root.classList.remove('hg-enter');
    this.root.classList.add('hg-testing', 'hg-aim-training');
    this.root.querySelector<HTMLElement>('#hg-test')!.hidden = false;
    this.setText('hg-test-title', 'TREINO DE MIRA');
    this.setText('hg-test-weapon', `ALVO MÓVEL · ${this.selectedSlot === 'right' ? 'BRAÇO D' : 'BRAÇO E'}`);
    this.setText('hg-test-shots-label', 'DISPAROS');
    this.setText('hg-test-dmg-label', 'ACERTOS');
    this.setText('hg-test-heat-label', 'PRECISÃO');
    this.setText('hg-test-state', '0%');
    this.root.querySelector<HTMLElement>('#hg-practice-help')!.hidden = false;
    this.setText('hg-test-stop', 'ESC PARA SAIR');
    this.preview.aimPractice(selectedWeapon);
  }

  /** Chamado ao soltar Esc ou quando o navegador encerra o Pointer Lock. */
  endAimPractice(stopped: boolean): void {
    if (!this.aimTraining) return;
    this.aimTraining = false;
    this.preview.stopAimPractice?.();
    this.root.classList.remove('hg-testing', 'hg-aim-training');
    this.root.querySelector<HTMLElement>('#hg-test')!.hidden = true;
    this.root.querySelector<HTMLElement>('#hg-practice-help')!.hidden = true;
    this.setText('hg-test-title', 'TESTE DE DISPARO');
    this.setText('hg-test-shots-label', 'TIROS');
    this.setText('hg-test-dmg-label', 'DANO');
    this.setText('hg-test-heat-label', 'CALOR');
    this.setText('hg-test-stop', 'PARAR');
    this.message = stopped ? 'Treino de mira encerrado.' : 'Treino encerrado: mouse liberado.';
    this.messageKind = 'info';
    this.renderMessage();
  }

  /** Fim do teste (acabou ou parou): os painéis voltam e o resumo fica na mensagem. */
  private endTest(stopped: boolean): void {
    const data = this.testing;
    if (!data) return;
    this.testing = null;
    if (stopped) this.preview.stopTest?.();
    this.root.classList.remove('hg-testing');
    this.root.querySelector<HTMLElement>('#hg-test')!.hidden = true;
    const heat = data.overheatAt === null ? 'sem ferver' : `ferveu em ${num(data.overheatAt, 1)} s`;
    this.message = stopped ? 'Teste interrompido.' : `Teste: ${data.shots.length} disparos e ${data.damage} de dano em ${num(data.seconds, 0)} s, ${heat}.`;
    this.messageKind = 'info';
    this.renderMessage();
  }

  /** Atalho cheio: carrega a montagem no rascunho (aplicar continua sendo do botão). */
  private loadPreset(index: number): void {
    const p = this.hangar.presets()[index];
    if (!p) return;
    this.draft = copySpec(p);
    this.selectedSlot = 'right';
    this.message = `Atalho ${index + 1} carregado: aplique para usar.`;
    this.messageKind = 'info';
    this.render();
  }

  private savePreset(index: number): void {
    const check = this.hangar.savePreset(index, this.draft);
    this.message = check.ok ? `Montagem salva no atalho ${index + 1}.` : check.detail;
    this.messageKind = check.ok ? 'info' : 'error';
    this.render();
  }

  private open(): void {
    this.draft = copySpec(this.hangar.current);
    this.message = '';
    this.root.classList.remove('hidden', 'hg-enter');
    void this.root.offsetWidth; // reinicia a animação de entrada
    this.root.classList.add('hg-enter');
    this.pauseOverlay?.classList.add('hidden');
    document.documentElement.classList.add('hangar-open');
    this.preview.open();
    this.render();
    this.root.querySelector<HTMLButtonElement>('.hangar-apply')?.focus();
  }

  private close(): void {
    this.endAimPractice(true);
    this.endTest(true);
    this.root.classList.add('hidden');
    this.pauseOverlay?.classList.remove('hidden');
    document.documentElement.classList.remove('hangar-open');
    this.preview.close();
  }

  private onClick(event: MouseEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    const tab = target?.closest<HTMLButtonElement>('[data-tab-btn]')?.dataset.tabBtn;
    if (tab === 'chassi' || tab === 'armas' || tab === 'numeros') {
      this.tab = tab;
      this.render();
      return;
    }
    const slot = target?.closest<HTMLButtonElement>('[data-slot]')?.dataset.slot;
    if (slot === 'right' || slot === 'left') {
      this.selectedSlot = slot;
      this.tab = 'armas';
      this.message = '';
      this.render();
      return;
    }
    const chassis = target?.closest<HTMLButtonElement>('[data-chassis]')?.dataset.chassis;
    if (chassis === 'vector09' || chassis === 'android') {
      if (chassis !== this.draft.chassis) {
        this.draft = chassis === this.hangar.current.chassis ? copySpec(this.hangar.current) : factorySpec(chassis);
        this.selectedSlot = 'right';
        this.message = chassis === this.hangar.current.chassis ? '' : 'Piloto novo: aplique para trocar (a partida recomeça).';
        this.messageKind = 'info';
      }
      this.render();
      return;
    }
    const tier = target?.closest<HTMLButtonElement>('[data-tier]')?.dataset.tier;
    if (tier === '0' || tier === '1' || tier === '2') {
      const selected = Number(tier) as Tier;
      this.draft = withArm(this.draft, this.selectedSlot, (arm) => (arm ? { ...arm, tier: selected } : null));
      this.message = '';
      this.render();
      return;
    }
    const load = target?.closest<HTMLButtonElement>('[data-preset-load]')?.dataset.presetLoad;
    if (load !== undefined) {
      const i = Number(load);
      if (this.hangar.presets()[i]) this.loadPreset(i);
      else this.savePreset(i);
      return;
    }
    const save = target?.closest<HTMLButtonElement>('[data-preset-save]')?.dataset.presetSave;
    if (save !== undefined) {
      this.savePreset(Number(save));
      return;
    }
    const action = target?.closest<HTMLButtonElement>('[data-action]')?.dataset.action;
    if (action === 'test') {
      event.stopPropagation();
      this.startTest();
      return;
    }
    if (action === 'aim-practice') {
      event.stopPropagation();
      this.startAimPractice();
      return;
    }
    if (action === 'stop-test') {
      event.stopPropagation();
      if (this.aimTraining) this.endAimPractice(true);
      else this.endTest(true);
      return;
    }
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
    if (!(target instanceof HTMLSelectElement) || target.id !== 'hangar-weapon-select') return;
    const selected = target.value as WeaponId | '';
    this.draft = withArm(this.draft, this.selectedSlot, () => (selected ? { id: selected, tier: this.draft[this.selectedSlot]?.tier ?? 0 } : null));
    this.message = '';
    this.render();
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
      this.renderMessage();
      reloadWithout('build');
      return;
    }
    this.message = this.preview.applied?.() ?? 'Montagem salva.';
    this.messageKind = 'info';
    this.render();
  }

  private async copyLink(): Promise<void> {
    const input = this.root.querySelector<HTMLInputElement>('#hangar-build-link')!;
    try {
      await navigator.clipboard.writeText(input.value);
      this.message = 'Link copiado: quem abrir entra com esta montagem.';
    } catch {
      input.focus();
      input.select();
      this.message = 'Link selecionado · copie com Ctrl+C.';
    }
    this.messageKind = 'info';
    this.renderMessage();
  }

  private render(): void {
    const spec = this.draft;
    const chassis = CHASSIS[spec.chassis];
    const label = CHASSIS_LABEL[spec.chassis];
    const report = this.hangar.report(spec);
    const current = this.hangar.current;
    this.root.dataset.tab = this.tab;
    for (const b of this.root.querySelectorAll<HTMLButtonElement>('[data-tab-btn]')) b.classList.toggle('selected', b.dataset.tabBtn === this.tab);

    // O galpão 3D mostra a montagem do rascunho (a válida; fora da carga, as armas de fábrica do chassi).
    this.preview.show?.(spec.chassis, report.check.ok ? report.check.loadout : chassis.loadout);

    this.setText('hg-top-load', `${num(report.mass, 1)} / ${num(report.capacity, 0)} t`);
    this.setText('hg-top-pilot', label.title);
    this.setText('hg-top-mode', this.preview.status?.() ?? 'OFFLINE');
    this.setText('hangar-mech-title', label.title);
    this.setText('hangar-mech-detail', `${label.className} · ${label.detail}`);
    this.setText('hangar-height', `${num(chassis.height, 1)} m`);
    this.setText('hangar-speed', `${num(chassis.moveSpeed, 1)} m/s`);
    this.setText('hangar-armor', `${chassis.maxModuleHealth.torso} HP`);
    this.setText('hangar-cooling', `${Math.round(chassis.heatCooling * 100)}% / s`);

    const chassisList = this.root.querySelector<HTMLElement>('#hangar-chassis-list')!;
    chassisList.innerHTML = (Object.keys(CHASSIS) as ChassisId[])
      .map((id) => {
        const c = CHASSIS[id];
        const l = CHASSIS_LABEL[id];
        const selected = id === spec.chassis;
        const inUse = id === current.chassis;
        return `<button class="hg-chassis-card${selected ? ' selected' : ''}" type="button" data-chassis="${id}" aria-pressed="${selected}"><svg viewBox="0 0 60 84" aria-hidden="true">${CHASSIS_ICON[id]}</svg><span><small>${l.className}</small><b>${l.title}</b><em>${num(c.weaponCapacity, 0)} t de carga · ${num(c.height, 1)} m${inUse ? ' · EM USO' : ''}</em></span></button>`;
      })
      .join('');

    const slotList = this.root.querySelector<HTMLElement>('#hangar-slot-list')!;
    slotList.innerHTML = (['right', 'left'] as const)
      .map((slot) => {
        const arm = spec[slot];
        const w = arm ? weapon(arm.id, arm.tier) : null;
        const selected = slot === this.selectedSlot;
        return `<button class="hg-slot${selected ? ' selected' : ''}${w ? '' : ' empty'}" type="button" data-slot="${slot}" aria-pressed="${selected}"><b class="hg-slot-num">${SLOT_NUM[slot]}</b><svg viewBox="0 0 24 24" aria-hidden="true">${w ? WEAPON_ICON[w.id] : '<path d="M6 12h12" />'}</svg><span><small>${SLOT_LABEL[slot]}</small><b>${w?.name ?? 'VAZIO'}</b></span><em>${w ? TIERS[w.tier]!.label : '—'}</em></button>`;
      })
      .join('');

    const arm = spec[this.selectedSlot];
    const w = arm ? weapon(arm.id, arm.tier) : null;
    const nowArm = current.chassis === spec.chassis ? current[this.selectedSlot] : null;
    const was = nowArm ? weapon(nowArm.id, nowArm.tier) : null;
    const options = armOptions(this.selectedSlot, spec.chassis)
      .map((id) => `<option value="${id}"${arm?.id === id ? ' selected' : ''}>${weapon(id).name}</option>`)
      .join('');
    const editor = this.root.querySelector<HTMLElement>('#hangar-weapon-editor')!;
    editor.innerHTML = `
      <label class="hg-label" for="hangar-weapon-select">${SLOT_LABEL[this.selectedSlot]} · ARMAMENTO</label>
      <select id="hangar-weapon-select">${this.selectedSlot === 'left' ? `<option value=""${arm ? '' : ' selected'}>VAZIO (menos carga)</option>` : ''}${options}</select>
      <p class="hg-hint">${w ? WEAPON_HINT[w.id] : 'Encaixe vazio: sobra carga para o outro braço.'}</p>
      <div class="hg-label">NÍVEL DE POTÊNCIA</div>
      <div class="hg-tiers">${TIERS.map((t, i) => `<button class="hg-tier${arm?.tier === i ? ' selected' : ''}" type="button" data-tier="${i}" aria-pressed="${arm?.tier === i}"${arm ? '' : ' disabled'}><b>${t.label}</b><small>${i === 0 ? 'PADRÃO' : `+${Math.round((t.damage - 1) * 100)}% dano`}</small></button>`).join('')}</div>
      <button class="hg-test-btn" type="button" data-action="test"${arm ? '' : ' disabled'}>▶ TESTAR DISPARO · 4 S</button>
      <button class="hg-practice-btn" type="button" data-action="aim-practice"${arm ? '' : ' disabled'}>◎ TREINO DE MIRA · ALVO MÓVEL</button>
      ${w ? `<div class="hg-bars">${STATS.map((s) => bar(s, w, was)).join('')}</div><p class="hg-legend"><i class="now"></i> esta montagem <i class="was"></i> a que está no Mech</p>` : ''}`;

    const capPct = Math.min(100, (report.mass / report.capacity) * 100);
    const fill = this.root.querySelector<HTMLElement>('#hangar-mass-fill')!;
    fill.style.width = `${capPct}%`;
    const over = !report.check.ok && report.check.error === 'carga';
    fill.classList.toggle('over', over);
    this.setText('hangar-mass-value', `${num(report.mass, 1)} / ${num(report.capacity, 0)} t`);
    this.setText('hangar-mass-caption', over ? 'PASSOU DA CARGA: alivie um braço' : `${num(Math.max(0, report.capacity - report.mass), 1)} t livres`);
    this.setText('hangar-heat-value', report.overheatAt === null ? 'NÃO FERVE' : `${num(report.overheatAt, 1)} s`);
    this.setText('hangar-ttk-value', Number.isFinite(report.ttkTorso) ? `${num(report.ttkTorso, 1)} s` : '—');
    this.setText('hangar-damage-value', `${Math.round(report.damage20)} HP`);
    const shareUrl = new URL(location.href);
    shareUrl.searchParams.set('build', loadoutKey(spec));
    shareUrl.searchParams.delete('sala');
    this.root.querySelector<HTMLInputElement>('#hangar-build-link')!.value = shareUrl.toString();
    for (const apply of this.root.querySelectorAll<HTMLButtonElement>('[data-action="apply"]')) {
      apply.disabled = !report.check.ok;
      apply.title = report.check.ok ? 'Salvar e aplicar a montagem' : report.check.detail;
    }
    this.hotLeft.querySelector('span')!.innerHTML = `<b>02</b> ${spec.left ? 'BRAÇO E' : 'BRAÇO E · VAZIO'}`;
    // Atalhos 1 a 4: vazio salva a montagem da tela; cheio carrega (e o SALVAR pequeno sobrescreve).
    const draftKey = loadoutKey(spec);
    this.root.querySelector<HTMLElement>('#hg-presets')!.innerHTML = this.hangar
      .presets()
      .map((p, i) => {
        const active = p !== null && loadoutKey(p) === draftKey;
        const label = p ? presetLabel(p) : 'VAZIO · salvar';
        return `<div class="hg-preset${p ? '' : ' empty'}${active ? ' active' : ''}"><button type="button" data-preset-load="${i}" title="${p ? `Carregar o atalho ${i + 1} (tecla ${i + 1})` : 'Salvar esta montagem aqui'}"><b>${i + 1}</b><small>${label}</small></button>${p ? `<button class="hg-preset-save" type="button" data-preset-save="${i}" title="Salvar a montagem da tela neste atalho">SALVAR</button>` : ''}</div>`;
      })
      .join('');
    this.hotRight.classList.toggle('selected', this.selectedSlot === 'right');
    this.hotLeft.classList.toggle('selected', this.selectedSlot === 'left');
    this.renderMessage();
  }

  private renderMessage(): void {
    const node = this.root.querySelector<HTMLElement>('#hangar-message');
    if (!node) return;
    node.textContent = this.message;
    node.dataset.kind = this.messageKind;
  }

  private setText(id: string, text: string): void {
    const node = this.root.querySelector<HTMLElement>(`#${id}`);
    if (node) node.textContent = text;
  }
}

/** Rótulo curto de um atalho: chassi e nível de cada braço (ex.: "V09 · III / I"). */
function presetLabel(p: LoadoutSpec): string {
  const tier = (a: LoadoutSpec[ArmSlot]) => (a ? ['I', 'II', 'III'][a.tier] : '—');
  return `${p.chassis === 'android' ? 'A-1' : 'V09'} · ${tier(p.right)} / ${tier(p.left)}`;
}

/** Uma barra de leitura: o valor da arma escolhida e, por baixo, o da que está no Mech (se for outra). */
function bar(s: StatRow, w: WeaponStats, was: WeaponStats | null): string {
  const v = s.get(w);
  const max = STAT_MAX[s.key] || 1;
  const old = was ? s.get(was) : null;
  const delta = old === null ? 0 : v - old;
  const better = s.lowerIsBetter ? delta < 0 : delta > 0;
  const mark = Math.abs(delta) < 1e-6 ? '' : `<em class="${better ? 'up' : 'down'}">${delta > 0 ? '▲' : '▼'}</em>`;
  return `<div class="hg-bar"><span>${s.label}</span><div class="hg-track"><i class="was" style="width:${old === null ? 0 : Math.min(100, (old / max) * 100)}%"></i><i class="now" style="width:${Math.min(100, (v / max) * 100)}%"></i></div><b>${num(v, s.digits)}${s.unit}</b>${mark}</div>`;
}

function copySpec(spec: LoadoutSpec): LoadoutSpec {
  return { v: spec.v, chassis: spec.chassis, right: { ...spec.right }, left: spec.left ? { ...spec.left } : null };
}

function withArm(spec: LoadoutSpec, slot: ArmSlot, update: (arm: LoadoutSpec[ArmSlot]) => LoadoutSpec[ArmSlot]): LoadoutSpec {
  return { ...spec, [slot]: update(spec[slot]) };
}
