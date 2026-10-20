import type { VozEfeito } from '../core/Settings';

/**
 * OS EFEITOS NA VOZ (P231, ordem do Comandante em 20/10: "teria como inserirmos efeitos na minha voz? falar tipo voz de locutor militar russo, ou tipo o darth vader, ou outra voz mais imponente
 * (tipo o big brother)?"). Uma cadeia de áudio do navegador (Web Audio) entre o microfone e o destino: **muda o tom, o grave, o ambiente e a pressão da voz; não muda o sotaque** (ninguém vira russo
 * por filtro, o que dá é o timbre de rádio e de alto-falante). Vale na narração (F10) e na prévia do teste do microfone; o chat de voz não usa (decisão aberta do Comandante).
 *
 * Pedaço sob demanda (a dieta de JS, P187): só baixa quem escolhe um efeito. Custo: **zero fora da narração e do teste**; ligada, é uma dúzia de nós de áudio no fio do navegador (o deslocador de tom
 * são dois atrasos modulados; a reverberação é uma convolução de ~1 s, a parte mais cara, só nas predefinições que a usam). A voz chega **~12 ms depois** com o tom mudado (o atraso médio dos dois
 * atrasos), imperceptível numa gravação.
 *
 * Sem DOM e sem estado global: recebe qualquer `BaseAudioContext`, então a bancada mede o resultado num `OfflineAudioContext` (`medicoes/efeitos-de-voz.mjs`: tom, filtros, reverberação e pico).
 */

/** A cadeia pronta: liga a fonte em `entrada`, ouve `saida`, e `desligar()` para os geradores e solta os nós (a gravação e o teste chamam ao parar). */
export interface CadeiaDeVoz {
  entrada: AudioNode;
  saida: AudioNode;
  desligar(): void;
}

export type PredefinicaoDeVoz = Exclude<VozEfeito, 'normal'>;

/** Tudo o que distingue uma predefinição da outra, em dados: o teste confere cada faixa de valor. */
export interface ParametrosDaVoz {
  /** Mudança de tom em semitons (negativo = mais grave); 0 = não mexe no tom. */
  semitons: number;
  /** Filtros de timbre, em Hz (0 = sem o filtro). */
  passaAltas: number;
  passaBaixas: number;
  /** Realce dos graves (prateleira baixa) e da presença (sino), em dB. */
  graves: { hz: number; db: number } | null;
  presenca: { hz: number; db: number; q: number } | null;
  /** Força da distorção suave (0 = nenhuma): dá o "chiado" de rádio e o metal. */
  distorcao: number;
  /** O compressor que dá a pressão de quem fala "em ordem": limiar em dB, razão, ataque e soltura em segundos. */
  compressor: { limiar: number; razao: number; ataque: number; soltura: number };
  /** Eco curto de alto-falante: atraso em segundos e quanto volta (0 a 1). */
  eco: { atraso: number; ganho: number } | null;
  /** O ambiente: tamanho da sala em segundos, quantos dB a cauda cai até o fim, e quanto entra na mistura (0 a 1). */
  reverb: { duracao: number; quedaDb: number; mistura: number } | null;
}

/** O nome na interface é neutro de propósito (jogo público): "sombrio" é o grave metálico de vilão; "irmao", a voz de telão que manda e ecoa. */
export const PREDEFINICOES_DE_VOZ: Readonly<Record<PredefinicaoDeVoz, Readonly<ParametrosDaVoz>>> = Object.freeze({
  // Rádio e alto-falante: banda de telefone, presença no meio, um pouco de distorção, compressor firme e o eco curto da praça.
  locutor: {
    semitons: 0,
    passaAltas: 280,
    passaBaixas: 3600,
    graves: null,
    presenca: { hz: 1800, db: 5, q: 0.9 },
    distorcao: 1.5,
    compressor: { limiar: -30, razao: 10, ataque: 0.003, soltura: 0.12 },
    eco: { atraso: 0.042, ganho: 0.22 },
    reverb: null,
  },
  // Grave de vilão: cinco semitons abaixo, graves fortes, metal e uma sala curta e dura.
  sombrio: {
    semitons: -5,
    passaAltas: 60,
    passaBaixas: 4500,
    graves: { hz: 220, db: 7 },
    presenca: null,
    distorcao: 0.8,
    compressor: { limiar: -26, razao: 6, ataque: 0.004, soltura: 0.2 },
    eco: null,
    reverb: { duracao: 0.45, quedaDb: 40, mistura: 0.16 },
  },
  // A voz do telão: três semitons abaixo, compressão pesada (volume parelho, "de cima") e um salão grande.
  irmao: {
    semitons: -3,
    passaAltas: 80,
    passaBaixas: 7000,
    graves: { hz: 160, db: 5 },
    presenca: { hz: 2500, db: 2, q: 0.7 },
    distorcao: 0,
    compressor: { limiar: -36, razao: 14, ataque: 0.002, soltura: 0.25 },
    eco: null,
    reverb: { duracao: 1.4, quedaDb: 50, mistura: 0.35 },
  },
});

