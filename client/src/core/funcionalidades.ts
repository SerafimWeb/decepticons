import { weapon, WEAPON_IDS } from '../combat/weapons';
import { CHASSIS, type ChassisId } from '../entities/chassis';
import type { EstadoDeVisibilidade } from '../../../shared/visibilidade';

/**
 * O CATÁLOGO DE FUNCIONALIDADES (P191, `PAINEL_ADMIN.md` § 6): tudo o que o Comandante pode **liberar para os jogadores ou segurar em teste**. Cada uma tem um id (`grupo:nome`), o grupo em que o
 * painel a lista, o nome e o **padrão**: o que vale enquanto ele não mexer no painel. **Regra para todo agente: funcionalidade nova entra aqui como `restrito`** e o Comandante a libera quando estiver
 * pronta (o botão LADO, o ARQUIVO e o RELATÓRIO são os primeiros). O servidor guarda só as exceções ao padrão; o jogo junta os dois (`core/Visibilidade.ts`).
 */
export type GrupoDeFuncionalidade = 'fases' | 'modos' | 'telas' | 'robos' | 'armas';

export interface Funcionalidade {
  readonly id: string;
  readonly grupo: GrupoDeFuncionalidade;
  readonly nome: string;
  readonly padrao: EstadoDeVisibilidade;
  /** Uma linha para o painel: o que some do jogo quando está restrita. */
  readonly efeito?: string;
}

export const NOME_DO_GRUPO: Readonly<Record<GrupoDeFuncionalidade, string>> = {
  fases: 'FASES E MAPAS',
  modos: 'MODOS DE JOGO',
  telas: 'BOTÕES E TELAS',
  robos: 'ROBÔS (CHASSIS)',
  armas: 'ARMAS',
};

const fixas: readonly Funcionalidade[] = [
  { id: 'mapa:arena', grupo: 'fases', nome: 'Cidade Neon (Arena)', padrao: 'publico', efeito: 'o pino no mapa-múndi e a entrada por link' },
  { id: 'mapa:bunker', grupo: 'fases', nome: 'Bunker', padrao: 'publico', efeito: 'o pino no mapa-múndi e a entrada por link' },
  { id: 'mapa:praia', grupo: 'fases', nome: 'Praia dos Cabos', padrao: 'publico', efeito: 'o pino no mapa-múndi e a entrada por link' },
  { id: 'mapa:amazonia', grupo: 'fases', nome: 'Amazônia · Terras Raras', padrao: 'publico', efeito: 'o pino no mapa-múndi e a entrada por link' },
  { id: 'modo:deathmatch', grupo: 'modos', nome: 'Deathmatch', padrao: 'publico', efeito: 'o botão do modo' },
  { id: 'modo:survival', grupo: 'modos', nome: 'Sobrevivência (missões)', padrao: 'publico', efeito: 'o botão do modo' },
  { id: 'modo:ctf', grupo: 'modos', nome: 'Bandeira', padrao: 'publico', efeito: 'o botão do modo' },
  { id: 'modo:dominio', grupo: 'modos', nome: 'Domínio', padrao: 'publico', efeito: 'o botão do modo' },
  { id: 'tela:hangar', grupo: 'telas', nome: 'Hangar', padrao: 'publico', efeito: 'o botão HANGAR' },
  { id: 'tela:esquadrao', grupo: 'telas', nome: 'Esquadrão', padrao: 'publico', efeito: 'o botão ESQUADRÃO' },
  { id: 'tela:multi', grupo: 'telas', nome: 'MULTI (online)', padrao: 'publico', efeito: 'o botão MULTI da primeira tela' },
  { id: 'tela:cftv', grupo: 'telas', nome: 'Câmeras do local', padrao: 'publico', efeito: 'o botão CÂMERAS' },
  { id: 'tela:conta', grupo: 'telas', nome: 'Conta (entrar e criar)', padrao: 'publico', efeito: 'o botão CONTA' },
  { id: 'tela:arquivo', grupo: 'telas', nome: 'Arquivo (o que o jogo ensina)', padrao: 'restrito', efeito: 'o chip ARQUIVO' },
  { id: 'tela:lado', grupo: 'telas', nome: 'Seletor de lado (Aliança ou Consórcio)', padrao: 'restrito', efeito: 'o chip ESCOLHA O LADO' },
  { id: 'tela:relatorio', grupo: 'telas', nome: 'Relatório de Consequências', padrao: 'restrito', efeito: 'o chip RELATÓRIO depois da missão' },
];

/** Os robôs e as armas vêm dos dados do jogo: robô ou arma nova aparece no painel sozinha, **já pública** (o padrão de hoje); o Comandante a restringe se quiser. */
const robos: Funcionalidade[] = (Object.keys(CHASSIS) as ChassisId[]).map((id) => ({ id: `chassi:${id.toLowerCase()}`, grupo: 'robos', nome: CHASSIS[id].name, padrao: 'publico', efeito: 'a ficha no Hangar (o que já está montado fica)' }));
const armas: Funcionalidade[] = WEAPON_IDS.map((id) => ({ id: `arma:${id}`, grupo: 'armas', nome: weapon(id).name, padrao: 'publico', efeito: 'a opção nas listas do Hangar (a que já está montada fica)' }));

export const FUNCIONALIDADES: readonly Funcionalidade[] = [...fixas, ...robos, ...armas];

const porId = new Map(FUNCIONALIDADES.map((f) => [f.id, f]));

/** O padrão do código para um id (`publico` para o que o catálogo não conhece: o que nunca foi catalogado não some do jogo). */
export function padraoDe(id: string): EstadoDeVisibilidade {
  return porId.get(id)?.padrao ?? 'publico';
}

export const conhece = (id: string): boolean => porId.has(id);
