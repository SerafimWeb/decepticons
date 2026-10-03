import * as THREE from 'three';
import { DEFAULT_BONES, instantiateImportedMechRig, type ImportedMechAsset, type ImportedRigOptions } from './importedMechRig';

/**
 * Inspetor de robô importado: lê uma cena glTF já carregada e confere o contrato de `MECHS_IMPORTADOS.md`, dizendo
 * o que o `.glb` traz e que entrada o `IMPORTED_CHASSIS` precisa. Só ferramenta de desenvolvimento (`npm run
 * mech:inspecionar`): o jogo não importa este arquivo, então ele nunca entra no bundle. Sem DOM, para poder ser testado.
 */

export type BoneKey = keyof typeof DEFAULT_BONES;
export type Severidade = 'erro' | 'aviso' | 'info';

export interface Achado {
  severidade: Severidade;
  codigo: string;
  mensagem: string;
}

/** O que o `IMPORTED_CHASSIS` precisa para este arquivo (só o que difere do padrão). */
export interface Sugestao {
  rotationY?: number;
  boneNames?: Partial<Record<BoneKey, string>>;
  armRest?: NonNullable<ImportedRigOptions['armRest']>;
  weaponMounts: boolean;
}

export interface Relatorio {
  bytes: number | null;
  malhas: { total: number; comSkin: number; semSkin: number; triangulos: number; materiais: number; texturas: number; maiorTextura: number };
  tamanho: { x: number; y: number; z: number };
  esqueleto: { tipo: 'mixamo' | 'tripo' | 'desconhecido'; ossos: number; nomes: Partial<Record<BoneKey, string>>; faltando: BoneKey[] };
  antebraco: boolean;
  dedos: { esquerda: number; direita: number };
  /** Para onde o arquivo olha. `certeza`: medida (o pé decidiu), fraca (o pé inclina, pouco) ou assumida (+Z, o padrão glTF e Mixamo). */
  frente: { eixo: '+Z' | '-Z'; deslocamento: number; certeza: 'medida' | 'fraca' | 'assumida' };
  pose: { tipo: 'T-pose' | 'A-pose' | 'pendurado'; angulo: number };
  achados: Achado[];
  sugestao: Sugestao;
}

const KEYS = Object.keys(DEFAULT_BONES) as BoneKey[];

/** Os nomes do esqueleto do Tripo3D (Lancer-L1 e LR-7L Bastion). */
const TRIPO_BONES: Record<BoneKey, string> = {
  hips: 'Hip',
  head: 'Head',
  torso: 'Spine01',
  leftArm: 'L_Upperarm',
  rightArm: 'R_Upperarm',
  leftUpLeg: 'L_Thigh',
  leftLowerLeg: 'L_Calf',
  rightUpLeg: 'R_Thigh',
  rightLowerLeg: 'R_Calf',
  leftHand: 'L_Hand',
  rightHand: 'R_Hand',
};

/** Quando o osso do padrão não existe, o que costuma ocupar o lugar dele (o Marauder não tem `Head`, usa o pescoço). */
const ALTERNATIVAS: Partial<Record<BoneKey, string[]>> = {
  head: ['mixamorigNeck', 'Neck', 'mixamorigHead', 'Head'],
  torso: ['mixamorigSpine1', 'mixamorigSpine2', 'mixamorigSpine', 'Spine01', 'Spine02', 'Spine'],
};

/** Pose de arma em punho do Marauder (ver `ImportedRigOptions.armRest`): o ponto de partida para qualquer malha em T-pose. */
const ARM_REST_PADRAO = { upper: [0.62, -0.77, -0.15], fore: [0.1, 0, -1] } as const;

/** Fração da altura abaixo da qual os vértices contam como pé, para achar para onde o pé aponta. */
const FRACAO_PE = 0.08;
/** Deslocamento do pé (fração da altura): a partir de FRENTE_MEDIDA a frente é medida; entre FRENTE_FRACA e ela, só inclina; abaixo, é assumida. */
const FRENTE_MEDIDA = 0.01;
const FRENTE_FRACA = 0.002;

const firstBoneChild = (o: THREE.Object3D): THREE.Object3D | undefined => o.children.find((c) => (c as THREE.Bone).isBone);

