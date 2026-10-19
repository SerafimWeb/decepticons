import { CHASSIS } from '../entities/chassis';
import { parseLoadoutKey } from '../hangar/loadout';

/**
 * Os pilotos da sala no monitor REDE (P216): quando há **mais de uma pessoa** online, o nome de cada uma vira um botão; clicar abre o Hangar dela (só ver) com a conversa por texto, sem sair do
 * Hangar (`ui/VisitaPanel.ts`, sob demanda). Só desenha uma lista e um aviso: o dado é da `OnlineSession.pilotos()` e das `Conversas`. Custo de CPU: zero (redesenha na entrada e na saída de alguém
 * e quando chega mensagem; nada por quadro).
 */
export interface PilotoNaRede {
  id: number;
  nome: string;
  build: string;
}

export function nomeDoChassi(build: string): string {
  const spec = parseLoadoutKey(build);
  return spec ? CHASSIS[spec.chassis].name : '';
}

export class RedePilotos {
  private atual: readonly PilotoNaRede[] = [];

  constructor(
    private readonly lista: HTMLElement | null,
    private readonly aoClicar: (p: PilotoNaRede) => void,
  ) {
    lista?.addEventListener('click', (e) => {
      const id = (e.target instanceof Element ? e.target.closest<HTMLElement>('[data-piloto]') : null)?.dataset.piloto;
      const p = this.atual.find((x) => String(x.id) === id);
      if (p) {
        e.stopPropagation();
        this.aoClicar(p);
      }
    });
  }

  /** Redesenha a lista: some quando não há outra pessoa na sala. `naoLidas` diz quantas mensagens de cada uma ainda não foram vistas. */
  atualizar(pilotos: readonly PilotoNaRede[], naoLidas: (id: number) => number): void {
    this.atual = pilotos;
    const lista = this.lista;
    if (!lista) return;
    lista.replaceChildren();
    lista.hidden = pilotos.length === 0;
    for (const p of pilotos) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'rede-piloto';
      b.dataset.piloto = String(p.id);
      b.title = `Ver o Hangar de ${p.nome} e conversar por texto`;
      const nome = document.createElement('b');
      nome.textContent = p.nome;
      const chassi = document.createElement('small');
      chassi.textContent = nomeDoChassi(p.build);
      b.append(nome, chassi);
      const n = naoLidas(p.id);
      if (n > 0) {
        const nova = document.createElement('i');
        nova.className = 'rede-nova';
        nova.textContent = String(n);
        nova.title = `${n} mensagem(ns) nova(s)`;
        b.append(nova);
      }
      li.append(b);
      lista.append(li);
    }
  }
}

/** O aviso curto de mensagem nova no canto da tela (durante a partida): quem escreveu e o começo do texto; some sozinho. Só um por vez. */
export class AvisoDeMensagem {
  private el: HTMLElement | null = null;
  private timer = 0;

  mostrar(de: string, texto: string): void {
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.className = 'chat-aviso';
      this.el.dataset.i18n = 'nao';
      this.el.setAttribute('role', 'status');
      document.body.append(this.el);
    }
    const resumo = texto.length > 70 ? `${texto.slice(0, 70)}…` : texto;
    this.el.textContent = `✉ ${de}: ${resumo}  ·  Esc → REDE`;
    this.el.classList.add('on');
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.el?.classList.remove('on'), 6000);
  }
}
