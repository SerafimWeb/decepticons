/** Utilidades do hub do Estúdio (P155), compartilhadas pelo núcleo (`scripts/estudio.mjs`) e pelos módulos (`scripts/estudio/modulo-*.mjs`). */
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Tipos de áudio que o Estúdio lê, serve e importa. */
export const TIPOS = { '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.flac': 'audio/flac', '.aac': 'audio/aac', '.webm': 'audio/webm' };

/** Nome de arquivo simples: letras, números, espaço, ponto, hífen, sublinhado e parênteses. Sem barra, sem `..` no começo, sem byte nulo. */
export const NOME_SEGURO = /^[A-Za-z0-9][A-Za-z0-9._ ()-]{0,120}$/;

export const TETO_JSON = 1024 * 1024;
export const TETO_AUDIO = 25 * 1024 * 1024;

export const lerJson = (arquivo) => JSON.parse(readFileSync(arquivo, 'utf8'));

/** Grava JSON de forma atômica (arquivo temporário e renomeia): uma queda no meio nunca deixa o arquivo pela metade. */
export function gravarJson(arquivo, dados) {
  const tmp = `${arquivo}.tmp`;
  writeFileSync(tmp, JSON.stringify(dados, null, 2) + '\n');
  renameSync(tmp, arquivo);
}

/** Lê o corpo de uma requisição com teto de tamanho (G7: nunca confiar no `content-length` anunciado). */
export function lerCorpo(req, teto) {
  return new Promise((resolver, rejeitar) => {
    const partes = [];
    let total = 0;
    req.on('data', (c) => {
      total += c.length;
      if (total > teto) {
        rejeitar(Object.assign(new Error('corpo grande demais'), { status: 413 }));
        req.destroy();
        return;
      }
      partes.push(c);
    });
    req.on('end', () => resolver(Buffer.concat(partes)));
    req.on('error', rejeitar);
  });
}

/** O JSON do corpo (com teto); corpo vazio vira `{}`. JSON inválido vira erro 400. */
export async function corpoJson(req, teto = TETO_JSON) {
  const bytes = await lerCorpo(req, teto);
  if (bytes.length === 0) return {};
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    throw Object.assign(new Error('JSON inválido'), { status: 400 });
  }
}

/** Um nome de clipe a partir do nome de um arquivo: `WEAPMisc-Single_shot-Elevenlabs.mp3` → `single_shot`. Só minúsculas, números e sublinhado. */
export function nomeDeClipe(arquivo, prefixo = 'arma_') {
  const base = arquivo
    .replace(/\.[A-Za-z0-9]+$/, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^WEAP[A-Za-z]*-/, '')
    .replace(/-?Elevenlabs/gi, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
    .replace(/_+$/, '');
  return `${prefixo}${base || 'som'}`;
}

/** O primeiro nome livre a partir de `base`: `arma_x`, `arma_x_2`, `arma_x_3`... */
export function nomeLivre(base, jaExistem) {
  const usados = new Set(jaExistem);
  if (!usados.has(base)) return base;
  for (let n = 2; n < 1000; n++) if (!usados.has(`${base}_${n}`)) return `${base}_${n}`;
  throw new Error('nomes demais iguais');
}

export const existe = (...partes) => existsSync(join(...partes));
