/**
 * Métricas (/cybermech/metricas/): a página privada do dono. Mostra de onde vêm as conexões, quantas entram, quantas são
 * recusadas e por quê, a partir de `GET /metricas` do servidor de jogo (contrato em `shared/net/telemetry.ts`).
 *
 * **Privada de verdade:** o servidor só responde com o token do dono (`.tmp/servidor/metricas-token.txt` no PC do servidor);
 * a página guarda o token só neste navegador (`localStorage`), não entra em busca (`noindex`) e não tem link no menu. Só
 * contagens: nenhum IP, nenhuma pessoa, nenhuma cidade. Cidade e tempo de sessão ficam no Google Analytics (já nas páginas).
 *
 * Uso: node scripts/metricas.mjs --out <.tmp/site/metricas/index.html>
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pagina, topo } from './site/tema.mjs';

const argv = process.argv.slice(2);
const OUT = resolve(argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : '.tmp/site/metricas/index.html');

const { runnerImport } = await import('vite');
const load = async (p) => (await runnerImport(resolve(p), { configFile: false, logLevel: 'silent' })).module;
const { serverHttpUrl } = await load('shared/net/serverUrl.ts');
const tel = await load('shared/net/telemetry.ts');
const status = await load('shared/net/status.ts');
const URL_METRICAS = serverHttpUrl(process.env.VITE_GAME_SERVER, tel.METRICAS_PATH);

const css = `
  .m-hero { display: grid; gap: 14px; padding-top: 30px; }
  .title { font: 400 clamp(3rem, 8vw, 5.5rem)/.9 var(--fs); letter-spacing: .04em; color: var(--amber); text-shadow: var(--glow); margin: 0; }
  .title span { color: var(--bone); }
  .pitch { font-size: 16px; line-height: 1.6; max-width: 66ch; text-wrap: pretty; }
  #painel { display: grid; gap: 64px; }
  #painel[hidden] { display: none; }
  #acesso { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  #acesso label { display: flex; gap: 8px; align-items: center; color: var(--muted); }
  #acesso input { width: min(34ch, 70vw); background: #0a0804; color: var(--bone); border: 1px solid var(--line2); padding: 8px 10px; font: inherit; }
  #acesso button { background: transparent; color: var(--amber); border: 1px solid var(--line2); padding: 8px 14px; font: inherit; cursor: pointer; letter-spacing: .08em; text-transform: uppercase; }
  #acesso button:hover, #acesso button:focus-visible { background: rgba(255,176,0,.12); outline: none; }
  #estado { color: var(--muted); min-height: 1.6em; }
  #estado.ruim { color: var(--red); }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; }
  .card { border: 1px solid var(--line); background: var(--panel); padding: 12px 14px; display: grid; gap: 4px; }
  .card .k { font-size: 11px; letter-spacing: .14em; color: var(--muted); text-transform: uppercase; }
  .card .v { font: 400 2.2rem/1 var(--fd); color: var(--amber); font-variant-numeric: tabular-nums; }
  .card .d { font-size: 12.5px; color: var(--muted); line-height: 1.35; }
  .card.ruim .v { color: var(--red); }
  .barras { display: grid; gap: 8px; }
  .barra { display: grid; grid-template-columns: minmax(130px, 220px) 1fr auto; gap: 10px; align-items: center; font-size: 14px; }
  .barra .trilho { height: 14px; background: #0a0804; border: 1px solid var(--line); }
  .barra .trilho i { display: block; height: 100%; background: var(--amber); }
  .barra .n { font-variant-numeric: tabular-nums; color: var(--bone); min-width: 8ch; text-align: right; }
  .barra small { color: var(--muted); }
  table.paises { width: 100%; border-collapse: collapse; font-size: 14px; font-variant-numeric: tabular-nums; }
  table.paises th, table.paises td { padding: 7px 10px; text-align: right; border-bottom: 1px solid var(--line); white-space: nowrap; }
  table.paises th:first-child, table.paises td:first-child { text-align: left; }
  table.paises thead th { font-weight: 400; font-size: 11px; letter-spacing: .14em; color: var(--muted); text-transform: uppercase; }
  .rolavel { overflow-x: auto; }
  svg.dias { width: 100%; height: auto; }
  svg.dias text { fill: var(--muted); font: 11px var(--fb); }
  .legenda { display: flex; flex-wrap: wrap; gap: 14px; font-size: 13px; color: var(--muted); }
  .legenda i { display: inline-block; width: 10px; height: 10px; margin-right: 6px; }
  .nota { padding: 16px 18px; border: 1px solid var(--line); background: var(--panel); display: grid; gap: 8px; font-size: 14px; }
  .nota ul { margin: 0; padding-left: 18px; display: grid; gap: 4px; }
  details.tabela summary { cursor: pointer; color: var(--amber); }
`;

const body = `
  ${topo({ base: '../', current: 'metricas', left: 'CYBERMECH // MÉTRICAS', live: 'privado · só contagens' })}
  <header class="m-hero">
    <h1 class="title">MÉ<span>TRICAS</span></h1>
    <p class="pitch">De onde vêm as conexões, quantos entram no jogo, quantos são recusados e por quê. <b>Só contagens</b>: nenhum IP, nenhuma pessoa, nenhuma cidade. O país vem da Cloudflare. Esta página só mostra algo com o <b>token</b> do servidor.</p>
    <form id="acesso" autocomplete="off">
      <label>token <input id="token" type="password" autocomplete="off" spellcheck="false" aria-label="Token das métricas"></label>
      <button type="submit">ver</button>
      <button type="button" id="atualizar">atualizar</button>
      <button type="button" id="esquecer">esquecer o token</button>
      <span id="estado" role="status" aria-live="polite"></span>
    </form>
  </header>

  <div id="painel" hidden>
    <section aria-labelledby="h-agora">
      <h2 id="h-agora">Agora</h2>
      <div class="cards" id="cards"></div>
    </section>
    <section aria-labelledby="h-funil">
      <h2 id="h-funil">Funil · últimos 7 dias</h2>
      <p class="lede">Da visita à partida. Cada barra é o total do passo; o número pequeno é quanto sobrou do passo anterior.</p>
      <div class="barras" id="funil"></div>
    </section>
    <section aria-labelledby="h-dias">
      <h2 id="h-dias">Por dia · últimos 14 dias</h2>
      <div class="legenda"><span><i style="background:var(--amber)"></i>jogo aberto</span><span><i style="background:var(--green)"></i>conexões online</span><span><i style="background:var(--red)"></i>recusadas</span></div>
      <svg class="dias" id="dias" viewBox="0 0 700 220" role="img" aria-label="Por dia: jogo aberto, conexões online e recusadas"></svg>
      <details class="tabela"><summary>ver os números em tabela</summary><div class="rolavel"><table class="paises" id="tab-dias"></table></div></details>
    </section>
    <section aria-labelledby="h-paises">
      <h2 id="h-paises">De onde vêm · últimos 30 dias</h2>
      <p class="lede">País de quem abriu o jogo, entrou numa sala ou foi recusado. <b>??</b> = a Cloudflare não soube dizer.</p>
      <div class="rolavel"><table class="paises" id="paises"></table></div>
    </section>
  </div>

  <section class="nota" aria-labelledby="h-nota">
    <h3 id="h-nota">Como ler, e onde achar o resto</h3>
    <ul>
      <li><b>Jogo aberto</b> é o jogo carregando num navegador (offline ou online). <b>Conexões online</b> são as que chegaram ao servidor; <b>entradas</b>, as que escolheram uma montagem e entraram numa sala.</li>
      <li><b>Recusada por versão</b> = a pessoa abriu o jogo numa versão que o servidor não conhece (o servidor atrasou em relação ao site). Se esse número sobe, o servidor precisa atualizar.</li>
      <li>O token está no arquivo <code>.tmp/servidor/metricas-token.txt</code> do PC do servidor (gerado na primeira subida) ou na variável <code>CYBERMECH_METRICAS_TOKEN</code>. Ele fica só neste navegador.</li>
      <li><b>Cidade, aparelho, tempo no site e de onde veio o clique</b>: Google Analytics (a tag já está nas páginas): <code>analytics.google.com</code> → Relatórios → Público → Detalhes demográficos.</li>
    </ul>
  </section>
  <footer><span>CYBERMECH © ${new Date().getFullYear()} <b>SERAFIM WEB</b> · contagens do servidor de jogo, sem dados pessoais</span><span>${URL_METRICAS ? 'servidor configurado neste build' : 'sem servidor neste build · use ?servidor='}</span></footer>
`;

// O JavaScript da página. Dados do servidor entram só por textContent e atributos de SVG (nunca innerHTML).
const js = `(() => {
  'use strict';
  const PADRAO = ${JSON.stringify(URL_METRICAS)};
  const HEADER = ${JSON.stringify(tel.METRICAS_HEADER)};
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  // ?servidor=https://... (ou ws://) troca o servidor; o caminho é sempre o do contrato.
  const servidor = (() => {
    const s = params.get('servidor');
    if (!s) return PADRAO;
    try { const u = new URL(s); u.protocol = u.protocol === 'wss:' ? 'https:' : u.protocol === 'ws:' ? 'http:' : u.protocol; u.pathname = ${JSON.stringify(tel.METRICAS_PATH)}; u.search = ''; u.hash = ''; return u.toString(); } catch { return PADRAO; }
  })();
  // O token guardado é de UM servidor: um link com ?servidor= apontando para outro lugar nunca recebe o token guardado dos demais.
  const GUARDA = 'cybermech.metricas.token|' + servidor;
  const estado = (texto, ruim) => { $('estado').textContent = texto; $('estado').className = ruim ? 'ruim' : ''; };
  const guardado = () => { try { return localStorage.getItem(GUARDA) || ''; } catch { return ''; } };
  const guardar = (t) => { try { if (t) localStorage.setItem(GUARDA, t); else localStorage.removeItem(GUARDA); } catch { /* sem armazenamento: vale só nesta aba */ } };
  const N = (n) => Number(n || 0).toLocaleString('pt-BR');
  /** Os últimos n dias do calendário (fuso de Brasília, como o servidor), do mais antigo ao de hoje; dia sem registro vem vazio. */
  const calendario = (m, n) => {
    const por = new Map(m.dias.map((d) => [d.dia, d]));
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const dia = new Date(Date.now() - 3 * 3600e3 - i * 86400e3).toISOString().slice(0, 10);
      out.push(por.get(dia) || { dia, eventos: {}, pico: 0 });
    }
    return out;
  };
  const nomePais = (() => { try { return new Intl.DisplayNames(['pt-BR'], { type: 'region' }); } catch { return null; } })();
  const rotulo = (c) => {
    if (c === '??') return 'Desconhecido';
    if (c === 'T1') return 'Rede Tor';
    let n = c; try { n = (nomePais && nomePais.of(c)) || c; } catch { /* código que o navegador não conhece */ }
    return n === c ? c : n + ' · ' + c;
  };
  const el = (tag, attrs, texto) => { const e = document.createElement(tag); if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]); if (texto !== undefined) e.textContent = texto; return e; };
  const svg = (tag, attrs, texto) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]); if (texto !== undefined) e.textContent = texto; return e; };

  /** Soma de um evento nos dias pedidos (todos os países). */
  const soma = (dias, nome) => dias.reduce((s, d) => s + Object.values(d.eventos[nome] || {}).reduce((a, b) => a + b, 0), 0);
  const RECUSAS = ['recusa_versao', 'recusa_cheia', 'recusa_montagem', 'recusa_mensagem', 'recusa_limite'];
  const somaRecusas = (dias) => RECUSAS.reduce((s, n) => s + soma(dias, n), 0);

  function cartoes(m) {
    const dh = calendario(m, 1);
    const d7 = calendario(m, 7);
    const recHoje = somaRecusas(dh);
    const versao7 = soma(d7, 'recusa_versao');
    const pico = Math.max(0, ...m.dias.map((d) => d.pico));
    const lista = [
      ['jogo aberto hoje', N(soma(dh, 'boot_ok')), N(soma(d7, 'boot_ok')) + ' nos últimos 7 dias · ' + N(m.total.boot_ok) + ' no total'],
      ['partidas iniciadas hoje', N(soma(dh, 'partida_iniciada')), N(soma(d7, 'partida_iniciada')) + ' em 7 dias'],
      ['conexões online hoje', N(soma(dh, 'conexao_online')), N(soma(dh, 'entrou_na_sala')) + ' entraram numa sala · ' + N(soma(d7, 'conexao_online')) + ' em 7 dias'],
      ['recusadas hoje', N(recHoje), versao7 ? N(versao7) + ' por versão diferente em 7 dias: o servidor precisa atualizar' : 'nenhuma por versão em 7 dias', recHoje > 0],
      ['pico de jogadores', N(Math.max(0, ...dh.map((d) => d.pico))), 'maior de todos os dias guardados: ' + N(pico)],
    ];
    const caixa = $('cards'); caixa.replaceChildren();
    for (const [k, v, d, ruim] of lista) {
      const c = el('div', { class: 'card' + (ruim ? ' ruim' : '') });
      c.append(el('span', { class: 'k' }, k), el('span', { class: 'v' }, v), el('span', { class: 'd' }, d));
      caixa.append(c);
    }
  }

  /** De qual passo cada passo do funil sai (null = não depende de outro). */
  const DE = [null, 0, null, 2, 3, null, 5];
  function funil(m) {
    const d7 = calendario(m, 7);
    const passos = [
      ['visitas à landing', soma(d7, 'landing_view')],
      ['cliques em jogar', soma(d7, 'click_cockpit') + soma(d7, 'click_online')],
      ['jogo aberto', soma(d7, 'boot_ok')],
      ['partidas iniciadas', soma(d7, 'partida_iniciada')],
      ['partidas terminadas', soma(d7, 'partida_terminada')],
      ['conexões online', soma(d7, 'conexao_online')],
      ['entraram numa sala', soma(d7, 'entrou_na_sala')],
    ];
    const max = Math.max(1, ...passos.map((p) => p[1]));
    const caixa = $('funil'); caixa.replaceChildren();
    passos.forEach(([nome, n], i) => {
      const linha = el('div', { class: 'barra' });
      const trilho = el('div', { class: 'trilho' }); const barra = el('i'); barra.style.width = (100 * n / max) + '%'; trilho.append(barra);
      const num = el('span', { class: 'n' }, N(n));
      // Só onde o passo sai do anterior (quem abre o jogo direto não passou pela landing, então o jogo aberto não tem %).
      const de = DE[i] === null ? 0 : passos[DE[i]][1];
      if (de > 0) num.append(el('small', null, ' ' + Math.round(100 * n / de) + '%'));
      linha.append(el('span', null, nome), trilho, num);
      caixa.append(linha);
    });
  }

  function porDia(m) {
    const ult = calendario(m, 14);
    const g = $('dias'); g.replaceChildren();
    const W = 700, H = 220, base = H - 26, topo = 12;
    const max = Math.max(1, ...ult.map((d) => Math.max(soma([d], 'boot_ok'), soma([d], 'conexao_online'), somaRecusas([d]))));
    const largura = W / Math.max(1, ult.length);
    const series = [['boot_ok', 'var(--amber)'], ['conexao_online', 'var(--green)'], [null, 'var(--red)']];
    ult.forEach((d, i) => {
      series.forEach(([nome, cor], k) => {
        const n = nome ? soma([d], nome) : somaRecusas([d]);
        const h = Math.max(n ? 2 : 0, (base - topo) * n / max);
        g.append(svg('rect', { x: String(i * largura + 6 + k * ((largura - 12) / 3)), y: String(base - h), width: String(Math.max(2, (largura - 12) / 3 - 2)), height: String(h), fill: cor }));
      });
      if (i % 2 === 0 || ult.length < 8) g.append(svg('text', { x: String(i * largura + largura / 2), y: String(H - 8), 'text-anchor': 'middle' }, d.dia.slice(8) + '/' + d.dia.slice(5, 7)));
    });
    g.append(svg('text', { x: '4', y: '10' }, 'máx ' + N(max)));
    g.setAttribute('aria-label', 'Por dia: ' + ult.map((d) => d.dia + ' jogo aberto ' + soma([d], 'boot_ok') + ', conexões ' + soma([d], 'conexao_online') + ', recusadas ' + somaRecusas([d])).join('; '));
    const t = $('tab-dias'); t.replaceChildren();
    const cab = el('tr'); for (const h of ['dia', 'jogo aberto', 'partidas', 'conexões', 'entradas', 'recusadas', 'pico']) cab.append(el('th', null, h));
    const cabeca = el('thead'); cabeca.append(cab); t.append(cabeca);
    const corpo = el('tbody');
    for (const d of ult.slice().reverse()) {
      const tr = el('tr'); const dados = [d.dia, soma([d], 'boot_ok'), soma([d], 'partida_iniciada'), soma([d], 'conexao_online'), soma([d], 'entrou_na_sala'), somaRecusas([d]), d.pico];
      dados.forEach((x, i) => tr.append(el('td', null, i === 0 ? x : N(x))));
      corpo.append(tr);
    }
    t.append(corpo);
  }

  function porPais(m) {
    const d30 = calendario(m, 30);
    const mapa = {};
    const add = (nome, campo) => { for (const d of d30) for (const [p, n] of Object.entries(d.eventos[nome] || {})) { (mapa[p] ||= { boot: 0, conexoes: 0, entradas: 0, recusas: 0 })[campo] += n; } };
    add('boot_ok', 'boot'); add('conexao_online', 'conexoes'); add('entrou_na_sala', 'entradas');
    for (const r of RECUSAS) add(r, 'recusas');
    const linhas = Object.entries(mapa).sort((a, b) => (b[1].boot + b[1].conexoes) - (a[1].boot + a[1].conexoes));
    const t = $('paises'); t.replaceChildren();
    const cab = el('tr'); for (const h of ['país', 'jogo aberto', 'conexões online', 'entraram', 'recusadas']) cab.append(el('th', null, h));
    const cabeca = el('thead'); cabeca.append(cab); t.append(cabeca);
    const corpo = el('tbody');
    if (!linhas.length) { const tr = el('tr'); tr.append(el('td', { colspan: '5' }, 'Ainda sem dados nos últimos 30 dias.')); corpo.append(tr); }
    for (const [p, v] of linhas.slice(0, 40)) {
      const tr = el('tr'); tr.append(el('td', null, rotulo(p)), el('td', null, N(v.boot)), el('td', null, N(v.conexoes)), el('td', null, N(v.entradas)), el('td', null, N(v.recusas)));
      corpo.append(tr);
    }
    t.append(corpo);
  }

  /** Confere o que veio do servidor: o painel não confia nem no servidor dele. */
  function valido(m) {
    return m && typeof m === 'object' && Array.isArray(m.dias) && m.total && typeof m.total === 'object' &&
      m.dias.every((d) => d && typeof d.dia === 'string' && /^\\d{4}-\\d{2}-\\d{2}$/.test(d.dia) && typeof d.pico === 'number' && d.eventos && typeof d.eventos === 'object');
  }

  async function ver() {
    const token = $('token').value.trim() || guardado();
    if (!servidor) return estado('Este build não tem servidor configurado. Abra a página com ?servidor=https://seu-servidor.', true);
    if (!token) return estado('Cole o token do servidor (arquivo .tmp/servidor/metricas-token.txt).', true);
    estado('Buscando…');
    let res;
    try { res = await fetch(servidor, { headers: { [HEADER]: token }, cache: 'no-store', credentials: 'omit' }); }
    catch {
      $('painel').hidden = true;
      // O servidor de antes desta porta não manda CORS em /metricas, então o navegador bloqueia e parece "fora do ar".
      // O /status é público e tem CORS: se ele responde, o servidor está no ar e o que falta é atualizá-lo.
      try {
        const u = new URL(servidor); u.pathname = ${JSON.stringify(status.STATUS_PATH)};
        const st = await (await fetch(u, { cache: 'no-store', credentials: 'omit' })).json();
        if (st && typeof st.protocol === 'number') return estado('O servidor está no ar (protocolo ' + st.protocol + '), mas não tem a porta de métricas: é uma versão antiga. Atualize e reinicie o servidor (DEPLOY.md, seção 04/10).', true);
      } catch { /* nem o /status responde */ }
      return estado('Servidor fora do ar, ou o endereço não responde.', true);
    }
    if (res.status === 401) { $('painel').hidden = true; return estado('Token recusado.', true); }
    if (res.status === 404) { $('painel').hidden = true; return estado('Este servidor não tem a porta de métricas (versão antiga ou sem token configurado).', true); }
    if (res.status === 429) { $('painel').hidden = true; return estado('Tentativas demais: espere alguns minutos.', true); }
    if (!res.ok) { $('painel').hidden = true; return estado('O servidor respondeu ' + res.status + '.', true); }
    let m; try { m = await res.json(); } catch { m = null; }
    // Servidor de antes desta porta: responde 200 com o texto de boas-vindas em qualquer caminho, não com JSON.
    if (m === null) { $('painel').hidden = true; return estado('O servidor respondeu, mas não com métricas: é provavelmente uma versão antiga. Atualize e reinicie o servidor (DEPLOY.md, seção 04/10).', true); }
    if (!valido(m)) { $('painel').hidden = true; return estado('Resposta do servidor em formato inesperado.', true); }
    guardar(token); $('token').value = '';
    cartoes(m); funil(m); porDia(m); porPais(m);
    $('painel').hidden = false;
    estado('Atualizado às ' + new Date().toLocaleTimeString('pt-BR') + ' · dados desde ' + new Date(m.desde).toLocaleDateString('pt-BR') + ' · dias no fuso ' + m.fuso);
  }

  $('acesso').addEventListener('submit', (e) => { e.preventDefault(); void ver(); });
  $('atualizar').addEventListener('click', () => void ver());
  $('esquecer').addEventListener('click', () => { guardar(''); $('token').value = ''; $('painel').hidden = true; estado('Token esquecido neste navegador.'); });
  if (guardado()) void ver(); else estado(servidor ? 'Cole o token do servidor para ver os números.' : 'Este build não tem servidor configurado. Abra a página com ?servidor=https://seu-servidor.', !servidor);
})();`;

const html = pagina({
  title: 'Métricas · CYBERMECH',
  description: 'Métricas privadas do servidor de jogo do CYBERMECH: de onde vêm as conexões, quantos entram e quantos são recusados.',
  css,
  body,
  script: js,
  anticopia: false,
  noindex: true,
});
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
console.log(`metricas ${OUT}${URL_METRICAS ? '' : ' (sem servidor neste build)'}`);
