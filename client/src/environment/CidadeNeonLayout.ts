import { slidesDoAnuncio, type IdDoAnuncio } from '../brand/anuncios';
import { CITY_NEON, PALETTE } from '../core/palette';
import { BUILDINGS_DA_ARENA, MOBILIARIO_DA_ARENA, PLATAFORMA_DA_ARENA } from './Arena';
import { mulberry32 } from '../core/rng';

/**
 * O ENTORNO DA CIDADE NEON (P264, PR2). O Comandante mandou quatro quadros de uma cidade cyberpunk e escreveu "quero que o cenário fique nesse
 * nível": antes de qualquer detalhe, o que aqueles quadros têm e a Cidade Neon não tinha é **estar dentro de uma cidade** — a praça de combate
 * (±100 m) cercada por um paredão de torres, outdoors e letreiros, e mais duas camadas de torres atrás, sumindo na névoa.
 *
 * **Os outdoors (P266, 28/10):** "aproveite melhor os prédios pra colocar banners imponentes" e "nos prédios que têm banner, não precisa de janelas acesas". Cada prédio da frente e da
 * segunda fila que hospeda um outdoor (na vertical, o maior que a fachada comporta) leva `temBanner` — o shader dele não acende janela nenhuma —, e o anúncio de cada um vem do
 * catálogo da marca (`brand/anuncios.ts`: o Olho do Pai, a Serafim Web e a logo). As duas logos planas ficam nos prédios de destaque do norte (a primeira coisa que o jogador vê ao nascer) e do oeste.
 *
 * Este arquivo é só o **dado** (sem Three, sem DOM, roda no Node): onde fica cada torre, cada outdoor, cada letreiro e cada desenho em neon. Semente
 * fixa: a mesma cidade em toda partida. Quem desenha é `CidadeNeonCenario.ts`, num pedaço carregado sob demanda (`mapasSobDemanda.ts`).
 * **Nada aqui tem colisão:** tudo fica fora da praça (a parede invisível da Arena, em ±100 m, segura Mech, bot e câmera do lado de dentro).
 */

/** 0 = torre (com loja no térreo), 1 = coroa (o recuo no alto de uma torre), 2 = antena. */
export type TipoDeTorre = 0 | 1 | 2;

/** Uma caixa do entorno, alinhada aos eixos, apoiada em `y0`. */
export interface TorreDaCidade {
  readonly x: number;
  readonly z: number;
  /** Largura em x, profundidade em z e altura (m). */
  readonly w: number;
  readonly d: number;
  readonly h: number;
  /** Onde a base apoia: 0 no chão; a coroa e a antena sentam no teto de quem as carrega. */
  readonly y0: number;
  /** 1 = a fachada da praça, 2 = a segunda fila, 3 = o fundo na névoa. */
  readonly anel: 1 | 2 | 3;
  readonly tipo: TipoDeTorre;
  /** A cor de destaque (faixas e quina), da paleta da cidade. */
  readonly cor: number;
  /** 0 a 1: o sorteio do desenho das janelas (passo, andar, faixas). */
  readonly semente: number;
  /** A fração média das janelas acesas. */
  readonly ocupacao: number;
  /** Este prédio hospeda um outdoor: não acende janela nenhuma (o outdoor é a luz dele; janela em volta só polui). */
  readonly temBanner: boolean;
}

/** Um outdoor encostado numa fachada, virado para a praça, **na vertical** (1:2): o maior que a fachada comporta. */
export interface OutdoorDaCidade {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Rotação em Y: o plano nasce olhando para +z. */
  readonly ry: number;
  readonly w: number;
  readonly h: number;
  /** O anúncio com que ele **começa** (catálogo da marca); a logo plana é fixa, os demais alternam entre todas as imagens (P267). */
  readonly anuncio: IdDoAnuncio;
  /** Onde ele começa no anel da troca (o índice da imagem do anúncio dele, entre as que alternam); `-1` na logo plana, que não alterna. */
  readonly inicio: number;
  /** O índice (em `LayoutDaCidade.torres`) do prédio que o hospeda: se o outdoor sair do ar, as janelas dele voltam a acender. */
  readonly torre: number;
  /** O deslocamento do tempo, em fração do período (0 a 1): os outdoors não trocam todos juntos. */
  readonly fase: number;
}

