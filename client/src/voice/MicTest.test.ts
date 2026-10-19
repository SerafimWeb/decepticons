import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { carregarDicionario, IDIOMAS, traduzir, type Dicionario } from '../i18n/i18n';
import { listarAparelhos } from './aparelhos';
import { barraDoNivel, classificarFalha, DURACAO_MAXIMA_MS, ESPERA_SEM_SINAL_MS, estadoDoTeste, MicTest, nivelRms, RMS_CAPTANDO, TEXTO_DO_TESTE, type AmbienteDoTeste, type PecasDoTeste } from './MicTest';

const RAIZ = resolve(__dirname, '../..');

/** Uma onda de bytes (silêncio em 128) com a amplitude pedida (0 a 1), em tom puro. */
const onda = (amp: number, n = 1024): Uint8Array => Uint8Array.from({ length: n }, (_, i) => 128 + Math.round(amp * 127 * Math.sin(i / 3)));

describe('MicTest: a lógica pura (P212)', () => {
  it('nivelRms: silêncio é 0, o cheio é ~1, e a onda de meia amplitude fica entre os dois', () => {
    expect(nivelRms(new Uint8Array(1024).fill(128))).toBe(0);
    expect(nivelRms(new Uint8Array(0))).toBe(0);
    expect(nivelRms(onda(1))).toBeGreaterThan(0.6);
    expect(nivelRms(onda(0.5))).toBeLessThan(nivelRms(onda(1)));
    expect(nivelRms(onda(0.5))).toBeGreaterThan(nivelRms(onda(0.1)));
  });

  it('barraDoNivel: em decibéis de −60 (vazio) a 0 (cheio); o silêncio é 0, a fala comum fica no meio e o cheio chega a 100', () => {
    expect(barraDoNivel(0)).toBe(0);
    expect(barraDoNivel(0.001)).toBe(0); // −60 dBFS
    expect(barraDoNivel(1)).toBe(100);
    expect(barraDoNivel(0.1)).toBe(67); // −20 dBFS
    expect(barraDoNivel(RMS_CAPTANDO)).toBeGreaterThan(40);
    expect(barraDoNivel(5)).toBe(100);
  });

  it('estadoDoTeste: captou é "ok" para sempre; sem captar, "fale" até a espera acabar e "sem sinal" depois', () => {
    expect(estadoDoTeste(100, RMS_CAPTANDO)).toBe('ok');
    expect(estadoDoTeste(ESPERA_SEM_SINAL_MS * 10, RMS_CAPTANDO + 0.1)).toBe('ok');
    expect(estadoDoTeste(100, 0)).toBe('fale');
    expect(estadoDoTeste(ESPERA_SEM_SINAL_MS - 1, RMS_CAPTANDO - 0.001)).toBe('fale');
    expect(estadoDoTeste(ESPERA_SEM_SINAL_MS, RMS_CAPTANDO - 0.001)).toBe('semSinal');
  });

  it('classificarFalha: bloqueado, sem aparelho, em uso por outro programa, e o resto', () => {
    for (const n of ['NotAllowedError', 'SecurityError', 'PermissionDeniedError']) expect(classificarFalha({ name: n })).toBe('negado');
    for (const n of ['NotFoundError', 'DevicesNotFoundError']) expect(classificarFalha({ name: n })).toBe('semAparelho');
    for (const n of ['NotReadableError', 'TrackStartError', 'AbortError']) expect(classificarFalha({ name: n })).toBe('emUso');
    for (const e of [{ name: 'OverconstrainedError' }, new Error('x'), null, undefined, 'texto']) expect(classificarFalha(e)).toBe('outra');
  });

  it('listarAparelhos: só microfones de verdade; sem nome (sem permissão) vira "Microfone N"; "default" e "communications" ficam de fora', () => {
    const todos = [
      { kind: 'audioinput', deviceId: 'default', label: 'Padrão - Headset' },
      { kind: 'audioinput', deviceId: 'communications', label: 'Comunicações' },
      { kind: 'audioinput', deviceId: 'abc', label: 'Headset USB' },
      { kind: 'audioinput', deviceId: 'def', label: '   ' },
      { kind: 'audiooutput', deviceId: 'out', label: 'Caixas' },
      { kind: 'videoinput', deviceId: 'cam', label: 'Câmera' },
      { kind: 'audioinput', deviceId: '', label: '' },
    ];
    expect(listarAparelhos(todos, (n) => `Microfone ${n}`)).toEqual([
      { id: 'abc', nome: 'Headset USB' },
      { id: 'def', nome: 'Microfone 2' },
    ]);
    expect(listarAparelhos([], (n) => `Microfone ${n}`)).toEqual([]);
  });
});

// ---------- o painel, com um microfone e um relógio falsos ----------

class FaixaFalsa {
  parada = false;
  stop() {
    this.parada = true;
  }
}

