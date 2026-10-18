import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AMAZONIA_GERADORES } from './AmazoniaLayout';
import { metrosParaLer, ObjetivosDaMissao, textosDoObjetivo, type EstadoDosObjetivos } from './AmazoniaObjetivos';

/** Um nó de DOM de mentira, o bastante para o painel: filhos, classes, estilo, texto e `hidden`. */
class No {
  hidden = false;
  className = '';
  textContent = '';
  style: Record<string, string> = {};
  readonly filhos: No[] = [];
  readonly classes = new Set<string>();
  readonly classList = {
    toggle: (c: string, ligado?: boolean): void => {
      if (ligado ?? !this.classes.has(c)) this.classes.add(c);
      else this.classes.delete(c);
    },
  };
  constructor(readonly tag: string) {}
  append(...n: No[]): void {
    this.filhos.push(...n);
  }
  tem(c: string): boolean {
    return this.className.split(' ').includes(c) || this.classes.has(c);
  }
}

const achar = (raiz: No, classe: string): No[] => {
  const r: No[] = [];
  const ande = (n: No): void => {
    if (n.tem(classe)) r.push(n);
    n.filhos.forEach(ande);
  };
  ande(raiz);
  return r;
};

const ESCOTILHA_FECHADA = { aberta: false, carga: 0, dentro: 0 };

describe('a ordem e a dica na tela (TERRAS RARAS)', () => {
  it('com o escudo de pé a ordem é derrubar os geradores (quantos já caíram) e a dica diz qual e a quantos metros', () => {
    const t = textosDoObjetivo({ caidos: 1, total: 3, maisPerto: { nome: 'PLANTA', metros: 318 }, escotilha: ESCOTILHA_FECHADA });
    expect(t.titulo).toBe('DERRUBE OS GERADORES · 1 DE 3');
    expect(t.dica).toBe('Siga o marcador: PLANTA, a 320 m.');
  });

  it('sem gerador à vista a dica ainda orienta (nunca fica vazia)', () => {
    expect(textosDoObjetivo({ caidos: 0, total: 3, maisPerto: null, escotilha: ESCOTILHA_FECHADA }).dica).toBe('Siga os marcadores verdes.');
  });

  it('com o escudo caído a ordem é derrubar o Draga; a dica depende da escotilha: fechada, aberta sem andróide, aberta com a carga subindo', () => {
    const base = { caidos: 3, total: 3, maisPerto: null };
    expect(textosDoObjetivo({ ...base, escotilha: ESCOTILHA_FECHADA })).toEqual({ titulo: 'DERRUBE O DRAGA-01', dica: 'Derrube o Draga a tiro.' });
    expect(textosDoObjetivo({ ...base, escotilha: { aberta: true, carga: 0, dentro: 0 } }).dica).toBe('A Resistência corre até a escotilha. Escolte-a ou derrube o Draga a tiro.');
    expect(textosDoObjetivo({ ...base, escotilha: { aberta: true, carga: 0.452, dentro: 2 } }).dica).toBe('A Resistência planta a carga: 45%. Proteja-a ou derrube o Draga a tiro.');
  });

  it('os metros: exatos até 100 m, de 10 em 10 depois (a distância que muda a cada passo não vira ruído), nunca negativos', () => {
    expect(metrosParaLer(42.4)).toBe(42);
    expect(metrosParaLer(99.6)).toBe(100);
    expect(metrosParaLer(318)).toBe(320);
    expect(metrosParaLer(1234)).toBe(1230);
    expect(metrosParaLer(-5)).toBe(0);
  });
});

