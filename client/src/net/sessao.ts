import { idadePodeOuvir, mesclarProgresso, progressoIgual, VOZ_SO_PARA_ADULTO_DECLARADO, type ContaResposta, type IdadeDaConta, type ProgressoPiloto } from '../../../shared/net/auth';
import { serverHttpUrl } from '../../../shared/net/serverUrl';

/**
 * A sessão do piloto no navegador (ordem P174: "concluamos sobre o LOGIN"; `RANKING_E_LOGIN.md` C3). Junta três coisas que não sabem umas das outras: o servidor de contas (`ContaCliente`), o
 * lugar onde o token fica (o armazenamento do navegador) e o **progresso local** (o nível, os créditos, o apelido e a montagem que o jogo já guardava). Sem UI e sem DOM (G3): a tela é
 * `ui/ContaSettings.ts`; o jogo só liga os dois por callbacks.
 *
 * **O convidado vira conta sem perder nada:** ao entrar ou criar a conta, o progresso do navegador é mesclado com o da conta (`mesclarProgresso`: quem tem mais nível e XP vence) e o
 * resultado vai para os dois lados. Depois disso, cada mudança local é mandada à conta (com 5 s de calma, para não mandar a cada abate). Falha de rede **nunca** trava o jogo nem apaga
 * nada: o progresso local é a verdade do aparelho, e a conta é uma cópia que alcança quando o servidor voltar. **O progresso da conta não vale para ranking** (G13).
 */

/** O mínimo do `Storage` que a sessão usa (o `localStorage` serve; o teste entrega um falso). */
export interface Armazem {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
}

/** O que a sessão precisa do servidor (o `ContaCliente` serve; o teste entrega um falso). */
export interface ServidorDeContas {
  criar(email: string, senha: string, nascimento?: string): Promise<ContaResposta | { erro: string }>;
  entrar(email: string, senha: string): Promise<ContaResposta | { erro: string }>;
  sair(token: string): Promise<void>;
  eu(token: string): Promise<{ email: string; is_admin: boolean; medir?: boolean; idade?: IdadeDaConta } | null>;
  /** A idade (P211): informa o mês e o ano de nascimento de uma conta que ainda não tem. Uma vez só; o servidor devolve a faixa. */
  nascimento?(token: string, nascimento: string): Promise<{ idade: IdadeDaConta } | { erro: string }>;
  /** Os direitos do titular (P192, LGPD art. 18): baixar os dados, apagar a conta, escolher se a atividade é medida. */
  dados(token: string): Promise<{ json: string } | { erro: string }>;
  apagar(token: string, senha: string): Promise<string | null>;
  medicao(token: string, ativa: boolean): Promise<boolean | null>;
  lerProgresso(token: string): Promise<{ progresso: ProgressoPiloto | null } | null>;
  gravarProgresso(token: string, progresso: ProgressoPiloto): Promise<boolean>;
  /** Opcional: "esqueci a senha" (P206). Um servidor sem isto responde como se o envio não estivesse ligado. */
  esqueci?(email: string, lang: string): Promise<{ ok: true } | { erro: string; semEmail?: true }>;
}

/** O progresso do navegador, lido e escrito pelo jogo (o `ui/DailyChallenges` e o Hangar ficam atrás disto). */
export interface ProgressoLocal {
  /** O que o navegador tem agora (`null` se ainda não há nada que valha guardar). `atualizadoEm` vem de `quandoMudou`. */
  ler(quandoMudou: number): ProgressoPiloto | null;
  /** A conta tinha mais: o jogo aplica o que vier (nível, XP, créditos, apelido, montagem). */
  aplicar(progresso: ProgressoPiloto): void;
}

export const CHAVE_TOKEN = 'cybermech.conta.token';
const CHAVE_MUDOU = 'cybermech.conta.mudou';
/** Quanto o progresso local fica quieto antes de ir para a conta (ms). */
export const ENVIO_APOS_MS = 5000;

/**
 * A chave do token no armazenamento: **uma por servidor** (como a do admin): o token é de UM servidor, e um link com `?servidor=` apontando para outro lugar nunca recebe o token
 * guardado. `ws` e `http` dão a mesma chave.
 */
export function chaveDoToken(gameServer: string | undefined | null): string {
  const url = serverHttpUrl(gameServer, '/');
  return `${CHAVE_TOKEN}|${url ? url.replace(/\/$/, '') : ''}`;
}

export interface EstadoSessao {
  /** O e-mail da conta, ou `null` sem sessão. */
  email: string | null;
  /** A conta já recebeu o progresso mais novo? (`false` enquanto há algo por mandar ou sem rede.) */
  sincronizado: boolean;
  /** O jogo registra a atividade desta conta (dias, minutos, abates, mortes)? Padrão sim; a pessoa pode desligar. */
  medir: boolean;
  /** A faixa de idade da conta (P211): `adulto` abre o chat de voz; `menor` e `sem-idade` (inclui o convidado) não. */
  idade: IdadeDaConta;
}

