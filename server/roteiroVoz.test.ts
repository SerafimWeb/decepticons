import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import narrador from '../client/src/audio/falas.json';
import radio from '../client/src/audio/radio.json';
import { MINUTOS_POR_FALA, renderizarRoteiro } from '../scripts/roteiroVozLib.mjs';

const lido = () => readFileSync(resolve('.decepticons/ROTEIRO_DE_GRAVACAO.md'), 'utf8').replace(/\r\n/g, '\n');

describe('o roteiro de gravação (P316)', () => {
  it('o ROTEIRO_DE_GRAVACAO.md é exatamente o que o gerador produz do radio.json (se reprovar: rode `npm run roteiro`)', () => {
    expect(lido()).toBe(renderizarRoteiro(radio, narrador));
  });

  it('é determinístico: a mesma entrada dá o mesmo texto (sem data nem sorteio)', () => {
    expect(renderizarRoteiro(radio, narrador)).toBe(renderizarRoteiro(radio, narrador));
  });

  it('o narrador entra no roteiro, com a mesma ordem do catálogo (as falas que o jogador mais ouve), e sem ele o roteiro continua válido', () => {
    const t = renderizarRoteiro(radio, narrador);
    expect(t).toContain(`mais as ${narrador.falas.length} do narrador`);
    const secao = t.slice(t.indexOf('## 5. O narrador'), t.indexOf('## 6. As falas do rádio'));
    let ultima = -1;
    for (const f of narrador.falas) {
      expect(secao, f.chave).toContain(`\`${f.chave}\``);
      expect(secao, f.chave).toContain(f.texto.br);
      const pos = secao.indexOf(`\`${f.chave}\``);
      expect(pos, f.chave).toBeGreaterThan(ultima);
      ultima = pos;
    }
    const sem = renderizarRoteiro(radio);
    expect(sem).not.toContain('O narrador: as falas de partida');
    expect(sem).toContain('## 5. As falas do rádio, canal por canal');
  });

  it('toda fala aparece, com a chave, e a estimativa de tempo vem da quantidade de falas', () => {
    const t = renderizarRoteiro(radio, narrador);
    for (const f of radio.falas) {
      expect(t, f.chave).toContain(`\`${f.chave}\``);
      expect(t, f.chave).toContain(f.texto);
    }
    const minutos = Math.round(radio.falas.length * MINUTOS_POR_FALA);
    expect(t).toContain(`${radio.falas.length} falas de rádio em ${Object.keys(radio.canais).length} canais`);
    expect(t).toContain(`${Math.floor(minutos / 60)} h ${minutos % 60} min`);
  });

  it('a estrela marca só as falas que o cérebro do time já aciona, e a contagem do aviso bate com as estrelas da tabela', () => {
    const t = renderizarRoteiro(radio, narrador);
    const quentes = radio.falas.filter((f) => f.gatilho.startsWith('cerebro:'));
    expect(quentes.length).toBeGreaterThan(0);
    for (const f of radio.falas) {
      const linha = t.split('\n').find((l) => l.includes(`\`${f.chave}\``))!;
      expect(linha.includes('★'), f.chave).toBe(f.gatilho.startsWith('cerebro:'));
    }
    expect(t).toContain(`grave primeiro as ${quentes.length} falas marcadas com ★`);
  });

  it('cada diálogo sai na ordem dos turnos', () => {
    const t = renderizarRoteiro(radio, narrador);
    const secao = t.slice(t.indexOf('## 7. Os diálogos'));
    const flanco = radio.falas.filter((f) => 'cena' in f && f.cena === 'flanco').sort((a, b) => (('turno' in a ? a.turno : 0) ?? 0) - (('turno' in b ? b.turno : 0) ?? 0));
    expect(flanco).toHaveLength(3);
    const posicoes = flanco.map((f) => secao.indexOf(f.texto));
    expect(posicoes.every((p) => p > 0)).toBe(true);
    expect(posicoes).toEqual([...posicoes].sort((a, b) => a - b));
  });

  it('cada canal ganha a sua seção e a sua linha na direção sonora, com o tratamento sugerido', () => {
    const t = renderizarRoteiro(radio, narrador);
    for (const m of Object.values(radio.canais)) {
      expect(t).toContain(m.rotulo);
      expect(t).toContain(`Tratamento sugerido: **${m.efeito}**`);
    }
  });
});
