/**
 * Métricas (/metricas/): a página privada do dono. Mostra de onde vêm as conexões, quantas entram, quantas são
 * recusadas e por quê, a partir de `GET /metricas` do servidor de jogo (contrato em `shared/net/telemetry.ts`).
 *
 * **Privada de verdade:** o servidor só responde com o token do dono (`metricas-token.txt`, na pasta de dados do servidor, `CYBERMECH_DADOS`, no PC dele);
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
  .quem { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 22px; }
  .quem h3 { font: 400 12px/1.3 var(--fb); letter-spacing: .16em; text-transform: uppercase; color: var(--muted); margin: 0 0 8px; }
  .quem .barra { grid-template-columns: minmax(90px, 140px) 1fr auto; }
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
    <section><h2>Experiência por montagem</h2><p>Resumos declarados pelo cliente, separados por versão, modo, online/offline e assistência (Banco ou potências alteradas). Não representam jogadores únicos nem placar competitivo. Agregados desde o início desta coleta.</p><div class="rolavel"><table class="paises" id="partidas"></table></div><p id="partidas-limite"></p></section>
    <section aria-labelledby="h-agora">
      <h2 id="h-agora">Agora</h2>
      <div class="cards" id="cards"></div>
    </section>
    <section aria-labelledby="h-pilotos">
      <h2 id="h-pilotos">Pilotos com conta</h2>
      <p class="lede">Quem criou conta: quantos abrem o jogo, quantos jogam de fato, por quanto tempo e se voltam. <b>Só contagens</b> (nenhum e-mail, nenhum identificador aqui). Quem joga como convidado não entra nestes números: aparece só nos totais de rodadas logo abaixo.</p>
      <div class="cards" id="pilotos"></div>
      <p class="lede" id="pilotos-desde"></p>
      <details class="tabela"><summary>ver o dia a dia dos pilotos</summary><div class="rolavel"><table class="paises" id="tab-pilotos"></table></div></details>
    </section>
    <section aria-labelledby="h-jogo">
      <h2 id="h-jogo">O que se joga</h2>
      <p class="lede">As rodadas que os navegadores declararam (com e sem conta), por mapa e modo e por dia. A <b>onda</b> é a média da mais alta que cada rodada alcançou (missões e Sobrevivência); vitória e derrota só existem nas missões. Números declarados pelo cliente: medem o jogo, não valem como placar.</p>
      <div class="rolavel"><table class="paises" id="tab-mapas"></table></div>
      <div class="rolavel"><table class="paises" id="tab-jogo-dias"></table></div>
    </section>
    <section aria-labelledby="h-origem">
      <h2 id="h-origem">De onde vêm · últimos 30 dias</h2>
      <p class="lede">Como a pessoa chegou: <b>digitou o endereço</b> ou usou um favorito (direto), veio de uma <b>busca</b>, de uma <b>rede social</b>, de <b>outro site</b> ou de um <b>link marcado por nós</b> (campanha). A origem da landing acompanha a pessoa até o jogo. Só categorias: nenhuma pessoa, nenhum IP.</p>
      <div class="rolavel"><table class="paises" id="tab-origem"></table></div>
      <div class="rolavel"><table class="paises" id="tab-sites"></table></div>
      <div class="rolavel"><table class="paises" id="tab-campanhas"></table></div>
    </section>
    <section aria-labelledby="h-quem">
      <h2 id="h-quem">Quem chega · últimos 30 dias</h2>
      <p class="lede">O jeito de quem abre o jogo, por categorias (nunca por pessoa): novo ou recorrente, com conta ou convidado, aparelho, navegador, sistema e idioma. <b>Recorrente</b> vem de uma data guardada no próprio navegador (a da primeira visita), que nunca é enviada.</p>
      <div class="quem" id="quem"></div>
      <div class="rolavel"><table class="paises" id="tab-uf"></table></div>
    </section>
    <section aria-labelledby="h-tempo">
      <h2 id="h-tempo">Quanto se joga e em que condição · últimos 30 dias</h2>
      <p class="lede">Duração das rodadas (declarada pelo navegador) e a qualidade gráfica em que terminaram: o jogo rebaixa sozinho quando o aparelho não aguenta (G12), então quem termina em "baixa" mostra onde o computador não dá conta.</p>
      <div class="quem" id="tempo"></div>
    </section>
    <section aria-labelledby="h-audit">
      <h2 id="h-audit">Auditoria interna</h2>
      <p class="lede">O que foi feito de sensível, do mais novo para o mais velho: conta criada ou apagada, dados baixados, configuração mudada, acesso (ou tentativa recusada) a esta página e ao painel do servidor, administradores promovidos, reinícios. <b>Sem e-mail e sem IP</b>: o ator e o alvo são o número da conta, "dono" ou "sistema". Guardada por 400 dias.</p>
      <div class="rolavel"><table class="paises" id="tab-audit"></table></div>
    </section>
    <section aria-labelledby="h-ga">
      <h2 id="h-ga">Google Analytics</h2>
      <p class="lede" id="ga-nota">Os números do Google chegam pelo servidor. <a href="https://analytics.google.com" rel="noopener" target="_blank">Abrir o painel do Google</a>.</p>
      <div class="cards" id="ga-cartoes"></div>
      <div class="rolavel"><table class="paises" id="tab-ga-canais"></table></div>
      <div class="rolavel"><table class="paises" id="tab-ga-paises"></table></div>
      <div class="rolavel"><table class="paises" id="tab-ga-aparelhos"></table></div>
      <details class="tabela"><summary>ver o Google dia a dia</summary><div class="rolavel"><table class="paises" id="tab-ga-dias"></table></div></details>
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
      <li>O token está no arquivo <code>metricas-token.txt</code> da pasta de dados do servidor (<code>CYBERMECH_DADOS</code>; em produção <code>.tmp/servidor/</code> da pasta principal do projeto), no PC dele (gerado na primeira subida; o log do servidor diz o caminho) ou na variável <code>CYBERMECH_METRICAS_TOKEN</code>. Ele fica só neste navegador.</li>
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

  const pct = (a, b) => (b > 0 ? Math.round(100 * Number(a || 0) / b) + '%' : '—');
  const tabela = (id, cabecalho, linhas, vazio) => {
    const t = $(id); t.replaceChildren();
    const cab = el('tr'); for (const h of cabecalho) cab.append(el('th', null, h));
    const cabeca = el('thead'); cabeca.append(cab); t.append(cabeca);
    const corpo = el('tbody');
    if (!linhas.length) { const tr = el('tr'); tr.append(el('td', { colspan: String(cabecalho.length) }, vazio)); corpo.append(tr); }
    for (const l of linhas) { const tr = el('tr'); l.forEach((x) => tr.append(el('td', null, x))); corpo.append(tr); }
    t.append(corpo);
  };
  /** Os dias de calendário (Brasília) de hoje para trás: o "hoje" e o "há n dias" no mesmo fuso do servidor. */
  const diaAtras = (i) => new Date(Date.now() - 3 * 3600e3 - i * 86400e3).toISOString().slice(0, 10);

  function pilotos(m) {
    const u = m.usuarios;
    const caixa = $('pilotos'); caixa.replaceChildren();
    if (!u || typeof u !== 'object') {
      $('pilotos-desde').textContent = 'Este servidor ainda não manda os números dos pilotos: é uma versão antiga. Atualize e reinicie o servidor.';
      tabela('tab-pilotos', ['dia'], [], 'Sem dados.');
      return;
    }
    const novas = u.novasPorDia || {};
    let novas7 = 0; for (let i = 0; i < 7; i++) novas7 += novas[diaAtras(i)] || 0;
    const ativos = u.ativos || {}; const jogaram = u.jogaram || {};
    const ret = (r) => { const x = r || {}; return [pct(x.voltaram, x.coorte), N(x.voltaram) + ' de ' + N(x.coorte) + ' voltaram. ']; };
    const lista = [
      ['contas criadas', N(u.contas), N(novas[diaAtras(0)] || 0) + ' hoje · ' + N(novas7) + ' nos últimos 7 dias'],
      ['abriram o jogo hoje', N(ativos.dia), N(ativos.semana) + ' em 7 dias · ' + N(ativos.mes) + ' em 30 dias'],
      ['jogaram hoje', N(jogaram.dia), N(jogaram.semana) + ' em 7 dias · ' + N(jogaram.mes) + ' em 30 dias (entrar sem jogar não conta)'],
      ['minutos por piloto', Number(u.minutosPorJogador || 0).toLocaleString('pt-BR'), 'média de quem jogou, nos últimos 30 dias'],
      ['voltaram no dia seguinte', ret(u.retencao && u.retencao.d1)[0], ret(u.retencao && u.retencao.d1)[1] + 'D1: das contas criadas nos últimos 30 dias (com o dia seguinte já passado)'],
      ['voltaram em 7 dias', ret(u.retencao && u.retencao.d7)[0], ret(u.retencao && u.retencao.d7)[1] + 'D7: abriram o jogo de novo 7 dias depois de criar a conta'],
    ];
    for (const [k, v, d] of lista) {
      const c = el('div', { class: 'card' });
      c.append(el('span', { class: 'k' }, k), el('span', { class: 'v' }, v), el('span', { class: 'd' }, d));
      caixa.append(c);
    }
    $('pilotos-desde').textContent = u.desde ? 'Medindo desde ' + u.desde + ': a retenção só vale para contas criadas depois disso.' : 'Ainda sem nenhuma atividade de conta registrada.';
    const dias = Array.isArray(u.porDia) ? u.porDia.slice().reverse() : [];
    tabela('tab-pilotos', ['dia', 'abriram o jogo', 'jogaram', 'minutos', 'rodadas', 'abates', 'mortes', 'abates por morte'],
      dias.map((d) => [d.dia, N(d.ativos), N(d.jogaram), N(d.minutos), N(d.partidas), N(d.abates), N(d.mortes), d.mortes > 0 ? (d.abates / d.mortes).toFixed(2) : '—']),
      'Ainda sem atividade de pilotos com conta.');
  }

  function oQueSeJoga(m) {
    const p = m.play || {};
    const mapas = Array.isArray(p.maps) ? p.maps.slice().sort((a, b) => b.reports - a.reports) : [];
    tabela('tab-mapas', ['mapa · modo', 'rodadas', 'concluídas', 'minutos', 'abates / mortes', 'vitórias / derrotas', 'onda média', 'com conta'],
      mapas.map((g) => [
        g.map + ' · ' + g.mode, N(g.reports), pct(g.completed, g.reports), N(Math.round(g.seconds / 60)), N(g.kills) + ' / ' + N(g.deaths),
        g.won + g.lost > 0 ? N(g.won) + ' / ' + N(g.lost) : '—', g.waveReports > 0 ? (g.waves / g.waveReports).toFixed(1) : '—', pct(g.logged, g.reports),
      ]),
      'Ainda sem rodadas com mapa (o navegador novo manda o mapa; os antigos não).');
    const dias = Array.isArray(p.days) ? p.days.slice(-14).reverse() : [];
    tabela('tab-jogo-dias', ['dia', 'rodadas', 'minutos jogados', 'com conta', 'abates', 'mortes'],
      dias.map((d) => [d.day, N(d.reports), N(Math.round(d.seconds / 60)), pct(d.logged, d.reports), N(d.kills), N(d.deaths)]),
      'Ainda sem rodadas por dia.');
  }

  const ROTULOS = {
    canal: { direto: 'direto (digitou o endereço)', busca: 'busca', social: 'rede social', site: 'outro site', campanha: 'campanha (link marcado)', interno: 'interno' },
    disp: { desktop: 'computador', mobile: 'celular', tablet: 'tablet' },
    nav: { chrome: 'Chrome', edge: 'Edge', firefox: 'Firefox', safari: 'Safari', opera: 'Opera', samsung: 'Samsung Internet', outro: 'outro' },
    so: { windows: 'Windows', mac: 'macOS', linux: 'Linux', android: 'Android', ios: 'iOS', chromeos: 'ChromeOS', outro: 'outro' },
    lang: { pt: 'português', en: 'inglês', es: 'espanhol', fr: 'francês', ja: 'japonês', zh: 'chinês', ru: 'russo', outro: 'outro' },
    ret: { novo: 'novo (primeira visita)', d1: 'voltou 1 dia depois', 'd2-7': 'voltou em 2 a 7 dias', 'd8-30': 'voltou em 8 a 30 dias', 'd31+': 'voltou depois de 30 dias' },
    conta: { logado: 'com conta', convidado: 'convidado' },
  };
  const rot = (dim, v) => (ROTULOS[dim] && ROTULOS[dim][v]) || v;
  const ordem = (obj, ref) => Object.entries(obj || {}).sort((a, b) => (ref ? ref.indexOf(a[0]) - ref.indexOf(b[0]) : b[1] - a[1]));
  /** Os últimos n dias que o servidor mandou (a audiência), do mais novo para trás: o servidor já corta em 120. */
  const diasAud = (m, n) => {
    const limite = diaAtras(n - 1);
    return (m.audiencia && Array.isArray(m.audiencia.dias) ? m.audiencia.dias : []).filter((d) => d && typeof d.dia === 'string' && d.dia >= limite);
  };
  const juntar = (alvo, origem) => { for (const [k, n] of Object.entries(origem || {})) alvo[k] = (alvo[k] || 0) + (Number(n) || 0); return alvo; };
  const perfilSomado = (dias, pagina, dim) => dias.reduce((acc, d) => juntar(acc, d.perfil && d.perfil[pagina] && d.perfil[pagina][dim]), {});
  /** Barras de uma categoria: rótulo, barra proporcional ao maior e o número com a fatia do total. */
  function barras(caixa, titulo, dados, dim, ref) {
    const total = Object.values(dados).reduce((a, b) => a + b, 0);
    const bloco = el('div'); bloco.append(el('h3', null, titulo));
    const g = el('div', { class: 'barras' });
    const linhas = ordem(dados, ref);
    const max = Math.max(1, ...linhas.map((l) => l[1]));
    if (!linhas.length) g.append(el('p', { class: 'd' }, 'Ainda sem dados.'));
    for (const [v, n] of linhas.slice(0, 12)) {
      const linha = el('div', { class: 'barra' });
      const trilho = el('div', { class: 'trilho' }); const b = el('i'); b.style.width = (100 * n / max) + '%'; trilho.append(b);
      const num = el('span', { class: 'n' }, N(n)); num.append(el('small', null, ' ' + pct(n, total)));
      linha.append(el('span', null, rot(dim, v)), trilho, num); g.append(linha);
    }
    bloco.append(g); caixa.append(bloco);
  }
  const PASSOS = ['landing_view', 'click_cockpit', 'boot_ok', 'partida_iniciada', 'partida_terminada'];
  const CANAIS = ['direto', 'busca', 'social', 'site', 'campanha'];

  function audiencia(m) {
    const dias = diasAud(m, 30);
    // De onde vêm: o funil de cada canal, com a conversão de cada passo.
    const porCanal = {};
    for (const d of dias) for (const [canal, passos] of Object.entries(d.funil || {})) juntar((porCanal[canal] ||= {}), passos);
    const canais = Object.keys(porCanal).sort((a, b) => CANAIS.indexOf(a) - CANAIS.indexOf(b));
    tabela('tab-origem', ['canal', 'visitas na landing', 'cliques em jogar', 'abriram o jogo', 'iniciaram partida', 'terminaram', 'visita → clique', 'jogo → partida'],
      canais.map((c) => { const f = porCanal[c]; return [rot('canal', c), N(f.landing_view), N((f.click_cockpit || 0) + (f.click_online || 0)), N(f.boot_ok), N(f.partida_iniciada), N(f.partida_terminada), pct((f.click_cockpit || 0) + (f.click_online || 0), f.landing_view), pct(f.partida_iniciada, f.boot_ok)]; }),
      'Ainda sem visitas com origem (o navegador novo manda; os antigos não).');
    // Os sites que mandam gente e as campanhas.
    const hosts = dias.reduce((acc, d) => juntar(juntar(acc, d.perfil && d.perfil.landing && d.perfil.landing.host), d.perfil && d.perfil.jogo && d.perfil.jogo.host), {});
    tabela('tab-sites', ['site que mandou a visita', 'visitas'], ordem(hosts).slice(0, 15).map(([h, n]) => [h, N(n)]), 'Ainda nenhum site mandou visita.');
    const camp = (dim) => dias.reduce((acc, d) => juntar(juntar(acc, d.perfil && d.perfil.landing && d.perfil.landing[dim]), d.perfil && d.perfil.jogo && d.perfil.jogo[dim]), {});
    const cs = camp('utm_campaign'); const fs = camp('utm_source'); const ms = camp('utm_medium');
    const linhasCamp = [];
    for (const [nome, mapa] of [['campanha', cs], ['fonte', fs], ['meio', ms]]) for (const [v, n] of ordem(mapa).slice(0, 8)) linhasCamp.push([nome, v, N(n)]);
    tabela('tab-campanhas', ['marca do link', 'valor', 'visitas'], linhasCamp, 'Nenhum link marcado (utm_source, utm_medium, utm_campaign) foi aberto ainda.');
    // Quem chega: o perfil de quem abre o jogo (e, sem jogo, o da landing).
    const pagina = dias.some((d) => d.perfil && d.perfil.jogo) ? 'jogo' : 'landing';
    const caixa = $('quem'); caixa.replaceChildren();
    barras(caixa, 'novo ou recorrente', perfilSomado(dias, pagina, 'ret'), 'ret', ['novo', 'd1', 'd2-7', 'd8-30', 'd31+']);
    const conta = dias.reduce((acc, d) => juntar(acc, d.conta), {});
    barras(caixa, 'partidas iniciadas: com conta ou convidado', conta, 'conta', ['logado', 'convidado']);
    barras(caixa, 'aparelho', perfilSomado(dias, pagina, 'disp'), 'disp');
    barras(caixa, 'navegador', perfilSomado(dias, pagina, 'nav'), 'nav');
    barras(caixa, 'sistema', perfilSomado(dias, pagina, 'so'), 'so');
    barras(caixa, 'idioma do navegador', perfilSomado(dias, pagina, 'lang'), 'lang');
    const ufs = dias.reduce((acc, d) => juntar(juntar(acc, d.perfil && d.perfil.landing && d.perfil.landing.uf), d.perfil && d.perfil.jogo && d.perfil.jogo.uf), {});
    tabela('tab-uf', ['estado (Brasil)', 'visitas'], ordem(ufs).slice(0, 27).map(([u, n]) => [u, N(n)]), 'Sem estados ainda: a Cloudflare só manda o estado quando "Add visitor location headers" está ligado (Rules → Managed Transforms).');
    // Quanto se joga: a duração das rodadas e a qualidade em que terminaram.
    const d30 = (m.play && Array.isArray(m.play.days) ? m.play.days : []).filter((d) => d.day >= diaAtras(29));
    const soma = (campo, n) => Array.from({ length: n }, (_, i) => d30.reduce((s, d) => s + ((Array.isArray(d[campo]) && Number(d[campo][i])) || 0), 0));
    const dur = soma('dur', 5); const qual = soma('qual', 3);
    const cx = $('tempo'); cx.replaceChildren();
    barras(cx, 'duração da rodada', Object.fromEntries(['menos de 1 min', '1 a 5 min', '5 a 15 min', '15 a 30 min', '30 min ou mais'].map((r, i) => [r, dur[i]])), 'dur', ['menos de 1 min', '1 a 5 min', '5 a 15 min', '15 a 30 min', '30 min ou mais']);
    barras(cx, 'qualidade gráfica ao terminar', Object.fromEntries(['alta', 'média (resolução menor)', 'baixa (sem brilho)'].map((r, i) => [r, qual[i]])), 'qual', ['alta', 'média (resolução menor)', 'baixa (sem brilho)']);
    const rodadas = d30.reduce((s, d) => s + (d.reports || 0), 0); const seg = d30.reduce((s, d) => s + (d.seconds || 0), 0);
    if (rodadas) cx.append(el('p', { class: 'd' }, 'Média: ' + (seg / rodadas / 60).toFixed(1).replace('.', ',') + ' min por rodada, em ' + N(rodadas) + ' rodadas.'));
  }

  /**
   * O Google Analytics (P207): os números vêm do servidor (server/analytics.ts), que fala com o Google com a chave da conta de serviço; esta página nunca fala com o Google nem vê chave.
   * Cada estado do servidor tem a frase certa (o que falta e onde), porque "não aparece nada" é a pior resposta para quem está configurando.
   */
  const GA_NOTAS = {
    'sem-chave': 'A chave do Google ainda não está guardada no servidor (o arquivo ga-chave.json, na pasta de dados). O passo a passo está em LANCAMENTO.md, seção 6C.',
    'chave-ruim': 'O arquivo ga-chave.json existe, mas não é uma chave de conta de serviço do Google legível: baixe a chave JSON de novo no Google Cloud.',
    'sem-propriedade': 'Falta o ID numérico da propriedade do Analytics: ponha só os números em ga-propriedade.txt (Analytics, Administrador, Detalhes da propriedade), ou ligue a Google Analytics Admin API no projeto do Google para o servidor descobrir sozinho.',
  };
  const GA_ERROS = {
    token: 'o Google recusou a chave da conta de serviço: confira se é a chave do projeto certo e se não foi apagada',
    api: 'a conta de serviço não enxerga a propriedade: no Analytics, Administrador, Gerenciamento de acesso, dê o papel de Leitor ao e-mail da conta de serviço',
    cota: 'a cota do Google acabou por ora',
    rede: 'o servidor não conseguiu falar com o Google',
  };
  const MIN_S = (s) => Math.floor(s / 60) + ' min ' + String(Math.round(s % 60)).padStart(2, '0') + ' s';
  function analyticsDoGoogle(m) {
    const a = m.analytics;
    const nota = $('ga-nota');
    const limpar = () => { $('ga-cartoes').replaceChildren(); for (const t of ['tab-ga-canais', 'tab-ga-paises', 'tab-ga-aparelhos', 'tab-ga-dias']) $(t).replaceChildren(); };
    if (!a || typeof a !== 'object' || typeof a.estado !== 'string') { limpar(); nota.textContent = 'Este servidor é de uma versão sem o Analytics: atualize e reinicie o servidor.'; return; }
    if (a.estado === 'desligado') { limpar(); nota.textContent = GA_NOTAS[a.motivo] || 'O Analytics está desligado neste servidor.'; return; }
    if (a.estado === 'carregando') { limpar(); nota.textContent = 'Pedindo os números ao Google… clique em Atualizar em alguns segundos.'; return; }
    if (a.estado === 'erro') { limpar(); nota.textContent = 'O Google não respondeu como esperado: ' + (GA_ERROS[a.motivo] || 'erro') + '. O servidor tenta de novo sozinho em 2 minutos.' + (a.detalhe ? ' (' + String(a.detalhe) + ')' : ''); return; }
    const r = a.relatorio;
    if (a.estado !== 'ok' || !r || !r.resumo) { limpar(); nota.textContent = 'Resposta do Analytics em formato inesperado.'; return; }
    nota.textContent = 'Últimos ' + N(r.dias) + ' dias, só de quem aceitou os cookies do site (o Google não enxerga os outros): o que o servidor mede por conta própria está nas seções de cima. Números de ' + new Date(r.geradoEm).toLocaleString('pt-BR') + '.';
    const s = r.resumo;
    const engajadas = s.sessoes ? Math.round((100 * s.sessoesEngajadas) / s.sessoes) + '% das sessões' : 'sem sessões';
    const caixa = $('ga-cartoes'); caixa.replaceChildren();
    for (const [k, v, d] of [
      ['usuários ativos', N(s.usuarios), N(s.novos) + ' novos'],
      ['sessões', N(s.sessoes), N(s.sessoesEngajadas) + ' engajadas (' + engajadas + ')'],
      ['tempo médio por sessão', MIN_S(s.duracaoMediaS), 'páginas vistas: ' + N(s.paginasVistas)],
      ['no site agora', r.agora === null ? '—' : N(r.agora), r.agora === null ? 'o Google não respondeu essa parte' : 'usuários ativos nos últimos 30 minutos'],
    ]) {
      const c = el('div', { class: 'card' }); c.append(el('span', { class: 'k' }, k), el('span', { class: 'v' }, v), el('span', { class: 'd' }, d)); caixa.append(c);
    }
    const lista = (x) => (Array.isArray(x) ? x : []);
    tabela('tab-ga-canais', ['canal (Google)', 'sessões', 'usuários'], lista(r.canais).map((c) => [String(c.nome), N(c.sessoes), N(c.usuarios)]), 'Sem canais ainda.');
    tabela('tab-ga-paises', ['país (Google)', 'usuários'], lista(r.paises).map((p) => [rotulo(String(p.codigo)), N(p.usuarios)]), 'Sem países ainda.');
    tabela('tab-ga-aparelhos', ['aparelho (Google)', 'usuários'], lista(r.aparelhos).map((p) => [String(p.nome), N(p.usuarios)]), 'Sem aparelhos ainda.');
    tabela('tab-ga-dias', ['dia', 'usuários', 'sessões'], lista(r.porDia).slice().reverse().map((d) => [new Date(d.dia + 'T12:00:00').toLocaleDateString('pt-BR'), N(d.usuarios), N(d.sessoes)]), 'Sem dias ainda.');
  }

  const ACOES = { conta_criada: 'conta criada', conta_apagada: 'conta apagada', dados_baixados: 'dados baixados', medicao_alterada: 'medição alterada', admin_config: 'configuração global', admin_acesso: 'acesso às portas do dono', admin_promovido: 'administrador promovido', admin_rebaixado: 'administrador rebaixado', servidor_reiniciado: 'servidor reiniciado' };
  function auditoriaInterna(m) {
    const lista = Array.isArray(m.auditoria) ? m.auditoria.slice(0, 40) : [];
    tabela('tab-audit', ['quando', 'ator', 'ação', 'alvo', 'resultado'],
      lista.map((e) => [new Date(e.quando).toLocaleString('pt-BR'), String(e.ator), ACOES[e.acao] || String(e.acao), String(e.alvo || '—'), e.ok ? 'feito' : 'RECUSADO']),
      'Nenhum evento sensível registrado ainda.');
  }

  /** Confere o que veio do servidor: o painel não confia nem no servidor dele. */
  function valido(m) {
    return m && typeof m === 'object' && Array.isArray(m.dias) && m.total && typeof m.total === 'object' &&
      m.dias.every((d) => d && typeof d.dia === 'string' && /^\\d{4}-\\d{2}-\\d{2}$/.test(d.dia) && typeof d.pico === 'number' && d.eventos && typeof d.eventos === 'object');
  }

  async function ver() {
    const token = $('token').value.trim() || guardado();
    if (!servidor) return estado('Este build não tem servidor configurado. Abra a página com ?servidor=https://seu-servidor.', true);
    if (!token) return estado('Cole o token do servidor (arquivo metricas-token.txt, na pasta de dados do servidor: .tmp/servidor da pasta principal).', true);
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
    cartoes(m); pilotos(m); oQueSeJoga(m); audiencia(m); auditoriaInterna(m); analyticsDoGoogle(m); funil(m); porDia(m); porPais(m);
    const table=$('partidas');table.replaceChildren();const header=el('tr');for(const text of ['Versão / modo / montagem','Origem','Assistência','Rodadas','Concluídas','Quadros lentos','Abates / mortes'])header.append(el('th',null,text));table.append(header);
    const groups=Array.isArray(m.play?.groups)?m.play.groups.slice(0,128):[];
    for(const g of groups){const row=el('tr');const values=[String(g.release)+' / '+String(g.mode)+' / '+String(g.build),g.online?'Online':'Offline',g.assisted?'Assistida':'Normal',N(g.reports),N(g.completed),g.frames>0?(100*g.slowFrames/g.frames).toFixed(1)+'%':'—',N(g.kills)+' / '+N(g.deaths)];for(const value of values)row.append(el('td',null,value));table.append(row);}
    if(!groups.length){const row=el('tr');row.append(el('td',{colspan:'7'},'Ainda sem resumos de partidas.'));table.append(row);}
    $('partidas-limite').textContent=m.play?.droppedGroups?'Combinações além do teto: '+N(m.play.droppedGroups):'Teto de 128 combinações; relatórios têm fila local de até 24 horas.';
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
