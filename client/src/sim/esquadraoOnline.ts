import type { MapaOnline } from '../../../shared/net/mapa';
import { ROOM_BOT_ANDROIDS, ROOM_BOT_MECHS } from '../../../shared/net/constants';
import type { RegrasOnline } from '../../../shared/regras';
import { DEFAULT_SETTINGS } from '../core/Settings';
import { ehTita, type ChassisId } from '../entities/chassis';
import { factorySpec, validateLoadout, type LoadoutSpec } from '../hangar/loadout';
import { chaveDoEsquadrao, ESQUADRAO_VERSAO, esquadraoDeFoes, sanearEsquadrao, type ArmaDoBot, type BotSpec, type EsquadraoSpec, type Limites, type PapelDoBot } from './esquadrao';

/**
 * O ESQUADRÃO DAS SALAS ONLINE (P270, ordem do Comandante em 28/10: "quando eu jogo online, queria poder configurar os times no botão ESQUADRÃO, pra mudar os mechs, nomes, etc").
 * Online quem manda nos inimigos é o servidor, e quem manda no servidor é o **dono**: ele monta o esquadrão na mesma janela do jogo offline e o servidor o guarda
 * (`server/esquadraoOnline.ts`, `esquadrao-online.json`), no molde das regras (`shared/regras.ts`) e dos outdoors. Vale para as salas **novas**: a sala de pé termina como começou
 * (os corpos nascem com a partida), e a sala vazia fecha em 30 s. Sem um esquadrão salvo valem as regras (`esquadraoDasRegras`): o jogo online de sempre.
 *
 * **O teto é o que cabe na banda por jogador** (G11, `CAPACIDADE.md`; P273): até 6 Mechs, 6 andróides e o técnico, que com os humanos dá no máximo `ROOM_UNITS` (15) unidades no estado a 20 Hz,
 * os 8 KB/s da meta. (Era 3, 3 e 1 até 29/10; o servidor e a GPU aguentam muito mais, a banda não.) Também não há **aliados** (o roster de rede não os descreve, `ArenaRoom`) nem **titãs**
 * (um corpo de 20 m e 1.900 de torso não cabe no orçamento de rede e de CPU da sala).
 *
 * Só dados e conta (sem Three.js nem DOM): roda igual no servidor, no navegador e nos testes. Nada é confiado: o que vem da rede passa por `esquadraoParaOnline`.
 */

export const ADMIN_ESQUADRAO_PATH = '/admin/esquadrao';
export const ADMIN_ESQUADRAO_GRAVAR_PATH = '/admin/esquadrao/gravar';

/** Os mapas onde o esquadrão salvo vale: a Cidade Neon e a Estação dos Cabos (o combate livre do lançamento). As outras salas seguem com as regras. */
export const MAPAS_DO_ESQUADRAO_ONLINE: readonly MapaOnline[] = ['arena', 'praia'];
export const esquadraoValeNoMapa = (mapa: MapaOnline): boolean => MAPAS_DO_ESQUADRAO_ONLINE.includes(mapa);

/** O que cabe num esquadrão online: 6 Mechs, 6 andróides e o técnico, único (`ROOM_BOT_MECHS`, `ROOM_BOT_ANDROIDS`). As regras da sala (sem esquadrão salvo) seguem em `LIMITES_DAS_REGRAS` (3 e 3). */
export const LIMITES_ONLINE: Readonly<Record<PapelDoBot, number>> = Object.freeze({
  mech: ROOM_BOT_MECHS,
  android: ROOM_BOT_ANDROIDS,
  technician: 1,
});

/** Os limites que o editor da janela usa online: o teto por papel acima, sem aliados e sem titãs. */
export function limitesOnline(): Limites {
  const total = LIMITES_ONLINE.mech + LIMITES_ONLINE.android + LIMITES_ONLINE.technician;
  return { inimigos: total, aliados: 0, tecnicos: LIMITES_ONLINE.technician, titas: 0, total, porPapel: LIMITES_ONLINE };
}

/** O formato de um esquadrão que vem de fora (o corpo do `POST`): a versão certa e a lista de inimigos. O que é lixo não vira "o padrão" em silêncio, é recusado. */
export function pareceEsquadrao(raw: unknown): raw is { v: number; inimigos: unknown[] } {
  const r = raw as { v?: unknown; inimigos?: unknown } | null;
  return typeof raw === 'object' && raw !== null && r?.v === ESQUADRAO_VERSAO && Array.isArray(r.inimigos);
}

