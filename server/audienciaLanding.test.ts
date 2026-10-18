import { describe, expect, it } from 'vitest';
import { audienciaParaLanding } from '../scripts/site/audiencia-landing.mjs';
import { Audiencia, CHAVE_ORIGEM, CHAVE_VISITOU, type Ambiente } from '../client/src/core/Audiencia';

/**
 * A landing é HTML estático, sem bundler: ela embute o código da audiência (P193) transpilado de `shared/net/audiencia.ts` e `client/src/core/Audiencia.ts`. Este teste prova que o código
 * embutido **faz exatamente o que a classe do jogo faz**: as duas páginas descrevem a mesma visita do mesmo jeito (senão o painel diria duas coisas para a mesma pessoa).
 */
describe('a audiência embutida na landing', () => {
  const CHROME_WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
  const amb = (over: Partial<Ambiente> = {}): Ambiente => ({ referrer: '', hostProprio: 'cybermech.online', search: '', userAgent: CHROME_WIN, marcas: [], plataforma: '', dedo: false, largura: 1920, lingua: 'pt-BR', ...over });
  class Mem {
    readonly d = new Map<string, string>();
    getItem(k: string): string | null {
      return this.d.get(k) ?? null;
    }
    setItem(k: string, v: string): void {
      this.d.set(k, v);
    }
  }
  const CASOS: [string, Ambiente][] = [
    ['direto', amb()],
    ['busca', amb({ referrer: 'https://www.google.com/search?q=mech' })],
    ['rede social no celular', amb({ referrer: 'https://l.instagram.com/?u=x', userAgent: IPHONE, dedo: true, largura: 390, lingua: 'en-US' })],
    ['outro site', amb({ referrer: 'https://blog.exemplo.com/post' })],
    ['campanha', amb({ search: '?utm_source=Amigo&utm_medium=zap&utm_campaign=Lancamento' })],
    ['interno', amb({ referrer: 'https://cybermech.online/' })],
  ];

  async function embutida() {
    const js = await audienciaParaLanding();
    return (new Function(`return ${js};`)() as { Audiencia: typeof Audiencia }).Audiencia;
  }

  it('o código sai como JavaScript puro (nada de import, export nem tipos)', async () => {
    const js = await audienciaParaLanding();
    expect(js).not.toMatch(/^\s*(import|export)\b/m);
    expect(js).not.toMatch(/\binterface\b/);
    expect(js).toContain('classificarOrigem');
    expect(js.length).toBeLessThan(16 * 1024); // vai inline na página
  });

  it('a mesma visita, o mesmo funil e a mesma marca de primeira visita que a classe do jogo, nos seis jeitos de chegar', async () => {
    const Embutida = await embutida();
    for (const [nome, a] of CASOS) {
      const localJogo = new Mem();
      const localLanding = new Mem();
      const jogo = new Audiencia(a, { local: localJogo, sessao: new Mem() }, () => '2026-10-18');
      const landing = new Embutida(a, { local: localLanding, sessao: new Mem() }, () => '2026-10-18');
      expect(landing.visita(), nome).toEqual(jogo.visita());
      expect(landing.funil('logado'), nome).toEqual(jogo.funil('logado'));
      expect(localLanding.d, nome).toEqual(localJogo.d);
    }
  });

  it('as duas páginas se entendem pela aba: a origem que a landing guarda é a que o jogo herda', async () => {
    const Embutida = await embutida();
    const sessao = new Mem();
    const landing = new Embutida(amb({ referrer: 'https://www.google.com/' }), { local: new Mem(), sessao }, () => '2026-10-18');
    landing.visita();
    expect(JSON.parse(sessao.getItem(CHAVE_ORIGEM)!)).toEqual({ canal: 'busca', host: 'google.com' });
    const jogo = new Audiencia(amb({ referrer: 'https://cybermech.online/' }), { local: new Mem(), sessao }, () => '2026-10-18');
    expect(jogo.canal()).toBe('busca');
    expect(CHAVE_VISITOU).toBe('cybermech.visitou');
  });
});
