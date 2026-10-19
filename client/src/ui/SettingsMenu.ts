import {
  DIFFICULTY_LABELS,
  KEY_ACTIONS,
  LIMITS,
  QUALITY_LABELS,
  RESERVED_KEYS,
  keyLabel,
  normalizeKey,
  type Difficulty,
  type GameSettings,
  type KeyAction,
  type QualityPreset,
  type VoiceMode,
  type Settings,
} from '../core/Settings';

import { NARRACOES, ROTULO_DA_NARRACAO, type Narracao } from '../audio/falas';
import { listarAparelhos } from '../voice/aparelhos';
import type { MicTest } from '../voice/MicTest';
import { type ElegibilidadeDaVoz, TEXTO_DA_ELEGIBILIDADE } from '../voice/elegibilidade';
import { ligarPasso } from './Passo';
import { attachSettingsTabs, isSettingsTab, type SettingsTab } from './settingsTabs';

const $ = (id: string) => document.getElementById(id)!;

export class SettingsMenu {
  private readonly modal = $('settings-modal');
  private readonly btnOpen = $('btn-settings');
  private readonly btnClose = $('btn-settings-close');
  private readonly btnReset = $('btn-settings-reset');

  private readonly sliderSens = $('setting-sens') as HTMLInputElement;
  private readonly valSens = $('val-sens');
  private readonly chkInvertY = $('setting-inverty') as HTMLInputElement;
  private readonly chkAssist = $('setting-assist') as HTMLInputElement;
  private readonly chkAutoFire = $('setting-autofire') as HTMLInputElement;
  private readonly sliderFov = $('setting-fov') as HTMLInputElement;
  private readonly valFov = $('val-fov');
  private readonly sliderReticleSize = $('setting-reticle-size') as HTMLInputElement;
  private readonly valReticleSize = $('val-reticle-size');
  private readonly sliderReticleOpacity = $('setting-reticle-opacity') as HTMLInputElement;
  private readonly valReticleOpacity = $('val-reticle-opacity');
  private readonly sliderGlow = $('setting-glow') as HTMLInputElement;
  private readonly valGlow = $('val-glow');
  private readonly selQuality = $('setting-quality') as HTMLSelectElement;
  private readonly selDiff = $('setting-diff') as HTMLSelectElement;
  private readonly chkShowPerf = $('setting-showperf') as HTMLInputElement;
  private readonly sliderVolume = $('setting-volume') as HTMLInputElement;
  private readonly valVolume = $('val-volume');
  private readonly selNarracao = $('setting-narracao') as HTMLSelectElement;
  private readonly chkVozOn = $('setting-voz-on') as HTMLInputElement;
  private readonly selVozModo = $('setting-voz-modo') as HTMLSelectElement;
  private readonly sliderVozVolume = $('setting-voz-volume') as HTMLInputElement;
  private readonly valVozVolume = $('val-voz-volume');
  private readonly selVozAparelho = $('setting-voz-aparelho') as HTMLSelectElement;
  private readonly btnVozTestar = $('btn-voz-testar') as HTMLButtonElement;
  /** O teste do microfone (P212): pedaço sob demanda, só baixa quem toca em TESTAR. */
  private micTest: MicTest | null = null;

  private readonly tabs: { select(tab: SettingsTab): void };
  private remappingAction: KeyAction | null = null;
  private keyButtons: Record<KeyAction, HTMLButtonElement>;

  constructor(private readonly settings: Settings) {
    this.keyButtons = {
      forward: $('key-forward') as HTMLButtonElement,
      back: $('key-back') as HTMLButtonElement,
      left: $('key-left') as HTMLButtonElement,
      right: $('key-right') as HTMLButtonElement,
      jump: $('key-jump') as HTMLButtonElement,
      dash: $('key-dash') as HTMLButtonElement,
      secondary: $('key-secondary-bind') as HTMLButtonElement,
      camera: $('key-camera') as HTMLButtonElement,
      shield: $('key-shield') as HTMLButtonElement,
      ptt: $('key-ptt') as HTMLButtonElement,
    };

    this.tabs = attachSettingsTabs(this.modal);
    this.initDOM();
    this.wireEvents();
    this.settings.onChange((s) => this.render(s));
  }