/** Um letreiro vertical "de bandeira": sai perpendicular da fachada, as duas faces olhando ao longo da rua. */
export interface LetreiroDaCidade {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly ry: number;
  /** Espessura (eixo x local), quanto sai da parede (z local) e altura (m). */
  readonly espessura: number;
  readonly largura: number;
  readonly altura: number;
  /** Qual coluna de glifos do atlas (0 a `COLUNAS_DE_GLIFOS` − 1). */
  readonly coluna: number;
  readonly cor: number;
  readonly semente: number;
}

/** Um desenho em tubo de neon (contorno) pregado na fachada. */
export interface NeonDaCidade {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly ry: number;
  readonly lado: number;
  /** Qual desenho do atlas (0 a `DESENHOS_DE_NEON` − 1). */
  readonly desenho: number;
  readonly cor: number;
  readonly semente: number;
}

/** Um poste de rua na calçada da praça: a base, para onde o braço aponta (a avenida) e a luz. */
export interface PosteDaRua {
  readonly x: number;
  readonly z: number;
  /** Rotação em Y: o braço nasce apontando para +z. */
  readonly ry: number;
  /** Para onde o braço aponta (a avenida), em x e z: a cabeça fica a `BRACO_DO_POSTE` m da base. */
  readonly fx: number;
  readonly fz: number;
  /** A luz da cabeça e a faixa de neon do poste. */
  readonly corLuz: number;
  readonly corFaixa: number;
  /** A fase do respirar da luz e se o poste tem defeito (pisca e falha). */
  readonly fase: number;
  readonly defeito: boolean;
}

/** Uma tampa de bueiro (na avenida) ou uma grelha (na calçada de fora, junto das fachadas): as duas soltam vapor. */
export interface BueiroDaRua {
  readonly x: number;
  readonly z: number;
  readonly grelha: boolean;
  readonly periodo: number;
}

export interface LayoutDaCidade {
  readonly torres: readonly TorreDaCidade[];
  readonly outdoors: readonly OutdoorDaCidade[];
  readonly letreiros: readonly LetreiroDaCidade[];
  readonly neons: readonly NeonDaCidade[];
  readonly postes: readonly PosteDaRua[];
  readonly bueiros: readonly BueiroDaRua[];
}

/** Quantas colunas de glifos e quantos desenhos o atlas dos letreiros tem (`CidadeNeonArte.ts` desenha exatamente estes). */
export const COLUNAS_DE_GLIFOS = 8;
export const DESENHOS_DE_NEON = 8;

/** Até onde vai a praça jogável (m): nada do entorno pode passar daqui para dentro. */
export const BORDA_DA_PRACA = 100;
/** A fachada mais perto da praça (m do centro): uma calçada de 5 m entre a borda e o paredão. */
const FACHADA_MIN = 105;

/**
 * O DESENHO DA RUA (o Comandante, ao ver os postes da PR1 soltos no quadriculado: "só se tiver o desenho das ruas, pois nesse quadriculado não achei
 * bom não"). A praça vira um **calçadão** cercado por uma **avenida** em anel quadrado, que corre junto da parede da arena: medidas em
 * "distância quadrada" do centro, `max(|x|, |z|)` (m). O piso (`CidadeNeonRua.ts`) e os postes leem daqui.
 */
export const RUA = Object.freeze({
  /** Até aqui é o calçadão (lajotas grandes). */
  calcadao: 84.5,
  /** O meio-fio: daqui até a parede é asfalto. */
  meioFio: 88,
  /** A borda de fora da avenida (a parede invisível da arena); dali para fora, a calçada das fachadas. */
  borda: BORDA_DA_PRACA,
  /** O centro de cada faixa de pedestre, ao longo do lado (m): o 0 em todos os lados, e mais uma em `+55` (norte e sul) ou `−55` (leste e oeste). */
  faixaDoMeio: 0,
  faixaDeLado: 55,
  /** Meia largura de uma faixa de pedestre (m, ao longo do lado). */
  meiaFaixa: 2.6,
});

/** Onde ficam os postes ao longo de cada lado da calçada (m). Nenhum em cima de faixa de pedestre nem na esquina. */
const POSTES_AO_LONGO = [-74, -46, -20, 20, 46, 74] as const;
/** Quanto o braço do poste avança sobre a avenida (m): a cabeça fica sobre a pista de dentro. */
export const BRACO_DO_POSTE = 3.9;
/** A altura da cabeça do poste (m). */
export const ALTURA_DO_POSTE = 10.4;