function descendentes(o: THREE.Object3D): number {
  let n = 0;
  o.traverse((c) => {
    if (c !== o && (c as THREE.Bone).isBone) n++;
  });
  return n;
}

/** Para onde apontam os pés: média, em Z, dos vértices rente ao chão menos a posição do tornozelo (fração da altura). */
function deslocamentoDoPe(meshes: THREE.Mesh[], ankleZ: number, minY: number, altura: number): number {
  const v = new THREE.Vector3();
  let soma = 0;
  let n = 0;
  for (const mesh of meshes) {
    const pos = mesh.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      if (v.y > minY + altura * FRACAO_PE) continue;
      soma += v.z;
      n++;
    }
  }
  return n ? (soma / n - ankleZ) / altura : 0;
}

export function inspecionarMech(scene: THREE.Object3D, bytes: number | null = null): Relatorio {
  scene.updateMatrixWorld(true);
  const achados: Achado[] = [];
  const add = (severidade: Severidade, codigo: string, mensagem: string) => achados.push({ severidade, codigo, mensagem });

  const meshes: THREE.Mesh[] = [];
  const bones = new Map<string, THREE.Object3D>();
  scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
    if ((o as THREE.Bone).isBone) bones.set(o.name, o);
  });

  // Malhas, skin, triângulos, materiais e texturas.
  const comSkin = meshes.filter((m) => (m as THREE.SkinnedMesh).isSkinnedMesh).length;
  const materiais = new Set<THREE.Material>();
  const texturas = new Set<THREE.Texture>();
  let triangulos = 0;
  for (const m of meshes) {
    const g = m.geometry;
    triangulos += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      materiais.add(mat);
      for (const value of Object.values(mat)) if ((value as THREE.Texture | null)?.isTexture) texturas.add(value as THREE.Texture);
    }
  }
  let maiorTextura = 0;
  for (const t of texturas) {
    const img = t.image as { width?: number; height?: number } | undefined;
    maiorTextura = Math.max(maiorTextura, img?.width ?? 0, img?.height ?? 0);
  }
  if (!meshes.length) add('erro', 'sem-malha', 'o arquivo não tem nenhuma malha');
  else if (comSkin === 0) add('erro', 'sem-skin', 'nenhuma malha tem skin: a armadura não segue o esqueleto e fica parada no ar');
  else if (comSkin < meshes.length) add('aviso', 'malha-estatica', `${meshes.length - comSkin} malha(s) sem skin ao lado das que têm: o jogo as esconde (duplicata de T-pose), mas confira se não é armadura de verdade`);
  if (maiorTextura > 4096) add('aviso', 'textura-grande', `textura de ${maiorTextura}px: pesa no download`);

  // Tamanho (a mesma conta do jogo: caixa só das malhas).
  const box = new THREE.Box3();
  for (const m of meshes) box.expandByObject(m);
  const size = box.isEmpty() ? new THREE.Vector3() : box.getSize(new THREE.Vector3());
  if (meshes.length && (![size.x, size.y, size.z].every(Number.isFinite) || size.y < 1e-3 || size.y > 1e5)) {
    add('erro', 'tamanho', `altura absurda (${size.y}): malha invisível ou com escala quebrada na exportação`);
  }

  // Esqueleto: o padrão (Mixamo ou Tripo) que mais ossos acerta, e o que falta.
  const acertos = (preset: Record<BoneKey, string>) => KEYS.filter((k) => bones.has(preset[k])).length;
  const mixamo = acertos(DEFAULT_BONES);
  const tripo = acertos(TRIPO_BONES);
  const tipo: Relatorio['esqueleto']['tipo'] = Math.max(mixamo, tripo) < 6 ? 'desconhecido' : tripo > mixamo ? 'tripo' : 'mixamo';
  const preset: Record<BoneKey, string> = tipo === 'tripo' ? TRIPO_BONES : DEFAULT_BONES;
  const nomes: Partial<Record<BoneKey, string>> = {};
  const faltando: BoneKey[] = [];
  for (const k of KEYS) {
    const nome = [preset[k], ...(ALTERNATIVAS[k] ?? [])].find((n) => bones.has(n));
    if (nome) nomes[k] = nome;
    else faltando.push(k);
  }
  if (faltando.length) add('erro', 'ossos-faltando', `ossos que o jogo anima e o arquivo não tem: ${faltando.join(', ')}`);
  if (tipo === 'desconhecido') add('aviso', 'esqueleto-desconhecido', 'os nomes dos ossos não são Mixamo nem Tripo: mapeie todos em boneNames');

  // Braços: antebraço, dedos e pose de repouso.
  const leftHand = nomes.leftHand ? bones.get(nomes.leftHand) : undefined;
  const rightHand = nomes.rightHand ? bones.get(nomes.rightHand) : undefined;
  const leftArm = nomes.leftArm ? bones.get(nomes.leftArm) : undefined;
  const rightArm = nomes.rightArm ? bones.get(nomes.rightArm) : undefined;
  const antebraco = !!(leftHand && rightHand && leftArm && rightArm && leftHand.parent !== leftArm && rightHand.parent !== rightArm);
  const dedos = { esquerda: leftHand ? descendentes(leftHand) : 0, direita: rightHand ? descendentes(rightHand) : 0 };
  if (leftHand && leftArm && !antebraco) add('aviso', 'sem-antebraco', 'a mão é filha direta do braço: sem antebraço não há onde nascer o encaixe de arma');
  if (dedos.esquerda || dedos.direita) add('info', 'dedos', `a mão tem ${dedos.esquerda}/${dedos.direita} ossos de dedo: somem pelo encolhimento da mão (weaponMounts); o ideal é o antebraço terminar liso`);

  let pose: Relatorio['pose'] = { tipo: 'pendurado', angulo: 0 };
  if (leftArm && leftHand) {
    const dir = leftHand.getWorldPosition(new THREE.Vector3()).sub(leftArm.getWorldPosition(new THREE.Vector3())).normalize();
    const angulo = (Math.acos(THREE.MathUtils.clamp(-dir.y, -1, 1)) * 180) / Math.PI;
    pose = { tipo: angulo >= 70 ? 'T-pose' : angulo >= 25 ? 'A-pose' : 'pendurado', angulo: Math.round(angulo) };
  }
  if (pose.tipo === 'T-pose') add('aviso', 'tpose', `braços abertos (${pose.angulo}° da vertical): precisa de armRest, senão a mira só rola o braço sobre si mesmo`);

  // Frente: para onde apontam os pés em relação ao tornozelo.
  let frente: Relatorio['frente'] = { eixo: '+Z', deslocamento: 0, certeza: 'assumida' };
  const lowerLeg = nomes.leftLowerLeg ? bones.get(nomes.leftLowerLeg) : undefined;
  const ankle = lowerLeg ? firstBoneChild(lowerLeg) : undefined;
  if (ankle && meshes.length && size.y > 0) {
    const d = deslocamentoDoPe(meshes, ankle.getWorldPosition(new THREE.Vector3()).z, box.min.y, size.y);
    const mag = Math.abs(d);
    frente = {
      eixo: mag < FRENTE_FRACA ? '+Z' : d > 0 ? '+Z' : '-Z',
      deslocamento: Math.round(d * 1000) / 1000,
      certeza: mag >= FRENTE_MEDIDA ? 'medida' : mag >= FRENTE_FRACA ? 'fraca' : 'assumida',
    };
  }
  if (frente.certeza !== 'medida') {
    add('aviso', 'frente', `frente ${frente.eixo} ${frente.certeza === 'fraca' ? 'pelo pé, com pouca margem' : 'assumida (padrão glTF e Mixamo)'}: confirme no painel "frente" da foto, que deve mostrar a frente do robô`);
  }

  // O que o IMPORTED_CHASSIS precisa.
  const sugestao: Sugestao = { weaponMounts: antebraco };
  if (frente.eixo === '+Z') sugestao.rotationY = Math.PI;
  const diferentes = KEYS.filter((k) => nomes[k] && nomes[k] !== DEFAULT_BONES[k]);
  if (diferentes.length) {
    sugestao.boneNames = {};
    for (const k of tipo === 'mixamo' ? diferentes : KEYS) if (nomes[k]) sugestao.boneNames[k] = nomes[k]!;
  }
  if (pose.tipo === 'T-pose') sugestao.armRest = antebraco ? { upper: ARM_REST_PADRAO.upper, fore: ARM_REST_PADRAO.fore } : { upper: ARM_REST_PADRAO.upper };

  if (bytes !== null) add('info', 'tamanho-arquivo', `${(bytes / 1024).toFixed(0)} KB`);
  add('info', 'triangulos', `${Math.round(triangulos)} triângulos (o Marauder, com as duas armas, tem ~20 mil)`);

  return {
    bytes,
    malhas: { total: meshes.length, comSkin, semSkin: meshes.length - comSkin, triangulos: Math.round(triangulos), materiais: materiais.size, texturas: texturas.size, maiorTextura },
    tamanho: { x: size.x, y: size.y, z: size.z },
    esqueleto: { tipo, ossos: bones.size, nomes, faltando },
    antebraco,
    dedos,
    frente,
    pose,
    achados,
    sugestao,
  };
}

