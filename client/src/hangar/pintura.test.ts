import { describe, expect, it, vi } from 'vitest';
import type { MeshStandardMaterial } from 'three';
import { PINTURAS } from '../../../shared/pinturas';
import { corDaMontagem, pintarCasco } from './pintura';

/** Um material de casco de mentira: só a cor, que é o que a pintura mexe. */
const material = () => ({ color: { setHex: vi.fn() } });

describe('a cor da montagem no desenho (P305)', () => {
  it('a montagem sem cor, ou com a de fábrica, não pede cor nenhuma (o chassi fica como é)', () => {
    expect(corDaMontagem(undefined)).toBeNull();
    expect(corDaMontagem(null)).toBeNull();
    expect(corDaMontagem({})).toBeNull();
    expect(corDaMontagem({ pintura: 0 })).toBeNull();
  });

  it('a montagem com cor pede exatamente a cor do catálogo', () => {
    expect(corDaMontagem({ pintura: 2 })).toBe(PINTURAS[2]!.cor);
  });

  it('um índice que não existe não vira cor (o desenho cai na de fábrica)', () => {
    expect(corDaMontagem({ pintura: 42 })).toBeNull();
  });

  it('pintar o casco de um importado põe a cor em cada material do casco', () => {
    const a = material();
    const b = material();
    pintarCasco([a as unknown as MeshStandardMaterial, b as unknown as MeshStandardMaterial], 0x112233);
    expect(a.color.setHex).toHaveBeenCalledWith(0x112233);
    expect(b.color.setHex).toHaveBeenCalledWith(0x112233);
  });

  it('sem cor (null), não mexe em material nenhum: o modelo sai com o visual dele', () => {
    const a = material();
    pintarCasco([a as unknown as MeshStandardMaterial], null);
    expect(a.color.setHex).not.toHaveBeenCalled();
  });
});
