import type { Hangar } from '../hangar/Hangar';
import { CHASSIS_LABEL } from './HangarMenu';
import type { WeaponStats } from '../combat/weapons';

/**
 * Textos da tela inicial e da pausa que dependem do piloto: o subtítulo (chassi e classe) e as dicas das teclas
 * de arma. Antes eram fixos no Vector-09: com um Lancer ou um Marauder a tela dizia "VECTOR-09" e "plasma" (06/10).
 * Trocar de chassi é só no Hangar (um botão de atalho duplicava a escolha e zerava a montagem).
 */
export class PilotLabels {
  constructor(private readonly hangar: Hangar) {
    this.applyTexts();
    // Trocar a montagem no Hangar (mesmo chassi, outra arma) atualiza os textos sem recarregar a página.
    hangar.onChange = () => this.applyTexts();
  }

  /** Subtítulo com o nome e a classe do chassi atual; teclas com as armas da montagem atual. */
  private applyTexts(): void {
    const label = CHASSIS_LABEL[this.hangar.current.chassis];
    const loadout = this.hangar.equipped;
    setText('pilot-sub', `${label.title} // ${label.className}`);
    setText('key-primary', weaponHint(loadout.primary, loadout.offhand));
    setText('key-secondary', loadout.metalShield ? 'escudo físico (segure)' : loadout.secondary ? weaponHint(loadout.secondary) : 'sem arma');
  }
}

/** Nome da arma para a dica de tecla: minúsculas; corpo a corpo ganha "(encostado)"; as duas mãos saem juntas. */
function weaponHint(w: WeaponStats, offhand?: WeaponStats | null): string {
  const name = (x: WeaponStats) => (x.kind === 'melee' ? `${x.name.toLowerCase()} (encostado)` : x.name.toLowerCase());
  return offhand ? `${name(w)} + ${name(offhand)}` : name(w);
}

function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
