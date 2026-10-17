import { readFileSync, statSync } from 'node:fs';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { LEG_IDS, WALKER_HEIGHT_M, WALKER_SCALE, newWalkerPose, type LegId } from './walkerGait';
import { parseWalkerGlb, WALKER_BONES, WalkerVisual, type WalkerAsset } from './WalkerVisual';

/**
 * O teste do rig com o ARQUIVO REAL (`client/public/models/draga-01.glb`, feito por `scripts/blender/rig-walker.py`). Ele carrega em Node porque o arquivo não tem textura
 * (o `GLTFLoader` só pede o navegador para decodificar imagem): então dá para conferir os ossos, a convenção dos sentidos e o orçamento de custo sem abrir o Chrome.
 */
const CAMINHO = new URL('../../public/models/draga-01.glb', import.meta.url);

let asset: WalkerAsset;
beforeAll(async () => {
  const b = readFileSync(CAMINHO);
  asset = await parseWalkerGlb(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
});

const mundo = (v: WalkerVisual, id: LegId): THREE.Vector3 => v.footWorld(id, new THREE.Vector3());
const novo = (): WalkerVisual => {
  const v = new WalkerVisual(asset);
  v.root.updateMatrixWorld(true);
  return v;
};

describe('o arquivo do Draga-01 (P180): o contrato do script de Blender e o orçamento', () => {
  it('tem os 18 ossos, uma malha com pele, cor nos vértices e nenhuma textura', () => {
    const ossos = new Set<string>();
    let peles = 0;
    let malhas = 0;
    let comCor = 0;
    let triangulos = 0;
    asset.scene.traverse((o) => {
      if ((o as THREE.Bone).isBone) ossos.add(o.name);
      const m = o as THREE.SkinnedMesh;
      if (m.isMesh) {
        malhas++;
        if (m.isSkinnedMesh) peles++;
        if (m.geometry.getAttribute('color')) comCor++;
        triangulos += (m.geometry.index?.count ?? 0) / 3;
        expect((m.material as THREE.MeshStandardMaterial).map ?? null, 'sem textura: o download não cresce').toBeNull();
      }
    });
    expect(WALKER_BONES).toHaveLength(18);
    for (const nome of WALKER_BONES) expect(ossos.has(nome), nome).toBe(true);
    expect(ossos.size).toBe(18);
    expect([malhas, peles, comCor], 'uma malha só, com pele e com cor: um desenho').toEqual([1, 1, 1]);
    expect(triangulos).toBeGreaterThan(26_000);
    expect(triangulos, 'o orçamento do robô: ~27 mil triângulos').toBeLessThan(28_500);
  });

  it('pesa menos de 1,1 MB (o download de um robô: o Marauder tem 0,6 MB, o Colossus v4, 2,6 MB)', () => {
    expect(statSync(CAMINHO).size).toBeLessThan(1_100_000);
  });

  it('cada vértice tem um osso só, com peso 1 (pele rígida por parte: a junta não amassa)', () => {
    asset.scene.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isSkinnedMesh) return;
      const w = m.geometry.getAttribute('skinWeight');
      for (let i = 0; i < w.count; i++) {
        expect(w.getX(i), `vértice ${i}`).toBeCloseTo(1, 4);
        expect(w.getY(i) + w.getZ(i) + w.getW(i)).toBeCloseTo(0, 4);
      }
    });
  });
});

