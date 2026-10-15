import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PRAIA_ZONES } from './PraiaLayout';
import { PraiaZonas, zonasDaPraia } from './PraiaZonas';
import { criarUniformes } from './PraiaUniformes';
import { alturaDoChao } from './PraiaTerreno';

describe('o chão das zonas de vantagem da praia (P127, rodada de luz)', () => {
  it('cada zona da regra (`PRAIA_ZONES`) ganha o desenho dela, no mesmo lugar e com o mesmo raio, sobre o chão', () => {
    const zonas = zonasDaPraia();
    expect(zonas.length).toBe(PRAIA_ZONES.length);
    zonas.forEach((z, i) => {
      const regra = PRAIA_ZONES[i]!;
      expect(z.x).toBe(regra.x);
      expect(z.z).toBe(regra.z);
      expect(z.radius, 'o aro desenhado é o limite da regra').toBe(regra.radius);
      expect(z.kind).toBe(regra.kind);
      expect(z.y, 'sobre o chão').toBeGreaterThan(alturaDoChao(z.x, z.z));
      expect(z.y, 'e rente a ele').toBeLessThan(0.3);
    });
  });

  it('há cura e resfriamento, cada um com a sua cor; o chão é um desenho e a cortina é outro', () => {
    const tipos = new Set(zonasDaPraia().map((z) => z.kind));
    expect(tipos.has('heal')).toBe(true);
    expect(tipos.has('cool')).toBe(true);
    const cena = new THREE.Scene();
    new PraiaZonas(cena, criarUniformes());
    const malhas = cena.children.filter((c): c is THREE.Mesh => c instanceof THREE.Mesh);
    expect(malhas.length, 'dois desenhos para as quatro zonas').toBe(2);
    const material = malhas[0]!.material as THREE.ShaderMaterial;
    expect(material.uniforms.uCura).toBeDefined();
    expect(material.uniforms.uFrio).toBeDefined();
    expect(material.uniforms.uTempo, 'o tempo é o mesmo da praia: sem CPU por quadro').toBeDefined();
  });

  it('a qualidade baixa desliga a cortina e deixa o chão (é a informação do jogo)', () => {
    const cena = new THREE.Scene();
    const zonas = new PraiaZonas(cena, criarUniformes());
    const [chao, cortina] = cena.children as THREE.Mesh[];
    zonas.setDetalhe(false);
    expect(chao!.visible).toBe(true);
    expect(cortina!.visible).toBe(false);
    zonas.setDetalhe(true);
    expect(cortina!.visible).toBe(true);
  });
});
