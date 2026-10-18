/**
 * Arquivar o que é velho dos dois documentos que só crescem (P203, ordem do Comandante: "bora limpar pra tornar mais leve,
 * bem enxuto e salvando o que for importante").
 *
 * `ESTADO_ATUAL.md` e `HISTORICO_DE_DECISOES.md` chegaram a 640 KB cada, e todo agente os lê e edita a cada tarefa. Aqui o
 * que tem mais de dois dias sai deles **sem perder uma linha**: vai, tal e qual, para `.decepticons/arquivo/` (um arquivo por
 * quinzena, do mais novo ao mais velho). O painel (`scripts/site/dados.mjs`) lê os dois lugares, então os números não mudam.
 *
 *   npm run arquivar                                   -> ensaio: diz quanto sai, não escreve nada
 *   npm run arquivar -- --aplicar                      -> arquiva (mantém hoje e ontem)
 *   npm run arquivar -- --manter-a-partir 2026-10-17 --aplicar
 *
 * A lógica de dividir é pura (texto entra, texto sai) e tem teste em `server/arquivarDocs.test.ts`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const PASTA = '.decepticons';
const ARQUIVO = join(PASTA, 'arquivo');
const MARCA = '<!-- arquivo -->';

/** Seções do ESTADO que nunca saem: o painel e o ritual de sessão leem pelo nome (a de EM BRANCH só perde o histórico de entregas). */
const FIXAS = /^## (Resumo Executivo|EM BRANCH|PENDENTE|RASCUNHO ANTIGO|MODELOS DE IA|DIVISÃO DE TRABALHO|DECISÕES EM ABERTO|BLOQUEIOS|PRÓXIMA SESSÃO)/i;

const PONTEIRO_EM_BRANCH = '> O histórico de entregas que ficava aqui';

const iso = (a, m, d) => `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/**
 * A data `dd/mm` mais recente do título de uma seção (`Claude, 18/10 (branch …)`) como `AAAA-MM-DD`, ou `null` se não há.
 * A mais recente, e não a primeira: um título que cita um dia antigo ("continuação de 11/10 … 18/10") é de hoje, e na dúvida
 * a seção fica. O ano é o do corte (o anterior se o mês cair longe depois dele).
 */
export function dataDoTitulo(titulo, corte) {
  const [ano, mesCorte] = [Number(corte.slice(0, 4)), Number(corte.slice(5, 7))];
  const datas = [...titulo.matchAll(/(?<!\d)(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])(?!\d)/g)].map((m) => {
    const mes = Number(m[2]);
    return iso(mes > mesCorte + 1 ? ano - 1 : ano, mes, Number(m[1]));
  });
  return datas.length ? datas.sort().at(-1) : null;
}

/** Em qual arquivo uma data cai: uma quinzena (`2026-10-a` = dias 1 a 15, `b` = 16 em diante). */
export function quinzena(dia) {
  return `${dia.slice(0, 7)}-${Number(dia.slice(8, 10)) <= 15 ? 'a' : 'b'}`;
}

/** Quebra o texto em blocos que começam por uma linha `## `; o que vem antes do primeiro é o `cabeca`. */
function blocos(texto) {
  const linhas = texto.split('\n');
  const partes = [];
  let atual = { cabeca: true, linhas: [] };
  for (const l of linhas) {
    if (l.startsWith('## ')) {
      partes.push(atual);
      atual = { cabeca: false, linhas: [l] };
    } else atual.linhas.push(l);
  }
  partes.push(atual);
  return partes.map((p) => ({ cabeca: p.cabeca, titulo: p.cabeca ? '' : p.linhas[0], texto: p.linhas.join('\n') }));
}

/**
 * Divide o `ESTADO_ATUAL.md`. Sai a seção cujo título traz uma data anterior a `manterAPartirDe`; ficam as de hoje para
 * a frente, as sem data e as fixas. Da seção "EM BRANCH" fica a tabela e sai a lista antiga de entregas (já na `main`).
 * @returns {{ fica: string, saem: { chave: string, texto: string }[] }}
 */
export function dividirEstado(texto, manterAPartirDe) {
  const fica = [];
  const saem = [];
  for (const b of blocos(texto)) {
    if (b.cabeca) {
      fica.push(b.texto);
      continue;
    }
    if (/^## EM BRANCH/i.test(b.titulo)) {
      const linhas = b.texto.split('\n');
      const corte = linhas.findIndex((l, i) => i > 0 && l.trim() === '---');
      const resto = corte >= 0 ? linhas.slice(corte + 1).filter((l) => !l.startsWith(PONTEIRO_EM_BRANCH)).join('\n').trim() : '';
      if (resto) {
        fica.push(`${linhas.slice(0, corte + 1).join('\n')}\n\n${PONTEIRO_EM_BRANCH} está em \`.decepticons/arquivo/estado-em-branch.md\`.\n`);
        saem.push({ chave: 'em-branch', texto: `${b.titulo}\n\n${resto}\n` });
      } else fica.push(b.texto);
      continue;
    }
    const dia = FIXAS.test(b.titulo) ? null : dataDoTitulo(b.titulo, manterAPartirDe);
    if (dia && dia < manterAPartirDe) saem.push({ chave: quinzena(dia), texto: b.texto });
    else fica.push(b.texto);
  }
  return { fica: avisoNoTopo(fica.join('\n'), AVISO_ESTADO), saem };
}

