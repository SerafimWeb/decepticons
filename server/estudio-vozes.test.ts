import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarEstudio } from '../scripts/estudio.mjs';
import { acharFfmpeg } from '../scripts/sonsRodar.mjs';
import { planejar, resumoDoPlano } from '../scripts/vozesLib.mjs';

const REAL = (p: string) => resolve(p);
const ffmpeg = acharFfmpeg();
const ARQUIVOS = [
  'scripts/sons-armas.json', 'client/src/audio/armasSom.json', 'scripts/estudio/armas-info.json',
  'scripts/estudio/index.html', 'scripts/estudio/estudio.css', 'scripts/estudio/nucleo.js', 'scripts/estudio/sons.js', 'scripts/estudio/microfone.js', 'scripts/estudio/vozes.js',
  'client/src/audio/falas.json', 'client/src/audio/vozesGeradas.json', 'scripts/vozes-gravadas.json', 'client/public/audio/vozes/br/combate.mp3',
];

/** Um WAV de verdade (PCM 16 bits, 22,05 kHz, mono): uma senoide que decai, no lugar de uma fala gravada. */
function wav(segundos = 1): Buffer {
  const taxa = 22050, n = Math.round(taxa * segundos), d = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) d.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 200 * i) / taxa) * 18000 * Math.exp(-i / (taxa * 0.5))), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + d.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(taxa, 24); h.writeUInt32LE(taxa * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(d.length, 40);
  return Buffer.concat([h, d]);
}

/** Um WAV com a amplitude dada (em passos de 16 bits): 0 é o zero absoluto de um aparelho mudo; 30 (−60 dBFS) é um chiado de microfone vivo. */
function wavConstante(amplitude: number, segundos = 1): Buffer {
  const taxa = 22050, n = Math.round(taxa * segundos), d = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) d.writeInt16LE(i % 2 === 0 ? amplitude : -amplitude, i * 2);
  const h = wav(0.001).subarray(0, 44);
  h.writeUInt32LE(36 + d.length, 4); h.writeUInt32LE(d.length, 40);
  return Buffer.concat([h, d]);
}

interface Resp { status: number; corpo: Buffer; tipo: string | undefined; cabecalhos: Record<string, string | string[] | undefined> }
function http(porta: number, metodo: string, caminho: string, opcoes: { corpo?: string | Buffer; headers?: Record<string, string> } = {}): Promise<Resp> {
  return new Promise((ok, falha) => {
    const req = request({ host: '127.0.0.1', port: porta, method: metodo, path: caminho, headers: opcoes.headers }, (res) => {
      const partes: Buffer[] = [];
      res.on('data', (c: Buffer) => partes.push(c));
      res.on('end', () => ok({ status: res.statusCode ?? 0, corpo: Buffer.concat(partes), tipo: res.headers['content-type'], cabecalhos: res.headers }));
    });
    req.on('error', falha);
    if (opcoes.corpo) req.write(opcoes.corpo);
    req.end();
  });
}
const json = (r: Resp) => JSON.parse(r.corpo.toString('utf8'));

