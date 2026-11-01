/**
 * A recompensa de uma partida (P304, "toda partida rende"): o XP e os Créditos que o fim de uma rodada, de uma missão, da Bandeira ou do Domínio entrega ao piloto.
 *
 * **Por quê:** até aqui o XP só vinha das três missões do dia (no máximo 600 por dia, com 1000 por nível): jogar uma rodada inteira não rendia nada, e o fim da
 * partida não tinha nada a mostrar. Agora cada partida soma, parte por parte, e o cartão do fim (`ui/CartaoDaRecompensa.ts`) mostra a conta.
 *
 * **A régua** (`XP_DA_PARTIDA`): uma rodada comum (3 abates, 1.500 de dano) rende ~160 XP, uns 6 rodadas por nível; uma rodada vencida com 8 abates e uma
 * sequência de 4, ~500. Créditos = um quarto do XP. Os tetos impedem que uma partida longa contra bots fáceis valha um dia inteiro.
 *
 * **Limite (R13):** o progresso é do navegador (e da conta, P174), escrito pelo cliente: dá para trapacear. Por isso vale só para nível e Créditos, que são
 * cosméticos e nunca dão vantagem em combate (`VISAO.md`), e nunca para ranking (G13).
 *
 * Pura: só números, sem relógio nem DOM (o teste é `recompensaDaPartida.test.ts`). Custo: uma conta por fim de partida.
 */

/** O que o piloto fez na partida (o `Game` junta do placar, dos acertos e da sequência de abates). */
export interface DesempenhoDaPartida {
  readonly abates: number;
  readonly dano: number;
  readonly maiorSequencia: number;
  /** 1 = primeiro lugar no placar; `null` = partida sem placar individual (missão, Bandeira, Domínio, online sem a lista). */
  readonly posicao: number | null;
  /** Quantos estão no placar (o pódio só vale com gente para disputar). */
  readonly jogadores: number;
  /** Venceu a partida (rodada em primeiro com abate, missão cumprida, o time azul ganhou). */
  readonly venceu: boolean;
  /** Quanto tempo jogou (a participação só vale para quem ficou). */
  readonly segundos: number;
  /** Ondas vencidas na Sobrevivência (0 fora dela). */
  readonly ondas: number;
}

export interface LinhaDaRecompensa {
  /** O texto da linha, já com o número (a tradução usa a chave com `{0}`: `CARTAO_TEXTOS`). */
  readonly rotulo: string;
  readonly xp: number;
}

export interface Recompensa {
  readonly xp: number;
  readonly creditos: number;
  readonly linhas: readonly LinhaDaRecompensa[];
}

export const XP_DA_PARTIDA = {
  participacao: 50,
  porAbate: 25,
  /** 1 XP a cada tanto de dano. */
  danoPorXp: 40,
  /** Por abate da maior sequência acima de 2 (a sequência de 3 rende 15, a de 4 rende 30…). */
  porSequencia: 15,
  vitoria: 120,
  segundoLugar: 50,
  terceiroLugar: 25,
  porOnda: 40,
} as const;

export const TETOS_DA_PARTIDA = {
  abates: 30,
  xpDeDano: 200,
  sequencia: 10,
  ondas: 20,
} as const;

/** Quem jogou menos que isto não ganha a participação (entrou e saiu). */
export const SEGUNDOS_PARA_PARTICIPAR = 45;
/** O pódio (2º e 3º) só vale com pelo menos este tanto de gente no placar. */
export const JOGADORES_PARA_PODIO = 4;
/** Créditos = XP dividido por isto. */
export const XP_POR_CREDITO = 4;

/** Os textos das linhas (as chaves de tradução, com `{0}` onde entra o número). */
export const ROTULOS = {
  participacao: 'PARTICIPAÇÃO',
  abates: 'ABATES ×{0}',
  dano: 'DANO CAUSADO {0}',
  sequencia: 'SEQUÊNCIA {0}×',
  vitoria: 'VITÓRIA',
  lugar: '{0}º LUGAR',
  ondas: 'ONDAS ×{0}',
} as const;

function inteiro(v: number, teto: number): number {
  return Number.isFinite(v) ? Math.min(teto, Math.max(0, Math.floor(v))) : 0;
}

function preencher(modelo: string, n: number): string {
  return modelo.replace('{0}', String(n));
}

/** A conta da partida: as linhas (só as que renderam) e o total de XP e de Créditos. */
export function recompensaDaPartida(d: DesempenhoDaPartida): Recompensa {
  const linhas: LinhaDaRecompensa[] = [];
  const somar = (rotulo: string, xp: number): void => {
    if (xp > 0) linhas.push({ rotulo, xp });
  };

  if (Number.isFinite(d.segundos) && d.segundos >= SEGUNDOS_PARA_PARTICIPAR) somar(ROTULOS.participacao, XP_DA_PARTIDA.participacao);

  const abates = inteiro(d.abates, TETOS_DA_PARTIDA.abates);
  somar(preencher(ROTULOS.abates, abates), abates * XP_DA_PARTIDA.porAbate);

  const dano = inteiro(d.dano, Number.MAX_SAFE_INTEGER);
  somar(preencher(ROTULOS.dano, dano), Math.min(TETOS_DA_PARTIDA.xpDeDano, Math.floor(dano / XP_DA_PARTIDA.danoPorXp)));

  const sequencia = inteiro(d.maiorSequencia, TETOS_DA_PARTIDA.sequencia);
  if (sequencia >= 3) somar(preencher(ROTULOS.sequencia, sequencia), (sequencia - 2) * XP_DA_PARTIDA.porSequencia);

  const ondas = inteiro(d.ondas, TETOS_DA_PARTIDA.ondas);
  somar(preencher(ROTULOS.ondas, ondas), ondas * XP_DA_PARTIDA.porOnda);

  if (d.venceu) somar(ROTULOS.vitoria, XP_DA_PARTIDA.vitoria);
  else if (d.posicao !== null && d.jogadores >= JOGADORES_PARA_PODIO) {
    if (d.posicao === 2) somar(preencher(ROTULOS.lugar, 2), XP_DA_PARTIDA.segundoLugar);
    else if (d.posicao === 3) somar(preencher(ROTULOS.lugar, 3), XP_DA_PARTIDA.terceiroLugar);
  }

  const xp = linhas.reduce((s, l) => s + l.xp, 0);
  return { xp, creditos: Math.floor(xp / XP_POR_CREDITO), linhas };
}

/** Rodada de todos contra todos: venceu quem terminou em primeiro com pelo menos um abate (a mesma regra do "VENCEDOR:" do placar, `RoundHud`). */
export function venceuARodada(posicao: number | null, abates: number): boolean {
  return posicao === 1 && abates > 0;
}
