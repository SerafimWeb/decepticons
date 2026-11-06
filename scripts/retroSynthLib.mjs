/**
 * O sintetizador retrô do Estúdio (P316): gera, por código, candidatos de som no espírito dos videogames e da música eletrônica dos anos 80 e 90, para o Comandante
 * auditionar no Estúdio (aba SONS) e escolher o que vira o som de cada arma, aviso e comando.
 *
 * **Só técnicas, nunca amostras nem melodias de ninguém:** o canal de ruído de 15 bits dos consoles de 8 bits, as ondas de pulso (com *duty*), triângulo e serra,
 * o bitcrush, o bumbo de varredura de seno das caixas de ritmo e a distorção dos sintetizadores do rave. Tudo original, determinístico (a mesma receita dá os mesmos
 * bytes: sem `Math.random`) e puro: o teste mede o que sai (pico, duração, silêncio, NaN) sem tocar nada. O comando é `scripts/sons-retro.mjs` (`npm run sons-retro`).
 *
 * O Claude não ouve: o que este módulo garante é que o som é **seguro** (finito, sem estourar, sem silêncio, com a duração certa) e **diferente entre as leituras**; o gosto é do
 * ouvido do Comandante.
 */

export const TAXA = 44100;
const N = (s) => Math.max(1, Math.round(s * TAXA));
const dois_pi = 2 * Math.PI;

// ── geradores ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** O canal de ruído dos 8 bits: um registrador de 15 bits que realimenta o bit 1 (ruído) ou o bit 6 (metálico, curto). `hz(t)` é a taxa em que o valor muda. Sai ±1. */
function ruidoLfsr(hz, modo) {
  let reg = 1;
  let acc = 0;
  let saida = 1;
  const deslocamento = modo === 'curto' ? 6 : 1;
  return (t) => {
    acc += (typeof hz === 'function' ? hz(t) : hz) / TAXA;
    while (acc >= 1) {
      acc -= 1;
      const bit = (reg ^ (reg >> deslocamento)) & 1;
      reg = (reg >> 1) | (bit << 14);
      saida = reg & 1 ? -1 : 1;
    }
    return saida;
  };
}

const ONDAS = {
  pulse: (fase, duty) => (fase % 1 < duty ? 1 : -1),
  tri: (fase) => 4 * Math.abs((fase % 1) - 0.5) - 1,
  saw: (fase) => 2 * (fase % 1) - 1,
  sine: (fase) => Math.sin(dois_pi * fase),
};

/** Uma voz: `dur` segundos de uma onda cuja frequência (número ou função do tempo) e cuja amplitude (função do tempo) o chamador dita. */
export function voz({ dur, onda = 'pulse', duty = 0.5, freq, amp = () => 1 }) {
  const n = N(dur);
  const saida = new Float32Array(n);
  let fase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / TAXA;
    fase += (typeof freq === 'function' ? freq(t) : freq) / TAXA;
    saida[i] = ONDAS[onda](fase, duty) * amp(t);
  }
  return saida;
}

/** Ruído de `dur` segundos (canal de 15 bits), com amplitude função do tempo e a taxa `hz` (número ou função do tempo). */
export function ruido({ dur, hz = 8000, modo = 'longo', amp = () => 1 }) {
  const n = N(dur);
  const saida = new Float32Array(n);
  const gerar = ruidoLfsr(hz, modo);
  for (let i = 0; i < n; i++) saida[i] = gerar(i / TAXA) * amp(i / TAXA);
  return saida;
}

// ── envelopes e varreduras (funções do tempo) ────────────────────────────────────────────────────────────────────────────────────────────
export const decaimento = (tau) => (t) => Math.exp(-t / tau);
export const ataqueDecaimento = (ataque, tau) => (t) => (t < ataque ? t / ataque : Math.exp(-(t - ataque) / tau));
/** Varredura exponencial de `f0` a `f1` em `dur` segundos (depois fica em `f1`): a curva do "pew" e do bumbo. */
export const varredura = (f0, f1, dur) => (t) => f0 * Math.pow(f1 / f0, Math.min(t, dur) / dur);
/** Segura a amplitude em 1 até `ate` e some em seguida (porta). */
export const porta = (ate) => (t) => (t < ate ? 1 : 0);

// ── efeitos ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Bitcrush: `bits` de resolução e uma amostra segurada por `segura` (o som "de 8 bits" que nasce da perda). */
export function bitcrush(x, bits, segura = 1) {
  const passos = 2 ** (bits - 1);
  const saida = new Float32Array(x.length);
  let ultima = 0;
  for (let i = 0; i < x.length; i++) {
    if (i % segura === 0) ultima = Math.round(x[i] * passos) / passos;
    saida[i] = ultima;
  }
  return saida;
}

