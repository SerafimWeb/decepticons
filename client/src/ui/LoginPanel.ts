import { type IdadeDaConta, validarEmail, validarNascimento, validarSenha, VOZ_SO_PARA_ADULTO_DECLARADO } from '../../../shared/net/auth';

/**
 * LoginPanel — Interface de Autenticação (P33)
 *
 * Módulo de UI independente em `client/src/ui/` para login e criação de contas de piloto.
 *
 * Funcionalidades:
 * - Abas "Entrar" e "Criar conta"
 * - Validação em tempo real (e-mail plausível max 254 chars, senha 8 a 72 chars)
 * - Estado de "carregando" enquanto aguarda a API
 * - Exibição de erros legíveis do servidor em português
 * - Estado "logado como <email>" com botão "Sair"
 * - Criar conta exige as duas caixas (política de privacidade lida; maior de 18 anos ou com autorização de um responsável): o servidor também recusa sem elas (P192, LGPD)
 * - Criar conta pergunta o mês e o ano de nascimento (P211): o chat de voz é só de maior de 18 anos. Quem tem conta sem idade informada vê o mesmo par de campos logado, e informa uma vez
 * - Logado: "Meus dados" (LGPD art. 18): ligar/desligar o registro da atividade, baixar os dados e apagar a conta (com a senha de novo)
 * - NUNCA exibe a senha em logs
 * - NUNCA coloca dois botões de ação primária lado a lado (layout vertical único)
 * - Responsivo e pronto para dispositivos móveis
 */

export type LoginModo = 'entrar' | 'criar' | 'esqueci';

/** A política de privacidade publicada no site (o jogo pode estar em outro endereço; a política é uma só). */
export const POLITICA_URL_PADRAO = 'https://cybermech.online/privacidade/';

export interface LoginPanelEstado {
  logado: boolean;
  email: string;
  modo: LoginModo;
  carregando: boolean;
  erro: string | null;
  /** A atividade da conta é registrada? (A caixa de "Meus dados"; vem da sessão.) */
  medir: boolean;
  /** Logado: a confirmação de apagar a conta está aberta (pede a senha). */
  confirmandoApagar: boolean;
  /** Uma frase de confirmação ("Dados baixados."), em verde, acima das ações. */
  aviso: string | null;
  /** A faixa de idade da conta logada (P211): `sem-idade` mostra o pedido de mês e ano; `menor` mostra o aviso de que não há voz. */
  idade: IdadeDaConta;
}

export interface LoginPanelOptions {
  onEntrar?: (email: string, senha: string) => Promise<void> | void;
  /** `nascimento`: `AAAA-MM`, já conferido (o botão só liga com o mês e o ano escolhidos). */
  onCriar?: (email: string, senha: string, nascimento: string) => Promise<void> | void;
  /** A conta logada sem idade informa o mês e o ano de nascimento (P211): `AAAA-MM`. */
  onNascimento?: (nascimento: string) => Promise<void> | void;
  /** "Esqueci a senha" (P206): pede o link de redefinição para este e-mail. */
  onEsqueci?: (email: string) => Promise<void> | void;
  onSair?: () => Promise<void> | void;
  /** Baixar os dados da conta (LGPD art. 18 II e V). */
  onBaixar?: () => Promise<void> | void;
  /** Apagar a conta com a senha digitada (LGPD art. 18 VI). */
  onApagar?: (senha: string) => Promise<void> | void;
  /** A pessoa ligou ou desligou o registro da atividade (LGPD art. 18 § 2). */
  onMedicao?: (ativa: boolean) => Promise<void> | void;
  /** Para onde vai o link "Política de Privacidade". */
  politicaUrl?: string;
  estadoInicial?: Partial<LoginPanelEstado>;
}

export class LoginPanel {
  private estado: LoginPanelEstado;
  private options: LoginPanelOptions;
  private containerEl: HTMLElement | null = null;
  private inputEmailVal = '';
  private inputSenhaVal = '';
  private emailTocado = false;
  private senhaTocada = false;
  private aceitePolitica = false;
  private aceiteIdade = false;
  private senhaApagar = '';
  /** O mês (`1` a `12`) e o ano escolhidos nas listas (texto vazio = nada escolhido). */
  private nascMes = '';
  private nascAno = '';

