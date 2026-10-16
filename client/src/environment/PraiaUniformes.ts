import * as THREE from 'three';

/**
 * Os uniformes que a praia inteira divide (P127): o tempo, o detalhe (qualidade), a vida do núcleo da estação e a textura das sombras
 * assadas. Um objeto só, criado pelo `Praia` e entregue aos módulos que montam as malhas — todos leem o MESMO `{ value }`, então mudar
 * um número aqui muda o mar, o céu, as palmas, os materiais e o feixe de uma vez, sem varrer a cena (G4).
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
}

export function criarUniformes(): UniformesDaPraia {
  return {
    tempo: { value: 0 },
    detalhe: { value: 1 },
    nucleo: { value: 1 },
    sombra: { value: null },
    sombraArea: { value: new THREE.Vector4(0, 0, 1, 1) },
  };
}
