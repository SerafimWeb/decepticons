import { CHASSIS } from '../entities/chassis';
import type { EnemyNames, Persona } from '../core/Settings';
import type { MapId } from '../environment/Bunker';
import { type EsquadraoSpec, type LadoDoBot, type PapelDoBot, planejarEsquadrao } from '../sim/esquadrao';
import { posicaoNoSistema, type BeatDoRoteiro } from '../sim/Roteiro';
import { descreverBot, indicesNoPapel, rotuloDoPapel } from './esquadraoEditor';
import type { RadarQuadro } from './TacticalRadar';

/**
 * O ELENCO do WARGAME (P290, ordem do Comandante em 30/10: "o menu do wargame tá muito cru, não sei qual mech vai em cada ponto"): quem é cada robô do episódio, onde nasce e o número que o Comandante vê no
 * mapa, na lista de quem é quem e nas batidas. Só dados e conta (sem DOM): a janela (`WargamePanel`) desenha, e o mapa (`RoteiroMapa`) recebe o que `desenhoDoMapa` monta.
 *
 * **O número é a posição na lista do esquadrão do lado** (a da tela ESQUADRÃO), de 1: é o mesmo número que a batida guarda como `alvo` (de 0), então "INIMIGO 2" no mapa, na lista e na batida é sempre o
 * mesmo robô.
 */

export interface RoboDoElenco {
  lado: LadoDoBot;
  /** A posição na lista do lado, de 0: o `alvo` de uma batida. */
  indice: number;
  /** O número de quem vê, de 1 (`indice + 1`). */
  numero: number;
  papel: PapelDoBot;
  /** O nome que aparece na partida (com a personalidade, como a etiqueta do robô). */
  nome: string;
  /** O corpo em letras de ficha: "ONÇA-B2", "ANDRÓIDE", "TÉCNICO". */
  corpo: string;
  /** Onde nasce. */
  ponto: { x: number; z: number };
  /** Recebe ordem de posição? O técnico não: segue quem está avariado. */
  ordenavel: boolean;
  persona: Persona;
}

const GRUPO_DO_PAPEL = { mech: 'mechs', android: 'androids', technician: 'tecnicos' } as const;

/** Os robôs dos dois lados, inimigos primeiro, cada um na ordem da lista do esquadrão. Lança se o esquadrão não cabe no mapa (o roteiro já vem saneado). */
export function elencoDoRoteiro(esquadrao: EsquadraoSpec, mapa: MapId, nomes: EnemyNames): RoboDoElenco[] {
  const plano = planejarEsquadrao(esquadrao, mapa, nomes);
  const out: RoboDoElenco[] = [];
  for (const lado of ['inimigo', 'aliado'] as const) {
    const lista = esquadrao[lado === 'inimigo' ? 'inimigos' : 'aliados'];
    const planoDoLado = plano[lado === 'inimigo' ? 'inimigos' : 'aliados'];
    const noPapel = indicesNoPapel(lista);
    lista.forEach((bot, i) => {
      const slot = planoDoLado[GRUPO_DO_PAPEL[bot.papel]][noPapel[i]!]!;
      out.push({
        lado,
        indice: i,
        numero: i + 1,
        papel: bot.papel,
        nome: descreverBot(bot, lado, noPapel[i]!, nomes).nome,
        corpo: bot.papel === 'mech' ? CHASSIS[slot.chassi].name : rotuloDoPapel(bot.papel),
        ponto: { x: slot.ponto[0], z: slot.ponto[1] },
        ordenavel: posicaoNoSistema(lista, i) !== null,
        persona: slot.persona,
      });
    });
  }
  return out;
}

/** O robô de uma batida (`lado` + `alvo`), ou `undefined` se a batida é do lado inteiro. */
export const roboDaBatida = (elenco: readonly RoboDoElenco[], b: Pick<BeatDoRoteiro, 'lado' | 'alvo'>): RoboDoElenco | undefined =>
  b.lado && b.alvo !== undefined ? elenco.find((r) => r.lado === b.lado && r.indice === b.alvo) : undefined;

