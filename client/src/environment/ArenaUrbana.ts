import { PALETTE } from '../core/palette';

/**
 * A PRAÇA URBANA DA CIDADE NEON (P268, ordem do Comandante de 28/10): "queria na praça, pra dar cobertura, e reduzir o alcance, fazer combate urbano com diferentes espaços de conflito e que permita
 * diversas estratégias. Não precisa lotar a cidade, só adiciona mais alguns prédios e elementos, tipo uma praça de playground porém urbana."
 *
 * Antes, a praça de 170 m tinha três prédios, seis barricadas e uma plataforma: de um ponto de nascimento o Mech via, em média, 64 m em volta (tiro de uma ponta a outra) e **83% dos pares de
 * pontos a 30–60 m se enxergavam**. Aqui entram **nove prédios pequenos e médios, cinco contêineres, dois quiosques que quebram e um playground**, em cinco espaços de conflito diferentes:
 *
 *  - **O Beco do Mercado** (sudeste): três prédios em T, com becos de 7 e 8 m. Combate de esquina, a poucos metros: favorece o andróide, a motosserra, o lança-chamas e quem sabe virar a esquina.
 *  - **O Pátio** (nordeste): dois prédios com um beco de 7 m entre eles (uma galeria de tiro de 14 m com as duas pontas abertas) e uma loja solta ao norte. Quem entra pelo beco é visto dos dois lados.
 *  - **O Playground** (noroeste): a "praça dos degraus": uma plataforma de 3 m com quatro degraus de 0,6 m ao sul (o Mech sobe andando, o andróide pulando), uma rampa de 7 m ao leste (o
 *    escorregador: dois jeitos de subir, um só de descer rápido) e um cubo de 1,5 m. O alto dá visão e exposição; o cubo dá cobertura só ao pequeno. Vertical, de média distância, sem fresta onde se prender.
 *  - **Os Contêineres** (espalhados): pilhas de dois (5,2 m) que tapam a vista de um Mech de 5,3 m e deixam um corredor de 12 m para cada lado: flanquear ou segurar a linha.
 *  - **Os quiosques** (destrutíveis): cobertura que o inimigo derruba e que, derrubada, abre a linha. O que estava seguro deixa de estar.
 *
 * **Regras de desenho** (conferidas por `ArenaUrbana.test.ts`, com a planta de `ArenaMapa.ts`): nada sobre ponto de nascimento (5 m de folga), zona de cura ou frio, armário do transformador, porta do
 * banco ou a fachada de um telão; entre dois obstáculos o vão é **zero ou maior que 3,8 m** (o Marauder, o maior Mech jogável, tem 3,2 m de diâmetro: fresta que ele não cruza é armadilha); todo canto
 * da praça é alcançável de todo ponto de nascimento pelo Mech e **o Colossus-01 (3,6 m de raio) cruza do nascimento dele ao transformador** (os obstáculos de até 2,4 m ele pisa por cima; os becos de 7 m ficam fechados a ele, de propósito: refúgio); e o alcance cai
 * (a olho de Mech, a fração de pares a 30–60 m que se enxergam passa de 83% para menos de 62%).
 *
 * Dado puro (sem Three, sem DOM): o servidor e o cliente montam a mesma coisa (G14), e a Arena os lê daqui. Nada tem nascimento nem sorteio: a mesma praça em toda partida.
 */

export interface BlocoUrbano {
  /** O nome (só para as mensagens dos testes e para o relatório). */
  readonly nome: string;
  readonly x: number;
  readonly z: number;
  readonly w: number;
  readonly d: number;
  readonly h: number;
  /** A cor do neon das arestas (e da tinta das janelas, nos prédios). */
  readonly accent: number;
}

/** Um quiosque: uma caixa que quebra (a vida é a das barricadas: `Destructibles`). */
export interface QuiosqueUrbano extends BlocoUrbano {
  readonly hp: number;
}

const b = (nome: string, x: number, z: number, w: number, d: number, h: number, accent: number): BlocoUrbano => Object.freeze({ nome, x, z, w, d, h, accent });

/** Os prédios pequenos e médios (8 a 16 m): janelas acesas como os da praça, sem colisão a mais que a caixa. */
export const PREDIOS_URBANOS: readonly BlocoUrbano[] = Object.freeze([
  // O Beco do Mercado (sudeste): um T de becos (7 m entre o 1 e o 2, 8 m entre eles e o 3).
  b('Mercado 1', 26, 50, 10, 12, 14, PALETTE.sodium),
  b('Mercado 2', 43, 50, 10, 12, 10, PALETTE.cyan),
  b('Mercado 3', 34, 68, 20, 8, 16, PALETTE.pink),
  // O Pátio (nordeste): o beco de 7 m entre o A e o B, e a loja ao norte.
  b('Pátio A', 52, -30, 14, 10, 13, PALETTE.pink),
  b('Pátio B', 52, -12, 14, 12, 9, PALETTE.fluo),
  b('Loja do Norte', 28, -52, 10, 8, 9, PALETTE.cyan),
  // Os que fecham as linhas longas do oeste e do centro.
  b('Ateliê', -64, 2, 10, 12, 12, PALETTE.cyan),
  b('Galpão', -48, -52, 12, 10, 10, PALETTE.green),
  b('Banca', -22, 20, 8, 8, 8, PALETTE.amber),
]);

