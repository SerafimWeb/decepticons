import * as THREE from 'three';
import { marcadorNaTela, type MargensDaTela, type MarcadorNaTela } from '../ui/praiaHudData';
import { AMAZONIA_GERADORES } from './AmazoniaLayout';

/**
 * O OBJETIVO NA TELA (TERRAS RARAS, o pedido do Comandante de 18/10: *"a maioria dos jogadores não quer ler, apenas jogar: temos que trazer a orientação até eles do que fazer para passar de
 * fase"*). Três coisas que **nunca exigem leitura de manual**:
 *  - **uma frase de ordem** no topo (o que fazer AGORA, uma só): `DERRUBE OS GERADORES · 1 DE 3`, depois `DERRUBE O DRAGA-01`;
 *  - **uma linha de dica** logo abaixo (como): `Siga o marcador: CERCA, a 320 m.` ou `A Resistência planta a carga: 45%…`;
 *  - **marcadores no mundo**: um losango sobre cada gerador de pé (o mais perto em destaque), sobre o Draga e sobre a escotilha aberta, com o nome e a distância; **fora da tela, o marcador gruda na
 *    borda com uma seta** apontando para onde ir. Os marcadores aparecem **por cima da mata** (são do HUD, não do mundo): o gerador no meio das árvores não se perde.
 *
 * Pedaço sob demanda da Amazônia (R7: só baixa quem abre a missão). **Custo:** o texto se refaz a 4 Hz e só escreve no DOM quando muda; por quadro são até cinco projeções (cada uma escreve o
 * `transform` só se andou mais de meio pixel); nada aloca (G4). Módulo independente (G3): o `Game` só lhe dá o estado e recebe o texto da ordem por um callback.
 */

/** Margens (px) dos marcadores: o topo guarda a ordem e a barra do Draga; a base, a vida e as armas. */
const MARGENS: MargensDaTela = { topo: 150, base: 130, esq: 40, dir: 60 };
/** A cada quantos segundos o texto e as distâncias se refazem. */
const PERIODO_DO_TEXTO_S = 0.25;
/** O número de marcadores: um por gerador, o Draga e a escotilha. */
const MARCADORES = AMAZONIA_GERADORES.length + 2;
const DRAGA = AMAZONIA_GERADORES.length;
const ESCOTILHA = AMAZONIA_GERADORES.length + 1;

/** Um gerador no mundo: o `Game` reaproveita estes objetos a cada quadro (G4), por isso os campos são mutáveis. */
export interface GeradorNoMundo {
  nome: string;
  x: number;
  y: number;
  z: number;
  vivo: boolean;
}

export interface EstadoDosObjetivos {
  /** A missão está em andamento e o jogador está jogando (sem isto, tudo se esconde). */
  ativo: boolean;
  camera: THREE.Camera;
  largura: number;
  altura: number;
  eu: { x: number; z: number };
  /** Os geradores na ordem de `AMAZONIA_GERADORES`, com a altura do topo e se ainda estão de pé. */
  geradores: GeradorNoMundo[];
  /** O Draga (o ponto do casco que o marcador segue), ou `null` se caiu. */
  draga: { x: number; y: number; z: number } | null;
  escotilha: { aberta: boolean; x: number; y: number; z: number; carga: number; dentro: number; total: number };
}

/** Os metros que o jogador lê: de 10 em 10 (a distância que muda a cada passo não vira ruído na tela). */
export function metrosParaLer(m: number): number {
  const d = Math.max(0, m);
  return d < 100 ? Math.round(d) : Math.round(d / 10) * 10;
}

export interface TextosDoObjetivo {
  titulo: string;
  dica: string;
}

/**
 * A ordem e a dica, em português (o tradutor do DOM faz o resto). Pura: o teste cobra cada passo.
 *  - escudo de pé: derrube os geradores, e a dica diz **qual** e **a quantos metros**;
 *  - escudo caído: derrube o Draga; com a escotilha aberta, a dica diz o que a Resistência está fazendo e que o jogador a protege (ou derruba o Draga a tiro).
 */
export function textosDoObjetivo(o: { caidos: number; total: number; maisPerto: { nome: string; metros: number } | null; escotilha: { aberta: boolean; carga: number; dentro: number } }): TextosDoObjetivo {
  if (o.caidos < o.total) {
    return {
      titulo: `DERRUBE OS GERADORES · ${o.caidos} DE ${o.total}`,
      dica: o.maisPerto ? `Siga o marcador: ${o.maisPerto.nome}, a ${metrosParaLer(o.maisPerto.metros)} m.` : 'Siga os marcadores verdes.',
    };
  }
  if (!o.escotilha.aberta) return { titulo: 'DERRUBE O DRAGA-01', dica: 'Derrube o Draga a tiro.' };
  return {
    titulo: 'DERRUBE O DRAGA-01',
    dica: o.escotilha.dentro > 0 ? `A Resistência planta a carga: ${Math.round(o.escotilha.carga * 100)}%. Proteja-a ou derrube o Draga a tiro.` : 'A Resistência corre até a escotilha. Escolte-a ou derrube o Draga a tiro.',
  };
}

interface Marcador {
  raiz: HTMLElement;
  seta: HTMLElement;
  rotulo: HTMLElement;
  visivel: boolean;
  principal: boolean;
  naBorda: boolean;
  x: number;
  y: number;
  texto: string;
  ponto: MarcadorNaTela;
}

const _v = new THREE.Vector3();

export class ObjetivosDaMissao {
  private readonly dica: HTMLElement;
  private readonly marcadores: Marcador[] = [];
  private periodoS = 0;
  private titulo = '';
  private dicaMostrada = '';
  private escondido = true;

