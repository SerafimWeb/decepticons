import { describe, expect, it } from 'vitest';
import { codificarPronto, codificarSinal, lerLista, lerSinal, VOZ } from '../shared/net/voz';
import { autorizarPorSessao, RelayDeVoz } from './voz';

const SDP = 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\n';

/** O relé com conexões de mentira (números) e um relógio que o teste move. */
function montar(autorizar: (token: string) => boolean = (token) => token === 'adulto') {
  const recebido = new Map<number, Uint8Array[]>();
  let agora = 0;
  const relay = new RelayDeVoz<number>((peer, bytes) => {
    if (!recebido.has(peer)) recebido.set(peer, []);
    recebido.get(peer)!.push(bytes);
  }, () => agora, autorizar);
  return {
    relay,
    de: (peer: number) => recebido.get(peer) ?? [],
    listas: (peer: number) => (recebido.get(peer) ?? []).filter((b) => b[0] === VOZ.LISTA).map((b) => lerLista(b)),
    passar: (ms: number) => (agora += ms),
  };
}

describe('RelayDeVoz: a sinalização do chat de voz (P205)', () => {
  it('PRONTO: quem entra e quem sai recebe a lista de quem está na voz (só os que estão nela)', () => {
    const t = montar();
    t.relay.pronto(1, 10, codificarPronto(true, 'adulto'));
    expect(t.listas(1)).toEqual([[10]]);
    t.relay.pronto(2, 20, codificarPronto(true, 'adulto'));
    expect(t.listas(1).at(-1)).toEqual([10, 20]);
    expect(t.listas(2)).toEqual([[10, 20]]);
    t.relay.pronto(1, 10, codificarPronto(false));
    expect(t.listas(2).at(-1)).toEqual([20]);
    // quem saiu não recebe mais nada
    expect(t.listas(1)).toHaveLength(2);
    expect(t.relay.naVoz).toBe(1);
  });

  it('PRONTO repetido não manda a lista de novo; quem nunca entrou e "sai" não faz barulho', () => {
    const t = montar();
    t.relay.pronto(1, 10, codificarPronto(true, 'adulto'));
    t.relay.pronto(1, 10, codificarPronto(true, 'adulto'));
    expect(t.listas(1)).toHaveLength(1);
    t.relay.pronto(9, 90, codificarPronto(false));
    expect(t.listas(1)).toHaveLength(1);
  });

  it('queda de conexão: sai da voz e os outros recebem a lista nova', () => {
    const t = montar();
    t.relay.pronto(1, 10, codificarPronto(true, 'adulto'));
    t.relay.pronto(2, 20, codificarPronto(true, 'adulto'));
    t.relay.sairDaSala(1);
    expect(t.listas(2).at(-1)).toEqual([20]);
    expect(t.relay.naVoz).toBe(1);
  });

  it('SINAL: repassa ao destino com o remetente trocado pelo id de verdade (ninguém se passa por outro)', () => {
    const t = montar();
    t.relay.pronto(1, 10, codificarPronto(true, 'adulto'));
    t.relay.pronto(2, 20, codificarPronto(true, 'adulto'));
    // o jogador 1 (id 10) manda ao id 20 — o campo "id" que viaja é o destino
    expect(t.relay.sinal(1, codificarSinal({ id: 20, tipo: 'oferta', sdp: SDP }))).toBe(true);
    const chegou = lerSinal(t.de(2).at(-1)!)!;
    expect(chegou).toEqual({ id: 10, tipo: 'oferta', sdp: SDP });
    // e a resposta volta pelo mesmo caminho
    expect(t.relay.sinal(2, codificarSinal({ id: 10, tipo: 'resposta', sdp: SDP }))).toBe(true);
    expect(lerSinal(t.de(1).at(-1)!)).toEqual({ id: 20, tipo: 'resposta', sdp: SDP });
  });

  it('SINAL: descarta quem não está na voz, destino que não está, para si mesmo e SDP torto', () => {
    const t = montar();
    t.relay.pronto(1, 10, codificarPronto(true, 'adulto'));
    t.relay.pronto(2, 20, codificarPronto(true, 'adulto'));
    const antes = t.de(2).length;
    // 3 está na sala, mas não na voz
    expect(t.relay.sinal(3, codificarSinal({ id: 20, tipo: 'oferta', sdp: SDP }))).toBe(false);
    // destino que não existe, e o próprio id
    expect(t.relay.sinal(1, codificarSinal({ id: 99, tipo: 'oferta', sdp: SDP }))).toBe(false);
    expect(t.relay.sinal(1, codificarSinal({ id: 10, tipo: 'oferta', sdp: SDP }))).toBe(false);
    // não é SDP
    expect(t.relay.sinal(1, codificarSinal({ id: 20, tipo: 'oferta', sdp: 'lixo' }))).toBe(false);
    expect(t.de(2)).toHaveLength(antes);
  });

  it('SINAL: o destino que saiu da voz não recebe mais', () => {
    const t = montar();
    t.relay.pronto(1, 10, codificarPronto(true, 'adulto'));
    t.relay.pronto(2, 20, codificarPronto(true, 'adulto'));
    t.relay.pronto(2, 20, codificarPronto(false));
    expect(t.relay.sinal(1, codificarSinal({ id: 20, tipo: 'oferta', sdp: SDP }))).toBe(false);
  });

  it('o repasse é uma cópia: mexer no que chegou não estraga o que o remetente mandou', () => {
    const t = montar();
    t.relay.pronto(1, 10, codificarPronto(true, 'adulto'));
    t.relay.pronto(2, 20, codificarPronto(true, 'adulto'));
    const original = codificarSinal({ id: 20, tipo: 'oferta', sdp: SDP });
    t.relay.sinal(1, original);
    expect(original[1]).toBe(20);
  });

  it('teto: depois de 30 mensagens de voz na janela o jogador é ignorado, e a janela vira', () => {
    const t = montar();
    t.relay.pronto(1, 10, codificarPronto(true, 'adulto')); // 1
    t.relay.pronto(2, 20, codificarPronto(true, 'adulto'));
    const oferta = codificarSinal({ id: 20, tipo: 'oferta', sdp: SDP });
    let passou = 0;
    for (let i = 0; i < 40; i++) if (t.relay.sinal(1, oferta)) passou++;
    expect(passou).toBe(29);
    t.passar(10_001);
    expect(t.relay.sinal(1, oferta)).toBe(true);
    // o teto é por jogador: o outro não foi afetado
    expect(t.relay.sinal(2, codificarSinal({ id: 10, tipo: 'resposta', sdp: SDP }))).toBe(true);
  });

  it('mensagem de PRONTO torta é ignorada', () => {
    const t = montar();
    t.relay.pronto(1, 10, Uint8Array.of(VOZ.PRONTO, 7));
    t.relay.pronto(1, 10, Uint8Array.of(VOZ.PRONTO));
    expect(t.relay.naVoz).toBe(0);
  });
});

