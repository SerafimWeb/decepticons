/**
 * O LAYOUT DA AMAZÔNIA (P180, parte B; `AMAZONIA.md` §§ 3 e 5; `fichas/cenario-amazonas.md`): o desenho do mapa em **dado puro** (sem Three, sem DOM), lido pela malha, pela física, pela
 * simulação e pelos testes. O rio corre de **oeste (montante, a aldeia) a leste (jusante)**, serpenteando; a **mina a céu aberto**, a **planta** e a **lagoa de rejeitos** ficam na margem
 * norte; o **Draga-01** anda no leito. O mapa tem **2.400 × 900 m** (14 vezes a área da praia): o orçamento de custo é o do `AMAZONIA.md` § 5.
 *
 * Convenção: **x cresce rio abaixo (para o leste)**, z é a largura; o chão firme da margem está perto de y = 0 (é onde todo nascimento põe os pés); o rio corre abaixo disso.
 */

export const AMAZONIA_EXTENSAO = { comprimento: 2400, largura: 900 } as const;

/** Os limites do mundo jogável (as paredes invisíveis ficam aqui). */
export const AMAZONIA_LIMITES = {
  minX: -AMAZONIA_EXTENSAO.comprimento / 2,
  maxX: AMAZONIA_EXTENSAO.comprimento / 2,
  minZ: -AMAZONIA_EXTENSAO.largura / 2,
  maxZ: AMAZONIA_EXTENSAO.largura / 2,
} as const;

/** O lado das células da grade do terreno (m): a mesma para a malha e para o colisor. */
export const AMAZONIA_CELULA = 6;
/** O tamanho do pedaço do terreno (m): a malha é feita em pedaços que a câmera descarta por inteiro (o custo do mapa grande). */
export const AMAZONIA_PEDACO = 300;

/** A altura da superfície da água (m): abaixo do chão firme da margem. */
export const NIVEL_DA_AGUA = -1.2;

/** O z do eixo do rio em `x`: serpenteia devagar (uma curva larga e uma menor), sempre dentro de ±100 m do eixo do mapa. */
export function rioEmX(x: number): number {
  return -18 + 62 * Math.sin(x / 310 + 0.6) + 26 * Math.sin(x / 117 + 2.0);
}

/** A largura do rio em `x` (m): estreito a montante (a aldeia), largo no leito do Draga, o dobro de 1/3 até o fim. */
export function larguraDoRio(x: number): number {
  const t = (x - AMAZONIA_LIMITES.minX) / AMAZONIA_EXTENSAO.comprimento; // 0 a 1, de montante a jusante
  return 78 + 62 * Math.max(0, Math.min(1, t)) + 6 * Math.sin(x / 83);
}

/** A fundura máxima do leito no meio do rio (m abaixo do chão firme). */
export const FUNDURA_DO_RIO = 5.5;

/** A distância (m) do ponto ao eixo do rio na mesma coluna x (a medida simples que o terreno e os adereços usam). */
export function distanciaAoEixoDoRio(x: number, z: number): number {
  return Math.abs(z - rioEmX(x));
}

/** O ponto está na água (dentro das margens do rio)? */
export function estaNoRio(x: number, z: number): boolean {
  return distanciaAoEixoDoRio(x, z) < larguraDoRio(x) / 2;
}

/** **A aldeia** (a montante, na margem sul): o ponto que a missão protege (nunca é alvo) e onde o jogador nasce. */
export const AMAZONIA_ALDEIA = Object.freeze({ x: -1010, z: -215, raio: 70 });

/** **A mina a céu aberto** (margem norte): a cava em bacia, funda no meio. */
export const AMAZONIA_MINA = Object.freeze({ x: 330, z: 270, raio: 120, fundura: 30 });

/** **A planta de beneficiamento** (margem norte, a oeste da cava): o pátio plano onde ficam os prédios, os tanques e as esteiras. */
export const AMAZONIA_PLANTA = Object.freeze({ x: 20, z: 190, comprimento: 190, largura: 110 });