  constructor(options: LoginPanelOptions = {}, parent: HTMLElement | null = null) {
    this.options = options;
    this.estado = {
      logado: false,
      email: '',
      modo: 'entrar',
      carregando: false,
      erro: null,
      medir: true,
      confirmandoApagar: false,
      aviso: null,
      idade: 'sem-idade',
      ...options.estadoInicial,
    };
    if (this.estado.email) {
      this.inputEmailVal = this.estado.email;
    }

    if (parent) {
      this.attachTo(parent);
    }
  }

  /** Retorna uma cópia do estado atual do painel. */
  getEstado(): Readonly<LoginPanelEstado> {
    return { ...this.estado };
  }

  /** Atualiza o estado do painel (usado pelo Game.ts ou chamador externo) e re-renderiza. */
  setEstado(novoEstado: Partial<LoginPanelEstado>): void {
    const logadoMudou = novoEstado.logado !== undefined && novoEstado.logado !== this.estado.logado;
    const modoMudou = novoEstado.modo !== undefined && novoEstado.modo !== this.estado.modo;

    this.estado = {
      ...this.estado,
      ...novoEstado,
    };
    // A frase de confirmação é de um momento: ao trocar de tela (logar, sair, outra aba) ela some, a menos que quem trocou mande outra.
    if ((logadoMudou || modoMudou) && novoEstado.aviso === undefined) this.estado.aviso = null;

    if (novoEstado.email !== undefined && !this.inputEmailVal) {
      this.inputEmailVal = novoEstado.email;
    }

    if (logadoMudou || modoMudou) {
      this.emailTocado = false;
      this.senhaTocada = false;
    }

    this._render();
  }

  /** Altera explicitamente a indicação de carregamento. */
  setCarregando(carregando: boolean): void {
    this.setEstado({ carregando });
  }

  /** Altera a mensagem de erro. */
  setErro(erro: string | null): void {
    this.setEstado({ erro });
  }

  /** Define o painel como logado. */
  setLogado(email: string): void {
    this.senhaApagar = '';
    this.setEstado({ logado: true, email, carregando: false, erro: null, confirmandoApagar: false });
  }

  /** A sessão diz se a atividade é medida (só redesenha quando a escolha mudou). */
  setMedicao(medir: boolean): void {
    if (medir !== this.estado.medir) this.setEstado({ medir });
  }

  /** A sessão diz a faixa de idade da conta (só redesenha quando mudou). */
  setIdade(idade: IdadeDaConta): void {
    if (idade !== this.estado.idade) this.setEstado({ idade, erro: null });
  }

  /** Uma frase de confirmação acima das ações (`null` tira). */
  setAviso(aviso: string | null): void {
    this.setEstado({ aviso });
  }

  /** Define o painel como deslogado. */
  setDeslogado(): void {
    this.inputSenhaVal = '';
    this.senhaApagar = '';
    this.aceitePolitica = false;
    this.aceiteIdade = false;
    this.nascMes = '';
    this.nascAno = '';
    this.emailTocado = false;
    this.senhaTocada = false;
    this.setEstado({ logado: false, carregando: false, erro: null, confirmandoApagar: false });
  }

  /** Valida os campos atuais conforme o contrato. */
  validar(): { emailErro: string | null; senhaErro: string | null; valido: boolean } {
    const emailErro = validarEmail(this.inputEmailVal);
    // No "esqueci a senha" não há campo de senha: só o e-mail precisa estar certo.
    const senhaErro = this.estado.modo === 'esqueci' ? null : validarSenha(this.inputSenhaVal);
    return {
      emailErro,
      senhaErro,
      valido: emailErro === null && senhaErro === null,
    };
  }

  /** Anexa o elemento HTML do painel a um container pai. */
  attachTo(parent: HTMLElement | null): void {
    if (typeof document === 'undefined' || !parent) return;

    let el = parent.querySelector<HTMLElement>('.login-panel');
    if (!el) {
      el = document.createElement('div');
      el.className = 'login-panel';
      parent.appendChild(el);
    }
    this.containerEl = el;
    this._render();
  }

