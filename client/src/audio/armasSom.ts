/**
 * Os sons de arma de referência (P146): qual amostra toca em qual arma, e com que ganho, altura e duração máxima. Os arquivos saem de `scripts/sons-armas.json`
 * (`npm run sons`: apara e normaliza as referências do Comandante) e moram em `client/public/audio/armas/`. Só da tela (G1/G2).
 *
 * Arma que não está aqui (rotatória, canhão automático, arco, gelo, sônico, lança-chamas...) segue com o som sintetizado de sempre; **amostra ainda não carregada
 * também cai no sintetizado** (o `AudioSystem.playArma` devolve `false`), então o jogo nunca fica mudo por causa deste arquivo.
 */
export interface AmostraDeArma {
  /** O nome do arquivo em `audio/armas/` (sem a extensão). */
  nome: string;
  /** O ganho (0 a ~1,2) em cima do volume mestre. */
  ganho: number;
  /** A altura: 1 = a do arquivo; menos que 1 fica mais grave e mais longo (o canhão de cerco). */
  pitch: number;
  /** A duração máxima em segundos, com fade no fim: o rabo do arquivo não cobre o próximo tiro. */
  maxS: number;
}

export const AMOSTRAS_DAS_ARMAS: Readonly<Record<string, AmostraDeArma>> = {
  blaster: { nome: 'arma_blaster', ganho: 0.8, pitch: 1, maxS: 0.55 },
  plasma: { nome: 'arma_plasma', ganho: 0.8, pitch: 1, maxS: 0.4 },
  cannon: { nome: 'arma_canhao', ganho: 0.9, pitch: 1, maxS: 1.8 },
  // O canhão de cerco (360 de dano, 4,5 s entre tiros): o mesmo estouro, mais grave e mais longo.
  siege: { nome: 'arma_canhao', ganho: 1, pitch: 0.78, maxS: 2.5 },
  rockets: { nome: 'arma_foguete', ganho: 0.75, pitch: 1, maxS: 0.8 },
  seeker: { nome: 'arma_teleguiado', ganho: 0.8, pitch: 1, maxS: 1.3 },
  barrage: { nome: 'arma_chuva', ganho: 0.85, pitch: 1, maxS: 1.3 },
};

/** Os arquivos a carregar na abertura (sem repetir: o cerco e o canhão dividem um). */
export const ARQUIVOS_DAS_ARMAS: readonly string[] = [...new Set(Object.values(AMOSTRAS_DAS_ARMAS).map((a) => a.nome))];
