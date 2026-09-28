/**
 * Saúde técnica: a seção da oficina que mostra o que o projeto prova sobre si mesmo — os testes de
 * simulação, onde falta teste próprio e as dívidas que o tipo não esconde.
 *
 * Nenhum número é digitado aqui: chega pronto de `dados.mjs → saudeTecnica()` e de `arquitetura()`.
 * Uso: `saudeOficina(saude)`, com o que `saudeTecnica()` devolveu ('' quando não há dados).
 *
 * O orçamento de banda entra só como contagem de testes, não em bytes por jogador: a conta fina é
 * engenharia do repositório privado, e o site público não a republica (decisão do dono, 27/09/2026).
 */
import { pct } from './graficos.mjs';
import { esc } from './tema.mjs';

export function saudeOficina(s) {
  if (!s) return '';
  const { net } = s;

  const cards = `<div class="sitrep">
      <div class="read frame"><span class="k">testes automatizados</span><span class="v">${s.testes}</span><span class="d">travam regras a cada entrega (G14), espalhados pelos ${s.modulos} módulos de código</span></div>
      <div class="read frame"><span class="k">módulos com teste</span><span class="v">${s.comTeste}/${s.modulos}</span><span class="d">${pct(s.comTeste / s.modulos)} têm teste próprio; os outros ${s.semTeste.length} estão na lista abaixo, à vista</span></div>
      <div class="read frame"><span class="k">orçamento de rede</span><span class="v">${net ? `${net.tests} testes` : '—'}</span><span class="d">travam a conta do G11 a cada entrega: a sala cheia cabe no teto por jogador. A conta em bytes fica no repositório</span></div>
      <div class="read frame"><span class="k">dívidas no fonte</span><span class="v">${s.forcados}</span><span class="d">conversões forçadas (\`as unknown as\`) em ${s.arquivosTs} arquivos TypeScript: onde o tipo não garante nada — é o tipo de dívida que a seção 9 do \`MULTIPLAYER.md\` vigia</span></div>
    </div>`;

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
    <p class="lede">Nada aqui é digitado à mão: os números saem do próprio repositório a cada build — os testes que travam as regras, os que travam a conta da rede e as dívidas que o tipo não esconde. É a parte chata do desenvolvimento, publicada junto com a bonita.</p>
    ${cards}
    ${tabela}
  </section>`;
}
