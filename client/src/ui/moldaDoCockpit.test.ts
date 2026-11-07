import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { conhece, padraoDe } from '../core/funcionalidades';
import { MODO_DA_MOLDURA, moldaDoCockpit } from './moldaDoCockpit';

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const hud = readFileSync(new URL('./HUD.ts', import.meta.url), 'utf8');
const game = readFileSync(new URL('../core/Game.ts', import.meta.url), 'utf8');
const primeiraPessoa = readFileSync(new URL('../camera/FirstPersonCamera.ts', import.meta.url), 'utf8');

describe('a moldura do cockpit (P317): quando aparece', () => {
  it('só na primeira pessoa e só com a funcionalidade liberada: as quatro combinações', () => {
    expect(moldaDoCockpit('fps', true)).toBe(true);
    expect(moldaDoCockpit('fps', false)).toBe(false); // restrita: o jogador não a vê, nem na primeira pessoa
    expect(moldaDoCockpit('tps', true)).toBe(false);
    expect(moldaDoCockpit('tactical', true)).toBe(false);
    expect(moldaDoCockpit('', true)).toBe(false); // antes do primeiro `setMode`
  });

  it('o id da primeira pessoa é o da câmera de verdade (se a câmera mudar de id, a moldura não some em silêncio)', () => {
    expect(primeiraPessoa).toContain(`readonly id = '${MODO_DA_MOLDURA}'`);
  });

  it('a funcionalidade nasce RESTRITA no catálogo (P191): o Comandante a libera quando aprovar', () => {
    expect(conhece('tela:cockpit')).toBe(true);
    expect(padraoDe('tela:cockpit')).toBe('restrito');
  });

  it('o HUD liga a classe cam-fps pela regra (não direto pelo id da câmera) e o Game a reaplica quando a visibilidade muda', () => {
    expect(hud).toContain("classList.toggle('cam-fps', moldaDoCockpit(this.modoDaCamera, funcionalidadeVisivel('tela:cockpit')))");
    expect(hud).not.toMatch(/toggle\('cam-fps', mode\.id/);
    expect(game).toMatch(/aoMudarVisibilidade\(\(\) => this\.hud\.aplicarMoldura\(\)\)/);
  });
});

describe('a moldura do cockpit (P317): o CSS e o HTML', () => {
  // Do `/*` que abre o comentário do título até o bloco seguinte: começar no meio do comentário deixaria o texto dele sem a abertura, e a limpeza abaixo não o tiraria.
  const completo = css.slice(css.lastIndexOf('/*', css.indexOf('Moldura do cockpit')), css.indexOf('Painel de desempenho'));
  // Só as regras: os comentários explicam (e citam até o que a moldura NÃO usa).
  const bloco = completo.replace(/\/\*[\s\S]*?\*\//g, '');

  it('o bloco existe e é só CSS: sem backdrop-filter, sem animação por quadro, sem pegar o clique', () => {
    expect(completo.length).toBeGreaterThan(1500);
    expect(bloco).not.toContain('backdrop-filter');
    expect(bloco).not.toContain('@keyframes');
    expect(bloco).toMatch(/#cockpit-frame \{[^}]*pointer-events: none/);
  });

  it('a moldura fica ATRÁS de todo painel do HUD (z-index negativo): a bancada mediu painel de arma e calor coberto quando ela ficava por cima', () => {
    expect(bloco).toMatch(/#cockpit-frame \{[^}]*z-index: -1/);
    expect(bloco).not.toMatch(/#cockpit-frame \{[^}]*z-index: [1-9]/);
  });

  it('aparece só com cam-fps (opacidade 0 por padrão) e sai na pausa e no modo cego', () => {
    expect(bloco).toMatch(/#cockpit-frame \{[^}]*opacity: 0/);
    expect(bloco).toContain('#hud.cam-fps #cockpit-frame { opacity: 1; }');
    expect(bloco).toContain('#hud.blind #cockpit-frame');
  });

  it('respeita quem pediu menos movimento e o celular não perde campo de visão', () => {
    expect(bloco).toContain('@media (prefers-reduced-motion: reduce)');
    expect(bloco).toContain('@media (max-width: 900px)');
  });

  it('o elemento é o primeiro filho do #hud, escondido de leitores de tela, sem data-func (a restrição é por função: o selo TESTE colidiria com o ::after da moldura)', () => {
    expect(html).toMatch(/<div id="hud">\s*(<!--[\s\S]*?-->\s*)?<div id="cockpit-frame" aria-hidden="true">/);
    expect(html).not.toMatch(/id="cockpit-frame"[^>]*data-func/);
  });
});
