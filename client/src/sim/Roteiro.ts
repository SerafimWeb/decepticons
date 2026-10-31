import type { MapId } from '../environment/Bunker';
import { MAPAS } from './campanha';
import { chaveDoEsquadrao, esquadraoPadrao, lerChaveDoEsquadrao, limparNome, nomeParaTexto, sanearEsquadrao, textoParaNome, type BotSpec, type EsquadraoSpec, type LadoDoBot } from './esquadrao';

/**
 * O roteiro do WARGAME (P262: "transformar nossa gameplay num tipo de filme ou novela", times roteirizados que o
 * Comandante grava com F9 e publica): uma lista de **batidas**, cada uma num tick da partida, que dão uma ordem de
 * alto nível a um esquadrão inteiro (a mesma `BotController.receiveOrder` que `Match.ts` já usa hoje para a
 * Resistência e o Domínio — os bots continuam andando, errando e se escondendo sozinhos; o roteiro só manda "ataque
 * aqui" ou "segure aqui", como um técnico gritando da lateral, nunca um controle remoto passo a passo), uma legenda
 * e/ou um corte de câmera. Só dados e conta: sem Three.js nem DOM, roda igual no navegador e nos testes (G14).
 *
 * - **Tick-indexado, não por gatilho/condição**: mais simples, determinístico (G1/G2) e fácil de testar e de
 *   desenhar como lista "segundo X: ordem Y". Um gatilho por condição ("esquadrão perdeu metade da força") fica de
 *   porta aberta para v2, sem mudar o formato de hoje (um campo novo opcional na batida).
 * - **v1 só tem as ordens `hold` e `follow`** (`BotController.SquadOrder`): cobrem "defenda aqui" e "avance/agrupe
 *   aqui", e cabem no "clica um ponto e pronto" do editor. `focus` precisa de um alvo específico (outro Mech), não
 *   um ponto do mapa — fica para v2.
 * - **Nada é confiado.** O que vem do armazenamento ou do link passa por `sanearRoteiro` (corta o que não vale) ou
 *   `lerChaveDoRoteiro` (recusa o texto inteiro se algo estiver errado: nada é aplicado pela metade) — mesma
 *   disciplina de `esquadrao.ts`/`campanha.ts`.
 */

export const ROTEIRO_VERSAO = 1;
/** Parâmetro do link que leva o roteiro a outro aparelho: `?wargame=w1~a~-~q1.…~t0:li:oh12,-8~t300:la:of0,0`. */
export const PARAM_DO_ROTEIRO = 'wargame';

export type TipoDeOrdem = 'hold' | 'follow';
const TIPOS_DE_ORDEM: readonly TipoDeOrdem[] = ['hold', 'follow'];

export interface OrdemDoRoteiro {
  tipo: TipoDeOrdem;
  ponto: { x: number; z: number };
}

export type CameraDoRoteiro =
  /** Uma câmera fixa do mapa, pelo índice em `camerasDoMapa(mapa)` (array estável: seguro guardar o índice). */
  | { modo: 'fixa'; indice: number }
  /** A N-ésima câmera de Mech vivo daquele lado, resolvida na hora (nunca um índice cru do `SpectatorCam`: drones
   * podem morrer no meio do episódio e deslocar os índices depois deles). */
  | { modo: 'mech'; lado: LadoDoBot; ordinal: number };

export interface BeatDoRoteiro {
  /** O tick da partida (60/s) em que a batida dispara. */
  tick: number;
  /** Quem recebe a ordem (ausente = batida só de apresentação: legenda e/ou câmera, sem ordem). */
  lado?: LadoDoBot;
  /**
   * **Qual robô** do lado recebe a ordem (P290: "não sei qual mech vai em cada ponto"): a posição dele na lista do esquadrão desse lado (a da tela ESQUADRÃO, de 0). Ausente = o lado inteiro, como sempre.
   * Só Mech e andróide recebem ordem (o técnico segue o Mech avariado); um índice que não existe no esquadrão, ou que é de técnico, sai no saneamento e a ordem volta a valer para o lado.
   */
  alvo?: number;
  ordem?: OrdemDoRoteiro;
  legenda?: { texto: string; duracaoS: number };
  camera?: CameraDoRoteiro;
}

