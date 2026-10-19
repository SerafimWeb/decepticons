import { serverHttpUrl } from '../../../shared/net/serverUrl';
import {
  ACEITE_ATUAL,
  type AceiteDaPolitica,
  CONTA_APAGAR_PATH,
  CONTA_CRIAR_PATH,
  CONTA_DADOS_PATH,
  CONTA_ENTRAR_PATH,
  CONTA_ESQUECI_PATH,
  CONTA_EU_PATH,
  CONTA_MEDICAO_PATH,
  CONTA_NASCIMENTO_PATH,
  CONTA_PROGRESSO_PATH,
  CONTA_SAIR_PATH,
  CONFIG_PATH,
  ADMIN_CONFIG_PATH,
  type ContaResposta,
  type IdadeDaConta,
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

/** A faixa que o servidor mandou; qualquer outra coisa (servidor velho, resposta estranha) é "sem idade": o caminho que não abre a voz. */
function lerIdade(x: unknown): IdadeDaConta {
  return x === 'adulto' || x === 'menor' ? x : 'sem-idade';
}

export class ContaCliente {
  private readonly base: string | null;

  constructor(gameServer: string | undefined | null) {
    // Os quatro caminhos vivem na mesma origem; guardamos só a origem e montamos o caminho por chamada.
    const url = serverHttpUrl(gameServer, '/');
    this.base = url ? url.replace(/\/$/, '') : null;
  }

  /** Criar a conta já manda o aceite da política e o mês e o ano de nascimento (`AAAA-MM`, P211): o formulário só chama isto com as duas caixas marcadas e a idade escolhida (o servidor recusa sem o aceite). */
  criar(email: string, senha: string, nascimento?: string): Promise<ContaResposta | ContaErro> {
    return this.postCredenciais(CONTA_CRIAR_PATH, email, senha, ACEITE_ATUAL, nascimento);
  }

  entrar(email: string, senha: string): Promise<ContaResposta | ContaErro> {
    return this.postCredenciais(CONTA_ENTRAR_PATH, email, senha);
  }

  /**
   * "Esqueci a senha" (P206): pede o link por e-mail. O servidor responde igual exista a conta ou não (nada de descobrir e-mails), então `{ ok: true }` quer dizer só "pedido recebido".
   * `semEmail`: o servidor ainda não tem o envio de e-mail ligado. Nunca lança.
   */
  async esqueci(email: string, lang: string): Promise<{ ok: true } | { erro: string; semEmail?: true }> {
    if (!this.base) return { erro: 'sem servidor' };
    try {
      const res = await fetch(this.base + CONTA_ESQUECI_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, lang }),
        mode: 'cors',
      });
      if (res.status === 202) return { ok: true };
      const dados = await res.json().catch(() => null);
      if (res.status === 503 && dados?.codigo === 'sem-email') return { erro: 'a recuperação por e-mail ainda não está ativa: peça ajuda pelo contato da página de Privacidade', semEmail: true };
      return { erro: (dados && typeof dados.erro === 'string' && dados.erro) || 'não deu para completar' };
    } catch {
      return { erro: 'servidor fora do ar' };
    }
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
  async eu(token: string): Promise<{ email: string; is_admin: boolean; medir: boolean; idade: IdadeDaConta } | null> {
    if (!this.base || !token) return null;
    try {
      const res = await fetch(this.base + CONTA_EU_PATH, { headers: { [SESSAO_HEADER]: token }, mode: 'cors', cache: 'no-store' });
      if (!res.ok) return null;
      const dados = await res.json();
      return typeof dados?.email === 'string' ? { email: dados.email, is_admin: dados.is_admin === true, medir: dados.medir !== false, idade: lerIdade(dados.idade) } : null;
    } catch {
      return null;
    }
  }

  /**
   * Os dados da conta, para baixar (LGPD art. 18 II e V). `json` já vem formatado para quem abrir o arquivo. Nunca lança.
   */
  async dados(token: string): Promise<{ json: string } | ContaErro> {
    if (!this.base || !token) return { erro: 'sem servidor' };
    try {
      const res = await fetch(this.base + CONTA_DADOS_PATH, { headers: { [SESSAO_HEADER]: token }, mode: 'cors', cache: 'no-store' });
      if (!res.ok) return { erro: res.status === 401 ? 'sessão vencida: entre de novo' : 'não deu para baixar os dados' };
      return { json: JSON.stringify(await res.json(), null, 2) };
    } catch {
      return { erro: 'servidor fora do ar' };
    }
  }

  /** Apaga a conta (LGPD art. 18 VI), confirmando com a senha. `null` = apagada; senão a mensagem para a tela. Nunca lança. */
  async apagar(token: string, senha: string): Promise<string | null> {
    if (!this.base || !token) return 'sem servidor';
    try {
      const res = await fetch(this.base + CONTA_APAGAR_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json', [SESSAO_HEADER]: token },
        body: JSON.stringify({ senha }),
        mode: 'cors',
      });
      if (res.ok) return null;
      const dados = await res.json().catch(() => null);
      return (dados && typeof dados.erro === 'string' && dados.erro) || 'não deu para apagar a conta';
    } catch {
      return 'servidor fora do ar';
    }
  }

  /** Liga ou desliga o registro da atividade da conta (LGPD art. 18 § 2). Devolve a escolha que o servidor guardou, ou `null` se não deu. Nunca lança. */
  async medicao(token: string, ativa: boolean): Promise<boolean | null> {
    if (!this.base || !token) return null;
    try {
      const res = await fetch(this.base + CONTA_MEDICAO_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json', [SESSAO_HEADER]: token },
        body: JSON.stringify({ ativa }),
        mode: 'cors',
      });
      if (!res.ok) return null;
      const dados = await res.json().catch(() => null);
      return dados && typeof dados.ativa === 'boolean' ? dados.ativa : null;
    } catch {
      return null;
    }
  }

  /**
   * Informa o mês e o ano de nascimento (`AAAA-MM`) de uma conta que ainda não tem (P211): uma vez só, o servidor não deixa mudar. Devolve a faixa que ele guardou, ou a mensagem para a tela. Nunca lança.
   */
  async nascimento(token: string, nascimento: string): Promise<{ idade: IdadeDaConta } | ContaErro> {
    if (!this.base || !token) return { erro: 'sem servidor' };
    try {
      const res = await fetch(this.base + CONTA_NASCIMENTO_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json', [SESSAO_HEADER]: token },
        body: JSON.stringify({ nascimento }),
        mode: 'cors',
      });
      const dados = await res.json().catch(() => null);
      if (!res.ok) return { erro: (dados && typeof dados.erro === 'string' && dados.erro) || 'não deu para guardar' };
      return { idade: lerIdade(dados?.idade) };
    } catch {
      return { erro: 'servidor fora do ar' };
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

  private async postCredenciais(path: string, email: string, senha: string, aceite?: AceiteDaPolitica, nascimento?: string): Promise<ContaResposta | ContaErro> {
    if (!this.base) return { erro: 'sem servidor' };
    try {
      const res = await fetch(this.base + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(aceite ? (nascimento ? { email, senha, aceite, nascimento } : { email, senha, aceite }) : { email, senha }),
        mode: 'cors',
      });
      const dados = await res.json().catch(() => null);
      if (!res.ok) return { erro: (dados && typeof dados.erro === 'string' && dados.erro) || 'não deu para completar' };
      if (dados && typeof dados.token === 'string' && typeof dados.email === 'string') return { token: dados.token, email: dados.email, is_admin: dados.is_admin === true, medir: dados.medir !== false, idade: lerIdade(dados.idade) };
      return { erro: 'resposta inesperada do servidor' };
    } catch {
      return { erro: 'servidor fora do ar' };
    }
  }
}