/**
 * Divide o `HISTORICO_DE_DECISOES.md` (entradas `## [AAAA-MM-DD] título`). Saem as anteriores a `manterAPartirDe`.
 * Um título fora do formato (`## 06/10 — Codex: …`, escrito à mão por um agente) **segue a entrada de colchetes que vem
 * antes dele**, como o painel já o lê (ele só separa entradas pelo `## [`): sai e fica junto com ela, e a contagem não muda.
 */
export function dividirHistorico(texto, manterAPartirDe) {
  const fica = [];
  const saem = [];
  let destino = null; // o que se decidiu para a última entrada de colchetes: { chave } se vai embora, null se fica
  for (const b of blocos(texto)) {
    const dia = /^## \[(\d{4}-\d{2}-\d{2})\]/.exec(b.titulo)?.[1];
    if (dia) destino = dia < manterAPartirDe ? { chave: quinzena(dia) } : null;
    if (destino && (dia || !b.cabeca)) saem.push({ chave: destino.chave, texto: b.texto });
    else fica.push(b.texto);
  }
  return { fica: avisoNoTopo(fica.join('\n'), AVISO_HISTORICO), saem };
}

const AVISO_ESTADO = `> **Arquivo:** o que tem mais de dois dias mora em \`.decepticons/arquivo/estado-*.md\` (nada se perdeu; \`npm run arquivar\` move mais). Procure por busca, não leia inteiro.`;
const AVISO_HISTORICO = `> **Arquivo:** as entradas com mais de dois dias moram em \`.decepticons/arquivo/historico-*.md\` (nada se perdeu; \`npm run arquivar\` move mais). Procure por busca, não leia inteiro.`;

/** Põe o aviso uma vez só, no topo (depois do título `# …`, se houver). */
function avisoNoTopo(texto, aviso) {
  if (texto.includes('**Arquivo:**')) return texto;
  const linhas = texto.split('\n');
  const i = linhas[0]?.startsWith('# ') ? 1 : 0;
  linhas.splice(i, 0, ...(i ? [''] : []), aviso, '');
  return linhas.join('\n');
}

/** Junta o que saiu por arquivo de destino, do mais novo ao mais velho dentro de cada um (a ordem em que estava). */
export function agrupar(saem) {
  const por = new Map();
  for (const s of saem) por.set(s.chave, `${por.get(s.chave) ?? ''}${por.has(s.chave) ? '\n' : ''}${s.texto.replace(/\n+$/, '')}\n`);
  return por;
}

/** Acrescenta ao arquivo que já existe (logo depois do cabeçalho, porque o que sai agora é mais novo) ou cria um com cabeçalho. */
export function acrescentar(existente, novo, cabecalho) {
  if (!existente) return `${cabecalho}\n${MARCA}\n\n${novo}`;
  const i = existente.indexOf(MARCA);
  if (i < 0) throw new Error('arquivo sem a marca de início');
  const corte = i + MARCA.length;
  return `${existente.slice(0, corte)}\n\n${novo.replace(/\n+$/, '')}\n${existente.slice(corte).replace(/^\n+/, '\n')}`;
}

const crlf = (t) => t.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
const lf = (t) => t.replace(/\r\n/g, '\n');
const kb = (t) => Math.round(Buffer.byteLength(t) / 1024);

function ontem() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function main(args) {
  const aplicar = args.includes('--aplicar');
  const i = args.indexOf('--manter-a-partir');
  const manter = i >= 0 ? args[i + 1] : ontem();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(manter ?? '')) throw new Error('--manter-a-partir AAAA-MM-DD');

  const alvos = [
    { arq: join(PASTA, 'ESTADO_ATUAL.md'), prefixo: 'estado', nome: 'ESTADO_ATUAL', dividir: dividirEstado },
    { arq: join(PASTA, 'HISTORICO_DE_DECISOES.md'), prefixo: 'historico', nome: 'HISTORICO_DE_DECISOES', dividir: dividirHistorico },
  ];
  console.log(`mantém de ${manter} em diante${aplicar ? '' : ' (ensaio: nada é escrito; use --aplicar)'}`);
  for (const a of alvos) {
    const antes = lf(readFileSync(a.arq, 'utf8'));
    const { fica, saem } = a.dividir(antes, manter);
    const por = agrupar(saem);
    const movido = [...por.values()].reduce((s, t) => s + Buffer.byteLength(t), 0);
    console.log(`${a.nome}: ${kb(antes)} KB -> ${kb(fica)} KB (saem ${saem.length} blocos, ${Math.round(movido / 1024)} KB, para ${[...por.keys()].map((c) => `${a.prefixo}-${c}.md`).join(', ') || 'nenhum'})`);
    if (!aplicar) continue;
    mkdirSync(ARQUIVO, { recursive: true });
    for (const [chave, texto] of por) {
      const dest = join(ARQUIVO, `${a.prefixo}-${chave}.md`);
      const cab = `# ARQUIVO — ${a.nome} (${chave === 'em-branch' ? 'entregas antigas da seção EM BRANCH' : `quinzena ${chave}`})\n\n> Texto movido sem alteração de \`${a.nome}.md\` por \`npm run arquivar\`. Não editar: o vivo é o documento principal.\n`;
      const atual = existsSync(dest) ? lf(readFileSync(dest, 'utf8')) : '';
      writeFileSync(dest, crlf(acrescentar(atual, texto, cab)));
    }
    writeFileSync(a.arq, crlf(fica));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
