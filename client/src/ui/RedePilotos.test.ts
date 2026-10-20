import { afterEach, describe, expect, it, vi } from 'vitest';
import { anexarMudo } from '../voice/MudoNaRede';
import { RedePilotos, type PilotoNaRede } from './RedePilotos';

/** Um DOM de mentira com o mínimo que a lista usa (o Vitest roda no Node puro, G14). */
class No {
  children: No[] = [];
  parent: No | null = null;
  className = '';
  title = '';
  type = '';
  hidden = false;
  textContent = '';
  dataset: Record<string, string> = {};
  attrs: Record<string, string> = {};
  ouvintes: Record<string, ((e: unknown) => void)[]> = {};
  constructor(public tag: string) {}
  append(...filhos: No[]): void {
    for (const f of filhos) {
      f.parent = this;
      this.children.push(f);
    }
  }
  replaceChildren(): void {
    this.children = [];
  }
  setAttribute(k: string, v: string): void {
    this.attrs[k] = v;
  }
  getAttribute(k: string): string | null {
    return this.attrs[k] ?? null;
  }
  addEventListener(tipo: string, f: (e: unknown) => void): void {
    (this.ouvintes[tipo] ??= []).push(f);
  }
  /** Só os dois seletores que a lista usa: `[data-piloto]` e `[data-mudo]`. */
  closest(seletor: string): No | null {
    const chave = seletor === '[data-piloto]' ? 'piloto' : seletor === '[data-mudo]' ? 'mudo' : '';
    for (let n: No | null = this; n; n = n.parent) if (chave && n.dataset[chave] !== undefined) return n;
    return null;
  }
  clicar(alvo: No): { parou: boolean } {
    const e = { target: alvo, parou: false, stopPropagation() { e.parou = true; } };
    for (const f of this.ouvintes.click ?? []) f(e);
    return e;
  }
  todos(): No[] {
    return [this, ...this.children.flatMap((c) => c.todos())];
  }
}

const A: PilotoNaRede = { id: 4, nome: 'ANA', build: '' };
const B: PilotoNaRede = { id: 9, nome: 'BETO', build: '' };

function montar(aoClicar = vi.fn(), aoSilenciar = vi.fn()) {
  vi.stubGlobal('Element', No);
  vi.stubGlobal('document', { createElement: (tag: string) => new No(tag) });
  const lista = new No('ul');
  const rede = new RedePilotos(lista as unknown as HTMLElement, aoClicar, aoSilenciar);
  return { lista, rede, aoClicar, aoSilenciar };
}
const botoesDeMudo = (lista: No) => lista.todos().filter((n) => n.dataset.mudo !== undefined);
/** A voz de mentira: desenha o botão como o pedaço sob demanda da voz desenha (`anexarMudo`), com o estado de cada piloto. */
const vozCom = (silenciado: (id: number) => boolean) => ({ anexar: (li: HTMLElement, id: number) => anexarMudo(li, id, silenciado(id)) });

describe('RedePilotos: o mudo da voz de cada piloto (P228)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sem voz (fora da voz, convidado, menor) não há botão de mudo; com voz, um por piloto', () => {
    const { lista, rede } = montar();
    rede.atualizar([A, B], () => 0);
    expect(botoesDeMudo(lista)).toHaveLength(0);
    rede.atualizar([A, B], () => 0, vozCom(() => false));
    expect(botoesDeMudo(lista).map((b) => b.dataset.mudo)).toEqual(['4', '9']);
  });

  it('o botão mostra o estado: silenciar, ou voz silenciada (e diz isso a leitor de tela)', () => {
    const { lista, rede } = montar();
    rede.atualizar([A, B], () => 0, vozCom((id) => id === 9));
    const [ana, beto] = botoesDeMudo(lista);
    expect(ana!.textContent).toBe('SILENCIAR VOZ');
    expect(ana!.getAttribute('aria-pressed')).toBe('false');
    expect(ana!.className).toBe('rede-mudo');
    expect(beto!.textContent).toBe('VOZ SILENCIADA');
    expect(beto!.getAttribute('aria-pressed')).toBe('true');
    expect(beto!.className).toContain('ligado');
  });

  it('clicar silencia quem estava ouvindo e volta a ouvir quem estava silenciado, e não abre o Hangar do piloto', () => {
    const { lista, rede, aoClicar, aoSilenciar } = montar();
    rede.atualizar([A, B], () => 0, vozCom((id) => id === 9));
    const [ana, beto] = botoesDeMudo(lista);
    const e1 = lista.clicar(ana!);
    expect(aoSilenciar).toHaveBeenLastCalledWith(A, true);
    expect(e1.parou).toBe(true);
    lista.clicar(beto!);
    expect(aoSilenciar).toHaveBeenLastCalledWith(B, false);
    expect(aoClicar, 'o mudo não é o clique do piloto').not.toHaveBeenCalled();
  });

  it('clicar no nome continua abrindo o Hangar do piloto (não virou mudo)', () => {
    const { lista, rede, aoClicar, aoSilenciar } = montar();
    rede.atualizar([A], () => 0, vozCom(() => false));
    const botaoDoPiloto = lista.todos().find((n) => n.dataset.piloto === '4')!;
    lista.clicar(botaoDoPiloto);
    expect(aoClicar).toHaveBeenCalledWith(A);
    expect(aoSilenciar).not.toHaveBeenCalled();
  });

  it('um piloto que já saiu da lista não recebe o clique do mudo', () => {
    const { lista, rede, aoSilenciar } = montar();
    rede.atualizar([A], () => 0, vozCom(() => false));
    const [ana] = botoesDeMudo(lista);
    rede.atualizar([], () => 0, vozCom(() => false));
    lista.clicar(ana!);
    expect(aoSilenciar).not.toHaveBeenCalled();
  });
});