export interface RoteiroSpec {
  v: typeof ROTEIRO_VERSAO;
  /** O nome que o Comandante deu (até `LEGENDA_MAX` letras); ausente = o título automático da tela. */
  nome?: string;
  mapa: MapId;
  /** Os dois times (o mesmo contrato do editor de esquadrão) — embutido no roteiro, não o "esquadrão atual" do
   * Comandante: um episódio salvo/compartilhado joga sempre o mesmo elenco, como `campanha.ts` já faz. */
  esquadrao: EsquadraoSpec;
  beats: BeatDoRoteiro[];
}

export const LIMITES_DO_ROTEIRO = {
  /** Batidas por roteiro: o link cabe e a lista cabe numa tela. */
  beats: 64,
  /** Tick máximo de uma batida (10 min a 60/s): além de um episódio já seria longo demais para gravar de uma vez. */
  tickMax: 36_000,
  /** Segundos de legenda na tela, por batida. */
  duracaoMin: 1,
  duracaoMax: 20,
} as const;

/** O texto de uma legenda: sem tags nem quebras, cabe em `LEGENDA_MAX` (bem mais longo que o nome de um bot — é uma frase). */
export const LEGENDA_MAX = 140;
export function limparLegenda(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.replace(/[<>&"'`\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, LEGENDA_MAX);
  return s || undefined;
}

const ehLado = (v: unknown): v is LadoDoBot => v === 'inimigo' || v === 'aliado';
const ehAlvo = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 64;
const ehTipoDeOrdem = (v: unknown): v is TipoDeOrdem => (TIPOS_DE_ORDEM as readonly string[]).includes(v as string);
const ehMapa = (v: unknown): v is MapId => typeof v === 'string' && (MAPAS as readonly string[]).includes(v);
const ehNumeroFinito = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** O ponto num quadrado de 1 km em torno da origem: generoso o bastante para qualquer mapa de hoje, recusa lixo (NaN, texto). */
function sanearPonto(v: unknown): { x: number; z: number } | null {
  if (typeof v !== 'object' || v === null) return null;
  const r = v as Record<string, unknown>;
  if (!ehNumeroFinito(r.x) || !ehNumeroFinito(r.z) || Math.abs(r.x) > 500 || Math.abs(r.z) > 500) return null;
  return { x: Math.round(r.x * 10) / 10, z: Math.round(r.z * 10) / 10 };
}

function sanearOrdem(v: unknown): OrdemDoRoteiro | undefined {
  if (typeof v !== 'object' || v === null) return undefined;
  const r = v as Record<string, unknown>;
  if (!ehTipoDeOrdem(r.tipo)) return undefined;
  const ponto = sanearPonto(r.ponto);
  return ponto ? { tipo: r.tipo, ponto } : undefined;
}

function sanearCamera(v: unknown): CameraDoRoteiro | undefined {
  if (typeof v !== 'object' || v === null) return undefined;
  const r = v as Record<string, unknown>;
  if (r.modo === 'fixa' && ehNumeroFinito(r.indice) && r.indice >= 0) return { modo: 'fixa', indice: Math.trunc(r.indice) };
  if (r.modo === 'mech' && ehLado(r.lado) && ehNumeroFinito(r.ordinal) && r.ordinal >= 0) return { modo: 'mech', lado: r.lado, ordinal: Math.trunc(r.ordinal) };
  return undefined;
}

function sanearLegendaDaBatida(v: unknown): { texto: string; duracaoS: number } | undefined {
  if (typeof v !== 'object' || v === null) return undefined;
  const r = v as Record<string, unknown>;
  const texto = limparLegenda(r.texto);
  if (!texto) return undefined;
  const duracaoS = ehNumeroFinito(r.duracaoS) ? Math.min(LIMITES_DO_ROTEIRO.duracaoMax, Math.max(LIMITES_DO_ROTEIRO.duracaoMin, r.duracaoS)) : LIMITES_DO_ROTEIRO.duracaoMin;
  return { texto, duracaoS: Math.round(duracaoS * 10) / 10 };
}

/**
 * Uma batida limpa e **canônica**, ou `null` se não tem tick válido nem nenhum dos quatro campos (uma batida vazia
 * não serve para nada). `lado` sem `ordem` some (não faz sentido); `ordem` sem `lado` também.
 */
export function sanearBatida(raw: unknown): BeatDoRoteiro | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!ehNumeroFinito(r.tick) || r.tick < 0) return null;
  const tick = Math.min(LIMITES_DO_ROTEIRO.tickMax, Math.trunc(r.tick));
  const batida: BeatDoRoteiro = { tick };
  const lado = ehLado(r.lado) ? r.lado : undefined;
  const ordem = sanearOrdem(r.ordem);
  if (lado && ordem) {
    batida.lado = lado;
    if (ehAlvo(r.alvo)) batida.alvo = r.alvo;
    batida.ordem = ordem;
  }
  const legenda = sanearLegendaDaBatida(r.legenda);
  if (legenda) batida.legenda = legenda;
  const camera = sanearCamera(r.camera);
  if (camera) batida.camera = camera;
  return batida.ordem || batida.legenda || batida.camera ? batida : null;
}

