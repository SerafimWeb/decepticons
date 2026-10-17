import { MOBILIDADE_RASTEJANDO } from '../entities/MechBase';
import { PONTOS_DOS_CABOS, CODIGO_DO_ESTADO } from './CabosDeDados';

/**
 * AS FASES DO CHEFE (ordens P147 e P165, **Capítulo 1, parte D**: a Colossus, `CAMPANHAS_E_CHEFES.md` §§ 0 e 2): *"o titã anda para os nós do cabo; CORTE derruba as pernas (para o andar),
 * LINHA o segura longe do núcleo, BASE repara o nó que ele atinge. Pernas caídas = ele rasteja e atira: vira outra luta"*. Um chefe bom é um problema de organização, não uma esponja de vida:
 *
 *  - **ANDA** (as duas pernas de pé): o titã vai ao **cabo mais perto que ainda não foi cortado** e o **depreda** (peso 4: corta em ~17 s, e cada cabo cortado drena a rede). Quem derruba as pernas
 *    o para.
 *  - **MANCA** (uma perna caiu): metade da velocidade. A regra do jogo já era essa (\`MechBase.mobility\`: uma perna destruída tira 50%).
 *  - **RASTEJA** (as duas caíram): num Mech comum isso é uma torre imóvel; o titã **rasteja** (30% da velocidade) e continua atirando e depredando: é outra luta, de perto e sem pressa,
 *    mas ainda indo ao cabo.
 *  - **CAIU** (o torso zerou): a missão acaba.
 *
 * Regra **pura** (G1/G2, G14): só números; a vida das pernas e do torso vem do dano por parte que o jogo já tem (\`combat/damage.ts\`), então as fases **não criam um sistema de dano novo**.
 * O que é do chefe e nada mais: a velocidade de rastejo (\`MechBase.crawls\`) e a escolha do alvo (\`alvoDoChefe\`).
 */

export type FaseDoChefe = 'anda' | 'manca' | 'rasteja' | 'caido';
/** As fases em número, para o HUD (0 caiu, 1 anda, 2 manca, 3 rasteja). */
export const CODIGO_DA_FASE: Readonly<Record<FaseDoChefe, number>> = { caido: 0, anda: 1, manca: 2, rasteja: 3 };

/** O que a fase pede da leitura: o rótulo da barra do chefe e a regra dita numa linha (o jogador entende o problema sem ler manual). */
export const TEXTOS_DA_FASE: Readonly<Record<FaseDoChefe, { rotulo: string; regra: string }>> = {
  anda: { rotulo: 'ANDA', regra: 'Ele vai cortar os cabos. Derrube as pernas.' },
  manca: { rotulo: 'MANCA', regra: 'Uma perna caiu: ele manca. Derrube a outra.' },
  rasteja: { rotulo: 'RASTEJA', regra: 'Rasteja e atira. Acabe com ele antes que o último cabo caia.' },
  caido: { rotulo: 'CAIU', regra: '' },
};

/** A velocidade do titã rastejando, em fração da dele: 30% (de 5 m/s, 1,5 m/s). */
export const VELOCIDADE_DO_RASTEJO = MOBILIDADE_RASTEJANDO;

export interface ModulosDoChefe {
  torso: number;
  leftLeg: number;
  rightLeg: number;
}

/** A fase do chefe a partir da vida de cada módulo (> 0 = de pé). */
export function faseDoChefe(m: ModulosDoChefe): FaseDoChefe {
  if (m.torso <= 0) return 'caido';
  const pernas = (m.leftLeg > 0 ? 1 : 0) + (m.rightLeg > 0 ? 1 : 0);
  return pernas === 2 ? 'anda' : pernas === 1 ? 'manca' : 'rasteja';
}

/**
 * O cabo para onde o titã vai: o **mais perto** (de (x, z)) que **ainda não foi cortado** (\`estados\` são os códigos de \`CabosDeDados\`: 3 = cortado), ou \`-1\` se os três foram cortados
 * (aí ele vai para a porta principal do prédio). Num empate vale o de menor índice. Sem alocar.
 */
export function alvoDoChefe(x: number, z: number, estados: ArrayLike<number>): number {
  let melhor = -1;
  let melhorD2 = Infinity;
  for (let i = 0; i < PONTOS_DOS_CABOS.length; i++) {
    if ((estados[i] ?? 0) === CODIGO_DO_ESTADO.cortado) continue;
    const p = PONTOS_DOS_CABOS[i]!;
    const d2 = (x - p.x) * (x - p.x) + (z - p.z) * (z - p.z);
    if (d2 < melhorD2) {
      melhorD2 = d2;
      melhor = i;
    }
  }
  return melhor;
}

/**
 * O aviso do topo da tela quando a fase do chefe muda (códigos de \`CODIGO_DA_FASE\`): a perna que cai, o rastejo, a queda. \`null\` se nada mudou ou se foi só a entrada do chefe (de 0 a 1).
 */
export function avisoDoChefe(antes: number, depois: number): string | null {
  if (antes === depois) return null;
  if (depois === 0 && antes > 0) return 'COLOSSUS-01 CAIU';
  if (depois === 3) return 'COLOSSUS-01 RASTEJA · ACABE COM ELE';
  if (depois === 2) return 'COLOSSUS-01 · UMA PERNA CAIU · ELE MANCA';
  return null;
}