/**
 * O esquadrão como uma sala online o aceita: cada robô limpo (`sanearEsquadrao`), **só os inimigos**, sem titã, e no máximo `LIMITES_ONLINE` de cada papel (o que passa sai do fim da lista).
 * Nunca lança; a ordem dos robôs é a que veio.
 */
export function esquadraoParaOnline(raw: unknown): EsquadraoSpec {
  const sobra: Record<PapelDoBot, number> = { ...LIMITES_ONLINE };
  const inimigos = sanearEsquadrao(raw, 'arena').inimigos.filter((b) => {
    if (b.papel === 'mech' && b.chassi && ehTita(b.chassi)) return false;
    if (sobra[b.papel] <= 0) return false;
    sobra[b.papel]--;
    return true;
  });
  return { v: ESQUADRAO_VERSAO, inimigos, aliados: [] };
}

/**
 * A chave do esquadrão com que uma sala de `mapa` nasce: o texto curto do link (`chaveDoEsquadrao`) do que vale ali, ou `''` (sem esquadrão: valem as regras). A sala a guarda e o servidor a compara
 * com a do esquadrão salvo agora: **a sala vazia que nasceu com outro esquadrão fecha na hora** (não espera os 30 s), e quem entra de novo cai numa sala com o esquadrão novo.
 */
export function chaveDoEsquadraoOnline(salvo: EsquadraoSpec | null, mapa: MapaOnline): string {
  return salvo && esquadraoValeNoMapa(mapa) ? chaveDoEsquadrao(esquadraoParaOnline(salvo)) : '';
}

/** O que a sala online monta enquanto o dono não salvou um esquadrão: os Mechs e andróides das regras, o técnico e as personalidades de fábrica (o jogo online de sempre). */
export function esquadraoDasRegras(regras: RegrasOnline): EsquadraoSpec {
  return esquadraoParaOnline(esquadraoDeFoes({ ...DEFAULT_SETTINGS, enemyMechs: regras.mechs, enemyAndroids: regras.androides }, 0));
}

/** A resposta do servidor à janela: o esquadrão que valeria numa sala nova agora, e se é um salvo pelo dono (`false` = o das regras). */
export interface RespostaDoEsquadrao {
  salvo: boolean;
  esquadrao: EsquadraoSpec;
}

/** Lê a resposta do servidor: o que não é uma resposta (`null`) deixa a janela com o aviso, e o esquadrão vem sempre limpo. */
export function lerRespostaDoEsquadrao(x: unknown): RespostaDoEsquadrao | null {
  const r = x as { salvo?: unknown; esquadrao?: unknown } | null;
  if (typeof x !== 'object' || x === null || typeof r?.salvo !== 'boolean' || !pareceEsquadrao(r.esquadrao)) return null;
  return { salvo: r.salvo, esquadrao: esquadraoParaOnline(r.esquadrao) };
}

/**
 * A montagem com que os **outros jogadores** veem um robô do esquadrão: o chassi dele e as armas que o esquadrão deu (o roster de rede já leva uma montagem por unidade, `RosterEntry.build`).
 * Sem arma pedida vale a de fábrica do chassi. Uma combinação que o Hangar recusaria (a carga do chassi, o encaixe) perde primeiro a mão esquerda e, se ainda assim não cabe, cai na de fábrica:
 * é só desenho (quem atira e fere é o servidor, com os números do chassi, e o bot não paga peso), mas uma chave que o cliente não lê não pode ir no roster.
 */
export function montagemDoBot(kit: { chassi?: ChassisId; arma?: ArmaDoBot | null; secundaria?: ArmaDoBot | null; extras?: BotSpec['extras'] | null }): LoadoutSpec {
  const fabrica = factorySpec(kit.chassi ?? 'vector09');
  const comArma: LoadoutSpec = kit.arma ? { ...fabrica, right: { id: kit.arma.id, tier: kit.arma.tier } } : fabrica;
  const comEsquerda: LoadoutSpec = kit.secundaria ? { ...comArma, left: { id: kit.secundaria.id, tier: kit.secundaria.tier } } : comArma;
  // Os encaixes extras (P288) vão primeiro ao chão se a carga não fechar: são o que mais pesa.
  const completa: LoadoutSpec = { ...comEsquerda, ...Object.fromEntries(Object.entries(kit.extras ?? {}).map(([slot, a]) => [slot, { id: a.id, tier: a.tier }])) };
  return [completa, comEsquerda, comArma].find((spec) => validateLoadout(spec).ok) ?? fabrica;
}