describe('o painel de objetivos e os marcadores no mundo', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { createElement: (tag: string) => new No(tag) });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** A câmera do jogador a 1,7 m do chão olhando para -Z (a frente do Three), no ponto `(x, z)`. */
  function camera(x: number, z: number, yaw = 0): THREE.PerspectiveCamera {
    const c = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1500);
    c.position.set(x, 1.7, z);
    c.rotation.set(0, yaw, 0);
    c.updateMatrixWorld(true);
    return c;
  }

  function montar() {
    const raiz = new No('div');
    const ordens: string[] = [];
    const painel = new ObjetivosDaMissao(raiz as unknown as HTMLElement, (t) => ordens.push(t));
    const estado: EstadoDosObjetivos = {
      ativo: true,
      camera: camera(0, 0),
      largura: 1280,
      altura: 720,
      eu: { x: 0, z: 0 },
      geradores: AMAZONIA_GERADORES.map((g) => ({ nome: g.nome, x: g.x, y: 17, z: g.z, vivo: true })),
      draga: { x: 700, y: 24, z: 20 },
      escotilha: { aberta: false, x: 0, y: 0, z: 0, carga: 0, dentro: 0, total: 3 },
    };
    return { raiz, painel, estado, ordens, marcas: () => achar(raiz, 'obj-marca'), dica: () => achar(raiz, 'obj-dica')[0]! };
  }

  it('nasce com a dica e cinco marcadores escondidos (um por gerador, o Draga e a escotilha); a primeira atualização dá a ordem do topo pelo callback', () => {
    const { painel, estado, ordens, marcas, dica } = montar();
    expect(marcas()).toHaveLength(AMAZONIA_GERADORES.length + 2);
    expect(marcas().every((m) => m.hidden)).toBe(true);
    painel.atualizar(0.016, estado);
    expect(ordens).toEqual(['DERRUBE OS GERADORES · 0 DE 3']);
    expect(dica().hidden).toBe(false);
    expect(dica().textContent).toMatch(/^Siga o marcador: /);
  });

  it('mostra o rótulo (nome e distância) de cada gerador de pé e o do Draga; o gerador mais perto fica em destaque; a escotilha fechada não aparece', () => {
    const { painel, estado, marcas } = montar();
    estado.eu.x = -100;
    estado.eu.z = 40; // o mais perto: a CERCA (-100, 143)
    painel.atualizar(0.016, estado);
    const [cerca, planta, cava, draga, escotilha] = marcas();
    expect(cerca!.filhos[1]!.textContent).toBe('CERCA · 100 m');
    expect(planta!.filhos[1]!.textContent).toMatch(/^PLANTA · \d+ m$/);
    expect(cava!.filhos[1]!.textContent).toMatch(/^CAVA · \d+ m$/);
    expect(draga!.filhos[1]!.textContent).toMatch(/^DRAGA-01 · \d+ m$/);
    expect(escotilha!.hidden).toBe(true);
    expect(cerca!.tem('principal')).toBe(true);
    expect(planta!.tem('principal')).toBe(false);
  });

  it('gerador caído some do mapa da tela; derrubados todos, o destaque passa ao Draga e a ordem muda; a escotilha aberta ganha marcador', () => {
    const { painel, estado, ordens, marcas } = montar();
    painel.atualizar(0.016, estado);
    estado.geradores[0]!.vivo = false;
    painel.atualizar(0.3, estado);
    expect(marcas()[0]!.hidden).toBe(true);
    expect(ordens.at(-1)).toBe('DERRUBE OS GERADORES · 1 DE 3');
    for (const g of estado.geradores) g.vivo = false;
    estado.escotilha = { aberta: true, x: 690, y: 6, z: 8, carga: 0.2, dentro: 1, total: 3 };
    painel.atualizar(0.3, estado);
    expect(ordens.at(-1)).toBe('DERRUBE O DRAGA-01');
    expect(marcas().slice(0, 3).every((m) => m.hidden)).toBe(true);
    expect(marcas()[3]!.tem('principal')).toBe(true);
    expect(marcas()[4]!.hidden).toBe(false);
    expect(marcas()[4]!.filhos[1]!.textContent).toMatch(/^ESCOTILHA · \d+ m$/);
  });

  it('o texto só se refaz a 4 Hz (o mesmo quadro não reescreve), e a ordem só vai ao callback quando muda', () => {
    const { painel, estado, ordens } = montar();
    painel.atualizar(0.016, estado);
    painel.atualizar(0.016, estado);
    painel.atualizar(0.016, estado);
    painel.atualizar(0.3, estado);
    expect(ordens).toHaveLength(1);
  });

  it('um gerador à frente cai DENTRO da tela (sem seta); um atrás da câmera vai para a borda de baixo, com a seta (a borda é o que diz "vire para lá")', () => {
    const { painel, estado, marcas } = montar();
    // câmera em (-100, 400) olhando para -Z: a CERCA (-100, 143) fica à frente, a 257 m
    estado.camera = camera(-100, 400, 0);
    estado.eu.x = -100;
    estado.eu.z = 400;
    painel.atualizar(0.3, estado);
    expect(marcas()[0]!.tem('borda')).toBe(false);
    // virada para o lado oposto (+Z): a CERCA fica atrás
    estado.camera = camera(-100, 400, Math.PI);
    painel.atualizar(0.3, estado);
    expect(marcas()[0]!.tem('borda')).toBe(true);
    expect(marcas()[0]!.filhos[0]!.style.transform).toMatch(/^rotate\(/);
  });

  it('a missão parada (sem jogo ativo, fim ou jogador caído) esconde tudo; rodada nova recomeça o texto', () => {
    const { painel, estado, ordens, marcas, dica } = montar();
    painel.atualizar(0.3, estado);
    estado.ativo = false;
    painel.atualizar(0.3, estado);
    expect(dica().hidden).toBe(true);
    expect(marcas().every((m) => m.hidden)).toBe(true);
    painel.reiniciar();
    estado.ativo = true;
    painel.atualizar(0.3, estado);
    expect(ordens).toEqual(['DERRUBE OS GERADORES · 0 DE 3', 'DERRUBE OS GERADORES · 0 DE 3']); // a ordem volta ao callback depois do recomeço
  });
});
