/**
 * Vinheta sonora da SERAFIM WEB (~1,7 s), sintetizada na hora: um sopro que sobe, um impacto grave
 * e um acorde brilhante com eco, no espírito das aberturas de console dos anos 90. Sem arquivo de
 * som. Tudo agendado no relógio do AudioContext; os nós se desligam sozinhos ao terminar.
 */
export function playBrandSting(ctx: AudioContext, out: AudioNode): void {
  const t0 = ctx.currentTime + 0.02;

  // Eco do acorde: um atraso curto que se repete baixinho.
  const echo = ctx.createDelay(0.5);
  echo.delayTime.value = 0.19;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.28;
  echo.connect(feedback).connect(echo);
  echo.connect(out);

  // 1) Sopro: ruído filtrado com a banda subindo (0 → 0,35 s).
  const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.4), ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1; // efeito sonoro, fora da simulação
  const whoosh = ctx.createBufferSource();
  whoosh.buffer = noise;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 1.4;
  band.frequency.setValueAtTime(300, t0);
  band.frequency.exponentialRampToValueAtTime(5000, t0 + 0.34);
  const wg = ctx.createGain();
  wg.gain.setValueAtTime(0.0001, t0);
  wg.gain.exponentialRampToValueAtTime(0.35, t0 + 0.28);
  wg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.38);
  whoosh.connect(band).connect(wg).connect(out);
  whoosh.start(t0);
  whoosh.stop(t0 + 0.4);

  // 2) Impacto grave quando o emblema acende (0,32 s).
  const hit = t0 + 0.32;
  const boom = ctx.createOscillator();
  boom.type = 'sine';
  boom.frequency.setValueAtTime(110, hit);
  boom.frequency.exponentialRampToValueAtTime(38, hit + 0.45);
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(0.0001, hit);
  bg.gain.exponentialRampToValueAtTime(0.9, hit + 0.015);
  bg.gain.exponentialRampToValueAtTime(0.0001, hit + 0.6);
  boom.connect(bg).connect(out);
  boom.start(hit);
  boom.stop(hit + 0.62);

  // 3) Acorde brilhante (mi maior aberto), notas em cascata, com eco.
  const notes = [659.26, 987.77, 1318.51, 1975.53];
  notes.forEach((f, i) => {
    const at = hit + 0.02 + i * 0.055;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.22 - i * 0.03, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 1.25);
    o.connect(g);
    g.connect(out);
    g.connect(echo);
    o.start(at);
    o.stop(at + 1.3);
  });

  // 4) Colchão: duas serras levemente desafinadas, com o filtro abrindo.
  const pad = ctx.createBiquadFilter();
  pad.type = 'lowpass';
  pad.frequency.setValueAtTime(350, hit);
  pad.frequency.exponentialRampToValueAtTime(3200, hit + 0.8);
  const pg = ctx.createGain();
  pg.gain.setValueAtTime(0.0001, hit);
  pg.gain.exponentialRampToValueAtTime(0.1, hit + 0.12);
  pg.gain.exponentialRampToValueAtTime(0.0001, hit + 1.35);
  pad.connect(pg).connect(out);
  for (const detune of [-9, 9]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 329.63;
    o.detune.value = detune;
    o.connect(pad);
    o.start(hit);
    o.stop(hit + 1.4);
  }
}
