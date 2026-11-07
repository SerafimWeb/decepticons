import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import ajustesDoJogo from '../client/src/entities/movimentoGen3.json';
import faixasDoJogo from '../client/src/entities/movimentoGen3.faixas.json';
import { criarEstudio } from '../scripts/estudio.mjs';
import { moduloMechs, validarAjustesDoMovimento } from '../scripts/estudio/modulo-mechs.mjs';

const ARQ_AJUSTES = 'client/src/entities/movimentoGen3.json';
const ARQ_FAIXAS = 'client/src/entities/movimentoGen3.faixas.json';

interface Resp {
  status: number;
  corpo: Buffer;
  tipo: string | undefined;
}
function http(porta: number, metodo: string, caminho: string, corpo?: string): Promise<Resp> {
  return new Promise((ok, falha) => {
    const req = request({ host: '127.0.0.1', port: porta, method: metodo, path: caminho, headers: corpo ? { 'content-type': 'application/json' } : {} }, (res) => {
      const partes: Buffer[] = [];
      res.on('data', (c: Buffer) => partes.push(c));
      res.on('end', () => ok({ status: res.statusCode ?? 0, corpo: Buffer.concat(partes), tipo: res.headers['content-type'] }));
    });
    req.on('error', falha);
    if (corpo) req.write(corpo);
    req.end();
  });
}
const json = (r: Resp): Record<string, unknown> => JSON.parse(r.corpo.toString('utf8')) as Record<string, unknown>;

describe('estrutura do dado (o que o jogo, o teste e o Estúdio leem)', () => {
  it('as faixas e os ajustes têm as mesmas chaves, e o arquivo está dentro das faixas', () => {
    expect(Object.keys(faixasDoJogo).sort()).toEqual(Object.keys(ajustesDoJogo).sort());
    expect(validarAjustesDoMovimento(ajustesDoJogo, faixasDoJogo as never).ok).toBe(true);
  });
});

describe('validarAjustesDoMovimento', () => {
  const faixas = { a: [0, 1], b: [10, 20] } as const;
  it('aceita todas as chaves dentro da faixa, na ordem das faixas', () => {
    const r = validarAjustesDoMovimento({ b: 15, a: 0.5 }, faixas);
    expect(r).toEqual({ ok: true, ajustes: { a: 0.5, b: 15 } });
    expect(Object.keys((r as { ajustes: object }).ajustes)).toEqual(['a', 'b']);
  });
  it.each([
    ['fora da faixa', { a: 2, b: 15 }],
    ['chave a mais', { a: 0.5, b: 15, c: 1 }],
    ['chave faltando', { a: 0.5 }],
    ['não é número', { a: '0.5', b: 15 }],
    ['NaN', { a: Number.NaN, b: 15 }],
    ['infinito', { a: Number.POSITIVE_INFINITY, b: 15 }],
  ])('recusa %s', (_nome, entrada) => {
    expect(validarAjustesDoMovimento(entrada, faixas).ok).toBe(false);
  });
  it.each([[null], [undefined], [3], ['texto'], [[1, 2]]])('recusa o que não é objeto (%s)', (entrada) => {
    expect(validarAjustesDoMovimento(entrada, faixas).ok).toBe(false);
  });
});

