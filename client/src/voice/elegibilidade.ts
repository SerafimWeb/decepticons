import type { IdadeDaConta } from '../../../shared/net/auth';

/**
 * Quem pode usar o chat de voz (P211, ordem do Comandante em 19/10: "menores de 18 anos NÃO TÊM ACESSO ao microfone nem aos áudios dos outros jogadores, apenas o áudio do jogo").
 * Só conta de maior de 18 anos: convidado (sem conta), conta sem idade informada e conta de menor ficam sem o microfone e sem a voz dos outros. O servidor decide de verdade
 * (`server/voz.ts` confere o token da sessão); isto só diz à tela o que mostrar. Sem DOM, sem custo.
 */
export type ElegibilidadeDaVoz = 'liberada' | 'convidado' | 'sem-idade' | 'menor';

export function elegibilidadeDaVoz(logado: boolean, idade: IdadeDaConta): ElegibilidadeDaVoz {
  if (!logado) return 'convidado';
  return idade === 'adulto' ? 'liberada' : idade;
}

/**
 * O chat de voz liga? As três condições juntas: o jogador quer (Configurações), o Comandante liberou a funcionalidade (`tela:voz`) **e a conta é de maior de 18 anos** (P211).
 * Qualquer `idade` que não seja `adulto` (inclusive a sessão ainda não restaurada, `undefined`) mantém a voz desligada: na dúvida, desligada.
 */
export function vozDeveLigar(querOJogador: boolean, liberadaPeloDono: boolean, idade: IdadeDaConta | undefined): boolean {
  return querOJogador && liberadaPeloDono && idade === 'adulto';
}

/**
 * A narração (P230, F8) grava a voz do jogador no próprio arquivo, sem rede: **mesma regra do chat, por ser a mesma ordem** ("menores de 18 anos NÃO TÊM ACESSO ao microfone"). Só `adulto` abre o microfone;
 * menor, sem idade e a sessão ainda não restaurada (`undefined`) ficam sem: na dúvida, sem. Não depende do `tela:voz` (que solta ou segura o CHAT, não o microfone do próprio jogador).
 */
export function microfoneDaNarracaoLiberado(idade: IdadeDaConta | undefined): boolean {
  return idade === 'adulto';
}

/**
 * Por que a voz NÃO está ligada para quem está numa sala com outras pessoas (P237). Em 20/10 o Comandante testou com dois PCs lado a lado, o microfone funcionava no teste, e a voz não chegou ao
 * outro PC: **nada na tela dizia por quê** (o outro PC não era conta de adulto, e quem não entra na voz não via nem o indicador). `null` = a voz está ligada, ou nem existe para o jogador
 * (funcionalidade ainda restrita pelo Comandante). Pura, sem DOM.
 */
export type MotivoSemVoz = Exclude<ElegibilidadeDaVoz, 'liberada'> | 'desligada';

export function motivoSemVoz(e: ElegibilidadeDaVoz, voiceOn: boolean, funcionalidadeLiberada: boolean): MotivoSemVoz | null {
  if (!funcionalidadeLiberada) return null;
  if (e !== 'liberada') return e;
  return voiceOn ? null : 'desligada';
}
