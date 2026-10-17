import * as THREE from 'three';
import { COLOSSUS_01_BLUEPRINT } from './mechBlueprint';
import { box } from './meshKit';

/**
 * A MÁSCARA DO CHEFE (ordem P165, 16/10): *"os Colossus V1, quero que você coloque uma MÁSCARA DO TRUMP nele (uma skin, que não será a padrão, apenas quando ele for o chefe)"*. É uma
 * **caricatura** de figura pública, **sátira política** do jogo: rosto laranja chapado, olhos e boca em fenda, o topete e as laterais de cabelo dourado, exagerados. Só desenho: não muda
 * colisão, vida, calor nem arma (G14), e **só o Colossus que é o chefe da missão a veste**; o Colossus que o jogador escolhe no Hangar e os demais Mechs não.
 *
 * **Desligável** (o risco jurídico e de plataforma está registrado em \`CAMPANHAS_E_CHEFES.md\` § 0: o botão de desligar fica para o caso de uma loja ou plataforma reclamar):
 * \`?mascara=0\` no link tira a máscara; sem o parâmetro ela entra. É uma lista de caixas em \`MASCARA_DO_CHEFE\`: trocar a cara é trocar linhas de tabela.
 *
 * **Custo:** 12 caixas e 3 materiais criados **uma vez**, na montagem do chefe (a cabeça já é um grupo próprio do rig); nada por quadro, nada por tick.
 */

type Material = 'laranja' | 'ouro' | 'preto';

/** Uma peça da máscara: o tamanho (largura, altura, profundidade) e a posição (x, y, z) em frações do tamanho da cabeça do chefe (largura, altura, profundidade), e o material. */
interface Peca {
  material: Material;
  /** O tamanho em frações da cabeça [largura, altura, profundidade]. */
  tamanho: readonly [number, number, number];
  /** A posição em frações da cabeça [x, y, z]; y = 0 é a base da cabeça e 1 o topo; z negativo é a frente. */
  posicao: readonly [number, number, number];
  /** A inclinação para a frente (rad, em torno de X): o topete cai para a frente. */
  inclina?: number;
}

/** O desenho da máscara, da cabeça do Colossus-01 (1,65 × 1,05 × 1,5 m). Cada linha é uma caixa. */
export const MASCARA_DO_CHEFE: readonly Peca[] = [
  // O rosto: uma placa laranja na frente da cabeça, um pouco maior que ela, e as fendas dos olhos e da boca.
  { material: 'laranja', tamanho: [1.06, 0.92, 0.1], posicao: [0, 0.5, -0.56] },
  { material: 'preto', tamanho: [0.2, 0.1, 0.03], posicao: [-0.2, 0.62, -0.6] },
  { material: 'preto', tamanho: [0.2, 0.1, 0.03], posicao: [0.2, 0.62, -0.6] },
  { material: 'preto', tamanho: [0.36, 0.07, 0.03], posicao: [0, 0.25, -0.6] },
  // O nariz (mais escuro que a placa, saltando para a frente) e as sobrancelhas franzidas, para o rosto ler de longe.
  { material: 'laranja', tamanho: [0.16, 0.3, 0.2], posicao: [0, 0.46, -0.66] },
  { material: 'ouro', tamanho: [0.3, 0.07, 0.05], posicao: [-0.2, 0.74, -0.6], inclina: 0.35 },
  { material: 'ouro', tamanho: [0.3, 0.07, 0.05], posicao: [0.2, 0.74, -0.6], inclina: 0.35 },
  // O cabelo: a base, o topete que cai para a frente e as duas laterais.
  { material: 'ouro', tamanho: [1.12, 0.25, 1.1], posicao: [0, 1.1, 0] },
  { material: 'ouro', tamanho: [0.95, 0.32, 0.78], posicao: [0, 1.3, -0.34], inclina: -0.3 },
  { material: 'ouro', tamanho: [0.13, 0.62, 0.9], posicao: [-0.56, 0.7, 0.02] },
  { material: 'ouro', tamanho: [0.13, 0.62, 0.9], posicao: [0.56, 0.7, 0.02] },
  { material: 'ouro', tamanho: [0.95, 0.4, 0.14], posicao: [0, 0.9, 0.55] },
];

/**
 * O quanto a máscara é maior que a cabeça (a caricatura exagera): 1,3×. A cabeça do Colossus tem 1,65 m numa máquina de 14 m, e a máscara no tamanho dela não se lia de longe. O grupo é
 * escalado em torno da base da cabeça e descido para o rosto continuar no meio dela.
 */
export const ESCALA_DA_MASCARA = 1.3;

/** O `?mascara=` do link: `0`, `off` ou `nao` tiram a máscara do chefe; ausente ou qualquer outro valor, ela fica. */
export function mascaraFromSearch(search: string): boolean {
  const valor = new URLSearchParams(search).get('mascara');
  return valor === null || !['0', 'off', 'nao', 'não'].includes(valor.toLowerCase());
}

/**
 * Veste a máscara na cabeça do chefe: procura o grupo `head` na raiz do corpo (o rig por blueprint nomeia a cabeça) e põe as peças dentro dele. Devolve quantas peças pôs (0 = não achou a
 * cabeça, e nada foi alterado). Idempotente: vestir duas vezes não duplica.
 */
export function aplicarMascaraDoChefe(raiz: THREE.Object3D): number {
  const cabeca = raiz.getObjectByName('head');
  if (!cabeca) return 0;
  if (cabeca.getObjectByName('mascara-do-chefe')) return 0;
  const { width, height, depth } = COLOSSUS_01_BLUEPRINT.head;
  const materiais: Record<Material, THREE.Material> = {
    laranja: new THREE.MeshStandardMaterial({ color: 0xff8a1e, metalness: 0.05, roughness: 0.7, emissive: 0x3a1700, emissiveIntensity: 0.6 }),
    ouro: new THREE.MeshStandardMaterial({ color: 0xffd23a, metalness: 0.25, roughness: 0.5, emissive: 0x4a3200, emissiveIntensity: 0.7 }),
    preto: new THREE.MeshStandardMaterial({ color: 0x120804, metalness: 0, roughness: 0.9 }),
  };
  const grupo = new THREE.Group();
  grupo.name = 'mascara-do-chefe';
  grupo.scale.setScalar(ESCALA_DA_MASCARA);
  grupo.position.y = -((ESCALA_DA_MASCARA - 1) / 2) * height; // o centro do rosto fica no centro da cabeça
  cabeca.add(grupo);
  for (const p of MASCARA_DO_CHEFE) {
    const m = box(grupo, p.tamanho[0] * width, p.tamanho[1] * height, p.tamanho[2] * depth, materiais[p.material], p.posicao[0] * width, p.posicao[1] * height, p.posicao[2] * depth);
    if (p.inclina) m.rotation.x = p.inclina;
  }
  return MASCARA_DO_CHEFE.length;
}
