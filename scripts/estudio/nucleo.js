'use strict';
/**
 * O núcleo do Estúdio no navegador (P155): o que todas as abas usam. Mensagens, chamadas ao servidor, o áudio (Web Audio), a ONDA (componente com seleção por
 * arrasto), as abas e o painel de "alterações ainda não publicadas". Cada aba (sons.js, e as próximas) fica no seu arquivo e usa `window.Estudio`.
 */
(() => {
  const $ = (s, raiz = document) => raiz.querySelector(s);
  const r2 = (n) => Math.round(n * 100) / 100;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const ALVO_MEDIA = -18, ALVO_PICO = -1;

  // ── mensagens e estado "sujo" ───────────────────────────────────────────────────────────────────
  function msg(texto, tipo) {
    const li = document.createElement('li');
    if (tipo) li.className = tipo;
    li.textContent = texto;
    const ul = $('#mensagens');
    ul.prepend(li);
    while (ul.children.length > 10) ul.lastChild.remove();
  }
  let sujo = false;
  function marcarSujo(v = true) { sujo = v; $('#aviso-sujo').textContent = v ? '● alterações não salvas' : ''; }
  window.addEventListener('beforeunload', (e) => { if (sujo) { e.preventDefault(); e.returnValue = ''; } });

  async function api(caminho, opcoes) {
    const r = await fetch(caminho, opcoes);
    let corpo = null;
    try { corpo = await r.json(); } catch { /* sem corpo */ }
    if (!r.ok) {
      const e = new Error(corpo?.erros?.join('\n') ?? corpo?.erro ?? `erro ${r.status}`);
      e.status = r.status;
      throw e;
    }
    return corpo;
  }
  const postJson = (caminho, dados) => api(caminho, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(dados) });

  // ── áudio ───────────────────────────────────────────────────────────────────────────────────────
  let tocando = [];
  function parar() { for (const s of tocando) { try { s.stop(); } catch { /* já parou */ } } tocando = []; }
  /** Toca um trecho de `b`. `fadeMs` = fade no fim; `maxS` corta (com fade de 30 ms); `quando` = atraso em segundos. Devolve a duração real. */
  function tocar(b, { de = 0, ate = b.duration, fadeMs = 0, ganho = 1, pitch = 1, maxS = 0, quando = 0 } = {}) {
    if (ctx.state === 'suspended') ctx.resume();
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.playbackRate.value = pitch;
    const g = ctx.createGain();
    src.connect(g).connect(ctx.destination);
    let fim = (ate - de) / pitch;
    let fade = fadeMs / 1000;
    if (maxS > 0 && maxS < fim) { fim = maxS; fade = Math.max(fade, 0.03); }
    fade = Math.min(fade, fim / 2);
    const t0 = ctx.currentTime + quando;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(ganho, t0 + 0.003);
    if (fade > 0) { g.gain.setValueAtTime(ganho, t0 + fim - fade); g.gain.linearRampToValueAtTime(0, t0 + fim); }
    src.start(t0, de, ate - de);
    src.stop(t0 + fim + 0.02);
    tocando.push(src);
    return fim;
  }
  /** Repete `fn(quando)` a cada `intervalo` segundos durante `segundos`: é a audição "no ritmo de tiro da arma". */
  function ritmo(fn, intervalo, segundos = 4) {
    parar();
    const passo = Math.max(0.05, intervalo);
    for (let t = 0; t < segundos; t += passo) fn(t);
  }
  const decodificar = (bytes) => ctx.decodeAudioData(bytes);
  /** O ganho (linear) que o ffmpeg aplicaria ao trecho: média -18 dB sem passar de -1 dBFS de pico (mais o ganho extra). Estimativa para a audição rápida. */
  function ganhoDeNormalizacao(b, de, ate, extraDb) {
    const dados = b.getChannelData(0);
    const i0 = Math.floor(de * b.sampleRate), i1 = Math.min(dados.length, Math.floor(ate * b.sampleRate));
    let soma = 0, pico = 0;
    for (let i = i0; i < i1; i++) { const v = dados[i]; soma += v * v; if (Math.abs(v) > pico) pico = Math.abs(v); }
    const mediaDb = 20 * Math.log10(Math.sqrt(soma / Math.max(1, i1 - i0)) + 1e-9);
    const picoDb = 20 * Math.log10(pico + 1e-9);
    return Math.min(8, Math.pow(10, (Math.min(ALVO_MEDIA - mediaDb, ALVO_PICO - picoDb) + extraDb) / 20));
  }

  // ── a onda ──────────────────────────────────────────────────────────────────────────────────────
  /** Desenha a forma de onda de `b` em `canvas` (sem seleção): usada para mostrar o resultado da prévia. */
  function desenharForma(canvas, b, cor = '#e2a03a') {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(300, Math.floor(canvas.clientWidth * dpr));
    canvas.height = Math.floor(canvas.clientHeight * dpr);
    const c = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
    c.fillStyle = '#0a0e11'; c.fillRect(0, 0, w, h);
    if (!b) return;
    const dados = b.getChannelData(0), passo = dados.length / w;
    c.fillStyle = cor;
    for (let x = 0; x < w; x++) {
      let mn = 1, mx = -1;
      const a = Math.floor(x * passo), z = Math.min(dados.length, Math.floor((x + 1) * passo) + 1);
      for (let i = a; i < z; i++) { const v = dados[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
      c.fillRect(x, h / 2 - mx * (h / 2 - 4), 1, Math.max(1, (mx - mn) * (h / 2 - 4)));
    }
  }

  /**
   * A onda com seleção: arrastar no vazio cria um trecho, arrastar uma borda a ajusta. `aoMudar(sel)` é chamado a cada mudança por arrasto; `aoSoltar()` quando solta.
   * `sel = { de, ate }` em segundos.
   */
  class Onda {
    constructor(canvas, { aoMudar = () => {}, aoSoltar = () => {} } = {}) {
      this.canvas = canvas;
      this.buf = null;
      this.sel = { de: 0, ate: 0.5 };
      this.picos = null;
      this.arrasto = null;
      this.aoMudar = aoMudar;
      this.aoSoltar = aoSoltar;
      canvas.addEventListener('pointerdown', (e) => this.apertou(e));
      canvas.addEventListener('pointermove', (e) => this.moveu(e));
      canvas.addEventListener('pointerup', () => { if (this.arrasto) { this.arrasto = null; this.aoSoltar(); } });
      window.addEventListener('resize', () => this.desenhar());
    }
    definir(buf, sel) {
      this.buf = buf;
      if (sel) this.sel = { ...sel };
      this.canvas.width = 0; // força recalcular os picos
      this.desenhar();
    }
    calcularPicos() {
      if (!this.buf) { this.picos = null; return; }
      const w = this.canvas.width, dados = this.buf.getChannelData(0), passo = dados.length / w;
      this.picos = new Array(w);
      for (let x = 0; x < w; x++) {
        let mn = 1, mx = -1;
        const a = Math.floor(x * passo), b = Math.min(dados.length, Math.floor((x + 1) * passo) + 1);
        for (let i = a; i < b; i++) { const v = dados[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
        this.picos[x] = [mn, mx];
      }
    }
    desenhar() {
      const cv = this.canvas, dpr = window.devicePixelRatio || 1;
      const w = Math.max(300, Math.floor(cv.clientWidth * dpr));
      if (cv.width !== w) { cv.width = w; cv.height = Math.floor(170 * dpr); this.calcularPicos(); }
      const c = cv.getContext('2d'), h = cv.height;
      c.clearRect(0, 0, w, h);
      c.fillStyle = '#0a0e11'; c.fillRect(0, 0, w, h);
      if (!this.buf) { c.fillStyle = '#8fa0a8'; c.font = `${14 * dpr}px system-ui`; c.fillText('Abra uma referência na lista à esquerda', 20, h / 2); return; }
      const dur = this.buf.duration, xDe = (this.sel.de / dur) * w, xAte = (this.sel.ate / dur) * w;
      c.fillStyle = 'rgba(57,255,106,0.16)'; c.fillRect(xDe, 0, xAte - xDe, h);
      c.fillStyle = '#4b8d62';
      for (let x = 0; x < w; x++) {
        const [mn, mx] = this.picos[x];
        c.fillRect(x, h / 2 - mx * (h / 2 - 6), 1, Math.max(1, (mx - mn) * (h / 2 - 6)));
      }
      const passos = [0.05, 0.1, 0.25, 0.5, 1, 2, 5], alvo = dur / 8;
      const passo = passos.find((p) => p >= alvo) ?? 5;
      c.fillStyle = '#8fa0a8'; c.font = `${11 * dpr}px system-ui`;
      for (let t = 0; t <= dur; t += passo) { const x = (t / dur) * w; c.fillRect(x, h - 14, 1, 14); c.fillText(`${r2(t)}s`, x + 3, h - 3); }
      c.fillStyle = '#39ff6a'; c.fillRect(xDe - 1, 0, 2, h); c.fillRect(xAte - 1, 0, 2, h);
    }
    tempo(e) {
      const r = this.canvas.getBoundingClientRect();
      return Math.min(this.buf.duration, Math.max(0, ((e.clientX - r.left) / r.width) * this.buf.duration));
    }
    apertou(e) {
      if (!this.buf) return;
      this.canvas.setPointerCapture(e.pointerId);
      const t = this.tempo(e), px = (this.buf.duration / this.canvas.getBoundingClientRect().width) * 10;
      if (Math.abs(t - this.sel.de) < px) this.arrasto = { tipo: 'de' };
      else if (Math.abs(t - this.sel.ate) < px) this.arrasto = { tipo: 'ate' };
      else this.arrasto = { tipo: 'novo', ancora: t };
    }
    moveu(e) {
      if (!this.buf || !this.arrasto) return;
      const t = this.tempo(e), s = this.sel;
      if (this.arrasto.tipo === 'de') s.de = Math.min(t, s.ate - 0.02);
      else if (this.arrasto.tipo === 'ate') s.ate = Math.max(t, s.de + 0.02);
      else { s.de = Math.min(this.arrasto.ancora, t); s.ate = Math.max(this.arrasto.ancora, t, s.de + 0.02); }
      this.desenhar();
      this.aoMudar(s);
    }
    /** Ajusta o trecho para onde há som: corta o silêncio do começo e do fim (limiar em dB abaixo do pico). */
    aparar(limiarDb = -40) {
      if (!this.buf) return false;
      const dados = this.buf.getChannelData(0);
      let pico = 0;
      for (let i = 0; i < dados.length; i++) if (Math.abs(dados[i]) > pico) pico = Math.abs(dados[i]);
      const limite = pico * Math.pow(10, limiarDb / 20);
      let a = 0, b = dados.length - 1;
      while (a < b && Math.abs(dados[a]) < limite) a++;
      while (b > a && Math.abs(dados[b]) < limite) b--;
      const sr = this.buf.sampleRate;
      this.sel = { de: Math.max(0, r2(a / sr - 0.005)), ate: Math.min(this.buf.duration, r2(b / sr + 0.02)) };
      if (this.sel.ate <= this.sel.de) return false;
      this.desenhar();
      return true;
    }
  }

  // ── abas ────────────────────────────────────────────────────────────────────────────────────────
  function iniciarAbas() {
    const botoes = [...document.querySelectorAll('#abas button')];
    const mostrar = (id) => {
      for (const b of botoes) b.classList.toggle('ativa', b.dataset.aba === id);
      for (const p of document.querySelectorAll('.painel-aba')) p.hidden = p.id !== `aba-${id}`;
      try { localStorage.setItem('estudio.aba', id); } catch { /* sem storage */ }
    };
    for (const b of botoes) b.addEventListener('click', () => mostrar(b.dataset.aba));
    let guardada = 'sons';
    try { guardada = localStorage.getItem('estudio.aba') || 'sons'; } catch { /* sem storage */ }
    mostrar(botoes.some((b) => b.dataset.aba === guardada) ? guardada : 'sons');
  }

  // ── alterações ainda não publicadas ─────────────────────────────────────────────────────────────
  async function atualizarPendencias() {
    const caixa = $('#pendencias');
    try {
      const p = await api('/api/pendencias');
      if (!p.git || p.arquivos.length === 0) { caixa.hidden = true; return; }
      caixa.hidden = false;
      const mp3 = p.arquivos.filter((a) => a.arquivo.endsWith('.mp3')).length;
      const outros = p.arquivos.length - mp3;
      const t = document.createElement('div');
      const forte = document.createElement('b');
      forte.textContent = 'Ainda NÃO está no jogo publicado. ';
      const code = document.createElement('code');
      code.textContent = 'publica os sons';
      t.append(forte, `${p.arquivos.length} arquivo(s) mudaram neste computador (${mp3} som(ns) processado(s), ${outros} de configuração). Para ir ao ar, diga ao Claude: `, code, '.');
      caixa.replaceChildren(t);
    } catch { caixa.hidden = true; }
  }

  window.Estudio = { $, r2, ctx, msg, marcarSujo, api, postJson, tocar, parar, ritmo, decodificar, ganhoDeNormalizacao, desenharForma, Onda, iniciarAbas, atualizarPendencias };
})();
