import { browserStorage } from './Settings';

/**
 * O modo Comandante está ligado agora? **Decidido uma vez, no início** (`main.ts`) e lido pelo jogo e pelo console. A regra e o porquê estão em `core/DecisaoDoComandante.ts`, que é **sob demanda**: só
 * é baixada quando há o que decidir (um `?comandante=`, a lembrança do navegador ou uma conta guardada), e o jogador comum não paga nada (o pacote de partida está no teto de 500 KB). **A porta fica
 * aqui e não no `main.ts` de propósito:** o `smoke` conta como "de partida" tudo o que o próprio `index` cita, `import()` incluído; só o que um pedaço de partida carrega fica "sob demanda".
 */
let ligado = false;

/** Onde o navegador lembra que o modo Comandante está ligado. */
export const COMANDANTE_KEY = 'cybermech.comandante.v1';

export function definirModoComandante(valor: boolean): void {
  ligado = valor;
}

export function modoComandante(): boolean {
  return ligado;
}

/** O começo da chave em que o navegador guarda o token da conta (`net/sessao.ts`, `CHAVE_TOKEN`; um teste confere que é o mesmo). Aqui só se pergunta "há uma conta guardada?", sem importar a sessão inteira. */
export const PREFIXO_DO_TOKEN = 'cybermech.conta.token';

/** Decide o modo Comandante (P224): só carrega a decisão se há link, lembrança ou conta no navegador; senão, desligado. */
export async function decidirModoComandante(servidor: string | null | undefined): Promise<boolean> {
  const armazem = browserStorage();
  let ha = /[?&](comandante|admin)=/.test(location.search);
  try {
    for (let i = 0; armazem && !ha && i < armazem.length; i++) {
      const k = armazem.key(i);
      ha = k === COMANDANTE_KEY || !!k?.startsWith(PREFIXO_DO_TOKEN);
    }
  } catch {
    /* sem armazenamento */
  }
  return ha ? (await import('./DecisaoDoComandante')).decidirModoComandante(servidor) : false;
}
