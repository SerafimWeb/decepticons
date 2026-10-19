import { describe, expect, it } from 'vitest';
import { ROOM_SIZE } from './constants';
import { codificarLista, codificarPronto, codificarSinal, ehMensagemDeVoz, lerLista, lerPronto, lerSinal, sinalValido, VOZ, VOZ_SDP_MAX } from './voz';
import { MSG } from './messages';

const SDP = 'v=0\r\no=- 46117 2 IN IP4 127.0.0.1\r\ns=-\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n';

describe('voz: o contrato de sinalização (P205)', () => {
  it('os tipos de voz não colidem com os do jogo, e só eles são de voz', () => {
    const jogo = Object.values(MSG);
    for (const t of Object.values(VOZ)) {
      expect(jogo).not.toContain(t);
      expect(ehMensagemDeVoz(t)).toBe(true);
    }
    for (const t of jogo) expect(ehMensagemDeVoz(t)).toBe(false);
    expect(ehMensagemDeVoz(0)).toBe(false);
  });

  it('PRONTO: ida e volta, e recusa tamanho e valor estranhos', () => {
    expect(lerPronto(codificarPronto(true))).toBe(true);
    expect(lerPronto(codificarPronto(false))).toBe(false);
    expect(lerPronto(Uint8Array.of(VOZ.PRONTO))).toBeNull();
    expect(lerPronto(Uint8Array.of(VOZ.PRONTO, 2))).toBeNull();
    expect(lerPronto(Uint8Array.of(VOZ.PRONTO, 1, 0))).toBeNull();
    expect(lerPronto(Uint8Array.of(VOZ.LISTA, 1))).toBeNull();
  });

  it('LISTA: ida e volta, corta em ROOM_SIZE e recusa tamanho que não bate', () => {
    expect(lerLista(codificarLista([3, 7, 12]))).toEqual([3, 7, 12]);
    expect(lerLista(codificarLista([]))).toEqual([]);
    expect(lerLista(codificarLista(Array.from({ length: 20 }, (_, i) => i)))).toHaveLength(ROOM_SIZE);
    expect(lerLista(Uint8Array.of(VOZ.LISTA, 3, 1, 2))).toBeNull();
    expect(lerLista(Uint8Array.of(VOZ.LISTA, 1, 1, 2))).toBeNull();
    expect(lerLista(Uint8Array.of(VOZ.LISTA, ROOM_SIZE + 1, ...new Array(ROOM_SIZE + 1).fill(0)))).toBeNull();
  });

  it('SINAL: ida e volta da oferta e da resposta, com acento no texto', () => {
    const o = lerSinal(codificarSinal({ id: 5, tipo: 'oferta', sdp: SDP }))!;
    expect(o).toEqual({ id: 5, tipo: 'oferta', sdp: SDP });
    const r = lerSinal(codificarSinal({ id: 9, tipo: 'resposta', sdp: `${SDP}a=ação\r\n` }))!;
    expect(r.tipo).toBe('resposta');
    expect(r.sdp).toBe(`${SDP}a=ação\r\n`);
  });

  it('SINAL: só vale com cara de SDP, tipo conhecido e dentro do teto', () => {
    const bom = codificarSinal({ id: 1, tipo: 'oferta', sdp: SDP });
    expect(sinalValido(bom)).toBe(true);
    // não começa com "v=0"
    expect(sinalValido(codificarSinal({ id: 1, tipo: 'oferta', sdp: 'GET / HTTP/1.1\r\n' }))).toBe(false);
    // tipo desconhecido
    const torto = bom.slice();
    torto[2] = 2;
    expect(sinalValido(torto)).toBe(false);
    expect(lerSinal(torto)).toBeNull();
    // vazio ou só o cabeçalho
    expect(sinalValido(Uint8Array.of(VOZ.SINAL, 1, 0))).toBe(false);
    expect(sinalValido(Uint8Array.of(VOZ.SINAL, 1, 0, 0x76, 0x3d, 0x30))).toBe(false);
    // o teto: o maior SDP aceito passa, um byte a mais não
    const limite = codificarSinal({ id: 1, tipo: 'oferta', sdp: `v=0${'a'.repeat(VOZ_SDP_MAX - 3)}` });
    expect(limite.length).toBe(VOZ_SDP_MAX + 3);
    expect(sinalValido(limite)).toBe(true);
    expect(sinalValido(codificarSinal({ id: 1, tipo: 'oferta', sdp: `v=0${'a'.repeat(VOZ_SDP_MAX - 2)}` }))).toBe(false);
  });

  it('SINAL: UTF-8 inválido não vira texto (lerSinal devolve null)', () => {
    const m = codificarSinal({ id: 1, tipo: 'oferta', sdp: SDP });
    const sujo = new Uint8Array(m.length + 1);
    sujo.set(m);
    sujo[m.length] = 0xff;
    expect(lerSinal(sujo)).toBeNull();
  });
});
