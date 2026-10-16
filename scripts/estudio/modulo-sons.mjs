/**
 * Módulo SONS do Estúdio (P150, P155): os cortes e efeitos de cada clipe (`scripts/sons-armas.json`) e o clipe de cada arma (`client/src/audio/armasSom.json`).
 * Rotas em `/api/sons/...`. O núcleo (`scripts/estudio.mjs`) cuida da segurança (Host, Origin), da página e dos arquivos estáticos; aqui só vive o que é de som.
 */
import { createReadStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { duracaoFinal, resumoDosEfeitos } from '../efeitosLib.mjs';
import { validarArmas, validarMapa } from '../sonsLib.mjs';
import { capacidadesDoFfmpeg, duracaoDoArquivo, processarSom } from '../sonsRodar.mjs';
import { NOME_SEGURO, TETO_AUDIO, TIPOS, corpoJson, gravarJson, lerCorpo, lerJson, nomeDeClipe, nomeLivre } from './util.mjs';

/** O módulo de sons para uma raiz de projeto, uma pasta de referências e um ffmpeg (que pode faltar: então só "Processar" e "Prévia" ficam indisponíveis). */
export function moduloSons({ raiz, origem, ffmpeg }) {
  const caminhos = {
    mapa: join(raiz, 'scripts/sons-armas.json'),
    armas: join(raiz, 'client/src/audio/armasSom.json'),
    info: join(raiz, 'scripts/estudio/armas-info.json'),
    saidas: join(raiz, 'client/public/audio/armas'),
    previas: join(raiz, '.tmp/estudio-previa'),
  };
  const caps = ffmpeg ? capacidadesDoFfmpeg(ffmpeg) : { rubberband: false };
  const duracoes = new Map(); // arquivo|mtime -> segundos
  let previasFeitas = 0;

  function listarFontes() {
    if (!existsSync(origem)) return [];
    return readdirSync(origem)
      .filter((a) => TIPOS[extname(a).toLowerCase()] && NOME_SEGURO.test(a))
      .sort()
      .map((nome) => {
        const arq = join(origem, nome);
        const st = statSync(arq);
        const chave = `${nome}|${st.mtimeMs}`;
        if (!duracoes.has(chave)) duracoes.set(chave, ffmpeg ? duracaoDoArquivo(ffmpeg, arq) : Number.NaN);
        const d = duracoes.get(chave);
        return { nome, kb: Math.round(st.size / 102.4) / 10, duracao: Number.isFinite(d) ? Math.round(d * 100) / 100 : null };
      });
  }

  function estado() {
    const mapa = lerJson(caminhos.mapa);
    return {
      fontes: listarFontes(),
      mapa: { alvo: mapa.alvo, sons: mapa.sons },
      armas: lerJson(caminhos.armas).armas,
      info: lerJson(caminhos.info).armas,
      saidas: existsSync(caminhos.saidas) ? readdirSync(caminhos.saidas).filter((a) => a.endsWith('.mp3')) : [],
      origem,
    };
  }

  /** Valida o que a página mandou salvar; devolve `{ erros }` ou `{ mapa, armas }` prontos para gravar. */
  function validar(corpo) {
    const atual = lerJson(caminhos.mapa);
    const info = lerJson(caminhos.info).armas;
    const mapa = { ...atual, sons: corpo.sons };
    const erros = Array.isArray(corpo.sons) ? validarMapa(mapa) : ['"sons" tem de ser uma lista'];
    if (Array.isArray(corpo.sons)) {
      for (const s of corpo.sons) if (s.fonte && !existsSync(join(origem, s.fonte))) erros.push(`${s.destino}: a fonte "${s.fonte}" não está em ${origem}`);
    }
    if (!corpo.armas || typeof corpo.armas !== 'object') erros.push('"armas" tem de ser um objeto');
    else if (Array.isArray(corpo.sons)) {
      const nominal = (clipe) => {
        const s = corpo.sons.find((x) => x.destino === `${clipe}.mp3`);
        return s && s.ate > s.de ? duracaoFinal(s) : Number.NaN;
      };
      erros.push(...validarArmas(corpo.armas, info.map((a) => a.id), corpo.sons.map((s) => String(s.destino).replace(/\.mp3$/, '')), nominal));
      for (const id of Object.keys(corpo.armas)) if (info.find((a) => a.id === id && !a.aceita)) erros.push(`${id}: esta arma tem som contínuo próprio e ainda não aceita amostra`);
    }
    return erros.length ? { erros } : { mapa, armas: corpo.armas };
  }

  /** Um clipe sozinho, validado como se estivesse no mapa (a prévia usa clipe ainda não salvo). */
  function validarUm(som) {
    if (!som || typeof som !== 'object') return ['"som" tem de ser um objeto'];
    const mapa = lerJson(caminhos.mapa);
    const erros = validarMapa({ alvo: mapa.alvo, sons: [{ ...som, destino: 'arma_previa.mp3' }] });
    if (som.fonte && !existsSync(join(origem, som.fonte))) erros.push(`a fonte "${som.fonte}" não está em ${origem}`);
    return erros;
  }

  /** O que o núcleo pergunta ao git: estes caminhos têm mudança que ainda não foi para o jogo? */
  const pastasDoGit = ['scripts/sons-armas.json', 'client/src/audio/armasSom.json', 'client/public/audio/armas'];

  /**
   * Trata uma rota do módulo. `ctx` = `{ req, res, responder, caminho, url }` (o `caminho` já sem `/api/sons`). Devolve `true` se tratou.
   */
  async function rotas({ req, res, responder, caminho, url }) {
    const arquivo = /^\/(fonte|saida)\/(.+)$/.exec(caminho);
    if (req.method === 'GET' && arquivo) {
      const nome = decodeURIComponent(arquivo[2]);
      const dir = arquivo[1] === 'fonte' ? origem : caminhos.saidas;
      const tipo = TIPOS[extname(nome).toLowerCase()];
      if (!NOME_SEGURO.test(nome) || !tipo) return responder(400, { erro: 'nome de arquivo inválido' }), true;
      const alvo = join(dir, nome);
      if (!existsSync(alvo)) return responder(404, { erro: 'arquivo não encontrado' }), true;
      res.writeHead(200, { 'content-type': tipo, 'content-length': statSync(alvo).size, 'cache-control': 'no-store' });
      createReadStream(alvo).pipe(res);
      return true;
    }

    if (req.method === 'POST' && caminho === '/salvar') {
      const corpo = await corpoJson(req);
      const v = validar(corpo);
      if (v.erros) return responder(400, { erros: v.erros }), true;
      gravarJson(caminhos.mapa, v.mapa);
      const antigo = lerJson(caminhos.armas);
      gravarJson(caminhos.armas, { ...antigo, armas: v.armas });
      return responder(200, { ok: true, sons: v.mapa.sons.length, armas: Object.keys(v.armas).length }), true;
    }

    if (req.method === 'POST' && caminho === '/processar') {
      if (!ffmpeg) return responder(503, { erro: 'ffmpeg não encontrado neste computador' }), true;
      const corpo = await corpoJson(req);
      const mapa = lerJson(caminhos.mapa);
      const alvos = corpo.destino ? mapa.sons.filter((s) => s.destino === corpo.destino) : mapa.sons;
      if (alvos.length === 0) return responder(404, { erro: 'clipe não encontrado (salve antes de processar)' }), true;
      const resultados = alvos.map((som) => ({ destino: som.destino, efeitos: resumoDosEfeitos(som.efeitos), ...processarSom({ ffmpeg, caps, origem, destinoDir: caminhos.saidas, mapa, som }) }));
      return responder(200, { resultados }), true;
    }

    // A PRÉVIA: o clipe como está na tela (salvo ou não), com os mesmos efeitos e a mesma normalização do arquivo final, devolvido como áudio sem gravar nada no jogo.
    if (req.method === 'POST' && caminho === '/previa') {
      if (!ffmpeg) return responder(503, { erro: 'ffmpeg não encontrado neste computador' }), true;
      const corpo = await corpoJson(req);
      const erros = validarUm(corpo.som);
      if (erros.length) return responder(400, { erros }), true;
      const mapa = lerJson(caminhos.mapa);
      mkdirSync(caminhos.previas, { recursive: true });
      const nome = `previa-${process.pid}-${++previasFeitas}.mp3`;
      const r = processarSom({ ffmpeg, caps, origem, destinoDir: caminhos.previas, mapa, som: { ...corpo.som, destino: nome } });
      if (!r.ok) return responder(500, { erro: r.erro }), true;
      const arq = join(caminhos.previas, nome);
      const bytes = readFileSync(arq);
      try { unlinkSync(arq); } catch { /* a limpeza é só higiene */ }
      res.writeHead(200, {
        'content-type': 'audio/mpeg',
        'cache-control': 'no-store',
        'x-resultado': JSON.stringify({ duracao: r.duracao, picoDb: r.picoDb, mediaDb: r.mediaDb, ganhoDb: r.ganhoDb }),
        'access-control-expose-headers': 'x-resultado',
      });
      res.end(bytes);
      return true;
    }

    // IMPORTAR: guarda o arquivo na pasta de referências e, com `registrar=1`, já o REGISTRA como clipe do jogo (como se o Claude o tivesse adicionado):
    // nome único, corte inicial, entrada no mapa, processado e pronto para ser escolhido numa arma.
    if (req.method === 'POST' && caminho === '/importar') {
      const nome = url.searchParams.get('nome') ?? '';
      if (!NOME_SEGURO.test(nome) || !TIPOS[extname(nome).toLowerCase()]) return responder(400, { erro: 'nome inválido: use só letras, números, espaço, ponto, hífen e parênteses, com extensão de áudio' }), true;
      const destino = join(origem, nome);
      const existiaAntes = existsSync(destino);
      if (existiaAntes && url.searchParams.get('sobrescrever') !== '1') return responder(409, { erro: 'já existe um arquivo com esse nome' }), true;
      const bytes = await lerCorpo(req, TETO_AUDIO);
      if (bytes.length < 100) return responder(400, { erro: 'arquivo vazio' }), true;
      mkdirSync(origem, { recursive: true });
      writeFileSync(destino, bytes);
      if (url.searchParams.get('registrar') !== '1') return responder(200, { ok: true, nome }), true;
      if (!ffmpeg) return responder(200, { ok: true, nome, aviso: 'arquivo guardado, mas sem ffmpeg não dá para registrar o clipe' }), true;
      const dur = duracaoDoArquivo(ffmpeg, destino);
      if (!Number.isFinite(dur) || dur <= 0.05) {
        if (!existiaAntes) { try { unlinkSync(destino); } catch { /* já não está */ } } // não deixa lixo na pasta de referências
        return responder(400, { erro: 'não consegui ler este áudio (o arquivo está corrompido ou não é áudio)' }), true;
      }
      const mapa = lerJson(caminhos.mapa);
      const clipe = nomeLivre(nomeDeClipe(nome), mapa.sons.map((s) => s.destino.replace(/\.mp3$/, '')));
      const ate = Math.round(Math.min(dur, 2) * 100) / 100;
      const som = { destino: `${clipe}.mp3`, fonte: nome, de: 0, ate, fade_ms: Math.min(100, Math.floor(ate * 500)) };
      const erros = validarMapa({ alvo: mapa.alvo, sons: [som] });
      if (erros.length) return responder(400, { erros }), true;
      const feito = processarSom({ ffmpeg, caps, origem, destinoDir: caminhos.saidas, mapa, som });
      if (!feito.ok) return responder(500, { erro: feito.erro }), true;
      gravarJson(caminhos.mapa, { ...mapa, sons: [...mapa.sons, som] });
      return responder(200, { ok: true, nome, clipe, som, resultado: feito, duracaoOriginal: Math.round(dur * 100) / 100 }), true;
    }

    return false;
  }

  return { id: 'sons', titulo: 'SONS', estado, rotas, pastasDoGit, caps };
}
