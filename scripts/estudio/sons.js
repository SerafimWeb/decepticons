'use strict';
/**
 * A aba SONS do Estúdio (P150, P155): onda, corte, efeitos, prévia, importar-e-registrar, e a tabela de qual clipe toca em cada arma.
 * Fala com `/api/sons/...` (scripts/estudio/modulo-sons.mjs). Nomes de arquivo e de clipe só entram na tela por `textContent` (nunca como HTML).
 */
(() => {
  const { $, r2, msg, marcarSujo, api, postJson, tocar, parar, ritmo, decodificar, ganhoDeNormalizacao, desenharForma, Onda, iniciarAbas, atualizarPendencias } = window.Estudio;

  let E = null;          // o estado de sons do servidor
  let sons = [];         // os clipes em edição
  let armas = {};        // a tabela de armas em edição
  let fonteAtual = null; // o arquivo aberto na onda
  let buf = null;        // o AudioBuffer dele
  let clipeAtual = null; // o destino do clipe em edição
  let rubberband = false;

  const destinoDe = (clipe) => `${clipe}.mp3`;
  const clipeDe = (destino) => destino.replace(/\.mp3$/, '');
  const velocidadeDe = (s) => s.efeitos?.velocidade ?? 1;
  const duracaoFinalDe = (s) => (s.ate - s.de) / velocidadeDe(s);

  const onda = new Onda($('#onda'), {
    aoMudar: () => { campos(); marcarSujo(); },
    aoSoltar: () => { ajustarFade(true); campos(); },
  });

  // ── os campos do corte ──────────────────────────────────────────────────────────────────────────
  function campos() {
    $('#de').value = r2(onda.sel.de);
    $('#ate').value = r2(onda.sel.ate);
    const vel = Number($('#ef-velocidade').value) || 1;
    $('#duracao').textContent = buf ? `trecho: ${r2(onda.sel.ate - onda.sel.de)} s de ${r2(buf.duration)} s${vel !== 1 ? ` · depois da velocidade: ${r2((onda.sel.ate - onda.sel.de) / vel)} s` : ''}` : '';
  }
  /** O fade não pode passar de metade do som final (o servidor recusa): em vez de dar erro, a página encurta o fade e avisa. */
  function ajustarFade(avisar = false) {
    const dur = (onda.sel.ate - onda.sel.de) / (Number($('#ef-velocidade').value) || 1);
    const maximo = Math.max(0, Math.floor(dur * 500));
    for (const [id, nome] of [['#fade', 'de saída'], ['#ef-fade-in', 'de entrada']]) {
      if ((Number($(id).value) || 0) > maximo) {
        $(id).value = maximo;
        if (avisar) msg(`O fade ${nome} foi encurtado para ${maximo} ms: não pode passar de metade do som (${r2(dur)} s).`);
      }
    }
  }
  for (const id of ['#de', '#ate']) {
    $(id).addEventListener('change', () => {
      if (!buf) return;
      const de = Math.max(0, Number($('#de').value)), ate = Math.min(buf.duration, Number($('#ate').value));
      if (ate > de) { onda.sel = { de, ate }; marcarSujo(); ajustarFade(true); }
      campos(); onda.desenhar();
    });
  }
  for (const id of ['#fade', '#ganho-extra']) $(id).addEventListener('change', () => marcarSujo());
  $('#btn-aparar').addEventListener('click', () => {
    if (!buf) return msg('Abra uma referência primeiro.', 'erro');
    if (onda.aparar()) { marcarSujo(); ajustarFade(true); campos(); msg(`Corte ajustado para onde há som: ${r2(onda.sel.de)} s a ${r2(onda.sel.ate)} s.`, 'ok'); }
    else msg('Não achei som para aparar neste arquivo.', 'erro');
  });

  // ── os efeitos ──────────────────────────────────────────────────────────────────────────────────
  const CAMPOS_EF = ['#ef-velocidade', '#ef-alvo', '#ef-pitch', '#ef-graves', '#ef-agudos', '#ef-passa-alta', '#ef-passa-baixa', '#ef-ruido', '#ef-saturacao', '#ef-compressor', '#ef-eco-ms', '#ef-eco-decay', '#ef-fade-in', '#ef-reverso'];
  const num = (id) => Number($(id).value) || 0;

  /** Lê os efeitos da tela: só o que está ligado (o objeto vazio quer dizer "sem efeitos"). */
  function lerEfeitos() {
    const e = {};
    const vel = num('#ef-velocidade');
    if (vel && vel !== 1) e.velocidade = r2(vel);
    if (num('#ef-pitch')) e.pitch_st = num('#ef-pitch');
    if (num('#ef-graves')) e.graves_db = num('#ef-graves');
    if (num('#ef-agudos')) e.agudos_db = num('#ef-agudos');
    if (num('#ef-passa-alta') > 0) e.passa_alta_hz = num('#ef-passa-alta');
    if (num('#ef-passa-baixa') > 0) e.passa_baixa_hz = num('#ef-passa-baixa');
    if (num('#ef-ruido') > 0) e.ruido_db = num('#ef-ruido');
    if (num('#ef-saturacao') > 0) e.saturacao = num('#ef-saturacao');
    if ($('#ef-compressor').value) e.compressor = $('#ef-compressor').value;
    if (num('#ef-eco-ms') > 0) { e.eco_ms = num('#ef-eco-ms'); e.eco_decay = num('#ef-eco-decay') || 0.3; }
    if ($('#ef-reverso').checked) e.reverso = true;
    if (num('#ef-fade-in') > 0) e.fade_in_ms = num('#ef-fade-in');
    return e;
  }
  function escreverEfeitos(e = {}) {
    $('#ef-velocidade').value = e.velocidade ?? 1;
    $('#ef-pitch').value = e.pitch_st ?? 0;
    $('#ef-graves').value = e.graves_db ?? 0;
    $('#ef-agudos').value = e.agudos_db ?? 0;
    $('#ef-passa-alta').value = e.passa_alta_hz ?? 0;
    $('#ef-passa-baixa').value = e.passa_baixa_hz ?? 0;
    $('#ef-ruido').value = e.ruido_db ?? 0;
    $('#ef-saturacao').value = e.saturacao ?? 0;
    $('#ef-compressor').value = e.compressor || '';
    $('#ef-eco-ms').value = e.eco_ms ?? 0;
    $('#ef-eco-decay').value = e.eco_decay ?? 0.3;
    $('#ef-fade-in').value = e.fade_in_ms ?? 0;
    $('#ef-reverso').checked = Boolean(e.reverso);
    sincronizarAlvo();
    resumirEfeitos();
  }
  function resumirEfeitos() {
    const e = lerEfeitos(), r = [];
    if (e.velocidade) r.push(`×${e.velocidade}`);
    if (e.pitch_st) r.push(`tom ${e.pitch_st > 0 ? '+' : ''}${e.pitch_st}`);
    if (e.graves_db) r.push('graves');
    if (e.agudos_db) r.push('agudos');
    if (e.passa_alta_hz || e.passa_baixa_hz) r.push('filtro');
    if (e.ruido_db) r.push('ruído');
    if (e.saturacao) r.push('saturação');
    if (e.compressor) r.push(`comp. ${e.compressor}`);
    if (e.eco_ms) r.push('eco');
    if (e.reverso) r.push('reverso');
    $('#resumo-efeitos').textContent = r.length ? `— ligados: ${r.join(', ')}` : '— nenhum ligado';
    campos();
  }
  /** Velocidade e duração-alvo são a mesma coisa vista de dois lados: mexer num atualiza o outro. */
  function sincronizarAlvo() {
    const vel = Number($('#ef-velocidade').value) || 1;
    $('#ef-alvo').value = buf ? r2((onda.sel.ate - onda.sel.de) / vel) : '';
  }
  $('#ef-alvo').addEventListener('change', () => {
    const alvo = Number($('#ef-alvo').value), dur = onda.sel.ate - onda.sel.de;
    if (!(alvo > 0) || !(dur > 0)) return;
    const vel = Math.min(2, Math.max(0.5, dur / alvo));
    $('#ef-velocidade').value = r2(vel);
    if (r2(dur / vel) !== r2(alvo)) msg(`A velocidade vai de 0,5× a 2×: a duração mais perto possível é ${r2(dur / vel)} s.`);
    sincronizarAlvo(); ajustarFade(true); resumirEfeitos(); marcarSujo();
  });
  for (const id of CAMPOS_EF.filter((c) => c !== '#ef-alvo')) {
    $(id).addEventListener('change', () => { if (id === '#ef-velocidade') { sincronizarAlvo(); ajustarFade(true); } resumirEfeitos(); marcarSujo(); });
  }
  $('#btn-zerar-efeitos').addEventListener('click', () => { escreverEfeitos({}); marcarSujo(); msg('Efeitos zerados.'); });

  // Predefinidos: pontos de partida para a prévia (o gosto é de quem ouve; depois é só ajustar os números).
  const PREDEFINIDOS = [
    ['Grave e pesado', { pitch_st: -3, graves_db: 4, compressor: 'medio' }],
    ['Agudo e estalado', { pitch_st: 3, agudos_db: 3, saturacao: 0.2 }],
    ['Metálico', { pitch_st: 5, passa_alta_hz: 300, eco_ms: 40, eco_decay: 0.3 }],
    ['Eco de arena', { eco_ms: 180, eco_decay: 0.4, compressor: 'leve' }],
    ['Rádio sujo', { passa_alta_hz: 400, passa_baixa_hz: 3400, saturacao: 0.3, compressor: 'forte' }],
    ['Esmagado', { saturacao: 0.6, compressor: 'forte', graves_db: 3 }],
    ['Mais curto e seco', { velocidade: 1.4, compressor: 'leve' }],
    ['Mais longo e arrastado', { velocidade: 0.7, pitch_st: -2 }],
  ];
  for (const [nome, ef] of PREDEFINIDOS) {
    const b = document.createElement('button');
    b.className = 'pequeno';
    b.textContent = nome;
    b.addEventListener('click', () => { escreverEfeitos(ef); ajustarFade(true); marcarSujo(); if (buf) $('#btn-previa').click(); });
    $('#predefinidos').append(b);
  }

  // ── referências e clipes ────────────────────────────────────────────────────────────────────────
  async function abrirFonte(nome) {
    parar();
    const r = await fetch(`/api/sons/fonte/${encodeURIComponent(nome)}`);
    if (!r.ok) { msg(`Não consegui abrir ${nome}`, 'erro'); return false; }
    buf = await decodificar(await r.arrayBuffer());
    fonteAtual = nome;
    $('#nome-fonte').textContent = `${nome} (${r2(buf.duration)} s)`;
    onda.definir(buf, { de: 0, ate: Math.min(buf.duration, 1) });
    listarFontes();
    return true;
  }
  function listarFontes() {
    const ul = $('#lista-fontes');
    ul.replaceChildren();
    for (const f of E.fontes) {
      const li = document.createElement('li');
      if (f.nome === fonteAtual) li.className = 'ativo';
      const n = document.createElement('span');
      n.textContent = f.nome.replace(/-Elevenlabs/i, '').replace(/\.(mp3|wav|ogg|m4a|flac|aac|webm)$/i, '').replace(/^WEAP/, '');
      const d = document.createElement('small');
      d.textContent = f.duracao != null ? `${f.duracao}s` : '';
      li.append(n, d);
      li.title = f.nome;
      li.addEventListener('click', async () => {
        if (!(await abrirFonte(f.nome))) return;
        clipeAtual = null; escreverEfeitos({}); $('#fade').value = 100; $('#ganho-extra').value = 0; ajustarFade(); campos(); listarClipes();
      });
      ul.append(li);
    }
    if (E.fontes.length === 0) { const li = document.createElement('li'); li.className = 'info'; li.textContent = 'Nenhuma referência. Importe um arquivo.'; ul.append(li); }
  }
  const usadoPorArma = (destino) => Object.entries(armas).filter(([, a]) => a.clipe === clipeDe(destino)).map(([id]) => id);
  async function abrirClipe(destino) {
    const s = sons.find((x) => x.destino === destino);
    if (!s) return;
    if (s.fonte !== fonteAtual && !(await abrirFonte(s.fonte))) return;
    onda.sel = { de: s.de, ate: s.ate };
    clipeAtual = s.destino;
    $('#nome-clipe').value = clipeDe(s.destino);
    $('#fade').value = s.fade_ms;
    $('#ganho-extra').value = s.ganho_db ?? 0;
    escreverEfeitos(s.efeitos ?? {});
    campos(); onda.desenhar(); listarFontes(); listarClipes();
  }
  function listarClipes() {
    const ul = $('#lista-clipes');
    ul.replaceChildren();
    for (const s of sons) {
      const li = document.createElement('li');
      if (s.destino === clipeAtual) li.className = 'ativo';
      const n = document.createElement('span');
      n.textContent = clipeDe(s.destino) + (s.efeitos && Object.keys(s.efeitos).length ? ' ✦' : '');
      const d = document.createElement('small');
      d.textContent = `${r2(duracaoFinalDe(s))}s`;
      const x = document.createElement('button');
      x.className = 'x'; x.textContent = '✕'; x.title = 'Remover este clipe';
      x.addEventListener('click', (e) => {
        e.stopPropagation();
        const quem = usadoPorArma(s.destino);
        if (quem.length) { msg(`${clipeDe(s.destino)} é usado por: ${quem.join(', ')}. Troque o clipe dessas armas antes de remover.`, 'erro'); return; }
        if (!confirm(`Remover o clipe ${clipeDe(s.destino)}?`)) return;
        sons = sons.filter((y) => y.destino !== s.destino); marcarSujo(); listarClipes(); montarArmas();
      });
      li.append(n, d, x);
      li.title = `${s.fonte} (${s.de}–${s.ate})${s.efeitos ? ' ✦ com efeitos' : ''}`;
      li.addEventListener('click', () => abrirClipe(s.destino));
      ul.append(li);
    }
  }

  // ── ouvir ───────────────────────────────────────────────────────────────────────────────────────
  function ouvirTrecho(quando = 0) {
    tocar(buf, { de: onda.sel.de, ate: onda.sel.ate, fadeMs: num('#fade'), ganho: ganhoDeNormalizacao(buf, onda.sel.de, onda.sel.ate, num('#ganho-extra')) * 0.8, quando });
  }
  /** O clipe como está na tela (salvo ou não), para a prévia e para o salvar. */
  function somAtual() {
    const som = { fonte: fonteAtual, de: r2(onda.sel.de), ate: r2(onda.sel.ate), fade_ms: Math.round(num('#fade')) };
    if (num('#ganho-extra')) som.ganho_db = num('#ganho-extra');
    const ef = lerEfeitos();
    if (Object.keys(ef).length) som.efeitos = ef;
    return som;
  }
  let ultimaPrevia = null; // { buffer, info }
  /** A PRÉVIA: o servidor roda o mesmo ffmpeg do arquivo final (efeitos, normalização, limitador) e devolve o som, sem gravar nada no jogo. */
  async function previa() {
    if (!buf) throw new Error('Abra uma referência primeiro.');
    const r = await fetch('/api/sons/previa', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ som: somAtual() }) });
    if (!r.ok) {
      let corpo = null; try { corpo = await r.json(); } catch { /* sem corpo */ }
      throw new Error(corpo?.erros?.join('\n') ?? corpo?.erro ?? `erro ${r.status}`);
    }
    const info = JSON.parse(r.headers.get('x-resultado') ?? '{}');
    const buffer = await decodificar(await r.arrayBuffer());
    ultimaPrevia = { buffer, info };
    const cv = $('#onda-resultado');
    cv.hidden = false;
    desenharForma(cv, buffer);
    $('#resultado').textContent = `prévia: ${r2(info.duracao)} s · pico ${r2(info.picoDb)} dB · ganho ${info.ganhoDb >= 0 ? '+' : ''}${r2(info.ganhoDb)} dB`;
    return ultimaPrevia;
  }
  $('#btn-ouvir').addEventListener('click', () => { if (!buf) return msg('Abra uma referência primeiro.', 'erro'); parar(); ouvirTrecho(); });
  $('#btn-parar').addEventListener('click', parar);
  $('#btn-previa').addEventListener('click', async () => {
    try { parar(); const p = await previa(); tocar(p.buffer, { ganho: 0.8 }); } catch (e) { msg(e.message, 'erro'); }
  });
  $('#btn-ritmo').addEventListener('click', async () => {
    if (!buf) return msg('Abra uma referência primeiro.', 'erro');
    const arma = E.info.find((a) => a.id === $('#ritmo-arma').value);
    try {
      const p = await previa(); // no ritmo se ouve o som de verdade (com os efeitos)
      ritmo((t) => tocar(p.buffer, { ganho: 0.8, quando: t }), arma.intervalo);
    } catch (e) { msg(e.message, 'erro'); ritmo((t) => ouvirTrecho(t), arma.intervalo); }
  });

  // ── salvar, processar ───────────────────────────────────────────────────────────────────────────
  $('#btn-salvar-corte').addEventListener('click', () => {
    if (!buf) return msg('Abra uma referência primeiro.', 'erro');
    let nome = $('#nome-clipe').value.trim().toLowerCase().replace(/\.mp3$/, '').replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
    if (!nome) return msg('Dê um nome ao clipe (ex.: arma_blaster).', 'erro');
    if (!nome.startsWith('arma_')) nome = `arma_${nome}`;
    ajustarFade(true);
    const novo = { destino: destinoDe(nome), ...somAtual() };
    const i = sons.findIndex((s) => s.destino === novo.destino);
    if (i >= 0) sons[i] = { ...novo, ...(sons[i].arma ? { arma: sons[i].arma } : {}), ...(sons[i].nota ? { nota: sons[i].nota } : {}) };
    else sons.push(novo);
    clipeAtual = novo.destino; $('#nome-clipe').value = nome;
    marcarSujo(); listarClipes(); montarArmas();
    msg(`Corte e efeitos salvos no clipe ${nome} (ainda falta SALVAR TUDO e Processar).`, 'ok');
  });
  async function salvar() {
    const r = await postJson('/api/sons/salvar', { sons, armas });
    marcarSujo(false);
    atualizarPendencias();
    return r;
  }
  async function processar(destino) {
    const r = await postJson('/api/sons/processar', destino ? { destino } : {});
    for (const x of r.resultados) {
      if (x.ok) {
        msg(`${x.destino}: ${r2(x.duracao)} s, pico ${r2(x.picoDb)} dB, média ${r2(x.mediaDb)} dB, ganho ${x.ganhoDb >= 0 ? '+' : ''}${r2(x.ganhoDb)} dB, ${r2(x.kb)} KB${x.efeitos?.length ? ` · efeitos: ${x.efeitos.join(', ')}` : ''}`, 'ok');
        if (x.ganhoDb > 15) msg(`${x.destino}: o trecho é muito fraco (ganho de +${r2(x.ganhoDb)} dB para chegar ao volume dos outros): vai subir o chiado. Corte onde o som está forte.`, 'erro');
      } else msg(`${x.destino}: ${x.erro}`, 'erro');
    }
    E.saidas = (await api('/api/estado')).sons.saidas;
    montarArmas();
    atualizarPendencias();
    return r;
  }
  $('#btn-salvar').addEventListener('click', async () => {
    try { const r = await salvar(); msg(`Salvo: ${r.sons} clipes e ${r.armas} armas. Falta processar o que mudou.`, 'ok'); } catch (e) { msg(e.message, 'erro'); }
  });
  $('#btn-processar').addEventListener('click', async () => {
    if (!clipeAtual) return msg('Salve o corte num clipe antes de processar.', 'erro');
    try { await salvar(); $('#resultado').textContent = 'processando…'; await processar(clipeAtual); $('#resultado').textContent = ''; } catch (e) { $('#resultado').textContent = ''; msg(e.message, 'erro'); }
  });
  $('#btn-processar-tudo').addEventListener('click', async () => {
    try { await salvar(); msg('Salvo. Processando todos os clipes…'); await processar(null); } catch (e) { msg(e.message, 'erro'); }
  });
  async function bufferDaSaida(clipe) {
    const r = await fetch(`/api/sons/saida/${encodeURIComponent(destinoDe(clipe))}?t=${Date.now()}`);
    if (!r.ok) throw new Error(`${clipe} ainda não foi processado: use "Processar" primeiro.`);
    return decodificar(await r.arrayBuffer());
  }
  $('#btn-ouvir-saida').addEventListener('click', async () => {
    if (!clipeAtual) return msg('Escolha um clipe na lista.', 'erro');
    try { parar(); tocar(await bufferDaSaida(clipeDe(clipeAtual)), { ganho: 0.8 }); } catch (e) { msg(e.message, 'erro'); }
  });

  // ── a tabela de armas ───────────────────────────────────────────────────────────────────────────
  function montarArmas() {
    const tb = $('#tabela-armas');
    tb.replaceChildren();
    const clipes = sons.map((s) => clipeDe(s.destino));
    const selRitmo = $('#ritmo-arma');
    if (!selRitmo.options.length) for (const a of E.info) selRitmo.append(new Option(`${a.nome} (${a.intervalo}s)`, a.id));
    for (const a of E.info) {
      const tr = document.createElement('tr');
      if (!a.aceita) tr.className = 'desligada';
      const cfg = armas[a.id];
      const td0 = document.createElement('td');
      const nomeArma = document.createElement('b'); nomeArma.textContent = a.nome;
      const pequeno = document.createElement('small'); pequeno.textContent = `${a.id} · ${a.intervalo}s entre tiros`;
      td0.append(nomeArma, pequeno);
      const sc = document.createElement('select');
      sc.append(new Option('— sintetizado —', ''));
      for (const c of clipes) sc.append(new Option(c, c));
      sc.value = cfg?.clipe ?? ''; sc.disabled = !a.aceita;
      const entrada = (campo, passo, min, max) => {
        const i = document.createElement('input');
        i.type = 'number'; i.step = passo; i.min = min; i.max = max; i.value = cfg?.[campo] ?? ''; i.disabled = !cfg || !a.aceita;
        i.addEventListener('change', () => { armas[a.id][campo] = Number(i.value); marcarSujo(); });
        return i;
      };
      const iGanho = entrada('ganho', 0.05, 0.05, 1.5), iPitch = entrada('pitch', 0.01, 0.5, 2), iMax = entrada('maxS', 0.05, 0.1, 6);
      sc.addEventListener('change', () => {
        if (!sc.value) delete armas[a.id];
        else {
          const s = sons.find((x) => x.destino === destinoDe(sc.value));
          const pitch = armas[a.id]?.pitch ?? 1;
          armas[a.id] = { clipe: sc.value, ganho: armas[a.id]?.ganho ?? 0.8, pitch, maxS: r2(Math.min(s ? duracaoFinalDe(s) / pitch : 1.5, 3)) };
        }
        marcarSujo(); montarArmas();
      });
      const ouvir = async (ritmado) => {
        const c = armas[a.id];
        if (!c) return msg(`${a.nome} usa o som sintetizado: escolha um clipe para ouvir.`, 'erro');
        try {
          parar();
          const b = await bufferDaSaida(c.clipe);
          const uma = (t) => tocar(b, { ganho: c.ganho, pitch: c.pitch, maxS: c.maxS, quando: t });
          if (ritmado) ritmo(uma, a.intervalo); else uma(0);
        } catch (e) { msg(e.message, 'erro'); }
      };
      const tdb = document.createElement('td');
      const b1 = document.createElement('button'); b1.textContent = '▶'; b1.disabled = !cfg; b1.addEventListener('click', () => ouvir(false));
      const b2 = document.createElement('button'); b2.textContent = '▶▶'; b2.title = 'No ritmo de tiro da arma (4 s)'; b2.disabled = !cfg; b2.style.marginLeft = '4px'; b2.addEventListener('click', () => ouvir(true));
      tdb.append(b1, b2);
      const celula = (el) => { const td = document.createElement('td'); td.append(el); return td; };
      tr.append(td0, celula(sc), celula(iGanho), celula(iPitch), celula(iMax), tdb);
      tb.append(tr);
    }
  }

  // ── importar e registrar ────────────────────────────────────────────────────────────────────────
  /** Cada arquivo é guardado, vira um clipe com nome próprio, é processado e fica registrado (o servidor faz tudo e o clipe já está no mapa). */
  async function importar(arquivos) {
    let ultimo = null;
    for (const f of arquivos) {
      const nome = f.name.replace(/[^A-Za-z0-9._ ()-]+/g, '_');
      try {
        const url = (extra = '') => `/api/sons/importar?nome=${encodeURIComponent(nome)}&registrar=1${extra}`;
        let r = await fetch(url(), { method: 'POST', body: f });
        if (r.status === 409 && confirm(`Já existe ${nome}. Substituir a referência? (o clipe que já usa este arquivo continua)`)) r = await fetch(url('&sobrescrever=1'), { method: 'POST', body: f });
        const corpo = await r.json();
        if (!r.ok) throw new Error(corpo.erros?.join('\n') ?? corpo.erro);
        if (corpo.som && !sons.some((s) => s.destino === corpo.som.destino)) sons.push(corpo.som);
        if (corpo.clipe) {
          msg(`Importado e registrado: ${nome} → clipe ${corpo.clipe} (${r2(corpo.resultado.duracao)} s, processado). Escolha uma arma na tabela para usá-lo.`, 'ok');
          ultimo = corpo.som.destino;
        } else msg(`Importado: ${nome}${corpo.aviso ? ` (${corpo.aviso})` : ''}`, 'ok');
      } catch (e) { msg(`${nome}: ${e.message}`, 'erro'); }
    }
    E = (await api('/api/estado')).sons;
    listarFontes(); listarClipes(); montarArmas();
    atualizarPendencias();
    if (ultimo) await abrirClipe(ultimo);
  }
  $('#btn-importar').addEventListener('click', () => $('#arquivo').click());
  $('#arquivo').addEventListener('change', (e) => { importar([...e.target.files]); e.target.value = ''; });
  let arrastos = 0;
  window.addEventListener('dragenter', (e) => { e.preventDefault(); arrastos++; $('#solta').style.display = 'grid'; });
  window.addEventListener('dragleave', () => { if (--arrastos <= 0) { arrastos = 0; $('#solta').style.display = 'none'; } });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => { e.preventDefault(); arrastos = 0; $('#solta').style.display = 'none'; importar([...e.dataTransfer.files]); });

  // ── início ──────────────────────────────────────────────────────────────────────────────────────
  (async () => {
    iniciarAbas();
    try {
      const tudo = await api('/api/estado');
      E = tudo.sons; rubberband = tudo.rubberband;
      sons = structuredClone(E.mapa.sons); armas = structuredClone(E.armas);
      if (!tudo.ffmpeg) msg('ffmpeg não encontrado neste computador: dá para cortar e ouvir, mas "Processar" e "Prévia" não funcionam (winget install Gyan.FFmpeg).', 'erro');
      $('#aviso-rubberband').textContent = rubberband
        ? 'Tom e velocidade independentes com o rubberband (qualidade de estúdio).'
        : 'Este ffmpeg não tem o rubberband: tom e velocidade independentes pelo método simples (qualidade um pouco menor).';
      listarFontes(); listarClipes(); montarArmas(); onda.desenhar(); resumirEfeitos();
      atualizarPendencias();
      if (sons[0]) await abrirClipe(sons[0].destino);
    } catch (e) { msg(`Não consegui falar com o estúdio: ${e.message}`, 'erro'); }
  })();
})();
