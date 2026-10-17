import type { EstadoSessao, SessaoPiloto } from '../net/sessao';
import { LoginPanel } from './LoginPanel';

/**
 * A conta do piloto nas Configurações (ordem P174; `RANKING_E_LOGIN.md` C3). **Opcional e sem porta:** o jogo nunca pede conta; este bloco fica no fim da aba JOGO, para quem quer levar o
 * progresso (nível, créditos, apelido, montagem) para outro aparelho. Módulo independente (G3): fala só com a `SessaoPiloto` e com o `LoginPanel` (o formulário já pronto); o jogo o liga por
 * uma chamada. Texto de estado em português (o tradutor de DOM cuida das outras línguas, P173). Custo de CPU: zero fora do clique e do aviso de mudança.
 */
export const TEXTO_CONVIDADO = 'Sem conta, o progresso fica só neste aparelho. Crie uma conta para levá-lo para outro.';
export const TEXTO_LOGADO = 'Progresso guardado na conta.';
export const TEXTO_GUARDANDO = 'Guardando o progresso na conta…';

/** A frase de estado para a sessão de agora. */
export function textoDeEstado(e: EstadoSessao): string {
  if (!e.email) return TEXTO_CONVIDADO;
  return e.sincronizado ? TEXTO_LOGADO : TEXTO_GUARDANDO;
}

export class ContaSettings {
  private readonly painel: LoginPanel;
  private readonly status: HTMLElement;

  constructor(
    parent: HTMLElement,
    private readonly sessao: SessaoPiloto,
  ) {
    this.status = document.createElement('p');
    this.status.className = 'setting-hint';
    this.status.id = 'conta-status';
    const formulario = document.createElement('div');
    parent.append(this.status, formulario);
    this.painel = new LoginPanel({ onEntrar: (e, s) => this.abrir(() => sessao.entrar(e, s)), onCriar: (e, s) => this.abrir(() => sessao.criar(e, s)), onSair: () => this.sair() }, formulario);
    sessao.onMudou = (e) => this.mostrar(e);
    this.mostrar(sessao.estado);
  }

  /** O jogo abriu: volta logado se a sessão guardada ainda vale. */
  async restaurar(): Promise<void> {
    await this.sessao.restaurar();
    this.mostrar(this.sessao.estado);
  }

  private async abrir(acao: () => Promise<string | null>): Promise<void> {
    this.painel.setCarregando(true);
    const erro = await acao();
    if (erro) {
      this.painel.setCarregando(false);
      this.painel.setErro(erro);
      return;
    }
    this.mostrar(this.sessao.estado);
  }

  private async sair(): Promise<void> {
    this.painel.setCarregando(true);
    await this.sessao.sair();
    this.painel.setDeslogado();
  }

  private mostrar(e: EstadoSessao): void {
    this.status.textContent = textoDeEstado(e);
    if (e.email) {
      if (!this.painel.getEstado().logado || this.painel.getEstado().email !== e.email) this.painel.setLogado(e.email);
    } else if (this.painel.getEstado().logado) {
      this.painel.setDeslogado();
    }
  }
}
