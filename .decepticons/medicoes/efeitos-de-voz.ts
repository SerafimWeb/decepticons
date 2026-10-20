import { criarCadeiaDeVoz, criarDeslocadorDeTom, PREDEFINICOES_DE_VOZ, type PredefinicaoDeVoz, razaoDeSemitons } from '../../client/src/voice/EfeitosDeVoz';

/**
 * A página da bancada `efeitos-de-voz.mjs`: renderiza cada efeito de voz **de verdade** (os mesmos nós do jogo) num `OfflineAudioContext` do Chrome, com sinais de teste conhecidos, e devolve o que
 * se mede: o tom (varredura de Goertzel), o nível por frequência, o pico, a cauda da reverberação, o eco, a latência e a velocidade de renderização. Quem decide aprovado ou reprovado é o `.mjs`.
 */
const SR = 48000;
const NOMES = Object.keys(PREDEFINICOES_DE_VOZ) as PredefinicaoDeVoz[];

const db = (x: number) => 20 * Math.log10(Math.max(x, 1e-9));
const rms = (x: Float32Array, de: number, ate: number) => {
  let s = 0;
  for (let i = de; i < ate; i++) s += x[i]! * x[i]!;
  return Math.sqrt(s / Math.max(1, ate - de));
};
const pico = (x: Float32Array) => {
  let p = 0;
  for (const v of x) if (Math.abs(v) > p) p = Math.abs(v);
  return p;
};

/**
 * A frequência de um trecho [de, ate) em [lo, hi] Hz (Goertzel com janela de Hann, passo de 0,5 Hz): o pico e o **centroide** (a média ponderada pela potência, só dos pontos com pelo menos 5% do pico).
 * O centroide é o que vale para o tom: o cruzamento das duas vozes do deslocador cria bandas laterais a ±10 Hz, e o pico às vezes cai numa delas (260 Hz para um tom de 250), mas elas são simétricas.
 */
function frequenciaDominante(x: Float32Array, de: number, ate: number, lo: number, hi: number): { pico: number; centroide: number } {
  const n = ate - de;
  const janela = new Float32Array(n);
  for (let i = 0; i < n; i++) janela[i] = x[de + i]! * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  let melhor = lo;
  let potencia = -1;
  const pontos: { f: number; p: number }[] = [];
  for (let f = lo; f <= hi; f += 0.5) {
    const w = (2 * Math.PI * f) / SR;
    const coef = 2 * Math.cos(w);
    let s1 = 0;
    let s2 = 0;
    for (let i = 0; i < n; i++) {
      const s0 = janela[i]! + coef * s1 - s2;
      s2 = s1;
      s1 = s0;
    }
    const p = s1 * s1 + s2 * s2 - coef * s1 * s2;
    pontos.push({ f, p });
    if (p > potencia) {
      potencia = p;
      melhor = f;
    }
  }
  let soma = 0;
  let pesos = 0;
  for (const { f, p } of pontos) {
    if (p < potencia * 0.05) continue;
    soma += f * p;
    pesos += p;
  }
  return { pico: melhor, centroide: pesos > 0 ? soma / pesos : melhor };
}

/** Renderiza `fonte → [o que `montar` ligar] → saída` e devolve a onda. `montar` recebe o contexto e o nó de entrada, e devolve o nó de saída. */
async function renderizar(duracao: number, gerar: (ctx: OfflineAudioContext) => AudioNode, montar: (ctx: OfflineAudioContext, entrada: AudioNode) => { saida: AudioNode; desligar?: () => void }): Promise<Float32Array> {
  const ctx = new OfflineAudioContext(1, Math.round(duracao * SR), SR);
  const fonte = gerar(ctx);
  const m = montar(ctx, fonte);
  m.saida.connect(ctx.destination);
  const buf = await ctx.startRendering();
  return buf.getChannelData(0).slice();
}

/** Um seno de `hz` e amplitude `amp` que começa em `inicio` segundos. */
const seno = (hz: number, amp: number, inicio = 0) => (ctx: OfflineAudioContext) => {
  const o = ctx.createOscillator();
  o.frequency.value = hz;
  const g = ctx.createGain();
  g.gain.value = amp;
  o.connect(g);
  o.start(inicio);
  return g;
};

/** Ruído branco determinístico de `amp`, ligado de `inicio` a `fim` segundos. */
const ruido = (amp: number, inicio: number, fim: number) => (ctx: OfflineAudioContext) => {
  const n = Math.round(ctx.length);
  const b = ctx.createBuffer(1, n, SR);
  const d = b.getChannelData(0);
  let s = 12345;
  for (let i = Math.round(inicio * SR); i < Math.min(n, Math.round(fim * SR)); i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    d[i] = ((s / 4294967296) * 2 - 1) * amp;
  }
  const f = ctx.createBufferSource();
  f.buffer = b;
  f.start(0);
  return f;
};

const cadeia = (efeito: PredefinicaoDeVoz, soFiltros = false) => (ctx: OfflineAudioContext, entrada: AudioNode) => {
  // `soFiltros`: os mesmos números da predefinição, sem a reverberação (a resposta de frequência dela é aleatória, ±4 dB por frequência) e sem o deslocador de tom (as duas vozes cruzadas somam em fase
  // diferente a cada frequência e ondulam o ganho dos graves em ±4 dB): sobra o que se quer medir, os filtros, a distorção e o compressor
  const c = criarCadeiaDeVoz(ctx, efeito, soFiltros ? { ...PREDEFINICOES_DE_VOZ[efeito], reverb: null, semitons: 0 } : undefined)!;
  entrada.connect(c.entrada);
  return { saida: c.saida };
};

