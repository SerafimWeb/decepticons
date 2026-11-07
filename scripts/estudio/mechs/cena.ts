/**
 * A prévia da aba MECHS 3D do Estúdio (P321, `ESTUDIO.md` § 3.3, primeiro corte: o movimento). Roda o MESMO código do jogo (`Vector09` →
 * `MechBase.render`, `geracao3.ts`) com a geração 2 ao lado da geração 3, para o Comandante julgar ao olho e ajustar os números de gosto
 * (`movimentoGen3.json`). Montada pelo `modulo-mechs.mjs` (Vite) e servida em `/api/mechs/app/`. Todo texto entra na tela por `textContent`.
 *
 * Os números da ficha e do "ao vivo" saem das mesmas funções que mexem as peças (`parametrosDaPassada`, `MechBase`): nenhum é digitado.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ajustesGen3, definirAjustesGen3, FAIXAS, PADRAO_GEN3, type AjustesDoMovimento } from '../../../client/src/entities/ajustesGen3';
import { PALETTE } from '../../../client/src/core/palette';
import { Android } from '../../../client/src/entities/Android';
import { BLUEPRINT_BY_CHASSIS } from '../../../client/src/entities/blueprintByChassis';
import { CHASSIS, CHASSIS_SIZE, type ChassisId } from '../../../client/src/entities/chassis';
import { IMPORTED_CHASSIS, tryInstantiateMechRig, whenMechAssetReady } from '../../../client/src/entities/importedMechAssets';
import { ImportedMech } from '../../../client/src/entities/ImportedMech';
import { MECH_GRAVITY, type MechBase, type MechRig } from '../../../client/src/entities/MechBase';
import { carregarGeracao3, setMovimentoGen3 } from '../../../client/src/entities/movimentoGen3';
import { parametrosDaPassada, taxaDaFase } from '../../../client/src/entities/passadaGen3';
import { medirGeometriaDaPerna } from '../../../client/src/entities/passadaRig';
import { comandoDoModo, DT, integrar, novoEstado, type Estado, type ModoDeMovimento } from '../../../client/src/entities/roteiroDeMovimento';
import { Vector09 } from '../../../client/src/entities/Vector09';

declare global {
  interface Window {
    /** A prova no Chrome (`medicoes/estudio-mechs.mjs`) espera por isto. */
    pronto?: boolean;
    mechsProva?: () => unknown;
  }
}

/** De onde vem o corpo de cada chassi: código (os blueprints), o andróide (código à parte) ou malha importada (`.glb`, geração 2 só). */
type Origem = 'codigo' | 'androide' | 'malha';
const origemDe = (id: ChassisId): Origem => (id === 'android' ? 'androide' : IMPORTED_CHASSIS[id] ? 'malha' : 'codigo');
const ORIGEM_ORDEM: Readonly<Record<Origem, number>> = { codigo: 0, androide: 1, malha: 2 };
const ORIGEM_ROTULO: Readonly<Record<Origem, string>> = { codigo: 'código', androide: 'andróide, código', malha: 'malha importada' };
/** TODOS os robôs do jogo, sem lista digitada: chassi novo em `CHASSIS` aparece aqui sozinho (os de código primeiro, depois o andróide e os de malha). */
const TODOS: readonly ChassisId[] = (Object.keys(CHASSIS) as ChassisId[]).sort(
  (a, b) => ORIGEM_ORDEM[origemDe(a)] - ORIGEM_ORDEM[origemDe(b)] || CHASSIS_SIZE[a] - CHASSIS_SIZE[b] || CHASSIS[a].name.localeCompare(CHASSIS[b].name),
);
const RAD = 180 / Math.PI;
const TAU = Math.PI * 2;
/** Os ajustes que viram parte da passada ao criar o Mech: mexer neles refaz os Mechs (os outros valem ao vivo). */
const ASSADOS = new Set<keyof AjustesDoMovimento>(['ciclosMax', 'agachamento', 'molejoDoPasso', 'cadenciaLenta']);
const ROTULO_DO_AJUSTE: Readonly<Record<keyof AjustesDoMovimento, string>> = {
  ciclosMax: 'Teto da cadência (ciclos/s de cada perna)',
  agachamento: 'Agachamento na corrida (fração da perna)',
  molejoDoPasso: 'Molejo do passo na corrida (fração da perna)',
  cadenciaLenta: 'Cadência de marcha (fração do teto)',
  inclinacaoDoTronco: 'Inclinação do tronco (graus)',
  amortecimentoDoPouso: 'Tranco do pouso',
  rigidez: 'Rigidez das molas',
  amortecimento: 'Amortecimento das molas',
};

