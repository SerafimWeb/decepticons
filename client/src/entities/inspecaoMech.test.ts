import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DEFAULT_BONES, type ImportedMechAsset } from './importedMechRig';
import { formatarSugestao, inspecionarMech, verificarConvencao } from './inspecaoMech';

interface Opcoes {
  nomes?: 'mixamo' | 'tripo';
  pose?: 'T' | 'A' | 'pendurado';
  /** Para onde o personagem olha no arquivo (+1 = +Z, o padrão glTF). */
  frente?: 1 | -1;
  skin?: boolean;
  estaticaExtra?: boolean;
  cabeca?: boolean;
  antebraco?: boolean;
  dedos?: number;
  escala?: number;
}

const MIXAMO = { hips: 'mixamorigHips', spine: 'mixamorigSpine1', neck: 'mixamorigNeck', head: 'mixamorigHead', arm: 'mixamorigArm', fore: 'mixamorigForeArm', hand: 'mixamorigHand', up: 'mixamorigUpLeg', low: 'mixamorigLeg', foot: 'mixamorigFoot' };
const TRIPO = { hips: 'Hip', spine: 'Spine01', neck: 'Neck', head: 'Head', arm: 'Upperarm', fore: 'Forearm', hand: 'Hand', up: 'Thigh', low: 'Calf', foot: 'Foot' };

const bone = (name: string, x: number, y: number, z: number): THREE.Bone => {
  const b = new THREE.Bone();
  b.name = name;
  b.position.set(x, y, z);
  return b;
};

/** Esqueleto de robô no referencial do ARQUIVO: personagem de pé olhando para `frente`, esquerda dele em +X se olha para +Z. */
function robo(o: Opcoes = {}): THREE.Group {
  const { nomes = 'mixamo', pose = 'A', frente = 1, skin = true, cabeca = true, antebraco = true, dedos = 0, escala = 1 } = o;
  const N = nomes === 'mixamo' ? MIXAMO : TRIPO;
  const lado = (s: 'Left' | 'Right') => (nomes === 'mixamo' ? s : s === 'Left' ? 'L_' : 'R_');
  const nome = (s: 'Left' | 'Right', base: string) => (nomes === 'mixamo' ? base.replace('mixamorig', `mixamorig${s}`) : `${lado(s)}${base}`);
  const todos: THREE.Bone[] = [];
  const reg = (b: THREE.Bone) => (todos.push(b), b);

  const hips = reg(bone(N.hips, 0, 1, 0));
  const spine = reg(bone(N.spine, 0, 0.3, 0));
  const neck = reg(bone(N.neck, 0, 0.4, 0));
  hips.add(spine);
  spine.add(neck);
  if (cabeca) neck.add(reg(bone(N.head, 0, 0.2, 0)));

  for (const s of ['Left', 'Right'] as const) {
    const sx = s === 'Left' ? frente : -frente;
    const braco = reg(bone(nome(s, N.arm), 0.3 * sx, 0.3, 0));
    const [dx, dy] = pose === 'T' ? [0.4, 0] : pose === 'A' ? [0.26, -0.31] : [0, -0.4];
    const maoOffset: [number, number, number] = [dx * sx, dy, 0];
    const mao = reg(bone(nome(s, N.hand), ...(antebraco ? maoOffset : [2 * dx * sx, 2 * dy, 0] as [number, number, number])));
    if (antebraco) {
      const fore = reg(bone(nome(s, N.fore), ...maoOffset));
      braco.add(fore);
      fore.add(mao);
    } else braco.add(mao);
    for (let i = 0; i < dedos; i++) mao.add(reg(bone(`${mao.name}Dedo${i}`, 0.05 * sx, -0.02, 0)));
    spine.add(braco);

    const coxa = reg(bone(nome(s, N.up), 0.2 * sx, 0, 0));
    const canela = reg(bone(nome(s, N.low), 0, -0.5, 0));
    const pe = reg(bone(nome(s, N.foot), 0, -0.5, 0));
    hips.add(coxa);
    coxa.add(canela);
    canela.add(pe);
  }

  const root = new THREE.Group();
  root.add(hips);
  root.scale.setScalar(escala);

  const material = new THREE.MeshStandardMaterial();
  const corpo = (comSkin: boolean): THREE.Mesh => {
    const g = new THREE.BoxGeometry(0.6, 2, 0.4);
    g.translate(0, 1, 0);
    if (!comSkin) return new THREE.Mesh(g, material);
    const n = g.getAttribute('position').count;
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(n * 4).fill(0), 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(Array.from({ length: n * 4 }, (_, i) => (i % 4 === 0 ? 1 : 0)), 4));
    const m = new THREE.SkinnedMesh(g, material);
    m.add(hips);
    m.bind(new THREE.Skeleton(todos));
    return m;
  };
  const principal = corpo(skin);
  if (skin) root.remove(hips);
  root.add(principal);
  for (const sx of [-1, 1]) {
    const pe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.4), material);
    pe.position.set(0.2 * sx, 0.03, 0.3 * frente);
    root.add(pe);
  }
  if (o.estaticaExtra) root.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), material));
  root.updateMatrixWorld(true);
  return root;
}