(window as unknown as { __medir: unknown }).__medir = async () => {
  const saida: Record<string, unknown> = {};

  // 1. o tom do deslocador sozinho: um seno de 500 Hz deve sair em 500 × razão
  const tom: { semitons: number; esperado: number; medido: number; pico: number }[] = [];
  for (const semitons of [-12, -7, -5, -3, 3]) {
    const onda = await renderizar(
      2,
      seno(500, 0.5),
      (ctx, entrada) => {
        const d = criarDeslocadorDeTom(ctx, semitons, { nos: [], fontes: [] });
        entrada.connect(d.entrada);
        return { saida: d.saida };
      },
    );
    const esperado = 500 * razaoDeSemitons(semitons);
    const f = frequenciaDominante(onda, Math.round(0.5 * SR), Math.round(1.5 * SR), esperado * 0.7, esperado * 1.3);
    tom.push({ semitons, esperado, medido: f.centroide, pico: f.pico });
  }
  saida.tom = tom;

  // 2. o nível de cada efeito em vários tons (amplitude 0,2): dB de saída, e onde caiu a frequência dominante
  const niveis: Record<string, { entradaHz: number; db: number; dominanteHz: number }[]> = {};
  const lineares: Record<string, { entradaHz: number; db: number }[]> = {};
  for (const nome of NOMES) {
    niveis[nome] = [];
    lineares[nome] = [];
    for (const hz of [100, 200, 500, 1000, 3000, 6000]) {
      // A resposta LINEAR dos filtros: um tom a -54 dBFS, abaixo do limiar de todos os compressores. A volume alto o compressor nivela tudo (é o que ele faz com a voz), e escondia os filtros.
      const fraco = await renderizar(1.6, seno(hz, 0.002), cadeia(nome, true));
      lineares[nome]!.push({ entradaHz: hz, db: db(rms(fraco, Math.round(0.6 * SR), Math.round(1.5 * SR))) });
      const onda = await renderizar(1.6, seno(hz, 0.2), cadeia(nome));
      const de = Math.round(0.6 * SR);
      const ate = Math.round(1.5 * SR);
      niveis[nome]!.push({ entradaHz: hz, db: db(rms(onda, de, ate)), dominanteHz: frequenciaDominante(onda, de, Math.round(1.1 * SR), hz * 0.3, hz * 1.4).centroide });
    }
  }
  saida.niveis = niveis;
  saida.lineares = lineares;

  // 3. o pico com entrada quase no teto: seno de 300 Hz a 0,9 e ruído a 0,9 (nunca pode passar de 1)
  const picos: Record<string, { seno: number; ruido: number }> = {};
  for (const nome of NOMES) {
    const s = await renderizar(1.5, seno(300, 0.9), cadeia(nome));
    const r = await renderizar(1.5, ruido(0.9, 0.2, 1.3), cadeia(nome));
    picos[nome] = { seno: pico(s), ruido: pico(r) };
  }
  saida.picos = picos;

  // 4. a cauda: um estouro de ruído de 0,3 s a 0,3 de amplitude e depois silêncio; a energia em 0,6 a 1,0 s depois do fim, relativa ao ruído
  const caudas: Record<string, number> = {};
  for (const nome of NOMES) {
    const onda = await renderizar(3, ruido(0.3, 0.2, 0.5), cadeia(nome));
    const durante = rms(onda, Math.round(0.25 * SR), Math.round(0.5 * SR));
    const cauda = rms(onda, Math.round(1.1 * SR), Math.round(1.5 * SR)); // 0,6 a 1,0 s depois de 0,5
    caudas[nome] = db(cauda) - db(durante);
  }
  saida.caudas = caudas;

  // 5. o eco do locutor: a autocorrelação do ruído no atraso do eco (42 ms) contra atrasos vizinhos
  {
    const onda = await renderizar(2, ruido(0.3, 0.2, 1.6), cadeia('locutor'));
    const de = Math.round(0.5 * SR);
    const ate = Math.round(1.5 * SR);
    const r = (lag: number) => {
      let s = 0;
      let e = 0;
      for (let i = de; i < ate; i++) {
        s += onda[i]! * onda[i - lag]!;
        e += onda[i]! * onda[i]!;
      }
      return s / e;
    };
    const lagEco = Math.round(PREDEFINICOES_DE_VOZ.locutor.eco!.atraso * SR);
    const vizinhos = [lagEco - 480, lagEco - 240, lagEco + 240, lagEco + 480].map((l) => Math.abs(r(l)));
    saida.eco = { noAtraso: r(lagEco), vizinhoMaximo: Math.max(...vizinhos) };
  }

  // 6. a latência: um seno que começa em 0,5 s; quando a saída passa de 0,02
  const latencia: Record<string, number> = {};
  for (const nome of NOMES) {
    const onda = await renderizar(2, seno(400, 0.3, 0.5), cadeia(nome));
    let i = Math.round(0.45 * SR);
    while (i < onda.length && Math.abs(onda[i]!) < 0.02) i++;
    latencia[nome] = i / SR - 0.5;
  }
  saida.latencia = latencia;

  // 7. o custo: quantas vezes mais rápido que o tempo real o navegador renderiza (10 s de áudio)
  const velocidade: Record<string, number> = {};
  for (const nome of NOMES) {
    // O melhor de 3 renderizações: a máquina é compartilhada (outras sessões, o navegador, o antivírus) e a velocidade de uma rodada só varia de 5x a 60x conforme a carga do momento.
    let melhor = 0;
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      await renderizar(10, ruido(0.2, 0, 10), cadeia(nome));
      melhor = Math.max(melhor, 10000 / (performance.now() - t0));
    }
    velocidade[nome] = melhor;
  }
  saida.velocidade = velocidade;
  return saida;
};
