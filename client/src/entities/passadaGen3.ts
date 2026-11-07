/**
 * A passada da geração 3 (P321): o pé **plantado** no chão, sem senoide. Função pura, sem Three nem DOM (G14), sem alocação:
 * quem chama passa o `out` e reaproveita. O desenho (`MechBase.animate`) só lê o resultado.
 *
 * Convenção do rig (`MECHS_IMPORTADOS.md`): quadril positivo leva o pé para a frente (-Z); joelho negativo dobra o pé para trás.
 * No plano da passada, `f` é a frente do pé em relação ao quadril (m) e `d` é a profundidade do quadril até o pé (m, para baixo).
 *
 * Por que a altura da pelve é um mínimo: um pé de apoio só alcança o chão se a perna não passar do comprimento máximo
 * (`ue + w`). Quanto mais o pé se afasta do quadril, mais baixo o quadril tem de ficar. O mínimo dos limites dos dois pés é
 * contínuo, então a pelve não dá degrau no pouso nem na decolagem.
 *
 * **O tornozelo (P322):** a perna termina no tornozelo, e o pé gira nele (`MechRig.setFootPitch`). No apoio o pé fica plano no chão, qualquer que seja a
 * inclinação da canela; no balanço ele desce a ponta ao sair do chão e a sobe antes de pisar. Com o pé rígido (a geração 3 de antes) a perna encurtava a
 * cada passo inclinado para o calcanhar e a ponta não furarem o piso, e o joelho dobrava 70° no apoio: o robô andava agachado (Comandante, 07/11).
 */

/** Medidas de uma perna no plano da passada, lidas do próprio rig (procedural ou importado). */
export interface GeometriaDaPerna {
  /** Quadril até o eixo do joelho (m). */
  readonly ue: number;
  /** Ângulo do eixo do joelho em relação à vertical (rad). É zero nos Mechs cujo joelho não é deslocado (o digitígrado). */
  readonly eps: number;
  /** Joelho até o eixo do tornozelo, na vertical (m). */
  readonly w: number;
  /** Frente do pé em repouso, em relação ao quadril (m). */
  readonly f0: number;
  /** Profundidade do quadril até o eixo do tornozelo em repouso (m). É igual a `uv + w`; com o pé plano, o tornozelo está a `tornozelo` do chão. */
  readonly dRest: number;
  /** Do eixo do tornozelo até a ponta do pé (m): o pé inclinado do balanço tem a ponta tão mais baixa quanto maior ele é. */
  readonly peFrente: number;
  /** Do eixo do tornozelo até o calcanhar (m). Menor que `peFrente` quando o pé está deslocado para a frente, como nos blueprints (12% do comprimento). */
  readonly peTras: number;
  /** Do eixo do tornozelo até a sola (m): a altura do tornozelo sobre o chão com o pé plano. */
  readonly tornozelo: number;
}

export interface Juntas {
  /** Rotação do quadril (rad, eixo X do rig). */
  hip: number;
  /** Rotação do joelho em relação à coxa (rad, eixo X do rig; negativo dobra para trás). */
  knee: number;
}

/** Os números da passada de um chassi, todos em metros ou fração do ciclo. */
export interface ParametrosDaPassada {
  /** Fração do ciclo com o pé no chão (0,6: o pé apoia 60% do tempo e balança 40%). */
  readonly fracaoDeApoio: number;
  /** Meio-curso do pé para a frente e para trás do repouso (m). Vem do chassi e do limite de alcance da perna. */
  readonly alcance: number;
  /** Altura máxima do pé no balanço (m). */
  readonly altura: number;
  /** Quanto o quadril agacha ao andar, em relação ao repouso (m). Em repouso não agacha. */
  readonly agachamento: number;
  /** Quanto o quadril sobe e desce a cada passo (m): a amplitude do molejo do andar. */
  readonly bob: number;
  /** Teto da cadência: ciclos por segundo de cada perna. Acima dele, a fase para de acompanhar a velocidade e o pé escorrega um pouco. */
  readonly ciclosMax: number;
  /** A cadência de quem mal anda, em fração do teto: ela cresce com a velocidade até o teto (`passoNaVelocidade`). */
  readonly cadenciaLenta: number;
}