type Parte = 'tudo' | 'pelve' | 'tronco' | 'cabeca' | 'bracos' | 'pernas';
type Vista = 'lado' | 'g3' | 'g2';
interface Posicionado {
  position: THREE.Vector3;
}
interface Peca {
  readonly no: Posicionado;
  readonly base: THREE.Vector3;
  /** Afastamento lateral e vertical, em fração da altura (o lateral vai para o lado do próprio nó). */
  readonly dx: number;
  readonly dy: number;
}

const obj = (j: unknown): THREE.Object3D => j as THREE.Object3D;

/** O que cada botão de "Isolar" mostra (as malhas próprias do pivô: o tronco, por exemplo, não leva a cabeça e os braços junto). */
function grupos(r: MechRig): Record<Exclude<Parte, 'tudo'>, THREE.Object3D[]> {
  return {
    pelve: [r.pelvis],
    tronco: [obj(r.torso)],
    cabeca: [r.head],
    bracos: [obj(r.leftArm), obj(r.rightArm)],
    pernas: [obj(r.leftLeg.hip), obj(r.leftLeg.knee), obj(r.rightLeg.hip), obj(r.rightLeg.knee)],
  };
}

function descartar(raiz: THREE.Object3D): void {
  raiz.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.geometry.dispose();
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mat.dispose();
    }
  });
}

function criarCena(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x15191c);
  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  const luz = new THREE.DirectionalLight(0xffffff, 3);
  luz.position.set(6, 10, 8);
  scene.add(luz);
  const contra = new THREE.DirectionalLight(0x88aaff, 1.5);
  contra.position.set(-6, 6, -8);
  scene.add(contra);
  scene.add(new THREE.GridHelper(400, 400, 0x2f414c, 0x2f414c));
  const grade5 = new THREE.GridHelper(400, 80, 0x86aabd, 0x86aabd);
  grade5.position.y = 0.004;
  scene.add(grade5);
  return scene;
}

// ── O estado da prévia ─────────────────────────────────────────────────────────────────────────────────────────────
let chassi: ChassisId = 'vector09';
let modo: ModoDeMovimento = 'correr';
let vista: Vista = 'lado';
let parte: Parte = 'tudo';
let explosao = 0;
let quadroN = 0;
let tempo = 0;

class Lado {
  readonly scene = criarCena();
  readonly cam = new THREE.PerspectiveCamera(30, 1, 0.1, 1000);
  mech!: MechBase;
  rig!: MechRig;
  /** Pronto para andar e ser desenhado (a malha importada leva um tempo para carregar). */
  pronto = false;
  /** A geração 3 existe neste corpo: só o rig de código que informa o pé e o tornozelo; o andróide e a malha importada andam na geração 2. */
  temGen3 = false;
  /** O corpo é feito de peças que dá para isolar e afastar (a malha importada é uma peça só, presa a um esqueleto). */
  desmontavel = true;
  private versao = 0;
  sim: Estado = novoEstado();
  readonly passos: number[] = [];
  readonly pelve: number[] = [];
  readonly tronco: number[] = [];
  pecas: Peca[] = [];

  constructor(
    readonly gen3: boolean,
    readonly cor: string,
  ) {}

