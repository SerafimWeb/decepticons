/**
 * Oficina (/oficina/): a bancada de testes do jogo. Mechs, armas e defesas medidos pela mesma
 * simulação do jogo (client/src/combat/balance.ts: tick fixo de 60 Hz, calor, cadência, carregador),
 * a cada versão. Nenhum número é digitado aqui: tudo sai do TypeScript do jogo (dados.mjs → jogo()), e o selo de
 * cada recurso, do quadro STATUS_REAL.md (dados.mjs → statusReal()).
 *
 * Uso: node scripts/oficina.mjs --out <.tmp/site/oficina/index.html>
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { arquitetura, entregas, jogo, marcos, porModulo, saudeTecnica, statusReal } from './site/dados.mjs';
import { GRAFO_CSS, grafoOficina } from './site/grafo.mjs';
import { CHART_CSS, divergingBars, heatTable, lineChart, nf, pct, rankBars } from './site/graficos.mjs';
import { saudeOficina } from './site/saude.mjs';
import { esc, pagina } from './site/tema.mjs';
import { HUD_PAGE_CSS, hudCss, hudFooter, hudNav, limpaRotulos, pageHero } from './site/hud.mjs';
import { COMBAT_GUIDE_CSS, WORKSHOP_SCRIPT, familiasDeNumeros, workshopGuide } from './site/combat-guide.mjs';

const argv = process.argv.slice(2);
// A oficina do site é só o **jogo**: robôs, armas, escudos, calor. O mapa da arquitetura e a saúde técnica (testes por módulo, onde falta teste, conversões forçadas) são o retrato das nossas fraquezas e do
// nosso desenho interno: ficam só na versão `--interno`, no PC do Comandante (`.decepticons/VITRINE.md`; a guarda é `scripts/site/vitrine.mjs`).
const INTERNO = argv.includes('--interno');
const OUT = resolve(argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : INTERNO ? '.tmp/painel/oficina-interna.html' : '.tmp/site/oficina/index.html');
const m = marcos();
const game = await jogo();
const status = statusReal();
// O mapa da arquitetura: módulos, testes e frentes (arquitetura()) e a equipe de cada frente (das etiquetas dos PRs).
// A mesma leitura do repositório alimenta a saúde técnica: testes por módulo, onde falta teste e o orçamento de banda.
const arq = INTERNO ? arquitetura() : null;
const grafo = INTERNO ? grafoOficina(arq, porModulo(entregas().prs)) : null;
const saude = INTERNO ? saudeOficina(saudeTecnica(arq, game)) : '';

/** Espaço sem quebra: o número e a unidade nunca se separam na virada de linha ("20 / s" sozinho na linha de baixo). */
const NB = ' ';
const sec = (n, d = 1) => `${nf(n, d)}${NB}s`;
const met = (n, d = 0) => `${nf(n, d)}${NB}m`;
const lista = (itens) => (itens.length < 2 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`);

/**
 * As rajadas dos exercícios: 8 tiros e 1 s de pausa. É o cenário que `MechHeat.test.ts` trava ("andando na pausa fervem;
 * parando na pausa, não"). Com 6 tiros e 1,2 s de pausa, o par dava empate (864 de dano nos dois, pico de 49% e 50%): a pausa
 * longa esfriava o Mech de qualquer jeito e o gráfico não provava nada. Mexeu no calor? Confira que o par ainda se distingue.
 */
const BURST = { shots: 8, pause: 1 };

function build() {
  const { weapons: W, balance: B, heat: H, vector: V, zones: Z, chassis: CH } = game;
  const P = W.weapon('plasma');
  const R = W.weapon('rockets');
  const SECONDS = 20;

  // ---------- 1. o que esquenta ----------
  const verbo = { chainsaw: 'corte', barrage: 'lançamento' };
  const porTiro = W.WEAPON_IDS.map((id) => W.weapon(id))
    .sort((a, b) => b.heatPerShot - a.heatPerShot)
    .map((w) => ({ label: `${w.name} · 1 ${verbo[w.id] ?? 'tiro'}`, value: w.heatPerShot }));
  const actions = [
    ...porTiro,
    { label: 'Dash', value: V.heatDash },
    { label: 'Pulo', value: V.heatJump },
    { label: '1 s correndo', value: V.heatRun },
    { label: `Levar 1 tiro de plasma (${P.damage} de dano)`, value: P.damage * V.heatPerDamage },
    { label: '1 s superaquecido, parado', value: -V.heatCooling * H.OVERHEAT_COOLING },
    { label: '1 s esfriando, andando', value: -V.heatCooling },
    { label: '1 s esfriando, parado', value: -V.heatCooling * V.heatIdleCooling },
  ];
  const sign = (v) => `${v >= 0 ? '+' : '−'}${pct(Math.abs(v), Math.abs(v) < 0.1 ? 1 : 0)}`;
  const heatBudget = divergingBars({
    title: 'Quanto cada ação esquenta o Mech',
    caption: `Cada barra é quanto a ação soma (vermelho) ou tira (ciano) da barra de calor do ${esc(V.name)}, que vai de 0% a 100%: em 100% o Mech superaquece. Os itens “1 s” são taxas por segundo. O resfriamento só começa ${sec(V.heatCoolDelay, 2)} depois do último tiro, pulo ou dash; as armas estão no ${W.TIERS[0].label}.`,
    items: actions,
    fmt: sign,
    ariaLabel: `Calor de cada ação: ${actions.map((a) => `${a.label} ${sign(a.value)}`).join('; ')}`,
  });
  const plasmaRate = P.heatPerShot / P.fireInterval;
  const zona = `Na arena, a zona de resfriamento tira ${pct(Z.COOL_ZONE_VENT_RATE)}/s sem esperar o atraso${Z.COOL_ZONE_VENT_RATE >= plasmaRate ? `: mais do que o plasma esquenta em rajada contínua (${pct(plasmaRate)}/s), então parado nela dá para segurar o gatilho sem travar` : ''}.`;

  // ---------- 2. dinamômetro: exercícios de 20 s ----------
  const drills = [
    { name: 'Parado, gatilho apertado', d: { speed: 0, fire: [P] } },
    { name: 'Correndo, gatilho apertado', d: { speed: 1, fire: [P] } },
    { name: 'Correndo, plasma + foguetes', d: { speed: 1, fire: [P, R] } },
    { name: `Rajadas de ${BURST.shots}, andando na pausa`, d: { speed: 1, fire: [P], burst: BURST } },
    { name: `Rajadas de ${BURST.shots}, parando na pausa`, d: { speed: 1, fire: [P], burst: BURST, stopInPause: true } },
    { name: 'Só manobra: corre, dash e pulo', d: { speed: 1, fire: [], dashEvery: 3, jumpEvery: 2 } },
  ].map((x) => ({ ...x, r: B.drill(V, x.d, SECONDS) }));
  const [heldStill, heldRun, , moving, stopping] = drills;
  const xs = drills[0].r.heat.map((_, i) => i * 0.1);
  const minis = drills
    .map(({ name, r }) => {
      const peak = Math.max(...r.heat);
      const caption =
        r.overheatAt === null
          ? `<b>nunca superaquece</b> · pico de <b>${pct(peak)}</b> · <b>${nf(r.damage)}</b> de dano`
          : `ferve em <b>${sec(r.overheatAt)}</b> · travado <b>${pct(r.lockedShare)}</b> do tempo · <b>${nf(r.damage)}</b> de dano`;
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
        yTitle: 'calor',
        band: [H.HOT, 1, 'quente'],
        ceiling: 1,
        locks: r.locked,
        ariaLabel: `${name}: calor ao longo de ${SECONDS} s; ${r.overheatAt === null ? 'nunca superaquece' : `superaquece em ${nf(r.overheatAt, 1)} s e fica travado ${pct(r.lockedShare)} do tempo`}; ${r.damage} de dano`,
      });
    })
    .join('');
  const drillTable = `<details class="table-view"><summary>ver os números em tabela</summary>
      <div class="scroll-x"><table><thead><tr><th>exercício (${SECONDS} s)</th><th>ferve em</th><th>travado</th><th>pico de calor</th><th>dano</th><th>dano/s</th></tr></thead><tbody>${drills
        .map(({ name, r }) => `<tr><td>${esc(name)}</td><td>${r.overheatAt === null ? '—' : sec(r.overheatAt)}</td><td>${pct(r.lockedShare)}</td><td>${pct(Math.max(...r.heat))}</td><td>${nf(r.damage)}</td><td>${nf(r.damage / SECONDS, 1)}</td></tr>`)
        .join('')}</tbody></table></div>
    </details>`;
  // A chave de leitura: o que cada traço dos seis gráficos quer dizer, dita uma vez.
  const chave = `<ul class="chave" aria-label="Como ler os gráficos de calor">
      <li><i class="k-line"></i>calor do Mech</li>
      <li><i class="k-band"></i>zona quente: a partir de ${pct(H.HOT)}</li>
      <li><i class="k-ceil"></i>limite: em 100% o Mech superaquece</li>
      <li><i class="k-lock"></i>tempo travado: armas bloqueadas, sem pulo nem dash</li>
    </ul>`;
  // O achado é tirado dos números do próprio build: se o equilíbrio mudar, a frase muda (ou some, e o build avisa).
  const contraste = moving.r.overheatAt !== null && stopping.r.overheatAt === null;
  if (!contraste) console.warn('::warning::oficina: as rajadas andando e parando na pausa deixaram de se distinguir; a bancada já não mostra que parar esfria. Reveja BURST em scripts/oficina.mjs');
  const trava = [heldStill, heldRun].map((x) => x.r.lockedShare);
  const achado = contraste
    ? `<p class="achado">Segurar o gatilho trava o Mech em <b>${pct(Math.min(...trava))} a ${pct(Math.max(...trava))}</b> do tempo. Em rajadas de ${BURST.shots} tiros com ${sec(BURST.pause, 0)} de pausa, quem <b>anda</b> na pausa ainda ferve (em ${sec(moving.r.overheatAt)}) e passa ${pct(moving.r.lockedShare)} do tempo travado; quem <b>para</b> na pausa nunca ferve (o calor não passa de ${pct(Math.max(...stopping.r.heat))}) e entrega ${nf(stopping.r.damage)} de dano, <b>${pct(stopping.r.damage / moving.r.damage - 1)} a mais</b>. Parar é a manobra que esfria.</p>`
    : '';

  // ---------- 3. placar: dano entregue ----------
  const firing = drills.filter((x) => x.d.fire.length === 1);
  const best = firing.reduce((a, b) => (b.r.damage > a.r.damage ? b : a));
  const gain = best.r.damage / heldRun.r.damage - 1;
  const ranking = rankBars({
    title: `Dano entregue em ${SECONDS} s, só com o plasma`,
    caption: `Todos os tiros no alvo. O melhor, <b>${esc(best.name.toLowerCase())}</b>, entrega <b>${pct(gain)} mais dano</b> que correr com o gatilho apertado${best.r.overheatAt === null ? ' e nunca fica travado' : ''}.`,
    items: [...firing]
      .sort((a, b) => b.r.damage - a.r.damage)
      .map(({ name, r }) => ({ label: name, value: r.damage, best: r.damage === best.r.damage, note: r.overheatAt === null ? 'sem travar' : `${pct(r.lockedShare)} travado` })),
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
  // Fora da tabela: o EMP (não é arma de dano: o que importa é o calor que soma ao alvo), a chuva de mísseis (de área) e a motosserra (de contato).
  const ttkIds = ['plasma', 'rockets', 'blaster', 'shotgun', 'railgun'];
  const rowsW = ttkIds.flatMap((id) => W.TIERS.map((_, t) => W.weapon(id, t)));
  const cells = rowsW.map((w) =>
    parts.map((p) => {
      const t = B.timeToKill([w], V, p.hp);
      return Number.isFinite(t)
        ? { v: t, text: sec(t), title: `${w.name} ${W.TIERS[w.tier].label} destrói ${p.label.toLowerCase()} (${p.hp}) em ${nf(t, 1)} s` }
        : { v: null, text: '—', title: `${w.name} ${W.TIERS[w.tier].label} não destrói ${p.label.toLowerCase()} em 2 minutos` };
    }),
  );
  const all = cells.flat().map((c) => c.v).filter((v) => v !== null);
  const [lnMin, lnMax] = [Math.log(Math.min(...all)), Math.log(Math.max(...all))];
  const ttk = heatTable({
    rows: rowsW.map((w) => `${w.name.toUpperCase()} ${W.TIERS[w.tier].label}`),
    cols: parts.map((p) => ({ label: p.label, sub: `${p.hp} de vida` })),
    cells,
    // Escala logarítmica na cor: o blaster (dezenas de segundos) não apaga a diferença entre o plasma e o trilho. Os números não mudam.
    strong: (v) => 1 - (Math.log(v) - lnMin) / (lnMax - lnMin || 1),
    caption: `Tempo para destruir cada parte de um ${V.name}, por arma e nível`,
  });
  const E = W.weapon('emp');
  const legTime = B.timeToKill([P], V, mh.leftLeg);
  const torsoTime = B.timeToKill([P], V, mh.torso);

  // ---------- 5. dano × distância (uma arma por gráfico, mesma escala) ----------
  // As armas de P152 (míssil leve, guiado, laser e cruzador) entram aqui: é o gráfico em que o Comandante enxerga o alcance de cada uma na mesma escala.
  const rangeIds = ['plasma', 'rockets', 'blaster', 'shotgun', 'railgun', 'emp', 'barrage', 'swarm', 'seeker', 'laser', 'cruise', 'grenade'];
  const rangeW = rangeIds.map((id) => W.weapon(id));
  const XMAX = Math.ceil(Math.max(...rangeW.map((w) => w.maxRange)) / 40) * 40;
  const flight = (w) =>
    w.barrage ? `sobe ${sec(w.barrage.ascent)} e cai ${sec(w.barrage.fall)}` : w.beam ? 'acerta na hora (feixe, sem voo)' : w.cruise ? `voa em arco: ${sec(w.maxRange / w.speed)} até o fim` : w.lob ? 'cai em arco no ponto da mira (gravidade); tabela na parede' : `${sec(w.maxRange / w.speed)} de voo até o fim`;
  const ranges = rangeW
    .map((w) => {
      const dx = [];
      for (let d = 0; d < w.maxRange; d += 5) dx.push(d);
      dx.push(w.maxRange);
      const note =
        w.minFactor < 1
          ? `cheio até <b>${met(w.optimalRange)}</b> · ${pct(w.minFactor)} a ${met(w.maxRange)}, onde some`
          : `não perde força; some a <b>${met(w.maxRange)}</b>`;
      return lineChart({
        title: w.name,
        caption: `${note} · ${flight(w)}`,
        // O último ponto desce a zero no alcance máximo: ali o tiro se desfaz.
        xs: [...dx, w.maxRange],
        ys: [...dx.map((d) => W.rangeFactor(w, d)), 0],
        xMax: XMAX,
        yMax: 1,
        xTicks: [0, 1, 2, 3, 4].map((k) => (XMAX / 4) * k),
        yTicks: [0, 0.5, 1],
        xFmt: (t) => `${t} m`,
        yFmt: (t) => pct(t),
        yTitle: 'dano',
        marks: w.minFactor < 1 ? [{ x: w.optimalRange, y: 1, title: `alcance ótimo: ${w.optimalRange} m` }] : [],
        cut: { x: w.maxRange, label: 'some' },
        ariaLabel: `${w.name}: dano em função da distância; ${w.minFactor < 1 ? `100% até ${w.optimalRange} m e ${pct(w.minFactor)} a ${w.maxRange} m` : `100% até ${w.maxRange} m`}, e o tiro some aí`,
      });
    })
    .join('');
  const comoLer = `<div class="g frame how">
      <h3>Como ler</h3>
      <ul>
        <li>A linha é quanto do dano chega ao alvo em cada distância (100% = dano cheio).</li>
        <li>O ponto marca o alcance ótimo: até ali o dano é cheio. Depois dele cai em linha reta até o alcance máximo.</li>
        <li>No alcance máximo o tiro se desfaz (“some”): a linha despenca a zero.</li>
        <li>Os sete gráficos têm a mesma escala, de 0 a ${met(XMAX)}: dá para comparar a olho.</li>
      </ul>
    </div>`;
  const rangeTable = `<details class="table-view"><summary>ver os números em tabela</summary>
      <div class="scroll-x"><table><thead><tr><th>arma</th><th>cheio até</th><th>alcance máximo</th><th>dano no máximo</th><th>voo até o máximo</th></tr></thead><tbody>${rangeW
        .map((w) => `<tr><td>${esc(w.name)}</td><td>${w.minFactor < 1 ? met(w.optimalRange) : 'o alcance todo'}</td><td>${met(w.maxRange)}</td><td>${pct(w.minFactor)}</td><td>${esc(flight(w))}</td></tr>`)
        .join('')}</tbody></table></div>
    </details>`;
  const porAlcance = [...rangeW].sort((a, b) => a.maxRange - b.maxRange);
  const curta = porAlcance[0];
  const longa = porAlcance.at(-1);

  // ---------- 6. chassis na bancada ----------
  const robos = Object.values(CH);
  const armasDoGatilho = (c) => [c.loadout.primary, c.loadout.offhand].filter(Boolean);
  const nomesArmas = (guns) => {
    const n = new Map();
    for (const g of guns) n.set(g.name.toLowerCase(), (n.get(g.name.toLowerCase()) ?? 0) + 1);
    return [...n].map(([nome, k]) => (k > 1 ? `${k} × ${nome}` : nome)).join(' + ');
  };
  const chassisRows = robos.map((c) => {
    const run = B.drill(c, { speed: 1, fire: armasDoGatilho(c) }, SECONDS);
    return `<tr><th scope="row">${esc(c.name)}</th><td>${nf(c.moveSpeed, c.moveSpeed % 1 ? 1 : 0)}${NB}m/s</td><td>${nf(c.maxModuleHealth.torso)}</td><td>${nf(c.weaponCapacity, c.weaponCapacity % 1 ? 1 : 0)}${NB}t</td><td>${esc(nomesArmas(armasDoGatilho(c)))}</td><td>${pct(c.heatCooling)}/s</td><td>${pct(c.heatRun)}/s</td><td>${run.overheatAt === null ? `não ferve em ${SECONDS}${NB}s` : sec(run.overheatAt)}</td></tr>`;
  });
  const maisVeloz = robos.reduce((a, b) => (b.moveSpeed > a.moveSpeed ? b : a));
  const maisForte = robos.reduce((a, b) => (b.maxModuleHealth.torso > a.maxModuleHealth.torso ? b : a));
  const semSalto = robos.filter((c) => !c.maxJumps && !c.dashSpeed).map((c) => c.name);
  const familias = familiasDeNumeros(CH);
  const iguais = familias[0];
  const destaques = `Correndo com o gatilho principal apertado por ${SECONDS}${NB}s. O mais veloz é <b>${esc(maisVeloz.name)}</b> (${nf(maisVeloz.moveSpeed, maisVeloz.moveSpeed % 1 ? 1 : 0)}${NB}m/s); o mais resistente, <b>${esc(maisForte.name)}</b> (${nf(maisForte.maxModuleHealth.torso)} no torso e ${nf(maisForte.weaponCapacity)}${NB}t de carga)${semSalto.length ? `; ${esc(lista(semSalto))} não pula nem dá dash` : ''}.${iguais.length > 1 ? ` ${iguais.length} dos ${robos.length} robôs repetem os números do ${esc(V.name)}, por isso várias linhas se parecem: hoje o que os separa é o desenho e a montagem de fábrica.` : ''}`;

  const readouts = `<div class="sitrep">
      <div class="read frame"><span class="k">dissipador</span><span class="v">${pct(V.heatCooling)}/s</span><span class="d">quanto o ${esc(V.name)} esfria andando</span></div>
      <div class="read frame"><span class="k">parado</span><span class="v">×${nf(V.heatIdleCooling)}</span><span class="d">esfria em dobro: parar é a manobra de resfriamento</span></div>
      <div class="read frame"><span class="k">quente</span><span class="v">≥ ${pct(H.HOT)}</span><span class="d">aviso no painel: a próxima rajada pode travar</span></div>
      <div class="read frame"><span class="k">superaquecido</span><span class="v">100%</span><span class="d">armas travadas, sem pulo nem dash, ${pct(H.OVERHEAT_SPEED)} da velocidade até voltar a ${pct(V.heatRecover)}</span></div>
    </div>`;

  return `


  ${workshopGuide(game, status)}
  ${INTERNO ? `<details id="mapa" class="mapa"><summary>Explorar arquitetura e módulos do jogo</summary>${grafo.html}</details>` : ''}

  <section aria-labelledby="calor">
    <span class="kicker">// termodinâmica · ${esc(V.name)}</span>
    <h2 id="calor">O calor decide a luta</h2>
    <p class="lede">Tudo esquenta o Mech: cada tiro (cada arma tem o seu coeficiente), correr, pular, dar dash e até levar tiro. Um dissipador só, do chassi, esfria tudo. Quem ferve trava; quem para esfria em dobro. ${zona}</p>
    ${readouts}
    ${heatBudget}
  </section>

  <section aria-labelledby="dinamometro">
    <span class="kicker">// dinamômetro · ${SECONDS} s por exercício</span>
    <h2 id="dinamometro">Seis pilotos, o mesmo Mech</h2>
    <p class="lede">O mesmo ${esc(V.name)} com o canhão de plasma ${W.TIERS[0].label}, pilotado de seis jeitos durante ${SECONDS}${NB}s. Nas rajadas, são ${BURST.shots} tiros e ${sec(BURST.pause, 0)} de pausa entre elas.</p>
    ${chave}
    ${achado}
    <div class="minis">${minis}</div>
    ${drillTable}
    ${ranking}
  </section>

  <section aria-labelledby="partes">
    <span class="kicker">// balística · defesa por parte</span>
    <h2 id="partes">Tempo para destruir cada parte</h2>
    <p class="lede">Gatilho apertado, parado, todos os tiros na mesma parte de um ${esc(V.name)}. Cor mais forte, destrói mais rápido. Com o plasma ${W.TIERS[0].label}, a perna cai em ${sec(legTime)} e o torso em ${sec(torsoTime)}: mirar nas partes é a habilidade que mais rende.</p>
    ${ttk}
    <p class="hm-legend"><span>mais rápido</span><i></i><span>mais lento</span></p>
    <p class="hm-note">Fora da tabela: o <b>${esc(E.name)}</b> não é arma de dano (${E.damage} por pulso): cada pulso soma <b>${pct(E.empHeat)} de calor</b> ao alvo até ${met(E.optimalRange)} (${pct(E.empHeat * E.minFactor)} a ${met(E.maxRange)}), por cima do calor que ele mesmo gera. A chuva de mísseis é de área e a motosserra, de contato: têm regras próprias, descritas no Arsenal.</p>
  </section>

  <section aria-labelledby="distancia">
    <span class="kicker">// balística · distância</span>
    <h2 id="distancia">Dano e distância</h2>
    <p class="lede">Cada arma tem um alcance ótimo, com dano cheio, e um alcance máximo, onde o tiro se desfaz: da ${esc(curta.name.toLowerCase())} (cheia até ${met(curta.optimalRange)}, some a ${met(curta.maxRange)}) ao ${esc(longa.name.toLowerCase())} (cheio até ${met(longa.optimalRange)}, some a ${met(longa.maxRange)}). Chegar perto rende, mas expõe; de longe, o tiro lento dá tempo de desviar.</p>
    <div class="minis">${ranges}${comoLer}</div>
    ${rangeTable}
  </section>

  <section aria-labelledby="chassis">
    <span class="kicker">// chassis na bancada</span>
    <h2 id="chassis">Chassis</h2>
    <p class="lede">${destaques}</p>
    <div class="scroll-x"><table class="spec">
      <thead><tr><th scope="col">chassi</th><th scope="col">velocidade</th><th scope="col">torso</th><th scope="col">carga</th><th scope="col">gatilho principal</th><th scope="col">dissipa</th><th scope="col">corrida</th><th scope="col">ferve em</th></tr></thead>
      <tbody>${chassisRows.join('')}</tbody>
    </table></div>
  </section>

  ${saude}

  <section class="method frame" aria-labelledby="metodo">
    <h2 id="metodo">Como a bancada mede</h2>
    <ul>
      <li>O mesmo código do jogo: calor, cadência, carga e carregador rodam no tick fixo de 60 Hz, sem sorteio.</li>
      <li>Teto teórico: todos os tiros acertam, no alcance ótimo, num alvo parado e sem defesa (sem escudo e sem cobertura). No jogo, errar e se mexer deixam tudo mais lento.</li>
      <li>Um teste compara a bancada com o Mech de verdade, com física, correndo e atirando: a diferença de calor fica abaixo de 8 pontos. Só o ${esc(V.name)} com o canhão de plasma passa por essa prova.</li>
      <li>${game.benchTests} testes de simulação travam as regras de arma, calor e bancada a cada entrega. Equilíbrio e diversão também precisam de partidas reais.</li>
      <li>As tabelas e os gráficos são refeitos a cada versão: o carimbo no rodapé diz de qual.</li>
    </ul>
  </section>`;
}

const css = `
  ${COMBAT_GUIDE_CSS}
  ${CHART_CSS}
  ${INTERNO ? GRAFO_CSS : ''}
  .o-hero { display: grid; gap: 16px; padding-top: 30px; }
  .pitch { font-size: 17px; line-height: 1.6; color: var(--text); max-width: 64ch; text-wrap: pretty; }
  .read .d { color: var(--muted); font-size: 12.5px; line-height: 1.4; }
  .mapa > summary { cursor: pointer; color: var(--amber); font-size: 13px; letter-spacing: .14em; text-transform: uppercase; padding: 12px 0; }
  .mapa[open] > summary { padding-bottom: 14px; }
  .spec { width: 100%; border-collapse: collapse; font-size: 14px; font-variant-numeric: tabular-nums; }
  .spec th, .spec td { padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--line); white-space: nowrap; }
  .spec thead th { font-weight: 400; font-size: 11px; letter-spacing: .14em; color: var(--muted); text-transform: uppercase; }
  .spec tbody th { font: 400 1.15rem var(--fd); color: var(--amber); letter-spacing: .05em; }
  .method { padding: 18px 20px; display: grid; gap: 10px; }
  .method h2 { font-size: 1.6rem; }
  .method ul { margin: 0; padding-left: 18px; display: grid; gap: 6px; color: var(--text); font-size: 14px; }
  .method li::marker { content: '> '; color: var(--amber); }
