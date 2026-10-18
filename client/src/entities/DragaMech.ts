import * as THREE from 'three';
import { pernasCaidas, type PernasCaidas } from '../sim/DragaMarcha';
import { MechBase, type MechRig, type MechStats } from './MechBase';
import type { LegId } from './walkerGait';

/**
 * O que o corpo do Draga precisa do desenho (o `WalkerVisual` satisfaz): a raiz do modelo (pés em y = 0, frente em -Z), a queda de cada uma das quatro pernas, o giro do convés e o passo.
 * É uma **interface** de propósito: a simulação (e o servidor, e os testes) não carrega o arquivo `.glb` nem o Three do desenho; quem quer ver o Draga passa um visual, quem não quer passa `null`.
 */
export interface VisualDoDraga {
  readonly root: THREE.Object3D;
  readonly collapse: Record<LegId, number>;
  deckYaw: number;
  update(dt: number, speedMs: number, maxSpeedMs?: number): void;
}

/** O `MechBase` pede um rig de bípede (tronco, cabeça, dois braços, duas pernas): o do Draga é de nós **vazios** que a animação procedural mexe à toa, e o desenho de verdade (quatro pernas) é o `visual`. */
function rigDoDraga(visual: VisualDoDraga | null): MechRig {
  const no = (nome: string): THREE.Object3D => {
    const o = new THREE.Object3D();
    o.name = nome;
    return o;
  };
  const model = new THREE.Group();
  if (visual) model.add(visual.root);
  const perna = (lado: string) => ({ hip: no(`${lado}-quadril`), knee: no(`${lado}-joelho`) });
  return {
    model,
    pelvis: no('pelve'),
    torso: no('tronco'),
    head: no('cabeca'),
    leftArm: no('braco-esq'),
    rightArm: no('braco-dir'),
    leftLeg: perna('esq'),
    rightLeg: perna('dir'),
    muzzle: no('boca'),
    thrusters: [],
    thrusterMaterial: new THREE.MeshStandardMaterial(),
    hullMaterials: [],
    hipHeight: 0,
  };
}

/**
 * O **corpo do Draga-01** na partida (P180, parte C): um `MechBase` como o Colossus (cápsula cinemática, character controller, dano por parte, calor), que anda pelo leito do rio
 * guiado pelo `DragaController`. **A regra é toda do `MechBase`** (os módulos de perna viram velocidade, `crawls` o faz rastejar); o que é do Draga é só o **desenho**: a cada quadro as
 * quatro pernas caem conforme a vida dos dois módulos (`pernasCaidas`), o convés gira para onde ele mira e o passo anda com a velocidade de verdade.
 */
export class DragaMech extends MechBase {
  /** O desenho (nulo no servidor e nos testes de regra). */
  private readonly visual: VisualDoDraga | null;
  private readonly caidas: PernasCaidas = { fl: 0, fr: 0, rl: 0, rr: 0 };
  /** Para onde o convés mira (yaw absoluto, como o de `MechBase.yaw`): o cérebro escreve, o desenho lê. */
  deckAim = 0;

  constructor(stats: MechStats, visual: VisualDoDraga | null = null) {
    super(stats, rigDoDraga(visual));
    this.visual = visual;
    this.crawls = true; // as duas pernas caídas não o deixam imóvel: ele rasteja a 30% (a fase "rasteja" do chefe)
  }

  /** A queda de cada perna agora (0 de pé, 1 caída): o que o desenho mostra. Só leitura (testes). */
  get pernas(): Readonly<PernasCaidas> {
    const m = this.modules;
    const max = this.stats.maxModuleHealth;
    return pernasCaidas(m.leftLeg / max.leftLeg, m.rightLeg / max.rightLeg, this.caidas);
  }

  override render(dt: number, alpha: number): void {
    super.render(dt, alpha);
    const v = this.visual;
    if (!v || !this.alive) return;
    const p = this.pernas;
    v.collapse.fl = p.fl;
    v.collapse.fr = p.fr;
    v.collapse.rl = p.rl;
    v.collapse.rr = p.rr;
    // O convés gira em relação ao casco: o casco olha para onde anda (`yaw`), o convés para onde mira, pelo caminho curto.
    let d = this.deckAim - this.yaw;
    d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI;
    v.deckYaw = d;
    v.update(dt, Math.hypot(this.velocity.x, this.velocity.z));
  }
}