  /** (Re)cria o Mech do chassi atual. A passada da geração 3 nasce com os ajustes de agora (`criarEstado`, no primeiro quadro). */
  async montar(): Promise<void> {
    const versao = ++this.versao;
    const id = chassi;
    this.pronto = false;
    let mech: MechBase;
    try {
      mech = await criarMech(id);
    } catch (e) {
      dizer(`Não consegui montar ${CHASSIS[id].name}: ${String(e)}`, true);
      return;
    }
    // Cliques rápidos no seletor: só a última montagem vale.
    if (versao !== this.versao) {
      descartar(mech.root);
      return;
    }
    if (this.mech) {
      this.scene.remove(this.mech.root);
      descartar(this.mech.root);
    }
    this.mech = mech;
    this.rig = (this.mech as unknown as { rig: MechRig }).rig;
    this.temGen3 = medirGeometriaDaPerna(this.rig) !== null;
    this.desmontavel = origemDe(id) !== 'malha';
    this.mech.grounded = true;
    this.mech.onFootstep = () => {
      this.passos.push(tempo);
    };
    this.scene.add(this.mech.root);
    this.sim = novoEstado();
    this.passos.length = 0;
    this.pelve.length = 0;
    this.tronco.length = 0;
    const r = this.rig;
    const nos: [Posicionado, number, number][] = [
      [r.torso, 0, 0.14],
      [r.head, 0, 0.3],
      [r.leftArm, 0.24, 0.04],
      [r.rightArm, 0.24, 0.04],
      [r.leftLeg.hip, 0.16, -0.02],
      [r.rightLeg.hip, 0.16, -0.02],
      [r.leftLeg.knee, 0, -0.12],
      [r.rightLeg.knee, 0, -0.12],
    ];
    this.pecas = this.desmontavel ? nos.map(([no, dx, dy]) => ({ no, base: no.position.clone(), dx, dy })) : [];
    isolar(this);
    this.pronto = true;
  }
}

/** O corpo de um chassi: o blueprint de código, o andróide, ou a malha importada (espera o arquivo carregar; o jogo faz o mesmo no Hangar). */
async function criarMech(id: ChassisId): Promise<MechBase> {
  const st = CHASSIS[id];
  if (id === 'android') return new Android({ stats: st, paint: PALETTE.playerPaint, visor: PALETTE.green, tool: 'pilot' });
  const malha = IMPORTED_CHASSIS[id];
  if (malha) {
    await whenMechAssetReady(malha.url, st.height, malha);
    const rig = tryInstantiateMechRig(malha.url, st.height);
    if (!rig) throw new Error('a malha não carregou');
    return new ImportedMech(st, rig);
  }
  return new Vector09({ stats: st, blueprint: BLUEPRINT_BY_CHASSIS[id] });
}

const lados = [new Lado(false, '#ffd36b'), new Lado(true, '#6dff9a')];

function isolar(l: Lado): void {
  if (!l.desmontavel) return;
  for (const [nome, nos] of Object.entries(grupos(l.rig))) {
    for (const no of nos) for (const f of no.children) if ((f as THREE.Mesh).isMesh) f.visible = parte === 'tudo' || parte === nome;
  }
}

function explodir(l: Lado): void {
  const H = CHASSIS[chassi].height;
  for (const p of l.pecas) {
    // `animate` só escreve a altura da pelve e o recuo (z) dos braços: x e y dos outros nós são da prévia.
    p.no.position.x = p.base.x + Math.sign(p.base.x || 1) * p.dx * H * explosao;
    p.no.position.y = p.base.y + p.dy * H * explosao;
  }
}

