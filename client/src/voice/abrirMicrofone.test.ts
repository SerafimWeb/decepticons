import { describe, expect, it } from 'vitest';
import { abrirMicrofone, aparelhoSumiu, RESTRICOES_DO_MIC } from './abrirMicrofone';

/**
 * O pedido do microfone (P229). O defeito que isto cobre foi achado num PC de verdade: com `deviceId: { ideal }` o Chrome/Brave abria SEMPRE o aparelho padrão, e a escolha do jogador nunca valia.
 * (O navegador de verdade só se prova com microfone de verdade: `.decepticons/medicoes/mic-real.mjs`.)
 */
const fluxo = { id: 'fluxo' } as unknown as MediaStream;
const erro = (name: string) => Object.assign(new Error(name), { name });

describe('abrirMicrofone: o aparelho escolhido é EXATO', () => {
  it('com um aparelho escolhido pede `exact` (não `ideal`) junto das restrições de voz', async () => {
    const pedidos: MediaStreamConstraints[] = [];
    await abrirMicrofone('usb-1', async (c) => (pedidos.push(c), fluxo));
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]).toEqual({ audio: { ...RESTRICOES_DO_MIC, deviceId: { exact: 'usb-1' } }, video: false });
    expect(JSON.stringify(pedidos[0]), 'nunca ideal: perde para as outras preferências').not.toContain('ideal');
  });

  it('sem escolha ("" = o padrão do sistema) não manda deviceId nenhum', async () => {
    const pedidos: MediaStreamConstraints[] = [];
    await abrirMicrofone('', async (c) => (pedidos.push(c), fluxo));
    expect(pedidos).toEqual([{ audio: { ...RESTRICOES_DO_MIC }, video: false }]);
  });

  it('o aparelho salvo sumiu (OverconstrainedError ou NotFoundError): cai no padrão em vez de falhar', async () => {
    for (const nome of ['OverconstrainedError', 'NotFoundError']) {
      const pedidos: MediaStreamConstraints[] = [];
      const r = await abrirMicrofone('sumiu', async (c) => {
        pedidos.push(c);
        if (pedidos.length === 1) throw erro(nome);
        return fluxo;
      });
      expect(r, nome).toBe(fluxo);
      expect(pedidos, nome).toHaveLength(2);
      expect(JSON.stringify(pedidos[1]), 'o segundo pedido é o padrão').not.toContain('deviceId');
    }
  });

  it('permissão negada, aparelho em uso e o resto NÃO caem no padrão: o erro chega a quem chamou (que diz o motivo ao jogador)', async () => {
    for (const nome of ['NotAllowedError', 'NotReadableError', 'SecurityError', 'AbortError', 'Estranho']) {
      let chamadas = 0;
      await expect(abrirMicrofone('usb-1', async () => (chamadas++, Promise.reject(erro(nome)))), nome).rejects.toMatchObject({ name: nome });
      expect(chamadas, nome).toBe(1);
    }
  });

  it('se nem o padrão abre depois de o aparelho sumir, o erro do padrão é o que chega', async () => {
    await expect(abrirMicrofone('sumiu', async () => Promise.reject(erro('OverconstrainedError')))).rejects.toMatchObject({ name: 'OverconstrainedError' });
    let n = 0;
    await expect(abrirMicrofone('sumiu', async () => { n++; throw erro(n === 1 ? 'OverconstrainedError' : 'NotAllowedError'); })).rejects.toMatchObject({ name: 'NotAllowedError' });
  });

  it('aparelhoSumiu reconhece só os dois erros de "não existe"', () => {
    expect(aparelhoSumiu({ name: 'OverconstrainedError' })).toBe(true);
    expect(aparelhoSumiu({ name: 'NotFoundError' })).toBe(true);
    for (const e of [{ name: 'NotAllowedError' }, { name: 'NotReadableError' }, new Error('x'), null, undefined, 'texto']) expect(aparelhoSumiu(e)).toBe(false);
  });
});