/** As caixas que um poste não pode ocupar (o prédio Serafim, que encosta na calçada do leste). */
const SEM_POSTE: readonly { x0: number; x1: number; z0: number; z1: number }[] = [{ x0: 72, x1: 88, z0: 32, z1: 48 }];

/** As cores dos letreiros e dos desenhos: as da cidade e um roxo (o rosa e o ciano dominam nas referências). */
const CORES_DE_NEON: readonly number[] = [...CITY_NEON, PALETTE.pink, PALETTE.cyan, 0xb04dff];

/** Um lado da praça: a direção que a fachada encara (para dentro) e a rotação de um plano que nasce olhando para +z. */
interface Lado {
  readonly nx: number;
  readonly nz: number;
  readonly ry: number;
}
const LADOS: readonly Lado[] = [
  { nx: 0, nz: 1, ry: 0 }, // a fila do norte (z negativo) olha para +z
  { nx: 0, nz: -1, ry: Math.PI }, // a do sul (z positivo) olha para −z
  { nx: 1, nz: 0, ry: Math.PI / 2 }, // a do oeste (x negativo) olha para +x
  { nx: -1, nz: 0, ry: -Math.PI / 2 }, // a do leste (x positivo) olha para −x
];

/** As medidas de uma fila de torres em volta da praça. */
interface Fila {
  readonly anel: 1 | 2;
  /** Distância da fachada até o centro (m). */
  readonly fachada: readonly [number, number];
  readonly largura: readonly [number, number];
  readonly vao: readonly [number, number];
  readonly fundo: readonly [number, number];
  /** Até onde a fila vai ao longo do lado (m): norte e sul cobrem as esquinas; oeste e leste ficam entre eles. */
  readonly alcanceNS: number;
  readonly alcanceLO: number;
}

const FILA_1: Fila = { anel: 1, fachada: [FACHADA_MIN, 112], largura: [12, 26], vao: [0.5, 5], fundo: [16, 28], alcanceNS: 128, alcanceLO: 104 };
const FILA_2: Fila = { anel: 2, fachada: [146, 170], largura: [20, 40], vao: [3, 12], fundo: [20, 34], alcanceNS: 196, alcanceLO: 145 };

/** O baralho dos anúncios: quantas vezes cada um sai a cada rodada. O Olho do Pai domina (são os produtos que o Comandante quer divulgar nesta fase) e o bureau aparece menos. */
const BARALHO: readonly (readonly [IdDoAnuncio, number])[] = [
  ['odp-olho', 5],
  ['odp-gps', 4],
  ['odp-ping', 4],
  ['odp-sos', 4],
  ['odp-familia', 5],
  ['swb', 3],
];

/** Onde o outdoor fica numa torre (a decisão vem antes de a torre existir: ela precisa saber se tem banner). */
interface PlanoDeBanner {
  readonly w: number;
  readonly h: number;
  /** A altura do centro do outdoor (m). */
  readonly y: number;
  /** O outdoor que ocupa a fachada quase inteira (sem letreiros de quina). */
  readonly grande: boolean;
  /** Quanto ele sai do meio da fachada, ao longo dela (m). */
  readonly deslocamento: number;
}

/**
 * Quanto outdoor cabe numa fachada. Vertical (1:2) e o maior possível: na frente (anel 1) a largura segue a fachada e a altura do prédio; na segunda fila (anel 2) o outdoor sobe
 * acima do paredão da frente (a partir dos 46 m). Cada torre sorteia sempre os mesmos 4 números (a decisão de uma não embaralha as outras quando um limite muda).
 */
