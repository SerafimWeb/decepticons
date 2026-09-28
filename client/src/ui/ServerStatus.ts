import { probeStatus, type ServerProbe, statusClass, statusLine } from '../net/serverStatus';
import { STATUS_POLL_S, statusUrl } from '../../../shared/net/status';

/**
 * A linha "SERVIDOR ONLINE · 2 PILOTOS EM COMBATE" na tela de pausa (dono, 28/09: *"tem como deixarmos na
 * página, permanentemente, a info se o servidor está online, quantas pessoas jogando?"*). Módulo
 * independente (G3): recebe o endereço do servidor e um lugar para morar, e o `Game.ts` só o liga.
 *
 * **Custo:** um `GET /status` de ~350 bytes a cada 20 s, **só enquanto a tela de pausa está à vista** e a aba
 * está na frente — entrou em combate, parou de perguntar. Nada disso roda no laço de 60 Hz nem aloca por
 * quadro (G4): é um `setTimeout` e um `textContent` quando o texto muda de verdade.
 *
 * Sem servidor configurado (`VITE_GAME_SERVER` ausente), o módulo não desenha nada: o jogo é offline e a
 * tela não fala de um servidor que não existe.
 *
 * **Por que o `defaultServer()` não entra aqui.** Aquele atalho devolve `ws://localhost:2567` quando o jogo
 * está aberto no próprio PC — inclusive no Chrome headless do `npm run check`, onde não há servidor nenhum.
 * A pergunta falharia, e um `fetch` que falha escreve no console do navegador, o que **reprova o smoke e o
 * `site --check`** (os dois tratam erro de console como falha). Então o status só pergunta ao servidor
 * público do build ou ao endereço explícito do link (`&servidor=`): nas duas o dono sabe que há servidor.
 */
export class ServerStatus {
  private readonly el: HTMLElement | null = null;
  private readonly url: string | null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private shown = '';
  private stopped = false;

  constructor(gameServer: string | undefined | null, parent: HTMLElement | null = null) {
    this.url = statusUrl(gameServer);
    if (!this.url || typeof document === 'undefined') return;
    const host = parent ?? document.getElementById('overlay');
    if (!host) return;
    const el = document.createElement('p');
    el.className = 'server-status';
    el.append(Object.assign(document.createElement('i'), { className: 'dot' }), document.createElement('span'));
    host.append(el);
    this.el = el;
    this.paint({ up: false }, 'checando');
    document.addEventListener('visibilitychange', () => this.kick());
    this.kick();
  }

  /** Para de perguntar (o jogo não chama hoje; existe para o teste e para quem desmontar a tela). */
  stop(): void {
    this.stopped = true;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  /** Visível quando a pausa está à vista e a aba está na frente: em combate ninguém lê esta linha. */
  private awake(): boolean {
    if (!this.el || this.stopped) return false;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false;
    return this.el.offsetParent !== null || this.el.getClientRects().length > 0;
  }

  private kick(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    if (this.stopped) return;
    void this.tick();
  }

  private async tick(): Promise<void> {
    if (this.stopped || !this.url) return;
    if (this.awake()) {
      const probe = await probeStatus(this.url);
      if (this.stopped) return;
      this.paint(probe, statusClass(probe));
    }
    // Mesmo dormindo, volta a olhar: é o mesmo prazo, e um `setTimeout` a cada 20 s não custa nada.
    this.timer = setTimeout(() => void this.tick(), STATUS_POLL_S * 1000);
  }

  private paint(probe: ServerProbe, kind: string): void {
    if (!this.el) return;
    const text = kind === 'checando' ? 'PROCURANDO O SERVIDOR…' : statusLine(probe);
    if (text !== this.shown) {
      this.el.lastElementChild!.textContent = text;
      this.shown = text;
    }
    this.el.className = `server-status ${kind}`;
  }
}
