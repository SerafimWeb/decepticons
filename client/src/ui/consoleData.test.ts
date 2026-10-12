import { describe, expect, it } from 'vitest';
import { CHASSIS } from '../entities/chassis';
import type { MechPart } from '../entities/MechBase';
import { FACTORY_LOADOUT, factorySpec } from '../hangar/loadout';
import { DEFAULT_SETTINGS } from '../core/Settings';
import {
  acaoDaTecla,
  contagemInimigos,
  escalacaoDaPartida,
  fichaDoMech,
  fracoesDasPartes,
  lerModoComandante,
  MESA_COMANDO,
  MESA_URL,
  LINHAS_DE_PILOTOS,
  nivelDeAmeaca,
  pilotosVisiveis,
  sondarMesa,
  type BotsLidos,
  type MechLido,
  type PilotoNaPartida,
} from './consoleData';

describe('modo Comandante', () => {
  it('liga com ?comandante=1 (ou ?admin=1) e manda o navegador lembrar', () => {
    expect(lerModoComandante('?comandante=1', null)).toEqual({ ligado: true, gravar: '1' });
    expect(lerModoComandante('?admin=1', null)).toEqual({ ligado: true, gravar: '1' });
  });

  it('desliga com =0 e manda esquecer', () => {
    expect(lerModoComandante('?comandante=0', '1')).toEqual({ ligado: false, gravar: 'apagar' });
  });

  it('sem o parâmetro, vale o que o navegador lembra (e um valor estranho não liga)', () => {
    expect(lerModoComandante('', '1')).toEqual({ ligado: true, gravar: null });
    expect(lerModoComandante('?build=x', null)).toEqual({ ligado: false, gravar: null });
    expect(lerModoComandante('?comandante=talvez', null)).toEqual({ ligado: false, gravar: null });
  });
});

describe('ficha do seu Mech', () => {
  it('a montagem de fábrica: Vector-09, 300 de tronco, 9 m/s, plasma e foguetes MK I', () => {
    const f = fichaDoMech(FACTORY_LOADOUT);
    expect(f.chassi).toBe('vector09');
    expect(f.vida.valor).toBe(CHASSIS.vector09.maxModuleHealth.torso);
    expect(f.velocidade.valor).toBe(CHASSIS.vector09.moveSpeed);
    expect(f.carga.limite).toBe(CHASSIS.vector09.weaponCapacity);
    expect(f.carga.usada).toBeGreaterThan(0);
    expect(f.carga.usada).toBeLessThanOrEqual(f.carga.limite);
    expect(f.armas.map((a) => a.encaixe)).toEqual(['DIR', 'ESQ']);
    expect(f.armas.every((a) => a.nome.endsWith('MK I'))).toBe(true);
  });

  it('o nível da arma aparece no nome, e o módulo entra como quarto encaixe', () => {
    const f = fichaDoMech({ ...FACTORY_LOADOUT, right: { id: 'plasma', tier: 2 }, module: 'fire' });
    expect(f.armas[0]!.nome).toMatch(/MK III$/);
    expect(f.armas.at(-1)).toEqual({ encaixe: 'MÓD', nome: 'Anel de fogo' });
  });

  it('o Marauder mostra os ombros', () => {
    const spec = factorySpec('marauder');
    const f = fichaDoMech(spec);
    expect(f.armas.some((a) => a.encaixe === 'OMB')).toBe(spec.shoulders != null);
  });

  it('as barras comparam com o melhor chassi de combate (o Colossus, de escala 3, fica fora da régua)', () => {
    for (const id of Object.keys(CHASSIS) as (keyof typeof CHASSIS)[]) {
      if (id === 'colossus01') continue;
      const f = fichaDoMech(factorySpec(id));
      expect(f.vida.valor / f.vida.ref, id).toBeLessThanOrEqual(1);
      expect(f.velocidade.valor / f.velocidade.ref, id).toBeLessThanOrEqual(1);
    }
  });
});