describe('Estúdio, aba VOZES (P151, P155): o servidor', () => {
  let raiz = '';
  let vozes = '';
  let porta = 0;
  let servidor: ReturnType<typeof criarEstudio>;

  beforeAll(async () => {
    mkdirSync(resolve('.tmp'), { recursive: true });
    raiz = mkdtempSync(join(resolve('.tmp'), 'estudio-vozes-'));
    vozes = join(raiz, 'gravacoes');
    for (const rel of ARQUIVOS) {
      mkdirSync(join(raiz, rel, '..'), { recursive: true });
      copyFileSync(REAL(rel), join(raiz, rel));
    }
    mkdirSync(join(raiz, 'origem'), { recursive: true });
    servidor = criarEstudio({ raiz, origem: join(raiz, 'origem'), origemVozes: vozes, ffmpeg });
    await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok));
    porta = (servidor.address() as AddressInfo).port;
  });
  afterAll(async () => {
    await new Promise<void>((ok) => servidor.close(() => ok()));
    rmSync(raiz, { recursive: true, force: true });
  });

  const estado = async () => json(await http(porta, 'GET', '/api/estado')).vozes;
  const post = (caminho: string, corpo: unknown) => http(porta, 'POST', caminho, { corpo: JSON.stringify(corpo), headers: { 'content-type': 'application/json' } });
  const gravar = (sotaque: string, chave: string, bytes: Buffer, tipo = 'audio/wav') => http(porta, 'POST', `/api/vozes/gravar?sotaque=${sotaque}&chave=${chave}`, { corpo: bytes, headers: { 'content-type': tipo } });
  const entrada = (extra: Record<string, unknown> = {}) => ({ sotaque: 'br', chave: 'combate', fonte: 'combate-1.wav', de: 0, ate: 0.8, fade_ms: 60, ...extra });
  const salvar = (gravacoes: unknown[]) => post('/api/vozes/salvar', { gravacoes });

  it('o estado traz os sotaques, as 19 falas do catálogo, o que já foi gerado e nenhuma tomada ainda', async () => {
    const e = await estado();
    expect(e.sotaques).toEqual(['br', 'en', 'ru', 'cn']);
    expect(e.falas).toHaveLength(19);
    expect(e.falas.find((f: { chave: string }) => f.chave === 'combate').texto.br).toBe('Combate!');
    expect(e.geradas.br).toContain('combate');
    expect(e.tomadas).toEqual([]);
    expect(e.gravacoes).toEqual([]);
    expect((await http(porta, 'GET', '/estudio/vozes.js')).status).toBe(200);
    const modulos = json(await http(porta, 'GET', '/api/estado')).modulos;
    expect(modulos).toEqual([{ id: 'sons', titulo: 'SONS' }, { id: 'vozes', titulo: 'VOZES' }]);
  });

  it.skipIf(!ffmpeg)('GRAVAR converte o áudio do navegador para WAV mono 44,1 kHz e numera as tomadas (webm, wav, mp3)', async () => {
    const r1 = await gravar('br', 'combate', wav(1));
    expect(r1.status).toBe(200);
    expect(json(r1)).toMatchObject({ arquivo: 'combate-1.wav', numero: 1 });
    expect(json(r1).duracao).toBeCloseTo(1, 1);
    // o que o MediaRecorder do Chrome entrega: webm/opus, SEM duração no cabeçalho; o servidor o converte e acha a duração real
    const webm = join(raiz, 'teste.webm');
    const gerou = spawnSync(ffmpeg!, ['-hide_banner', '-y', '-f', 'lavfi', '-i', 'sine=frequency=300:duration=1.2', '-c:a', 'libopus', webm], { encoding: 'utf8' });
    expect(gerou.status).toBe(0);
    const r2 = await gravar('br', 'combate', readFileSync(webm), 'audio/webm;codecs=opus');
    expect(r2.status).toBe(200);
    expect(json(r2)).toMatchObject({ arquivo: 'combate-2.wav', numero: 2 });
    expect(json(r2).duracao).toBeCloseTo(1.2, 1);
    const wavLido = readFileSync(join(vozes, 'br', 'combate-2.wav'));
    expect(wavLido.subarray(0, 4).toString('latin1')).toBe('RIFF');
    expect(wavLido.readUInt32LE(24)).toBe(44100); // a taxa de amostragem
    expect(wavLido.readUInt16LE(22)).toBe(1); // mono
    // outra fala começa a sua própria contagem
    expect(json(await gravar('en', 'combate', wav(0.5))).arquivo).toBe('combate-1.wav');
    const e = await estado();
    expect(e.tomadas.filter((t: { sotaque: string; chave: string }) => t.sotaque === 'br' && t.chave === 'combate').map((t: { arquivo: string }) => t.arquivo)).toEqual(['combate-1.wav', 'combate-2.wav']);
  });

  it('GRAVAR recusa sotaque ou fala desconhecidos, gravação vazia, e não deixa lixo (arquivo que não é áudio ou curto demais)', async () => {
    expect((await gravar('xx', 'combate', wav())).status).toBe(400);
    expect((await gravar('br', 'fala_inventada', wav())).status).toBe(400);
    expect((await gravar('br', 'combate', Buffer.alloc(50))).status).toBe(400);
    if (!ffmpeg) return;
    const antes = readdirSync(join(vozes, 'br')).sort();
    const lixo = await gravar('br', 'combate', Buffer.from('isto nao e audio '.repeat(40)), 'audio/webm');
    expect(lixo.status).toBe(400);
    expect(json(lixo).erro).toContain('não consegui ler esta gravação');
    const curto = await gravar('br', 'combate', wav(0.03));
    expect(curto.status).toBe(400);
    expect(readdirSync(join(vozes, 'br')).sort()).toEqual(antes); // nada ficou para trás (nem o arquivo bruto temporário)
  });

  it.skipIf(!ffmpeg)('GRAVAR recusa a tomada em silêncio total (microfone mudo, P286) com 422 e não deixa arquivo, mas guarda o chiado de um microfone vivo', async () => {
    const antes = readdirSync(join(vozes, 'br')).sort();
    const mudo = await gravar('br', 'combate', wavConstante(0));
    expect(mudo.status).toBe(422);
    expect(json(mudo).mudo).toBe(true);
    expect(json(mudo).erro).toContain('silêncio total');
    expect(json(mudo).erro).toContain('PROCURAR O QUE FUNCIONA');
    expect(readdirSync(join(vozes, 'br')).sort()).toEqual(antes); // nem a tomada nem o arquivo bruto ficaram
    // o chiado de um microfone de verdade (−60 dBFS) passa: só o zero absoluto é recusado
    const vivo = await gravar('br', 'combate', wavConstante(30));
    expect(vivo.status).toBe(200);
    // e a tomada muda recusada não gastou o número: a próxima é a seguinte da última guardada
    const proxima = await gravar('br', 'combate', wavConstante(0));
    expect(proxima.status).toBe(422);
    const seguinte = await gravar('br', 'combate', wav(0.5));
    expect(json(seguinte).numero).toBe(json(vivo).numero + 1);
  });

  it.skipIf(!ffmpeg)('as tomadas são servidas só pelo nome simples e só as dos sotaques conhecidos', async () => {
    const ok = await http(porta, 'GET', '/api/vozes/gravacao/br/combate-1.wav');
    expect(ok.status).toBe(200);
    expect(ok.tipo).toBe('audio/wav');
    for (const ruim of ['/api/vozes/gravacao/br/..%2F..%2Fpackage.json', '/api/vozes/gravacao/br/ref.exe', '/api/vozes/gravacao/xx/combate-1.wav', '/api/vozes/gravacao/br/.env']) {
      expect([400, 404], ruim).toContain((await http(porta, 'GET', ruim)).status);
    }
    expect((await http(porta, 'GET', '/api/vozes/gravacao/br/combate-99.wav')).status).toBe(404);
  });

  it.skipIf(!ffmpeg)('SALVAR grava a lista das falas gravadas (com os efeitos) quando é válida, e recusa o que não é, sem gravar nada', async () => {
    const arq = join(raiz, 'scripts/vozes-gravadas.json');
    const antes = readFileSync(arq, 'utf8');
    for (const [ruim, esperado] of [
      [entrada({ fonte: 'combate-9.wav' }), 'não está em'],
      [entrada({ fonte: '../../package.json' }), 'não está em'],
      [entrada({ sotaque: 'xx' }), 'sotaque desconhecido'],
      [entrada({ chave: 'inventada' }), 'catálogo não tem'],
      [entrada({ efeitos: { pitch_st: 40 } }), 'pitch_st'],
      [entrada({ efeitos: { chorus: 1 } }), 'desconhecido'],
      [entrada({ de: 0.5, ate: 0.5 }), 'corte inválido'],
      [entrada({ fade_ms: 900 }), 'fade'],
      [entrada({ de: 0, ate: 9 }), 'mais de 8 s'],
    ] as const) {
      const r = await salvar([ruim]);
      expect(r.status, JSON.stringify(ruim)).toBe(400);
      expect(json(r).erros.join(), JSON.stringify(ruim)).toContain(esperado);
    }
    expect(json(await salvar([entrada(), entrada()])).erros.join()).toContain('repetida');
    expect((await post('/api/vozes/salvar', { gravacoes: 'x' })).status).toBe(400);
    expect(readFileSync(arq, 'utf8')).toBe(antes); // nada foi gravado
    const boa = entrada({ efeitos: { pitch_st: -2, compressor: 'forte', eco_ms: 90, eco_decay: 0.25 } });
    expect((await salvar([boa])).status).toBe(200);
    const g = JSON.parse(readFileSync(arq, 'utf8'));
    expect(g.gravacoes).toEqual([boa]);
    expect(g.alvo).toEqual({ media_db: -16, pico_db: -1 }); // o alvo e a nota sobrevivem
    expect(typeof g._nota).toBe('string');
  });

  it.skipIf(!ffmpeg)('PROCESSAR grava o mp3 da fala no lugar do gerado (que fica guardado), com os efeitos, e põe a fala no manifesto do jogo', async () => {
    const mp3 = join(raiz, 'client/public/audio/vozes/br/combate.mp3');
    const gerado = readFileSync(mp3);
    const r = await post('/api/vozes/processar', { sotaque: 'br', chave: 'combate' });
    expect(r.status).toBe(200);
    expect(json(r).resultado.ok).toBe(true);
    expect(json(r).resultado.efeitos).toEqual(['tom -2 st', 'compressor forte', 'eco 90 ms']);
    expect(readFileSync(mp3).equals(gerado)).toBe(false); // trocou
    const copia = join(vozes, '_elevenlabs/br/combate.mp3');
    expect(readFileSync(copia).equals(gerado)).toBe(true); // a voz gerada ficou guardada
    const manifesto = JSON.parse(readFileSync(join(raiz, 'client/src/audio/vozesGeradas.json'), 'utf8'));
    expect(manifesto.br).toContain('combate');
    // a fala gravada é servida em /saida (é o que o jogo toca)
    const saida = await http(porta, 'GET', '/api/vozes/saida/br/combate.mp3');
    expect(saida.status).toBe(200);
    expect(saida.tipo).toBe('audio/mpeg');
    // processar de novo NÃO sobrescreve a cópia da voz gerada com a gravada
    await post('/api/vozes/processar', { sotaque: 'br', chave: 'combate' });
    expect(readFileSync(copia).equals(gerado)).toBe(true);
    // fala que não está salva
    expect((await post('/api/vozes/processar', { sotaque: 'br', chave: 'voce_morreu' })).status).toBe(404);
  });

  it.skipIf(!ffmpeg)('uma fala que nunca teve voz gerada entra no manifesto do jogo quando é gravada (e sai quando se reverte)', async () => {
    await gravar('en', 'voce_morreu', wav(0.9));
    const g = [entrada(), entrada({ sotaque: 'en', chave: 'voce_morreu', fonte: 'voce_morreu-1.wav', ate: 0.8 })];
    expect((await salvar(g)).status).toBe(200);
    expect((await post('/api/vozes/processar', { sotaque: 'en', chave: 'voce_morreu' })).status).toBe(200);
    const manifesto = () => JSON.parse(readFileSync(join(raiz, 'client/src/audio/vozesGeradas.json'), 'utf8'));
    expect(manifesto().en).toContain('voce_morreu');
    expect(existsSync(join(raiz, 'client/public/audio/vozes/en/voce_morreu.mp3'))).toBe(true);
    // reverter sem cópia da voz gerada: a fala fica sem áudio e sai do manifesto
    const r = await post('/api/vozes/reverter', { sotaque: 'en', chave: 'voce_morreu' });
    expect(r.status).toBe(200);
    expect(json(r).voltouParaAVozGerada).toBe(false);
    expect(manifesto().en).not.toContain('voce_morreu');
    expect(existsSync(join(raiz, 'client/public/audio/vozes/en/voce_morreu.mp3'))).toBe(false);
    expect((await post('/api/vozes/reverter', { sotaque: 'en', chave: 'voce_morreu' })).status).toBe(404);
  });

  it.skipIf(!ffmpeg)('REVERTER devolve o mp3 que o ElevenLabs tinha gerado e tira a fala da lista de gravadas', async () => {
    const original = readFileSync(join(vozes, '_elevenlabs/br/combate.mp3'));
    const r = await post('/api/vozes/reverter', { sotaque: 'br', chave: 'combate' });
    expect(r.status).toBe(200);
    expect(json(r).voltouParaAVozGerada).toBe(true);
    expect(readFileSync(join(raiz, 'client/public/audio/vozes/br/combate.mp3')).equals(original)).toBe(true);
    const g = JSON.parse(readFileSync(join(raiz, 'scripts/vozes-gravadas.json'), 'utf8'));
    expect(g.gravacoes.find((x: { sotaque: string; chave: string }) => x.sotaque === 'br' && x.chave === 'combate')).toBeUndefined();
    // a tomada gravada continua guardada (dá para regravar a partir dela)
    expect(existsSync(join(vozes, 'br/combate-1.wav'))).toBe(true);
  });

  it.skipIf(!ffmpeg)('a PRÉVIA devolve a fala com os efeitos como mp3, sem gravar nada no jogo nem deixar arquivo', async () => {
    const mp3 = join(raiz, 'client/public/audio/vozes/br/combate.mp3');
    const antes = readFileSync(mp3);
    const gravadas = readFileSync(join(raiz, 'scripts/vozes-gravadas.json'), 'utf8');
    const corpo = { sotaque: 'br', chave: 'combate', gravacao: { fonte: 'combate-1.wav', de: 0, ate: 0.8, fade_ms: 60, efeitos: { velocidade: 2, pitch_st: -3, compressor: 'forte' } } };
    const r = await post('/api/vozes/previa', corpo);
    expect(r.status).toBe(200);
    expect(r.tipo).toBe('audio/mpeg');
    expect(JSON.parse(r.cabecalhos['x-resultado'] as string).duracao).toBeCloseTo(0.4, 5); // 0,8 s a 2×
    expect(readFileSync(mp3).equals(antes)).toBe(true);
    expect(readFileSync(join(raiz, 'scripts/vozes-gravadas.json'), 'utf8')).toBe(gravadas);
    expect(readdirSync(join(raiz, '.tmp/estudio-previa'))).toEqual([]);
    expect((await post('/api/vozes/previa', { ...corpo, gravacao: { ...corpo.gravacao, fonte: 'combate-9.wav' } })).status).toBe(400);
    expect((await post('/api/vozes/previa', { ...corpo, gravacao: { ...corpo.gravacao, efeitos: { pitch_st: 99 } } })).status).toBe(400);
    expect((await post('/api/vozes/previa', {})).status).toBe(400);
  });
});

