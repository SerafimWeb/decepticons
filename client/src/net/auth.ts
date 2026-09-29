import { serverHttpUrl } from '../../../shared/net/serverUrl';
import {
  CONTA_CRIAR_PATH,
  CONTA_ENTRAR_PATH,
  CONTA_EU_PATH,
  CONTA_SAIR_PATH,
  type ContaResposta,
  SESSAO_HEADER,
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

  /** Confere se o token ainda vale, e devolve o e-mail se sim. `null` = sem sessão (token ruim, expirado, ou
   * sem servidor) — nunca lança. */
  async eu(token: string): Promise<{ email: string } | null> {
    if (!this.base || !token) return null;
    try {
      const res = await fetch(this.base + CONTA_EU_PATH, { headers: { [SESSAO_HEADER]: token }, mode: 'cors', cache: 'no-store' });
      if (!res.ok) return null;
      const dados = await res.json();
      return typeof dados?.email === 'string' ? { email: dados.email } : null;
    } catch {
      return null;
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
      if (dados && typeof dados.token === 'string' && typeof dados.email === 'string') return { token: dados.token, email: dados.email };
      return { erro: 'resposta inesperada do servidor' };
    } catch {
      return { erro: 'servidor fora do ar' };
    }
  }
}
