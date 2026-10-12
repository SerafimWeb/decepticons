/**
 * O que a porta privada de métricas (`GET /metricas`) e a gravação dos números em disco precisam, fora do `Server.ts` para o
 * teste bater direto. Sem dependência de rede.
 */
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const TOKEN_ARQUIVO = 'metricas-token.txt';
export const DADOS_ARQUIVO = 'telemetria.json';
const TOKEN_MIN = 16;

/**
 * O token do dono para ver as métricas por país. Vem da variável `CYBERMECH_METRICAS_TOKEN` (mínimo de 16 caracteres), ou do
 * arquivo `metricas-token.txt` da pasta de dados, ou é gerado na primeira subida e gravado lá (o arquivo fica em `.tmp/`, que
 * o git ignora; quem tem acesso ao PC do servidor já tem o dono). Nunca vai para o repositório, o log ou o site.
 */
export function carregarToken(dir: string, env: string | undefined = process.env.CYBERMECH_METRICAS_TOKEN): string {
  if (env && env.trim().length >= TOKEN_MIN) return env.trim();
  const arquivo = join(dir, TOKEN_ARQUIVO);
  if (existsSync(arquivo)) {
    const lido = readFileSync(arquivo, 'utf8').trim();
    if (lido.length >= TOKEN_MIN) return lido;
  }
  const novo = randomBytes(32).toString('base64url');
  mkdirSync(dir, { recursive: true });
  writeFileSync(arquivo, `${novo}\n`, 'utf8');
  return novo;
}

/** Compara em tempo constante (quem erra não descobre o token letra por letra pelo tempo da resposta). */
export function tokenConfere(recebido: unknown, esperado: string): boolean {
  if (typeof recebido !== 'string' || recebido.length === 0) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Lê um JSON; arquivo que não existe ou não é JSON vira `null` (o servidor sobe do zero em vez de cair). */
export function lerJson(caminho: string): unknown {
  try {
    return JSON.parse(readFileSync(caminho, 'utf8'));
  } catch {
    return null;
  }
}

/** Grava sem deixar arquivo pela metade: escreve ao lado e troca de nome (a troca é uma operação só). */
export function gravarJson(caminho: string, valor: unknown): void {
  mkdirSync(dirname(caminho), { recursive: true });
  const tmp = `${caminho}.tmp`;
  writeFileSync(tmp, JSON.stringify(valor), 'utf8');
  renameSync(tmp, caminho);
}