describe('RelayDeVoz: só conta de maior de idade entra na voz (P211)', () => {
  it('sem token (cliente velho), token de menor, de conta sem idade ou vencido: não entra, não recebe lista e não aparece para ninguém', () => {
    const t = montar();
    t.relay.pronto(1, 10, codificarPronto(true, 'adulto'));
    for (const [peer, id, token] of [[2, 20, ''], [3, 30, 'menor'], [4, 40, 'sem-idade'], [5, 50, 'vencido']] as const) t.relay.pronto(peer, id, codificarPronto(true, token));
    expect(t.relay.naVoz).toBe(1);
    expect(t.listas(1)).toEqual([[10]]);
    for (const peer of [2, 3, 4, 5]) expect(t.de(peer)).toHaveLength(0);
  });

  it('o menor não manda sinal a ninguém e ninguém lhe manda: a oferta dele não chega ao adulto', () => {
    const t = montar();
    t.relay.pronto(1, 10, codificarPronto(true, 'adulto'));
    t.relay.pronto(3, 30, codificarPronto(true, 'menor'));
    t.relay.sinal(3, codificarSinal({ id: 10, tipo: 'oferta', sdp: SDP }));
    expect(t.de(1).filter((b) => b[0] === VOZ.SINAL)).toHaveLength(0);
    t.relay.sinal(1, codificarSinal({ id: 30, tipo: 'oferta', sdp: SDP }));
    expect(t.de(3)).toHaveLength(0);
  });

  it('quem estava na voz e manda um PRONTO que não vale (sessão vencida) sai, e os outros recebem a lista nova', () => {
    let valida = true;
    const t = montar(() => valida);
    t.relay.pronto(1, 10, codificarPronto(true, 'a'));
    t.relay.pronto(2, 20, codificarPronto(true, 'b'));
    valida = false;
    t.relay.pronto(1, 10, codificarPronto(true, 'a'));
    expect(t.relay.naVoz).toBe(1);
    expect(t.listas(2).at(-1)).toEqual([20]);
  });

  it('sem autorizador o padrão é negar: ninguém entra na voz', () => {
    const recebido: number[] = [];
    const relay = new RelayDeVoz<number>((peer) => recebido.push(peer));
    relay.pronto(1, 10, codificarPronto(true, 'adulto'));
    relay.pronto(2, 20, codificarPronto(true));
    expect(relay.naVoz).toBe(0);
    expect(recebido).toEqual([]);
  });

  it('sair não pede token', () => {
    const t = montar();
    t.relay.pronto(1, 10, codificarPronto(true, 'adulto'));
    t.relay.pronto(2, 20, codificarPronto(true, 'adulto'));
    t.relay.pronto(1, 10, codificarPronto(false));
    expect(t.relay.naVoz).toBe(1);
  });
});

