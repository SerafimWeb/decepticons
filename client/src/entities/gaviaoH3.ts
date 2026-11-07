import * as THREE from 'three';
import { box, casca, cupula, cyl, placa } from './kitCasco';
import { registrarCorpo, type CorpoDoRig, type MechBlueprint } from './mechBlueprint';

/**
 * O GAVIÃO-H3 (P323), o primeiro robô da geração 3: um humanoide esguio de placas chanfradas em grafite, com acentos na cor da pintura, visor aceso,
 * ombreiras redondas, joelheiras e botas grossas (a referência é o print 4 do Comandante, 07/11). É o corpo de blueprint de sempre (`mechBlueprint.ts`,
 * a mesma tomada de armas, calor, gelo e dash), com as peças trocadas pelo kit de casco (`kitCasco.ts`) e o tornozelo (`MechRig.setFootPitch`).
 *
 * Só entra no pedaço sob demanda da geração 3: quem importa este arquivo registra o corpo (`registrarCorpo`); o pacote de partida não o carrega.
 * Custo: nenhum triângulo a mais por quadro; ~10 malhas (um pivô, uma malha), como todo Mech de código.
 */
export const GAVIAO_H3_BLUEPRINT: MechBlueprint = {
  id: 'gaviao',
  corpo: 'gaviao-h3',
  // Um cinza-grafite médio: o aço de fábrica lê mais claro e mais frio, e sem mapa de ambiente um casco mais escuro que isto vira preto na tela.
  cores: { armor: 0x70767e },
  referenceHeight: 4.7,
  torso: { width: 1.16, height: 1.2, depth: 0.78 },
  head: { width: 0.56, height: 0.62, depth: 0.62, antenna: 0 },
  shoulders: { width: 0.62, height: 0.48, depth: 0.66 },
  hips: { width: 0.74, depth: 0.5 },
  legs: { hipWidth: 0.66, thighWidth: 0.5, shinWidth: 0.42, upperLength: 1.05, lowerLength: 0.95, footLength: 1.05, digitigrade: 0 },
  arms: { mountX: 0.84, upperWidth: 0.34, upperLength: 0.62, forearmWidth: 0.34, forearmDepth: 0.74 },
  vents: { count: 2, width: 0.08, height: 0.26 },
  backPack: { width: 0.7, height: 0.7, depth: 0.34 },
};

const marcaPe = (m: THREE.Mesh, lado: number): THREE.Mesh => {
  m.userData.mechFoot = lado;
  return m;
};

