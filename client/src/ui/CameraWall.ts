import type { AdminCliente } from '../net/admin';
import type { EstadoDoMural, MuralCliente } from '../net/mural';
import type { MuralSala } from '../../../shared/net/mural';
import { linhaDoCartao, ordenarSalas, quadroDaSala, textoDoEstado, totais } from './cameraData';
import { TacticalRadar, type RadarCaixa } from './TacticalRadar';

export interface CameraWallOptions {
  /** O canal do mural (`net/mural.ts`): a janela o liga ao abrir e o desliga ao fechar. */
  mural: MuralCliente;
  /** A planta e o tamanho do mapa das salas online (a Arena): os mesmos do radar do console. */
  planta: () => readonly RadarCaixa[];
  meia: number;
  /** Os apelidos dos pilotos de cada sala, do painel do servidor (opcional: sem isto, os cartões não dizem quem joga). */
  nomes?: AdminCliente;
  /** Abre a janela do SERVIDOR (onde se digita o token), quando falta. */
  abrirServidor?: () => void;
}

/** De quanto em quanto tempo a janela aberta pergunta os apelidos ao painel do servidor. */
const CADA_NOMES_MS = 5000;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

interface Cartao {
  raiz: HTMLElement;
  titulo: HTMLElement;
  detalhe: HTMLElement;
  nomes: HTMLElement;
  radar: TacticalRadar;
  sala: MuralSala;
}

/**
 * A janela de câmeras ao vivo (P88, 11/10: "assistir as câmeras de várias partidas simultaneamente, pelo servidor"): um **mural de radares**,
 * um cartão por partida aberta no servidor, todos alimentados por uma conexão só (`net/mural.ts`). Abre pelo monitor COMANDO do console.
 * Sem token, diz como entrar (a janela do SERVIDOR); com ele, as partidas aparecem sozinhas, com quem joga, a rodada e o tempo, e somem
 * quando a sala fecha. **Observar não é jogar:** ninguém aparece no placar, nenhuma vaga é ocupada.
 *
 * Custo: zero no jogo. Aberta, a conexão traz 4 quadros por segundo (~0,5 KB/s por sala cheia) e a janela redesenha até 8 radares pequenos
 * a cada quadro; fechada, a conexão cai e nada roda. Nunca cria uma cena 3D por sala (G12).
 */
export class CameraWall {
  private readonly root: HTMLElement;
  private aberta = false;
  private readonly cartoes = new Map<string, Cartao>();
  private salas: readonly MuralSala[] = [];
  private nomes = new Map<string, readonly string[]>();
  private timerNomes: ReturnType<typeof setInterval> | null = null;

  private readonly cab = el('header', 'cam-head');
  private readonly chip = el('span', 'cam-chip');
  private readonly sub = el('span', 'cam-sub');
  private readonly aviso = el('div', 'cam-aviso');
  private readonly avisoTexto = el('p');
  private readonly grade = el('section', 'cam-grade');
  private readonly vazio = el('p', 'cam-vazio', 'Nenhuma partida aberta agora. Quando alguém entrar numa sala, o radar dela aparece aqui.');

  constructor(
    private readonly o: CameraWallOptions,
    root: HTMLElement | null = document.getElementById('cameras-modal'),
  ) {
    if (!root) {
      this.root = el('div');
      return;
    }
    this.root = root;
    this.montar();
    root.addEventListener('click', (e) => this.clique(e));
    // No documento, em captura, só com a janela aberta: o Esc tem de fechar mesmo se o foco foi para o corpo da página.
    document.addEventListener('keydown', (e) => (this.aberta ? this.tecla(e) : undefined), true);
    document.addEventListener('visibilitychange', () => {
      if (this.aberta && document.visibilityState === 'visible') void this.pedirNomes();
    });
  }

  get isOpen(): boolean {
    return this.aberta;
  }

