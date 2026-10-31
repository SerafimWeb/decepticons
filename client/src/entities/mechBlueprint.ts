import { weaponModel } from './weaponModels';
import * as THREE from 'three';
import type { Loadout } from '../combat/weapons';
import { EXTRA_SLOTS, type ExtraSlot } from '../combat/encaixesExtras';
import { PALETTE } from '../core/palette';
import type { LegRig, MechRig } from './MechBase';
import { batchRigMeshes, beveledBox, box, cyl, frostShell, group, heatVapor, taperedBox } from './meshKit';

/** Parâmetros visuais apenas; não altera colisão, massa, vida, calor ou armas da simulação. */
export interface MechBlueprint {
  readonly id: 'ferret' | 'vector09' | 'heavy' | 'colossus01';
  /** Tem os encaixes extras de peso (P282: as costas e os dois ombros ao lado da cabeça): o rig cria os nós deles. */
  readonly encaixesDePeso?: boolean;
  /**
   * P295 (31/10, o Comandante): o canhão das costas sai no lugar da cabeça (sem cabeça), e os ombros ficam para fora, nas laterais de cima do torso,
   * e não enterrados no peito. A boca de tiro da simulação (`muzzles` do chassi) acompanha a posição nova.
   */
  readonly canhaoNaCabeca?: boolean;
  /** Tamanho das armas dos encaixes de peso em relação ao padrão (1). O Colossus leva armas do tamanho do corpo (P302). */
  readonly escalaDosEncaixes?: number;
  readonly label: string;
  readonly referenceHeight: number;
  readonly torso: { readonly width: number; readonly height: number; readonly depth: number };
  readonly head: {
    readonly width: number; readonly height: number; readonly depth: number; readonly antenna: number;
    /**
     * Canhão giratório no lugar da cabeça (pedido do dono, 29/09), em vez do rosto de sempre. Mesmo
     * espaço, mesma posição — a zona de acerto da cabeça (`combat/damage.ts`, fração da altura total)
     * não muda; só a forma muda. Gira devagar sozinho (ver `MechBase.animate`), decorativo, sem ligar
     * com a mira real do jogador — a "arma" de verdade continua nos braços, como qualquer outro Mech.
     */
    readonly turret?: boolean;
  };
  readonly shoulders: { readonly width: number; readonly height: number; readonly depth: number };
  readonly hips: { readonly width: number; readonly depth: number };
  readonly legs: { readonly hipWidth: number; readonly thighWidth: number; readonly shinWidth: number; readonly upperLength: number; readonly lowerLength: number; readonly footLength: number; readonly digitigrade: number };
  readonly arms: { readonly mountX: number; readonly upperWidth: number; readonly upperLength: number; readonly forearmWidth: number; readonly forearmDepth: number };
  readonly vents: { readonly count: number; readonly width: number; readonly height: number };
  readonly backPack: { readonly width: number; readonly height: number; readonly depth: number };
  /**
   * Cauda decorativa (opcional): 2–3 segmentos afunilando, presos na pelve, sem junta nem animação.
   * Puramente visual — não move, não é uma parte de dano (`MechPart` continua com as 6 de sempre) e não
   * participa da mira nem do meshKit é reaproveitado, então custa 0 alocação por quadro (G4/G5). Existe
   * porque braço e cabeça já estão ligados à mira e à zona de acerto (ver achado de 29/09 no histórico);
   * a cauda é o jeito seguro de dar identidade animal sem mexer nisso.
   */
  readonly tail?: { readonly segments: number; readonly baseRadius: number; readonly length: number; readonly droop: number };
}

/**
 * Ferret-X / Arara-B1: leve e esguio — não é o Vector-09 encolhido. Torso pequeno, pernas compridas e
 * bem digitígradas (joelho invertido, quase de ave), pés e braços finos. Achado do dono (29/09, comparando
 * lado a lado com o Onça-B2 e o Colossus): as proporções antigas eram quase a mesma forma só escalada —
 * a mesma armadilha de design que a conversa de referência descreve ("três robôs com ombros diferentes").
 * Agora a razão largura/altura do torso e o comprimento relativo das pernas são deliberadamente diferentes
 * do médio e do pesado, não só o tamanho.
 */