describe('o módulo MECHS 3D no servidor do Estúdio', () => {
  const raiz = mkdtempSync(join(resolve('.tmp'), 'estudio-mechs-'));
  let servidor: ReturnType<typeof criarEstudio>;
  let porta = 0;
  let montagens = 0;

  beforeAll(async () => {
    mkdirSync(join(raiz, 'client/src/entities'), { recursive: true });
    for (const a of [ARQ_AJUSTES, ARQ_FAIXAS]) copyFileSync(resolve(a), join(raiz, a));
    const modulo = moduloMechs({
      raiz,
      construir: async ({ saida }) => {
        montagens++;
        mkdirSync(join(saida, 'assets'), { recursive: true });
        writeFileSync(join(saida, 'index.html'), '<!doctype html><title>previa</title>');
        writeFileSync(join(saida, 'assets/app.js'), 'export {}');
        writeFileSync(join(saida, 'assets/rapier.wasm'), Buffer.from([0, 97, 115, 109]));
      },
    });
    servidor = criarEstudio({ raiz, origem: join(raiz, 'sons'), ffmpeg: undefined, modulos: [modulo] });
    await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok));
    porta = (servidor.address() as AddressInfo).port;
  });
  afterAll(async () => {
    await new Promise<void>((ok) => servidor.close(() => ok()));
    rmSync(raiz, { recursive: true, force: true });
  });

  const lido = (): Record<string, number> => JSON.parse(readFileSync(join(raiz, ARQ_AJUSTES), 'utf8')) as Record<string, number>;

  it('o estado traz os ajustes, as faixas e se a prévia já foi montada', async () => {
    const r = await http(porta, 'GET', '/api/estado');
    expect(r.status).toBe(200);
    const mechs = json(r).mechs as { ajustes: object; faixas: object; montado: boolean };
    expect(mechs.ajustes).toEqual(ajustesDoJogo);
    expect(mechs.faixas).toEqual(faixasDoJogo);
    expect(mechs.montado).toBe(false);
  });

  it('sem o dado, o estado devolve o erro em vez de derrubar o /api/estado dos outros módulos', async () => {
    const vazio = mkdtempSync(join(resolve('.tmp'), 'estudio-mechs-vazio-'));
    try {
      expect(moduloMechs({ raiz: vazio }).estado()).toMatchObject({ montado: false, erro: expect.stringContaining('movimentoGen3') });
    } finally {
      rmSync(vazio, { recursive: true, force: true });
    }
  });

  it('antes de montar, a página não existe (404 com o aviso)', async () => {
    expect((await http(porta, 'GET', '/api/mechs/app/index.html')).status).toBe(404);
  });

  it('montar constrói uma vez; de novo sem mudança de fonte, não reconstrói', async () => {
    const a = await http(porta, 'POST', '/api/mechs/montar');
    expect(a.status).toBe(200);
    expect(json(a).montou).toBe(true);
    expect(montagens).toBe(1);
    const b = await http(porta, 'POST', '/api/mechs/montar');
    expect(json(b).montou).toBe(false);
    expect(montagens).toBe(1);
  });

  it('serve a página, o script e o wasm com o tipo certo', async () => {
    const pagina = await http(porta, 'GET', '/api/mechs/app/index.html');
    expect(pagina.status).toBe(200);
    expect(pagina.tipo).toMatch(/text\/html/);
    expect((await http(porta, 'GET', '/api/mechs/app/assets/app.js')).tipo).toMatch(/javascript/);
    expect((await http(porta, 'GET', '/api/mechs/app/assets/rapier.wasm')).tipo).toBe('application/wasm');
    expect((await http(porta, 'GET', '/api/mechs/app/')).status).toBe(200);
  });

  it('não sai da pasta montada (nada de ..), não serve tipo desconhecido nem diretório', async () => {
    for (const caminho of ['/api/mechs/app/..%2f..%2fpackage.json', '/api/mechs/app/%2e%2e/%2e%2e/package.json', '/api/mechs/app/../../package.json', '/api/mechs/app/assets', '/api/mechs/app/%00', '/api/mechs/app/assets/app.exe']) {
      expect((await http(porta, 'GET', caminho)).status, caminho).toBe(404);
    }
  });

  it('grava os ajustes válidos, na ordem das faixas, e o estado reflete', async () => {
    const novos = { ...ajustesDoJogo, ciclosMax: 1.9, rigidez: 1.25 };
    const r = await http(porta, 'PUT', '/api/mechs/ajustes', JSON.stringify({ ajustes: novos }));
    expect(r.status).toBe(200);
    expect(lido().ciclosMax).toBe(1.9);
    expect(Object.keys(lido())).toEqual(Object.keys(faixasDoJogo));
    expect(existsSync(join(raiz, `${ARQ_AJUSTES}.tmp`))).toBe(false);
    const estado = json(await http(porta, 'GET', '/api/estado')).mechs as { ajustes: Record<string, number> };
    expect(estado.ajustes.rigidez).toBe(1.25);
  });

  it('recusa ajustes fora da faixa, com chave a mais ou sem corpo, e o arquivo não muda', async () => {
    const antes = readFileSync(join(raiz, ARQ_AJUSTES), 'utf8');
    for (const corpo of [{ ajustes: { ...ajustesDoJogo, ciclosMax: 99 } }, { ajustes: { ...ajustesDoJogo, intruso: 1 } }, { ajustes: { ciclosMax: 1 } }, {}, { ajustes: null }]) {
      const r = await http(porta, 'PUT', '/api/mechs/ajustes', JSON.stringify(corpo));
      expect(r.status, JSON.stringify(corpo)).toBe(400);
    }
    expect((await http(porta, 'PUT', '/api/mechs/ajustes', '{quebrado')).status).toBe(400);
    expect(readFileSync(join(raiz, ARQ_AJUSTES), 'utf8')).toBe(antes);
  });
});