describe('o Draga-01 em pé (P180): 38 m, de frente para -Z, com os pés no chão', () => {
  it('mede 38 m de altura, com os pés em y = 0, e o centro de apoio dos quatro pés fica na origem', () => {
    const v = novo();
    const caixa = new THREE.Box3();
    v.root.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) caixa.union(new THREE.Box3().setFromObject(o, true));
    });
    expect(caixa.max.y - caixa.min.y).toBeCloseTo(WALKER_HEIGHT_M, 0);
    expect(caixa.min.y).toBeGreaterThan(-0.6);
    expect(caixa.min.y).toBeLessThan(0.6);
    const media = new THREE.Vector3();
    for (const id of LEG_IDS) media.add(mundo(v, id));
    media.divideScalar(4);
    expect(Math.abs(media.x)).toBeLessThan(0.5);
    expect(Math.abs(media.z)).toBeLessThan(0.5);
  });

  it('a frente é -Z e a esquerda é -X (a convenção do jogo): a dianteira esquerda fica à frente e à esquerda, a traseira direita atrás e à direita', () => {
    const v = novo();
    const fl = mundo(v, 'fl');
    const fr = mundo(v, 'fr');
    const rl = mundo(v, 'rl');
    const rr = mundo(v, 'rr');
    expect(fl.z).toBeLessThan(-5);
    expect(fr.z).toBeLessThan(-5);
    expect(rl.z).toBeGreaterThan(5);
    expect(rr.z).toBeGreaterThan(5);
    expect(fl.x).toBeLessThan(-5);
    expect(rl.x).toBeLessThan(-5);
    expect(fr.x).toBeGreaterThan(5);
    expect(rr.x).toBeGreaterThan(5);
  });

  it('o corpo tem 38 m de comprimento e 20 m de largura (o desenho do Comandante, na escala do tamanho 5)', () => {
    const v = novo();
    const caixa = new THREE.Box3().setFromObject(v.root, true);
    expect(caixa.max.z - caixa.min.z).toBeGreaterThan(34);
    expect(caixa.max.z - caixa.min.z).toBeLessThan(42);
    expect(caixa.max.x - caixa.min.x).toBeGreaterThan(17);
    expect(caixa.max.x - caixa.min.x).toBeLessThan(23);
    expect(WALKER_SCALE).toBeGreaterThan(38);
  });

  it('o radar fica à frente (na cabine) e a chaminé atrás: a frente do desenho é a frente do robô', () => {
    const v = novo();
    const radar = new THREE.Vector3();
    v.root.getObjectByName('radar')!.getWorldPosition(radar);
    expect(radar.z, 'o radar está na cabine, à frente').toBeLessThan(-3);
    const guindaste = new THREE.Vector3();
    v.root.getObjectByName('guindaste_esq')!.getWorldPosition(guindaste);
    expect(guindaste.z, 'os guindastes ficam atrás').toBeGreaterThan(3);
    expect(guindaste.x, 'o guindaste esquerdo fica à esquerda (-X)').toBeLessThan(0);
  });
});