  // ─── Renderização e Eventos Internos ────────────────────────────────────────

  private _render(): void {
    if (!this.containerEl) return;

    if (this.estado.logado) {
      this._renderLogado();
    } else {
      this._renderDeslogado();
    }
  }

  private _renderLogado(): void {
    if (!this.containerEl) return;

    const emailExibicao = this.estado.email || 'Piloto Autenticado';
    const politica = this._escapeHtml(this.options.politicaUrl ?? POLITICA_URL_PADRAO);
    const carregando = this.estado.carregando;
    const senhaOk = validarSenha(this.senhaApagar) === null;
    // Apagar a conta não se desfaz: um clique abre a confirmação, que pede a senha de novo e tem o botão de desistir.
    const apagar = this.estado.confirmandoApagar
      ? `
        <div class="login-field login-apagar">
          <label for="login-input-apagar">CONFIRME COM A SENHA · APAGAR NÃO SE DESFAZ</label>
          <input type="password" id="login-input-apagar" class="login-input" placeholder="••••••••" autocomplete="current-password" value="${this._escapeHtml(this.senhaApagar)}" ${carregando ? 'disabled' : ''} />
        </div>
        <button type="button" class="btn-login-action btn-logout" id="btn-login-apagar-confirmar" ${!senhaOk || carregando ? 'disabled' : ''}>
          ${carregando ? 'APAGANDO…' : 'APAGAR A CONTA PARA SEMPRE'}
        </button>
        <button type="button" class="btn-login-action btn-login-secondary" id="btn-login-apagar-cancelar" ${carregando ? 'disabled' : ''}>
          DESISTIR
        </button>`
      : `
        <button type="button" class="btn-login-action btn-login-secondary" id="btn-login-apagar" ${carregando ? 'disabled' : ''}>
          APAGAR MINHA CONTA
        </button>`;

    this.containerEl.innerHTML = `
      <div class="login-box">
        <div class="login-header-tag">// CONTA DE PILOTO</div>
        <div class="login-user-status">
          <div class="login-user-icon">👤</div>
          <div class="login-user-info">
            <span class="login-user-label">LOGADO COMO</span>
            <span class="login-user-email">${this._escapeHtml(emailExibicao)}</span>
          </div>
        </div>

        ${this.estado.erro ? `<div class="login-error-banner" role="alert">${this._escapeHtml(this.estado.erro)}</div>` : ''}
        ${this.estado.aviso ? `<div class="login-aviso" role="status">${this._escapeHtml(this.estado.aviso)}</div>` : ''}

        ${this._blocoDaIdade()}

        <div class="login-header-tag">// MEUS DADOS</div>
        <label class="login-check">
          <input type="checkbox" id="login-check-medir" ${this.estado.medir ? 'checked' : ''} ${carregando ? 'disabled' : ''} />
          <span>Registrar minha atividade (dias jogados, minutos, abates e mortes) para as estatísticas do jogo</span>
        </label>
        <p class="login-hint">O que o jogo guarda e quais são os seus direitos: <a href="${politica}" target="_blank" rel="noopener">Política de Privacidade</a>.</p>

        <div class="login-actions-stacked">
          <button type="button" class="btn-login-action btn-login-secondary" id="btn-login-baixar" ${carregando ? 'disabled' : ''}>
            BAIXAR MEUS DADOS
          </button>
          ${apagar}
          <button type="button" class="btn-login-action btn-logout" id="btn-login-logout" ${carregando ? 'disabled' : ''}>
            ${carregando ? 'AGUARDE…' : 'SAIR DA CONTA'}
          </button>
        </div>
      </div>
    `;

    const q = <T extends HTMLElement>(id: string) => this.containerEl!.querySelector<T>(`#${id}`);
    q('btn-login-logout')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.estado.carregando) return;
      if (this.options.onSair) void this.options.onSair();
      else this.setDeslogado();
    });
    q<HTMLInputElement>('login-check-medir')?.addEventListener('change', (e) => {
      const ativa = !!(e.target as HTMLInputElement | null)?.checked;
      this.estado = { ...this.estado, medir: ativa };
      void this.options.onMedicao?.(ativa);
    });
    this._ligarCamposDeNascimento(() => {
      const botao = q<HTMLButtonElement>('btn-login-nascimento');
      if (botao) botao.disabled = this._nascimento() === null || this.estado.carregando;
    });
    q('btn-login-nascimento')?.addEventListener('click', (e) => {
      e.preventDefault();
      const nasc = this._nascimento();
      if (nasc !== null && !this.estado.carregando) void this.options.onNascimento?.(nasc);
    });
    q('btn-login-baixar')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (!this.estado.carregando) void this.options.onBaixar?.();
    });
    q('btn-login-apagar')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.senhaApagar = '';
      this.setEstado({ confirmandoApagar: true, erro: null, aviso: null });
    });
    q('btn-login-apagar-cancelar')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.senhaApagar = '';
      this.setEstado({ confirmandoApagar: false, erro: null });
    });
    q<HTMLInputElement>('login-input-apagar')?.addEventListener('input', (e) => {
      this.senhaApagar = (e.target as HTMLInputElement).value;
      // Só liga ou desliga o botão: refazer o painel a cada tecla tiraria o foco do campo.
      const botao = q<HTMLButtonElement>('btn-login-apagar-confirmar');
      if (botao) botao.disabled = validarSenha(this.senhaApagar) !== null || this.estado.carregando;
    });
    q('btn-login-apagar-confirmar')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.estado.carregando || validarSenha(this.senhaApagar) !== null) return;
      void this.options.onApagar?.(this.senhaApagar);
    });
  }

  private _renderDeslogado(): void {
    if (!this.containerEl) return;

    const { emailErro, senhaErro, valido } = this.validar();
    const mostrarEmailErro = this.emailTocado && emailErro !== null;
    const mostrarSenhaErro = this.senhaTocada && senhaErro !== null;

    if (this.estado.modo === 'esqueci') {
      this.containerEl.innerHTML = `
      <div class="login-box">
        <div class="login-header-tag">// RECUPERAR ACESSO</div>
        <form class="login-form" id="login-form-element" novalidate>
          ${this.estado.erro ? `<div class="login-error-banner" role="alert">${this._escapeHtml(this.estado.erro)}</div>` : ''}
          ${this.estado.aviso ? `<div class="login-aviso" role="status">${this._escapeHtml(this.estado.aviso)}</div>` : ''}
          <p class="login-hint">Digite o e-mail da sua conta. Se ele tiver uma conta, enviamos um link para você escolher uma senha nova. O link vale 30 minutos.</p>
          <div class="login-field">
            <label for="login-input-email">E-MAIL DO PILOTO</label>
            <input type="email" id="login-input-email" class="login-input ${mostrarEmailErro ? 'invalid' : ''}" placeholder="piloto@cybermech.com" autocomplete="email" value="${this._escapeHtml(this.inputEmailVal)}" ${this.estado.carregando ? 'disabled' : ''} />
            ${mostrarEmailErro ? `<span class="field-error">${this._escapeHtml(emailErro)}</span>` : ''}
          </div>
          <div class="login-actions-stacked">
            <button type="submit" class="btn-login-action btn-submit" id="btn-login-submit" ${!valido || this.estado.carregando ? 'disabled' : ''}>${this.estado.carregando ? 'ENVIANDO…' : 'ENVIAR LINK'}</button>
          </div>
          <button type="button" class="login-link" id="btn-login-voltar">VOLTAR PARA ENTRAR</button>
        </form>
      </div>`;
      this._bindEventsDeslogado();
      return;
    }

    const modoEntrar = this.estado.modo === 'entrar';
    const acaoTexto = modoEntrar ? 'ENTRAR' : 'CRIAR CONTA';
    const carregandoTexto = modoEntrar ? 'ENTRANDO…' : 'CRIANDO CONTA…';

    this.containerEl.innerHTML = `
      <div class="login-box">
        <div class="login-header-tag">// AUTENTICAÇÃO DE PILOTO</div>

        <!-- Abas de navegação (NUNCA botões de ação primária lado a lado) -->
        <div class="login-tabs" role="tablist">
          <button type="button" role="tab" class="login-tab ${modoEntrar ? 'active' : ''}" id="tab-login-entrar" aria-selected="${modoEntrar}">
            ENTRAR
          </button>
          <button type="button" role="tab" class="login-tab ${!modoEntrar ? 'active' : ''}" id="tab-login-criar" aria-selected="${!modoEntrar}">
            CRIAR CONTA
          </button>
        </div>

        <form class="login-form" id="login-form-element" novalidate>
          ${this.estado.erro ? `<div class="login-error-banner" role="alert">${this._escapeHtml(this.estado.erro)}</div>` : ''}
          ${this.estado.aviso ? `<div class="login-aviso" role="status">${this._escapeHtml(this.estado.aviso)}</div>` : ''}

          <div class="login-field">
            <label for="login-input-email">E-MAIL DO PILOTO</label>
            <input
              type="email"
              id="login-input-email"
              class="login-input ${mostrarEmailErro ? 'invalid' : ''}"
              placeholder="piloto@cybermech.com"
              autocomplete="email"
              value="${this._escapeHtml(this.inputEmailVal)}"
              ${this.estado.carregando ? 'disabled' : ''}
            />
            ${mostrarEmailErro ? `<span class="field-error">${this._escapeHtml(emailErro)}</span>` : ''}
          </div>

          <div class="login-field">
            <label for="login-input-senha">SENHA</label>
            <input
              type="password"
              id="login-input-senha"
              class="login-input ${mostrarSenhaErro ? 'invalid' : ''}"
              placeholder="••••••••"
              autocomplete="${modoEntrar ? 'current-password' : 'new-password'}"
              value="${this._escapeHtml(this.inputSenhaVal)}"
              ${this.estado.carregando ? 'disabled' : ''}
            />
            ${mostrarSenhaErro ? `<span class="field-error">${this._escapeHtml(senhaErro)}</span>` : ''}
          </div>

          ${modoEntrar ? '' : `
          <div class="login-field">
            <label for="login-nasc-mes">NASCIMENTO · MÊS E ANO</label>
            ${this._camposDeNascimento(this.estado.carregando)}
            <p class="login-hint">Só o mês e o ano. O chat de voz é só para maiores de 18 anos; quem tem menos joga normalmente, sem a voz.</p>
          </div>
          <div class="login-consent">
            <label class="login-check">
              <input type="checkbox" id="login-check-politica" ${this.aceitePolitica ? 'checked' : ''} ${this.estado.carregando ? 'disabled' : ''} />
              <span>Li e aceito a <a href="${this._escapeHtml(this.options.politicaUrl ?? POLITICA_URL_PADRAO)}" target="_blank" rel="noopener">Política de Privacidade</a>.</span>
            </label>
            <label class="login-check">
              <input type="checkbox" id="login-check-idade" ${this.aceiteIdade ? 'checked' : ''} ${this.estado.carregando ? 'disabled' : ''} />
              <span>Tenho 18 anos ou mais, ou um responsável autorizou.</span>
            </label>
            <p class="login-hint">Você pode baixar ou apagar tudo o que o jogo guarda da sua conta quando quiser.</p>
          </div>`}

          <!-- Um único botão de ação primária por visualização (empilhado verticalmente) -->
          <div class="login-actions-stacked">
            <button
              type="submit"
              class="btn-login-action btn-submit"
              id="btn-login-submit"
              ${!valido || (!modoEntrar && !this._aceitou()) || this.estado.carregando ? 'disabled' : ''}
            >
              ${this.estado.carregando ? carregandoTexto : acaoTexto}
            </button>
          </div>
          ${modoEntrar && this.options.onEsqueci ? '<button type="button" class="login-link" id="btn-login-esqueci">Esqueci a senha</button>' : ''}
        </form>
      </div>
    `;

    this._bindEventsDeslogado();
  }

  private _bindEventsDeslogado(): void {
    if (!this.containerEl) return;

    const tabEntrar = this.containerEl.querySelector<HTMLButtonElement>('#tab-login-entrar');
    const tabCriar = this.containerEl.querySelector<HTMLButtonElement>('#tab-login-criar');
    const inputEmail = this.containerEl.querySelector<HTMLInputElement>('#login-input-email');
    const inputSenha = this.containerEl.querySelector<HTMLInputElement>('#login-input-senha');
    const form = this.containerEl.querySelector<HTMLFormElement>('#login-form-element');
    this.containerEl.querySelector('#btn-login-esqueci')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.setEstado({ modo: 'esqueci', erro: null, aviso: null });
    });
    this.containerEl.querySelector('#btn-login-voltar')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.setEstado({ modo: 'entrar', erro: null, aviso: null });
    });
    const checkPolitica = this.containerEl.querySelector<HTMLInputElement>('#login-check-politica');
    const checkIdade = this.containerEl.querySelector<HTMLInputElement>('#login-check-idade');
    checkPolitica?.addEventListener('change', () => {
      this.aceitePolitica = !!checkPolitica.checked;
      this._atualizarEstadoSubmit();
    });
    checkIdade?.addEventListener('change', () => {
      this.aceiteIdade = !!checkIdade.checked;
      this._atualizarEstadoSubmit();
    });
    this._ligarCamposDeNascimento(() => this._atualizarEstadoSubmit());

    if (tabEntrar) {
      tabEntrar.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.estado.modo !== 'entrar') {
          this.setEstado({ modo: 'entrar', erro: null });
        }
      });
    }

    if (tabCriar) {
      tabCriar.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.estado.modo !== 'criar') {
          this.setEstado({ modo: 'criar', erro: null });
        }
      });
    }

    if (inputEmail) {
      inputEmail.addEventListener('input', () => {
        this.inputEmailVal = inputEmail.value;
        this.emailTocado = true;
        this._atualizarEstadoSubmit();
      });
      inputEmail.addEventListener('blur', () => {
        this.emailTocado = true;
        this._mostrarValidacao();
      });
    }

    if (inputSenha) {
      inputSenha.addEventListener('input', () => {
        this.inputSenhaVal = inputSenha.value;
        this.senhaTocada = true;
        this._atualizarEstadoSubmit();
      });
      inputSenha.addEventListener('blur', () => {
        this.senhaTocada = true;
        this._mostrarValidacao();
      });
    }

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.emailTocado = true;
        this.senhaTocada = true;
        const { valido } = this.validar();
        if (!valido || this.estado.carregando || (this.estado.modo === 'criar' && !this._aceitou())) {
          this._render();
          return;
        }

        const email = this.inputEmailVal.trim();
        if (this.estado.modo === 'esqueci') {
          void this.options.onEsqueci?.(email);
          return;
        }
        const senha = this.inputSenhaVal;

        if (this.estado.modo === 'entrar' && this.options.onEntrar) {
          void this.options.onEntrar(email, senha);
        } else if (this.estado.modo === 'criar' && this.options.onCriar) {
          void this.options.onCriar(email, senha, this._nascimento()!);
        }
      });
    }
  }

  /**
   * Mostra (ou tira) o aviso de cada campo **sem refazer o painel**. Antes o `blur` chamava `_render()`, que troca o DOM inteiro: o campo para onde o foco ia (clicar na senha logo depois
   * do e-mail) e o botão sob o clique (clicar em ENTRAR logo depois da senha: mousedown e mouseup caíam em nós diferentes) eram destruídos, e o clique se perdia. (P174: achado ao ligar o
   * painel ao jogo e testar no navegador de verdade.)
   */
  private _mostrarValidacao(): void {
    if (!this.containerEl) return;
    const { emailErro, senhaErro } = this.validar();
    const campos: Array<[string, boolean, string | null]> = [
      ['login-input-email', this.emailTocado, emailErro],
      ['login-input-senha', this.senhaTocada, senhaErro],
    ];
    for (const [id, tocado, erro] of campos) {
      const input = this.containerEl.querySelector<HTMLInputElement>(`#${id}`);
      const campo = input?.parentElement;
      if (!input || !campo) continue;
      const mostrar = tocado && erro !== null;
      input.classList.toggle('invalid', mostrar);
      let aviso = campo.querySelector<HTMLElement>('.field-error');
      if (mostrar) {
        if (!aviso) {
          aviso = document.createElement('span');
          aviso.className = 'field-error';
          campo.appendChild(aviso);
        }
        aviso.textContent = erro;
      } else {
        aviso?.remove();
      }
    }
  }

  private _atualizarEstadoSubmit(): void {
    if (!this.containerEl) return;
    const btnSubmit = this.containerEl.querySelector<HTMLButtonElement>('#btn-login-submit');
    const { valido } = this.validar();
    if (btnSubmit) {
      btnSubmit.disabled = !valido || (this.estado.modo === 'criar' && !this._aceitou()) || this.estado.carregando;
    }
  }

  /** O criar conta está completo: as duas caixas marcadas e o mês e o ano escolhidos? (O servidor recusa sem o aceite: isto só evita o clique que não leva a nada.) */
  private _aceitou(): boolean {
    return this.aceitePolitica && this.aceiteIdade && this._nascimento() !== null;
  }

  /** O `AAAA-MM` do que está escolhido nas listas, ou `null` se falta o mês, o ano, ou não vale. */
  private _nascimento(): string | null {
    if (!this.nascMes || !this.nascAno) return null;
    return validarNascimento(`${this.nascAno}-${this.nascMes.padStart(2, '0')}`);
  }

  /** As duas listas, mês e ano (números: servem a toda língua). O ano vai do atual até 100 atrás. */
  private _camposDeNascimento(desligado: boolean): string {
    const meses = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${this.nascMes === String(i + 1) ? 'selected' : ''}>${String(i + 1).padStart(2, '0')}</option>`).join('');
    const atual = new Date().getFullYear();
    const anos = Array.from({ length: 101 }, (_, i) => `<option value="${atual - i}" ${this.nascAno === String(atual - i) ? 'selected' : ''}>${atual - i}</option>`).join('');
    return `<div class="login-nasc">
              <select id="login-nasc-mes" class="login-input" aria-label="MÊS" ${desligado ? 'disabled' : ''}><option value="">MÊS</option>${meses}</select>
              <select id="login-nasc-ano" class="login-input" aria-label="ANO" ${desligado ? 'disabled' : ''}><option value="">ANO</option>${anos}</select>
            </div>`;
  }

  private _ligarCamposDeNascimento(aoMudar: () => void): void {
    const mes = this.containerEl?.querySelector<HTMLSelectElement>('#login-nasc-mes');
    const ano = this.containerEl?.querySelector<HTMLSelectElement>('#login-nasc-ano');
    mes?.addEventListener('change', () => {
      this.nascMes = mes.value;
      aoMudar();
    });
    ano?.addEventListener('change', () => {
      this.nascAno = ano.value;
      aoMudar();
    });
  }

  /** Logado: `sem-idade` pede o mês e o ano (uma vez); `menor` explica que não há voz; `adulto` não mostra nada. */
  private _blocoDaIdade(): string {
    const { idade, carregando } = this.estado;
    if (idade === 'menor') return VOZ_SO_PARA_ADULTO_DECLARADO ? '<p class="login-hint login-idade">Conta de menor de 18 anos: sem chat de voz (nem o microfone, nem a voz dos outros jogadores). O áudio do jogo segue normal.</p>' : '<p class="login-hint login-idade">Conta de menor de 18 anos: o chat de voz só ouve (sem microfone). O áudio do jogo segue normal.</p>';
    if (idade !== 'sem-idade') return '';
    return `<div class="login-header-tag">// IDADE</div>
        <p class="login-hint">${VOZ_SO_PARA_ADULTO_DECLARADO ? 'Informe o mês e o ano de nascimento para liberar o chat de voz. Quem tem menos de 18 anos joga sem ele.' : 'Informe o mês e o ano de nascimento da sua conta. Quem tem menos de 18 anos só ouve o chat de voz, sem microfone.'} Só dá para informar uma vez.</p>
        <div class="login-field">
          ${this._camposDeNascimento(carregando)}
        </div>
        <button type="button" class="btn-login-action btn-login-secondary" id="btn-login-nascimento" ${this._nascimento() === null || carregando ? 'disabled' : ''}>GUARDAR A IDADE</button>`;
  }

  private _escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
