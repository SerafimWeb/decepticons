import type { MapId } from '../environment/Bunker';
import { chaveDoEsquadrao, esquadraoPadrao, excessosDoEsquadrao, lerChaveDoEsquadrao, limparNome, nomeParaTexto, sanearEsquadrao, textoParaNome, type BotSpec, type EsquadraoSpec } from './esquadrao';
import type { GameMode } from './gameMode';
import { mapaLiberado } from '../core/Lancamento';

/**
 * A campanha (13/10, fase 4 / P27 / P54: "painel de campanhas: escolher oponentes, missões e tarefas e salvar campanhas personalizadas com nome,
 * como as montagens do Hangar"): uma lista de etapas, cada uma com **onde** (o mapa), **como** (o modo), **contra quem** (o esquadrão, o mesmo contrato do
 * editor) e **o que vence** (o fim natural do modo). É o contrato (AGENTS, regra 5: o contrato entra antes da tela) que a tela Campanha escreve e o jogo lê.
 * Só dados e conta: sem Three.js nem DOM, roda igual no navegador e nos testes.
 *
 * - **A etapa não cria regra nova.** O que vence é o que cada modo já tem: na **Sobrevivência**, limpar as ondas (perde quem cai); na **Bandeira**, vencer a
 *   partida; no **Deathmatch**, que não tem fim, a meta de abates da etapa. `resultadoDaEtapa` é a única conta.
 * - **Jogar uma etapa é abrir o jogo com o link dela** (`linkDaEtapa`): `?modo=…&mapa=…&esquadrao=…` (os parâmetros que o jogo já entende) mais
 *   `&campanha=…&etapa=N`, que só dizem ao jogo em que campanha está. Nada na partida muda de caminho (G3: módulo independente, ligado por callbacks).
 * - **Nada é confiado.** O que vem do aparelho, do link ou da rede passa por `sanearCampanha` (corta o que não vale) ou por `lerChaveDaCampanha` (recusa o
 *   texto inteiro se algo estiver errado: nada é aplicado pela metade).
 * - **A campanha padrão é a Sobrevivência de hoje** (uma etapa só), então quem nunca abriu a tela joga o que sempre jogou.
 */

export const CAMPANHA_VERSAO = 1;
/** Parâmetros do link: `?campanha=c1~…&etapa=2` (a etapa conta de 1). */
export const PARAM_DA_CAMPANHA = 'campanha';
export const PARAM_DA_ETAPA = 'etapa';

/** Os modos de cada mapa (o Bunker é só do Deathmatch; a praia abre o Deathmatch e as ondas — `mapFromSearch` manda os CTF/Domínio para a Arena; `ui/theater.ts` tem de concordar, e o teste confere). */
export const MODOS_DO_MAPA: Readonly<Record<MapId, readonly GameMode[]>> = {
  arena: ['deathmatch', 'survival', 'ctf'],
  bunker: ['deathmatch'],
  praia: ['deathmatch', 'survival'],
  amazonia: ['deathmatch', 'survival'],
  janeiro: ['deathmatch', 'survival'],
};
export const MAPAS: readonly MapId[] = ['arena', 'bunker', 'praia', 'amazonia', 'janeiro'];
export const MODOS: readonly GameMode[] = ['deathmatch', 'survival', 'ctf'];
export const MAPA_NOME: Readonly<Record<MapId, string>> = { arena: 'CIDADE NEON', bunker: 'BUNKER', praia: 'PRAIA DOS CABOS', amazonia: 'AMAZÔNIA · TERRAS RARAS', janeiro: '8 DE JANEIRO' };
export const MODO_NOME: Readonly<Record<GameMode, string>> = { deathmatch: 'DEATHMATCH', survival: 'SOBREVIVÊNCIA', ctf: 'CAPTURAR A BANDEIRA', dominio: 'DOMÍNIO' };

export const LIMITES_DA_CAMPANHA = {
  /** Etapas por campanha: o link cabe (cada etapa leva o esquadrão) e a campanha cabe numa sessão. */
  etapas: 8,
  /** A meta de abates do Deathmatch (o único modo sem fim próprio). */
  abatesMin: 3,
  abatesMax: 50,
  abatesPadrao: 10,
} as const;

export interface EtapaDaCampanha {
  mapa: MapId;
  modo: GameMode;
  /** Quem está na etapa (o mesmo contrato do editor de esquadrão; cabe nos limites do mapa). */
  esquadrao: EsquadraoSpec;
  /** Só no Deathmatch: abates do jogador que vencem a etapa. Nos outros modos o fim é o do próprio modo (ausente). */
  abates?: number;
}

export interface CampanhaSpec {
  v: typeof CAMPANHA_VERSAO;
  /** O nome que o Comandante deu (até `NAME_MAX` letras); ausente = o título automático da tela. */
  nome?: string;
  etapas: EtapaDaCampanha[];
}

