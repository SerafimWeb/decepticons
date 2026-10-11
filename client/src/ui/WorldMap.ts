import type { MapId } from '../environment/Bunker';
import type { GameMode } from '../sim/gameMode';
import { GAME_MODES } from './ModeSelector';
import { mapHref } from './MapLinks';
import {
  BRASIL,
  decodificarMascara,
  deltaLon,
  ENQUADRAMENTOS,
  enquadrar,
  formatarCoordenada,
  estadoDoTeatro,
  interpolarVista,
  MAR,
  passoDaGrade,
  projetar,
  RECURSO_NOME,
  TEATROS,
  type Enquadramento,
  type EstadoTeatro,
  type Teatro,
  type Vista,
} from './theater';
import { BRASIL_CONTORNO, BRASIL_CONTORNO_ESCALA } from './brasilContorno';
import { escalaTipografica } from './escala';
import { WORLD_MASK } from './worldMask';

const ZOOM_MS = 420;
const ZOOM_KEY = 'cybermech.console.zoom.v1';
const COR_TERRA = 'rgba(0, 229, 255, 0.30)';
const COR_BRASIL = 'rgba(57, 255, 106, 0.78)';
const COR_GRADE = 'rgba(0, 229, 255, 0.07)';
const COR_ROTULO = 'rgba(0, 229, 255, 0.5)';
const COR_CONTORNO = 'rgba(120, 255, 160, 0.95)';

const ESTADO_TEXTO: Readonly<Record<EstadoTeatro, string>> = {
  aqui: 'VOCÊ ESTÁ AQUI',
  disponivel: 'DISPONÍVEL',
  'outro-modo': 'SÓ NO DEATHMATCH',
  'em-breve': 'EM CONSTRUÇÃO',
};

export interface TeatroContexto {
  mapa: MapId;
  modo: GameMode;
  online: boolean;
  /** Ameaça de 1 a 5 da missão em que você está (a escalação da partida aberta). */
  ameaca: () => number;
  /** O clique em IMPLANTAR: quem liga o console faz a transição e navega (sem isto, o link vale como link comum). */
  implantar?: (href: string) => void;
}

/**
 * Monitor "TEATRO DE OPERAÇÕES" do console: o mapa-múndi em pontos, centrado no Brasil, com as missões. As jogáveis acendem e
 * levam até elas (a escolha do mapa mora aqui; a fileira ARENA/BUNKER da pausa antiga saiu); as que faltam construir aparecem
 * trancadas. Dados e contas em `theater.ts`.
 *
 * **Custo:** zero no jogo. O canvas só é redesenhado quando o tamanho ou o zoom mudam (até ~12 mil células, < 1 ms); o zoom anima
 * por 0,42 s e para. Os marcadores e as rotas pulsam por CSS (o compositor anima, o JS não roda por quadro).
 */
export class WorldMap {
  private readonly grade = decodificarMascara();
  private readonly canvas: HTMLCanvasElement;
  private readonly g: CanvasRenderingContext2D | null;
  private readonly rotas: SVGSVGElement;
  private readonly ficha: HTMLElement;
  private readonly pinsHost: HTMLElement;
  private readonly pins = new Map<Teatro['id'], HTMLButtonElement>();
  private readonly paths = new Map<Teatro['id'], SVGPathElement>();
  /** A largura de cada nome (medida uma vez, com todos à vista): o nome vira para o lado em que cabe. */
  private readonly larguras = new Map<Teatro['id'], number>();
  private readonly ponto = { x: 0, y: 0 };
  private readonly origem = { x: 0, y: 0 };
  private vista: Vista = { lon: 0, lat: 0, escala: 1 };
  private readonly de: Vista = { lon: 0, lat: 0, escala: 1 };
  private enquadramento: Enquadramento;
  private w = 0;
  private h = 0;
  private quadro = 0;
  /** A escala tipográfica do console (`--k`), lida a cada mudança de tamanho. */
  private k = 1;
  private selecionado: Teatro;

