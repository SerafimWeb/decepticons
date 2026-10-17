import { validarEmail, validarSenha } from '../../../shared/net/auth';

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
 * - NUNCA exibe a senha em logs
 * - NUNCA coloca dois botões de ação primária lado a lado (layout vertical único)
 * - Responsivo e pronto para dispositivos móveis
 */

export type LoginModo = 'entrar' | 'criar';

export interface LoginPanelEstado {
  logado: boolean;
  email: string;
  modo: LoginModo;
  carregando: boolean;
  erro: string | null;
}

export interface LoginPanelOptions {
  onEntrar?: (email: string, senha: string) => Promise<void> | void;
  onCriar?: (email: string, senha: string) => Promise<void> | void;
  onSair?: () => Promise<void> | void;
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

  constructor(options: LoginPanelOptions = {}, parent: HTMLElement | null = null) {
    this.options = options;
    this.estado = {
      logado: false,
      email: '',
      modo: 'entrar',
      carregando: false,
      erro: null,
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
    this.setEstado({ logado: true, email, carregando: false, erro: null });
  }

  /** Define o painel como deslogado. */
  setDeslogado(): void {
    this.inputSenhaVal = '';
    this.emailTocado = false;
    this.senhaTocada = false;
    this.setEstado({ logado: false, carregando: false, erro: null });
  }

  /** Valida os campos atuais conforme o contrato. */
  validar(): { emailErro: string | null; senhaErro: string | null; valido: boolean } {
    const emailErro = validarEmail(this.inputEmailVal);
    const senhaErro = validarSenha(this.inputSenhaVal);
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

        <div class="login-actions-stacked">
          <button type="button" class="btn-login-action btn-logout" id="btn-login-logout" ${this.estado.carregando ? 'disabled' : ''}>
            ${this.estado.carregando ? 'ENCERRANDO SESSÃO…' : 'SAIR DA CONTA'}
          </button>
        </div>
      </div>
    `;

    const btnLogout = this.containerEl.querySelector<HTMLButtonElement>('#btn-login-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.estado.carregando) return;
        if (this.options.onSair) {
          void this.options.onSair();
        } else {
          this.setDeslogado();
        }
      });
    }
  }

  private _renderDeslogado(): void {
    if (!this.containerEl) return;

    const { emailErro, senhaErro, valido } = this.validar();
    const mostrarEmailErro = this.emailTocado && emailErro !== null;
    const mostrarSenhaErro = this.senhaTocada && senhaErro !== null;

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

          <!-- Um único botão de ação primária por visualização (empilhado verticalmente) -->
          <div class="login-actions-stacked">
            <button
              type="submit"
              class="btn-login-action btn-submit"
              id="btn-login-submit"
              ${!valido || this.estado.carregando ? 'disabled' : ''}
            >
              ${this.estado.carregando ? carregandoTexto : acaoTexto}
            </button>
          </div>
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
        if (!valido || this.estado.carregando) {
          this._render();
          return;
        }

        const email = this.inputEmailVal.trim();
        const senha = this.inputSenhaVal;

        if (this.estado.modo === 'entrar' && this.options.onEntrar) {
          void this.options.onEntrar(email, senha);
        } else if (this.estado.modo === 'criar' && this.options.onCriar) {
          void this.options.onCriar(email, senha);
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
      btnSubmit.disabled = !valido || this.estado.carregando;
    }
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