const ehMapa = (v: unknown): v is MapId => typeof v === 'string' && (MAPAS as readonly string[]).includes(v);
const ehModo = (v: unknown): v is GameMode => typeof v === 'string' && (MODOS as readonly string[]).includes(v);

/** O modo roda neste mapa? */
export const modoServeAoMapa = (modo: GameMode, mapa: MapId): boolean => MODOS_DO_MAPA[mapa].includes(modo);

/** O título da etapa na tela: "CIDADE NEON · SOBREVIVÊNCIA". */
export const tituloDaEtapa = (e: Pick<EtapaDaCampanha, 'mapa' | 'modo'>): string => `${MAPA_NOME[e.mapa]} · ${MODO_NOME[e.modo]}`;

/** O que vence a etapa, numa frase para a tela e para o aviso de início. */
export function objetivoDaEtapa(e: EtapaDaCampanha): string {
  if (e.modo === 'survival') return 'Limpe todas as ondas';
  if (e.modo === 'ctf') return 'Vença a partida de bandeira';
  return `Abata ${e.abates ?? LIMITES_DA_CAMPANHA.abatesPadrao} robôs`;
}

// ─── Limpar o que vem de fora ─────────────────────────────────────────────────

/** A meta de abates dentro dos limites; o que não é número vira o padrão. */
export function sanearAbates(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : LIMITES_DA_CAMPANHA.abatesPadrao;
  return Math.min(LIMITES_DA_CAMPANHA.abatesMax, Math.max(LIMITES_DA_CAMPANHA.abatesMin, n));
}

/**
 * Uma etapa limpa e **canônica** (a mesma etapa sai sempre igual, o que estabiliza o link). `null` se o mapa ou o modo não existem, ou se o modo não roda no
 * mapa (Bunker só tem Deathmatch). O esquadrão passa por `sanearEsquadrao` com o mapa da etapa (o Bunker tem menos pontos livres).
 */
export function sanearEtapa(raw: unknown): EtapaDaCampanha | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!ehMapa(r.mapa) || !ehModo(r.modo) || !modoServeAoMapa(r.modo, r.mapa)) return null;
  const etapa: EtapaDaCampanha = { mapa: r.mapa, modo: r.modo, esquadrao: sanearEsquadrao(r.esquadrao, r.mapa) };
  if (r.modo === 'deathmatch') etapa.abates = sanearAbates(r.abates);
  return etapa;
}

/**
 * Uma campanha válida a partir de qualquer coisa (armazenamento, link, rede): cada etapa limpa (`sanearEtapa`), as que não valem descartadas, o excesso
 * cortado do fim (`LIMITES_DA_CAMPANHA.etapas`), e o que não é campanha, ou ficou sem etapa nenhuma, vira a padrão. Nunca lança.
 */
export function sanearCampanha(raw: unknown): CampanhaSpec {
  if (typeof raw !== 'object' || raw === null || (raw as { v?: unknown }).v !== CAMPANHA_VERSAO) return campanhaPadrao();
  const r = raw as Record<string, unknown>;
  const etapas = (Array.isArray(r.etapas) ? r.etapas : []).flatMap((e) => {
    const limpa = sanearEtapa(e);
    return limpa ? [limpa] : [];
  }).slice(0, LIMITES_DA_CAMPANHA.etapas);
  if (!etapas.length) return campanhaPadrao();
  const nome = limparNome(r.nome);
  return nome ? { v: CAMPANHA_VERSAO, nome, etapas } : { v: CAMPANHA_VERSAO, etapas };
}

// ─── As campanhas de fábrica ──────────────────────────────────────────────────

/** A campanha padrão: a Sobrevivência de hoje, uma etapa, o esquadrão de fábrica. */
export function campanhaPadrao(): CampanhaSpec {
  return { v: CAMPANHA_VERSAO, nome: 'SOBREVIVÊNCIA', etapas: [{ mapa: 'arena', modo: 'survival', esquadrao: esquadraoPadrao() }] };
}

const mech = (chassi?: BotSpec['chassi'], persona?: BotSpec['persona']): BotSpec => ({ papel: 'mech', ...(chassi ? { chassi } : {}), ...(persona ? { persona } : {}) });

/**
 * As campanhas que já vêm no jogo, para a tela ter o que mostrar antes de o Comandante montar a dele. A **Operação Neon** sobe de nível a cada etapa:
 * treino no Bunker contra andróides, a Cidade Neon contra Marauder e Lancer (os corpos importados, com aliados), a Bandeira, e a Sobrevivência de fechamento.
 */
