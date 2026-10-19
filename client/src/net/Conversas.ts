/**
 * As conversas de texto do jogador com os outros pilotos da sala (P216): só o **dado** (a tela é `ui/VisitaPanel.ts`, carregada sob demanda). Vive no jogo desde o começo para que a mensagem que chega
 * com a tela ainda fechada não se perca: fica guardada e aparece como "não lida" na lista da REDE. Sem histórico em disco nem no servidor: a conversa vive enquanto a sala vive (os ids são da sala).
 * Silenciar um piloto é só deste cliente: o que ele manda deixa de chegar a você, sem avisá-lo.
 */
export interface LinhaDeConversa {
  /** `true`: você escreveu; `false`: o outro. */
  meu: boolean;
  texto: string;
}

/** Quantas linhas cada conversa guarda (as mais antigas saem). */
export const LINHAS_POR_CONVERSA = 60;

export class Conversas {
  private readonly linhasDe = new Map<number, LinhaDeConversa[]>();
  private readonly naoLidasDe = new Map<number, number>();
  private readonly silenciados = new Set<number>();
  private readonly ouvintes = new Set<() => void>();

  /** Chama `f` quando algo muda (mensagem nova, lida, silenciado). Devolve quem cancela. */
  ouvir(f: () => void): () => void {
    this.ouvintes.add(f);
    return () => this.ouvintes.delete(f);
  }

  /** Uma mensagem do outro piloto. `false` se foi descartada (ele está silenciado). `aberta` = a conversa com ele está na tela agora (não vira "não lida"). */
  receber(de: number, texto: string, aberta = false): boolean {
    if (this.silenciados.has(de)) return false;
    this.guardar(de, { meu: false, texto });
    if (!aberta) this.naoLidasDe.set(de, (this.naoLidasDe.get(de) ?? 0) + 1);
    this.avisar();
    return true;
  }

  /** Uma mensagem sua ao outro piloto (já saiu). */
  enviada(para: number, texto: string): void {
    this.guardar(para, { meu: true, texto });
    this.avisar();
  }

  linhas(id: number): readonly LinhaDeConversa[] {
    return this.linhasDe.get(id) ?? [];
  }

  naoLidas(id: number): number {
    return this.naoLidasDe.get(id) ?? 0;
  }

  marcarLida(id: number): void {
    if (this.naoLidasDe.delete(id)) this.avisar();
  }

  estaSilenciado(id: number): boolean {
    return this.silenciados.has(id);
  }

  silenciar(id: number, silenciado: boolean): void {
    if (silenciado === this.silenciados.has(id)) return;
    if (silenciado) this.silenciados.add(id);
    else this.silenciados.delete(id);
    this.avisar();
  }

  /** Saiu da sala (ou a conexão caiu): os ids deixam de valer, a conversa some. */
  limpar(): void {
    this.linhasDe.clear();
    this.naoLidasDe.clear();
    this.silenciados.clear();
    this.avisar();
  }

  private guardar(id: number, linha: LinhaDeConversa): void {
    let l = this.linhasDe.get(id);
    if (!l) this.linhasDe.set(id, (l = []));
    l.push(linha);
    if (l.length > LINHAS_POR_CONVERSA) l.shift();
  }

  private avisar(): void {
    for (const f of this.ouvintes) f();
  }
}