export const LIGHT_MECH_BLUEPRINT: MechBlueprint = {
  id: 'ferret', label: 'LEVE', referenceHeight: 4.5,
  torso: { width: 1.0, height: 0.85, depth: 0.72 },
  head: { width: 0.46, height: 0.38, depth: 0.5, antenna: 0.42 },
  shoulders: { width: 0.4, height: 0.4, depth: 0.46 }, hips: { width: 0.6, depth: 0.42 },
  legs: { hipWidth: 0.3, thighWidth: 0.24, shinWidth: 0.17, upperLength: 1.35, lowerLength: 1.55, footLength: 0.6, digitigrade: 0.55 },
  arms: { mountX: 0.68, upperWidth: 0.22, upperLength: 0.56, forearmWidth: 0.28, forearmDepth: 0.56 },
  vents: { count: 3, width: 0.1, height: 0.3 }, backPack: { width: 0.56, height: 0.68, depth: 0.4 },
};

/** Vector-09: assalto médio, mantendo a proporção visual aprovada do modelo atual. */
export const MEDIUM_MECH_BLUEPRINT: MechBlueprint = {
  id: 'vector09', label: 'MÉDIO', referenceHeight: 5.3,
  torso: { width: 2.0, height: 1.4, depth: 1.5 },
  head: { width: 0.75, height: 0.5, depth: 0.85, antenna: 0.3 },
  shoulders: { width: 0.7, height: 0.6, depth: 0.9 }, hips: { width: 1.3, depth: 0.9 },
  legs: { hipWidth: 0.5, thighWidth: 0.55, shinWidth: 0.5, upperLength: 1.15, lowerLength: 1.15, footLength: 1.1, digitigrade: 0 },
  arms: { mountX: 1.5, upperWidth: 0.4, upperLength: 0.9, forearmWidth: 0.55, forearmDepth: 1.2 },
  vents: { count: 2, width: 0.16, height: 0.42 }, backPack: { width: 1.02, height: 0.86, depth: 0.62 },
};

/**
 * Onça-B2: pesado de escala 2 — baixo, largo e atarracado, não o médio esticado. Torso alto e fundo,
 * pernas curtas e grossas com pés grandes (estabilidade, centro de massa baixo), cabeça pequena e sem
 * antena (lê mais "animal predador" que "robô sensor"). A largura do torso passa a da altura: silhueta
 * de urso/felino agachado, não de humanoide P/M/G. Ver nota do Arara-B1 sobre o achado do dono (29/09).
 * **Sem cauda (29/09→29/09):** chegou a ganhar uma cauda decorativa (`tail`) no mesmo dia; o dono viu ao
 * vivo, achou fraca ("bosta") e não resolvia a queixa real (silhueta de blocos) — removida da mesma
 * sessão. A capacidade `tail` continua disponível no tipo e no builder pra quem precisar depois.
 */
export const HEAVY_MECH_BLUEPRINT: MechBlueprint = {
  encaixesDePeso: true,
  id: 'heavy', label: 'PESADO', referenceHeight: 6.5,
  torso: { width: 3.1, height: 2.3, depth: 2.3 },
  head: { width: 0.7, height: 0.42, depth: 0.8, antenna: 0 },
  shoulders: { width: 1.4, height: 0.85, depth: 1.35 }, hips: { width: 2.15, depth: 1.55 },
  legs: { hipWidth: 0.95, thighWidth: 0.95, shinWidth: 0.85, upperLength: 1.05, lowerLength: 0.95, footLength: 1.65, digitigrade: 0 },
  arms: { mountX: 2.3, upperWidth: 0.76, upperLength: 0.85, forearmWidth: 1.0, forearmDepth: 1.75 },
  vents: { count: 5, width: 0.2, height: 0.42 }, backPack: { width: 1.6, height: 0.85, depth: 0.9 },
};

/**
 * Colossus-01: máquina de cerco da escala 3. Não é o pesado de escala 2 aumentado:
 * recebe uma base larga, tronco alto e pernas que criam espaço para o jogador circular.
 * São parâmetros estritamente visuais; IA, vida e armas entram no encontro em outro módulo.
 */
export const COLOSSUS_01_BLUEPRINT: MechBlueprint = {
  encaixesDePeso: true,
  id: 'colossus01', label: 'COLOSSUS-01', referenceHeight: 14, canhaoNaCabeca: true, escalaDosEncaixes: 2.2,
  torso: { width: 5.8, height: 3.8, depth: 4.2 },
  head: { width: 1.65, height: 1.05, depth: 1.5, antenna: 0 },
  shoulders: { width: 2.25, height: 1.75, depth: 2.15 }, hips: { width: 3.95, depth: 2.5 },
  legs: { hipWidth: 2.2, thighWidth: 1.65, shinWidth: 1.45, upperLength: 3.05, lowerLength: 2.85, footLength: 3.25, digitigrade: 0 },
  arms: { mountX: 4.45, upperWidth: 1.2, upperLength: 2.15, forearmWidth: 1.62, forearmDepth: 3.1 },
  vents: { count: 5, width: 0.42, height: 1.15 }, backPack: { width: 3.2, height: 2.55, depth: 1.85 },
};