/** O tempo de uma volta da rampa do deslocador e a parte dela que é cruzada entre as duas vozes (Chris Wilson, "Jungle"). */
const RAMPA_S = 0.1;
const CRUZAMENTO_S = 0.05;

/** A razão de frequência de uma mudança em semitons (−12 = metade). */
export const razaoDeSemitons = (semitons: number): number => 2 ** (semitons / 12);

/**
 * A curva do distorcedor (suave, ímpar, passa por zero e termina em ±1): `tanh(x·drive) / tanh(drive)`. `drive` ≤ 0 devolve a reta (nada muda). Pura: o teste confere a forma.
 */
export function curvaDeDistorcao(drive: number, pontos = 1024): Float32Array<ArrayBuffer> {
  const curva = new Float32Array(pontos);
  const norma = drive > 0 ? Math.tanh(drive) : 1;
  for (let i = 0; i < pontos; i++) {
    const x = (i / (pontos - 1)) * 2 - 1;
    curva[i] = drive > 0 ? Math.tanh(x * drive) / norma : x;
  }
  return curva;
}

/**
 * O ruído da resposta ao impulso da reverberação: aleatório com semente (o mesmo som a cada vez, e testável), que cai `quedaDb` dB do começo ao fim, alisado por um filtro de um polo (sem
 * o chiado agudo de ruído branco puro). A convolução do navegador normaliza o volume (`normalize`), então só a forma da cauda importa aqui.
 */
export function ruidoDaReverberacao(amostras: number, quedaDb: number, semente: number): Float32Array<ArrayBuffer> {
  const ruido = new Float32Array(amostras);
  let s = semente >>> 0 || 1;
  let y = 0;
  for (let i = 0; i < amostras; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const x = (s / 4294967296) * 2 - 1;
    y += (x - y) * 0.45;
    ruido[i] = y * 10 ** ((-quedaDb * (i / amostras)) / 20);
  }
  return ruido;
}

/** Os nós de uma cadeia, para o `desligar` soltar todos. */
interface Pecas {
  nos: AudioNode[];
  fontes: AudioScheduledSourceNode[];
}

/**
 * O deslocador de tom (o truque do "Jungle"): dois atrasos cujo tempo sobe (tom mais grave) ou desce (mais agudo) em rampa, e um cruzamento de potência entre eles esconde a emenda da rampa.
 * Atrasar cada vez mais devagar = som mais grave: a razão de tom é `1 − (taxa de subida do atraso)`, e a taxa é a profundidade da rampa. Tem o chiado granulado clássico, que num efeito de
 * vilão ajuda. Exportado para a bancada medir o tom sozinho.
 */
export function criarDeslocadorDeTom(ctx: BaseAudioContext, semitons: number, pecas: Pecas): { entrada: AudioNode; saida: AudioNode } {
  const razao = razaoDeSemitons(semitons);
  const profundidade = Math.abs(1 - razao);
  const subir = razao > 1;
  const n = Math.round(RAMPA_S * ctx.sampleRate);
  const meio = Math.round(CRUZAMENTO_S * ctx.sampleRate);
  const rampa = ctx.createBuffer(1, n, ctx.sampleRate);
  const fade = ctx.createBuffer(1, n, ctx.sampleRate);
  const r = rampa.getChannelData(0);
  const f = fade.getChannelData(0);
  for (let i = 0; i < n; i++) {
    r[i] = subir ? 1 - i / n : i / n;
    f[i] = i < meio ? Math.sqrt(i / meio) : Math.sqrt(Math.max(0, 1 - (i - meio) / (n - meio)));
  }
  const entrada = ctx.createGain();
  const saida = ctx.createGain();
  pecas.nos.push(entrada, saida);
  const t0 = ctx.currentTime + 0.01;
  for (let voz = 0; voz < 2; voz++) {
    const atraso = ctx.createDelay(1);
    const profundidadeDoAtraso = ctx.createGain();
    profundidadeDoAtraso.gain.value = profundidade * RAMPA_S;
    const fonteDaRampa = ctx.createBufferSource();
    fonteDaRampa.buffer = rampa;
    fonteDaRampa.loop = true;
    fonteDaRampa.connect(profundidadeDoAtraso);
    profundidadeDoAtraso.connect(atraso.delayTime);
    const cruzamento = ctx.createGain();
    cruzamento.gain.value = 0;
    const fonteDoFade = ctx.createBufferSource();
    fonteDoFade.buffer = fade;
    fonteDoFade.loop = true;
    fonteDoFade.connect(cruzamento.gain);
    entrada.connect(atraso);
    atraso.connect(cruzamento);
    cruzamento.connect(saida);
    const inicio = t0 + voz * (RAMPA_S - CRUZAMENTO_S);
    fonteDaRampa.start(inicio);
    fonteDoFade.start(inicio);
    pecas.nos.push(atraso, profundidadeDoAtraso, cruzamento, fonteDaRampa, fonteDoFade); // os geradores também são soltos, não só parados
    pecas.fontes.push(fonteDaRampa, fonteDoFade);
  }
  return { entrada, saida };
}

