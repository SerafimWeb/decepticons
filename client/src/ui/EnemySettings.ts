import { LIMITS, PERSONA_LABELS, type GameSettings, type Persona, type Settings } from '../core/Settings';

/** Indicativos dos Mechs rebeldes, na ordem das personalidades (`GameSettings.enemyPersonas`). */
const CALLSIGNS = ['KESTREL', 'MAKO', 'VIPER'];
const PERSONAS: readonly Persona[] = ['soldado', 'brabo', 'manso', 'fujao'];
const ATTACKERS = [1, 1.5, 2, 3, 4];

/** O que a partida em curso usou (a contagem de inimigos só muda ao reiniciar). */
export interface EnemyLineup {
  enemyMechs: number;
  enemyAndroids: number;
  technician: boolean;
}

/**
 * Seção "Inimigos" da tela de configurações (dono, 25/09: "quero poder configurar mais"): quantos Mechs e
 * andróides, o técnico, a personalidade de cada Mech e quantos atacam ao mesmo tempo. Monta as próprias
 * linhas dentro de `#settings-enemies`, no visual das outras seções, e só fala com o contrato
 * (`Settings.update`). Personalidade e ataque valem na hora; a contagem, ao reiniciar a partida.
 */
export class EnemySettings {
  constructor(
    settings: Settings,
    private readonly running: EnemyLineup,
    host: HTMLElement | null = document.getElementById('settings-enemies'),
  ) {
    if (!host) return;
    const s = settings.value;
    const count = (id: string, key: 'enemyMechs' | 'enemyAndroids', max: number) =>
      this.select(id, Array.from({ length: max + 1 }, (_, i) => [String(i), String(i)]), String(s[key]), (v) => settings.update({ [key]: Number(v) }));
    const restart = document.createElement('button');
    restart.type = 'button';
    restart.className = 'btn-terminal';
    restart.textContent = '[ REINICIAR A PARTIDA ]';
    restart.addEventListener('click', () => location.reload());
    const note = document.createElement('small');
    note.className = 'setting-val';
    note.style.flexBasis = '100%';
    note.style.textAlign = 'right';

    const tech = document.createElement('input');
    tech.type = 'checkbox';
    tech.id = 'setting-tech';
    tech.checked = s.technician;
    tech.addEventListener('change', () => settings.update({ technician: tech.checked }));

    host.append(
      this.row('Mechs rebeldes', count('setting-foe-mechs', 'enemyMechs', LIMITS.enemyMechs.max)),
      this.row('Andróides de combate', count('setting-foe-androids', 'enemyAndroids', LIMITS.enemyAndroids.max)),
      this.row('Técnico (conserta os Mechs)', tech),
      this.row(
        'Atacam ao mesmo tempo',
        this.select('setting-foe-attackers', ATTACKERS.map((n) => [String(n), n % 1 ? `${Math.floor(n)} e ½` : String(n)]), String(s.maxAttackers), (v) => settings.update({ maxAttackers: Number(v) })),
        'Mech conta 1, andróide ½; os outros esperam a vez, afastados',
      ),
      ...CALLSIGNS.map((name, i) =>
        this.row(
          `Personalidade de ${name}`,
          this.select(`setting-persona-${i}`, PERSONAS.map((p) => [p, PERSONA_LABELS[p].label]), s.enemyPersonas[i] ?? 'soldado', (v) => {
            const list = [...settings.value.enemyPersonas];
            list[i] = v as Persona;
            settings.update({ enemyPersonas: list });
          }),
          PERSONA_LABELS[s.enemyPersonas[i] ?? 'soldado'].about,
        ),
      ),
      this.row('', restart, ''),
    );
    restart.parentElement?.append(note);
    settings.onChange((v) => this.refresh(v, host, restart, note));
  }

  /** Mostra a descrição da personalidade escolhida e avisa quando a contagem pede reiniciar. */
  private refresh(s: Readonly<GameSettings>, host: HTMLElement, restart: HTMLButtonElement, note: HTMLElement): void {
    for (let i = 0; i < CALLSIGNS.length; i++) {
      const help = host.querySelector<HTMLElement>(`#setting-persona-${i}`)?.parentElement?.querySelector('small');
      if (help) help.textContent = PERSONA_LABELS[s.enemyPersonas[i] ?? 'soldado'].about;
    }
    const r = this.running;
    const pending = s.enemyMechs !== r.enemyMechs || s.enemyAndroids !== r.enemyAndroids || s.technician !== r.technician;
    restart.hidden = !pending;
    note.textContent = pending ? 'Mechs, andróides e técnico mudam ao reiniciar.' : 'Personalidade e ataque já valem nesta partida.';
  }

  private select(id: string, options: readonly (readonly [string, string])[], value: string, onChange: (v: string) => void): HTMLSelectElement {
    const el = document.createElement('select');
    el.id = id;
    for (const [v, label] of options) {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = label;
      el.append(o);
    }
    el.value = value;
    el.addEventListener('change', () => onChange(el.value));
    return el;
  }

  private row(label: string, control: HTMLElement, help?: string): HTMLElement {
    const row = document.createElement('div');
    row.className = 'setting-row';
    const l = document.createElement('label');
    l.textContent = label;
    if (control.id) l.htmlFor = control.id;
    const ctrl = document.createElement('div');
    ctrl.className = 'setting-ctrl';
    ctrl.append(control);
    // Ajuda numa linha própria, embaixo do controle (o controle não é empurrado para o lado).
    ctrl.style.flexWrap = 'wrap';
    ctrl.style.justifyContent = 'flex-end';
    if (help !== undefined) {
      const small = document.createElement('small');
      small.className = 'setting-val';
      small.style.flexBasis = '100%';
      small.style.textAlign = 'right';
      small.textContent = help;
      ctrl.append(small);
    }
    row.append(l, ctrl);
    return row;
  }
}
