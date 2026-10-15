import { weapon, WEAPON_IDS } from '../combat/weapons';
import { reloadWithout, withoutParam } from '../core/url';
import {
  CLAN_FIELDS,
  CLANS,
  clampPower,
  defaultPower,
  POWER_GOALS,
  POWER_MAX,
  POWER_MIN,
  powerChanges,
  powerKey,
  powerReport,
  sanitizePower,
  WEAPON_FIELDS,
  type Clan,
  type PowerReport,
  type PowerSpec,
} from '../tuning/power';
import { POWER_PARAM, type PowerStore } from '../tuning/PowerStore';

const CLAN_LABEL: Record<Clan, string> = { player: 'Você', mechs: 'Mechs rebeldes', androids: 'Andróides rebeldes', technician: 'Técnico (dano = conserto)' };
const WEAPON_HEAD = ['Dano', 'Cadência', 'Calor', 'Alcance'] as const;
const CLAN_HEAD = ['Dano', 'Vida', 'Velocid.', 'Calor'] as const;

const secs = (s: number) => (Number.isFinite(s) ? `${s.toFixed(1).replace('.', ',')} s` : 'não derruba');

/**
 * Seção "Potências" da tela de configurações (dono, 25/09: "um painel de controle para configurar as potências das
 * armas, dos robôs, por arma, por clã, pra eu customizar"). Uma grade de porcentagens por arma (dano, cadência,
 * calor, alcance) e por clã (dano, vida, velocidade, calor), com o que o ajuste faz com a luta calculado na hora
 * pela mesma simulação das metas de equilíbrio, e um aviso quando sai delas. Vale ao reiniciar; o link leva o
 * ajuste para outro aparelho. Só fala com o contrato (`tuning/power.ts`, `PowerStore`).
 */
export class PowerSettings {
  private readonly draft: PowerSpec;
  private readonly cells: { input: HTMLInputElement; get: () => number }[] = [];
  private readonly baseline: PowerReport = powerReport(defaultPower());
  private report!: HTMLUListElement;
  private status!: HTMLElement;

  constructor(
    private readonly store: PowerStore,
    host: HTMLElement | null = document.getElementById('settings-power'),
  ) {
    this.draft = sanitizePower(store.current);
    this.flagPause();
    if (!host) return;

    const note = document.createElement('p');
    note.className = 'power-note';
    note.textContent = `Porcentagem do padrão do jogo (100%), de ${POWER_MIN * 100}% a ${POWER_MAX * 100}%. Arma: vale para todos que a usam (os rebeldes também); clã: só para ele. Vale ao reiniciar a partida, neste aparelho; o link leva o ajuste para outro.`;

    const arms = this.grid(
      'Armas',
      WEAPON_HEAD,
      WEAPON_IDS.map((id) => ({ label: weapon(id).name, spec: this.draft.weapons[id], fields: WEAPON_FIELDS })),
    );
    const clans = this.grid(
      'Robôs por clã',
      CLAN_HEAD,
      CLANS.map((c) => ({ label: CLAN_LABEL[c], spec: this.draft.clans[c], fields: CLAN_FIELDS })),
    );

    this.report = document.createElement('ul');
    this.report.className = 'power-report';
    this.status = document.createElement('small');
    this.status.className = 'power-status';

    const actions = document.createElement('div');
    actions.className = 'power-actions';
    actions.append(
      this.button('[ APLICAR E REINICIAR ]', () => {
        this.store.save(this.draft);
        reloadWithout(POWER_PARAM);
      }),
      this.button('[ PADRÃO ]', () => this.setAll(defaultPower())),
      this.button('[ COPIAR LINK ]', () => this.copyLink()),
    );

    host.append(note, arms, clans, this.report, actions, this.status);
    this.refresh();
  }

