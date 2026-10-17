import {
  AMAZONIA_ALDEIA,
  AMAZONIA_MINA,
  AMAZONIA_PLANTA,
  AMAZONIA_REJEITOS,
  larguraDoRio,
  NIVEL_DA_AGUA,
  rioEmX,
} from './AmazoniaLayout';

/**
 * A COR DO CHÃO DA AMAZÔNIA (P180, parte B): função pura por ponto (zona, altura, lama, laterita), lida pela malha na montagem. Devolve a cor (RGB, 0 a 1) e a **vida** (0 a 1) do ponto:
 * a vida é o quanto aquele chão **morre** quando a frente do rio passa (vegetação 1; pedra, concreto, lama do leito e a lagoa 0): o shader (`AmazoniaMateriais.patchMorteDoRio`) lê essa vida.
 */
export interface CorDoChao {
  r: number;
  g: number;
  b: number;
  vida: number;
}

const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);
const suave = (t: number): number => {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
};
const mistura = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Um ruído barato e estável (sem aleatório do sistema) em [0, 1]. */
const ruido = (x: number, z: number): number => 0.5 + 0.25 * Math.sin(x * 0.13 + Math.sin(z * 0.09) * 2.1) + 0.25 * Math.sin(z * 0.17 - x * 0.07 + 1.3);

/** Escreve em `saida` a cor do chão em (x, z), com `h` a altura do terreno ali e `declive` o declive local (0 chão plano, 1 a 45°). */
export function corDoChao(x: number, z: number, h: number, declive: number, saida: CorDoChao): CorDoChao {
  const n = ruido(x, z);
  // 1. O chão de floresta: verde escuro e úmido, mais claro nos altos.
  let r = mistura(0.05, 0.075, n);
  let g = mistura(0.1, 0.17, n) + 0.012 * clamp01(h / 14);
  let b = mistura(0.026, 0.05, n);
  let vida = 1;

  // 2. A margem e o leito do rio: lama marrom na beira, areia e lama no fundo (não morrem).
  const d = Math.abs(z - rioEmX(x));
  const meia = larguraDoRio(x) / 2;
  const beira = 1 - suave((d - meia) / 16);
  if (beira > 0) {
    r = mistura(r, 0.3, beira * 0.85);
    g = mistura(g, 0.22, beira * 0.85);
    b = mistura(b, 0.13, beira * 0.85);
    vida = mistura(vida, 0.25, beira);
  }
  if (h < NIVEL_DA_AGUA) {
    const fundo = clamp01((NIVEL_DA_AGUA - h) / 3);
    r = mistura(r, 0.34, 0.6 + 0.3 * fundo);
    g = mistura(g, 0.3, 0.6 + 0.3 * fundo);
    b = mistura(b, 0.2, 0.6 + 0.3 * fundo);
    vida = 0;
  }

  // 3. A cava da mina: laterita vermelha com degraus escuros nas paredes e o fundo cinza-lama.
  const m = AMAZONIA_MINA;
  const dm = Math.hypot(x - m.x, z - m.z);
  const naCava = 1 - suave((dm - m.raio * 0.9) / (m.raio * 0.6));
  if (naCava > 0) {
    const degrau = 0.5 + 0.5 * Math.sin(dm / 11);
    const fundo = 1 - suave(dm / (m.raio * 0.4));
    const lr = mistura(0.52, 0.36, degrau * 0.6);
    const lg = mistura(0.22, 0.15, degrau * 0.6);
    const lb = mistura(0.12, 0.09, degrau * 0.6);
    r = mistura(r, mistura(lr, 0.3, fundo * 0.7), naCava);
    g = mistura(g, mistura(lg, 0.26, fundo * 0.7), naCava);
    b = mistura(b, mistura(lb, 0.22, fundo * 0.7), naCava);
    vida = mistura(vida, 0, naCava);
  }

  // 4. O pátio da planta (concreto sujo, com a terra vermelha em volta) e a lagoa de rejeitos (a bacia negra).
  const p = AMAZONIA_PLANTA;
  const dpx = Math.max(0, Math.abs(x - p.x) - p.comprimento / 2);
  const dpz = Math.max(0, Math.abs(z - p.z) - p.largura / 2);
  const naPlanta = 1 - suave(Math.hypot(dpx, dpz) / 18);
  if (naPlanta > 0) {
    const cinza = mistura(0.36, 0.42, n);
    r = mistura(r, cinza + 0.04, naPlanta);
    g = mistura(g, cinza, naPlanta);
    b = mistura(b, cinza - 0.03, naPlanta);
    vida = mistura(vida, 0, naPlanta);
  }
  const rj = AMAZONIA_REJEITOS;
  const er = Math.hypot((x - rj.x) / rj.rx, (z - rj.z) / rj.rz);
  const naLagoa = 1 - suave((er - 0.9) / 0.5);
  if (naLagoa > 0) {
    r = mistura(r, 0.07, naLagoa);
    g = mistura(g, 0.055, naLagoa);
    b = mistura(b, 0.05, naLagoa);
    vida = mistura(vida, 0, naLagoa);
  }

  // 5. A aldeia: terra batida clara no terreiro.
  const a = AMAZONIA_ALDEIA;
  const naAldeia = 1 - suave((Math.hypot(x - a.x, z - a.z) - a.raio * 0.7) / (a.raio * 0.5));
  if (naAldeia > 0) {
    r = mistura(r, mistura(0.52, 0.46, n), naAldeia * 0.9);
    g = mistura(g, mistura(0.4, 0.34, n), naAldeia * 0.9);
    b = mistura(b, mistura(0.25, 0.2, n), naAldeia * 0.9);
    vida = mistura(vida, 0.3, naAldeia);
  }

  // 6. Encosta íngreme: terra e pedra aparecem por baixo do verde.
  const rocha = suave((declive - 0.28) / 0.3);
  if (rocha > 0) {
    r = mistura(r, 0.34, rocha * 0.7);
    g = mistura(g, 0.28, rocha * 0.7);
    b = mistura(b, 0.2, rocha * 0.7);
    vida *= 1 - rocha * 0.6;
  }

  saida.r = r;
  saida.g = g;
  saida.b = b;
  saida.vida = vida;
  return saida;
}
