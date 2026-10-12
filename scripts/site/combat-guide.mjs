/**
 * O guia da oficina (robôs, arsenal, escudos, equipe) e o roteiro de operação da sala de controle.
 *
 * Regra desta página (R14): **nenhum número é digitado aqui**. Chassis, armas, níveis, escudos e resistências saem do
 * código do jogo (`dados.mjs → jogo()`), e o selo de cada recurso (real, parcial, demo, ausente) sai do quadro
 * `STATUS_REAL.md` (`dados.mjs → statusReal()`). O texto que sobra explica como cada coisa se usa; quando o jogo muda,
 * a página muda junto no build seguinte. (Em 06/10 ela dizia que o escudo metálico "ainda não estava disponível" dois
 * dias depois de ele entrar no jogo, e a tabela de chassis tinha 2 dos 10.)
 */
import { esc } from './tema.mjs';

export const COMBAT_GUIDE_CSS = `
  .combat-nav { display: flex; flex-wrap: wrap; gap: 10px; margin: 18px 0; }
  .combat-nav a { border: 1px solid var(--line); padding: 10px 14px; color: var(--amber); text-decoration: none; }
  .combat-nav a:hover { border-color: var(--amber); }
  .combat-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  .combat-grid.dois { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .combat-card { padding: 20px; display: grid; align-content: start; gap: 12px; min-width: 0; }
  .combat-card h3 { font: 400 1.5rem var(--fd); color: var(--amber); display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; }
  .combat-card p { font-size: 14px; line-height: 1.6; color: var(--muted); }
  .combat-card p b { color: var(--text); }
  .combat-card .meta { font-size: 13px; color: var(--text); font-variant-numeric: tabular-nums; }
  .combat-card a { color: var(--amber); }
  .combat-card[hidden] { display: none; }
  .combat-select { width: 100%; max-width: 420px; padding: 12px; background: var(--bg); color: var(--text); border: 1px solid var(--line); font: inherit; margin: 12px 0; }
  .combat-table { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
  .combat-table th, .combat-table td { padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--line); vertical-align: top; }
  .combat-table thead th { font-weight: 400; font-size: 11px; letter-spacing: .14em; color: var(--muted); text-transform: uppercase; white-space: nowrap; }
  .combat-table tbody th { font-weight: 400; color: var(--text); }
  .combat-table td small, .combat-table th small { display: block; color: var(--muted); font-size: 11.5px; line-height: 1.4; }
  .combat-table .sub td, .combat-table .sub th { color: var(--muted); }
  .arsenal { min-width: 900px; }
  .hm-note { color: var(--muted); font-size: 12.5px; line-height: 1.55; max-width: 84ch; }
  .hm-note b { color: var(--text); }
  .resist td, .combat-table td.nw { white-space: nowrap; }
  .resist thead th small { letter-spacing: .04em; text-transform: none; font-size: 10.5px; white-space: normal; max-width: 15ch; margin: 2px auto 0; }
  .resist tbody th { white-space: nowrap; }
  .modelos { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; font-size: 13px; color: var(--muted); }
  .modelos b { color: var(--amber); }
  /* O selo do quadro de estado do projeto (STATUS_REAL): a cor sozinha nunca diz o estado, a palavra vem junto. */
  .selo { display: inline-block; text-shadow: none; font: 400 11px/1 var(--fb); letter-spacing: .14em; text-transform: uppercase; padding: 4px 7px 3px; border: 1px solid currentColor; vertical-align: middle; }
  .selo.real { color: var(--green); }
  .selo.parcial { color: var(--amber); }
  .selo.demo, .selo.ausente { color: var(--red); }
  .selos-chave { color: var(--muted); font-size: 12.5px; line-height: 1.7; }
  .selos-chave .selo { margin: 0 4px 0 0; }
  @media (max-width: 800px) {
    .combat-grid, .combat-grid.dois { grid-template-columns: 1fr; }
    .combat-table th, .combat-table td { padding: 8px; font-size: 12px; }
  }
`;

