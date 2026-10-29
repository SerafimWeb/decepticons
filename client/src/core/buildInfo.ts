/**
 * O rótulo do build no rodapé (P278): "build 1284 · 634d80d · 29/10 10:25". O `scripts/site.mjs` grava o número e o hash (`VITE_BUILD`) e o instante em
 * UTC (`VITE_BUILD_EM`); a hora que aparece é a do aparelho de quem olha (o Comandante lê a de Brasília). Sem o instante (o build de desenvolvimento
 * e o do CI), o rótulo é só o de antes.
 */

/** "29/10 10:25" para um instante ISO; `null` se não for uma data de verdade. `timeZone` só para o teste (o jogo usa o fuso do aparelho). */
export function dataDoBuild(iso: string | undefined, timeZone?: string): string | null {
  if (!iso) return null;
  const quando = new Date(iso);
  if (Number.isNaN(quando.getTime())) return null;
  const partes = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', ...(timeZone ? { timeZone } : {}) }).formatToParts(quando);
  const de = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
  return `${de('day')}/${de('month')} ${de('hour')}:${de('minute')}`;
}

/** O texto da assinatura do rodapé: "CYBERMECH build 1284 · 634d80d · 29/10 10:25 · © 2026 SERAFIM WEB". */
export function rotuloDoBuild(build: string | undefined, emIso: string | undefined, ano: number, timeZone?: string): string {
  const id = build ?? 'dev';
  const data = build ? dataDoBuild(emIso, timeZone) : null;
  return `CYBERMECH ${id}${data ? ` · ${data}` : ''} · © ${ano} SERAFIM WEB`;
}