/** **A lagoa de rejeitos** (nordeste, depois da cava): a bacia da água morta, que o shader pinta de preto e óleo. */
export const AMAZONIA_REJEITOS = Object.freeze({ x: 700, z: 250, rx: 95, rz: 62, fundura: 4 });

/** **A margem fortificada** (norte do rio, de frente para o leito do Draga): a faixa da cerca e das torres. */
export const AMAZONIA_MARGEM = Object.freeze({ minX: -260, maxX: 520 });

/**
 * Os três **geradores do escudo** do Draga-01 (P180, parte D; `AMAZONIA.md` § 6, ato 1): a **cerca** (na margem norte, atrás das torres), a **planta** (no flanco sul dela, junto à água) e a
 * **cava** (entre a planta e a mina). Espalhados no eixo do rio para o jogador cruzar a defesa de ponta a ponta: o Draga desce de x = 700 e passa por eles na marcha. O teste confere que
 * nenhum cai no rio nem dentro de uma estrutura sólida.
 */
export const AMAZONIA_GERADORES: readonly { readonly nome: string; readonly x: number; readonly z: number }[] = Object.freeze([
  Object.freeze({ nome: 'CERCA', x: -100, z: 143 }),
  Object.freeze({ nome: 'PLANTA', x: 20, z: 120 }),
  Object.freeze({ nome: 'CAVA', x: 260, z: 140 }),
]);

/**
 * A **força de defesa** da missão do rio (P180, parte D2): onde cada Mech e cada andróide monta guarda, em volta dos três geradores (um Mech e dois andróides por gerador). Eles **seguram o
 * posto** (`BotController.rearguard`): trocam tiro com quem chega ao alcance e não largam o gerador para correr atrás do jogador. Não renascem: derrubá-los é desmantelar a defesa. O teste
 * confere que nenhum nasce no rio nem dentro de uma estrutura.
 */
export const AMAZONIA_GUARDA: { readonly mechs: readonly (readonly [number, number])[]; readonly androids: readonly (readonly [number, number])[] } = Object.freeze({
  mechs: Object.freeze([[-82, 160], [46, 112], [282, 156]] as const),
  androids: Object.freeze([[-122, 128], [-112, 166], [4, 106], [-2, 134], [236, 120], [250, 164]] as const),
});

/**
 * A **Resistência** (P180, parte E): os três andróides aliados que esperam na aldeia, junto de onde o jogador nasce. Quando o escudo do Draga cai e a escotilha abre, eles vão até ela plantar a carga
 * (`sim/InvasaoDoDraga.ts`). Antes disso acompanham o jogador. Renascem na aldeia se caírem (o canhão do Draga mata um andróide por tiro). O teste confere que nenhum nasce dentro de uma estrutura.
 */
export const AMAZONIA_RESISTENCIA: readonly (readonly [number, number])[] = Object.freeze([[-944, -160], [-944, -200], [-978, -158]] as const);

/** Onde o Draga-01 começa (x, rio abaixo da aldeia): a água a montante dele é limpa, a de jusante é morta. */
export const AMAZONIA_DRAGA_INICIO_X = 700;

/** Onde o jogador nasce (na aldeia, na margem sul) e onde nascem as ondas da defesa (a pista e o cais, a jusante). */
export const AMAZONIA_NASCIMENTO_JOGADOR = Object.freeze({ x: -960, z: -180 });

/**
 * Os pontos de nascimento do Deathmatch: o primeiro é o do jogador; os outros onze ficam espaçados a cada 170 m ao longo da **margem sul** do rio (60 m para dentro da terra firme), de montante
 * a jusante. Cada ponto é de um corpo só (a regra dos nascimentos).
 */
export const AMAZONIA_SPAWNS: readonly (readonly [number, number])[] = [
  [AMAZONIA_NASCIMENTO_JOGADOR.x, AMAZONIA_NASCIMENTO_JOGADOR.z],
  ...Array.from({ length: 11 }, (_, k): readonly [number, number] => {
    const x = -760 + k * 170;
    return [x, rioEmX(x) - larguraDoRio(x) / 2 - 60];
  }),
];
