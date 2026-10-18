import { configVazia, lerConfig, type ConfigDeVisibilidade, type EstadoDeVisibilidade } from '../../../shared/visibilidade';
import { STATUS_PATH } from '../../../shared/net/status';
import { serverHttpUrl } from '../../../shared/net/serverUrl';
import { padraoDe } from './funcionalidades';

/**
 * O QUE O JOGADOR VÊ (P191): junta o **padrão do código** (`funcionalidades.ts`) com as **exceções do servidor** (`GET /visibilidade`, o que o Comandante liberou ou segurou no painel). O Comandante
 * (modo Comandante) vê tudo, com o selo **TESTE** no que está restrito; o jogador normal só vê o que é público. **Não é segurança** (quem liga o modo Comandante vê tudo): é a vitrine do jogo.
 *
 * Sempre responde, mesmo sem rede: a última configuração boa fica no navegador (`localStorage`) e, sem ela, valem os padrões. **Custo:** uma consulta ao abrir (4 s de limite, sem bloquear o jogo); um
 * objeto de leitura depois.
 */
export const VISIBILIDADE_CACHE_KEY = 'cybermech.visibilidade.v1';
const ESPERA_MS = 4000;

export interface ArmazemSimples {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

type Ouvinte = () => void;

export class Visibilidade {
  private config: ConfigDeVisibilidade = configVazia();
  /** O Comandante olhando "como jogador": ignora o modo Comandante até recarregar. */
  private comoJogador = false;
  private readonly ouvintes = new Set<Ouvinte>();

  constructor(
    private readonly admin: boolean,
    private readonly armazem: ArmazemSimples | null = null,
  ) {
    try {
      const guardado = armazem?.getItem(VISIBILIDADE_CACHE_KEY);
      if (guardado) this.config = lerConfig(JSON.parse(guardado));
    } catch {
      /* cache quebrado: vale o padrão */
    }
  }

  /** O estado de uma funcionalidade: a exceção do servidor, senão o padrão do código. */
  estado(id: string): EstadoDeVisibilidade {
    return this.config.itens[id] ?? padraoDe(id);
  }

  get ehAdmin(): boolean {
    return this.admin && !this.comoJogador;
  }

  /** Esta funcionalidade aparece para quem está jogando agora? Pública: sempre. Restrita: só para o Comandante. */
  visivel(id: string): boolean {
    return this.estado(id) === 'publico' || this.ehAdmin;
  }

  /** Está restrita, mas o Comandante a vê (para o selo TESTE)? */
  emTeste(id: string): boolean {
    return this.estado(id) === 'restrito' && this.ehAdmin;
  }

  get itens(): Readonly<Record<string, EstadoDeVisibilidade>> {
    return this.config.itens;
  }

  /** Troca a configuração (o que o servidor mandou, ou o que o painel acabou de gravar), guarda no navegador e avisa quem desenha. */
  definir(c: ConfigDeVisibilidade): void {
    this.config = c;
    try {
      this.armazem?.setItem(VISIBILIDADE_CACHE_KEY, JSON.stringify(c));
    } catch {
      /* sem armazenamento */
    }
    this.avisar();
  }

  /** O Comandante olha o jogo como o jogador olha (o painel mostra o resultado na hora). */
  verComoJogador(ligado: boolean): void {
    this.comoJogador = ligado;
    this.avisar();
  }

  aoMudar(fn: Ouvinte): void {
    this.ouvintes.add(fn);
  }

  private avisar(): void {
    for (const fn of this.ouvintes) fn();
  }

  /**
   * Pergunta ao servidor o que vale (uma vez, ao abrir), pelo `/status` (que todo servidor responde com CORS: um servidor antigo, sem a visibilidade, só não traz o campo). Nunca lança e nunca
   * trava o jogo: sem resposta, fica o que o navegador lembrava (ou o padrão).
   */
  async carregar(gameServer: string | undefined | null, buscar: typeof fetch = (...a) => fetch(...a)): Promise<boolean> {
    const base = serverHttpUrl(gameServer, STATUS_PATH);
    if (!base) return false;
    try {
      const res = await buscar(base, { cache: 'no-store', mode: 'cors', signal: AbortSignal.timeout(ESPERA_MS) });
      if (!res.ok) return false;
      const corpo = (await res.json()) as { visibilidade?: unknown } | null;
      if (!corpo?.visibilidade) return false;
      this.definir(lerConfig(corpo.visibilidade));
      return true;
    } catch {
      return false;
    }
  }
}

let compartilhada: Visibilidade | null = null;

/** O jogo tem uma visibilidade só (criada no `main.ts`, antes da interface): quem desenha uma lista (modos, mapas, Hangar) a consulta por aqui, sem receber o objeto. */
export function definirVisibilidadeGlobal(v: Visibilidade | null): void {
  compartilhada = v;
}

/** A visibilidade compartilhada (para o painel), ou `null` se ninguém a criou. */
export const visibilidadeGlobal = (): Visibilidade | null => compartilhada;

/** Avisa quando a configuração muda (o painel gravou, o servidor respondeu, o Comandante olhou como jogador). Sem visibilidade criada, não faz nada. */
export function aoMudarVisibilidade(fn: () => void): void {
  compartilhada?.aoMudar(fn);
}

/** A funcionalidade aparece para quem joga? Sem visibilidade criada (os testes, o servidor), tudo aparece. */
export const funcionalidadeVisivel = (id: string): boolean => compartilhada?.visivel(id) ?? true;

/** Aplica o catálogo da visibilidade compartilhada a um pedaço do DOM (os `data-func` que nascem depois da largada). */
export function aplicarGlobal(raiz: ParentNode): void {
  if (compartilhada) aplicarAoDom(compartilhada, raiz);
}

/**
 * O link de um jogador que abriu uma fase ou um modo **restrito** (`?mapa=amazonia`, `?modo=ctf`) volta ao padrão: sem o parâmetro, o jogo abre a Arena em Deathmatch. Devolve a busca nova, ou
 * `null` se nada mudou. O Comandante (e quem o jogo trata como tal) não é filtrado.
 */
export function sanearLink(search: string, v: Pick<Visibilidade, 'visivel'>): string | null {
  const p = new URLSearchParams(search);
  let mudou = false;
  const mapa = p.get('mapa');
  if (mapa && !v.visivel(`mapa:${mapa}`)) {
    p.delete('mapa');
    mudou = true;
  }
  const modo = p.get('modo');
  if (modo && !v.visivel(`modo:${modo}`)) {
    p.delete('modo');
    mudou = true;
  }
  return mudou ? p.toString() : null;
}

/** Aplica o catálogo ao DOM: todo `[data-func="id"]` some (classe `func-oculta`) se a funcionalidade não é visível, e leva o selo TESTE (`func-teste`) se é restrita e o Comandante a vê. */
export function aplicarAoDom(v: Pick<Visibilidade, 'visivel' | 'emTeste'>, raiz: ParentNode): void {
  for (const el of raiz.querySelectorAll<HTMLElement>('[data-func]')) {
    const id = el.dataset.func!;
    el.classList.toggle('func-oculta', !v.visivel(id));
    el.classList.toggle('func-teste', v.emTeste(id));
  }
}