/** Os quiosques que quebram (a cobertura que cai): 4×4×3,6 m, com a vida de uma barricada média. */
export const QUIOSQUES_URBANOS: readonly QuiosqueUrbano[] = Object.freeze([
  Object.freeze({ ...b('Quiosque do Mercado', 30, 62, 4, 4, 3.6, PALETTE.amber), hp: 500 }),
  Object.freeze({ ...b('Quiosque da Praça', 44, 6, 4, 4, 3.6, PALETTE.green), hp: 500 }),
]);

/**
 * O mobiliário fixo (não quebra): contêineres (pilhas de dois, 5,2 m) e o playground (plataforma, degraus e cubos de 1,5 m: cobertura de andróide, que o Mech pisa por cima).
 * Todos numa malha só (`Arena.addMobiliario`): o custo de desenho é o mesmo de uma peça.
 */
export const MOBILIARIO_URBANO: readonly BlocoUrbano[] = Object.freeze([
  b('Contêiner Norte', -10, -58, 12, 2.6, 5.2, PALETTE.sodium),
  b('Contêiner Nordeste', 34, -38, 2.6, 12, 5.2, PALETTE.cyan),
  b('Contêiner Leste', 66, 8, 12, 2.6, 5.2, PALETTE.pink),
  b('Contêiner Oeste', -40, -20, 2.6, 12, 5.2, PALETTE.sodium),
  b('Contêiner Sul', 10, 64, 12, 2.6, 5.2, PALETTE.cyan),
  // O Playground (noroeste): a plataforma de 3 m e os quatro degraus de 0,6 m (1,6 m de piso cada) que sobem a ela pelo sul. (Um degrau de 0,9 m, o `stepHeight` do Mech, o prende por 2 s: 0,6 m ele sobe andando.)
  b('Playground: plataforma', -74, -32, 8, 8, 3, PALETTE.green),
  b('Playground: degrau 4', -74, -27.2, 6, 1.6, 2.4, PALETTE.yellow),
  b('Playground: degrau 3', -74, -25.6, 6, 1.6, 1.8, PALETTE.yellow),
  b('Playground: degrau 2', -74, -24, 6, 1.6, 1.2, PALETTE.yellow),
  b('Playground: degrau 1', -74, -22.4, 6, 1.6, 0.6, PALETTE.yellow),
  b('Playground: cubo 2', -64, -23, 3, 3, 1.5, PALETTE.pink),
]);

/**
 * Uma rampa (o escorregador do playground): sobe de `h` metros em `run` metros, **descendo para o leste** a partir da borda de cima, em `x`. A inclinação (23°) é a da rampa da plataforma da arena,
 * que o Mech vence com folga (o limite dele é 50°).
 */
export interface RampaUrbana {
  readonly nome: string;
  /** A borda de cima (onde a rampa encontra a plataforma) em x, e o meio da largura em z. */
  readonly x: number;
  readonly z: number;
  /** O comprimento no chão, a largura e a subida (m). */
  readonly run: number;
  readonly largura: number;
  readonly h: number;
  readonly accent: number;
}

export const RAMPAS_URBANAS: readonly RampaUrbana[] = Object.freeze([
  Object.freeze({ nome: 'Playground: rampa', x: -70, z: -32, run: 7, largura: 4, h: 3, accent: PALETTE.green }),
]);

/**
 * A caixa inclinada de uma rampa, pela mesma conta da rampa da plataforma (`Arena.buildPlatform`): o centro, o tamanho (comprimento da face inclinada, 1 m de espessura, largura) e o ângulo de giro em
 * torno de z (negativo: desce para +x). A face de cima passa pela borda de cima em \`h\` e chega ao chão no fim do \`run\`. Fonte única: o desenho, o colisor e os testes leem daqui.
 */
export function caixaDaRampa(r: RampaUrbana): { centro: { x: number; y: number; z: number }; tamanho: { x: number; y: number; z: number }; angulo: number } {
  const espessura = 1;
  const angulo = Math.atan2(r.h, r.run);
  const comprimento = r.run / Math.cos(angulo);
  return {
    centro: { x: r.x + r.run / 2 - Math.sin(angulo) * (espessura / 2), y: r.h / 2 - Math.cos(angulo) * (espessura / 2), z: r.z },
    tamanho: { x: comprimento, y: espessura, z: r.largura },
    angulo: -angulo,
  };
}
