/**
 * Os quatro marcadores do carregador do Ataque 2 no HUD, como conta pura (sem DOM). Até quatro tiros no carregador (foguetes, chuva, guiado), um marcador por tiro, e o próximo
 * enche com o progresso da recarga; acima de quatro (o lançador de mísseis leve: 8, 16 ou 32), cada marcador vale um quarto do lançador e mostra a **fração cheia**, que esvazia
 * durante a salva e enche tubo a tubo na recarga.
 */
export const ROCKET_PIPS = 4;

/** O preenchimento (0 a 1) de cada um dos quatro marcadores. `reload` é o progresso (0 a 1) do próximo tiro, só usado nos carregadores de até quatro. */
export function pipFills(ammo: number, reload: number, magazine: number): number[] {
  const fills: number[] = [];
  const cheios = magazine > ROCKET_PIPS ? (ammo * ROCKET_PIPS) / magazine : ammo;
  for (let i = 0; i < ROCKET_PIPS; i++) {
    fills.push(magazine > ROCKET_PIPS ? Math.min(1, Math.max(0, cheios - i)) : i < ammo ? 1 : i === ammo ? reload : 0);
  }
  return fills;
}