/**
 * Um roteiro válido a partir de qualquer coisa (armazenamento, link): cada batida limpa (`sanearBatida`), em ordem
 * de tick, o excesso cortado do fim (`LIMITES_DO_ROTEIRO.beats`), e o que não é roteiro, ou ficou sem batida
 * nenhuma, vira o padrão (a Arena, o esquadrão de fábrica, sem batida — dois times parados, prontos para montar).
 * Nunca lança.
 */
export function sanearRoteiro(raw: unknown): RoteiroSpec {
  if (typeof raw !== 'object' || raw === null || (raw as { v?: unknown }).v !== ROTEIRO_VERSAO) return roteiroPadrao();
  const r = raw as Record<string, unknown>;
  if (!ehMapa(r.mapa)) return roteiroPadrao();
  const mapa = r.mapa;
  const esquadrao = sanearEsquadrao(r.esquadrao, mapa);
  const beats = (Array.isArray(r.beats) ? r.beats : [])
    .flatMap((b) => {
      const limpa = sanearBatida(b);
      return limpa ? [limpa] : [];
    })
    .sort((a, b) => a.tick - b.tick)
    .slice(0, LIMITES_DO_ROTEIRO.beats);
  limparAlvos(esquadrao, beats);
  const nome = limparNome(r.nome);
  return nome ? { v: ROTEIRO_VERSAO, nome, mapa, esquadrao, beats } : { v: ROTEIRO_VERSAO, mapa, esquadrao, beats };
}

/** O alvo precisa existir neste esquadrão e poder receber ordem; senão a batida volta a valer para o lado inteiro (o esquadrão pode ter mudado depois de a batida ser escrita). Muda as batidas recebidas. */
export function limparAlvos(esquadrao: EsquadraoSpec, beats: BeatDoRoteiro[]): void {
  for (const b of beats) if (b.lado && b.alvo !== undefined && posicaoNoSistema(esquadrao[b.lado === 'inimigo' ? 'inimigos' : 'aliados'], b.alvo) === null) delete b.alvo;
}

/** O roteiro padrão: a Arena, o esquadrão de fábrica, sem nenhuma batida (dois times parados até o Comandante montar o roteiro). */
export function roteiroPadrao(): RoteiroSpec {
  return { v: ROTEIRO_VERSAO, mapa: 'arena', esquadrao: esquadraoPadrao(), beats: [] };
}

/**
 * Onde o robô nº `i` da lista de um lado fica em `BotSystem.mechs`, que guarda **os Mechs primeiro, depois os andróides e depois os técnicos**, cada grupo na ordem do esquadrão (P290: é o que leva a ordem
 * a UM robô). `null` se o robô não existe ou é um técnico (não recebe ordem: segue quem está avariado).
 */
