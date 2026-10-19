import { codificarReceber, lerEnviar } from '../shared/net/texto';

/** Mensagens de texto que cada jogador pode mandar numa janela (conversa normal: uma a cada poucos segundos; o teto corta quem cola em rajada). */
const MAX_NA_JANELA = 6;
const JANELA_MS = 10_000;

/**
 * O relé do chat de texto direto (P216): **só repassa**, de um piloto a outro da mesma sala. Lê a mensagem (formato, UTF-8, limpeza: `shared/net/texto.ts`), confere o destino e manda
 * **o texto limpo** com o **remetente trocado pelo id de verdade** (o cliente nunca escolhe quem ele é). Nada é guardado: o servidor não tem histórico de conversa.
 *
 * Custo: nada por tick (só reage a mensagem); uma cópia pequena por mensagem entregue. Defesas: teto de mensagens por jogador por janela, destino tem de ser outra pessoa da sala, tamanho e
 * limpeza do texto (sem controle nem inversão de direção); a porteira geral (`guard.ts`) já limita a conexão. Genérico no tipo da conexão: a sala usa o `Peer`; o teste usa um número.
 */
export class RelayDeTexto<P> {
  private readonly uso = new Map<P, { desde: number; n: number }>();

  constructor(
    private readonly enviar: (peer: P, bytes: Uint8Array) => void,
    private readonly agora: () => number = () => performance.now(),
  ) {}

  /** `ENVIAR` de `peer` (cujo id na sala é `deId`). `achar` devolve a conexão da pessoa com aquele id. `true` se entregou. */
  mensagem(peer: P, deId: number, bytes: Uint8Array, achar: (id: number) => P | undefined): boolean {
    const m = lerEnviar(bytes);
    if (!m || !this.dentroDoTeto(peer)) return false;
    const para = achar(m.id);
    if (para === undefined || para === peer) return false;
    this.enviar(para, codificarReceber(deId, m.texto));
    return true;
  }

  /** O jogador saiu da sala: esquece o contador dele. */
  sairDaSala(peer: P): void {
    this.uso.delete(peer);
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
}
