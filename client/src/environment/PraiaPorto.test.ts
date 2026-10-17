import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { avisoDoQuadro } from '../ui/praiaHudData';
import { Praia } from './Praia';
import { PRAIA_DESEMBARQUE, PRAIA_QUADRO_DE_LUZ } from './PraiaLayout';
import { aberturaDoDesembarque, aparenciaDoQuadro, PraiaPorto } from './PraiaPorto';

describe('as portas dos contêineres de desembarque (P164): abrem com a onda e fecham entre elas', () => {
  it('a abertura anda em linha reta até o alvo (~2 s) e para nele, nos dois sentidos', () => {
    let a = 0;
    for (let i = 0; i < 60; i++) a = aberturaDoDesembarque(a, true, 1 / 60); // 1 s
    expect(a).toBeGreaterThan(0.4);
    expect(a).toBeLessThan(0.7);
    for (let i = 0; i < 180; i++) a = aberturaDoDesembarque(a, true, 1 / 60);
    expect(a).toBe(1); // parou no alvo, sem passar
    for (let i = 0; i < 300; i++) a = aberturaDoDesembarque(a, false, 1 / 60);
    expect(a).toBe(0);
    expect(aberturaDoDesembarque(0.5, true, -1)).toBe(0.5); // dt torto não anda para trás
  });

  it('seis folhas (duas por contêiner), em duas malhas instanciadas, fechadas no começo e coladas na porta de leste de cada contêiner', () => {
    const scene = new THREE.Scene();
    new PraiaPorto(scene);
    const malhas = scene.children.filter((o) => (o as THREE.InstancedMesh).isInstancedMesh) as THREE.InstancedMesh[];
    expect(malhas).toHaveLength(2);
    expect(malhas[0]!.count + malhas[1]!.count).toBe(PRAIA_DESEMBARQUE.linhas.length * 2);
    // fechada: a folha está no plano da porta (x de leste do contêiner), na quina do vão
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const xDaPorta = PRAIA_DESEMBARQUE.x + PRAIA_DESEMBARQUE.comprimento / 2;
    for (const malha of malhas) {
      for (let i = 0; i < malha.count; i++) {
        malha.getMatrixAt(i, m);
        p.setFromMatrixPosition(m);
        expect(p.x).toBeCloseTo(xDaPorta, 3); // as matrizes são de 32 bits
        const metade = PRAIA_DESEMBARQUE.profundidade / 2;
        expect(PRAIA_DESEMBARQUE.linhas.some((z) => Math.abs(Math.abs(p.z - z) - metade) < 0.05)).toBe(true); // na quina
      }
    }
  });

  it('abrir e fechar mexe nas folhas: aberta, a ponta livre vai para o leste (para fora do contêiner); fechada, volta ao plano da porta', () => {
    const scene = new THREE.Scene();
    const porto = new PraiaPorto(scene);
    const malhas = scene.children.filter((o) => (o as THREE.InstancedMesh).isInstancedMesh) as THREE.InstancedMesh[];
    const pontaLivre = (malha: THREE.InstancedMesh, i: number, sentido: 1 | -1): THREE.Vector3 => {
      const m = new THREE.Matrix4();
      malha.getMatrixAt(i, m);
      // a ponta livre da folha: a largura dela para o lado do vão, no sistema local
      return new THREE.Vector3(0, 0, sentido * ((PRAIA_DESEMBARQUE.profundidade - 0.1) / 2)).applyMatrix4(m);
    };
    const xDaPorta = PRAIA_DESEMBARQUE.x + PRAIA_DESEMBARQUE.comprimento / 2;
    expect(pontaLivre(malhas[0]!, 0, -1).x).toBeCloseTo(xDaPorta, 3);
    expect(pontaLivre(malhas[1]!, 0, 1).x).toBeCloseTo(xDaPorta, 3);
    porto.setDesembarque(true);
    for (let i = 0; i < 200; i++) porto.atualiza(1 / 60, i / 60, 0, 1);
    expect(porto.aberturaAtual).toBe(1);
    expect(pontaLivre(malhas[0]!, 0, -1).x).toBeGreaterThan(xDaPorta + 2); // abriu para fora, para o leste
    expect(pontaLivre(malhas[1]!, 0, 1).x).toBeGreaterThan(xDaPorta + 2);
    porto.setDesembarque(false);
    for (let i = 0; i < 200; i++) porto.atualiza(1 / 60, 4 + i / 60, 0, 1);
    expect(porto.aberturaAtual).toBe(0);
    expect(pontaLivre(malhas[0]!, 0, -1).x).toBeCloseTo(xDaPorta, 3);
  });
});

