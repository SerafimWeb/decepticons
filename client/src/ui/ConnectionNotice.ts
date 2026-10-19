import { t } from '../i18n/i18n';
import type { OnlineStatus } from '../net/OnlineSession';
import { type AvisoDeConexao, textoDoAviso } from './avisoDeConexao';

/**
 * O painel "SERVIDOR REINICIANDO" (P204), por cima do jogo quando o servidor avisa que vai reiniciar ou a conexão cai depois de o
 * jogador já estar na sala. O texto vem de `avisoDeConexao.ts` (puro, com teste); aqui só se desenha.
 *
 * **Custo:** nada enquanto está escondido (sem relógio, sem DOM tocado). Visível, um `setInterval` de 1 s que só escreve um
 * `textContent` quando o texto mudou de verdade. Nada no laço de 60 Hz e nada alocado por quadro (G4).
 */
export interface ConnectionNoticeOptions {
  /** Sai do online para o jogo offline (recarrega a página sem a sala). */
  aoJogarOffline: () => void;
  /** Recarrega a página (quando a insistência acabou). */
  aoRecarregar: () => void;
  /** Relógio injetável (os testes). */
  agora?: () => number;
}

export class ConnectionNotice {
  private readonly el: HTMLElement;
  private readonly titulo: HTMLElement;
  private readonly linha: HTMLElement;
  private readonly rotulo: HTMLElement;
  private readonly contador: HTMLElement;
  private readonly botao: HTMLButtonElement;
  private status: OnlineStatus | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private tom: AvisoDeConexao['tom'] | null = null;
  private readonly agora: () => number;

  constructor(parent: HTMLElement, o: ConnectionNoticeOptions) {
    this.agora = o.agora ?? Date.now;
    const el = document.createElement('div');
    el.className = 'net-aviso';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    const card = document.createElement('div');
    card.className = 'card';
    this.titulo = Object.assign(document.createElement('h2'), { className: 'titulo' });
    this.linha = Object.assign(document.createElement('p'), { className: 'linha' });
    const relogio = Object.assign(document.createElement('p'), { className: 'relogio' });
    this.rotulo = Object.assign(document.createElement('span'), { className: 'rotulo' });
    this.contador = Object.assign(document.createElement('b'), { className: 'contador' });
    this.contador.setAttribute('aria-hidden', 'true');
    relogio.append(this.rotulo, this.contador);
    this.botao = Object.assign(document.createElement('button'), { type: 'button', className: 'botao' });
    this.botao.addEventListener('click', () => (this.tom === 'fim' ? o.aoRecarregar() : o.aoJogarOffline()));
    card.append(this.titulo, this.linha, relogio, this.botao);
    el.append(card);
    parent.append(el);
    this.el = el;
  }

  /** O estado novo da conexão (a sessão online manda a cada mudança). */
  atualizar(s: OnlineStatus): void {
    this.status = s;
    this.pintar();
  }

  dispose(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.el.remove();
  }

  private pintar(): void {
    const a = this.status ? textoDoAviso(this.status, this.agora()) : null;
    if (!a) {
      if (this.timer !== null) clearInterval(this.timer);
      this.timer = null;
      this.tom = null;
      this.el.classList.remove('on');
      return;
    }
    if (this.timer === null) this.timer = setInterval(() => this.pintar(), 1000);
    this.tom = a.tom;
    this.el.classList.add('on');
    this.el.dataset.tom = a.tom;
    escrever(this.titulo, a.titulo);
    escrever(this.linha, a.linha);
    escrever(this.rotulo, a.rotulo ?? '');
    escrever(this.contador, a.contador ?? '');
    this.contador.parentElement!.hidden = a.contador === null;
    this.botao.hidden = !a.podeJogarOffline;
    escrever(this.botao, a.tom === 'fim' ? t('RECARREGAR') : t('JOGAR OFFLINE ENQUANTO ISSO'));
  }
}

/** Só toca o DOM quando o texto mudou (o relógio muda a cada segundo; o resto, quase nunca). */
function escrever(el: HTMLElement, texto: string): void {
  if (el.textContent !== texto) el.textContent = texto;
}
