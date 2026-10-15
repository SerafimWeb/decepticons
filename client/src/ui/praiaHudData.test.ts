import { describe, expect, it } from 'vitest';
import { FUNDURA_MOLHADA } from '../combat/Agua';
import { PRAIA_ESTACAO, PRAIA_PIER } from '../environment/PraiaLayout';
import { PRAIA_LIMITES } from '../environment/PraiaTerreno';
import { AlertaDoNucleo, AnunciadorDeLugar, avisoDeAgua, CARTAO_DA_MISSAO, fracaoNaFaixa, MARCOS_DA_FAIXA, marcadorNaTela, textoDeDistancia, type AvisoDeAgua, type MarcadorNaTela } from './praiaHudData';

const MARGENS = { topo: 100, base: 120, esq: 24, dir: 24 };
const saida = (): MarcadorNaTela => ({ x: 0, y: 0, naBorda: false });
const agua = (): AvisoDeAgua => ({ nivel: 'seco', progresso: 0, texto: '' });

describe('o HUD da praia: a faixa da costa', () => {
  it('as pontas do mapa são 0 e 1, e fora do mapa não passa disso', () => {
    expect(fracaoNaFaixa(PRAIA_LIMITES.minX)).toBe(0);
    expect(fracaoNaFaixa(PRAIA_LIMITES.maxX)).toBe(1);
    expect(fracaoNaFaixa(0)).toBeCloseTo(0.5, 6);
    expect(fracaoNaFaixa(-9999)).toBe(0);
    expect(fracaoNaFaixa(9999)).toBe(1);
  });

  it('os três marcos vão de oeste para leste: o porto, a Ponte Metálica e a estação (o objetivo, no fim)', () => {
    expect(MARCOS_DA_FAIXA.map((m) => m.id)).toEqual(['porto', 'ponte', 'estacao']);
    const fr = MARCOS_DA_FAIXA.map((m) => fracaoNaFaixa(m.x));
    expect(fr[0]!).toBeLessThan(fr[1]!);
    expect(fr[1]!).toBeLessThan(fr[2]!);
    expect(MARCOS_DA_FAIXA[1]!.x).toBe(PRAIA_PIER.x);
    expect(MARCOS_DA_FAIXA[2]!.x).toBe(PRAIA_ESTACAO.x);
  });

  it('a distância sai em metros até 999 e em quilômetros depois', () => {
    expect(textoDeDistancia(0)).toBe('0 m');
    expect(textoDeDistancia(212.4)).toBe('212 m');
    expect(textoDeDistancia(999.4)).toBe('999 m');
    expect(textoDeDistancia(1250)).toBe('1,3 km');
    expect(textoDeDistancia(-5)).toBe('0 m');
  });
});

describe('o marcador da estação na tela', () => {
  it('dentro da tela e das margens, fica no lugar do alvo', () => {
    const m = marcadorNaTela(0, 0, false, 1280, 720, MARGENS, saida());
    expect(m.naBorda).toBe(false);
    expect(m.x).toBeCloseTo(640, 6);
    expect(m.y).toBeCloseTo(360, 6);
  });

  it('fora da tela, é preso na borda do lado em que o alvo está (nunca some)', () => {
    const direita = marcadorNaTela(3, 0.2, false, 1280, 720, MARGENS, saida());
    expect(direita.naBorda).toBe(true);
    expect(direita.x).toBe(1280 - MARGENS.dir);
    const esquerda = marcadorNaTela(-3, 0, false, 1280, 720, MARGENS, saida());
    expect(esquerda.x).toBe(MARGENS.esq);
    const alto = marcadorNaTela(0, 5, false, 1280, 720, MARGENS, saida());
    expect(alto.y).toBe(MARGENS.topo); // o topo guarda os banners
    const baixo = marcadorNaTela(0, -5, false, 1280, 720, MARGENS, saida());
    expect(baixo.y).toBe(720 - MARGENS.base); // e a base, a barra de vida
  });

  it('atrás da câmera, vai para a borda de baixo, do lado de onde o alvo está', () => {
    // O x chega espelhado quando o alvo está atrás: um ndc de +0,5 espelhado cai à esquerda.
    const m = marcadorNaTela(0.5, 0, true, 1280, 720, MARGENS, saida());
    expect(m.naBorda).toBe(true);
    expect(m.y).toBe(720 - MARGENS.base);
    expect(m.x).toBeLessThan(640);
  });
});

