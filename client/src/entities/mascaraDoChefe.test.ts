import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { COLOSSUS_BOSS_STATS } from './chassis';
import { aplicarMascaraDoChefe, ESCALA_DA_MASCARA, MASCARA_DO_CHEFE, mascaraFromSearch } from './mascaraDoChefe';
import { COLOSSUS_01_BLUEPRINT } from './mechBlueprint';
import { Vector09 } from './Vector09';

const colossus = (): Vector09 => new Vector09({ stats: COLOSSUS_BOSS_STATS, blueprint: COLOSSUS_01_BLUEPRINT });

describe('a MÁSCARA DO CHEFE (P165): a caricatura que só o Colossus da missão veste, e que se desliga', () => {
  it('o link manda: sem o parâmetro ela entra; ?mascara=0, off ou nao a tiram', () => {
    expect(mascaraFromSearch('')).toBe(true);
    expect(mascaraFromSearch('?mapa=praia')).toBe(true);
    expect(mascaraFromSearch('?mascara=1')).toBe(true);
    expect(mascaraFromSearch('?mascara=0')).toBe(false);
    expect(mascaraFromSearch('?mascara=off')).toBe(false);
    expect(mascaraFromSearch('?mascara=OFF')).toBe(false);
    expect(mascaraFromSearch('?mascara=nao')).toBe(false);
    expect(mascaraFromSearch('?modo=survival&mascara=0&onda=6')).toBe(false);
  });

  it('veste a cabeça do Colossus: um grupo com todas as peças da tabela, dentro do grupo `head`, e devolve quantas pôs', () => {
    const c = colossus();
    expect(aplicarMascaraDoChefe(c.root)).toBe(MASCARA_DO_CHEFE.length);
    const cabeca = c.root.getObjectByName('head')!;
    const grupo = cabeca.getObjectByName('mascara-do-chefe')!;
    expect(grupo).toBeDefined();
    expect(grupo.parent).toBe(cabeca);
    expect(grupo.children).toHaveLength(MASCARA_DO_CHEFE.length);
  });

  it('o desenho: o rosto laranja fica na FRENTE da cabeça (z negativo, além dela), o cabelo dourado no alto, e o conjunto é maior que a cabeça', () => {
    const c = colossus();
    aplicarMascaraDoChefe(c.root);
    const { width, height, depth } = COLOSSUS_01_BLUEPRINT.head;
    const grupo = c.root.getObjectByName('mascara-do-chefe')!;
    const pecas = grupo.children as THREE.Mesh[];
    const laranja = pecas.filter((m) => (m.material as THREE.MeshStandardMaterial).color.getHex() === 0xff8a1e);
    const ouro = pecas.filter((m) => (m.material as THREE.MeshStandardMaterial).color.getHex() === 0xffd23a);
    expect(laranja).toHaveLength(2); // a placa do rosto e o nariz
    expect(ouro.length).toBeGreaterThanOrEqual(4); // o topete, a base, as laterais e as sobrancelhas
    const largura = (m: THREE.Mesh): number => {
      const caixa = new THREE.Box3().setFromObject(m);
      return caixa.max.x - caixa.min.x;
    };
    const [placa, nariz] = [...laranja].sort((a, b) => largura(b) - largura(a)); // a placa é a mais larga
    expect(placa!.position.z).toBeLessThan(-depth / 2); // na frente
    expect(nariz!.position.z, 'o nariz salta para a frente da placa').toBeLessThan(placa!.position.z);
    expect(placa!.position.y).toBeGreaterThan(0);
    expect(placa!.position.y).toBeLessThan(height);
    expect(Math.max(...ouro.map((m) => m.position.y))).toBeGreaterThan(height); // o cabelo passa do topo da cabeça
    const caixa = new THREE.Box3().setFromObject(grupo);
    expect(caixa.max.x - caixa.min.x).toBeGreaterThan(width * ESCALA_DA_MASCARA); // o conjunto é mais largo que a cabeça, e exagerado
    expect(ESCALA_DA_MASCARA).toBeGreaterThan(1);
    // o centro do rosto continua no meio da cabeça, mesmo com a máscara maior
    const centroDoRosto = placa!.position.y * ESCALA_DA_MASCARA + grupo.position.y;
    expect(centroDoRosto).toBeCloseTo(height * 0.5, 6);
    // as fendas dos olhos e da boca ficam na frente da placa (mais para a frente que ela)
    const pretos = pecas.filter((m) => (m.material as THREE.MeshStandardMaterial).color.getHex() === 0x120804);
    expect(pretos).toHaveLength(3);
    for (const p of pretos) expect(p.position.z).toBeLessThan(placa!.position.z);
  });

  it('é idempotente (vestir duas vezes não duplica) e não quebra num corpo sem cabeça', () => {
    const c = colossus();
    expect(aplicarMascaraDoChefe(c.root)).toBeGreaterThan(0);
    expect(aplicarMascaraDoChefe(c.root)).toBe(0);
    expect(c.root.getObjectByName('head')!.children.filter((o) => o.name === 'mascara-do-chefe')).toHaveLength(1);
    expect(aplicarMascaraDoChefe(new THREE.Group())).toBe(0);
  });

  it('só quem recebe a chamada a veste: o Colossus que o jogador monta no Hangar não tem máscara', () => {
    const doHangar = colossus();
    expect(doHangar.root.getObjectByName('mascara-do-chefe')).toBeUndefined();
  });
});
