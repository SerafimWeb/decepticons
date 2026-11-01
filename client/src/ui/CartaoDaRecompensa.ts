import type { Recompensa } from '../core/recompensaDaPartida';

/**
 * O cartão do fim da partida (P304, "toda partida rende"): o XP linha por linha, os Créditos, a barra de nível que enche na hora e o aviso quando o piloto sobe
 * de nível ou cumpre uma missão do dia. É o momento que diz ao jogador "valeu a pena, joga mais uma".
 *
 * **Onde aparece:** no placar do intervalo da rodada (offline, `RoundHud`), na tela do fim da missão, da Bandeira e do Domínio (o console), e online como um aviso
 * curto no topo (`compacto`): online o servidor só avisa quando a rodada SEGUINTE começa, então o cartão não pode tampar a luta.
 *
 * Os textos vão por `textContent`, cada um no seu nó (a tradução do `i18n` acha a frase e o número separados); nada do jogador entra como HTML.
 * Custo: monta o DOM uma vez por fim de partida; a barra anda por transição de CSS, sem laço de quadro.
 */
export interface ProgressoDoPiloto {
  readonly nivelAntes: number;
  readonly xpAntes: number;
  readonly nivel: number;
  readonly xp: number;
  readonly xpPorNivel: number;
}

/** As frases do cartão (chaves de tradução; o teste de idioma confere que as seis línguas têm todas). */
export const CARTAO_TEXTOS = {
  titulo: 'SUA PARTIDA',
  xp: '+{0} XP',
  creditos: '+{0} ₵',
  nivel: 'NÍVEL DE PILOTO {0}',
  subiu: 'SUBIU PARA O NÍVEL {0}!',
  barra: '{0} / {1} XP',
  missao: 'MISSÃO DO DIA CUMPRIDA',
  resgate: 'resgate a recompensa em CARREIRA',
  semXp: 'jogue a partida inteira para ganhar XP',
} as const;

/** Quanto tempo o aviso compacto (online) fica na tela. */
export const CARTAO_COMPACTO_MS = 6000;

const preencher = (modelo: string, ...v: (string | number)[]): string => v.reduce<string>((s, x, i) => s.replace(`{${i}}`, String(x)), modelo);

/** Quanto da barra está cheio antes e depois (0 a 1). Subiu de nível: a barra parte do zero (o nível novo). */
export function barraDoNivel(p: ProgressoDoPiloto): { de: number; ate: number } {
  const frac = (xp: number) => (p.xpPorNivel > 0 ? Math.min(1, Math.max(0, xp / p.xpPorNivel)) : 0);
  return { de: p.nivel > p.nivelAntes ? 0 : frac(p.xpAntes), ate: frac(p.xp) };
}

export class CartaoDaRecompensa {
  readonly el: HTMLDivElement | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private quadro = 0;
  /** O último que mostrou (para quem confere sem DOM). */
  ultimo: { recompensa: Recompensa; progresso: ProgressoDoPiloto; missoes: readonly string[] } | null = null;

  constructor() {
    if (typeof document === 'undefined') return;
    this.el = document.createElement('div');
    this.el.className = 'cartao-recompensa';
    this.el.hidden = true;
  }

  /**
   * Mostra o cartão dentro de `parent` (o placar, a tela do fim) ou, com `compacto`, solto no topo da tela por `CARTAO_COMPACTO_MS`.
   * `missoes`: os títulos das missões do dia que ficaram prontas para resgatar nesta partida.
   */
  mostrar(parent: HTMLElement | null, recompensa: Recompensa, progresso: ProgressoDoPiloto, missoes: readonly string[] = [], compacto = false): void {
    this.ultimo = { recompensa, progresso, missoes };
    const el = this.el;
    if (!el || !parent) return;
    this.pararTimer();
    if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this.quadro);
    el.classList.toggle('compacto', compacto);
    el.replaceChildren();

    const topo = this.filho(el, 'div', 'cr-topo');
    this.filho(topo, 'span', 'cr-titulo', CARTAO_TEXTOS.titulo);
    this.filho(topo, 'span', 'cr-xp', preencher(CARTAO_TEXTOS.xp, recompensa.xp));
    if (recompensa.creditos > 0) this.filho(topo, 'span', 'cr-creditos', preencher(CARTAO_TEXTOS.creditos, recompensa.creditos));

    if (!compacto) {
      const lista = this.filho(el, 'ul', 'cr-linhas');
      if (recompensa.linhas.length === 0) this.filho(lista, 'li', 'cr-vazio', CARTAO_TEXTOS.semXp);
      for (const l of recompensa.linhas) {
        const li = this.filho(lista, 'li', 'cr-linha');
        this.filho(li, 'span', '', l.rotulo);
        this.filho(li, 'span', 'cr-linha-xp', preencher(CARTAO_TEXTOS.xp, l.xp));
      }
    }

    const nivel = this.filho(el, 'div', 'cr-nivel');
    const subiu = progresso.nivel > progresso.nivelAntes;
    this.filho(nivel, 'span', subiu ? 'cr-subiu' : 'cr-nivel-n', preencher(subiu ? CARTAO_TEXTOS.subiu : CARTAO_TEXTOS.nivel, progresso.nivel));
    const trilho = this.filho(nivel, 'div', 'cr-trilho');
    const barra = this.filho(trilho, 'div', 'cr-barra');
    this.filho(nivel, 'span', 'cr-nivel-xp', preencher(CARTAO_TEXTOS.barra, progresso.xp, progresso.xpPorNivel));
    const { de, ate } = barraDoNivel(progresso);
    barra.style.transform = `scaleX(${de})`;

    for (const titulo of missoes) {
      const m = this.filho(el, 'div', 'cr-missao');
      this.filho(m, 'span', 'cr-missao-rotulo', CARTAO_TEXTOS.missao);
      this.filho(m, 'span', 'cr-missao-titulo', titulo);
      if (!compacto) this.filho(m, 'span', 'cr-missao-dica', CARTAO_TEXTOS.resgate);
    }

    el.classList.toggle('subiu', subiu);
    if (el.parentElement !== parent) parent.append(el);
    el.hidden = false;
    // A barra anda depois que o cartão já está na tela (sem o quadro de espera, a transição não acontece).
    if (typeof requestAnimationFrame !== 'undefined') this.quadro = requestAnimationFrame(() => (barra.style.transform = `scaleX(${ate})`));
    else barra.style.transform = `scaleX(${ate})`;
    if (compacto) this.timer = setTimeout(() => this.esconder(), CARTAO_COMPACTO_MS);
  }

  /** Some (a rodada nova começou, a missão recomeçou). */
  esconder(): void {
    this.pararTimer();
    if (this.el) this.el.hidden = true;
  }

  private pararTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private filho<K extends keyof HTMLElementTagNameMap>(pai: HTMLElement, tag: K, classe: string, texto?: string): HTMLElementTagNameMap[K] {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto !== undefined) e.textContent = texto;
    pai.append(e);
    return e;
  }
}