export class SessaoPiloto {
  private token: string | null = null;
  private emailAtual: string | null = null;
  private medirAtual = true;
  private idadeAtual: IdadeDaConta = 'sem-idade';
  private sincronizadoAgora = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private sincronizando: Promise<void> | null = null;
  /** O que a tela precisa saber: entrou, saiu, sincronizou. */
  onMudou?: (estado: EstadoSessao) => void;
  /** A conta entrou, saiu ou mudou de faixa de idade (P211): é o que decide se o chat de voz abre. Não repete se nada disso mudou. */
  onIdadeMudou?: (estado: EstadoSessao) => void;
  private conta = '|sem-idade';

  constructor(
    private readonly servidor: ServidorDeContas,
    private readonly armazem: Armazem | null,
    private readonly local: ProgressoLocal,
    private readonly chave: string,
    private readonly agora: () => number = () => Date.now(),
  ) {}

  get estado(): EstadoSessao {
    return { email: this.emailAtual, sincronizado: this.sincronizadoAgora, medir: this.medirAtual, idade: this.idadeAtual };
  }

  /**
   * O token da sessão **só para o chat de voz** (P211): o `PRONTO` o leva e o servidor confere a idade. `null` se esta faixa de idade não entra na voz: o cliente nem tenta (o servidor confere de qualquer jeito,
   * isto só poupa a viagem). Na fase de testes (P241) o convidado entra: o token dele é vazio, e o servidor o trata como convidado. Não sai daqui para mais nada.
   */
  tokenDaVoz(soAdulto: boolean = VOZ_SO_PARA_ADULTO_DECLARADO): string | null {
    return idadePodeOuvir(this.idadeAtual, soAdulto) ? (this.token ?? '') : null;
  }

  /** Abre o jogo: se há token guardado e o servidor ainda o aceita, volta logado e sincroniza; senão fica como convidado. */
  async restaurar(): Promise<void> {
    const guardado = this.ler(this.chave);
    if (!guardado) return;
    const eu = await this.servidor.eu(guardado);
    // Sem resposta o jogador segue como convidado (o progresso local não mexeu). O token **não** é apagado: `eu` devolve `null` tanto para sessão vencida quanto para rede fora, e
    // um jogo aberto num trem não deve deslogar ninguém. Entrar de novo (ou a próxima abertura com rede) troca o token.
    if (!eu) return;
    this.token = guardado;
    this.emailAtual = eu.email;
    this.medirAtual = eu.medir !== false;
    this.idadeAtual = eu.idade ?? 'sem-idade';
    this.avisar();
    await this.sincronizar();
  }

  /** `null` = entrou; senão a mensagem de erro, pronta para a tela. */
  async entrar(email: string, senha: string): Promise<string | null> {
    return this.abrir(await this.servidor.entrar(email, senha));
  }

  /** Pede o link de redefinição por e-mail (P206). `{ ok: true }` = o servidor recebeu o pedido (ele não diz se a conta existe). */
  async esqueciSenha(email: string, lang: string): Promise<{ ok: true } | { erro: string }> {
    return (await this.servidor.esqueci?.(email, lang)) ?? { erro: 'a recuperação por e-mail ainda não está ativa: peça ajuda pelo contato da página de Privacidade' };
  }

  /** `nascimento`: `AAAA-MM`, o que o formulário perguntou (P211). Sem ele a conta nasce "sem idade" e a pessoa informa depois. */
  async criar(email: string, senha: string, nascimento?: string): Promise<string | null> {
    return this.abrir(await this.servidor.criar(email, senha, nascimento));
  }

  /** Informa o mês e o ano de nascimento de uma conta "sem idade" (P211). `null` = o servidor guardou (a faixa muda na hora); senão a mensagem para a tela. */
  async informarNascimento(nascimento: string): Promise<string | null> {
    if (!this.token) return 'entre na conta primeiro';
    const r = await (this.servidor.nascimento?.(this.token, nascimento) ?? Promise.resolve({ erro: 'não deu para guardar' }));
    if ('erro' in r) return r.erro;
    this.idadeAtual = r.idade;
    this.avisar();
    return null;
  }

  /** Sai da conta: avisa o servidor, esquece o token. **O progresso local fica** (o aparelho continua do piloto). */
  async sair(): Promise<void> {
    const token = this.token;
    this.cancelarEnvio();
    this.esquecerSessao();
    if (token) await this.servidor.sair(token);
  }