export interface PoseDaPassada {
  hipL: number;
  kneeL: number;
  hipR: number;
  kneeR: number;
  /** Profundidade do quadril até o plano do tornozelo nesta pose (m). `dPelvis - geo.dRest` é o quanto a pelve desce em relação ao repouso. */
  dPelvis: number;
  /** A inclinação do pé esquerdo e do direito em relação ao CHÃO (rad; positivo levanta a ponta): zero no apoio. Quem desenha a converte para o ângulo relativo à canela. */
  phiL: number;
  phiR: number;
}

const TAU = Math.PI * 2;
/** Fração do ciclo com o pé no chão: 60%, a marcha de passo (e não de salto). */
const FRACAO_DE_APOIO = 0.6;
/** Altura do pé no balanço, em fração do alcance total: 12%. */
const ALTURA_DO_PASSO_FRAC = 0.12;
/** Quanto a ponta desce logo depois de o pé sair do chão, e sobe antes de pisar (rad, 12°): o pé chega plano ao apoio. */
const INCLINACAO_DO_PE = 0.21;
/**
 * Até quanto do comprimento a perna de apoio estica (99%): ela nunca fica exatamente reta, e o joelho dobra pelo menos 16°. Reta, a conta de duas barras tem
 * uma quina (o joelho cresce com a raiz da altura que o pé sobe), e o joelho dava um tranco a cada decolagem e a cada pouso.
 */
export const PERNA_MAXIMA = 0.99;

/** O que o gosto muda na passada (o resto é geometria da perna). Os valores de verdade moram em `movimentoGen3.json` (`movimentoGen3.ts`). */
export interface AjustesDaPassada {
  /**
   * Teto da cadência, em ciclos por segundo de cada perna (1,6: 3,2 passos por segundo no total). Com o pé plantado a 9 m/s o Vector-09 daria 3,8
   * passos por segundo, nervoso demais para um robô de 5 m; acima do teto o pé escorrega um pouco (a geração 2 escorregava mais da metade da velocidade do corpo).
   */
  readonly ciclosMax: number;
  /**
   * O agachamento do joelho no topo da velocidade, em fração do alcance total da perna (`ue + w`): 1,5% (um joelho dobrado ~20° no meio do apoio, como
   * o de quem anda). Cresce com a velocidade (de marcha o robô anda de pé). Era 10% fixo, a toda velocidade, e o robô andava agachado (Comandante, 07/11).
   */
  readonly agachamento: number;
  /**
   * Amplitude do molejo a cada passo, em fração do alcance total, no passo mais longo: 7% (no Vector-09, 0,17 m). É o quanto o quadril desce quando o pé mais
   * longe pisa e define o passo mais longo: cresce com o quadrado do passo, então de marcha quase não balança.
   */
  readonly molejoDoPasso: number;
  /** A cadência de marcha, em fração do teto (0,5: de marcha o robô dá a metade dos passos do teto; a passada acelera até ele na velocidade de topo). */
  readonly cadenciaLenta: number;
}

export const PASSADA_PADRAO: AjustesDaPassada = { ciclosMax: 1.6, agachamento: 0.015, molejoDoPasso: 0.07, cadenciaLenta: 0.5 };
const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);
const clampCos = (x: number): number => (x < -1 ? -1 : x > 1 ? 1 : x);

/**
 * Os parâmetros da passada de uma perna. O alcance é o menor entre o do chassi (o seno do ângulo do quadril, como a passada
 * antiga) e o que a perna alcança sem o quadril afundar mais que `bob`. Com o alcance no limite, o pé mais longe ainda toca o chão.
 */