/** A entrada do `IMPORTED_CHASSIS` (texto pronto para colar), com o que o inspetor sugeriu. */
export function formatarSugestao(id: string, arquivo: string, s: Sugestao): string {
  const linhas = [`  ${id}: {`, `    url: \`\${import.meta.env.BASE_URL}models/${arquivo}\`,`];
  if (s.rotationY !== undefined) linhas.push('    rotationY: Math.PI,');
  if (s.armRest) {
    const { upper, fore } = s.armRest;
    linhas.push(`    armRest: { upper: [${upper.join(', ')}]${fore ? `, fore: [${fore.join(', ')}]` : ''} },`);
  }
  if (s.weaponMounts) linhas.push('    weaponMounts: true, // tire se o modelo já traz a arma desenhada');
  if (s.boneNames) {
    linhas.push('    boneNames: {');
    for (const [k, v] of Object.entries(s.boneNames)) linhas.push(`      ${k}: '${v}',`);
    linhas.push('    },');
  }
  linhas.push('  },');
  return linhas.join('\n');
}

export interface Checagem {
  nome: string;
  ok: boolean;
  /** Deslocamento medido no eixo que importa (m): o sinal certo está no `nome`. */
  valor: number;
}

/**
 * A convenção da animação (`MechBase.animate`): com `rotation.x` positivo o quadril leva o pé para a frente (-Z), o
 * joelho negativo dobra o pé para trás e o pitch positivo sobe o que está à frente do ombro. Mede com uma sonda presa
 * em cada osso, então vale para qualquer pose de repouso (um braço apontando para trás também passa).
 */