/** Distorção suave (tangente hiperbólica), com ganho unitário em ±1 e o resultado sempre limitado a ±1: o dente de serra do rave e o punch do bumbo. */
export function distorcer(x, ganho) {
  const norma = Math.tanh(ganho);
  return x.map((v) => Math.max(-1, Math.min(1, Math.tanh(v * ganho) / norma)));
}

/** Passa-baixa de um polo, com a frequência de corte função do tempo (o filtro que abre e fecha o "whoosh"). */
export function passaBaixa(x, fc) {
  const saida = new Float32Array(x.length);
  let y = 0;
  for (let i = 0; i < x.length; i++) {
    const f = typeof fc === 'function' ? fc(i / TAXA) : fc;
    y += (1 - Math.exp((-dois_pi * f) / TAXA)) * (x[i] - y);
    saida[i] = y;
  }
  return saida;
}

export function passaAlta(x, fc) {
  const baixo = passaBaixa(x, fc);
  return x.map((v, i) => v - baixo[i]);
}

/** Eco com realimentação: o sinal atrasado `ms`, que volta `fb` de si mesmo a cada repetição, somado ao seco na proporção `mix`. A cauda cabe em seis atrasos. */
export function eco(x, ms, fb, mix) {
  const atraso = N(ms / 1000);
  const comprimento = x.length + atraso * 6;
  const molhado = new Float32Array(comprimento);
  for (let i = atraso; i < comprimento; i++) molhado[i] = (i - atraso < x.length ? x[i - atraso] : 0) + fb * molhado[i - atraso];
  const saida = new Float32Array(comprimento);
  for (let i = 0; i < comprimento; i++) saida[i] = (i < x.length ? x[i] : 0) + mix * molhado[i];
  return saida;
}

/** Soma camadas, cada uma com o seu atraso (s) e ganho. O resultado tem o comprimento da camada que termina por último. */
export function somar(camadas) {
  const fim = Math.max(...camadas.map((c) => N(c.atraso ?? 0) + c.x.length));
  const saida = new Float32Array(fim);
  for (const c of camadas) {
    const ini = N(c.atraso ?? 0);
    const g = c.ganho ?? 1;
    for (let i = 0; i < c.x.length; i++) saida[ini + i] += c.x[i] * g;
  }
  return saida;
}

/** Fade de entrada e de saída (ms): sem clique no começo nem no fim. */
export function fade(x, entradaMs = 1, saidaMs = 8) {
  const saida = Float32Array.from(x);
  const ei = Math.min(N(entradaMs / 1000), saida.length);
  const so = Math.min(N(saidaMs / 1000), saida.length);
  for (let i = 0; i < ei; i++) saida[i] *= i / ei;
  for (let i = 0; i < so; i++) saida[saida.length - 1 - i] *= i / so;
  return saida;
}

/** Leva o pico a `picoDb` dBFS (−1 por padrão). Sinal em silêncio absoluto fica como está. */
export function normalizar(x, picoDb = -1) {
  let pico = 0;
  for (const v of x) pico = Math.max(pico, Math.abs(v));
  if (pico < 1e-9) return x;
  const g = Math.pow(10, picoDb / 20) / pico;
  return x.map((v) => v * g);
}

/** WAV de 16 bits, mono, 44,1 kHz. */
export function emWav(x) {
  const dados = Buffer.alloc(x.length * 2);
  for (let i = 0; i < x.length; i++) dados.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x[i])) * 32767), i * 2);
  const cab = Buffer.alloc(44);
  cab.write('RIFF', 0);
  cab.writeUInt32LE(36 + dados.length, 4);
  cab.write('WAVEfmt ', 8);
  cab.writeUInt32LE(16, 16);
  cab.writeUInt16LE(1, 20);
  cab.writeUInt16LE(1, 22);
  cab.writeUInt32LE(TAXA, 24);
  cab.writeUInt32LE(TAXA * 2, 28);
  cab.writeUInt16LE(2, 32);
  cab.writeUInt16LE(16, 34);
  cab.write('data', 36);
  cab.writeUInt32LE(dados.length, 40);
  return Buffer.concat([cab, dados]);
}

// ── receitas ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const PI2 = dois_pi;
/** Um bumbo de varredura de seno: o "BOOM" das caixas de ritmo, com um clique de ruído no ataque. */
function bumbo({ f0, f1, dur, tau, clique = 0.7, drive = 4 }) {
  const corpo = voz({ dur, onda: 'sine', freq: varredura(f0, f1, dur * 0.8), amp: decaimento(tau) });
  const estalo = ruido({ dur: 0.012, hz: 14000, amp: decaimento(0.004) });
  return distorcer(somar([{ x: corpo }, { x: estalo, ganho: clique }]), drive);
}