  /** O estado da conexão (a tela que abre a janela mostra as câmeras só com servidor). */
  get temServidor(): boolean {
    return this.o.mural.temServidor;
  }

  abrir(): boolean {
    if (!this.root.id || !this.o.mural.temServidor) return false;
    this.aberta = true;
    this.root.classList.remove('hidden');
    this.desenharEstado(this.o.mural.estado);
    this.o.mural.abrir();
    if (this.o.nomes) {
      void this.pedirNomes();
      this.timerNomes = setInterval(() => (document.visibilityState === 'visible' ? void this.pedirNomes() : undefined), CADA_NOMES_MS);
    }
    this.root.querySelector<HTMLElement>('.cam-fechar')?.focus();
    return true;
  }

  fechar(): void {
    this.aberta = false;
    this.root.classList.add('hidden');
    this.o.mural.fechar();
    if (this.timerNomes) clearInterval(this.timerNomes);
    this.timerNomes = null;
    this.limparCartoes();
    this.salas = [];
  }

  /** Um quadro novo do mural (o `Game` liga ao `MuralCliente`). */
  quadro(salas: readonly MuralSala[]): void {
    if (!this.aberta) return;
    this.salas = salas;
    this.desenharSalas();
  }

  /** O estado da conexão mudou (o `Game` liga ao `MuralCliente`). */
  estado(e: EstadoDoMural): void {
    if (this.aberta) this.desenharEstado(e);
  }

  // ─── Esqueleto ────────────────────────────────────────────────────────────────────────────────────────────────────

  private montar(): void {
    const box = el('div', 'cam-box');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-labelledby', 'cam-titulo');
    const titulo = el('h2', '', 'CÂMERAS AO VIVO');
    titulo.id = 'cam-titulo';
    const fechar = el('button', 'btn-close cam-fechar', '[X]');
    fechar.type = 'button';
    fechar.dataset.acao = 'fechar';
    fechar.title = 'Fechar (Esc)';
    this.cab.append(titulo, this.chip, this.sub, fechar);
    const servidor = el('button', 'btn-terminal', '[ ABRIR SERVIDOR ]');
    servidor.type = 'button';
    servidor.dataset.acao = 'servidor';
    servidor.title = 'A janela do SERVIDOR pede o token do dono; o mesmo vale aqui';
    this.aviso.append(this.avisoTexto, servidor);
    this.grade.setAttribute('aria-live', 'polite');
    const pe = el('footer', 'cam-pe');
    pe.append(el('p', '', 'Um canal só, quatro quadros por segundo, uns 0,5 KB/s por sala cheia. Observar não é jogar: ninguém ocupa vaga nem aparece no placar.'));
    box.append(this.cab, this.aviso, this.grade, pe);
    this.root.replaceChildren(box);
  }

  // ─── Desenho ──────────────────────────────────────────────────────────────────────────────────────────────────────

  private desenharEstado(e: EstadoDoMural): void {
    const t = textoDoEstado(e);
    this.chip.className = `cam-chip ${t.tom}`;
    this.chip.textContent = t.chip;
    this.aviso.hidden = t.frase === null;
    this.avisoTexto.textContent = t.frase ?? '';
    const botao = this.aviso.querySelector<HTMLElement>('[data-acao="servidor"]');
    if (botao) botao.hidden = !t.pedeToken || !this.o.abrirServidor;
    // Sem sinal, os radares param no último quadro: melhor apagar do que mostrar partida velha como se fosse ao vivo.
    if (e !== 'ao-vivo' && e !== 'caiu') {
      this.salas = [];
      this.desenharSalas();
    }
    this.desenharCabecalho();
  }

  private desenharCabecalho(): void {
    const t = totais(this.salas);
    this.sub.textContent = this.salas.length ? `${t.salas} partida${t.salas === 1 ? '' : 's'} · ${t.pilotos} piloto${t.pilotos === 1 ? '' : 's'}` : 'o servidor de jogo, em radar';
  }

