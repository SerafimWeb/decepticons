import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { acaoDaTecla, MESA_COMANDO, MESA_URL } from './consoleData';
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
    // Nenhuma promessa hoje: a ficha do bot, o servidor, as câmeras e a campanha abrem janela. Se uma nova entrar como "em construção", ela precisa vir sem link.
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

it('a tela de carregamento esconde os monitores com display none (guarda do boot: com eles visíveis o aquecimento dos shaders levou +5 s)', () => {
    const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
    const bloco = css.slice(css.indexOf('Tela de carregamento: o console enquanto o jogo carrega'));
    expect(bloco.length, 'bloco da tela de carregamento no styles.css').toBeGreaterThan(200);
    // Os monitores, a fileira de baixo, a escolha de modo e as teclas somem (sem caixa, sem camada) enquanto o overlay tem cc-espera.
    for (const alvo of ['.mon', '.cc-row', '.cc-ops', '.cc-info']) {
      // O seletor inteiro (termina em vírgula ou chave): `.mon` não pode ser aceito por `.monX`.
      const seletor = new RegExp(`#overlay\.console\.cc-espera ${alvo.replace('.', '\.')}\s*[,{]`);
      expect(seletor.test(bloco), `${alvo} escondido no carregamento`).toBe(true);
    }
    expect(bloco).toMatch(/display:\s*none\s*!important/);
    // E nenhuma animação roda nesse intervalo.
    expect(bloco).toMatch(/animation:\s*none\s*!important/);
  });

  it('o título e o botão ficam no mesmo lugar na tela de carregamento e na final (a grade é a mesma; só o botão ganha a coluna do meio)', () => {
    const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
    const bloco = css.slice(css.indexOf('Tela de carregamento: o console enquanto o jogo carrega'));
    expect(bloco, 'a tela de carregamento não pode trocar o display do overlay').not.toMatch(/#overlay\.console\.cc-espera\s*\{[^}]*display:\s*flex/);
    expect(bloco).toMatch(/\.cc-launch\s*\{[^}]*grid-column:\s*2/);
  });

  it('a mesa de vídeo: o item aponta para o endereço local, o balão de ajuda mostra o comando certo e começa fechado', () => {
    const comando = consoleHtml.slice(consoleHtml.indexOf('id="mon-comando"'));
    expect(comando).toContain(`<li id="cmd-mesa"><a href="${MESA_URL}"`);
    expect(comando).toMatch(/id="cmd-mesa-ajuda"[^>]*\bhidden\b/);
    expect(comando).toContain(`<code class="ajuda-cmd" id="cmd-mesa-cmd">${MESA_COMANDO}</code>`);
    for (const acao of ['copiar', 'abrir', 'fechar']) expect(comando.includes(`data-acao="${acao}"`), acao).toBe(true);
  });

  it('o esquadrão (P91): o botão do monitor PILOTOS e a ficha do Comandante abrem a mesma janela, que mora fora dos monitores e começa fechada', () => {
    const pilotos = monitores.find((m) => m.includes('id="mon-oponentes"'))!;
    expect(pilotos).toMatch(/id="btn-esquadrao"[^>]*data-esquadrao-open/);
    // O AJUSTAR continua (o `SettingsMenu` e o `OnlineSwitch` acham o #btn-settings), ao lado do ESQUADRÃO.
    expect(pilotos).toMatch(/id="btn-settings"/);
    const comando = monitores.find((m) => m.includes('id="mon-comando"'))!;
    expect(comando).toMatch(/<li id="cmd-ficha"><button type="button" data-esquadrao-open/);
    expect([...consoleHtml.matchAll(/data-esquadrao-open/g)]).toHaveLength(2);
    expect(consoleHtml).toContain('<div id="squad-modal" class="hidden"></div>');
    for (const m of monitores) expect(m.includes('id="squad-modal"'), 'a janela dentro de um monitor').toBe(false);
  });

  it('o arsenal (fase 4C): o item do monitor COMANDO abre a janela, que mora fora dos monitores e começa fechada; o console não dá Enter por trás dela', () => {
    const comando = monitores.find((m) => m.includes('id="mon-comando"'))!;
    expect(comando).toMatch(/<li id="cmd-arsenal"><button type="button" data-arsenal-open/);
    expect([...consoleHtml.matchAll(/data-arsenal-open/g)]).toHaveLength(1);
    expect(consoleHtml).toContain('<div id="arsenal-modal" class="hidden"></div>');
    for (const m of monitores) expect(m.includes('id="arsenal-modal"'), 'a janela dentro de um monitor').toBe(false);
    const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
    expect(css).toMatch(/#arsenal-modal\s*\{[^}]*position:\s*fixed/);
    expect(css).toMatch(/#arsenal-modal\.hidden\s*\{\s*display:\s*none/);
    const fonte = readFileSync(new URL('./CommandConsole.ts', import.meta.url), 'utf8');
    expect(fonte, 'algoPorCima conhece a janela do arsenal').toContain('#arsenal-modal:not(.hidden)');
  });

  it('a campanha (fase 4B): o item do monitor COMANDO abre a janela, que mora fora dos monitores e começa fechada; o console não dá Enter por trás dela nem do painel do fim', () => {
    const comando = monitores.find((m) => m.includes('id="mon-comando"'))!;
    expect(comando).toMatch(/<li id="cmd-campanha"><button type="button" data-campanha-open/);
    expect([...consoleHtml.matchAll(/data-campanha-open/g)]).toHaveLength(1);
    expect(consoleHtml).toContain('<div id="campanha-modal" class="hidden"></div>');
    for (const m of monitores) expect(m.includes('id="campanha-modal"'), 'a janela dentro de um monitor').toBe(false);
    const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
    expect(css).toMatch(/#campanha-modal\s*\{[^}]*position:\s*fixed/);
    expect(css).toMatch(/#campanha-modal\.hidden\s*\{\s*display:\s*none/);
    expect(css).toMatch(/\.campanha-fim\s*\{[^}]*position:\s*fixed/);
    const fonte = readFileSync(new URL('./CommandConsole.ts', import.meta.url), 'utf8');
    expect(fonte, 'algoPorCima conhece a janela e o painel do fim').toContain('#campanha-modal:not(.hidden), #campanha-fim');
  });

  it('o servidor (P93): o item do monitor COMANDO abre a janela, que mora fora dos monitores e começa fechada; o painel só aparece no modo Comandante', () => {
    const comando = monitores.find((m) => m.includes('id="mon-comando"'))!;
    expect(comando).toMatch(/<li id="cmd-servidor"><button type="button" data-servidor-open/);
    expect([...consoleHtml.matchAll(/data-servidor-open/g)]).toHaveLength(1);
    expect(consoleHtml).toContain('<div id="server-modal" class="hidden"></div>');
    for (const m of monitores) expect(m.includes('id="server-modal"'), 'a janela dentro de um monitor').toBe(false);
    const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
    expect(css).toMatch(/#server-modal\s*\{[^}]*position:\s*fixed/);
    expect(css).toMatch(/#server-modal\.hidden\s*\{\s*display:\s*none/);
    const fonte = readFileSync(new URL('./CommandConsole.ts', import.meta.url), 'utf8');
    expect(fonte, 'algoPorCima conhece a janela do servidor').toContain('#server-modal:not(.hidden)');
  });

  it('as câmeras ao vivo (P88): o item do monitor COMANDO abre a janela, que mora fora dos monitores e começa fechada; o console não dá Enter por trás dela', () => {
    const comando = monitores.find((m) => m.includes('id="mon-comando"'))!;
    expect(comando).toMatch(/<li id="cmd-cameras"><button type="button" data-cameras-open/);
    expect([...consoleHtml.matchAll(/data-cameras-open/g)]).toHaveLength(1);
    expect(consoleHtml).toContain('<div id="cameras-modal" class="hidden"></div>');
    for (const m of monitores) expect(m.includes('id="cameras-modal"'), 'a janela dentro de um monitor').toBe(false);
    const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
    expect(css).toMatch(/#cameras-modal\s*\{[^}]*position:\s*fixed/);
    expect(css).toMatch(/#cameras-modal\.hidden\s*\{\s*display:\s*none/);
    expect(css).toMatch(/\.cam-box\s*\{[^}]*height:\s*min\(\d+px,\s*94vh\)/);
    const fonte = readFileSync(new URL('./CommandConsole.ts', import.meta.url), 'utf8');
    expect(fonte, 'algoPorCima conhece a janela de câmeras').toContain('#cameras-modal:not(.hidden)');
    expect(comando, 'o item não é mais "em construção"').not.toMatch(/CÂMERAS AO VIVO<\/b><span>em construção/);
  });

  it('o esquadrão (P91): a janela tem o estilo (cabe em 1280×720 sem rolar a página) e o console não dá Enter por trás dela', () => {
    const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
    expect(css).toMatch(/#squad-modal\s*\{[^}]*position:\s*fixed/);
    expect(css).toMatch(/#squad-modal\.hidden\s*\{\s*display:\s*none/);
    expect(css).toMatch(/\.squad-box\s*\{[^}]*height:\s*min\(\d+px,\s*94vh\)/);
    const fonte = readFileSync(new URL('./CommandConsole.ts', import.meta.url), 'utf8');
    expect(fonte, 'algoPorCima conhece a janela do esquadrão').toContain('#squad-modal:not(.hidden)');
  });
});