describe('o painel do quadro de luz da cidade (P164)', () => {
  it('ligado: verde e firme; sabotado: laranja e treme com a vida; apagado: vermelho, piscando', () => {
    const ligado = aparenciaDoQuadro(0, 1, 3);
    expect(ligado.cor).toBe(0x3dff7a);
    expect(aparenciaDoQuadro(0, 1, 5).intensidade).toBe(ligado.intensidade); // firme
    const sab = aparenciaDoQuadro(1, 0.2, 3);
    expect(sab.cor).toBe(0xff9a1a);
    const luzes = new Set<number>();
    for (let t = 0; t < 2; t += 0.05) luzes.add(Math.round(aparenciaDoQuadro(1, 0.2, t).intensidade * 100));
    expect(luzes.size).toBeGreaterThan(5); // treme
    const apagado = new Set<number>();
    for (let t = 0; t < 3; t += 0.1) apagado.add(aparenciaDoQuadro(2, 0, t).intensidade);
    expect(apagado.size).toBe(2); // pisca: forte e fraca
    expect(aparenciaDoQuadro(2, 0, 0).cor).toBe(0xff2030);
  });

  it('o painel fica na face de leste do armário e muda a luz com o estado', () => {
    const scene = new THREE.Scene();
    const porto = new PraiaPorto(scene);
    const painel = scene.children.find((o) => (o as THREE.Mesh).isMesh && !(o as THREE.InstancedMesh).isInstancedMesh) as THREE.Mesh;
    expect(painel.position.x).toBeGreaterThan(PRAIA_QUADRO_DE_LUZ.x);
    expect(painel.position.z).toBe(PRAIA_QUADRO_DE_LUZ.z);
    porto.atualiza(1 / 60, 1, 2, 0);
    expect((painel.material as THREE.MeshStandardMaterial).emissive.getHex()).toBe(0xff2030);
    porto.atualiza(1 / 60, 2, 0, 1);
    expect((painel.material as THREE.MeshStandardMaterial).emissive.getHex()).toBe(0x3dff7a);
  });
});

describe('os avisos do quadro de luz no topo da tela (P164)', () => {
  it('nada mudou, nada de aviso; cada mudança tem a sua linha; a vida que só cai (sabotado → sabotado) não avisa de novo', () => {
    expect(avisoDoQuadro(0, 0)).toBeNull();
    expect(avisoDoQuadro(1, 1)).toBeNull();
    expect(avisoDoQuadro(0, 1)).toBe('QUADRO DE LUZ SOB SABOTAGEM · A CIDADE VAI AO ESCURO');
    expect(avisoDoQuadro(1, 2)).toBe('CIDADE NO ESCURO · AS ZONAS DE CURA CAÍRAM');
    expect(avisoDoQuadro(0, 2)).toBe('CIDADE NO ESCURO · AS ZONAS DE CURA CAÍRAM');
    expect(avisoDoQuadro(2, 1)).toBe('QUADRO DE LUZ RECUPERADO · A LUZ VOLTOU');
    expect(avisoDoQuadro(2, 0)).toBe('QUADRO DE LUZ RECUPERADO · A LUZ VOLTOU');
    expect(avisoDoQuadro(1, 0)).toBeNull(); // o quadro voltou a 100% sem nunca ter apagado: sem aviso
  });
});

