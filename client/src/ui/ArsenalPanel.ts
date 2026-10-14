import { CLASS_LABEL, WEAPON_CLASSES, type WeaponClass } from '../combat/weaponClass';
import { CHASSIS, type ChassisId } from '../entities/chassis';
import { fichasDasArmas, fichasDosChassis, NATUREZA_ROTULO, type FichaDaArma, type FichaDoChassi } from './arsenalData';

/** O que a janela precisa do jogo (o `Game.ts` só liga: G3). */
export interface ArsenalPanelOptions {
  /** Os chassis que o esquadrão aceita como bot (a coluna "BOT"). */
  chassisDeBot: readonly ChassisId[];
}

type Aba = 'armas' | 'chassis';

/** Cria um elemento com classe e texto (nada de `innerHTML`: os nomes vêm do catálogo, mas o hábito vale). */
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

const num = (n: number, casas = 0): string => n.toFixed(casas).replace('.', ',');

function botao(texto: string, className: string, dados: Record<string, string>, titulo?: string): HTMLButtonElement {
  const b = el('button', className, texto);
  b.type = 'button';
  for (const [k, v] of Object.entries(dados)) b.dataset[k] = v;
  if (titulo) b.title = titulo;
  return b;
}

/**
 * A janela ARSENAL (fase 4C, P27/P54): do monitor COMANDO, as fichas de todas as armas (classe, natureza, dano, cadência, DPS, alcance, calor, carga, o que cada uma faz de
 * diferente, quem a leva) e de todos os chassis (tamanho, vida, passo, carga, encaixes, se o bot pode pilotá-lo). **Só leitura**: os números saem do catálogo
 * (`arsenalData.ts`), então o equilíbrio muda a ficha sozinho. Mudar um número é em Configurações → Avançado (potências) ou nos arquivos de equilíbrio.
 *
 * Custo: zero no jogo. A janela só existe com a pausa à vista; as fichas são calculadas uma vez, na primeira abertura (cerca de quarenta linhas).
 */
export class ArsenalPanel {
  private readonly root: HTMLElement;
  private aba: Aba = 'armas';
  private classe: WeaponClass | 'todas' = 'todas';
  private aberta = false;
  private armas: FichaDaArma[] | null = null;
  private chassis: FichaDoChassi[] | null = null;

  constructor(private readonly o: ArsenalPanelOptions, root: HTMLElement | null = document.getElementById('arsenal-modal')) {
    if (!root) {
      this.root = el('div');
      return;
    }
    this.root = root;
    root.addEventListener('click', (e) => this.clique(e));
  }

