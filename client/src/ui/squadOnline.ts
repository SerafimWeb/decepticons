import { DIFICULDADES_ONLINE, LIMITES_DAS_REGRAS, type RegrasOnline } from '../../../shared/regras';
import type { Difficulty } from '../core/Settings';
import type { AdminCliente, MotivoDeFalha, Resposta } from '../net/admin';
import type { EsquadraoSpec } from '../sim/esquadrao';
import { esquadraoDasRegras, type RespostaDoEsquadrao } from '../sim/esquadraoOnline';

/**
 * A janela ESQUADRÃO falando com o servidor (P270): o Comandante monta o esquadrão das salas online e o servidor o guarda (`server/esquadraoOnline.ts`). Sem DOM (G3): a janela só chama
 * `carregar` e `gravar`, e aqui se junta o que são duas coisas do servidor, o esquadrão (`/admin/esquadrao`) e a **pressão** (quantos atacam ao mesmo tempo, que mora nas regras, `/admin/regras`),
 * para a janela mostrar uma coisa só. A chave do dono é a de sempre (a da janela SERVIDOR); nunca lança: toda falha vira um texto em português.
 */

/** O que a janela precisa saber do servidor para se montar. */
export interface SquadOnlineEstado {
  /** O esquadrão que valeria numa sala nova agora (o salvo, ou o que as regras montam). */
  esquadrao: EsquadraoSpec;
  /** `false` = ainda valem as regras do servidor: nenhum esquadrão foi salvo. */
  salvo: boolean;
  /** Quantos atacam ao mesmo tempo, nas regras da sala. */
  atacantes: number;
  /** A dificuldade das salas (cada robô pode ter a sua). */
  dificuldade: Difficulty;
  /** O que as regras montam sem esquadrão salvo: o preset PADRÃO da janela e o "voltar às regras". */
  padrao: EsquadraoSpec;
}

export type SquadOnlineResposta = { ok: true; estado: SquadOnlineEstado } | { ok: false; motivo: string };

export interface SquadOnline {
  carregar(): Promise<SquadOnlineResposta>;
  /** Grava o esquadrão (`null` = voltar às regras) e a pressão; devolve o estado que vale depois. */
  gravar(esquadrao: EsquadraoSpec | null, atacantes: number): Promise<SquadOnlineResposta>;
}

/** Só o que a janela usa do cliente do painel do servidor (os testes passam um de mentira). */
export type ClienteDoEsquadrao = Pick<AdminCliente, 'esquadrao' | 'gravarEsquadrao' | 'regras' | 'gravarRegras'>;

const MOTIVO: Readonly<Record<MotivoDeFalha, string>> = {
  'sem-servidor': 'Este build não sabe onde está o servidor de jogo.',
  'sem-token': 'Falta a chave do dono: abra SERVIDOR no console e cole o token (ou entre na conta de administrador).',
  token: 'O servidor recusou a chave do dono.',
  bloqueado: 'Erros demais de chave: espere uns minutos.',
  'fora-do-ar': 'O servidor não respondeu.',
  resposta: 'O servidor respondeu algo que não entendi (talvez seja uma versão antiga, sem o esquadrão das salas).',
  recusado: 'O servidor recusou.',
};

const falha = (r: Extract<Resposta<unknown>, { ok: false }>): SquadOnlineResposta => ({ ok: false, motivo: MOTIVO[r.motivo] });

/** A dificuldade das regras do servidor é a mesma palavra da dos bots do jogo. */
const dificuldadeDe = (r: RegrasOnline): Difficulty => (DIFICULDADES_ONLINE.includes(r.dificuldade) ? r.dificuldade : 'facil');

const junta = (e: RespostaDoEsquadrao, r: RegrasOnline): SquadOnlineResposta => ({
  ok: true,
  estado: { esquadrao: e.esquadrao, salvo: e.salvo, atacantes: r.atacantes, dificuldade: dificuldadeDe(r), padrao: esquadraoDasRegras(r) },
});

export function criarSquadOnline(cliente: ClienteDoEsquadrao): SquadOnline {
  const carregar = async (): Promise<SquadOnlineResposta> => {
    const [e, r] = await Promise.all([cliente.esquadrao(), cliente.regras()]);
    if (!e.ok) return falha(e);
    if (!r.ok) return falha(r);
    return junta(e.dados, r.dados);
  };
  return {
    carregar,
    async gravar(esquadrao, atacantes) {
      const regras = await cliente.regras();
      if (!regras.ok) return falha(regras);
      // A pressão só vai ao servidor se mudou (e dentro do que as regras aceitam): o servidor puxa para os limites, mas a janela não precisa pedir o impossível.
      const L = LIMITES_DAS_REGRAS.atacantes;
      const pedida = Math.max(L.min, Math.min(L.max, atacantes));
      if (pedida !== regras.dados.atacantes) {
        const g = await cliente.gravarRegras({ ...regras.dados, atacantes: pedida });
        if (!g.ok) return falha(g);
      }
      const gravou = await cliente.gravarEsquadrao(esquadrao);
      if (!gravou.ok) return falha(gravou);
      // As regras de depois de gravar (a pressão pode ter sido puxada para o limite): relê, para a janela mostrar o que vale de verdade.
      const depois = await cliente.regras();
      return depois.ok ? junta(gravou.dados, depois.dados) : junta(gravou.dados, regras.dados);
    },
  };
}
