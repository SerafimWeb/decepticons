import { describe, expect, it } from 'vitest';
import { abrirMicrofone, aparelhoSumiu, RESTRICOES_DO_MIC, substitutosDaMixagem } from './abrirMicrofone';
import { ehMixagemDoSistema, listarAparelhos } from './aparelhos';

/**
 * O pedido do microfone (P229). O defeito que isto cobre foi achado num PC de verdade: com `deviceId: { ideal }` o Chrome/Brave abria SEMPRE o aparelho padrão, e a escolha do jogador nunca valia.
 * (O navegador de verdade só se prova com microfone de verdade: `.decepticons/medicoes/mic-real.mjs`.)
 */
const comRotulo = (rotulo: string) => {
  const parou: boolean[] = [];
  const faixa = { label: rotulo, stop: () => parou.push(true) };
  return { parou, fluxo: { id: rotulo, getAudioTracks: () => [faixa], getTracks: () => [faixa] } as unknown as MediaStream };
};
const fluxo = comRotulo('Microfone (Captain 300)').fluxo;
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

describe('a "Mixagem estéreo" nunca é o microfone do jogo (P241)', () => {
  const mixagem = 'Mixagem estéreo (Realtek(R) Audio)';
  const aparelhos = [
    { kind: 'audioinput', deviceId: 'default', label: 'Padrão - Mixagem estéreo (Realtek(R) Audio)' },
    { kind: 'audioinput', deviceId: 'communications', label: 'Comunicações - Mixagem estéreo (Realtek(R) Audio)' },
    { kind: 'audioinput', deviceId: 'mix-1', label: mixagem },
    { kind: 'audioinput', deviceId: 'cam-1', label: 'Câmera HD (046d:0825)' },
    { kind: 'audioinput', deviceId: 'mic-usb', label: 'Microfone (Captain 300)' },
    { kind: 'videoinput', deviceId: 'v-1', label: 'Câmera' },
  ];

  it('reconhece a mixagem pelo nome, em português, inglês e espanhol, e não confunde um microfone com ela', () => {
    for (const nome of [mixagem, 'Stereo Mix (Realtek High Definition Audio)', 'Mezcla estéreo (Realtek)', 'What U Hear', 'Wave Out Mix', 'Loopback (Virtual)'])
      expect(ehMixagemDoSistema(nome), nome).toBe(true);
    for (const nome of ['Microfone (Captain 300)', 'Headset (JBL GO Hands-Free AG Audio)', 'Microphone Array (Realtek)', 'Entrada (Realtek(R) Audio)', ''])
      expect(ehMixagemDoSistema(nome), nome).toBe(false);
  });

  it('a lista de escolha do jogador não oferece a mixagem', () => {
    const lista = listarAparelhos(aparelhos, (n) => `Microfone ${n}`);
    expect(lista.map((a) => a.id)).toEqual(['cam-1', 'mic-usb']);
  });

  it('os substitutos: só entradas de verdade, as que parecem microfone primeiro', () => {
    expect(substitutosDaMixagem(aparelhos)).toEqual(['mic-usb', 'cam-1']);
    expect(substitutosDaMixagem([])).toEqual([]);
  });

  it('o padrão do Windows é a mixagem: o jogo larga e abre o microfone de verdade', async () => {
    const aberta = comRotulo(mixagem);
    const boa = comRotulo('Microfone (Captain 300)');
    const pedidos: MediaStreamConstraints[] = [];
    const r = await abrirMicrofone(
      '',
      async (c) => {
        pedidos.push(c);
        return pedidos.length === 1 ? aberta.fluxo : boa.fluxo;
      },
      async () => aparelhos,
    );
    expect(r).toBe(boa.fluxo);
    expect(aberta.parou, 'a mixagem foi largada').toEqual([true]);
    expect(JSON.stringify(pedidos[1])).toContain('mic-usb');
  });

  it('a mixagem ficou salva como escolha: o mesmo caminho (a escolha exata abre a mixagem, o jogo troca)', async () => {
    const boa = comRotulo('Microfone (Captain 300)');
    const rotulos: Record<string, ReturnType<typeof comRotulo>> = { 'mix-1': comRotulo(mixagem), 'mic-usb': boa };
    const r = await abrirMicrofone(
      'mix-1',
      async (c) => rotulos[(c.audio as { deviceId: { exact: string } }).deviceId.exact]!.fluxo,
      async () => aparelhos,
    );
    expect(r).toBe(boa.fluxo);
  });

  it('um microfone de verdade abre de primeira, sem listar aparelho nenhum', async () => {
    let listou = 0;
    const r = await abrirMicrofone('', async () => fluxo, async () => (listou++, aparelhos));
    expect(r).toBe(fluxo);
    expect(listou).toBe(0);
  });

  it('só há a mixagem: falha com NotFoundError (mixagem) e NÃO manda o som do computador para a sala', async () => {
    const abertas: ReturnType<typeof comRotulo>[] = [];
    const pedir = async () => {
      const a = comRotulo(mixagem);
      abertas.push(a);
      return a.fluxo;
    };
    await expect(abrirMicrofone('', pedir, async () => aparelhos.filter((a) => /ixagem/.test(a.label)))).rejects.toMatchObject({ name: 'NotFoundError', message: expect.stringContaining('mixagem') });
    expect(abertas.every((a) => a.parou.length === 1), 'toda mixagem aberta foi largada').toBe(true);
  });

  it('a listagem falha: o mesmo resultado (nada de aparelho, nada de mixagem)', async () => {
    await expect(
      abrirMicrofone('', async () => comRotulo(mixagem).fluxo, async () => Promise.reject(new Error('sem enumerateDevices'))),
    ).rejects.toMatchObject({ name: 'NotFoundError' });
  });
});
