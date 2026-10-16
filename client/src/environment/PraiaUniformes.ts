import * as THREE from 'three';
import { COR_DA_NEVOA, DIRECAO_DA_LUA, DIRECAO_DO_SOL } from './PraiaCeu';

/**
 * Os uniformes que a praia inteira divide (P127): o tempo, o detalhe (qualidade), a vida do núcleo da estação e a textura das sombras
 * assadas. Um objeto só, criado pelo `Praia` e entregue aos módulos que montam as malhas — todos leem o MESMO `{ value }`, então mudar
 * um número aqui muda o mar, o céu, as palmas, os materiais e o feixe de uma vez, sem varrer a cena (G4).
 *
 * O **ciclo do dia** (P161) mora aqui também: a direção do sol e da lua, a cor da névoa, a noite e as lâmpadas acesas. São objetos **do `Praia`** (não as
 * constantes do módulo do céu, que ficam como o desenho do começo e como a direção que as sombras assadas usam): o ciclo muda estes, em cima, por quadro.
 */
export interface UniformesDaPraia {
  /** Segundos corridos: o mar, as nuvens, as palmas, as velas, as gaivotas, os pedestres e as pipas leem dele. */
  tempo: { value: number };
  /** 1 = todo o detalhe (nuvens, ruído do mar); 0 = qualidade baixa (G12). */
  detalhe: { value: number };
  /** A vida do núcleo da estação (1 = inteira): as janelas do centro de dados e a fita do muro reagem. */
  nucleo: { value: number };
  /** A sombra do sol assada no chão (R) e a oclusão de ambiente (G), em coordenadas do mundo. */
  sombra: { value: THREE.Texture | null };
  /** `(minX, minZ, 1 / tamX, 1 / tamZ)` da textura de sombras: leva (x, z) do mundo ao UV. */
  sombraArea: { value: THREE.Vector4 };
  /** Para onde está o disco do sol (unitário): sobe e desce no ciclo do dia. */
  solDir: { value: THREE.Vector3 };
  /** Para onde está a lua (unitário): sobe devagar. */
  luaDir: { value: THREE.Vector3 };
  /** A cor da névoa e do horizonte (a mesma da `scene.fog`): do rosa do pôr do sol ao azul-noite. */
  nevoa: { value: THREE.Color };
  /** 0 = pôr do sol; 1 = noite fechada. */
  noite: { value: number };
  /** Quanto da iluminação pública está acesa (0 a 1); cada lâmpada liga no seu instante. */
  lampadas: { value: number };
  /** A injeção de cada um dos três cabos de dados (0 a 1) e a vida (0 a 1), para o brilho do cabo (P162): o dado que corre vira vermelho. */
  cabosInj: { value: THREE.Vector3 };
  cabosVida: { value: THREE.Vector3 };
}

export function criarUniformes(): UniformesDaPraia {
  return {
    tempo: { value: 0 },
    detalhe: { value: 1 },
    nucleo: { value: 1 },
    sombra: { value: null },
    sombraArea: { value: new THREE.Vector4(0, 0, 1, 1) },
    solDir: { value: DIRECAO_DO_SOL.clone() },
    luaDir: { value: DIRECAO_DA_LUA.clone() },
    nevoa: { value: new THREE.Color(COR_DA_NEVOA) },
    noite: { value: 0 },
    lampadas: { value: 0 },
    cabosInj: { value: new THREE.Vector3(0, 0, 0) },
    cabosVida: { value: new THREE.Vector3(1, 1, 1) },
  };
}