`;

const hero = pageHero({
  base: '../',
  eyebrowText: 'ESTATÍSTICAS DE COMBATE',
  title: 'OFICINA',
  sub: 'DADOS QUE IMPORTAM',
  art: 'cena-duelo.jpg',
  pitch: 'Aqui cada Mech, arma e escudo passa pela bancada antes de ir para a arena. Nenhum número é digitado: os gráficos saem da mesma simulação que roda no jogo, os robôs, as armas e os escudos são lidos do código dele, e os selos vêm do quadro de estado do projeto, tudo refeito a cada versão. É assim que o equilíbrio vira número, e a estratégia, uma escolha que dá para medir.',
  extra: `<div class="hero-meta"><span class="chip-tag" style="color:var(--amber)">SIMULAÇÃO A 60 HZ</span><span class="chip-tag" style="color:var(--muted)">BUILD ${esc(m.head)}</span></div>`,
});
const body = `
  ${hudNav({ base: '../', current: 'oficina' })}
  <main id="conteudo">
  ${hero}
  <div class="page">
  ${game ? limpaRotulos(build()) : '<section><h2>Bancada fora do ar</h2><p class="lede">Não foi possível ler a simulação do jogo neste build.</p></section>'}
  </div>
  </main>
  ${hudFooter({ base: '../' })}
`;

const html = pagina({
  title: 'Oficina · CYBERMECH',
  description: 'A bancada de testes do CYBERMECH: robôs, armas, escudos e calor medidos pela simulação do jogo a cada versão.',
  css: hudCss('../') + HUD_PAGE_CSS + css,
  body,
  script: INTERNO ? `${grafo.script}\n${WORKSHOP_SCRIPT}` : WORKSHOP_SCRIPT,
});
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
console.log(`oficina ${OUT}${game ? '' : ' (sem os dados do jogo)'}`);