/** Um disparo de foguete: o sopro de ruído que abre o filtro, mais o baque do lançador. */
function sopro({ dur, ruidoHz, corte0, corte1, tau, ataque = 0.03 }) {
  const r = ruido({ dur, hz: ruidoHz, amp: ataqueDecaimento(ataque, tau) });
  return passaBaixa(r, varredura(corte0, corte1, dur));
}

const ARPEJO_A_MENOR = [220, 261.63, 329.63, 440, 329.63, 261.63, 220]; // Lá menor: o mesmo tom da música de combate (P315)

// ── a trilha: dois temas de quatro compassos, em Lá menor a 108 BPM (o andamento e o tom da música de combate do jogo, para casarem) ─────────
const BATIDA = 60 / 108;
const SEMICOLCHEIA = BATIDA / 4;
/** A progressão i, VI, III, VII (Lá menor, Fá, Dó, Sol): o baixo de cada compasso e as quatro notas do arpejo. */
const ACORDES = [
  { baixo: 55, arpejo: [220, 261.63, 329.63, 261.63] },
  { baixo: 43.65, arpejo: [174.61, 220, 261.63, 220] },
  { baixo: 65.41, arpejo: [261.63, 329.63, 392, 329.63] },
  { baixo: 49, arpejo: [196, 246.94, 293.66, 246.94] },
];
const nota = (f, onda, duty, dur, tau) => voz({ dur, onda, duty, freq: f, amp: decaimento(tau) });
const bumboDeMusica = (e) => (e === '8bit'
  ? bitcrush(voz({ dur: 0.22, onda: 'tri', freq: varredura(150, 45, 0.18), amp: decaimento(0.09) }), 6, 2)
  : bumbo({ f0: 150, f1: 45, dur: 0.28, tau: 0.1, clique: 0.5, drive: 2 }));
const caixaDeMusica = () => somar([{ x: passaAlta(ruido({ dur: 0.18, hz: 12000, amp: decaimento(0.05) }), 800) }, { x: voz({ dur: 0.12, onda: 'tri', freq: varredura(220, 150, 0.1), amp: decaimento(0.04) }), ganho: 0.5 }]);
const chimbal = () => passaAlta(ruido({ dur: 0.05, hz: 15000, modo: 'curto', amp: decaimento(0.012) }), 6000);

/** Corta ou completa com silêncio até exatamente `dur` segundos: o laço da trilha só fecha se o clipe tiver exatamente os compassos. */
const comprimento = (x, dur) => {
  const saida = new Float32Array(N(dur));
  saida.set(x.subarray(0, saida.length));
  return saida;
};

/** Um tema de menu: bumbo nos tempos, chimbal nos contratempos, baixo em colcheias e um arpejo de pulso em semicolcheias (a lógica de um sequenciador de máquina). */
function temaDeMenu(e) {
  const camadas = [];
  ACORDES.forEach((a, c) => {
    const t0 = c * 4 * BATIDA;
    for (let k = 0; k < 8; k++) camadas.push({ x: nota(a.baixo * (k % 4 === 2 ? 2 : 1), e === '8bit' ? 'tri' : 'saw', 0.5, 0.25, 0.18), atraso: t0 + (k * BATIDA) / 2, ganho: 0.7 });
    for (let k = 0; k < 16; k++) camadas.push({ x: nota(a.arpejo[k % 4], 'pulse', 0.25, 0.12, 0.06), atraso: t0 + k * SEMICOLCHEIA, ganho: 0.35 });
    for (let b = 0; b < 4; b++) {
      camadas.push({ x: bumboDeMusica(e), atraso: t0 + b * BATIDA, ganho: 0.8 });
      camadas.push({ x: chimbal(), atraso: t0 + b * BATIDA + BATIDA / 2, ganho: 0.3 });
    }
  });
  return comprimento(somar(camadas), 16 * BATIDA);
}