export function verificarConvencao(asset: ImportedMechAsset, altura: number): Checagem[] {
  const rig = instantiateImportedMechRig(asset, altura);
  const root = new THREE.Group();
  root.add(rig.model);
  root.updateMatrixWorld(true);
  const bone = (name: string): THREE.Object3D => {
    let found: THREE.Object3D | undefined;
    rig.model.traverse((n) => {
      if (n.name === name) found = n;
    });
    return found!;
  };
  /** Gira a junta e devolve o quanto uma sonda a `offset` do osso (no referencial do Mech) se deslocou. */
  const mede = (joint: { name: string; rotation: { x: number } }, angulo: number, offset: THREE.Vector3): THREE.Vector3 => {
    root.updateMatrixWorld(true);
    const b = bone(joint.name);
    const probe = new THREE.Object3D();
    probe.position.copy(b.worldToLocal(b.getWorldPosition(new THREE.Vector3()).add(offset)));
    b.add(probe);
    root.updateMatrixWorld(true);
    const antes = probe.getWorldPosition(new THREE.Vector3());
    joint.rotation.x = angulo;
    root.updateMatrixWorld(true);
    const depois = probe.getWorldPosition(new THREE.Vector3());
    joint.rotation.x = 0;
    b.remove(probe);
    return depois.sub(antes);
  };
  const abaixo = new THREE.Vector3(0, -1, 0);
  const frente = new THREE.Vector3(0, 0, -1);
  const hip = mede(rig.leftLeg.hip, 0.5, abaixo);
  const knee = mede(rig.leftLeg.knee, -0.8, abaixo);
  const arm = mede(rig.leftArm, 0.5, frente);
  return [
    { nome: 'quadril positivo leva o pé para a frente (-Z)', ok: hip.z < -0.05, valor: hip.z },
    { nome: 'joelho negativo dobra o pé para trás (+Z)', ok: knee.z > 0.05, valor: knee.z },
    { nome: 'pitch positivo sobe o que está à frente do ombro', ok: arm.y > 0.05, valor: arm.y },
  ];
}
