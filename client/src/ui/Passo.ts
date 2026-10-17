/**
 * O seletor `‹ valor ›` (ordem P182, 17/10; `REFERENCIA_VISUAL.md` § 8): nas interfaces de jogos antigos que o Comandante mandou, uma opção com poucos valores se troca **com um passo
 * para a esquerda ou para a direita**, sem abrir lista. Aqui ele veste um `<select>` que **continua existindo** (escondido): o jogo segue lendo e escrevendo `select.value` como sempre e
 * ouvindo o evento `change`; o `‹ valor ›` só espelha o que o select diz e o muda por clique ou pelas setas do teclado. Nada do que lê o select precisa saber que ele está vestido.
 * Módulo independente (G3). Custo de CPU: zero fora do clique (um observador de opções por seletor, só quando o texto delas muda: a troca de idioma).
 */

/** O índice para onde o passo vai (circular: depois do último volta ao primeiro, como nos menus de arcade). Sem opções, -1. */
export function proximoIndice(atual: number, total: number, direcao: -1 | 1): number {
  if (total <= 0) return -1;
  const base = atual < 0 ? (direcao === 1 ? -1 : 0) : atual;
  return (((base + direcao) % total) + total) % total;
}

/** O que o `‹ valor ›` mostra: o texto da opção marcada (vazio se não há). */
export function rotuloDoPasso(select: Pick<HTMLSelectElement, 'selectedIndex' | 'options'>): string {
  const o = select.selectedIndex >= 0 ? select.options[select.selectedIndex] : undefined;
  return o?.textContent?.trim() ?? '';
}

/** Quantas opções um select pode ter para valer um `‹ valor ›` (acima disso a lista é melhor: o idioma, os números grandes). */
export const MAX_OPCOES_DO_PASSO = 8;

/**
 * Veste `select` (que já está no documento) com o `‹ valor ›` e o esconde. Devolve o conjunto (para o chamador achar o elemento). Chamar duas vezes no mesmo select não duplica.
 * Mantém-se em dia com o select: mudar `.value` ou `.selectedIndex` por código, trocar as opções ou o texto delas (a tradução) atualiza o valor mostrado.
 */
export function ligarPasso(select: HTMLSelectElement): HTMLElement | null {
  if (select.dataset.passoLigado === '1' || !select.parentElement) return null;
  select.dataset.passoLigado = '1';

  const conjunto = document.createElement('span');
  conjunto.className = 'passo';
  conjunto.setAttribute('role', 'group');
  const rotulo = (select.closest('.setting-row')?.querySelector('label') ?? (select.id ? document.querySelector(`label[for="${select.id}"]`) : null))?.textContent?.trim();
  if (rotulo) conjunto.setAttribute('aria-label', rotulo);

  const seta = (texto: string, direcao: -1 | 1, nome: string): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'passo-seta';
    b.textContent = texto;
    b.setAttribute('aria-label', nome);
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      passar(direcao);
    });
    return b;
  };
  const valor = document.createElement('span');
  valor.className = 'passo-valor';
  valor.setAttribute('aria-live', 'polite');
  conjunto.append(seta('‹', -1, 'Valor anterior'), valor, seta('›', 1, 'Próximo valor'));

  const atualizar = (): void => {
    const texto = rotuloDoPasso(select);
    if (valor.textContent !== texto) valor.textContent = texto;
  };
  const passar = (direcao: -1 | 1): void => {
    const i = proximoIndice(select.selectedIndex, select.options.length, direcao);
    if (i < 0) return;
    select.selectedIndex = i;
    atualizar();
    select.dispatchEvent(new Event('change', { bubbles: true }));
  };
  conjunto.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      passar(e.key === 'ArrowRight' ? 1 : -1);
    }
  });

  // O jogo escreve `select.value` e `select.selectedIndex` direto (sem evento): o espelho acompanha pela propriedade da própria instância.
  for (const nome of ['value', 'selectedIndex'] as const) {
    const original = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, nome);
    if (!original?.get || !original.set) continue;
    Object.defineProperty(select, nome, {
      configurable: true,
      get() {
        return original.get!.call(select);
      },
      set(v: never) {
        original.set!.call(select, v);
        atualizar();
      },
    });
  }
  // Opções que chegam depois, e o texto delas traduzido: o observador refaz o rótulo.
  new MutationObserver(atualizar).observe(select, { childList: true, subtree: true, characterData: true });

  select.hidden = true;
  select.before(conjunto);
  atualizar();
  return conjunto;
}