  /** `raiz` é o `#hud`; `aoTitulo` recebe a ordem do topo quando ela muda (o `Game` a escreve na linha da missão). */
  constructor(
    raiz: HTMLElement,
    private readonly aoTitulo: (texto: string) => void,
  ) {
    this.dica = document.createElement('p');
    this.dica.className = 'obj-dica';
    this.dica.hidden = true;
    raiz.append(this.dica);
    for (let i = 0; i < MARCADORES; i++) {
      const m = document.createElement('div');
      m.className = i === DRAGA ? 'obj-marca obj-draga' : i === ESCOTILHA ? 'obj-marca obj-escotilha' : 'obj-marca obj-gerador';
      m.hidden = true;
      const seta = document.createElement('i');
      seta.className = 'obj-seta';
      const rotulo = document.createElement('b');
      rotulo.className = 'obj-rotulo';
      m.append(seta, rotulo);
      raiz.append(m);
      this.marcadores.push({ raiz: m, seta, rotulo, visivel: false, principal: false, naBorda: false, x: -9999, y: -9999, texto: '', ponto: { x: 0, y: 0, naBorda: false } });
    }
  }

  /** Rodada nova: o texto e os marcadores recomeçam do zero. */
  reiniciar(): void {
    this.titulo = '';
    this.dicaMostrada = '';
    this.periodoS = 0;
    this.esconder();
  }

  private esconder(): void {
    if (this.escondido) return;
    this.escondido = true;
    this.dica.hidden = true;
    for (const m of this.marcadores) {
      m.raiz.hidden = true;
      m.visivel = false;
    }
  }

  atualizar(dt: number, e: EstadoDosObjetivos): void {
    if (!e.ativo) {
      this.esconder();
      return;
    }
    this.escondido = false;
    this.dica.hidden = false;
    this.periodoS -= dt;
    if (this.periodoS <= 0) {
      this.periodoS = PERIODO_DO_TEXTO_S;
      this.refazerTexto(e);
    }
    for (let i = 0; i < this.marcadores.length; i++) this.posicionar(this.marcadores[i]!, i, e);
  }

  /** A ordem, a dica e o rótulo de cada marcador (a 4 Hz). */
  private refazerTexto(e: EstadoDosObjetivos): void {
    const total = e.geradores.length;
    let vivos = 0;
    let perto = -1;
    let metrosPerto = Infinity;
    for (let i = 0; i < total; i++) {
      const g = e.geradores[i]!;
      const metros = Math.hypot(g.x - e.eu.x, g.z - e.eu.z);
      this.definir(i, g.vivo, `${g.nome} · ${metrosParaLer(metros)} m`);
      if (!g.vivo) continue;
      vivos++;
      if (metros < metrosPerto) {
        metrosPerto = metros;
        perto = i;
      }
    }
    const maisPerto = perto >= 0 ? { nome: e.geradores[perto]!.nome, metros: metrosPerto } : null;
    const alvoDoDraga = e.draga;
    const distDraga = alvoDoDraga ? Math.hypot(alvoDoDraga.x - e.eu.x, alvoDoDraga.z - e.eu.z) : 0;
    this.definir(DRAGA, alvoDoDraga !== null, `DRAGA-01 · ${metrosParaLer(distDraga)} m`);
    const esc = e.escotilha;
    const abre = esc.aberta && alvoDoDraga !== null;
    this.definir(ESCOTILHA, abre, `ESCOTILHA · ${metrosParaLer(Math.hypot(esc.x - e.eu.x, esc.z - e.eu.z))} m`);
    for (let i = 0; i < total; i++) this.marcadores[i]!.principal = i === perto;
    this.marcadores[DRAGA]!.principal = vivos === 0;
    const t = textosDoObjetivo({ caidos: total - vivos, total, maisPerto, escotilha: esc });
    if (t.titulo !== this.titulo) {
      this.titulo = t.titulo;
      this.aoTitulo(t.titulo);
    }
    if (t.dica !== this.dicaMostrada) {
      this.dicaMostrada = t.dica;
      this.dica.textContent = t.dica;
    }
  }

  private definir(i: number, visivel: boolean, texto: string): void {
    const m = this.marcadores[i]!;
    m.visivel = visivel;
    if (visivel && texto !== m.texto) {
      m.texto = texto;
      m.rotulo.textContent = texto;
    }
  }

  /** Projeta o ponto do mundo e põe o marcador na tela (ou na borda, com a seta). */
  private posicionar(m: Marcador, i: number, e: EstadoDosObjetivos): void {
    if (!m.visivel) {
      if (!m.raiz.hidden) m.raiz.hidden = true;
      return;
    }
    if (m.raiz.hidden) m.raiz.hidden = false;
    const alvo = i < e.geradores.length ? e.geradores[i]! : i === DRAGA ? e.draga : e.escotilha;
    if (!alvo) return;
    _v.set(alvo.x, alvo.y, alvo.z).applyMatrix4(e.camera.matrixWorldInverse);
    const atras = _v.z > 0;
    _v.applyMatrix4(e.camera.projectionMatrix);
    const p = marcadorNaTela(_v.x, _v.y, atras, e.largura, e.altura, MARGENS, m.ponto);
    if (Math.abs(p.x - m.x) > 0.5 || Math.abs(p.y - m.y) > 0.5) {
      m.x = p.x;
      m.y = p.y;
      m.raiz.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
    }
    if (p.naBorda !== m.naBorda) {
      m.naBorda = p.naBorda;
      m.raiz.classList.toggle('borda', p.naBorda);
    }
    if (p.naBorda) m.seta.style.transform = `rotate(${Math.atan2(p.y - e.altura / 2, p.x - e.largura / 2).toFixed(2)}rad)`;
    m.raiz.classList.toggle('principal', m.principal);
  }
}
