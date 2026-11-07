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
  { id: 'fase:chefes-janeiro', grupo: 'fases', nome: 'Trampado e Evil · 8 de Janeiro', padrao: 'restrito', efeito: 'o encontro dos dois chefes da missão offline' },
  { id: 'arma:cacetete-poder', grupo: 'armas', nome: 'Cacetete de poder · prêmio do Evil', padrao: 'restrito', efeito: 'o golpe F conquistado na missão do 8 de Janeiro' },
  // P305: a cor do casco. Nasceu RESTRITA (regra P191); liberada ao público em 02/11 (P308), depois de o Colossus pintar o casco inteiro (P306).
  { id: 'robo:pintura', grupo: 'robos', nome: 'Cor do casco · compra com Créditos', padrao: 'publico', efeito: 'a cor do Mech: comprada no Hangar com Créditos e vista pelos outros pilotos online' },
  // P309 (02/11): o clipe dos últimos 10 s em vertical. Nasce público por ordem do Comandante ("sim liberado"); opt-in (L liga, K salva) e custa CPU só ligado.
  { id: 'clip:gravar', grupo: 'telas', nome: 'Clipe dos últimos 10 s (vertical)', padrao: 'publico', efeito: 'tecla L liga o buffer dos últimos 10 s em 9:16, K salva o trecho como arquivo (usa CPU enquanto ligado)' },
  // P310 (02/11): o modo streamer, ?stream=1: a sala AO-VIVO de código fixo, a faixa AO VIVO e o clipe ligado ao começar. Nasce público por ordem do Comandante; restrito, o link cai no jogo de sempre.
  { id: 'modo:streamer', grupo: 'modos', nome: 'Modo streamer · sala AO VIVO e clipe ligado', padrao: 'publico', efeito: 'o link ?stream=1 deixa de levar à sala AO-VIVO: o jogo abre como de costume, sem a faixa AO VIVO e sem o clipe ligado' },
  // P314 (02/11): a missão de combate (caça, destruição e aniquilação), ?modo=missao. Nasce RESTRITA (P191): o Comandante a libera em VISIBILIDADE quando o jogo estiver pronto.
  { id: 'modo:missao', grupo: 'modos', nome: 'Missão de combate (caça, destruição e aniquilação)', padrao: 'restrito', efeito: 'o botão MISSÃO some do seletor de modo, e o link ?modo=missao cai no Deathmatch' },
  // P269: o cérebro do time dos bots (pinça e reagrupar). Nasce RESTRITO: a bancada bot × bot não mostrou ganho de força (45% / 38% / 45% de vitória, 40 duelos por dificuldade), então o Comandante julga jogando e libera aqui. Também é o interruptor de segurança: restrito devolve os bots ao comportamento de antes, tick a tick (esquadraoPadrao.test.ts).
  { id: 'ia:time', grupo: 'modos', nome: 'IA de time dos bots (pinça e reagrupar)', padrao: 'restrito', efeito: 'os bots deixam de combinar pinça e reagrupamento e lutam como antes (o diretor de ataque e o rádio de contato continuam)' },
  // P282: a fase escura e a visão noturna. Nasce RESTRITA: o Comandante julga jogando (chip FASE ESCURA) e libera aqui. Restrita, o quadro de luz apagado só baixa as luzes da cidade, como antes.
  { id: 'modo:fase-escura', grupo: 'modos', nome: 'Fase escura e visão noturna (Cidade Neon)', padrao: 'restrito', efeito: 'o apagão do quadro de luz deixa de escurecer a cena e de cortar a visão dos robôs sem visão noturna: a cidade só baixa as luzes, como antes' },
  { id: 'mapa:arena', grupo: 'fases', nome: 'Cidade Neon (Arena)', padrao: 'publico', efeito: 'o pino vira EM BREVE no mapa-múndi e o link cai na Cidade Neon' },
  { id: 'mapa:bunker', grupo: 'fases', nome: 'Bunker', padrao: 'restrito', efeito: 'o pino vira EM BREVE no mapa-múndi, some das campanhas e o link cai na Cidade Neon' },
  { id: 'mapa:praia', grupo: 'fases', nome: 'Estação dos Cabos (Praia)', padrao: 'publico', efeito: 'o pino vira EM BREVE no mapa-múndi, some das campanhas e o link cai na Cidade Neon' },
  { id: 'mapa:janeiro', grupo: 'fases', nome: '8 DE JANEIRO (Praça dos Três Poderes)', padrao: 'publico', efeito: 'o pino vira EM BREVE no mapa-múndi, some das campanhas e o link cai na Cidade Neon' },
  { id: 'mapa:amazonia', grupo: 'fases', nome: 'Amazônia · Terras Raras', padrao: 'restrito', efeito: 'o pino vira EM BREVE no mapa-múndi, some das campanhas e o link cai na Cidade Neon' },
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
  { id: 'tela:voz', grupo: 'telas', nome: 'Chat de voz (online)', padrao: 'restrito', efeito: 'a seção CHAT DE VOZ das Configurações e a voz na sala online (some junto o pedido de microfone)' },
  { id: 'tela:chat', grupo: 'telas', nome: 'Pilotos da REDE: ver o Hangar do outro e conversar por texto (online)', padrao: 'restrito', efeito: 'a lista de pilotos no monitor REDE, a visita ao Hangar de outro piloto e o chat de texto (some junto o aviso de mensagem)' },
  { id: 'tela:lado', grupo: 'telas', nome: 'Seletor de lado (Aliança ou Consórcio)', padrao: 'restrito', efeito: 'o chip ESCOLHA O LADO' },
  { id: 'tela:relatorio', grupo: 'telas', nome: 'Relatório de Consequências', padrao: 'publico', efeito: 'o chip RELATÓRIO depois da missão' },
  // P317 (06/11): a moldura do cockpit da câmera em 1ª pessoa (obra do Gemini, concluída e medida). Nasce RESTRITA (P191): o Comandante julga jogando (?comandante=1) e libera aqui. A restrição é por função (`ui/moldaDoCockpit.ts`), não por `data-func`: o selo TESTE colidiria com o ::after da moldura.
  { id: 'tela:cockpit', grupo: 'telas', nome: 'Moldura do cockpit (câmera em primeira pessoa)', padrao: 'restrito', efeito: 'a câmera em primeira pessoa fica sem a moldura metálica do visor' },
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
