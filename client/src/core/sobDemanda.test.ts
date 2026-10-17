import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { abrirSobDemanda, sobDemanda } from './sobDemanda';

describe('painéis sob demanda (R7: fora do JS de partida)', () => {
  it('cria uma vez só, mesmo com vários cliques antes de o primeiro terminar', async () => {
    const criar = vi.fn(async () => ({ abrir: () => true }));
    const obter = sobDemanda(criar);
    const [a, b] = await Promise.all([obter(), obter()]);
    expect(a).toBe(b);
    expect(await obter()).toBe(a);
    expect(criar).toHaveBeenCalledTimes(1);
  });

  it('se o pedaço não baixou, o erro não fica guardado: a próxima tentativa baixa de novo', async () => {
    let tentativa = 0;
    const obter = sobDemanda(async () => {
      tentativa++;
      if (tentativa === 1) throw new Error('sem rede');
      return { abrir: () => true };
    });
    await expect(obter()).rejects.toThrow('sem rede');
    expect(await obter()).toBeDefined();
    expect(tentativa).toBe(2);
  });

  it('abrir cria o painel e o abre; um painel que falha ao nascer não derruba o jogo', async () => {
    const abrir = vi.fn(() => true);
    abrirSobDemanda(sobDemanda(async () => ({ abrir })));
    await vi.waitFor(() => expect(abrir).toHaveBeenCalledTimes(1));
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    abrirSobDemanda(sobDemanda(async () => Promise.reject(new Error('sem rede'))));
    await vi.waitFor(() => expect(aviso).toHaveBeenCalledTimes(1));
    aviso.mockRestore();
  });
});

describe('a ligação no Game (os painéis do console não pesam no download de quem não os abre)', () => {
  const game = readFileSync(new URL('./Game.ts', import.meta.url), 'utf8');

  it('o Esquadrão, as Campanhas, o Arsenal, o Servidor e as Câmeras vêm de import() no clique, não de import estático', () => {
    for (const painel of ['SquadPanel', 'CampaignPanel', 'ArsenalPanel', 'ServerPanel', 'CameraWall']) {
      expect(game, `import estático de ${painel}`).not.toMatch(new RegExp(`^import \\{[^}]*\\b${painel}\\b[^}]*\\} from '\\.\\./ui/${painel}';`, 'm'));
      expect(game, `import() de ${painel}`).toContain(`import('../ui/${painel}')`);
    }
  });
});