function planejarBanner(anel: 1 | 2, frenteM: number, h: number, s: readonly [number, number, number, number]): PlanoDeBanner | null {
  const [sHospeda, sGrande, sAltura, sLado] = s;
  if (anel === 1) {
    if (h < 34 || frenteM < 9 || sHospeda > 0.62) return null;
    const grande = frenteM >= 13 && sGrande < 0.3;
    const w = Math.min(grande ? frenteM - 1.6 : frenteM - 5, (h - 12) / 2, grande ? 22 : 18);
    if (w < 6.5) return null;
    const hb = 2 * w;
    const yMax = h - hb - 4; // o topo do outdoor a 4 m do teto, no mínimo (w <= (h − 12) / 2 garante yMax >= 8)
    const base = Math.max(8, Math.min(yMax, 8 + sAltura * Math.max(0, h * 0.45 - 8)));
    return { w, h: hb, y: base + hb / 2, grande, deslocamento: grande ? 0 : (sLado * 2 - 1) * Math.max(0, (frenteM - 5 - w) / 2) };
  }
  if (h < 84 || frenteM < 14 || sHospeda > 0.6) return null;
  const w = Math.min(frenteM - 3, 26, (h - 52) / 2);
  if (w < 7) return null;
  const hb = 2 * w;
  const yMax = h - hb - 6; // (h − 52) / 2 garante yMax >= 46
  const base = Math.max(46, Math.min(yMax, 46 + sAltura * Math.max(0, h * 0.5 - 46)));
  return { w, h: hb, y: base + hb / 2, grande: false, deslocamento: (sLado * 2 - 1) * Math.max(0, (frenteM - 3 - w) / 2) };
}

/** De onde o jogador vê a cidade ao nascer: o ponto de nascimento (0, 25) e a câmera de terceira pessoa um pouco atrás e acima (m). */
export const OLHO_DE_QUEM_NASCE: readonly [number, number, number] = [0, 5, 34];

/** Uma caixa alinhada aos eixos, em metros. */
export interface Caixa {
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
  readonly z0: number;
  readonly z1: number;
}

/** Os prédios e a plataforma da praça, como caixas: o que pode esconder a cidade de quem está na praça. */
export function caixasDaPraca(): readonly Caixa[] {
  return [...BUILDINGS_DA_ARENA, ...MOBILIARIO_DA_ARENA, PLATAFORMA_DA_ARENA].map((b) => ({ x0: b.x - b.w / 2, x1: b.x + b.w / 2, y0: 0, y1: b.h, z0: b.z - b.d / 2, z1: b.z + b.d / 2 }));
}

/** O segmento de `o` até `p` atravessa a caixa? (o método das lajes: o intervalo de t em que o segmento está dentro de cada par de planos tem de se sobrepor.) */
export function segmentoBateNaCaixa(o: readonly [number, number, number], p: readonly [number, number, number], c: Caixa): boolean {
  let t0 = 0;
  let t1 = 1;
  const baixo = [c.x0, c.y0, c.z0];
  const alto = [c.x1, c.y1, c.z1];
  for (let i = 0; i < 3; i++) {
    const d = p[i]! - o[i]!;
    if (Math.abs(d) < 1e-9) {
      if (o[i]! < baixo[i]! || o[i]! > alto[i]!) return false;
      continue;
    }
    let a = (baixo[i]! - o[i]!) / d;
    let b = (alto[i]! - o[i]!) / d;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
    if (t0 > t1) return false;
  }
  return true;
}

/** Quantos dos pontos de um painel (o centro, a parte de baixo e as duas laterais) um prédio da praça esconde de quem nasce. Zero = o painel inteiro aparece. */
export function pontosEscondidosDeQuemNasce(x: number, y: number, z: number, ry: number, w: number, h: number): number {
  const tx = Math.cos(ry) * (w * 0.4);
  const tz = -Math.sin(ry) * (w * 0.4);
  const pontos: [number, number, number][] = [
    [x, y, z],
    [x, y - h * 0.2, z],
    [x + tx, y, z + tz],
    [x - tx, y, z - tz],
  ];
  const caixas = caixasDaPraca();
  return pontos.filter((p) => caixas.some((c) => segmentoBateNaCaixa(OLHO_DE_QUEM_NASCE, p, c))).length;
}

let cache: LayoutDaCidade | null = null;

/** Os sorteios de um prédio escolhido para destaque: sempre hospeda, o maior possível (a fachada inteira), no meio da altura e no meio da fachada. */
const SORTEIO_DE_DESTAQUE: readonly [number, number, number, number] = [0, 0, 0.5, 0.5];

/** Um prédio da frente (anel 1) que poderia levar uma logo de destaque: onde ela ficaria e para quem nasce, quanto dela um prédio da praça esconderia. */
interface DestaquePossivel {
  readonly indice: number;
  readonly lado: Lado;
  readonly plano: PlanoDeBanner;
  readonly x: number;
  readonly z: number;
  readonly escondidos: number;
}

