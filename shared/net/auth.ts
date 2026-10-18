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
export const CONTA_PROGRESSO_PATH = '/conta/progresso';
/** Os direitos do titular (LGPD art. 18, P187): baixar os dados da conta, apagá-la e escolher se a atividade é medida. */
export const CONTA_DADOS_PATH = '/conta/dados';
export const CONTA_APAGAR_PATH = '/conta/apagar';
export const CONTA_MEDICAO_PATH = '/conta/medicao';
export const CONFIG_PATH = '/config';
export const ADMIN_CONFIG_PATH = '/admin/config';

/** Cabeçalho que carrega o token de sessão nas chamadas autenticadas (`GET /conta/eu`, `POST /conta/sair`). */
export const SESSAO_HEADER = 'x-cybermech-sessao';

/**
 * A versão do texto da política de privacidade (`/privacidade/`) que quem cria a conta aceita. **Mudou o texto em algo que o titular precisa saber de novo? Mude esta data junto**
 * (e o texto em `scripts/privacidade.mjs`): a conta guarda a versão que a pessoa aceitou, e um navegador com a versão velha é mandado recarregar antes de criar conta.
 */
export const POLITICA_VERSAO = '2026-10-18';

/** O que o formulário de criar conta manda além do e-mail e da senha: as duas caixas marcadas (política lida; maior de 18 anos ou com autorização do responsável). */
export interface AceiteDaPolitica {
  politica: string;
  idade: boolean;
}
export const ACEITE_ATUAL: AceiteDaPolitica = { politica: POLITICA_VERSAO, idade: true };

export interface CriarContaPedido {
  email: string;
  senha: string;
  aceite: AceiteDaPolitica;
}
export interface EntrarPedido {
  email: string;
  senha: string;
}
export interface ContaResposta {
  /** Token de sessão: o cliente guarda e manda no cabeçalho `x-cybermech-sessao` dali em diante. */
  token: string;
  email: string;
  is_admin?: boolean;
  /** A atividade da conta é registrada? (A pessoa pode desligar; ao entrar em outro aparelho a escolha vem junto.) */
  medir?: boolean;
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

/** O corpo de `POST /conta/criar`: as credenciais **e** o aceite. `aceite`: faltou ou veio desmarcado; `versao`: o navegador tem uma política velha (recarregar). */
export type CriarContaLeitura = { ok: true; email: string; senha: string } | { ok: false; motivo: 'dados' | 'aceite' | 'versao' };

export function parseCriarConta(raw: unknown): CriarContaLeitura {
  const cred = parseCredenciais(raw);
  if (!cred) return { ok: false, motivo: 'dados' };
  const a = (raw as Record<string, unknown>).aceite;
  if (typeof a !== 'object' || a === null) return { ok: false, motivo: 'aceite' };
  const { politica, idade } = a as Record<string, unknown>;
  if (idade !== true || typeof politica !== 'string') return { ok: false, motivo: 'aceite' };
  if (politica !== POLITICA_VERSAO) return { ok: false, motivo: 'versao' };
  return { ok: true, ...cred };
}

/** O corpo de `POST /conta/apagar`: a senha de novo (apagar não se desfaz; uma sessão esquecida aberta não pode apagar a conta de ninguém). */
export function parseSenhaDeConfirmacao(raw: unknown): string | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const s = (raw as Record<string, unknown>).senha;
  return validarSenha(s) === null ? (s as string) : null;
}

/** O corpo de `POST /conta/medicao`: ligar ou desligar o registro da atividade da conta. */
export function parseMedicao(raw: unknown): boolean | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const a = (raw as Record<string, unknown>).ativa;
  return typeof a === 'boolean' ? a : null;
}

/** Tudo o que o servidor guarda de uma conta, no formato que `GET /conta/dados` devolve (o direito de acesso e a portabilidade, LGPD art. 18 II e V). */
export interface DadosDaConta {
  v: 1;
  geradoEm: string;
  nota: string;
  conta: { email: string; criadaEm: string; aceiteEm: string | null; aceiteVersao: string | null; medirAtividade: boolean; administrador: boolean };
  progresso: unknown | null;
  atividade: { dia: string; segundos: number; partidas: number; abates: number; mortes: number }[];
  sessoes: { criadaEm: string; venceEm: string }[];
}