  /** O Esc fecha de onde estiver o foco (a janela refaz os botões a cada clique e o foco se perde): o ouvido fica no documento enquanto ela está aberta. */
  private readonly aoTeclar = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    this.fechar();
  };

  get isOpen(): boolean {
    return this.aberta;
  }

  abrir(): boolean {
    if (!this.root.id) return false;
    this.armas ??= fichasDasArmas();
    this.chassis ??= fichasDosChassis(this.o.chassisDeBot);
    this.aberta = true;
    document.addEventListener('keydown', this.aoTeclar, true);
    this.root.classList.remove('hidden');
    this.desenhar();
    this.root.querySelector<HTMLElement>('.squad-fechar')?.focus();
    return true;
  }

  fechar(): void {
    document.removeEventListener('keydown', this.aoTeclar, true);
    this.aberta = false;
    this.root.classList.add('hidden');
  }

  private clique(e: Event): void {
    const alvo = (e.target as HTMLElement).closest<HTMLElement>('[data-acao]');
    if (!alvo) return;
    switch (alvo.dataset.acao) {
      case 'fechar':
        return this.fechar();
      case 'aba':
        this.aba = alvo.dataset.aba === 'chassis' ? 'chassis' : 'armas';
        return this.desenhar();
      case 'classe':
        this.classe = (alvo.dataset.classe as WeaponClass | 'todas') ?? 'todas';
        return this.desenhar();
    }
  }

  private desenhar(): void {
    if (!this.root.id) return;
    const caixa = el('div', 'squad-box arsenal-box');
    caixa.setAttribute('role', 'dialog');
    caixa.setAttribute('aria-modal', 'true');
    caixa.setAttribute('aria-label', 'Arsenal');

    const cab = el('header', 'squad-head');
    cab.append(el('h2', '', 'ARSENAL'), el('span', 'squad-sub', 'as armas e os chassis, com os números do jogo'), botao('×', 'squad-fechar', { acao: 'fechar' }, 'Fechar (Esc)'));

    const abas = el('nav', 'squad-presets');
    abas.append(
      botao('ARMAS', `squad-preset${this.aba === 'armas' ? ' sel' : ''}`, { acao: 'aba', aba: 'armas' }),
      botao('CHASSIS', `squad-preset${this.aba === 'chassis' ? ' sel' : ''}`, { acao: 'aba', aba: 'chassis' }),
    );
    if (this.aba === 'armas') {
      abas.append(el('span', 'squad-presets-rot', 'CLASSE'));
      for (const c of ['todas', ...WEAPON_CLASSES] as const) {
        abas.append(botao(c === 'todas' ? 'TODAS' : CLASS_LABEL[c], `squad-preset${this.classe === c ? ' sel' : ''}`, { acao: 'classe', classe: c }));
      }
    }

    const corpo = el('div', 'arsenal-corpo');
    corpo.append(this.aba === 'armas' ? this.tabelaDeArmas() : this.tabelaDeChassis());

    const pe = el('footer', 'squad-pe');
    pe.append(
      el('p', 'squad-msg', this.aba === 'armas'
        ? 'Números do MK I. A classe é o porte da arma no tamanho de robô para o qual foi feita; num gigante, a pesada dos Mechs é a leve dele. Para mudar um número: Configurações → Avançado → Potências.'
        : 'Vida e passo do chassi; a carga é o que o Hangar deixa pôr em armas. BOT: o esquadrão oferece o chassi para os robôs (os titãs só como inimigos).'),
    );

    caixa.append(cab, abas, corpo, pe);
    this.root.replaceChildren(caixa);
  }

  private tabelaDeArmas(): HTMLElement {
    const t = el('table', 'arsenal-tabela');
    const cabeca = el('tr');
    for (const h of ['ARMA', 'CLASSE', 'NATUREZA', 'DANO', 'TIROS/S', 'DPS', 'ALCANCE (m)', 'CALOR', 'CARGA (t)', 'O QUE FAZ', 'QUEM LEVA']) cabeca.append(el('th', '', h));
    const cabecalho = el('thead');
    cabecalho.append(cabeca);
    t.append(cabecalho);
    const corpo = el('tbody');
    for (const f of this.armas!.filter((a) => this.classe === 'todas' || a.classe === this.classe)) {
      const linha = el('tr');
      linha.append(
        el('td', 'arsenal-nome', f.nome),
        el('td', '', `${CLASS_LABEL[f.classe]} ${f.tamanho === 2 ? '' : `(T${f.tamanho})`}`.trim()),
        el('td', '', NATUREZA_ROTULO[f.natureza]),
        el('td', 'n', num(f.dano)),
        el('td', 'n', num(f.tirosPorSegundo, 2)),
        el('td', 'n', f.danoPorSegundo === null ? '—' : num(f.danoPorSegundo, 1)),
        el('td', 'n', `${num(f.alcanceOtimo)} / ${num(f.alcanceMaximo)}`),
        el('td', 'n', num(f.calorPorTiro, 2)),
        el('td', 'n', num(f.massa, 1)),
        el('td', 'arsenal-notas', f.notas.join('; ') || '—'),
      );
      const quem = el('td', 'arsenal-quem', `${f.chassis.length} chassi${f.chassis.length === 1 ? '' : 's'}`);
      quem.title = f.chassis.map((c) => CHASSIS[c].name).join(', ');
      linha.append(quem);
      corpo.append(linha);
    }
    t.append(corpo);
    return t;
  }

  private tabelaDeChassis(): HTMLElement {
    const t = el('table', 'arsenal-tabela');
    const cabeca = el('tr');
    for (const h of ['CHASSI', 'TAMANHO', 'PAPEL', 'TORSO', 'VIDA TOTAL', 'PASSO (m/s)', 'PULA / DASH', 'CARGA (t)', 'DIREITA', 'ESQUERDA', 'OMBROS', 'FÁBRICA', 'BOT']) cabeca.append(el('th', '', h));
    const cabecalho = el('thead');
    cabecalho.append(cabeca);
    t.append(cabecalho);
    const corpo = el('tbody');
    for (const f of this.chassis!) {
      const linha = el('tr');
      const lista = (nomes: string[]): HTMLElement => {
        const td = el('td', 'n', nomes.length ? String(nomes.length) : '—');
        td.title = nomes.join(', ');
        return td;
      };
      linha.append(
        el('td', 'arsenal-nome', f.nome),
        el('td', 'n', String(f.tamanho)),
        el('td', 'arsenal-notas', f.papel),
        el('td', 'n', num(f.vidaDoTorso)),
        el('td', 'n', num(f.vidaTotal)),
        el('td', 'n', num(f.velocidade, 1)),
        el('td', '', `${f.pula ? 'pula' : '—'} / ${f.dash ? 'dash' : '—'}`),
        el('td', 'n', num(f.carga, 1)),
        lista(f.direita),
        lista(f.esquerda),
        lista(f.ombros),
        el('td', '', f.armaDeFabrica),
        el('td', '', f.bot ? 'sim' : '—'),
      );
      corpo.append(linha);
    }
    t.append(corpo);
    return t;
  }
}
