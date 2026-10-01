/**
 * Contas de piloto: SQLite no próprio PC do servidor (dono, 28/09: escolheu isso a caminhos gerenciados
 * de nuvem — "gratuito, sem serviço novo, cabe no orçamento do projeto"). `node:sqlite` embutido do Node
 * (>=22.5): **zero dependência nova** — depois da dor de hoje com o binário nativo do `@rolldown` travando
 * a instalação, evitar mais um binário nativo (`better-sqlite3` faria o mesmo) é a decisão certa aqui.
 *
 * **Aviso (R13, para não afirmar mais do que existe):** `node:sqlite` é experimental na versão do Node do
 * projeto — a API pode mudar em versões futuras do Node. Por isso toda a leitura/escrita do banco passa por
 * este arquivo só, atrás de funções com nome em português (não o SQL cru espalhado pelo código): trocar de
 * banco depois (Postgres, se crescer) é mudar só aqui.
 *
 * **Senha:** nunca gravada em texto — `scrypt` (do próprio `node:crypto`, sem dependência) com um sal
 * aleatório de 16 bytes por conta. **Sessão:** o token que o cliente guarda é aleatório (32 bytes); o banco
 * grava só o hash SHA-256 dele — um vazamento do arquivo `contas.db` não dá sessão utilizável a ninguém.
 */
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);

/** 30 dias: uma sessão de jogo casual não deveria pedir senha de novo toda semana. */
const SESSAO_DIAS = 30;
const SAL_BYTES = 16;
const HASH_BYTES = 64;
const TOKEN_BYTES = 32;

export interface Conta {
  id: number;
  email: string;
  is_admin: boolean;
}

export class Contas {
  private readonly db: DatabaseSync;

  constructor(caminho: string) {
    this.db = new DatabaseSync(caminho);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        hash TEXT NOT NULL,
        sal TEXT NOT NULL,
        criada_em TEXT NOT NULL,
        is_admin INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS sessoes (
        token_hash TEXT PRIMARY KEY,
        conta_id INTEGER NOT NULL REFERENCES contas(id),
        criada_em TEXT NOT NULL,
        expira_em TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sessoes_conta ON sessoes(conta_id);
      CREATE TABLE IF NOT EXISTS configuracoes_globais (
        chave TEXT PRIMARY KEY,
        valor TEXT NOT NULL
      );
    `);
    
    // Migração de schema em tempo real: garante que contas criadas antes da tabela
    // ganhar a coluna is_admin não quebrem o sistema (para SQLite existente).
    try {
      this.db.exec(`ALTER TABLE contas ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;`);
    } catch {
      // Falha silenciosamente se a coluna já existir (comportamento esperado na 2ª vez).
    }
  }

  close(): void {
    this.db.close();
  }

  /** Cria a conta. `'existe'` se o e-mail já está cadastrado (mensagem que a UI pode mostrar direto —
   * diferente da mensagem de login, que nunca diz se o e-mail existe). */
  async criar(email: string, senha: string): Promise<{ ok: true; conta: Conta } | { ok: false; motivo: 'existe' }> {
    const ja = this.db.prepare('SELECT id FROM contas WHERE email = ?').get(email);
    if (ja) return { ok: false, motivo: 'existe' };
    const sal = randomBytes(SAL_BYTES);
    const hash = (await scrypt(senha, sal, HASH_BYTES)) as Buffer;
    const agora = new Date().toISOString();
    const r = this.db.prepare('INSERT INTO contas (email, hash, sal, criada_em, is_admin) VALUES (?, ?, ?, ?, 0)').run(email, hash.toString('hex'), sal.toString('hex'), agora);
    return { ok: true, conta: { id: Number(r.lastInsertRowid), email, is_admin: false } };
  }

  /** Confere e-mail + senha. Tempo de resposta parecido para "não existe" e "senha errada" (ainda calcula
   * um scrypt mesmo sem conta, com sal fixo) — não elimina timing attack por completo, mas encarece. */
  async autenticar(email: string, senha: string): Promise<Conta | null> {
    const row = this.db.prepare('SELECT id, hash, sal, is_admin FROM contas WHERE email = ?').get(email) as
      | { id: number; hash: string; sal: string; is_admin: number }
      | undefined;
    const sal = row ? Buffer.from(row.sal, 'hex') : randomBytes(SAL_BYTES);
    const calculado = (await scrypt(senha, sal, HASH_BYTES)) as Buffer;
    if (!row) return null;
    const guardado = Buffer.from(row.hash, 'hex');
    if (guardado.length !== calculado.length || !timingSafeEqual(guardado, calculado)) return null;
    return { id: row.id, email, is_admin: row.is_admin === 1 };
  }

  /** Nova sessão para a conta; devolve o token de verdade (só existe em memória — o banco guarda o hash). */
  criarSessao(contaId: number): string {
    const token = randomBytes(TOKEN_BYTES).toString('hex');
    const agora = new Date();
    const expira = new Date(agora.getTime() + SESSAO_DIAS * 24 * 60 * 60 * 1000);
    this.db
      .prepare('INSERT INTO sessoes (token_hash, conta_id, criada_em, expira_em) VALUES (?, ?, ?, ?)')
      .run(hashToken(token), contaId, agora.toISOString(), expira.toISOString());
    return token;
  }

  /** A conta dona do token, se a sessão existir e não tiver expirado. */
  validarSessao(token: string): Conta | null {
    const row = this.db
      .prepare('SELECT c.id as id, c.email as email, c.is_admin as is_admin, s.expira_em as expira_em FROM sessoes s JOIN contas c ON c.id = s.conta_id WHERE s.token_hash = ?')
      .get(hashToken(token)) as { id: number; email: string; is_admin: number; expira_em: string } | undefined;
    if (!row) return null;
    if (new Date(row.expira_em).getTime() < Date.now()) return null;
    return { id: row.id, email: row.email, is_admin: row.is_admin === 1 };
  }

  /** Encerra a sessão (o `POST /conta/sair`). Idempotente: token que não existe não é erro. */
  encerrarSessao(token: string): void {
    this.db.prepare('DELETE FROM sessoes WHERE token_hash = ?').run(hashToken(token));
  }

  /** Sessões vencidas juntam sem limpeza (nenhum dado sensível nelas — só o hash — mas não custa varrer).
   * Chamado de vez em quando pelo servidor, nunca no laço de 60 Hz. */
  limparExpiradas(): number {
    const r = this.db.prepare('DELETE FROM sessoes WHERE expira_em < ?').run(new Date().toISOString());
    return Number(r.changes);
  }

  /** Lê uma configuração global pela chave (retorna o valor gravado ou nulo) */
  getConfig(chave: string): string | null {
    const row = this.db.prepare('SELECT valor FROM configuracoes_globais WHERE chave = ?').get(chave) as { valor: string } | undefined;
    return row ? row.valor : null;
  }

  /** Salva/Atualiza uma configuração global (ex: 'mechs_oficina', '["quadraV2"]') */
  setConfig(chave: string, valor: string): void {
    this.db.prepare('INSERT INTO configuracoes_globais (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor').run(chave, valor);
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
