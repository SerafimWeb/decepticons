import { describe, expect, it } from 'vitest';
import { ajustarOpus, OPUS_PARAMS } from './opus';

const base = (fmtp: string) =>
  ['v=0', 'o=- 1 2 IN IP4 127.0.0.1', 's=-', 'm=audio 9 UDP/TLS/RTP/SAVPF 111 63', 'a=rtpmap:111 opus/48000/2', ...(fmtp ? [fmtp] : []), 'a=rtpmap:63 red/48000/2', 'a=fmtp:63 111/111', ''].join('\r\n');

const fmtpDoOpus = (sdp: string) => /^a=fmtp:111 (.*)$/m.exec(sdp)![1]!.replace(/\r$/, '');

describe('ajustarOpus: a voz enxuta no SDP (P205)', () => {
  it('sem a linha fmtp, cria uma com o DTX, o FEC e o teto de 24 kbps, logo depois do rtpmap', () => {
    const out = ajustarOpus(base(''));
    const campos = fmtpDoOpus(out).split(';');
    expect(campos).toContain('usedtx=1');
    expect(campos).toContain('useinbandfec=1');
    expect(campos).toContain('maxaveragebitrate=24000');
    expect(out.indexOf('a=fmtp:111')).toBe(out.indexOf('a=rtpmap:111 opus/48000/2\r\n') + 'a=rtpmap:111 opus/48000/2\r\n'.length);
  });

  it('com fmtp, mantém o que já tinha e troca só o que difere (nada duplicado)', () => {
    const out = ajustarOpus(base('a=fmtp:111 minptime=10;useinbandfec=0;usedtx=0;stereo=1'));
    const campos = fmtpDoOpus(out).split(';');
    expect(campos).toContain('minptime=10');
    expect(campos).toContain('stereo=1');
    expect(campos).toContain('usedtx=1');
    expect(campos).toContain('useinbandfec=1');
    expect(campos).toContain('maxaveragebitrate=24000');
    expect(campos.filter((c) => c.startsWith('usedtx'))).toHaveLength(1);
    expect(campos.filter((c) => c.startsWith('useinbandfec'))).toHaveLength(1);
  });

  it('não mexe no que não é Opus (a linha de outro codec fica como estava) e é idempotente', () => {
    const out = ajustarOpus(base(''));
    expect(out).toContain('a=fmtp:63 111/111');
    expect(ajustarOpus(out)).toBe(out);
  });

  it('SDP sem Opus volta igual; as quebras de linha são as do SDP (CRLF ou LF)', () => {
    const semOpus = 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 0\r\na=rtpmap:0 PCMU/8000\r\n';
    expect(ajustarOpus(semOpus)).toBe(semOpus);
    const lf = base('').replace(/\r\n/g, '\n');
    const out = ajustarOpus(lf);
    expect(out).not.toContain('\r');
    expect(fmtpDoOpus(out)).toContain('usedtx=1');
  });

  it('os parâmetros podem ser trocados (o padrão é OPUS_PARAMS)', () => {
    const out = ajustarOpus(base(''), { maxaveragebitrate: '16000' });
    expect(fmtpDoOpus(out)).toBe('maxaveragebitrate=16000');
    expect(OPUS_PARAMS.maxaveragebitrate).toBe('24000');
  });
});
