import { mesclarProgresso, progressoIgual, type ContaResposta, type ProgressoPiloto } from '../../../shared/net/auth';
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
  criar(email: string, senha: string): Promise<ContaResposta | { erro: string }>;
  entrar(email: string, senha: string): Promise<ContaResposta | { erro: string }>;
  sair(token: string): Promise<void>;
  eu(token: string): Promise<{ email: string; is_admin: boolean } | null>;
  lerProgresso(token: string): Promise<{ progresso: ProgressoPiloto | null } | null>;
  gravarProgresso(token: string, progresso: ProgressoPiloto): Promise<boolean>;
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
}

export class SessaoPiloto {
  private token: string | null = null;
  private emailAtual: string | null = null;
  private sincronizadoAgora = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private sincronizando: Promise<void> | null = null;
  /** O que a tela precisa saber: entrou, saiu, sincronizou. */
  onMudou?: (estado: EstadoSessao) => void;

  constructor(
    private readonly servidor: ServidorDeContas,
    private readonly armazem: Armazem | null,
    private readonly local: ProgressoLocal,
    private readonly chave: string,
    private readonly agora: () => number = () => Date.now(),
  ) {}

  get estado(): EstadoSessao {
    return { email: this.emailAtual, sincronizado: this.sincronizadoAgora };
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
    this.avisar();
    await this.sincronizar();
  }

  /** `null` = entrou; senão a mensagem de erro, pronta para a tela. */
  async entrar(email: string, senha: string): Promise<string | null> {
    return this.abrir(await this.servidor.entrar(email, senha));
  }

  async criar(email: string, senha: string): Promise<string | null> {
    return this.abrir(await this.servidor.criar(email, senha));
  }

  /** Sai da conta: avisa o servidor, esquece o token. **O progresso local fica** (o aparelho continua do piloto). */
  async sair(): Promise<void> {
    const token = this.token;
    this.cancelarEnvio();
    this.token = null;
    this.emailAtual = null;
    this.sincronizadoAgora = false;
    this.apagar(this.chave);
    this.avisar();
    if (token) await this.servidor.sair(token);
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
