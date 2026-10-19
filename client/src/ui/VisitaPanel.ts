import type { Conversas } from '../net/Conversas';
import { limparTexto, TEXTO_MAX_CARACTERES } from '../../../shared/net/texto';

/**
 * A VISITA AO HANGAR DE OUTRO PILOTO (P216): a janela de conversa por texto que aparece **dentro do Hangar** quando você clica no nome de alguém na REDE. O Hangar mostra o robô e as armas
 * dele (só leitura, `HangarMenu.visitar`); aqui ficam a conversa, o campo de texto e o SILENCIAR. Pedaço sob demanda (R7): só baixa para quem abre uma visita. Tudo entra por `textContent`
 * (nada de HTML do outro piloto na tela). Custo de CPU: zero fora dos eventos (clique, mensagem).
 */
export interface VisitaHooks {
  conversas: Conversas;
  /** Manda o texto ao piloto; `false` se não saiu (fora da sala, vazio). */
  enviar(id: number, texto: string): boolean;
  /** O piloto ainda está na sala? */
  presente(id: number): boolean;
  /** Voltar ao Hangar de verdade / fechar. */
  aoSair(): void;
}

/** O mesmo teto da sala (`server/texto.ts`): 6 mensagens por 10 s; o cliente avisa antes de o servidor descartar. */
const MAX_NA_JANELA = 6;
const JANELA_MS = 10_000;

export class VisitaPanel {
  private id = -1;
  private nome = '';
  private log!: HTMLElement;
  private campo!: HTMLInputElement;
  private aviso!: HTMLElement;
  private mudo!: HTMLButtonElement;
  private cancelar: (() => void) | null = null;
  private readonly enviados: number[] = [];

  constructor(
    private readonly caixa: HTMLElement,
    private readonly h: VisitaHooks,
  ) {}

  /** Mostra a visita a `nome` (id `id` na sala): a conversa até agora e o campo de texto. */
  abrir(id: number, nome: string): void {
    this.cancelar?.();
    this.id = id;
    this.nome = nome;
    this.montar();
    this.h.conversas.marcarLida(id);
    this.cancelar = this.h.conversas.ouvir(() => {
      this.h.conversas.marcarLida(this.id);
      this.pintar();
    });
    this.pintar();
    this.campo.focus({ preventScroll: true });
  }

  fechar(): void {
    this.cancelar?.();
    this.cancelar = null;
    this.id = -1;
    this.caixa.replaceChildren();
  }

  /** A sala mudou (alguém saiu): se o visitado saiu, o campo de texto fecha. */
  presencaMudou(): void {
    if (this.id >= 0) this.pintar();
  }

  get visitando(): number {
    return this.id;
  }

  private el<K extends keyof HTMLElementTagNameMap>(tag: K, classe: string, texto?: string): HTMLElementTagNameMap[K] {
    const e = document.createElement(tag);
    e.className = classe;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  private montar(): void {
    const topo = this.el('header', 'vp-topo');
    topo.append(this.el('b', 'vp-nome', `VISITA · HANGAR DE ${this.nome}`), this.el('small', 'vp-ajuda', 'só ver: nada que você clicar aqui muda o seu robô'));
    this.mudo = this.el('button', 'hg-btn vp-botao');
    this.mudo.type = 'button';
    this.mudo.addEventListener('click', () => {
      this.h.conversas.silenciar(this.id, !this.h.conversas.estaSilenciado(this.id));
      this.pintar();
    });
    const sair = this.el('button', 'hg-btn vp-botao', 'VOLTAR AO MEU HANGAR');
    sair.type = 'button';
    sair.addEventListener('click', () => this.h.aoSair());
    topo.append(this.mudo, sair);

    this.log = this.el('ol', 'vp-log');
    this.log.setAttribute('aria-live', 'polite');

    const form = this.el('form', 'vp-form');
    this.campo = this.el('input', 'vp-campo');
    this.campo.type = 'text';
    this.campo.maxLength = TEXTO_MAX_CARACTERES;
    this.campo.autocomplete = 'off';
    this.campo.setAttribute('aria-label', `Mensagem para ${this.nome}`);
    // As teclas do campo são do campo: não viram atalho do jogo (Esc continua fechando o Hangar).
    this.campo.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') e.stopPropagation();
    });
    const enviar = this.el('button', 'hg-btn vp-botao primario', 'ENVIAR');
    enviar.type = 'submit';
    this.aviso = this.el('small', 'vp-aviso');
    form.append(this.campo, enviar);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.enviar();
    });
    this.caixa.replaceChildren(topo, this.log, form, this.aviso);
  }

  private enviar(): void {
    const texto = limparTexto(this.campo.value);
    if (!texto) return;
    const agora = performance.now();
    while (this.enviados.length && agora - this.enviados[0]! > JANELA_MS) this.enviados.shift();
    if (this.enviados.length >= MAX_NA_JANELA) {
      this.aviso.textContent = 'Devagar: espere alguns segundos para mandar mais.';
      return;
    }
    if (!this.h.presente(this.id)) {
      this.aviso.textContent = `${this.nome} saiu da sala.`;
      return;
    }
    if (!this.h.enviar(this.id, texto)) {
      this.aviso.textContent = 'Não consegui mandar: confira a conexão.';
      return;
    }
    this.enviados.push(agora);
    this.h.conversas.enviada(this.id, texto);
    this.campo.value = '';
    this.aviso.textContent = '';
  }

  private pintar(): void {
    const presente = this.h.presente(this.id);
    const silenciado = this.h.conversas.estaSilenciado(this.id);
    this.mudo.textContent = silenciado ? 'DEIXAR DE SILENCIAR' : 'SILENCIAR';
    this.mudo.setAttribute('aria-pressed', String(silenciado));
    this.campo.disabled = !presente;
    this.campo.placeholder = presente ? `Escreva a ${this.nome}…` : `${this.nome} saiu da sala`;
    const linhas = this.h.conversas.linhas(this.id);
    this.log.replaceChildren();
    if (linhas.length === 0) {
      this.log.append(this.el('li', 'vp-vazio', silenciado ? 'Você silenciou este piloto: o que ele escrever não chega.' : 'Nenhuma mensagem ainda. Diga oi.'));
    }
    for (const l of linhas) {
      const li = this.el('li', l.meu ? 'vp-linha meu' : 'vp-linha');
      li.append(this.el('b', '', l.meu ? 'VOCÊ' : this.nome), this.el('span', '', l.texto));
      this.log.append(li);
    }
    this.log.scrollTop = this.log.scrollHeight;
  }
}
