/**
 * A ferramenta do dono para os privilégios (ordem P196): `npm run admin -- listar | promover <e-mail> | rebaixar <e-mail>`. **É a única porta para criar um administrador**: nenhuma rota HTTP promove ninguém,
 * então o privilégio mais alto só se concede com acesso ao PC do servidor e ao arquivo do banco (o mesmo acesso que já dá tudo). Cada promoção e rebaixamento entra na trilha de auditoria (`auditoria.ts`).
 * A lógica mora aqui (testável); `scripts/admin.mjs` só abre o banco e imprime.
 */
import type { Auditoria } from './auditoria';
import type { Contas } from './contas';
import { normalizarEmail, REDEFINIR_VALE_MIN, urlDeRedefinicao, validarEmail } from '../shared/net/auth';

export const USO_ADMIN = 'uso: npm run admin -- listar | promover <e-mail> | rebaixar <e-mail> | link-senha <e-mail>';
/** O endereço do site que vai no link de senha gerado à mão (o mesmo do e-mail automático: `CYBERMECH_SITE_URL`). */
export const SITE_PADRAO = 'https://cybermech.online';

export function executarComandoAdmin(argv: readonly string[], contas: Contas, auditoria: Auditoria, siteBase: string = SITE_PADRAO): { codigo: number; linhas: string[] } {
  const [cmd, bruto] = argv;
  if (cmd === 'listar') {
    const admins = contas.listarAdmins();
    return { codigo: 0, linhas: admins.length ? admins.map((a) => `conta ${a.id}: ${a.email}`) : ['nenhum administrador'] };
  }
  if (cmd === 'link-senha') {
    // Para quando o e-mail automático não está ligado, ou a pessoa pediu ajuda ao dono: gera o link de redefinição (30 min, uso único) e o dono o entrega por onde conversa com ela.
    if (!bruto || validarEmail(bruto)) return { codigo: 2, linhas: ['e-mail inválido', USO_ADMIN] };
    const email = normalizarEmail(bruto);
    const r = contas.pedirRedefinicao(email);
    if (!r) return { codigo: 1, linhas: [`não existe conta com o e-mail ${email}`] };
    auditoria.registrar({ ator: 'dono', acao: 'link_senha_gerado', alvo: `conta:${r.contaId}` });
    return { codigo: 0, linhas: [`link de redefinição da conta ${r.contaId} (vale ${REDEFINIR_VALE_MIN} min, uma vez só; o anterior parou de valer):`, urlDeRedefinicao(siteBase, r.token, 'pt')] };
  }
  if (cmd !== 'promover' && cmd !== 'rebaixar') return { codigo: 2, linhas: [USO_ADMIN] };
  if (!bruto || validarEmail(bruto)) return { codigo: 2, linhas: ['e-mail inválido', USO_ADMIN] };
  const email = normalizarEmail(bruto);
  const promover = cmd === 'promover';
  const conta = contas.definirAdmin(email, promover);
  if (!conta) return { codigo: 1, linhas: [`não existe conta com o e-mail ${email} (a pessoa precisa criar a conta antes)`] };
  auditoria.registrar({ ator: 'dono', acao: promover ? 'admin_promovido' : 'admin_rebaixado', alvo: `conta:${conta.id}` });
  return { codigo: 0, linhas: [`${promover ? 'promovida' : 'rebaixada'}: conta ${conta.id} (${conta.email})`] };
}
