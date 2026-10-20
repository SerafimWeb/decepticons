/**
 * Onde o jogador e os rebeldes nascem no Deathmatch da Praça (o primeiro é do jogador). Todos em chão livre **fora dos saguões** (nenhum Mech nasce onde não cabe sair). O teste (`Praca.test.ts`)
 * confere que nenhum cai dentro de um bloco sólido nem colado numa parede.
 *
 * **Num arquivo à parte de propósito:** a `Match` e o `sim/nascimentos.ts` (pacote de partida) só precisam destes 16 pontos; o resto do `PracaLayout.ts` (prédios, blocos, fontes da multidão) só
 * baixa com o mapa (`mapasSobDemanda.ts`). Importar `PracaLayout` aqui o traria para o pacote de partida, que está no teto de 500 KB.
 */
export const PRACA_SPAWNS: readonly (readonly [number, number])[] = [
  [66, -12],
  [66, 12],
  [54, 0],
  [82, 0],
  [90, -36],
  [90, 36],
  [54, -34],
  [76, -34],
  [76, 30],
  [-10, 0],
  [-12, 16],
  [-12, -16],
  [-50, 0],
  [-72, 18],
  [-72, -18],
  [-96, 0],
];
