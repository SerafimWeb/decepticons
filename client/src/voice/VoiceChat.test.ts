import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { codificarLista, codificarSinal, lerPronto, lerSinal, VOZ } from '../../../shared/net/voz';
import { messageType } from '../../../shared/net/messages';
import { VoiceChat, type Ambiente } from './VoiceChat';

const SDP = ['v=0', 'o=- 1 2 IN IP4 127.0.0.1', 's=-', 'm=audio 9 UDP/TLS/RTP/SAVPF 111', 'a=rtpmap:111 opus/48000/2', 'a=fmtp:111 minptime=10', ''].join('\r\n');

class Emissor {
  private readonly ouvintes = new Map<string, ((e: any) => void)[]>();
  addEventListener(tipo: string, f: (e: any) => void): void {
    this.ouvintes.set(tipo, [...(this.ouvintes.get(tipo) ?? []), f]);
  }
  removeEventListener(tipo: string, f: (e: any) => void): void {
    this.ouvintes.set(tipo, (this.ouvintes.get(tipo) ?? []).filter((x) => x !== f));
  }
  emitir(tipo: string, e: object = {}): void {
    for (const f of this.ouvintes.get(tipo) ?? []) f({ type: tipo, ...e });
  }
}

class Transceptor {
  trocas: unknown[] = [];
  sender = {
    track: null as unknown,
    replaceTrack: async (t: unknown) => {
      this.sender.track = t;
      this.trocas.push(t);
    },
  };
  constructor(public direction: string) {}
}

class FakePC extends Emissor {
  static todas: FakePC[] = [];
  iceGatheringState = 'complete';
  connectionState = 'new';
  localDescription: { type: string; sdp: string } | null = null;
  remoteDescription: { type: string; sdp: string } | null = null;
  transceptores: Transceptor[] = [];
  fechada = false;
  constructor(public cfg: unknown) {
    super();
    FakePC.todas.push(this);
  }
  addTransceiver(_tipo: string, init: { direction: string }) {
    const t = new Transceptor(init.direction);
    this.transceptores.push(t);
    return t;
  }
  getTransceivers() {
    return this.transceptores;
  }
  async createOffer() {
    return { type: 'offer', sdp: SDP };
  }
  async createAnswer() {
    return { type: 'answer', sdp: SDP };
  }
  async setLocalDescription(d: { type: string; sdp: string }) {
    this.localDescription = d;
  }
  async setRemoteDescription(d: { type: string; sdp: string }) {
    this.remoteDescription = d;
    if (d.type === 'offer' && this.transceptores.length === 0) this.transceptores.push(new Transceptor('recvonly'));
  }
  close() {
    this.fechada = true;
  }
}

class Faixa extends Emissor {
  enabled = true;
  parada = false;
  stop() {
    this.parada = true;
  }
}
const fluxoComFaixa = () => {
  const faixa = new Faixa();
  return { faixa, fluxo: { getTracks: () => [faixa], getAudioTracks: () => [faixa] } as unknown as MediaStream };
};

/** Quem manda o quê: o teste lê as mensagens que o chat mandou ao servidor. */
function montar(opts: { saida?: boolean; token?: string | null } = {}) {
  let token: string | null | undefined = opts.token;
  const enviadas: Uint8Array[] = [];
  let resolverMic!: (f: MediaStream) => void;
  let recusarMic!: (e: unknown) => void;
  const pedidos = { n: 0, aparelhos: [] as string[] };
  const ambiente: Ambiente = {
    novaConexao: (cfg) => new FakePC(cfg) as unknown as RTCPeerConnection,
    pedirMicrofone: (aparelho) => {
      pedidos.n++;
      pedidos.aparelhos.push(aparelho);
      return new Promise((res, rej) => {
        resolverMic = res;
        recusarMic = rej;
      });
    },
  };
  const chat = new VoiceChat({ enviar: (b) => enviadas.push(b), saida: () => (opts.saida ? ({} as never) : null), ambiente, ...(token === undefined ? {} : { token: () => token ?? null }) });
  return {
    chat,
    enviadas,
    pedidos,
    definirToken: (novo: string | null) => (token = novo),
    resolverMic: (f: MediaStream) => resolverMic(f),
    recusarMic: (e: unknown) => recusarMic(e),
    de: (tipo: number) => enviadas.filter((b) => messageType(b) === tipo),
    pcs: () => FakePC.todas,
  };
}

/** Deixa as promessas e os `await` do chat andarem. */
const andar = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