const codigos = (r: ReturnType<typeof inspecionarMech>, severidade: string): string[] => r.achados.filter((a) => a.severidade === severidade).map((a) => a.codigo);

describe('inspecionarMech: o contrato do arquivo, lido de uma cena', () => {
  it('robô bom (Mixamo, A-pose, frente +Z, com skin): sem erro, e sugere só o giro de 180°', () => {
    const r = inspecionarMech(robo(), 1000);
    expect(codigos(r, 'erro')).toEqual([]);
    expect(r.esqueleto).toMatchObject({ tipo: 'mixamo', faltando: [] });
    expect(r.pose.tipo).toBe('A-pose');
    expect(r.frente.eixo).toBe('+Z');
    expect(r.frente.certeza).toBe('medida');
    expect(r.antebraco).toBe(true);
    expect(r.sugestao).toEqual({ rotationY: Math.PI, weaponMounts: true });
  });

  it('frente para -Z: não manda girar', () => {
    const r = inspecionarMech(robo({ frente: -1 }));
    expect(r.frente.eixo).toBe('-Z');
    expect(r.sugestao.rotationY).toBeUndefined();
  });

  it('T-pose: avisa e sugere armRest com o cotovelo; sem antebraço não há cotovelo nem encaixe', () => {
    const t = inspecionarMech(robo({ pose: 'T' }));
    expect(t.pose.tipo).toBe('T-pose');
    expect(codigos(t, 'aviso')).toContain('tpose');
    expect(t.sugestao.armRest).toEqual({ upper: [0.62, -0.77, -0.15], fore: [0.1, 0, -1] });

    const sem = inspecionarMech(robo({ pose: 'T', antebraco: false }));
    expect(sem.antebraco).toBe(false);
    expect(codigos(sem, 'aviso')).toContain('sem-antebraco');
    expect(sem.sugestao.armRest).toEqual({ upper: [0.62, -0.77, -0.15] });
    expect(sem.sugestao.weaponMounts).toBe(false);
  });

  it('braço pendurado ou em A-pose não pede armRest', () => {
    expect(inspecionarMech(robo({ pose: 'pendurado' })).sugestao.armRest).toBeUndefined();
    expect(inspecionarMech(robo({ pose: 'A' })).sugestao.armRest).toBeUndefined();
  });

  it('malha sem skin é erro (a armadura ficaria parada no ar); estática ao lado de uma com skin é aviso', () => {
    expect(codigos(inspecionarMech(robo({ skin: false })), 'erro')).toContain('sem-skin');
    const r = inspecionarMech(robo({ estaticaExtra: true }));
    expect(codigos(r, 'erro')).toEqual([]);
    expect(codigos(r, 'aviso')).toContain('malha-estatica');
  });

  it('cabeça ausente com pescoço presente: usa o pescoço e sugere o boneNames, sem erro', () => {
    const r = inspecionarMech(robo({ cabeca: false }));
    expect(codigos(r, 'erro')).toEqual([]);
    expect(r.esqueleto.nomes.head).toBe('mixamorigNeck');
    expect(r.sugestao.boneNames).toEqual({ head: 'mixamorigNeck' });
  });

  it('osso que o jogo anima e o arquivo não tem: erro com a lista', () => {
    const cena = robo();
    cena.traverse((o) => {
      if (o.name === 'mixamorigLeftLeg') o.name = 'canela_esq';
    });
    const r = inspecionarMech(cena);
    expect(codigos(r, 'erro')).toContain('ossos-faltando');
    expect(r.esqueleto.faltando).toContain('leftLowerLeg');
  });

  it('esqueleto Tripo é reconhecido e leva o mapa completo de boneNames', () => {
    const r = inspecionarMech(robo({ nomes: 'tripo' }));
    expect(r.esqueleto.tipo).toBe('tripo');
    expect(codigos(r, 'erro')).toEqual([]);
    expect(Object.keys(r.sugestao.boneNames ?? {}).sort()).toEqual(Object.keys(DEFAULT_BONES).sort());
    expect(r.sugestao.boneNames?.leftHand).toBe('L_Hand');
  });

  it('conta os dedos da mão e a malha com escala quebrada vira erro de tamanho', () => {
    expect(inspecionarMech(robo({ dedos: 3 })).dedos).toEqual({ esquerda: 3, direita: 3 });
    expect(codigos(inspecionarMech(robo({ escala: 1e-37 })), 'erro')).toContain('tamanho');
  });

  it('a entrada sugerida sai como texto pronto para colar', () => {
    const texto = formatarSugestao('novo', 'novo.glb', inspecionarMech(robo({ pose: 'T', cabeca: false })).sugestao);
    expect(texto).toContain('novo: {');
    expect(texto).toContain('models/novo.glb');
    expect(texto).toContain('rotationY: Math.PI,');
    expect(texto).toContain('armRest: { upper: [0.62, -0.77, -0.15], fore: [0.1, 0, -1] },');
    expect(texto).toContain('weaponMounts: true');
    expect(texto).toContain("head: 'mixamorigNeck',");
  });
});

