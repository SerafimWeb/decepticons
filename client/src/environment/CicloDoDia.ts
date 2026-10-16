/**
 * O CICLO DO DIA da PRAIA DOS CABOS (P161): a partida **começa no pôr do sol** (o sol vermelho, rente ao horizonte, a cidade ainda de dia) e, em
 * **cinco minutos**, o sol se põe, o céu escurece, a lua sobe e **as luzes da cidade acendem**. Pedido do Comandante (16/10): *"o cenário tá muito claro
 * pra hora do dia que o sol define; tem muita iluminação pública, isso deveria ser mais sutil (tá tudo aceso ainda de dia). O melhor seria que o cenário
 * começasse de dia e no final do tempo já estivesse de noite: começar com o sol bem vermelho, perto da linha do horizonte, e ao final dos 5 minutos o sol já
 * terminou de se pôr e já está mais escuro... aí as luzes acendem."*
 *
 * **Só dado puro** (sem Three, sem DOM, sem aleatório): `faseDoDia(progresso)` devolve os números do momento e quem desenha (`Praia.ts`) os aplica. Nada
 * aqui toca a simulação (G1/G2): é só a **luz** do cenário, calculada do relógio da partida; a mesma partida mostra o mesmo céu no mesmo segundo.
 *
 * **Custo de CPU:** um punhado de contas por quadro (10 números); nenhuma alocação. O resto é uniforme na GPU.
 */

/** A duração do dia em segundos de partida: a rodada (`ROUND_S`) e o tempo que o Comandante pediu. Depois disso a noite fica fechada. */
export const DURACAO_DO_DIA_S = 300;

/** A altura do sol (o componente vertical da direção do disco) no começo e no fim do dia: começa um palmo acima do horizonte e termina bem abaixo dele. */
export const SOL_ALTURA_INICIAL = 0.085;
export const SOL_ALTURA_FINAL = -0.24;
/** A altura da lua no começo e no fim: ela já está no céu e sobe devagar. */
export const LUA_ALTURA_INICIAL = 0.1;
export const LUA_ALTURA_FINAL = 0.42;

/** Tudo o que muda ao longo do dia (0 a 1 em cada intensidade). */
export interface FaseDoDia {
  /** A altura do disco do sol (+ acima do horizonte, - abaixo). */
  solAltura: number;
  /** A altura da lua. */
  luaAltura: number;
  /** 0 = pôr do sol; 1 = noite fechada (o céu, o mar e a névoa leem isto). */
  noite: number;
  /** O quanto da iluminação pública está acesa (0 = de dia, só um fio de brilho; 1 = tudo aceso). Cada poste liga num instante, ver `instanteDeLigar`. */
  lampadas: number;
  /** O quanto da luz do sol (direcional) ainda chega (0 a 1): cai a zero quando ele se põe. A luz do céu e a da lua seguem a `noite`. */
  luzDoSol: number;
}

const limitar = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
const misturar = (a: number, b: number, t: number): number => a + (b - a) * t;
/** O degrau suave de 0 (em `a`) a 1 (em `b`); funciona nos dois sentidos (a > b inverte). */
function degrau(a: number, b: number, v: number): number {
  const t = limitar((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** O progresso do dia (0 a 1) para `decorridoS` segundos de partida; valor torto (negativo, NaN, infinito) cai no começo, nunca quebra a luz. */
export function progressoDoDia(decorridoS: number, duracaoS = DURACAO_DO_DIA_S): number {
  if (!Number.isFinite(decorridoS) || !(duracaoS > 0)) return 0;
  return limitar(decorridoS / duracaoS, 0, 1);
}

/** Os relógios que a partida tem à mão; `progressoDaPartida` escolhe o que manda. */
export interface RelogiosDaPartida {
  /** O relógio da missão em ondas (`SurvivalWaves.missionElapsed`), quando há missão; senão `null`. */
  missaoS: number | null;
  /** A rodada com tempo (todos contra todos), quando há; `jogando = false` é o intervalo entre rodadas. Sem tempo (modos de objetivo, online), `null`. */
  rodada: { restanteS: number; duracaoS: number; jogando: boolean } | null;
  /** O relógio visual do mapa, contado desde que ele foi montado: o que sobra para a Captura da Bandeira, o Domínio e o online (que ainda não trazem o relógio do servidor). */
  visualS: number;
}

/**
 * O progresso do dia (0 a 1) de uma partida: **a missão manda** (as ondas), depois **a rodada** (os 5 minutos do todos contra todos; no intervalo, a noite fica
 * fechada até a rodada seguinte recomeçar o dia) e, sem nenhuma das duas, o relógio visual do mapa.
 */
export function progressoDaPartida(r: RelogiosDaPartida): number {
  if (r.missaoS !== null) return progressoDoDia(r.missaoS);
  if (r.rodada && Number.isFinite(r.rodada.restanteS)) return progressoDoDia(r.rodada.jogando ? r.rodada.duracaoS - r.rodada.restanteS : r.rodada.duracaoS, r.rodada.duracaoS);
  return progressoDoDia(r.visualS);
}

/**
 * O `?dia=` do link (0 a 1): **fixa a hora do dia** (0 = pôr do sol, 1 = noite fechada), para o Comandante ver qualquer momento sem esperar os 5 minutos e para a
 * bancada fotografar. Da mesma família do `?onda=`: não muda regra nenhuma. Sem o parâmetro, ou torto, devolve `null` (o relógio da partida manda).
 */
export function diaFromSearch(search: string): number | null {
  const bruto = new URLSearchParams(search).get('dia');
  if (bruto === null || bruto.trim() === '') return null;
  const valor = Number(bruto);
  return Number.isFinite(valor) ? limitar(valor, 0, 1) : null;
}

/** A fase do dia para o `progresso` (0 = começo da partida, 1 = fim dos cinco minutos). Contínua e monótona: nada pula entre dois quadros. */
export function faseDoDia(progresso: number): FaseDoDia {
  const p = limitar(Number.isFinite(progresso) ? progresso : 0, 0, 1);
  const solAltura = misturar(SOL_ALTURA_INICIAL, SOL_ALTURA_FINAL, p);
  const luaAltura = misturar(LUA_ALTURA_INICIAL, LUA_ALTURA_FINAL, p);
  // A noite começa quando o disco encosta no mar e fecha quando ele já está bem abaixo (o crepúsculo é o meio do caminho).
  const noite = degrau(0.02, -0.17, solAltura);
  // As luzes acendem **depois** do pôr do sol e de forma escalonada (cada uma no seu instante, `instanteDeLigar`): de dia ficam num fio de brilho.
  const lampadas = degrau(0.36, 0.78, p);
  return {
    solAltura,
    luaAltura,
    noite,
    lampadas,
    luzDoSol: degrau(-0.04, 0.1, solAltura),
  };
}

/**
 * O instante (0 a 1, na escala de `lampadas`) em que **uma** lâmpada liga, escolhido pela fase dela (o mesmo número que o halo já leva): a cidade acende
 * aos poucos, poste por poste, em vez de tudo de uma vez. Devolve um valor entre 0,05 e 0,9; a lâmpada está acesa quando `lampadas >= instante`.
 */
export function instanteDeLigar(fase: number): number {
  const s = Math.sin(fase * 12.9898) * 43758.5453;
  return 0.05 + 0.85 * (s - Math.floor(s));
}