// ── Um quadro de simulação (60 Hz fixos, o mesmo do jogo) ──────────────────────────────────────────────────────────
function passo(): void {
  const st = CHASSIS[chassi];
  const c = comandoDoModo(modo, quadroN, st.moveSpeed);
  for (const l of lados) {
    if (!l.pronto) continue;
    setMovimentoGen3(l.gen3); // a chave é global: cada lado a põe antes do próprio quadro
    integrar(l.sim, c, st, MECH_GRAVITY, quadroN);
    const s = l.sim;
    const m = l.mech;
    const privado = m as unknown as { dashTimeLeft: number; recoil: number; leftRecoil: number };
    m.velocity.set(s.vx, s.vy, s.vz);
    m.grounded = s.grounded;
    m.applyFacing(s.yaw, 0);
    privado.dashTimeLeft = Math.max(0, s.dash);
    if (c.tiro) {
      privado.recoil = 1;
      privado.leftRecoil = 1;
    }
    m.render(DT, 1);
    m.root.position.set(s.x, s.y, s.z);
    if (explosao > 0 || l.pecas[0]?.no.position.y !== l.pecas[0]?.base.y) explodir(l);
    l.pelve.push(l.rig.pelvis.position.y - l.rig.hipHeight);
    l.tronco.push(l.rig.torso.rotation.x * RAD);
    if (l.pelve.length > 180) {
      l.pelve.shift();
      l.tronco.shift();
    }
  }
  quadroN++;
  tempo += DT;
  // O chão da prévia é finito: volta ao começo quando o Mech anda longe (a câmera acompanha, ninguém vê o salto).
  if (lados[0] && Math.abs(lados[0].sim.z) > 140) for (const l of lados) l.sim.z = 0;
}

// ── A câmera: um OrbitControls numa câmera de controle, e cada lado a segue a partir do próprio Mech ──────────────────
const tela = document.getElementById('tela') as HTMLCanvasElement;
const palco = document.getElementById('palco') as HTMLElement;
const renderer = new THREE.WebGLRenderer({ canvas: tela, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x15191c);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.setScissorTest(true);
const ctrlCam = new THREE.PerspectiveCamera(30, 1, 0.1, 1000);
const controles = new OrbitControls(ctrlCam, tela);
controles.enableDamping = true;
controles.enablePan = false;

function predefinida(nome: 'lateral' | 'tres-quartos' | 'frente' | 'cima'): void {
  const H = CHASSIS[chassi].height;
  controles.target.set(0, H * 0.45, 0);
  controles.minDistance = H * 0.8;
  controles.maxDistance = H * 8;
  const d = H * 3.3;
  const p: Record<typeof nome, [number, number, number]> = {
    lateral: [d, H * 0.55, 0],
    'tres-quartos': [d * 0.72, H * 0.6, -d * 0.72],
    frente: [0, H * 0.55, -d],
    cima: [0.001, H * 3.4, 0.001],
  };
  ctrlCam.position.set(...p[nome]);
  controles.update();
}

function desenhar(): void {
  const w = palco.clientWidth;
  const h = palco.clientHeight;
  const mostrar = vista === 'lado' ? lados : vista === 'g3' ? [lados[1]] : [lados[0]];
  mostrar.forEach((l, k) => {
    if (!l?.pronto) return;
    const larg = w / mostrar.length;
    l.cam.aspect = larg / h;
    l.cam.updateProjectionMatrix();
    l.cam.position.set(l.sim.x + ctrlCam.position.x, ctrlCam.position.y, l.sim.z + ctrlCam.position.z);
    l.cam.lookAt(l.sim.x + controles.target.x, controles.target.y, l.sim.z + controles.target.z);
    renderer.setViewport(k * larg, 0, larg, h);
    renderer.setScissor(k * larg, 0, larg, h);
    renderer.render(l.scene, l.cam);
  });
  (document.getElementById('rotulo2') as HTMLElement).hidden = vista === 'g3';
  (document.getElementById('rotulo3') as HTMLElement).hidden = vista === 'g2';
}

new ResizeObserver(() => renderer.setSize(palco.clientWidth, palco.clientHeight, false)).observe(palco);

// ── O painel: nada de HTML montado de texto, só nós e `textContent` ────────────────────────────────────────────────
function el<K extends keyof HTMLElementTagNameMap>(tag: K, atributos: Record<string, string> = {}, ...filhos: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(atributos)) e.setAttribute(k, v);
  e.append(...filhos);
  return e;
}

