import { lerModoComandante } from '../ui/consoleData';

/**
 * QUEM VÊ O QUE AINDA NÃO FOI LANÇADO (P224, 19/10): o modo Comandante mostra as telas e as fases restritas (`mapa:*`, `tela:*`). **Antes**, qualquer pessoa o ligava digitando `?comandante=1` (ou
 * escrevendo a chave no armazenamento do navegador): é um **atalho de depuração** (um "interruptor escondido"), bom para desenvolver e **ruim para lançar** (abre fase em construção e conteúdo
 * ainda sem revisão). Agora há **dois caminhos**, e só um vale em produção:
 *
 * 1. **O link** (`?comandante=1`, e o que o navegador lembra): só **em desenvolvimento** (`npm run dev`), **no próprio PC** (`localhost`) e **no site publicado enquanto `VITE_COMANDANTE_POR_LINK=1`** (o
 *    `publicar-site` liga enquanto `deploy-site.json` não diz `"comandantePorLink": false`). **No lançamento o dono desliga com uma linha**, e o link e a lembrança passam a ser ignorados.
 * 2. **A conta de administrador:** quem entrou com uma conta `is_admin` (o servidor responde em `/conta/eu`) abre o modo Comandante **sem link**.
 *
 * **Isto continua sendo o lado do navegador** (quem controla o próprio navegador pode fingir): o que protege de verdade é o **servidor** (o token do dono nas rotas `/admin`, e, **ainda por fazer**, a
 * recusa de mapa restrito a quem não é administrador). O nome do padrão: **feature flag** (interruptor de funcionalidade), com **acesso por papel** (RBAC) validado no servidor para valer de verdade.
 */

/** O link e a lembrança valem aqui? Desenvolvimento e o próprio PC: sempre. O site publicado: só com `VITE_COMANDANTE_POR_LINK=1` (o lançamento o desliga). */
export function linkPermitido(hostname: string, dev: boolean, flag: string | undefined): boolean {
  if (dev) return true;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return true;
  return flag === '1';
}

export interface DecisaoDoComandante {
  ligado: boolean;
  /** De onde veio: o link (ou a lembrança), a conta de administrador, ou de lugar nenhum. */
  origem: 'link' | 'conta' | 'nenhuma';
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
  if (e.admin) return { ligado: true, origem: 'conta', gravar: null };
  if (!e.linkPermitido) return { ligado: false, origem: 'nenhuma', gravar: e.lembrado === '1' ? 'apagar' : null };
  const m = lerModoComandante(e.search, e.lembrado);
  return { ligado: m.ligado, origem: m.ligado ? 'link' : 'nenhuma', gravar: m.gravar };
}

let ligado = false;

/** Guardado no início (`main.ts`) para o jogo e o console lerem o mesmo valor. */
export function definirModoComandante(valor: boolean): void {
  ligado = valor;
}

export function modoComandante(): boolean {
  return ligado;
}
