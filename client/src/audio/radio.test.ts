import { describe, expect, it } from 'vitest';
import { FALA_TEXTO } from '../combat/radioFalas';
import narrador from './falas.json';
import catalogo from './radio.json';
import { CANAIS_DE_RADIO, FALAS_DE_RADIO, falaDeRadio, falasDoGatilho, radioGravada } from './radio';

describe('o rádio de campo (P316): o catálogo', () => {
  it('toda fala tem chave única com o prefixo rd_, canal e estilo que existem, situação e texto', () => {
    expect(new Set(FALAS_DE_RADIO.map((f) => f.chave)).size).toBe(FALAS_DE_RADIO.length);
    for (const f of FALAS_DE_RADIO) {
      expect(f.chave, f.chave).toMatch(/^rd_[a-z0-9_]+$/);
      expect(CANAIS_DE_RADIO, f.chave).toContain(f.canal);
      expect(Object.keys(catalogo.estilos), f.chave).toContain(f.estilo);
      expect(f.situacao.length, f.chave).toBeGreaterThan(2);
      expect(f.texto.trim().length, f.chave).toBeGreaterThan(5);
    }
  });

  it('a chave do rádio nunca colide com a do narrador (o arquivo é audio/vozes/br/<chave>.mp3 nos dois)', () => {
    const doNarrador = new Set(narrador.falas.map((f) => f.chave));
    for (const f of FALAS_DE_RADIO) expect(doNarrador.has(f.chave), f.chave).toBe(false);
  });

  it('os canais do catálogo são os do tipo, na ordem de gravação (do mais calmo ao mais gritado: o grito é o último), e cada um se explica', () => {
    expect(Object.keys(catalogo.canais)).toEqual([...CANAIS_DE_RADIO]);
    expect(CANAIS_DE_RADIO[CANAIS_DE_RADIO.length - 1]).toBe('grito');
    for (const c of CANAIS_DE_RADIO) {
      const m = catalogo.canais[c];
      expect(m.rotulo.length, c).toBeGreaterThan(3);
      expect(m.quem.length, c).toBeGreaterThan(30);
      expect(m.efeito.length, c).toBeGreaterThan(2);
      expect(FALAS_DE_RADIO.filter((f) => f.canal === c).length, c).toBeGreaterThanOrEqual(10);
    }
    // as falas do arquivo seguem a ordem dos canais: o Estúdio lista na ordem do arquivo e o Comandante grava de cima para baixo
    const ordem = FALAS_DE_RADIO.map((f) => CANAIS_DE_RADIO.indexOf(f.canal));
    expect(ordem).toEqual([...ordem].sort((a, b) => a - b));
  });

  it('o texto cabe numa tomada (até 90 caracteres), numa linha só, e termina em pontuação', () => {
    for (const f of FALAS_DE_RADIO) {
      expect(f.texto.length, f.chave).toBeLessThanOrEqual(90);
      expect(f.texto, f.chave).not.toMatch(/[\r\n]/);
      expect(f.texto, f.chave).toMatch(/[.!?…]$/);
      expect(f.texto, f.chave).not.toMatch(/\s{2,}/);
    }
  });

  it('nenhuma fala cita pessoa real, partido ou marca de franquia (IDENTITY § 2 e UNIVERSO § 2-A: só arquétipos e codinomes fictícios)', () => {
    const proibido = /decepticon|transformers|autobot|optimus|megatron|hasbro|bolsonaro|trump|lula|biden|moraes|musk|zuckerberg|altman/i;
    for (const f of FALAS_DE_RADIO) expect(`${f.texto} ${f.nota ?? ''}`, f.chave).not.toMatch(proibido);
  });

  it('os diálogos: cada cena tem 2 falas ou mais, e os turnos seguem 1, 2, 3... sem buraco nem repetição', () => {
    const cenas = new Map<string, number[]>();
    for (const f of FALAS_DE_RADIO) {
      expect(f.cena === undefined, `${f.chave}: cena e turno andam juntos`).toBe(f.turno === undefined);
      if (f.cena) cenas.set(f.cena, [...(cenas.get(f.cena) ?? []), f.turno!]);
    }
    expect(cenas.size).toBeGreaterThanOrEqual(8);
    for (const [cena, turnos] of cenas) {
      expect(turnos.length, cena).toBeGreaterThanOrEqual(2);
      expect([...turnos].sort((a, b) => a - b), cena).toEqual(turnos.map((_, i) => i + 1));
    }
  });

  it('o gatilho é "futuro" ou uma chamada do cérebro do time que existe (a mesma do rádio de texto)', () => {
    const chamadas = Object.keys(FALA_TEXTO);
    expect(chamadas.length).toBeGreaterThanOrEqual(4);
    for (const f of FALAS_DE_RADIO) {
      if (f.gatilho === 'futuro') continue;
      expect(f.gatilho, f.chave).toMatch(/^cerebro:/);
      expect(chamadas, f.chave).toContain(f.gatilho.slice('cerebro:'.length));
    }
  });

  it('cada chamada do cérebro tem pelo menos 2 variações no rádio inimigo e 2 no do piloto aliado (para não repetir a mesma fala toda vez)', () => {
    for (const chamada of Object.keys(FALA_TEXTO)) {
      for (const canal of ['intercepto', 'piloto'] as const) {
        expect(falasDoGatilho(canal, `cerebro:${chamada}`).length, `${canal}/${chamada}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('falaDeRadio, falasDoGatilho e radioGravada respondem pelo catálogo e pelo manifesto (só o sotaque br)', () => {
    expect(falaDeRadio('rd_controle_abertura_1')?.texto).toBe('Instâncias ativas na malha. Canal de comando aberto.');
    expect(falaDeRadio('combate')).toBeUndefined();
    expect(falasDoGatilho('intercepto', 'cerebro:pinca').every((f) => f.canal === 'intercepto')).toBe(true);
    expect(falasDoGatilho('grito', 'cerebro:pinca')).toEqual([]);
    expect(radioGravada('rd_piloto_posicao_1', { br: ['rd_piloto_posicao_1'] })).toBe(true);
    expect(radioGravada('rd_piloto_posicao_1', { en: ['rd_piloto_posicao_1'] })).toBe(false);
    expect(radioGravada('rd_piloto_posicao_1', { br: [] })).toBe(false);
  });
});