export const MECH_BLUEPRINTS: readonly MechBlueprint[] = [
  LIGHT_MECH_BLUEPRINT,
  MEDIUM_MECH_BLUEPRINT,
  HEAVY_MECH_BLUEPRINT,
  COLOSSUS_01_BLUEPRINT,
];

export interface BlueprintRigOptions {
  readonly paint?: number;
  readonly visor?: number;
  readonly scaleToHeight?: number;
}

/** Constrói o mesmo rig articulado de seis partes a partir de proporções; toda fusão ocorre na criação. */
export function buildMechBlueprintRig(blueprint: MechBlueprint, options: BlueprintRigOptions = {}): MechRig {
  const scale = options.scaleToHeight ?? 1;
  const torsoW = blueprint.torso.width;
  const torsoH = blueprint.torso.height;
  const torsoD = blueprint.torso.depth;
  // Mantém a sola no chão: offset do quadril + segmentos da perna + meio do pé.
  const hipHeight = (blueprint.legs.upperLength + blueprint.legs.lowerLength + 0.3) * scale;
  const M = {
    armor: new THREE.MeshStandardMaterial({ color: PALETTE.armor, metalness: 0.6, roughness: 0.36 }),
    frame: new THREE.MeshStandardMaterial({ color: PALETTE.frame, metalness: 0.72, roughness: 0.48 }),
    paint: new THREE.MeshStandardMaterial({ color: options.paint ?? PALETTE.playerPaint, metalness: 0.36, roughness: 0.44 }),
    visor: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: options.visor ?? PALETTE.green, emissiveIntensity: 4 }),
    rocket: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: PALETTE.sodium, emissiveIntensity: 3 }),
    thruster: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: PALETTE.sodium, emissiveIntensity: 2 }),
  };
  M.thruster.userData.mechDynamicEmission = true;

  const model = new THREE.Group();
  model.name = `mech-${blueprint.id}`;
  const pelvis = group(model, 0, hipHeight, 0);
  pelvis.name = 'pelvis';
  box(pelvis, blueprint.hips.width, 0.5 * scale, blueprint.hips.depth, M.frame);

  // Cauda decorativa (opcional, G4/G5: construída uma vez, sem junta animada, sem custo por quadro).
  // Presa direto na pelve — nunca toca braço, cabeça ou pernas (ver nota no blueprint da Onça-B2).
  // A raiz fica atrás do ponto mais traseiro de verdade (torso + mochila, a mesma referência do exaustor
  // de calor logo abaixo): nascer só na borda do quadril a deixava por baixo do torso, escondida.
  if (blueprint.tail) {
    const { segments, baseRadius, length, droop } = blueprint.tail;
    const segLen = (length / segments) * scale;
    const rootZ = torsoD * 0.78 + blueprint.backPack.depth * 0.5 + 0.12 * scale;
    // A raiz carrega o ângulo inicial uma vez só; cada segmento gira só o INCREMENTO (`step`) em relação
    // ao pai — como cada segmento é filho do anterior (já girado), ângulos absolutos se somariam sozinhos
    // a cada elo e a cauda dobraria sobre si mesma (achado real, 29/09: media a posição no mundo de cada
    // segmento e via a curva ziguezaguear em vez de continuar). Incremento relativo é a conta certa.
    let node: THREE.Object3D = group(pelvis, 0, 0.1 * scale, rootZ);
    node.rotation.x = 1.42; // quase na horizontal, saindo pra trás — não pra cima, senão desaparece no corpo
    const step = (droop * 1.6) / segments;
    for (let i = 0; i < segments; i++) {
      const seg = group(node, 0, 0, 0);
      seg.rotation.x = step;
      const r = baseRadius * scale * (1 - (i / segments) * 0.75);
      cyl(seg, Math.max(0.015 * scale, r), segLen, M.frame, 0, segLen * 0.5, 0);
      node = group(seg, 0, segLen, 0);
    }
  }

  const leg = (side: number): LegRig => {
    const hip = group(pelvis, side * blueprint.legs.hipWidth * 0.5, -0.1 * scale, 0);
    hip.name = side < 0 ? 'leftLeg' : 'rightLeg';
    taperedBox(hip, blueprint.legs.thighWidth, blueprint.legs.upperLength * 0.76, blueprint.legs.thighWidth * 1.08, 1.4, M.armor, 0, -blueprint.legs.upperLength * 0.35, 0);
    cyl(hip, blueprint.legs.thighWidth * 0.38, blueprint.legs.upperLength * 0.9, M.frame, 0, -blueprint.legs.upperLength * 0.48, 0);
    const knee = group(hip, 0, -blueprint.legs.upperLength, 0);
    knee.name = side < 0 ? 'leftLegLower' : 'rightLegLower';
    // Pino do joelho: quebra a coxa e a canela em duas peças de verdade, não uma coluna contínua.
    const kneePin = cyl(knee, blueprint.legs.thighWidth * 0.3, blueprint.legs.thighWidth * 1.15, M.frame, 0, 0, 0);
    kneePin.rotation.z = Math.PI / 2;
    taperedBox(knee, blueprint.legs.shinWidth * 0.92, blueprint.legs.lowerLength * 0.94, blueprint.legs.shinWidth, 1.25, M.paint, 0, -blueprint.legs.lowerLength * 0.42, 0);
    box(knee, blueprint.legs.shinWidth * 1.2, 0.2 * scale, blueprint.legs.footLength, M.frame, 0, -blueprint.legs.lowerLength - 0.1 * scale, -blueprint.legs.footLength * 0.12);
    // Tornozelo avançado cria a perna digitígrada sem adicionar junta nem draw call.
    if (blueprint.legs.digitigrade > 0) knee.position.z = -blueprint.legs.digitigrade * scale;
    return { hip, knee };
  };
  const leftLeg = leg(-1);
  const rightLeg = leg(1);

  const torso = group(pelvis, 0, 0.3 * scale, 0);
  torso.name = 'torso';
  const updateVapor = heatVapor(torso, blueprint.backPack.width * 0.32, torsoD * 0.78 + blueprint.backPack.depth * 0.5 + 0.08 * scale);
  // Torso em duas placas, não uma só: cintura estreita (perto do quadril) alargando pro peito/ombro —
  // silhueta em V, não um bloco reto. Referência War Robots (pedido do dono, 29/09): a leitura de "mech
  // de verdade" vem de placas que afunilam e quebram no meio, não de um retângulo grande e único.
  taperedBox(torso, torsoW * 0.62, torsoH * 0.4, torsoD * 0.6, 1.42, M.armor, 0, torsoH * 0.36, 0);
  taperedBox(torso, torsoW * 0.88, torsoH * 0.7, torsoD * 0.92, 1.2, M.armor, 0, torsoH * 0.82, 0);
  // Cinto na emenda cintura→peito: aro mais escuro que quebra a leitura de "um bloco só".
  box(torso, torsoW * 0.7, torsoH * 0.045, torsoD * 0.66, M.frame, 0, torsoH * 0.56, 0);
  beveledBox(torso, torsoW * 1.04, 0.2 * scale, torsoD * 1.04, 0.07 * scale, M.paint, 0, torsoH * 1.18, 0);
  box(torso, torsoW * 0.62, 0.12 * scale, 0.06 * scale, M.visor, 0, torsoH * 0.78, -torsoD * 0.53);
  box(torso, torsoW * 0.56, torsoH * 0.62, blueprint.backPack.depth, M.frame, 0, torsoH * 0.66, torsoD * 0.78);
  // Respiros nas laterais: formas simples e espaçadas continuam legíveis à distância.
  for (const side of [-1, 1]) {
    for (let i = 0; i < blueprint.vents.count; i++) {
      const y = torsoH * (0.42 + (i / Math.max(1, blueprint.vents.count - 1)) * 0.48);
      box(torso, blueprint.vents.width, blueprint.vents.height / blueprint.vents.count, 0.055 * scale, M.rocket,
        side * (torsoW * 0.43), y, -torsoD * 0.52);
    }
  }
  const thrusters: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const x = side * blueprint.backPack.width * 0.32;
    cyl(torso, blueprint.backPack.width * 0.19, blueprint.backPack.depth * 0.9, M.frame, x, torsoH * 0.48, torsoD * 0.74);
    cyl(torso, blueprint.backPack.width * 0.15, 0.12 * scale, M.thruster, x, torsoH * 0.48, torsoD * 1.12);
    thrusters.push(group(torso, x, torsoH * 0.48, torsoD * 1.15));
  }

  const head = group(torso, 0, torsoH * 1.25, -torsoD * 0.08);
  head.name = 'head';
  if (blueprint.canhaoNaCabeca) {
    // P295: sem cabeça; o canhão das costas ocupa o lugar dela (ver `back` abaixo). A zona de acerto da cabeça continua a mesma (módulos).
  } else if (blueprint.head.turret) {
    // Torre + cano no lugar do rosto: mesmo espaço e posição da cabeça de sempre (a zona de acerto,
    // fração da altura total em combat/damage.ts, não olha pra malha — continua igual).
    cyl(head, blueprint.head.width * 0.58, blueprint.head.height * 0.85, M.armor, 0, blueprint.head.height * 0.55, 0);
    const barrel = blueprint.head.depth * 2.1 * scale;
    cyl(head, blueprint.head.width * 0.13, barrel, M.frame, 0, blueprint.head.height * 0.55, -blueprint.head.depth * 0.4 * scale - barrel * 0.5, Math.PI / 2);
    box(head, blueprint.head.width * 0.2, blueprint.head.width * 0.2, 0.05 * scale, M.visor, 0, blueprint.head.height * 0.55, -blueprint.head.depth * 0.42 * scale);
    head.userData.turret = true; // MechBase.animate() usa isso pra girar devagar sozinho
  } else {
    beveledBox(head, blueprint.head.width, blueprint.head.height, blueprint.head.depth, Math.min(blueprint.head.width, blueprint.head.height, blueprint.head.depth) * 0.11, M.armor, 0, blueprint.head.height * 0.5, 0);
    box(head, blueprint.head.width * 0.78, 0.11 * scale, 0.06 * scale, M.visor, 0, blueprint.head.height * 0.56, -blueprint.head.depth * 0.52);
  }
  if (blueprint.head.antenna > 0) cyl(head, 0.035 * scale, blueprint.head.antenna, M.frame, blueprint.head.width * 0.28, blueprint.head.height + blueprint.head.antenna * 0.45, 0.08 * scale);

  /**
   * As peças do braço. `semCasulo` (só no esquerdo) é o antebraço liso, para quando a arma do braço é a chuva de mísseis (o morteiro
   * fica nas costas): o rig guarda as duas geometrias do braço e `mountWeapons` troca uma pela outra, sem desenho a mais.
   */
  const armParts = (g: THREE.Object3D, side: number, isLeft: boolean, semCasulo: boolean): void => {
    const pad = beveledBox(g, blueprint.shoulders.width, blueprint.shoulders.height, blueprint.shoulders.depth, Math.min(blueprint.shoulders.width, blueprint.shoulders.height) * 0.1, M.paint, 0, 0, 0);
    // Ombreira angulada pra fora (pauldron), não um bloco plano alinhado ao corpo — referência War Robots.
    pad.rotation.z = -side * 0.16;
    // Pino da junta do ombro: quebra a leitura de "peça única" entre torso e braço.
    const shoulderPin = cyl(g, blueprint.shoulders.height * 0.24, blueprint.shoulders.width * 1.08, M.frame, 0, -blueprint.shoulders.height * 0.05, 0);
    shoulderPin.rotation.z = Math.PI / 2;
    taperedBox(g, blueprint.arms.upperWidth, blueprint.arms.upperLength, blueprint.arms.upperWidth, 1.3, M.frame, 0, -blueprint.arms.upperLength * 0.72, 0);
    const elbowPin = cyl(g, blueprint.arms.upperWidth * 0.3, blueprint.arms.upperWidth * 1.3, M.frame, 0, -blueprint.arms.upperLength * 1.42, 0);
    elbowPin.rotation.z = Math.PI / 2;
    box(g, blueprint.arms.forearmWidth, blueprint.arms.forearmWidth, blueprint.arms.forearmDepth, M.armor, 0, -blueprint.arms.upperLength * 1.5, -blueprint.arms.forearmDepth * 0.2);
    if (semCasulo) {
      // antebraço liso: nada a somar
    } else if (isLeft) {
      const rows = blueprint.id === 'heavy' || blueprint.id === 'colossus01' ? 3 : 2;
      const cols = 2;
      for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
        const cx = (col - (cols - 1) / 2) * blueprint.arms.forearmWidth * 0.42;
        const cy = -blueprint.arms.upperLength * 1.5 + (row - (rows - 1) / 2) * blueprint.arms.forearmWidth * 0.38;
        cyl(g, blueprint.arms.forearmWidth * 0.11, 0.18 * scale, M.rocket, cx, cy, -blueprint.arms.forearmDepth * 0.62, Math.PI / 2);
      }
    } else {
      cyl(g, blueprint.arms.forearmWidth * 0.2, blueprint.arms.forearmDepth * 1.1, M.frame, 0, -blueprint.arms.upperLength * 1.5, -blueprint.arms.forearmDepth * 0.64, Math.PI / 2);
      cyl(g, blueprint.arms.forearmWidth * 0.24, 0.12 * scale, M.visor, 0, -blueprint.arms.upperLength * 1.5, -blueprint.arms.forearmDepth * 1.16, Math.PI / 2);
    }
  };
  const arm = (side: number, isLeft: boolean): THREE.Group => {
    const g = group(torso, side * blueprint.arms.mountX, torsoH * 0.84, 0);
    g.name = isLeft ? 'leftArm' : 'rightArm';
    armParts(g, side, isLeft, false);
    return g;
  };
  const rightArm = arm(1, false);
  const leftArm = arm(-1, true);
  const muzzle = group(rightArm, 0, -blueprint.arms.upperLength * 1.5, -blueprint.arms.forearmDepth * 1.35);
  const leftMuzzle = group(leftArm, 0, -blueprint.arms.upperLength * 1.5, -blueprint.arms.forearmDepth * 0.8);

  // Morteiro da chuva de mísseis nas costas (pedido do dono, 04/10: "acoplando nos ombros, apontando pra cima, ou nas costas").
  // Fica oculto até a chuva ser a arma do braço esquerdo; oculto, não é desenhado (o Mech só paga o desenho a mais quando usa).
  const rack = group(torso, 0, 0, 0);
  rack.name = 'morteiro-costas';
  rack.visible = false;
  const barrageMouth = buildBackMortar(rack, blueprint, M);
  // Os encaixes extras de peso (P282): as costas e os dois ombros ao lado da cabeça, só nos robôs que os têm. O nó fica vazio até a montagem levar uma arma (`mountWeapons`).
  const nos: Partial<Record<ExtraSlot, THREE.Object3D>> = blueprint.encaixesDePeso
    ? {
        // atrás da traseira do tronco (a mochila termina a ~1,6 × a profundidade): a arma sai para trás, sem ficar enterrada no corpo
        // P295: o Colossus leva o canhão das costas no lugar da cabeça (boca para a frente) e os ombros nas laterais de cima do torso.
        // P296 (31/10): as três armas do Colossus ficam na PARTE DE CIMA do chassi, alinhadas para a frente (onde estava a cabeça): a das costas no centro e as dos ombros dos lados.
        back: blueprint.canhaoNaCabeca ? group(torso, 0, torsoH * 1.25, -torsoD * 0.08) : group(torso, 0, torsoH * 1.02, torsoD * 1.7),
        rightShoulder: blueprint.canhaoNaCabeca ? group(torso, torsoW * 0.34, torsoH * 1.25, -torsoD * 0.08) : group(torso, torsoW * 0.32, torsoH * 1.02, 0),
        leftShoulder: blueprint.canhaoNaCabeca ? group(torso, -torsoW * 0.34, torsoH * 1.25, -torsoD * 0.08) : group(torso, -torsoW * 0.32, torsoH * 1.02, 0),
      }
    : {};
  // Onde cada extra leva a sua arma: a arma fica com a boca no nó e o corpo para trás (como nas mãos). Um ponto sem peso (o próprio nó) serve de boca.
  const bocaDoExtra = new THREE.Object3D();
  const extrasMontados: Partial<Record<ExtraSlot, THREE.Object3D | undefined>> = {};
  const mostrandoExtra: Partial<Record<ExtraSlot, Loadout['secondary']>> = {};

  const batchedMaterial = batchRigMeshes(model, [M.armor, M.paint]);
  // Só depois do lote: `batchRigMeshes` varre e remove todo `THREE.Mesh` dos pivôs para fundir no casco —
  // criada antes, a capa de gelo seria varrida junto (ela é um `THREE.Mesh` comum, não um `THREE.Points` como
  // o vapor do calor). Cobre as duas placas do torso (cintura + peito, acima) com folga, não cada uma de perto.
  const updateFrost = frostShell(torso, torsoW, torsoH, torsoD, torsoH * 0.7);
  // O braço esquerdo mostra o casulo de foguetes, ou fica liso quando a arma é a chuva (o morteiro está nas costas). A variante lisa
  // é montada à parte e fundida do mesmo jeito (mesmas peças, mesmo casco); só a geometria vai e volta. **A boca (`leftMuzzle`) NÃO se
  // move:** o `MechBase` mede a boca de simulação do rig uma vez, no construtor, e o `equip` não a mede de novo; mexer nela aqui daria
  // tiros de origem diferente entre o cliente (que troca de arma depois) e o servidor (que já nasce com ela): G14. Só o desenho do
  // lançamento subindo usa a boca do morteiro (`barrageMouth`).
  const casuloArm = leftArm.children.find((c): c is THREE.Mesh => c instanceof THREE.Mesh);
  const variantParent = new THREE.Group();
  armParts(variantParent, -1, true, true);
  batchRigMeshes(variantParent, [M.armor, M.paint]);
  const lisoArm = variantParent.children.find((c): c is THREE.Mesh => c instanceof THREE.Mesh);
  const casuloGeometry = casuloArm?.geometry;
  const rightOriginal = rightArm.children.find((c): c is THREE.Mesh => c instanceof THREE.Mesh);
  const rightGeometry = rightOriginal?.geometry;
  const rightPlainParent = new THREE.Group();
  armParts(rightPlainParent, 1, false, true);
  batchRigMeshes(rightPlainParent, [M.armor, M.paint]);
  const rightPlain = rightPlainParent.children.find((c): c is THREE.Mesh => c instanceof THREE.Mesh);
  let rightModule: THREE.Object3D | undefined;
  let leftModule: THREE.Object3D | undefined;
  let shownRight: Loadout['primary'] | undefined;
  let shownLeft: Loadout['secondary'] | undefined;
  const attachModule = (w: Loadout['secondary'], arm: THREE.Object3D, mouth: THREE.Object3D, escala = 1): THREE.Object3D | undefined => {
    if (!w || w.id === 'barrage' || (w.tier === 0 &&
        ((arm === rightArm && w.id === 'plasma') || (arm === leftArm && w.id === 'rockets')))) return undefined;
    const m = weaponModel(w);
    m.object.name = `weapon-${w.id}`;
    const size = blueprint.arms.forearmWidth * 0.75 * escala;
    m.object.scale.setScalar(size);
    m.object.position.copy(mouth.position).addScaledVector(m.muzzle, -size);
    arm.add(m.object);
    return m.object;
  };
  /**
   * Chapa do escudo físico (`MetalShield.ts`): montada só quando a montagem leva uma, três peças fora do lote fundido. Abaixada,
   * fica na face de fora do antebraço; levantada, desliza para a frente do braço e cobre o flanco do torso. A faixa colorida
   * diz o modelo (cinza muralha, laranja refratário, vermelho reativo, ciano amortecedor). Só desenho: a regra é da simulação.
   */
  let plate: THREE.Group | undefined;
  let plateStripe: THREE.MeshStandardMaterial | undefined;
  let plateUp = 0;
  const plateY = -blueprint.arms.upperLength * 1.45;
  const buildPlate = (): THREE.Group => {
    const g = group(leftArm, 0, 0, 0);
    g.name = 'escudo-fisico';
    const h = blueprint.arms.upperLength * 1.9;
    const w = blueprint.shoulders.width * 1.25;
    beveledBox(g, w, h, 0.14 * scale, 0.04 * scale, M.armor, 0, 0, 0);
    box(g, w * 0.82, h * 0.86, 0.06 * scale, M.frame, 0, 0, -0.08 * scale);
    plateStripe = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x9aa4ad, emissiveIntensity: 2.2 });
    box(g, w * 0.12, h * 0.7, 0.05 * scale, plateStripe, 0, 0, -0.12 * scale);
    return g;
  };
  const PLATE_COLOR = { muralha: 0x9aa4ad, refratario: 0xff7a1a, reativo: 0xd8342c, amortecedor: 0x22d3ee } as const;
  const placePlate = (up: number): void => {
    if (!plate) return;
    // Abaixada: de lado, por fora do antebraço. Levantada: de frente, adiante do braço e puxada para o centro.
    plate.position.set(
      -blueprint.arms.forearmWidth * 0.75 + up * blueprint.arms.forearmWidth * 1.4,
      plateY + up * blueprint.arms.upperLength * 0.25,
      -blueprint.arms.forearmDepth * (0.1 + up * 1.25),
    );
    plate.rotation.y = (1 - up) * (Math.PI / 2);
  };
  const setGuardVisual = (dt: number, shown: boolean, raised: boolean): void => {
    if (!plate) return;
    plate.visible = shown;
    if (!shown) return;
    const goal = raised ? 1 : 0;
    if (plateUp === goal) return;
    plateUp = goal > plateUp ? Math.min(1, plateUp + dt * 7) : Math.max(0, plateUp - dt * 5);
    placePlate(plateUp);
  };
  const mountWeapons = (loadout: Loadout): void => {
    for (const slot of EXTRA_SLOTS) {
      const no = nos[slot];
      if (!no) continue;
      const w = loadout[slot] ?? null;
      if (mostrandoExtra[slot] === w) continue;
      extrasMontados[slot]?.removeFromParent();
      extrasMontados[slot] = attachModule(w, no, bocaDoExtra, blueprint.escalaDosEncaixes ?? 1);
      mostrandoExtra[slot] = w;
    }
    if (loadout.metalShield) {
      plate ??= buildPlate();
      plate.visible = true;
      plateStripe!.emissive.setHex(PLATE_COLOR[loadout.metalShield.id]);
      plateUp = 0;
      placePlate(0);
    } else if (plate) plate.visible = false;
    if (shownRight !== loadout.primary) {
      if (rightModule) rightArm.remove(rightModule);
      rightModule = attachModule(loadout.primary, rightArm, muzzle);
      shownRight = loadout.primary;
    }
    if (shownLeft !== loadout.secondary) {
      if (leftModule) leftArm.remove(leftModule);
      leftModule = attachModule(loadout.secondary, leftArm, leftMuzzle);
      shownLeft = loadout.secondary;
    }
    if (rightOriginal && rightGeometry && rightPlain) rightOriginal.geometry = rightModule ? rightPlain.geometry : rightGeometry;
    // A chuva fica no braço esquerdo (de antes) ou nas costas (P294): nos dois casos o morteiro da mochila aparece.
    const chuva = loadout.secondary?.id === 'barrage' || loadout.back?.id === 'barrage';
    rack.visible = chuva;
    if (casuloArm && casuloGeometry && lisoArm) casuloArm.geometry = chuva || leftModule || !loadout.secondary ? lisoArm.geometry : casuloGeometry;
  };
  const setHeatVisual = (dt: number, heat: number, overheated: boolean, coolingBoost: boolean): void => {
    const setHeat = batchedMaterial.userData.setHeat;
    if (typeof setHeat === 'function') setHeat(Math.max(0, (heat - 0.65) / 0.35) * (overheated ? 0.62 : 0.52));
    updateVapor(dt, heat, overheated, coolingBoost);
  };
  model.userData.blueprint = blueprint.id;
  model.scale.setScalar(scale);
  return {
    model, pelvis, torso, head, leftArm, rightArm, leftLeg, rightLeg, muzzle, leftMuzzle,
    backMuzzle: nos.back,
    shoulderMuzzles: nos.rightShoulder && nos.leftShoulder ? { right: nos.rightShoulder, left: nos.leftShoulder } : undefined,
    thrusters, thrusterMaterial: batchedMaterial, setDashVisual: batchedMaterial.userData.setDash,
    hullMaterials: [batchedMaterial], hipHeight, setHeatVisual, setFrozenVisual: updateFrost, setGuardVisual, mountWeapons, barrageMouth,
  };
}

