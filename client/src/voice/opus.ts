/**
 * O Opus enxuto para voz (P205): o WebRTC não liga a supressão de silêncio (DTX) sozinho, e o padrão do Chrome para voz gira em torno de 32 kbps contínuos. Quem **recebe** diz no
 * próprio SDP o que quer ouvir (`a=fmtp`), e o codificador de quem manda obedece: `usedtx` (sem fala, quase nenhum pacote), `useinbandfec` (perda de pacote não vira buraco) e
 * `maxaveragebitrate` de 24 kbps (de sobra para voz mono). Em silêncio o custo cai a ~0; falando, ~24 kbps por colega.
 */
export const OPUS_PARAMS: Readonly<Record<string, string>> = Object.freeze({
  usedtx: '1',
  useinbandfec: '1',
  maxaveragebitrate: '24000',
});

/** Devolve o SDP com os parâmetros do Opus acertados (acrescenta o que falta e troca o que difere). Sem Opus no SDP, devolve igual. */
export function ajustarOpus(sdp: string, params: Readonly<Record<string, string>> = OPUS_PARAMS): string {
  const rtpmap = /^a=rtpmap:(\d+) opus\/48000\/2[^\r\n]*/im.exec(sdp);
  if (!rtpmap) return sdp;
  const pt = rtpmap[1]!;
  const fim = sdp.includes('\r\n') ? '\r\n' : '\n';
  const linha = new RegExp(`^a=fmtp:${pt} ([^\\r\\n]*)`, 'im');
  const atual = linha.exec(sdp);
  const campos = new Map<string, string>();
  for (const par of (atual?.[1] ?? '').split(';')) {
    const [k, ...v] = par.trim().split('=');
    if (k) campos.set(k, v.join('='));
  }
  for (const [k, v] of Object.entries(params)) campos.set(k, v);
  const nova = `a=fmtp:${pt} ${[...campos].map(([k, v]) => (v === '' ? k : `${k}=${v}`)).join(';')}`;
  if (atual) return sdp.replace(linha, nova);
  const depois = rtpmap.index + rtpmap[0].length;
  return `${sdp.slice(0, depois)}${fim}${nova}${sdp.slice(depois)}`;
}
