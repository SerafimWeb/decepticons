import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { VozEfeito } from '../core/Settings';
import type { CadeiaDeVoz } from './EfeitosDeVoz';
import { carregarDicionario, IDIOMAS, traduzir, type Dicionario } from '../i18n/i18n';
import { listarAparelhos } from './aparelhos';
import { barraDoNivel, classificarFalha, DURACAO_MAXIMA_MS, ESPERA_SEM_SINAL_MS, estadoDoTeste, MicTest, nivelDaOnda, RMS_CAPTANDO, TEXTO_DO_TESTE, type AmbienteDoTeste, type PecasDoTeste } from './MicTest';

const RAIZ = resolve(__dirname, '../..');

/** Uma onda em ponto flutuante (amostras de -1 a 1) com a amplitude pedida, em tom puro. */
const onda = (amp: number, n = 1024): Float32Array => Float32Array.from({ length: n }, (_, i) => amp * Math.sin(i / 3));

describe('MicTest: a lógica pura (P212)', () => {
  it('nivelDaOnda: silêncio é 0 (RMS e pico), o cheio é ~0,7 de RMS, e a onda de meia amplitude fica entre os dois', () => {
    expect(nivelDaOnda(new Float32Array(1024))).toEqual({ rms: 0, pico: 0 });
    expect(nivelDaOnda(new Float32Array(0))).toEqual({ rms: 0, pico: 0 });
    expect(nivelDaOnda(onda(1)).rms).toBeGreaterThan(0.6);
    expect(nivelDaOnda(onda(1)).pico).toBeGreaterThan(0.99);
    expect(nivelDaOnda(onda(0.5)).rms).toBeLessThan(nivelDaOnda(onda(1)).rms);
    expect(nivelDaOnda(onda(0.5)).rms).toBeGreaterThan(nivelDaOnda(onda(0.1)).rms);
  });

  it('nivelDaOnda enxerga voz baixinha de fone Bluetooth (RMS de 0,01), que a medição em bytes de 8 bits não via', () => {
    const baixinha = onda(0.014); // RMS ~0,01
    expect(nivelDaOnda(baixinha).rms).toBeGreaterThan(RMS_CAPTANDO);
    expect(nivelDaOnda(baixinha).rms).toBeLessThan(0.0078 * 2);
    expect(estadoDoTeste(500, nivelDaOnda(baixinha).rms)).toBe('ok');
    expect(estadoDoTeste(ESPERA_SEM_SINAL_MS + 1, nivelDaOnda(onda(0.0015)).rms, 0.0015), 'o chiado do quarto não é voz').toBe('semSinal');
  });
  it('barraDoNivel: em decibéis de −60 (vazio) a 0 (cheio); o silêncio é 0, a fala comum fica no meio e o cheio chega a 100', () => {
    expect(barraDoNivel(0)).toBe(0);
    expect(barraDoNivel(0.001)).toBe(0); // −60 dBFS
    expect(barraDoNivel(1)).toBe(100);
    expect(barraDoNivel(0.1)).toBe(67); // −20 dBFS
    expect(barraDoNivel(RMS_CAPTANDO)).toBeGreaterThan(25); // a barra já mostra o limite de "captando" (−42 dBFS)
    expect(barraDoNivel(5)).toBe(100);
  });

  it('estadoDoTeste: captou é "ok" para sempre; sem captar, "fale" até a espera acabar e "sem sinal" depois', () => {
    expect(estadoDoTeste(100, RMS_CAPTANDO)).toBe('ok');
    expect(estadoDoTeste(ESPERA_SEM_SINAL_MS * 10, RMS_CAPTANDO + 0.1)).toBe('ok');
    expect(estadoDoTeste(100, 0)).toBe('fale');
    expect(estadoDoTeste(ESPERA_SEM_SINAL_MS - 1, RMS_CAPTANDO - 0.001)).toBe('fale');
    expect(estadoDoTeste(ESPERA_SEM_SINAL_MS, RMS_CAPTANDO - 0.001)).toBe('semSinal');
  });

  it('estadoDoTeste: zero absoluto o teste inteiro é "silêncio total" (aparelho mudo no Windows), só depois da espera; qualquer chiado é "sem sinal"', () => {
    expect(estadoDoTeste(100, 0, 0), 'cedo demais para dizer').toBe('fale');
    expect(estadoDoTeste(ESPERA_SEM_SINAL_MS - 1, 0, 0)).toBe('fale');
    expect(estadoDoTeste(ESPERA_SEM_SINAL_MS, 0, 0)).toBe('silencioTotal');
    expect(estadoDoTeste(ESPERA_SEM_SINAL_MS * 5, 0, 0)).toBe('silencioTotal');
    expect(estadoDoTeste(ESPERA_SEM_SINAL_MS, 0, 0.0001)).toBe('semSinal');
    expect(estadoDoTeste(ESPERA_SEM_SINAL_MS, RMS_CAPTANDO, 0), 'se captou, é ok').toBe('ok');
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
  label = 'Headset de teste';
  stop() {
    this.parada = true;
  }
}

/** A fonte do microfone dentro do contexto: guarda para onde está ligada e, como a de verdade, lança se desligarem o que não está ligado. */
function fonteFalsa() {
  const f = {
    destinos: [] as unknown[],
    connect(d: unknown) {
      f.destinos.push(d);
    },
    disconnect(d: unknown) {
      const i = f.destinos.indexOf(d);
      if (i < 0) throw new Error('InvalidAccessError');
      f.destinos.splice(i, 1);
    },
  };
  return f;
}

function montar(opcoes: { efeito?: () => VozEfeito; cadeiaDeVoz?: AmbienteDoTeste['cadeiaDeVoz']; ganho?: () => number } = {}) {
  const faixa = new FaixaFalsa();
  const fonte = fonteFalsa();
  const fluxo = { getTracks: () => [faixa], getAudioTracks: () => [faixa] } as unknown as MediaStream;
  const estado = { amp: 0, agora: 0, abertos: [] as string[], fechado: 0, volta: Object.assign(fonteFalsa(), { gain: { value: -1 } }), resolverAbrir: null as null | ((f: MediaStream) => void), recusarAbrir: null as null | ((e: unknown) => void), pendente: false };
  const quadros: (() => void)[] = [];
  const analyser = {
    fftSize: 1024,
    getFloatTimeDomainData: (a: Float32Array) => a.set(onda(estado.amp, a.length)),
    connect: () => {},
  };
  const nos: ReturnType<typeof fonteFalsa>[] = [];
  const ctx = {
    resume: async () => {},
    close: async () => {
      estado.fechado++;
    },
    createMediaStreamSource: () => fonte,
    createAnalyser: () => analyser,
    // o primeiro `createGain` do teste é a volta da voz; o segundo, o ganho do jogador (P237): cada nó anota para onde foi ligado
    createGain: () => {
      const n = nos.length === 0 ? estado.volta : Object.assign(fonteFalsa(), { gain: { value: 1 } });
      nos.push(n);
      return n;
    },
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
    cadeiaDeVoz: opcoes.cadeiaDeVoz,
  };
  const rolagens: string[] = [];
  const pecas: PecasDoTeste & { ouvir: { checked: boolean } } = {
    painel: { hidden: true, dataset: {} as Record<string, string | undefined>, scrollIntoView: (o: { block: 'nearest' }) => void rolagens.push(o.block) },
    barra: { style: { width: '' } },
    status: { textContent: '' as string | null },
    botao: { textContent: TEXTO_DO_TESTE.testar as string | null },
    ouvir: { checked: false },
    aparelho: { textContent: '' as string | null },
    dica: { textContent: '' as string | null },
  };
  let aparelho = '';
  let abriu = 0;
  const teste = new MicTest(pecas, () => aparelho, ambiente, () => abriu++, opcoes.efeito, opcoes.ganho);
  /** Roda o próximo quadro agendado (o laço do teste). */
  const quadro = () => quadros.shift()?.();
  return { teste, pecas, rolagens, estado, faixa, fonte, analyser, ganhoNo: () => nos[1] as ReturnType<typeof fonteFalsa> & { gain: { value: number } }, quadro, quadrosPendentes: () => quadros.length, setAparelho: (a: string) => (aparelho = a), abriu: () => abriu };
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

  it('só chiado, nenhuma voz, depois da espera: "sem sinal"', async () => {
    const t = montar();
    await t.teste.iniciar();
    t.estado.amp = 0.001; // chiado do quarto: acima de zero, abaixo da voz
    t.estado.agora = ESPERA_SEM_SINAL_MS - 1;
    t.quadro();
    expect(t.pecas.painel.dataset.estado).toBe('fale');
    t.estado.agora = ESPERA_SEM_SINAL_MS + 1;
    t.quadro();
    expect(t.pecas.painel.dataset.estado).toBe('semSinal');
    expect(t.pecas.status.textContent).toBe(TEXTO_DO_TESTE.semSinal);
  });

  it('o aparelho que o navegador abriu aparece no painel (para ver que a escolha da lista valeu), e some ao parar', async () => {
    const t = montar();
    await t.teste.iniciar();
    expect(t.pecas.aparelho!.textContent).toBe('Aparelho em uso: Headset de teste');
    t.teste.parar();
    expect(t.pecas.aparelho!.textContent).toBe('');
  });

  it('um aparelho que entrega zero absoluto depois da espera: "silêncio total" com a frase própria (não "sem sinal")', async () => {
    const t = montar();
    await t.teste.iniciar();
    t.estado.amp = 0; // zero exato, o teste inteiro
    t.estado.agora = ESPERA_SEM_SINAL_MS + 1;
    t.quadro();
    expect(t.pecas.painel.dataset.estado).toBe('silencioTotal');
    expect(t.pecas.status.textContent).toBe(TEXTO_DO_TESTE.silencioTotal);
  });

  it('um chiado (qualquer amostra acima de zero) sem voz depois da espera continua sendo "sem sinal"', async () => {
    const t = montar();
    await t.teste.iniciar();
    t.estado.amp = 0.001; // chiado: pico > 0, RMS abaixo do limite
    t.estado.agora = 100;
    t.quadro();
    t.estado.agora = ESPERA_SEM_SINAL_MS + 1;
    t.quadro();
    expect(t.pecas.painel.dataset.estado).toBe('semSinal');
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
  const textos = [...Object.values(TEXTO_DO_TESTE).map((t) => t.replace('{0}', '1')), 'Nível do microfone', 'NINGUÉM MAIS NA VOZ: TESTE O MICROFONE EM CONFIGURAÇÕES', 'Aparelho do microfone', 'Testar o microfone', 'Ouvir a minha voz (use fones: sem eles dá microfonia)', 'Ganho do microfone', 'Efeito na minha voz', 'Sem efeito', 'Locutor militar', 'Lorde sombrio', 'Grande Irmão', 'Vale na narração (F8) e no teste do microfone, não no chat. Muda o tom, o grave e o ambiente da voz; não muda o sotaque.'];

  for (const { id } of IDIOMAS.filter((i) => i.id !== 'pt')) {
    it(`${id}: todo texto do painel está traduzido`, () => {
      carregarDicionario(JSON.parse(readFileSync(resolve(RAIZ, `public/locales/${id}.json`), 'utf8')) as Dicionario);
      for (const texto of textos) expect(traduzir(texto), `${id}: "${texto}"`).not.toBe(texto);
    });
  }
});

/** Uma cadeia de efeito de mentira: anota o que se ligou a ela e se foi desligada. */
function cadeiaFalsa(nome: string) {
  const saida = { destinos: [] as unknown[], connect(d: unknown) { saida.destinos.push(d); } };
  const c = { nome, entrada: { id: `entrada-${nome}` }, saida, desligada: 0, desligar() { c.desligada++; } };
  return c;
}

describe('MicTest: o efeito na prévia "ouvir a minha voz" (P231)', () => {
  it('sem efeito, a voz vai direto à volta (e o nível da barra é sempre o do microfone puro)', async () => {
    const t = montar({ efeito: () => 'normal' });
    await t.teste.iniciar();
    expect(t.ganhoNo().destinos).toContain(t.analyser);
    expect(t.ganhoNo().destinos).toContain(t.estado.volta);
  });

  it('com efeito, o microfone vai à cadeia e só a cadeia vai à volta: a voz pura nunca toca; a barra segue medindo o microfone puro', async () => {
    const cadeia = cadeiaFalsa('sombrio');
    const pedidos: VozEfeito[] = [];
    const t = montar({ efeito: () => 'sombrio', cadeiaDeVoz: async (_ctx, efeito) => { pedidos.push(efeito); return cadeia as unknown as CadeiaDeVoz; } });
    await t.teste.iniciar();
    await Promise.resolve(); // o pedido do efeito termina
    expect(pedidos).toEqual(['sombrio']);
    expect(t.ganhoNo().destinos).toContain(cadeia.entrada);
    expect(t.ganhoNo().destinos, 'a voz crua não vai à volta').not.toContain(t.estado.volta);
    expect(t.ganhoNo().destinos, 'a barra mede o microfone puro').toContain(t.analyser);
    expect(cadeia.saida.destinos).toEqual([t.estado.volta]);
  });

  it('trocar o efeito com o teste ligado desliga a cadeia velha e passa a tocar a nova (e "sem efeito" volta ao fio direto)', async () => {
    let atual: VozEfeito = 'locutor';
    const cadeias: ReturnType<typeof cadeiaFalsa>[] = [];
    const t = montar({ efeito: () => atual, cadeiaDeVoz: async (_c, efeito) => { const c = cadeiaFalsa(efeito); cadeias.push(c); return c as unknown as CadeiaDeVoz; } });
    await t.teste.iniciar();
    await Promise.resolve();
    atual = 'irmao';
    await t.teste.trocarEfeito();
    expect(cadeias.map((c) => c.nome)).toEqual(['locutor', 'irmao']);
    expect(cadeias[0]!.desligada, 'a cadeia velha foi desligada').toBe(1);
    expect(t.ganhoNo().destinos).toContain(cadeias[1]!.entrada);
    expect(t.ganhoNo().destinos).not.toContain(cadeias[0]!.entrada);
    atual = 'normal';
    await t.teste.trocarEfeito();
    expect(cadeias[1]!.desligada).toBe(1);
    expect(t.ganhoNo().destinos).toContain(t.estado.volta);
  });

  it('um efeito que chega atrasado, depois de outra troca, é descartado e desligado (o último pedido ganha)', async () => {
    let atual: VozEfeito = 'locutor';
    const liberar: (() => void)[] = [];
    const cadeias: ReturnType<typeof cadeiaFalsa>[] = [];
    const t = montar({
      efeito: () => atual,
      cadeiaDeVoz: (_c, efeito) =>
        new Promise((res) => {
          liberar.push(() => {
            const c = cadeiaFalsa(efeito);
            cadeias.push(c);
            res(c as unknown as CadeiaDeVoz);
          });
        }),
    });
    await t.teste.iniciar();
    atual = 'irmao';
    const troca = t.teste.trocarEfeito();
    liberar[1]!(); // o segundo pedido (irmão) chega primeiro
    await troca;
    liberar[0]!(); // o primeiro (locutor), atrasado
    await Promise.resolve();
    await Promise.resolve();
    expect(cadeias.map((c) => c.nome)).toEqual(['irmao', 'locutor']);
    expect(cadeias[1]!.desligada, 'o atrasado é desligado, não ligado').toBe(1);
    expect(t.ganhoNo().destinos).toContain(cadeias[0]!.entrada);
    expect(t.ganhoNo().destinos).not.toContain(cadeias[1]!.entrada);
  });

  it('um efeito que não baixa deixa a prévia com a voz pura (e sem erro)', async () => {
    const t = montar({ efeito: () => 'sombrio', cadeiaDeVoz: async () => { throw new Error('sem rede'); } });
    await t.teste.iniciar();
    await Promise.resolve();
    await Promise.resolve();
    expect(t.ganhoNo().destinos).toContain(t.estado.volta);
    expect(t.teste.rodando).toBe(true);
  });

  it('parar desliga a cadeia, e um efeito que chega depois de parar não liga nada', async () => {
    const cadeias: ReturnType<typeof cadeiaFalsa>[] = [];
    const liberar: (() => void)[] = [];
    const t = montar({
      efeito: () => 'sombrio',
      cadeiaDeVoz: (_c, efeito) =>
        new Promise((res) => {
          liberar.push(() => {
            const c = cadeiaFalsa(efeito);
            cadeias.push(c);
            res(c as unknown as CadeiaDeVoz);
          });
        }),
    });
    await t.teste.iniciar();
    t.teste.parar(); // parou com o efeito ainda baixando
    liberar[0]!();
    await Promise.resolve();
    await Promise.resolve();
    expect(cadeias[0]!.desligada, 'chegou depois de parar: desligada na hora').toBe(1);
    expect(t.ganhoNo().destinos).not.toContain(cadeias[0]!.entrada);

    const t2 = montar({ efeito: () => 'irmao', cadeiaDeVoz: async (_c, e) => { const c = cadeiaFalsa(e); cadeias.push(c); return c as unknown as CadeiaDeVoz; } });
    await t2.teste.iniciar();
    await Promise.resolve();
    const c2 = cadeias[1]!;
    t2.teste.parar();
    expect(c2.desligada).toBe(1);
  });
});

describe('MicTest: o ganho do microfone e a dica (P237)', () => {
  it('o ganho do jogador entra entre o microfone e tudo: a barra, a prévia e o efeito saem dele; a fonte só alimenta o ganho', async () => {
    const t = montar({ ganho: () => 2.5 });
    await t.teste.iniciar();
    expect(t.ganhoNo().gain.value).toBe(2.5);
    expect(t.fonte.destinos, 'o microfone cru só vai ao ganho').toEqual([t.ganhoNo()]);
    expect(t.ganhoNo().destinos).toContain(t.analyser);
    expect(t.ganhoNo().destinos).toContain(t.estado.volta);
  });

  it('mexer no ganho com o teste ligado vale na hora, sem reiniciar', async () => {
    const t = montar({ ganho: () => 1 });
    await t.teste.iniciar();
    t.teste.setGanho(3);
    expect(t.ganhoNo().gain.value).toBe(3);
    t.teste.setGanho(0.5);
    expect(t.ganhoNo().gain.value).toBe(0.5);
  });

  it('voz captada mas baixa: a dica sugere o ganho; voz boa não sugere nada; no máximo não há o que subir', async () => {
    const t = montar({ ganho: () => 1 });
    await t.teste.iniciar();
    t.estado.amp = 0.028; // RMS ~ 0,02: captada (passa de 0,008) mas baixa (o alvo é 0,1)
    t.estado.agora = 300;
    t.quadro();
    expect(t.pecas.dica!.textContent).toBe('Voz baixa: suba o ganho do microfone para x4.0.');
    t.teste.setGanho(4);
    t.quadro();
    expect(t.pecas.dica!.textContent, 'já no máximo: nada a sugerir').toBe('');
    const b = montar({ ganho: () => 1 });
    await b.teste.iniciar();
    b.estado.amp = 0.2; // RMS ~ 0,14: já está boa
    b.estado.agora = 300;
    b.quadro();
    expect(b.pecas.dica!.textContent).toBe('');
  });

  it('sem voz (só o chiado) não há dica; e a dica some ao parar o teste', async () => {
    const t = montar({ ganho: () => 1 });
    await t.teste.iniciar();
    t.estado.amp = 0.0005;
    t.estado.agora = 300;
    t.quadro();
    expect(t.pecas.dica!.textContent).toBe('');
    t.estado.amp = 0.028;
    t.quadro();
    expect(t.pecas.dica!.textContent).not.toBe('');
    t.teste.parar();
    expect(t.pecas.dica!.textContent).toBe('');
  });

  it('depois de mexer no ganho a sugestão continua coerente: o pico visto até ali é reescalado (sem isso sugeriria o valor do ganho velho)', async () => {
    const t = montar({ ganho: () => 1 });
    await t.teste.iniciar();
    t.estado.amp = 0.07; // RMS ~ 0,0495 com o ganho 1: sugere x2.0
    t.estado.agora = 300;
    t.quadro();
    expect(t.pecas.dica!.textContent).toBe('Voz baixa: suba o ganho do microfone para x2.0.');
    t.teste.setGanho(1.5); // o pico visto (0,0495) passa a valer 0,074: o ideal continua sendo x2.0 (sem reescalar daria x3.0)
    t.quadro();
    expect(t.pecas.dica!.textContent).toBe('Voz baixa: suba o ganho do microfone para x2.0.');
  });
});
