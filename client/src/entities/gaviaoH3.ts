import * as THREE from 'three';
import desenhoSalvo from './desenhoGaviao.json';
import { box, casca, cupula, cyl, joelheira, ombreira, perigo, placa } from './kitCasco';
import { registrarCorpo, type CorpoDoRig, type MechBlueprint } from './mechBlueprint';

/**
 * O GAVIÃO-H3 (P323), o primeiro robô da geração 3: um humanoide esguio de placas chanfradas em grafite, com acentos pequenos na cor da pintura, visor aceso,
 * ombreiras de placas sobrepostas, joelheiras e botas grossas (a referência é o print 4 do Comandante, 07/11). É o corpo de blueprint de sempre
 * (`mechBlueprint.ts`, a mesma tomada de armas, calor, gelo e dash), com as peças trocadas pelo kit de casco (`kitCasco.ts`) e o tornozelo (`MechRig.setFootPitch`).
 *
 * **O padrão do corpo da geração 3** (ordem do Comandante, 07/11; `corpoGen3.contrato.test.ts` o trava): (1) **sem vão** entre o tronco e as pernas, em qualquer
 * pose: o núcleo escuro do abdômen desce para dentro do cinto da pelve, e o topo do cinto chega ao pivô do tronco; (2) a sola pisa o chão; (3) a ombreira é de
 * placas anguladas, não uma bola; (4) o acento é pequeno e raro; (5) o orçamento de malhas e triângulos.
 *
 * Só entra no pedaço sob demanda da geração 3: quem importa este arquivo registra o corpo (`registrarCorpo`); o pacote de partida não o carrega.
 * Custo: nenhum triângulo a mais por quadro; ~10 malhas (um pivô, uma malha), como todo Mech de código.
 */

/** Os números de desenho do Gavião-H3: o painel DESENHO do Estúdio os edita, e `desenhoGaviao.json` guarda os salvos. Cada um é um multiplicador de 1 (o desenho de fábrica). */
export interface DesenhoDoGaviao {
  /** O tamanho da ombreira. */
  ombreira: number;
  /** A queda da tampa da ombreira para fora (rad). */
  inclinacao: number;
  /** A largura do peito (os braços acompanham). */
  peito: number;
  /** A largura do abdômen. */
  cintura: number;
  /** A largura da pelve. */
  quadril: number;
  /** A grossura da coxa. */
  coxa: number;
  /** A grossura da canela. */
  canela: number;
  /** O tamanho da cabeça. */
  cabeca: number;
  /** O comprimento da bota. */
  bota: number;
  /** O tamanho dos riscos de perigo (0 os apaga). */
  acentos: number;
}

/** O desenho de projeto: o que o código entrega antes de o Comandante mexer (o botão PADRÃO DE PROJETO do painel volta a ele). */
export const DESENHO_DE_PROJETO: DesenhoDoGaviao = { ombreira: 1, inclinacao: 0.18, peito: 1, cintura: 1, quadril: 1, coxa: 1, canela: 1, cabeca: 1, bota: 1, acentos: 1 };
/** O desenho salvo (o painel DESENHO do Estúdio grava `desenhoGaviao.json`): é o que o jogo constrói. */
export const DESENHO_SALVO: DesenhoDoGaviao = { ...DESENHO_DE_PROJETO, ...(desenhoSalvo as Partial<DesenhoDoGaviao>) };

/**
 * O blueprint do Gavião com os números de desenho dados (o corpo os lê de `estilo`). A perna não muda de comprimento: a passada da geração 3 não depende do desenho.
 * `extra` são chaves de montagem que não são desenho: `peitoDeFora`, `cabecaDeFora` e `ombreiraDeFora` (1) deixam essa peça do corpo de fora, para a peça do Blender ocupar o lugar
 * (a Prova Blender, P329: a aba MECHS 3D alterna entre o kit em código e o Blender no mesmo robô).
 */