  constructor(
    private readonly root: HTMLElement,
    private readonly ctx: TeatroContexto,
  ) {
    const screen = root.querySelector<HTMLElement>('.teatro-screen')!;
    this.canvas = screen.querySelector('canvas')!;
    this.g = this.canvas.getContext('2d');
    this.rotas = screen.querySelector('svg')!;
    this.ficha = screen.querySelector<HTMLElement>('.teatro-ficha')!;
    this.enquadramento = lerZoom();
    this.selecionado = TEATROS.find((t) => t.mapa === ctx.mapa) ?? TEATROS[0]!;

    const pinsHost = (this.pinsHost = screen.querySelector<HTMLElement>('.teatro-pins')!);
    pinsHost.classList.toggle('zoom-mundo', this.enquadramento === 'mundo');
    const sede = TEATROS.find((t) => t.recurso === 'sede');
    for (const t of TEATROS) {
      const estado = estadoDoTeatro(t, ctx.mapa, ctx.modo);
      const pin = document.createElement('button');
      pin.type = 'button';
      pin.className = `pin pin-${estado} pin-${t.recurso}`;
      pin.dataset.id = t.id;
      pin.setAttribute('aria-label', `${t.nome}, ${t.lugar}: ${ESTADO_TEXTO[estado].toLowerCase()}`);
      pin.innerHTML = '<i class="pin-ring"></i><i class="pin-core"></i><span class="pin-nome"></span>';
      pin.querySelector('.pin-nome')!.textContent = t.nome;
      pin.addEventListener('click', () => this.selecionar(t));
      pin.addEventListener('pointerenter', () => this.mostrar(t));
      pin.addEventListener('pointerleave', () => this.mostrar(this.selecionado));
      pin.addEventListener('focus', () => this.mostrar(t));
      pinsHost.append(pin);
      this.pins.set(t.id, pin);
      // Rota de implantação: da sede da SERAFIM até cada missão.
      if (sede && t !== sede) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', `rota rota-${estado}`);
        this.rotas.append(path);
        this.paths.set(t.id, path);
      }
    }
    this.atualizar();

