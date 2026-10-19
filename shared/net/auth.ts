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
/** Os direitos do titular (LGPD art. 18, P192): baixar os dados da conta, apagá-la e escolher se a atividade é medida. */
export const CONTA_DADOS_PATH = '/conta/dados';
export const CONTA_APAGAR_PATH = '/conta/apagar';
export const CONTA_MEDICAO_PATH = '/conta/medicao';
/** A idade (P211): informar o mês e o ano de nascimento uma vez (quem criou a conta antes de o cadastro perguntar, ou por um cliente velho). */
export const CONTA_NASCIMENTO_PATH = '/conta/nascimento';
/** "Esqueci a senha" (P206): pedir o link por e-mail e, com o link, definir a senha nova. */
export const CONTA_ESQUECI_PATH = '/conta/esqueci';
export const CONTA_REDEFINIR_PATH = '/conta/redefinir';
export const CONFIG_PATH = '/config';
/**
 * As únicas chaves da configuração global (`GET /config`, aberta ao público; `POST /admin/config`, só administrador). Antes, QUALQUER nome era lido e gravado: bastava o dono guardar algo ali um dia e
 * a rota pública entregaria. Chave nova entra **aqui**, de propósito. O valor é sempre um JSON de até `CONFIG_VALOR_MAX` caracteres.
 */
export const CONFIG_CHAVES = ['chassis_status'] as const;
export const CONFIG_VALOR_MAX = 4096;
export function chaveDeConfigValida(c: unknown): c is (typeof CONFIG_CHAVES)[number] {
  return typeof c === 'string' && (CONFIG_CHAVES as readonly string[]).includes(c);
}
/** O valor é um JSON de tamanho aceitável? (O que o administrador grava passa por aqui antes de ir para o banco.) */
export function valorDeConfigValido(v: unknown): v is string {
  if (typeof v !== 'string' || v.length === 0 || v.length > CONFIG_VALOR_MAX) return false;
  try {
    JSON.parse(v);
    return true;
  } catch {
    return false;
  }
}
export const ADMIN_CONFIG_PATH = '/admin/config';

/** Cabeçalho que carrega o token de sessão nas chamadas autenticadas (`GET /conta/eu`, `POST /conta/sair`). */
export const SESSAO_HEADER = 'x-cybermech-sessao';

/**
 * A versão do texto da política de privacidade (`/privacidade/`) que quem cria a conta aceita. **Mudou o texto em algo que o titular precisa saber de novo? Mude esta data junto**
 * (e o texto em `scripts/privacidade.mjs`): a conta guarda a versão que a pessoa aceitou, e um navegador com a versão velha é mandado recarregar antes de criar conta.
 */
export const POLITICA_VERSAO = '2026-10-19.2';

/** O que o formulário de criar conta manda além do e-mail e da senha: as duas caixas marcadas (política lida; maior de 18 anos ou com autorização do responsável). */
export interface AceiteDaPolitica {
  politica: string;
  idade: boolean;
}
export const ACEITE_ATUAL: AceiteDaPolitica = { politica: POLITICA_VERSAO, idade: true };

// ---------------------------------------------------------------- a idade (P211)

/** A maioridade: o chat de voz é só de quem a tem (ordem do Comandante, 19/10: "menores de 18 anos NÃO TEM ACESSO ao microfone nem aos áudios dos outros jogadores"). */
export const IDADE_ADULTA = 18;
/** Ninguém nasceu há mais disto (anos): corta o ano digitado errado. */
export const NASCIMENTO_ANOS_MAX = 120;

/**
 * O mês e o ano de nascimento, `AAAA-MM` (**só isso**: o dia não é perguntado, é dado a menos que o jogo guarda). Devolve o texto normalizado, ou `null` se não vale (forma errada, mês fora de 1 a 12, no futuro, ou há mais de
 * `NASCIMENTO_ANOS_MAX` anos).
 */
export function validarNascimento(x: unknown, agora: Date = new Date()): string | null {
  if (typeof x !== 'string') return null;
  const m = /^(\d{4})-(\d{2})$/.exec(x);
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) return null;
  const hoje = agora.getUTCFullYear() * 12 + agora.getUTCMonth();
  const nasceu = ano * 12 + (mes - 1);
  if (nasceu > hoje || hoje - nasceu > NASCIMENTO_ANOS_MAX * 12) return null;
  return x;
}

/**
 * É maior de idade? **Conservador, com o mês como única precisão:** quem fez 18 anos no mês passado é adulto; quem os faz **neste mês** ainda não é (o dia exato não se sabe, e na dúvida o chat de voz não abre).
 * Sem data (conta sem idade informada, convidado) ou data inválida: **não**.
 */
export function ehMaiorDeIdade(nascimento: string | null | undefined, agora: Date = new Date()): boolean {
  const n = validarNascimento(nascimento, agora);
  if (n === null) return false;
  const hoje = agora.getUTCFullYear() * 12 + agora.getUTCMonth();
  const nasceu = Number(n.slice(0, 4)) * 12 + (Number(n.slice(5, 7)) - 1);
  return hoje - nasceu > IDADE_ADULTA * 12;
}