const NB = ' ';
/** Número em pt-BR, com até `max` casas ("2,5", "1,75", "5"): o ponto decimal do JavaScript faria "2.5 t" ler como 2 500 t. */
const num = (n, max = 2) => n.toLocaleString('pt-BR', { maximumFractionDigits: max });
/** Valor e unidade presos por um espaço sem quebra: a unidade nunca fica sozinha na linha de baixo. */
const un = (n, unit, max = 2) => `${num(n, max)}${NB}${unit}`;
const pc = (x, max = 0) => `${num(x * 100, max)}%`;
/** Percentual com uma casa quando é pequeno ("1,2%", "7%"). */
const pcf = (x) => pc(x, x < 0.1 ? 1 : 0);
/** Abertura de um cone (do cosseno do meio ângulo): 0,5 → 120°, -1 → 360°. */
const arco = (cosMeio) => Math.round((2 * Math.acos(cosMeio) * 180) / Math.PI);

const NATUREZA = { termico: 'térmico', laser: 'laser', balistico: 'balístico', explosivo: 'explosivo', pulso: 'pulso', sonico: 'sônico', corte: 'corte' };
const natureza = (t) => NATUREZA[t] ?? t;
const MAO = { right: 'D', left: 'E', shoulders: 'Ombros' };

/** Primeiro recurso do quadro de estado que casa com algum dos padrões (na ordem pedida), ou null. */
export function acharStatus(status, ...padroes) {
  for (const re of padroes) {
    const s = status.find((x) => re.test(x.feature));
    if (s) return s;
  }
  return null;
}
const selo = (s) => (s ? `<span class="selo ${s.tag.toLowerCase()}" title="${esc(s.note || `estado: ${s.tag.toLowerCase()}`)}">${s.tag.toLowerCase()}</span>` : '');

/** Os números de um chassi que o fazem diferente de outro: dois chassis com a mesma assinatura são o mesmo robô em campo. */
const assinatura = (c) =>
  JSON.stringify([c.moveSpeed, c.maxJumps, c.jumpVelocity, c.dashSpeed, c.dashCooldown, c.weaponCapacity, c.heatCooling, c.heatCoolDelay, c.heatRecover, c.heatIdleCooling, c.heatRun, c.heatJump, c.heatDash, c.heatPerDamage, c.maxModuleHealth]);

/** Os chassis agrupados pelos números: `[[nomes que repetem o mesmo conjunto], ...]`, do maior grupo para o menor. */
export function familiasDeNumeros(chassis) {
  const grupos = new Map();
  for (const c of Object.values(chassis)) {
    const k = assinatura(c);
    grupos.set(k, [...(grupos.get(k) ?? []), c.name]);
  }
  return [...grupos.values()].sort((a, b) => b.length - a.length);
}