export function posicaoNoSistema(lista: readonly BotSpec[], i: number): number | null {
  const bot = lista[i];
  if (!bot || bot.papel === 'technician') return null;
  const antes = lista.slice(0, i).filter((b) => b.papel === bot.papel).length;
  return bot.papel === 'mech' ? antes : lista.filter((b) => b.papel === 'mech').length + antes;
}

// ─── O stepper: o que dispara em cada tick ────────────────────────────────────

const VAZIO: readonly BeatDoRoteiro[] = Object.freeze([]);

/**
 * Percorre as batidas em ordem de tick, com um cursor só (sem re-varrer a lista a cada chamada): feito para ser
 * chamado uma vez por tick, com `n` sempre crescente (como `Match.step()` já faz com `tickJaneiro`). Devolve o
 * mesmo array vazio congelado (`===`) na esmagadora maioria dos ticks — G4/G5, zero alocação fora das poucas
 * batidas de verdade.
 */
export class RoteiroStepper {
  private readonly beats: readonly BeatDoRoteiro[];
  private proximo = 0;

  constructor(beats: readonly BeatDoRoteiro[]) {
    this.beats = [...beats].sort((a, b) => a.tick - b.tick);
  }

  tick(n: number): readonly BeatDoRoteiro[] {
    if (this.proximo >= this.beats.length || this.beats[this.proximo]!.tick > n) return VAZIO;
    const inicio = this.proximo;
    let i = inicio;
    while (i < this.beats.length && this.beats[i]!.tick <= n) i++;
    this.proximo = i;
    return this.beats.slice(inicio, i);
  }
}

// ─── O link: ?wargame=w1~a~-~q1.…~t0:li:oh12,-8~t300:la:of0,0 ─────────────────

const LETRA_DO_MAPA: Readonly<Record<MapId, string>> = { arena: 'a', bunker: 'b', praia: 'p', amazonia: 'z', janeiro: 'j' };
const LETRA_DO_LADO: Readonly<Record<LadoDoBot, string>> = { inimigo: 'i', aliado: 'a' };
const LETRA_DA_ORDEM: Readonly<Record<TipoDeOrdem, string>> = { hold: 'h', follow: 'f' };
const deLetra = <T extends string>(tabela: Readonly<Record<T, string>>, letra: string): T | undefined =>
  (Object.keys(tabela) as T[]).find((k) => tabela[k] === letra);

const num = (n: number): string => (Math.round(n * 10) / 10).toString();

function chaveDaBatida(b: BeatDoRoteiro): string {
  const campos = [`t${b.tick}`];
  if (b.lado && b.ordem) {
    campos.push(`l${LETRA_DO_LADO[b.lado]}`);
    if (b.alvo !== undefined) campos.push(`a${b.alvo}`);
    campos.push(`o${LETRA_DA_ORDEM[b.ordem.tipo]}${num(b.ordem.ponto.x)},${num(b.ordem.ponto.z)}`);
  }
  if (b.legenda) campos.push(`g${num(b.legenda.duracaoS)}_${nomeParaTexto(b.legenda.texto)}`);
  if (b.camera) campos.push(b.camera.modo === 'fixa' ? `kf${b.camera.indice}` : `km${LETRA_DO_LADO[b.camera.lado]}${b.camera.ordinal}`);
  return campos.join(':');
}

