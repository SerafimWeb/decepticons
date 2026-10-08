import * as THREE from 'three';
import { expect, it } from 'vitest';
import { PALETTE } from '../core/palette';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { Arena } from './Arena';
import { buildFloorTexture, buildSkyTexture, FLOOR_PLATES, FLOOR_TEX_SIZE, skyColorAt } from './Atmosphere';
import { Destructibles } from './Destructibles';

const rgb = (hex: number): number[] => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const luma = (c: ArrayLike<number>): number => c[0]! * 0.2126 + c[1]! * 0.7152 + c[2]! * 0.0722;

it('o céu vai do brilho do horizonte ao zênite quase preto, sempre escurecendo para cima', () => {
  expect(skyColorAt(0)).toEqual(rgb(PALETTE.skyHorizon));
  expect(skyColorAt(90)).toEqual(rgb(PALETTE.skyZenith));
  let previous = Infinity;
  for (let deg = 0; deg <= 90; deg += 3) {
    const l = luma(skyColorAt(deg));
    expect(l, `${deg}°`).toBeLessThanOrEqual(previous + 1e-9);
    previous = l;
  }
  // Abaixo do horizonte o chão cobre o céu: a cor é a da névoa, para o fim do chão se fundir com o horizonte.
  expect(skyColorAt(-30)).toEqual(rgb(PALETTE.fog));
  // As torres do horizonte saem da névoa e precisam ser mais claras que o céu acima delas, senão somem (o defeito que
  // motivou a atmosfera: céu, névoa e chão quase pretos).
  expect(luma(rgb(PALETTE.fog))).toBeGreaterThan(luma(rgb(PALETTE.skyUpper)) * 2);
});

it('a imagem do céu é o degradê de baixo (nadir) para cima (zênite), no mapeamento equirretangular', () => {
  const tex = buildSkyTexture();
  const { width, height, data } = tex.image as { width: number; height: number; data: Uint8Array };
  expect(tex.mapping).toBe(THREE.EquirectangularReflectionMapping);
  expect(data.length).toBe(width * height * 4);
  const pixel = (row: number): number[] => [...data.slice(row * width * 4, row * width * 4 + 3)];
  const near = (a: number[], b: number[], tol = 6) => a.every((v, i) => Math.abs(v - b[i]!) <= tol);
  expect(near(pixel(0), rgb(PALETTE.fog))).toBe(true);
  expect(near(pixel(height - 1), rgb(PALETTE.skyZenith))).toBe(true);
  // O brilho máximo está logo acima do meio da imagem (o horizonte).
  let brightest = 0;
  for (let r = 1; r < height; r++) if (luma(pixel(r)) > luma(pixel(brightest))) brightest = r;
  expect(Math.abs(brightest - height / 2)).toBeLessThanOrEqual(3);
});

it('o chão é determinístico, tem juntas escuras e é ladrilhável', () => {
  const a = buildFloorTexture();
  const b = buildFloorTexture();
  const data = (a.image as { data: Uint8Array }).data;
  expect(data.length).toBe(FLOOR_TEX_SIZE * FLOOR_TEX_SIZE * 4);
  expect(Buffer.compare(Buffer.from(data), Buffer.from((b.image as { data: Uint8Array }).data))).toBe(0);
  expect(Buffer.compare(Buffer.from(data), Buffer.from((buildFloorTexture(7).image as { data: Uint8Array }).data))).not.toBe(0);

  const at = (x: number, y: number): number => data[(y * FLOOR_TEX_SIZE + x) * 4]!;
  const plate = FLOOR_TEX_SIZE / FLOOR_PLATES;
  // Média do miolo da primeira placa contra a junta que a cerca.
  let core = 0;
  let n = 0;
  for (let y = 12; y < plate - 12; y++) for (let x = 12; x < plate - 12; x++, n++) core += at(x, y);
  core /= n;
  expect(at(plate - 1, plate / 2)).toBeLessThan(core * 0.6); // junta entre placas
  expect(at(0, plate / 2)).toBeLessThan(core * 0.6); // borda da imagem: a junta continua no ladrilho vizinho
  expect(at(FLOOR_TEX_SIZE - 1, plate / 2)).toBeLessThan(core * 0.6);
  expect(a.wrapS).toBe(THREE.RepeatWrapping);
});

it('a Arena monta o céu e o chão com textura também no Node (partida sem tela)', async () => {
  const physics = await PhysicsWorld.create();
  const scene = new THREE.Scene();
  const particles = { burst: () => {} } as never;
  const debris = { shatter: () => {} } as never;
  new Arena(scene, physics, new Destructibles(scene, physics, debris, particles));
  expect(scene.background).toBeInstanceOf(THREE.DataTexture);
  const floor = scene.children.find(
    (o): o is THREE.Mesh => o instanceof THREE.Mesh && (o.geometry as THREE.PlaneGeometry).parameters?.width === 704,
  );
  expect(floor).toBeDefined();
  expect((floor!.material as THREE.MeshStandardMaterial).map).toBeInstanceOf(THREE.DataTexture);
  // 704 m / 8 m = 88 ladrilhos: a origem cai numa junta e as placas de 4 m casam com a grade.
  expect((floor!.material as THREE.MeshStandardMaterial).map!.repeat.x).toBe(88);
});