const lista = (itens) => (itens.length < 2 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`);

/** O que há no jogo nesta versão, em quatro leituras: tudo lido do código. */
function inventario(game) {
  const { chassis, weapons: W, shields, metal, vector: V } = game;
  const t = W.TIERS;
  const familias = familiasDeNumeros(chassis);
  const iguais = familias.find((f) => f.includes(V.name))?.length ?? 1;
  const leitura = (k, v, d) => `<div class="read frame"><span class="k">${k}</span><span class="v">${v}</span><span class="d">${d}</span></div>`;
  return `<div class="sitrep" aria-label="O que há no jogo nesta versão">
    ${leitura('robôs pilotáveis', Object.keys(chassis).length, `${familias.length} conjuntos de números: ${iguais} deles repetem os do ${esc(V.name)}`)}
    ${leitura('armas', W.WEAPON_IDS.length, `em ${t.length} níveis (${t[0].label} a ${t.at(-1).label}): ${W.WEAPON_IDS.length * t.length} versões`)}
    ${leitura('escudos', Object.keys(shields.SHIELDS).length + metal.METAL_SHIELD_IDS.length, `${Object.keys(shields.SHIELDS).length} módulos de energia (barreira, esfera e anel de fogo) e ${metal.METAL_SHIELD_IDS.length} modelos de escudo metálico`)}
    ${leitura('cada nível acima', `+${pc(t[1].damage - 1)}`, `de dano, com +${pc(t[1].heat - 1)} de calor e +${pc(t[1].mass - 1)} de massa (${esc(t[1].label)}); o ${esc(t[2].label)} sobe em dobro`)}
  </div>`;
}

/** Uma linha da tabela do arsenal: os números do MK I e, ao lado, o MK III (o que a evolução custa). */
function linhaArma(W, id, fabrica) {
  const a = W.weapon(id, 0);
  const c = W.weapon(id, W.TIERS.length - 1);
  const dano = (w) => (w.barrage ? `${w.barrage.bombs} × ${w.damage}` : `${w.damage}`);
  const notaDano = a.barrage
    ? `bombas, cada uma até ${un(a.blastRadius, 'm')}`
    : a.kind === 'melee'
      ? 'por corte'
      : a.empHeat
        ? `+${pc(a.empHeat)} de calor no alvo`
        : a.blastRadius
          ? `explosão de ${un(a.blastRadius, 'm')}`
          : '';
  const porSeg = Math.round((10 / a.fireInterval)) / 10;
  const cadencia = `${num(porSeg, 1)} ${a.kind === 'melee' ? (porSeg === 1 ? 'corte' : 'cortes') : porSeg === 1 ? 'tiro' : 'tiros'}/s`;
  const notaCad = [
    a.chargeTime ? `carga de ${un(a.chargeTime, 's')}` : '',
    a.magazine ? `carregador de ${a.magazine}, +1 a cada ${un(a.reload, 's')}` : '',
    a.barrage ? `sobe ${un(a.barrage.ascent, 's')} antes de cair` : '',
  ].filter(Boolean).join(' · ');
  const alcance =
    a.kind === 'melee' ? `encostado (${un(a.maxRange, 'm', 1)})` : a.minFactor >= 1 ? `${un(a.maxRange, 'm')}, sem perder força` : `cheio até ${un(a.optimalRange, 'm')}`;
  const notaAlc = a.kind === 'melee' || a.minFactor >= 1 ? '' : `${pc(a.minFactor)} a ${un(a.maxRange, 'm')}, onde some`;
  const nat = natureza(W.DAMAGE_TYPE[id]);
  return `<tr><th scope="row">${esc(a.name)}</th>
    <td>${dano(a)} → ${dano(c)}${notaDano ? `<small>${esc(notaDano)}</small>` : ''}</td>
    <td>${cadencia}${notaCad ? `<small>${esc(notaCad)}</small>` : ''}</td>
    <td class="nw">${pcf(a.heatPerShot)} → ${pcf(c.heatPerShot)}</td>
    <td>${alcance}${notaAlc ? `<small>${esc(notaAlc)}</small>` : ''}</td>
    <td class="nw">${num(a.mass)} → ${un(c.mass, 't')}</td>
    <td>${esc(nat)}</td>
    <td>${fabrica}</td></tr>`;
}

/** Em que robôs a arma já sai montada de fábrica: os nomes (até três) ou a contagem. */
function fabricaEm(game, id) {
  const nomes = Object.entries(game.chassis)
    .filter(([cid]) => {
      const f = game.hangar.factorySpec(cid);
      return [f.right, f.left, f.shoulders].some((a) => a?.id === id);
    })
    .map(([, c]) => c.name);
  if (!nomes.length) return 'só no Hangar';
  return esc(nomes.length <= 3 ? lista(nomes) : `${nomes.length} robôs`);
}

/** O Arsenal: uma tabela com as oito armas e a escada de níveis (armas e escudo metálico). */
function arsenal(game) {
  const { weapons: W, metal } = game;
  const T = W.TIERS;
  const tabela = `<div class="scroll-x"><table class="combat-table arsenal">
      <thead><tr><th scope="col">arma</th><th scope="col">dano</th><th scope="col">cadência</th><th scope="col">calor por tiro</th><th scope="col">alcance</th><th scope="col">massa</th><th scope="col">natureza</th><th scope="col">de fábrica em</th></tr></thead>
      <tbody>${W.WEAPON_IDS.map((id) => linhaArma(W, id, fabricaEm(game, id))).join('')}</tbody>
    </table></div>`;
  const escadaArmas = `<article class="combat-card frame"><h3>Subir uma arma de nível</h3>
      <div class="scroll-x"><table class="combat-table"><thead><tr><th scope="col">nível</th><th scope="col">dano</th><th scope="col">calor por tiro</th><th scope="col">massa</th></tr></thead>
      <tbody>${T.map((t) => `<tr><th scope="row">${esc(t.label)}</th><td>×${num(t.damage)}</td><td>×${num(t.heat)}</td><td>×${num(t.mass)}</td></tr>`).join('')}</tbody></table></div>
      <p>O mesmo para toda arma. O nível alto bate mais forte, mas é o que menos rende por tonelada: quem monta o Mech escolhe onde gastar a carga.</p></article>`;
  const MT = metal.METAL_SHIELD_TIERS;
  const escadaEscudo = `<article class="combat-card frame"><h3>Subir um escudo metálico</h3>
      <div class="scroll-x"><table class="combat-table"><thead><tr><th scope="col">nível</th><th scope="col">chapa</th><th scope="col">resistência</th><th scope="col">massa</th></tr></thead>
      <tbody>${MT.map((t) => `<tr><th scope="row">${esc(t.label)}</th><td>×${num(t.integrity)}</td><td>${t.resist ? `+${num(t.resist * 100, 0)} pontos` : 'a do modelo'}</td><td>${t.mass ? `+${un(t.mass, 't')}` : 'a do modelo'}</td></tr>`).join('')}</tbody></table></div>
      <p>A chapa é a integridade do escudo; a resistência é a fração do dano que ele segura, por natureza (veja Escudos).</p></article>`;
  return `<section aria-labelledby="arsenal"><span class="kicker">// arsenal · ${W.WEAPON_IDS.length} armas, ${T.length} níveis</span><h2 id="arsenal">As armas, medidas</h2>
    <p class="lede">Cada arma é um dado do jogo: dano, cadência, calor por tiro, alcance e massa. Os números são do ${esc(T[0].label)}; a seta mostra o ${esc(T.at(-1).label)}, ou seja, o que a evolução custa. A natureza do dano diz que escudo segura melhor a arma.</p>
    ${tabela}
    <div class="combat-grid dois">${escadaArmas}${escadaEscudo}</div>
  </section>`;
}

/** Os escudos: os módulos de energia (barreira, esfera e anel de fogo) e o escudo metálico (mão esquerda), tudo lido do código. */
function defesas(game, status) {
  const { shields, metal, weapons: W, chassis, hangar, vector: V } = game;
  const estadoEnergia = selo(acharStatus(status, /^Barreira frontal [/] energia/, /^Barreira frontal e esfera/));
  const estadoMetal = selo(acharStatus(status, /^Escudo físico removível/));
  const nomeEnergia = { frontal: 'Barreira frontal', sphere: 'Esfera de energia', fire: 'Anel de fogo' };
  const energia = Object.entries(shields.SHIELDS)
    .map(([id, s]) => {
      if (id === 'fire') {
        // O anel de fogo não segura tiro: solta um círculo de fogo em volta do Mech (números lidos de FIRE_RING).
        return `<article class="combat-card frame"><h3>${esc(nomeEnergia[id])} ${estadoEnergia}</h3>
        <p class="meta">módulo de ${un(s.mass, 't')} · ${num(s.capacity)} de energia · gasta ${num(s.drain)}/s ligado</p>
        <p><b>Não segura tiro.</b> Solta um círculo de fogo de <b>${un(s.radius, 'm')}</b> de raio em volta do Mech por <b>${un(s.capacity / s.drain, 's')}</b>: a cada ${un(s.pulse, 's')}, todo inimigo dentro leva ${num(s.damage)} de dano e fica queimando, e <b>todo Mech dentro esquenta ${num(s.heat * 100)}% do calor, inclusive quem o solta e os aliados</b>. O inimigo congelado que o anel pega derrete e leva ${num(s.melt)} de dano extra: congelar e depois soltar o anel é um combo.</p>
        <p>Só liga com ${num(s.minStart)} de energia ou mais. Depois de ${un(s.recovery, 's')} desligado, recarrega ${num(s.regen)}/s. <b>Ctrl</b> liga e desliga. É um módulo extra: as armas ficam nas mãos.</p></article>`;
      }
      const cobertura = id === 'sphere' ? 'Protege em todas as direções (360°).' : `Cobre ${arco(s.coneCos)}° à frente e acompanha a mira.`;
      return `<article class="combat-card frame"><h3>${esc(nomeEnergia[id] ?? id)} ${estadoEnergia}</h3>
        <p class="meta">módulo de ${un(s.mass, 't')} · ${num(s.capacity)} de energia · gasta ${num(s.drain)}/s ligado</p>
        <p>${cobertura} Cada ponto de dano que segura custa ${num(s.damageCost)} de energia: sem levar tiro dura <b>${un(s.capacity / s.drain, 's')}</b>; levando tiro, menos.</p>
        <p>Só liga com ${num(s.minStart)} de energia ou mais. Depois de ${un(s.recovery, 's')} desligado, recarrega ${num(s.regen)}/s. <b>Ctrl</b> liga e desliga (a tecla se troca em Configurações; no toque há um botão). É um módulo extra: as armas ficam nas mãos.</p></article>`;
    })
    .join('');

  const modelos = metal.METAL_SHIELD_IDS.map((id) => metal.METAL_SHIELDS[id]);
  const integ = modelos.map((m) => m.integrity);
  const braco = V.maxModuleHealth.leftArm;
  const cabe = Object.entries(chassis).filter(([id]) => hangar.acceptsMetalShield(id)).map(([, c]) => c.name);
  const deFabrica = Object.entries(chassis)
    .filter(([, c]) => c.loadout.metalShield)
    .map(([, c]) => `${c.name} (de fábrica, o ${metal.METAL_SHIELDS[c.loadout.metalShield.id].name.replace(/^Escudo /, '')})`);
  const mecanica = `<article class="combat-card frame"><h3>Escudo metálico ${estadoMetal}</h3>
      <p>Ocupa a <b>mão esquerda</b>, no lugar da arma. <b>Segure o Ataque 2</b> (o clique direito) para levantar a chapa.</p>
      <p><b>Levantada:</b> cobre ${arco(metal.RAISED_CONE_COS)}° à frente com a resistência cheia do modelo, e o Mech anda a ${pc(metal.RAISED_SPEED)} da velocidade. <b>Abaixada:</b> protege só o flanco esquerdo (${arco(metal.LOWERED_CONE_COS)}°), com ${pc(metal.LOWERED_FACTOR)} da força.</p>
      <p>Não usa energia: a chapa tem <b>integridade</b> (de ${num(Math.min(...integ))}× a ${num(Math.max(...integ))}× a vida do braço esquerdo; ${num(Math.round(Math.min(...integ) * braco))} a ${num(Math.round(Math.max(...integ) * braco))} num ${esc(V.name)}) e não regenera sozinha: volta com conserto e ao renascer. Braço esquerdo destruído, sem escudo.</p>
      <p>Cabe em: ${esc(lista(cabe))}. ${deFabrica.length ? `Já vem montado: ${esc(lista(deFabrica))}.` : ''}</p></article>`;

  // Quanto cada modelo segura de cada natureza de dano (MK I): é por aqui que se escolhe o escudo contra a arma do inimigo.
  const tipos = Object.keys(modelos[0].resist);
  const armasDe = (t) => Object.entries(W.DAMAGE_TYPE).filter(([, x]) => x === t).map(([id]) => W.weapon(id).name);
  const cab = tipos.map((t) => `<th scope="col">${esc(natureza(t))}<small>${esc(armasDe(t).join(', ') || 'nenhuma arma ainda')}</small></th>`).join('');
  const linhas = modelos
    .map((m) => `<tr><th scope="row">${esc(m.name)}<small>${esc(un(m.mass, 't'))} · chapa de ${num(Math.round(m.integrity * braco))}</small></th>${tipos
      .map((t) => {
        const v = m.resist[t];
        return `<td style="background:rgba(255,176,0,${(0.06 + 0.55 * v).toFixed(3)})" title="${esc(`${m.name} segura ${pc(v)} do dano ${natureza(t)}`)}">${pc(v)}</td>`;
      })
      .join('')}</tr>`)
    .join('');
  const tabela = `<div class="scroll-x"><table class="heatmap combat-table resist">
      <caption class="sr">Quanto do dano cada escudo metálico segura, por natureza do dano</caption>
      <thead><tr><th scope="col"><span class="sr">modelo</span></th>${cab}</tr></thead><tbody>${linhas}</tbody></table></div>`;
  const dicas = `<ul class="modelos">${modelos.map((m) => `<li><b>${esc(m.name.replace(/^Escudo /, ''))}:</b> ${esc(m.hint)}</li>`).join('')}</ul>`;

  return `<section aria-labelledby="defesas"><span class="kicker">// sobreviver também é estratégia</span><h2 id="defesas">Escolha a sua proteção</h2>
    <p class="lede">Os dois tipos se somam. O <b>gerador de energia</b> é um módulo extra: pesa na carga, mas não ocupa mão. O <b>escudo metálico</b> ocupa a mão esquerda, no lugar da arma, e cada modelo segura melhor um tipo de dano.</p>
    <div class="combat-grid">${energia}${mecanica}</div>
    <h3 class="sub-h">Quanto cada escudo metálico segura</h3>
    <p class="hm-note">Levantada a chapa, em % do dano de cada natureza (MK I; cada nível soma ${num(game.metal.METAL_SHIELD_TIERS[1].resist * 100, 0)} pontos). Cor mais forte, segura mais. A natureza de cada arma está na tabela do Arsenal: escolha o modelo pela arma de quem você enfrenta.</p>
    ${tabela}${dicas}
  </section>`;
}

/** A equipe: o texto vem de quem implementou as ordens; o selo vem do quadro de estado. */
function equipe(status) {
  const estado = selo(acharStatus(status, /^Aliados/));
  return `<section aria-labelledby="equipe-offline"><span class="kicker">// você comanda</span><h2 id="equipe-offline">Uma equipe ao seu lado ${estado}</h2>
    <div class="combat-grid"><article class="combat-card frame"><h3>1 · Acompanhar</h3><p>Escolta com plasma e supressor com EMP acompanham o jogador, retomam a formação e respondem a ameaças.</p></article><article class="combat-card frame"><h3>2 · Concentrar fogo</h3><p>Mire em um inimigo e dê a ordem. Os aliados priorizam esse alvo, respeitando alcance, reação e linha de visão.</p></article><article class="combat-card frame"><h3>3 · Defender</h3><p>A equipe ocupa a região onde você deu a ordem. Volte para Acompanhar quando quiser avançar.</p></article></div>
    <p class="lede">Ordens disponíveis na Arena offline, também por botões na tela. Navegação local e busca de cobertura ainda estão em evolução.</p></section>`;
}

/** Os robôs: um cartão por chassi, com a montagem de fábrica e o que cabe em cada encaixe. */
function robos(game) {
  const { chassis, slots, weapons: W, hangar, shields, metal } = game;
  const ultimo = W.TIERS.length - 1;
  const arma = (a) => (metal.isMetalShieldId(a.id) ? metal.METAL_SHIELDS[a.id].name : W.weapon(a.id, a.tier).name);
  const cards = Object.entries(chassis)
    .map(([id, c]) => {
      const f = hangar.factorySpec(id);
      const fabrica = [
        f.right && `${MAO.right}: ${arma(f.right)}`,
        f.left && `${MAO.left}: ${arma(f.left)}`,
        f.shoulders && `${MAO.shoulders}: ${arma(f.shoulders)}`,
      ].filter(Boolean);
      const armas = W.WEAPON_IDS.filter((w) => Object.values(slots[id]).some((l) => l.includes(w)));
      const linhasArmas = armas
        .map((idW) => {
          const w = W.weapon(idW);
          const encaixes = Object.entries(slots[id]).filter(([, l]) => l.includes(idW)).map(([slot]) => MAO[slot]);
          return `<tr><th scope="row">${esc(w.name)}</th><td>${encaixes.join(' / ')}</td><td>${num(w.mass)} → ${un(W.weapon(idW, ultimo).mass, 't')}</td></tr>`;
        })
        .join('');
      const placa = hangar.acceptsMetalShield(id)
        ? (() => {
            const ms = metal.METAL_SHIELD_IDS.map((m) => metal.METAL_SHIELDS[m].mass);
            return `<tr class="sub"><th scope="row">Escudo metálico (${ms.length} modelos)</th><td>${MAO.left}</td><td>${num(Math.min(...ms))} a ${un(Math.max(...ms), 't')}</td></tr>`;
          })()
        : '';
      const modulos = id === 'android'
        ? ''
        : Object.entries(shields.SHIELDS)
            .map(([sid, s]) => `<tr class="sub"><th scope="row">${sid === 'sphere' ? 'Esfera de energia' : sid === 'fire' ? 'Anel de fogo' : 'Barreira frontal'}</th><td>módulo</td><td>${un(s.mass, 't')}</td></tr>`)
            .join('');
      const movimento = [
        c.maxJumps ? `${c.maxJumps} ${c.maxJumps === 1 ? 'pulo' : 'pulos'}` : 'sem pulo',
        c.dashSpeed ? `dash de ${un(c.dashSpeed, 'm/s')}, a cada ${un(c.dashCooldown, 's')}` : 'sem dash',
      ].join(' · ');
      return `<article class="combat-card frame" data-workshop-chassis="${esc(id)}">
      <h3>${esc(c.name)}</h3>
      <p class="meta">carga ${un(c.weaponCapacity, 't')} · ${un(c.moveSpeed, 'm/s')} · torso ${num(c.maxModuleHealth.torso)}<br>${esc(movimento)}</p>
      <p>De fábrica: <b>${esc(fabrica.join(' · '))}</b></p>
      <div class="scroll-x"><table class="combat-table"><thead><tr><th scope="col">cabe</th><th scope="col">encaixe</th><th scope="col">massa ${esc(W.TIERS[0].label)} → ${esc(W.TIERS[ultimo].label)}</th></tr></thead><tbody>${linhasArmas}${placa}${modulos}</tbody></table></div>
      <a href="../jogar/?build=${encodeURIComponent(hangar.loadoutKey(f))}">Pilotar ${esc(c.name)} →</a>
    </article>`;
    })
    .join('');
  const familias = familiasDeNumeros(chassis);
  const iguais = familias[0];
  const proprios = familias.slice(1).flat();
  const nota =
    iguais.length > 1
      ? `<p class="hm-note">Hoje <b>${iguais.length} dos ${Object.keys(chassis).length} robôs têm exatamente os mesmos números</b> (${esc(lista(iguais))}): velocidade, vida, pulos, dash e calor. O que os separa é o desenho e a montagem de fábrica. ${proprios.length ? `${esc(lista(proprios))} ${proprios.length === 1 ? 'tem números próprios' : 'têm números próprios'}.` : ''}</p>`
      : '';
  return `<section aria-labelledby="montagens"><span class="kicker">// robôs · o que cabe em cada um</span><h2 id="montagens">O que cabe no seu robô?</h2>
    <p class="lede">Compare os encaixes antes de entrar no Hangar. A combinação final precisa caber na carga do chassi, somando as armas, o gerador de energia e a chapa do escudo metálico.</p>
    <label for="workshop-chassis">Filtrar chassi</label><br><select class="combat-select" id="workshop-chassis"><option value="">Todos os chassis</option>${Object.entries(chassis).map(([id, c]) => `<option value="${esc(id)}">${esc(c.name)} · ${un(c.weaponCapacity, 't')}</option>`).join('')}</select>
    <p class="hm-note">D e E são os braços; Ombros são os lançadores dos ombros (contam um por ombro). A massa vai do ${esc(W.TIERS[0].label)} ao ${esc(W.TIERS[ultimo].label)}: o nível alto pesa mais (veja o Arsenal).</p>
    <div class="combat-grid">${cards}</div>
    ${nota}
  </section>`;
}

/** O guia inteiro da oficina: o que há no jogo, os robôs, o arsenal, os escudos e a equipe. */
export function workshopGuide(game, status = []) {
  const chave = status.length
    ? `<p class="selos-chave"><span class="selo real">real</span>funciona de ponta a ponta · <span class="selo parcial">parcial</span>funciona, com limites conhecidos (por exemplo, ainda não no online) · <span class="selo demo">demo</span>só visual · <span class="selo ausente">ausente</span>ainda não existe. Os selos são lidos do quadro de estado do projeto.</p>`
    : '';
  return `${inventario(game)}${chave}
  <nav class="combat-nav" aria-label="Explorar a Oficina"><a href="#montagens">Robôs</a><a href="#arsenal">Arsenal</a><a href="#defesas">Escudos</a><a href="#equipe-offline">Equipe offline</a><a href="#calor">Calor</a><a href="#mapa">Mapa do código</a></nav>
  ${robos(game)}
  ${arsenal(game)}
  ${defesas(game, status)}
  ${equipe(status)}`;
}

export const WORKSHOP_SCRIPT = `const chassisFilter=document.getElementById('workshop-chassis');chassisFilter?.addEventListener('change',()=>{for(const card of document.querySelectorAll('[data-workshop-chassis]'))card.hidden=!!chassisFilter.value&&card.dataset.workshopChassis!==chassisFilter.value;});
const abreBloco=()=>{const id=location.hash.length>1?decodeURIComponent(location.hash.slice(1)):'';const alvo=id?document.getElementById(id):null;const d=alvo?.closest('details');if(d&&!d.open){d.open=true;alvo.scrollIntoView();}};addEventListener('hashchange',abreBloco);abreBloco();`;

export function operationGuide(base) {
  return `<nav class="combat-nav" aria-label="Navegar pela operação"><a href="#validar-build">Testar esta versão</a><a href="#proximas-decisoes">Próximas decisões</a><a href="#novidades">Entregas</a><a href="${base}oficina/#montagens">Arsenal por chassi</a></nav>
  <section aria-labelledby="validar-build"><span class="kicker">// qualidade percebida em partida</span><h2 id="validar-build">O que observar ao jogar</h2><div class="combat-grid"><article class="combat-card frame"><h3>Controle e defesa</h3><p>Equipe um gerador de energia no Hangar (Ctrl liga e desliga) ou, nos chassis compatíveis, o escudo metálico na mão esquerda (segure o botão 2). Confira a cobertura, o gasto de energia ou o desgaste da chapa e a clareza da mira.</p><a href="${base}oficina/#defesas">Comparar escudos →</a></article><article class="combat-card frame"><h3>Decisões dos aliados</h3><p>Na Arena offline, avance, marque um alvo com 2 e mande defender com 3. Observe se a equipe chega, ajuda e retoma a formação com 1.</p><a href="${base}jogar/">Entrar na Arena →</a></article><article class="combat-card frame"><h3>Qualidade comprovada</h3><p>Testes automáticos verificam regras e regressões. Playtest verifica ritmo, legibilidade e diversão. Os dois são necessários; contar testes não certifica a experiência.</p><a href="${base}oficina/#metodo">Entender a bancada →</a></article></div></section>
  <section aria-labelledby="proximas-decisoes"><span class="kicker">// propostas · ainda não equipáveis</span><h2 id="proximas-decisoes">Novas armas, novos papéis</h2><div class="combat-grid"><article class="combat-card frame"><h3>Feixe térmico</h3><p>Pressão contínua de curto alcance. Exige manter a mira; o calor limita a duração. Próximo protótipo sugerido para diferenciar armas de rajada.</p></article><article class="combat-card frame"><h3>Arpão magnético</h3><p>Controle de posição com cabo visível e alcance curto. A diferença de massa e a possibilidade de romper o cabo devem impedir aprisionamento sem resposta.</p></article><article class="combat-card frame"><h3>Antes de ampliar</h3><p>Validar a escolta em rotas com vários obstáculos, revisar cobertura e flanqueamento e levar a integridade e a chapa levantada do escudo metálico para o online.</p></article></div><p class="lede">Capacidade multiplayer depende de homologação prolongada em produção. Ensaios locais com clientes sintéticos não garantem 10, 50 ou 100 pessoas simultâneas.</p></section>`;
}
