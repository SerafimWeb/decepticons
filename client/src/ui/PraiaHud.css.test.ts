import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const hud = readFileSync(new URL('./PraiaHud.ts', import.meta.url), 'utf8');

describe('o HUD da praia sobre o céu claro (P139, parte 1)', () => {
  const bloco = css.slice(css.indexOf('Legibilidade sobre o céu claro (P139'), css.indexOf('Legibilidade sobre o céu claro (P139') + 2400);

  it('o topo ganha um degradê escuro e suave só quando o HUD da praia está à vista (a classe hud-praia no #hud)', () => {
    expect(bloco).toContain('#hud.hud-praia::before');
    expect(bloco).toMatch(/linear-gradient\(180deg, rgba\(3, 6, 12, 0\.62\) 0%[^;]*rgba\(3, 6, 12, 0\) 100%\)/);
    expect(bloco, 'o degradê não pode pegar o clique').toMatch(/pointer-events: none/);
    // O HUD da praia põe e tira a classe junto com a própria visibilidade (e nasce escondido, como a raiz).
    expect(hud).toContain("this.pai.classList.toggle('hud-praia', v)");
    expect(hud).toMatch(/private visivel = false;/);
  });

  it('os textos de cima ganham sombra de verdade (o brilho colorido sumia sobre o céu rosado) e os marcos da faixa deixam de ter 9 px', () => {
    for (const alvo of ['.round-clock', '#mode', '.pf-marco', '.praia-alvo b']) expect(bloco).toContain(`#hud.hud-praia ${alvo}`);
    expect(bloco).toMatch(/\.pf-marco \{ font-size: 10\.5px;/);
    expect(bloco).toMatch(/text-shadow: 0 1px 2px #000/);
  });

  it('as cores de identidade ficam: a estação em ciano e o porto em laranja nos marcos', () => {
    expect(bloco).toContain('.pf-marco.pf-estacao { color: var(--cyan); }');
    expect(bloco).toContain('.pf-marco.pf-porto { color: var(--hot); }');
  });
});