/**
 * Monta a cadeia de um efeito: [deslocador de tom] → passa-altas → passa-baixas → graves → presença → distorção → compressor → (seco + eco + reverberação) → limitador. `normal` devolve `null`
 * (sem cadeia: o chamador liga a fonte direto). O **limitador** no fim garante que graves e distorção nunca estourem o volume da gravação. Qualquer contexto de áudio serve (o de verdade e o offline).
 * `parametros` troca os números da predefinição (a bancada mede o filtro sem a reverberação aleatória; afinar uma voz também começa por aqui).
 */
export function criarCadeiaDeVoz(ctx: BaseAudioContext, efeito: VozEfeito, parametros?: Readonly<ParametrosDaVoz>): CadeiaDeVoz | null {
  if (efeito === 'normal') return null;
  const p = parametros ?? PREDEFINICOES_DE_VOZ[efeito];
  const pecas: Pecas = { nos: [], fontes: [] };
  const entrada = ctx.createGain();
  pecas.nos.push(entrada);
  let ponta: AudioNode = entrada;
  const ligar = <T extends AudioNode>(no: T): T => {
    ponta.connect(no);
    pecas.nos.push(no);
    ponta = no;
    return no;
  };

  if (p.semitons !== 0) {
    const d = criarDeslocadorDeTom(ctx, p.semitons, pecas);
    ponta.connect(d.entrada);
    ponta = d.saida;
  }
  if (p.passaAltas > 0) {
    const f = ligar(ctx.createBiquadFilter());
    f.type = 'highpass';
    f.frequency.value = p.passaAltas;
    f.Q.value = 0.7;
  }
  if (p.passaBaixas > 0) {
    const f = ligar(ctx.createBiquadFilter());
    f.type = 'lowpass';
    f.frequency.value = p.passaBaixas;
    f.Q.value = 0.7;
  }
  if (p.graves) {
    const f = ligar(ctx.createBiquadFilter());
    f.type = 'lowshelf';
    f.frequency.value = p.graves.hz;
    f.gain.value = p.graves.db;
  }
  if (p.presenca) {
    const f = ligar(ctx.createBiquadFilter());
    f.type = 'peaking';
    f.frequency.value = p.presenca.hz;
    f.Q.value = p.presenca.q;
    f.gain.value = p.presenca.db;
  }
  if (p.distorcao > 0) {
    const w = ligar(ctx.createWaveShaper());
    w.curve = curvaDeDistorcao(p.distorcao);
    w.oversample = '2x';
  }
  const c = ligar(ctx.createDynamicsCompressor());
  c.threshold.value = p.compressor.limiar;
  c.knee.value = 12;
  c.ratio.value = p.compressor.razao;
  c.attack.value = p.compressor.ataque;
  c.release.value = p.compressor.soltura;

  // O seco, o eco e a reverberação somam numa mistura só.
  const mistura = ctx.createGain();
  pecas.nos.push(mistura);
  ponta.connect(mistura);
  if (p.eco) {
    const atraso = ctx.createDelay(1);
    atraso.delayTime.value = p.eco.atraso;
    const volta = ctx.createGain();
    volta.gain.value = p.eco.ganho;
    ponta.connect(atraso);
    atraso.connect(volta);
    volta.connect(mistura);
    pecas.nos.push(atraso, volta);
  }
  if (p.reverb) {
    const amostras = Math.round(p.reverb.duracao * ctx.sampleRate);
    // Resposta MONO: a voz do microfone é mono, e uma resposta de dois canais dobraria o custo da convolução sem ganho audível.
    const resposta = ctx.createBuffer(1, amostras, ctx.sampleRate);
    resposta.getChannelData(0).set(ruidoDaReverberacao(amostras, p.reverb.quedaDb, 0x9e3779b9));
    const sala = ctx.createConvolver();
    sala.buffer = resposta;
    const molhado = ctx.createGain();
    molhado.gain.value = p.reverb.mistura;
    ponta.connect(sala);
    sala.connect(molhado);
    molhado.connect(mistura);
    pecas.nos.push(sala, molhado);
  }

  // O limitador: um compressor de razão alta perto do teto. Sem ele, o realce dos graves e a distorção estouram a gravação.
  const limitador = ctx.createDynamicsCompressor();
  limitador.threshold.value = -3;
  limitador.knee.value = 0;
  limitador.ratio.value = 20;
  limitador.attack.value = 0.001;
  limitador.release.value = 0.08;
  mistura.connect(limitador);
  pecas.nos.push(limitador);

  return {
    entrada,
    saida: limitador,
    desligar() {
      for (const fonte of pecas.fontes) {
        try {
          fonte.stop();
        } catch {
          // já parou
        }
      }
      for (const no of pecas.nos) {
        try {
          no.disconnect();
        } catch {
          // já solto
        }
      }
      pecas.fontes.length = 0;
      pecas.nos.length = 0;
    },
  };
}
