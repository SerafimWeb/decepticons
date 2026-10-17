/**
 * Painéis opcionais, baixados só quando alguém os abre (R7: o JS de partida, o que todo jogador baixa para abrir o jogo, tem teto de 500 KB gzip e estava no limite; `scripts/orcamentoDeJs.mjs`).
 * O `Game` dá ao `CommandConsole` um `abrir` que chama `abrirSobDemanda`; o painel nasce no primeiro clique, a partir de um `import()`, e dali em diante é o mesmo.
 * Módulo independente (G3). Custo de CPU: zero até o clique.
 */

/** Uma fábrica que roda no máximo uma vez com sucesso. Se a criação falha (o pedaço não baixou: sem rede), a próxima chamada tenta de novo em vez de guardar o erro. */
export function sobDemanda<T>(criar: () => Promise<T>): () => Promise<T> {
  let pronto: Promise<T> | null = null;
  return () => {
    pronto ??= criar().catch((erro: unknown) => {
      pronto = null;
      throw erro;
    });
    return pronto;
  };
}

/** Abre o painel (criando-o na primeira vez). Um pedaço que não baixou não derruba o jogo: avisa no console e o próximo clique tenta de novo. */
export function abrirSobDemanda(painel: () => Promise<{ abrir(): unknown }>): void {
  void painel()
    .then((p) => p.abrir())
    .catch((erro: unknown) => console.warn('o painel não abriu (sem rede?):', erro));
}