describe('autorizarPorSessao (P211 e P241): o token do PRONTO vira a faixa de idade da conta', () => {
  const ano = new Date().getUTCFullYear();
  const contas: Record<string, { nascimento: string | null }> = {
    'tk-adulto-123': { nascimento: '1990-01' },
    'tk-menor-1234': { nascimento: `${ano - 10}-03` },
    'tk-semidade-1': { nascimento: null },
  };
  const validar = (token: string) => contas[token] ?? null;
  const confere = (soAdulto: boolean) => {
    const f = autorizarPorSessao(validar, soAdulto);
    return {
      adulto: f('tk-adulto-123'),
      menor: f('tk-menor-1234'),
      semIdade: f('tk-semidade-1'),
      convidado: f(''),
      vencido: f('tk-que-nao-existe'),
      curto: f('abc'),
      comprido: f('x'.repeat(201)),
    };
  };

  it('regra da P211 (soAdulto = true): só o adulto entra; menor, sem idade, convidado, sessão vencida e token torto ficam fora', () => {
    expect(confere(true)).toEqual({ adulto: true, menor: false, semIdade: false, convidado: false, vencido: false, curto: false, comprido: false });
  });

  it('fase de testes (soAdulto = false): todos entram na lista da voz (o menor só ouve: o microfone é negado no cliente)', () => {
    expect(confere(false)).toEqual({ adulto: true, menor: true, semIdade: true, convidado: true, vencido: true, curto: true, comprido: true });
  });

  it('o relé com a fase de testes deixa o convidado e o adulto se ouvirem; com a regra da P211, o convidado fica fora', () => {
    for (const [soAdulto, esperado] of [[false, 2], [true, 1]] as const) {
      const t = montar(autorizarPorSessao(validar, soAdulto));
      t.relay.pronto(1, 10, codificarPronto(true, 'tk-adulto-123'));
      t.relay.pronto(2, 20, codificarPronto(true, ''));
      expect(t.relay.naVoz, `soAdulto=${soAdulto}`).toBe(esperado);
    }
  });
});