describe('verificarConvencao: perna, joelho e mira no sentido do jogo', () => {
  /** O asset exatamente como o `preload` o monta: cena girada pelo rotationY sugerido. */
  function asset(cena: THREE.Group): ImportedMechAsset {
    const r = inspecionarMech(cena);
    if (r.sugestao.rotationY) cena.rotation.y = r.sugestao.rotationY;
    cena.updateMatrixWorld(true);
    return { scene: cena, boneNames: { ...DEFAULT_BONES, ...r.sugestao.boneNames }, hipHeight: 1, naturalHeight: 2, naturalMinY: 0, armRest: r.sugestao.armRest, weaponMounts: r.sugestao.weaponMounts };
  }

  it('com a sugestão aplicada, as três checagens passam, em T-pose e em A-pose', () => {
    for (const pose of ['T', 'A'] as const) {
      const checagens = verificarConvencao(asset(robo({ pose })), 2);
      expect(checagens).toHaveLength(3);
      for (const c of checagens) expect(c.ok, `${pose}: ${c.nome} (${c.valor})`).toBe(true);
    }
  });

  it('também passa quando o arquivo já olha para -Z (sem giro)', () => {
    for (const c of verificarConvencao(asset(robo({ frente: -1 })), 2)) expect(c.ok, `${c.nome} (${c.valor})`).toBe(true);
  });
});
