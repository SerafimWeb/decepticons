import { describe, expect, it } from 'vitest';
import {
  comprarPintura,
  corDaPintura,
  MASCARA_PINTURAS,
  possuiPintura,
  PINTURAS,
  pinturaValida,
  precoDaPintura,
  QUANTIDADE_PINTURAS,
  unirPinturas,
} from './pinturas';

/** Matiz (graus) e saturação de uma cor 0xRRGGBB: para checar que nenhuma cor do casco é o vermelho do inimigo. */
function matizESaturacao(cor: number): { matiz: number; saturacao: number } {
  const r = ((cor >> 16) & 255) / 255;
  const g = ((cor >> 8) & 255) / 255;
  const b = (cor & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return { matiz: (h * 60 + 360) % 360, saturacao: max === 0 ? 0 : d / max };
}

describe('o catálogo de cores do casco (P305)', () => {
  it('a primeira é a de fábrica: grátis, sem cor própria (o chassi mantém o visual dele)', () => {
    expect(PINTURAS[0]).toMatchObject({ id: 'fabrica', cor: null, preco: 0 });
    expect(corDaPintura(0)).toBeNull();
  });

  it('ids e nomes únicos, preços inteiros não negativos, cores inteiras de 24 bits', () => {
    expect(new Set(PINTURAS.map((p) => p.id)).size).toBe(PINTURAS.length);
    expect(new Set(PINTURAS.map((p) => p.nome)).size).toBe(PINTURAS.length);
    for (const p of PINTURAS) {
      expect(Number.isInteger(p.preco) && p.preco >= 0, p.id).toBe(true);
      if (p.cor !== null) expect(Number.isInteger(p.cor) && p.cor >= 0 && p.cor <= 0xffffff, p.id).toBe(true);
    }
  });

  it('nenhuma cor é o vermelho do inimigo nem o verde do visor do jogador (a leitura do combate não se perde)', () => {
    for (const p of PINTURAS) {
      if (p.cor === null) continue;
      expect(p.cor, p.id).not.toBe(0xff2d3d); // PALETTE.signal: as IAs rebeldes
      expect(p.cor, p.id).not.toBe(0x39ff6a); // PALETTE.green: o visor do jogador
      const { matiz, saturacao } = matizESaturacao(p.cor);
      const vermelhoVivo = (matiz >= 340 || matiz <= 20) && saturacao >= 0.5;
      expect(vermelhoVivo, `${p.id} é vermelho vivo`).toBe(false);
    }
  });

  it('a máscara de posse cobre exatamente as cores do catálogo', () => {
    expect(MASCARA_PINTURAS).toBe(2 ** QUANTIDADE_PINTURAS - 1);
  });
});

describe('a posse e a compra', () => {
  it('índice válido é inteiro de 0 a QUANTIDADE - 1; o resto não é cor', () => {
    for (let i = 0; i < QUANTIDADE_PINTURAS; i++) expect(pinturaValida(i)).toBe(true);
    for (const x of [-1, QUANTIDADE_PINTURAS, 1.5, NaN, '1', undefined, null]) expect(pinturaValida(x), String(x)).toBe(false);
  });

  it('a de fábrica é sempre do piloto, mesmo sem nenhum bit; as outras só com o bit ligado', () => {
    expect(possuiPintura(0, 0)).toBe(true);
    expect(possuiPintura(0, 1)).toBe(false);
    expect(possuiPintura(0b10, 1)).toBe(true);
    expect(possuiPintura(0b10, 2)).toBe(false);
    expect(possuiPintura(0b10, 99)).toBe(false);
  });

  it('a união dos aparelhos junta os bits e não passa do catálogo', () => {
    expect(unirPinturas(0b001, 0b100)).toBe(0b101);
    expect(unirPinturas(0b011, 0b010)).toBe(0b011);
    expect(unirPinturas(0, 2 ** 20)).toBe(0);
  });

  it('comprar debita o preço, liga o bit e devolve o que sobra', () => {
    const preco = precoDaPintura(1);
    expect(preco).toBeGreaterThan(0);
    expect(comprarPintura(0, 1, preco + 50)).toEqual({ bits: 0b10, creditos: 50 });
  });

  it('Créditos exatos bastam; Créditos a menos não', () => {
    const preco = precoDaPintura(2);
    expect(comprarPintura(0, 2, preco)).toEqual({ bits: 0b100, creditos: 0 });
    expect(comprarPintura(0, 2, preco - 1)).toBeNull();
  });

  it('não compra de novo a cor que já é do piloto (não cobra duas vezes)', () => {
    expect(comprarPintura(0b10, 1, 10_000)).toBeNull();
  });

  it('não compra a de fábrica nem índice que não existe', () => {
    expect(comprarPintura(0, 0, 10_000)).toBeNull();
    expect(comprarPintura(0, QUANTIDADE_PINTURAS, 10_000)).toBeNull();
    expect(comprarPintura(0, -1, 10_000)).toBeNull();
  });
});
