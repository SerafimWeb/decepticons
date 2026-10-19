import * as THREE from 'three';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import type { CaixaDaPlanta, InstanciaDoMapa, MapaCarregado } from './mapasSobDemanda';
import { blocosDaPraca, PRACA_LIMITES, PRACA_PREDIOS, type BlocoDaPraca } from './PracaLayout';

/**
 * O MAPA DA PRAÇA DOS TRÊS PODERES (P217, passo 4 da ficha): o desenho e os colisores do chão do 8 DE JANEIRO, a partir de `PracaLayout.ts`. **Carregado sob demanda** (`mapasSobDemanda.ts`):
 * o código daqui só baixa para quem abre o mapa. A cena toda é **estática**: dois `InstancedMesh` (os sólidos e o que é só desenho) mais a cúpula, a tigela e a água; nenhuma atualização por
 * quadro (G4/G5). Os colisores são **só os blocos sólidos** do layout (o teste trava o teto de 310, o do Bunker).
 *
 * Os desenhos redondos (a cúpula do Senado e a tigela da Câmara, no Congresso) são só desenho sobre os volumes sólidos do layout: o Mech esbarra na caixa, não na curva.
 */

const COR: Readonly<Record<BlocoDaPraca['kind'], number>> = {
  pavimento: 0xb7b9b1,
  gramado: 0x4c8f45,
  asfalto: 0x35383c,
  concreto: 0xe9e7df,
  vidro: 0x4a6a80,
  agua: 0x3f93b8,
  onibus: 0xf3c613,
  cerca: 0x2b3038,
  pedra: 0xcfcbbf,
  metal: 0x5b6168,
};

const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _c = new THREE.Color();
const EIXO_Z = new THREE.Vector3(0, 0, 1);

/** A instância do mapa que a partida guarda: só o relógio e a câmera (a Praça não tem rio, escotilha nem frente: os ganchos da Amazônia ficam sem efeito). */
class Praca implements InstanciaDoMapa {
  readonly frente = 0;
  readonly alcanceDaCamera = 700;
  constructor(scene: THREE.Scene, physics: PhysicsWorld) {
    // O fim de tarde de Brasília: céu claro e quente, névoa leve (a Esplanada de ponta a ponta se vê).
    scene.background = new THREE.Color(0xa8c8e8);
    scene.fog = new THREE.FogExp2(0xc7d8e6, 0.0016);
    scene.add(new THREE.HemisphereLight(0xd6e6f5, 0x8d8a7a, 1.05));
    const sol = new THREE.DirectionalLight(0xfff0d2, 1.5);
    sol.position.set(-120, 140, 90);
    scene.add(sol);
    const contra = new THREE.DirectionalLight(0xaec6e0, 0.4);
    contra.position.set(100, 50, -80);
    scene.add(contra);

    const blocos = blocosDaPraca();
    const solidos = blocos.filter((b) => b.solid);
    const desenho = blocos.filter((b) => !b.solid && b.kind !== 'agua');
    const aguas = blocos.filter((b) => b.kind === 'agua');
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const montar = (lista: readonly BlocoDaPraca[], material: THREE.Material, fisica: boolean): THREE.InstancedMesh => {
      const malha = new THREE.InstancedMesh(geo, material, Math.max(1, lista.length));
      malha.count = lista.length;
      lista.forEach((b, i) => {
        _p.set(b.x, b.y, b.z);
        _s.set(b.w, b.h, b.d);
        _q.setFromAxisAngle(EIXO_Z, b.rz);
        malha.setMatrixAt(i, _m.compose(_p, _q, _s));
        malha.setColorAt(i, _c.set(COR[b.kind]));
        if (fisica) physics.addStaticBox(_p, _s, _q);
      });
      malha.frustumCulled = false;
      malha.instanceMatrix.needsUpdate = true;
      if (malha.instanceColor) malha.instanceColor.needsUpdate = true;
      scene.add(malha);
      return malha;
    };
    montar(solidos, new THREE.MeshStandardMaterial({ roughness: 0.86, metalness: 0.05 }), true);
    montar(desenho, new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 }), false);
    montar(aguas, new THREE.MeshStandardMaterial({ roughness: 0.15, metalness: 0.25, transparent: true, opacity: 0.88 }), false);

    // A cúpula (convexa, ao norte) e a tigela (côncava, ao sul) do Congresso: só desenho sobre os volumes sólidos do layout.
    const branco = new THREE.MeshStandardMaterial({ color: 0xf4f2ea, roughness: 0.7 });
    const cupula = new THREE.Mesh(new THREE.SphereGeometry(11.5, 20, 9, 0, Math.PI * 2, 0, Math.PI / 2), branco);
    cupula.position.set(24, 14, -48);
    const tigela = new THREE.Mesh(new THREE.CylinderGeometry(12.5, 7, 5.2, 24, 1, true), branco);
    tigela.position.set(24, 8.6, 48);
    const fundo = new THREE.Mesh(new THREE.CircleGeometry(12.3, 24), new THREE.MeshStandardMaterial({ color: 0xc9c5b8, roughness: 0.9 }));
    fundo.rotation.x = -Math.PI / 2;
    fundo.position.set(24, 11.15, 48);
    for (const o of [cupula, tigela, fundo]) {
      o.frustumCulled = false;
      scene.add(o);
    }
  }

  update(_elapsed: number): void {
    // estática: a água é um desenho plano; nada anima
  }
  observar(): void {}
  setFrente(): void {}
  curar(): void {}
  setEscotilha(): void {}
}

/** A planta de cima (o radar e o minimapa): os blocos sólidos sem rotação, menos o chão. */
export function caixasDaPraca(): readonly CaixaDaPlanta[] {
  const out: CaixaDaPlanta[] = [];
  for (const b of blocosDaPraca()) {
    if (!b.solid || b.rz !== 0 || b.kind === 'pavimento' || b.kind === 'onibus' || b.h < 1) continue;
    out.push({ x0: b.x - b.w / 2, z0: b.z - b.d / 2, x1: b.x + b.w / 2, z1: b.z + b.d / 2 });
  }
  return out;
}

export const mapaDaPraca: MapaCarregado = {
  construir: (scene, physics) => new Praca(scene, physics),
  caixasDaPlanta: caixasDaPraca,
  rotulos: PRACA_PREDIOS.map((p) => ({ x: (p.caixa.x0 + p.caixa.x1) / 2, z: (p.caixa.z0 + p.caixa.z1) / 2 + (p.id === 'executivo' ? -8 : p.id === 'judiciario' ? 8 : 0), texto: p.nome, cor: 'rgba(255, 210, 63, 0.95)' })),
  meia: { x: Math.max(Math.abs(PRACA_LIMITES.minX), PRACA_LIMITES.maxX), z: PRACA_LIMITES.maxZ },
};
