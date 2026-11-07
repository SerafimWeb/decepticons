import * as THREE from 'three';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BLUEPRINT_BY_CHASSIS } from './blueprintByChassis';
import { CHASSIS, type ChassisId } from './chassis';
import { GAVIAO_H3_BLUEPRINT } from './gaviaoH3';
import { MECH_GRAVITY, type MechRig } from './MechBase';
import { buildMechBlueprintRig, MEDIUM_MECH_BLUEPRINT, type MechBlueprint } from './mechBlueprint';
import { carregarGeracao3, setMovimentoGen3 } from './movimentoGen3';
import { comandoDoRoteiro, DT, integrar, novoEstado, QUADROS } from './roteiroDeMovimento';
import { Vector09 } from './Vector09';

/**
 * O contrato do corpo da geração 3 (ordem do Comandante, 07/11: "esse espaço entre o tronco e as pernas, vamos eliminar a partir da terceira geração" e "os pés
 * afundam no solo"). Todo corpo novo entra na lista `CORPOS_GEN3` e herda os testes; os robôs de sempre (a geração 2) só entram na do pé no chão.
 *
 * Os dois testes olham a geometria de verdade, não a ficha: o vão é um raio horizontal que passa direto pela cintura (é o que o olho vê), e o pé é o vértice mais
 * baixo da malha depois do giro do tornozelo (que mora no shader do lote e aqui é emulado com as mesmas contas).
 */
const CORPOS_GEN3: readonly { nome: string; bp: MechBlueprint; stats: (typeof CHASSIS)[ChassisId] }[] = [
  { nome: 'Gavião-H3', bp: GAVIAO_H3_BLUEPRINT, stats: { ...CHASSIS.vector09, height: GAVIAO_H3_BLUEPRINT.referenceHeight } },
];

/** Os robôs de código de hoje: com a geração 3 ligada, o pé também tem de pisar o chão neles. */
const ROBOS_DE_CODIGO: readonly { nome: string; bp: MechBlueprint; stats: (typeof CHASSIS)[ChassisId] }[] = [
  ...(['vector09', 'arara', 'onca', 'colossus01'] as const).map((id) => ({ nome: id, bp: BLUEPRINT_BY_CHASSIS[id] ?? MEDIUM_MECH_BLUEPRINT, stats: CHASSIS[id] })),
  ...CORPOS_GEN3,
];

/** As poses extremas que o tronco e a perna fazem de verdade (o tronco inclina `pitch × 0,25` mais a mola, ~10°; aqui o dobro). */
const TRONCO_EXTREMO: readonly (readonly [number, number, number])[] = [
  [0, 0, 0],
  [0.3, 0, 0],
  [-0.3, 0, 0],
  [0, 0.25, 0],
  [0, -0.25, 0],
  [0.2, 0.2, 0.12],
  [-0.2, -0.2, -0.12],
];

/** Os pivôs do rig são `THREE.Group` de verdade; o tipo `RigJoint` só expõe o que o jogo usa. */
const obj = (no: unknown): THREE.Object3D => no as THREE.Object3D;

const malhasDoLote = (no: THREE.Object3D): THREE.Mesh[] => {
  const malhas: THREE.Mesh[] = [];
  no.traverse((o) => {
    if (o instanceof THREE.Mesh && (o.geometry as THREE.BufferGeometry).getAttribute('mechHull')) malhas.push(o);
  });
  return malhas;
};

/**
 * O vértice mais baixo do rig no mundo. O pé gira no tornozelo dentro do vertex shader do lote (`meshKit.batchRigMeshes`: rotação em X em torno de `(0, ankleY, 0)`
 * do pivô do joelho, ângulo `footPitch`); aqui a mesma conta, para a geometria que a GPU desenha.
 */
function verticeMaisBaixo(r: MechRig): number {
  r.model.updateMatrixWorld(true);
  const par = r.hullMaterials[0]?.userData.footPitch as THREE.Vector2;
  const v = new THREE.Vector3();
  let minimo = Infinity;
  for (const malha of malhasDoLote(r.model)) {
    const g = malha.geometry as THREE.BufferGeometry;
    const pos = g.getAttribute('position');
    const marca = g.getAttribute('mechFoot');
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const lado = marca.getX(i);
      if (lado !== 0) {
        const ay = (lado < 0 ? r.leftLeg.ankle : r.rightLeg.ankle)?.position.y ?? 0;
        const a = lado < 0 ? par.x : par.y;
        const c = Math.cos(a);
        const s = Math.sin(a);
        const dy = v.y - ay;
        const z = v.z;
        v.y = ay + c * dy - s * z;
        v.z = s * dy + c * z;
      }
      v.applyMatrix4(malha.matrixWorld);
      if (v.y < minimo) minimo = v.y;
    }
  }
  return minimo;
}

/** Quantos raios horizontais, numa faixa de alturas, passam direto pelo rig sem tocar em nada: cada um é um pedaço de vão que o olho vê. */
function raiosQuePassam(r: MechRig, yMin: number, yMax: number, xs: readonly number[]): number {
  r.model.updateMatrixWorld(true);
  const malhas = malhasDoLote(r.model);
  const raio = new THREE.Raycaster();
  let furos = 0;
  for (let y = yMin; y <= yMax; y += 0.02) {
    for (const x of xs) {
      // De trás para a frente (a frente do Mech é -z) e do lado de fora para dentro, em x e z.
      for (const [origem, direcao] of [
        [new THREE.Vector3(x, y, 8), new THREE.Vector3(0, 0, -1)],
        [new THREE.Vector3(x, y, -8), new THREE.Vector3(0, 0, 1)],
        [new THREE.Vector3(8, y, x * 0.2), new THREE.Vector3(-1, 0, 0)],
        [new THREE.Vector3(-8, y, x * 0.2), new THREE.Vector3(1, 0, 0)],
      ] as const) {
        raio.set(origem, direcao);
        if (raio.intersectObjects(malhas, false).length === 0) furos++;
      }
    }
  }
  return furos;
}