  private esquecerSessao(): void {
    this.cancelarEnvio();
    this.token = null;
    this.emailAtual = null;
    this.medirAtual = true;
    this.idadeAtual = 'sem-idade';
    this.sincronizadoAgora = false;
    this.apagar(this.chave);
    this.avisar();
  }

  /** Baixa tudo o que o servidor guarda desta conta (o JSON já formatado e um nome de arquivo com a data). Quem chama entrega o arquivo ao navegador. */
  async baixarDados(): Promise<{ json: string; nome: string } | { erro: string }> {
    if (!this.token) return { erro: 'entre na conta primeiro' };
    const r = await this.servidor.dados(this.token);
    if ('erro' in r) return r;
    return { json: r.json, nome: `cybermech-meus-dados-${new Date(this.agora()).toISOString().slice(0, 10)}.json` };
  }

  /**
   * Apaga a conta de vez, confirmando com a senha. `null` = apagada (a sessão é esquecida aqui; **o progresso deste aparelho fica**: ele é do aparelho, não do servidor); senão a mensagem para a tela.
   * Uma senha errada não esquece nada.
   */
  async apagarConta(senha: string): Promise<string | null> {
    if (!this.token) return 'entre na conta primeiro';
    const erro = await this.servidor.apagar(this.token, senha);
    if (erro) return erro;
    this.esquecerSessao();
    return null;
  }

  /** A pessoa liga ou desliga o registro da atividade da conta. `true` = o servidor guardou a escolha. */
  async definirMedicao(ativa: boolean): Promise<boolean> {
    if (!this.token) return false;
    const guardou = await this.servidor.medicao(this.token, ativa);
    if (guardou === null) return false;
    this.medirAtual = guardou;
    this.avisar();
    return true;
  }

  /** O jogo avisa que o progresso local mudou (um abate, uma recompensa): marca o instante e agenda o envio. Sem sessão, só marca (vale na hora de entrar). */
  mudou(): void {
    this.gravar(CHAVE_MUDOU, String(this.agora()));
    if (!this.token) return;
    this.sincronizadoAgora = false;
    this.cancelarEnvio();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.sincronizar();
    }, ENVIO_APOS_MS);
  }

  /** Puxa o progresso da conta, mescla com o local, aplica o que for mais novo aqui e manda para a conta o que for mais novo lá. Nunca lança; chamadas juntas viram uma. */
  sincronizar(): Promise<void> {
    if (this.sincronizando) return this.sincronizando;
    this.sincronizando = this.sincronizarAgora().finally(() => {
      this.sincronizando = null;
    });
    return this.sincronizando;
  }

  private async sincronizarAgora(): Promise<void> {
    const token = this.token;
    if (!token) return;
    const lido = await this.servidor.lerProgresso(token);
    if (!lido) {
      // Sem rede ou sessão recusada: não mexe em nada; a próxima mudança tenta de novo.
      this.sincronizadoAgora = false;
      this.avisar();
      return;
    }
    const local = this.local.ler(this.quandoMudou());
    const final = mesclarProgresso(local, lido.progresso);
    if (final && !progressoIgual(final, local)) this.local.aplicar(final);
    let ok = true;
    if (final && !progressoIgual(final, lido.progresso)) ok = await this.servidor.gravarProgresso(token, final);
    this.sincronizadoAgora = ok;
    this.avisar();
  }

  private async abrir(resposta: ContaResposta | { erro: string }): Promise<string | null> {
    if ('erro' in resposta) return resposta.erro;
    this.token = resposta.token;
    this.emailAtual = resposta.email;
    this.medirAtual = resposta.medir !== false;
    this.idadeAtual = resposta.idade ?? 'sem-idade';
    this.gravar(this.chave, resposta.token);
    this.avisar();
    await this.sincronizar();
    return null;
  }

  private quandoMudou(): number {
    const n = Number(this.ler(CHAVE_MUDOU));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  private cancelarEnvio(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private avisar(): void {
    this.onMudou?.(this.estado);
    const conta = `${this.emailAtual ?? ''}|${this.idadeAtual}`;
    if (conta === this.conta) return;
    this.conta = conta;
    this.onIdadeMudou?.(this.estado);
  }

  private ler(chave: string): string | null {
    try {
      return this.armazem?.getItem(chave) ?? null;
    } catch {
      return null;
    }
  }

  private gravar(chave: string, valor: string): void {
    try {
      this.armazem?.setItem(chave, valor);
    } catch {
      /* navegador sem armazenamento (aba anônima, cota): a sessão vale só nesta aba */
    }
  }

  private apagar(chave: string): void {
    try {
      this.armazem?.removeItem(chave);
    } catch {
      /* idem */
    }
  }
}
