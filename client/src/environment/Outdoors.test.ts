import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PARAMETROS_PADRAO } from '../../../shared/outdoors';
import { SLIDE_DA_LOGO, SLIDES, SLIDES_QUE_ALTERNAM, slidesDoAnuncio, type IdDoAnuncio } from '../brand/anuncios';
import { criarOutdoors, prioridadeDosOutdoors, type OutdoorDaCena } from './Outdoors';

const uniformes = () => ({ tempo: { value: 0 }, luz: { value: new THREE.Color(1, 1, 1) } });
const outdoor = (anuncio: IdDoAnuncio, w: number, i = 0): OutdoorDaCena => ({ x: i * 20, y: 30, z: -110, ry: 0, w, h: 2 * w, anuncio, inicio: anuncio === 'logo' ? -1 : slidesDoAnuncio(anuncio)[0]!, fase: (i % 10) / 10 });

describe('a ordem em que os outdoors saem do ar quando o Comandante pede menos (P267)', () => {
  it('a logo plana é a última a sair; depois, os maiores; no empate, a ordem da lista', () => {
    const lista = [outdoor('odp-gps', 10), outdoor('logo', 6), outdoor('swb', 20), outdoor('odp-sos', 10), outdoor('odp-ping', 15)];
    const posicao = prioridadeDosOutdoors(lista);
    // posição na ordem de saída: 0 = o último a sair
    expect(posicao[1], 'a logo, mesmo a menor').toBe(0);
    expect(posicao[2], 'depois o maior').toBe(1);
    expect(posicao[4]).toBe(2);
    expect(posicao[0], 'empate de largura: o que veio antes na lista fica').toBeLessThan(posicao[3]!);
    expect([...posicao].sort((a, b) => a - b), 'é uma permutação').toEqual([0, 1, 2, 3, 4]);
  });
});

describe('criarOutdoors: quantidade, anel da troca e começo de cada um', () => {
  const lista = [outdoor('odp-olho', 12, 0), outdoor('logo', 14, 1), outdoor('odp-sos', 8, 2), outdoor('swb', 16, 3), outdoor('odp-familia', 10, 4)];

  it('sem nenhum outdoor, não cria nada (um mapa sem outdoor não paga nada)', () => {
    const o = criarOutdoors([], uniformes(), { value: 1 });
    expect(o.painel).toBeNull();
    expect(o.brilho).toBeNull();
    expect(o.grupo.children).toHaveLength(0);
    expect(o.aplicar(PARAMETROS_PADRAO)).toEqual([]);
  });

  it('a quantidade deixa no ar os de maior prioridade e devolve o estado na ordem da lista', () => {
    const o = criarOutdoors(lista, uniformes(), { value: 1 });
    const estado = o.aplicar({ quantidade: 2, periodo: 12, desligados: [] });
    expect(estado.map((e) => e.visivel)).toEqual([false, true, false, true, false]); // a logo e o maior (swb)
    expect(o.painel!.count).toBe(2);
    expect(o.brilho!.count).toBe(2);
    expect(o.aplicar({ quantidade: 0, periodo: 12, desligados: [] }).some((e) => e.visivel)).toBe(false);
    expect(o.brilho!.visible, 'sem nenhum outdoor, o brilho não desenha').toBe(false);
    expect(o.aplicar({ quantidade: 999, periodo: 12, desligados: [] }).every((e) => e.visivel)).toBe(true);
    expect(o.brilho!.visible).toBe(true);
  });

  it('o anel só tem as imagens dos anúncios que ficaram; quem começava numa imagem desligada começa na seguinte, e passando da última volta ao começo', () => {
    const o = criarOutdoors(lista, uniformes(), { value: 1 });
    const familia = slidesDoAnuncio('odp-familia');
    const estado = o.aplicar({ quantidade: 10, periodo: 10, desligados: ['odp-sos', 'odp-gps'] });
    const n = o.anuncios.cicloN.value;
    const anel = o.anuncios.ciclo.value.slice(0, n);
    expect(n).toBe(SLIDES_QUE_ALTERNAM - 2);
    expect(anel.map((i) => SLIDES[i]!.anuncio).some((a) => a === 'odp-sos' || a === 'odp-gps')).toBe(false);
    expect(o.anuncios.periodo.value).toBe(10);
    // o outdoor do odp-sos (desligado) começa na imagem ativa seguinte a ele no catálogo: a primeira da família
    expect(anel[estado[2]!.inicio]).toBe(familia[0]);
    // o do odp-olho (ativo) começa nele mesmo; o da família, na primeira dela
    expect(SLIDES[anel[estado[0]!.inicio]!]!.anuncio).toBe('odp-olho');
    expect(anel[estado[4]!.inicio]).toBe(familia[0]);
    // o bureau (a última imagem do anel) começa nele
    expect(SLIDES[anel[estado[3]!.inicio]!]!.anuncio).toBe('swb');
    // a logo é fixa: o anel não a toca, e o começo dela vale 0
    expect(estado[1]!.inicio).toBe(0);
    expect(anel.includes(SLIDE_DA_LOGO)).toBe(false);
  });

  it('se todos os anúncios fossem desligados (o servidor não deixa), vale o anel inteiro em vez de um outdoor sem nada para mostrar', () => {
    const o = criarOutdoors(lista, uniformes(), { value: 1 });
    o.aplicar({ quantidade: 5, periodo: 12, desligados: [...new Set(SLIDES.slice(0, SLIDES_QUE_ALTERNAM).map((s) => s.anuncio))] });
    expect(o.anuncios.cicloN.value).toBe(SLIDES_QUE_ALTERNAM);
  });

  it('a qualidade baixa tira o brilho e a grade de LED sem mexer na quantidade, e a alta devolve', () => {
    const detalhe = { value: 1 };
    const o = criarOutdoors(lista, uniformes(), detalhe);
    o.aplicar({ quantidade: 3, periodo: 12, desligados: [] });
    o.setDetalhe(false);
    expect(o.brilho!.visible).toBe(false);
    expect(detalhe.value).toBe(0);
    expect(o.painel!.count).toBe(3);
    o.aplicar({ quantidade: 4, periodo: 12, desligados: [] }); // mexer na quantidade não religa o brilho na qualidade baixa
    expect(o.brilho!.visible).toBe(false);
    o.setDetalhe(true);
    expect(o.brilho!.visible).toBe(true);
    expect(detalhe.value).toBe(1);
  });

  it('os painéis e o brilho dividem o mesmo atributo por instância (um só envio para a GPU) e a mesma cor/anel', () => {
    const o = criarOutdoors(lista, uniformes(), { value: 1 });
    expect(o.painel!.geometry.getAttribute('aAnuncio')).toBe(o.brilho!.geometry.getAttribute('aAnuncio'));
    const m = o.painel!.material as THREE.ShaderMaterial;
    const b = o.brilho!.material as THREE.ShaderMaterial;
    for (const nome of ['uCiclo', 'uCicloN', 'uPeriodo', 'uCores']) expect(m.uniforms[nome], nome).toBe(b.uniforms[nome]);
  });
});
