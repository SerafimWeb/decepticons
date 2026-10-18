/**
 * Dados das páginas do site (landing e bastidores). Tudo sai do repositório, nada é digitado à mão:
 * ROADMAP, ESTADO_ATUAL, GAME_DESIGN, HISTORICO_DE_DECISOES, o código do jogo, o git e (se houver
 * acesso) a lista de PRs do GitHub. Formato que mudou → a seção some em vez de mentir (R14).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const read = (path) => readFileSync(resolve(path), 'utf8').replace(/\r\n/g, '\n');

/** O histórico de decisões inteiro: o vivo e os arquivados (`arquivo/historico-*.md`, do mais novo ao mais velho, a ordem de antes de arquivar). */
function historicoCompleto() {
  const dir = '.decepticons/arquivo';
  const arquivados = existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => /^historico-.*\.md$/.test(f))
        .sort()
        .reverse()
        .map((f) => read(`${dir}/${f}`).split('<!-- arquivo -->')[1] ?? '')
    : [];
  return [read('.decepticons/HISTORICO_DE_DECISOES.md'), ...arquivados].join('\n');
}

/** Sem shell: argumentos em lista. Fora de um repositório git (ou comando que falha), devolve vazio. */
export function git(...args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 32 << 20 }).trim();
  } catch {
    return '';
  }
}

// ---------- ROADMAP e ESTADO ----------

export function parseRoadmap(md) {
  const errors = [];
  const fronts = [];
  const phases = [];
  let current = null;
  md.split(/\r?\n/).forEach((line, i) => {
    const n = i + 1;
    const front = /^\|\s*`#([a-z-]+)`\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/.exec(line);
    if (front) {
      fronts.push({ tag: front[1], name: front[2], desc: front[3] });
      return;
    }
    if (line.startsWith('## ')) {
      const phase = /FASE\s+(\d+)\s+—\s+(.+)$/.exec(line);
      if (phase) {
        const focus = /\(atual\)/i.test(phase[2]);
        const title = phase[2].replace(/\s*\([^)]*\)\s*$/, '').trim();
        current = { num: Number(phase[1]), title, focus, ideas: false, items: [] };
        phases.push(current);
      } else if (/IDEIAS/i.test(line)) {
        current = { num: null, title: 'Ideias', focus: false, ideas: true, items: [] };
        phases.push(current);
      } else {
        current = null;
      }
      return;
    }
    const item = /^- \[( |x|~)\]\s+(.+)$/.exec(line);
    if (!item || !current) return;
    const tagged = /^(.*?)\s+#([a-z-]+)\s*$/.exec(item[2]);
    if (!tagged) {
      errors.push(`linha ${n}: item sem etiqueta de frente: "${item[2].slice(0, 60)}"`);
      return;
    }
    const status = item[1] === 'x' ? 'done' : item[1] === '~' ? 'doing' : 'todo';
    current.items.push({ status: current.ideas && status === 'todo' ? 'idea' : status, text: tagged[1], tag: tagged[2], line: n });
  });

  const known = new Set(fronts.map((f) => f.tag));
  if (fronts.length === 0) errors.push('tabela de FRENTES não encontrada (linhas "| `#etiqueta` | Frente | O que cobre |")');
  for (const p of phases) {
    if (p.items.length === 0) errors.push(`${p.ideas ? 'IDEIAS' : `FASE ${p.num}`} sem itens`);
    for (const it of p.items) if (!known.has(it.tag)) errors.push(`linha ${it.line}: etiqueta #${it.tag} não está na tabela de FRENTES`);
  }
  const focused = phases.filter((p) => p.focus);
  if (focused.length !== 1) errors.push(`precisa de exatamente uma fase com "(atual)"; há ${focused.length}`);
  if (!phases.some((p) => !p.ideas)) errors.push('nenhuma fase "## … FASE N — Título" encontrada');
  return { fronts, phases, errors };
}

export function readRoadmap() {
  return parseRoadmap(read('.decepticons/ROADMAP.md'));
}

/** Números do roadmap: estado de cada fase, progresso de cada frente. */
export function roadmapStats({ fronts, phases }) {
  const phaseItems = phases.filter((p) => !p.ideas).flatMap((p) => p.items);
  const done = phaseItems.filter((i) => i.status === 'done').length;
  const total = phaseItems.length;
  const ideasCount = phases.filter((p) => p.ideas).flatMap((p) => p.items).length;
  const focus = phases.find((p) => p.focus);
  for (const p of phases) {
    const d = p.items.filter((i) => i.status === 'done').length;
    p.done = d;
    p.state = p.ideas ? 'ideas' : d === p.items.length ? 'done' : p.focus ? 'focus' : d === 0 && p.num > focus.num ? 'locked' : 'open';
  }
  const next = phases.find((p) => !p.ideas && p.num === focus.num + 1) ?? null;
  const RANKS = [
    [1, 'MAXIMIZADO', 'max'],
    [0.67, 'NOMINAL', 'ok'],
    [0.34, 'OPERACIONAL', 'op'],
    [0.01, 'CRÍTICO', 'crit'],
    [0, 'OFFLINE', 'off'],
  ];
  const frontStats = fronts.map((f) => {
    const items = phases.flatMap((p) => p.items.map((it) => ({ ...it, phase: p })).filter((it) => it.tag === f.tag));
    const d = items.filter((i) => i.status === 'done').length;
    const ratio = items.length ? d / items.length : 0;
    const [, rank, rankClass] = RANKS.find(([min]) => ratio >= min);
    return { ...f, items, done: d, ratio, rank, rankClass };
  });
  return { done, total, ideasCount, focus, next, frontStats, pct: total ? Math.round((done / total) * 100) : 0 };
}

