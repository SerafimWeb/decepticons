/**
 * O progresso da tela de carregamento (a barra e a dica sob "INICIALIZANDO A SALA DE COMANDO"; pendência do Gemini, "tela de carregamento com barra de progresso e dicas").
 * O botão de jogar já dizia a etapa ("preparando gráficos 7/27"); agora a barra mostra **quanto falta**, e a dica ocupa a espera.
 *
 * As faixas pesam o tempo de cada etapa do boot (a física, os robôs importados, a montagem do jogo e o aquecimento dos shaders, que é a maior); dentro de uma faixa, o
 * progresso é `feito/total`. Só leitura de contagens que o boot já tem: custo zero no jogo.
 */
export type FaseDoBoot = 'fisica' | 'robos' | 'jogo' | 'graficos' | 'hangar' | 'pronto';

const FAIXAS: Readonly<Record<FaseDoBoot, readonly [number, number]>> = {
  fisica: [0, 0.15],
  robos: [0.15, 0.35],
  jogo: [0.35, 0.55],
  graficos: [0.55, 0.85],
  hangar: [0.85, 1],
  pronto: [1, 1],
};

/** O progresso (de 0 a 1) de `feito` entre `total` passos da fase. Total ausente ou zero conta como a fase cumprida só ao chegar nela (0). */
export function progressoDoBoot(fase: FaseDoBoot, feito = 0, total = 0): number {
  const [de, ate] = FAIXAS[fase];
  if (fase === 'pronto') return 1;
  const f = total > 0 ? Math.min(1, Math.max(0, feito / total)) : 0;
  return de + (ate - de) * f;
}

/** As dicas da espera: só o que o jogo faz de verdade, em frases curtas para o jogador. */
export const DICAS_DO_BOOT: readonly string[] = [
  'Pernas destruídas deixam o inimigo mais lento.',
  'Cuidado com a cabeça: sem ela, você perde o painel de alvo.',
  'Em rajadas curtas o Mech esfria entre uma e outra.',
  'O aviso de dano mostra de onde veio o tiro.',
  'Shift faz o dash: use para sair da linha de tiro.',
  'No Hangar (H) você troca o chassi, as armas e o nível delas.',
  'V alterna entre a visão em primeira e em terceira pessoa.',
  'A qualidade se ajusta sozinha em placas de vídeo fracas.',
];

/** A dica de um número qualquer (a semente), sempre dentro da lista. */
export function dicaDoBoot(semente: number): string {
  const i = Number.isFinite(semente) ? Math.abs(Math.trunc(semente)) % DICAS_DO_BOOT.length : 0;
  return DICAS_DO_BOOT[i]!;
}

let dicaMostrada = false;

/** Pinta a barra (e a dica, uma vez) na tela de carregamento. Sem a tela (testes, outra página), não faz nada. */
export function bootProgresso(fase: FaseDoBoot, feito = 0, total = 0): void {
  if (typeof document === 'undefined') return;
  const carga = document.getElementById('cc-carga');
  if (!carga) return;
  const pct = progressoDoBoot(fase, feito, total);
  carga.style.setProperty('--p', pct.toFixed(3));
  carga.setAttribute('aria-valuenow', String(Math.round(pct * 100)));
  if (!dicaMostrada) {
    dicaMostrada = true;
    const dica = document.getElementById('cc-dica');
    if (dica) dica.textContent = dicaDoBoot(Math.floor(Math.random() * DICAS_DO_BOOT.length));
  }
}