  /** Uma grade: cabeçalho de 4 colunas e uma linha por arma ou clã, cada célula uma porcentagem. */
  private grid<F extends string>(
    title: string,
    heads: readonly string[],
    rows: readonly { label: string; spec: Record<F, number>; fields: readonly F[] }[],
  ): HTMLElement {
    const grid = document.createElement('div');
    grid.className = 'power-grid';
    const cell = (cls: string, text: string) => {
      const el = document.createElement('span');
      el.className = cls;
      el.textContent = text;
      grid.append(el);
    };
    cell('pt', title);
    cell('ph', '');
    for (const h of heads) cell('ph', h);
    for (const row of rows) {
      cell('pl', row.label);
      row.fields.forEach((f, i) => {
        const input = document.createElement('input');
        input.type = 'number';
        input.inputMode = 'numeric';
        input.min = String(POWER_MIN * 100);
        input.max = String(POWER_MAX * 100);
        input.step = '5';
        input.setAttribute('aria-label', `${row.label} · ${heads[i]}`);
        input.addEventListener('input', () => {
          const v = Number(input.value);
          if (input.value !== '' && Number.isFinite(v)) row.spec[f] = clampPower(v / 100);
          this.refresh();
        });
        // Ao sair da célula, mostra o valor que vale (dentro da faixa).
        input.addEventListener('change', () => this.show(input, row.spec[f]));
        this.show(input, row.spec[f]);
        this.cells.push({ input, get: () => row.spec[f] });
        grid.append(input);
      });
    }
    return grid;
  }

  private show(input: HTMLInputElement, v: number): void {
    input.value = String(Math.round(v * 100));
    input.classList.toggle('changed', v !== 1);
  }

  private setAll(spec: PowerSpec): void {
    for (const id of WEAPON_IDS) Object.assign(this.draft.weapons[id], spec.weapons[id]);
    for (const c of CLANS) Object.assign(this.draft.clans[c], spec.clans[c]);
    for (const { input, get } of this.cells) this.show(input, get());
    this.refresh();
  }

  /** O que o ajuste faz com a luta, e se sai das metas de equilíbrio do padrão. */
  private refresh(): void {
    for (const { input, get } of this.cells) input.classList.toggle('changed', get() !== 1);
    const r = powerReport(this.draft);
    const b = this.baseline;
    const line = (text: string, now: number, base: number, min?: number) => {
      const li = document.createElement('li');
      const low = min !== undefined && now < min;
      li.className = low ? 'warn' : '';
      li.textContent = `${text}: ${secs(now)} (padrão ${secs(base)})${low ? ` · abaixo da meta de ${secs(min)}: apelação` : ''}`;
      return li;
    };
    const shots = document.createElement('li');
    shots.textContent = `Seu plasma derruba um andróide rebelde com ${r.androidShots} tiro${r.androidShots === 1 ? '' : 's'} (padrão ${b.androidShots})`;
    this.report.replaceChildren(
      line('Seu plasma derruba um Mech rebelde', r.yourPlasma, b.yourPlasma, POWER_GOALS.singleMin),
      line('Seus dois braços juntos', r.yourCombo, b.yourCombo, POWER_GOALS.comboMin),
      line('O plasma de um Mech rebelde derruba você', r.theirPlasma, b.theirPlasma, POWER_GOALS.singleMin),
      line('Os dois braços de um Mech rebelde', r.theirCombo, b.theirCombo, POWER_GOALS.comboMin),
      line('A motosserra de um andróide arranca sua perna', r.sawLeg, b.sawLeg),
      shots,
    );
    const running = this.store.changes;
    const pending = powerKey(this.draft) !== powerKey(this.store.current);
    this.status.textContent = `Nesta partida: ${running ? `${running} ajuste${running === 1 ? '' : 's'}` : 'o padrão do jogo'}.${pending ? ' Os valores novos valem ao reiniciar.' : ''} Teto teórico, sem errar tiro.`;
  }

  private copyLink(): void {
    const url = new URL(withoutParam(location.href, POWER_PARAM));
    if (powerChanges(this.draft)) url.searchParams.set(POWER_PARAM, powerKey(this.draft));
    const text = url.toString();
    const done = (ok: boolean) => (this.status.textContent = ok ? 'Link copiado.' : `Copie o link: ${text}`);
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => done(true), () => done(false));
    else done(false);
  }

  private button(label: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn-terminal';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  /** Aviso na pausa quando a partida roda com potências ajustadas (para ninguém esquecer que mexeu). */
  private flagPause(): void {
    const n = this.store.changes;
    const after = document.querySelector('#overlay .cc-brand h1');
    if (!n || !after) return;
    const flag = document.createElement('p');
    flag.className = 'power-flag';
    flag.textContent = `POTÊNCIAS AJUSTADAS · ${n} mudança${n === 1 ? '' : 's'} · configurações → potências`;
    after.after(flag);
  }
}
