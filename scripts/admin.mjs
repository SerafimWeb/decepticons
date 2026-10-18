/**
 * `npm run admin -- listar | promover <e-mail> | rebaixar <e-mail>`: o único jeito de criar (ou tirar) um administrador (ordem P196; lógica e testes em `server/adminContas.ts`).
 * Rode **na pasta principal do projeto, no PC do servidor** (ela aponta para `.tmp/servidor`, onde está o banco de contas de produção), ou diga a pasta com `CYBERMECH_DADOS`.
 * A pessoa precisa ter criado a conta antes. O efeito é imediato: a sessão que ela já tem aberta passa a valer como administrador (ou deixa de valer).
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runnerImport } from 'vite';

const load = async (p) => (await runnerImport(resolve(p), { configFile: false, logLevel: 'silent' })).module;
const { Contas } = await load('server/contas.ts');
const { pastaDados, bancoDeContas } = await load('server/dados.ts');
const { Auditoria, AUDITORIA_PASTA } = await load('server/auditoria.ts');
const { executarComandoAdmin } = await load('server/adminContas.ts');

const dados = pastaDados(resolve('.'));
const banco = bancoDeContas(dados);
if (!existsSync(banco)) {
  console.error(`não achei o banco de contas em ${banco}\nRode na pasta principal do projeto (no PC do servidor) ou diga a pasta com CYBERMECH_DADOS.`);
  process.exit(1);
}
const contas = new Contas(banco);
try {
  const r = executarComandoAdmin(process.argv.slice(2), contas, new Auditoria(join(dados, AUDITORIA_PASTA)));
  for (const l of r.linhas) (r.codigo === 0 ? console.log : console.error)(l);
  process.exitCode = r.codigo;
} finally {
  contas.close();
}