const maxima: Record<MechPart, number> = { torso: 300, head: 100, leftArm: 120, rightArm: 120, leftLeg: 150, rightLeg: 150 };
const mech = (name: string, modules: Partial<Record<MechPart, number>> = {}): MechLido => ({
  stats: { name, maxModuleHealth: maxima },
  modules: { ...maxima, ...modules },
});

describe('vida por parte', () => {
  it('fração de 0 a 1, e a parte arrancada (vida negativa) é 0', () => {
    const f = fracoesDasPartes(mech('VECTOR-09', { torso: 150, leftArm: -20 }));
    expect(f.torso).toBe(0.5);
    expect(f.leftArm).toBe(0);
    expect(f.head).toBe(1);
  });
});

describe('escalação da partida', () => {
  const bots = (lista: { m: MechLido; nome: string; tec?: boolean; persona?: 'brabo' }[]): BotsLidos<MechLido> => ({
    mechs: lista.map((b) => b.m),
    nameOf: (m) => lista.find((b) => b.m === m)!.nome,
    brainOf: (m) => {
      const b = lista.find((x) => x.m === m)!;
      return b.persona ? { persona: { id: b.persona } } : undefined;
    },
    technicianOf: (m) => (lista.find((b) => b.m === m)!.tec ? {} : undefined),
  });

  it('classifica cada robô (Mech, andróide, técnico, chefe), dá a personalidade só aos Mechs e põe os aliados no fim', () => {
    const inimigos = bots([
      { m: mech('VECTOR-09'), nome: 'CLAWD', persona: 'brabo' },
      { m: mech('ANDRÓIDE'), nome: 'KUEN', persona: 'brabo' },
      { m: mech('ANDRÓIDE'), nome: 'ENTRÓPICO', tec: true },
      { m: mech('COLOSSUS-01'), nome: 'COLOSSUS-01' },
    ]);
    const aliados = bots([{ m: mech('VECTOR-09'), nome: 'ESCOLTA' }]);
    expect(escalacaoDaPartida(inimigos, aliados)).toEqual([
      { nome: 'CLAWD', tipo: 'mech', persona: 'brabo' },
      { nome: 'KUEN', tipo: 'android' },
      { nome: 'ENTRÓPICO', tipo: 'tecnico' },
      { nome: 'COLOSSUS-01', tipo: 'chefe' },
      { nome: 'ESCOLTA', tipo: 'aliado' },
    ]);
  });

  it('sem bots (partida online): lista vazia', () => {
    expect(escalacaoDaPartida(null, null)).toEqual([]);
  });

  it('conta os inimigos no singular e no plural, sem os aliados', () => {
    const l: PilotoNaPartida[] = [
      { nome: 'A', tipo: 'mech' },
      { nome: 'B', tipo: 'android' },
      { nome: 'C', tipo: 'android' },
      { nome: 'D', tipo: 'aliado' },
    ];
    expect(contagemInimigos(l)).toBe('1 MECH · 2 ANDRÓIDES');
    expect(contagemInimigos([])).toBe('NENHUM INIMIGO');
  });

  it('a lista de pilotos do monitor cabe sem rolagem: com esquadrão grande, as primeiras linhas e o resto resumido', () => {
    const cabe = Array.from({ length: LINHAS_DE_PILOTOS }, (_, i) => i);
    expect(pilotosVisiveis(cabe)).toEqual({ mostrados: cabe, ocultos: 0 });
    expect(pilotosVisiveis([])).toEqual({ mostrados: [], ocultos: 0 });
    const trinta = Array.from({ length: 30 }, (_, i) => i);
    const r = pilotosVisiveis(trinta);
    // Uma linha a menos que o máximo: a última é o aviso "+ N pilotos".
    expect(r.mostrados).toEqual(trinta.slice(0, LINHAS_DE_PILOTOS - 1));
    expect(r.ocultos).toBe(30 - (LINHAS_DE_PILOTOS - 1));
    expect(r.mostrados.length + 1).toBe(LINHAS_DE_PILOTOS);
    expect(pilotosVisiveis(Array.from({ length: LINHAS_DE_PILOTOS + 1 }, (_, i) => i)).ocultos).toBe(2);
  });

  it('a ameaça fica entre 1 e 5 e sobe com mais inimigos e mais dificuldade', () => {
    const um: PilotoNaPartida[] = [{ nome: 'A', tipo: 'android' }];
    const muitos: PilotoNaPartida[] = [
      { nome: 'M1', tipo: 'mech' },
      { nome: 'M2', tipo: 'mech' },
      { nome: 'M3', tipo: 'mech' },
      { nome: 'C', tipo: 'chefe' },
    ];
    expect(nivelDeAmeaca([], 'facil')).toBe(1);
    expect(nivelDeAmeaca(muitos, 'dificil')).toBe(5);
    expect(nivelDeAmeaca(um, 'dificil')).toBeGreaterThanOrEqual(nivelDeAmeaca(um, 'facil'));
    expect(nivelDeAmeaca(muitos, 'normal')).toBeGreaterThan(nivelDeAmeaca(um, 'normal'));
  });
});