export function campanhasDeFabrica(): CampanhaSpec[] {
  // O lançamento (P197): a etapa de um mapa ainda fechado (a OPERAÇÃO NEON abre no Bunker) sai da campanha, em vez de rodar noutro mapa com o título errado.
  return todasAsDeFabrica()
    .map((c) => ({ ...c, etapas: c.etapas.filter((e) => mapaLiberado(e.mapa)) }))
    .filter((c) => c.etapas.length > 0);
}

function todasAsDeFabrica(): CampanhaSpec[] {
  const treino: EsquadraoSpec = sanearEsquadrao({ v: 1, inimigos: [{ papel: 'android' }, { papel: 'android' }, { papel: 'android' }], aliados: [] }, 'bunker');
  const marauderELancer: EsquadraoSpec = sanearEsquadrao(
    { v: 1, inimigos: [mech('marauder', 'brabo'), mech('lancerL1'), { papel: 'android' }, { papel: 'android' }, { papel: 'technician' }], aliados: [mech(), mech()] },
    'arena',
  );
  return [
    campanhaPadrao(),
    {
      v: CAMPANHA_VERSAO,
      nome: 'OPERAÇÃO NEON',
      etapas: [
        { mapa: 'bunker', modo: 'deathmatch', esquadrao: treino, abates: 6 },
        { mapa: 'arena', modo: 'deathmatch', esquadrao: marauderELancer, abates: 12 },
        { mapa: 'arena', modo: 'ctf', esquadrao: esquadraoPadrao() },
        { mapa: 'arena', modo: 'survival', esquadrao: esquadraoPadrao() },
      ],
    },
  ];
}

// ─── O link: ?campanha=c1~…&etapa=2 ───────────────────────────────────────────

const LETRA_DO_MAPA: Readonly<Record<MapId, string>> = { arena: 'a', bunker: 'b', praia: 'p', amazonia: 'z', janeiro: 'j' };
const LETRA_DO_MODO: Readonly<Record<GameMode, string>> = { deathmatch: 'd', survival: 's', ctf: 'c', dominio: 'm' };

function chaveDaEtapa(e: EtapaDaCampanha): string {
  const abates = e.modo === 'deathmatch' ? String(sanearAbates(e.abates)) : '';
  return `${LETRA_DO_MAPA[e.mapa]}${LETRA_DO_MODO[e.modo]}${abates}!${chaveDoEsquadrao(e.esquadrao)}`;
}

function lerEtapa(texto: string): EtapaDaCampanha | null {
  const m = /^([abpz])([dsc])(\d{1,2})?!(q[0-9]+\.[^~!]+)$/.exec(texto);
  if (!m) return null;
  const mapa = (Object.keys(LETRA_DO_MAPA) as MapId[]).find((k) => LETRA_DO_MAPA[k] === m[1]);
  const modo = (Object.keys(LETRA_DO_MODO) as GameMode[]).find((k) => LETRA_DO_MODO[k] === m[2]);
  if (!mapa || !modo || !modoServeAoMapa(modo, mapa)) return null;
  // A meta só existe no Deathmatch, e dentro dos limites: fora deles a chave inteira é recusada (nada pela metade).
  if ((modo === 'deathmatch') !== (m[3] !== undefined)) return null;
  const abates = m[3] === undefined ? undefined : Number(m[3]);
  if (abates !== undefined && (abates < LIMITES_DA_CAMPANHA.abatesMin || abates > LIMITES_DA_CAMPANHA.abatesMax)) return null;
  const esquadrao = lerChaveDoEsquadrao(m[4]!);
  if (!esquadrao || excessosDoEsquadrao(esquadrao, mapa).length) return null;
  return abates === undefined ? { mapa, modo, esquadrao } : { mapa, modo, esquadrao, abates };
}

/**
 * A campanha em texto curto, para link e para guardar: `c1~<nome>~<etapa>~<etapa>…`. O nome vai em base64 de URL (`-` se não tem). Cada etapa é
 * `<mapa><modo><abates>!<esquadrão>`: mapa `a` Cidade Neon, `b` Bunker, `p` Praia dos Cabos ou `z` Amazônia, modo `d` Deathmatch (com a meta de abates), `s` Sobrevivência ou `c` Bandeira, e a chave
 * do esquadrão (`q1.…`): `c1~-~as!q1.…~bd6!q1.…` é uma campanha sem nome com uma Sobrevivência na Cidade Neon e um Deathmatch de 6 abates no Bunker.
 */
export function chaveDaCampanha(spec: CampanhaSpec): string {
  const limpa = sanearCampanha(spec);
  return ['c' + CAMPANHA_VERSAO, limpa.nome ? nomeParaTexto(limpa.nome) : '-', ...limpa.etapas.map(chaveDaEtapa)].join('~');
}

