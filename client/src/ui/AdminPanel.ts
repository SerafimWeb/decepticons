import { browserStorage } from '../core/Settings';
import { sessaoDeAdminGuardada, TokenDoDono } from '../net/admin';
import { ContaCliente } from '../net/auth';
import { CHASSIS, type ChassisId } from '../entities/chassis';

export class AdminPanel {
  private root: HTMLElement;
  private readonly client: ContaCliente;
  private token: string | null = null;
  /** P106: a sessão do admin vai para o mesmo lugar da chave do dono; o painel do servidor e o mural passam a valer sem colar chave nenhuma. */
  private readonly guarda: TokenDoDono;
  private lockedMechs: Set<ChassisId> = new Set();
  
  constructor(private readonly onChange: (locked: Set<ChassisId>) => void) {
    this.client = new ContaCliente(import.meta.env.VITE_GAME_SERVER);
    // A sessão é guardada na chave do servidor que a EMITIU (o mesmo do ContaCliente acima), nunca na do `?servidor=` do link: um link de terceiros
    // apontando para outro servidor não encontra a sessão do admin e não a recebe (o painel do servidor só a envia ao servidor da própria chave).
    this.guarda = new TokenDoDono(browserStorage(), import.meta.env.VITE_GAME_SERVER);
    this.root = document.createElement('div');
    this.root.className = 'admin-modal hidden';
    this.root.innerHTML = `
      <div class="admin-content">
        <header>
          <h2>CENTRAL DE COMANDO</h2>
          <button type="button" data-action="close">×</button>
        </header>
        <div id="admin-body"></div>
      </div>
    `;
    document.body.appendChild(this.root);

    this.root.addEventListener('click', (e) => this.onClick(e));

    // Estilos do painel admin (injetados apenas uma vez)
    if (!document.getElementById('admin-style')) {
      const style = document.createElement('style');
      style.id = 'admin-style';
      style.textContent = `
        .admin-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 10000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
        .admin-modal.hidden { display: none; }
        .admin-content { background: #111; border: 1px solid var(--accent); padding: 24px; width: 400px; color: #fff; font-family: var(--font-mono); }
        .admin-content header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; padding-bottom: 12px; margin-bottom: 16px; }
        .admin-content h2 { margin: 0; font-size: 16px; color: var(--accent); }
        .admin-content header button { background: none; border: none; color: #fff; font-size: 24px; cursor: pointer; padding: 0; line-height: 1; }
        .admin-form { display: flex; flex-direction: column; gap: 12px; }
        .admin-form input { background: #222; border: 1px solid #444; color: #fff; padding: 10px; font-family: var(--font-mono); outline: none; }
        .admin-form input:focus { border-color: var(--accent); }
        .admin-form button { background: var(--accent); color: #000; border: none; padding: 10px; font-weight: bold; cursor: pointer; transition: opacity 0.2s; }
        .admin-form button:hover { opacity: 0.8; }
        .admin-error { color: #ff4444; font-size: 12px; height: 14px; }
        .admin-mech-list { display: flex; flex-direction: column; gap: 8px; max-height: 400px; overflow-y: auto; }
        .admin-mech-item { display: flex; justify-content: space-between; align-items: center; background: #222; padding: 10px; border-left: 2px solid transparent; }
        .admin-mech-item.locked { border-left-color: #ff4444; opacity: 0.7; }
        .admin-mech-item.unlocked { border-left-color: #44ff44; }
        .admin-mech-item button { background: #333; color: #fff; border: 1px solid #555; padding: 6px 12px; cursor: pointer; font-size: 11px; font-weight: bold; }
        .admin-mech-item button:hover { background: #444; }
      `;
      document.head.appendChild(style);
    }
  }

  async loadConfig(): Promise<Set<ChassisId>> {
    const raw = await this.client.lerConfig('chassis_status');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) this.lockedMechs = new Set(parsed);
      } catch {}
    }
    return this.lockedMechs;
  }

  open() {
    this.root.classList.remove('hidden');
    this.render();
    // Já entrou como admin antes (ou no painel do servidor)? A sessão guardada evita pedir e-mail e senha de novo.
    if (!this.token) {
      void sessaoDeAdminGuardada(this.guarda, this.client).then((sessao) => {
        if (sessao && !this.token) {
          this.token = sessao;
          this.render();
        }
      });
    }
  }

  private close() {
    this.root.classList.add('hidden');
  }

  private render() {
    const body = this.root.querySelector('#admin-body')!;
    if (!this.token) {
      body.innerHTML = `
        <div class="admin-form">
          <label>ACESSO RESTRITO</label>
          <input type="email" id="admin-email" placeholder="E-mail" autocomplete="off">
          <input type="password" id="admin-pass" placeholder="Senha">
          <div class="admin-error" id="admin-error"></div>
          <button type="button" data-action="login">ENTRAR</button>
        </div>
      `;
    } else {
      const isOficina = (id: string) => CHASSIS[id as ChassisId].status === 'oficina';
      const items = (Object.keys(CHASSIS) as ChassisId[])
        .filter(id => isOficina(id)) // Só mostra mechs quebrados/oficina
        .map(id => {
          // Para simplificar, o array `chassis_status` salvará os IDs que estão destrancados (apesar de oficina).
          const isUnlocked = this.lockedMechs.has(id); 
          return `
            <div class="admin-mech-item ${isUnlocked ? 'unlocked' : 'locked'}">
              <span>${id.toUpperCase()}</span>
              <button type="button" data-action="toggle" data-id="${id}">${isUnlocked ? 'BLOQUEAR (OFF)' : 'LIBERAR (ON)'}</button>
            </div>
          `;
        }).join('');
      body.innerHTML = `
        <p style="font-size: 11px; color: #888; margin-bottom: 12px;">GERENCIAR ACESSO (MECHS EM OFICINA)</p>
        <div class="admin-mech-list">${items || 'Nenhum Mech na oficina.'}</div>
      `;
    }
  }

  private async onClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    const action = target.closest('[data-action]')?.getAttribute('data-action');
    if (action === 'close') {
      this.close();
    } else if (action === 'login') {
      const email = (this.root.querySelector('#admin-email') as HTMLInputElement).value;
      const pass = (this.root.querySelector('#admin-pass') as HTMLInputElement).value;
      const err = this.root.querySelector('#admin-error')!;
      err.textContent = 'Autenticando...';
      const res = await this.client.entrar(email, pass);
      if ('erro' in res) {
        err.textContent = res.erro;
      } else if (!res.is_admin) {
        err.textContent = 'Conta não tem permissão de Admin.';
      } else {
        this.token = res.token;
        this.guarda.gravar(res.token);
        this.render();
      }
    } else if (action === 'toggle') {
      const id = target.getAttribute('data-id') as ChassisId;
      if (this.lockedMechs.has(id)) {
        this.lockedMechs.delete(id); // Tranca
      } else {
        this.lockedMechs.add(id); // Destranca
      }
      target.textContent = '...';
      const ok = await this.client.salvarConfig(this.token!, 'chassis_status', JSON.stringify(Array.from(this.lockedMechs)));
      if (ok) {
        this.onChange(this.lockedMechs);
        this.render();
      } else {
        target.textContent = 'ERRO';
      }
    }
  }
}
