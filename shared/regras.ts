/**
 * AS REGRAS DAS SALAS ONLINE (P199, `PAINEL_ADMIN.md` § 7): o que o **dono** ajusta, pelo painel do servidor, sobre os **bots** que enfrentam os jogadores nas salas online: a dificuldade, quantos Mechs
 * e andróides, e a **pressão** (quantos atacam ao mesmo tempo). Nasceu do primeiro teste online (18/10): *"achamos MUITO DIFÍCIL os bots inimigos, não conseguimos trocar direito devido à pressão
 * adversária"*. O padrão antigo da sala era o de uma partida solo: 3 Mechs e 2 andróides em dificuldade normal, **todos atacando juntos** (a sala não limitava os atacantes). O servidor guarda as regras
 * (`regras-online.json`), aplica nas salas novas e, ao vivo, nas que já estão de pé; só o dono as lê e as grava (`/admin/regras`).
 */
export type DificuldadeOnline = 'facil' | 'normal' | 'dificil';

export interface RegrasOnline {
  dificuldade: DificuldadeOnline;
  /** Quantos Mechs rebeldes a sala usa (0 a 3; a sala cheia de gente tira os últimos). */
  mechs: number;
  /** Quantos andróides rebeldes (0 a 3). Vale para as salas **novas** (a sala de pé não cria nem remove corpo). */
  androides: number;
  /** Quantos atacam ao mesmo tempo (Mech vale 1, andróide ½): o resto espera afastado. 0,5 a 4, de meio em meio. */
  atacantes: number;
}

export const DIFICULDADES_ONLINE: readonly DificuldadeOnline[] = ['facil', 'normal', 'dificil'];

export const LIMITES_DAS_REGRAS = {
  mechs: { min: 0, max: 3 },
  androides: { min: 0, max: 3 },
  atacantes: { min: 0.5, max: 4, passo: 0.5 },
} as const;

/** O que vale enquanto o dono não mexer: **de iniciante**. O primeiro teste online (18/10) mostrou que o padrão da partida solo é pesado demais para duas pessoas. */
export const REGRAS_PADRAO: Readonly<RegrasOnline> = Object.freeze({ dificuldade: 'facil', mechs: 2, androides: 1, atacantes: 1.5 });

/** Receitas prontas do painel (um clique): o iniciante, o equilíbrio da partida solo e o desafio. */
export const RECEITAS_DAS_REGRAS: Readonly<Record<'iniciante' | 'padrao' | 'desafio', RegrasOnline>> = {
  iniciante: { dificuldade: 'facil', mechs: 1, androides: 1, atacantes: 1 },
  padrao: { ...REGRAS_PADRAO },
  desafio: { dificuldade: 'normal', mechs: 3, androides: 2, atacantes: 2 },
};

/** As regras **sem limite** (o jogo antigo da sala: 3 Mechs, 2 andróides, normal, todos atacando): só a bancada e os testes as usam; o servidor de verdade parte de `REGRAS_PADRAO`. */
export const REGRAS_SEM_LIMITE: Readonly<RegrasOnline> = Object.freeze({ dificuldade: 'normal', mechs: 3, androides: 2, atacantes: 4 });

export const ADMIN_REGRAS_PATH = '/admin/regras';
export const ADMIN_REGRAS_GRAVAR_PATH = '/admin/regras/gravar';

const limitar = (v: unknown, min: number, max: number, padrao: number, passo = 1): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : padrao;
  const arredondado = Math.round(n / passo) * passo;
  return Math.max(min, Math.min(max, arredondado));
};

/** Lê as regras de fora (arquivo, corpo de requisição): o que não presta vira o padrão, o que passa do limite é puxado para ele. Nunca lança. */
export function normalizarRegras(x: unknown): RegrasOnline {
  const r = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const L = LIMITES_DAS_REGRAS;
  return {
    dificuldade: DIFICULDADES_ONLINE.includes(r.dificuldade as DificuldadeOnline) ? (r.dificuldade as DificuldadeOnline) : REGRAS_PADRAO.dificuldade,
    mechs: limitar(r.mechs, L.mechs.min, L.mechs.max, REGRAS_PADRAO.mechs),
    androides: limitar(r.androides, L.androides.min, L.androides.max, REGRAS_PADRAO.androides),
    atacantes: limitar(r.atacantes, L.atacantes.min, L.atacantes.max, REGRAS_PADRAO.atacantes, L.atacantes.passo),
  };
}

/** Resposta do servidor ao painel: as regras lidas (`null` se o formato não é um objeto). */
export function lerRegrasDaResposta(x: unknown): RegrasOnline | null {
  return x && typeof x === 'object' && 'dificuldade' in (x as object) ? normalizarRegras(x) : null;
}
