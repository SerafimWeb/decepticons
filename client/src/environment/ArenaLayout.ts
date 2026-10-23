/**
 * O LAYOUT DA CIDADE NEON que a simulação e o desenho dividem (sem Three, sem DOM): hoje, o **transformador do Banco Vorcaris**, o segundo "quadro de luz" do jogo (ordem P164, parte E:
 * *"um tipo de circuito que podemos repetir nas diferentes fases"*). Fica **a leste do banco** (a fachada com o terminal de códigos está em `BANK_DOOR`, x = -28, z = -25), no corredor entre
 * o banco e o meio da arena: perto o bastante para o jogador socorrer, longe o bastante para o saboteiro não ser visto de cara. A vida é maior que a do porto da praia (480 contra 240): o
 * transformador do banco é o coração da cidade, e o Colossus do fim da missão o depreda em ~20 s.
 */
export const ARENA_QUADRO_DE_LUZ = Object.freeze({ x: -13, z: -33 });

/** A vida do transformador do banco. */
export const ARENA_QUADRO_VIDA = 480;

/** O volume do armário do transformador (largura em x, altura, profundidade em z): o desenho e o colisor leem a mesma medida. */
export const ARENA_QUADRO_VOLUME = Object.freeze({ w: 3.2, h: 3.4, d: 2 });

/**
 * OS TELÕES DIEGÉTICOS (P246, `GAME_DESIGN.md` § HORIZONTE): dois painéis de vídeo encostados em fachadas que já existem (`BUILDINGS` em `Arena.ts`), virados para o meio da arena — nunca o
 * prédio do banco (`x: -28`), que já tem o `BankSign`. `ry` é a rotação em Y para a tela encarar o centro (plano nasce de frente para +Z); `w`/`h` cabem dentro da fachada escolhida com folga.
 */
export const ARENA_TELAO_1 = Object.freeze({ x: 26, y: 11, z: -15, ry: -Math.PI / 2, w: 9, h: 5 });
/** A fachada norte do prédio mais alto (`h: 42`): tela maior, mais alta, lida de longe. */
export const ARENA_TELAO_2 = Object.freeze({ x: 4, y: 23, z: -64, ry: 0, w: 14, h: 6 });
