import { idiomaAtual } from '../i18n/i18n';
import type { EstadoSessao, SessaoPiloto } from '../net/sessao';
import { LoginPanel } from './LoginPanel';

/**
 * A conta do piloto nas Configurações (ordem P174; `RANKING_E_LOGIN.md` C3). **Opcional e sem porta:** o jogo nunca pede conta; este bloco fica no fim da aba JOGO, para quem quer levar o
 * progresso (nível, créditos, apelido, montagem) para outro aparelho. Módulo independente (G3): fala só com a `SessaoPiloto` e com o `LoginPanel` (o formulário já pronto); o jogo o liga por
 * uma chamada, **sob demanda** (dieta de JS, P187): quem restaura a sessão na abertura é o jogo, porque a voz precisa da idade da conta antes de a tela existir. Texto de estado em português (o tradutor de DOM cuida das outras línguas, P173). Custo de CPU: zero fora do clique e do aviso de mudança.
 */
export const TEXTO_CONVIDADO = 'Sem conta, o progresso fica só neste aparelho. Crie uma conta para levá-lo para outro.';
export const TEXTO_LOGADO = 'Progresso guardado na conta.';
export const TEXTO_GUARDANDO = 'Guardando o progresso na conta…';
export const TEXTO_LINK_ENVIADO = 'Pronto. Se esse e-mail tiver uma conta, o link já está a caminho (confira também o spam). Ele vale 30 minutos.';
export const TEXTO_IDADE_GUARDADA = 'Pronto: a idade foi guardada.';
export const TEXTO_APAGADA = 'Conta apagada: o servidor já não guarda nada dela. O progresso deste aparelho continua aqui.';

/** Entrega um texto ao navegador como arquivo para salvar (sem rede: um Blob e um link temporário). */
function entregarArquivo(nome: string, texto: string): void {
  const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

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
    this.painel = new LoginPanel(
      {
        onEntrar: (e, s) => this.abrir(() => sessao.entrar(e, s)),
        onCriar: (e, s, nascimento) => this.abrir(() => sessao.criar(e, s, nascimento)),
        onNascimento: (nascimento) => this.informarIdade(nascimento),
        onEsqueci: (email) => this.esqueci(email),
        onSair: () => this.sair(),
        onBaixar: () => this.baixar(),
        onApagar: (senha) => this.apagar(senha),
        onMedicao: (ativa) => this.medir(ativa),
      },
      formulario,
    );
    sessao.onMudou = (e) => this.mostrar(e);
    this.mostrar(sessao.estado);
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

  /** "Esqueci a senha": pede o link ao servidor, na língua do jogo. O servidor não diz se a conta existe, e a frase também não. */
  private async esqueci(email: string): Promise<void> {
    this.painel.setEstado({ carregando: true, erro: null, aviso: null });
    const r = await this.sessao.esqueciSenha(email, idiomaAtual());
    if ('erro' in r) {
      this.painel.setEstado({ carregando: false, erro: r.erro });
      return;
    }
    this.painel.setEstado({ carregando: false, aviso: TEXTO_LINK_ENVIADO });
  }

  private async sair(): Promise<void> {
    this.painel.setCarregando(true);
    await this.sessao.sair();
    this.painel.setDeslogado();
  }

  /** Baixa o JSON da conta: o servidor entrega, o navegador salva (um link temporário clicado por código). */
  private async baixar(): Promise<void> {
    this.painel.setEstado({ carregando: true, erro: null, aviso: null });
    const r = await this.sessao.baixarDados();
    if ('erro' in r) {
      this.painel.setEstado({ carregando: false, erro: r.erro });
      return;
    }
    entregarArquivo(r.nome, r.json);
    this.painel.setEstado({ carregando: false, aviso: 'Pronto: o arquivo com os seus dados foi baixado.' });
  }

  /** Apaga a conta de vez (a senha foi pedida no painel). Depois disso o painel volta a ser o de convidado, com a confirmação. */
  private async apagar(senha: string): Promise<void> {
    this.painel.setEstado({ carregando: true, erro: null, aviso: null });
    const erro = await this.sessao.apagarConta(senha);
    if (erro) {
      this.painel.setEstado({ carregando: false, erro });
      return;
    }
    this.painel.setDeslogado();
    this.painel.setAviso(TEXTO_APAGADA);
  }

  /** A conta sem idade informa o mês e o ano (P211): o servidor guarda uma vez e devolve a faixa; a sessão avisa o jogo, que abre (ou não) a voz. */
  private async informarIdade(nascimento: string): Promise<void> {
    this.painel.setEstado({ carregando: true, erro: null, aviso: null });
    const erro = await this.sessao.informarNascimento(nascimento);
    this.painel.setEstado({ carregando: false, ...(erro ? { erro } : { aviso: TEXTO_IDADE_GUARDADA }) });
    this.painel.setIdade(this.sessao.estado.idade);
  }

  private async medir(ativa: boolean): Promise<void> {
    const ok = await this.sessao.definirMedicao(ativa);
    if (!ok) this.painel.setEstado({ medir: this.sessao.estado.medir, erro: 'não deu para guardar a escolha: tente de novo' });
  }

  private mostrar(e: EstadoSessao): void {
    this.status.textContent = textoDeEstado(e);
    this.painel.setMedicao(e.medir);
    this.painel.setIdade(e.idade);
    if (e.email) {
      if (!this.painel.getEstado().logado || this.painel.getEstado().email !== e.email) this.painel.setLogado(e.email);
    } else if (this.painel.getEstado().logado) {
      this.painel.setDeslogado();
    }
  }
}