export function blueprintDoGaviao(d: DesenhoDoGaviao = DESENHO_SALVO, extra: Readonly<Record<string, number>> = {}): MechBlueprint {
  return {
    id: 'gaviao',
    corpo: 'gaviao-h3',
    // Um aço de gunmetal claro: a luz da arena é fria e fraca (ambiente a 0,25), e um casco mais escuro que isto vira preto na tela do jogo (medido na prévia COMO NO JOGO).
    cores: { armor: 0x7d838b },
    estilo: { ...d, ...extra },
    referenceHeight: 4.7,
    // O tronco tem 1,4: o topo do peito (1,39) fica na linha do ombro (a junta a 1,18 mais a tampa da ombreira), e o queixo pousa nele.
    torso: { width: 1.16 * d.peito, height: 1.4, depth: 0.78 },
    head: { width: 0.56 * d.cabeca, height: 0.62 * d.cabeca, depth: 0.62 * d.cabeca, antenna: 0 },
    shoulders: { width: 0.62 * d.ombreira, height: 0.48 * d.ombreira, depth: 0.66 * d.ombreira },
    hips: { width: 0.74 * d.quadril, depth: 0.5 },
    legs: { hipWidth: 0.66, thighWidth: 0.5 * d.coxa, shinWidth: 0.42 * d.canela, upperLength: 1.05, lowerLength: 0.95, footLength: 1.05 * d.bota, digitigrade: 0 },
    arms: { mountX: 0.84 + (d.peito - 1) * 0.58, upperWidth: 0.34, upperLength: 0.62, forearmWidth: 0.34, forearmDepth: 0.74 },
    vents: { count: 2, width: 0.08, height: 0.26 },
    backPack: { width: 0.7, height: 0.7, depth: 0.34 },
  };
}

export const GAVIAO_H3_BLUEPRINT: MechBlueprint = blueprintDoGaviao();

const desenhoDe = (bp: MechBlueprint): DesenhoDoGaviao => ({ ...DESENHO_DE_PROJETO, ...(bp.estilo as Partial<DesenhoDoGaviao> | undefined) });

const marcaPe = (m: THREE.Mesh, lado: number): THREE.Mesh => {
  m.userData.mechFoot = lado;
  return m;
};

/**
 * As peças de cada pivô. As medidas saem do blueprint; as constantes são a espessura de uma placa (m). Referenciais: a pelve tem o zero no quadril; o tronco nasce a 0,3 acima
 * dele (o topo do cinto); a cabeça nasce a 1,75 do pivô do tronco, e a base do crânio fica a 0,25 abaixo dela.
 */
