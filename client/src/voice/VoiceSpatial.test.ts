import { afterEach, describe, expect, it, vi } from 'vitest';
import { ALCANCE_DA_VOZ, VoiceSpatial, type SaidaDeAudio } from './VoiceSpatial';

class Param {
  value = 0;
}
const tresParams = () => ({ positionX: new Param(), positionY: new Param(), positionZ: new Param() });

/** O Web Audio de mentira: guarda o que o código monta e deixa o teste dizer qual é a onda que "chega". */
function audioFalso() {
  const onda = { desvio: 0 };
  const panners: any[] = [];
  const ligacoes: [unknown, unknown][] = [];
  const no = () => ({ connect: vi.fn(), disconnect: vi.fn() });
  const bus = { ...no(), gain: new Param() };
  const ctx = {
    listener: { ...tresParams(), forwardX: new Param(), forwardY: new Param(), forwardZ: new Param(), upX: new Param(), upY: new Param(), upZ: new Param() },
    createGain: () => bus,
    createPanner: () => {
      const p = { ...no(), ...tresParams(), panningModel: '', distanceModel: '', refDistance: 0, maxDistance: 0, rolloffFactor: 0 };
      panners.push(p);
      return p;
    },
    createAnalyser: () => ({ ...no(), fftSize: 2048, getByteTimeDomainData: (a: Uint8Array) => a.fill(128 + onda.desvio) }),
    createMediaStreamSource: (mediaStream: unknown) => ({ ...no(), mediaStream }),
    resume: vi.fn(async () => {}),
  };
  const out = no();
  const saida: SaidaDeAudio = { ctx: ctx as unknown as AudioContext, out: out as unknown as AudioNode };
  return { ctx, saida, onda, panners, bus, out, ligacoes };
}

const fluxo = (nome: string) => ({ nome }) as unknown as MediaStream;

