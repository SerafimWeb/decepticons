'use strict';
/**
 * A aba VOZES do Estúdio (P151, P155): o Comandante GRAVA cada fala do narrador com o microfone (ou importa uma gravação), corta, trata com os mesmos efeitos dos sons
 * e salva como a fala do jogo. Fala com `/api/vozes/...` (scripts/estudio/modulo-vozes.mjs). Textos e nomes só entram na tela por `textContent` (nunca como HTML).
 */
(() => {
  const { $, r2, ctx, msg, marcarSujo, api, postJson, tocar, parar, decodificar, desenharForma, Onda, atualizarPendencias, efeitosUi } = window.Estudio;

  const ROTULO = { br: 'Brasileiro', en: 'Inglês', ru: 'Sotaque russo', cn: 'Sotaque chinês' };
  const INTENCAO = {
    grave: 'Grave e firme, separando as sílabas, como quem anuncia o começo de algo importante.',
    grito: 'Grito curto e explosivo, com raiva boa: a voz sobe no fim. Chegue perto do microfone (uns 15 cm) e solte.',
    seco: 'Seco, tenso e baixo, sem enfeite: um aviso.',
  };
  /** Pontos de partida para a prévia (o gosto é de quem ouve; depois é só ajustar os números). */
  const PREDEFINIDOS = [
    ['Locutor grave', { pitch_st: -2, graves_db: 4, agudos_db: 2, passa_alta_hz: 70, compressor: 'forte', saturacao: 0.15, eco_ms: 90, eco_decay: 0.25 }],
    ['Arena', { eco_ms: 180, eco_decay: 0.35, compressor: 'medio', graves_db: 3 }],
    ['Rádio de comando', { passa_alta_hz: 400, passa_baixa_hz: 3400, saturacao: 0.3, compressor: 'forte' }],
    ['Limpo', { passa_alta_hz: 80, ruido_db: 12, compressor: 'leve' }],
    ['Demônio', { pitch_st: -6, graves_db: 5, saturacao: 0.25, eco_ms: 120, eco_decay: 0.4, compressor: 'forte' }],
  ];
  const LIMITE_DA_GRAVACAO_S = 10;

  let V = null;            // o estado do módulo no servidor
  let gravacoes = [];      // as falas gravadas, em edição
  let sotaque = 'br';
  let chave = null;
  let tomada = null;       // o arquivo da tomada aberta
  let buf = null;          // o AudioBuffer dela

  const EF = efeitosUi('vz');
  EF.montar($('#vz-efeitos'));
  const onda = new Onda($('#vz-onda'), {
    aoMudar: () => { campos(); marcarSujo(); },
    aoSoltar: () => { ajustarFade(true); campos(); },
  });

  const falaAtual = () => V?.falas.find((f) => f.chave === chave);
  const entradaDe = (s, c) => gravacoes.find((g) => g.sotaque === s && g.chave === c);
  const num = (id) => Number($(id).value) || 0;

  // ── campos do corte ─────────────────────────────────────────────────────────────────────────────
  function campos() {
    $('#vz-de').value = r2(onda.sel.de);
    $('#vz-ate').value = r2(onda.sel.ate);
    const vel = Number($('#vz-velocidade').value) || 1;
    $('#vz-duracao').textContent = buf ? `trecho: ${r2(onda.sel.ate - onda.sel.de)} s${vel !== 1 ? ` · depois da velocidade: ${r2((onda.sel.ate - onda.sel.de) / vel)} s` : ''}` : '';
  }
  function ajustarFade(avisar = false) {
    const dur = (onda.sel.ate - onda.sel.de) / (Number($('#vz-velocidade').value) || 1);
    const maximo = Math.max(0, Math.floor(dur * 500));
    for (const [id, nome] of [['#vz-fade', 'de saída'], ['#vz-fade-in', 'de entrada']]) {
      if (num(id) > maximo) { $(id).value = maximo; if (avisar) msg(`O fade ${nome} foi encurtado para ${maximo} ms: não pode passar de metade da fala (${r2(dur)} s).`); }
    }
  }
  function resumir() {
    const e = EF.ler(), r = [];
    if (e.velocidade) r.push(`×${e.velocidade}`);
    if (e.pitch_st) r.push(`tom ${e.pitch_st > 0 ? '+' : ''}${e.pitch_st}`);
    if (e.graves_db || e.agudos_db) r.push('equalização');
    if (e.passa_alta_hz || e.passa_baixa_hz) r.push('filtro');
    if (e.ruido_db) r.push('ruído');
    if (e.saturacao) r.push('saturação');
    if (e.compressor) r.push(`comp. ${e.compressor}`);
    if (e.eco_ms) r.push('eco');
    if (e.reverso) r.push('reverso');
    $('#vz-resumo').textContent = r.length ? `— ligados: ${r.join(', ')}` : '— nenhum ligado';
    campos();
  }
  function sincronizarAlvo() {
    $('#vz-alvo').value = buf ? r2((onda.sel.ate - onda.sel.de) / (Number($('#vz-velocidade').value) || 1)) : '';
  }
  function escreverEfeitos(e = {}) { EF.escrever(e); sincronizarAlvo(); resumir(); }
  for (const id of EF.ids) {
    $(id).addEventListener('change', () => {
      if (id === '#vz-alvo') {
        const alvo = Number($('#vz-alvo').value), dur = onda.sel.ate - onda.sel.de;
        if (alvo > 0 && dur > 0) $('#vz-velocidade').value = r2(Math.min(2, Math.max(0.5, dur / alvo)));
      }
      if (id === '#vz-velocidade' || id === '#vz-alvo') { sincronizarAlvo(); ajustarFade(true); }
      resumir(); marcarSujo();
    });
  }
  for (const id of ['#vz-fade', '#vz-ganho']) $(id).addEventListener('change', () => marcarSujo());
  for (const id of ['#vz-de', '#vz-ate']) {
    $(id).addEventListener('change', () => {
      if (!buf) return;
      const de = Math.max(0, num('#vz-de')), ate = Math.min(buf.duration, num('#vz-ate'));
      if (ate > de) { onda.sel = { de, ate }; marcarSujo(); ajustarFade(true); }
      campos(); onda.desenhar();
    });
  }
  $('#vz-aparar').addEventListener('click', () => {
    if (!buf) return msg('Grave ou escolha uma tomada primeiro.', 'erro');
    if (onda.aparar()) { marcarSujo(); ajustarFade(true); campos(); sincronizarAlvo(); msg(`Corte ajustado para onde há voz: ${r2(onda.sel.de)} s a ${r2(onda.sel.ate)} s.`, 'ok'); }
    else msg('Não achei voz para aparar.', 'erro');
  });
  for (const [nome, ef] of PREDEFINIDOS) {
    const b = document.createElement('button');
    b.className = 'pequeno'; b.textContent = nome;
    b.addEventListener('click', () => { escreverEfeitos(ef); ajustarFade(true); marcarSujo(); if (buf) $('#vz-previa').click(); });
    $('#vz-predefinidos').append(b);
  }

  // ── sotaques e falas ────────────────────────────────────────────────────────────────────────────
  function montarSotaques() {
    const alvo = $('#vz-sotaques');
    alvo.replaceChildren();
    for (const s of V.sotaques) {
      const b = document.createElement('button');
      b.textContent = ROTULO[s] ?? s;
      b.className = s === sotaque ? 'forte' : '';
      b.addEventListener('click', () => { sotaque = s; montarSotaques(); listarFalas(); abrirFala(chave); });
      alvo.append(b);
    }
  }
  function situacao(s, c) {
    if (entradaDe(s, c)) return ['●', 'gravada por você'];
    if (V.geradas[s]?.includes(c)) return ['◆', 'voz gerada (ElevenLabs)'];
    return ['○', 'sem áudio'];
  }
  function listarFalas() {
    const ul = $('#vz-lista');
    ul.replaceChildren();
    for (const f of V.falas) {
      const li = document.createElement('li');
      if (f.chave === chave) li.className = 'ativo';
      const [marca, dica] = situacao(sotaque, f.chave);
      const n = document.createElement('span');
      n.textContent = `${marca} ${f.texto[sotaque]}`;
      n.title = `${f.chave} · ${dica}`;
      const d = document.createElement('small');
      d.textContent = f.chave;
      li.append(n, d);
      li.addEventListener('click', () => abrirFala(f.chave));
      ul.append(li);
    }
  }
  function tomadasDaFala() { return V.tomadas.filter((t) => t.sotaque === sotaque && t.chave === chave).sort((a, b) => a.numero - b.numero); }
  function listarTomadas(selecionar) {
    const sel = $('#vz-tomadas');
    sel.replaceChildren();
    for (const t of tomadasDaFala()) sel.append(new Option(`tomada ${t.numero}${t.duracao != null ? ` (${t.duracao} s)` : ''}`, t.arquivo));
    if (selecionar && [...sel.options].some((o) => o.value === selecionar)) sel.value = selecionar;
    else if (sel.options.length) sel.value = sel.options[sel.options.length - 1].value;
  }
  async function abrirTomada(arquivo, corte) {
    if (!arquivo) { buf = null; tomada = null; onda.definir(null); $('#vz-duracao').textContent = ''; return; }
    const r = await fetch(`/api/vozes/gravacao/${sotaque}/${encodeURIComponent(arquivo)}`);
    if (!r.ok) { msg(`Não consegui abrir a tomada ${arquivo}`, 'erro'); return; }
    buf = await decodificar(await r.arrayBuffer());
    tomada = arquivo;
    onda.definir(buf, corte ?? { de: 0, ate: Math.min(buf.duration, 8) });
    sincronizarAlvo(); campos();
  }
  async function abrirFala(c) {
    parar();
    const f = V.falas.find((x) => x.chave === c) ?? V.falas[0];
    chave = f.chave;
    $('#vz-titulo').textContent = `${ROTULO[sotaque] ?? sotaque} · ${f.chave} · ${f.estilo}`;
    $('#vz-texto').textContent = f.texto[sotaque];
    $('#vz-intencao').textContent = INTENCAO[f.estilo] ?? '';
    const [marca, dica] = situacao(sotaque, f.chave);
    $('#vz-info').textContent = `${marca} ${dica}`;
    const e = entradaDe(sotaque, f.chave);
    listarTomadas(e?.fonte);
    $('#vz-resultado').hidden = true;
    if (e) {
      $('#vz-fade').value = e.fade_ms; $('#vz-ganho').value = e.ganho_db ?? 0;
      await abrirTomada(e.fonte, { de: e.de, ate: e.ate });
      escreverEfeitos(e.efeitos ?? {});
    } else {
      $('#vz-fade').value = 60; $('#vz-ganho').value = 0;
      escreverEfeitos({});
      await abrirTomada($('#vz-tomadas').value || null);
      if (buf && onda.aparar()) campos();
    }
    onda.desenhar();
    listarFalas();
    $('#vz-reverter').disabled = !e;
  }
  $('#vz-tomadas').addEventListener('change', async () => { await abrirTomada($('#vz-tomadas').value); if (onda.aparar()) campos(); marcarSujo(); });

  // ── gravar ──────────────────────────────────────────────────────────────────────────────────────
  let gravador = null, fluxo = null, partes = [], analisador = null, temporizador = null, comeco = 0;
  function liberarMicrofone() {
    clearInterval(temporizador); temporizador = null;
    if (fluxo) { for (const t of fluxo.getTracks()) t.stop(); fluxo = null; }
    $('#vz-nivel').style.width = '0';
    $('#vz-gravar').disabled = false; $('#vz-parar-gravacao').disabled = true;
  }
  async function comecarGravacao() {
    if (!chave) return msg('Escolha uma fala primeiro.', 'erro');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return msg('Este navegador não grava áudio. Use o Chrome, ou importe uma gravação feita no celular.', 'erro');
    try {
      parar();
      if (ctx.state === 'suspended') await ctx.resume();
      // Sem cancelamento de eco, supressão de ruído nem ganho automático: o tratamento é nosso (e a voz chega crua, com a dinâmica toda).
      fluxo = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch (e) {
      return msg(`Sem acesso ao microfone (${e.name}). Libere o microfone para esta página no navegador (o cadeado ao lado do endereço), ou importe uma gravação.`, 'erro');
    }
    const tipo = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find((t) => MediaRecorder.isTypeSupported(t));
    gravador = new MediaRecorder(fluxo, tipo ? { mimeType: tipo } : undefined);
    partes = [];
    gravador.ondataavailable = (e) => { if (e.data.size) partes.push(e.data); };
    const fala = chave, sot = sotaque;
    gravador.onstop = () => enviar(new Blob(partes, { type: gravador.mimeType || 'audio/webm' }), fala, sot);
    const fonte = ctx.createMediaStreamSource(fluxo);
    analisador = ctx.createAnalyser(); analisador.fftSize = 1024;
    fonte.connect(analisador);
    const amostras = new Float32Array(analisador.fftSize);
    gravador.start();
    comeco = performance.now();
    $('#vz-gravar').disabled = true; $('#vz-parar-gravacao').disabled = false;
    temporizador = setInterval(() => {
      analisador.getFloatTimeDomainData(amostras);
      let pico = 0; for (const v of amostras) pico = Math.max(pico, Math.abs(v));
      $('#vz-nivel').style.width = `${Math.min(100, pico * 100)}%`;
      $('#vz-nivel').style.background = pico > 0.95 ? 'var(--vermelho)' : 'var(--verde)';
      const s = (performance.now() - comeco) / 1000;
      $('#vz-estado-gravacao').textContent = `● gravando ${r2(s)} s${pico > 0.95 ? ' — ALTO DEMAIS: afaste-se do microfone' : ''}`;
      if (s >= LIMITE_DA_GRAVACAO_S) pararGravacao();
    }, 80);
  }
  function pararGravacao() {
    if (gravador && gravador.state !== 'inactive') gravador.stop();
    liberarMicrofone();
    $('#vz-estado-gravacao').textContent = 'enviando…';
  }
  /** Manda o áudio bruto ao servidor (que converte para WAV e numera a tomada) e abre a tomada nova já aparada. */
  async function enviar(corpo, fala, sot) {
    try {
      const r = await fetch(`/api/vozes/gravar?sotaque=${sot}&chave=${encodeURIComponent(fala)}`, { method: 'POST', headers: { 'content-type': corpo.type || 'application/octet-stream' }, body: corpo });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro);
      V = (await api('/api/estado')).vozes;
      msg(`Tomada ${j.numero} de "${fala}" guardada (${j.duracao} s).`, 'ok');
      if (sot === sotaque && fala === chave) {
        listarTomadas(j.arquivo);
        await abrirTomada(j.arquivo);
        if (onda.aparar()) campos();
        ajustarFade(); sincronizarAlvo();
        marcarSujo();
      }
      $('#vz-estado-gravacao').textContent = '';
    } catch (e) { msg(`Gravação: ${e.message}`, 'erro'); $('#vz-estado-gravacao').textContent = ''; }
  }
  $('#vz-gravar').addEventListener('click', comecarGravacao);
  $('#vz-parar-gravacao').addEventListener('click', pararGravacao);
  $('#vz-importar').addEventListener('click', () => $('#vz-arquivo').click());
  $('#vz-arquivo').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (!chave) return msg('Escolha uma fala primeiro.', 'erro');
    await enviar(f, chave, sotaque);
  });

  // ── ouvir, prévia, salvar ───────────────────────────────────────────────────────────────────────
  $('#vz-ouvir-atual').addEventListener('click', async () => {
    if (!chave) return;
    const r = await fetch(`/api/vozes/saida/${sotaque}/${chave}.mp3?t=${Date.now()}`);
    if (!r.ok) return msg('Esta fala ainda não tem áudio neste sotaque.', 'erro');
    parar(); tocar(await decodificar(await r.arrayBuffer()), { ganho: 0.9 });
  });
  $('#vz-ouvir-tomada').addEventListener('click', () => { if (!buf) return msg('Grave ou escolha uma tomada primeiro.', 'erro'); parar(); tocar(buf, { de: onda.sel.de, ate: onda.sel.ate, ganho: 0.9 }); });
  $('#vz-parar').addEventListener('click', parar);

  function gravacaoAtual() {
    const g = { sotaque, chave, fonte: tomada, de: r2(onda.sel.de), ate: r2(onda.sel.ate), fade_ms: Math.round(num('#vz-fade')) };
    if (num('#vz-ganho')) g.ganho_db = num('#vz-ganho');
    const ef = EF.ler();
    if (Object.keys(ef).length) g.efeitos = ef;
    return g;
  }
  async function previa() {
    if (!buf || !tomada) throw new Error('Grave ou escolha uma tomada primeiro.');
    const { sotaque: s, chave: c, ...gravacao } = gravacaoAtual();
    const r = await fetch('/api/vozes/previa', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sotaque: s, chave: c, gravacao }) });
    if (!r.ok) {
      let corpo = null; try { corpo = await r.json(); } catch { /* sem corpo */ }
      throw new Error(corpo?.erros?.join('\n') ?? corpo?.erro ?? `erro ${r.status}`);
    }
    const info = JSON.parse(r.headers.get('x-resultado') ?? '{}');
    const buffer = await decodificar(await r.arrayBuffer());
    const cv = $('#vz-resultado');
    cv.hidden = false;
    desenharForma(cv, buffer);
    $('#vz-info').textContent = `prévia: ${r2(info.duracao)} s · pico ${r2(info.picoDb)} dB · ganho ${info.ganhoDb >= 0 ? '+' : ''}${r2(info.ganhoDb)} dB`;
    return buffer;
  }
  $('#vz-previa').addEventListener('click', async () => {
    try { parar(); tocar(await previa(), { ganho: 0.9 }); } catch (e) { msg(e.message, 'erro'); }
  });
  $('#vz-salvar').addEventListener('click', async () => {
    try {
      if (!buf || !tomada) throw new Error('Grave ou escolha uma tomada primeiro.');
      ajustarFade(true);
      const nova = gravacaoAtual();
      const i = gravacoes.findIndex((g) => g.sotaque === sotaque && g.chave === chave);
      if (i >= 0) gravacoes[i] = nova; else gravacoes.push(nova);
      await postJson('/api/vozes/salvar', { gravacoes });
      const r = await postJson('/api/vozes/processar', { sotaque, chave });
      V = (await api('/api/estado')).vozes;
      gravacoes = structuredClone(V.gravacoes);
      marcarSujo(false);
      const x = r.resultado;
      msg(`"${chave}" (${ROTULO[sotaque] ?? sotaque}) agora é a SUA voz no jogo: ${r2(x.duracao)} s, pico ${r2(x.picoDb)} dB, ganho ${x.ganhoDb >= 0 ? '+' : ''}${r2(x.ganhoDb)} dB${x.efeitos?.length ? ` · efeitos: ${x.efeitos.join(', ')}` : ''}. Teste no jogo com ?narrador=${sotaque}.`, 'ok');
      listarFalas(); $('#vz-reverter').disabled = false;
      const [marca, dica] = situacao(sotaque, chave);
      $('#vz-info').textContent = `${marca} ${dica}`;
      atualizarPendencias();
    } catch (e) { msg(e.message, 'erro'); }
  });
  $('#vz-reverter').addEventListener('click', async () => {
    if (!entradaDe(sotaque, chave)) return;
    if (!confirm(`Voltar "${chave}" para a voz gerada? A sua gravação continua guardada como tomada.`)) return;
    try {
      const r = await postJson('/api/vozes/reverter', { sotaque, chave });
      V = (await api('/api/estado')).vozes;
      gravacoes = structuredClone(V.gravacoes);
      msg(r.voltouParaAVozGerada ? `"${chave}" voltou para a voz gerada.` : `"${chave}" ficou sem áudio neste sotaque (não havia cópia da voz gerada).`, 'ok');
      listarFalas(); $('#vz-reverter').disabled = true;
      atualizarPendencias();
    } catch (e) { msg(e.message, 'erro'); }
  });

  // ── início ──────────────────────────────────────────────────────────────────────────────────────
  (async () => {
    try {
      V = (await api('/api/estado')).vozes;
      gravacoes = structuredClone(V.gravacoes);
      montarSotaques(); listarFalas(); resumir();
      await abrirFala(V.falas.find((f) => f.chave === 'combate')?.chave ?? V.falas[0].chave);
    } catch (e) { msg(`Vozes: não consegui falar com o estúdio: ${e.message}`, 'erro'); }
  })();
})();