describe('atalhos de teclado do console', () => {
  it('Enter põe em combate, H abre o Hangar, O entra no online, Z troca o zoom (maiúscula ou minúscula)', () => {
    expect(acaoDaTecla('Enter')).toBe('combate');
    expect(acaoDaTecla('h')).toBe('hangar');
    expect(acaoDaTecla('H')).toBe('hangar');
    expect(acaoDaTecla('o')).toBe('online');
    expect(acaoDaTecla('z')).toBe('zoom');
  });

  it('as outras teclas não fazem nada', () => {
    for (const k of ['a', 'Escape', ' ', 'Tab', 'ArrowLeft', '1', 'F9']) expect(acaoDaTecla(k), k).toBeNull();
  });

  it('nunca rouba uma tecla que o jogo já usa com a pausa à vista: M e B (briefing), C (CFTV), V, Q e E (espectador) e as teclas padrão', () => {
    for (const k of ['m', 'b', 'c', 'v', 'q', 'e']) expect(acaoDaTecla(k), k).toBeNull();
    for (const code of Object.values(DEFAULT_SETTINGS.keys)) {
      if (code.startsWith('Key')) expect(acaoDaTecla(code.slice(3)), code).toBeNull();
    }
  });
});

describe('a mesa de vídeo: a sondagem', () => {
  const resposta = (async () => ({}) as Response) as unknown as typeof fetch;
  const recusada = (async () => {
    throw new TypeError('Failed to fetch');
  }) as unknown as typeof fetch;
  /** Uma conexão que nunca responde, mas obedece ao aborto (como o navegador faz). */
  const muda = ((_: unknown, init?: RequestInit) =>
    new Promise((_ok, falha) => {
      init?.signal?.addEventListener('abort', () => falha(new DOMException('aborted', 'AbortError')));
    })) as unknown as typeof fetch;

  it('ligada: alguém atendeu, qualquer que seja a resposta', async () => {
    expect(await sondarMesa(resposta)).toBe(true);
  });

  it('desligada: a conexão é recusada', async () => {
    expect(await sondarMesa(recusada)).toBe(false);
  });

  it('sem resposta dentro do prazo, conta como desligada (e não trava o clique)', async () => {
    const t0 = Date.now();
    expect(await sondarMesa(muda, MESA_URL, 40)).toBe(false);
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  it('sonda o endereço local da mesa, sem CORS e sem cache', async () => {
    let visto: { url: string; init?: RequestInit } | null = null;
    const espia = (async (url: string, init?: RequestInit) => {
      visto = { url, init };
      return {} as Response;
    }) as unknown as typeof fetch;
    await sondarMesa(espia);
    expect(visto!.url).toBe(MESA_URL);
    expect(MESA_URL.startsWith('http://127.0.0.1:')).toBe(true);
    expect(visto!.init?.mode).toBe('no-cors');
    expect(visto!.init?.cache).toBe('no-store');
    expect(MESA_COMANDO).toBe('npm run mesa');
  });
});
