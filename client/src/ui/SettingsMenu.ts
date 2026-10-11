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
  type Settings,
} from '../core/Settings';

import { attachSettingsTabs } from './settingsTabs';

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
    };

    attachSettingsTabs(this.modal);
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

    // Select options
    this.selQuality.innerHTML = (['auto', 'alta', 'media', 'baixa'] as QualityPreset[])
      .map((q) => `<option value="${q}">${QUALITY_LABELS[q]}</option>`)
      .join('');

    this.selDiff.innerHTML = (['facil', 'normal', 'dificil'] as Difficulty[])
      .map((d) => `<option value="${d}">${DIFFICULTY_LABELS[d]}</option>`)
      .join('');
  }

  private wireEvents(): void {
    this.btnOpen.addEventListener('click', (e) => {
      e.stopPropagation();
      this.open();
    });

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

  open(): void {
    this.modal.classList.remove('hidden');
    this.render(this.settings.value);
  }

  close(): void {
    this.cancelRemap();
    this.modal.classList.add('hidden');
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

    for (const { action } of KEY_ACTIONS) {
      if (this.remappingAction === action) continue;
      const btn = this.keyButtons[action];
      btn.textContent = `[ ${keyLabel(s.keys[action])} ]`;
    }
  }
}
