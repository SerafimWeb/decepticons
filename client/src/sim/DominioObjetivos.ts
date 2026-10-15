import type { DominioLado } from './Dominio';

/** O que a atribuição lê de um ponto (estrutural: o estado vivo do `Dominio`, ou um objeto simples nos testes). */
export interface PontoLido {
  readonly def: { readonly x: number; readonly z: number };
  readonly dono: DominioLado | null;
}

/** O que ela lê de um soldado (um Mech de IA; nos testes, um objeto simples). */
export interface SoldadoLido {
  readonly alive: boolean;
  readonly simPosition: { readonly x: number; readonly z: number };
}

/** Cada soldado a mais num ponto "custa" tanto de caminho: é o que espalha o esquadrão em vez de mandar todos ao mais perto. */
export const CUSTO_POR_COMPANHEIRO_M = 60;
/** Ponto que não é meu (neutro ou do inimigo) atrai: vale tanto de caminho a menos. */
export const BONUS_DE_ATAQUE_M = 25;
/** Ponto meu, sem ninguém indo defender: vale tanto a menos (deixa um soldado de guarda). */
export const BONUS_DE_GUARDA_M = 40;
/** Ponto meu que já tem guarda: custa tanto a mais (o resto do esquadrão vai tomar outro). */
export const CUSTO_DE_EXCESSO_M = 60;
/** O soldado só troca de ponto se o novo for melhor que o atual por pelo menos isto (evita ir e voltar). */
export const HISTERESE_M = 18;

/**
 * Para qual ponto cada soldado de um lado vai (os bots do Domínio: capturar e defender, em vez de patrulhar). Uma passada gulosa e
 * determinística, na ordem dos soldados: cada um escolhe o ponto de menor custo, e o custo cresce com quem já foi mandado para lá.
 *
 *  - custo = distância até o ponto + `CUSTO_POR_COMPANHEIRO_M` por soldado já mandado para ele;
 *  - ponto que não é meu atrai (`BONUS_DE_ATAQUE_M`); ponto meu sem guarda também (`BONUS_DE_GUARDA_M`), mas o segundo soldado num ponto
 *    meu paga `CUSTO_DE_EXCESSO_M`: um fica, os outros avançam;
 *  - quem já tinha um ponto só o troca por um melhor por `HISTERESE_M` ou mais.
 *
 * Escreve em `saida[i]` (índice do ponto, ou -1 se o soldado está morto) e usa `carga` como rascunho (um por ponto): nada é alocado.
 * Custo: `soldados × pontos` contas por chamada, e o `Match` chama a cada ~2 s (G4).
 */
export function atribuirPontos(
  pontos: readonly PontoLido[],
  lado: DominioLado,
  soldados: readonly SoldadoLido[],
  atual: readonly number[],
  saida: number[],
  carga: number[],
): void {
  carga.fill(0, 0, pontos.length);
  const custo = (s: SoldadoLido, p: number): number => {
    const ponto = pontos[p]!;
    const dx = s.simPosition.x - ponto.def.x;
    const dz = s.simPosition.z - ponto.def.z;
    let c = Math.hypot(dx, dz) + carga[p]! * CUSTO_POR_COMPANHEIRO_M;
    if (ponto.dono === lado) c += carga[p]! >= 1 ? CUSTO_DE_EXCESSO_M : -BONUS_DE_GUARDA_M;
    else c -= BONUS_DE_ATAQUE_M;
    return c;
  };
  for (let i = 0; i < soldados.length; i++) {
    const s = soldados[i]!;
    if (!s.alive) {
      saida[i] = -1;
      continue;
    }
    let melhor = 0;
    let menor = Infinity;
    for (let p = 0; p < pontos.length; p++) {
      const c = custo(s, p);
      if (c < menor) {
        menor = c;
        melhor = p;
      }
    }
    const antes = atual[i] ?? -1;
    if (antes >= 0 && antes < pontos.length && antes !== melhor && custo(s, antes) <= menor + HISTERESE_M) melhor = antes;
    saida[i] = melhor;
    carga[melhor] = carga[melhor]! + 1;
  }
}