/** Um tema de combate: quebra de ritmo (bumbo em 0, 6 e 10; caixa em 4 e 12, nas semicolcheias do compasso), baixo pulsando e um "stab" curto do acorde, a serra distorcida do rave. */
function temaDeCombate(e) {
  const camadas = [];
  ACORDES.forEach((a, c) => {
    const t0 = c * 4 * BATIDA;
    for (const k of [0, 6, 10]) camadas.push({ x: bumboDeMusica(e), atraso: t0 + k * SEMICOLCHEIA });
    for (const k of [4, 12]) camadas.push({ x: caixaDeMusica(), atraso: t0 + k * SEMICOLCHEIA, ganho: 0.7 });
    for (let k = 0; k < 16; k++) camadas.push({ x: chimbal(), atraso: t0 + k * SEMICOLCHEIA, ganho: k % 4 === 2 ? 0.35 : 0.15 });
    for (let k = 0; k < 8; k++) camadas.push({ x: nota(a.baixo * 2, e === '8bit' ? 'pulse' : 'saw', 0.5, 0.2, 0.12), atraso: t0 + (k * BATIDA) / 2, ganho: 0.6 });
    for (const k of [0, 3, 6, 11]) {
      const stab = somar(a.arpejo.slice(0, 3).map((f) => ({ x: nota(f, e === '8bit' ? 'pulse' : 'saw', 0.25, 0.1, 0.05), ganho: 0.5 })));
      camadas.push({ x: e === '8bit' ? bitcrush(stab, 6, 2) : distorcer(stab, 3), atraso: t0 + k * SEMICOLCHEIA, ganho: 0.6 });
    }
  });
  return comprimento(somar(camadas), 16 * BATIDA);
}

/**
 * Cada receita: `id`, `arma` (o id da arma do jogo, ou null para aviso, comando e impacto), `uso`, `referencia` (a técnica que a inspira) e `gerar(estilo)`.
 * `estilo`: `8bit` (pulso, triângulo e ruído de 15 bits, o som seco dos consoles) ou `rave` (serra, bumbo de seno e distorção, o som cheio da pista).
 */