const abertas: PhysicsWorld[] = [];

describe('a praia leva a energia da cidade às luzes e às zonas', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });
  afterEach(() => {
    while (abertas.length) abertas.pop()!.world.free();
  });

  async function montar() {
    const physics = await PhysicsWorld.create();
    abertas.push(physics);
    const scene = new THREE.Scene();
    const praia = new Praia(scene, physics);
    let lampadas: { value: number } | undefined;
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
      // o material dos halos (e o das poças) lê `uLampadas` direto do uniforme da praia
      if (m && m.isShaderMaterial && m.uniforms.uLampadas && m.vertexShader.includes('iDados')) lampadas = m.uniforms.uLampadas as { value: number };
    });
    return { scene, praia, lampadas: lampadas! };
  }

  it('as luzes da cidade são o ciclo do dia vezes a energia: sem energia a cidade fica no escuro mesmo de noite, e voltam com ela', async () => {
    const { praia, lampadas } = await montar();
    praia.setProgressoDoDia(1); // noite fechada: todas as lâmpadas acesas
    expect(lampadas.value).toBe(1);
    praia.setEnergia(0.5);
    expect(lampadas.value).toBeCloseTo(0.5, 6);
    praia.setEnergia(0);
    expect(lampadas.value).toBe(0);
    praia.setProgressoDoDia(0.9); // o dia anda com a cidade no escuro: continua apagada
    expect(lampadas.value).toBe(0);
    praia.setEnergia(1);
    expect(lampadas.value).toBeGreaterThan(0.9);
    praia.setEnergia(Number.NaN); // entrada torta: vale a energia cheia
    expect(lampadas.value).toBeGreaterThan(0.9);
  });

  it('sem energia as zonas de cura e de resfriamento somem do chão; com energia voltam', async () => {
    const { scene, praia } = await montar();
    const zonas = (): THREE.Mesh[] =>
      scene.children.filter((o) => {
        const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
        return !!m && m.isShaderMaterial && !!m.uniforms.uCura && !!m.uniforms.uFrio;
      }) as THREE.Mesh[];
    expect(zonas()).toHaveLength(2); // o chão e a cortina
    expect(zonas().every((z) => z.visible)).toBe(true);
    praia.setEnergia(0);
    expect(zonas().every((z) => !z.visible)).toBe(true);
    praia.setEnergia(0.3);
    expect(zonas().every((z) => z.visible)).toBe(true);
    // a qualidade baixa continua desligando a cortina, com energia
    praia.setDetalhe(false);
    const [chao, cortina] = zonas();
    expect(chao!.visible && !cortina!.visible).toBe(true);
  });

  it('setDesembarque + update abrem as portas dos contêineres na cena da praia, e a cena segue dentro do teto de desenhos', async () => {
    const { scene, praia } = await montar();
    praia.setDesembarque(true);
    for (let i = 0; i < 200; i++) praia.update(i / 60);
    const folhas = scene.children.filter((o) => (o as THREE.InstancedMesh).isInstancedMesh && (o as THREE.InstancedMesh).count === 3 && ((o as THREE.Mesh).geometry as THREE.BoxGeometry).parameters?.depth > 2) as THREE.InstancedMesh[];
    expect(folhas.length).toBeGreaterThanOrEqual(2);
    const m = new THREE.Matrix4();
    folhas[0]!.getMatrixAt(0, m);
    const quat = new THREE.Quaternion().setFromRotationMatrix(m);
    expect(Math.abs(quat.y)).toBeGreaterThan(0.5); // girou: está aberta
    let desenhos = 0;
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) desenhos++;
    });
    expect(desenhos).toBeLessThanOrEqual(67); // o teto da ficha (Praia.test.ts)
  });
});