/** O contrário de `chaveDaCampanha`. Texto que não é uma campanha (ou passa do teto, ou tem etapa torta) vira `null`: nada é aplicado pela metade. */
export function lerChaveDaCampanha(chave: string): CampanhaSpec | null {
  const partes = chave.trim().split('~');
  if (partes.length < 3 || partes.length - 2 > LIMITES_DA_CAMPANHA.etapas || partes[0] !== `c${CAMPANHA_VERSAO}`) return null;
  let nome: string | undefined;
  if (partes[1] !== '-') {
    nome = textoParaNome(partes[1]!);
    if (!nome || limparNome(nome) !== nome) return null;
  }
  const etapas: EtapaDaCampanha[] = [];
  for (const t of partes.slice(2)) {
    const e = lerEtapa(t);
    if (!e) return null;
    etapas.push(e);
  }
  return nome ? { v: CAMPANHA_VERSAO, nome, etapas } : { v: CAMPANHA_VERSAO, etapas };
}

/** A campanha e a etapa do link (`?campanha=…&etapa=N`), ou `null` se falta algo, se o texto não vale ou se a etapa não existe. */
export function campanhaDoLink(search: string): { campanha: CampanhaSpec; etapa: number } | null {
  const q = new URLSearchParams(search);
  const chave = q.get(PARAM_DA_CAMPANHA);
  const n = Number(q.get(PARAM_DA_ETAPA));
  if (!chave || !Number.isInteger(n) || n < 1) return null;
  const campanha = lerChaveDaCampanha(chave);
  return campanha && n <= campanha.etapas.length ? { campanha, etapa: n } : null;
}

/**
 * O link que abre a etapa `n` (de 1): os parâmetros que o jogo já entende (`modo`, `mapa`, `esquadrao`) e os dois que dizem em que campanha está. Devolve só a
 * parte da busca (`?modo=…`), para quem monta o endereço (`location.pathname + link`).
 */
export function linkDaEtapa(campanha: CampanhaSpec, n: number): string {
  const limpa = sanearCampanha(campanha);
  const etapa = limpa.etapas[n - 1];
  if (!etapa) return '';
  const q = new URLSearchParams();
  q.set('modo', etapa.modo);
  if (etapa.mapa !== 'arena') q.set('mapa', etapa.mapa); // a Cidade Neon é o padrão do link; os outros mapas dizem o nome
  q.set('esquadrao', chaveDoEsquadrao(etapa.esquadrao));
  q.set(PARAM_DA_CAMPANHA, chaveDaCampanha(limpa));
  q.set(PARAM_DA_ETAPA, String(n));
  return `?${q.toString()}`;
}

/** A etapa que vem depois (de 1), ou `null` se esta é a última: a campanha acabou. */
export const proximaEtapa = (campanha: CampanhaSpec, n: number): number | null => (n < campanha.etapas.length ? n + 1 : null);

/** É a campanha de fábrica padrão (nada a guardar)? */
export const ehACampanhaPadrao = (spec: CampanhaSpec): boolean => chaveDaCampanha(spec) === chaveDaCampanha(campanhaPadrao());

// ─── Quem venceu ──────────────────────────────────────────────────────────────

/** O que o jogo viu até agora na etapa: quem alimenta é o `Game`, pelos avisos que a simulação já dá. */
export interface FatosDaEtapa {
  /** Robôs que o jogador abateu nesta etapa. */
  abates: number;
  /** O fim da Sobrevivência (`SurvivalWaves`), ou `null` enquanto as ondas seguem. */
  sobrevivencia: 'completed' | 'failed' | null;
  /** O fim da partida de bandeira, do lado do jogador, ou `null` enquanto ela segue. */
  ctf: 'vitoria' | 'derrota' | 'empate' | null;
}

export type ResultadoDaEtapa = 'em-curso' | 'vencida' | 'perdida';

export const FATOS_ZERADOS: Readonly<FatosDaEtapa> = Object.freeze({ abates: 0, sobrevivencia: null, ctf: null });

/** A única conta de quem venceu: o fim natural de cada modo, e no Deathmatch a meta de abates (que nunca se perde: o jogador renasce). */
export function resultadoDaEtapa(etapa: EtapaDaCampanha, fatos: Readonly<FatosDaEtapa>): ResultadoDaEtapa {
  if (etapa.modo === 'survival') return fatos.sobrevivencia === 'completed' ? 'vencida' : fatos.sobrevivencia === 'failed' ? 'perdida' : 'em-curso';
  if (etapa.modo === 'ctf') return fatos.ctf === 'vitoria' ? 'vencida' : fatos.ctf === 'derrota' || fatos.ctf === 'empate' ? 'perdida' : 'em-curso';
  return fatos.abates >= (etapa.abates ?? LIMITES_DA_CAMPANHA.abatesPadrao) ? 'vencida' : 'em-curso';
}
