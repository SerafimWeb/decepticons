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