export const RECEITAS = [
  {
    id: 'blaster', arma: 'blaster', uso: 'tiro', referencia: 'o "pew" de varredura de pulso dos arcades de 1978 a 1982',
    gerar: (e) => (e === '8bit'
      ? voz({ dur: 0.16, onda: 'pulse', duty: 0.25, freq: varredura(1900, 260, 0.14), amp: decaimento(0.05) })
      : distorcer(somar([{ x: voz({ dur: 0.2, onda: 'saw', freq: varredura(2600, 160, 0.15), amp: decaimento(0.06) }) }, { x: voz({ dur: 0.2, onda: 'pulse', freq: varredura(1300, 90, 0.15), amp: decaimento(0.06) }), ganho: 0.5 }]), 3)),
  },
  {
    id: 'plasma', arma: 'plasma', uso: 'tiro', referencia: 'pulso estreito com vibrato rápido (os chips de som de 8 bits) / três serras desafinadas (o "supersaw" do rave)',
    gerar: (e) => (e === '8bit'
      ? somar([{ x: voz({ dur: 0.3, onda: 'pulse', duty: 0.125, freq: (t) => 760 * (1 - (0.5 * t) / 0.3) * (1 + 0.04 * Math.sin(PI2 * 38 * t)), amp: decaimento(0.09) }) }, { x: ruido({ dur: 0.02, hz: 8000, modo: 'curto' }), ganho: 0.4 }])
      : eco(distorcer(somar([520, 526, 533].map((f) => ({ x: voz({ dur: 0.32, onda: 'saw', freq: (t) => f * (1 - (0.5 * t) / 0.32), amp: decaimento(0.1) }), ganho: 0.4 }))), 4), 40, 0.3, 0.3)),
  },
  {
    id: 'rotary', arma: 'rotary', uso: 'tiro (repete a 20 por segundo)', referencia: 'o "tick" do canal de ruído curto (metálico) / o estalo do bumbo curto',
    gerar: (e) => (e === '8bit'
      ? somar([{ x: ruido({ dur: 0.03, hz: 9000, modo: 'curto', amp: decaimento(0.008) }) }, { x: voz({ dur: 0.012, onda: 'pulse', freq: 3200 }), ganho: 0.5 }])
      : bumbo({ f0: 220, f1: 60, dur: 0.04, tau: 0.012, clique: 0.9, drive: 3 })),
  },
  {
    id: 'autocannon', arma: 'autocannon', uso: 'tiro', referencia: 'pulso quadrado que cai + ruído / bumbo curto distorcido',
    gerar: (e) => (e === '8bit'
      ? somar([{ x: voz({ dur: 0.12, onda: 'pulse', freq: varredura(190, 70, 0.08), amp: decaimento(0.04) }) }, { x: ruido({ dur: 0.06, hz: 6000, amp: decaimento(0.02) }), ganho: 0.6 }])
      : bumbo({ f0: 260, f1: 55, dur: 0.16, tau: 0.05, clique: 0.8, drive: 5 })),
  },
  {
    id: 'cannon', arma: 'cannon', uso: 'tiro', referencia: 'triângulo que despenca com ruído e bitcrush (consoles de 8 bits) / o bumbo de varredura de seno com distorção (caixas de ritmo e rave)',
    gerar: (e) => (e === '8bit'
      ? bitcrush(somar([{ x: voz({ dur: 0.45, onda: 'tri', freq: varredura(230, 42, 0.32), amp: ataqueDecaimento(0.002, 0.14) }) }, { x: passaBaixa(ruido({ dur: 0.2, hz: 5000, amp: decaimento(0.06) }), 2500), ganho: 0.7 }]), 6, 2)
      : eco(bumbo({ f0: 200, f1: 40, dur: 0.5, tau: 0.16, clique: 0.8, drive: 4 }), 70, 0.3, 0.3)),
  },
  {
    id: 'siege', arma: 'siege', uso: 'tiro (mais pesado que o canhão)', referencia: 'o mesmo bumbo, uma oitava abaixo e com cauda de ruído grave',
    gerar: (e) => (e === '8bit'
      ? bitcrush(somar([{ x: voz({ dur: 0.9, onda: 'tri', freq: varredura(150, 28, 0.6), amp: ataqueDecaimento(0.003, 0.25) }) }, { x: passaBaixa(ruido({ dur: 0.5, hz: 3000, amp: decaimento(0.18) }), 900), ganho: 0.8 }]), 5, 3)
      : distorcer(somar([{ x: voz({ dur: 1.1, onda: 'sine', freq: varredura(130, 30, 0.5), amp: decaimento(0.3) }) }, { x: passaBaixa(ruido({ dur: 0.9, hz: 2500, amp: decaimento(0.3) }), 400), ganho: 0.6 }, { x: ruido({ dur: 0.012, hz: 14000, amp: decaimento(0.004) }), ganho: 0.7 }]), 6)),
  },
  {
    id: 'rockets', arma: 'rockets', uso: 'tiro', referencia: 'o sopro de ruído com filtro que abre, mais o baque do lançador',
    gerar: (e) => somar([{ x: sopro({ dur: 0.7, ruidoHz: e === '8bit' ? 4500 : 9000, corte0: 400, corte1: 3500, tau: 0.25 }) }, { x: voz({ dur: 0.12, onda: e === '8bit' ? 'tri' : 'sine', freq: varredura(120, 50, 0.1), amp: decaimento(0.05) }), ganho: 0.9 }]),
  },
  {
    id: 'seeker', arma: 'seeker', uso: 'tiro (míssil teleguiado)', referencia: 'o assobio de serra que sobe, com vibrato (a "sirene" dos fliperamas)',
    gerar: (e) => somar([{ x: voz({ dur: 0.9, onda: e === '8bit' ? 'pulse' : 'saw', duty: 0.5, freq: (t) => varredura(380, 1500, 0.7)(t) * (1 + 0.03 * Math.sin(PI2 * 9 * t)), amp: ataqueDecaimento(0.05, 0.5) }), ganho: 0.7 }, { x: passaBaixa(ruido({ dur: 0.5, hz: 7000, amp: decaimento(0.2) }), 2500), ganho: 0.3 }]),
  },
  {
    id: 'barrage', arma: 'barrage', uso: 'tiro (chuva de mísseis)', referencia: 'seis baques em ritmo, como uma frase de bateria eletrônica',
    gerar: (e) => somar([0, 1, 2, 3, 4, 5].map((i) => ({ x: somar([{ x: voz({ dur: 0.14, onda: e === '8bit' ? 'tri' : 'sine', freq: varredura(160 - i * 8, 60, 0.12), amp: decaimento(0.05) }) }, { x: ruido({ dur: 0.08, hz: 6000, amp: decaimento(0.03) }), ganho: 0.5 }]), atraso: i * 0.11, ganho: 0.9 - i * 0.05 }))),
  },
  {
    id: 'grenade', arma: 'grenade', uso: 'tiro', referencia: 'o "bloop" de pulso que cai, seguido do estalo',
    gerar: (e) => somar([{ x: voz({ dur: 0.2, onda: e === '8bit' ? 'pulse' : 'saw', freq: varredura(900, 180, 0.18), amp: decaimento(0.07) }) }, { x: ruido({ dur: 0.05, hz: 7000, amp: decaimento(0.015) }), atraso: 0.17, ganho: 0.8 }]),
  },
  {
    id: 'railgun', arma: 'railgun', uso: 'tiro', referencia: 'a carga que sobe por varredura e o estalo seco da descarga',
    gerar: (e) => somar([{ x: voz({ dur: 0.3, onda: e === '8bit' ? 'pulse' : 'saw', duty: 0.25, freq: varredura(220, 2800, 0.28), amp: (t) => Math.min(1, t / 0.28) * 0.7 }) }, { x: ruido({ dur: 0.1, hz: 14000, amp: decaimento(0.02) }), atraso: 0.28 }, { x: voz({ dur: 0.18, onda: 'sine', freq: varredura(3000, 200, 0.1), amp: decaimento(0.05) }), atraso: 0.28, ganho: 0.8 }]),
  },
  {
    id: 'arc', arma: 'arc', uso: 'tiro', referencia: 'serra com modulação de amplitude (o zumbido de eletricidade) e estalos de ruído',
    gerar: (e) => distorcer(somar([{ x: voz({ dur: 0.35, onda: 'saw', freq: 180, amp: (t) => 0.5 * (1 + Math.sin(PI2 * 70 * t)) * decaimento(0.18)(t) }) }, { x: ruido({ dur: 0.35, hz: e === '8bit' ? 7000 : 12000, modo: 'curto', amp: (t) => (Math.sin(PI2 * 31 * t) > 0.4 ? 0.5 : 0.05) }), ganho: 0.6 }]), 3),
  },
  {
    id: 'cryo', arma: 'cryo', uso: 'tiro', referencia: 'um sino de síntese FM (a assinatura dos chips de 1988) descendo em três notas',
    gerar: (e) => somar([1760, 1320, 990].map((f, i) => ({ x: voz({ dur: 0.22, onda: 'sine', freq: f, amp: (t) => decaimento(0.07)(t) * (e === '8bit' ? ONDAS.pulse(f * 1.5 * t, 0.5) * 0.4 + 0.6 : 1 + 0.6 * Math.sin(PI2 * f * 1.5 * t) * decaimento(0.05)(t)) }), atraso: i * 0.09, ganho: 0.8 }))),
  },
  {
    id: 'sonic', arma: 'sonic', uso: 'tiro', referencia: 'o grave que balança (LFO lento): o "wub" da música de baixo',
    gerar: (e) => distorcer(somar([{ x: voz({ dur: 0.9, onda: 'sine', freq: (t) => 95 + 25 * Math.sin(PI2 * 7 * t), amp: ataqueDecaimento(0.05, 0.5) }) }, { x: voz({ dur: 0.9, onda: e === '8bit' ? 'tri' : 'saw', freq: (t) => 190 + 50 * Math.sin(PI2 * 7 * t), amp: ataqueDecaimento(0.05, 0.35) }), ganho: 0.3 }]), 2),
  },
  {
    id: 'emp', arma: 'emp', uso: 'tiro', referencia: 'o estouro de ruído que desaba em triângulo (a "queda de tensão")',
    gerar: (e) => somar([{ x: ruido({ dur: 0.1, hz: 9000, amp: decaimento(0.03) }) }, { x: voz({ dur: 0.6, onda: e === '8bit' ? 'tri' : 'saw', freq: varredura(1400, 70, 0.5), amp: decaimento(0.2) }), ganho: 0.7 }]),
  },
  {
    id: 'shotgun', arma: 'shotgun', uso: 'tiro', referencia: 'estouro de ruído grosso com bumbo por baixo',
    gerar: (e) => somar([{ x: passaBaixa(ruido({ dur: 0.3, hz: e === '8bit' ? 6000 : 10000, amp: decaimento(0.05) }), 5000) }, { x: voz({ dur: 0.14, onda: 'sine', freq: varredura(180, 50, 0.1), amp: decaimento(0.05) }), ganho: 0.9 }]),
  },
  {
    id: 'harpoon', arma: 'harpoon', uso: 'tiro', referencia: 'pulso que desce e o "clink" metálico da ponta',
    gerar: (e) => somar([{ x: voz({ dur: 0.18, onda: 'pulse', duty: 0.25, freq: varredura(1100, 500, 0.1), amp: decaimento(0.05) }) }, { x: voz({ dur: 0.15, onda: e === '8bit' ? 'pulse' : 'sine', freq: 2400, amp: decaimento(0.04) }), atraso: 0.1, ganho: 0.5 }]),
  },
  {
    id: 'swarm', arma: 'swarm', uso: 'tiro', referencia: 'oito "pips" de pulso em fila, como um arpejo muito rápido',
    gerar: (e) => somar([0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ x: voz({ dur: 0.06, onda: e === '8bit' ? 'pulse' : 'saw', duty: 0.25, freq: varredura(1800 - i * 60, 700, 0.04), amp: decaimento(0.02) }), atraso: i * 0.045, ganho: 0.9 - i * 0.04 }))),
  },
  {
    id: 'cruise', arma: 'cruise', uso: 'tiro (míssil de cruzeiro)', referencia: 'o sopro longo e grave de ruído que abre devagar, com um baque profundo (o foguete grande)',
    gerar: (e) => somar([{ x: sopro({ dur: 1.2, ruidoHz: e === '8bit' ? 3000 : 6000, corte0: 250, corte1: 1500, tau: 0.6, ataque: 0.1 }) }, { x: voz({ dur: 0.3, onda: e === '8bit' ? 'tri' : 'sine', freq: varredura(90, 45, 0.25), amp: decaimento(0.12) }), ganho: 0.9 }]),
  },
  {
    id: 'gas', arma: 'gas', uso: 'tiro (lançador de gás)', referencia: 'o "foop" do lançamento e o chiado do gás escapando',
    gerar: (e) => somar([{ x: voz({ dur: 0.15, onda: e === '8bit' ? 'pulse' : 'sine', duty: 0.5, freq: varredura(300, 120, 0.12), amp: decaimento(0.05) }) }, { x: passaBaixa(ruido({ dur: 0.5, hz: e === '8bit' ? 5000 : 9000, amp: ataqueDecaimento(0.04, 0.2) }), 3000), atraso: 0.08, ganho: 0.6 }]),
  },
  {
    id: 'flamer', arma: 'flamer', uso: 'laço (enquanto o gatilho está apertado)', referencia: 'ruído filtrado com estalos de amplitude',
    gerar: (e) => passaBaixa(ruido({ dur: 0.7, hz: e === '8bit' ? 5000 : 9000, amp: (t) => 1 + 0.4 * Math.sin(PI2 * 17 * t) }), 1800),
  },
  {
    id: 'chainsaw', arma: 'chainsaw', uso: 'laço (corpo a corpo)', referencia: 'serra grave com modulação de amplitude e ruído de dentes',
    gerar: (e) => distorcer(somar([{ x: voz({ dur: 0.8, onda: 'saw', freq: 64, amp: (t) => 0.5 * (1 + 0.6 * Math.sin(PI2 * 26 * t)) }) }, { x: ruido({ dur: 0.8, hz: e === '8bit' ? 5000 : 9000, modo: 'curto' }), ganho: 0.2 }]), 3),
  },
  {
    id: 'laser', arma: 'laser', uso: 'laço (feixe contínuo)', referencia: 'dois pulsos muito finos, desafinados, que "vibram"',
    gerar: () => somar([{ x: voz({ dur: 0.6, onda: 'pulse', duty: 0.03, freq: 880 }) }, { x: voz({ dur: 0.6, onda: 'pulse', duty: 0.03, freq: 887.4 }), ganho: 0.8 }]),
  },
  {
    id: 'explosao', arma: null, uso: 'impacto (explosão)', referencia: 'o canal de ruído de 15 bits com filtro que fecha e um baque grave',
    gerar: (e) => {
      const base = somar([{ x: passaBaixa(ruido({ dur: 1, hz: varredura(8000, 1200, 0.8), amp: ataqueDecaimento(0.005, 0.35) }), varredura(6000, 300, 0.9)) }, { x: voz({ dur: 0.5, onda: 'tri', freq: varredura(90, 35, 0.4), amp: decaimento(0.2) }), ganho: 0.9 }]);
      return e === '8bit' ? bitcrush(base, 8, 2) : distorcer(base, 3);
    },
  },
  {
    id: 'acerto', arma: null, uso: 'impacto (acertou o inimigo)', referencia: 'o "blip" curto de pulso',
    gerar: (e) => voz({ dur: 0.08, onda: 'pulse', duty: e === '8bit' ? 0.25 : 0.5, freq: varredura(1400, 800, 0.05), amp: decaimento(0.02) }),
  },
  {
    id: 'comms_abrir', arma: null, uso: 'comando (o rádio abre antes da fala)', referencia: 'o bipe de abertura de canal dos rádios de voo, seguido do chiado',
    gerar: () => somar([{ x: voz({ dur: 0.09, onda: 'sine', freq: 2525 }) }, { x: ruido({ dur: 0.05, hz: 12000, amp: decaimento(0.015) }), atraso: 0.09, ganho: 0.3 }]),
  },
  {
    id: 'comms_fechar', arma: null, uso: 'comando (o rádio fecha depois da fala)', referencia: 'o bipe de fecho do canal, um pouco mais grave, e o estalo de fim',
    gerar: () => somar([{ x: voz({ dur: 0.09, onda: 'sine', freq: 2475 }) }, { x: ruido({ dur: 0.06, hz: 12000, amp: decaimento(0.02) }), atraso: 0.09, ganho: 0.35 }]),
  },
  {
    id: 'alerta_missil', arma: null, uso: 'comando (míssil travado em você: a fala "Aviso. Míssil travado em você.")', referencia: 'o bipe interrompido do alarme de radar, e o tom contínuo do travamento',
    gerar: () => somar([0, 1, 2].map((i) => ({ x: voz({ dur: 0.1, onda: 'pulse', duty: 0.5, freq: 1000 }), atraso: i * 0.17 })).concat([{ x: voz({ dur: 0.25, onda: 'pulse', duty: 0.5, freq: 1400, amp: (t) => 1 - t / 0.25 * 0.4 }), atraso: 0.55 }])),
  },
  {
    id: 'radar_ping', arma: null, uso: 'comando (varredura do radar)', referencia: 'o "ping" de seno que decai, com eco',
    gerar: () => eco(voz({ dur: 0.5, onda: 'sine', freq: 1500, amp: decaimento(0.18) }), 140, 0.45, 0.5),
  },
  {
    id: 'fanfarra_rodada', arma: null, uso: 'trilha (abertura da rodada)', referencia: 'um arpejo de pulso em Lá menor, em semicolcheias a 108 BPM (o tom da música de combate)',
    gerar: (e) => somar([...ARPEJO_A_MENOR.map((f, i) => ({ x: voz({ dur: 0.13, onda: e === '8bit' ? 'pulse' : 'saw', duty: 0.5, freq: f, amp: decaimento(0.09) }), atraso: i * (60 / 108 / 4), ganho: 0.8 })), { x: voz({ dur: 1.0, onda: 'tri', freq: 110, amp: ataqueDecaimento(0.01, 0.8) }), ganho: 0.6 }]),
  },
  {
    id: 'tema_menu', arma: null, longa: true, uso: 'trilha (candidato a música de menu: 4 compassos, em laço)', referencia: 'o sequenciador de máquina: arpejo de pulso, baixo em colcheias e bumbo nos tempos, em Lá menor a 108 BPM',
    gerar: temaDeMenu,
  },
  {
    id: 'tema_combate', arma: null, longa: true, uso: 'trilha (candidato a música de combate: 4 compassos, em laço)', referencia: 'a quebra de ritmo e o "stab" de serra distorcida do rave dos anos 90, em Lá menor a 108 BPM (o tom da música de combate do jogo)',
    gerar: temaDeCombate,
  },
  {
    id: 'sequencia_abate', arma: null, uso: 'trilha (sequência de abates)', referencia: 'três notas subindo (pentatônica) e uma final longa',
    gerar: (e) => somar([440, 523.25, 659.25, 880].map((f, i) => ({ x: voz({ dur: i === 3 ? 0.35 : 0.12, onda: e === '8bit' ? 'pulse' : 'saw', duty: 0.5, freq: f, amp: decaimento(i === 3 ? 0.2 : 0.07) }), atraso: i * 0.11 }))),
  },
  {
    id: 'aviso_calor', arma: null, uso: 'comando (calor crítico)', referencia: 'dois bipes graves em fila',
    gerar: () => somar([0, 1].map((i) => ({ x: voz({ dur: 0.12, onda: 'pulse', duty: 0.5, freq: 520 }), atraso: i * 0.22 }))),
  },
  {
    id: 'dash', arma: null, uso: 'movimento (investida)', referencia: 'o "whoosh" de ruído com filtro que abre',
    gerar: (e) => passaBaixa(ruido({ dur: 0.25, hz: varredura(3000, 9000, 0.2), amp: ataqueDecaimento(0.02, 0.1) }), varredura(800, e === '8bit' ? 2500 : 4000, 0.2)),
  },
  {
    id: 'reaparecer', arma: null, uso: 'movimento (volta ao combate)', referencia: 'arpejo ascendente de serra com deslize',
    gerar: (e) => somar([220, 329.63, 440, 523.25, 659.25].map((f, i) => ({ x: voz({ dur: 0.16, onda: e === '8bit' ? 'pulse' : 'saw', duty: 0.25, freq: (t) => f * (1 + 0.05 * Math.min(1, t / 0.08)), amp: decaimento(0.08) }), atraso: i * 0.08 }))),
  },
];

export const ESTILOS = ['8bit', 'rave'];

/** Renderiza uma receita num estilo: sempre com fade nas pontas e o pico em −1 dBFS. Determinístico. */
export function renderizar(receita, estilo) {
  if (!ESTILOS.includes(estilo)) throw new Error(`estilo desconhecido: ${estilo}`);
  return normalizar(fade(receita.gerar(estilo)), -1);
}

/** O nome do arquivo de uma receita num estilo (o Estúdio lista tudo o que está na pasta de referências, por ordem alfabética). */
export const nomeDoArquivo = (receita, estilo) => `RETRO_${receita.id}_${estilo}.wav`;