/** Quem recebe a ordem de uma batida, em palavras: "todos os inimigos (4)" ou "INIMIGO 2 · CLAWD·BRABO · ONÇA-B2". */
export function quemDaBatida(elenco: readonly RoboDoElenco[], b: Pick<BeatDoRoteiro, 'lado' | 'alvo'>): string {
  if (!b.lado) return '—';
  const robo = roboDaBatida(elenco, b);
  if (robo) return `${rotuloDoLado(robo.lado)} ${robo.numero} · ${robo.nome} · ${robo.corpo}`;
  const n = elenco.filter((r) => r.lado === b.lado && r.ordenavel).length;
  return `todos os ${b.lado === 'inimigo' ? 'inimigos' : 'aliados'} (${n})`;
}

export const rotuloDoLado = (lado: LadoDoBot): string => (lado === 'inimigo' ? 'INIMIGO' : 'ALIADO');

/** Os robôs que recebem a ordem de uma batida: o alvo, ou todos os que podem receber, do lado. Vazio sem ordem. */
export function afetadosPelaBatida(elenco: readonly RoboDoElenco[], b: Pick<BeatDoRoteiro, 'lado' | 'alvo' | 'ordem'>): RoboDoElenco[] {
  if (!b.lado || !b.ordem) return [];
  const um = roboDaBatida(elenco, b);
  if (um) return um.ordenavel ? [um] : [];
  return elenco.filter((r) => r.lado === b.lado && r.ordenavel);
}

/** O raio (m) em que um ponto "fica perto" de um marco com nome do mapa. */
export const PERTO_DO_MARCO_M = 45;

/** Onde fica um ponto, em palavras: "perto de VORCARIS (78, -51)" ou só as coordenadas, longe de qualquer marco. */
export function descreverPonto(p: { x: number; z: number }, marcos: readonly { x: number; z: number; texto: string }[] | undefined): string {
  const coords = `(${Math.round(p.x)}, ${Math.round(p.z)})`;
  let melhor: { texto: string; d: number } | null = null;
  for (const m of marcos ?? []) {
    const d = Math.hypot(m.x - p.x, m.z - p.z);
    if (d <= PERTO_DO_MARCO_M && (!melhor || d < melhor.d)) melhor = { texto: m.texto, d };
  }
  return melhor ? `perto de ${melhor.texto} ${coords}` : coords;
}

const COR_DO_LADO: Readonly<Record<LadoDoBot, string>> = { inimigo: '#ff4d5e', aliado: '#00e5ff' };
const COR_SEM_LADO = '#ffb000';

/**
 * O que o mapa do WARGAME desenha por cima da planta (P290): cada robô no ponto onde nasce, com o número dele; cada batida com ordem como um anel numerado no ponto da ordem; e, da batida em foco, uma seta de
 * cada robô que a recebe até o ponto. O mapa já sabe pintar `aliados`, `inimigos`, `rotulos`, `marcas` e `setas` (`TacticalRadar`).
 */
export function desenhoDoMapa(
  elenco: readonly RoboDoElenco[],
  beats: readonly BeatDoRoteiro[],
  emFoco: number | null,
): Pick<RadarQuadro, 'aliados' | 'inimigos' | 'marcas' | 'setas'> & { rotulos: { x: number; z: number; texto: string; cor: string }[] } {
  const aliados = elenco.filter((r) => r.lado === 'aliado').map((r) => ({ x: r.ponto.x, z: r.ponto.z }));
  const inimigos = elenco.filter((r) => r.lado === 'inimigo').map((r) => ({ x: r.ponto.x, z: r.ponto.z, grande: r.papel === 'mech' }));
  const rotulos = elenco.map((r) => ({ x: r.ponto.x, z: r.ponto.z, texto: String(r.numero), cor: COR_DO_LADO[r.lado] }));
  const marcas = beats.flatMap((b, i) => (b.ordem ? [{ x: b.ordem.ponto.x, z: b.ordem.ponto.z, texto: String(i), cor: b.lado ? COR_DO_LADO[b.lado] : COR_SEM_LADO, destaque: i === emFoco }] : []));
  const foco = emFoco === null ? undefined : beats[emFoco];
  const setas = foco?.ordem && foco.lado ? afetadosPelaBatida(elenco, foco).map((r) => ({ de: { x: r.ponto.x, z: r.ponto.z }, para: { x: foco.ordem!.ponto.x, z: foco.ordem!.ponto.z }, cor: COR_DO_LADO[foco.lado!] })) : [];
  return { aliados, inimigos, rotulos, marcas, setas };
}
