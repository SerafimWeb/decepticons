import { serverHttpUrl } from '../../../shared/net/serverUrl';
import {
  CONTA_CRIAR_PATH,
  CONTA_ENTRAR_PATH,
  CONTA_EU_PATH,
  CONTA_PROGRESSO_PATH,
  CONTA_SAIR_PATH,
  CONFIG_PATH,
  ADMIN_CONFIG_PATH,
  type ContaResposta,
  type ProgressoPiloto,
  SESSAO_HEADER,
  validarProgresso,
} from '../../../shared/net/auth';

/**
 * Chamadas de conta (G3: módulo independente, sem UI — a tela de login/cadastro é outra frente). Contra o
 * mesmo servidor de jogo que já responde `/status` e `/evento`. Sem servidor configurado, toda chamada
 * devolve `{ erro: 'sem servidor' }` sem tentar rede nenhuma.
 *
 * O token de sessão é responsabilidade de quem chama guardar (ex.: `localStorage`) — este módulo não decide
 * onde persistir, só fala com o servidor.
 */
export type ContaErro = { erro: string };

export class ContaCliente {
  private readonly base: string | null;

  constructor(gameServer: string | undefined | null) {
    // Os quatro caminhos vivem na mesma origem; guardamos só a origem e montamos o caminho por chamada.
    const url = serverHttpUrl(gameServer, '/');
    this.base = url ? url.replace(/\/$/, '') : null;
  }

  criar(email: string, senha: string): Promise<ContaResposta | ContaErro> {
    return this.postCredenciais(CONTA_CRIAR_PATH, email, senha);
  }

  entrar(email: string, senha: string): Promise<ContaResposta | ContaErro> {
    return this.postCredenciais(CONTA_ENTRAR_PATH, email, senha);
  }

  async sair(token: string): Promise<void> {
    if (!this.base) return;
    try {
      await fetch(this.base + CONTA_SAIR_PATH, { method: 'POST', headers: { [SESSAO_HEADER]: token }, mode: 'cors' });
    } catch {
      // O jogador já vai perder o token localmente; se o servidor não recebeu o aviso, a sessão expira sozinha.
    }
  }

  /** Confere se o token ainda vale, e devolve o e-mail (e se é admin) se sim. `null` = sem sessão (token ruim, expirado, ou
   * sem servidor) — nunca lança. */
  async eu(token: string): Promise<{ email: string; is_admin: boolean } | null> {
    if (!this.base || !token) return null;
    try {
      const res = await fetch(this.base + CONTA_EU_PATH, { headers: { [SESSAO_HEADER]: token }, mode: 'cors', cache: 'no-store' });
      if (!res.ok) return null;
      const dados = await res.json();
      return typeof dados?.email === 'string' ? { email: dados.email, is_admin: dados.is_admin === true } : null;
    } catch {
      return null;
    }
  }

  /**
   * O progresso que a conta guarda (P174). `{ progresso: null }` = a conta ainda não guardou nada; `null` = não deu para saber (sem sessão, sem servidor, rede): quem chama não
   * mexe em nada. Nunca lança. O que volta passa pelo mesmo contrato do servidor (`validarProgresso`): um servidor estranho não injeta lixo no navegador.
   */
  async lerProgresso(token: string): Promise<{ progresso: ProgressoPiloto | null } | null> {
    if (!this.base || !token) return null;
    try {
      const res = await fetch(this.base + CONTA_PROGRESSO_PATH, { headers: { [SESSAO_HEADER]: token }, mode: 'cors', cache: 'no-store' });
      if (!res.ok) return null;
      const dados = (await res.json()) as { progresso?: unknown } | null;
      if (!dados || dados.progresso === undefined) return null;
      if (dados.progresso === null) return { progresso: null };
      const lido = validarProgresso(dados.progresso);
      return lido ? { progresso: lido } : null;
    } catch {
      return null;
    }
  }

  /** Guarda o progresso na conta (substitui o anterior). `false` = não gravou (sem sessão, sem servidor, recusado); nunca lança. */
  async gravarProgresso(token: string, progresso: ProgressoPiloto): Promise<boolean> {
    if (!this.base || !token) return false;
    try {
      const res = await fetch(this.base + CONTA_PROGRESSO_PATH, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', [SESSAO_HEADER]: token },
        body: JSON.stringify(progresso),
        mode: 'cors',
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async lerConfig(chave: string): Promise<string | null> {
    if (!this.base) return null;
    try {
      const res = await fetch(`${this.base}${CONFIG_PATH}?chave=${encodeURIComponent(chave)}`, { mode: 'cors', cache: 'no-store' });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async salvarConfig(token: string, chave: string, valor: string): Promise<boolean> {
    if (!this.base || !token) return false;
    try {
      const res = await fetch(this.base + ADMIN_CONFIG_PATH, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [SESSAO_HEADER]: token,
        },
        body: JSON.stringify({ chave, valor }),
        mode: 'cors',
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private async postCredenciais(path: string, email: string, senha: string): Promise<ContaResposta | ContaErro> {
    if (!this.base) return { erro: 'sem servidor' };
    try {
      const res = await fetch(this.base + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, senha }),
        mode: 'cors',
      });
      const dados = await res.json().catch(() => null);
      if (!res.ok) return { erro: (dados && typeof dados.erro === 'string' && dados.erro) || 'não deu para completar' };
      if (dados && typeof dados.token === 'string' && typeof dados.email === 'string') return { token: dados.token, email: dados.email, is_admin: dados.is_admin === true };
      return { erro: 'resposta inesperada do servidor' };
    } catch {
      return { erro: 'servidor fora do ar' };
    }
  }
}