describe('os sentidos da animação (P180): o que a marcha pura assume, medido no rig de verdade', () => {
  it('quadril positivo leva o pé para a frente (-Z), nas quatro pernas', () => {
    for (const id of LEG_IDS) {
      const v = novo();
      const antes = mundo(v, id);
      const pose = newWalkerPose();
      pose.legs[id].hip = 0.15;
      v.apply(pose);
      v.root.updateMatrixWorld(true);
      const depois = mundo(v, id);
      expect(depois.z - antes.z, id).toBeLessThan(-1);
    }
  });

  it('a dobra "lift" do joelho SOBE o pé (o sinal é medido na carga, perna a perna)', () => {
    for (const id of LEG_IDS) {
      const v = novo();
      const antes = mundo(v, id);
      const pose = newWalkerPose();
      pose.legs[id].lift = 0.5;
      v.apply(pose);
      v.root.updateMatrixWorld(true);
      expect(mundo(v, id).y - antes.y, `${id} levanta o pé`).toBeGreaterThan(0.5);
      expect(Math.abs(v.liftSignOf(id))).toBe(1);
    }
    // as pernas da frente e as de trás dobram para lados opostos (o joelho aponta para fora nas duas pontas)
    const v = novo();
    expect(v.liftSignOf('fl')).toBe(v.liftSignOf('fr'));
    expect(v.liftSignOf('rl')).toBe(v.liftSignOf('rr'));
    expect(v.liftSignOf('fl')).toBe(-v.liftSignOf('rl'));
  });

  it('o pé fica chato no chão mesmo com o quadril e o joelho girados (o tornozelo compensa)', () => {
    const v = novo();
    const id: LegId = 'fl';
    const q0 = v.root.getObjectByName(`${id}_pe`)!.getWorldQuaternion(new THREE.Quaternion());
    const pose = newWalkerPose();
    pose.legs[id].hip = 0.17;
    pose.legs[id].lift = 0.55;
    v.apply(pose);
    v.root.updateMatrixWorld(true);
    const q1 = v.root.getObjectByName(`${id}_pe`)!.getWorldQuaternion(new THREE.Quaternion());
    expect(q0.angleTo(q1)).toBeLessThan(1e-4);
  });

  it('o convés gira em torno da vertical: o radar dá meia-volta em torno do eixo do disco e a altura não muda', () => {
    const v = novo();
    const radar = v.root.getObjectByName('radar')!;
    const deck = v.root.getObjectByName('deck')!;
    const p0 = radar.getWorldPosition(new THREE.Vector3());
    const eixo = deck.getWorldPosition(new THREE.Vector3());
    const pose = newWalkerPose();
    pose.deckYaw = Math.PI;
    v.apply(pose);
    v.root.updateMatrixWorld(true);
    const p1 = radar.getWorldPosition(new THREE.Vector3());
    expect(p1.y).toBeCloseTo(p0.y, 3);
    // meia-volta em torno do eixo do disco: o ponto vai ao lado oposto dele
    expect(p1.x - eixo.x).toBeCloseTo(-(p0.x - eixo.x), 1);
    expect(p1.z - eixo.z).toBeCloseTo(-(p0.z - eixo.z), 1);
  });

  it('o radar gira no rig: o osso dele gira exatamente o ângulo pedido em torno da vertical, sem sair do lugar', () => {
    const v = novo();
    const radar = v.root.getObjectByName('radar')!;
    const q0 = radar.getWorldQuaternion(new THREE.Quaternion());
    const pose = newWalkerPose();
    pose.radar = 1.0;
    v.apply(pose);
    v.root.updateMatrixWorld(true);
    const q1 = radar.getWorldQuaternion(new THREE.Quaternion());
    expect(q0.angleTo(q1)).toBeCloseTo(1.0, 3);
    // o eixo é a vertical: o vetor para cima do osso não muda
    const cima0 = new THREE.Vector3(0, 1, 0).applyQuaternion(q0);
    const cima1 = new THREE.Vector3(0, 1, 0).applyQuaternion(q1);
    expect(cima0.distanceTo(cima1)).toBeLessThan(1e-6);
  });

  it('um arquivo sem um dos ossos é acusado com o nome dele (o contrato do script de rig)', async () => {
    const b = readFileSync(CAMINHO);
    const copia = Buffer.from(b);
    const jsonLen = copia.readUInt32LE(12);
    const json = copia.subarray(20, 20 + jsonLen).toString('utf8');
    expect(json).toContain('"fl_coxa"');
    const trocado = json.split('"fl_coxa"').join('"xx_coxa"'); // o mesmo tamanho: o pedaço de JSON não muda de comprimento
    expect(trocado.length).toBe(json.length);
    copia.write(trocado, 20, 'utf8');
    await expect(parseWalkerGlb(copia.buffer.slice(copia.byteOffset, copia.byteOffset + copia.byteLength))).rejects.toThrow(/fl_coxa/);
  });

  it('as pernas não se mexem com o convés, e o convés não se mexe com a passada (juntas independentes)', () => {
    const v = novo();
    const pe0 = mundo(v, 'fl');
    const pose = newWalkerPose();
    pose.deckYaw = 1.2;
    pose.radar = 2;
    pose.craneLeft = 0.3;
    v.apply(pose);
    v.root.updateMatrixWorld(true);
    expect(mundo(v, 'fl').distanceTo(pe0)).toBeLessThan(1e-4);
  });

  it('guindastes e radar giram em torno da vertical sem sair do lugar (a base fica)', () => {
    const v = novo();
    for (const nome of ['guindaste_esq', 'guindaste_dir', 'radar']) {
      const osso = v.root.getObjectByName(nome)!;
      const p0 = osso.getWorldPosition(new THREE.Vector3());
      const pose = newWalkerPose();
      pose.craneLeft = 0.4;
      pose.craneRight = -0.4;
      pose.radar = 3;
      v.apply(pose);
      v.root.updateMatrixWorld(true);
      expect(osso.getWorldPosition(new THREE.Vector3()).distanceTo(p0), nome).toBeLessThan(1e-3);
    }
  });
});

