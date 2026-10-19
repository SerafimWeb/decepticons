/**
 * Módulo VOZES do Estúdio (P151, P155): o Comandante GRAVA as falas do narrador no navegador (ou importa uma gravação), trata com os mesmos efeitos dos sons
 * (grave, compressor, eco de arena...), e salva como o `.mp3` da fala, no manifesto que o jogo lê. Rotas em `/api/vozes/...`.
 *
 * - A gravação bruta fica em `.tmp/SOUNDS/VOZ/<sotaque>/<chave>-<n>.wav` (convertida para WAV mono 44,1 kHz: o MediaRecorder do navegador entrega webm sem duração).
 * - O que muda de verdade está em `scripts/vozes-gravadas.json` (de qual tomada, que trecho, que efeitos) e no mp3 de `client/public/audio/vozes/<sotaque>/`.
 * - A fala gravada fica **protegida**: o `npm run vozes` (ElevenLabs) não a regera. O mp3 gerado antes é guardado em `_elevenlabs/` (dá para voltar).
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { duracaoFinal, resumoDosEfeitos } from '../efeitosLib.mjs';
import { REGRAS_DE_VOZ, validarMapa } from '../sonsLib.mjs';
import { capacidadesDoFfmpeg, duracaoDoArquivo, processarSom } from '../sonsRodar.mjs';
import { montarManifesto, SOTAQUES } from '../vozesLib.mjs';
import { NOME_SEGURO, TETO_AUDIO, TIPOS, corpoJson, gravarJson, lerCorpo, lerJson } from './util.mjs';

/** A extensão para guardar o corpo bruto antes de converter (o ffmpeg reconhece pelo conteúdo, mas a extensão ajuda). */
const EXTENSAO_DO_TIPO = { 'audio/webm': '.webm', 'video/webm': '.webm', 'audio/ogg': '.ogg', 'audio/wav': '.wav', 'audio/x-wav': '.wav', 'audio/mpeg': '.mp3', 'audio/mp4': '.m4a', 'audio/aac': '.aac', 'audio/flac': '.flac' };

