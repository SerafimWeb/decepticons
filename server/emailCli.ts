import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Duplex } from 'node:stream';
import { validarEmail } from '../shared/net/auth';
import { CONFIG_SMTP_EXEMPLO, EMAIL_ARQUIVO, MailerDaPasta, SENHA_DE_EXEMPLO } from './email';

/**
 * A ferramenta do dono para ligar o e-mail do "esqueci a senha" (P206): `npm run email -- iniciar | estado | testar <seu-e-mail>`. A lógica mora aqui (testável); `scripts/email.mjs`
 * só aponta para a pasta de dados e imprime. O dono **não precisa escrever JSON**: `iniciar` cria o `email.json` com a Hostinger já preenchida e ele só troca a senha no Bloco de Notas;
 * `testar` manda uma mensagem de verdade pelo MESMO caminho do servidor e, se falhar, diz o que conferir (a Hostinger responde só com um código).
 */
export const USO_EMAIL = 'uso: npm run email -- iniciar | estado | testar <seu-e-mail>';

const DICAS: [RegExp, string][] = [
  [/autenticação/, 'A caixa recusou o usuário ou a senha. No hPanel (E-mails), confira se a caixa existe, redefina a senha dela e use o endereço inteiro como usuário.'],
  [/conexão|tempo/, 'Não consegui falar com o servidor de e-mail. Confira o endereço e a porta (hPanel → E-mails → Configurações mostra o SMTP; a porta 465 é a de TLS direto) e a internet deste PC.'],
  [/remetente/, 'O endereço de origem ("de") precisa ser o da própria caixa que enviou.'],
  [/destinatário/, 'O servidor de e-mail recusou o destinatário do teste: confira o endereço digitado.'],
  [/envio|dados/, 'A Hostinger recusou a mensagem (limite de envios da caixa ou bloqueio). Espere alguns minutos e tente de novo.'],
  [/respondeu 40[13]|respondeu 422/, 'O provedor recusou a chave ou o remetente: confira a chave e se o domínio do remetente está verificado nele.'],
];

export async function executarEmail(
  argv: readonly string[],
  dirDados: string,
  o: { env?: NodeJS.ProcessEnv; conectar?: (host: string, porta: number) => Duplex } = {},
): Promise<{ codigo: number; linhas: string[] }> {
  const [cmd, alvo] = argv;
  const arquivo = join(dirDados, EMAIL_ARQUIVO);
  const env = o.env ?? {};

  if (cmd === 'iniciar') {
    if (existsSync(arquivo)) return { codigo: 1, linhas: [`já existe ${arquivo}; não sobrescrevo. Abra no Bloco de Notas, ajuste e rode: npm run email -- testar seu@email.com`] };
    mkdirSync(dirDados, { recursive: true });
    writeFileSync(arquivo, `${JSON.stringify(CONFIG_SMTP_EXEMPLO, null, 2).replace(/\n/g, '\r\n')}\r\n`);
    return {
      codigo: 0,
      linhas: [
        `criei ${arquivo} (fora do git).`,
        `1) Abra esse arquivo no Bloco de Notas e troque ${SENHA_DE_EXEMPLO} pela senha da caixa ${CONFIG_SMTP_EXEMPLO.usuario} (a que você criou no hPanel, em E-mails). Salve.`,
        '2) Teste: npm run email -- testar seu@email.com',
        '(o servidor lê o arquivo sozinho: não precisa reiniciar.)',
      ],
    };
  }

  if (cmd === 'estado') {
    if (!existsSync(arquivo)) return { codigo: 1, linhas: [`sem ${EMAIL_ARQUIVO}: rode npm run email -- iniciar`] };
    let cfg: { provedor?: string; host?: string; porta?: number; usuario?: string; senha?: string; chave?: string; de?: string };
    try {
      cfg = JSON.parse(readFileSync(arquivo, 'utf8'));
    } catch {
      return { codigo: 1, linhas: [`${EMAIL_ARQUIVO} não é JSON válido (uma vírgula ou aspa fora do lugar?)`] };
    }
    const segredoOk = cfg.provedor === 'smtp' ? !!cfg.senha && cfg.senha !== SENHA_DE_EXEMPLO : !!cfg.chave && cfg.chave !== 're_COLE_AQUI';
    const linhas = [`provedor: ${cfg.provedor ?? '?'}`];
    if (cfg.provedor === 'smtp') linhas.push(`servidor: ${cfg.host ?? '?'}:${cfg.porta ?? 465}`, `usuário: ${cfg.usuario ?? '?'}`);
    linhas.push(`de: ${cfg.de ?? '?'}`, `senha/chave: ${segredoOk ? 'definida (não mostrada)' : `AINDA É O EXEMPLO: troque ${SENHA_DE_EXEMPLO}`}`);
    return { codigo: segredoOk ? 0 : 1, linhas };
  }

  if (cmd === 'testar') {
    if (!alvo || validarEmail(alvo)) return { codigo: 2, linhas: ['e-mail inválido', USO_EMAIL] };
    const log: string[] = [];
    const mailer = new MailerDaPasta(dirDados, env, (l) => log.push(l), undefined, o.conectar);
    if (!mailer.configurado()) return { codigo: 1, linhas: [`o envio de e-mail ainda não está configurado.`, ...log, 'Rode: npm run email -- iniciar (e troque a senha no arquivo).'] };
    const antes = log.length;
    const ok = await mailer.enviar({
      para: alvo,
      assunto: 'CYBERMECH: teste do envio de e-mail',
      texto: 'Se você recebeu esta mensagem, o envio de e-mail do servidor do CYBERMECH está funcionando e o "Esqueci a senha" já pode mandar o link.\n',
    });
    if (ok) return { codigo: 0, linhas: [`enviado para ${alvo}. Confira a caixa de entrada (e o spam, na primeira vez).`] };
    const falhas = log.slice(antes).filter((l) => l.startsWith('e-mail:'));
    const dica = DICAS.find(([re]) => falhas.some((l) => re.test(l)))?.[1];
    return { codigo: 1, linhas: ['NÃO enviou.', ...falhas, ...(dica ? [dica] : [])] };
  }

  return { codigo: 2, linhas: [USO_EMAIL] };
}