describe('o Draga andando (P180)', () => {
  it('em passo a 3 m/s durante 20 s, nunca há mais de um pé no ar, os pés ficam rente ao chão e o casco não sai do lugar', () => {
    const v = novo();
    const dt = 1 / 60;
    const p = new THREE.Vector3();
    // o "pé" medido é o osso do tornozelo (a uns 2,6 m do chão): tudo é relativo à altura de repouso dele
    const repouso = Object.fromEntries(LEG_IDS.map((id) => [id, mundo(v, id).y])) as Record<LegId, number>;
    let maxNoAr = 0;
    let menor = Infinity;
    let maior = -Infinity;
    for (let i = 0; i < 60 * 20; i++) {
      v.update(dt, 3);
      v.root.updateMatrixWorld(true);
      let noAr = 0;
      for (const id of LEG_IDS) {
        v.footWorld(id, p);
        const d = p.y - repouso[id];
        menor = Math.min(menor, d);
        maior = Math.max(maior, d);
        if (d > 1.0) noAr++;
      }
      maxNoAr = Math.max(maxNoAr, noAr);
    }
    expect(maxNoAr, 'três pés sempre no chão').toBeLessThanOrEqual(1);
    expect(menor, 'nenhum pé afunda mais que o casco desce').toBeGreaterThan(-0.8);
    expect(maior, 'o pé do balanço sobe poucos metros, não pula').toBeLessThan(6);
    expect(maior, 'e o balanço levanta o pé de verdade').toBeGreaterThan(1.5);
  });

  it('o pé que pisa anda para trás, em relação ao casco, na mesma velocidade que o casco anda para a frente (não escorrega)', () => {
    const v = novo();
    const dt = 1 / 60;
    const v0 = 3;
    // deixa o ciclo rodar um pouco e mede o pé da dianteira esquerda durante a pisada dele
    const zs: number[] = [];
    const p = new THREE.Vector3();
    for (let i = 0; i < 60 * 8; i++) {
      v.update(dt, v0);
      v.root.updateMatrixWorld(true);
      v.footWorld('fl', p);
      zs.push(p.z);
    }
    // a velocidade do pé em z (no referencial do casco) durante a pisada: vários quadros seguidos com o pé baixo
    const baixos: number[] = [];
    for (let i = 1; i < zs.length; i++) baixos.push((zs[i]! - zs[i - 1]!) / dt);
    const pisando = baixos.filter((x) => x > 0.5 && x < 6); // o pé se afasta para trás (+Z) devagar: é a pisada
    expect(pisando.length).toBeGreaterThan(100);
    const media = pisando.reduce((a, b) => a + b, 0) / pisando.length;
    expect(media, 'a pisada anda para trás na velocidade do casco, ±30%').toBeGreaterThan(v0 * 0.7);
    expect(media).toBeLessThan(v0 * 1.3);
  });

  it('parado, o Draga fica quieto nas pernas (só o radar e os guindastes se mexem)', () => {
    const v = novo();
    const antes = LEG_IDS.map((id) => mundo(v, id));
    for (let i = 0; i < 120; i++) v.update(1 / 60, 0);
    v.root.updateMatrixWorld(true);
    LEG_IDS.forEach((id, i) => expect(mundo(v, id).distanceTo(antes[i]!), id).toBeLessThan(1e-3));
  });

  it('perna caída: o casco desce e a perna dobra; as outras seguem no chão', () => {
    const v = novo();
    v.collapse.fl = 1;
    v.update(1 / 60, 0);
    v.root.updateMatrixWorld(true);
    const deck = v.root.getObjectByName('deck')!.getWorldPosition(new THREE.Vector3());
    const v2 = novo();
    const deck0 = v2.root.getObjectByName('deck')!.getWorldPosition(new THREE.Vector3());
    expect(deck0.y - deck.y, 'o casco afunda').toBeGreaterThan(1.5);
  });

  it('o passo pousa: onFootstep dispara uma vez por pé por ciclo, com a posição do pé', () => {
    const v = novo();
    const repouso = Object.fromEntries(LEG_IDS.map((id) => [id, mundo(v, id).y])) as Record<LegId, number>;
    const pousos: LegId[] = [];
    v.onFootstep = (leg, w) => {
      pousos.push(leg);
      expect(Math.abs(w.y - repouso[leg]), 'o pé pousa rente ao chão').toBeLessThan(1.5);
    };
    for (let i = 0; i < 60 * 60; i++) v.update(1 / 60, 3);
    expect(pousos.length).toBeGreaterThan(20);
    for (const id of LEG_IDS) expect(pousos.filter((x) => x === id).length, id).toBeGreaterThan(4);
  });

  it('a inclinação do casco vai para o lado da perna caída: a dianteira esquerda cai e a cabine (frente) e o guindaste esquerdo descem mais que o resto', () => {
    const y = (v: WalkerVisual, nome: string): number => v.root.getObjectByName(nome)!.getWorldPosition(new THREE.Vector3()).y;
    const normal = novo();
    const caido = novo();
    caido.collapse.fl = 1;
    caido.update(1 / 60, 0);
    caido.root.updateMatrixWorld(true);
    const descida = (nome: string): number => y(normal, nome) - y(caido, nome);
    // o nariz (o radar, na cabine) desce mais que a traseira (os guindastes), e o lado esquerdo (guindaste_esq) mais que o direito
    expect(descida('radar')).toBeGreaterThan(descida('guindaste_esq'));
    expect(descida('guindaste_esq'), 'a esquerda cai mais que a direita').toBeGreaterThan(descida('guindaste_dir'));
    // e a perna traseira direita caída inclina para o outro lado
    const outro = novo();
    outro.collapse.rr = 1;
    outro.update(1 / 60, 0);
    outro.root.updateMatrixWorld(true);
    expect(y(normal, 'radar') - y(outro, 'radar'), 'com a traseira caída a frente não cai tanto').toBeLessThan(y(normal, 'guindaste_dir') - y(outro, 'guindaste_dir'));
  });

  it('a malha usa a cor dos vértices, não é cortada pelo frustum (a caixa de pele em repouso não acompanha a pose) e não projeta sombra', () => {
    const v = novo();
    expect(v.material.vertexColors).toBe(true);
    v.root.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isSkinnedMesh) return;
      expect(m.material).toBe(v.material);
      expect(m.frustumCulled).toBe(false);
      expect(m.castShadow).toBe(false);
    });
  });

  it('duas instâncias são independentes (o esqueleto é clonado): mexer em uma não mexe na outra', () => {
    const a = novo();
    const b = novo();
    expect(a.root.getObjectByName('fl_coxa')).not.toBe(b.root.getObjectByName('fl_coxa'));
    const antes = mundo(b, 'fl');
    for (let i = 0; i < 100; i++) a.update(1 / 60, 3);
    b.root.updateMatrixWorld(true);
    expect(mundo(b, 'fl').distanceTo(antes)).toBeLessThan(1e-6);
  });
});
