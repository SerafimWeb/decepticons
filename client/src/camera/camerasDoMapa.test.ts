import { describe, expect, it } from 'vitest';
import { PRAIA_CFTV, praiaBlocks, type BlocoDaPraia } from '../environment/PraiaLayout';
import { PRAIA_LIMITES } from '../environment/PraiaTerreno';
import { CFTV_CABECA_Y, CFTV_LENTE, camerasDoMapa } from './camerasDoMapa';
import { DEFAULT_FIXED_CAMERAS } from './SpectatorCam';

interface Ponto { x: number; y: number; z: number }

/** O ponto está dentro de um bloco sólido (sem inclinação: os inclinados são adereços de borda e não entram na conta)? */
function dentroDeBloco(p: Ponto, b: BlocoDaPraia): boolean {
  if (!b.solid || b.rx || b.rz) return false;
  return Math.abs(p.x - b.x) < b.w / 2 && Math.abs(p.y - b.y) < b.h / 2 && Math.abs(p.z - b.z) < b.d / 2;
}

/** As torres de vigia (`PraiaAderecosCena.ts`: 241,7 e 311,7) têm o corpo de colisão de `PraiaAderecos.ts`: 4,2 × 9 × 4,2 m. */
const TORRES = [{ x: 241, z: 7 }, { x: 311, z: 7 }];
const dentroDeTorre = (p: Ponto): boolean => TORRES.some((t) => Math.abs(p.x - t.x) < 2.1 && Math.abs(p.z - t.z) < 2.1 && p.y > 0 && p.y < 9);

const solidos = praiaBlocks().filter((b) => b.solid);

describe('camerasDoMapa (P148)', () => {
  it('a Arena mantém as cinco câmeras de sempre; o bunker (interior) não tem câmera de cenário', () => {
    expect(camerasDoMapa('arena')).toBe(DEFAULT_FIXED_CAMERAS);
    expect(camerasDoMapa('bunker')).toEqual([]);
  });

  describe('praia', () => {
    const cams = camerasDoMapa('praia');

    it('tem portão, torre, teto da estação e hotel, com id e rótulo próprios', () => {
      expect(cams.length).toBeGreaterThanOrEqual(10);
      expect(new Set(cams.map((c) => c.id)).size).toBe(cams.length);
      for (const c of cams) expect(c.label.length).toBeGreaterThan(4);
      const rotulos = cams.map((c) => c.label).join('|');
      for (const parte of ['PORTÃO DO MAR', 'PORTÃO SUL', 'PORTÃO OESTE', 'TORRE DE VIGIA', 'TETO DA ESTAÇÃO', 'HOTEL']) expect(rotulos).toContain(parte);
    });

    it('devolve sempre a mesma lista (as posições nascem uma vez, G4)', () => {
      expect(camerasDoMapa('praia')).toBe(cams);
    });

    it('cada poste de CFTV que o jogador vê tem a câmera na frente da lente, com a lente apontando para onde a câmera olha', () => {
      for (const p of PRAIA_CFTV) {
        const c = cams.find((k) => k.label === p.nome);
        expect(c, p.nome).toBeDefined();
        // a 1,3 m do poste, na altura do braço (a lente aponta para o +x local, que o giro leva para (cos g, -sin g))
        expect(Math.hypot(c!.position.x - p.x, c!.position.z - p.z), p.nome).toBeCloseTo(CFTV_LENTE, 5);
        expect(c!.position.y, p.nome).toBeCloseTo(CFTV_CABECA_Y, 5);
        const lenteX = Math.cos(p.giro);
        const lenteZ = -Math.sin(p.giro);
        const alvoX = c!.lookAt.x - p.x;
        const alvoZ = c!.lookAt.z - p.z;
        const cos = (lenteX * alvoX + lenteZ * alvoZ) / Math.hypot(alvoX, alvoZ);
        expect(cos, `${p.nome}: a lente não aponta para o alvo`).toBeGreaterThan(0.9999);
      }
    });

    it('nenhuma câmera nasce dentro de uma parede ou de uma torre, nem olha para dentro de uma', () => {
      for (const c of cams) {
        for (const b of solidos) {
          expect(dentroDeBloco(c.position, b), `${c.label}: câmera dentro do bloco ${b.kind} em (${b.x}, ${b.z})`).toBe(false);
          expect(dentroDeBloco(c.lookAt, b), `${c.label}: olha para dentro do bloco ${b.kind} em (${b.x}, ${b.z})`).toBe(false);
        }
        expect(dentroDeTorre(c.position), `${c.label}: câmera dentro do corpo da torre`).toBe(false);
      }
    });

    it('a visão está livre nos primeiros 12 m: nenhuma parede, torre ou telhado na frente da lente (o que o olho viu torto na captura)', () => {
      for (const c of cams) {
        const dist = c.position.distanceTo(c.lookAt);
        const passo = 0.25;
        const ate = Math.min(dist, 12);
        for (let d = 0.5; d <= ate; d += passo) {
          const t = d / dist;
          const p = {
            x: c.position.x + (c.lookAt.x - c.position.x) * t,
            y: c.position.y + (c.lookAt.y - c.position.y) * t,
            z: c.position.z + (c.lookAt.z - c.position.z) * t,
          };
          for (const b of solidos) expect(dentroDeBloco(p, b), `${c.label}: a ${d.toFixed(2)} m da câmera há ${b.kind} em (${b.x}, ${b.z}) na frente da lente`).toBe(false);
          expect(dentroDeTorre(p), `${c.label}: a ${d.toFixed(2)} m da câmera há uma torre na frente da lente`).toBe(false);
        }
      }
    });

    it('todas ficam dentro do mapa, olham para um ponto a mais de 8 m e não apontam para o céu', () => {
      for (const c of cams) {
        for (const p of [c.position, c.lookAt]) {
          expect(p.x, c.label).toBeGreaterThan(PRAIA_LIMITES.minX);
          expect(p.x, c.label).toBeLessThan(PRAIA_LIMITES.maxX);
          expect(p.z, c.label).toBeGreaterThan(PRAIA_LIMITES.minZ);
          expect(p.z, c.label).toBeLessThan(PRAIA_LIMITES.maxZ);
        }
        expect(c.position.distanceTo(c.lookAt), c.label).toBeGreaterThan(8);
        expect(c.lookAt.y, c.label).toBeLessThanOrEqual(c.position.y);
      }
    });
  });
});