/** Linhas de uma tabela markdown, sem o cabeçalho e sem a linha de traços: cada linha vira a lista de células. */
function tableRows(md) {
  return md
    .split('\n')
    .map((l) => /^\|(.+)\|\s*$/.exec(l)?.[1].split('|').map((c) => c.trim()))
    .filter((c) => c && !/^:?-+:?$/.test(c[0]))
    .slice(1);
}

export function readEstado() {
  const md = read('.decepticons/ESTADO_ATUAL.md');
  const section = (title) => {
    const m = new RegExp(`^## ${title}[^\\n]*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm').exec(md);
    return m ? m[1].trim() : '';
  };
  const team = [];
  for (const line of section('DIVISÃO DE TRABALHO').split('\n')) {
    const row = /^\|\s*\*\*(.+?)\*\*\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*$/.exec(line);
    if (row && !/zona/i.test(row[1])) team.push({ name: row[1], role: row[3] });
  }
  // "- [ ] **Quem:** tarefa" → pendências por pessoa.
  const pending = [...section('PENDENTE').matchAll(/^- \[ \] \*\*(.+?):\*\*\s*(.+)$/gm)].map((p) => ({ who: p[1], text: p[2] }));
  // Decisões que esperam o dono: "| Decisão | Situação |".
  const open = tableRows(section('DECISÕES EM ABERTO')).map(([title, text]) => ({ title, text }));
  return {
    next: section('PRÓXIMA SESSÃO'),
    team,
    pending,
    open,
    status: /\*\*Iteração atual:\*\*\s*(.+)/.exec(md)?.[1] ?? '',
  };
}

// ---------- STATUS_REAL ----------

/**
 * O quadro do que existe de verdade (`STATUS_REAL.md`, R13): uma linha por recurso, com o estado em REAL, PARCIAL, DEMO ou
 * AUSENTE. A oficina conta como cada coisa funciona pelo código do jogo e mostra, ao lado, o selo deste quadro: o quão pronta
 * ela está. Linha que mudou de nome ou de formato → sem selo, nunca selo errado (R14).
 */
export function statusReal() {
  try {
    return read('.decepticons/STATUS_REAL.md')
      .split('\n')
      .map((l) => /^\|\s*([^|]+?)\s*\|\s*(REAL|PARCIAL|DEMO|AUSENTE)\b([^|]*)\|/.exec(l))
      .filter(Boolean)
      .map((m) => ({ feature: m[1], tag: m[2], note: m[3].replace(/^\s*[—–-]\s*/, '').trim() }));
  } catch {
    return [];
  }
}

// ---------- GAME_DESIGN ----------

function designSection(title) {
  try {
    const g = read('.decepticons/GAME_DESIGN.md');
    return new RegExp(`## ${title}[^\\n]*\\n([\\s\\S]*?)\\n---`).exec(g)?.[1] ?? '';
  } catch {
    return '';
  }
}

/** O princípio "não é pay-to-win" (fonte única: GAME_DESIGN.md). */
export function pledge() {
  return [...designSection('PRINCÍPIO: NÃO É PAY-TO-WIN').matchAll(/^- (.+)$/gm)].map((m) => m[1]);
}

/** O que o jogador encontra hoje, para a landing: `- **Título:** frase.` na seção VITRINE. */
export function vitrine() {
  return [...designSection('VITRINE').matchAll(/^- \*\*(.+?):\*\*\s*(.+)$/gm)].map((m) => ({ title: m[1], text: m[2] }));
}

/** Direções futuras explicitamente separadas do que já está no jogo. */
export function horizonte() {
  return [...designSection('HORIZONTE').matchAll(/^- \*\*(.+?):\*\*\s*(.+)$/gm)].map((m) => ({ title: m[1], text: m[2] }));
}

// ---------- código do jogo ----------

/**
 * Carrega do TypeScript do jogo, pelo mesmo compilador do build (Vite), o que o site mostra: o chassi
 * e o arsenal. O número da página é o número do jogo, sem cópia nem regex (R14). Os módulos lidos não
 * tocam em WebGL nem em DOM. Falhou? Devolve null, a seção some e o log avisa.
 */
export async function jogo() {
  try {
    const { runnerImport } = await import('vite');
    const load = async (p) => (await runnerImport(resolve(p), { configFile: false, logLevel: 'silent' })).module;
    const weapons = await load('client/src/combat/weapons.ts');
    const balance = await load('client/src/combat/balance.ts');
    const heat = await load('client/src/combat/heat.ts');
    // Os números dos chassis ficam num arquivo sem 3D: o site não carrega o Three.js.
    const { VECTOR09_STATS, ANDROID_STATS, PILOT_ANDROID_STATS, ARM_SLOTS, CHASSIS, CHASSIS_SIZE } = await load('client/src/entities/chassis.ts');
    const hangar = await load('client/src/hangar/loadout.ts');
    // As classes de arma (leve, média, pesada): a ficha de cada arma na landing diz a dela.
    const weaponClass = await load('client/src/combat/weaponClass.ts');
    const shields = await load('client/src/combat/EnergyShield.ts');
    // O escudo físico (4 modelos, resistência por natureza de dano) e as zonas da arena: a oficina descreve os dois pelos números do jogo.
    const metal = await load('client/src/combat/MetalShield.ts');
    const zones = await load('client/src/combat/Zone.ts');
    const count = (file) => (read(file).match(/^\s+it\(/gm) ?? []).length;
    // Rede (multiplayer): ritmos, tetos e a conta da banda, do mesmo código que os testes travam.
    const netConst = await load('shared/net/constants.ts');
    const budget = await load('shared/net/budget.ts');
    // Status público do servidor (GET /status): a landing pergunta sozinha se há gente jogando agora.
    const status = await load('shared/net/status.ts');
    // Métricas de produto (POST /evento): a landing conta visita e cliques quando há servidor de jogo.
    const serverUrl = await load('shared/net/serverUrl.ts');
    const telemetry = await load('shared/net/telemetry.ts');
    const net = {
      ...netConst,
      statusUrl: status.statusUrl(process.env.VITE_GAME_SERVER),
      statusPollS: status.STATUS_POLL_S,
      eventoUrl: serverUrl.serverHttpUrl(process.env.VITE_GAME_SERVER, telemetry.EVENTO_PATH),
      inputBytes: (await load('shared/net/input.ts')).INPUT_BYTES,
      unitBytes: (await load('shared/net/state.ts')).UNIT_BYTES,
      download: budget.downloadPerSecond(netConst.ROOM_UNITS),
      upload: budget.uploadPerSecond(),
      maxUnits: budget.unitsWithinBudget(),
      tests: count('shared/net/codec.test.ts') + count('client/src/net/adapters.test.ts'),
    };
    const tests = count('client/src/combat/weapons.test.ts');
    // Testes que travam as regras da bancada: armas, calor e o Mech de verdade contra a bancada.
    const benchTests = tests + count('client/src/combat/heat.test.ts') + count('client/src/entities/MechHeat.test.ts');
    return { weapons, balance, heat, hangar, weaponClass, shields, metal, zones, vector: VECTOR09_STATS, android: ANDROID_STATS, pilot: PILOT_ANDROID_STATS, slots: ARM_SLOTS, chassis: CHASSIS, sizes: CHASSIS_SIZE, tests, benchTests, net };
  } catch (err) {
    console.warn(`::warning::site sem os dados do jogo: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

/** Ficha técnica do Vector-09 (chassi e armas de fábrica), do código do jogo. */
export function recordSheet(game) {
  if (!game) return null;
  const v = game.vector;
  const m = v.maxModuleHealth;
  const p = v.loadout.primary;
  return {
    name: v.name,
    speed: v.moveSpeed,
    dash: v.dashSpeed,
    jumps: v.maxJumps,
    fire: p.fireInterval,
    damage: p.damage,
    primary: p.name,
    secondary: v.loadout.secondary?.name ?? null,
    armor: [
      ['CABEÇA', m.head],
      ['TORSO', m.torso],
      ['BRAÇO E', m.leftArm],
      ['BRAÇO D', m.rightArm],
      ['PERNA E', m.leftLeg],
      ['PERNA D', m.rightLeg],
    ],
  };
}

/**
 * Arsenal do Hangar: cada arma de Mech nos três níveis, com o dano sustentado e o tempo para derrubar o
 * torso do Vector-09 calculados pela mesma simulação do jogo (`combat/balance.ts`: teto teórico, todos
 * os tiros no alvo). O blaster fica de fora: é a arma dos andróides. `weapons` é o que cabe nos braços do
 * Vector-09 (as contas da página sobre o Hangar são dele); `others` é o resto dos Mechs, como a escopeta do
 * Lancer-L1, com o nome do chassi que a carrega. O alvo das contas é sempre o torso do Vector-09.
 */
export function arsenal(game) {
  if (!game) return null;
  const { weapons: W, balance: B, vector: v, slots: S, chassis: C, sizes: Z } = game;
  const torso = v.maxModuleHealth.torso;
  // Só as armas dos braços do Mech (energia e munição); blaster e motosserra são dos andróides.
  const ids = W.WEAPON_IDS.filter((id) => id !== 'blaster' && W.weapon(id).kind !== 'melee');
  const levels = [0, 1, 2];
  const card = (id, slot) => {
    const base = W.weapon(id, 0);
    return {
      id,
      name: base.name,
      kind: base.kind,
      // Leve, média ou pesada (a do tamanho de robô para o qual a arma foi feita, o 2 dos Mechs).
      class: game.weaponClass.CLASS_LABEL[game.weaponClass.WEAPON_FIT[id].class].toLowerCase(),
      speed: base.speed,
      optimal: base.optimalRange,
      max: base.maxRange,
      minFactor: base.minFactor,
      blast: base.blastRadius,
      magazine: base.magazine,
      slot,
      tiers: levels.map((t) => {
        const w = W.weapon(id, t);
        return {
          label: W.TIERS[t].label,
          damage: w.damage,
          rate: 1 / w.fireInterval,
          heat: w.heatPerShot,
          reload: w.reload,
          mass: w.mass,
          dps: B.sustainedDps(w, v),
          ttk: B.timeToKill([w], v, torso),
        };
      }),
    };
  };
  const onVector = (id) => S.vector09.right.includes(id) || S.vector09.left.includes(id);
  // Onde a arma da `others` mora: o chassi de menor tamanho que a aceita (os Mechs antes do gigante), na ordem do catálogo, e em qual encaixe (braço ou ombros).
  const carrier = (id) => {
    const chassisId = Object.keys(S)
      .filter((c) => S[c].right.includes(id) || S[c].left.includes(id) || (S[c].shoulders ?? []).includes(id))
      .sort((a, b) => Z[a] - Z[b])[0];
    const chassis = C[chassisId].name;
    const lugar = S[chassisId].right.includes(id) ? 'braço direito' : S[chassisId].left.includes(id) ? 'braço esquerdo' : 'ombros';
    return { chassis, slot: `${chassis.toLowerCase()} · ${lugar}` };
  };
  return {
    target: v.name,
    torso,
    tests: game.tests,
    weapons: ids.filter(onVector).map((id) => card(id, S.vector09.right.includes(id) ? 'braço direito' : 'braço esquerdo')),
    others: ids.filter((id) => !onVector(id)).map((id) => ({ ...card(id, carrier(id).slot), chassis: carrier(id).chassis })),
    combo: levels.map((t) => ({ label: W.TIERS[t].label, ttk: B.timeToKill([W.weapon('plasma', t), W.weapon('rockets', t)], v, torso) })),
    tier: W.TIERS,
    capacity: v.weaponCapacity,
    // Todas as montagens de plasma × foguetes: quais cabem na carga (validação do Hangar) e o tempo do combo.
    builds: levels.map((p) =>
      levels.map((r) => {
        const spec = { v: 1, chassis: 'vector09', right: { id: 'plasma', tier: p }, left: { id: 'rockets', tier: r } };
        const check = game.hangar.validateLoadout(spec);
        return { p, r, fits: check.ok, mass: check.mass, key: game.hangar.loadoutKey(spec), ttk: B.timeToKill([W.weapon('plasma', p), W.weapon('rockets', r)], v, torso) };
      }),
    ),
    // Jogar a pé: o andróide pilotado, com a montagem de fábrica dele (blaster + motosserra).
    pilot: game.pilot && {
      key: game.hangar.loadoutKey(game.hangar.factorySpec('android')),
      height: game.pilot.height,
      mechHeight: v.height,
      torso: game.pilot.maxModuleHealth.torso,
    },
  };
}

/** Tamanho do download do jogo (gzip, como o servidor entrega), a partir do build em `gameDir`. */
export function bundleSize(gameDir) {
  const assets = join(gameDir, 'assets');
  if (!existsSync(assets)) return null;
  let js = 0;
  let wasm = 0;
  for (const f of readdirSync(assets)) {
    const size = () => gzipSync(readFileSync(join(assets, f)), { level: 9 }).length;
    if (f.endsWith('.js') || f.endsWith('.css')) js += size();
    else if (f.endsWith('.wasm')) wasm += size();
  }
  return { js, wasm, total: js + wasm };
}

// ---------- história ----------

const agentOf = (branch) => /^(claude|gemini|codex|qwen)\//.exec(branch ?? '')?.[1] ?? null;
const brDate = (iso) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

/**
 * PRs mergeados. Do GitHub quando há acesso (`gh`, com GH_TOKEN no CI): título, branch, etiquetas de
 * frente e agente, linhas mexidas. Sem acesso, do git (título e data; agente só pelo nome do branch).
 */
/**
 * Lead time de cada PR, do git: do primeiro commit do branch até o merge na `main`. Os commits do PR são
 * os do segundo pai do merge, subindo até cair num commit da `main` (os branches saem da `main`). Um
 * processo git só. Devolve Map(número do PR → horas).
 */
export function leadTimes() {
  const byHash = new Map();
  for (const rec of git('log', '--format=%H%x1f%P%x1f%at%x1f%ct%x1f%s', 'HEAD').split('\n')) {
    const [h, parents = '', at, ct, subject = ''] = rec.split('\x1f');
    if (h) byHash.set(h, { parents: parents.split(' ').filter(Boolean), at: Number(at) * 1000, ct: Number(ct) * 1000, subject });
  }
  const main = new Set();
  for (let h = git('rev-parse', 'HEAD'); h && byHash.has(h); h = byHash.get(h).parents[0]) main.add(h);
  const leads = new Map();
  for (const h of main) {
    const c = byHash.get(h);
    const pr = /(?:PR|pull request) #(\d+)/.exec(c.subject)?.[1];
    if (!pr || c.parents.length < 2) continue;
    let first = Infinity;
    for (let b = c.parents[1]; b && byHash.has(b) && !main.has(b); b = byHash.get(b).parents[0]) first = Math.min(first, byHash.get(b).at);
    if (Number.isFinite(first)) leads.set(Number(pr), (c.ct - first) / 3_600_000);
  }
  return leads;
}

export function entregas() {
  const leads = leadTimes();
  try {
    const out = execFileSync(
      'gh',
      ['pr', 'list', '--state', 'merged', '--limit', '500', '--json', 'number,title,headRefName,labels,createdAt,mergedAt,additions,deletions'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30_000, maxBuffer: 64 << 20 },
    );
    const prs = JSON.parse(out).map((p) => {
      const labels = p.labels.map((l) => l.name);
      const agents = labels.filter((l) => l.startsWith('agente:')).map((l) => l.slice(7));
      return {
        n: p.number,
        title: p.title.replace(/decepticons/ig, '[PROJETO]'),
        date: brDate(p.mergedAt),
        agents: agents.length ? agents : [agentOf(p.headRefName)].filter(Boolean),
        fronts: labels.filter((l) => l.startsWith('frente:')).map((l) => l.slice(7)),
        add: p.additions,
        del: p.deletions,
        // Lead time (DORA): do primeiro commit da mudança até o merge (do git); sem ele, do PR aberto.
        leadH: leads.get(p.number) ?? (Date.parse(p.mergedAt) - Date.parse(p.createdAt)) / 3_600_000,
        mergedAt: p.mergedAt,
      };
    });
    return { prs: prs.sort((a, b) => b.n - a.n), fromGithub: true };
  } catch {
    const log = git('log', '--merges', '--first-parent', '--format=%cs%x1f%s%x1f%b%x1e');
    const prs = [];
    for (const rec of log.split('\x1e')) {
      const [date, subject = '', body = ''] = rec.trim().split('\x1f');
      const ours = /PR #(\d+):\s*(.+)$/.exec(subject);
      const gh = /pull request #(\d+) from [^/]+\/(\S+)/.exec(subject);
      if (ours) prs.push({ n: Number(ours[1]), title: ours[2].replace(/decepticons/ig, '[PROJETO]'), date, agents: [], fronts: [] });
      else if (gh) prs.push({ n: Number(gh[1]), title: (body.split('\n')[0] || gh[2]).replace(/decepticons/ig, '[PROJETO]'), date, agents: [agentOf(gh[2])].filter(Boolean), fronts: [] });
    }
    return { prs, fromGithub: false };
  }
}

const BRT = 'America/Sao_Paulo';
const AGENTS = ['claude', 'gemini', 'codex', 'qwen'];

/**
 * Atividade da equipe, commit a commit, lida do git (uma chamada só). Cada commit é atribuído a quem
 * o fez: coautoria do Claude no próprio commit; senão, o agente do PR em que ele entrou (etiquetas
 * do GitHub ou prefixo do branch); sem PR, "equipe". Merges da main aparecem como entregas.
 * Também devolve o mapa de calor (commits por dia e hora, no horário de Brasília).
 */
export function atividade(prs) {
  const raw = git('log', '--format=%H%x1f%P%x1f%ct%x1f%s%x1f%(trailers:key=Co-Authored-By,valueonly,separator=;)%x1e', 'HEAD');
  const list = raw
    .split('\x1e')
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => {
      const [sha, parents, ct, subject, co] = r.split('\x1f');
      return { sha, parents: parents ? parents.split(' ') : [], t: Number(ct) * 1000, subject: subject.replace(/decepticons/ig, '[PROJETO]'), co: co ?? '' };
    });
  const bySha = new Map(list.map((c) => [c.sha, c]));
  const prAgents = new Map(prs.map((p) => [p.n, p.agents]));
  const reachable = (from) => {
    const seen = new Set();
    const stack = [from];
    while (stack.length) {
      const s = stack.pop();
      if (!s || seen.has(s)) continue;
      seen.add(s);
      stack.push(...(bySha.get(s)?.parents ?? []));
    }
    return seen;
  };
  // Cada merge da main (primeiro pai) diz de que PR vieram os commits que ele trouxe.
  const prOf = new Map();
  const deliveries = new Set();
  for (let cur = list[0]; cur; cur = bySha.get(cur.parents[0])) {
    const n = Number(/(?:PR|pull request) #(\d+)/.exec(cur.subject)?.[1]);
    if (!n || cur.parents.length < 2) continue;
    const base = reachable(cur.parents[0]);
    const stack = [cur.parents[1]];
    while (stack.length) {
      const s = stack.pop();
      if (!s || base.has(s) || prOf.has(s)) continue;
      prOf.set(s, n);
      stack.push(...(bySha.get(s)?.parents ?? []));
    }
    prOf.set(cur.sha, n);
    deliveries.add(cur.sha);
  }
  // Entrega = merge de um PR na linha principal; merge de integração (trabalho) conta como commit.
  const commits = list.map((c) => {
    const merge = deliveries.has(c.sha);
    const pr = prOf.get(c.sha) ?? null;
    const team = pr ? (prAgents.get(pr) ?? []) : [];
    let agent;
    if (/claude/i.test(c.co)) agent = 'claude';
    else if (merge) agent = team[0] ?? 'equipe';
    else agent = team.find((a) => a !== 'claude') ?? team[0] ?? 'equipe';
    return { sha: c.sha.slice(0, 7), t: c.t, subject: c.subject, agent, pr, merge };
  });

  const byAgent = Object.fromEntries([...AGENTS, 'equipe'].map((a) => [a, 0]));
  const dayOf = (t) => new Date(t).toLocaleDateString('sv-SE', { timeZone: BRT });
  const hourOf = (t) => Number(new Date(t).toLocaleString('en-US', { timeZone: BRT, hour: 'numeric', hourCycle: 'h23' }));
  const heat = new Map();
  for (const c of commits) {
    if (c.merge) continue;
    byAgent[c.agent] = (byAgent[c.agent] ?? 0) + 1;
    const d = dayOf(c.t);
    if (!heat.has(d)) heat.set(d, Array(24).fill(0));
    heat.get(d)[hourOf(c.t)]++;
  }
  const days = [...heat.keys()].sort();
  return {
    commits,
    total: commits.filter((c) => !c.merge).length,
    merges: commits.filter((c) => c.merge).length,
    byAgent,
    heat: { days, grid: days.map((d) => heat.get(d)), max: Math.max(1, ...[...heat.values()].flat()) },
    last: commits[0]?.t ?? null,
  };
}

/** Pedidos do dono atendidos: entradas do cofre que nasceram de um pedido ou relato dele. */
export function pedidos() {
  const entries = historicoCompleto().split(/^## \[/m).slice(1);
  return entries.filter((e) => /pedido do dono|sintoma \(dono|\(pedido do dono|pedido do dono/i.test(e)).length;
}

/**
 * Fichas de design (pasta `fichas/` dos documentos): o fluxo de status e a lista de fichas, lidos do README
 * delas. Sem a pasta, listas vazias (a seção some).
 */
export function fichas() {
  let md;
  try {
    md = read('.decepticons/fichas/README.md');
  } catch {
    return { flow: [], sheets: [] };
  }
  const section = (title) => new RegExp(`^## ${title}[^\\n]*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm').exec(md)?.[1] ?? '';
  return {
    flow: tableRows(section('Como uma ficha anda')).map(([status, who, what]) => ({ status: status.replace(/`/g, ''), who, what })),
    sheets: tableRows(section('Fichas a fazer')).map(([file, type, ref, state]) => ({ file, type, ref, done: /✅/.test(state), state: state.replace('✅', '').replace(/^a fazer\s*/i, '').replace(/^\((.*)\)$/, '$1').trim() })),
  };
}

/** Entradas do cofre de decisões (título e data), da mais nova para a mais antiga. */
export function diario() {
  // Assuntos internos de conta e acesso ficam fora da página pública.
  const INTERNO = /conta do github|mesma conta github/i;
  return [...historicoCompleto().matchAll(/^## \[(\d{4}-\d{2}-\d{2})\]\s+(.+)$/gm)]
    .map((m) => ({ date: m[1], title: m[2].trim() }))
    .filter((e) => !INTERNO.test(e.title));
}

/**
 * Evolução do projeto, uma medida por commit da `main` (cada merge é uma entrega): testes automáticos
 * e linhas de TypeScript do jogo. Lido do git com `git grep` em cada commit, sem checkout.
 * Precisa do histórico inteiro (no CI: checkout com fetch-depth 0).
 */
export function evolucao() {
  const commits = git('log', '--first-parent', '--reverse', '--format=%H%x09%cs%x09%s', 'HEAD')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [sha, date, subject] = line.split('\t');
      const pr = /(?:PR|pull request) #(\d+)/.exec(subject)?.[1];
      return { sha, date, pr: pr ? Number(pr) : null };
    });
  const shas = commits.map((c) => c.sha);
  // Um `git grep` só para todos os commits (saída "sha:arquivo:contagem"): um processo por commit
  // levava segundos no Windows.
  const perCommit = (out) => {
    const totals = new Map();
    for (const l of out.split('\n')) {
      const sha = l.slice(0, 40);
      totals.set(sha, (totals.get(sha) ?? 0) + (Number(l.slice(l.lastIndexOf(':') + 1)) || 0));
    }
    return totals;
  };
  const tests = perCommit(git('grep', '-c', '-E', '^[[:space:]]*(it|test)(\\.each\\(.*\\))?\\(', ...shas, '--', '*.test.ts'));
  const loc = perCommit(git('grep', '-c', '', ...shas, '--', 'client/src/*.ts', 'shared/*.ts', 'server/*.ts', ':!*.test.ts'));
  return commits.map(({ sha, date, pr }) => ({ date, pr, tests: tests.get(sha) ?? 0, loc: loc.get(sha) ?? 0 }));
}

/**
 * Histórico do ROADMAP: uma leitura por commit que mexeu nele, mais a de agora. Cada leitura conta os
 * itens do escopo (fases, sem as ideias), os feitos e o progresso de cada fase (pelo título, que é o que
 * sobrevive às renumerações). Base do burn-up, da linha do tempo das fases e do ritmo. Um processo git
 * para todas as versões (`cat-file --batch`): um por commit levava segundos no Windows.
 */
let unidadesEmCache = null;

/** Cada arma e cada chassi do código com a data (`AAAA-MM-DD`) do merge que o trouxe para a `main`. Cara (uma busca no git por unidade): guardada para o resto da execução. */
function unidadesDoJogo() {
  if (unidadesEmCache) return unidadesEmCache;
  /** Os pares [id, linha] que `re` acha no arquivo (ou só no bloco que começa em `bloco` e vai até o fim da chave). */
  const ids = (arquivo, re, bloco) => {
    let txt = read(arquivo);
    if (bloco) {
      const i = txt.indexOf(bloco);
      if (i < 0) return [];
      const fim = txt.indexOf('\n}', i);
      txt = txt.slice(i, fim < 0 ? undefined : fim);
    }
    return [...txt.matchAll(re)].map((m) => [m[1], m[0].trim()]);
  };
  const dataDoId = (arquivo, trecho) => git('log', '--first-parent', '--reverse', '--format=%cs', '-S', trecho, '--', arquivo).split('\n')[0] || null;
  const unidades = [];
  for (const [id] of ids('client/src/combat/weapons.ts', /^\s+id: '([a-z0-9]+)',/gm)) {
    const data = dataDoId('client/src/combat/weapons.ts', `id: '${id}'`);
    if (data) unidades.push({ id, tipo: 'arma', data });
  }
  for (const [id, linha] of ids('client/src/entities/chassis.ts', /^  ([a-z0-9]+): [A-Z][A-Z0-9_]*,/gm, 'export const CHASSIS')) {
    const data = dataDoId('client/src/entities/chassis.ts', linha.replace(/,$/, ''));
    if (data) unidades.push({ id, tipo: 'chassi', data });
  }
  unidadesEmCache = unidades;
  return unidades;
}

/**
 * O ritmo de conteúdo (P175; `LICOES_WAR_ROBOTS.md` § 2.1: "contar conteúdo como se conta código"): cada **arma** e cada **chassi** do jogo conta uma unidade, na **semana** (a segunda-feira dela)
 * em que o merge que o criou entrou na `main`. Os ids saem do código (nada copiado) e a data, do histórico do git (`--first-parent -S`: a primeira entrega na `main` que traz o id). Sem git (ou
 * sem histórico), devolve vazio. `media4` = unidades por semana nas últimas quatro semanas completas (a conta que o Comandante confere com a meta de 2 por semana, ainda por decidir).
 */
export function conteudoPorSemana(hoje = new Date()) {
  const unidades = unidadesDoJogo();
  if (!unidades.length) return { unidades, semanas: [], total: 0, media4: 0 };
  const segunda = (iso) => {
    const d = new Date(`${iso}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  };
  const porSemana = new Map();
  for (const u of unidades) {
    const s = segunda(u.data);
    if (!porSemana.has(s)) porSemana.set(s, []);
    porSemana.get(s).push(u.id);
  }
  const primeira = [...porSemana.keys()].sort()[0];
  const atual = segunda(hoje.toISOString().slice(0, 10));
  const semanas = [];
  for (let d = new Date(`${primeira}T12:00:00Z`); d.toISOString().slice(0, 10) <= atual; d.setUTCDate(d.getUTCDate() + 7)) {
    const s = d.toISOString().slice(0, 10);
    semanas.push({ segunda: s, n: (porSemana.get(s) ?? []).length, ids: porSemana.get(s) ?? [] });
  }
  const completas = semanas.filter((w) => w.segunda < atual).slice(-4);
  const media4 = completas.length ? completas.reduce((a, w) => a + w.n, 0) / completas.length : 0;
  return { unidades, semanas, total: unidades.length, media4 };
}

export function historicoRoadmap() {
  const path = '.decepticons/ROADMAP.md';
  const log = git('log', '--reverse', '--format=%H%x1f%cI', '--', path).split('\n').filter(Boolean);
  const snaps = [];
  const count = (md, t) => {
    const phases = parseRoadmap(md).phases.filter((p) => !p.ideas);
    const items = phases.flatMap((p) => p.items);
    snaps.push({
      t,
      total: items.length,
      done: items.filter((i) => i.status === 'done').length,
      phases: phases.map((p) => ({ title: p.title, total: p.items.length, done: p.items.filter((i) => i.status === 'done').length, active: p.items.some((i) => i.status !== 'todo') })),
    });
  };
  if (log.length) {
    try {
      const input = log.map((l) => `${l.split('\x1f')[0]}:${path}`).join('\n') + '\n';
      const buf = execFileSync('git', ['cat-file', '--batch'], { input, maxBuffer: 64 << 20, stdio: ['pipe', 'pipe', 'ignore'] });
      let at = 0;
      for (const l of log) {
        const nl = buf.indexOf(10, at);
        const header = buf.subarray(at, nl).toString();
        const size = Number(header.split(' ')[2]);
        at = nl + 1;
        if (Number.isFinite(size)) {
          count(buf.subarray(at, at + size).toString('utf8'), new Date(l.split('\x1f')[1]).getTime());
          at += size + 1;
        }
      }
    } catch {
      // Sem git (ou histórico raso): só a leitura de agora.
    }
  }
  count(read(path), Date.now());
  return snaps;
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null;
};

/**
 * Entrega contínua: as quatro métricas do DORA, lidas do GitHub. Cada execução do CI na `main` (um
 * push = um merge) é um deploy: se passou, o site foi atualizado; se falhou, é uma mudança que falhou.
 * `prs` traz o lead time de cada mudança (do primeiro commit ao merge). Sem acesso ao GitHub: null.
 */
export function pipeline(prs) {
  try {
    const out = execFileSync('gh', ['run', 'list', '--workflow', 'ci.yml', '--branch', 'main', '--limit', '300', '--json', 'conclusion,createdAt,updatedAt,event'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 30_000,
    });
    const runs = JSON.parse(out)
      .filter((r) => r.event === 'push' && (r.conclusion === 'success' || r.conclusion === 'failure'))
      .map((r) => ({ t0: Date.parse(r.createdAt), t1: Date.parse(r.updatedAt), ok: r.conclusion === 'success' }))
      .sort((a, b) => a.t0 - b.t0);
    if (!runs.length) return null;
    const good = runs.filter((r) => r.ok);
    const deployMin = median(good.map((r) => (r.t1 - r.t0) / 60_000)) ?? 0;
    // Recuperação: da primeira falha de uma sequência até o próximo deploy que passou.
    const recover = [];
    runs.forEach((r, i) => {
      if (r.ok || (i > 0 && !runs[i - 1].ok)) return;
      const next = runs.slice(i + 1).find((x) => x.ok);
      if (next) recover.push((next.t1 - r.t1) / 3_600_000);
    });
    const days = Math.max(1, (runs.at(-1).t1 - runs[0].t0) / 86_400_000);
    const leads = prs.map((p) => p.leadH).filter((h) => Number.isFinite(h) && h >= 0);
    return {
      deploys: good.length,
      perDay: good.length / days,
      leadH: (median(leads) ?? 0) + deployMin / 60,
      failRate: (runs.length - good.length) / runs.length,
      failures: runs.length - good.length,
      runs: runs.length,
      mttrH: median(recover),
      deployMin,
    };
  } catch {
    return null;
  }
}

// ---------- arquitetura (o grafo dos módulos) ----------

/**
 * O mapa da arquitetura do CYBERMECH, lido dos próprios arquivos: um nó por módulo (a pasta de primeiro
 * nível) e uma aresta para cada import entre módulos. Muda sozinho quando o código muda; nada digitado à
 * mão (R14). Conta também os testes que cobrem cada módulo. Fica de fora o CSS. Alimenta o grafo da oficina.
 */
export function arquitetura() {
  const ROOTS = ['client/src', 'shared', 'server', 'scripts'];
  const norm = (p) => p.replace(/\\/g, '/');
  const moduleOf = (path, base) => {
    if (base !== 'client/src') return base.replace(/\/.*$/, '');
    const rel = path.slice(base.length + 1);
    const slash = rel.indexOf('/');
    return slash === -1 ? 'raiz' : rel.slice(0, slash);
  };
  const files = [];
  const tests = new Map(); // módulo → nº de testes (`it`) que o cobrem
  const walk = (dir, base) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = norm(join(dir, e.name));
      if (e.isDirectory()) walk(p, base);
      else if (e.name.endsWith('.test.ts')) {
        const m = moduleOf(p, base);
        tests.set(m, (tests.get(m) ?? 0) + (read(p).match(/^\s+it\(/gm) ?? []).length);
      } else if (e.name.endsWith('.ts')) files.push({ path: p, module: moduleOf(p, base) });
    }
  };
  for (const r of ROOTS) if (existsSync(r)) walk(r, r);
  const byPath = new Map(files.map((f) => [f.path, f]));

  const nodes = new Map();
  const node = (id) => {
    if (!nodes.has(id)) nodes.set(id, { id, files: 0, loc: 0, imports: new Set(), importedBy: new Set() });
    return nodes.get(id);
  };
  const weight = new Map();
  for (const f of files) {
    const src = read(f.path);
    const me = node(f.module);
    me.files++;
    me.loc += src.split('\n').length;
    const specs = [
      ...src.matchAll(/\bfrom\s+['"](\.[^'"]+)['"]/g),
      ...src.matchAll(/\bimport\s+['"](\.[^'"]+)['"]/g),
    ].map((m) => m[1]);
    for (const spec of specs) {
      const p = norm(join(dirname(f.path), spec));
      const hit = [`${p}.ts`, `${p}.tsx`, `${p}/index.ts`].map((c) => byPath.get(c)).find(Boolean);
      if (!hit || hit.module === f.module) continue;
      me.imports.add(hit.module);
      node(hit.module).importedBy.add(f.module);
      const key = `${f.module}|${hit.module}`;
      weight.set(key, (weight.get(key) ?? 0) + 1);
    }
  }
  return {
    nodes: [...nodes.values()].map((n) => ({ ...n, tests: tests.get(n.id) ?? 0, imports: [...n.imports].sort(), importedBy: [...n.importedBy].sort() })),
    links: [...weight].map(([key, w]) => {
      const [source, target] = key.split('|');
      return { source, target, weight: w };
    }),
    files: files.length,
  };
}

/** A frente do ROADMAP de cada módulo (o vocabulário do `ROADMAP.md`): agrupa e dá a cor do grafo. */
export const MOD_FRENTE = {
  physics: 'jogabilidade', player: 'jogabilidade', camera: 'jogabilidade',
  combat: 'combate',
  entities: 'mechs', hangar: 'mechs',
  environment: 'cenarios',
  ui: 'ux', tuning: 'ux',
  audio: 'som',
  net: 'rede', shared: 'rede', server: 'rede',
  fx: 'desempenho', debug: 'desempenho',
  core: 'base', sim: 'base', raiz: 'base', scripts: 'base',
  brand: 'negocio',
};

/**
 * Quem cuida de cada módulo: os agentes dos PRs da frente dele (Claude, Gemini, Codex, Qwen), do que mais
 * entregou para o que menos. Sai das etiquetas dos PRs (`entregas()`), nada digitado à mão.
 */
export function porModulo(prs) {
  const out = {};
  for (const [mod, frente] of Object.entries(MOD_FRENTE)) {
    const per = new Map();
    for (const p of prs) if (p.fronts.includes(frente)) for (const ag of p.agents) per.set(ag, (per.get(ag) ?? 0) + 1);
    out[mod] = [...per.entries()].sort((a, b) => b[1] - a[1]).map(([ag]) => ag);
  }
  return out;
}

/**
 * A saúde técnica do repositório, medida dele mesmo: quantos testes travam as regras, em quantos módulos,
 * onde falta teste próprio, quantas conversões forçadas o tipo não garante e o que resta do orçamento de
 * banda (das constantes de `shared/net/`, a mesma conta que os testes travam). Nada digitado à mão.
 */
export function saudeTecnica(arq, game) {
  const semTeste = arq.nodes
    .filter((n) => n.tests === 0)
    .sort((a, b) => b.loc - a.loc)
    .map((n) => ({ id: n.id, frente: MOD_FRENTE[n.id] ?? 'base', files: n.files, loc: n.loc }));

  let forcados = 0;
  let arquivosTs = 0;
  const conta = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) conta(p);
      else if (e.name.endsWith('.ts')) {
        arquivosTs++;
        forcados += (read(p).match(/as unknown as/g) ?? []).length;
      }
    }
  };
  for (const r of ['client/src', 'shared', 'server']) if (existsSync(r)) conta(r);

  return {
    testes: arq.nodes.reduce((s, n) => s + n.tests, 0),
    modulos: arq.nodes.length,
    arquivos: arq.files,
    linhas: arq.nodes.reduce((s, n) => s + n.loc, 0),
    comTeste: arq.nodes.length - semTeste.length,
    semTeste,
    forcados,
    arquivosTs,
    net: game?.net ?? null,
    benchTests: game?.benchTests ?? null,
  };
}

/** Versão (última tag), commit atual e dia do projeto. */
export function marcos() {
  const first = git('log', '--reverse', '--format=%cs').split('\n')[0] || null;
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const day = first ? Math.round((Date.parse(today) - Date.parse(first)) / 86_400_000) + 1 : null;
  return {
    version: git('describe', '--tags', '--abbrev=0') || null,
    head: git('log', '-1', '--format=%h'),
    headDate: git('log', '-1', '--format=%cs'),
    first,
    day,
    generated: new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }),
  };
}
