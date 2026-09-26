import { drill, timeToKill } from '../combat/balance';
import { weapon, type Loadout } from '../combat/weapons';
import { CHASSIS } from '../entities/chassis';
import { FACTORY_LOADOUT, loadoutKey, parseLoadoutKey, validateLoadout, type LoadoutCheck, type LoadoutSpec } from './loadout';

/** Onde a montagem fica salva no aparelho (sem conta: o progresso é do aparelho). */
export const HANGAR_STORAGE_KEY = 'cybermech.hangar.v1';
/** As montagens dos atalhos 1 a 4. */
export const PRESETS_STORAGE_KEY = 'cybermech.hangar.presets.v1';
export const PRESET_COUNT = 4;

/** Números de uma montagem para a tela do Hangar, da mesma simulação do jogo (teto teórico). */
export interface LoadoutReport {
  check: LoadoutCheck;
  /** Carga usada e a do chassi (t). */
  mass: number;
  capacity: number;
  /** Segundos para derrubar o torso de um Vector-09 com os dois braços, todos os tiros no alvo. */
  ttkTorso: number;
  /** Correndo com tudo disparando: em quantos segundos o Mech superaquece (null = não ferve em 20 s). */
  overheatAt: number | null;
  /** Dano em 20 s correndo com tudo disparando (o calor e as recargas contam). */
  damage20: number;
}

/**
 * O Hangar do jogador: a montagem salva, a validação, os números para a tela e a troca de armas.
 * A tela (Gemini, `ui/`) só usa isto: `current`, `check`, `report`, `apply`. O jogo aplica a montagem
 * nova no próximo renascimento (`takePending`), com o Mech inteiro e frio.
 *
 * Também lê um link de build (`?build=v1.vector09.plasma-2.rockets-0`): quem recebe o link entra com a
 * mesma montagem, se ela for válida.
 */
export class Hangar {
  private spec: LoadoutSpec;
  private pending: Loadout | null = null;
  /** A montagem mudou (a tela e o HUD podem se atualizar). */
  onChange?: (spec: LoadoutSpec) => void;

  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeStorage(),
    search = typeof location === 'undefined' ? '' : location.search,
  ) {
    const fromLink = parseLoadoutKey(new URLSearchParams(search).get('build') ?? '');
    const saved = this.read();
    this.spec = fromLink ?? saved ?? FACTORY_LOADOUT;
    if (fromLink) this.write(fromLink);
  }

  /** A montagem atual (a salva, a do link ou a de fábrica). */
  get current(): LoadoutSpec {
    return this.spec;
  }

  /** As armas da montagem atual, prontas para o Mech. */
  get equipped(): Loadout {
    const c = validateLoadout(this.spec);
    return c.ok ? c.loadout : CHASSIS.vector09.loadout;
  }

  /** Link para compartilhar a montagem atual (texto do parâmetro `build`). */
  get key(): string {
    return loadoutKey(this.spec);
  }

  check(spec: LoadoutSpec): LoadoutCheck {
    return validateLoadout(spec);
  }

  report(spec: LoadoutSpec): LoadoutReport {
    const check = validateLoadout(spec);
    const chassis = CHASSIS[spec.chassis] ?? CHASSIS.vector09;
    const arms = [weapon(spec.right.id, spec.right.tier), ...(spec.left ? [weapon(spec.left.id, spec.left.tier)] : [])];
    const run = drill(chassis, { speed: 1, fire: arms }, 20);
    return {
      check,
      mass: check.mass,
      capacity: check.capacity,
      ttkTorso: timeToKill(arms, chassis, CHASSIS.vector09.maxModuleHealth.torso),
      overheatAt: run.overheatAt,
      damage20: run.damage,
    };
  }

  /** Salva e agenda a montagem para o próximo renascimento. Montagem inválida não muda nada. */
  apply(spec: LoadoutSpec): LoadoutCheck {
    const check = validateLoadout(spec);
    if (!check.ok) return check;
    this.spec = spec;
    this.pending = check.loadout;
    this.write(spec);
    this.onChange?.(spec);
    return check;
  }

  /** As montagens salvas nos atalhos 1 a 4 (null = atalho vazio). Montagem salva que não vale mais vira vazio. */
  presets(): (LoadoutSpec | null)[] {
    const out: (LoadoutSpec | null)[] = Array.from({ length: PRESET_COUNT }, () => null);
    try {
      const raw: unknown = JSON.parse(this.storage?.getItem(PRESETS_STORAGE_KEY) ?? '[]');
      if (Array.isArray(raw)) raw.slice(0, PRESET_COUNT).forEach((s, i) => (out[i] = validateLoadout(s).ok ? (s as LoadoutSpec) : null));
    } catch {
      // Salvo estragado: atalhos vazios.
    }
    return out;
  }

  /** Salva uma montagem no atalho `index` (0 a 3). Montagem inválida não é salva. */
  savePreset(index: number, spec: LoadoutSpec): LoadoutCheck {
    const check = validateLoadout(spec);
    if (!check.ok || index < 0 || index >= PRESET_COUNT) return check;
    const list = this.presets();
    list[index] = spec;
    try {
      this.storage?.setItem(PRESETS_STORAGE_KEY, JSON.stringify(list));
    } catch {
      // Sem armazenamento: o atalho vale só nesta sessão (não guardado).
    }
    return check;
  }

  /** O jogo pega a montagem agendada no renascimento (uma vez só). */
  takePending(): Loadout | null {
    const p = this.pending;
    this.pending = null;
    return p;
  }

  private read(): LoadoutSpec | null {
    try {
      const raw = this.storage?.getItem(HANGAR_STORAGE_KEY);
      if (!raw) return null;
      const spec: unknown = JSON.parse(raw);
      return validateLoadout(spec).ok ? (spec as LoadoutSpec) : null;
    } catch {
      return null;
    }
  }

  private write(spec: LoadoutSpec): void {
    try {
      this.storage?.setItem(HANGAR_STORAGE_KEY, JSON.stringify(spec));
    } catch {
      // Sem armazenamento (aba anônima, cota): vale só nesta sessão.
    }
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