/**
 * A cidade em volta da praça. Calculada uma vez (o resultado é imutável e o mesmo em toda chamada). **Duas passadas:** a primeira só procura os dois prédios de destaque (o do norte,
 * perto do eixo e **visto inteiro por quem nasce**, e o do oeste); a segunda refaz o layout forçando os dois a hospedar a logo (os sorteios de geometria e de todo o resto são os mesmos).
 */
export function layoutDaCidade(): LayoutDaCidade {
  if (!cache) {
    const primeira = montar(new Map());
    const escolher = (filtro: (d: DestaquePossivel) => boolean, distancia: (d: DestaquePossivel) => number): DestaquePossivel | null => {
      const lista = primeira.destaques.filter(filtro);
      if (!lista.length) return null;
      // Cada ponto do painel escondido pesa 1000 (só escolhe um escondido se não houver nenhum à vista); depois, perto do eixo, com peso no tamanho (cada metro de outdoor vale 2 m de eixo).
      const nota = (d: DestaquePossivel): number => distancia(d) - 2 * d.plano.w + 1000 * d.escondidos;
      return lista.reduce((a, b) => (nota(b) < nota(a) ? b : a));
    };
    const norte = escolher((d) => d.lado.nz === 1, (d) => Math.abs(d.x));
    const oeste = escolher((d) => d.lado.nx === 1, (d) => Math.abs(d.z));
    const forcar = new Map<number, PlanoDeBanner>();
    for (const d of [norte, oeste]) if (d) forcar.set(d.indice, d.plano);
    cache = montar(forcar).layout;
  }
  return cache;
}

