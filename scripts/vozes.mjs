/**
 * Gera as vozes do narrador com o ElevenLabs (P146). Uma fala por sotaque, em `client/public/audio/vozes/<sotaque>/<chave>.mp3`, e atualiza o manifesto
 * `client/src/audio/vozesGeradas.json` (é por ele que o jogo sabe quais clipes pedir, sem 404).
 *
 *   npm run vozes                                  # esta ajuda
 *   npm run vozes -- --listar                      # as vozes da SUA conta (id, nome, sotaque); grátis
 *   npm run vozes -- --biblioteca "russian"        # procura na biblioteca pública (melhor esforço; adicione a voz à sua conta no site do ElevenLabs)
 *   npm run vozes -- --custo                       # o que seria gerado e quantos caracteres, SEM gastar nada
 *   npm run vozes -- --gerar                       # mostra o plano; para gastar crédito, repita com --sim
 *   npm run vozes -- --gerar --sim [--sotaque ru,cn] [--so combate,rodada_1] [--refazer]
 *   npm run vozes -- --manifesto                   # só reescreve o manifesto (depois de largar `.mp3` gerados no site do ElevenLabs na pasta)
 *
 * **A chave fica só na variável de ambiente** `ELEVENLABS_API_KEY` (R2): no PowerShell, `$env:ELEVENLABS_API_KEY = "..."` na própria janela (some ao fechar).
 * Nunca no repositório, nunca no chat, nunca impressa. O que já foi gerado não se gera de novo (o crédito se gasta uma vez só por frase).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { API, linhasDeVozes, montarManifesto, planejar, resumoDoPlano, SOTAQUES, sintetizar } from './vozesLib.mjs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOGO = join(raiz, 'client/src/audio/falas.json');
const MANIFESTO = join(raiz, 'client/src/audio/vozesGeradas.json');
const CONFIG = join(raiz, 'scripts/vozes.config.json');
const PASTA = join(raiz, 'client/public/audio/vozes');

const args = process.argv.slice(2);
const tem = (n) => args.includes(`--${n}`);
const valor = (n) => (tem(n) ? args[args.indexOf(`--${n}`) + 1] : undefined);
const lista = (n) => valor(n)?.split(',').map((s) => s.trim()).filter(Boolean) ?? null;

const lerJson = (arq) => JSON.parse(readFileSync(arq, 'utf8'));
const catalogo = lerJson(CATALOGO);
const config = lerJson(CONFIG);

function arquivosGerados() {
  const porSotaque = {};
  for (const s of SOTAQUES) {
    const dir = join(PASTA, s);
    porSotaque[s] = existsSync(dir) ? readdirSync(dir).filter((a) => a.endsWith('.mp3')).map((a) => a.slice(0, -4)) : [];
  }
  return porSotaque;
}

/** As falas que o Comandante gravou no Estúdio (`scripts/vozes-gravadas.json`): o gerador não as regera. */
function protegidasDoEstudio() {
  const arq = join(raiz, 'scripts/vozes-gravadas.json');
  if (!existsSync(arq)) return new Set();
  return new Set((lerJson(arq).gravacoes ?? []).map((g) => `${g.sotaque}/${g.chave}`));
}

function gravarManifesto() {
  const antigo = existsSync(MANIFESTO) ? lerJson(MANIFESTO) : {};
  const novo = montarManifesto(arquivosGerados(), catalogo.falas, antigo._nota ?? '');
  writeFileSync(MANIFESTO, JSON.stringify(novo, null, 2) + '\n');
  const total = SOTAQUES.reduce((n, s) => n + novo[s].length, 0);
  console.log(`manifesto atualizado: ${total} fala(s) gerada(s) (${SOTAQUES.map((s) => `${s} ${novo[s].length}`).join(', ')})`);
}

const chaveApi = process.env.ELEVENLABS_API_KEY?.trim();
function exigirChave() {
  if (chaveApi) return chaveApi;
  console.error('Falta a chave do ElevenLabs. Defina a variável de ambiente na própria janela (a chave nunca vai para o repositório nem para o chat):');
  console.error('  PowerShell:  $env:ELEVENLABS_API_KEY = "sua-chave"');
  process.exit(1);
}

async function pegar(caminho) {
  const r = await fetch(`${API}${caminho}`, { headers: { 'xi-api-key': exigirChave() } });
  if (!r.ok) throw new Error(`o ElevenLabs respondeu ${r.status}${r.status === 401 ? ' (chave recusada)' : ''}`);
  return r.json();
}

try {
  if (tem('manifesto')) {
    gravarManifesto();
  } else if (tem('listar')) {
    const r = await pegar('/v1/voices');
    console.log('id                      nome                         sotaque        gênero   categoria');
    for (const l of linhasDeVozes(r)) console.log(l);
    console.log('\nPonha o id escolhido em scripts/vozes.config.json (br, en, ru, cn).');
  } else if (tem('biblioteca')) {
    const busca = valor('biblioteca') ?? '';
    const r = await pegar(`/v1/shared-voices?page_size=15&search=${encodeURIComponent(busca)}`);
    for (const v of r.voices ?? []) console.log(`${v.voice_id}  ${String(v.name ?? '').padEnd(28)} ${String(v.accent ?? '-').padEnd(14)} ${String(v.gender ?? '-').padEnd(8)} ${v.preview_url ?? ''}`);
    console.log('\nPara usar uma voz da biblioteca, adicione-a à sua coleção no site do ElevenLabs e confirme com `npm run vozes -- --listar`.');
  } else if (tem('custo') || tem('gerar')) {
    const existentes = new Set(Object.entries(arquivosGerados()).flatMap(([s, cs]) => cs.map((c) => `${s}/${c}`)));
    const protegidas = protegidasDoEstudio();
    const plano = planejar({ falas: catalogo.falas, config, existentes, sotaques: lista('sotaque') ?? SOTAQUES, so: lista('so'), refazer: tem('refazer'), protegidas });
    console.log(resumoDoPlano(plano));
    if (tem('gerar') && plano.fazer.length > 0) {
      const teto = Number(valor('max-caracteres') ?? 3000);
      if (plano.caracteres > teto) {
        console.error(`Recusado: ${plano.caracteres} caracteres passam do teto de ${teto} (--max-caracteres N para mudar).`);
        process.exit(1);
      }
      if (!tem('sim')) {
        console.log('\nNada foi gasto. Para gerar de verdade, repita o comando com --sim.');
      } else {
        const chave = exigirChave();
        let feitos = 0;
        try {
          for (const item of plano.fazer) {
            const bytes = await sintetizar({
              fetchFn: fetch,
              chaveApi: chave,
              voz: item.voz,
              texto: item.texto,
              estilo: item.estilo,
              modelo: catalogo.modelo,
              saida: config.saida ?? 'mp3_44100_128',
              estilos: catalogo.estilos,
            });
            mkdirSync(join(PASTA, item.sotaque), { recursive: true });
            writeFileSync(join(PASTA, item.sotaque, `${item.chave}.mp3`), bytes);
            feitos++;
            console.log(`  ok  ${item.sotaque}/${item.chave}  (${bytes.length} bytes)  "${item.texto}"`);
          }
        } finally {
          if (feitos > 0) gravarManifesto();
        }
        console.log(`\n${feitos} fala(s) gerada(s). Abra o jogo com ?narrador=${plano.fazer[0].sotaque} para ouvir; depois commite os .mp3 e o manifesto.`);
      }
    }
  } else {
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace(/^\/\*\*\n?/, '').replace(/^ \* ?/gm, ''));
  }
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}