    for (const b of root.querySelectorAll<HTMLButtonElement>('[data-zoom]')) {
      b.addEventListener('click', () => this.zoom(b.dataset.zoom === 'mundo' ? 'mundo' : 'brasil'));
    }
    this.pintarAbas();
    new ResizeObserver(() => this.medir()).observe(this.canvas.parentElement!);
  }

  /** O atalho Z: troca entre o zoom BRASIL e o MUNDO. */
  alternarZoom(): void {
    this.zoom(this.enquadramento === 'brasil' ? 'mundo' : 'brasil');
  }

  /** Refaz o que depende da partida: o halo de ameaça da missão em que você está (cresce com a ameaça) e a ficha à vista. */
  atualizar(): void {
    const aqui = TEATROS.find((t) => t.mapa === this.ctx.mapa);
    if (aqui) this.pins.get(aqui.id)?.style.setProperty('--ameaca', String(this.ctx.ameaca()));
    this.marcarSelecao();
    this.mostrar(this.selecionado);
  }

  /** Muda o zoom (BRASIL ↔ MUNDO) com uma animação curta; sem animação para quem pediu menos movimento. */
  zoom(alvo: Enquadramento): void {
    if (alvo === this.enquadramento) return;
    this.enquadramento = alvo;
    this.pinsHost.classList.toggle('zoom-mundo', alvo === 'mundo');
    gravarZoom(alvo);
    this.pintarAbas();
    if (!this.w || !this.h) return;
    const fim = enquadrar(ENQUADRAMENTOS[alvo], this.w, this.h);
    cancelAnimationFrame(this.quadro);
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.vista = fim;
      this.desenhar();
      return;
    }
    Object.assign(this.de, this.vista);
    const t0 = performance.now();
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - t0) / ZOOM_MS);
      interpolarVista(this.de, fim, 1 - (1 - t) ** 3, this.vista);
      this.desenhar();
      if (t < 1) this.quadro = requestAnimationFrame(passo);
    };
    this.quadro = requestAnimationFrame(passo);
  }

  private medir(): void {
    const r = this.canvas.parentElement!.getBoundingClientRect();
    const w = Math.round(r.width);
    const h = Math.round(r.height);
    if (!w || !h || (w === this.w && h === this.h)) return;
    this.w = w;
    this.h = h;
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.g?.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.rotas.setAttribute('viewBox', `0 0 ${w} ${h}`);
    this.k = escalaTipografica(this.canvas);
    this.medirNomes();
    cancelAnimationFrame(this.quadro);
    this.vista = enquadrar(ENQUADRAMENTOS[this.enquadramento], w, h);
    this.desenhar();
  }

  /** Mede os nomes dos marcadores com todos visíveis (no zoom MUNDO só o selecionado aparece: o `display: none` mediria zero). */
  private medirNomes(): void {
    if (this.larguras.size === this.pins.size) return;
    const mundo = this.pinsHost.classList.contains('zoom-mundo');
    this.pinsHost.classList.remove('zoom-mundo');
    for (const [id, pin] of this.pins) this.larguras.set(id, pin.querySelector<HTMLElement>('.pin-nome')!.offsetWidth);
    this.pinsHost.classList.toggle('zoom-mundo', mundo);
  }

  private desenhar(): void {
    const g = this.g;
    const { w, h, vista: v } = this;
    if (!g || !w || !h) return;
    g.clearRect(0, 0, w, h);

    // Meridianos e paralelos de 15 em 15 graus: a grade tática por baixo dos continentes, com os graus nas bordas.
    g.strokeStyle = COR_GRADE;
    g.lineWidth = 1;
    g.beginPath();
    const lonMin = v.lon - w / 2 / v.escala;
    const lonMax = v.lon + w / 2 / v.escala;
    const rotular = v.escala >= 4 ? 15 : 30;
    g.fillStyle = COR_ROTULO;
    g.font = `${8 * this.k}px Consolas, "Courier New", monospace`;
    g.textAlign = 'center';
    for (let lon = Math.ceil(lonMin / 15) * 15; lon <= lonMax; lon += 15) {
      const x = Math.round(w / 2 + (lon - v.lon) * v.escala) + 0.5;
      g.moveTo(x, 0);
      g.lineTo(x, h);
      if (lon % rotular === 0 && x > 18 * this.k && x < w - 18 * this.k) g.fillText(rotuloGrau(deltaLon(lon, 0), 'L', 'O'), x, 9 * this.k);
    }
    g.textAlign = 'left';
    for (let lat = -60; lat <= 90; lat += 15) {
      const y = Math.round(h / 2 - (lat - v.lat) * v.escala) + 0.5;
      if (y < 0 || y > h) continue;
      g.moveTo(0, y);
      g.lineTo(w, y);
      if (lat % rotular === 0 && y > 16 * this.k && y < h - 8) g.fillText(rotuloGrau(lat, 'N', 'S'), 4, y - 2);
    }
    g.stroke();

    // Os pontos: uma célula por grau, ou uma a cada `s` quando o mapa está longe (o bloco inteiro conta).
    // Cada camada vira um caminho só e um `fill` só (milhares de `fillRect` com sombra custavam muito mais).
    const { cols, rows, lon0, lat0, step } = WORLD_MASK;
    const s = passoDaGrade(v.escala);
    const gap = s * step * v.escala;
    const lado = Math.max(1, Math.min(gap * 0.6, 4.5));
    const kIni = Math.floor((lonMin - lon0) / step / s) * s;
    const kFim = Math.ceil((lonMax - lon0) / step);
    for (let passada = 0; passada < 2; passada++) {
      g.fillStyle = passada === 0 ? COR_TERRA : COR_BRASIL;
      // O Brasil brilha (o halo só existe na segunda passada; o resto do mundo fica opaco e frio).
      g.shadowColor = passada === 0 ? 'transparent' : 'rgba(57, 255, 106, 0.55)';
      g.shadowBlur = passada === 0 ? 0 : Math.min(7, lado * 1.5);
      g.beginPath();
      for (let r = 0; r < rows; r += s) {
        const lat = lat0 - (r + s / 2) * step;
        const y = h / 2 - (lat - v.lat) * v.escala;
        if (y < -gap || y > h + gap) continue;
        for (let k = kIni; k <= kFim; k += s) {
          const c = ((k % cols) + cols) % cols;
          const cel = this.bloco(r, c, s);
          if (cel === MAR || (passada === 0) === (cel === BRASIL)) continue;
          const x = w / 2 + (lon0 + (k + s / 2) * step - v.lon) * v.escala;
          g.rect(x - lado / 2, y - lado / 2, lado, lado);
        }
      }
      g.fill();
    }

    // O contorno do Brasil por cima dos pontos: a borda nítida em qualquer zoom.
    g.beginPath();
    for (let i = 0; i < BRASIL_CONTORNO.length; i += 2) {
      projetar(v, w, h, BRASIL_CONTORNO[i]! / BRASIL_CONTORNO_ESCALA, BRASIL_CONTORNO[i + 1]! / BRASIL_CONTORNO_ESCALA, this.ponto);
      if (i === 0) g.moveTo(this.ponto.x, this.ponto.y);
      else g.lineTo(this.ponto.x, this.ponto.y);
    }
    g.closePath();
    g.lineJoin = 'round';
    g.lineWidth = v.escala >= 4 ? 1.3 : 1;
    g.strokeStyle = COR_CONTORNO;
    g.shadowColor = 'rgba(57, 255, 106, 0.8)';
    g.shadowBlur = 9;
    g.stroke();
    g.shadowBlur = 0;

    // Marcadores e rotas acompanham a vista.
    const sede = TEATROS.find((t) => t.recurso === 'sede');
    if (sede) projetar(v, w, h, sede.lon, sede.lat, this.origem);
    for (const t of TEATROS) {
      projetar(v, w, h, t.lon, t.lat, this.ponto);
      const pin = this.pins.get(t.id)!;
      pin.style.transform = `translate(${this.ponto.x.toFixed(1)}px, ${this.ponto.y.toFixed(1)}px)`;
      pin.classList.toggle('pin-a-esquerda', nomeVaiParaEsquerda(t.lado, this.ponto.x, this.larguras.get(t.id) ?? 0, w));
      const path = this.paths.get(t.id);
      if (path && sede) {
        // Arco suave: o ponto de controle sobe perpendicular à reta, proporcional à distância.
        const dx = this.ponto.x - this.origem.x;
        const dy = this.ponto.y - this.origem.y;
        const cx = (this.origem.x + this.ponto.x) / 2 - dy * 0.25;
        const cy = (this.origem.y + this.ponto.y) / 2 + dx * 0.25 - Math.hypot(dx, dy) * 0.12;
        path.setAttribute('d', `M${this.origem.x.toFixed(1)} ${this.origem.y.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${this.ponto.x.toFixed(1)} ${this.ponto.y.toFixed(1)}`);
      }
    }
  }

  /** O valor de um bloco `s` × `s` da grade: Brasil se houver Brasil, terra se houver terra (ilhas pequenas não somem no zoom). */
  private bloco(r: number, c: number, s: number): number {
    if (s === 1) return this.grade[r * WORLD_MASK.cols + c]!;
    let v = MAR;
    for (let i = 0; i < s && r + i < WORLD_MASK.rows; i++) {
      const base = (r + i) * WORLD_MASK.cols;
      for (let j = 0; j < s; j++) {
        const cel = this.grade[base + ((c + j) % WORLD_MASK.cols)]!;
        if (cel === BRASIL) return BRASIL;
        if (cel > v) v = cel;
      }
    }
    return v;
  }

  private selecionar(t: Teatro): void {
    this.selecionado = t;
    this.marcarSelecao();
    this.mostrar(t);
  }

  private marcarSelecao(): void {
    for (const [id, pin] of this.pins) pin.classList.toggle('selecionado', id === this.selecionado.id);
  }

  /** A ficha da missão no canto do mapa: onde é, o que se disputa, em que modos roda e o que fazer. */
  private mostrar(t: Teatro): void {
    const estado = estadoDoTeatro(t, this.ctx.mapa, this.ctx.modo);
    const f = this.ficha;
    f.className = `teatro-ficha ficha-${estado}`;
    f.replaceChildren();
    const linha = (cls: string, texto: string) => {
      const p = document.createElement('p');
      p.className = cls;
      p.textContent = texto;
      f.append(p);
      return p;
    };
    const nome = linha('ficha-nome', t.nome);
    const coord = document.createElement('span');
    coord.className = 'ficha-coord';
    coord.textContent = formatarCoordenada(t.lat, t.lon);
    nome.append(coord);
    linha('ficha-lugar', `${t.lugar}${t.proposta ? ' · local a confirmar' : ''}`);
    const modos = t.modos.map((m) => GAME_MODES.find((g) => g.id === m)?.short ?? m).join(' · ');
    linha('ficha-recurso', `${RECURSO_NOME[t.recurso]}${modos ? ` · ${modos}` : ''}`);
    linha('ficha-resumo', t.resumo);
    const pe = linha('ficha-estado', ESTADO_TEXTO[estado]);
    if (estado === 'aqui') {
      const n = this.ctx.ameaca();
      const barra = document.createElement('span');
      barra.className = 'ficha-ameaca';
      barra.textContent = ` · AMEAÇA ${'▮'.repeat(n)}${'▯'.repeat(5 - n)}`;
      pe.append(barra);
    } else if (estado === 'disponivel' && t.mapa) {
      const ir = document.createElement('a');
      ir.className = 'ficha-ir';
      ir.href = mapHref(location.href, t.mapa);
      ir.textContent = '[ IMPLANTAR ]';
      // Clique comum: o console faz a transição (som e fade) e navega; Ctrl, Shift ou botão do meio abrem o link como qualquer outro.
      ir.addEventListener('click', (e) => {
        if (!this.ctx.implantar || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        this.ctx.implantar(ir.href);
      });
      if (this.ctx.online && t.mapa === 'bunker') ir.title = 'O Bunker é treino offline: sai da sala online';
      pe.append(ir);
    }
  }

  private pintarAbas(): void {
    for (const b of this.root.querySelectorAll<HTMLButtonElement>('[data-zoom]')) {
      const on = b.dataset.zoom === this.enquadramento;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    }
  }
}