export function parametrosDaPassada(geo: GeometriaDaPerna, anguloDoQuadril: number, ajustes: AjustesDaPassada = PASSADA_PADRAO): ParametrosDaPassada {
  const rMax = geo.ue + geo.w;
  const agachamento = ajustes.agachamento * rMax;
  const bob = ajustes.molejoDoPasso * rMax;
  // A pelve mais baixa do andar: quando o pé mais longe (para a frente, com o deslocamento `f0`) está com a perna esticada.
  const dAndar = geo.dRest - agachamento - bob;
  const aPeloLimite = Math.sqrt(Math.max(0, (PERNA_MAXIMA * rMax) ** 2 - dAndar * dAndar)) - Math.abs(geo.f0);
  const aPeloChassi = rMax * Math.sin(clamp(anguloDoQuadril, 0.05, 1.2));
  return {
    fracaoDeApoio: FRACAO_DE_APOIO,
    alcance: Math.max(0, Math.min(aPeloChassi, aPeloLimite)),
    altura: ALTURA_DO_PASSO_FRAC * rMax,
    agachamento,
    bob,
    ciclosMax: ajustes.ciclosMax,
    cadenciaLenta: ajustes.cadenciaLenta,
  };
}

/** A passada com os campos graváveis: o `Estado3` de cada Mech guarda uma e a reescreve a cada quadro (G4: sem alocar). */
export type PassadaMutavel = { -readonly [K in keyof ParametrosDaPassada]: ParametrosDaPassada[K] };

/**
 * A passada na velocidade `v` (m/s) de um chassi com velocidade de topo `vTopo` (m/s): o passo, a altura do pé, o agachamento e o molejo
 * **crescem com a velocidade**. De marcha o robô anda de pé, com o joelho quase esticado; só na corrida o quadril desce e o passo estica.
 * `base` é a passada do topo da velocidade (`parametrosDaPassada`) e `saida` recebe a desta velocidade (sem alocar).
 *
 * O meio-curso do pé que o planta, numa cadência natural `c` (de `cadenciaLenta` a 1 vezes o teto `ciclosMax`, com a velocidade), é
 * `fracaoDeApoio·v / (2c)`, até o alcance máximo da base; acima dele o pé escorrega um pouco (`fasePorSegundo` limita a cadência).
 * Antes (P321) o passo era sempre o máximo e o quadril ficava 12,5% abaixo do repouso a partir de metade da velocidade, em todo chassi.
 */
export function passoNaVelocidade(base: ParametrosDaPassada, v: number, vTopo: number, saida: PassadaMutavel): PassadaMutavel {
  const s = vTopo > 0 ? clamp(v / vTopo, 0, 1) : 1;
  const cadencia = base.ciclosMax * (base.cadenciaLenta + (1 - base.cadenciaLenta) * s);
  const necessario = (base.fracaoDeApoio * Math.max(0, v)) / (2 * Math.max(1e-6, cadencia));
  const alcance = Math.min(base.alcance, necessario);
  // O pé só sobe o quanto o passo pede: sem passo, sem balanço (o pé não fica pendurado no ar quando o robô para com a fase parada).
  const passo = base.alcance > 0 ? alcance / base.alcance : 0;
  saida.fracaoDeApoio = base.fracaoDeApoio;
  saida.ciclosMax = base.ciclosMax;
  saida.cadenciaLenta = base.cadenciaLenta;
  saida.alcance = alcance;
  saida.altura = base.altura * Math.sqrt(passo);
  saida.agachamento = base.agachamento * s;
  // O molejo é o quanto o quadril desce com o passo (a perna inclinada): cresce com o quadrado do passo, e o pé mais longe toca o chão sem puxar a pelve.
  saida.bob = base.bob * passo * passo;
  return saida;
}

/**
 * Cinemática inversa de duas barras no plano da passada: a coxa (`geo.ue`) e a canela (`geo.w`) levam o quadril até o pé em
 * (`f`, `d`). Fora do alcance, o pé para no limite (sem NaN). Sem alocação.
 */
