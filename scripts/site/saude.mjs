/**
 * Saúde técnica: a seção da oficina que mostra o que o projeto prova sobre si mesmo — os testes de
 * simulação, onde falta teste próprio, as dívidas que o tipo não esconde e o orçamento de banda.
 *
 * Nenhum número é digitado aqui: chega pronto de `dados.mjs → saudeTecnica()` e de `arquitetura()`.
 * Uso: `saudeOficina(saude)`, com o que `saudeTecnica()` devolveu ('' quando não há dados).
 */
import { nf, pct, rankBars } from './graficos.mjs';
import { esc } from './tema.mjs';

const kb = (bytes) => `${nf(bytes / 1024, 1)} KB/s`;

export function saudeOficina(s) {
  if (!s) return '';
  const { net } = s;
  const share = net ? net.download / net.DOWNLOAD_BUDGET : 0;

  const cards = `<div class="sitrep">
      <div class="read frame"><span class="k">testes automatizados</span><span class="v">${s.testes}</span><span class="d">travam regras a cada entrega (G14), espalhados pelos ${s.modulos} módulos de código</span></div>
      <div class="read frame"><span class="k">módulos com teste</span><span class="v">${s.comTeste}/${s.modulos}</span><span class="d">${pct(s.comTeste / s.modulos)} têm teste próprio; os outros ${s.semTeste.length} estão na lista abaixo, à vista</span></div>
      <div class="read frame"><span class="k">download por jogador</span><span class="v">${net ? kb(net.download) : '—'}</span><span class="d">${net ? `sala cheia (${net.ROOM_UNITS} robôs) numa luta intensa; a meta é ${kb(net.DOWNLOAD_BUDGET)}` : 'sem os dados da rede neste build'}</span></div>
      <div class="read frame"><span class="k">byte por robô</span><span class="v">${net ? `${net.unitBytes} B` : '—'}</span><span class="d">${net ? `posição, ângulos, a vida das 6 partes e o calor, quantizados a ${net.SNAPSHOT_HZ} Hz; cabem ${net.maxUnits} unidades antes de precisar de delta` : ''}</span></div>
      <div class="read frame"><span class="k">dívidas no fonte</span><span class="v">${s.forcados}</span><span class="d">conversões forçadas (\`as unknown as\`) em ${s.arquivosTs} arquivos TypeScript: onde o tipo não garante nada — é o tipo de dívida que a seção 9 do \`MULTIPLAYER.md\` vigia</span></div>
    </div>`;

  const banda = net
    ? rankBars({
        title: 'O orçamento de banda, por jogador',
        caption: `Toda a conta sai do mesmo código que o servidor usa (\`shared/net/\`): o estado de cada unidade a ${net.SNAPSHOT_HZ} Hz, mais os eventos da luta, com a moldura do WebSocket. A sala cheia usa <b>${pct(share)} da meta</b> — é esta folga que diz quantos drones e torres cabem sem delta.`,
        items: [
          { label: `sala cheia (${net.ROOM_UNITS} robôs), luta intensa`, value: net.download, note: `${pct(share)} da meta` },
          { label: 'meta do G11', value: net.DOWNLOAD_BUDGET, note: 'teto por jogador' },
        ],
        fmt: (v) => kb(v),
      })
    : '';

  const linhas = s.semTeste
    .map((m) => `<tr><th scope="row">${esc(m.id)}</th><td>${esc(m.frente)}</td><td>${m.files}</td><td>${m.loc}</td></tr>`)
    .join('');
  const tabela = `<details class="table-view"><summary>onde ainda não há teste próprio</summary>
      <table><thead><tr><th>módulo</th><th>frente</th><th>arquivos</th><th>linhas</th></tr></thead><tbody>${linhas}</tbody></table>
      <p class="lede">Sem teste próprio não é o mesmo que sem cobertura: parte destes módulos é exercitada pelos testes de quem os usa (o mapa acima mostra quem importa quem). A lista serve como bússola — é onde uma regra nova entra sem rede.</p>
    </details>`;

  return `
  <section class="saude" aria-labelledby="saude">
    <span class="kicker">// saúde técnica · medido no build</span>
    <h2 id="saude">O que o projeto prova sobre si mesmo</h2>
    <p class="lede">Nada aqui é digitado à mão: os números saem do próprio repositório a cada build — os testes que travam as regras, o orçamento de banda calculado pelo mesmo código que o servidor roda e as dívidas que o tipo não esconde. É a parte chata do desenvolvimento, publicada junto com a bonita.</p>
    ${cards}
    ${banda}
    ${tabela}
  </section>`;
}
