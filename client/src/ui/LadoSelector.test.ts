import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CUSTO_DO_CONSORCIO,
  LADO_KEY,
  LADOS,
  SELO_SEM_LADO,
  ehLado,
  gravarLado,
  lerLado,
  rotuloDoSelo,
  type Memoria,
} from './LadoSelector';

const RAIZ = resolve(__dirname, '../..');

class Mem implements Memoria {
  readonly d = new Map<string, string>();
  getItem(k: string): string | null {
    return this.d.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.d.set(k, v);
  }
}

describe('o lado guardado (P179)', () => {
  it('sem escolha, null: o primeiro acesso não pergunta nada (nada de porta, P133)', () => {
    expect(lerLado(new Mem())).toBeNull();
    expect(lerLado(null)).toBeNull();
  });

  it('grava e lê as duas respostas', () => {
    const m = new Mem();
    gravarLado(m, 'consorcio');
    expect(m.getItem(LADO_KEY)).toBe('consorcio');
    expect(lerLado(m)).toBe('consorcio');
    gravarLado(m, 'alianca');
    expect(lerLado(m)).toBe('alianca');
  });

  it('valor estranho no armazenamento (adulterado ou de outra versão) vale como "sem escolha"', () => {
    const m = new Mem();
    for (const lixo of ['', 'x', 'ALIANCA', '1', '{"lado":"alianca"}']) {
      m.setItem(LADO_KEY, lixo);
      expect(lerLado(m), lixo).toBeNull();
    }
  });

  it('armazenamento que lança (aba anônima) não quebra nada', () => {
    const quebrado: Memoria = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    };
    expect(lerLado(quebrado)).toBeNull();
    expect(() => gravarLado(quebrado, 'alianca')).not.toThrow();
  });

  it('ehLado só aceita as duas respostas', () => {
    expect(ehLado('alianca')).toBe(true);
    expect(ehLado('consorcio')).toBe(true);
    expect(ehLado('outro')).toBe(false);
    expect(ehLado(null)).toBe(false);
  });
});

describe('o selo do console', () => {
  it('sem lado, o convite; com lado, o nome dele', () => {
    expect(rotuloDoSelo(null)).toBe(SELO_SEM_LADO);
    expect(rotuloDoSelo('alianca')).toBe('LADO: ALIANÇA ▸');
    expect(rotuloDoSelo('consorcio')).toBe('LADO: CONSÓRCIO ▸');
  });
});

describe('as duas respostas e o custo do Consórcio (dados)', () => {
  it('são duas, a Aliança primeiro (o padrão), cada uma com nome, quem é e o que busca', () => {
    expect(LADOS.map((l) => l.id)).toEqual(['alianca', 'consorcio']);
    for (const l of LADOS) for (const campo of [l.nome, l.quem, l.busca]) expect(campo.trim().length, l.id).toBeGreaterThan(5);
  });

  it('o painel do custo tem os pares "ele diz → na prática", sem repetir e sem número ou nome real (sátira de arquétipos: o fato só entra com fonte)', () => {
    expect(CUSTO_DO_CONSORCIO.length).toBeGreaterThanOrEqual(4);
    expect(new Set(CUSTO_DO_CONSORCIO.map(([diz]) => diz)).size).toBe(CUSTO_DO_CONSORCIO.length);
    for (const [diz, significa] of CUSTO_DO_CONSORCIO) {
      expect(diz.length).toBeGreaterThan(3);
      expect(significa.length).toBeGreaterThan(10);
      // fato é fato (`LADO_E_PEDAGOGIA.md` § 5): nenhum número, porcentagem ou ano no texto do jogo sem ficha com fonte
      expect(`${diz} ${significa}`, diz).not.toMatch(/\d/);
    }
  });
});

describe('o selo está no console completo e na pausa (o canto direito do cabeçalho), nunca na primeira tela', () => {
  const html = readFileSync(resolve(RAIZ, 'index.html'), 'utf8');

  it('o botão do selo existe dentro do `cc-flags` (que a primeira tela esconde: nada de porta)', () => {
    const flags = html.slice(html.indexOf('<div class="cc-flags">'));
    expect(flags.indexOf('id="cc-lado"')).toBeGreaterThan(0);
    expect(flags.indexOf('id="cc-lado"')).toBeLessThan(flags.indexOf('</div>'));
    expect(html).toMatch(/id="cc-lado"[^>]*hidden/); // só aparece quando o jogo o liga
  });

  it('o CSS da primeira tela esconde o `cc-flags` (a pergunta do lado não é uma porta)', () => {
    const css = readFileSync(resolve(RAIZ, 'src/styles.css'), 'utf8');
    expect(css).toMatch(/#overlay\.console\.cc-primeira \.cc-flags,[\s\S]*?display: none !important/);
  });
});
