import {
  AMAZONIA_ALDEIA,
  AMAZONIA_CELULA,
  AMAZONIA_LIMITES,
  AMAZONIA_MINA,
  AMAZONIA_PLANTA,
  AMAZONIA_REJEITOS,
  FUNDURA_DO_RIO,
  larguraDoRio,
  rioEmX,
} from './AmazoniaLayout';

/**
 * O CHÃO DA AMAZÔNIA (P180, parte B): o terreno em **função pura**, lida pela malha e pelo colisor de altura (o que se vê é o que se pisa) e pelos testes (G14). O chão firme da margem
 * fica perto de y = 0 (onde todo nascimento põe os pés); **o leito do rio desce** até `FUNDURA_DO_RIO`; **a cava da mina** é uma bacia funda com degraus suaves; a planta e a aldeia são
 * pátios planos; a lagoa de rejeitos é uma bacia rasa com um dique; longe do rio o chão sobe em colinas e fecha o vale nas bordas.
 *
 * Continuidade: nenhuma peça é degrau (o Mech anda sem pular): as encostas ficam abaixo de ~30°, e os testes medem isso na grade.
 */

const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);
const suave = (t: number): number => {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
};

/** A altura do chão em (x, z), em metros. Pura e determinística. */
export function alturaDoTerreno(x: number, z: number): number {
  const d = Math.abs(z - rioEmX(x)); // a distância ao eixo do rio
  const meia = larguraDoRio(x) / 2;

  // 1. O relevo: colinas que crescem com a distância do rio, e o vale se fecha nas bordas do mapa.
  const ondulacao = Math.sin(x / 190 + 1.3) * Math.sin(z / 140 + 0.4) + 0.5 * Math.sin(x / 77 + z / 61) + 0.25 * Math.sin(x / 31 - z / 43);
  const longeDoRio = suave((d - meia - 30) / 200);
  const bordaZ = suave((Math.abs(z) - 360) / 90);
  const bordaX = suave((Math.abs(x) - 1080) / 120);
  // (a ondulação miúda some junto da margem, para o chão firme chegar exatamente em 0 na beira da água e o leito sair dela sem degrau)
  const miuda = 0.35 * Math.sin(x / 17) * Math.cos(z / 23) * (1 - longeDoRio) * suave((d - meia) / 25);
  // as colinas só SOBEM do chão firme (nunca criam bacia abaixo da água longe do rio): a ondulação (−1,75 a 1,75) vira 0 a 1
  const colinas = 12 * ((ondulacao + 1.75) / 3.5) * longeDoRio;
  // a parede do vale nas pontas sobe em 120 m a partir da margem (e não colada nela): o rio sai do mapa por uma boca suave, não por um penhasco
  let h = colinas + 13 * bordaZ + 18 * bordaX * suave((d - meia) / 120) + miuda;

  // 2. O leito do rio: do chão firme (nas margens) ao fundo no meio, em curva suave.
  if (d < meia) {
    const u = 1 - d / meia; // 0 na margem, 1 no meio
    h = Math.min(h, -FUNDURA_DO_RIO * Math.sqrt(suave(u))); // a raiz dá a margem de ladeira suave e a água quase na largura inteira
  }

  // 3. A planta (o pátio plano, com 28 m de rampa em volta) e a aldeia (o terreiro plano).
  const planta = AMAZONIA_PLANTA;
  const dxp = Math.max(0, Math.abs(x - planta.x) - planta.comprimento / 2);
  const dzp = Math.max(0, Math.abs(z - planta.z) - planta.largura / 2);
  const mascaraPlanta = 1 - suave(Math.hypot(dxp, dzp) / 28);
  h = h + (1.4 - h) * mascaraPlanta;
  const aldeia = AMAZONIA_ALDEIA;
  const mascaraAldeia = 1 - suave((Math.hypot(x - aldeia.x, z - aldeia.z) - aldeia.raio) / 40);
  h = h + (0.5 - h) * mascaraAldeia;

  // 4. A cava da mina: uma bacia funda no meio, com degraus suaves nas paredes e o monte de entulho no alto da borda.
  const mina = AMAZONIA_MINA;
  const dm = Math.hypot(x - mina.x, z - mina.z);
  if (dm < mina.raio * 1.5) {
    const u = dm / mina.raio;
    const bacia = -mina.fundura * (1 - suave(u)) + (u < 1 ? 0.9 * Math.sin(dm / 11) * suave(1 - u) * suave(u * 3) : 0);
    const entulho = 2.2 * Math.exp(-(((u - 1.08) / 0.1) ** 2));
    const dentro = 1 - suave((u - 1.0) / 0.5); // o chão em volta desce em ~60 m até a cava (a parede de fora não é barranco)
    h = h + (bacia + entulho - h) * dentro + entulho * (1 - dentro);
  }

  // 5. A lagoa de rejeitos: uma bacia rasa de borda elevada (o dique).
  const r = AMAZONIA_REJEITOS;
  const er = Math.hypot((x - r.x) / r.rx, (z - r.z) / r.rz);
  if (er < 1.7) {
    const bacia = -r.fundura * (1 - suave(er / 0.95));
    const dique = 1.6 * Math.exp(-(((er - 1.08) / 0.12) ** 2));
    const dentro = 1 - suave((er - 1.0) / 0.7); // o chão em volta se aplaina em ~43 m até a bacia (nada de barranco colado na lagoa)
    h = h + (bacia + dique - h) * dentro + dique * (1 - dentro);
  }

  return h;
}

/** A grade de alturas de uma região (a mesma para a malha e para o colisor): `alturas[ix * (celulasZ + 1) + iz]`, a ordem do Rapier. */
export interface GradeDeAlturas {
  celulasX: number;
  celulasZ: number;
  minX: number;
  minZ: number;
  celula: number;
  alturas: Float32Array;
}

export function gradeDoTerreno(minX: number, minZ: number, celulasX: number, celulasZ: number, celula = AMAZONIA_CELULA): GradeDeAlturas {
  const alturas = new Float32Array((celulasX + 1) * (celulasZ + 1));
  for (let ix = 0; ix <= celulasX; ix++) for (let iz = 0; iz <= celulasZ; iz++) alturas[ix * (celulasZ + 1) + iz] = alturaDoTerreno(minX + ix * celula, minZ + iz * celula);
  return { celulasX, celulasZ, minX, minZ, celula, alturas };
}

/** A grade do mapa inteiro. */
export function gradeDoMapa(): GradeDeAlturas {
  const celulasX = Math.round((AMAZONIA_LIMITES.maxX - AMAZONIA_LIMITES.minX) / AMAZONIA_CELULA);
  const celulasZ = Math.round((AMAZONIA_LIMITES.maxZ - AMAZONIA_LIMITES.minZ) / AMAZONIA_CELULA);
  return gradeDoTerreno(AMAZONIA_LIMITES.minX, AMAZONIA_LIMITES.minZ, celulasX, celulasZ);
}