/**
 * O morteiro da chuva de mísseis nas costas: uma placa sobre a mochila e quatro tubos verticais, apontando para cima, com a boca
 * luminosa e uma escora atrás. Sobe só até a altura da cabeça, em todo chassi (não tapa a mira de quem joga por trás). Muda a silhueta (o casulo é
 * uma grade rasa na ponta do braço): a arma nova não parece o casulo. As medidas vêm do torso e da mochila do blueprint, então
 * valem para todo chassi. Devolve o nó da boca (no referencial do torso): de onde o lançamento desenhado sobe.
 */
function buildBackMortar(
  root: THREE.Object3D,
  bp: MechBlueprint,
  M: { armor: THREE.Material; frame: THREE.Material; rocket: THREE.Material },
): THREE.Object3D {
  const { width: tw, height: th, depth: td } = bp.torso;
  const depth = bp.backPack.depth;
  const baseY = th * 0.97; // o topo da mochila
  const zc = td * 0.78; // o centro da mochila (+Z = costas)
  const plate = th * 0.08;
  const radius = tw * 0.08;
  const length = th * 0.4;
  const y0 = baseY + plate;
  box(root, tw * 0.5, plate, depth * 1.1, M.frame, 0, baseY + plate / 2, zc);
  box(root, tw * 0.46, length * 0.8, depth * 0.1, M.frame, 0, y0 + length * 0.4, zc + depth * 0.6);
  for (const x of [-tw * 0.11, tw * 0.11]) {
    for (const z of [zc - depth * 0.28, zc + depth * 0.28]) {
      cyl(root, radius, length, M.armor, x, y0 + length / 2, z); // o tubo, claro: contra a mochila escura ele se lê
      cyl(root, radius * 1.3, th * 0.05, M.frame, x, y0 + length, z); // aro escuro na boca
      cyl(root, radius * 0.85, th * 0.05, M.rocket, x, y0 + length + th * 0.035, z); // brilho da carga
    }
  }
  const mouth = group(root, 0, y0 + length + th * 0.08, zc);
  mouth.name = 'boca-chuva';
  return mouth;
}
