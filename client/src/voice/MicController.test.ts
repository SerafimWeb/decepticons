import { describe, expect, it } from 'vitest';
import { MicController } from './MicController';

const faixa = () => ({ enabled: true });

describe('MicController: quando o microfone transmite (P205)', () => {
  it('modo "sempre": a faixa abre ao ligar, e a tecla alterna o mudo (soltar não faz nada)', () => {
    const m = new MicController();
    const f = faixa();
    m.usar(f);
    expect(f.enabled).toBe(true);
    expect(m.transmitindo).toBe(true);
    m.aoTecla(true);
    m.aoTecla(false);
    expect(m.mudo).toBe(true);
    expect(f.enabled).toBe(false);
    m.aoTecla(true);
    expect(f.enabled).toBe(true);
  });

  it('modo "ptt": a faixa nasce fechada, abre enquanto a tecla está apertada e fecha ao soltar', () => {
    const m = new MicController();
    const f = faixa();
    m.setModo('ptt');
    m.usar(f);
    expect(f.enabled).toBe(false);
    m.aoTecla(true);
    expect(f.enabled).toBe(true);
    expect(m.transmitindo).toBe(true);
    m.aoTecla(false);
    expect(f.enabled).toBe(false);
  });

  it('trocar de modo acerta a faixa na hora; a tecla que ficou apertada não passa de um modo para o outro', () => {
    const m = new MicController();
    const f = faixa();
    m.usar(f);
    m.setModo('ptt');
    expect(f.enabled).toBe(false);
    m.aoTecla(true);
    m.setModo('sempre');
    expect(m.apertada).toBe(false);
    expect(f.enabled).toBe(true);
    m.aoTecla(true);
    expect(f.enabled).toBe(false);
    // o mudo do modo "sempre" fica guardado ao voltar para o ptt e de novo para o "sempre"
    m.setModo('ptt');
    m.setModo('sempre');
    expect(m.mudo).toBe(true);
    expect(f.enabled).toBe(false);
  });

  it('perder o foco solta o PTT (nunca fica aberto sozinho)', () => {
    const m = new MicController();
    const f = faixa();
    m.setModo('ptt');
    m.usar(f);
    m.aoTecla(true);
    m.soltar();
    expect(f.enabled).toBe(false);
    expect(m.transmitindo).toBe(false);
  });

  it('sem microfone (negado, ou o aparelho caiu) nada transmite e a tecla não quebra', () => {
    const m = new MicController();
    expect(m.temMic).toBe(false);
    expect(m.transmitindo).toBe(false);
    m.aoTecla(true);
    m.setModo('ptt');
    m.aoTecla(true);
    expect(m.transmitindo).toBe(false);
    const f = faixa();
    m.usar(f);
    m.usar(null);
    expect(m.temMic).toBe(false);
  });
});

describe('MicController: as teclas dos canais (P237 PR 3)', () => {
  it('o canal de quem fala: todos (aberto), calado (mudo), time e privado (teclas apertadas); o privado vale mais que o do time', () => {
    const m = new MicController();
    m.usar(faixa());
    expect(m.canal).toBe('todos');
    m.aoTecla(true); // mudo
    expect(m.canal).toBeNull();
    m.aoTeclaCanal('time', true);
    expect(m.canal).toBe('time');
    m.aoTeclaCanal('privado', true);
    expect(m.canal).toBe('privado');
    m.aoTeclaCanal('privado', false);
    expect(m.canal).toBe('time');
    m.aoTeclaCanal('time', false);
    expect(m.canal, 'soltou tudo: volta ao estado do mudo').toBeNull();
  });

  it('apertar uma tecla de canal abre o microfone MESMO mudo e no "segurar para falar" solto (apertar é pedir para falar)', () => {
    const m = new MicController();
    const f = faixa();
    m.usar(f);
    m.aoTecla(true); // mudo
    expect(f.enabled).toBe(false);
    m.aoTeclaCanal('time', true);
    expect(f.enabled).toBe(true);
    expect(m.transmitindo).toBe(true);
    m.aoTeclaCanal('time', false);
    expect(f.enabled, 'soltou: volta a mudo').toBe(false);

    const p = new MicController();
    const g = faixa();
    p.usar(g);
    p.setModo('ptt');
    expect(g.enabled).toBe(false);
    p.aoTeclaCanal('privado', true);
    expect(g.enabled).toBe(true);
    p.aoTeclaCanal('privado', false);
    expect(g.enabled).toBe(false);
  });

  it('o PTT de todos continua o mesmo: com a tecla do time apertada o canal é o do time, e ao soltar volta a "todos" se o PTT ainda está apertado', () => {
    const m = new MicController();
    m.usar(faixa());
    m.setModo('ptt');
    m.aoTecla(true);
    expect(m.canal).toBe('todos');
    m.aoTeclaCanal('time', true);
    expect(m.canal).toBe('time');
    m.aoTeclaCanal('time', false);
    expect(m.canal).toBe('todos');
    m.aoTecla(false);
    expect(m.canal).toBeNull();
  });

  it('a janela que perde o foco solta as teclas dos canais também (nada fica preso aberto)', () => {
    const m = new MicController();
    const f = faixa();
    m.usar(f);
    m.setModo('ptt');
    m.aoTeclaCanal('time', true);
    m.aoTeclaCanal('privado', true);
    m.soltar();
    expect(m.time).toBe(false);
    expect(m.privado).toBe(false);
    expect(f.enabled).toBe(false);
  });

  it('sem microfone as teclas de canal se soltam: ao voltar o microfone ninguém fala sem apertar de novo', () => {
    const m = new MicController();
    m.usar(faixa());
    m.setModo('ptt');
    m.aoTeclaCanal('time', true);
    m.usar(null); // o fone caiu com a tecla apertada: o "soltar" da tecla se perde
    expect(m.time).toBe(false);
    const nova = faixa();
    m.usar(nova);
    expect(nova.enabled, 'o microfone novo nasce calado').toBe(false);
    expect(m.canal).toBeNull();
  });

  it('trocar o modo solta as teclas dos canais; sem microfone não há canal', () => {
    const m = new MicController();
    expect(m.canal).toBeNull();
    m.usar(faixa());
    m.aoTeclaCanal('privado', true);
    m.setModo('sempre');
    expect(m.privado).toBe(false);
  });
});