describe.each(CORPOS_GEN3)('o corpo da geração 3 $nome: sem vão entre o tronco e as pernas', ({ bp }) => {
  it('a cintura é fechada em qualquer pose do tronco: nenhum raio horizontal passa entre o cinto e o peito', () => {
    const r = buildMechBlueprintRig(bp);
    r.model.updateMatrixWorld(true);
    // O pivô do tronco é o topo do cinto: a faixa vai do alto da pelve até a base do peito (0,6 acima do pivô, em torno do eixo central).
    const pivo = new THREE.Vector3();
    obj(r.torso).getWorldPosition(pivo);
    for (const [pitch, yaw, roll] of TRONCO_EXTREMO) {
      obj(r.torso).rotation.set(pitch, yaw, roll);
      expect(raiosQuePassam(r, pivo.y - 0.2, pivo.y + 0.6, [-0.12, 0, 0.12]), `tronco em ${pitch}, ${yaw}, ${roll}`).toBe(0);
    }
  });

  it('o quadril é fechado com a perna toda para a frente e toda para trás: nenhum raio passa pela junta', () => {
    const r = buildMechBlueprintRig(bp);
    r.model.updateMatrixWorld(true);
    const quadril = new THREE.Vector3();
    obj(r.leftLeg.hip).getWorldPosition(quadril);
    for (const flexao of [0, 0.9, -0.9]) {
      obj(r.leftLeg.hip).rotation.x = flexao;
      obj(r.rightLeg.hip).rotation.x = -flexao;
      expect(raiosQuePassam(r, quadril.y - 0.15, quadril.y + 0.2, [0]), `quadril em ${flexao}`).toBe(0);
    }
  });

  it('o abdômen entra no cinto: o topo da pelve passa do pivô do tronco, e a base do tronco desce abaixo dele', () => {
    const r = buildMechBlueprintRig(bp);
    r.model.updateMatrixWorld(true);
    const pelve = malhasDoLote(obj(r.pelvis)).filter((m) => m.parent === obj(r.pelvis));
    const tronco = malhasDoLote(obj(r.torso)).filter((m) => m.parent === obj(r.torso));
    expect(pelve.length).toBe(1);
    expect(tronco.length).toBe(1);
    const topoDaPelve = new THREE.Box3().setFromObject(pelve[0]!, true).max.y;
    const baseDoTronco = new THREE.Box3().setFromObject(tronco[0]!, true).min.y;
    // Folga de 4 cm de cada lado do pivô: a pelve passa dele, o tronco desce abaixo dele.
    expect(topoDaPelve - baseDoTronco).toBeGreaterThan(0.04);
  });
});

describe('o pé no chão na geração 3: o vértice mais baixo da malha, depois do giro do tornozelo, não fura o piso (2 cm na corrida, 1% da altura no pior quadro do roteiro todo)', () => {
  beforeAll(async () => {
    await carregarGeracao3();
    setMovimentoGen3(true);
  });
  afterAll(() => setMovimentoGen3(false));

  it.each(ROBOS_DE_CODIGO)('$nome: parado, corre, freia, pula, pousa, vira, dá dash e atira sem afundar', ({ bp, stats }) => {
    const mech = new Vector09({ stats, blueprint: bp });
    const privado = mech as unknown as { dashTimeLeft: number; recoil: number; leftRecoil: number };
    const rig = (mech as unknown as { rig: MechRig }).rig;
    const sim = novoEstado();
    mech.grounded = true;
    let fundo = Infinity;
    let fundoNaCorrida = Infinity;
    for (let i = 0; i < QUADROS; i++) {
      const e = comandoDoRoteiro(i, stats.moveSpeed);
      integrar(sim, e, stats, MECH_GRAVITY, i);
      privado.dashTimeLeft = Math.max(0, sim.dash);
      mech.velocity.set(sim.vx, sim.vy, sim.vz);
      mech.grounded = sim.grounded;
      mech.applyFacing(sim.yaw, 0);
      if (e.tiro) {
        privado.recoil = 1;
        privado.leftRecoil = 1;
      }
      mech.render(DT, 1);
      mech.root.position.set(sim.x, sim.y, sim.z);
      mech.root.updateMatrixWorld(true);
      const y = verticeMaisBaixo(rig);
      fundo = Math.min(fundo, y);
      // A corrida firme (a bancada: 1,8 a 3,9 s): o pé tem de estar plantado.
      if (i >= Math.round(1.8 / DT) && i < Math.round(3.9 / DT)) fundoNaCorrida = Math.min(fundoNaCorrida, y);
    }
    expect(fundoNaCorrida).toBeGreaterThan(-0.02);
    // O pior quadro de todos é o toque do pouso: a ponta ainda vem da postura de ar e raspa por 2 a 3 quadros, proporcional ao pé (na geração 2 eram 18 a 42 cm, o tempo todo).
    expect(fundo).toBeGreaterThan(-0.01 * stats.height);
  });
});
