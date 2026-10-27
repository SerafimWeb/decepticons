/**
 * A legenda do WARGAME (P262): o texto de uma batida do roteiro, centralizado embaixo, igual ao `cj-legenda` da
 * `CutsceneJaneiro.ts` — mas genérica (várias mensagens ao longo do episódio, não uma só fixa). Só apresentação:
 * quem decide QUANDO mostrar e por quanto tempo é `Match.onRoteiroEvento` (`Game.ts`); aqui só o `mostrar`/esconder.
 */
const CSS = `
#wargame-legenda { position: fixed; left: 50%; bottom: 12vh; transform: translateX(-50%); width: min(680px, 86vw); text-align: center;
  pointer-events: none; z-index: 400; font-size: 14px; line-height: 1.6; letter-spacing: 1.3px; text-transform: uppercase;
  color: var(--ink, #eef2e8); text-shadow: 0 1px 3px #000; opacity: 0; transition: opacity 0.6s ease; }
#wargame-legenda.wl-visivel { opacity: 1; }
`;

export class WargameCaptionOverlay {
  private readonly el: HTMLDivElement;
  private readonly estilo: HTMLStyleElement;
  /** `performance.now()` em que a legenda deve sumir; `0` = nada a esconder. View só (não entra na simulação, G1/G2). */
  private escondeEm = 0;

  constructor() {
    this.estilo = document.createElement('style');
    this.estilo.textContent = CSS;
    document.head.append(this.estilo);
    this.el = document.createElement('div');
    this.el.id = 'wargame-legenda';
    document.body.append(this.el);
  }

  mostrar(texto: string, duracaoS: number): void {
    this.el.textContent = texto;
    this.el.classList.add('wl-visivel');
    this.escondeEm = performance.now() + duracaoS * 1000;
  }

  /** Chamar todo quadro: barato (uma comparação; sumir é raro). */
  atualizar(): void {
    if (this.escondeEm && performance.now() >= this.escondeEm) {
      this.el.classList.remove('wl-visivel');
      this.escondeEm = 0;
    }
  }

  dispose(): void {
    this.el.remove();
    this.estilo.remove();
  }
}