function botoes<T extends string>(opcoes: readonly (readonly [string, T])[], atual: () => T, aoEscolher: (v: T) => void): HTMLElement & { marcar: () => void } {
  const linha = el('div', { class: 'linha' });
  const lista: [HTMLButtonElement, T][] = [];
  const marcar = (): void => lista.forEach(([b, v]) => b.classList.toggle('on', v === atual()));
  for (const [rotulo, valor] of opcoes) {
    const b = el('button', { type: 'button' }, rotulo);
    b.addEventListener('click', () => {
      aoEscolher(valor);
      marcar();
    });
    lista.push([b, valor]);
    linha.append(b);
  }
  marcar();
  return Object.assign(linha, { marcar });
}

const fichaTbody = el('tbody');
const vivoTbody = el('tbody');
const graficos = { pelve: el('canvas', { class: 'graf', width: '340', height: '66' }), tronco: el('canvas', { class: 'graf', width: '340', height: '66' }) };
const aviso = el('div', { id: 'aviso' });
const sliders = new Map<keyof AjustesDoMovimento, { entrada: HTMLInputElement; saida: HTMLOutputElement }>();

function linhaDeFicha(rotulo: string, valor: string): HTMLTableRowElement {
  return el('tr', {}, el('td', {}, rotulo), el('td', {}, valor));
}

/** A ficha: tudo lido do chassi e das funções da passada (`parametrosDaPassada` mede a perna do próprio rig). */
function atualizarFicha(): void {
  const st = CHASSIS[chassi];
  const gen3 = lados[1];
  const linhas: [string, string][] = [
    ['Chassi', st.name],
    ['Corpo', ORIGEM_ROTULO[origemDe(chassi)]],
    ['Altura', `${st.height.toFixed(1)} m`],
    ['Velocidade de corrida', `${st.moveSpeed.toFixed(1)} m/s`],
    ['Aceleração no chão', `${st.groundAccel} m/s²`],
  ];
  const geo = gen3 ? medirGeometriaDaPerna(gen3.rig) : null;
  if (geo) {
    const p = parametrosDaPassada(geo, (st.gait ?? { hip: 0.7 }).hip, ajustesGen3());
    const plantado = (st.moveSpeed * taxaDaFase(p)) / TAU;
    const comTeto = Math.min(plantado, p.ciclosMax);
    linhas.push(
      ['Perna (coxa + canela)', `${(geo.ue + geo.w).toFixed(2)} m`],
      ['Alcance do passo', `${p.alcance.toFixed(2)} m`],
      ['Agacha no topo da velocidade', `${p.agachamento.toFixed(2)} m`],
      ['Molejo do passo no topo', `${p.bob.toFixed(3)} m`],
      ['Passos/s com o pé 100% plantado', (2 * plantado).toFixed(1)],
      ['Passos/s com o teto', (2 * comTeto).toFixed(1)],
      ['Escorrega com o teto', `${(st.moveSpeed * Math.max(0, 1 - comTeto / plantado)).toFixed(1)} m/s`],
    );
  } else linhas.push(['Geração 3', 'indisponível neste chassi']);
  fichaTbody.replaceChildren(...linhas.map(([a, b]) => linhaDeFicha(a, b)));
}

