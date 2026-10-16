/**
 * O miolo do gerador de vozes do narrador (P146): funções puras e injetáveis (o teste não gasta crédito nem toca a rede). O comando é `scripts/vozes.mjs`
 * (`npm run vozes`); o catálogo de falas é `client/src/audio/falas.json`; as vozes de cada sotaque, `scripts/vozes.config.json`.
 *
 * **A chave do ElevenLabs só existe na variável de ambiente `ELEVENLABS_API_KEY`** (R2): nunca em arquivo versionado, nunca no chat, nunca impressa.
 */

export const SOTAQUES = ['br', 'en', 'ru', 'cn'];
export const API = 'https://api.elevenlabs.io';

/**
 * O que gerar: uma fala por sotaque que **tem voz configurada** e ainda **não tem `.mp3`** (a menos que `refazer`). `so` limita a algumas chaves e `sotaques`
 * a alguns sotaques. Devolve também o que foi pulado e por quê, e o total de caracteres a pagar (o ElevenLabs cobra por caractere).
 */
export function planejar({ falas, config, existentes, sotaques = SOTAQUES, so = null, refazer = false, protegidas = new Set() }) {
  const fazer = [];
  const pulados = [];
  for (const fala of falas) {
    if (so && !so.includes(fala.chave)) continue;
    for (const sotaque of sotaques) {
      const voz = config.vozes?.[sotaque]?.voz?.trim();
      if (!voz) {
        pulados.push({ sotaque, chave: fala.chave, motivo: 'sem voz configurada' });
        continue;
      }
      // A fala que o Comandante GRAVOU (Estúdio, aba VOZES) nunca é regerada: nem com --refazer (o gerador não pisa na voz dele).
      if (protegidas.has(`${sotaque}/${fala.chave}`)) {
        pulados.push({ sotaque, chave: fala.chave, motivo: 'gravada por você (protegida)' });
        continue;
      }
      if (!refazer && existentes.has(`${sotaque}/${fala.chave}`)) {
        pulados.push({ sotaque, chave: fala.chave, motivo: 'já existe' });
        continue;
      }
      fazer.push({ sotaque, chave: fala.chave, texto: fala.texto[sotaque], estilo: fala.estilo, voz });
    }
  }
  const caracteres = fazer.reduce((n, f) => n + f.texto.length, 0);
  return { fazer, pulados, caracteres };
}

/** O manifesto `vozesGeradas.json`: para cada sotaque, as chaves do catálogo (na ordem dele) que têm `.mp3` na pasta. Arquivo fora do catálogo é ignorado. */
export function montarManifesto(arquivos, falas, nota) {
  const manifesto = { _nota: nota };
  for (const sotaque of SOTAQUES) {
    const tem = new Set(arquivos[sotaque] ?? []);
    manifesto[sotaque] = falas.map((f) => f.chave).filter((chave) => tem.has(chave));
  }
  return manifesto;
}

/** Uma fala em áudio: `POST /v1/text-to-speech/{voz}`. Devolve os bytes do `.mp3`. O erro nunca carrega a chave. */
export async function sintetizar({ fetchFn, chaveApi, voz, texto, estilo, modelo, saida, estilos }) {
  const resposta = await fetchFn(`${API}/v1/text-to-speech/${encodeURIComponent(voz)}?output_format=${encodeURIComponent(saida)}`, {
    method: 'POST',
    headers: { 'xi-api-key': chaveApi, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({ text: texto, model_id: modelo, voice_settings: estilos[estilo] }),
  });
  if (!resposta.ok) {
    let detalhe = '';
    try {
      detalhe = (await resposta.text()).slice(0, 200);
    } catch {
      /* sem corpo */
    }
    const dica = resposta.status === 401 ? ' (chave recusada: confira a variável ELEVENLABS_API_KEY)' : resposta.status === 429 ? ' (limite de uso: espere e rode de novo, o que já saiu fica)' : '';
    throw new Error(`o ElevenLabs respondeu ${resposta.status}${dica}${detalhe ? `: ${detalhe}` : ''}`);
  }
  return new Uint8Array(await resposta.arrayBuffer());
}

/** O texto do aviso de custo, antes de gastar crédito. */
export function resumoDoPlano(plano) {
  const porSotaque = {};
  for (const f of plano.fazer) porSotaque[f.sotaque] = (porSotaque[f.sotaque] ?? 0) + 1;
  const linhas = [`A gerar: ${plano.fazer.length} fala(s), ${plano.caracteres} caractere(s) a pagar.`];
  for (const [s, n] of Object.entries(porSotaque)) linhas.push(`  ${s}: ${n}`);
  const semVoz = [...new Set(plano.pulados.filter((p) => p.motivo === 'sem voz configurada').map((p) => p.sotaque))];
  if (semVoz.length > 0) linhas.push(`Sem voz configurada (pulados): ${semVoz.join(', ')}. Escolha a voz com \`npm run vozes -- --listar\` e ponha o id em scripts/vozes.config.json.`);
  const protegidas = plano.pulados.filter((p) => p.motivo.startsWith('gravada por você')).length;
  if (protegidas > 0) linhas.push(`Gravadas por você (protegidas, nunca regeradas, nem com --refazer): ${protegidas}.`);
  const jaExistem = plano.pulados.filter((p) => p.motivo === 'já existe').length;
  if (jaExistem > 0) linhas.push(`Já existem (pulados, sem custo): ${jaExistem}. Use --refazer para gerar de novo.`);
  return linhas.join('\n');
}

/** As vozes da conta, para a tela de escolha: id, nome, sotaque e gênero (do rótulo que o ElevenLabs guarda). */
export function linhasDeVozes(resposta) {
  return (resposta?.voices ?? []).map((v) => {
    const r = v.labels ?? {};
    return `${v.voice_id}  ${String(v.name ?? '').padEnd(28)} ${String(r.accent ?? '-').padEnd(14)} ${String(r.gender ?? '-').padEnd(8)} ${v.category ?? ''}`;
  });
}
