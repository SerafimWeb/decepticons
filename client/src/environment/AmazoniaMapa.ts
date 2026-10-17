import { Amazonia } from './Amazonia';
import { aderecosDaAmazonia } from './AmazoniaAderecos';
import { AMAZONIA_ALDEIA, AMAZONIA_LIMITES, AMAZONIA_MINA, AMAZONIA_PLANTA, AMAZONIA_REJEITOS } from './AmazoniaLayout';
import type { CaixaDaPlanta, MapaCarregado } from './mapasSobDemanda';

/**
 * A Amazônia como mapa **sob demanda** (P180, parte B): a ponte entre o `Amazonia` (o cenário) e o registro de `mapasSobDemanda.ts`. É este módulo que o `import()` baixa, e com ele o terreno, a
 * floresta e os shaders; o pacote de partida só vê o registro.
 */

/** As estruturas sólidas da Amazônia vistas de cima (a planta do radar e do minimapa): as caixas, e os cilindros como quadrados do tamanho deles. */
export function caixasDaAmazonia(): CaixaDaPlanta[] {
  const lista: CaixaDaPlanta[] = [];
  for (const a of aderecosDaAmazonia()) {
    if (!a.solido) continue;
    const mx = a.forma === 'caixa' ? Math.abs(a.w * Math.cos(a.giro)) / 2 + Math.abs(a.d * Math.sin(a.giro)) / 2 : a.w;
    const mz = a.forma === 'caixa' ? Math.abs(a.w * Math.sin(a.giro)) / 2 + Math.abs(a.d * Math.cos(a.giro)) / 2 : a.d;
    lista.push({ x0: a.x - mx, z0: a.z - mz, x1: a.x + mx, z1: a.z + mz });
  }
  return lista;
}

export const mapaDaAmazonia: MapaCarregado = {
  construir: (scene, physics) => new Amazonia(scene, physics),
  caixasDaPlanta: caixasDaAmazonia,
  rotulos: [
    { x: AMAZONIA_ALDEIA.x, z: AMAZONIA_ALDEIA.z + 55, texto: 'ALDEIA', cor: 'rgba(57, 255, 106, 0.95)' },
    { x: AMAZONIA_PLANTA.x, z: AMAZONIA_PLANTA.z + 70, texto: 'PLANTA', cor: 'rgba(255, 138, 31, 0.9)' },
    { x: AMAZONIA_MINA.x, z: AMAZONIA_MINA.z + 140, texto: 'MINA', cor: 'rgba(255, 138, 31, 0.9)' },
    { x: AMAZONIA_REJEITOS.x, z: AMAZONIA_REJEITOS.z + 85, texto: 'REJEITOS', cor: 'rgba(255, 45, 61, 0.9)' },
  ],
  meia: { x: AMAZONIA_LIMITES.maxX, z: AMAZONIA_LIMITES.maxZ },
};
