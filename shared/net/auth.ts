/**
 * Contas de piloto (dono, 28/09: "conclua o /mesa/... depois, partir para login?" → escopo combinado:
 * SQLite no próprio PC do servidor, e-mail + senha, só o esqueleto — criar conta, entrar, sair).
 *
 * Contrato único do servidor e do cliente. Sem nenhuma dependência de banco nem de rede: só as regras
 * (validação, formato das mensagens), testável isolado (G14). A implementação mora em `server/contas.ts`.
 */

/** E-mail: até 254 (o teto do padrão), formato plausível (não é validação de RFC completa — ninguém
 * precisa disso; existe para pegar erro de digitação, a prova real é conseguir entrar depois). */
export const EMAIL_MAX = 254;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Senha: 8 a 72 caracteres. O teto de 72 não é arbitrário: é o limite real do scrypt/bcrypt por design —
 * caracteres além dele são silenciosamente ignorados por muitas implementações, então é mais honesto recusar. */
export const SENHA_MIN = 8;
export const SENHA_MAX = 72;

export const CONTA_CRIAR_PATH = '/conta/criar';
export const CONTA_ENTRAR_PATH = '/conta/entrar';
export const CONTA_SAIR_PATH = '/conta/sair';
export const CONTA_EU_PATH = '/conta/eu';
export const CONFIG_PATH = '/config';
export const ADMIN_CONFIG_PATH = '/admin/config';

/** Cabeçalho que carrega o token de sessão nas chamadas autenticadas (`GET /conta/eu`, `POST /conta/sair`). */
export const SESSAO_HEADER = 'x-cybermech-sessao';

export interface CriarContaPedido {
  email: string;
  senha: string;
}
export interface EntrarPedido {
  email: string;
  senha: string;
}
export interface ContaResposta {
  /** Token de sessão: o cliente guarda e manda no cabeçalho `x-cybermech-sessao` dali em diante. */
  token: string;
  email: string;
}

/** Normaliza o e-mail (minúsculas, sem espaço nas pontas) — a mesma forma usada para comparar e gravar. */
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Erros de validação, em português, prontos para a tela (não vazam se o e-mail existe ou não). */
export function validarEmail(email: unknown): string | null {
  if (typeof email !== 'string') return 'e-mail inválido';
  const e = normalizarEmail(email);
  if (!e || e.length > EMAIL_MAX) return 'e-mail inválido';
  if (!EMAIL_RE.test(e)) return 'e-mail inválido';
  return null;
}

export function validarSenha(senha: unknown): string | null {
  if (typeof senha !== 'string') return 'senha inválida';
  if (senha.length < SENHA_MIN) return `senha precisa de pelo menos ${SENHA_MIN} caracteres`;
  if (senha.length > SENHA_MAX) return `senha longa demais (máximo ${SENHA_MAX} caracteres)`;
  return null;
}

/** Lê o corpo de `POST /conta/criar` ou `/conta/entrar`. Não diz qual campo está errado (mensagem única,
 * ambos os endpoints): não ajuda um script a descobrir por tentativa se um e-mail existe. */
export function parseCredenciais(raw: unknown): { email: string; senha: string } | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (validarEmail(r.email) || validarSenha(r.senha)) return null;
  return { email: normalizarEmail(r.email as string), senha: r.senha as string };
}
