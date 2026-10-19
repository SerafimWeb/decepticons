import { t } from '../i18n/i18n';
import type { OnlineStatus } from '../net/OnlineSession';

/**
 * O que a tela diz quando o servidor reinicia ou a conexão cai (P204; dono, 18/10: *"será que temos que adicionar uma imagem dizendo que
 * estamos reiniciando o servidor ou em manutenção, com previsão de retorno, atualizada sozinha, com um contador na tela?"*). Sem DOM: o
 * estado da conexão e o relógio entram, o texto sai (o painel `ConnectionNotice` só desenha), então dá para testar cada frase.
 *
 * Quatro situações, da mais avisada à menos:
 * - **`aviso`**: o servidor avisou que vai reiniciar e ainda corta em N segundos (a conexão segue de pé);
 * - **`espera`**: o reinício avisado já cortou; há previsão de volta e o contador desce;
 * - **`queda`**: caiu sem aviso (o PC, a internet, o túnel): sem previsão, o contador sobe ("fora há");
 * - **`fim`**: a insistência acabou (10 minutos); só resta recarregar.
 * Passou da previsão de um reinício avisado, vira "demorando mais que o previsto" (ainda `espera`) e passa a contar o tempo fora.
 */
export interface AvisoDeConexao {
  tom: 'aviso' | 'espera' | 'queda' | 'fim';
  titulo: string;
  linha: string;
  rotulo: string | null;
  /** `m:ss`. */
  contador: string | null;
  /** Mostra o botão de jogar offline enquanto o servidor não volta. */
  podeJogarOffline: boolean;
}

/** Depois de quanto tempo fora, sem previsão, o aviso oferece o jogo offline (antes disso é só um soluço). */
export const OFFLINE_DEPOIS_DE_MS = 30_000;
/** Até quando a frase de queda é só "tentando reconectar". */
const SO_RECONECTANDO_ATE_MS = 20_000;

/** Contagem regressiva: arredonda para cima (o último segundo mostra 0:01, nunca 0:00 antes da hora). */
export function relogioRegressivo(ms: number): string {
  return relogio(Math.max(0, Math.ceil(ms / 1000)));
}

/** Tempo decorrido: arredonda para baixo. */
export function relogioProgressivo(ms: number): string {
  return relogio(Math.max(0, Math.floor(ms / 1000)));
}

function relogio(totalS: number): string {
  return `${Math.floor(totalS / 60)}:${String(totalS % 60).padStart(2, '0')}`;
}

export function textoDoAviso(s: OnlineStatus, agora: number): AvisoDeConexao | null {
  if (s.state === 'na sala' && s.aviso) {
    return {
      tom: 'aviso',
      titulo: t('ATUALIZAÇÃO DO SERVIDOR'),
      linha: t('Termine o que estiver fazendo: o servidor volta em cerca de {0} min e você reconecta sozinho.', Math.max(1, Math.ceil(s.aviso.voltaEmS / 60))),
      rotulo: t('CORTE EM'),
      contador: relogioRegressivo(s.aviso.cortaEm - agora),
      podeJogarOffline: false,
    };
  }
  if (!s.queda) return null;
  const fora = agora - s.queda.desde;
  if (s.state === 'caiu') {
    return { tom: 'fim', titulo: t('SEM CONEXÃO COM O SERVIDOR'), linha: t('Não conseguimos reconectar a tempo. Recarregue a página para tentar de novo.'), rotulo: null, contador: null, podeJogarOffline: true };
  }
  if (s.state !== 'reconectando') return null;
  if (s.queda.previsto !== null) {
    const falta = s.queda.previsto - agora;
    return falta > 0
      ? { tom: 'espera', titulo: t('SERVIDOR REINICIANDO'), linha: t('Atualização em andamento. Você volta para a partida sozinho assim que ele responder.'), rotulo: t('VOLTA EM ~'), contador: relogioRegressivo(falta), podeJogarOffline: false }
      : { tom: 'espera', titulo: t('DEMORANDO MAIS QUE O PREVISTO'), linha: t('O servidor ainda não voltou. Continuamos tentando a cada 5 segundos, sem você precisar fazer nada.'), rotulo: t('FORA HÁ'), contador: relogioProgressivo(fora), podeJogarOffline: fora >= OFFLINE_DEPOIS_DE_MS };
  }
  return {
    tom: 'queda',
    titulo: t('CONEXÃO PERDIDA'),
    linha: fora < SO_RECONECTANDO_ATE_MS ? t('Tentando reconectar…') : t('O servidor pode estar reiniciando ou fora do ar, sem previsão de volta. Continuamos tentando.'),
    rotulo: t('FORA HÁ'),
    contador: relogioProgressivo(fora),
    podeJogarOffline: fora >= OFFLINE_DEPOIS_DE_MS,
  };
}
