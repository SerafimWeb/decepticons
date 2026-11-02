/**
 * O recorte vertical do clipe (P309): a parte central da cena que cabe em 9:16. Pura (sem DOM), testada em `recorte.test.ts`.
 *
 * A altura inteira é mantida e a largura é 9/16 dela, centrada, quando a cena é mais larga que 9:16 (o caso do jogo: 16:9). Se a cena já for
 * mais estreita que 9:16, a largura inteira é mantida e a altura é cortada, também centrada. O corte é a ação do meio da tela: é onde o robô fica.
 */
export interface Recorte {
  readonly sx: number;
  readonly sy: number;
  readonly sw: number;
  readonly sh: number;
}

/** O mesmo recorte, num objeto que o quadro reusa a cada quadro (G4: zero alocação por quadro). */
export interface RecorteEditavel {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/** A proporção do clipe: 9 de largura para 16 de altura (vertical, como TikTok e Shorts). */
export const PROPORCAO_VERTICAL = 9 / 16;

/**
 * O recorte 9:16 de uma fonte de `largura` × `altura` pixels, gravado em `saida` (o mesmo objeto, sem alocar). `centroX` (0 a 1, a fração da
 * largura) diz onde a ação está: o recorte segue esse ponto, sem sair da fonte (o robô do jogador, na câmera de terceira pessoa, fica
 * deslocado, e um corte no meio cortaria o robô). Entradas inválidas (zero, negativas, não finitas) devolvem o recorte vazio.
 */
export function recorteVerticalEm(largura: number, altura: number, centroX: number, saida: RecorteEditavel): RecorteEditavel {
  if (!(largura > 0) || !(altura > 0) || !Number.isFinite(largura) || !Number.isFinite(altura)) {
    saida.sx = 0;
    saida.sy = 0;
    saida.sw = 0;
    saida.sh = 0;
    return saida;
  }
  if (largura / altura > PROPORCAO_VERTICAL) {
    // Mais larga que 9:16: mantém a altura, corta a largura, centrada no ponto da ação e limitada às bordas.
    const sw = Math.round(altura * PROPORCAO_VERTICAL);
    const cx = Number.isFinite(centroX) ? Math.min(1, Math.max(0, centroX)) : 0.5;
    saida.sx = Math.round(Math.min(largura - sw, Math.max(0, cx * largura - sw / 2)));
    saida.sy = 0;
    saida.sw = sw;
    saida.sh = altura;
    return saida;
  }
  // Mais estreita (ou igual): mantém a largura, corta a altura (centrada).
  const sh = Math.round(largura / PROPORCAO_VERTICAL);
  saida.sx = 0;
  saida.sy = Math.round((altura - sh) / 2);
  saida.sw = largura;
  saida.sh = sh;
  return saida;
}

/** O recorte 9:16 como objeto novo (para testes e uso fora do quadro). O quadro usa `recorteVerticalEm`. */
export function recorteVertical(largura: number, altura: number, centroX = 0.5): Recorte {
  return recorteVerticalEm(largura, altura, centroX, { sx: 0, sy: 0, sw: 0, sh: 0 });
}
