import {
  CANAIS,
  classificarOrigem,
  faixaDeRetorno,
  familiaDoNavegador,
  familiaDoSistema,
  idiomaPrincipal,
  tipoDeAparelho,
  type Canal,
  type ContaTipo,
  type ContextoDoFunil,
  type Visita,
} from '../../../shared/net/audiencia';

/**
 * Audiência (P188), o lado do navegador: descreve **esta visita por categorias** (de onde veio, que aparelho, que idioma, novo ou recorrente) para o servidor somar. G3: módulo independente, ligado
 * por chamada; sem DOM direto (o `lerAmbiente` é o único que toca `window`/`navigator`) e sem rede (quem envia é a `Telemetry`).
 *
 * **O que fica no navegador, e por quê não identifica ninguém:**
 * - `cybermech.visitou` (`localStorage`): o **dia** da primeira visita, para separar "novo" de "recorrente". É uma data que todo mundo que chegou naquele dia tem igual; **nunca é enviada**,
 *   só a faixa ("há 2 a 7 dias") que ela produz.
 * - `cybermech.origem` (`sessionStorage`): a origem **desta aba** (a da primeira página), para o jogo saber que quem veio da landing chegou por uma rede social e não "do próprio site". Some ao
 *   fechar a aba.
 * Tudo isto está descrito na política de privacidade (`/privacidade/`). Custo de CPU: uma classificação por carregamento de página, fora do tick.
 */
export const CHAVE_VISITOU = 'cybermech.visitou';
export const CHAVE_ORIGEM = 'cybermech.origem';

/** O que a página sabe de si, lido uma vez (o teste entrega um falso). */
export interface Ambiente {
  referrer: string;
  hostProprio: string;
  search: string;
  userAgent: string;
  marcas: readonly string[];
  plataforma: string;
  dedo: boolean;
  largura: number;
  lingua: string;
}

type Armazem = Pick<Storage, 'getItem' | 'setItem'>;
export interface Armazens {
  /** Dura entre visitas (a marca de primeira visita). */
  local: Armazem | null;
  /** Dura a aba (a origem). */
  sessao: Armazem | null;
}

const ler = (a: Armazem | null, chave: string): string | null => {
  try {
    return a?.getItem(chave) ?? null;
  } catch {
    return null;
  }
};
const gravar = (a: Armazem | null, chave: string, valor: string): void => {
  try {
    a?.setItem(chave, valor);
  } catch {
    /* navegador sem armazenamento (aba anônima, cota): a visita vale, só sem a memória entre páginas */
  }
};

/** Hoje, no calendário do aparelho (AAAA-MM-DD): só as diferenças entre datas importam. */
export function hojeLocal(agora: Date = new Date()): string {
  const dois = (n: number) => String(n).padStart(2, '0');
  return `${agora.getFullYear()}-${dois(agora.getMonth() + 1)}-${dois(agora.getDate())}`;
}

/** Lê o navegador de verdade. Cada leitura é protegida: um navegador estranho vira "outro", nunca um erro. */
export function lerAmbiente(): Ambiente {
  const nav = (typeof navigator === 'undefined' ? {} : navigator) as Navigator & { userAgentData?: { brands?: { brand: string }[]; platform?: string } };
  let dedo = false;
  try {
    dedo = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  } catch {
    /* sem matchMedia: computador */
  }
  const loc = typeof location === 'undefined' ? ({ hostname: '', search: '' } as Location) : location;
  return {
    referrer: typeof document === 'undefined' ? '' : document.referrer,
    hostProprio: loc.hostname,
    search: loc.search,
    userAgent: nav.userAgent ?? '',
    marcas: nav.userAgentData?.brands?.map((b) => b.brand) ?? [],
    plataforma: nav.userAgentData?.platform ?? '',
    dedo,
    largura: typeof innerWidth === 'number' ? innerWidth : 1280,
    lingua: nav.language ?? '',
  };
}

export function armazensDoNavegador(): Armazens {
  const pegar = (nome: 'localStorage' | 'sessionStorage'): Armazem | null => {
    try {
      return typeof window === 'undefined' ? null : window[nome];
    } catch {
      return null;
    }
  };
  return { local: pegar('localStorage'), sessao: pegar('sessionStorage') };
}

type Origem = Pick<Visita, 'canal' | 'host' | 'us' | 'um' | 'uc'>;

/** A origem guardada na aba, se estiver inteira e na lista fechada (um valor estragado não vale). */
function origemGuardada(a: Armazem | null): Origem | null {
  try {
    const x = JSON.parse(ler(a, CHAVE_ORIGEM) ?? 'null') as Record<string, unknown> | null;
    if (!x || typeof x.canal !== 'string' || !(CANAIS as readonly string[]).includes(x.canal) || x.canal === 'interno') return null;
    const o: Origem = { canal: x.canal as Canal };
    for (const k of ['host', 'us', 'um', 'uc'] as const) if (typeof x[k] === 'string') o[k] = x[k] as string;
    return o;
  } catch {
    return null;
  }
}

export class Audiencia {
  private origem: Origem | null = null;

  constructor(
    private readonly amb: Ambiente,
    private readonly arm: Armazens,
    private readonly hoje: () => string = hojeLocal,
  ) {}

  /**
   * De onde veio esta sessão. Um referrer de fora é a origem (e fica guardada na aba); um referrer do próprio site (a landing levando ao jogo) herda a origem guardada; sem nada disso,
   * é `direto`. Nunca devolve `interno`: não diz nada a quem lê o painel.
   */
  private resolver(): Origem {
    if (this.origem) return this.origem;
    const calculada = classificarOrigem(this.amb);
    if (calculada.canal !== 'interno') {
      this.origem = calculada;
      gravar(this.arm.sessao, CHAVE_ORIGEM, JSON.stringify(calculada));
    } else {
      this.origem = origemGuardada(this.arm.sessao) ?? { canal: 'direto' };
    }
    return this.origem;
  }

  canal(): Canal {
    return this.resolver().canal;
  }

  /** A visita desta página (para `landing_view` e `boot_ok`). Marca a primeira visita no aparelho, se ainda não havia. */
  visita(): Visita {
    const origem = this.resolver();
    const hoje = this.hoje();
    const marca = ler(this.arm.local, CHAVE_VISITOU);
    const ret = faixaDeRetorno(marca, hoje);
    if (!marca || !/^\d{4}-\d{2}-\d{2}$/.test(marca)) gravar(this.arm.local, CHAVE_VISITOU, hoje);
    return {
      ...origem,
      disp: tipoDeAparelho(this.amb.dedo, this.amb.largura),
      nav: familiaDoNavegador(this.amb.userAgent, this.amb.marcas),
      so: familiaDoSistema(this.amb.userAgent, this.amb.plataforma),
      lang: idiomaPrincipal(this.amb.lingua),
      ret,
    };
  }

  /** O contexto dos passos do funil (clique, partida iniciada e terminada): o canal da sessão e, na partida, se havia conta. */
  funil(conta?: ContaTipo): ContextoDoFunil {
    return { canal: this.canal(), ...(conta ? { conta } : {}) };
  }
}
