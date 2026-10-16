import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WEAPON_IDS, weapon } from '../client/src/combat/weapons';
import { criarEstudio } from '../scripts/estudio-sons.mjs';
import { validarArmas, validarMapa, type MapaDeSons } from '../scripts/sonsLib.mjs';
import { acharFfmpeg } from '../scripts/sonsRodar.mjs';

const REAL = (p: string) => resolve(p);
const lerReal = (p: string) => JSON.parse(readFileSync(REAL(p), 'utf8'));
const ffmpeg = acharFfmpeg();

/** Um WAV de verdade (PCM 16 bits, 8 kHz, mono): uma senoide de 1 s, para o servidor ter o que listar, servir e processar sem depender de arquivo do Comandante. */
function wavDeSenoide(segundos = 1): Buffer {
  const taxa = 8000, n = taxa * segundos, dados = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) dados.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / taxa) * 16000 * Math.exp(-i / (taxa * 0.6))), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + dados.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(taxa, 24); h.writeUInt32LE(taxa * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(dados.length, 40);
  return Buffer.concat([h, dados]);
}

interface Resp { status: number; corpo: Buffer; tipo: string | undefined }
function http(porta: number, metodo: string, caminho: string, opcoes: { corpo?: string | Buffer; headers?: Record<string, string> } = {}): Promise<Resp> {
  return new Promise((ok, falha) => {
    const req = request({ host: '127.0.0.1', port: porta, method: metodo, path: caminho, headers: opcoes.headers }, (res) => {
      const partes: Buffer[] = [];
      res.on('data', (c: Buffer) => partes.push(c));
      res.on('end', () => ok({ status: res.statusCode ?? 0, corpo: Buffer.concat(partes), tipo: res.headers['content-type'] }));
    });
    req.on('error', falha);
    if (opcoes.corpo) req.write(opcoes.corpo);
    req.end();
  });
}
const json = (r: Resp) => JSON.parse(r.corpo.toString('utf8'));

describe('Estúdio de Sons (P146): dados reais do repositório', () => {
  const mapa = lerReal('scripts/sons-armas.json') as MapaDeSons;
  const armas = lerReal('client/src/audio/armasSom.json').armas;
  const info = lerReal('scripts/estudio/armas-info.json').armas as { id: string; nome: string; intervalo: number; aceita: boolean }[];

  it('o mapa de clipes e a tabela de armas que estão no repositório são válidos', () => {
    expect(validarMapa(mapa)).toEqual([]);
    const nominal = (clipe: string) => {
      const s = mapa.sons.find((x) => x.destino === `${clipe}.mp3`);
      return s ? s.ate - s.de : Number.NaN;
    };
    expect(validarArmas(armas, info.map((a) => a.id), mapa.sons.map((s) => s.destino.replace(/\.mp3$/, '')), nominal)).toEqual([]);
  });

  it('o armas-info.json (o que o estúdio mostra) bate com o catálogo de armas do jogo: id, nome e segundos entre tiros', () => {
    expect(info.map((a) => a.id).sort()).toEqual([...WEAPON_IDS].sort());
    for (const a of info) {
      const w = weapon(a.id as (typeof WEAPON_IDS)[number]);
      expect(a.nome, a.id).toBe(w.name);
      expect(a.intervalo, a.id).toBe(w.fireInterval);
    }
  });

  it('só o lança-chamas e a motosserra (som contínuo próprio) ficam sem aceitar amostra', () => {
    expect(info.filter((a) => !a.aceita).map((a) => a.id).sort()).toEqual(['chainsaw', 'flamer']);
  });
});

