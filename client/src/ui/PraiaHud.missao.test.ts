import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PRAIA_ESTACAO } from '../environment/PraiaLayout';
import { novoQuadroDaPraia, PraiaHud, type QuadroDaPraia } from './PraiaHud';

/** Um elemento de mentira, o bastante para o HUD montar a árvore e escrever nela (o ambiente de teste é Node puro, G14). */
class No {
  className = '';
  textContent = '';
  hidden = false;
  readonly dataset: Record<string, string> = {};
  readonly style: Record<string, string> = {};
  readonly children: No[] = [];
  readonly offsetWidth = 0;
  private readonly marcas = new Set<string>();
  readonly classList = {
    add: (c: string) => void this.marcas.add(c),
    remove: (c: string) => void this.marcas.delete(c),
    contains: (c: string) => this.marcas.has(c),
    toggle: (c: string, forca?: boolean) => {
      const poe = forca ?? !this.marcas.has(c);
      if (poe) this.marcas.add(c);
      else this.marcas.delete(c);
      return poe;
    },
  };
  constructor(readonly tag: string) {}
  appendChild(f: No): No {
    this.children.push(f);
    return f;
  }
  setAttribute(): void {}
}

const achar = (no: No, classe: string): No | undefined => {
  if (no.className.split(' ').includes(classe)) return no;
  for (const f of no.children) {
    const r = achar(f, classe);
    if (r) return r;
  }
  return undefined;
};
const textos = (no: No): string[] => [no.textContent, ...no.children.flatMap(textos)];

function montar(soMissao: boolean) {
  const pai = new No('div');
  const hud = new PraiaHud(pai as unknown as HTMLElement, soMissao);
  const raiz = pai.children[0]!;
  const q: QuadroDaPraia = novoQuadroDaPraia(new THREE.PerspectiveCamera());
  q.ativo = true;
  q.eu.alive = true;
  q.largura = 1280;
  q.altura = 720;
  return { pai, hud, raiz, q, quadro: achar(raiz, 'praia-quadro')!, chefe: achar(raiz, 'praia-chefe')!, zona: achar(raiz, 'praia-zona')!, cartao: achar(raiz, 'praia-cartao')! };
}

