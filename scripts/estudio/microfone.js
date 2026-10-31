'use strict';
/**
 * O MICROFONE do Estúdio (P286, 30/10: "quero gravar os áudios, mas não consegui gravar, ficou mudo o microfone"). A causa, medida neste PC com `.decepticons/medicoes/mic-real.mjs`:
 * a aba VOZES abria SEMPRE o aparelho padrão do Windows, e o padrão de agora é o ponto USB "Microfone (Captain 300)", que entrega zero absoluto; só o fone Bluetooth tinha sinal.
 * Sem lista de aparelhos, sem medidor com número e sem aviso, a gravação saía muda e ninguém dizia por quê.
 *
 * Aqui: a lista dos microfones de verdade (nunca a "Mixagem estéreo", que grava o som do computador), a escolha EXATA do aparelho (lembrada), o veredito em palavras
 * (silêncio total / fraco / bom / estourando), o "procurar o que funciona" e o ganho de entrada (o fone Bluetooth é baixinho). As contas (veredito, ganho, barra, filtro de
 * aparelhos) não tocam o navegador e têm teste (`server/estudioMic.test.ts`); o resto é Web Audio e é provado no Chrome (`medicoes/estudio.mjs`).
 */
(() => {
  // O mesmo critério de client/src/voice/aparelhos.ts: a mixagem do sistema nunca é um microfone.
  const MIXAGEM = /mixagem|stereo mix|st[eé]r[eé]o mix|mezcla est[eé]reo|what u hear|what you hear|wave out|loopback/i;
  const APELIDOS = ['default', 'communications'];
  const ehMixagem = (rotulo) => MIXAGEM.test(rotulo ?? '');

  const dB = (v) => 20 * Math.log10(Math.max(v, 1e-5));
  const arred = (n) => Math.round(n * 10) / 10;
  const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

  /** Os microfones de verdade da lista do navegador, com nome ("Microfone 1" quando ele não dá: sem permissão os rótulos vêm vazios). Fora os apelidos "default" e "communications". */
  function aparelhosDe(todos) {
    const reais = (todos ?? []).filter((d) => d.kind === 'audioinput' && d.deviceId && !APELIDOS.includes(d.deviceId) && !ehMixagem(d.label));
    return reais.map((d, i) => ({ id: d.deviceId, nome: (d.label ?? '').trim() || `Microfone ${i + 1}` }));
  }

  /** A barra do medidor (0 a 100): em decibéis, de −60 dBFS (vazio) a 0 (cheio). A voz normal fica entre 50 e 85. */
  const barra = (v) => Math.round(Math.min(100, Math.max(0, ((dB(v) + 60) / 60) * 100)));

  const SO_ZERO = 1e-6;
  const LIMITE_BAIXO = 0.01; // −40 dBFS: abaixo disto a voz quase não passa do chiado
  const LIMITE_ALTO = 0.95;

  /**
   * O que dizer de um microfone depois de ouvi-lo: `pico` é a maior amostra vista (0 a 1) e `rms` o maior nível médio (0 a 1), os dois já com o ganho.
   * `mudo`: zero absoluto (mudo no Windows, ponto morto, fone fora do modo microfone). `baixo`: há sinal, mas ainda sem voz. `alto`: encosta no teto. `ok`.
   */
  function veredito(pico, rms) {
    if (!(pico > SO_ZERO)) return { estado: 'mudo', texto: 'SILÊNCIO TOTAL: este aparelho entrega zero (mudo no Windows, ponto morto ou fone fora do modo microfone). Escolha outro na lista, ou clique em PROCURAR O QUE FUNCIONA.' };
    if (pico > LIMITE_ALTO) return { estado: 'alto', texto: `Estourando (pico ${arred(dB(pico))} dB): afaste-se do microfone ou baixe o ganho.` };
    if (rms < LIMITE_BAIXO) return { estado: 'baixo', texto: `Há sinal, mas ainda sem voz (nível ${arred(dB(rms))} dB). Fale no microfone; se já falou, chegue mais perto ou suba o ganho.` };
    return { estado: 'ok', texto: `Bom: voz a ${arred(dB(rms))} dB, pico ${arred(dB(pico))} dB.` };
  }

  const RMS_ALVO = 0.1; // ≈ −20 dBFS, onde a fala comum deve ficar
  const GANHO_MAX = 8;
  /** Que ganho sugerir: a voz medida (`rms`, com o ganho atual) puxada até o alvo. `null` = nada a sugerir (sem voz, só chiado; ou já está boa; ou já no máximo). */
  function sugerirGanho(rms, ganhoAtual) {
    if (rms < 0.0015 || ganhoAtual >= GANHO_MAX) return null;
    const ideal = (ganhoAtual * RMS_ALVO) / rms;
    if (ideal < ganhoAtual * 1.25) return null;
    return Math.min(GANHO_MAX, Math.round(ideal * 2) / 2);
  }

  // ── o navegador ─────────────────────────────────────────────────────────────────────────────────
  /**
   * Abre o microfone cru (sem eco, ruído nem ganho automático: o tratamento é do Estúdio). Com `id`, o aparelho é EXATO; se ele sumiu cai no padrão, exceto com `exato`
   * (a busca precisa saber de cada um, sem trocar um pelo outro). Quem chama diz o aparelho que abriu pelo rótulo da faixa.
   */
  async function abrir(id, { exato = false } = {}) {
    const base = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 };
    const pedir = (extra) => navigator.mediaDevices.getUserMedia({ audio: { ...base, ...extra }, video: false });
    if (id) {
      try { return await pedir({ deviceId: { exact: id } }); }
      catch (e) { if (exato || (e.name !== 'OverconstrainedError' && e.name !== 'NotFoundError')) throw e; }
    }
    return pedir({});
  }

  /** Liga o microfone ao gravador: fonte → ganho → (analisador, saída). `saida` é o fluxo que o MediaRecorder grava; `ler()` devolve o pico e o RMS da janela mais recente (0 a 1). */
  function ligar(ctx, fluxo, ganho = 1) {
    const fonte = ctx.createMediaStreamSource(fluxo);
    const g = ctx.createGain();
    g.gain.value = ganho;
    const analisador = ctx.createAnalyser();
    analisador.fftSize = 2048;
    const destino = ctx.createMediaStreamDestination();
    fonte.connect(g);
    g.connect(analisador);
    g.connect(destino);
    const amostras = new Float32Array(analisador.fftSize);
    return {
      saida: destino.stream,
      rotulo: fluxo.getAudioTracks()[0]?.label ?? '',
      mudarGanho(v) { g.gain.value = v; },
      ler() {
        analisador.getFloatTimeDomainData(amostras);
        let soma = 0, pico = 0;
        for (const v of amostras) { soma += v * v; const a = v < 0 ? -v : v; if (a > pico) pico = a; }
        return { pico, rms: Math.sqrt(soma / amostras.length) };
      },
      fechar() {
        try { fonte.disconnect(); g.disconnect(); } catch { /* já solto */ }
        for (const t of fluxo.getTracks()) t.stop();
      },
    };
  }

  /** Ouve um fluxo por `ms` e devolve o maior pico e o maior RMS vistos (e solta o microfone). */
  async function medirPor(ctx, fluxo, ms) {
    const ponte = ligar(ctx, fluxo, 1);
    let pico = 0, rms = 0;
    const fim = performance.now() + ms;
    try {
      while (performance.now() < fim) {
        await esperar(50);
        const l = ponte.ler();
        pico = Math.max(pico, l.pico);
        rms = Math.max(rms, l.rms);
      }
    } finally { ponte.fechar(); }
    return { pico, rms };
  }

  /** Libera o microfone para a página (sem isso o navegador não dá o nome dos aparelhos): abre o padrão e solta na hora. */
  async function liberar() {
    const f = await abrir('');
    for (const t of f.getTracks()) t.stop();
  }

  async function listar() {
    return aparelhosDe(await navigator.mediaDevices.enumerateDevices());
  }

  /**
   * Abre cada microfone por `ms` e diz qual tem sinal. O melhor é o de maior nível (voz, se a pessoa falou) entre os que não estão em zero absoluto.
   * Um aparelho que nem abre (em uso, sumiu) conta como `erro`. `aoAndar(aparelho)` avisa a tela de qual está sendo ouvido.
   */
  async function procurar(ctx, aparelhos, { ms = 1200, aoAndar } = {}) {
    const achados = [];
    for (const a of aparelhos) {
      aoAndar?.(a);
      try {
        const m = await medirPor(ctx, await abrir(a.id, { exato: true }), ms);
        achados.push({ ...a, ...m, ...veredito(m.pico, m.rms) });
      } catch (e) {
        achados.push({ ...a, pico: 0, rms: 0, estado: 'erro', texto: `não abriu (${e.name})` });
      }
    }
    return { achados, melhor: melhorDe(achados) };
  }

  /** O melhor da busca: o que tem sinal, de maior nível. `null` se todos estão mudos. */
  function melhorDe(achados) {
    const vivos = achados.filter((a) => a.estado !== 'mudo' && a.estado !== 'erro');
    vivos.sort((a, b) => b.rms - a.rms || b.pico - a.pico);
    return vivos[0] ?? null;
  }

  const CHAVE = 'estudio.microfone';
  const lembrar = (id) => { try { localStorage.setItem(CHAVE, id); } catch { /* sem armazenamento: a escolha só vale nesta visita */ } };
  const lembrado = () => { try { return localStorage.getItem(CHAVE) ?? ''; } catch { return ''; } };

  window.EstudioMic = { ehMixagem, aparelhosDe, barra, dB, veredito, sugerirGanho, melhorDe, abrir, ligar, medirPor, liberar, listar, procurar, lembrar, lembrado };
})();
