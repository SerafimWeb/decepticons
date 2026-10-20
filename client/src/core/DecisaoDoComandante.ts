import { ContaCliente } from '../net/auth';
import { chaveDoToken } from '../net/sessao';
import { COMANDANTE_KEY, definirModoComandante } from './ModoComandante';
import { browserStorage } from './Settings';

/**
 * QUEM VÊ O QUE AINDA NÃO FOI LANÇADO (P224, 19/10): o modo Comandante mostra as telas e as fases restritas (`mapa:*`, `tela:*`). **Antes**, qualquer pessoa o ligava digitando `?comandante=1` (ou
 * escrevendo a chave no armazenamento do navegador): é um **atalho de depuração** (um "interruptor escondido"), bom para desenvolver e **ruim para lançar** (abre fase em construção e conteúdo
 * ainda sem revisão). Agora há **dois caminhos**, e só um vale em produção:
 *
 * 1. **O link** (`?comandante=1`, e o que o navegador lembra): só **em desenvolvimento** (`npm run dev`), **no próprio PC** (`localhost`) e **no site publicado enquanto `VITE_COMANDANTE_POR_LINK=1`** (o
 *    `publicar-site` liga enquanto `deploy-site.json` não diz `"comandantePorLink": false`). **No lançamento o dono desliga com uma linha**, e o link e a lembrança passam a ser ignorados.
 * 2. **A conta de administrador:** quem entrou com uma conta `is_admin` (o servidor responde em `/conta/eu`) abre o modo Comandante **sem link**.
 *
 * **Isto continua sendo o lado do navegador** (quem controla o próprio navegador pode fingir): o que protege de verdade é o **servidor** (o token do dono nas rotas `/admin` e a recusa de mapa
 * restrito a quem não é administrador, A0/P226: `CREDENCIAL` antes do JOIN). O nome do padrão: **feature flag** (interruptor de funcionalidade), com **acesso por papel** (RBAC) validado no servidor.
 *
 * **Sob demanda:** o pacote de partida do jogo está no teto (500 KB), e quase nenhum jogador tem link, lembrança ou conta de administrador: o `main.ts` só importa este módulo quando há um dos três.
 */

/**
 * Liga com `?comandante=1` (ou `?admin=1`) e desliga com `=0`; sem o parâmetro, vale o que o navegador lembra. **Não é segurança:** só mostra os monitores de ajuste do jogo, que não mexem em
 * servidor nem em dado de ninguém (tudo ali já existia nas Configurações). O que pede proteção de verdade é o servidor (token, `PAINEL_ADMIN.md`; mapa restrito, A0/P226).
 */
export function lerModoComandante(search: string, lembrado: string | null): { ligado: boolean; gravar: '1' | 'apagar' | null } {
  const p = new URLSearchParams(search);
  const v = p.get('comandante') ?? p.get('admin');
  if (v === '1' || v === 'sim') return { ligado: true, gravar: '1' };
  if (v === '0' || v === 'nao' || v === 'não') return { ligado: false, gravar: 'apagar' };
  return { ligado: lembrado === '1', gravar: null };
}

/** O link e a lembrança valem aqui? Desenvolvimento e o próprio PC: sempre. O site publicado: só com `VITE_COMANDANTE_POR_LINK=1` (o lançamento o desliga). */
export function linkPermitido(hostname: string, dev: boolean, flag: string | undefined): boolean {
  if (dev) return true;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return true;
  return flag === '1';
}

export interface DecisaoDoComandante {
  ligado: boolean;
  /** O que fazer com a lembrança do navegador: guardar, apagar, ou deixar como está. */
  gravar: '1' | 'apagar' | null;
}

export interface EntradaDoComandante {
  search: string;
  /** O que o navegador lembrava (a chave `COMANDANTE_KEY`). */
  lembrado: string | null;
  linkPermitido: boolean;
  /** A conta em que o navegador está entrou como administrador (o servidor confirmou). */
  admin: boolean;
}

/** A decisão, pura: a conta de administrador sempre liga; sem ela, o link só vale onde é permitido (onde não é, **ignora o link e apaga a lembrança**). */
export function decidirComandante(e: EntradaDoComandante): DecisaoDoComandante {
  if (e.admin) return { ligado: true, gravar: null };
  if (!e.linkPermitido) return { ligado: false, gravar: e.lembrado === '1' ? 'apagar' : null };
  return lerModoComandante(e.search, e.lembrado);
}

/** Esta conta é de administrador? **Só pergunta se há uma conta** (o token do navegador, um por servidor) e espera até 1,5 s; qualquer falha é "não". O servidor é quem diz (`/conta/eu`). */
async function contaDeAdministrador(servidor: string | null | undefined): Promise<boolean> {
  try {
    const token = servidor ? browserStorage()?.getItem(chaveDoToken(servidor)) : null;
    if (!servidor || !token) return false;
    const eu = await Promise.race([new ContaCliente(servidor).eu(token), new Promise<null>((fim) => setTimeout(() => fim(null), 1500))]);
    return eu?.is_admin === true;
  } catch {
    return false;
  }
}

/** Decide **uma vez, no início** (o jogo, o console e a visibilidade leem o mesmo valor), guarda ou apaga a lembrança do navegador e devolve se o modo Comandante está ligado. */
export async function decidirModoComandante(servidor: string | null | undefined): Promise<boolean> {
  const armazem = browserStorage();
  let lembrado: string | null = null;
  try {
    lembrado = armazem?.getItem(COMANDANTE_KEY) ?? null;
  } catch {
    /* sem armazenamento */
  }
  const entrada = { search: location.search, lembrado, linkPermitido: linkPermitido(location.hostname, import.meta.env.DEV, import.meta.env.VITE_COMANDANTE_POR_LINK), admin: false };
  let d = decidirComandante(entrada);
  if (!d.ligado) d = decidirComandante({ ...entrada, admin: await contaDeAdministrador(servidor) });
  try {
    if (d.gravar === '1') armazem?.setItem(COMANDANTE_KEY, '1');
    else if (d.gravar === 'apagar') armazem?.removeItem(COMANDANTE_KEY);
  } catch {
    /* sem armazenamento */
  }
  definirModoComandante(d.ligado);
  return d.ligado;
}
