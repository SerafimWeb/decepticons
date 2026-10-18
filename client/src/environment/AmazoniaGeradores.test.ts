import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { ESCUDO_DO_DRAGA } from '../sim/EscudoDoDraga';
import { aderecosDaAmazonia } from './AmazoniaAderecos';
import { defesaDaAmazonia } from './AmazoniaGeradores';
import { AMAZONIA_GERADORES, estaNoRio, larguraDoRio, rioEmX } from './AmazoniaLayout';
import type { AlvoExterno, Destructibles, EfeitosDoAlvo } from './Destructibles';

/** Um `Destructibles` de mentira que só guarda os alvos que a defesa registra. */
function registro() {
  const alvos: AlvoExterno[] = [];
  const destructibles = { addExterno: (a: AlvoExterno) => alvos.push(a) - 1 } as unknown as Destructibles;
  return { alvos, destructibles };
}
const EFEITOS = { debris: { shatter: () => {} }, particles: { burst: () => {} } } as unknown as EfeitosDoAlvo;

describe('os geradores do escudo na Amazônia (P180, parte D): o lugar', () => {
  it('são três, espalhados (mais de 100 m entre quaisquer dois) e a vida vem da regra', () => {
    expect(AMAZONIA_GERADORES).toHaveLength(ESCUDO_DO_DRAGA.geradores);
    for (let i = 0; i < AMAZONIA_GERADORES.length; i++) {
      for (let j = i + 1; j < AMAZONIA_GERADORES.length; j++) {
        const a = AMAZONIA_GERADORES[i]!;
        const b = AMAZONIA_GERADORES[j]!;
        expect(Math.hypot(a.x - b.x, a.z - b.z), `${a.nome} e ${b.nome}`).toBeGreaterThan(100);
      }
    }
    expect(defesaDaAmazonia.geradores).toBe(ESCUDO_DO_DRAGA.geradores);
    expect(defesaDaAmazonia.vidaDoGerador).toBe(ESCUDO_DO_DRAGA.vidaDoGerador);
  });

  it('nenhum cai no rio (nem a menos de 12 m da água) nem dentro de uma estrutura sólida (8 m de folga)', () => {
    const solidas = aderecosDaAmazonia().filter((a) => a.solido);
    for (const g of AMAZONIA_GERADORES) {
      expect(estaNoRio(g.x, g.z), `${g.nome} no rio`).toBe(false);
      expect(Math.abs(g.z - rioEmX(g.x)) - larguraDoRio(g.x) / 2, `${g.nome} junto da água`).toBeGreaterThan(12);
      for (const a of solidas) {
        const mx = a.forma === 'caixa' ? Math.hypot(a.w, a.d) / 2 : a.w;
        expect(Math.hypot(a.x - g.x, a.z - g.z), `${g.nome} dentro de uma estrutura em (${a.x.toFixed(0)}, ${a.z.toFixed(0)})`).toBeGreaterThan(mx + 8);
      }
    }
  });

  it('ficam na faixa em que o Draga passa e a defesa se estende de ponta a ponta (da cerca à cava, ~360 m)', () => {
    const xs = AMAZONIA_GERADORES.map((g) => g.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(300);
    expect(Math.min(...xs)).toBeGreaterThan(-260); // dentro da margem fortificada ou depois dela
    expect(Math.max(...xs)).toBeLessThan(700); // o Draga larga em x = 700
  });
});

describe('os geradores do escudo: o desenho e o alvo', () => {
  function monta() {
    const { alvos, destructibles } = registro();
    const scene = new THREE.Scene();
    const aoQuebrar = vi.fn();
    const aoVoltar = vi.fn();
    const r = defesaDaAmazonia.criarGeradores({ scene, destructibles, aoQuebrar, aoVoltar });
    return { alvos, scene, aoQuebrar, aoVoltar, r };
  }

  it('registra um alvo destrutível por gerador, com a vida da regra, e põe seis desenhos na cena (um corpo e um brilho cada)', () => {
    const { alvos, scene, r } = monta();
    expect(alvos).toHaveLength(3);
    expect(r.ids).toEqual([0, 1, 2]);
    for (const a of alvos) {
      expect(a.hp).toBe(ESCUDO_DO_DRAGA.vidaDoGerador);
      expect(a.caixas).toHaveLength(1);
    }
    expect(scene.children).toHaveLength(3);
    let malhas = 0;
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh) malhas++;
    });
    expect(malhas).toBe(6);
  });

  it('quebrar um gerador o esconde e avisa a regra com o índice dele; voltar o mostra e avisa a rodada nova', () => {
    const { alvos, r, aoQuebrar, aoVoltar } = monta();
    const dir = new THREE.Vector3(0, 1, 0);
    alvos[1]!.quebrou(EFEITOS, dir, 10);
    expect(aoQuebrar).toHaveBeenCalledTimes(1);
    expect(aoQuebrar).toHaveBeenCalledWith(1);
    expect(r.grupos[1]!.visible).toBe(false);
    expect(r.grupos[0]!.visible).toBe(true);
    alvos[1]!.voltou();
    expect(r.grupos[1]!.visible).toBe(true);
    expect(aoVoltar).toHaveBeenCalledTimes(1);
  });

  it('cada gerador fica no chão do ponto dele (a base não flutua nem afunda mais que 1 m)', () => {
    const { r } = monta();
    r.grupos.forEach((g, i) => {
      expect(g.position.x).toBe(AMAZONIA_GERADORES[i]!.x);
      expect(g.position.z).toBe(AMAZONIA_GERADORES[i]!.z);
      expect(Math.abs(g.position.y)).toBeLessThan(20);
    });
  });
});