function lerBatida(texto: string): BeatDoRoteiro | null {
  const campos = texto.split(':');
  const tCampo = campos.find((c) => c[0] === 't');
  if (!tCampo) return null;
  const tick = Number(tCampo.slice(1));
  if (!Number.isFinite(tick) || tick < 0) return null;
  const bruto: Record<string, unknown> = { tick };
  let lado: LadoDoBot | undefined;
  for (const campo of campos) {
    const tag = campo[0] ?? '';
    const valor = campo.slice(1);
    if (tag === 't') continue;
    if (tag === 'l') {
      lado = deLetra(LETRA_DO_LADO, valor);
      if (!lado) return null;
    } else if (tag === 'a') {
      const indice = Number(valor);
      if (!/^\d+$/.test(valor) || !ehAlvo(indice)) return null;
      bruto.alvo = indice;
    } else if (tag === 'o') {
      const m = /^([hf])(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(valor);
      if (!m) return null;
      const tipo = deLetra(LETRA_DA_ORDEM, m[1]!);
      if (!tipo) return null;
      bruto.ordem = { tipo, ponto: { x: Number(m[2]), z: Number(m[3]) } };
    } else if (tag === 'g') {
      const m = /^(\d+(?:\.\d+)?)_(.*)$/.exec(valor);
      if (!m) return null;
      const texto2 = textoParaNome(m[2]!);
      if (!texto2) return null;
      bruto.legenda = { texto: texto2, duracaoS: Number(m[1]) };
    } else if (tag === 'k') {
      if (valor[0] === 'f') {
        const indice = Number(valor.slice(1));
        if (!Number.isFinite(indice) || indice < 0) return null;
        bruto.camera = { modo: 'fixa', indice };
      } else if (valor[0] === 'm') {
        const ladoDaCamera = deLetra(LETRA_DO_LADO, valor[1] ?? '');
        const ordinal = Number(valor.slice(2));
        if (!ladoDaCamera || !Number.isFinite(ordinal) || ordinal < 0) return null;
        bruto.camera = { modo: 'mech', lado: ladoDaCamera, ordinal };
      } else return null;
    } else return null;
  }
  if (lado) bruto.lado = lado;
  return sanearBatida(bruto);
}

/**
 * O roteiro em texto curto, para link e para guardar: `w1~<mapa>~<nome|->~<esquadrão>~<batida>~<batida>…`. O nome
 * vai em base64 de URL (`-` se não tem); cada batida é `t<tick>` seguido dos campos que tem: `l`+`o` (lado e ordem,
 * sempre juntos; `a`+índice quando a ordem é de UM robô, P290), `g` (legenda: segundos e texto em base64) e `k` (câmera: `f`+índice fixo, ou `m`+lado+ordinal).
 */
export function chaveDoRoteiro(spec: RoteiroSpec): string {
  const limpo = sanearRoteiro(spec);
  return ['w' + ROTEIRO_VERSAO, LETRA_DO_MAPA[limpo.mapa], limpo.nome ? nomeParaTexto(limpo.nome) : '-', chaveDoEsquadrao(limpo.esquadrao), ...limpo.beats.map(chaveDaBatida)].join('~');
}

/** O contrário de `chaveDoRoteiro`. Texto que não é um roteiro (ou passa do teto, ou tem batida torta) vira `null`: nada é aplicado pela metade. */
export function lerChaveDoRoteiro(chave: string): RoteiroSpec | null {
  const partes = chave.trim().split('~');
  if (partes.length < 4 || partes.length - 4 > LIMITES_DO_ROTEIRO.beats || partes[0] !== `w${ROTEIRO_VERSAO}`) return null;
  const mapa = (Object.keys(LETRA_DO_MAPA) as MapId[]).find((k) => LETRA_DO_MAPA[k] === partes[1]);
  if (!mapa) return null;
  let nome: string | undefined;
  if (partes[2] !== '-') {
    nome = textoParaNome(partes[2]!);
    if (!nome || limparNome(nome) !== nome) return null;
  }
  const esquadrao = lerChaveDoEsquadrao(partes[3]!);
  if (!esquadrao) return null;
  const beats: BeatDoRoteiro[] = [];
  for (const t of partes.slice(4)) {
    const b = lerBatida(t);
    if (!b) return null;
    beats.push(b);
  }
  beats.sort((a, b) => a.tick - b.tick);
  limparAlvos(esquadrao, beats);
  const spec: RoteiroSpec = nome ? { v: ROTEIRO_VERSAO, nome, mapa, esquadrao, beats } : { v: ROTEIRO_VERSAO, mapa, esquadrao, beats };
  return spec;
}

/** O roteiro do link (`?wargame=`), ou `null` se não há ou se o texto não vale. */
export function roteiroDoLink(search: string): RoteiroSpec | null {
  const chave = new URLSearchParams(search).get(PARAM_DO_ROTEIRO);
  return chave ? lerChaveDoRoteiro(chave) : null;
}