describe('VoiceSpatial: a voz dos colegas no espaço (P205)', () => {
  afterEach(() => {
    delete (globalThis as { Audio?: unknown }).Audio;
  });

  it('antes do primeiro gesto (sem saída de áudio) o colega espera, e entra no ar quando a saída chega', () => {
    const a = audioFalso();
    let saida: SaidaDeAudio | null = null;
    const s = new VoiceSpatial(() => saida);
    s.adicionar(7, fluxo('a'));
    expect(s.quantos).toBe(0);
    s.ouvinte(0, 0, 0, 0);
    expect(s.quantos).toBe(0);
    saida = a.saida;
    s.ouvinte(0, 0, 0, 0);
    expect(s.quantos).toBe(1);
    expect(a.ctx.resume).toHaveBeenCalled();
  });

  it('o barramento de voz liga na saída do jogo, e o volume da voz é dele', () => {
    const a = audioFalso();
    const s = new VoiceSpatial(() => a.saida);
    s.setVolume(0.5);
    s.adicionar(1, fluxo('a'));
    expect(a.bus.connect).toHaveBeenCalledWith(a.out);
    expect(a.bus.gain.value).toBe(0.5);
    s.setVolume(0.2);
    expect(a.bus.gain.value).toBe(0.2);
  });

  it('cada colega passa por um panner de dois lados com queda em linha reta até o alcance da voz', () => {
    const a = audioFalso();
    const s = new VoiceSpatial(() => a.saida);
    s.adicionar(1, fluxo('a'));
    const p = a.panners[0];
    expect(p.panningModel).toBe('equalpower');
    expect(p.distanceModel).toBe('linear');
    expect(p.refDistance).toBe(ALCANCE_DA_VOZ.perto);
    expect(p.maxDistance).toBe(ALCANCE_DA_VOZ.longe);
    expect(p.rolloffFactor).toBe(1);
    expect(p.connect).toHaveBeenCalledWith(a.bus);
  });

  it('o ouvinte olha para -Z com yaw 0 e para a esquerda (-X) com yaw de 90°', () => {
    const a = audioFalso();
    const s = new VoiceSpatial(() => a.saida);
    s.adicionar(1, fluxo('a'));
    s.ouvinte(3, 4, 5, 0);
    const l = a.ctx.listener;
    expect([l.positionX.value, l.positionY.value, l.positionZ.value]).toEqual([3, 4, 5]);
    expect(l.forwardX.value).toBeCloseTo(0);
    expect(l.forwardZ.value).toBeCloseTo(-1);
    expect(l.upY.value).toBe(1);
    s.ouvinte(3, 4, 5, Math.PI / 2);
    expect(l.forwardX.value).toBeCloseTo(-1);
    expect(l.forwardZ.value).toBeCloseTo(0);
  });

  it('posicionar leva o panner ao colega, mas só se ele andou mais de 10 cm', () => {
    const a = audioFalso();
    const s = new VoiceSpatial(() => a.saida);
    s.adicionar(1, fluxo('a'));
    const p = a.panners[0];
    s.posicionar(1, 10, 0, -20);
    expect([p.positionX.value, p.positionZ.value]).toEqual([10, -20]);
    s.posicionar(1, 10.05, 0, -20);
    expect(p.positionX.value).toBe(10);
    s.posicionar(1, 10.5, 0, -20);
    expect(p.positionX.value).toBe(10.5);
    // quem não está na voz é ignorado
    expect(() => s.posicionar(99, 1, 2, 3)).not.toThrow();
  });

  it('falando: acima do limiar o colega está falando, e o indicador segura 350 ms depois do último som', () => {
    const a = audioFalso();
    const s = new VoiceSpatial(() => a.saida);
    s.adicionar(1, fluxo('a'));
    s.adicionar(2, fluxo('b'));
    const quem = new Set<number>();
    a.onda.desvio = 0;
    s.falando(1000, quem);
    expect([...quem]).toEqual([]);
    a.onda.desvio = 40;
    s.falando(1100, quem);
    expect([...quem].sort()).toEqual([1, 2]);
    a.onda.desvio = 3; // o ruído que sobra da supressão do navegador
    s.falando(1300, quem);
    expect(quem.size).toBe(2);
    s.falando(1500, quem);
    expect(quem.size).toBe(0);
  });

  it('remover desliga o colega do grafo; dispose desliga tudo, inclusive o barramento', () => {
    const a = audioFalso();
    const s = new VoiceSpatial(() => a.saida);
    s.adicionar(1, fluxo('a'));
    s.adicionar(2, fluxo('b'));
    s.remover(1);
    expect(s.quantos).toBe(1);
    expect(a.panners[0].disconnect).toHaveBeenCalled();
    s.dispose();
    expect(s.quantos).toBe(0);
    expect(a.bus.disconnect).toHaveBeenCalled();
  });

  it('o mesmo colega entrando de novo (outra conexão) substitui a voz velha em vez de somar', () => {
    const a = audioFalso();
    const s = new VoiceSpatial(() => a.saida);
    s.adicionar(1, fluxo('velha'));
    s.adicionar(1, fluxo('nova'));
    expect(s.quantos).toBe(1);
    expect(a.panners).toHaveLength(2);
    expect(a.panners[0].disconnect).toHaveBeenCalled();
  });

  it('o fluxo também vai num <audio> mudo (o Chrome só entrega o fluxo remoto ao Web Audio assim), e solta ao remover', () => {
    const elementos: { srcObject: unknown; muted: boolean }[] = [];
    (globalThis as { Audio?: unknown }).Audio = class {
      srcObject: unknown = null;
      muted = false;
      constructor() {
        elementos.push(this);
      }
      play() {
        return Promise.resolve();
      }
    };
    const a = audioFalso();
    const s = new VoiceSpatial(() => a.saida);
    const f = fluxo('a');
    s.adicionar(1, f);
    expect(elementos).toHaveLength(1);
    expect(elementos[0]!.muted).toBe(true);
    expect(elementos[0]!.srcObject).toBe(f);
    s.remover(1);
    expect(elementos[0]!.srcObject).toBeNull();
  });
});

