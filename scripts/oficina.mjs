/**
 * Oficina (/cybermech/oficina/): a bancada de testes do jogo. Mechs, armas e defesas medidos pela mesma
 * simulação do jogo (client/src/combat/balance.ts: tick fixo de 60 Hz, calor, cadência, carregador),
 * a cada versão. Nenhum número é digitado aqui: tudo sai do TypeScript do jogo (dados.mjs → jogo()).
 *
 * Uso: node scripts/oficina.mjs --out <.tmp/site/oficina/index.html>
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { arquitetura, entregas, jogo, marcos, porModulo, saudeTecnica } from './site/dados.mjs';
import { GRAFO_CSS, grafoOficina } from './site/grafo.mjs';
import { CHART_CSS, divergingBars, heatTable, lineChart, nf, pct, rankBars } from './site/graficos.mjs';
import { saudeOficina } from './site/saude.mjs';
import { esc, pagina, topo } from './site/tema.mjs';

const argv = process.argv.slice(2);
const OUT = resolve(argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : '.tmp/site/oficina/index.html');
const m = marcos();
const game = await jogo();
// O mapa da arquitetura: módulos, testes e frentes (arquitetura()) e a equipe de cada frente (das etiquetas dos PRs).
// A mesma leitura do repositório alimenta a saúde técnica: testes por módulo, onde falta teste e o orçamento de banda.
const arq = arquitetura();
const grafo = grafoOficina(arq, porModulo(entregas().prs));
const saude = saudeOficina(saudeTecnica(arq, game));

function build() {
  const { weapons: W, balance: B, heat: H, vector: V, android: A } = game;
  const P = W.weapon('plasma');
  const P3 = W.weapon('plasma', 2);
  const R = W.weapon('rockets');
  const SECONDS = 20;

  // ---------- 1. o que esquenta ----------
  const actions = [
    { label: `Tiro de plasma ${W.TIERS[0].label}`, value: P.heatPerShot },
    { label: `Tiro de plasma ${W.TIERS[2].label}`, value: P3.heatPerShot },
    { label: `Disparo de foguete ${W.TIERS[0].label}`, value: R.heatPerShot },
    { label: 'Dash', value: V.heatDash },
    { label: 'Pulo', value: V.heatJump },
    { label: '1 s correndo', value: V.heatRun },
    { label: `Levar 1 tiro de plasma (${P.damage})`, value: P.damage * V.heatPerDamage },
    { label: '1 s superaquecido, parado', value: -V.heatCooling * H.OVERHEAT_COOLING },
    { label: '1 s esfriando, andando', value: -V.heatCooling },
    { label: '1 s esfriando, parado', value: -V.heatCooling * V.heatIdleCooling },
  ];
  const sign = (v) => `${v >= 0 ? '+' : '−'}${pct(Math.abs(v), Math.abs(v) < 0.1 ? 1 : 0)}`;
  const heatBudget = divergingBars({
    title: 'Quanto cada ação esquenta o Mech',
    caption: `Em % do dissipador do ${esc(V.name)}. Em vermelho o que esquenta; em ciano o que esfria. O resfriamento só começa ${nf(V.heatCoolDelay, 2)} s depois do último tiro, pulo ou dash.`,
    items: actions,
    fmt: sign,
    ariaLabel: `Calor de cada ação: ${actions.map((a) => `${a.label} ${sign(a.value)}`).join('; ')}`,
  });

  // ---------- 2. dinamômetro: exercícios de 20 s ----------
  const drills = [
    { name: 'Parado, gatilho apertado', d: { speed: 0, fire: [P] } },
    { name: 'Correndo, gatilho apertado', d: { speed: 1, fire: [P] } },
    { name: 'Correndo, plasma + foguetes', d: { speed: 1, fire: [P, R] } },
    { name: 'Rajadas de 6, parando na pausa', d: { speed: 1, fire: [P], burst: { shots: 6, pause: 1.2 }, stopInPause: true } },
    { name: 'Rajadas de 6, sem parar', d: { speed: 1, fire: [P], burst: { shots: 6, pause: 1.2 } } },
    { name: 'Só manobra: corre, dash e pulo', d: { speed: 1, fire: [], dashEvery: 3, jumpEvery: 2 } },
  ].map((x) => ({ ...x, r: B.drill(V, x.d, SECONDS) }));
  const xs = drills[0].r.heat.map((_, i) => i * 0.1);
  const minis = drills
    .map(({ name, r }) => {
      const peak = Math.max(...r.heat);
      const caption =
        r.overheatAt === null
          ? `<b>nunca superaquece</b> · pico de ${pct(peak)} · <b>${nf(r.damage)}</b> de dano em ${SECONDS} s`
          : `ferve em <b>${nf(r.overheatAt, 1)} s</b> · travado <b>${pct(r.lockedShare)}</b> do tempo · <b>${nf(r.damage)}</b> de dano`;
      return lineChart({
        title: name,
        caption,
        xs,
        ys: r.heat,
        xMax: SECONDS,
        yMax: 1,
        xTicks: [0, 5, 10, 15, 20],
        yTicks: [0, 0.5, 1],
        xFmt: (t) => `${t} s`,
        yFmt: (t) => pct(t),
        band: [H.HOT, 1, 'quente'],
        ceiling: 1,
        locks: r.locked,
        ariaLabel: `${name}: calor ao longo de ${SECONDS} s; ${r.overheatAt === null ? 'nunca superaquece' : `superaquece em ${nf(r.overheatAt, 1)} s e fica travado ${pct(r.lockedShare)} do tempo`}; ${r.damage} de dano`,
      });
    })
    .join('');
  const drillTable = `<details class="table-view"><summary>ver os números em tabela</summary>
      <table><thead><tr><th>exercício (${SECONDS} s)</th><th>ferve em</th><th>travado</th><th>pico de calor</th><th>dano</th><th>dano/s</th></tr></thead><tbody>${drills
        .map(({ name, r }) => `<tr><td>${esc(name)}</td><td>${r.overheatAt === null ? '—' : `${nf(r.overheatAt, 1)} s`}</td><td>${pct(r.lockedShare)}</td><td>${pct(Math.max(...r.heat))}</td><td>${nf(r.damage)}</td><td>${nf(r.damage / SECONDS, 1)}</td></tr>`)
        .join('')}</tbody></table>
    </details>`;

  // ---------- 3. placar: dano entregue ----------
  const firing = drills.filter((x) => x.d.fire.length === 1);
  const best = firing.reduce((a, b) => (b.r.damage > a.r.damage ? b : a));
  const heldRun = drills[1];
  const gain = best.r.damage / heldRun.r.damage - 1;
  const ranking = rankBars({
    title: `Dano entregue em ${SECONDS} s, só com o plasma`,
    caption: `Todos os tiros no alvo. Quem administra o calor causa <b>${pct(gain)} mais dano</b> que quem corre com o gatilho apertado.`,
    items: [...firing]
      .sort((a, b) => b.r.damage - a.r.damage)
      .map(({ name, r }) => ({ label: name, value: r.damage, best: r === best.r, note: r.overheatAt === null ? 'sem travar' : `${pct(r.lockedShare)} travado` })),
    fmt: (v) => nf(v),
  });

  // ---------- 4. tempo para destruir cada parte ----------
  const mh = V.maxModuleHealth;
  const parts = [
    { label: 'CABEÇA', hp: mh.head },
    { label: 'BRAÇO', hp: mh.rightArm },
    { label: 'PERNA', hp: mh.leftLeg },
    { label: 'TORSO', hp: mh.torso },
  ];
  const rowsW = ['plasma', 'rockets'].flatMap((id) => [0, 1, 2].map((t) => W.weapon(id, t)));
  const cells = rowsW.map((w) =>
    parts.map((p) => {
      const t = B.timeToKill([w], V, p.hp);
      return { v: t, text: `${nf(t, 1)} s`, title: `${w.name} ${W.TIERS[w.tier].label} destrói ${p.label.toLowerCase()} (${p.hp}) em ${nf(t, 1)} s` };
    }),
  );
  const all = cells.flat().map((c) => c.v);
  const [tMin, tMax] = [Math.min(...all), Math.max(...all)];
  const ttk = heatTable({
    rows: rowsW.map((w) => `${w.name.toUpperCase()} ${W.TIERS[w.tier].label}`),
    cols: parts.map((p) => ({ label: p.label, sub: `${p.hp} de vida` })),
    cells,
    strong: (v) => 1 - (v - tMin) / (tMax - tMin || 1),
    caption: `Tempo para destruir cada parte de um ${V.name}, por arma e nível`,
  });

  // ---------- 5. dano × distância (uma arma por gráfico, mesma escala) ----------
  const XMAX = 240;
  const ranges = ['plasma', 'rockets', 'blaster']
    .map((id) => {
      const w = W.weapon(id);
      const dx = Array.from({ length: 49 }, (_, i) => i * 5).filter((d) => d <= w.maxRange);
      const note =
        w.minFactor < 1
          ? `cheio até <b>${w.optimalRange} m</b>, ${pct(w.minFactor)} a ${w.maxRange} m, onde some`
          : `não perde força; some a <b>${w.maxRange} m</b> · lento (${w.speed} m/s): de longe, dá para desviar`;
      return lineChart({
        title: w.name,
        caption: `${note}${id === 'blaster' ? ' · arma dos andróides' : ''}`,
        xs: dx,
        ys: dx.map((d) => W.rangeFactor(w, d)),
        xMax: XMAX,
        yMax: 1,
        xTicks: [0, 60, 120, 180, 240],
        yTicks: [0, 0.5, 1],
        xFmt: (t) => `${t} m`,
        yFmt: (t) => pct(t),
        marks: w.minFactor < 1 ? [{ x: w.optimalRange, y: 1, title: `alcance ótimo: ${w.optimalRange} m` }] : [],
        ariaLabel: `${w.name}: dano em função da distância; ${w.minFactor < 1 ? `100% até ${w.optimalRange} m e ${pct(w.minFactor)} a ${w.maxRange} m` : `100% até ${w.maxRange} m`}`,
      });
    })
    .join('');

  // ---------- 6. chassis na bancada ----------
  const chassisRows = [V, A].map((c) => {
    const run = B.drill(c, { speed: 1, fire: [c.loadout.primary] }, SECONDS);
    return `<tr><th scope="row">${esc(c.name)}</th><td>${c.moveSpeed} m/s</td><td>${c.maxModuleHealth.torso}</td><td>${esc(c.loadout.primary.name.toLowerCase())}</td><td>${pct(c.heatCooling)}/s</td><td>${pct(c.heatRun)}/s</td><td>${run.overheatAt === null ? 'não ferve' : `${nf(run.overheatAt, 1)} s`}</td></tr>`;
  });

  const readouts = `<div class="sitrep">
      <div class="read frame"><span class="k">dissipador</span><span class="v">${pct(V.heatCooling)}/s</span><span class="d">quanto o ${esc(V.name)} esfria andando</span></div>
      <div class="read frame"><span class="k">parado</span><span class="v">×${nf(V.heatIdleCooling)}</span><span class="d">esfria em dobro: parar é a manobra de resfriamento</span></div>
      <div class="read frame"><span class="k">quente</span><span class="v">≥ ${pct(H.HOT)}</span><span class="d">aviso no painel: a próxima rajada pode travar</span></div>
      <div class="read frame"><span class="k">superaquecido</span><span class="v">100%</span><span class="d">armas travadas, sem pulo nem dash, ${pct(H.OVERHEAT_SPEED)} da velocidade até voltar a ${pct(V.heatRecover)}</span></div>
    </div>`;

  return `
  <header class="o-hero">
    <p class="boot">&gt; bancada de testes · simulação do jogo a 60 Hz · build ${esc(m.head)}<span class="cursor" aria-hidden="true">█</span></p>
    <h1 class="title">OFI<span>CINA</span></h1>
    <p class="pitch">Aqui cada Mech, arma e defesa passa pela bancada antes de ir para a arena. Os gráficos saem da mesma simulação que roda no jogo, refeita a cada versão: nada é desenhado à mão. É assim que o equilíbrio vira número, e a estratégia, uma escolha que dá para medir.</p>
  </header>

  ${grafo.html}

  <section aria-labelledby="calor">
    <span class="kicker">// termodinâmica · ${esc(V.name)}</span>
    <h2 id="calor">O calor decide a luta</h2>
    <p class="lede">Tudo esquenta o Mech: cada tiro (cada arma tem o seu coeficiente), correr, pular, dar dash e até levar tiro. Um dissipador só, do chassi, esfria tudo. Quem ferve trava; quem para esfria em dobro.</p>
    ${readouts}
    ${heatBudget}
  </section>

  <section aria-labelledby="dinamometro">
    <span class="kicker">// dinamômetro · ${SECONDS} s por exercício</span>
    <h2 id="dinamometro">Seis pilotos, o mesmo Mech</h2>
    <p class="lede">O mesmo ${esc(V.name)} com o canhão de plasma ${W.TIERS[0].label}, pilotado de seis jeitos. A linha é o calor; a faixa clara é a zona quente; as tiras vermelhas, o tempo travado.</p>
    <div class="minis">${minis}</div>
    ${drillTable}
    ${ranking}
  </section>

  <section aria-labelledby="partes">
    <span class="kicker">// balística · defesa por parte</span>
    <h2 id="partes">Tempo para destruir cada parte</h2>
    <p class="lede">Gatilho apertado, parado, todos os tiros na mesma parte de um ${esc(V.name)}. Quanto mais intenso, mais rápido. A perna cai bem antes do torso: mirar é a habilidade que mais rende.</p>
    ${ttk}
    <p class="hm-legend"><span>mais rápido</span><i></i><span>mais lento</span></p>
  </section>

  <section aria-labelledby="distancia">
    <span class="kicker">// balística · distância</span>
    <h2 id="distancia">Dano e distância</h2>
    <p class="lede">O plasma se dissipa no caminho: chegar perto rende, mas expõe. O foguete não perde força, mas voa devagar.</p>
    <div class="minis">${ranges}</div>
  </section>

  <section aria-labelledby="chassis">
    <span class="kicker">// chassis na bancada</span>
    <h2 id="chassis">Chassis</h2>
    <p class="lede">Correndo com o gatilho apertado. O andróide é leve e esfria rápido: quase nunca ferve, mas a arma dele mal arranha um Mech.</p>
    <div class="scroll-x"><table class="spec">
      <thead><tr><th scope="col">chassi</th><th scope="col">velocidade</th><th scope="col">torso</th><th scope="col">arma</th><th scope="col">dissipa</th><th scope="col">corrida</th><th scope="col">ferve em</th></tr></thead>
      <tbody>${chassisRows.join('')}</tbody>
    </table></div>
  </section>

  ${saude}

  <section class="method frame" aria-labelledby="metodo">
    <h2 id="metodo">Como a bancada mede</h2>
    <ul>
      <li>O mesmo código do jogo: calor, cadência e carregador rodam no tick fixo de 60 Hz, sem sorteio.</li>
      <li>Teto teórico: todos os tiros acertam, no alcance ótimo. No jogo, errar e se mexer deixam tudo mais lento.</li>
      <li>Um teste compara a bancada com o Mech de verdade, com física, correndo e atirando: a diferença de calor fica abaixo de 8 pontos.</li>
      <li><b>${game.benchTests} testes de simulação</b> travam estas regras a cada entrega. Se uma mudança criar apelação, a versão não sai.</li>
    </ul>
  </section>`;
}

const css = `
  ${CHART_CSS}
  ${GRAFO_CSS}
  .o-hero { display: grid; gap: 16px; padding-top: 30px; }
  .pitch { font-size: 17px; line-height: 1.6; color: var(--text); max-width: 64ch; text-wrap: pretty; }
  .read .d { color: var(--muted); font-size: 12.5px; line-height: 1.4; }
  .spec { width: 100%; border-collapse: collapse; font-size: 14px; font-variant-numeric: tabular-nums; }
  .spec th, .spec td { padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--line); white-space: nowrap; }
  .spec thead th { font-weight: 400; font-size: 11px; letter-spacing: .14em; color: var(--muted); text-transform: uppercase; }
  .spec tbody th { font: 400 1.15rem var(--fd); color: var(--amber); letter-spacing: .05em; }
  .method { padding: 18px 20px; display: grid; gap: 10px; }
  .method h2 { font-size: 1.6rem; }
  .method ul { margin: 0; padding-left: 18px; display: grid; gap: 6px; color: var(--text); font-size: 14px; }
  .method li::marker { content: '> '; color: var(--amber); }
`;

const body = `
  ${topo({ base: '../', current: 'oficina', left: 'CYBERMECH // OFICINA', live: `bancada · build ${esc(m.head)}` })}
  ${game ? build() : '<section><h2>Bancada fora do ar</h2><p class="lede">Não foi possível ler a simulação do jogo neste build.</p></section>'}
  <footer><span>CYBERMECH © ${new Date().getFullYear()} <b>SERAFIM WEB</b> · números gerados pela simulação do jogo</span><span>build ${esc(m.head)} · ${esc(m.generated)} BRT</span></footer>
`;

const html = pagina({
  title: 'Oficina · CYBERMECH',
  description: 'A bancada de testes do CYBERMECH: calor, armas e defesas dos Mechs medidos pela simulação do jogo a cada versão.',
  css,
  body,
  script: grafo.script,
});
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
console.log(`oficina ${OUT}${game ? '' : ' (sem os dados do jogo)'}`);
