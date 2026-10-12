import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LoginPanel } from './LoginPanel';

// Mock simples de DOM para rodar os testes da UI no ambiente de teste Node puro do Vitest (G14)
class MockNode {
  id = '';
  className = '';
  type = '';
  value = '';
  disabled = false;
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
});