/** O módulo de vozes para uma raiz de projeto, a pasta das gravações e um ffmpeg (sem ele não dá para gravar nem processar). */
export function moduloVozes({ raiz, origemVozes, ffmpeg }) {
  const caminhos = {
    catalogo: join(raiz, 'client/src/audio/falas.json'),
    gravadas: join(raiz, 'scripts/vozes-gravadas.json'),
    manifesto: join(raiz, 'client/src/audio/vozesGeradas.json'),
    saidas: join(raiz, 'client/public/audio/vozes'),
    previas: join(raiz, '.tmp/estudio-previa'),
    copias: join(origemVozes, '_elevenlabs'),
  };
  const caps = ffmpeg ? capacidadesDoFfmpeg(ffmpeg) : { rubberband: false };
  let previasFeitas = 0;
  const duracoes = new Map();

  const catalogo = () => lerJson(caminhos.catalogo);
  const chaves = () => new Set(catalogo().falas.map((f) => f.chave));
  const gravadas = () => (existsSync(caminhos.gravadas) ? lerJson(caminhos.gravadas) : { alvo: { media_db: -16, pico_db: -1 }, gravacoes: [] });

  function listarTomadas() {
    const tomadas = [];
    for (const sotaque of SOTAQUES) {
      const dir = join(origemVozes, sotaque);
      if (!existsSync(dir)) continue;
      for (const arquivo of readdirSync(dir).sort()) {
        const m = /^([a-z0-9_]+)-(\d+)\.wav$/.exec(arquivo);
        if (!m || !NOME_SEGURO.test(arquivo)) continue;
        const chave = `${arquivo}|${statSync(join(dir, arquivo)).mtimeMs}`;
        if (!duracoes.has(chave)) duracoes.set(chave, ffmpeg ? duracaoDoArquivo(ffmpeg, join(dir, arquivo)) : Number.NaN);
        const d = duracoes.get(chave);
        tomadas.push({ sotaque, chave: m[1], numero: Number(m[2]), arquivo, duracao: Number.isFinite(d) ? Math.round(d * 100) / 100 : null });
      }
    }
    return tomadas;
  }

  function estado() {
    const cat = catalogo();
    const manifesto = existsSync(caminhos.manifesto) ? lerJson(caminhos.manifesto) : {};
    const g = gravadas();
    return {
      sotaques: SOTAQUES,
      falas: cat.falas.map((f) => ({ chave: f.chave, estilo: f.estilo, texto: f.texto })),
      gravacoes: g.gravacoes,
      alvo: g.alvo,
      geradas: Object.fromEntries(SOTAQUES.map((s) => [s, Array.isArray(manifesto[s]) ? manifesto[s] : []])),
      tomadas: listarTomadas(),
      origemVozes,
    };
  }

  /** Valida as gravações que a página mandou salvar; devolve os problemas (vazia = ok). */
  function validar(lista) {
    if (!Array.isArray(lista)) return ['"gravacoes" tem de ser uma lista'];
    const g = gravadas();
    const existentes = chaves();
    const erros = [];
    const vistos = new Set();
    for (const r of lista) {
      const quem = `${r?.sotaque}/${r?.chave}`;
      if (!SOTAQUES.includes(r?.sotaque)) { erros.push(`${quem}: sotaque desconhecido`); continue; }
      if (!existentes.has(r.chave)) { erros.push(`${quem}: fala que o catálogo não tem`); continue; }
      if (vistos.has(quem)) erros.push(`${quem}: fala repetida`);
      vistos.add(quem);
      if (typeof r.fonte !== 'string' || !/^[a-z0-9_]+-\d+\.wav$/.test(r.fonte) || !existsSync(join(origemVozes, r.sotaque, r.fonte))) erros.push(`${quem}: a tomada "${r.fonte}" não está em ${join(origemVozes, r.sotaque)}`);
      erros.push(...validarMapa({ alvo: g.alvo, sons: [{ destino: `${r.chave}.mp3`, fonte: String(r.fonte ?? '').replace(/[\\/]/g, ''), de: r.de, ate: r.ate, fade_ms: r.fade_ms, ganho_db: r.ganho_db, efeitos: r.efeitos }] }, REGRAS_DE_VOZ).map((e) => `${quem}: ${e.replace(/^[^:]*: /, '')}`));
    }
    return erros;
  }

  /** A fala como `som` do motor de efeitos (o mesmo do módulo de sons). */
  const comoSom = (r) => ({ destino: `${r.chave}.mp3`, fonte: r.fonte, de: r.de, ate: r.ate, fade_ms: r.fade_ms, ...(r.ganho_db ? { ganho_db: r.ganho_db } : {}), ...(r.efeitos ? { efeitos: r.efeitos } : {}) });

  /** Atualiza o manifesto que o jogo lê, a partir do que há em `client/public/audio/vozes/`. */
  function atualizarManifesto() {
    const porSotaque = {};
    for (const s of SOTAQUES) {
      const dir = join(caminhos.saidas, s);
      porSotaque[s] = existsSync(dir) ? readdirSync(dir).filter((a) => a.endsWith('.mp3')).map((a) => a.slice(0, -4)) : [];
    }
    const antigo = existsSync(caminhos.manifesto) ? lerJson(caminhos.manifesto) : {};
    gravarJson(caminhos.manifesto, montarManifesto(porSotaque, catalogo().falas, antigo._nota ?? ''));
  }

  const pastasDoGit = ['client/public/audio/vozes', 'client/src/audio/vozesGeradas.json', 'scripts/vozes-gravadas.json'];

  async function rotas({ req, res, responder, caminho, url }) {
    // As tomadas gravadas (WAV) e o mp3 atual de uma fala (do ElevenLabs ou gravado): para ouvir.
    const tomada = /^\/gravacao\/([a-z]{2})\/(.+)$/.exec(caminho);
    if (req.method === 'GET' && tomada) {
      const nome = decodeURIComponent(tomada[2]);
      if (!SOTAQUES.includes(tomada[1]) || !NOME_SEGURO.test(nome) || !TIPOS[extname(nome).toLowerCase()]) return responder(400, { erro: 'nome de arquivo inválido' }), true;
      const alvo = join(origemVozes, tomada[1], nome);
      if (!existsSync(alvo)) return responder(404, { erro: 'arquivo não encontrado' }), true;
      res.writeHead(200, { 'content-type': TIPOS[extname(nome).toLowerCase()], 'content-length': statSync(alvo).size, 'cache-control': 'no-store' });
      createReadStream(alvo).pipe(res);
      return true;
    }
    const saida = /^\/saida\/([a-z]{2})\/([a-z0-9_]+\.mp3)$/.exec(caminho);
    if (req.method === 'GET' && saida) {
      const alvo = join(caminhos.saidas, saida[1], saida[2]);
      if (!SOTAQUES.includes(saida[1]) || !existsSync(alvo)) return responder(404, { erro: 'arquivo não encontrado' }), true;
      res.writeHead(200, { 'content-type': 'audio/mpeg', 'content-length': statSync(alvo).size, 'cache-control': 'no-store' });
      createReadStream(alvo).pipe(res);
      return true;
    }

    // GRAVAR: o corpo é o áudio bruto do navegador (webm/ogg/wav/mp3/m4a); vira WAV mono 44,1 kHz e uma tomada numerada.
    if (req.method === 'POST' && caminho === '/gravar') {
      const sotaque = url.searchParams.get('sotaque') ?? '';
      const chave = url.searchParams.get('chave') ?? '';
      if (!SOTAQUES.includes(sotaque)) return responder(400, { erro: 'sotaque desconhecido' }), true;
      if (!chaves().has(chave)) return responder(400, { erro: 'fala que o catálogo não tem' }), true;
      const bytes = await lerCorpo(req, TETO_AUDIO);
      if (bytes.length < 200) return responder(400, { erro: 'gravação vazia' }), true;
      // O pedido errado é 400 em qualquer máquina; "sem ffmpeg" (503) só vale para o pedido certo (o runner do CI não tem ffmpeg e o teste de recusa tem que passar lá também).
      if (!ffmpeg) return responder(503, { erro: 'ffmpeg não encontrado neste computador' }), true;
      const dir = join(origemVozes, sotaque);
      mkdirSync(dir, { recursive: true });
      const tipo = String(req.headers['content-type'] ?? '').split(';')[0].trim();
      const bruto = join(dir, `.entrada-${process.pid}-${Date.now()}${EXTENSAO_DO_TIPO[tipo] ?? '.bin'}`);
      writeFileSync(bruto, bytes);
      const usados = readdirSync(dir).map((a) => new RegExp(`^${chave}-(\\d+)\\.wav$`).exec(a)?.[1]).filter(Boolean).map(Number);
      const n = (usados.length ? Math.max(...usados) : 0) + 1;
      const arquivo = `${chave}-${n}.wav`;
      const r = spawnSync(ffmpeg, ['-hide_banner', '-nostats', '-y', '-i', bruto, '-ac', '1', '-ar', '44100', '-c:a', 'pcm_s16le', join(dir, arquivo)], { encoding: 'utf8' });
      try { unlinkSync(bruto); } catch { /* a limpeza é só higiene */ }
      if (r.status !== 0 || !existsSync(join(dir, arquivo))) return responder(400, { erro: 'não consegui ler esta gravação (o arquivo está corrompido ou não é áudio)' }), true;
      const duracao = duracaoDoArquivo(ffmpeg, join(dir, arquivo));
      if (!Number.isFinite(duracao) || duracao < 0.1) {
        try { unlinkSync(join(dir, arquivo)); } catch { /* já não está */ }
        return responder(400, { erro: 'a gravação ficou curta demais ou sem som' }), true;
      }
      return responder(200, { ok: true, sotaque, chave, arquivo, numero: n, duracao: Math.round(duracao * 100) / 100 }), true;
    }

    if (req.method === 'POST' && caminho === '/salvar') {
      const corpo = await corpoJson(req);
      const erros = validar(corpo.gravacoes);
      if (erros.length) return responder(400, { erros }), true;
      gravarJson(caminhos.gravadas, { ...gravadas(), gravacoes: corpo.gravacoes });
      return responder(200, { ok: true, gravacoes: corpo.gravacoes.length }), true;
    }

    // PROCESSAR: grava o mp3 da fala (no lugar do que o ElevenLabs gerou, que fica guardado em `_elevenlabs/`) e põe a fala no manifesto.
    if (req.method === 'POST' && caminho === '/processar') {
      if (!ffmpeg) return responder(503, { erro: 'ffmpeg não encontrado neste computador' }), true;
      const { sotaque, chave } = await corpoJson(req);
      const r = gravadas().gravacoes.find((g) => g.sotaque === sotaque && g.chave === chave);
      if (!r) return responder(404, { erro: 'esta fala não está salva (salve antes de processar)' }), true;
      const atual = join(caminhos.saidas, sotaque, `${chave}.mp3`);
      const copia = join(caminhos.copias, sotaque, `${chave}.mp3`);
      if (existsSync(atual) && !existsSync(copia)) { mkdirSync(join(caminhos.copias, sotaque), { recursive: true }); copyFileSync(atual, copia); }
      const feito = processarSom({ ffmpeg, caps, origem: join(origemVozes, sotaque), destinoDir: join(caminhos.saidas, sotaque), mapa: { alvo: gravadas().alvo, sons: [] }, som: comoSom(r) });
      if (!feito.ok) return responder(500, { erro: feito.erro }), true;
      atualizarManifesto();
      return responder(200, { ok: true, resultado: { ...feito, efeitos: resumoDosEfeitos(r.efeitos) } }), true;
    }

    // PRÉVIA: a fala como está na tela, com os mesmos efeitos e normalização do mp3 final, sem gravar nada no jogo.
    if (req.method === 'POST' && caminho === '/previa') {
      if (!ffmpeg) return responder(503, { erro: 'ffmpeg não encontrado neste computador' }), true;
      const corpo = await corpoJson(req);
      const erros = validar([{ ...corpo.gravacao, sotaque: corpo.sotaque, chave: corpo.chave }]);
      if (erros.length) return responder(400, { erros }), true;
      mkdirSync(caminhos.previas, { recursive: true });
      const nome = `previa-voz-${process.pid}-${++previasFeitas}.mp3`;
      const r = { ...corpo.gravacao, sotaque: corpo.sotaque, chave: corpo.chave };
      const feito = processarSom({ ffmpeg, caps, origem: join(origemVozes, corpo.sotaque), destinoDir: caminhos.previas, mapa: { alvo: gravadas().alvo, sons: [] }, som: { ...comoSom(r), destino: nome } });
      if (!feito.ok) return responder(500, { erro: feito.erro }), true;
      const arq = join(caminhos.previas, nome);
      const bytes = readFileSync(arq);
      try { unlinkSync(arq); } catch { /* a limpeza é só higiene */ }
      res.writeHead(200, {
        'content-type': 'audio/mpeg',
        'cache-control': 'no-store',
        'x-resultado': JSON.stringify({ duracao: feito.duracao, picoDb: feito.picoDb, mediaDb: feito.mediaDb, ganhoDb: feito.ganhoDb }),
        'access-control-expose-headers': 'x-resultado',
      });
      res.end(bytes);
      return true;
    }

    // REVERTER: tira a fala da lista de gravadas e devolve o mp3 que o ElevenLabs tinha gerado (se há cópia); sem cópia, a fala fica sem áudio.
    if (req.method === 'POST' && caminho === '/reverter') {
      const { sotaque, chave } = await corpoJson(req);
      const g = gravadas();
      if (!g.gravacoes.some((x) => x.sotaque === sotaque && x.chave === chave)) return responder(404, { erro: 'esta fala não está entre as gravadas' }), true;
      gravarJson(caminhos.gravadas, { ...g, gravacoes: g.gravacoes.filter((x) => !(x.sotaque === sotaque && x.chave === chave)) });
      const atual = join(caminhos.saidas, sotaque, `${chave}.mp3`);
      const copia = join(caminhos.copias, sotaque, `${chave}.mp3`);
      let voltou = false;
      if (existsSync(copia)) { mkdirSync(join(caminhos.saidas, sotaque), { recursive: true }); copyFileSync(copia, atual); voltou = true; }
      else if (existsSync(atual)) unlinkSync(atual);
      atualizarManifesto();
      return responder(200, { ok: true, voltouParaAVozGerada: voltou }), true;
    }

    return false;
  }

  return { id: 'vozes', titulo: 'VOZES', estado, rotas, pastasDoGit };
}