function atualizarAoVivo(): void {
  const dados = lados.map((l) => {
    if (l.gen3 && !l.temGen3) return ['—', '—', '—', '—'];
    for (let p = l.passos[0]; p !== undefined && tempo - p > 2; p = l.passos[0]) l.passos.shift();
    return [
      Math.hypot(l.sim.vx, l.sim.vz).toFixed(1),
      (l.passos.length / 2).toFixed(1),
      (l.rig.pelvis.position.y - l.rig.hipHeight).toFixed(2),
      (l.rig.torso.rotation.x * RAD).toFixed(1),
    ];
  });
  const rotulos = ['Velocidade (m/s)', 'Passos por segundo', 'Pelve (m)', 'Tronco (graus)'];
  vivoTbody.replaceChildren(
    el('tr', {}, el('th', {}, ''), el('th', { class: 'g2' }, 'GER. 2'), el('th', { class: 'g3' }, 'GER. 3')),
    ...rotulos.map((r, i) => el('tr', {}, el('td', {}, r), el('td', { class: 'g2' }, dados[0]?.[i] ?? ''), el('td', { class: 'g3' }, dados[1]?.[i] ?? ''))),
  );
  tracar(graficos.pelve, 'pelve');
  tracar(graficos.tronco, 'tronco');
}

/** Duas linhas (geração 2 e 3) dos últimos 3 s; a escala é a dos dois juntos. */
function tracar(cv: HTMLCanvasElement, serie: 'pelve' | 'tronco'): void {
  const g = cv.getContext('2d');
  if (!g) return;
  const todos = lados.flatMap((l) => l[serie]);
  const min = Math.min(...todos, -0.001);
  const max = Math.max(...todos, 0.001);
  g.clearRect(0, 0, cv.width, cv.height);
  g.strokeStyle = '#2b343c';
  const zero = cv.height - ((0 - min) / (max - min)) * (cv.height - 8) - 4;
  g.beginPath();
  g.moveTo(0, zero);
  g.lineTo(cv.width, zero);
  g.stroke();
  for (const l of lados) {
    g.strokeStyle = l.cor;
    g.beginPath();
    l[serie].forEach((v, i) => {
      const x = (i / 179) * cv.width;
      const y = cv.height - ((v - min) / (max - min)) * (cv.height - 8) - 4;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    });
    g.stroke();
  }
}

/** Monta o Mech do chassi atual nos dois lados e ajusta o painel ao que o corpo permite (sem geração 3, só a 2; malha importada não desmonta). */
async function montarTodos(): Promise<void> {
  await Promise.all(lados.map((l) => l.montar()));
  aposMontar();
}

let vistaBotoes: (HTMLElement & { marcar: () => void }) | undefined;
let blocoDesmontar: HTMLElement | undefined;
let avisoDesmontar: HTMLElement | undefined;
function aposMontar(): void {
  const g3 = lados[1]?.temGen3 ?? false;
  const desmontavel = lados[0]?.desmontavel ?? true;
  if (!g3 && vista !== 'g2') vista = 'g2';
  if (!desmontavel) parte = 'tudo';
  const botoesDaVista = vistaBotoes?.querySelectorAll('button');
  if (botoesDaVista) {
    // LADO A LADO e SÓ GER. 3 só valem onde a geração 3 existe.
    for (const i of [0, 1]) {
      const b = botoesDaVista[i];
      if (b) b.disabled = !g3;
    }
  }
  vistaBotoes?.marcar();
  if (blocoDesmontar) blocoDesmontar.hidden = !desmontavel;
  if (avisoDesmontar) avisoDesmontar.hidden = desmontavel;
}

let refazer = 0;
function agendarRefazer(): void {
  window.clearTimeout(refazer);
  refazer = window.setTimeout(() => {
    void montarTodos().then(atualizarFicha);
  }, 150);
}

function mostrarAjustes(): void {
  const a = ajustesGen3();
  for (const [k, s] of sliders) {
    s.entrada.value = String(a[k]);
    s.saida.textContent = a[k].toFixed(3);
  }
}

function dizer(texto: string, erro = false): void {
  aviso.textContent = texto;
  aviso.classList.toggle('erro', erro);
}

async function salvar(): Promise<void> {
  try {
    const r = await fetch('/api/mechs/ajustes', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ajustes: ajustesGen3() }) });
    const j = (await r.json()) as { erro?: string };
    if (r.ok) dizer('Salvo em client/src/entities/movimentoGen3.json. Falta commitar: aparece nas PENDÊNCIAS do Estúdio.');
    else dizer(`Não salvou: ${j.erro ?? r.status}`, true);
  } catch (e) {
    dizer(`Não salvou: ${String(e)}`, true);
  }
}