function montar() {
  const faixa = new FaixaFalsa();
  const fluxo = { getTracks: () => [faixa] } as unknown as MediaStream;
  const estado = { amp: 0, agora: 0, abertos: [] as string[], fechado: 0, volta: { gain: { value: -1 }, connect: () => {} }, resolverAbrir: null as null | ((f: MediaStream) => void), recusarAbrir: null as null | ((e: unknown) => void), pendente: false };
  const quadros: (() => void)[] = [];
  const analyser = {
    fftSize: 1024,
    getByteTimeDomainData: (a: Uint8Array) => a.set(onda(estado.amp, a.length)),
    connect: () => {},
  };
  const ctx = {
    resume: async () => {},
    close: async () => {
      estado.fechado++;
    },
    createMediaStreamSource: () => ({ connect: () => {} }),
    createAnalyser: () => analyser,
    createGain: () => estado.volta,
    destination: {},
  };
  const ambiente: AmbienteDoTeste = {
    abrir: (aparelho) => {
      estado.abertos.push(aparelho);
      if (!estado.pendente) return Promise.resolve(fluxo);
      return new Promise((res, rej) => {
        estado.resolverAbrir = res;
        estado.recusarAbrir = rej;
      });
    },
    novoContexto: () => ctx as unknown as AudioContext,
    quadro: (f) => quadros.push(f),
    cancelarQuadro: () => {},
    agora: () => estado.agora,
  };
  const rolagens: string[] = [];
  const pecas: PecasDoTeste & { ouvir: { checked: boolean } } = {
    painel: { hidden: true, dataset: {} as Record<string, string | undefined>, scrollIntoView: (o: { block: 'nearest' }) => void rolagens.push(o.block) },
    barra: { style: { width: '' } },
    status: { textContent: '' as string | null },
    botao: { textContent: TEXTO_DO_TESTE.testar as string | null },
    ouvir: { checked: false },
  };
  let aparelho = '';
  let abriu = 0;
  const teste = new MicTest(pecas, () => aparelho, ambiente, () => abriu++);
  /** Roda o próximo quadro agendado (o laço do teste). */
  const quadro = () => quadros.shift()?.();
  return { teste, pecas, rolagens, estado, faixa, quadro, quadrosPendentes: () => quadros.length, setAparelho: (a: string) => (aparelho = a), abriu: () => abriu };
}