describe('Estúdio de Sons: o servidor', () => {
  let raiz = '';
  let origem = '';
  let porta = 0;
  let servidor: ReturnType<typeof criarEstudio>;

  beforeAll(async () => {
    mkdirSync(resolve('.tmp'), { recursive: true });
    raiz = mkdtempSync(join(resolve('.tmp'), 'estudio-teste-'));
    origem = join(raiz, 'origem');
    for (const rel of ['scripts/sons-armas.json', 'client/src/audio/armasSom.json', 'scripts/estudio/armas-info.json', 'scripts/estudio/index.html']) {
      mkdirSync(join(raiz, rel, '..'), { recursive: true });
      copyFileSync(REAL(rel), join(raiz, rel));
    }
    mkdirSync(origem, { recursive: true });
    writeFileSync(join(origem, 'ref.wav'), wavDeSenoide());
    servidor = criarEstudio({ raiz, origem, ffmpeg });
    await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok));
    porta = (servidor.address() as AddressInfo).port;
  });
  afterAll(async () => {
    await new Promise<void>((ok) => servidor.close(() => ok()));
    rmSync(raiz, { recursive: true, force: true });
  });

  const estado = async () => json(await http(porta, 'GET', '/api/estado'));
  const salvar = (corpo: unknown, headers: Record<string, string> = {}) => http(porta, 'POST', '/api/salvar', { corpo: JSON.stringify(corpo), headers: { 'content-type': 'application/json', ...headers } });
  const clipeNovo = { destino: 'arma_teste.mp3', fonte: 'ref.wav', de: 0, ate: 0.5, fade_ms: 100 };

  it('serve a página e o estado: referências, clipes, tabela de armas e o catálogo', async () => {
    const pagina = await http(porta, 'GET', '/');
    expect(pagina.status).toBe(200);
    expect(pagina.tipo).toContain('text/html');
    expect(pagina.corpo.toString('utf8')).toContain('ESTÚDIO DE SONS');
    const e = await estado();
    expect(e.fontes.map((f: { nome: string }) => f.nome)).toEqual(['ref.wav']);
    expect(e.mapa.sons.length).toBeGreaterThanOrEqual(6);
    expect(Object.keys(e.armas)).toContain('blaster');
    expect(e.info).toHaveLength(WEAPON_IDS.length);
    expect(e.ffmpeg).toBe(Boolean(ffmpeg));
  });

  it('só o próprio estúdio fala com ele: Host de fora (DNS rebinding) e Origin de fora levam 403', async () => {
    expect((await http(porta, 'GET', '/api/estado', { headers: { host: 'evil.example.com' } })).status).toBe(403);
    expect((await http(porta, 'GET', '/api/estado', { headers: { host: `evil.example.com:${porta}` } })).status).toBe(403);
    expect((await salvar({ sons: [], armas: {} }, { origin: 'https://evil.example.com' })).status).toBe(403);
    expect((await salvar({ sons: [], armas: {} }, { origin: 'http://localhost:1' })).status).toBe(403); // outra porta
    // o próprio estúdio (mesma porta, localhost ou 127.0.0.1) passa
    expect((await http(porta, 'GET', '/api/estado', { headers: { host: `localhost:${porta}`, origin: `http://localhost:${porta}` } })).status).toBe(200);
  });

  it('serve só arquivo de áudio com nome simples: caminho, extensão e inexistente são recusados', async () => {
    const ok = await http(porta, 'GET', '/api/fonte/ref.wav');
    expect(ok.status).toBe(200);
    expect(ok.tipo).toBe('audio/wav');
    expect(ok.corpo.subarray(0, 4).toString('latin1')).toBe('RIFF');
    for (const ruim of ['..%2F..%2Fpackage.json', '..%5C..%5Cpackage.json', 'ref.wav%00.txt', 'package.json', '.env']) {
      expect([400, 404], ruim).toContain((await http(porta, 'GET', `/api/fonte/${ruim}`)).status);
    }
    expect((await http(porta, 'GET', '/api/fonte/nao-existe.wav')).status).toBe(404);
    expect((await http(porta, 'GET', '/api/saida/arma_blaster.mp3')).status).toBe(404); // a saída de teste está vazia (não toca no repositório)
  });

  it('SALVAR grava o mapa e a tabela quando tudo é válido, e recusa (sem gravar nada) o que não é', async () => {
    const e = await estado();
    const boa = { sons: [...e.mapa.sons.filter((s: { fonte: string }) => s.fonte === 'ref.wav'), clipeNovo], armas: { blaster: { clipe: 'arma_teste', ganho: 0.7, pitch: 1, maxS: 0.4 } } };
    const antes = readFileSync(join(raiz, 'scripts/sons-armas.json'), 'utf8');
    // fonte que não existe na pasta de referências
    const r1 = await salvar({ sons: e.mapa.sons, armas: {} });
    expect(r1.status).toBe(400);
    expect(json(r1).erros.join('\n')).toContain('não está em');
    // arma que o jogo não conhece, clipe inexistente, valor fora da faixa, arma sem amostra possível
    expect(json(await salvar({ sons: [clipeNovo], armas: { naoexiste: { clipe: 'arma_teste', ganho: 0.7, pitch: 1, maxS: 0.4 } } })).erros.join()).toContain('o jogo não conhece');
    expect(json(await salvar({ sons: [clipeNovo], armas: { blaster: { clipe: 'arma_outro', ganho: 0.7, pitch: 1, maxS: 0.4 } } })).erros.join()).toContain('não existe no mapa');
    expect(json(await salvar({ sons: [clipeNovo], armas: { blaster: { clipe: 'arma_teste', ganho: 9, pitch: 1, maxS: 0.4 } } })).erros.join()).toContain('ganho');
    expect(json(await salvar({ sons: [clipeNovo], armas: { flamer: { clipe: 'arma_teste', ganho: 0.7, pitch: 1, maxS: 0.4 } } })).erros.join()).toContain('som contínuo próprio');
    // fonte com caminho
    expect(json(await salvar({ sons: [{ ...clipeNovo, fonte: '../../package.json' }], armas: {} })).erros.join()).toContain('só o nome de um arquivo');
    // corpo que não é JSON
    expect((await http(porta, 'POST', '/api/salvar', { corpo: 'isto não é json', headers: { 'content-type': 'application/json' } })).status).toBe(400);
    expect(readFileSync(join(raiz, 'scripts/sons-armas.json'), 'utf8')).toBe(antes); // nada foi gravado

    const r2 = await salvar(boa);
    expect(r2.status).toBe(200);
    const mapa = JSON.parse(readFileSync(join(raiz, 'scripts/sons-armas.json'), 'utf8'));
    expect(mapa.sons.map((s: { destino: string }) => s.destino)).toContain('arma_teste.mp3');
    expect(mapa.alvo).toEqual(e.mapa.alvo); // o alvo de nível sobrevive
    const armas = JSON.parse(readFileSync(join(raiz, 'client/src/audio/armasSom.json'), 'utf8'));
    expect(armas.armas).toEqual({ blaster: { clipe: 'arma_teste', ganho: 0.7, pitch: 1, maxS: 0.4 } });
    expect(typeof armas._nota).toBe('string'); // a nota do arquivo sobrevive
  });

  it('IMPORTAR guarda o arquivo na pasta de referências; nome ruim, duplicado e vazio são recusados', async () => {
    const wav = wavDeSenoide(0.5);
    const ok = await http(porta, 'POST', '/api/importar?nome=novo%20som%20(1).wav', { corpo: wav });
    expect(ok.status).toBe(200);
    expect(existsSync(join(origem, 'novo som (1).wav'))).toBe(true);
    expect((await http(porta, 'POST', '/api/importar?nome=novo%20som%20(1).wav', { corpo: wav })).status).toBe(409);
    expect((await http(porta, 'POST', '/api/importar?nome=novo%20som%20(1).wav&sobrescrever=1', { corpo: wav })).status).toBe(200);
    for (const nome of ['..%2Fx.wav', 'x.exe', 'x.wav%00.txt', '.wav', '']) expect((await http(porta, 'POST', `/api/importar?nome=${nome}`, { corpo: wav })).status, nome).toBe(400);
    expect((await http(porta, 'POST', '/api/importar?nome=vazio.wav', { corpo: Buffer.alloc(10) })).status).toBe(400);
  });

  it.skipIf(!ffmpeg)('PROCESSAR roda o ffmpeg de verdade: gera o mp3 do clipe, mono e curto, e o serve em /api/saida', async () => {
    const r = await http(porta, 'POST', '/api/processar', { corpo: JSON.stringify({ destino: 'arma_teste.mp3' }), headers: { 'content-type': 'application/json' } });
    expect(r.status).toBe(200);
    const [res] = json(r).resultados;
    expect(res.ok).toBe(true);
    expect(res.duracao).toBeCloseTo(0.5, 5);
    expect(res.picoDb).toBeLessThanOrEqual(0);
    expect(existsSync(join(raiz, 'client/public/audio/armas/arma_teste.mp3'))).toBe(true);
    const mp3 = await http(porta, 'GET', '/api/saida/arma_teste.mp3');
    expect(mp3.status).toBe(200);
    expect(mp3.tipo).toBe('audio/mpeg');
    expect(mp3.corpo.length).toBeGreaterThan(500);
    expect((await estado()).saidas).toContain('arma_teste.mp3');
    // clipe que não está salvo no mapa
    expect((await http(porta, 'POST', '/api/processar', { corpo: JSON.stringify({ destino: 'arma_fantasma.mp3' }), headers: { 'content-type': 'application/json' } })).status).toBe(404);
  });
});
