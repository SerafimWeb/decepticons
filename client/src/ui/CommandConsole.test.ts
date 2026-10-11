import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { acaoDaTecla } from './consoleData';
import { isSettingsTab } from './settingsTabs';

/**
 * O contrato entre o HTML do console de comando e os módulos que moram nele. Vários módulos acham o seu lugar pelo id (o `ServerStatus`,
 * o `ModeSelector`, as missões diárias, o `HUD`, o `PilotLabels`, os testes do site); um id que sumir do HTML quebra o módulo em silêncio.
 */
const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const consoleHtml = html.slice(html.indexOf('<div id="overlay"'), html.indexOf('<!-- Modal de Configurações -->'));
/** Os monitores (que barram o clique) e a mesa de operação, cada um como um pedaço do HTML. */
const monitores = [...consoleHtml.matchAll(/<section class="mon [^"]*"[\s\S]*?<\/section>/g)].map((m) => m[0]);

describe('console de comando: o HTML', () => {
  it('é a tela de início e de pausa (o #overlay que o HUD mostra e esconde)', () => {
    expect(consoleHtml).toMatch(/<div id="overlay" class="console[ "]/);
  });

  it('tem o lugar de cada módulo que mora nele', () => {
    for (const id of ['cta', 'menu-mode', 'menu-status', 'menu-profile', 'btn-hangar', 'btn-settings', 'btn-touch-layout', 'pilot-sub', 'key-primary', 'key-secondary', 'round-summary', 'cc-online-slot', 'mech-esquema', 'mon-teatro', 'mon-radar', 'mon-comando', 'cc-chip-comandante']) {
      expect(consoleHtml.includes(`id="${id}"`), `falta o id ${id}`).toBe(true);
    }
    expect(consoleHtml, 'o HUD põe a assinatura da versão em .menu-foot').toMatch(/class="[^"]*\bmenu-foot\b/);
    expect(consoleHtml, 'as Potências avisam logo depois de .studio').toMatch(/class="studio"/);
  });

  it('o título e o botão verde ficam fora dos monitores: clicar neles continua sendo "jogar" (é o que o teste do site clica)', () => {
    expect(monitores.length).toBeGreaterThanOrEqual(8);
    for (const m of monitores) {
      expect(m.includes('<h1'), 'h1 dentro de um monitor').toBe(false);
      expect(m.includes('id="cta"'), 'o botão de jogar dentro de um monitor').toBe(false);
    }
  });

  it('o esquema do Mech desenha as seis partes com vida própria', () => {
    const partes = [...consoleHtml.matchAll(/class="mp" data-part="([a-zA-Z]+)"/g)].map((m) => m[1]).sort();
    expect(partes).toEqual(['head', 'leftArm', 'leftLeg', 'rightArm', 'rightLeg', 'torso']);
  });

  it('todo botão que abre as Configurações aponta para uma aba que existe', () => {
    const abas = [...html.matchAll(/data-settings-open="([^"]+)"/g)].map((m) => m[1]);
    expect(abas.length).toBeGreaterThanOrEqual(4);
    for (const a of abas) expect(isSettingsTab(a), `aba ${a}`).toBe(true);
  });

  it('o monitor do Comandante nasce escondido: o jogador comum não vê as telas de ajuste', () => {
    expect(consoleHtml).toMatch(/<section class="mon mon-comando" id="mon-comando"[^>]*\bhidden\b/);
    expect(consoleHtml).toMatch(/id="cc-chip-comandante" hidden/);
  });

  it('o que ainda não existe aparece como em construção, sem link (R13)', () => {
    const breves = [...consoleHtml.matchAll(/<li class="breve"[^>]*>([\s\S]*?)<\/li>/g)].map((m) => m[1]!);
    expect(breves.length).toBeGreaterThanOrEqual(4);
    for (const b of breves) {
      expect(b).toMatch(/em construção/);
      expect(b).not.toMatch(/<a |<button/);
    }
  });

  it('nasce "sem sinal" e "carregando": as telas só acendem quando o jogo monta o console (sem piscar vazias)', () => {
    expect(consoleHtml).toMatch(/<div id="overlay" class="console cc-espera cc-carregando">/);
  });

  it('as teclas de atalho desenhadas nos botões são as que o console atende, e cada uma aparece uma vez', () => {
    const teclas = [...consoleHtml.matchAll(/data-tecla="([^"]+)"/g)].map((m) => m[1]);
    expect(teclas.sort()).toEqual(['H', 'Z', '↵ ENTER']);
    expect(acaoDaTecla('h')).toBe('hangar');
    expect(acaoDaTecla('z')).toBe('zoom');
    expect(acaoDaTecla('Enter')).toBe('combate');
    // O botão do online é criado pelo `OnlineSwitch` e ganha o "O" no código (`CommandConsole`): o atalho tem que existir.
    expect(acaoDaTecla('o')).toBe('online');
  });

  it('o botão de jogar leva a tecla ENTER e o botão do Hangar leva o H', () => {
    expect(consoleHtml).toMatch(/id="cta" data-tecla="↵ ENTER"/);
    expect(consoleHtml).toMatch(/id="btn-hangar"[^>]*data-tecla="H"/);
  });

  it('os links do site (Sala de Controle e Oficina) moram só no monitor do Comandante', () => {
    const comando = consoleHtml.slice(consoleHtml.indexOf('id="mon-comando"'));
    for (const id of ['cmd-sala', 'cmd-oficina']) expect(comando.includes(`id="${id}"`), id).toBe(true);
    expect(consoleHtml.slice(0, consoleHtml.indexOf('id="mon-comando"')).includes('../oficina/')).toBe(false);
  });
});