describe('o anúncio do lugar', () => {
  it('anuncia o lugar do começo na hora e só troca depois de ficar um instante no lugar novo', () => {
    const a = new AnunciadorDeLugar();
    expect(a.atualiza(262, 16, 0.016)).toBe('ESTAÇÃO DE CABOS'); // o começo da partida
    expect(a.atualiza(262, 16, 0.016)).toBeNull(); // não repete
    // Sai para a praia: só anuncia depois de 0,7 s ali.
    expect(a.atualiza(150, -20, 0.3)).toBeNull();
    expect(a.atualiza(150, -20, 0.3)).toBeNull();
    expect(a.atualiza(150, -20, 0.3)).toBe('PRAIA DOS CABOS');
    expect(a.atualiza(150, -20, 0.3)).toBeNull();
  });

  it('roçar numa fronteira não pisca: voltar antes do tempo cancela o anúncio', () => {
    const a = new AnunciadorDeLugar();
    a.atualiza(150, -20, 0.016); // praia
    expect(a.atualiza(150, 10, 0.3)).toBeNull(); // pisou no calçadão
    expect(a.atualiza(150, -20, 0.3)).toBeNull(); // voltou
    expect(a.atualiza(150, 10, 0.3)).toBeNull(); // pisou de novo: o relógio recomeça
    expect(a.atualiza(150, 10, 0.3)).toBeNull();
    expect(a.atualiza(150, 10, 0.3)).toBe('CALÇADÃO');
  });

  it('reset volta a anunciar o lugar (uma partida nova)', () => {
    const a = new AnunciadorDeLugar();
    a.atualiza(262, 16, 0.016);
    a.reset();
    expect(a.atualiza(262, 16, 0.016)).toBe('ESTAÇÃO DE CABOS');
  });
});

describe('o aviso da água', () => {
  const DESDE = 1.4;
  it('seco: nada a dizer', () => {
    expect(avisoDeAgua(0, 0, 3, DESDE, agua()).nivel).toBe('seco');
    expect(avisoDeAgua(FUNDURA_MOLHADA, 0, 3, DESDE, agua()).nivel).toBe('seco');
  });

  it('raso: vadeando, anda mais devagar e não afoga (o relógio não corre)', () => {
    const a = avisoDeAgua(0.8, 0, 3, DESDE, agua());
    expect(a.nivel).toBe('raso');
    expect(a.progresso).toBe(0);
    expect(a.texto).toContain('VADEANDO');
  });

  it('fundo: o relógio corre — conta os segundos que faltam e, passando, manda sair do mar', () => {
    const a = avisoDeAgua(3, 1, 3, DESDE, agua());
    expect(a.nivel).toBe('fundo');
    expect(a.progresso).toBeCloseTo(1 / 3, 6);
    expect(a.texto).toContain('2.0 s');
    const b = avisoDeAgua(3, 4, 3, DESDE, agua());
    expect(b.progresso).toBe(1);
    expect(b.texto).toContain('AFOGANDO');
  });
});

describe('o alerta do núcleo da estação', () => {
  it('avisa uma vez quando os invasores entram, e de novo só depois de uma calma', () => {
    const a = new AlertaDoNucleo();
    expect(a.atualiza(1, 0)).toBeNull(); // tudo calmo
    expect(a.atualiza(1, 1)).toBe('INVASORES NA ESTAÇÃO · EXPULSE-OS');
    expect(a.atualiza(0.98, 1)).toBeNull(); // continua: sem repetir
    expect(a.atualiza(0.98, 0)).toBeNull(); // expulsos
    expect(a.atualiza(0.98, 0.5)).toBe('INVASORES NA ESTAÇÃO · EXPULSE-OS'); // entraram de novo
  });

  it('cada limiar (75%, 50%, 25%) avisa uma vez, na descida; recompor a rede rearma', () => {
    const a = new AlertaDoNucleo();
    expect(a.atualiza(0.8, 0)).toBeNull();
    expect(a.atualiza(0.74, 1)).toBe('ESTAÇÃO A 75% · EXPULSE OS INVASORES');
    expect(a.atualiza(0.7, 1)).toBeNull();
    expect(a.atualiza(0.49, 1)).toBe('ESTAÇÃO A 50% · EXPULSE OS INVASORES');
    expect(a.atualiza(0.2, 1)).toBe('ESTAÇÃO A 25% · EXPULSE OS INVASORES'); // pulou direto para baixo do 25%
    expect(a.atualiza(0.1, 1)).toBeNull();
    // A rede se recompõe até quase cheia: os limiares voltam a valer.
    expect(a.atualiza(0.95, 0)).toBeNull();
    expect(a.atualiza(0.7, 1)).toBe('ESTAÇÃO A 75% · EXPULSE OS INVASORES');
  });

  it('a queda avisa uma vez e para por aí; a missão nova rearma tudo', () => {
    const a = new AlertaDoNucleo();
    expect(a.atualiza(0, 3)).toBe('A ESTAÇÃO CAIU');
    expect(a.atualiza(0, 3)).toBeNull();
    a.reset();
    expect(a.atualiza(0, 3)).toBe('A ESTAÇÃO CAIU');
    a.reset();
    expect(a.atualiza(1, 0)).toBeNull();
  });
});

describe('o cartão da missão', () => {
  it('conta a história em três linhas curtas, sem nome real nem marca (alegoria)', () => {
    expect(CARTAO_DA_MISSAO.linhas).toHaveLength(3);
    expect(CARTAO_DA_MISSAO.titulo.length).toBeGreaterThan(5);
    for (const l of CARTAO_DA_MISSAO.linhas) expect(l.length).toBeLessThan(100);
  });
});