describe('MicTest: o painel (P212)', () => {
  it('iniciar abre o microfone, mostra o painel e o botão vira "parar o teste"; a barra acompanha a voz', async () => {
    const t = montar();
    await t.teste.iniciar();
    expect(t.teste.rodando).toBe(true);
    expect(t.pecas.painel.hidden).toBe(false);
    expect(t.pecas.botao.textContent).toBe(TEXTO_DO_TESTE.parar);
    expect(t.pecas.status.textContent).toBe(TEXTO_DO_TESTE.fale);
    expect(t.abriu()).toBe(1);
    expect(t.rolagens, 'a janela das Configurações rola até o painel (a barra ficava cortada)').toEqual(['nearest']);
    t.estado.amp = 0.5;
    t.quadro();
    expect(Number.parseInt(t.pecas.barra.style.width, 10)).toBeGreaterThan(40);
    t.estado.amp = 0;
    t.quadro();
    expect(t.pecas.barra.style.width).toBe('0%');
  });

  it('o microfone escolhido vai no pedido ("" = o padrão)', async () => {
    const t = montar();
    t.setAparelho('headset-usb');
    await t.teste.iniciar();
    expect(t.estado.abertos).toEqual(['headset-usb']);
  });

  it('captou voz: o texto vira "funcionando" e continua assim mesmo se a pessoa se calar', async () => {
    const t = montar();
    await t.teste.iniciar();
    t.estado.amp = 0.4;
    t.estado.agora = 500;
    t.quadro();
    expect(t.pecas.painel.dataset.estado).toBe('ok');
    expect(t.pecas.status.textContent).toBe(TEXTO_DO_TESTE.ok);
    t.estado.amp = 0;
    t.estado.agora = ESPERA_SEM_SINAL_MS * 3;
    t.quadro();
    expect(t.pecas.painel.dataset.estado).toBe('ok');
  });

  it('nenhuma voz depois da espera: "sem sinal"', async () => {
    const t = montar();
    await t.teste.iniciar();
    t.estado.agora = ESPERA_SEM_SINAL_MS - 1;
    t.quadro();
    expect(t.pecas.painel.dataset.estado).toBe('fale');
    t.estado.agora = ESPERA_SEM_SINAL_MS + 1;
    t.quadro();
    expect(t.pecas.painel.dataset.estado).toBe('semSinal');
    expect(t.pecas.status.textContent).toBe(TEXTO_DO_TESTE.semSinal);
  });

  it('parar solta o microfone, fecha o áudio, esconde o painel, zera a barra e desliga a volta da voz', async () => {
    const t = montar();
    await t.teste.iniciar();
    t.pecas.ouvir.checked = true;
    t.estado.amp = 0.5;
    t.quadro();
    t.teste.parar();
    expect(t.faixa.parada).toBe(true);
    expect(t.estado.fechado).toBe(1);
    expect(t.teste.rodando).toBe(false);
    expect(t.pecas.painel.hidden).toBe(true);
    expect(t.pecas.painel.dataset.estado).toBeUndefined();
    expect(t.pecas.barra.style.width).toBe('0%');
    expect(t.pecas.ouvir.checked).toBe(false);
    expect(t.pecas.botao.textContent).toBe(TEXTO_DO_TESTE.testar);
    // depois de parar, um quadro atrasado não faz nada
    t.quadro();
    expect(t.pecas.barra.style.width).toBe('0%');
  });

  it('"ouvir a minha voz" liga a volta (ganho 1) e desliga (0); começa pelo estado da caixa', async () => {
    const t = montar();
    t.pecas.ouvir.checked = true;
    await t.teste.iniciar();
    expect(t.estado.volta.gain.value).toBe(1);
    t.teste.ouvirAMinhaVoz(false);
    expect(t.estado.volta.gain.value).toBe(0);
    t.teste.ouvirAMinhaVoz(true);
    expect(t.estado.volta.gain.value).toBe(1);
    const sem = montar();
    await sem.teste.iniciar();
    expect(sem.estado.volta.gain.value).toBe(0);
  });

  it('cada falha do navegador tem o seu texto e o botão volta a "testar"', async () => {
    const casos: [string, keyof typeof TEXTO_DO_TESTE, string][] = [
      ['NotAllowedError', 'negado', 'negado'],
      ['NotFoundError', 'semAparelho', 'semAparelho'],
      ['NotReadableError', 'emUso', 'emUso'],
      ['Estranho', 'outra', 'outra'],
    ];
    for (const [nome, texto, estadoDoPainel] of casos) {
      const t = montar();
      t.estado.pendente = true;
      const p = t.teste.iniciar();
      t.estado.recusarAbrir!(Object.assign(new Error('x'), { name: nome }));
      await p;
      expect(t.pecas.status.textContent, nome).toBe(TEXTO_DO_TESTE[texto]);
      expect(t.pecas.painel.dataset.estado).toBe(estadoDoPainel);
      expect(t.pecas.botao.textContent).toBe(TEXTO_DO_TESTE.testar);
      expect(t.teste.rodando).toBe(false);
    }
  });

  it('parar enquanto o navegador ainda pergunta: o microfone que chegar depois é solto na hora', async () => {
    const t = montar();
    t.estado.pendente = true;
    const p = t.teste.iniciar();
    expect(t.teste.rodando).toBe(true);
    t.teste.parar();
    t.estado.resolverAbrir!({ getTracks: () => [t.faixa] } as unknown as MediaStream);
    await p;
    expect(t.faixa.parada).toBe(true);
    expect(t.teste.rodando).toBe(false);
    expect(t.pecas.painel.hidden).toBe(true);
    expect(t.abriu()).toBe(0);
  });

  it('o teste desliga sozinho depois de 2 minutos (o microfone nunca fica aberto esquecido)', async () => {
    const t = montar();
    await t.teste.iniciar();
    t.estado.agora = DURACAO_MAXIMA_MS - 1;
    t.quadro();
    expect(t.teste.rodando).toBe(true);
    t.estado.agora = DURACAO_MAXIMA_MS + 1;
    t.quadro();
    expect(t.teste.rodando).toBe(false);
    expect(t.faixa.parada).toBe(true);
  });

  it('iniciar duas vezes não abre o microfone duas vezes; reiniciar troca para o aparelho novo', async () => {
    const t = montar();
    await t.teste.iniciar();
    await t.teste.iniciar();
    expect(t.estado.abertos).toHaveLength(1);
    t.setAparelho('outro');
    await t.teste.reiniciar();
    expect(t.estado.abertos).toEqual(['', 'outro']);
    expect(t.faixa.parada).toBe(true); // o primeiro foi solto
    expect(t.teste.rodando).toBe(true);
    // reiniciar com o teste parado não liga nada
    t.teste.parar();
    await t.teste.reiniciar();
    expect(t.teste.rodando).toBe(false);
    expect(t.estado.abertos).toHaveLength(2);
  });
});

describe('o teste do microfone e o aviso de "sozinho" nas seis línguas (P212)', () => {
  afterEach(() => carregarDicionario(null));
  const textos = [...Object.values(TEXTO_DO_TESTE).map((t) => t.replace('{0}', '1')), 'Nível do microfone', 'NINGUÉM MAIS NA VOZ: TESTE O MICROFONE EM CONFIGURAÇÕES', 'Aparelho do microfone', 'Testar o microfone', 'Ouvir a minha voz (use fones: sem eles dá microfonia)'];

  for (const { id } of IDIOMAS.filter((i) => i.id !== 'pt')) {
    it(`${id}: todo texto do painel está traduzido`, () => {
      carregarDicionario(JSON.parse(readFileSync(resolve(RAIZ, `public/locales/${id}.json`), 'utf8')) as Dicionario);
      for (const texto of textos) expect(traduzir(texto), `${id}: "${texto}"`).not.toBe(texto);
    });
  }
});
