import type { AdminAvaliacao, AdminEstado, AdminHistorico, AdminLog, AdminSala, AdminTeste, Checagem } from '../../../shared/net/admin';
import type { AdminCliente, MotivoDeFalha, Resposta, TokenDoDono } from '../net/admin';
import {
  caminhoDoGrafico,
  duracao,
  linhaDaSala,
  nivelContraMeta,
  num,
  ROTULO_DO_VEREDITO,
  serie,
  SIMBOLO_DO_RESULTADO,
  textoDoMotivo,
  voltou,
} from './serverData';

/** Metas que a janela desenha como linha tracejada e pinta nos cartões (as mesmas do servidor: `server/admin.ts`, `METAS`). */
const META_TICK_MS = 2;
const META_KBS_POR_JOGADOR = 8;
/** De quanto em quanto tempo a janela aberta pergunta de novo (ms). Fechada ou com a aba escondida, não pergunta. */
const CADA_ESTADO_MS = 5000;
const CADA_HISTORICO_MS = 15_000;
const CADA_LOG_MS = 10_000;
/** Depois de pedir o reinício: de quanto em quanto tempo olha o status público, e quando desiste de esperar. */
const CADA_VOLTA_MS = 3000;
const DESISTE_MS = 3 * 60 * 1000;

export interface ServerPanelOptions {
  cliente: AdminCliente;
  token: TokenDoDono;
  /** Hora de agora (ms): os testes passam uma fixa. */
  agora?: () => number;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

const SVG = 'http://www.w3.org/2000/svg';
function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string> = {}): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

function botao(texto: string, className: string, acao: string, titulo?: string, desligado = false): HTMLButtonElement {
  const b = el('button', className, texto);
  b.type = 'button';
  b.dataset.acao = acao;
  if (titulo) b.title = titulo;
  if (desligado) {
    b.setAttribute('aria-disabled', 'true');
    b.classList.add('off');
  }
  return b;
}

/**
 * A janela do servidor (P93, 12/10: "resetar, testar, avaliar e analisar o servidor e as infos dele"): abre pelo monitor COMANDO do console,
 * pede o token do dono uma vez (fica só neste aparelho) e mostra o servidor de jogo agora (jogadores, salas, tick, CPU, memória, rede, o laço
 * de eventos), a última hora em quatro gráficos, as salas, o fim do log e as três ações: **REINICIAR** (com confirmação; com gente jogando,
 * diz quantos caem), **TESTAR** (clientes de mentira entram pela porta do jogo e medem) e **AVALIAR** (o veredito sobre a última hora e a
 * capacidade). Fala com o servidor só por `AdminCliente`; nada aqui conhece a simulação (G3).
 *
 * Custo: zero no jogo. Aberta, uma consulta leve a cada 5 s (e o histórico a cada 15 s, o log a cada 10 s); fechada, nenhuma.
 */
export class ServerPanel {
  private readonly root: HTMLElement;
  private aberta = false;
  private estado: AdminEstado | null = null;
  private historico: AdminHistorico | null = null;
  private log: AdminLog | null = null;
  private autenticado = false;
  private msg = '';
  private erroDeRede: MotivoDeFalha | null = null;
  /** Confirmando o reinício? (a barra de confirmação aparece no pé). */
  private confirmando = false;
  private ocupado: 'testando' | 'avaliando' | 'reiniciando' | null = null;
  private avaliacao: AdminAvaliacao | null = null;
  private teste: AdminTeste | null = null;
  private timers: ReturnType<typeof setInterval>[] = [];
  private espera: ReturnType<typeof setInterval> | null = null;

  private readonly cab = el('header', 'srv-head');
  private readonly chip = el('span', 'srv-chip');
  private readonly sub = el('span', 'srv-sub');
  private readonly tokenBarra = el('div', 'srv-token');
  private readonly corpo = el('div', 'srv-corpo');
  private readonly cartoes = el('section', 'srv-cartoes');
  private readonly graficos = el('section', 'srv-graficos');
  private readonly lateral = el('section', 'srv-lateral');
  private readonly salasCaixa = el('div', 'srv-salas');
  private readonly salasLista = el('ul');
  private readonly salasTitulo = el('h3');
  private readonly logCaixa = el('div', 'srv-log');
  private readonly logTitulo = el('h3');
  private readonly logTexto = el('pre');
  /** O que o pé mostrava na última vez que foi desenhado (só se refaz quando muda: um clique no meio de um redesenho se perde). */
  private assinaturaDoPe = '';
  private readonly relatorio = el('section', 'srv-relatorio');
  private readonly aviso = el('p', 'srv-msg');
  private readonly acoes = el('div', 'srv-acoes');

