import { defaultPower, parsePowerKey, powerChanges, powerKey, sanitizePower, type PowerSpec } from './power';

/** Onde as potências ficam salvas no aparelho. */
export const POWER_STORAGE_KEY = 'cybermech.potencias.v1';
/** Parâmetro do link que leva as potências para outro aparelho: `?potencias=p1.plasma-d120`. */
export const POWER_PARAM = 'potencias';

/**
 * As potências em uso nesta partida: as salvas no aparelho, ou as de um link `?potencias=` (que passam a ser
 * as salvas). Mudar vale ao reiniciar a partida: os robôs e as armas são montados com elas uma vez só.
 */
export class PowerStore {
  /** As potências desta partida (não mudam até reiniciar). */
  readonly current: PowerSpec;

  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null,
    search = '',
  ) {
    const fromLink = parsePowerKey(new URLSearchParams(search).get(POWER_PARAM) ?? '');
    this.current = fromLink ?? this.read() ?? defaultPower();
    if (fromLink) this.save(fromLink);
  }

  /** Quantos multiplicadores desta partida saem de 100% (0 = o jogo padrão). */
  get changes(): number {
    return powerChanges(this.current);
  }

  /** Texto do link para levar estas potências a outro aparelho. */
  key(spec: PowerSpec = this.current): string {
    return powerKey(spec);
  }

  /** Salva para a próxima partida (tudo em 100% apaga o que estava salvo). */
  save(spec: PowerSpec): void {
    try {
      if (powerChanges(spec) === 0) this.storage?.removeItem(POWER_STORAGE_KEY);
      else this.storage?.setItem(POWER_STORAGE_KEY, JSON.stringify(sanitizePower(spec)));
    } catch {
      // Sem armazenamento (aba anônima bloqueada): vale só o link.
    }
  }

  private read(): PowerSpec | null {
    try {
      const raw = this.storage?.getItem(POWER_STORAGE_KEY);
      return raw ? sanitizePower(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }
}
