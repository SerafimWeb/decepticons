import { MicTest, type PecasDoTeste } from '../../client/src/voice/MicTest';

/**
 * A página da bancada `mic-real.mjs`: roda a classe `MicTest` **de verdade** (a mesma das Configurações) contra cada microfone REAL do computador, um por vez, e devolve o que o painel mostraria
 * (qual aparelho abriu, o estado, o texto e a barra). Só lê o nível; não grava nem guarda nada.
 */
const dorme = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function aparelhosDoComputador(): Promise<{ id: string; nome: string }[]> {
  // a permissão sai com o primeiro pedido; só depois o navegador mostra o nome dos aparelhos
  (await navigator.mediaDevices.getUserMedia({ audio: true })).getTracks().forEach((t) => t.stop());
  return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput').map((d) => ({ id: d.deviceId, nome: d.label || d.deviceId.slice(0, 8) }));
}

(window as unknown as { __medirTodos: unknown }).__medirTodos = async (ms: number) => {
  const saida: { pedido: string; aparelhoAberto: string; estado: string | undefined; texto: string; barraMax: number }[] = [];
  for (const a of await aparelhosDoComputador()) {
    const pecas = {
      painel: { hidden: true, dataset: {} as Record<string, string | undefined> },
      barra: { style: { width: '' } },
      status: { textContent: '' as string | null },
      botao: { textContent: '' as string | null },
      ouvir: { checked: false },
      aparelho: { textContent: '' as string | null },
    } satisfies PecasDoTeste;
    const teste = new MicTest(pecas, () => a.id);
    await teste.iniciar();
    let barraMax = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      await dorme(100);
      barraMax = Math.max(barraMax, Number.parseInt(pecas.barra.style.width, 10) || 0);
    }
    saida.push({ pedido: a.nome, aparelhoAberto: pecas.aparelho.textContent ?? '', estado: pecas.painel.dataset.estado, texto: pecas.status.textContent ?? '', barraMax });
    teste.parar();
  }
  return saida;
};