// ---------------------------------------------------------------- progresso do piloto (P174)

/** O teto do corpo de `PUT /conta/progresso` (bytes): o progresso é pequeno; o resto é abuso. */
export const PROGRESSO_MAX_BYTES = 8192;
/** A montagem do Hangar (o JSON que o navegador já guarda) vai como texto opaco: o servidor só limita o tamanho; quem a lê (o Hangar) a valida. */
export const MONTAGEM_MAX = 4096;
const NIVEL_MAX = 999;
const XP_MAX = 999;
const CREDITOS_MAX = 1_000_000_000;

/**
 * O que a conta guarda do piloto (ordem P174: "concluamos sobre o LOGIN"; `RANKING_E_LOGIN.md` C3: o convidado vira conta **sem perder nada**). É o que o navegador já tinha:
 * apelido, nível, XP, créditos e a montagem do robô. **Nada disto vale para o ranking** (G13: só o servidor autoritativo pontua o global): é conforto entre aparelhos, e quem o
 * adulterar só adultera a própria conta.
 */
export interface ProgressoPiloto {
  apelido: string;
  nivel: number;
  xp: number;
  creditos: number;
  /** O JSON da montagem do Hangar (`cybermech.hangar.v1`), ou vazio. */
  montagem: string;
  /** Quando o navegador gravou (ms desde 1970): desempata quem tem o mesmo nível e XP. */
  atualizadoEm: number;
}

const inteiro = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) && v >= min && v <= max ? v : null;

/** Lê e valida o progresso (do corpo de um `PUT` ou do que o servidor guardou). `null` = fora do contrato (nada é gravado). O apelido sai pelo mesmo filtro da sala online. */
export function validarProgresso(raw: unknown, sanitizar: (apelido: string) => string = (a) => a.trim().slice(0, 16)): ProgressoPiloto | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const nivel = inteiro(r.nivel, 1, NIVEL_MAX);
  const xp = inteiro(r.xp, 0, XP_MAX);
  const creditos = inteiro(r.creditos, 0, CREDITOS_MAX);
  const atualizadoEm = typeof r.atualizadoEm === 'number' && Number.isFinite(r.atualizadoEm) && r.atualizadoEm >= 0 ? Math.floor(r.atualizadoEm) : null;
  if (nivel === null || xp === null || creditos === null || atualizadoEm === null) return null;
  if (typeof r.apelido !== 'string' || typeof r.montagem !== 'string' || r.montagem.length > MONTAGEM_MAX) return null;
  return { apelido: r.apelido ? sanitizar(r.apelido) : '', nivel, xp, creditos, montagem: r.montagem, atualizadoEm };
}

/**
 * O convidado vira conta sem perder nada: junta o que o navegador tem (`local`) com o que a conta já guardava (`remoto`). **Quem tem mais progresso (nível, depois XP) vence
 * por inteiro** (os créditos andam junto com o nível; somar os dois seria dobrar o ganho de quem entra em dois aparelhos); empate, o gravado por último. O apelido e a montagem
 * do outro cobrem o que o vencedor não tem. Pura e determinística (G1).
 */
export function mesclarProgresso(local: ProgressoPiloto | null, remoto: ProgressoPiloto | null): ProgressoPiloto | null {
  if (!local) return remoto;
  if (!remoto) return local;
  const pesoL = local.nivel * 1000 + local.xp;
  const pesoR = remoto.nivel * 1000 + remoto.xp;
  const venceLocal = pesoL !== pesoR ? pesoL > pesoR : local.atualizadoEm > remoto.atualizadoEm;
  const [v, o] = venceLocal ? [local, remoto] : [remoto, local];
  return { ...v, apelido: v.apelido || o.apelido, montagem: v.montagem || o.montagem, atualizadoEm: Math.max(local.atualizadoEm, remoto.atualizadoEm) };
}

/** Os dois progressos dizem a mesma coisa? (Para não mandar ao servidor o que ele já tem.) */
export function progressoIgual(a: ProgressoPiloto | null, b: ProgressoPiloto | null): boolean {
  if (!a || !b) return a === b;
  return a.apelido === b.apelido && a.nivel === b.nivel && a.xp === b.xp && a.creditos === b.creditos && a.montagem === b.montagem;
}
