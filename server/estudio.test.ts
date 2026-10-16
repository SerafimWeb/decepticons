import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WEAPON_IDS, weapon } from '../client/src/combat/weapons';
import { criarEstudio, pendenciasDoGit } from '../scripts/estudio.mjs';
import { duracaoFinal } from '../scripts/efeitosLib.mjs';
import { validarArmas, validarMapa, type MapaDeSons } from '../scripts/sonsLib.mjs';
import { acharFfmpeg } from '../scripts/sonsRodar.mjs';

const REAL = (p: string) => resolve(p);
const lerReal = (p: string) => JSON.parse(readFileSync(REAL(p), 'utf8'));
const ffmpeg = acharFfmpeg();
const ARQUIVOS_DO_ESTUDIO = ['scripts/sons-armas.json', 'client/src/audio/armasSom.json', 'scripts/estudio/armas-info.json', 'scripts/estudio/index.html', 'scripts/estudio/estudio.css', 'scripts/estudio/nucleo.js', 'scripts/estudio/sons.js'];

/** Um WAV de verdade (PCM 16 bits, 8 kHz, mono): uma senoide de 1 s que decai, para o servidor ter o que listar, servir e processar sem depender de arquivo do Comandante. */
function wavDeSenoide(segundos = 1): Buffer {
  const taxa = 8000, n = Math.round(taxa * segundos), dados = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) dados.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / taxa) * 16000 * Math.exp(-i / (taxa * 0.6))), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + dados.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(taxa, 24); h.writeUInt32LE(taxa * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(dados.length, 40);
  return Buffer.concat([h, dados]);
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

describe('Estúdio (P150, P155): dados reais do repositório', () => {
  const mapa = lerReal('scripts/sons-armas.json') as MapaDeSons;
  const armas = lerReal('client/src/audio/armasSom.json').armas;
  const info = lerReal('scripts/estudio/armas-info.json').armas as { id: string; nome: string; intervalo: number; aceita: boolean }[];

  it('o mapa de clipes e a tabela de armas que estão no repositório são válidos', () => {
    expect(validarMapa(mapa)).toEqual([]);
    const nominal = (clipe: string) => {
      const s = mapa.sons.find((x) => x.destino === `${clipe}.mp3`);
      return s ? duracaoFinal(s) : Number.NaN;
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

describe('Estúdio: o servidor', () => {
  let raiz = '';
  let origem = '';
  let porta = 0;
  let servidor: ReturnType<typeof criarEstudio>;

  beforeAll(async () => {
    mkdirSync(resolve('.tmp'), { recursive: true });
    raiz = mkdtempSync(join(resolve('.tmp'), 'estudio-teste-'));
    origem = join(raiz, 'origem');
    for (const rel of ARQUIVOS_DO_ESTUDIO) {
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
  const post = (caminho: string, corpo: unknown, headers: Record<string, string> = {}) => http(porta, 'POST', caminho, { corpo: JSON.stringify(corpo), headers: { 'content-type': 'application/json', ...headers } });
  const salvar = (corpo: unknown, headers: Record<string, string> = {}) => post('/api/sons/salvar', corpo, headers);
  const clipeNovo = { destino: 'arma_teste.mp3', fonte: 'ref.wav', de: 0, ate: 0.5, fade_ms: 100 };

  it('serve a página, os scripts e o estilo, e o estado com o módulo de sons', async () => {
    const pagina = await http(porta, 'GET', '/');
    expect(pagina.status).toBe(200);
    expect(pagina.tipo).toContain('text/html');
    expect(pagina.corpo.toString('utf8')).toContain('ESTÚDIO');
    for (const [rota, tipo] of [['/estudio/nucleo.js', 'javascript'], ['/estudio/sons.js', 'javascript'], ['/estudio/estudio.css', 'css']] as const) {
      const r = await http(porta, 'GET', rota);
      expect(r.status, rota).toBe(200);
      expect(r.tipo, rota).toContain(tipo);
    }
    const e = await estado();
    expect(e.modulos).toEqual([{ id: 'sons', titulo: 'SONS' }]);
    expect(e.sons.fontes.map((f: { nome: string }) => f.nome)).toEqual(['ref.wav']);
    expect(e.sons.mapa.sons.length).toBeGreaterThanOrEqual(6);
    expect(Object.keys(e.sons.armas)).toContain('blaster');
    expect(e.sons.info).toHaveLength(WEAPON_IDS.length);
    expect(e.ffmpeg).toBe(Boolean(ffmpeg));
    expect(typeof e.rubberband).toBe('boolean');
  });

  it('só serve os arquivos da própria pasta do estúdio: html, caminho e inexistente não passam como estático', async () => {
    for (const ruim of ['/estudio/index.html', '/estudio/..%2F..%2Fpackage.json', '/estudio/../../package.json', '/estudio/nucleo.js.map', '/estudio/NUCLEO.JS', '/estudio/%2e%2e/sons.js', '/estudio/nao-existe.js']) {
      expect([404, 400], ruim).toContain((await http(porta, 'GET', ruim)).status);
    }
  });

  it('só o próprio estúdio fala com ele: Host de fora (DNS rebinding) e Origin de fora levam 403, em qualquer módulo', async () => {
    expect((await http(porta, 'GET', '/api/estado', { headers: { host: 'evil.example.com' } })).status).toBe(403);
    expect((await http(porta, 'GET', '/api/estado', { headers: { host: `evil.example.com:${porta}` } })).status).toBe(403);
    expect((await http(porta, 'GET', '/', { headers: { host: 'evil.example.com' } })).status).toBe(403);
    expect((await salvar({ sons: [], armas: {} }, { origin: 'https://evil.example.com' })).status).toBe(403);
    expect((await salvar({ sons: [], armas: {} }, { origin: 'http://localhost:1' })).status).toBe(403); // outra porta
    expect((await http(porta, 'GET', '/api/estado', { headers: { host: `localhost:${porta}`, origin: `http://localhost:${porta}` } })).status).toBe(200);
  });

  it('serve só arquivo de áudio com nome simples: caminho, extensão e inexistente são recusados', async () => {
    const ok = await http(porta, 'GET', '/api/sons/fonte/ref.wav');
    expect(ok.status).toBe(200);
    expect(ok.tipo).toBe('audio/wav');
    expect(ok.corpo.subarray(0, 4).toString('latin1')).toBe('RIFF');
    for (const ruim of ['..%2F..%2Fpackage.json', '..%5C..%5Cpackage.json', 'ref.wav%00.txt', 'package.json', '.env']) {
      expect([400, 404], ruim).toContain((await http(porta, 'GET', `/api/sons/fonte/${ruim}`)).status);
    }
    expect((await http(porta, 'GET', '/api/sons/fonte/nao-existe.wav')).status).toBe(404);
    expect((await http(porta, 'GET', '/api/sons/saida/arma_blaster.mp3')).status).toBe(404); // a saída de teste está vazia (não toca no repositório)
  });

  it('SALVAR grava o mapa (com os efeitos) e a tabela quando tudo é válido, e recusa (sem gravar nada) o que não é', async () => {
    const e = await estado();
    const comEfeitos = { ...clipeNovo, efeitos: { pitch_st: -3, compressor: 'medio', eco_ms: 90, eco_decay: 0.3 } };
    const boa = { sons: [...e.sons.mapa.sons.filter((s: { fonte: string }) => s.fonte === 'ref.wav'), comEfeitos], armas: { blaster: { clipe: 'arma_teste', ganho: 0.7, pitch: 1, maxS: 0.4 } } };
    const antes = readFileSync(join(raiz, 'scripts/sons-armas.json'), 'utf8');
    const r1 = await salvar({ sons: e.sons.mapa.sons, armas: {} });
    expect(r1.status).toBe(400);
    expect(json(r1).erros.join('\n')).toContain('não está em');
    expect(json(await salvar({ sons: [clipeNovo], armas: { naoexiste: { clipe: 'arma_teste', ganho: 0.7, pitch: 1, maxS: 0.4 } } })).erros.join()).toContain('o jogo não conhece');
    expect(json(await salvar({ sons: [clipeNovo], armas: { blaster: { clipe: 'arma_outro', ganho: 0.7, pitch: 1, maxS: 0.4 } } })).erros.join()).toContain('não existe no mapa');
    expect(json(await salvar({ sons: [clipeNovo], armas: { blaster: { clipe: 'arma_teste', ganho: 9, pitch: 1, maxS: 0.4 } } })).erros.join()).toContain('ganho');
    expect(json(await salvar({ sons: [clipeNovo], armas: { flamer: { clipe: 'arma_teste', ganho: 0.7, pitch: 1, maxS: 0.4 } } })).erros.join()).toContain('som contínuo próprio');
    expect(json(await salvar({ sons: [{ ...clipeNovo, fonte: '../../package.json' }], armas: {} })).erros.join()).toContain('só o nome de um arquivo');
    // efeitos inválidos, e esticar além do limite de 4 s
    expect(json(await salvar({ sons: [{ ...clipeNovo, efeitos: { pitch_st: 40 } }], armas: {} })).erros.join()).toContain('pitch_st');
    expect(json(await salvar({ sons: [{ ...clipeNovo, efeitos: { chorus: 2 } }], armas: {} })).erros.join()).toContain('desconhecido');
    expect(json(await salvar({ sons: [{ ...clipeNovo, de: 0, ate: 3, efeitos: { velocidade: 0.5 } }], armas: {} })).erros.join()).toContain('mais de 4 s');
    expect((await http(porta, 'POST', '/api/sons/salvar', { corpo: 'isto não é json', headers: { 'content-type': 'application/json' } })).status).toBe(400);
    expect(readFileSync(join(raiz, 'scripts/sons-armas.json'), 'utf8')).toBe(antes); // nada foi gravado

    const r2 = await salvar(boa);
    expect(r2.status).toBe(200);
    const mapa = JSON.parse(readFileSync(join(raiz, 'scripts/sons-armas.json'), 'utf8'));
    expect(mapa.sons.find((s: { destino: string }) => s.destino === 'arma_teste.mp3').efeitos).toEqual(comEfeitos.efeitos); // os efeitos foram gravados
    expect(mapa.alvo).toEqual(e.sons.mapa.alvo); // o alvo de nível sobrevive
    const armas = JSON.parse(readFileSync(join(raiz, 'client/src/audio/armasSom.json'), 'utf8'));
    expect(armas.armas).toEqual({ blaster: { clipe: 'arma_teste', ganho: 0.7, pitch: 1, maxS: 0.4 } });
    expect(typeof armas._nota).toBe('string');
  });

  it('a duração máxima de uma arma é conferida contra a duração DEPOIS dos efeitos: comprimir o clipe encurta o que a arma pode usar', async () => {
    const e = await estado();
    const base = e.sons.mapa.sons.filter((s: { fonte: string }) => s.fonte === 'ref.wav');
    const rapido = { ...clipeNovo, destino: 'arma_rapido.mp3', de: 0, ate: 0.8, efeitos: { velocidade: 2 } }; // 0,8 s viram 0,4 s
    const r = await salvar({ sons: [...base, rapido], armas: { blaster: { clipe: 'arma_rapido', ganho: 0.7, pitch: 1, maxS: 0.7 } } });
    expect(r.status).toBe(400);
    expect(json(r).erros.join()).toContain('passa do que o clipe dura');
    const ok = await salvar({ sons: [...base, rapido], armas: { blaster: { clipe: 'arma_rapido', ganho: 0.7, pitch: 1, maxS: 0.4 } } });
    expect(ok.status).toBe(200);
  });

  it.skipIf(!ffmpeg)('PROCESSAR roda o ffmpeg de verdade: gera o mp3 do clipe com efeitos, mono, na duração final, e o serve em /api/sons/saida', async () => {
    const e = await estado();
    const salvou = await salvar({ sons: [...e.sons.mapa.sons.filter((s: { fonte: string; destino: string }) => s.fonte === 'ref.wav' && s.destino !== 'arma_teste.mp3'), { ...clipeNovo, ate: 0.6, efeitos: { velocidade: 2, compressor: 'leve' } }], armas: {} });
    expect(salvou.status, salvou.corpo.toString('utf8')).toBe(200);
    const r = await post('/api/sons/processar', { destino: 'arma_teste.mp3' });
    expect(r.status).toBe(200);
    const [res] = json(r).resultados;
    expect(res.ok).toBe(true);
    expect(res.duracao).toBeCloseTo(0.3, 5); // 0,6 s a 2×
    expect(res.efeitos).toEqual(['velocidade ×2', 'compressor leve']);
    expect(res.picoDb).toBeLessThanOrEqual(0);
    expect(existsSync(join(raiz, 'client/public/audio/armas/arma_teste.mp3'))).toBe(true);
    const mp3 = await http(porta, 'GET', '/api/sons/saida/arma_teste.mp3');
    expect(mp3.status).toBe(200);
    expect(mp3.tipo).toBe('audio/mpeg');
    expect(mp3.corpo.length).toBeGreaterThan(300);
    expect((await estado()).sons.saidas).toContain('arma_teste.mp3');
    expect((await post('/api/sons/processar', { destino: 'arma_fantasma.mp3' })).status).toBe(404);
  });

  it.skipIf(!ffmpeg)('a PRÉVIA devolve o som como áudio, com os efeitos e a duração certos, sem gravar nada no jogo e sem deixar arquivo para trás', async () => {
    const saidasAntes = readdirSync(join(raiz, 'client/public/audio/armas'));
    const mapaAntes = readFileSync(join(raiz, 'scripts/sons-armas.json'), 'utf8');
    const normal = await post('/api/sons/previa', { som: { fonte: 'ref.wav', de: 0, ate: 0.8, fade_ms: 100 } });
    expect(normal.status).toBe(200);
    expect(normal.tipo).toBe('audio/mpeg');
    expect(normal.corpo.length).toBeGreaterThan(300);
    const info = JSON.parse(normal.cabecalhos['x-resultado'] as string);
    expect(info.duracao).toBeCloseTo(0.8, 5);
    const comprimido = await post('/api/sons/previa', { som: { fonte: 'ref.wav', de: 0, ate: 0.8, fade_ms: 100, efeitos: { velocidade: 2, pitch_st: 5, eco_ms: 60, graves_db: 4 } } });
    expect(comprimido.status).toBe(200);
    expect(JSON.parse(comprimido.cabecalhos['x-resultado'] as string).duracao).toBeCloseTo(0.4, 5); // a velocidade mudou a duração
    expect(comprimido.corpo.length).not.toBe(normal.corpo.length); // e os efeitos mudaram o som
    // nada foi para o jogo, e a pasta das prévias ficou limpa
    expect(readdirSync(join(raiz, 'client/public/audio/armas'))).toEqual(saidasAntes);
    expect(readFileSync(join(raiz, 'scripts/sons-armas.json'), 'utf8')).toBe(mapaAntes);
    expect(readdirSync(join(raiz, '.tmp/estudio-previa'))).toEqual([]);
    // entradas inválidas
    expect((await post('/api/sons/previa', { som: { fonte: 'ref.wav', de: 0, ate: 0.8, fade_ms: 100, efeitos: { pitch_st: 99 } } })).status).toBe(400);
    expect((await post('/api/sons/previa', { som: { fonte: 'nao-existe.wav', de: 0, ate: 0.8, fade_ms: 100 } })).status).toBe(400);
    expect((await post('/api/sons/previa', { som: { fonte: '../../package.json', de: 0, ate: 0.8, fade_ms: 100 } })).status).toBe(400);
    expect((await post('/api/sons/previa', { som: { fonte: 'ref.wav', de: 0.5, ate: 0.5, fade_ms: 0 } })).status).toBe(400);
    expect((await post('/api/sons/previa', {})).status).toBe(400);
  });

  it('IMPORTAR guarda o arquivo na pasta de referências; nome ruim, duplicado e vazio são recusados', async () => {
    const wav = wavDeSenoide(0.5);
    const ok = await http(porta, 'POST', '/api/sons/importar?nome=novo%20som%20(1).wav', { corpo: wav });
    expect(ok.status).toBe(200);
    expect(existsSync(join(origem, 'novo som (1).wav'))).toBe(true);
    expect((await http(porta, 'POST', '/api/sons/importar?nome=novo%20som%20(1).wav', { corpo: wav })).status).toBe(409);
    expect((await http(porta, 'POST', '/api/sons/importar?nome=novo%20som%20(1).wav&sobrescrever=1', { corpo: wav })).status).toBe(200);
    for (const nome of ['..%2Fx.wav', 'x.exe', 'x.wav%00.txt', '.wav', '']) expect((await http(porta, 'POST', `/api/sons/importar?nome=${nome}`, { corpo: wav })).status, nome).toBe(400);
    expect((await http(porta, 'POST', '/api/sons/importar?nome=vazio.wav', { corpo: Buffer.alloc(10) })).status).toBe(400);
  });

  it.skipIf(!ffmpeg)('IMPORTAR E REGISTRAR: o arquivo vira um clipe com nome único, entra no mapa, é processado e fica pronto para uma arma, como se o Claude o tivesse adicionado', async () => {
    const wav = wavDeSenoide(0.9);
    const r = await http(porta, 'POST', '/api/sons/importar?nome=Meu%20Som%20Novo!.wav&registrar=1', { corpo: wav });
    expect(r.status).toBe(400); // "!" não é permitido em nome de arquivo
    const r1 = await http(porta, 'POST', '/api/sons/importar?nome=Meu%20Som%20Novo.wav&registrar=1', { corpo: wav });
    expect(r1.status).toBe(200);
    const c1 = json(r1);
    expect(c1.clipe).toBe('arma_meu_som_novo');
    expect(c1.som).toMatchObject({ destino: 'arma_meu_som_novo.mp3', fonte: 'Meu Som Novo.wav', de: 0 });
    expect(c1.som.ate).toBeCloseTo(0.9, 1);
    expect(c1.resultado.ok).toBe(true);
    // está no mapa gravado, o mp3 existe, e o estado o lista
    const mapa = JSON.parse(readFileSync(join(raiz, 'scripts/sons-armas.json'), 'utf8')) as MapaDeSons;
    expect(mapa.sons.some((s) => s.destino === 'arma_meu_som_novo.mp3')).toBe(true);
    expect(validarMapa(mapa)).toEqual([]); // o mapa continua válido com o clipe novo
    expect(existsSync(join(raiz, 'client/public/audio/armas/arma_meu_som_novo.mp3'))).toBe(true);
    expect((await estado()).sons.mapa.sons.map((s: { destino: string }) => s.destino)).toContain('arma_meu_som_novo.mp3');
    // outro arquivo com o mesmo nome-base ganha nome único (sufixo), sem pisar no primeiro
    const r2 = await http(porta, 'POST', '/api/sons/importar?nome=meu-som-novo.wav&registrar=1', { corpo: wav });
    expect(json(r2).clipe).toBe('arma_meu_som_novo_2');
    // pronto para uma arma: salvar a tabela apontando para ele passa na validação
    const e = await estado();
    expect((await salvar({ sons: e.sons.mapa.sons, armas: { blaster: { clipe: 'arma_meu_som_novo', ganho: 0.8, pitch: 1, maxS: 0.5 } } })).status).toBe(200);
  });

  it.skipIf(!ffmpeg)('IMPORTAR E REGISTRAR um arquivo que não é áudio é recusado e não deixa lixo nem clipe', async () => {
    const lixo = Buffer.from('isto nao e audio '.repeat(40));
    const antes = (await estado()).sons.mapa.sons.length;
    const r = await http(porta, 'POST', '/api/sons/importar?nome=lixo.wav&registrar=1', { corpo: lixo });
    expect(r.status).toBe(400);
    expect(json(r).erro).toContain('não consegui ler este áudio');
    expect(existsSync(join(origem, 'lixo.wav'))).toBe(false);
    expect((await estado()).sons.mapa.sons.length).toBe(antes);
  });

  it('PENDÊNCIAS: devolve a forma esperada (e não quebra fora de um repositório)', async () => {
    const r = json(await http(porta, 'GET', '/api/pendencias'));
    expect(typeof r.git).toBe('boolean');
    expect(Array.isArray(r.arquivos)).toBe(true);
  });
});

describe('Estúdio: as pendências de publicação, lidas do git', () => {
  it('lista cada arquivo novo ou mudado nos caminhos dados, um a um, e ignora o resto', () => {
    mkdirSync(resolve('.tmp'), { recursive: true });
    const dir = mkdtempSync(join(resolve('.tmp'), 'git-teste-'));
    try {
      const git = (...args: string[]) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
      if (git('init', '-q').status !== 0) return; // sem git neste computador: nada a provar
      git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
      mkdirSync(join(dir, 'audio/armas'), { recursive: true });
      writeFileSync(join(dir, 'audio/armas/velho.mp3'), 'a');
      writeFileSync(join(dir, 'config.json'), '{}');
      git('add', '-A'); git('commit', '-q', '-m', 'base');
      expect(pendenciasDoGit(dir, ['audio/armas', 'config.json'])).toEqual({ git: true, arquivos: [] });
      writeFileSync(join(dir, 'audio/armas/novo.mp3'), 'b'); // novo
      writeFileSync(join(dir, 'audio/armas/velho.mp3'), 'aa'); // mudado
      writeFileSync(join(dir, 'fora.txt'), 'x'); // fora dos caminhos
      const p = pendenciasDoGit(dir, ['audio/armas', 'config.json']);
      expect(p.git).toBe(true);
      expect(p.arquivos.map((a) => a.arquivo).sort()).toEqual(['audio/armas/novo.mp3', 'audio/armas/velho.mp3']);
      expect(p.arquivos.find((a) => a.arquivo.endsWith('novo.mp3'))!.situacao).toBe('??');
      expect(p.arquivos.find((a) => a.arquivo.endsWith('velho.mp3'))!.situacao).toBe('M');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fora de um repositório devolve git:false em vez de quebrar', () => {
    const r = pendenciasDoGit('Z:/pasta/que/nao/existe', ['x']);
    expect(r).toEqual({ git: false, arquivos: [] });
  });
});