/**
 * De que lado do marcador o nome fica: o lado que a missão prefere, a menos que ele passe da borda do mapa e o outro lado caiba.
 * Exportada para o teste (a conta é pura).
 */
export function nomeVaiParaEsquerda(preferido: 'esquerda' | 'direita', x: number, largura: number, w: number): boolean {
  const folga = 11 + largura + 4;
  const cabeDireita = x + folga <= w;
  const cabeEsquerda = x - folga >= 0;
  return preferido === 'esquerda' ? cabeEsquerda || !cabeDireita : !cabeDireita && cabeEsquerda;
}

/** "15°L", "30°O", "0°": o grau de um meridiano ou paralelo na borda do mapa. */
function rotuloGrau(v: number, positivo: string, negativo: string): string {
  return v === 0 ? '0°' : `${Math.abs(v)}°${v > 0 ? positivo : negativo}`;
}

function lerZoom(): Enquadramento {
  try {
    return localStorage.getItem(ZOOM_KEY) === 'mundo' ? 'mundo' : 'brasil';
  } catch {
    return 'brasil';
  }
}

function gravarZoom(z: Enquadramento): void {
  try {
    localStorage.setItem(ZOOM_KEY, z);
  } catch {
    /* sem armazenamento: o zoom só não é lembrado */
  }
}