  private initDOM(): void {
    // Sliders min/max/step
    this.sliderSens.min = LIMITS.sensitivity.min.toString();
    this.sliderSens.max = LIMITS.sensitivity.max.toString();
    this.sliderSens.step = LIMITS.sensitivity.step.toString();

    this.sliderFov.min = LIMITS.fovOffset.min.toString();
    this.sliderFov.max = LIMITS.fovOffset.max.toString();
    this.sliderFov.step = LIMITS.fovOffset.step.toString();

    for (const [slider, lim] of [
      [this.sliderReticleSize, LIMITS.reticleSize],
      [this.sliderReticleOpacity, LIMITS.reticleOpacity],
      [this.sliderGlow, LIMITS.glow],
    ] as const) {
      slider.min = lim.min.toString();
      slider.max = lim.max.toString();
      slider.step = lim.step.toString();
    }

    this.sliderVolume.min = LIMITS.volume.min.toString();
    this.sliderVolume.max = LIMITS.volume.max.toString();
    this.sliderVolume.step = LIMITS.volume.step.toString();
    this.sliderVozVolume.min = LIMITS.voiceVolume.min.toString();
    this.sliderVozVolume.max = LIMITS.voiceVolume.max.toString();
    this.sliderVozVolume.step = LIMITS.voiceVolume.step.toString();

    // Select options
    this.selQuality.innerHTML = (['auto', 'alta', 'media', 'baixa'] as QualityPreset[])
      .map((q) => `<option value="${q}">${QUALITY_LABELS[q]}</option>`)
      .join('');

    this.selDiff.innerHTML = (['facil', 'normal', 'dificil'] as Difficulty[])
      .map((d) => `<option value="${d}">${DIFFICULTY_LABELS[d]}</option>`)
      .join('');

    for (const n of NARRACOES) this.selNarracao.append(new Option(ROTULO_DA_NARRACAO[n], n));

    // O `‹ valor ›` das interfaces de jogos antigas (P182): qualidade, dificuldade e narrador se trocam por um passo, sem abrir lista. O select segue sendo a fonte (escondido).
    for (const s of [this.selQuality, this.selDiff, this.selNarracao, this.selVozModo]) ligarPasso(s);
  }

