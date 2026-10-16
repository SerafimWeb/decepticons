import tabela from './armasSom.json';

/**
 * Os sons de arma de referência (P146): qual amostra toca em qual arma, e com que ganho, altura e duração máxima. **Os dados moram em `armasSom.json`**, que o
 * Estúdio de Sons (`npm run estudio`) edita; os cortes dos arquivos moram em `scripts/sons-armas.json` (`npm run sons` apara e normaliza as referências do Comandante)
 * e os `.mp3` em `client/public/audio/armas/`. Só da tela (G1/G2).
 *
 * Arma que não está na tabela (rotatória, canhão automático, arco, gelo, sônico, lança-chamas...) segue com o som sintetizado de sempre; **amostra ainda não carregada
 * também cai no sintetizado** (o `AudioSystem.playArma` devolve `false`), então o jogo nunca fica mudo por causa destes arquivos.
 */
export interface AmostraDeArma {
  /** O nome do arquivo em `audio/armas/` (sem a extensão). */
  nome: string;
  /** O ganho (0 a 1,5) em cima do volume mestre. */
  ganho: number;
  /** A altura: 1 = a do arquivo; menos que 1 fica mais grave e mais longo (o canhão de cerco). */
  pitch: number;
  /** A duração máxima em segundos, com fade no fim: o rabo do arquivo não cobre o próximo tiro. */
  maxS: number;
}

export const AMOSTRAS_DAS_ARMAS: Readonly<Record<string, AmostraDeArma>> = Object.fromEntries(
  Object.entries(tabela.armas as Record<string, { clipe: string; ganho: number; pitch: number; maxS: number }>).map(([id, a]) => [
    id,
    { nome: a.clipe, ganho: a.ganho, pitch: a.pitch, maxS: a.maxS },
  ]),
);

/** Os arquivos a carregar na abertura (sem repetir: o cerco e o canhão dividem um). */
export const ARQUIVOS_DAS_ARMAS: readonly string[] = [...new Set(Object.values(AMOSTRAS_DAS_ARMAS).map((a) => a.nome))];