describe('gerador de vozes: a sua voz gravada é protegida (P151)', () => {
  const falas = [{ chave: 'combate', estilo: 'grito', texto: { br: 'Combate!', en: 'Fight!', ru: 'Fight!', cn: 'Fight!' } }, { chave: 'voce_morreu', estilo: 'grave', texto: { br: 'Você morreu.', en: 'You die.', ru: 'You die.', cn: 'You die.' } }];
  const config = { vozes: { br: { voz: 'VOZ_BR' }, en: { voz: 'VOZ_EN' }, ru: { voz: '' }, cn: { voz: '' } } };

  it('uma fala gravada por você nunca é regerada: nem existindo, nem com --refazer', () => {
    const protegidas = new Set(['br/combate']);
    const normal = planejar({ falas, config, existentes: new Set(), protegidas });
    expect(normal.fazer.map((f) => `${f.sotaque}/${f.chave}`)).not.toContain('br/combate');
    expect(normal.fazer.map((f) => `${f.sotaque}/${f.chave}`)).toContain('en/combate'); // as outras seguem
    const refazendo = planejar({ falas, config, existentes: new Set(['br/combate', 'br/voce_morreu']), refazer: true, protegidas });
    expect(refazendo.fazer.map((f) => `${f.sotaque}/${f.chave}`)).not.toContain('br/combate'); // --refazer não pisa na sua voz
    expect(refazendo.fazer.map((f) => `${f.sotaque}/${f.chave}`)).toContain('br/voce_morreu'); // mas refaz a que não é sua
    expect(refazendo.pulados.find((p) => p.sotaque === 'br' && p.chave === 'combate')?.motivo).toContain('gravada por você');
    expect(resumoDoPlano(refazendo)).toContain('Gravadas por você (protegidas');
  });

  it('sem protegidas o comportamento de antes não muda', () => {
    const r = planejar({ falas, config, existentes: new Set(['br/combate']), refazer: true });
    expect(r.fazer.map((f) => `${f.sotaque}/${f.chave}`)).toContain('br/combate');
  });
});
