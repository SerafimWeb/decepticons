import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LoginPanel } from './LoginPanel';

// Mock simples de DOM para rodar os testes da UI no ambiente de teste Node puro do Vitest (G14)
class MockNode {
  id = '';
  className = '';
  type = '';
  value = '';
  disabled = false;
  checked = false;
  role = '';
  ariaSelected = 'false';
  listeners: Record<string, ((e: any) => void)[]> = {};
  children: MockNode[] = [];
  parentElement: MockNode | null = null;
  private _innerHTML = '';

  constructor(public tagName = 'DIV') {}

  get innerHTML(): string {
    return this._innerHTML;
  }

  set innerHTML(html: string) {
    this._innerHTML = html;
    this.children = [];
    this._parseHtml(html);
  }

  get textContent(): string {
    if (this.children.length === 0) return this._innerHTML.replace(/<[^>]*>/g, '').trim();
    return this.children.map((c) => c.textContent).join(' ').trim();
  }

  set textContent(texto: string) {
    this._innerHTML = texto;
    this.children = [];
  }

  /** O mínimo de `classList` que a tela usa (`toggle`), sobre o `className` do nó. */
  readonly classList = {
    toggle: (nome: string, ligado: boolean): void => {
      const nomes = this.className.split(/\s+/).filter(Boolean).filter((n) => n !== nome);
      if (ligado) nomes.push(nome);
      this.className = nomes.join(' ');
    },
  };

  remove(): void {
    if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((c) => c !== this);
  }

  appendChild(child: MockNode): MockNode {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  querySelector<T extends MockNode = MockNode>(selector: string): T | null {
    const all = this.querySelectorAll<T>(selector);
    return all.length > 0 ? all[0] : null;
  }

  querySelectorAll<T extends MockNode = MockNode>(selector: string): T[] {
    const results: T[] = [];

    const check = (node: MockNode) => {
      if (selector.startsWith('#') && node.id === selector.slice(1)) {
        results.push(node as unknown as T);
      } else if (selector.startsWith('.') && node.className.split(/\s+/).includes(selector.slice(1))) {
        results.push(node as unknown as T);
      } else if (selector === 'button' && node.tagName === 'BUTTON') {
        results.push(node as unknown as T);
      }
      for (const child of node.children) {
        check(child);
      }
    };

    for (const child of this.children) {
      check(child);
    }
    return results;
  }

  addEventListener(event: string, fn: (e: any) => void): void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }

  dispatchEvent(event: any): boolean {
    const type = typeof event === 'string' ? event : event.type;
    const list = this.listeners[type] || [];
    const evtObj = {
      type,
      preventDefault: () => {},
      stopPropagation: () => {},
      target: this,
    };
    for (const fn of list) {
      fn(evtObj);
    }
    return true;
  }

  click(): void {
    this.dispatchEvent('click');
  }

  private _parseHtml(html: string): void {
    // Regex simples para extrair elementos com id, class, type, etc. para os testes da UI
    const tagRegex = /<([a-z0-9]+)([^>]*)>([\s\S]*?)<\/\1>|<([a-z0-9]+)([^>]*)\/>/gi;
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(html)) !== null) {
      const tagName = (match[1] || match[4]).toUpperCase();
      const attrsStr = match[2] || match[5] || '';
      const content = match[3] || '';

      const node = new MockNode(tagName);

      const idMatch = /id=["']([^"']+)["']/i.exec(attrsStr);
      if (idMatch) node.id = idMatch[1];

      const classMatch = /class=["']([^"']+)["']/i.exec(attrsStr);
      if (classMatch) node.className = classMatch[1];

      const typeMatch = /type=["']([^"']+)["']/i.exec(attrsStr);
      if (typeMatch) node.type = typeMatch[1];

      const valueMatch = /value=["']([^"']*)["']/i.exec(attrsStr);
      if (valueMatch) node.value = valueMatch[1];

      if (/\bdisabled\b/i.test(attrsStr)) node.disabled = true;
      if (/\bchecked\b/i.test(attrsStr)) node.checked = true;

      node.innerHTML = content;
      this.appendChild(node);
    }
  }
}

if (typeof globalThis.document === 'undefined') {
  const elementsById: Record<string, MockNode> = {};

  (globalThis as any).document = {
    createElement: (tag: string) => new MockNode(tag.toUpperCase()),
    getElementById: (id: string) => elementsById[id] || null,
  };
  (globalThis as any).Event = class Event {
    constructor(public type: string) {}
  };
}