export const CORPO_GAVIAO_H3: CorpoDoRig = {
  pe: (bp, scale) => ({ ankleY: -bp.legs.lowerLength - 0.1 * scale, frente: bp.legs.footLength * 0.62, tras: bp.legs.footLength * 0.38, tornozelo: 0.1 * scale }),

  pelve(pelvis, bp, M) {
    const { width: hw, depth: hd } = bp.hips;
    // O núcleo escuro sobe até 0,32 e o cinto vai de 0,09 a 0,31: o topo do cinto é o pivô do tronco (0,3), e o abdômen desce para dentro dele. Nada de vão.
    box(pelvis, hw * 0.8, 0.56, hd * 0.84, M.frame, 0, 0.04, 0);
    placa(pelvis, hw * 1.14, 0.22, hd * 1.14, 0.045, M.armor, 0, 0.2, 0);
    placa(pelvis, 0.2, 0.2, 0.06, 0.02, M.frame, 0, 0.2, -hd * 0.57 - 0.02);
    for (const lado of [-1, 1]) {
      // As abas do quadril, abertas para fora, cobrem o alto da coxa.
      const aba = placa(pelvis, 0.12, 0.4, hd * 0.92, 0.035, M.armor, lado * (hw / 2 + 0.07), -0.12, 0);
      aba.rotation.z = -lado * 0.14;
    }
    const braguilha = placa(pelvis, hw * 0.4, 0.34, 0.08, 0.03, M.armor, 0, -0.14, -hd * 0.56);
    braguilha.rotation.x = 0.22;
    placa(pelvis, hw * 0.62, 0.3, 0.08, 0.03, M.armor, 0, -0.08, hd * 0.56);
  },

  coxa(hip, lado, bp, M) {
    const d = desenhoDe(bp);
    const L = bp.legs.upperLength;
    const W = bp.legs.thighWidth;
    cupula(hip, W * 0.4, W * 0.4, W * 0.4, M.frame, 0, 0, 0);
    cyl(hip, W * 0.26, L * 0.94, M.frame, 0, -L * 0.48, 0);
    casca(hip, [{ y: -0.14, w: W * 0.98, d: W * 0.9 }, { y: -L * 0.45, w: W, d: W * 0.92 }, { y: -L * 0.94, w: W * 0.76, d: W * 0.76 }], 0.06, M.armor, 0, 0, -0.01);
    // A placa de fora, mais comprida, e a faixa escura da frente que parte a coxa em duas.
    placa(hip, 0.08, L * 0.52, W * 0.78, 0.028, M.armor, lado * (W * 0.5 + 0.03), -L * 0.4, 0);
    box(hip, W * 0.1, L * 0.5, 0.04, M.frame, 0, -L * 0.5, -W * 0.47);
    if (d.acentos > 0.05) perigo(hip, lado * (W * 0.5 + 0.075), -L * 0.28, 0, M.paint, 0.85 * d.acentos, 3, 0.62, (lado * Math.PI) / 2);
  },

  canela(knee, lado, bp, M, scale) {
    const d = desenhoDe(bp);
    const Lc = bp.legs.lowerLength;
    const W = bp.legs.shinWidth;
    const F = bp.legs.footLength;
    const yA = -Lc - 0.1 * scale;
    const pino = cyl(knee, W * 0.34, W * 1.15, M.frame, 0, 0, 0);
    pino.rotation.z = Math.PI / 2;
    joelheira(knee, W, M, 0, 0.02, -W * 0.5);
    casca(knee, [{ y: -0.12, w: W * 0.9, d: W * 0.88 }, { y: -Lc * 0.38, w: W, d: W * 1.02, oz: W * 0.06 }, { y: -Lc * 0.93, w: W * 0.7, d: W * 0.7 }], 0.05, M.armor, 0, 0, 0);
    // A panturrilha (atrás) e a espinheira escura (na frente).
    placa(knee, W * 0.8, Lc * 0.42, 0.13, 0.04, M.armor, 0, -Lc * 0.36, W * 0.5);
    placa(knee, W * 0.5, Lc * 0.5, 0.07, 0.025, M.frame, 0, -Lc * 0.5, -W * 0.5);
    if (d.acentos > 0.05) perigo(knee, 0, -Lc * 0.62, -W * 0.5 - 0.045, M.paint, 0.8 * d.acentos, 3, 0.62);
    // A junta do tornozelo (escura, fica na canela) e o cano da bota (não gira); o pé, abaixo, gira no tornozelo.
    const junta = cyl(knee, W * 0.28, W * 1.0, M.frame, 0, yA + 0.17 * scale, 0);
    junta.rotation.z = Math.PI / 2;
    placa(knee, W * 1.08, 0.26 * scale, W * 1.04, 0.045, M.armor, 0, yA + 0.2 * scale, 0.04);
    // O pé: a sola escura (do chão ao eixo), o cabedal na cor do casco, o calcanhar e a biqueira escuros e mais altos, e um risco de perigo no peito do pé.
    marcaPe(placa(knee, W * 1.25, 0.1 * scale, F, 0.03, M.frame, 0, yA - 0.05 * scale, -F * 0.12), lado);
    marcaPe(placa(knee, W * 1.15, 0.12 * scale, F * 0.92, 0.04, M.armor, 0, yA + 0.06 * scale, -F * 0.12 - 0.02), lado);
    marcaPe(placa(knee, W * 1.15, 0.16 * scale, F * 0.26, 0.05, M.frame, 0, yA + 0.02 * scale, -F * 0.12 - F * 0.5 + F * 0.13), lado);
    marcaPe(placa(knee, W * 1.1, 0.2 * scale, F * 0.16, 0.04, M.frame, 0, yA + 0.04 * scale, -F * 0.12 + F * 0.5 - F * 0.08), lado);
    if (d.acentos > 0.05) {
      for (const m of perigo(knee, 0, yA + 0.12 * scale + 0.012, -F * 0.12 - F * 0.1, M.paint, 0.9 * d.acentos, 3, 0.62)) {
        m.rotation.set(Math.PI / 2, 0, 0.62);
        marcaPe(m, lado);
      }
    }
  },

  torso(torso, bp, M, scale) {
    const d = desenhoDe(bp);
    const tw = bp.torso.width;
    const th = bp.torso.height;
    const td = bp.torso.depth;
    const topo = th * 0.99; // o topo do peito: a linha do ombro
    const yOmbro = th * 0.84; // a junta do ombro (o rig põe os braços aqui)
    // O abdômen: o núcleo escuro desce para dentro do cinto da pelve, e as costelas se empilham por cima. Sem vão em nenhuma pose do tronco.
    box(torso, tw * 0.46 * d.cintura, 0.7, td * 0.5, M.frame, 0, 0.15, 0);
    for (let i = 0; i < 4; i++) placa(torso, tw * 0.52 * d.cintura, 0.08, td * 0.58, 0.02, M.armor, 0, 0.06 + 0.11 * i, 0);
    // O peito (o diafragma, o casco, as placas peitorais, o esterno, a gola, o pescoço e a placa das costas): `peitoDeFora` o deixa de fora para a peça do Blender ocupar o lugar (P329).
    const peito = (bp.estilo?.peitoDeFora ?? 0) <= 0;
    if (peito) {
      placa(torso, tw * 0.8, 0.17, td * 0.7, 0.04, M.armor, 0, 0.535, -td * 0.02);
      // O casco do peito.
      casca(torso, [{ y: 0.6, w: tw * 0.74, d: td * 0.72 }, { y: 0.98, w: tw * 1.0, d: td * 0.92 }, { y: topo, w: tw * 1.02, d: td * 0.78 }], 0.09, M.armor, 0, 0, -td * 0.02);
    }
    for (const lado of [-1, 1]) {
      if (peito) {
        // As duas placas peitorais abertas em V e a gola que desce para os ombros.
        const peitoral = placa(torso, tw * 0.4, 0.42, 0.12, 0.04, M.armor, lado * tw * 0.22, 1.02, -td * 0.47);
        peitoral.rotation.set(0.2, -lado * 0.22, 0);
        const gola = placa(torso, 0.3, 0.2, 0.3, 0.04, M.armor, lado * 0.36, topo - 0.02, 0);
        gola.rotation.z = -lado * 0.45;
      }
      // O eixo escuro do ombro, entre o peito e a junta do braço.
      const eixo = cyl(torso, 0.14, 0.5, M.frame, lado * (bp.arms.mountX - 0.12), yOmbro, 0);
      eixo.rotation.z = Math.PI / 2;
      if (peito && d.acentos > 0.05) perigo(torso, lado * tw * 0.3, 0.86, -td * 0.47 - 0.07, M.paint, 0.8 * d.acentos, 3, 0.62 * lado);
    }
    if (peito) {
      // A crista do esterno e o pescoço.
      box(torso, 0.1, 0.62, 0.05, M.frame, 0, 0.98, -td * 0.47 - 0.065);
      cyl(torso, 0.17, 0.3, M.frame, 0, topo + 0.06, -0.03);
    }
    // A mochila fina nas costas (com a placa de trás), os respiros (acendem com o calor) e os dois propulsores (a chama do dash).
    const pack = bp.backPack;
    if (peito) placa(torso, tw * 0.82, 0.8, 0.08, 0.04, M.armor, 0, 0.98, td * 0.5);
    placa(torso, pack.width, pack.height, pack.depth, 0.05, M.frame, 0, th * 0.66, td * 0.78);
    for (const lado of [-1, 1]) {
      for (let i = 0; i < bp.vents.count; i++) box(torso, bp.vents.width, bp.vents.height / bp.vents.count, 0.05 * scale, M.rocket, lado * pack.width * 0.3, th * (0.5 + i * 0.2), td * 0.78 + pack.depth / 2 + 0.02);
      cyl(torso, pack.width * 0.19, pack.depth * 0.9, M.frame, lado * pack.width * 0.32, th * 0.48, td * 0.74);
      cyl(torso, pack.width * 0.15, 0.12 * scale, M.thruster, lado * pack.width * 0.32, th * 0.48, td * 1.12);
    }
  },

  cabeca(head, bp, M) {
    if ((bp.estilo?.cabecaDeFora ?? 0) > 0) return; // o capacete é a peça do Blender (P329)
    const { width: hw, height: hh, depth: hd } = bp.head;
    // O pivô da cabeça fica a 1,75 do tronco; o queixo tem de pousar na linha do ombro (1,39): a base do crânio desce 0,25 do pivô.
    const y0 = -0.25;
    casca(head, [{ y: y0 + 0.02, w: hw * 0.78, d: hd * 0.8 }, { y: y0 + hh * 0.4, w: hw, d: hd }, { y: y0 + hh * 0.78, w: hw * 0.9, d: hd * 0.9, oz: hd * 0.02 }, { y: y0 + hh * 0.97, w: hw * 0.56, d: hd * 0.66, oz: hd * 0.04 }], 0.07, M.armor, 0, 0, 0);
    // A máscara escura, o visor (a faixa que acende), o queixo e as bochechas.
    placa(head, hw * 0.84, hh * 0.44, 0.08, 0.03, M.frame, 0, y0 + hh * 0.46, -hd * 0.5);
    box(head, hw * 0.5, hh * 0.055, 0.05, M.visor, 0, y0 + hh * 0.5, -hd * 0.55);
    const queixo = placa(head, hw * 0.56, hh * 0.2, hd * 0.34, 0.03, M.armor, 0, y0 + hh * 0.1, -hd * 0.3);
    queixo.rotation.x = -0.15;
    for (const lado of [-1, 1]) placa(head, 0.09, hh * 0.46, hd * 0.56, 0.03, M.armor, lado * hw * 0.5, y0 + hh * 0.42, 0.04);
    placa(head, hw * 0.16, 0.06, hd * 0.8, 0.02, M.frame, 0, y0 + hh * 1.0, 0);
  },

  braco(g, lado, ehEsquerdo, semCasulo, bp, M, scale) {
    const d = desenhoDe(bp);
    const ar = bp.arms;
    const yAntebraco = -ar.upperLength * 1.5;
    if ((bp.estilo?.ombreiraDeFora ?? 0) <= 0) ombreira(g, lado, d.ombreira, d.inclinacao, M, d.acentos); // `ombreiraDeFora`: a ombreira é a peça do Blender (P329)
    casca(g, [{ y: -0.1, w: ar.upperWidth * 1.1, d: ar.upperWidth * 1.1 }, { y: -ar.upperLength * 1.1, w: ar.upperWidth * 0.85, d: ar.upperWidth * 0.85 }], 0.04, M.armor, 0, 0, 0);
    cyl(g, ar.upperWidth * 0.28, ar.upperLength * 1.2, M.frame, 0, -ar.upperLength * 0.6, 0);
    cupula(g, ar.upperWidth * 0.7, ar.upperWidth * 0.7, ar.upperWidth * 0.7, M.frame, 0, -ar.upperLength * 1.42, 0);
    // A manga do braço (a placa de fora) e a cotoveleira.
    placa(g, 0.08, ar.upperLength * 0.75, ar.upperWidth * 0.95, 0.025, M.armor, lado * (ar.upperWidth * 0.5 + 0.03), -ar.upperLength * 0.78, 0);
    const cotoveleira = placa(g, ar.upperWidth * 0.9, 0.16, 0.2, 0.03, M.armor, 0, -ar.upperLength * 1.42, 0.2);
    cotoveleira.rotation.x = 0.3;
    // O antebraço aponta para a frente (a arma sai dele): a casca é feita ao longo de +Y e deitada.
    casca(g, [{ y: 0, w: ar.forearmWidth * 0.85, d: ar.forearmWidth * 0.9 }, { y: ar.forearmDepth * 0.55, w: ar.forearmWidth * 1.1, d: ar.forearmWidth * 1.15 }, { y: ar.forearmDepth, w: ar.forearmWidth * 0.8, d: ar.forearmWidth * 0.8 }], 0.04, M.armor, 0, yAntebraco, ar.forearmDepth * 0.25, -Math.PI / 2);
    placa(g, ar.forearmWidth * 0.95, ar.forearmWidth * 0.95, ar.forearmDepth * 0.34, 0.05, M.frame, 0, yAntebraco, -ar.forearmDepth * 0.9);
    if (d.acentos > 0.05) perigo(g, 0, yAntebraco + ar.forearmWidth * 0.58 + 0.01, -ar.forearmDepth * 0.25, M.paint, 0.9 * d.acentos, 3, 0.62).forEach((m) => m.rotation.set(Math.PI / 2, 0, 0.62));
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
      cyl(g, ar.forearmWidth * 0.14, 0.1 * scale, M.visor, 0, yAntebraco, -ar.forearmDepth * 1.16, Math.PI / 2);
    }
  },
};

registrarCorpo('gaviao-h3', CORPO_GAVIAO_H3);
