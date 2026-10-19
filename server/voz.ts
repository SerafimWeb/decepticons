import { codificarLista, lerPronto, sinalValido } from '../shared/net/voz';

/** Mensagens de voz que cada jogador pode mandar numa janela (a conta normal é uma oferta ou resposta por colega, mais um aviso de entrada). */
const MAX_NA_JANELA = 30;
const JANELA_MS = 10_000;

/**
 * O relé de sinalização do chat de voz (P205): **só repassa**. Quem diz `PRONTO` entra na lista de voz da sala; o servidor manda a lista a todos eles quando ela muda;
 * e cada `SINAL` (oferta ou resposta do WebRTC) vai ao destino com o **remetente trocado pelo id de verdade** (o cliente nunca escolhe quem ele é). O áudio não passa aqui.
 *
 * Custo: nada por tick (só reage a mensagem, ~2 por par de jogadores na entrada); nada alocado fora dessas mensagens raras. Defesas: o `SINAL` precisa ter forma de SDP e caber no
 * teto (`sinalValido`), o destino precisa estar na voz da mesma sala, e cada jogador tem um teto de mensagens de voz por janela (a porteira geral, `guard.ts`, já limita a conexão).
 * Genérico no tipo da conexão: a sala usa o `Peer`; o teste usa um número.
 */
export class RelayDeVoz<P> {
  /** id da unidade → conexão, de quem está na voz. */
  private readonly porId = new Map<number, P>();
  private readonly idDe = new Map<P, number>();
  private readonly uso = new Map<P, { desde: number; n: number }>();

  constructor(
    private readonly enviar: (peer: P, bytes: Uint8Array) => void,
    private readonly agora: () => number = () => performance.now(),
  ) {}

  get naVoz(): number {
    return this.porId.size;
  }

  /** `PRONTO`: entrou na voz (ou saiu). `id` é o da unidade do jogador na sala (quem chama já sabe que ele está na sala). */
  pronto(peer: P, id: number, bytes: Uint8Array): void {
    const ligado = lerPronto(bytes);
    if (ligado === null || !this.dentroDoTeto(peer)) return;
    if (ligado ? this.entrar(peer, id) : this.sair(peer)) this.mandarLista();
  }

  /** `SINAL`: repassa ao destino, com o remetente trocado. `false` se foi descartado (quem não está na voz, destino que não existe, SDP torto, ou teto). */
  sinal(peer: P, bytes: Uint8Array): boolean {
    const de = this.idDe.get(peer);
    if (de === undefined || !sinalValido(bytes) || !this.dentroDoTeto(peer)) return false;
    const para = this.porId.get(bytes[1]!);
    if (para === undefined || para === peer) return false;
    const copia = bytes.slice();
    copia[1] = de;
    this.enviar(para, copia);
    return true;
  }

  /** O jogador saiu da sala ou fechou a conexão: sai da voz. */
  sairDaSala(peer: P): void {
    this.uso.delete(peer);
    if (this.sair(peer)) this.mandarLista();
  }

  private entrar(peer: P, id: number): boolean {
    if (this.idDe.get(peer) === id) return false;
    this.sair(peer);
    this.porId.set(id, peer);
    this.idDe.set(peer, id);
    return true;
  }

  private sair(peer: P): boolean {
    const id = this.idDe.get(peer);
    if (id === undefined) return false;
    this.idDe.delete(peer);
    this.porId.delete(id);
    return true;
  }

  private dentroDoTeto(peer: P): boolean {
    const t = this.agora();
    let u = this.uso.get(peer);
    if (!u || t - u.desde >= JANELA_MS) {
      u = { desde: t, n: 0 };
      this.uso.set(peer, u);
    }
    return ++u.n <= MAX_NA_JANELA;
  }

  private mandarLista(): void {
    if (this.porId.size === 0) return;
    const lista = codificarLista([...this.porId.keys()]);
    for (const peer of this.porId.values()) this.enviar(peer, lista.slice());
  }
}