describe('LoginPanel — Autenticação de Piloto (P33)', () => {
  let parent: MockNode;

  beforeEach(() => {
    parent = (globalThis as any).document.createElement('div');
  });

  it('inicia por padrão no modo deslogado e com aba entrar', () => {
    const panel = new LoginPanel();
    const estado = panel.getEstado();

    expect(estado.logado).toBe(false);
    expect(estado.modo).toBe('entrar');
    expect(estado.carregando).toBe(false);
    expect(estado.erro).toBeNull();
  });

  it('valida e-mail e senha conforme as regras do contrato (validarEmail e validarSenha)', () => {
    const panel = new LoginPanel({}, parent as any);

    // Inicialmente sem preencher
    let res = panel.validar();
    expect(res.valido).toBe(false);
    expect(res.emailErro).toBe('e-mail inválido');
    expect(res.senhaErro).toBe('senha precisa de pelo menos 8 caracteres');

    // Com e-mail e senha válidos
    panel.setEstado({ email: 'piloto@cybermech.com' });
    const inputSenha = parent.querySelector('#login-input-senha')!;
    inputSenha.value = 'senha12345';
    inputSenha.dispatchEvent(new Event('input'));

    res = panel.validar();
    expect(res.valido).toBe(true);
    expect(res.emailErro).toBeNull();
    expect(res.senhaErro).toBeNull();
  });

  it('permite trocar de aba entre entrar e criar conta', () => {
    const panel = new LoginPanel({}, parent as any);

    expect(panel.getEstado().modo).toBe('entrar');

    const tabCriar = parent.querySelector('#tab-login-criar')!;
    tabCriar.click();

    expect(panel.getEstado().modo).toBe('criar');

    const tabEntrar = parent.querySelector('#tab-login-entrar')!;
    tabEntrar.click();

    expect(panel.getEstado().modo).toBe('entrar');
  });

  it('dispara callback onEntrar com e-mail e senha válidos', () => {
    const onEntrar = vi.fn();
    const panel = new LoginPanel({ onEntrar }, parent as any);
    expect(panel.getEstado().modo).toBe('entrar');

    const inputEmail = parent.querySelector('#login-input-email')!;
    const inputSenha = parent.querySelector('#login-input-senha')!;
    const form = parent.querySelector('#login-form-element')!;

    inputEmail.value = 'ace@cybermech.com';
    inputEmail.dispatchEvent(new Event('input'));

    inputSenha.value = 'segredo123';
    inputSenha.dispatchEvent(new Event('input'));

    form.dispatchEvent(new Event('submit'));

    expect(onEntrar).toHaveBeenCalledWith('ace@cybermech.com', 'segredo123');
  });

  it('dispara callback onCriar no modo criar conta', () => {
    const onCriar = vi.fn();
    const panel = new LoginPanel({ onCriar }, parent as any);

    panel.setEstado({ modo: 'criar' });
    expect(panel.getEstado().modo).toBe('criar');

    const inputEmail = parent.querySelector('#login-input-email')!;
    const inputSenha = parent.querySelector('#login-input-senha')!;
    const form = parent.querySelector('#login-form-element')!;

    inputEmail.value = 'novo@cybermech.com';
    inputEmail.dispatchEvent(new Event('input'));

    inputSenha.value = 'minhasenha123';
    inputSenha.dispatchEvent(new Event('input'));

    // criar conta pede as duas caixas (P187)
    const politica = parent.querySelector('#login-check-politica')!;
    const idade = parent.querySelector('#login-check-idade')!;
    politica.checked = true;
    politica.dispatchEvent(new Event('change'));
    idade.checked = true;
    idade.dispatchEvent(new Event('change'));

    form.dispatchEvent(new Event('submit'));

    expect(onCriar).toHaveBeenCalledWith('novo@cybermech.com', 'minhasenha123');
  });

  it('exibe estado de carregando e desabilita o botão submit', () => {
    const panel = new LoginPanel({}, parent as any);

    panel.setCarregando(true);

    const btnSubmit = parent.querySelector('#btn-login-submit')!;
    expect(btnSubmit.disabled).toBe(true);
    expect(btnSubmit.textContent).toContain('ENTRANDO…');
  });

  it('exibe mensagem de erro quando informada', () => {
    const panel = new LoginPanel({}, parent as any);

    panel.setErro('credenciais inválidas');

    const errorBanner = parent.querySelector('.login-error-banner')!;
    expect(errorBanner).not.toBeNull();
    expect(errorBanner.textContent).toBe('credenciais inválidas');
  });

  it('exibe estado logado com o e-mail do usuário e botão sair', () => {
    const onSair = vi.fn();
    const panel = new LoginPanel({ onSair }, parent as any);

    panel.setLogado('comandante@cybermech.com');

    expect(panel.getEstado().logado).toBe(true);
    expect(panel.getEstado().email).toBe('comandante@cybermech.com');

    const userEmailEl = parent.querySelector('.login-user-email')!;
    expect(userEmailEl.textContent).toBe('comandante@cybermech.com');

    const btnLogout = parent.querySelector('#btn-login-logout')!;
    btnLogout.click();

    expect(onSair).toHaveBeenCalled();
  });

  it('o blur não refaz o painel: o campo da senha e o botão seguem os mesmos nós (refazer o DOM engolia o clique em ENTRAR logo depois da senha)', () => {
    const panel = new LoginPanel({}, parent as any);
    const email = parent.querySelector('#login-input-email')!;
    const senha = parent.querySelector('#login-input-senha')!;
    const botao = parent.querySelector('#btn-login-submit')!;
    email.value = 'errado';
    email.dispatchEvent(new Event('input'));
    email.dispatchEvent(new Event('blur'));
    senha.dispatchEvent(new Event('blur'));
    expect(parent.querySelector('#login-input-email')).toBe(email);
    expect(parent.querySelector('#login-input-senha')).toBe(senha);
    expect(parent.querySelector('#btn-login-submit')).toBe(botao);
    expect(panel.getEstado().carregando).toBe(false);
  });

  it('o blur mostra o aviso do campo tocado no lugar, e digitar certo e dar blur de novo o tira', () => {
    new LoginPanel({}, parent as any);
    const email = parent.querySelector('#login-input-email')!;
    email.value = 'errado';
    email.dispatchEvent(new Event('input'));
    email.dispatchEvent(new Event('blur'));
    expect(parent.querySelectorAll('.field-error')).toHaveLength(1);
    expect(parent.querySelector('.field-error')!.textContent).toBe('e-mail inválido');
    expect(email.className).toContain('invalid');
    // sem tocar na senha, o aviso dela não aparece
    expect(parent.querySelector('#login-input-senha')!.className).not.toContain('invalid');
    email.value = 'piloto@cybermech.com';
    email.dispatchEvent(new Event('input'));
    email.dispatchEvent(new Event('blur'));
    expect(parent.querySelectorAll('.field-error')).toHaveLength(0);
    expect(email.className).not.toContain('invalid');
  });
});