function montar(forcar: ReadonlyMap<number, PlanoDeBanner>): { layout: LayoutDaCidade; destaques: DestaquePossivel[] } {
  // Cada família de coisas tem o seu sorteio: mexer nos outdoors não embaralha os prédios, nem os postes e os bueiros que o Comandante já aprovou.
  const rand = mulberry32(0xc1dade);
  const entre = (a: number, b: number): number => a + (b - a) * rand();
  const umDe = <T>(lista: readonly T[]): T => lista[Math.floor(rand() * lista.length)]!;
  const sorteioB = mulberry32(0xb4aa4e);
  const randB = (): number => sorteioB();
  // Os letreiros de quina e os desenhos em neon: o sorteio deles (a silhueta da cidade só depende da geometria, que usa o `rand` acima).
  const sorteioC = mulberry32(0x5167e5);
  const randC = (): number => sorteioC();
  const entreC = (a: number, b: number): number => a + (b - a) * randC();
  const umDeC = <T>(lista: readonly T[]): T => lista[Math.floor(randC() * lista.length)]!;

  const torres: TorreDaCidade[] = [];
  const letreiros: LetreiroDaCidade[] = [];
  const neons: NeonDaCidade[] = [];

  /** Coroa e antena no teto de uma torre alta: a silhueta deixa de ser uma caixa só. */
  const enfeitarTeto = (t: TorreDaCidade): void => {
    let topo = t.h;
    let cx = t.x;
    let cz = t.z;
    let lw = t.w;
    let ld = t.d;
    if (t.h > 48 && rand() < 0.55) {
      lw = t.w * entre(0.5, 0.8);
      ld = t.d * entre(0.5, 0.8);
      cx = t.x + (t.w - lw) * entre(-0.5, 0.5);
      cz = t.z + (t.d - ld) * entre(-0.5, 0.5);
      const h = entre(8, 26);
      torres.push({ x: cx, z: cz, w: lw, d: ld, h, y0: topo, anel: t.anel, tipo: 1, cor: t.cor, semente: rand(), ocupacao: t.ocupacao * 0.8, temBanner: t.temBanner });
      topo += h;
    }
    if (t.h > 40 && rand() < 0.4) {
      const ax = cx + lw * entre(-0.3, 0.3);
      const az = cz + ld * entre(-0.3, 0.3);
      torres.push({ x: ax, z: az, w: 0.7, d: 0.7, h: entre(10, 26), y0: topo, anel: t.anel, tipo: 2, cor: PALETTE.signal, semente: rand(), ocupacao: 0, temBanner: false });
    }
  };

  /** Uma torre da frente (anel 1 ou 2) com o outdoor que ela hospeda, se hospeda. */
  interface Candidata {
    readonly torre: TorreDaCidade;
    readonly lado: Lado;
    readonly fachada: number;
    readonly ao: number;
    readonly plano: PlanoDeBanner | null;
    /** A ordem da torre no anel 1 (−1 nas outras): é por ela que a segunda passada força o destaque. */
    readonly indice: number;
  }
  const destaques: DestaquePossivel[] = [];
  let contadorDoAnel1 = 0;

  /** Uma fila de torres em volta da praça, lado a lado, com becos entre elas; devolve as da frente (para pendurar outdoor e letreiro). */
  const fila = (f: Fila): Candidata[] => {
    const frente: Candidata[] = [];
    for (const lado of LADOS) {
      const alcance = lado.nz !== 0 ? f.alcanceNS : f.alcanceLO;
      // A tangente do lado (ao longo da fachada): perpendicular à normal.
      const tx = -lado.nz;
      const tz = lado.nx;
      let s = -alcance + entre(0, 3);
      while (s < alcance - 6) {
        const largura = Math.min(entre(f.largura[0], f.largura[1]), alcance - s);
        const fundo = entre(f.fundo[0], f.fundo[1]);
        const fachada = entre(f.fachada[0], f.fachada[1]);
        const ao = s + largura / 2;
        // O centro da base: atrás da fachada (contra a normal), na posição `ao` ao longo do lado.
        const cx = -lado.nx * (fachada + fundo / 2) + tx * ao;
        const cz = -lado.nz * (fachada + fundo / 2) + tz * ao;
        const baixa = f.anel === 1 && rand() < 0.32; // o gueto: um bloco baixo entre as torres
        const h = f.anel === 1 ? (baixa ? entre(16, 32) : entre(40, 104)) : entre(60, 172);
        const frenteM = largura; // a largura da fachada que olha para a praça: sempre a dimensão ao longo da fila (nas filas norte e sul é a do eixo x, nas oeste e leste a do z)
        const planoSorteado = planejarBanner(f.anel, frenteM, h, [randB(), randB(), randB(), randB()]);
        const indice = f.anel === 1 ? contadorDoAnel1++ : -1;
        const plano = forcar.get(indice) ?? planoSorteado;
        if (f.anel === 1) {
          // O que esta torre seria como destaque: onde a logo ficaria e quanto dela a praça esconderia de quem nasce.
          const dest = planejarBanner(1, frenteM, h, SORTEIO_DE_DESTAQUE);
          if (dest && dest.w >= 8 && h >= 44) {
            const p = naFachada(lado, fachada, ao + dest.deslocamento, 0.25);
            destaques.push({ indice, lado, plano: dest, x: p.x, z: p.z, escondidos: pontosEscondidosDeQuemNasce(p.x, dest.y, p.z, lado.ry, dest.w, dest.h) });
          }
        }
        const torre: TorreDaCidade = {
          x: cx,
          z: cz,
          w: lado.nz !== 0 ? largura : fundo,
          d: lado.nz !== 0 ? fundo : largura,
          h,
          y0: 0,
          anel: f.anel,
          tipo: 0,
          cor: umDe(CITY_NEON),
          semente: rand(),
          ocupacao: entre(0.32, 0.68),
          temBanner: plano !== null,
        };
        torres.push(torre);
        enfeitarTeto(torre);
        frente.push({ torre, lado, fachada, ao, plano, indice });
        s += largura + entre(f.vao[0], f.vao[1]);
      }
    }
    return frente;
  };

  /** Um ponto na fachada (`ao` ao longo do lado, `recuo` m para dentro da praça a partir da parede). */
  const naFachada = (lado: Lado, fachada: number, ao: number, recuo: number): { x: number; z: number } => ({
    x: -lado.nx * (fachada - recuo) + -lado.nz * ao,
    z: -lado.nz * (fachada - recuo) + lado.nx * ao,
  });

  const frente1 = fila(FILA_1);
  for (const { torre, lado, fachada, ao, plano } of frente1) {
    const frenteM = lado.nz !== 0 ? torre.w : torre.d;
    // O letreiro de bandeira numa quina (às vezes nas duas): sai da parede para a calçada, nunca passa da borda da praça. O outdoor que ocupa a fachada inteira não deixa lugar para ele.
    const quinas = plano?.grande ? [] : randC() < 0.3 ? [-1, 1] : randC() < 0.8 ? [randC() < 0.5 ? -1 : 1] : [];
    for (const q of quinas) {
      const altura = Math.min(entreC(7, 15), torre.h - 6);
      if (altura < 4) continue;
      const largura = entreC(2.2, 3.2);
      const base = entreC(4, Math.max(4.5, Math.min(12, torre.h - altura - 2)));
      // A 1–1,9 m da quina: o outdoor do meio para a 2,5 m dela, então sobram ao menos 0,6 m entre os dois (o teste exige 0,5 m).
      const p = naFachada(lado, fachada, ao + q * (frenteM / 2 - entreC(1, 1.9)), largura / 2 + 0.05);
      letreiros.push({ x: p.x, y: base + altura / 2, z: p.z, ry: lado.ry, espessura: 0.36, largura, altura, coluna: Math.floor(randC() * COLUNAS_DE_GLIFOS), cor: umDeC(CORES_DE_NEON), semente: randC() });
    }
    // Sem outdoor, a fachada pode ganhar um desenho em tubo de neon (ou ficar só nas janelas: também é cidade).
    const util = frenteM - 5;
    if (!plano && util >= 6 && randC() < 0.7) {
      const ladoN = Math.min(entreC(6, 11), util);
      const yMax = Math.min(torre.h - 2 - ladoN / 2, 32);
      const yMin = 5 + ladoN / 2;
      if (yMax > yMin) {
        const p = naFachada(lado, fachada, ao + entreC(-1, 1) * Math.max(0, (util - ladoN) / 2), 0.2);
        neons.push({ x: p.x, y: entreC(yMin, yMax), z: p.z, ry: lado.ry, lado: ladoN, desenho: Math.floor(randC() * DESENHOS_DE_NEON), cor: umDeC(CORES_DE_NEON), semente: randC() });
      }
    }
  }

  // A segunda fila: outdoors enormes, que aparecem por cima do paredão da frente.
  const frente2 = fila(FILA_2);

  // Os outdoors: as duas logos planas nos prédios de destaque (escolhidos na primeira passada: o do norte, perto do eixo e visto inteiro por quem nasce, e o do oeste), e o baralho nos demais.
  const comOutdoor = [...frente1, ...frente2].filter((c) => c.plano !== null);
  let cartas: IdDoAnuncio[] = [];
  let proxima = 0;
  const embaralhar = (): IdDoAnuncio[] => {
    const lista = BARALHO.flatMap(([id, n]) => Array<IdDoAnuncio>(n).fill(id));
    for (let i = lista.length - 1; i > 0; i--) {
      const j = Math.floor(randB() * (i + 1));
      [lista[i], lista[j]] = [lista[j]!, lista[i]!];
    }
    return lista;
  };
  /** A próxima carta do baralho, de preferência diferente da do outdoor vizinho (dois iguais lado a lado leem como defeito). */
  const darCarta = (vizinho: IdDoAnuncio | null): IdDoAnuncio => {
    if (proxima >= cartas.length) {
      cartas = embaralhar();
      proxima = 0;
    }
    let j = proxima;
    while (j < cartas.length && cartas[j] === vizinho) j++;
    if (j === cartas.length) j = proxima; // só sobraram iguais ao vizinho: usa mesmo assim
    [cartas[proxima], cartas[j]] = [cartas[j]!, cartas[proxima]!];
    return cartas[proxima++]!;
  };

  const outdoors: OutdoorDaCidade[] = [];
  let anterior: { id: IdDoAnuncio; lado: Lado; anel: number } | null = null;
  for (const c of comOutdoor) {
    const { torre, lado, fachada, ao, plano } = c;
    const p = naFachada(lado, fachada, ao + plano!.deslocamento, 0.25);
    const vizinho: IdDoAnuncio | null = anterior && anterior.lado === lado && anterior.anel === torre.anel ? anterior.id : null;
    const id: IdDoAnuncio = forcar.has(c.indice) ? 'logo' : darCarta(vizinho);
    outdoors.push({ x: p.x, y: plano!.y, z: p.z, ry: lado.ry, w: plano!.w, h: plano!.h, anuncio: id, inicio: id === 'logo' ? -1 : slidesDoAnuncio(id)[0]!, torre: torres.indexOf(torre), fase: randB() });
    anterior = { id, lado, anel: torre.anel };
  }

  // O fundo: arranha-céus espalhados num anel quadrado (como as filas de dentro) além da segunda fila, que a névoa transforma em silhueta com janelas.
  // Em "distância quadrada" de 236 a 330 m: a segunda fila acaba em 204 m e a maior torre do fundo tem 27 m de meia largura, então nenhuma a cruza (o teste confere).
  const FUNDO = 46;
  for (let i = 0; i < FUNDO; i++) {
    const ang = (i / FUNDO) * Math.PI * 2 + entre(-0.05, 0.05);
    const dist = entre(236, 330);
    const quadrado = dist / Math.max(Math.abs(Math.cos(ang)), Math.abs(Math.sin(ang)));
    const torre: TorreDaCidade = {
      x: Math.cos(ang) * quadrado,
      z: Math.sin(ang) * quadrado,
      w: entre(26, 54),
      d: entre(26, 54),
      h: entre(90, 260),
      y0: 0,
      anel: 3,
      tipo: 0,
      cor: umDe(CITY_NEON),
      semente: rand(),
      ocupacao: entre(0.3, 0.6),
      temBanner: false,
    };
    torres.push(torre);
    enfeitarTeto(torre);
  }

  // Os postes e os bueiros têm o sorteio deles (a rua que o Comandante aprovou não se embaralha quando os prédios mudam).
  const sorteioRua = mulberry32(0x9057e5);
  const randR = (): number => sorteioRua();
  const entreR = (a: number, b: number): number => a + (b - a) * randR();
  const umDeR = <T>(lista: readonly T[]): T => lista[Math.floor(randR() * lista.length)]!;

  // Os postes: na calçada da praça, a mesma distância do centro em todo lado, o braço sobre a avenida. Uns poucos com defeito (piscam e falham).
  const postes: PosteDaRua[] = [];
  const naCalcada = (RUA.calcadao + RUA.meioFio) / 2 + 0.2;
  for (const lado of LADOS) {
    // A normal do lado aponta para dentro (a praça); o braço aponta para fora (a avenida).
    const fx = -lado.nx;
    const fz = -lado.nz;
    for (const ao of POSTES_AO_LONGO) {
      const x = fx * naCalcada - lado.nz * ao;
      const z = fz * naCalcada + lado.nx * ao;
      if (SEM_POSTE.some((c) => x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1)) continue;
      postes.push({ x, z, ry: Math.atan2(fx, fz), fx, fz, corLuz: randR() < 0.7 ? 0xffc98a : 0xcfeeff, corFaixa: umDeR(CORES_DE_NEON), fase: randR() * Math.PI * 2, defeito: randR() < 0.22 });
    }
  }

  // Os bueiros: duas tampas por lado no meio de uma pista da avenida (longe das faixas de pedestre e das esquinas) e grelhas na calçada das fachadas.
  const bueiros: BueiroDaRua[] = [];
  const PISTAS = [89.6, 92.4, 95.6, 98.4] as const;
  const longeDaFaixa = (s: number, lado: Lado): boolean => {
    const faixaDeLado = lado.nz !== 0 ? RUA.faixaDeLado : -RUA.faixaDeLado;
    return Math.abs(s - RUA.faixaDoMeio) > 6 && Math.abs(s - faixaDeLado) > 6;
  };
  for (const lado of LADOS) {
    for (let k = 0; k < 3; k++) {
      const grelha = k === 2;
      let s = entreR(-76, 76);
      for (let tentativa = 0; tentativa < 8 && !longeDaFaixa(s, lado); tentativa++) s = entreR(-76, 76);
      const dist = grelha ? entreR(101.6, 103.2) : umDeR(PISTAS);
      // Ao longo do lado: norte e sul andam em x, leste e oeste em z (a mesma convenção do desenho do piso).
      const x = lado.nz !== 0 ? s : -lado.nx * dist;
      const z = lado.nz !== 0 ? -lado.nz * dist : s;
      bueiros.push({ x, z, grelha, periodo: entreR(1.5, 2.3) });
    }
  }

  return { layout: { torres, outdoors, letreiros, neons, postes, bueiros }, destaques };
}