/** Um fluxo com faixas de áudio de verdade (só o `enabled` importa ao mudo). */
const fluxoComFaixas = (n = 1) => {
  const faixas = Array.from({ length: n }, () => ({ enabled: true }));
  return { faixas, fluxo: { getAudioTracks: () => faixas } as unknown as MediaStream };
};

describe('VoiceSpatial: o mudo por jogador (P228)', () => {
  afterEach(() => {
    delete (globalThis as { Audio?: unknown }).Audio;
  });

  it('silenciar desliga a faixa que chega e voltar a ouvir a liga (custo zero: só o enabled)', () => {
    const a = audioFalso();
    const s = new VoiceSpatial(() => a.saida);
    const { faixas, fluxo: f } = fluxoComFaixas(2);
    s.adicionar(3, f);
    s.silenciar(3, true);
    expect(faixas.map((x) => x.enabled)).toEqual([false, false]);
    expect(s.silenciado(3)).toBe(true);
    s.silenciar(3, false);
    expect(faixas.map((x) => x.enabled)).toEqual([true, true]);
    expect(s.silenciado(3)).toBe(false);
  });

  it('quem ainda espera o áudio do jogo começar também é silenciado, e fica assim quando entra no ar', () => {
    let saida: SaidaDeAudio | null = null;
    const s = new VoiceSpatial(() => saida);
    const { faixas, fluxo: f } = fluxoComFaixas();
    s.adicionar(3, f); // esperando (sem saída de áudio)
    s.silenciar(3, true);
    expect(faixas[0]!.enabled).toBe(false);
    saida = audioFalso().saida;
    s.ouvinte(0, 0, 0, 0);
    expect(s.quantos).toBe(1);
    expect(faixas[0]!.enabled, 'entrar no ar não religa').toBe(false);
  });

  it('silenciar antes de o colega chegar vale quando ele chega, e silenciar um colega não mexe nos outros', () => {
    const a = audioFalso();
    const s = new VoiceSpatial(() => a.saida);
    s.silenciar(5, true); // ainda não há voz do 5
    const cinco = fluxoComFaixas();
    const seis = fluxoComFaixas();
    s.adicionar(5, cinco.fluxo);
    s.adicionar(6, seis.fluxo);
    expect(cinco.faixas[0]!.enabled).toBe(false);
    expect(seis.faixas[0]!.enabled, 'o outro colega segue ouvido').toBe(true);
  });

  it('o colega que sai da voz e volta (outra conexão) continua silenciado', () => {
    const a = audioFalso();
    const s = new VoiceSpatial(() => a.saida);
    s.adicionar(3, fluxoComFaixas().fluxo);
    s.silenciar(3, true);
    s.remover(3);
    const volta = fluxoComFaixas();
    s.adicionar(3, volta.fluxo);
    expect(volta.faixas[0]!.enabled).toBe(false);
    expect(s.silenciado(3)).toBe(true);
  });

  it('limparSilencios (sair da sala) volta a ouvir todo mundo e esquece quem estava silenciado', () => {
    const a = audioFalso();
    const s = new VoiceSpatial(() => a.saida);
    const x = fluxoComFaixas();
    s.adicionar(3, x.fluxo);
    s.silenciar(3, true);
    s.silenciar(8, true);
    s.limparSilencios();
    expect(x.faixas[0]!.enabled).toBe(true);
    expect(s.silenciado(3) || s.silenciado(8)).toBe(false);
  });

  it('dispose esquece os silenciados', () => {
    const a = audioFalso();
    const s = new VoiceSpatial(() => a.saida);
    s.silenciar(3, true);
    s.dispose();
    expect(s.silenciado(3)).toBe(false);
  });
});