async function desfazer(): Promise<void> {
  try {
    const j = (await (await fetch('/api/estado')).json()) as { mechs?: { ajustes?: Partial<AjustesDoMovimento> } };
    if (j.mechs?.ajustes) definirAjustesGen3(j.mechs.ajustes);
    mostrarAjustes();
    agendarRefazer();
    dizer('Voltou ao que está salvo no arquivo.');
  } catch (e) {
    dizer(`Não consegui ler o arquivo: ${String(e)}`, true);
  }
}

function montarPainel(): void {
  const painel = document.getElementById('painel') as HTMLElement;
  const seletor = el('select', {});
  for (const id of TODOS) seletor.append(el('option', { value: id }, `${CHASSIS[id].name} · ${ORIGEM_ROTULO[origemDe(id)]}`));
  seletor.addEventListener('change', () => {
    chassi = seletor.value as ChassisId;
    dizer(origemDe(chassi) === 'malha' ? `Carregando a malha de ${CHASSIS[chassi].name}…` : '');
    void montarTodos().then(() => {
      if (origemDe(chassi) === 'malha') dizer('');
      predefinida('lateral');
      atualizarFicha();
    });
  });

  const ajustes = el('div');
  for (const k of Object.keys(FAIXAS) as (keyof AjustesDoMovimento)[]) {
    const [min, max] = FAIXAS[k];
    const entrada = el('input', { type: 'range', min: String(min), max: String(max), step: String((max - min) / 200) });
    const saida = el('output', {});
    sliders.set(k, { entrada, saida });
    entrada.addEventListener('input', () => {
      definirAjustesGen3({ [k]: Number(entrada.value) });
      mostrarAjustes();
      if (ASSADOS.has(k)) agendarRefazer();
    });
    ajustes.append(el('div', { class: 'ajuste' }, el('label', {}, ROTULO_DO_AJUSTE[k], saida), entrada));
  }
  const bSalvar = el('button', { type: 'button', class: 'forte' }, 'SALVAR');
  bSalvar.addEventListener('click', () => void salvar());
  const bPadrao = el('button', { type: 'button' }, 'PADRÃO DE PROJETO');
  bPadrao.addEventListener('click', () => {
    definirAjustesGen3(PADRAO_GEN3);
    mostrarAjustes();
    agendarRefazer();
    dizer('Padrão de projeto na tela (ainda não salvo).');
  });
  const bDesfazer = el('button', { type: 'button' }, 'DESFAZER');
  bDesfazer.addEventListener('click', () => void desfazer());

  const explode = el('input', { type: 'range', min: '0', max: '1', step: '0.01', value: '0' });
  explode.addEventListener('input', () => {
    explosao = Number(explode.value);
    if (explosao === 0) for (const l of lados) explodir(l);
  });

  vistaBotoes = botoes([['LADO A LADO', 'lado'], ['SÓ GER. 3', 'g3'], ['SÓ GER. 2', 'g2']] as const, () => vista, (v) => (vista = v));
  blocoDesmontar = el(
    'div',
    {},
    botoes([['TUDO', 'tudo'], ['PELVE', 'pelve'], ['TRONCO', 'tronco'], ['CABEÇA', 'cabeca'], ['BRAÇOS', 'bracos'], ['PERNAS', 'pernas']] as const, () => parte, (v) => {
      parte = v;
      for (const l of lados) isolar(l);
    }),
    el('div', { class: 'ajuste' }, el('label', {}, 'Explodir'), explode),
  );
  avisoDesmontar = el('p', { class: 'dica' }, 'Desmontar só vale nos robôs de código: a malha importada é uma peça só, presa a um esqueleto.');
  avisoDesmontar.hidden = true;
  painel.append(
    el('h3', {}, 'Chassi'),
    seletor,
    el('h3', {}, 'Movimento'),
    botoes([['PARADO', 'parado'], ['ANDAR', 'andar'], ['CORRER', 'correr'], ['ROTEIRO', 'roteiro']] as const, () => modo, (v) => {
      modo = v;
      quadroN = 0;
      for (const l of lados) l.sim = novoEstado();
    }),
    el('p', { class: 'dica' }, 'ROTEIRO: parado, corre, freia, pula, pousa, anda virando, dash, tiro (9,4 s em laço).'),
    el('h3', {}, 'Vista'),
    vistaBotoes,
    el('div', { class: 'linha', style: 'margin-top:6px' }, ...(['lateral', 'tres-quartos', 'frente', 'cima'] as const).map((n) => {
      const b = el('button', { type: 'button' }, n === 'tres-quartos' ? '3/4' : n.toUpperCase());
      b.addEventListener('click', () => predefinida(n));
      return b;
    })),
    el('h3', {}, 'Desmontar'),
    blocoDesmontar,
    avisoDesmontar,
    el('h3', {}, 'Ficha (lida do código)'),
    el('table', {}, fichaTbody),
    el('h3', {}, 'Ao vivo'),
    el('table', {}, vivoTbody),
    el('p', { class: 'dica' }, 'Pelve: altura em relação ao repouso. Os gráficos mostram os últimos 3 s (amarelo: geração 2, verde: geração 3).'),
    graficos.pelve,
    graficos.tronco,
    el('h3', {}, 'Ajustes da geração 3'),
    ajustes,
    el('div', { class: 'linha' }, bSalvar, bPadrao, bDesfazer),
    aviso,
    el('p', { class: 'dica' }, 'Teto da cadência, agachamento e molejo refazem os Mechs; o resto vale ao vivo. Salvar grava o dado que o jogo lê; a geração 3 só aparece no jogo com mech:gen3 liberada.'),
  );
  seletor.value = chassi;
  mostrarAjustes();
  atualizarFicha();
  aposMontar();
}

