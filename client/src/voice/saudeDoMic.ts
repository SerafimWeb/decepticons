/**
 * A SAÚDE DO MICROFONE (P237, ordem do Comandante em 20/10: "novamente o microfone parou de funcionar… nem ouvir o microfone no Windows… o fone está funcionando mas o microfone não").
 * O jogo não conserta um fone, mas pode **perceber e dizer na tela** quando o microfone abre e entrega só silêncio, em vez de deixar a pessoa falar sozinha achando que o chat quebrou. Texto puro
 * e contas, sem DOM e sem Web Audio (testável): quem lê a onda é o `EnvioDeVoz`, e o HUD e o diagnóstico mostram o resultado.
 */

/** `ok`; `sem-som` (o microfone está aberto e entrega **zero absoluto**: mudo no fone, fone fora do modo microfone, aparelho morto); `sem-entrega` (o navegador diz que a faixa parou de receber dado). */
export type SaudeDoMic = 'ok' | 'sem-som' | 'sem-entrega';

/** Quanto silêncio total, com o microfone aberto, antes de avisar (ms). Um microfone vivo tem um chiado acima de zero; aparelhos que cortam o ruído sem voz avisam só depois de uma pausa longa. */
export const SEM_SOM_MS = 8000;

/** O volume da onda (amostras de -1 a 1): o RMS de 0 a 1 e o pico (a maior amostra, em módulo). Em ponto flutuante: um byte só enxerga passos de 0,0078 e perde a voz baixa de um fone Bluetooth. */
export function nivelDaOnda(onda: Float32Array): { rms: number; pico: number } {
  let soma = 0;
  let pico = 0;
  for (let i = 0; i < onda.length; i++) {
    const v = onda[i]!;
    soma += v * v;
    const a = v < 0 ? -v : v;
    if (a > pico) pico = a;
  }
  return { rms: onda.length === 0 ? 0 : Math.sqrt(soma / onda.length), pico };
}

/** O RMS na barra (0 a 100): em decibéis, de −60 dBFS (vazio) a 0 dBFS (cheio); a fala normal fica entre 50 e 80. */
export function barraDoNivel(rms: number): number {
  const db = 20 * Math.log10(Math.max(rms, 1e-5));
  return Math.round(Math.min(100, Math.max(0, ((db + 60) / 60) * 100)));
}

/**
 * O vigia: recebe uma leitura a cada ~100 ms (`ler`) e diz a saúde. **Só julga com o microfone aberto** (`transmitindo`): no mudo e no "segurar para falar" solto o silêncio é o esperado e
 * o relógio zera. Som qualquer (`pico > 0`) zera na hora e o aviso some.
 */
export class VigiaDoMic {
  private silencioDesde = -1;
  estado: SaudeDoMic = 'ok';

  ler(agora: number, pico: number, entregando: boolean, transmitindo: boolean): SaudeDoMic {
    if (!entregando) {
      this.silencioDesde = -1;
      return (this.estado = 'sem-entrega');
    }
    if (!transmitindo || pico > 0) {
      this.silencioDesde = -1;
      return (this.estado = 'ok');
    }
    if (this.silencioDesde < 0) this.silencioDesde = agora;
    return (this.estado = agora - this.silencioDesde >= SEM_SOM_MS ? 'sem-som' : 'ok');
  }

  reiniciar(): void {
    this.silencioDesde = -1;
    this.estado = 'ok';
  }
}

/** O pico de RMS que a fala comum deve ter depois do ganho (≈ −20 dBFS): abaixo disso, quem escuta mal ouve. */
export const RMS_ALVO = 0.1;
/** A partir deste RMS o microfone "está captando" (o mesmo limite do teste do microfone). */
const RMS_MINIMO = 0.008;
export const GANHO_MAX = 4;

/**
 * Que ganho sugerir ao jogador: `picoRms` é o maior RMS visto no teste **já com o ganho atual**. Voz captada mas baixa (um fone Bluetooth em modo mãos-livres, 16 kHz) pede mais ganho; sem voz (abaixo
 * do mínimo) não há o que sugerir; voz já boa, nenhuma sugestão. Arredonda a 0,1 e nunca passa do máximo. `null` = nada a sugerir.
 */
export function sugestaoDeGanho(picoRms: number, ganhoAtual: number): number | null {
  if (picoRms < RMS_MINIMO || ganhoAtual >= GANHO_MAX) return null;
  const ideal = (ganhoAtual * RMS_ALVO) / picoRms;
  if (ideal < ganhoAtual * 1.25) return null; // já está boa: menos de 25% de diferença não vale a conversa
  return Math.min(GANHO_MAX, Math.round(ideal * 10) / 10);
}