describe('LoginPanel — LGPD (P187): aceite ao criar e "Meus dados" na conta', () => {
  let parent: MockNode;
  beforeEach(() => {
    parent = (globalThis as any).document.createElement('div');
  });
  const marcar = (id: string, valor: boolean) => {
    const caixa = parent.querySelector(id)!;
    caixa.checked = valor;
    caixa.dispatchEvent(new Event('change'));
  };
  const preencher = () => {
    const email = parent.querySelector('#login-input-email')!;
    email.value = 'novo@cybermech.com';
    email.dispatchEvent(new Event('input'));
    const senha = parent.querySelector('#login-input-senha')!;
    senha.value = 'minhasenha123';
    senha.dispatchEvent(new Event('input'));
  };

  it('criar conta: sem as duas caixas o botão fica desligado e o envio não acontece; com as duas, acontece', () => {
    const onCriar = vi.fn();
    const panel = new LoginPanel({ onCriar }, parent as any);
    panel.setEstado({ modo: 'criar' });
    preencher();
    expect(parent.querySelector('#btn-login-submit')!.disabled).toBe(true);
    parent.querySelector('#login-form-element')!.dispatchEvent(new Event('submit'));
    expect(onCriar).not.toHaveBeenCalled();
    marcar('#login-check-politica', true);
    expect(parent.querySelector('#btn-login-submit')!.disabled, 'só a política: ainda não').toBe(true);
    marcar('#login-check-idade', true);
    expect(parent.querySelector('#btn-login-submit')!.disabled).toBe(false);
    marcar('#login-check-politica', false);
    expect(parent.querySelector('#btn-login-submit')!.disabled, 'desmarcar desliga de novo').toBe(true);
    marcar('#login-check-politica', true);
    parent.querySelector('#login-form-element')!.dispatchEvent(new Event('submit'));
    expect(onCriar).toHaveBeenCalledWith('novo@cybermech.com', 'minhasenha123');
  });

  it('entrar não pede o aceite (quem já tem conta já aceitou), e o link da política aponta para o site', () => {
    const onEntrar = vi.fn();
    new LoginPanel({ onEntrar }, parent as any);
    expect(parent.querySelector('#login-check-politica')).toBeNull();
    preencher();
    parent.querySelector('#login-form-element')!.dispatchEvent(new Event('submit'));
    expect(onEntrar).toHaveBeenCalled();
    const painel = new LoginPanel({}, (globalThis as any).document.createElement('div') as any);
    painel.setEstado({ modo: 'criar' });
    const html = (painel as any).containerEl.innerHTML as string;
    expect(html).toContain('href="https://cybermech.online/privacidade/"');
    expect(html).toContain('rel="noopener"');
    const outro = new LoginPanel({ politicaUrl: 'https://exemplo.test/p?a=1&b="2"' }, (globalThis as any).document.createElement('div') as any);
    outro.setEstado({ modo: 'criar' });
    expect((outro as any).containerEl.innerHTML).toContain('href="https://exemplo.test/p?a=1&amp;b=&quot;2&quot;"'); // o endereço é escapado
  });

  it('sair da tela de criar (ou da conta) esquece as caixas: a próxima conta exige o aceite de novo', () => {
    const panel = new LoginPanel({}, parent as any);
    panel.setEstado({ modo: 'criar' });
    marcar('#login-check-politica', true);
    marcar('#login-check-idade', true);
    panel.setLogado('a@b.com');
    panel.setDeslogado();
    panel.setEstado({ modo: 'criar' });
    expect(parent.querySelector('#login-check-politica')!.checked).toBe(false);
    expect(parent.querySelector('#login-check-idade')!.checked).toBe(false);
  });

  it('logado: o bloco "Meus dados" mostra a escolha da medição e avisa quando ela muda', () => {
    const onMedicao = vi.fn();
    const panel = new LoginPanel({ onMedicao }, parent as any);
    panel.setLogado('a@b.com');
    const caixa = parent.querySelector('#login-check-medir')!;
    expect(caixa.checked).toBe(true);
    caixa.checked = false;
    caixa.dispatchEvent(new Event('change'));
    expect(onMedicao).toHaveBeenCalledWith(false);
    panel.setMedicao(false);
    expect(parent.querySelector('#login-check-medir')!.checked).toBe(false);
    panel.setMedicao(true);
    expect(parent.querySelector('#login-check-medir')!.checked).toBe(true);
  });

  it('baixar os dados: o botão chama onBaixar; desligado enquanto carrega', () => {
    const onBaixar = vi.fn();
    const panel = new LoginPanel({ onBaixar }, parent as any);
    panel.setLogado('a@b.com');
    parent.querySelector('#btn-login-baixar')!.click();
    expect(onBaixar).toHaveBeenCalledTimes(1);
    panel.setCarregando(true);
    expect(parent.querySelector('#btn-login-baixar')!.disabled).toBe(true);
  });

  it('apagar a conta: um clique só abre a confirmação (nada é apagado); a senha curta não confirma; desistir fecha; a senha certa chama onApagar', () => {
    const onApagar = vi.fn();
    const panel = new LoginPanel({ onApagar }, parent as any);
    panel.setLogado('a@b.com');
    expect(parent.querySelector('#login-input-apagar')).toBeNull();
    parent.querySelector('#btn-login-apagar')!.click();
    expect(onApagar).not.toHaveBeenCalled();
    expect(panel.getEstado().confirmandoApagar).toBe(true);
    const campo = parent.querySelector('#login-input-apagar')!;
    const confirmar = parent.querySelector('#btn-login-apagar-confirmar')!;
    expect(confirmar.disabled).toBe(true);
    campo.value = 'curta';
    campo.dispatchEvent(new Event('input'));
    expect(parent.querySelector('#btn-login-apagar-confirmar')).toBe(confirmar); // digitar não refaz o painel (o foco ficaria sem campo)
    expect(confirmar.disabled).toBe(true);
    confirmar.click();
    expect(onApagar).not.toHaveBeenCalled();
    parent.querySelector('#btn-login-apagar-cancelar')!.click();
    expect(panel.getEstado().confirmandoApagar).toBe(false);
    expect(parent.querySelector('#login-input-apagar')).toBeNull();
    parent.querySelector('#btn-login-apagar')!.click();
    const campo2 = parent.querySelector('#login-input-apagar')!;
    expect(campo2.value, 'a senha de antes não fica').toBe('');
    campo2.value = 'senhasegura';
    campo2.dispatchEvent(new Event('input'));
    const confirmar2 = parent.querySelector('#btn-login-apagar-confirmar')!;
    expect(confirmar2.disabled).toBe(false);
    confirmar2.click();
    expect(onApagar).toHaveBeenCalledWith('senhasegura');
  });

  it('a frase de confirmação aparece e some ao trocar de tela; a conta apagada volta ao painel de convidado com o aviso', () => {
    const panel = new LoginPanel({}, parent as any);
    panel.setLogado('a@b.com');
    panel.setAviso('Pronto: baixado.');
    expect(parent.querySelector('.login-aviso')!.textContent).toBe('Pronto: baixado.');
    panel.setDeslogado();
    expect(parent.querySelector('.login-aviso')).toBeNull();
    panel.setAviso('Conta apagada.');
    expect(parent.querySelector('.login-aviso')!.textContent).toBe('Conta apagada.');
    panel.setEstado({ modo: 'criar' });
    expect(parent.querySelector('.login-aviso')).toBeNull();
  });
});