  /** Põe os cartões em dia com o quadro: cria os que faltam, tira os que sumiram, atualiza texto e radar dos que ficam. */
  private desenharSalas(): void {
    const ordem = ordenarSalas(this.salas);
    const presentes = new Set(ordem.map((s) => s.codigo));
    for (const [codigo, c] of this.cartoes) {
      if (presentes.has(codigo)) continue;
      c.radar.dispose();
      c.raiz.remove();
      this.cartoes.delete(codigo);
    }
    ordem.forEach((sala, i) => {
      let c = this.cartoes.get(sala.codigo);
      if (!c) {
        c = this.criarCartao(sala);
        this.cartoes.set(sala.codigo, c);
      }
      c.sala = sala;
      const l = linhaDoCartao(sala);
      if (c.titulo.textContent !== l.titulo) c.titulo.textContent = l.titulo;
      if (c.detalhe.textContent !== l.detalhe) c.detalhe.textContent = l.detalhe;
      this.escreverNomes(c);
      // A ordem na grade segue a ordem das salas (mais gente primeiro); só mexe no DOM se mudou de lugar.
      if (this.grade.children[i] !== c.raiz) this.grade.insertBefore(c.raiz, this.grade.children[i] ?? null);
      c.radar.desenhar();
    });
    const vazio = this.cartoes.size === 0 && this.o.mural.estado === 'ao-vivo';
    if (vazio && !this.vazio.isConnected) this.grade.append(this.vazio);
    else if (!vazio && this.vazio.isConnected) this.vazio.remove();
    this.desenharCabecalho();
  }

  private criarCartao(sala: MuralSala): Cartao {
    const raiz = el('article', 'cam-cartao');
    const cab = el('header', 'cam-cartao-cab');
    const titulo = el('h3');
    const detalhe = el('span');
    cab.append(titulo, detalhe);
    const radarRaiz = el('div', 'cam-radar');
    radarRaiz.append(document.createElement('canvas'));
    const nomes = el('p', 'cam-nomes');
    raiz.append(cab, radarRaiz, nomes);
    this.grade.append(raiz);
    const cartao: Cartao = {
      raiz,
      titulo,
      detalhe,
      nomes,
      sala,
      radar: new TacticalRadar(radarRaiz, () => quadroDaSala(cartao.sala, this.o.planta(), this.o.meia)),
    };
    cartao.radar.acender();
    return cartao;
  }

  private escreverNomes(c: Cartao): void {
    const lista = this.nomes.get(c.sala.codigo);
    const texto = lista?.length ? lista.join(' · ') : '';
    if (c.nomes.textContent !== texto) c.nomes.textContent = texto;
  }

  private limparCartoes(): void {
    for (const c of this.cartoes.values()) c.radar.dispose();
    this.cartoes.clear();
    this.grade.replaceChildren();
  }

  // ─── Apelidos (o painel do servidor sabe quem joga em cada sala) ─────────────────────────────────────────────────────

  private async pedirNomes(): Promise<void> {
    if (!this.o.nomes) return;
    const r = await this.o.nomes.estado();
    if (!this.aberta || !r.ok) return;
    this.nomes = new Map(r.dados.salas.map((s) => [s.codigo, s.nomes]));
    for (const c of this.cartoes.values()) this.escreverNomes(c);
  }

  // ─── Ações ────────────────────────────────────────────────────────────────────────────────────────────────────────

  private clique(e: Event): void {
    if (e.target === this.root) return this.fechar();
    const alvo = (e.target as HTMLElement).closest<HTMLElement>('[data-acao]');
    if (!alvo) return;
    if (alvo.dataset.acao === 'fechar') return this.fechar();
    if (alvo.dataset.acao === 'servidor') {
      this.fechar();
      this.o.abrirServidor?.();
    }
  }

  private tecla(e: KeyboardEvent): void {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    e.preventDefault();
    this.fechar();
  }
}
