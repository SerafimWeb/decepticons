/**
 * O consumo do GitHub Actions, para decidir com número e não com susto (P222): `npm run ci:consumo [-- --desde AAAA-MM-DD] [--cota 2000]`.
 * Lê as execuções recentes (`gh run list`, com a credencial do Git se o token do `gh` morreu), soma os minutos por workflow e evento (cada job cobra no mínimo 1 minuto, então o número é
 * **aproximado**: duração da execução arredondada para cima) e projeta quando a cota do mês acaba no ritmo do período. O ciclo de cobrança exato e o gasto oficial estão em github.com/settings/billing.
 */
import { spawnSync } from 'node:child_process';
import { esconder, tokenDoGit } from './ghSeguro.mjs';

const arg = (nome, padrao) => {
  const i = process.argv.indexOf(nome);
  return i >= 0 ? process.argv[i + 1] : padrao;
};
const COTA = Number(arg('--cota', '2000'));
const desde = Date.parse(`${arg('--desde', new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10))}T00:00:00Z`);
if (!Number.isFinite(desde)) throw new Error('--desde precisa ser AAAA-MM-DD');

// O gerenciador de credenciais do Windows às vezes passa dos 20 s da primeira chamada com a máquina carregada: tenta duas vezes.
const token = process.env.GH_TOKEN || tokenDoGit() || tokenDoGit();
if (!token) throw new Error('sem credencial: defina GH_TOKEN ou deixe o Git com a credencial do GitHub');
const r = spawnSync('gh', ['run', 'list', '--limit', '300', '--json', 'workflowName,event,createdAt,updatedAt'], { encoding: 'utf8', env: { ...process.env, GH_TOKEN: token }, maxBuffer: 64 * 1024 * 1024 });
if (r.status !== 0) throw new Error(`gh run list falhou: ${esconder(r.stderr, token).slice(0, 200)}`);

const runs = JSON.parse(esconder(r.stdout, token)).filter((x) => Date.parse(x.createdAt) >= desde);
if (!runs.length) {
  console.log('nenhuma execução no período');
  process.exit(0);
}
const por = new Map();
let total = 0;
for (const x of runs) {
  const min = Math.max(1, Math.ceil((Date.parse(x.updatedAt) - Date.parse(x.createdAt)) / 60_000));
  const chave = `${x.workflowName} / ${x.event}`;
  const a = por.get(chave) ?? { n: 0, min: 0 };
  a.n++;
  a.min += min;
  por.set(chave, a);
  total += min;
}
const dias = Math.max(1 / 24, (Date.now() - Math.min(...runs.map((x) => Date.parse(x.createdAt)))) / 86_400_000);
console.log(`Execuções desde ${new Date(desde).toISOString().slice(0, 10)} (minutos aproximados):`);
for (const [k, v] of [...por].sort((a, b) => b[1].min - a[1].min)) console.log(`${String(v.min).padStart(5)} min ${String(Math.round((100 * v.min) / total)).padStart(3)}%  ${String(v.n).padStart(3)} exec  ${k}`);
const ritmo = total / dias;
console.log(`${String(total).padStart(5)} min total em ${dias.toFixed(1)} dia(s): ~${Math.round(ritmo)} min/dia; a cota de ${COTA} min dura ~${Math.floor(COTA / ritmo)} dia(s) nesse ritmo.`);
