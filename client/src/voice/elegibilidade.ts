import { type IdadeDaConta, idadePodeFalar, idadePodeOuvir, VOZ_SO_PARA_ADULTO_DECLARADO } from '../../../shared/net/auth';

/**
 * Quem pode usar o chat de voz (P211, ordem do Comandante em 19/10: "menores de 18 anos NÃO TÊM ACESSO ao microfone nem aos áudios dos outros jogadores, apenas o áudio do jogo").
 * Só conta de maior de 18 anos: convidado (sem conta), conta sem idade informada e conta de menor ficam sem o microfone e sem a voz dos outros. O servidor decide de verdade
 * (`server/voz.ts` confere o token da sessão); isto só diz à tela o que mostrar. Sem DOM, sem custo.
 *
 * **FASE DE TESTES (P241, 21/10):** `VOZ_SO_PARA_ADULTO_DECLARADO = false` em `shared/net/auth.ts` deixa o convidado e a conta sem idade falarem e ouvirem; o menor declarado só ouve (sem microfone).
 * Todas as funções abaixo leem essa linha; o último parâmetro, `soAdulto`, existe para os testes provarem as duas regras.
 */
export type ElegibilidadeDaVoz = 'liberada' | 'convidado' | 'sem-idade' | 'menor';

export function elegibilidadeDaVoz(logado: boolean, idade: IdadeDaConta, soAdulto: boolean = VOZ_SO_PARA_ADULTO_DECLARADO): ElegibilidadeDaVoz {
  if (!logado) return soAdulto ? 'convidado' : 'liberada'; // o convidado nunca tem idade
  if (idade === 'adulto' || idadePodeFalar(idade, soAdulto)) return 'liberada';
  return idade; // 'menor' (na fase de testes só ouve) ou 'sem-idade' (só na regra da P211)
}

/**
 * O chat de voz liga? As três condições juntas: o jogador quer (Configurações), o Comandante liberou a funcionalidade (`tela:voz`) **e a conta é de maior de 18 anos** (P211).
 * Qualquer `idade` que não seja `adulto` (inclusive a sessão ainda não restaurada, `undefined`) mantém a voz desligada: na dúvida, desligada.
 */
export function vozDeveLigar(querOJogador: boolean, liberadaPeloDono: boolean, idade: IdadeDaConta | undefined, soAdulto: boolean = VOZ_SO_PARA_ADULTO_DECLARADO): boolean {
  return querOJogador && liberadaPeloDono && idade !== undefined && idadePodeOuvir(idade, soAdulto);
}

/**
 * O microfone vale para esta conta? **Uma regra, três portas:** o chat de voz (falar), o teste do microfone e a narração (P230, F8, que grava a voz do jogador no próprio arquivo, sem rede). Menor declarado fica
 * sem microfone, e a sessão ainda não restaurada (`undefined`) também: na dúvida, sem. Não depende do `tela:voz` (que solta ou segura o CHAT, não o microfone do próprio jogador).
 */
export function microfoneLiberado(idade: IdadeDaConta | undefined, soAdulto: boolean = VOZ_SO_PARA_ADULTO_DECLARADO): boolean {
  return idade !== undefined && idadePodeFalar(idade, soAdulto);
}

/**
 * Por que a voz NÃO está ligada para quem está numa sala com outras pessoas (P237). Em 20/10 o Comandante testou com dois PCs lado a lado, o microfone funcionava no teste, e a voz não chegou ao
 * outro PC: **nada na tela dizia por quê** (o outro PC não era conta de adulto, e quem não entra na voz não via nem o indicador). `null` = a voz está ligada, ou nem existe para o jogador
 * (funcionalidade ainda restrita pelo Comandante). Pura, sem DOM.
 */
export type MotivoSemVoz = Exclude<ElegibilidadeDaVoz, 'liberada'> | 'desligada';

export function motivoSemVoz(e: ElegibilidadeDaVoz, voiceOn: boolean, funcionalidadeLiberada: boolean, soAdulto: boolean = VOZ_SO_PARA_ADULTO_DECLARADO): MotivoSemVoz | null {
  if (!funcionalidadeLiberada) return null;
  const entra = !soAdulto && e === 'menor' ? 'liberada' : e; // o menor entra na voz, só ouvindo
  if (entra !== 'liberada') return entra;
  return voiceOn ? null : 'desligada';
}
