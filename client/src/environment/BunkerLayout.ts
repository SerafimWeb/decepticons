export const BUNKER_LEVELS = [0, 14, 28, 42] as const;
export const BUNKER_LIFTS = [[-77, 77], [77, 77], [77, -77], [-77, -77]] as const;
export const BUNKER_SPAWNS: readonly (readonly [number, number])[] = [
  [0, 43], [-38, 40], [38, -40], [38, 40], [-38, -40],
  [-80, 40], [80, -40], [0, -80], [-80, 0], [80, 0], [0, 80], [-80, -40],
];
export interface BunkerBlock {
  x: number; y: number; z: number; w: number; h: number; d: number;
  rx: number; rz: number; kind: 'concrete' | 'steel' | 'tunnel' | 'light' | 'amber' | 'red' | 'sniper';
  solid: boolean;
}
interface Rect { x0: number; x1: number; z0: number; z1: number; }
const rect = (x0: number, x1: number, z0: number, z1: number): Rect => ({ x0, x1, z0, z1 });

/** Recorta aberturas antes de gerar piso ou colisor. */
function cut(pieces: Rect[], hole: Rect): Rect[] {
  const result: Rect[] = [];
  for (const p of pieces) {
    const a = Math.max(p.x0, hole.x0), b = Math.min(p.x1, hole.x1);
    const c = Math.max(p.z0, hole.z0), d = Math.min(p.z1, hole.z1);
    if (a >= b || c >= d) { result.push(p); continue; }
    if (p.x0 < a) result.push(rect(p.x0, a, p.z0, p.z1));
    if (b < p.x1) result.push(rect(b, p.x1, p.z0, p.z1));
    if (p.z0 < c) result.push(rect(a, b, p.z0, c));
    if (d < p.z1) result.push(rect(a, b, d, p.z1));
  }
  return result;
}

/**
 * Quatro patamares separados por 14 m dentro de um poço aberto de 58 m. Rampas
 * largas carregam a colisão; as chapas transversais desenham degraus sem criar
 * ressaltos no controller. A cena toda é estática.
 */