export function juntasDaPerna(geo: GeometriaDaPerna, f: number, d: number, out: Juntas): Juntas {
  const ue = geo.ue;
  const w = geo.w;
  const r0 = Math.hypot(f, d);
  // Sem folga no limite: a perna esticada tem de dar junta zero. `clampCos` já cobre o arredondamento que passa de ±1.
  const rMax = ue + w;
  const rMin = Math.max(1e-6, Math.abs(ue - w));
  const r = clamp(r0, rMin, rMax);
  const phi = Math.atan2(f, d);
  // O eixo do joelho pode estar deslocado (digitígrado): a coxa efetiva vai do quadril ao eixo, com ângulo `eps`.
  const cosA = clampCos((ue * ue + r * r - w * w) / (2 * ue * r));
  const cosB = clampCos((w * w + r * r - ue * ue) / (2 * w * r));
  const a1 = phi + Math.acos(cosA);
  const shin = phi - Math.acos(cosB);
  out.hip = a1 - geo.eps;
  out.knee = shin - out.hip;
  return out;
}

/** Frente e profundidade do pé pela cinemática direta (o inverso de `juntasDaPerna`; usado nos testes). */
export function peDaPerna(geo: GeometriaDaPerna, j: Juntas, out: { f: number; d: number }): { f: number; d: number } {
  const a1 = j.hip + geo.eps;
  const shin = j.hip + j.knee;
  out.f = geo.ue * Math.sin(a1) + geo.w * Math.sin(shin);
  out.d = geo.ue * Math.cos(a1) + geo.w * Math.cos(shin);
  return out;
}

/** Taxa da fase (rad por metro andado) que deixa o pé plantado: `π·fracaoDeApoio / alcance`. Multiplicada pela velocidade, dá a fase por segundo. */
export function taxaDaFase(p: ParametrosDaPassada): number {
  return p.alcance > 0 ? (Math.PI * p.fracaoDeApoio) / p.alcance : 0;
}

/** Quanto a fase avança por segundo (rad/s) à velocidade `velocidade` (m/s): a taxa do pé plantado, até o teto da cadência. */
export function fasePorSegundo(p: ParametrosDaPassada, velocidade: number): number {
  return Math.min(taxaDaFase(p) * velocidade, p.ciclosMax * TAU);
}

/** Frente, altura e andamento de um pé no ciclo (`p` = fração 0..1 do ciclo). Apoio: o pé anda de +alcance a -alcance. Balanço: sobe e desce até o outro lado; `balanco` vai de 0 a 1 nele (-1 no apoio). */
function passoDoPe(p: number, fracao: number, alcance: number, altura: number, out: { f: number; lift: number; balanco: number }): void {
  if (p < fracao) {
    const s = p / fracao;
    out.f = alcance * (1 - 2 * s);
    out.lift = 0;
    out.balanco = -1;
  } else {
    const s = (p - fracao) / (1 - fracao);
    out.f = -alcance * Math.cos(Math.PI * s);
    out.lift = altura * Math.sin(Math.PI * s);
    out.balanco = s;
  }
}

/** A inclinação do pé em relação ao chão (rad) no balanço: a ponta desce e depois sobe, e o pé começa e termina plano. No apoio, plano. */
const inclinacaoDoPe = (balanco: number): number => (balanco < 0 ? 0 : -INCLINACAO_DO_PE * Math.sin(TAU * balanco));

/** Quanto o eixo do tornozelo sobe a mais, em relação ao pé plano, para a ponta (ou o calcanhar) do pé inclinado de `phi` não furar o chão. Zero com o pé plano. */
function sobeDoPe(geo: GeometriaDaPerna, phi: number): number {
  const s = Math.sin(phi);
  return geo.tornozelo * (Math.cos(phi) - 1) + (s < 0 ? geo.peFrente : geo.peTras) * Math.abs(s);
}

