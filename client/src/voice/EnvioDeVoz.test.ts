import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EnvioDeVoz } from './EnvioDeVoz';

/** Um nó de áudio de mentira: anota para onde foi ligado, o que foi solto e os parâmetros que o envio mexe. */
class No {
  destinos: No[] = [];
  solto = false;
  gain = { value: 1 };
  threshold = { value: 0 };
  knee = { value: 0 };
  ratio = { value: 0 };
  attack = { value: 0 };
  release = { value: 0 };
  fftSize = 0;
  stream: { getAudioTracks(): { stop(): void; parada: boolean }[]; getTracks(): { stop(): void; parada: boolean }[] } | undefined;
  constructor(public tipo: string) {}
  connect(d: No): No {
    this.destinos.push(d);
    return d;
  }
  disconnect(d?: No): void {
    if (d) this.destinos = this.destinos.filter((x) => x !== d);
    else this.destinos = [];
    this.solto = true;
  }
  getFloatTimeDomainData(a: Float32Array): void {
    a.set(onda.subarray(0, a.length));
  }
}
let onda = new Float32Array(1024);

function contexto(estado: 'running' | 'suspended' = 'running') {
  const nos: No[] = [];
  const faixas: { stop(): void; parada: boolean }[] = [];
  const novo = (tipo: string) => {
    const n = new No(tipo);
    nos.push(n);
    return n;
  };
  const ctx = {
    state: estado,
    fechado: false,
    retomado: 0,
    resume: async () => {
      ctx.retomado++;
    },
    close: async () => {
      ctx.fechado = true;
    },
    createMediaStreamSource: () => novo('fonte'),
    createGain: () => novo('gain'),
    createDynamicsCompressor: () => novo('limitador'),
    createAnalyser: () => novo('analisador'),
    createMediaStreamDestination: () => {
      const faixa = { parada: false, stop() { faixa.parada = true; } };
      faixas.push(faixa);
      const d = novo('destino');
      d.stream = { getAudioTracks: () => [faixa], getTracks: () => [faixa] };
      return d;
    },
  };
  return { ctx: ctx as unknown as AudioContext, c: ctx, nos, faixas };
}

