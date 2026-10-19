/**
 * `npm run email -- iniciar | estado | testar <seu-e-mail>`: liga e confere o e-mail do "esqueci a senha" (P206; lógica e testes em `server/emailCli.ts`).
 * Rode **no PC do servidor, na pasta `.tmp\wt-servidor-prod`** (a worktree de produção, sempre em dia com a `main`; ela acha sozinha os dados da pasta principal, onde fica o `email.json`), ou em qualquer worktree, ou diga a pasta com `CYBERMECH_DADOS`.
 * A senha da caixa de e-mail fica só nesse arquivo, fora do git; esta ferramenta nunca a imprime.
 */
import { resolve } from 'node:path';
import { runnerImport } from 'vite';

const load = async (p) => (await runnerImport(resolve(p), { configFile: false, logLevel: 'silent' })).module;
const { pastaDadosDasFerramentas } = await load('server/dados.ts');
const { executarEmail } = await load('server/emailCli.ts');

const r = await executarEmail(process.argv.slice(2), pastaDadosDasFerramentas(resolve('.')), { env: process.env });
for (const l of r.linhas) (r.codigo === 0 ? console.log : console.error)(l);
process.exitCode = r.codigo;
