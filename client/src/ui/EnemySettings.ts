import { NAME_MAX } from '../core/botNames';
import { LIMITS, PERSONA_LABELS, type EnemyNames, type GameSettings, type Persona, type Settings } from '../core/Settings';
import { ligarPasso, MAX_OPCOES_DO_PASSO } from './Passo';

const PERSONAS: readonly Persona[] = ['soldado', 'brabo', 'manso', 'fujao'];
const ATTACKERS = [1, 1.5, 2, 3, 4];
const MECHS = 3;

/** O que a partida em curso usou (contagem, técnico e nomes só mudam ao reiniciar). */
export interface EnemyLineup {
  enemyMechs: number;
  enemyAndroids: number;
  technician: boolean;
  names: EnemyNames;
}

/** O esquadrão personalizado (P91), quando há um: a contagem, as personalidades e os nomes dele valem no lugar dos desta seção. */
export interface EsquadraoAtivo {
  /** "16 inimigos e 8 aliados". */
  resumo: string;
  /** Apaga o esquadrão salvo e recarrega a partida (a das configurações volta). */
  voltarAoPadrao: () => void;
}

/** Um campo de nome: como ler o valor salvo e como gravar um novo no lugar certo da lista. */
interface NameField {
  input: HTMLInputElement;
  read: (n: EnemyNames) => string;
}

/**
 * Seções "Inimigos" e "Nomes na tela" da tela de configurações. Inimigos (dono, 25/09: "quero poder configurar mais"):
 * quantos Mechs e andróides, o técnico, a personalidade de cada Mech e quantos atacam ao mesmo tempo. Nomes (dono,
 * 06/10: "quero poder mudar o nome dos inimigos, npcs, etc, na própria interface"): cada Mech, andróide, técnico e
 * aliado. Só fala com o contrato (`Settings.update`). Personalidade e ataque valem na hora; contagem e nomes, ao reiniciar.
 */
export class EnemySettings {
  private readonly fields: NameField[] = [];

  constructor(
    settings: Settings,
    private readonly running: EnemyLineup,
    host: HTMLElement | null = document.getElementById('settings-enemies'),
    namesHost: HTMLElement | null = document.getElementById('settings-names'),
    squad: EsquadraoAtivo | null = null,
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

    if (squad) {
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'btn-terminal';
      reset.id = 'setting-squad-reset';
      reset.textContent = '[ VOLTAR AO PADRÃO ]';
      reset.addEventListener('click', squad.voltarAoPadrao);
      host.append(this.row('Esquadrão personalizado', reset, `${squad.resumo}. A contagem e as personalidades abaixo só valem sem ele; um nome que ele não dá vem de Nomes na tela.`));
    }
    host.append(
      this.row('Mechs rebeldes', count('setting-foe-mechs', 'enemyMechs', LIMITS.enemyMechs.max)),
      this.row('Andróides de combate', count('setting-foe-androids', 'enemyAndroids', LIMITS.enemyAndroids.max)),
      this.row('Técnico (conserta os Mechs)', tech),
      this.row(
        'Atacam ao mesmo tempo',
        this.select('setting-foe-attackers', ATTACKERS.map((n) => [String(n), n % 1 ? `${Math.floor(n)} e ½` : String(n)]), String(s.maxAttackers), (v) => settings.update({ maxAttackers: Number(v) })),
        'Mech conta 1, andróide ½; os outros esperam a vez, afastados',
      ),
      ...Array.from({ length: MECHS }, (_, i) => {
        const row = this.row(
          `Personalidade de ${s.names.mechs[i]}`,
          this.select(`setting-persona-${i}`, PERSONAS.map((p) => [p, PERSONA_LABELS[p].label]), s.enemyPersonas[i] ?? 'soldado', (v) => {
            const list = [...settings.value.enemyPersonas];
            list[i] = v as Persona;
            settings.update({ enemyPersonas: list });
          }),
          PERSONA_LABELS[s.enemyPersonas[i] ?? 'soldado'].about,
        );
        row.dataset.persona = String(i);
        return row;
      }),
      this.row('', restart, ''),
    );
    restart.parentElement?.append(note);
    settings.onChange((v) => this.refresh(v, host, restart, note));

    if (!namesHost) return;
    const field = (label: string, id: string, key: keyof EnemyNames, i: number): HTMLElement => {
      const read = (n: EnemyNames) => n[key][i] ?? '';
      const input = document.createElement('input');
      input.type = 'text';
      input.id = id;
      input.maxLength = NAME_MAX;
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.value = read(s.names);
      input.addEventListener('change', () => {
        const names = settings.value.names;
        settings.update({ names: { ...names, [key]: names[key].map((x, j) => (j === i ? input.value : x)) } });
      });
      this.fields.push({ input, read });
      return this.row(label, input);
    };
    namesHost.append(
      ...Array.from({ length: MECHS }, (_, i) => field(`Mech rebelde ${i + 1}`, `setting-name-mech-${i}`, 'mechs', i)),
      ...s.names.androids.map((_, i) => field(`Andróide ${i + 1}`, `setting-name-android-${i}`, 'androids', i)),
      field('Técnico', 'setting-name-tech', 'technicians', 0),
      ...s.names.allies.map((_, i) => field(`Aliado ${i + 1}`, `setting-name-ally-${i}`, 'allies', i)),
    );
    settings.onChange((v) => this.refreshNames(v));
  }

  /** Personalidade (descrição e nome na linha) e o aviso de reiniciar. */
  private refresh(s: Readonly<GameSettings>, host: HTMLElement, restart: HTMLButtonElement, note: HTMLElement): void {
    for (let i = 0; i < MECHS; i++) {
      const row = host.querySelector<HTMLElement>(`[data-persona="${i}"]`);
      if (!row) continue;
      row.querySelector('label')!.textContent = `Personalidade de ${s.names.mechs[i]}`;
      row.querySelector('small')!.textContent = PERSONA_LABELS[s.enemyPersonas[i] ?? 'soldado'].about;
    }
    const r = this.running;
    const countsPending = s.enemyMechs !== r.enemyMechs || s.enemyAndroids !== r.enemyAndroids || s.technician !== r.technician;
    const namesPending = JSON.stringify(s.names) !== JSON.stringify(r.names);
    const pending = countsPending || namesPending;
    restart.hidden = !pending;
    note.textContent = pending ? 'Mechs, andróides, técnico e nomes mudam ao reiniciar.' : 'Personalidade e ataque já valem nesta partida.';
  }

  /** Mostra o nome já limpo (sem brigar com quem está digitando). */
  private refreshNames(s: Readonly<GameSettings>): void {
    for (const f of this.fields) {
      if (document.activeElement !== f.input) f.input.value = f.read(s.names);
    }
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
    // Poucos valores (as personalidades, as quantidades): o `‹ valor ›` (P182). Já na linha, para o rótulo dela virar o nome do conjunto.
    if (control instanceof HTMLSelectElement && control.options.length <= MAX_OPCOES_DO_PASSO) ligarPasso(control);
    return row;
  }
}