describe('EnvioDeVoz (P237): o grafo de envio da voz', () => {
  beforeEach(() => {
    onda = new Float32Array(1024);
    vi.stubGlobal('MediaStream', class { constructor(public tracks: unknown[] = []) {} });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('microfone → ganho → limitador → analisador, com o ganho e o teto nos números certos', () => {
    const k = contexto();
    new EnvioDeVoz(k.ctx, {} as MediaStreamTrack, 2.5);
    const [fonte, ganho, limitador, analisador] = k.nos as [No, No, No, No];
    expect(fonte.tipo).toBe('fonte');
    expect(fonte.destinos).toEqual([ganho]);
    expect(ganho.gain.value).toBe(2.5);
    expect(ganho.destinos).toEqual([limitador]);
    expect(limitador.threshold.value, 'o limitador fica perto do teto').toBe(-3);
    expect(limitador.ratio.value).toBe(20);
    expect(limitador.destinos).toEqual([analisador]);
    expect(analisador.fftSize).toBe(1024);
    expect(k.c.retomado, 'o contexto é retomado (o navegador o cria suspenso sem gesto)').toBe(1);
  });

  it('setGanho muda o ganho ao vivo, sem refazer o grafo', () => {
    const k = contexto();
    const e = new EnvioDeVoz(k.ctx, {} as MediaStreamTrack, 1);
    const n = k.nos.length;
    e.setGanho(3.2);
    expect(k.nos.filter((x) => x.tipo === 'gain')[0]!.gain.value).toBe(3.2);
    expect(k.nos).toHaveLength(n);
  });

  it('cada colega tem a sua porta e o seu destino; a faixa de um não é a do outro, e repetir o pedido devolve a mesma', () => {
    const k = contexto();
    const e = new EnvioDeVoz(k.ctx, {} as MediaStreamTrack, 1);
    const f3 = e.faixaPara(3);
    const f4 = e.faixaPara(4);
    expect(f3).not.toBe(f4);
    expect(e.faixaPara(3), 'o mesmo colega, a mesma faixa (nada novo a cada pedido)').toBe(f3);
    expect(k.nos.filter((x) => x.tipo === 'destino')).toHaveLength(2);
    const limitador = k.nos.find((x) => x.tipo === 'limitador')!;
    const portas = k.nos.filter((x) => x.tipo === 'gain').slice(1);
    expect(portas).toHaveLength(2);
    for (const p of portas) expect(limitador.destinos).toContain(p);
  });

  it('a porta pode nascer FECHADA (um colega que chega no meio de uma fala só para o time não ouve nada)', () => {
    const k = contexto();
    const e = new EnvioDeVoz(k.ctx, {} as MediaStreamTrack, 1);
    e.faixaPara(3, false);
    e.faixaPara(4);
    const [p3, p4] = k.nos.filter((x) => x.tipo === 'gain').slice(1) as [No, No];
    expect(p3.gain.value).toBe(0);
    expect(p4.gain.value, 'o padrão é nascer aberta').toBe(1);
  });

  it('a porta de um colega abre e fecha sem mexer nas dos outros (é assim que um canal escolhe quem ouve)', () => {
    const k = contexto();
    const e = new EnvioDeVoz(k.ctx, {} as MediaStreamTrack, 1);
    e.faixaPara(3);
    e.faixaPara(4);
    const [p3, p4] = k.nos.filter((x) => x.tipo === 'gain').slice(1) as [No, No];
    expect(p3.gain.value, 'nasce aberta').toBe(1);
    e.abrirPara(3, false);
    expect(p3.gain.value).toBe(0);
    expect(p4.gain.value).toBe(1);
    e.abrirPara(3, true);
    expect(p3.gain.value).toBe(1);
    expect(() => e.abrirPara(99, false), 'um colega que não existe não quebra nada').not.toThrow();
  });

  it('soltar um colega desliga a porta dele e PARA a faixa do destino; os outros seguem', () => {
    const k = contexto();
    const e = new EnvioDeVoz(k.ctx, {} as MediaStreamTrack, 1);
    e.faixaPara(3);
    e.faixaPara(4);
    e.soltarPar(3);
    expect(k.faixas[0]!.parada).toBe(true);
    expect(k.faixas[1]!.parada).toBe(false);
    const limitador = k.nos.find((x) => x.tipo === 'limitador')!;
    const portas = k.nos.filter((x) => x.tipo === 'gain').slice(1);
    expect(limitador.destinos, 'só sobra a porta do 4 (e o analisador)').not.toContain(portas[0]);
    expect(limitador.destinos).toContain(portas[1]);
    expect(() => e.soltarPar(3)).not.toThrow();
  });

  it('ler devolve o RMS e o pico da onda que sai (já com o ganho)', () => {
    const k = contexto();
    const e = new EnvioDeVoz(k.ctx, {} as MediaStreamTrack, 1);
    expect(e.ler()).toEqual({ rms: 0, pico: 0 });
    onda = new Float32Array(1024).fill(0.05);
    const l = e.ler();
    expect(l.rms).toBeCloseTo(0.05, 6);
    expect(l.pico).toBeCloseTo(0.05, 6);
  });

  it('funcionando só com o contexto rodando; suspenso não conta', () => {
    expect(new EnvioDeVoz(contexto('running').ctx, {} as MediaStreamTrack, 1).funcionando).toBe(true);
    expect(new EnvioDeVoz(contexto('suspended').ctx, {} as MediaStreamTrack, 1).funcionando).toBe(false);
  });

  it('dispose solta tudo e fecha o contexto (o chat não deixa áudio ligado à toa)', () => {
    const k = contexto();
    const e = new EnvioDeVoz(k.ctx, {} as MediaStreamTrack, 1);
    e.faixaPara(3);
    e.dispose();
    expect(k.c.fechado).toBe(true);
    expect(k.faixas.every((f) => f.parada)).toBe(true);
    expect(k.nos.find((x) => x.tipo === 'fonte')!.solto).toBe(true);
    expect(() => e.dispose(), 'duas vezes não quebra').not.toThrow();
  });
});