  constructor(private readonly o: ServerPanelOptions, root: HTMLElement | null = document.getElementById('server-modal')) {
    if (!root) {
      this.root = el('div');
      return;
    }
    this.root = root;
    this.montar();
    root.addEventListener('click', (e) => this.clique(e));
    // No documento, em captura, só com a janela aberta: depois de um redesenho (o botão apertado some da página) o foco vai para o
    // corpo, e um ouvinte da própria janela nunca mais ouviria o Esc.
    document.addEventListener('keydown', (e) => (this.aberta ? this.tecla(e) : undefined), true);
    root.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.entrar();
    });
    document.addEventListener('visibilitychange', () => {
      if (this.aberta && document.visibilityState === 'visible') void this.atualizarTudo();
    });
  }

  get isOpen(): boolean {
    return this.aberta;
  }

  private get agora(): number {
    return (this.o.agora ?? Date.now)();
  }

  // ─── Abrir e fechar ───────────────────────────────────────────────────────────────────────────────────────────────

  abrir(): boolean {
    if (!this.root.id || !this.o.cliente.temServidor) return false;
    this.aberta = true;
    this.root.classList.remove('hidden');
    this.msg = '';
    this.desenhar();
    this.ligarRelogios();
    void this.atualizarTudo();
    this.root.querySelector<HTMLElement>(this.autenticado ? '.srv-fechar' : '#srv-token')?.focus();
    return true;
  }

  fechar(): void {
    this.aberta = false;
    this.root.classList.add('hidden');
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    if (this.espera) clearInterval(this.espera);
    this.espera = null;
    this.confirmando = false;
  }

  private ligarRelogios(): void {
    for (const t of this.timers) clearInterval(t);
    const quando = (ms: number, fazer: () => void) => setInterval(() => (this.aberta && this.autenticado && document.visibilityState === 'visible' ? fazer() : undefined), ms);
    this.timers = [
      quando(CADA_ESTADO_MS, () => void this.pedirEstado()),
      quando(CADA_HISTORICO_MS, () => void this.pedirHistorico()),
      quando(CADA_LOG_MS, () => void this.pedirLog()),
    ];
  }

  // ─── O que se pergunta ao servidor ────────────────────────────────────────────────────────────────────────────────

  private async atualizarTudo(): Promise<void> {
    if (!this.o.token.ler()) {
      this.autenticado = false;
      this.desenhar();
      return;
    }
    await Promise.all([this.pedirEstado(), this.pedirHistorico(), this.pedirLog()]);
  }

  /** Trata a falha de uma chamada: token ruim volta à tela do token; o resto vira aviso e a janela segue com o que tinha. */
  private falhou<T>(r: Resposta<T>): r is Extract<Resposta<T>, { ok: false }> {
    if (r.ok) {
      this.erroDeRede = null;
      return false;
    }
    this.erroDeRede = r.motivo;
    if (r.motivo === 'token' || r.motivo === 'sem-token') {
      this.autenticado = false;
      this.msg = textoDoMotivo(r.motivo, r.erro);
    }
    return true;
  }

  private async pedirEstado(): Promise<void> {
    const estavaAutenticado = this.autenticado;
    const r = await this.o.cliente.estado();
    if (!this.falhou(r) && r.ok) {
      this.estado = r.dados;
      this.autenticado = true;
    }
    if (!this.aberta) return;
    // A janela inteira só se refaz quando entra ou sai do painel; a cada consulta mudam o selo, os cartões, as salas e (se mudou) o pé.
    if (estavaAutenticado !== this.autenticado) this.desenhar();
    else {
      this.desenharCabecalho();
      if (this.autenticado) {
        this.desenharCartoes();
        this.desenharSalas();
      }
      this.desenharPe();
    }
  }

  private async pedirHistorico(): Promise<void> {
    const r = await this.o.cliente.historico();
    if (!this.falhou(r) && r.ok) this.historico = r.dados;
    if (this.aberta) this.desenharGraficos();
  }

  private async pedirLog(): Promise<void> {
    const r = await this.o.cliente.log();
    if (!this.falhou(r) && r.ok) this.log = r.dados;
    if (this.aberta) this.desenharLog();
  }

  // ─── Esqueleto (uma vez) ──────────────────────────────────────────────────────────────────────────────────────────

  private montar(): void {
    const box = el('div', 'srv-box');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-labelledby', 'srv-titulo');
    const titulo = el('h2', '', 'SERVIDOR');
    titulo.id = 'srv-titulo';
    this.cab.append(titulo, this.chip, this.sub, botao('[X]', 'btn-close srv-fechar', 'fechar', 'Fechar (Esc)'));
    this.salasCaixa.append(this.salasTitulo, this.salasLista);
    this.logCaixa.append(this.logTitulo, this.logTexto);
    this.lateral.append(this.salasCaixa, this.logCaixa);
    this.montarToken();
    this.corpo.append(this.cartoes, this.graficos, this.lateral);
    const pe = el('footer', 'srv-pe');
    this.aviso.setAttribute('role', 'status');
    pe.append(this.aviso, this.acoes);
    box.append(this.cab, this.tokenBarra, this.corpo, this.relatorio, pe);
    this.root.replaceChildren(box);
  }

  // ─── Desenho ──────────────────────────────────────────────────────────────────────────────────────────────────────

  private desenhar(): void {
    this.assinaturaDoPe = '';
    this.desenharCabecalho();
    this.desenharToken();
    this.corpo.hidden = !this.autenticado;
    this.relatorio.hidden = !this.autenticado || (!this.avaliacao && !this.teste && !this.ocupado);
    if (this.autenticado) {
      this.desenharCartoes();
      this.desenharGraficos();
      this.desenharLateral();
      this.desenharRelatorio();
    }
    this.desenharPe();
  }

  private desenharCabecalho(): void {
    const e = this.estado;
    const fora = this.erroDeRede === 'fora-do-ar';
    const reiniciando = this.ocupado === 'reiniciando' || !!e?.reiniciando;
    this.chip.className = `srv-chip ${fora ? 'fora' : reiniciando ? 'reiniciando' : e ? 'no-ar' : 'sem'}`;
    this.chip.textContent = fora ? 'FORA DO AR' : reiniciando ? 'REINICIANDO' : e ? 'NO AR' : 'SEM LEITURA';
    this.sub.textContent = e ? `versão ${e.release} · há ${duracao(e.uptimeS)} · ${e.supervisionado ? 'se religa sozinho (se cair, em até 10 min)' : 'rodando à mão (ninguém o religa)'}` : 'o servidor de jogo do PC';
  }

  /** O formulário do token, uma vez só: refazê-lo a cada consulta apagava o que a pessoa estava digitando. */
  private montarToken(): void {
    const form = el('form', 'srv-token-form');
    const rotulo = el('label', '', 'Token do dono');
    rotulo.htmlFor = 'srv-token';
    const campo = el('input');
    campo.type = 'password';
    campo.id = 'srv-token';
    campo.autocomplete = 'off';
    campo.spellcheck = false;
    campo.placeholder = 'cole o token aqui';
    const entrar = el('button', 'btn-terminal', '[ ENTRAR ]');
    entrar.type = 'submit';
    form.append(rotulo, campo, entrar);
    this.tokenBarra.replaceChildren(
      form,
      el('p', 'srv-dica', 'O token é o conteúdo de metricas-token.txt, na pasta de dados do servidor (.tmp/servidor/, no PC onde ele roda). Fica guardado só neste aparelho; só o dono o tem.'),
    );
  }

  private desenharToken(): void {
    this.tokenBarra.hidden = this.autenticado;
  }

  private desenharCartoes(): void {
    const e = this.estado;
    const lacoOk = e ? nivelContraMeta(e.lacoMs.p99, 20) : 'ok';
    const cartao = (rotulo: string, valor: string, sub: string, nivel: 'ok' | 'atencao' | 'falha' | '' = '') => {
      const c = el('div', `srv-cartao${nivel ? ` n-${nivel}` : ''}`);
      c.append(el('small', '', rotulo), el('b', '', valor), el('span', '', sub));
      return c;
    };
    const tickMax = e ? Math.max(0, ...e.salas.map((s) => s.tickMs)) : 0;
    this.cartoes.replaceChildren(
      cartao('JOGADORES', e ? String(e.jogadores) : '—', e ? `${e.conexoes} conexões` : ''),
      cartao('SALAS', e ? String(e.salas.length) : '—', e ? `${e.salas.reduce((n, s) => n + s.bots, 0)} bots` : ''),
      cartao('TICK', e ? `${num(tickMax, 2)} ms` : '—', `meta ${META_TICK_MS} ms por sala`, e ? nivelContraMeta(tickMax, META_TICK_MS) : ''),
      cartao('CPU', e ? `${Math.round(e.cpuPct)}%` : '—', 'de um núcleo', e ? (e.cpuPct <= 50 ? 'ok' : e.cpuPct <= 80 ? 'atencao' : 'falha') : ''),
      cartao('MEMÓRIA', e ? `${Math.round(e.memoria.rssMB)} MB` : '—', e ? `heap ${Math.round(e.memoria.heapMB)} MB` : '', e ? (e.memoria.rssMB <= 300 ? 'ok' : e.memoria.rssMB <= 500 ? 'atencao' : 'falha') : ''),
      cartao('REDE', e ? `${num(e.redeKBs.saida, 1)} KB/s` : '—', e ? `↓ por jogador ${e.jogadores ? num(e.redeKBs.saida / e.jogadores, 1) : '—'} · meta ${META_KBS_POR_JOGADOR}` : '', e && e.jogadores ? nivelContraMeta(e.redeKBs.saida / e.jogadores, META_KBS_POR_JOGADOR) : ''),
      cartao('LAÇO (p99)', e ? `${num(e.lacoMs.p99, 1)} ms` : '—', e ? `pior ${num(e.lacoMs.maximo, 1)} ms` : '', e ? lacoOk : ''),
      cartao('CONTAS', e?.contas === null || e?.contas === undefined ? '—' : String(e.contas), e ? `${e.recusas.total + e.recusas.ip + e.recusas.taxa} recusas desde que subiu` : ''),
    );
  }

  private desenharGraficos(): void {
    const am = this.historico?.amostras ?? [];
    const g = (titulo: string, valores: number[], unidade: string, o: { meta?: number; piso?: number; casas?: number }) => {
      const caixa = el('figure', 'srv-grafico');
      const agora = valores.length ? valores[valores.length - 1]! : 0;
      const topo = el('figcaption');
      topo.append(el('span', '', titulo), el('b', '', `${num(agora, o.casas ?? 1)} ${unidade}`));
      const c = caminhoDoGrafico(valores, 220, 56, o);
      const s = svg('svg', { viewBox: '0 0 220 56', preserveAspectRatio: 'none', role: 'img', 'aria-label': `${titulo}, última hora` });
      s.append(svg('path', { class: 'area', d: c.area }), svg('path', { class: 'linha', d: c.linha }));
      if (c.yDaMeta !== null) s.append(svg('line', { class: 'meta', x1: '0', x2: '220', y1: String(c.yDaMeta), y2: String(c.yDaMeta) }));
      const base = el('small', '', `${duracao(Math.max(0, am.length - 1) * (this.historico?.passoS ?? 5))} atrás … agora · teto ${num(c.max, c.max < 10 ? 1 : 0)} ${unidade}`);
      caixa.append(topo, s, base);
      return caixa;
    };
    this.graficos.replaceChildren(
      g('Jogadores', serie(am, 'jogadores'), '', { piso: 4, casas: 0 }),
      g('Tick da pior sala', serie(am, 'tickMs'), 'ms', { piso: 3, meta: META_TICK_MS, casas: 2 }),
      g('Rede (saída)', serie(am, 'saidaKBs'), 'KB/s', { piso: 16 }),
      g('Memória', serie(am, 'rssMB'), 'MB', { piso: 128, casas: 0 }),
    );
  }

  private desenharLateral(): void {
    this.desenharSalas();
    this.desenharLog();
  }

  private desenharSalas(): void {
    const e = this.estado;
    this.salasTitulo.textContent = `SALAS ${e ? e.salas.length : ''}`;
    const itens = e && e.salas.length ? e.salas.map((s) => this.linhaDeSala(s)) : [el('li', 'srv-vazio', e ? 'Nenhuma sala aberta: ninguém jogando.' : '—')];
    this.salasLista.replaceChildren(...itens);
  }

  /** O log abre no fim, onde está o que acabou de acontecer; quem rolou para cima para ler não é puxado de volta. */
  private desenharLog(): void {
    const pre = this.logTexto;
    const noFim = pre.scrollHeight - pre.scrollTop - pre.clientHeight < 24;
    this.logTitulo.textContent = `LOG ${this.log ? `(${this.log.fonte === 'arquivo' ? 'registro de 30 dias' : 'desde que subiu'})` : ''}`;
    const novo = this.log?.linhas.slice(-60).join('\n') ?? '';
    if (pre.textContent !== novo) {
      pre.textContent = novo;
      if (noFim) pre.scrollTop = pre.scrollHeight;
    }
  }

  private linhaDeSala(s: AdminSala): HTMLElement {
    const li = el('li');
    const texto = el('span');
    texto.append(el('b', '', s.codigo), document.createTextNode(linhaDaSala(s).slice(s.codigo.length)));
    if (s.nomes.length) texto.append(el('small', '', ` · ${s.nomes.join(', ')}`));
    li.append(texto, botao('FECHAR', 'srv-fecha', 'fechar-sala', `Fecha a sala ${s.codigo}: quem está nela cai e o jogo reconecta numa nova`));
    (li.lastElementChild as HTMLElement).dataset.sala = s.codigo;
    return li;
  }

  private desenharRelatorio(): void {
    const partes: HTMLElement[] = [];
    if (this.ocupado === 'testando') partes.push(this.cartaoDeEspera('TESTE DO SERVIDOR', 'Quatro pilotos de mentira entram pela porta do jogo e andam uns segundos…'));
    if (this.ocupado === 'avaliando') partes.push(this.cartaoDeEspera('AVALIAÇÃO', 'Lendo a última hora…'));
    if (this.avaliacao && this.ocupado !== 'avaliando') partes.push(this.cartaoDeAvaliacao(this.avaliacao));
    if (this.teste && this.ocupado !== 'testando') partes.push(this.cartaoDeTeste(this.teste));
    this.relatorio.replaceChildren(...partes);
  }

  private cartaoDeEspera(titulo: string, texto: string): HTMLElement {
    const c = el('article', 'srv-relato espera');
    c.append(el('h3', '', titulo), el('p', '', texto));
    return c;
  }

  private checagens(lista: readonly Checagem[]): HTMLElement {
    const ul = el('ul', 'srv-checagens');
    for (const c of lista) {
      const li = el('li', `n-${c.resultado}`);
      li.append(el('i', '', SIMBOLO_DO_RESULTADO[c.resultado]), el('b', '', c.nome), el('span', '', `${c.valor} (${c.limite})`));
      if (c.dica) li.append(el('small', '', c.dica));
      ul.append(li);
    }
    return ul;
  }

  private cartaoDeAvaliacao(a: AdminAvaliacao): HTMLElement {
    const c = el('article', `srv-relato v-${a.veredito}`);
    const topo = el('div', 'srv-relato-topo');
    topo.append(el('h3', '', 'AVALIAÇÃO'), el('strong', `selo v-${a.veredito}`, ROTULO_DO_VEREDITO[a.veredito]), el('small', '', `janela observada: ${duracao(a.janelaS)}`));
    const cap = a.capacidade;
    c.append(
      topo,
      el('p', '', a.resumo),
      this.checagens(a.checagens),
      el('p', 'srv-cap', `Capacidade estimada pela CPU: ~${cap.salasPorTick} salas de ${cap.jogadoresPorSala} (até ~${cap.jogadoresSimultaneos} jogadores). Não conta a banda de casa nem a memória.`),
    );
    return c;
  }

  private cartaoDeTeste(t: AdminTeste): HTMLElement {
    const c = el('article', `srv-relato ${t.ok ? 'v-apto' : 'v-problema'}`);
    const topo = el('div', 'srv-relato-topo');
    topo.append(el('h3', '', 'TESTE DO SERVIDOR'), el('strong', `selo ${t.ok ? 'v-apto' : 'v-problema'}`, t.ok ? 'PASSOU' : 'FALHOU'), el('small', '', `${t.clientes} pilotos de mentira · ${num(t.duracaoS, 1)} s`));
    c.append(topo, this.checagens(t.checagens));
    return c;
  }

  private desenharPe(): void {
    const e = this.estado;
    const n = e?.jogadores ?? 0;
    const ocupado = this.ocupado !== null;
    const assinatura = [this.autenticado, this.confirmando, this.ocupado, n, e?.supervisionado, this.msg, this.erroDeRede].join('|');
    if (assinatura === this.assinaturaDoPe) return;
    this.assinaturaDoPe = assinatura;
    this.aviso.textContent = this.msg || (this.erroDeRede && this.erroDeRede !== 'token' && this.erroDeRede !== 'sem-token' ? textoDoMotivo(this.erroDeRede) : '');
    this.aviso.classList.toggle('aviso', !!this.erroDeRede);
    if (!this.autenticado) {
      this.acoes.replaceChildren();
      return;
    }
    if (this.confirmando) {
      this.acoes.replaceChildren(
        el('span', 'srv-confirma', n > 0 ? `${n} jogador${n === 1 ? '' : 'es'} jogando agora: ${n === 1 ? 'ele cai' : 'eles caem'} e reconecta${n === 1 ? '' : 'm'} sozinho${n === 1 ? '' : 's'}. Reiniciar mesmo?` : 'Ninguém está jogando. Reiniciar o servidor?'),
        botao('[ CONFIRMAR REINÍCIO ]', 'btn-terminal srv-perigo', 'reiniciar-sim'),
        botao('[ CANCELAR ]', 'btn-terminal', 'reiniciar-nao'),
      );
      return;
    }
    this.acoes.replaceChildren(
      botao('[ AVALIAR ]', 'btn-terminal', 'avaliar', 'O veredito sobre a última hora e quantas salas cabem', ocupado),
      botao('[ REGRAS DAS SALAS ]', 'btn-terminal', 'regras', 'Dificuldade, quantos bots e a pressão dos inimigos nas salas online'),
      botao('[ TESTAR ]', 'btn-terminal', 'testar', n > 0 ? 'O teste espera a sala esvaziar: há gente jogando' : 'Quatro pilotos de mentira entram pela porta do jogo e medem', ocupado || n > 0),
      botao('[ REINICIAR ]', 'btn-terminal srv-perigo', 'reiniciar', e?.supervisionado === false ? 'O servidor roda à mão: reiniciar só o desliga' : 'Salva, sai e se religa sozinho em uns segundos', ocupado),
      botao('[ SAIR DO PAINEL ]', 'btn-terminal', 'sair', 'Esquece o token neste aparelho'),
    );
  }

  // ─── Ações ────────────────────────────────────────────────────────────────────────────────────────────────────────

  private clique(e: Event): void {
    if (e.target === this.root) return this.fechar();
    const alvo = (e.target as HTMLElement).closest<HTMLElement>('[data-acao]');
    if (!alvo || alvo.getAttribute('aria-disabled') === 'true') return;
    switch (alvo.dataset.acao) {
      case 'fechar':
        return this.fechar();
      case 'sair':
        this.o.token.apagar();
        this.autenticado = false;
        this.estado = null;
        this.historico = null;
        this.log = null;
        this.avaliacao = null;
        this.teste = null;
        this.msg = 'Token esquecido neste aparelho.';
        this.desenhar();
        return;
      case 'regras':
        return void import('./RegrasPanel').then((m) => new m.RegrasPanel(this.o.cliente).abrir());
      case 'avaliar':
        return void this.avaliar();
      case 'testar':
        return void this.testar();
      case 'reiniciar':
        this.confirmando = true;
        this.msg = '';
        this.desenharPe();
        return;
      case 'reiniciar-nao':
        this.confirmando = false;
        this.msg = '';
        this.desenharPe();
        return;
      case 'reiniciar-sim':
        return void this.reiniciar();
      case 'fechar-sala':
        return void this.fecharSala(alvo.dataset.sala ?? '');
    }
  }

  private tecla(e: KeyboardEvent): void {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    e.preventDefault();
    if (this.confirmando) {
      this.confirmando = false;
      this.desenharPe();
    } else this.fechar();
  }

  private async entrar(): Promise<void> {
    const campo = this.root.querySelector<HTMLInputElement>('#srv-token');
    const t = campo?.value.trim() ?? '';
    if (!t) return;
    this.o.token.gravar(t);
    this.msg = 'Conferindo o token…';
    this.desenharPe();
    const r = await this.o.cliente.estado();
    if (this.falhou(r) || !r.ok) {
      this.o.token.apagar();
      this.msg = textoDoMotivo(r.ok ? 'resposta' : r.motivo, r.ok ? undefined : r.erro);
      this.desenhar();
      return;
    }
    this.estado = r.dados;
    this.autenticado = true;
    this.msg = '';
    this.desenhar();
    void Promise.all([this.pedirHistorico(), this.pedirLog()]);
  }

  private async avaliar(): Promise<void> {
    this.ocupado = 'avaliando';
    this.desenhar();
    const r = await this.o.cliente.avaliar();
    this.ocupado = null;
    if (!this.falhou(r) && r.ok) {
      this.avaliacao = r.dados;
      this.msg = '';
    } else if (!r.ok) this.msg = textoDoMotivo(r.motivo, r.erro);
    this.desenhar();
  }

  private async testar(): Promise<void> {
    this.ocupado = 'testando';
    this.msg = '';
    this.desenhar();
    const r = await this.o.cliente.testar();
    this.ocupado = null;
    if (!this.falhou(r) && r.ok) {
      this.teste = r.dados;
      this.msg = '';
    } else if (!r.ok) this.msg = textoDoMotivo(r.motivo, r.erro);
    this.desenhar();
    void this.pedirEstado();
  }

  private async fecharSala(codigo: string): Promise<void> {
    if (!codigo) return;
    const r = await this.o.cliente.fecharSala(codigo);
    this.msg = r.ok ? `Sala ${codigo} fechada.` : textoDoMotivo(r.motivo, r.erro);
    this.desenharPe();
    await this.pedirEstado();
  }

  private async reiniciar(): Promise<void> {
    const antes = this.estado?.uptimeS ?? 0;
    const n = this.estado?.jogadores ?? 0;
    const r = await this.o.cliente.reiniciar(n > 0);
    if (!r.ok) {
      // Entrou gente depois da última leitura: a tela mostra quantos e pede a confirmação de novo.
      this.confirmando = r.motivo === 'recusado' && (r.erro?.jogadores ?? 0) > 0;
      this.msg = textoDoMotivo(r.motivo, r.erro);
      if (r.erro?.jogadores !== undefined && this.estado) this.estado = { ...this.estado, jogadores: r.erro.jogadores };
      this.desenhar();
      return;
    }
    this.confirmando = false;
    this.ocupado = 'reiniciando';
    this.msg = `Reiniciando: o servidor sai em ${num(r.dados.emS, 0)} s${r.dados.religa === 'supervisionado' ? ' e se religa sozinho' : '; ele roda à mão e ninguém o religa: ligue-o de novo no PC'}.`;
    this.avaliacao = null;
    this.teste = null;
    this.desenhar();
    this.esperarAVolta(antes, r.dados.religa, this.agora);
  }

  /** Olha o status público de poucos em poucos segundos até o servidor voltar com o uptime zerado (ou desistir). */
  private esperarAVolta(uptimeAntes: number, religa: 'supervisionado' | 'sozinho', desde: number): void {
    if (this.espera) clearInterval(this.espera);
    this.espera = setInterval(() => {
      void (async () => {
        const s = await this.o.cliente.statusPublico();
        if (voltou(uptimeAntes, s?.uptimeS ?? null)) {
          if (this.espera) clearInterval(this.espera);
          this.espera = null;
          this.ocupado = null;
          this.msg = `O servidor voltou em ${duracao((this.agora - desde) / 1000)}.`;
          this.erroDeRede = null;
          await this.atualizarTudo();
        } else if (this.agora - desde > DESISTE_MS) {
          if (this.espera) clearInterval(this.espera);
          this.espera = null;
          this.ocupado = null;
          this.msg =
            religa === 'supervisionado'
              ? 'Passaram 3 minutos e ele não voltou. O atualizador do Windows (a cada 10 min) o liga se ele não responder; veja o servidor.log no PC.'
              : 'Passaram 3 minutos: ele roda à mão e ninguém o religa. Ligue o servidor de novo no PC.';
          this.desenhar();
        } else if (this.aberta) {
          this.erroDeRede = s ? null : 'fora-do-ar';
          this.desenharCabecalho();
        }
      })();
    }, CADA_VOLTA_MS);
  }
}