/** As peças de cada pivô. As medidas saem do blueprint; as constantes são a espessura de uma placa (m). */
export const CORPO_GAVIAO_H3: CorpoDoRig = {
  pe: (bp, scale) => ({ ankleY: -bp.legs.lowerLength - 0.1 * scale, frente: bp.legs.footLength * 0.62, tras: bp.legs.footLength * 0.38, tornozelo: 0.1 * scale }),

  pelve(pelvis, bp, M) {
    const { hips } = bp;
    placa(pelvis, hips.width, 0.3, hips.depth, 0.05, M.frame, 0, 0, 0);
    placa(pelvis, hips.width * 0.5, 0.26, 0.07, 0.03, M.armor, 0, -0.05, -hips.depth / 2 - 0.02);
    for (const lado of [-1, 1]) placa(pelvis, 0.1, 0.28, hips.depth * 0.85, 0.03, M.armor, lado * (hips.width / 2 + 0.02), -0.04, 0);
    box(pelvis, hips.width * 1.04, 0.045, hips.depth * 1.06, M.paint, 0, 0.14, 0);
  },

  coxa(hip, lado, bp, M) {
    const L = bp.legs.upperLength;
    const W = bp.legs.thighWidth;
    cyl(hip, W * 0.28, L * 0.92, M.frame, 0, -L * 0.48, 0);
    casca(hip, [{ y: -0.1, w: W * 0.95, d: W * 0.9 }, { y: -L * 0.5, w: W * 0.9, d: W * 0.86 }, { y: -L * 0.93, w: W * 0.7, d: W * 0.7 }], 0.05, M.armor, 0, 0, -0.02);
    box(hip, 0.045, L * 0.5, W * 0.4, M.paint, lado * W * 0.5, -L * 0.5, -0.02);
    cupula(hip, W * 0.42, W * 0.42, W * 0.42, M.frame, 0, 0, 0);
  },

  canela(knee, lado, bp, M, scale) {
    const Lc = bp.legs.lowerLength;
    const W = bp.legs.shinWidth;
    const F = bp.legs.footLength;
    const yA = -Lc - 0.1 * scale;
    const pino = cyl(knee, W * 0.34, W * 1.2, M.frame, 0, 0, 0);
    pino.rotation.z = Math.PI / 2;
    cupula(knee, W * 0.62, W * 0.5, W * 0.55, M.armor, 0, 0.02, -W * 0.38, { ate: Math.PI * 0.6, rotX: -Math.PI / 2 });
    casca(knee, [{ y: -0.1, w: W * 0.9, d: W * 0.9 }, { y: -Lc * 0.4, w: W, d: W * 1.05, oz: W * 0.08 }, { y: -Lc * 0.95, w: W * 0.7, d: W * 0.7 }], 0.05, M.armor, 0, 0, 0);
    box(knee, W * 0.14, Lc * 0.55, 0.04, M.paint, 0, -Lc * 0.5, -W * 0.52);
    // O cano da bota sobe pela canela (não gira); o pé (o corpo da bota, a biqueira e a faixa) gira no tornozelo.
    placa(knee, W * 1.1, 0.3 * scale, W * 1.05, 0.05, M.armor, 0, yA + 0.2 * scale, 0.06);
    // O pé: a sola escura (do chão ao eixo), o cabedal na cor do casco, a biqueira escura e mais alta e a faixa de acento no peito do pé.
    marcaPe(placa(knee, W * 1.25, 0.1 * scale, F, 0.03, M.frame, 0, yA - 0.05 * scale, -F * 0.12), lado);
    marcaPe(placa(knee, W * 1.15, 0.12 * scale, F * 0.92, 0.04, M.armor, 0, yA + 0.06 * scale, -F * 0.12 - 0.02), lado);
    marcaPe(placa(knee, W * 1.15, 0.16 * scale, F * 0.26, 0.05, M.frame, 0, yA + 0.02 * scale, -F * 0.12 - F * 0.5 + F * 0.13), lado);
    marcaPe(box(knee, W * 0.9, 0.03 * scale, F * 0.46, M.paint, 0, yA + 0.12 * scale + 0.012, -F * 0.12 - F * 0.1), lado);
  },

  torso(torso, bp, M, scale) {
    const tw = bp.torso.width;
    const th = bp.torso.height;
    const td = bp.torso.depth;
    box(torso, tw * 0.5, th * 0.45, td * 0.5, M.frame, 0, th * 0.25, 0);
    for (let i = 0; i < 3; i++) placa(torso, tw * (0.46 + 0.03 * i), th * 0.1, td * 0.55, 0.03, M.armor, 0, th * (0.1 + 0.14 * i), -td * 0.03);
    casca(torso, [{ y: th * 0.46, w: tw * 0.62, d: td * 0.72 }, { y: th * 0.8, w: tw * 0.92, d: td * 0.9 }, { y: th * 1.2, w: tw * 0.98, d: td * 0.8 }], 0.09, M.armor, 0, 0, -td * 0.02);
    box(torso, 0.05, th * 0.5, 0.04, M.frame, 0, th * 0.8, -td * 0.45);
    for (const lado of [-1, 1]) box(torso, tw * 0.3, 0.04 * scale, 0.04, M.paint, lado * tw * 0.22, th * 0.62, -td * 0.46);
    box(torso, tw * 0.16, 0.06 * scale, 0.04, M.visor, 0, th * 0.7, -td * 0.47);
    cyl(torso, 0.2, 0.22, M.frame, 0, th * 1.25, 0);
    // A mochila fina, os respiros (acendem com o calor) e os dois propulsores (a chama do dash).
    const pack = bp.backPack;
    placa(torso, pack.width, pack.height, pack.depth, 0.05, M.frame, 0, th * 0.66, td * 0.78);
    for (const lado of [-1, 1]) {
      for (let i = 0; i < bp.vents.count; i++) box(torso, bp.vents.width, bp.vents.height / bp.vents.count, 0.05 * scale, M.rocket, lado * pack.width * 0.3, th * (0.5 + i * 0.2), td * 0.78 + pack.depth / 2 + 0.02);
      cyl(torso, pack.width * 0.19, pack.depth * 0.9, M.frame, lado * pack.width * 0.32, th * 0.48, td * 0.74);
      cyl(torso, pack.width * 0.15, 0.12 * scale, M.thruster, lado * pack.width * 0.32, th * 0.48, td * 1.12);
    }
  },

  cabeca(head, bp, M) {
    const { width: hw, height: hh, depth: hd } = bp.head;
    casca(head, [{ y: 0.02, w: hw * 0.78, d: hd * 0.8 }, { y: hh * 0.45, w: hw, d: hd }, { y: hh * 0.95, w: hw * 0.74, d: hd * 0.8, oz: hd * 0.03 }], 0.07, M.armor, 0, 0, 0);
    placa(head, hw * 0.9, hh * 0.18, 0.06, 0.02, M.frame, 0, hh * 0.52, -hd * 0.5);
    box(head, hw * 0.78, hh * 0.1, 0.05, M.visor, 0, hh * 0.52, -hd * 0.52);
    placa(head, hw * 0.62, hh * 0.26, hd * 0.4, 0.03, M.frame, 0, hh * 0.12, -hd * 0.22);
    box(head, hw * 0.16, hh * 0.06, hd * 0.7, M.paint, 0, hh * 0.99, 0);
    for (const lado of [-1, 1]) {
      const orelha = cyl(head, hh * 0.17, hw * 0.18, M.frame, lado * hw * 0.54, hh * 0.48, hd * 0.05);
      orelha.rotation.z = Math.PI / 2;
    }
  },

  braco(g, lado, ehEsquerdo, semCasulo, bp, M, scale) {
    const sh = bp.shoulders;
    const ar = bp.arms;
    const yAntebraco = -ar.upperLength * 1.5;
    cupula(g, sh.width * 0.62, sh.height * 0.7, sh.depth * 0.62, M.armor, lado * 0.04, 0.02, 0, { ate: Math.PI * 0.62, rotZ: -lado * 0.2 });
    box(g, sh.width * 0.5, 0.045, sh.depth * 0.9, M.paint, lado * 0.06, sh.height * 0.34, 0).rotation.z = -lado * 0.2;
    cupula(g, 0.16, 0.16, 0.16, M.frame, 0, -0.05, 0);
    casca(g, [{ y: -0.1, w: ar.upperWidth * 1.1, d: ar.upperWidth * 1.1 }, { y: -ar.upperLength * 1.1, w: ar.upperWidth * 0.85, d: ar.upperWidth * 0.85 }], 0.04, M.armor, 0, 0, 0);
    cyl(g, ar.upperWidth * 0.28, ar.upperLength * 1.2, M.frame, 0, -ar.upperLength * 0.6, 0);
    cupula(g, ar.upperWidth * 0.7, ar.upperWidth * 0.7, ar.upperWidth * 0.7, M.frame, 0, -ar.upperLength * 1.42, 0);
    // O antebraço aponta para a frente (a arma sai dele): a casca é feita ao longo de +Y e deitada.
    casca(g, [{ y: 0, w: ar.forearmWidth * 0.85, d: ar.forearmWidth * 0.9 }, { y: ar.forearmDepth * 0.55, w: ar.forearmWidth * 1.1, d: ar.forearmWidth * 1.15 }, { y: ar.forearmDepth, w: ar.forearmWidth * 0.8, d: ar.forearmWidth * 0.8 }], 0.04, M.armor, 0, yAntebraco, ar.forearmDepth * 0.25, -Math.PI / 2);
    placa(g, ar.forearmWidth * 0.95, ar.forearmWidth * 0.95, ar.forearmDepth * 0.34, 0.05, M.frame, 0, yAntebraco, -ar.forearmDepth * 0.9);
    box(g, ar.forearmWidth * 0.5, 0.04, ar.forearmDepth * 0.35, M.paint, 0, yAntebraco + ar.forearmWidth * 0.58, -ar.forearmDepth * 0.25);
    if (semCasulo) return; // o antebraço liso: a arma da montagem (ou a chuva de mísseis nas costas) ocupa o lugar
    if (ehEsquerdo) {
      for (let linha = 0; linha < 2; linha++) {
        for (let coluna = 0; coluna < 2; coluna++) {
          const cx = (coluna - 0.5) * ar.forearmWidth * 0.42;
          const cy = yAntebraco + (linha - 0.5) * ar.forearmWidth * 0.38;
          cyl(g, ar.forearmWidth * 0.11, 0.18 * scale, M.rocket, cx, cy, -ar.forearmDepth * 0.62, Math.PI / 2);
        }
      }
    } else {
      cyl(g, ar.forearmWidth * 0.2, ar.forearmDepth * 1.1, M.frame, 0, yAntebraco, -ar.forearmDepth * 0.64, Math.PI / 2);
      cyl(g, ar.forearmWidth * 0.24, 0.12 * scale, M.visor, 0, yAntebraco, -ar.forearmDepth * 1.16, Math.PI / 2);
    }
  },
};

registrarCorpo('gaviao-h3', CORPO_GAVIAO_H3);
