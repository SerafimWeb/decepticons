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
    // O aviso das Potências (`PowerSettings`) se ancora no título do console. Ele ancorava em `.studio`,
    // que saiu do cabeçalho na P132 (o Comandante tirou o "um jogo SERAFIM WEB" da pausa).
    expect(consoleHtml, 'as Potências se ancoram no título (.cc-brand h1)').toMatch(/class="cc-brand"[^>]*>\s*<h1>/);
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

  it('os links do site (Sala de Controle e Oficina) moram só no monitor do Comandante, e a Sala de Controle não se chama ESQUADRÃO (o nome é dos bots, P287)', () => {
    const comando = consoleHtml.slice(consoleHtml.indexOf('id="mon-comando"'));
    for (const id of ['cmd-sala', 'cmd-oficina']) expect(comando.includes(`id="${id}"`), id).toBe(true);
    expect(comando).toMatch(/id="cmd-sala"[^>]*>\s*<a [^>]*><b>SALA DE CONTROLE<\/b>/);
    expect([...comando.matchAll(/<b>ESQUADRÃO<\/b>/g)]).toHaveLength(0);
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

  it('o esquadrão (P91, P287): uma entrada só, o botão do monitor PILOTOS, abre a janela, que mora fora dos monitores e começa fechada', () => {
    const pilotos = monitores.find((m) => m.includes('id="mon-oponentes"'))!;
    expect(pilotos).toMatch(/id="btn-esquadrao"[^>]*data-esquadrao-open/);
    // P293: o AJUSTAR saiu do PILOTOS (repetia o monitor CONFIGURAÇÕES). O #btn-settings (que o `SettingsMenu` acha) mora agora na lista de CONFIGURAÇÕES.
    expect(pilotos).not.toMatch(/id="btn-settings"/);
    const config = monitores.find((m) => m.includes('id="mon-config"'))!;
    expect(config).toMatch(/id="btn-settings"[^>]*data-settings-open="jogo"/);
    // P287 ("menos menus, menos redundância"): o item FICHA DE CADA BOT do COMANDO abria a mesma janela e saiu; uma entrada só.
    const comando = monitores.find((m) => m.includes('id="mon-comando"'))!;
    expect(comando).not.toContain('cmd-ficha');
    expect([...consoleHtml.matchAll(/data-esquadrao-open/g)]).toHaveLength(1);
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

describe('console de comando: o primeiro acesso (P133)', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

  it('a frase e o "mais opções" moram na mesa (fora dos monitores), nascem escondidos, e ficam em volta do botão verde', () => {
    const deck = html.slice(html.indexOf('<footer class="cc-deck">'), html.indexOf('</footer>', html.indexOf('<footer class="cc-deck">')));
    expect(deck).toContain('id="cc-pitch"');
    expect(deck).toContain('id="cc-mais"');
    expect(deck).toMatch(/id="cc-pitch" hidden/);
    expect(deck).toMatch(/id="cc-mais" hidden/);
    // A ordem na mesa: a frase, o botão de jogar, o "mais opções" (a tela enxuta é uma coluna só).
    expect(deck.indexOf('id="cc-pitch"')).toBeLessThan(deck.indexOf('id="cta"'));
    expect(deck.indexOf('id="cta"')).toBeLessThan(deck.indexOf('id="cc-mais"'));
  });

  it('o "mais opções" não tem tecla de atalho (o Enter é do botão verde) e os atalhos seguem aparecendo uma vez só', () => {
    const mais = html.slice(html.indexOf('id="cc-mais"'), html.indexOf('</button>', html.indexOf('id="cc-mais"')));
    expect(mais).not.toContain('data-tecla');
  });

  it('o CSS da tela enxuta esconde os monitores, a fileira de listas e a seleção de operação, e mostra a frase e o "mais opções"', () => {
    const bloco = css.slice(css.indexOf('Primeiro acesso (P133'), css.indexOf('Balão de ajuda dentro de um monitor'));
    expect(bloco.length).toBeGreaterThan(500);
    for (const alvo of ['.mon', '.cc-row', '.cc-ops']) expect(bloco).toContain(`#overlay.console.cc-primeira ${alvo}`);
    expect(bloco).toMatch(/\.cc-pitch, \.cc-mais \{ display: none; \}/); // por padrão escondidos (o jogador comum e o dono não os veem)
    expect(bloco).toMatch(/#overlay\.console\.cc-primeira \.cc-pitch,\s*#overlay\.console\.cc-primeira \.cc-mais \{ display: block; \}/);
    // Na carga (cc-espera) a grade é a mesma: o botão não pula quando o jogo fica pronto.
    expect(bloco).toContain('#overlay.console.cc-primeira .cc-launch { grid-column: 1 !important; }');
    // O texto vem de uma variável por língua (`:root:lang(xx)`, P173); o padrão, sem variável, é o português.
    expect(bloco).toContain("content: var(--t-carregando, 'CARREGANDO A PARTIDA')");
  });

  it('o fundo da tela enxuta deixa a cena da partida aparecer (é uma sombra, não um painel opaco)', () => {
    const bloco = css.slice(css.indexOf('#overlay.console.cc-primeira {'), css.indexOf('#overlay.console.cc-primeira .mon,'));
    expect(bloco).not.toMatch(/var\(--cc-wall/); // o console completo pinta a parede; a enxuta, não
    expect(bloco).toMatch(/rgba\(6, 8, 10, 0\.2\)/);
  });
});

describe('o par SOLO / MULTI da primeira tela (P182)', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const consola = readFileSync(new URL('./CommandConsole.ts', import.meta.url), 'utf8');
  const chave = readFileSync(new URL('./OnlineSwitch.ts', import.meta.url), 'utf8');

  it('o HTML tem o MULTI e a nota do SOLO, escondidos (o console só mostra com servidor), entre o botão verde e o "explorar"', () => {
    const deck = consoleHtml.slice(consoleHtml.indexOf('<footer class="cc-deck">'));
    expect(deck).toMatch(/<small class="cc-solo" id="cc-solo" hidden>/);
    expect(deck).toMatch(/<button type="button" class="cc-multi" id="btn-multi" hidden( data-func="[^"]*")?>/);
    expect(deck.indexOf('id="cta"')).toBeLessThan(deck.indexOf('id="btn-multi"'));
    expect(deck.indexOf('id="btn-multi"')).toBeLessThan(deck.indexOf('id="cc-mais"'));
  });

  it('o MULTI delega ao botão do online do monitor (a regra de entrar fica num lugar só) e só existe fora de uma sala', () => {
    expect(consola).toMatch(/online\?\.dataset\.online !== 'nao'/);
    expect(consola).toMatch(/multi\.addEventListener\('click', \(e\) => \{\s*e\.stopPropagation\(\);[^}]*online\.click\(\);/);
    expect(chave).toContain("btn.dataset.online = online ? 'sim' : 'nao'");
  });

  it('o CSS mostra o par só na tela enxuta e fora da carga, e a barra dourada é a do foco ou do mouse', () => {
    expect(css).toMatch(/\.cc-solo, \.cc-multi \{ display: none; \}/);
    expect(css).toMatch(/#overlay\.console\.cc-primeira \.cc-multi:not\(\[hidden\]\) \{\s*display: flex;/);
    expect(css).toMatch(/\.cc-multi:hover, #overlay\.console\.cc-primeira \.cc-multi:focus-visible \{[^}]*linear-gradient\(90deg, #6b3f00, #ffb31f/);
    expect(css).toContain('#overlay.console.cc-primeira.cc-espera .cc-solo, #overlay.console.cc-primeira.cc-espera .cc-multi { display: none !important; }');
  });
});