export function bunkerBlocks(): BunkerBlock[] {
  const out: BunkerBlock[] = [];
  const box = (x: number, y: number, z: number, w: number, h: number, d: number,
    kind: BunkerBlock['kind'] = 'concrete', solid = true, rx = 0, rz = 0) => out.push({ x, y, z, w, h, d, kind, solid, rx, rz });

  // Fundo rochoso. Um colar largo e irregular à cota da superfície faz o corte
  // do terreno parecer escavado; o miolo permanece aberto para ver o fundo.
  box(0, -1, 0, 180, 2, 180);
  for (const s of [-1, 1]) {
    box(s * 89, 28, 0, 4, 60, 184, 'tunnel');
    box(0, 28, s * 89, 176, 60, 4, 'tunnel');
    box(s * 89, 57, 0, 8, 1.2, 184, 'concrete');
    box(0, 57, s * 89, 176, 1.2, 8, 'concrete');
    // Estratos quebrados do corte de terra, em faixas grandes e sem textura.
    for (const y of [48, 54]) {
      box(s * 86.7, y, 0, 0.7, 0.45, 168, 'amber', false);
      box(0, y - 1, s * 86.7, 168, 0.45, 0.7, 'red', false);
    }
  }

  // Átrio de queda central, quatro vãos de acesso e quatro poços de elevador.
  const holes = [rect(-29, 29, -34, 34)];
  for (const s of [-1, 1]) {
    holes.push(rect(s * 36 - 8, s * 36 + 8, -28.25, 28.25));
    holes.push(rect(-28.25, 28.25, s * 69 - 8, s * 69 + 8));
  }
  for (const [x, z] of BUNKER_LIFTS) holes.push(rect(x - 6.5, x + 6.5, z - 6.5, z + 6.5));

  for (const y of BUNKER_LEVELS) {
    if (y > 0) {
      let pieces = [rect(-87, 87, -87, 87)];
      for (const hole of holes) pieces = cut(pieces, hole);
      for (const p of pieces) box((p.x0 + p.x1) / 2, y - 0.75, (p.z0 + p.z1) / 2, p.x1 - p.x0, 1.5, p.z1 - p.z0);
    }

    // Galerias em cruz: pilares de concreto e vãos largos de combate.
    for (const s of [-1, 1]) {
      // As aberturas laterais coincidem com as rampas. No terceiro patamar,
      // um vão estreito adicional se esconde na parede do corredor secreto.
      const spansX = y === 28
        ? [[-88, -72], [-58, -45], [-35, -14], [14, 58], [72, 88]] as const
        : y === 42
          ? [[-88, -72], [-58, -52], [-42, -14], [14, 42], [52, 58], [72, 88]] as const
          : [[-88, -72], [-58, -14], [14, 58], [72, 88]] as const;
      const spansZ = y === 42
        ? [[-88, -72], [-30, -8], [8, 30], [72, 88]] as const
        : [[-88, -72], [-58, -44], [-30, -8], [8, 30], [44, 58], [72, 88]] as const;
      for (const [a, b] of spansX) {
        box(s * 48, y + 6.5, (a + b) / 2, 4, 13, b - a, 'concrete');
      }
      for (const [a, b] of spansZ) {
        box((a + b) / 2, y + 6.5, s * 52, b - a, 13, 4, 'concrete');
      }
      for (const t of [-40, 0, 40]) {
        box(s * 48, y + 11.5, t, 4, 3, 16, 'steel');
        box(t, y + 11.5, s * 52, 16, 3, 4, 'steel');
        for (const e of [-8.4, 8.4]) {
          box(s * 45.8, y + 4.8, t + e, 0.5, 9.5, 0.8, 'steel', false);
          box(t + e, y + 4.8, s * 49.8, 0.8, 9.5, 0.5, 'steel', false);
        }
        box(s * 45.5, y + 9.7, t, 0.2, 0.3, 15, 'light', false);
        box(t, y + 9.7, s * 49.5, 15, 0.3, 0.2, 'light', false);
      }

      // Costelas e guias de rota nas galerias profundas. Sem luz dinâmica:
      // duas faixas emissivas contínuas bastam para orientar no escuro.
      for (const t of [-70, -40, 0, 40, 70]) {
        box(s * 81, y + 11.65, t, 1.5, 0.2, 5, 'light', false);
        box(t, y + 11.65, s * 82, 5, 0.2, 1.5, 'light', false);
      }
      for (const t of [-22, 22]) {
        box(s * 28.5, y + 0.7, t, 1, 1.4, 14, 'steel');
        box(t * 0.85, y + 0.7, s * 32.5, 12, 1.4, 1, 'steel');
        box(s * 28.5, y + 1.43, t, 1.05, 0.12, 14, 'amber', false);
        box(t * 0.85, y + 1.43, s * 32.5, 12, 0.12, 1.05, 'amber', false);
      }

      // Elevadores: poços contínuos, trilhos, cabos e uma cabine em cada patamar.
      // O acesso entre cotas fica garantido pelas rampas largas logo adiante.
      for (const [x, z] of BUNKER_LIFTS) {
        if (y > 0) {
          box(x, y + 0.35, z, 10, 0.35, 10, 'steel', false);
          box(x, y + 0.56, z + 4.65, 9, 0.08, 0.18, 'amber', false);
        }
      }
    }

    if (y < 42) {
      // Oito subidas por trecho: quatro rampas opostas em torno do poço.
      const slope = Math.atan2(14, 56), run = Math.hypot(14, 56);
      for (const s of [-1, 1]) {
        // O controle avança para -Z; a rampa sobe nessa direção nos dois lados.
        const xRampZ = slope;
        const zRampX = s * slope;
        const deckY = y + 7 - Math.cos(slope) * 0.5;
        box(s * 36, deckY, -Math.sin(slope) * 0.5, 14, 1, run, 'steel', true, xRampZ);
        box(0, deckY, s * 69, run, 1, 14, 'steel', true, 0, zRampX);
        // Degraus de chapa são só desenho; a superfície contínua abaixo mantém
        // a subida suave para o character controller e os Mechs pesados.
        const treadCount = 14;
        for (let i = 0; i < treadCount; i++) {
          const u = (i + 0.5) / treadCount - 0.5;
          const along = u * 56;
          const rise = u * 14;
          box(s * 36, y + 7 - rise, along, 14, 0.12, 0.42, 'amber', false, xRampZ);
          box(along, y + 7 + s * rise, s * 69, 0.42, 0.12, 14, 'amber', false, 0, zRampX);
        }
      }
    }
  }

  // Passarelas estreitas alternadas sobre o vazio: no primeiro salto o eixo é
  // leste-oeste; no segundo, norte-sul. Cobertura pouca, leitura longa.
  box(0, 13.25, 0, 58, 1.5, 10, 'steel');
  box(0, 27.25, 0, 10, 1.5, 68, 'steel');
  for (const s of [-1, 1]) {
    box(0, 14.65, s * 5, 54, 1.3, 0.6, 'steel');
    box(s * 5, 28.65, 0, 0.6, 1.3, 64, 'steel');
    box(0, 15.34, s * 5, 54, 0.1, 0.65, 'amber', false);
    box(s * 5, 29.34, 0, 0.65, 0.1, 64, 'amber', false);
  }

  // Postos de atirador no último nível: blindagem lateral, fresta para o átrio,
  // faixa vermelha de ameaça e uma posição recuada para quebrar o contra-tiro.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * 57, z = sz * 57;
    box(x, 42.3, z, 20, 0.6, 18, 'sniper');
    box(x + sx * 5, 45, z, 1, 4, 18, 'steel');
    box(x, 45, z + sz * 4.5, 20, 4, 1, 'steel');
    box(x + sx * 9, 45, z + sz * 7, 1, 4, 4, 'steel');
    box(x + sx * 4, 43.35, z - sz * 7.5, 8, 0.12, 0.35, 'red', false);
    // Paredes de abrigo na base e máquinas no átrio criam pontos de avanço.
    box(x - sx * 8, 44.2, z + sz * 6, 3, 2.4, 3, 'steel');
  }
  for (const [x, z] of BUNKER_LIFTS) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(x + sx * 6.9, 28, z + sz * 6.9, 0.8, 56, 0.8, 'steel', false);
    box(x + sx * 6.9, 28, z + sz * 6.42, 0.16, 55, 0.12, 'amber', false);
  }
  for (const x of [-16, 16]) for (const z of [-18, 18]) {
    box(x, 2, z, 7, 4, 5, 'steel');
    box(x, 4.04, z, 7, 0.12, 0.5, 'amber', false);
  }

  // Acesso secreto: corredor baixo e sem luz direta atrás do pilar leste no
  // segundo subsolo. A entrada estreita, em sombra, liga duas galerias.
  const secretY = 28;
  box(52.5, secretY + 4, -45, 11, 8, 2, 'tunnel');
  box(75.5, secretY + 4, -45, 11, 8, 2, 'tunnel');
  box(64, secretY + 4, -35, 34, 8, 2, 'tunnel');
  box(64, secretY + 7.5, -40, 34, 1, 9, 'tunnel');
  box(64, secretY + 0.35, -40, 34, 0.7, 9, 'tunnel');
  // Selo visual que parece parte da parede até o piloto chegar perto.
  for (const x of [48.6, 79.4]) {
    box(x, secretY + 3.2, -44.2, 0.35, 6.4, 0.45, 'steel', false);
    box(x, secretY + 3.2, -35.8, 0.35, 6.4, 0.45, 'steel', false);
    box(x, secretY + 6.4, -40, 0.2, 0.18, 7, 'amber', false);
  }

  // Treliças altas e cabos expostos reforçam a profundidade do poço sem teto.
  for (const x of [-82, 82]) for (const z of [-82, 82]) box(x, 28, z, 2.5, 56, 2.5, 'steel');
  for (const x of [-72, -36, 0, 36, 72]) box(x, 53.5, 0, 1.4, 3, 176, 'steel');
  for (const z of [-70, -35, 0, 35, 70]) box(0, 52.5, z, 176, 1.4, 2, 'steel');
  return out;
}
