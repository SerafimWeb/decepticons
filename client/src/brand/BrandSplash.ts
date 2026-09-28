/** Quanto a vinheta fica na tela (ms). */
const DURATION_MS = 1900;
/** O mesmo clique que abriu a vinheta não pode pulá-la. */
const SKIP_AFTER_MS = 350;

/**
 * Vinheta da marca antes da partida, como as aberturas de console (SEGA, Konami, PlayStation): o
 * emblema da SERAFIM WEB acende, o letreiro aparece e toca a vinheta sonora; ~1,9 s. Roda uma vez
 * por sessão, no primeiro "clique para jogar" (o navegador só deixa tocar som depois de um gesto).
 * Clique ou tecla pula. Custo: duas imagens WebP (~43 KB, servidas junto do jogo) e uma animação CSS;
 * nada por quadro no JavaScript.
 */
export class BrandSplash {
  running = false;
  private readonly root: HTMLDivElement;
  private timer = 0;
  private startedAt = 0;
  private onDone: (() => void) | null = null;

  constructor(base = './brand/') {
    this.root = document.createElement('div');
    this.root.id = 'brand-splash';
    this.root.setAttribute('aria-hidden', 'true');
    const img = (className: string, file: string, w: number, h: number, alt: string) => {
      const i = document.createElement('img');
      Object.assign(i, { className, src: base + file, width: w, height: h, alt });
      return i;
    };
    const glow = document.createElement('div');
    glow.className = 'bs-glow';
    const tag = document.createElement('span');
    tag.className = 'bs-tag';
    tag.textContent = 'apresenta';
    this.root.append(glow, img('bs-emblem', 'serafim-emblem.webp', 240, 240, ''), img('bs-word', 'serafim-web.webp', 1100, 251, 'SERAFIM WEB'), tag);
    document.body.append(this.root);
    const skip = () => {
      if (this.running && performance.now() - this.startedAt > SKIP_AFTER_MS) this.finish();
    };
    window.addEventListener('pointerdown', skip, true);
    window.addEventListener('keydown', skip, true);
  }

  /** Mostra a vinheta. `playAudio` é um callback para acionar o som (ex: samples). Chama `onDone` no fim. */
  play(playAudio: (() => void) | null, onDone: () => void): void {
    this.onDone = onDone;
    this.running = true;
    this.startedAt = performance.now();
    // Reinicia as animações CSS (a classe sai e volta num quadro novo).
    this.root.classList.remove('on');
    void this.root.offsetWidth;
    this.root.classList.add('on');
    if (playAudio) playAudio();
    this.timer = window.setTimeout(() => this.finish(), DURATION_MS);
  }

  private finish(): void {
    if (!this.running) return;
    this.running = false;
    window.clearTimeout(this.timer);
    this.root.classList.remove('on');
    const done = this.onDone;
    this.onDone = null;
    done?.();
  }
}