/** O que o jogo sabe da idade de uma conta: `adulto` (a voz abre), `menor` (nem o microfone nem a voz dos outros) ou `sem-idade` (a pessoa ainda não informou: sem voz até informar). */
export type IdadeDaConta = 'adulto' | 'menor' | 'sem-idade';

export function idadeDaConta(nascimento: string | null | undefined, agora: Date = new Date()): IdadeDaConta {
  if (validarNascimento(nascimento, agora) === null) return 'sem-idade';
  return ehMaiorDeIdade(nascimento, agora) ? 'adulto' : 'menor';
}

/** O corpo de `POST /conta/nascimento`: `{ nascimento: "AAAA-MM" }`. */
export function parseNascimento(raw: unknown, agora: Date = new Date()): string | null {
  if (typeof raw !== 'object' || raw === null) return null;
  return validarNascimento((raw as Record<string, unknown>).nascimento, agora);
}

export interface CriarContaPedido {
  email: string;
  senha: string;
  aceite: AceiteDaPolitica;
  /** O mês e o ano de nascimento (`AAAA-MM`): o formulário exige; o servidor aceita sem (a conta nasce "sem idade", sem voz, e a pessoa informa depois). */
  nascimento?: string;
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
  /** A idade da conta (P211): só a faixa, nunca a data. */
  idade?: IdadeDaConta;
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
export type CriarContaLeitura = { ok: true; email: string; senha: string; nascimento?: string } | { ok: false; motivo: 'dados' | 'aceite' | 'versao' | 'nascimento' };

export function parseCriarConta(raw: unknown): CriarContaLeitura {
  const cred = parseCredenciais(raw);
  if (!cred) return { ok: false, motivo: 'dados' };
  const a = (raw as Record<string, unknown>).aceite;
  if (typeof a !== 'object' || a === null) return { ok: false, motivo: 'aceite' };
  const { politica, idade } = a as Record<string, unknown>;
  if (idade !== true || typeof politica !== 'string') return { ok: false, motivo: 'aceite' };
  if (politica !== POLITICA_VERSAO) return { ok: false, motivo: 'versao' };
  // O nascimento é opcional no servidor (um cliente velho cria a conta sem idade e informa depois); se vier, tem de valer.
  const bruto = (raw as Record<string, unknown>).nascimento;
  if (bruto === undefined || bruto === null) return { ok: true, ...cred };
  const nascimento = validarNascimento(bruto);
  if (nascimento === null) return { ok: false, motivo: 'nascimento' };
  return { ok: true, ...cred, nascimento };
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
  conta: { email: string; criadaEm: string; aceiteEm: string | null; aceiteVersao: string | null; nascimento: string | null; medirAtividade: boolean; administrador: boolean };
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

// ---------- esqueci a senha (P206) ----------

/** Por quanto tempo o link de redefinição vale (minutos). O servidor guarda só a impressão digital dele (SHA-256), e o link some ao ser usado ou vencer. */
export const REDEFINIR_VALE_MIN = 30;
/** O token do link: 32 bytes em base64url (43 caracteres). */
export const REDEFINIR_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
/** As línguas do e-mail e da página de redefinição (as mesmas do jogo: `client/src/i18n/i18n.ts`, que tem teste de igualdade). */
export const IDIOMAS_EMAIL = ['pt', 'en', 'es', 'fr', 'ja', 'zh', 'ru'] as const;
export type IdiomaEmail = (typeof IDIOMAS_EMAIL)[number];

/** O corpo de `POST /conta/esqueci`: o e-mail e (opcional) a língua do jogador. Língua desconhecida vira português. */
export function parseEsqueci(raw: unknown): { email: string; lang: IdiomaEmail } | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (validarEmail(r.email)) return null;
  const lang = IDIOMAS_EMAIL.find((l) => l === r.lang) ?? 'pt';
  return { email: normalizarEmail(r.email as string), lang };
}

/** O corpo de `POST /conta/redefinir`: o token do link e a senha nova (mesma regra da senha de sempre). `senha` é a mensagem de erro para a tela quando a senha não serve. */
export function parseRedefinir(raw: unknown): { ok: true; token: string; senha: string } | { ok: false; motivo: 'token' | 'senha'; senha?: string } {
  if (typeof raw !== 'object' || raw === null) return { ok: false, motivo: 'token' };
  const r = raw as Record<string, unknown>;
  if (typeof r.token !== 'string' || !REDEFINIR_TOKEN_RE.test(r.token)) return { ok: false, motivo: 'token' };
  const erro = validarSenha(r.senha);
  if (erro) return { ok: false, motivo: 'senha', senha: erro };
  return { ok: true, token: r.token, senha: r.senha as string };
}

/** O link do e-mail. O token vai depois do `#`: o fragmento não é enviado ao servidor nem no Referer, então não cai em log de ninguém. */
export function urlDeRedefinicao(siteBase: string, token: string, lang: IdiomaEmail): string {
  return `${siteBase.replace(/\/+$/, '')}/redefinir/?lang=${lang}#${token}`;
}