// ── Partida ────────────────────────────────────────────────────────────────────────────────────────────────────────
let acumulado = 0;
let ultimo = performance.now();
let ultimoPainel = 0;
function quadro(agora: number): void {
  acumulado += Math.min(0.1, (agora - ultimo) / 1000);
  ultimo = agora;
  while (acumulado >= DT) {
    passo();
    acumulado -= DT;
  }
  controles.update();
  desenhar();
  if (agora - ultimoPainel > 250) {
    ultimoPainel = agora;
    atualizarAoVivo();
  }
  requestAnimationFrame(quadro);
}

async function iniciar(): Promise<void> {
  await carregarGeracao3();
  try {
    // O arquivo pode ter mudado desde a montagem: a prévia parte do que está salvo agora.
    const j = (await (await fetch('/api/estado')).json()) as { mechs?: { ajustes?: Partial<AjustesDoMovimento> } };
    if (j.mechs?.ajustes) definirAjustesGen3(j.mechs.ajustes);
  } catch {
    // Sem o servidor do Estúdio a prévia usa os ajustes montados no pacote.
  }
  renderer.setSize(palco.clientWidth, palco.clientHeight, false);
  await Promise.all(lados.map((l) => l.montar()));
  montarPainel();
  predefinida('lateral');
  window.mechsProva = () => ({
    chassi,
    origem: origemDe(chassi),
    opcoes: TODOS.length,
    vista,
    modo,
    quadros: quadroN,
    lados: lados.map((l) => ({
      gen3: l.gen3,
      pronto: l.pronto,
      temGen3: l.temGen3,
      desmontavel: l.desmontavel,
      v: Math.hypot(l.sim.vx, l.sim.vz),
      passosPorSegundo: l.passos.length / 2,
      pelve: l.rig.pelvis.position.y - l.rig.hipHeight,
      tronco: l.rig.torso.rotation.x * RAD,
    })),
  });
  requestAnimationFrame(quadro);
  window.pronto = true;
}
void iniciar();
