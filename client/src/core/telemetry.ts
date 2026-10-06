import { serverHttpUrl } from '../../../shared/net/serverUrl';
import { EVENTO_PATH, type EventoNome } from '../../../shared/net/telemetry';

/**
 * Emissor de métricas de produto (G3: módulo independente, ligado por chamada, nunca por import direto de
 * outro sistema). Manda o evento pro mesmo servidor de jogo que já responde `/status` — sem servidor
 * configurado, o módulo não manda nada (não existe backend de site nenhum para receber).
 *
 * **Nunca falha visivelmente e nunca bloqueia:** `navigator.sendBeacon` (fogo e esquece, sobrevive a
 * fechar a aba) com fallback silencioso a um `fetch(..., { keepalive: true })`; qualquer erro de rede,
 * CSP ou CORS é engolido — telemetria não pode derrubar nem atrasar o jogo (o mesmo princípio do fallback
 * silencioso do `AudioSystem`).
 *
 * **Custo:** um POST de ~40 bytes por evento, só nos poucos pontos de funil (boot, clique, início/fim de
 * partida) — nunca por quadro, nunca no tick.
 */
export class Telemetry {
  private readonly url: string | null;
  private readonly aba: string;
  private sequence = 0;

  constructor(gameServer: string | undefined | null) {
    this.url = serverHttpUrl(gameServer, EVENTO_PATH);
    // Id efêmero só desta aba/carregamento: nunca gravado, nunca reenviado entre sessões (sem localStorage,
    // sem cookie) — existe só para o servidor não contar duas vezes um reenvio duplicado do sendBeacon.
    this.aba = randomId();
  }

  enviar(nome: EventoNome): void {
    if (!this.url) return;
    const corpo = JSON.stringify({ nome, aba: this.aba, seq: this.sequence++ });
    try {
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        // Blob sem "application/json" explícito: fica como envio "simples" do CORS, sem preflight.
        if (navigator.sendBeacon(this.url, new Blob([corpo], { type: 'text/plain' }))) return;
      }
      void fetch(this.url, { method: 'POST', body: corpo, headers: { 'content-type': 'application/json' }, keepalive: true, mode: 'cors' }).catch(() => {});
    } catch {
      // Servidor fora do ar, CSP, navegador sem suporte: silencioso, como o resto do fallback do jogo.
    }
  }
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  return Math.random().toString(36).slice(2, 18);
}