describe('o HUD de missão fora da praia: o transformador do banco e a barra do chefe na Cidade Neon (P164, parte E)', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { createElement: (tag: string) => new No(tag) });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('o HUD de missão leva a classe que o CSS usa para esconder o que é da praia; o da praia não', () => {
    expect(montar(true).raiz.className.split(' ')).toContain('praia-hud--missao');
    expect(montar(false).raiz.className.split(' ')).not.toContain('praia-hud--missao');
  });

  it('a célula do quadro diz de quem é: "TRANSFORMADOR · BANCO VORCARIS" na Cidade Neon, "QUADRO DE LUZ DA CIDADE" no porto', () => {
    expect(textos(montar(true).quadro)).toContain('TRANSFORMADOR · BANCO VORCARIS');
    expect(textos(montar(false).quadro)).toContain('QUADRO DE LUZ DA CIDADE');
  });

  it('só o HUD da praia liga a classe hud-praia no #hud (o degradê do topo é para o céu claro)', () => {
    const missao = montar(true);
    missao.hud.update(0.016, missao.q);
    expect(missao.pai.classList.contains('hud-praia')).toBe(false);
    const praia = montar(false);
    praia.hud.update(0.016, praia.q);
    expect(praia.pai.classList.contains('hud-praia')).toBe(true);
  });

  it('o transformador no HUD: a célula aparece com o estado e a vida, e o aviso do quadro sobe no topo', () => {
    const { hud, q, quadro, zona } = montar(true);
    q.quadro.presente = true;
    hud.update(0.016, q);
    expect(quadro.hidden).toBe(false);
    expect(quadro.dataset.estado).toBe('ligado');
    q.quadro.estado = 1;
    q.quadro.vida = 0.4;
    hud.update(0.016, q);
    expect(quadro.dataset.estado).toBe('sabotado');
    expect(zona.textContent).toBe('QUADRO DE LUZ SOB SABOTAGEM · A CIDADE VAI AO ESCURO');
    q.quadro.estado = 2;
    q.quadro.vida = 0;
    hud.update(0.016, q);
    expect(quadro.dataset.estado).toBe('apagado');
    expect(zona.textContent).toBe('CIDADE NO ESCURO · AS ZONAS DE CURA CAÍRAM');
  });

  it('sem o quadro na partida (o todos contra todos) a célula fica escondida', () => {
    const { hud, q, quadro } = montar(true);
    hud.update(0.016, q);
    expect(quadro.hidden, 'nasce escondida e o HUD não a mostra sem o quadro').toBe(true);
  });

  it('a barra do chefe no HUD de missão: o título com a fase, as pernas riscadas e o aviso da perna que caiu (que passa na frente do quadro)', () => {
    const { hud, q, chefe, zona } = montar(true);
    q.quadro.presente = true;
    q.chefe.presente = true;
    q.chefe.fase = 1;
    hud.update(0.016, q);
    expect(chefe.hidden).toBe(false);
    expect(textos(chefe)).toContain('COLOSSUS-01 · FASE 1 DE 3 · ANDA');
    expect(textos(chefe), 'na Cidade Neon o titã vai ao transformador, não aos cabos').toContain('Ele vai apagar o transformador do banco. Derrube as pernas.');
    expect(textos(chefe).join(' ')).not.toContain('cabos');
    q.chefe.fase = 2;
    q.chefe.pernas[0] = false;
    q.chefe.fracao = 0.6;
    q.quadro.estado = 1; // o quadro também mudou neste quadro: o chefe manda no aviso
    hud.update(0.016, q);
    expect(textos(chefe)).toContain('COLOSSUS-01 · FASE 2 DE 3 · MANCA');
    const pernas = achar(chefe, 'pcf-pernas')!;
    expect(pernas.children[0]!.classList.contains('caida')).toBe(true);
    expect(pernas.children[1]!.classList.contains('caida')).toBe(false);
    expect(zona.textContent).toBe('COLOSSUS-01 · UMA PERNA CAIU · ELE MANCA');
    q.chefe.presente = false;
    hud.update(0.016, q);
    expect(chefe.hidden).toBe(true);
  });

  it('na praia a regra da fase continua a dos cabos', () => {
    const { hud, q, chefe } = montar(false);
    q.chefe.presente = true;
    q.chefe.fase = 1;
    hud.update(0.016, q);
    expect(textos(chefe)).toContain('Ele vai cortar os cabos. Derrube as pernas.');
  });

  it('sem o que é da praia: nada de anúncio de lugar, de cartão da missão, de marcador da estação nem de faixa da costa', () => {
    const missao = montar(true);
    // o jogador no centro do complexo da estação: na praia o anúncio do lugar diz o nome dele
    missao.q.eu.x = PRAIA_ESTACAO.x;
    missao.q.eu.z = PRAIA_ESTACAO.z;
    // a câmera não pode ser tocada (a projeção do marcador é só da praia): qualquer leitura derruba o teste
    missao.q.camera = new Proxy({}, { get: () => { throw new Error('o HUD de missão projetou o marcador da estação'); } }) as unknown as THREE.Camera;
    for (let i = 0; i < 40; i++) missao.hud.update(0.1, missao.q);
    expect(missao.zona.textContent).toBe('');
    expect(missao.cartao.hidden).toBe(true);

    const praia = montar(false);
    praia.q.eu.x = PRAIA_ESTACAO.x;
    praia.q.eu.z = PRAIA_ESTACAO.z;
    praia.hud.update(0.016, praia.q);
    expect(praia.zona.textContent, 'na praia o lugar é anunciado').not.toBe('');
    expect(praia.cartao.hidden, 'na praia o cartão da missão aparece').toBe(false);
  });

  it('morto ou pausado o HUD some inteiro, nos dois modos', () => {
    const { hud, q, raiz } = montar(true);
    hud.update(0.016, q);
    expect(raiz.hidden).toBe(false);
    q.eu.alive = false;
    hud.update(0.016, q);
    expect(raiz.hidden).toBe(true);
  });
});