describe('VoiceChat: a malha P2P (P205)', () => {
  beforeEach(() => {
    FakePC.todas = [];
  });

  it('entra na voz ao entrar na sala: avisa o servidor uma vez e pede o microfone', async () => {
    const t = montar();
    t.chat.configurar(true, 'sempre', 0.8);
    expect(t.enviadas).toHaveLength(0);
    t.chat.entrouNaSala(5);
    expect(t.de(VOZ.PRONTO).map((b) => lerPronto(b)?.ligado)).toEqual([true]);
    expect(t.pedidos.n).toBe(1);
    expect(t.chat.ativa).toBe(true);
    expect(t.chat.estadoMic).toBe('pedindo');
    // outra volta pelas mesmas configurações não repete
    t.chat.configurar(true, 'ptt', 0.5);
    expect(t.de(VOZ.PRONTO)).toHaveLength(1);
    expect(t.pedidos.n).toBe(1);
  });

  it('com a voz desligada nas configurações, entrar na sala não avisa nada nem pede o microfone', () => {
    const t = montar();
    t.chat.configurar(false, 'sempre', 0.8);
    t.chat.entrouNaSala(5);
    expect(t.enviadas).toHaveLength(0);
    expect(t.pedidos.n).toBe(0);
    expect(t.chat.ativa).toBe(false);
  });

  it('ligar a voz já dentro da sala entra nela; desligar sai: avisa, fecha as ligações e solta o microfone', async () => {
    const t = montar();
    t.chat.configurar(false, 'sempre', 0.8);
    t.chat.entrouNaSala(5);
    t.chat.configurar(true, 'sempre', 0.8);
    expect(t.de(VOZ.PRONTO).map((b) => lerPronto(b)?.ligado)).toEqual([true]);
    const { faixa, fluxo } = fluxoComFaixa();
    t.resolverMic(fluxo);
    await andar();
    t.chat.receber(codificarLista([5, 9]));
    await andar();
    expect(t.pcs()).toHaveLength(1);
    t.chat.configurar(false, 'sempre', 0.8);
    expect(t.de(VOZ.PRONTO).map((b) => lerPronto(b)?.ligado)).toEqual([true, false]);
    expect(t.pcs()[0]!.fechada).toBe(true);
    expect(faixa.parada).toBe(true);
    expect(t.chat.ativa).toBe(false);
    expect(t.chat.estadoMic).toBe('sem');
  });

  it('LISTA: quem tem o id menor oferece (só aos maiores) e nunca para si mesmo', async () => {
    const t = montar();
    t.chat.configurar(true, 'sempre', 0.8);
    t.chat.entrouNaSala(5);
    t.chat.receber(codificarLista([2, 5, 9, 12]));
    await andar();
    const ofertas = t.de(VOZ.SINAL).map((b) => lerSinal(b)!);
    expect(ofertas.map((o) => o.id).sort((a, b) => a - b)).toEqual([9, 12]);
    expect(ofertas.every((o) => o.tipo === 'oferta')).toBe(true);
    expect(t.pcs()).toHaveLength(2);
    // a mesma lista de novo não refaz as ofertas
    t.chat.receber(codificarLista([2, 5, 9, 12]));
    await andar();
    expect(t.de(VOZ.SINAL)).toHaveLength(2);
  });

  it('a oferta sai com o Opus enxuto (DTX, FEC, 24 kbps), com os endereços já dentro e um transceptor de áudio de ida e volta', async () => {
    const t = montar();
    t.chat.configurar(true, 'sempre', 0.8);
    t.chat.entrouNaSala(1);
    t.chat.receber(codificarLista([1, 4]));
    await andar();
    const o = lerSinal(t.de(VOZ.SINAL)[0]!)!;
    expect(o.sdp).toContain('usedtx=1');
    expect(o.sdp).toContain('maxaveragebitrate=24000');
    expect(o.sdp).toContain('minptime=10');
    const pc = t.pcs()[0]!;
    expect(pc.transceptores).toHaveLength(1);
    expect(pc.transceptores[0]!.direction).toBe('sendrecv');
    expect(JSON.stringify(pc.cfg)).toContain('stun:stun.l.google.com:19302');
    expect(JSON.stringify(pc.cfg)).not.toContain('turn:');
  });

  it('oferta recebida: responde com o Opus enxuto, abre o transceptor para os dois lados e manda a resposta a quem ofereceu', async () => {
    const t = montar();
    t.chat.configurar(true, 'sempre', 0.8);
    t.chat.entrouNaSala(9);
    t.chat.receber(codificarSinal({ id: 3, tipo: 'oferta', sdp: SDP }));
    await andar();
    const pc = t.pcs()[0]!;
    expect(pc.remoteDescription).toMatchObject({ type: 'offer', sdp: SDP });
    expect(pc.transceptores[0]!.direction).toBe('sendrecv');
    const r = lerSinal(t.de(VOZ.SINAL)[0]!)!;
    expect(r.id).toBe(3);
    expect(r.tipo).toBe('resposta');
    expect(r.sdp).toContain('usedtx=1');
  });

  it('resposta recebida vai para a ligação certa; uma resposta de quem não temos é ignorada', async () => {
    const t = montar();
    t.chat.configurar(true, 'sempre', 0.8);
    t.chat.entrouNaSala(1);
    t.chat.receber(codificarLista([1, 4]));
    await andar();
    t.chat.receber(codificarSinal({ id: 4, tipo: 'resposta', sdp: SDP }));
    t.chat.receber(codificarSinal({ id: 77, tipo: 'resposta', sdp: SDP }));
    await andar();
    expect(t.pcs()[0]!.remoteDescription).toMatchObject({ type: 'answer' });
    expect(t.pcs()).toHaveLength(1);
  });

  it('oferta de quem já tem ligação (recomeçou) troca a ligação velha pela nova', async () => {
    const t = montar();
    t.chat.configurar(true, 'sempre', 0.8);
    t.chat.entrouNaSala(9);
    t.chat.receber(codificarSinal({ id: 3, tipo: 'oferta', sdp: SDP }));
    await andar();
    t.chat.receber(codificarSinal({ id: 3, tipo: 'oferta', sdp: SDP }));
    await andar();
    expect(t.pcs()).toHaveLength(2);
    expect(t.pcs()[0]!.fechada).toBe(true);
    expect(t.pcs()[1]!.fechada).toBe(false);
  });

  it('quem sai da LISTA tem a ligação fechada e a voz tirada do ar', async () => {
    const t = montar();
    const tirou = vi.spyOn(t.chat.spatial, 'remover');
    t.chat.configurar(true, 'sempre', 0.8);
    t.chat.entrouNaSala(1);
    t.chat.receber(codificarLista([1, 4, 6]));
    await andar();
    t.chat.receber(codificarLista([1, 6]));
    expect(t.pcs().find((p) => p.fechada)).toBeDefined();
    expect(t.pcs().filter((p) => !p.fechada)).toHaveLength(1);
    expect(tirou).toHaveBeenCalledWith(4);
  });

  it('o microfone que chega depois da ligação entra por replaceTrack, sem renegociar; no PTT a faixa nasce fechada', async () => {
    const t = montar();
    t.chat.configurar(true, 'ptt', 0.8);
    t.chat.entrouNaSala(1);
    t.chat.receber(codificarLista([1, 4]));
    await andar();
    const pc = t.pcs()[0]!;
    expect(pc.transceptores[0]!.trocas).toHaveLength(0);
    const { faixa, fluxo } = fluxoComFaixa();
    t.resolverMic(fluxo);
    await andar();
    expect(pc.transceptores[0]!.trocas).toEqual([faixa]);
    expect(t.chat.estadoMic).toBe('ativo');
    expect(faixa.enabled).toBe(false);
    t.chat.mic.aoTecla(true);
    expect(faixa.enabled).toBe(true);
    expect(t.de(VOZ.SINAL)).toHaveLength(1); // nenhuma oferta nova
  });

  it('o microfone que já existia entra direto nas ligações novas (oferta e resposta)', async () => {
    const t = montar();
    t.chat.configurar(true, 'sempre', 0.8);
    t.chat.entrouNaSala(5);
    const { faixa, fluxo } = fluxoComFaixa();
    t.resolverMic(fluxo);
    await andar();
    t.chat.receber(codificarLista([5, 8]));
    t.chat.receber(codificarSinal({ id: 2, tipo: 'oferta', sdp: SDP }));
    await andar();
    expect(t.pcs()).toHaveLength(2);
    for (const pc of t.pcs()) expect(pc.transceptores[0]!.sender.track).toBe(faixa);
  });

  it('microfone recusado: só ouve (as ligações seguem, nada é mandado) e o estado diz por quê', async () => {
    const t = montar();
    t.chat.configurar(true, 'sempre', 0.8);
    t.chat.entrouNaSala(1);
    t.chat.receber(codificarLista([1, 4]));
    t.recusarMic(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
    await andar();
    expect(t.chat.estadoMic).toBe('negado');
    expect(t.chat.mic.temMic).toBe(false);
    expect(t.pcs()).toHaveLength(1);
    expect(t.pcs()[0]!.transceptores[0]!.sender.track).toBeNull();
    expect(t.chat.mic.transmitindo).toBe(false);
  });

  it('sem aparelho de microfone o estado é "sem", e desligar a voz enquanto o navegador pergunta solta o microfone que chegar', async () => {
    const a = montar();
    a.chat.configurar(true, 'sempre', 0.8);
    a.chat.entrouNaSala(1);
    a.recusarMic(Object.assign(new Error('x'), { name: 'NotFoundError' }));
    await andar();
    expect(a.chat.estadoMic).toBe('sem');

    const b = montar();
    b.chat.configurar(true, 'sempre', 0.8);
    b.chat.entrouNaSala(1);
    b.chat.configurar(false, 'sempre', 0.8);
    const { faixa, fluxo } = fluxoComFaixa();
    b.resolverMic(fluxo);
    await andar();
    expect(faixa.parada).toBe(true);
    expect(b.chat.estadoMic).toBe('sem');
    expect(b.chat.mic.temMic).toBe(false);
  });

  it('o microfone que cai no meio (aparelho desligado) tira a faixa das ligações e do controle', async () => {
    const t = montar();
    t.chat.configurar(true, 'sempre', 0.8);
    t.chat.entrouNaSala(1);
    t.chat.receber(codificarLista([1, 4]));
    const { faixa, fluxo } = fluxoComFaixa();
    t.resolverMic(fluxo);
    await andar();
    faixa.emitir('ended');
    await andar();
    expect(t.chat.estadoMic).toBe('sem');
    expect(t.chat.mic.temMic).toBe(false);
    expect(t.pcs()[0]!.transceptores[0]!.sender.track).toBeNull();
  });

  it('a conexão com a sala caiu: fecha as ligações; ao voltar entra na voz de novo sem pedir o microfone outra vez', async () => {
    const t = montar();
    t.chat.configurar(true, 'sempre', 0.8);
    t.chat.entrouNaSala(1);
    const { fluxo } = fluxoComFaixa();
    t.resolverMic(fluxo);
    await andar();
    t.chat.receber(codificarLista([1, 4]));
    await andar();
    t.chat.saiuDaSala();
    expect(t.pcs()[0]!.fechada).toBe(true);
    expect(t.chat.ativa).toBe(false);
    expect(t.chat.estadoMic).toBe('ativo');
    t.chat.entrouNaSala(3);
    expect(t.de(VOZ.PRONTO).map((b) => lerPronto(b)?.ligado)).toEqual([true, true]);
    expect(t.pedidos.n).toBe(1);
    t.chat.receber(codificarLista([3, 8]));
    await andar();
    expect(t.pcs()).toHaveLength(2);
  });

  it('a voz do colega vai para o áudio quando a faixa chega (com ou sem fluxo pronto) e a ligação "conectada" conta', async () => {
    const t = montar();
    const entrou = vi.spyOn(t.chat.spatial, 'adicionar');
    t.chat.configurar(true, 'sempre', 0.8);
    t.chat.entrouNaSala(1);
    t.chat.receber(codificarLista([1, 4]));
    await andar();
    const pc = t.pcs()[0]!;
    const fluxoDele = {} as MediaStream;
    pc.emitir('track', { streams: [fluxoDele], track: {} });
    expect(entrou).toHaveBeenCalledWith(4, fluxoDele);
    pc.connectionState = 'connected';
    pc.emitir('connectionstatechange');
    expect(t.chat.ligados).toBe(1);
    expect(t.chat.semConexao).toBe(0);
  });

  it('a rede não deixou ligar: a ligação fica marcada, o áudio dela sai e a conexão fecha (sem tentar para sempre)', async () => {
    const t = montar();
    const tirou = vi.spyOn(t.chat.spatial, 'remover');
    t.chat.configurar(true, 'sempre', 0.8);
    t.chat.entrouNaSala(1);
    t.chat.receber(codificarLista([1, 4]));
    await andar();
    const pc = t.pcs()[0]!;
    pc.connectionState = 'failed';
    pc.emitir('connectionstatechange');
    expect(t.chat.semConexao).toBe(1);
    expect(t.chat.ligados).toBe(0);
    expect(pc.fechada).toBe(true);
    expect(tirou).toHaveBeenCalledWith(4);
    // a mesma lista não abre outra tentativa
    t.chat.receber(codificarLista([1, 4]));
    await andar();
    expect(t.pcs()).toHaveLength(1);
  });

  it('erro ao montar a oferta marca a ligação como sem conexão em vez de quebrar o jogo', async () => {
    const t = montar();
    const original = t.pcs;
    t.chat.configurar(true, 'sempre', 0.8);
    t.chat.entrouNaSala(1);
    const criar = FakePC.prototype.createOffer;
    FakePC.prototype.createOffer = async () => {
      throw new Error('sem rede');
    };
    try {
      t.chat.receber(codificarLista([1, 4]));
      await andar();
    } finally {
      FakePC.prototype.createOffer = criar;
    }
    expect(original()[0]!.fechada).toBe(true);
    expect(t.chat.semConexao).toBe(1);
    expect(t.de(VOZ.SINAL)).toHaveLength(0);
  });

  it('mensagens de voz antes de entrar na voz (ou depois de sair) são ignoradas', async () => {
    const t = montar();
    t.chat.receber(codificarLista([1, 4]));
    t.chat.receber(codificarSinal({ id: 3, tipo: 'oferta', sdp: SDP }));
    await andar();
    expect(t.pcs()).toHaveLength(0);
    t.chat.configurar(true, 'sempre', 0.8);
    t.chat.entrouNaSala(1);
    t.chat.configurar(false, 'sempre', 0.8);
    t.chat.receber(codificarLista([1, 4]));
    await andar();
    expect(t.pcs()).toHaveLength(0);
  });

  it('mensagem torta do servidor é ignorada (não derruba nada)', async () => {
    const t = montar();
    t.chat.configurar(true, 'sempre', 0.8);
    t.chat.entrouNaSala(1);
    t.chat.receber(Uint8Array.of(VOZ.LISTA, 5, 1));
    t.chat.receber(Uint8Array.of(VOZ.SINAL, 1, 0, 1, 2, 3, 4));
    t.chat.receber(Uint8Array.of(99));
    t.chat.receber(new Uint8Array(0));
    await andar();
    expect(t.pcs()).toHaveLength(0);
  });

  it('por quadro: sem ligação não faz nada; com ligação, leva o ouvinte e a posição de quem o jogo vê', async () => {
    const t = montar();
    const ouvinte = vi.spyOn(t.chat.spatial, 'ouvinte');
    const posicionar = vi.spyOn(t.chat.spatial, 'posicionar');
    const pos = (id: number) => (id === 4 ? { x: 1, y: 2, z: 3 } : undefined);
    t.chat.configurar(true, 'sempre', 0.8);
    t.chat.entrouNaSala(1);
    t.chat.atualizar(0, 0, 0, 0, pos);
    expect(ouvinte).not.toHaveBeenCalled();
    t.chat.receber(codificarLista([1, 4, 6]));
    await andar();
    t.chat.atualizar(10, 0, 20, 1.5, pos);
    expect(ouvinte).toHaveBeenCalledWith(10, 0, 20, 1.5);
    expect(posicionar).toHaveBeenCalledTimes(1);
    expect(posicionar).toHaveBeenCalledWith(4, 1, 2, 3);
  });

  describe('o aparelho do microfone e o "sozinho na voz" (P212)', () => {
    it('o aparelho escolhido vai no pedido do microfone ("" = o padrão)', async () => {
      const t = montar();
      t.chat.configurar(true, 'sempre', 0.8, 'headset-usb');
      t.chat.entrouNaSala(1);
      expect(t.pedidos.aparelhos).toEqual(['headset-usb']);
      const sem = montar();
      sem.chat.configurar(true, 'sempre', 0.8);
      sem.chat.entrouNaSala(1);
      expect(sem.pedidos.aparelhos).toEqual(['']);
    });

    it('trocar de microfone no meio da voz solta o velho e pede o novo; as ligações recebem a faixa nova sem renegociar', async () => {
      const t = montar();
      t.chat.configurar(true, 'sempre', 0.8, 'a');
      t.chat.entrouNaSala(1);
      const velho = fluxoComFaixa();
      t.resolverMic(velho.fluxo);
      await andar();
      t.chat.receber(codificarLista([1, 4]));
      await andar();
      const pc = t.pcs()[0]!;
      expect(pc.transceptores[0]!.sender.track).toBe(velho.faixa);
      const ofertasAntes = t.de(VOZ.SINAL).length;
      t.chat.configurar(true, 'sempre', 0.8, 'b');
      expect(velho.faixa.parada).toBe(true);
      expect(t.pedidos.aparelhos).toEqual(['a', 'b']);
      const novo = fluxoComFaixa();
      t.resolverMic(novo.fluxo);
      await andar();
      expect(pc.transceptores[0]!.sender.track).toBe(novo.faixa);
      expect(t.chat.estadoMic).toBe('ativo');
      expect(t.de(VOZ.SINAL)).toHaveLength(ofertasAntes);
      expect(pc.fechada).toBe(false);
    });

    it('mexer em outra configuração (o volume da voz) NÃO pede o microfone de novo', async () => {
      const t = montar();
      t.chat.configurar(true, 'sempre', 0.8, 'a');
      t.chat.entrouNaSala(1);
      const { fluxo } = fluxoComFaixa();
      t.resolverMic(fluxo);
      await andar();
      for (const v of [0.7, 0.6, 0.5]) t.chat.configurar(true, 'sempre', v, 'a');
      t.chat.configurar(true, 'ptt', 0.5, 'a');
      expect(t.pedidos.n).toBe(1);
    });

    it('trocar o aparelho com a voz desligada, ou fora da voz, não pede nada', () => {
      const t = montar();
      t.chat.configurar(false, 'sempre', 0.8, 'a');
      t.chat.configurar(false, 'sempre', 0.8, 'b');
      expect(t.pedidos.n).toBe(0);
      t.chat.configurar(true, 'sempre', 0.8, 'b');
      t.chat.configurar(true, 'sempre', 0.8, 'c'); // ainda fora da sala: nada a trocar
      expect(t.pedidos.n).toBe(0);
    });

    it('colegas: zero é "sozinho na voz"; sobe com quem entra e desce com quem sai', async () => {
      const t = montar();
      t.chat.configurar(true, 'sempre', 0.8);
      t.chat.entrouNaSala(5);
      expect(t.chat.colegas).toBe(0);
      t.chat.receber(codificarLista([5]));
      expect(t.chat.colegas).toBe(0);
      t.chat.receber(codificarLista([5, 9, 12]));
      await andar();
      expect(t.chat.colegas).toBe(2);
      t.chat.receber(codificarLista([5, 12]));
      await andar();
      expect(t.chat.colegas).toBe(1);
    });
  });

  describe('o botão de microfone da tela de toque (P209)', () => {
    it('fora da voz o botão não faz nada; dentro, no modo "sempre", tocar alterna o mudo e soltar não muda nada', async () => {
      const t = montar();
      t.chat.aoBotao(true);
      expect(t.chat.mic.mudo).toBe(false);
      expect(t.pedidos.n, 'fora da voz o toque não pede o microfone').toBe(0);
      t.chat.configurar(true, 'sempre', 0.8);
      t.chat.entrouNaSala(1);
      const { faixa, fluxo } = fluxoComFaixa();
      t.resolverMic(fluxo);
      await andar();
      t.chat.aoBotao(true);
      t.chat.aoBotao(false);
      expect(faixa.enabled).toBe(false);
      t.chat.aoBotao(true);
      t.chat.aoBotao(false);
      expect(faixa.enabled).toBe(true);
    });

    it('no modo "segurar" vale enquanto o dedo está no botão', async () => {
      const t = montar();
      t.chat.configurar(true, 'ptt', 0.8);
      t.chat.entrouNaSala(1);
      const { faixa, fluxo } = fluxoComFaixa();
      t.resolverMic(fluxo);
      await andar();
      expect(faixa.enabled).toBe(false);
      t.chat.aoBotao(true);
      expect(faixa.enabled).toBe(true);
      t.chat.aoBotao(false);
      expect(faixa.enabled).toBe(false);
    });

    it('sem microfone (negado ou ausente) tocar pede o microfone de novo, e o toque seguinte já transmite', async () => {
      const t = montar();
      t.chat.configurar(true, 'sempre', 0.8);
      t.chat.entrouNaSala(1);
      t.recusarMic(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
      await andar();
      expect(t.chat.estadoMic).toBe('negado');
      expect(t.pedidos.n).toBe(1);
      t.chat.aoBotao(true);
      expect(t.pedidos.n).toBe(2);
      expect(t.chat.estadoMic).toBe('pedindo');
      const { faixa, fluxo } = fluxoComFaixa();
      t.resolverMic(fluxo);
      await andar();
      expect(t.chat.estadoMic).toBe('ativo');
      expect(faixa.enabled).toBe(true);
    });

    it('enquanto o navegador ainda pergunta, tocar não pergunta de novo; com o microfone ativo também não', async () => {
      const t = montar();
      t.chat.configurar(true, 'sempre', 0.8);
      t.chat.entrouNaSala(1);
      expect(t.chat.estadoMic).toBe('pedindo');
      t.chat.aoBotao(true);
      t.chat.aoBotao(false);
      expect(t.pedidos.n).toBe(1);
      const { fluxo } = fluxoComFaixa();
      t.resolverMic(fluxo);
      await andar();
      t.chat.aoBotao(true);
      expect(t.pedidos.n).toBe(1);
    });
  });

  describe('a tecla do chat (PTT ou mudo)', () => {
    let alvo: Emissor;
    const tecla = (tipo: 'keydown' | 'keyup', code: string, extra: object = {}) => alvo.emitir(tipo, { code, repeat: false, target: null, ...extra });

    beforeEach(() => {
      alvo = new Emissor();
      (globalThis as { window?: unknown }).window = alvo;
    });
    afterEach(() => {
      delete (globalThis as { window?: unknown }).window;
    });

    it('no ptt segura para falar; só vale com a voz ativa, ignora repetição e campo de texto, e perder o foco solta', async () => {
      const t = montar();
      const desligar = t.chat.ligarTeclas(() => 'KeyT');
      t.chat.configurar(true, 'ptt', 0.8);
      const { faixa, fluxo } = fluxoComFaixa();
      tecla('keydown', 'KeyT');
      expect(t.chat.mic.apertada).toBe(false); // ainda fora da voz
      t.chat.entrouNaSala(1);
      t.resolverMic(fluxo);
      await andar();
      tecla('keydown', 'KeyT', { target: { tagName: 'INPUT' } });
      expect(t.chat.mic.apertada).toBe(false);
      tecla('keydown', 'KeyW');
      expect(t.chat.mic.apertada).toBe(false);
      tecla('keydown', 'KeyT');
      expect(faixa.enabled).toBe(true);
      tecla('keyup', 'KeyT');
      expect(faixa.enabled).toBe(false);
      tecla('keydown', 'KeyT');
      alvo.emitir('blur');
      expect(faixa.enabled).toBe(false);
      desligar();
      tecla('keydown', 'KeyT');
      expect(t.chat.mic.apertada).toBe(false);
    });

    it('no modo "sempre" a tecla alterna o mudo, e a repetição do teclado (segurar) não fica ligando e desligando', async () => {
      const t = montar();
      t.chat.ligarTeclas(() => 'KeyT');
      t.chat.configurar(true, 'sempre', 0.8);
      t.chat.entrouNaSala(1);
      const { faixa, fluxo } = fluxoComFaixa();
      t.resolverMic(fluxo);
      await andar();
      tecla('keydown', 'KeyT');
      expect(faixa.enabled).toBe(false);
      tecla('keydown', 'KeyT', { repeat: true });
      tecla('keydown', 'KeyT', { repeat: true });
      expect(faixa.enabled).toBe(false);
      tecla('keyup', 'KeyT');
      tecla('keydown', 'KeyT');
      expect(faixa.enabled).toBe(true);
    });

    it('Shift e Ctrl valem pelos dois lados do teclado (a tecla configurada é o nome curto)', async () => {
      const t = montar();
      t.chat.ligarTeclas(() => 'Shift');
      t.chat.configurar(true, 'ptt', 0.8);
      t.chat.entrouNaSala(1);
      const { fluxo } = fluxoComFaixa();
      t.resolverMic(fluxo);
      await andar();
      tecla('keydown', 'ShiftRight');
      expect(t.chat.mic.apertada).toBe(true);
    });
  });

  describe('a espera pelos endereços', () => {
    afterEach(() => vi.useRealTimers());

    it('espera o navegador achar os endereços e manda a oferta quando a coleta termina', async () => {
      const t = montar();
      t.chat.configurar(true, 'sempre', 0.8);
      t.chat.entrouNaSala(1);
      const ctor = FakePC.prototype.createOffer;
      FakePC.prototype.createOffer = async function (this: FakePC) {
        this.iceGatheringState = 'gathering';
        return ctor.call(this);
      };
      try {
        t.chat.receber(codificarLista([1, 4]));
        await andar();
        expect(t.de(VOZ.SINAL)).toHaveLength(0);
        const pc = t.pcs()[0]!;
        pc.iceGatheringState = 'complete';
        pc.emitir('icegatheringstatechange');
        await andar();
        expect(t.de(VOZ.SINAL)).toHaveLength(1);
      } finally {
        FakePC.prototype.createOffer = ctor;
      }
    });

    it('com a coleta travada, manda o que tem depois de 2,5 s (a voz não espera para sempre)', async () => {
      vi.useFakeTimers();
      const t = montar();
      t.chat.configurar(true, 'sempre', 0.8);
      t.chat.entrouNaSala(1);
      const ctor = FakePC.prototype.createOffer;
      FakePC.prototype.createOffer = async function (this: FakePC) {
        this.iceGatheringState = 'gathering';
        return ctor.call(this);
      };
      try {
        t.chat.receber(codificarLista([1, 4]));
        await andar();
        expect(t.de(VOZ.SINAL)).toHaveLength(0);
        await vi.advanceTimersByTimeAsync(2400);
        expect(t.de(VOZ.SINAL)).toHaveLength(0);
        await vi.advanceTimersByTimeAsync(200);
        expect(t.de(VOZ.SINAL)).toHaveLength(1);
      } finally {
        FakePC.prototype.createOffer = ctor;
      }
    });

    it('ligação fechada enquanto esperava os endereços não manda a oferta', async () => {
      const t = montar();
      t.chat.configurar(true, 'sempre', 0.8);
      t.chat.entrouNaSala(1);
      const ctor = FakePC.prototype.createOffer;
      FakePC.prototype.createOffer = async function (this: FakePC) {
        this.iceGatheringState = 'gathering';
        return ctor.call(this);
      };
      try {
        t.chat.receber(codificarLista([1, 4]));
        await andar();
        t.chat.receber(codificarLista([1]));
        const pc = t.pcs()[0]!;
        pc.iceGatheringState = 'complete';
        pc.emitir('icegatheringstatechange');
        await andar();
        expect(t.de(VOZ.SINAL)).toHaveLength(0);
      } finally {
        FakePC.prototype.createOffer = ctor;
      }
    });
  });
});

describe('VoiceChat: só entra na voz com o token de uma conta de maior de idade (P211)', () => {
  it('o PRONTO leva o token da sessão', () => {
    const t = montar({ token: 'sessao-do-adulto' });
    t.chat.configurar(true, 'sempre', 0.8);
    t.chat.entrouNaSala(5);
    expect(t.de(VOZ.PRONTO).map((b) => lerPronto(b))).toEqual([{ ligado: true, token: 'sessao-do-adulto' }]);
  });

  it('sem token (convidado, menor, sem idade): não avisa o servidor, não pede o microfone e não fica na voz', () => {
    const t = montar({ token: null });
    t.chat.configurar(true, 'sempre', 0.8);
    t.chat.entrouNaSala(5);
    expect(t.de(VOZ.PRONTO)).toHaveLength(0);
    expect(t.pedidos.n).toBe(0);
    expect(t.chat.estadoMic).toBe('sem');
    expect(t.chat.colegas).toBe(0);
  });

  it('o token chega depois (a idade foi informada na sala): a próxima configuração entra na voz', () => {
    const t = montar({ token: null });
    t.chat.configurar(true, 'sempre', 0.8);
    t.chat.entrouNaSala(5);
    expect(t.de(VOZ.PRONTO)).toHaveLength(0);
    t.definirToken('sessao-nova');
    t.chat.configurar(true, 'sempre', 0.8);
    expect(t.de(VOZ.PRONTO).map((b) => lerPronto(b))).toEqual([{ ligado: true, token: 'sessao-nova' }]);
    expect(t.pedidos.n).toBe(1);
  });

  it('o token some no meio da voz (saiu da conta): a próxima configuração tira da voz', () => {
    const t = montar({ token: 'sessao' });
    t.chat.configurar(true, 'sempre', 0.8);
    t.chat.entrouNaSala(5);
    t.definirToken(null);
    t.chat.configurar(true, 'sempre', 0.8);
    expect(t.de(VOZ.PRONTO).map((b) => lerPronto(b)?.ligado)).toEqual([true, false]);
  });
});

describe('VoiceChat: o mudo por jogador (P228)', () => {
  it('silenciar e silenciado vão ao espaço da voz, e sair da sala esquece quem estava silenciado (os ids de lá não valem mais)', () => {
    const t = montar();
    expect(t.chat.silenciado(7)).toBe(false);
    t.chat.silenciar(7, true);
    expect(t.chat.silenciado(7)).toBe(true);
    t.chat.silenciar(7, false);
    expect(t.chat.silenciado(7)).toBe(false);
    t.chat.silenciar(8, true);
    t.chat.saiuDaSala();
    expect(t.chat.silenciado(8)).toBe(false);
  });
});

describe('VoiceChat.diagnostico (P237): o retrato que explica por que "não ouço ninguém"', () => {
  beforeEach(() => {
    FakePC.todas = [];
  });

  it('antes de entrar na voz: fora da sala, sem microfone, sem ligações', async () => {
    const t = montar();
    const d = await t.chat.diagnostico();
    expect(d).toMatchObject({ ativa: false, meuId: -1, estadoMic: 'sem', naLista: [], ligacoes: [] });
  });

  it('dentro da voz: o id, o token, o microfone (rótulo e modo) e quem o servidor disse estar na voz', async () => {
    const t = montar({ token: 'abc' });
    t.chat.configurar(true, 'sempre', 0.8);
    t.chat.entrouNaSala(1);
    const { faixa, fluxo } = fluxoComFaixa();
    (faixa as unknown as { label: string; getSettings: () => object }).label = 'Fone (Captain 300)';
    (faixa as unknown as { getSettings: () => object }).getSettings = () => ({ sampleRate: 16000, echoCancellation: true, noiseSuppression: false, autoGainControl: undefined });
    t.resolverMic(fluxo);
    await andar();
    t.chat.receber(codificarLista([1, 3]));
    await andar();
    const d = await t.chat.diagnostico();
    expect(d).toMatchObject({ ativa: true, meuId: 1, token: true, estadoMic: 'ativo', rotulo: 'Fone (Captain 300)', taxa: 16000, eco: 'sim', ruido: 'não', ganho: '?', modo: 'sempre', mudo: false, transmitindo: true });
    expect(d.naLista, 'o meu id não entra na lista dos colegas').toEqual([3]);
  });

  it('cada ligação entra no retrato com o estado e, quando o navegador dá, a rota e os bytes de áudio', async () => {
    const t = montar({ token: 'abc' });
    t.chat.configurar(true, 'sempre', 0.8);
    t.chat.entrouNaSala(1);
    t.chat.receber(codificarLista([1, 3]));
    await andar();
    const pc = t.pcs()[0] as unknown as { connectionState: string; iceConnectionState: string; getStats: () => Promise<Map<string, Record<string, unknown>>> };
    pc.connectionState = 'connected';
    pc.iceConnectionState = 'connected';
    const stats = new Map<string, Record<string, unknown>>([
      ['par', { id: 'par', type: 'candidate-pair', state: 'succeeded', nominated: true, localCandidateId: 'l', remoteCandidateId: 'r' }],
      ['l', { id: 'l', type: 'local-candidate', candidateType: 'host', protocol: 'udp' }],
      ['r', { id: 'r', type: 'remote-candidate', candidateType: 'srflx' }],
      ['o', { id: 'o', type: 'outbound-rtp', kind: 'audio', bytesSent: 5000 }],
      ['i', { id: 'i', type: 'inbound-rtp', kind: 'audio', bytesReceived: 7000, packetsLost: 2, audioLevel: 0.05 }],
      ['v', { id: 'v', type: 'outbound-rtp', kind: 'video', bytesSent: 999999 }],
    ]);
    (stats as unknown as { forEach: unknown }).forEach = Map.prototype.forEach.bind(stats);
    pc.getStats = async () => stats;
    const d = await t.chat.diagnostico();
    expect(d.ligacoes).toHaveLength(1);
    expect(d.ligacoes[0]).toMatchObject({ id: 3, conexao: 'connected', ice: 'connected', rota: 'host/udp → srflx', enviados: 5000, recebidos: 7000, perdidos: 2, nivel: 0.05 });
  });

  it('um navegador que falha nas estatísticas não derruba o diagnóstico: a ligação entra sem rota e sem bytes', async () => {
    const t = montar({ token: 'abc' });
    t.chat.configurar(true, 'sempre', 0.8);
    t.chat.entrouNaSala(1);
    t.chat.receber(codificarLista([1, 3]));
    await andar();
    (t.pcs()[0] as unknown as { getStats: () => Promise<never> }).getStats = async () => {
      throw new Error('sem estatística');
    };
    const d = await t.chat.diagnostico();
    expect(d.ligacoes[0]).toMatchObject({ id: 3, rota: '', enviados: 0, recebidos: 0, nivel: null });
  });
});