  private wireEvents(): void {
    // Os botões do console de comando abrem direto numa aba (`data-settings-open`); o `btn-settings` é um deles.
    const entries = new Set<HTMLElement>([this.btnOpen, ...document.querySelectorAll<HTMLElement>('[data-settings-open]')]);
    for (const el of entries) {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const tab = el.dataset.settingsOpen;
        this.open(isSettingsTab(tab) ? tab : undefined);
        // `data-settings-foco` (o atalho da conta no canto, P176): rola a aba até o bloco pedido, que fica no fim dela.
        const foco = el.dataset.settingsFoco;
        if (foco) document.getElementById(foco)?.closest('.settings-section')?.scrollIntoView({ block: 'start' });
      });
    }

    this.btnClose.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });

    this.btnReset.addEventListener('click', (e) => {
      e.stopPropagation();
      this.cancelRemap();
      this.settings.reset();
    });

    // Inputs
    this.sliderSens.addEventListener('input', () => {
      const val = parseFloat(this.sliderSens.value);
      this.valSens.textContent = `${val.toFixed(2)}x`;
      this.settings.update({ sensitivity: val });
    });

    this.chkInvertY.addEventListener('change', () => {
      this.settings.update({ invertY: this.chkInvertY.checked });
    });

    this.chkAssist.addEventListener('change', () => this.settings.update({ touchAimAssist: this.chkAssist.checked }));
    this.chkAutoFire.addEventListener('change', () => this.settings.update({ touchAutoFire: this.chkAutoFire.checked }));

    this.sliderFov.addEventListener('input', () => {
      const val = parseInt(this.sliderFov.value, 10);
      this.valFov.textContent = `${val >= 0 ? '+' : ''}${val}°`;
      this.settings.update({ fovOffset: val });
    });

    const pct = (v: number) => `${Math.round(v * 100)}%`;
    this.sliderReticleSize.addEventListener('input', () => {
      const v = parseFloat(this.sliderReticleSize.value);
      this.valReticleSize.textContent = pct(v);
      this.settings.update({ reticleSize: v });
    });
    this.sliderReticleOpacity.addEventListener('input', () => {
      const v = parseFloat(this.sliderReticleOpacity.value);
      this.valReticleOpacity.textContent = pct(v);
      this.settings.update({ reticleOpacity: v });
    });
    this.sliderGlow.addEventListener('input', () => {
      const v = parseFloat(this.sliderGlow.value);
      this.valGlow.textContent = pct(v);
      this.settings.update({ glow: v });
    });

    this.selQuality.addEventListener('change', () => {
      this.settings.update({ quality: this.selQuality.value as QualityPreset });
    });

    this.selDiff.addEventListener('change', () => {
      this.settings.update({ difficulty: this.selDiff.value as Difficulty });
    });

    this.selNarracao.addEventListener('change', () => {
      this.settings.update({ narracao: this.selNarracao.value as Narracao });
    });

    this.chkVozOn.addEventListener('change', () => {
      this.settings.update({ voiceOn: this.chkVozOn.checked });
    });

    this.selVozModo.addEventListener('change', () => {
      this.settings.update({ voiceMode: this.selVozModo.value as VoiceMode });
    });

    this.sliderVozVolume.addEventListener('input', () => {
      const val = parseFloat(this.sliderVozVolume.value);
      this.valVozVolume.textContent = `${Math.round(val * 100)}%`;
      this.settings.update({ voiceVolume: val });
    });

    this.selVozAparelho.addEventListener('change', () => {
      this.settings.update({ micDevice: this.selVozAparelho.value });
      void this.micTest?.reiniciar();
    });

    this.btnVozTestar.addEventListener('click', () => void this.alternarTesteDoMic());
    // Trocar de aba esconde o painel: o microfone não fica aberto por trás.
    for (const b of this.modal.querySelectorAll('.settings-tab')) b.addEventListener('click', () => this.micTest?.parar());

    this.chkShowPerf.addEventListener('change', () => {
      this.settings.update({ showPerf: this.chkShowPerf.checked });
    });

    this.sliderVolume.addEventListener('input', () => {
      const val = parseFloat(this.sliderVolume.value);
      this.valVolume.textContent = `${Math.round(val * 100)}%`;
      this.settings.update({ volume: val });
    });

    // Keys remapping buttons
    for (const { action } of KEY_ACTIONS) {
      const btn = this.keyButtons[action];
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.remappingAction === action) {
          this.cancelRemap();
        } else {
          this.startRemap(action);
        }
      });
    }

    // Keydown capture when remapping
    window.addEventListener(
      'keydown',
      (e) => {
        if (!this.remappingAction) return;
        e.preventDefault();
        e.stopPropagation();

        const code = normalizeKey(e.code);
        if (code === 'Escape') {
          this.cancelRemap();
          return;
        }
        if (RESERVED_KEYS.includes(code)) {
          // Recusa teclas reservadas
          this.flashError(this.keyButtons[this.remappingAction]);
          return;
        }

        this.applyKeyRemap(this.remappingAction, code);
        this.cancelRemap();
      },
      true,
    );
  }

  private startRemap(action: KeyAction): void {
    this.cancelRemap();
    this.remappingAction = action;
    const btn = this.keyButtons[action];
    btn.classList.add('listening');
    btn.textContent = '[ PRESSIONE ]';
  }

  private cancelRemap(): void {
    if (!this.remappingAction) return;
    const btn = this.keyButtons[this.remappingAction];
    btn.classList.remove('listening');
    this.remappingAction = null;
    this.render(this.settings.value);
  }

  private applyKeyRemap(action: KeyAction, newKey: string): void {
    const currentKeys = { ...this.settings.value.keys };
    // Swap se a nova tecla já estiver atribuída a outra ação
    for (const { action: otherAction } of KEY_ACTIONS) {
      if (otherAction !== action && currentKeys[otherAction] === newKey) {
        currentKeys[otherAction] = currentKeys[action];
        break;
      }
    }
    currentKeys[action] = newKey;
    this.settings.update({ keys: currentKeys });
  }

  private flashError(btn: HTMLButtonElement): void {
    btn.classList.add('error');
    setTimeout(() => btn.classList.remove('error'), 400);
  }

  /** Abre o modal; com `tab`, já na aba pedida (senão, na última que estava aberta). */
  open(tab?: SettingsTab): void {
    if (tab) this.tabs.select(tab);
    this.modal.classList.remove('hidden');
    this.render(this.settings.value);
    void this.atualizarAparelhos();
  }

  close(): void {
    this.cancelRemap();
    this.micTest?.parar();
    this.modal.classList.add('hidden');
  }

  /**
   * Quem pode usar o chat de voz (P211): só conta de maior de 18 anos. Para os outros os controles somem (nem o microfone, nem o teste dele) e uma frase diz o motivo e o que fazer.
   * O teste do microfone que estiver aberto é fechado.
   */
  setElegibilidadeDaVoz(e: ElegibilidadeDaVoz): void {
    const liberada = e === 'liberada';
    $('voz-controles').hidden = !liberada;
    const aviso = $('voz-elegibilidade');
    aviso.hidden = liberada;
    aviso.textContent = liberada ? '' : TEXTO_DA_ELEGIBILIDADE[e];
    if (!liberada) this.micTest?.parar();
  }

  /** O botão TESTAR / PARAR O TESTE: baixa o teste na primeira vez, e liga ou desliga. */
  private async alternarTesteDoMic(): Promise<void> {
    if (!this.micTest) {
      const { MicTest } = await import('../voice/MicTest');
      const ouvir = $('voz-ouvir') as HTMLInputElement;
      this.micTest = new MicTest(
        { painel: $('voz-teste'), barra: $('voz-nivel-barra'), status: $('voz-teste-status'), botao: this.btnVozTestar, ouvir },
        () => this.settings.value.micDevice,
        undefined,
        () => void this.atualizarAparelhos(),
      );
      ouvir.addEventListener('change', () => this.micTest?.ouvirAMinhaVoz(ouvir.checked));
    }
    if (this.micTest.rodando) this.micTest.parar();
    else await this.micTest.iniciar();
  }

  /** Os microfones da lista de escolha (com nome depois que o navegador deu a permissão); o salvo que sumiu continua escolhido, marcado como desconectado. */
  private async atualizarAparelhos(): Promise<void> {
    const todos = navigator.mediaDevices?.enumerateDevices ? await navigator.mediaDevices.enumerateDevices().catch(() => []) : [];
    const lista = listarAparelhos(todos, (n) => `Microfone ${n}`);
    const escolhido = this.settings.value.micDevice;
    const sel = this.selVozAparelho;
    sel.replaceChildren(new Option('Padrão do sistema', ''), ...lista.map((a) => new Option(a.nome, a.id)));
    if (escolhido && !lista.some((a) => a.id === escolhido)) sel.append(new Option('Aparelho salvo (desconectado)', escolhido));
    sel.value = escolhido;
  }

  private render(s: Readonly<GameSettings>): void {
    this.sliderSens.value = s.sensitivity.toString();
    this.valSens.textContent = `${s.sensitivity.toFixed(2)}x`;

    this.chkInvertY.checked = s.invertY;
    this.chkAssist.checked = s.touchAimAssist;
    this.chkAutoFire.checked = s.touchAutoFire;

    this.sliderFov.value = s.fovOffset.toString();
    this.valFov.textContent = `${s.fovOffset >= 0 ? '+' : ''}${s.fovOffset}°`;

    this.sliderReticleSize.value = s.reticleSize.toString();
    this.valReticleSize.textContent = `${Math.round(s.reticleSize * 100)}%`;
    this.sliderReticleOpacity.value = s.reticleOpacity.toString();
    this.valReticleOpacity.textContent = `${Math.round(s.reticleOpacity * 100)}%`;
    this.sliderGlow.value = s.glow.toString();
    this.valGlow.textContent = `${Math.round(s.glow * 100)}%`;

    this.selQuality.value = s.quality;
    this.selDiff.value = s.difficulty;
    this.chkShowPerf.checked = s.showPerf;

    this.sliderVolume.value = s.volume.toString();
    this.valVolume.textContent = `${Math.round(s.volume * 100)}%`;
    this.selNarracao.value = s.narracao;
    this.chkVozOn.checked = s.voiceOn;
    this.selVozModo.value = s.voiceMode;
    this.sliderVozVolume.value = s.voiceVolume.toString();
    this.valVozVolume.textContent = `${Math.round(s.voiceVolume * 100)}%`;
    if ([...this.selVozAparelho.options].some((o) => o.value === s.micDevice)) this.selVozAparelho.value = s.micDevice;

    for (const { action } of KEY_ACTIONS) {
      if (this.remappingAction === action) continue;
      const btn = this.keyButtons[action];
      btn.textContent = `[ ${keyLabel(s.keys[action])} ]`;
    }
  }
}