const _pe = { f: 0, lift: 0, balanco: -1 };
const _juntas: Juntas = { hip: 0, knee: 0 };

/**
 * A pose inteira num instante. `fase` (rad) avança com `taxaDaFase·v·dt`; `peso` (0..1) mistura com a postura parada, que é a
 * pose de repouso do rig (pernas retas, pelve na altura de hoje). Sem passo, o robô sai e para sem tranco.
 * `escalaL` e `escalaR` (0..1) encurtam o passo de cada perna: a perna avariada manca (o `legDamageLean` do dano às pernas).
 */
export function poseDaPassada(fase: number, peso: number, geo: GeometriaDaPerna, p: ParametrosDaPassada, out: PoseDaPassada, escalaL = 1, escalaR = 1): PoseDaPassada {
  const rMax = (geo.ue + geo.w) * PERNA_MAXIMA;
  const g = clamp(peso, 0, 1);
  const alcance = p.alcance;
  const altura = p.altura;
  const phaseL = ((fase % TAU) + TAU) % TAU / TAU;
  const phaseR = (phaseL + 0.5) % 1;
  // A pose de andar inteira (peso 1): o quadril agacha (`agachamento`) e faz o molejo, afundando logo depois de cada pisada e subindo no meio
  // do apoio, duas vezes por ciclo e sem bico. O peso mistura essa pose com o repouso no fim da função.
  const molejo = p.bob * (0.5 - 0.5 * Math.cos(4 * Math.PI * (phaseL - 0.5 * p.fracaoDeApoio)));
  const dTopo = geo.dRest - p.agachamento - molejo;

  passoDoPe(phaseL, p.fracaoDeApoio, alcance * escalaL, altura * escalaL, _pe);
  const fL = geo.f0 + _pe.f;
  const liftL = _pe.lift;
  const phiL = inclinacaoDoPe(_pe.balanco);
  const sobeL = sobeDoPe(geo, phiL);
  passoDoPe(phaseR, p.fracaoDeApoio, alcance * escalaR, altura * escalaR, _pe);
  const fR = geo.f0 + _pe.f;
  const liftR = _pe.lift;
  const phiR = inclinacaoDoPe(_pe.balanco);
  const sobeR = sobeDoPe(geo, phiR);

  // O mínimo dos limites dos dois pés: o de apoio (folga só a do pé inclinado, que no apoio é zero: o pé é plano) e o do pé no ar (mais a altura dele).
  // Contínuo no ciclo.
  const dPelvis = Math.min(
    dTopo,
    liftL + sobeL + Math.sqrt(Math.max(0, rMax * rMax - fL * fL)),
    liftR + sobeR + Math.sqrt(Math.max(0, rMax * rMax - fR * fR)),
  );
  out.dPelvis = dPelvis;
  // O alvo da perna é o tornozelo: o pé plano o põe a `tornozelo` do chão; o pé no ar sobe `lift`, e inclinado, um pouco mais (`sobeDoPe`).
  juntasDaPerna(geo, fL, dPelvis - liftL - sobeL, _juntas);
  out.hipL = _juntas.hip;
  out.kneeL = _juntas.knee;
  juntasDaPerna(geo, fR, dPelvis - liftR - sobeR, _juntas);
  out.hipR = _juntas.hip;
  out.kneeR = _juntas.knee;

  // Mistura com o repouso (juntas em zero, pelve na altura de hoje) pelo peso. Mistura-se a POSE e não a tarefa (alcance, agachamento): o
  // repouso é a perna esticada, o ponto singular da conta de duas barras, onde um agachamento minúsculo pede um joelho grande (cresce com a
  // raiz do agachamento) e a pose daria um estalo no primeiro quadro de movimento.
  out.hipL *= g;
  out.kneeL *= g;
  out.hipR *= g;
  out.kneeR *= g;
  out.phiL = phiL * g;
  out.phiR = phiR * g;
  out.dPelvis = geo.dRest + (out.dPelvis - geo.dRest) * g;
  return out;
}
