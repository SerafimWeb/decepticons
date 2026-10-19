# MULTIDÃO DO 8 DE JANEIRO — a medida de CPU (19/10, Claude)

> **O que se mede:** o custo, por tick de 60 Hz, da simulação da multidão (`client/src/sim/Multidao.ts`, a ficha `fichas/cenario-8-de-janeiro.md` § 3 e § 4). **Só a simulação**: o desenho (a vertex shader, os impostores) ainda não existe e tem a bancada de GPU dele.
> **Como se roda:** `npx vitest run client/src/sim/Multidao.test.ts -t "o custo" --silent=false --reporter=verbose` (a linha `Multidão: …` sai do `console.info` do teste; o Vitest esconde o console de teste que passa sem o `--silent=false`).

## O cenário

3.000 figurantes de cota (2.828 em vetor e o resto de androides rebeldes agendados), a Praça de mentira do teste (dois ônibus, quatro bueiros, três lixeiras, três prédios, duas saídas), a fase inteira de 5 minutos (18.000 ticks). **Em cada tick:** `avancar(t)` (os eventos agendados), `calcularPosicoes(t)` (a posição de **todos** os figurantes, que o jogo real só pede nos ticks em que alguém atira ou assusta) e, a cada 6 ticks, um tiro (10 tiros por segundo) que varre o vetor.

## O resultado

| O que | Valor |
|---|---|
| Figurantes no vetor | 2.828 |
| Pico na Praça ao mesmo tempo | 1.465 |
| **CPU por tick** (as posições de todos todo tick + 10 tiros/s) | **0,043 ms** |
| A estimativa da ficha | ≤ 0,3 ms (o teto) e ~0,1 ms (a conta de bolso) |
| O tick de 60 Hz | 16,7 ms (a multidão gasta ~0,26% dele) |

Máquina: o PC do Comandante (6 GB de RAM, CPU sob carga de outras sessões durante a medida); **é um piso pessimista**, e a medida é de um único processo do Node, sem o resto da partida.

## O que a medida não diz (R13)

- **O desenho:** 1.500 a 3.000 figurantes visíveis custam triângulos e chamadas de desenho, não CPU de simulação. É o passo 3 da ficha (instanciado, posição na shader, impostor) e vai medido na GPU real (`varrer-nan`, `FERRAMENTAS.md` § 4.1).
- **A rede:** a multidão não manda posição (só `morreu` e `fugiu`); a banda se mede na etapa O4 do online (`MULTIPLAYER.md` § 12), com o servidor de verdade.
- **Os androides rebeldes** (no máximo 6 vivos) são entidades do jogo e têm o custo deles (`BotSystem`), que já está medido nas outras fases.

---

# O DESENHO NA GPU REAL (passo 3 da ficha, 19/10)

> **O que se mede:** o quadro do jogo com a multidão desenhada (`client/src/environment/MultidaoDesenho.ts`: três malhas instanciadas, a posição na vertex shader a partir do tick) contra o **mesmo ponto sem ela**.
> **Como se roda:** `npm run build && node .decepticons/medicoes/multidao-gpu.mjs --fotos --salvar` (o Chrome do sistema com `--use-angle=d3d11`, sem vsync, 1280×720, qualidade alta, **rodadas intercaladas e a mediana**, porque o iGPU divide a máquina com o resto). A multidão entra pela **demonstração** `?multidao=1&cota=N&t=T` (Cidade Neon, 200 m; `debug/MultidaoDemo.ts`).
> **As fotos:** `.decepticons/arte/multidao-0.png`, `multidao-1500.png`, `multidao-3000.png`.

## O que achou (só a GPU de verdade mostra)

1. **"Too many attributes" (16 por vértice):** a primeira versão tinha 17 (o `InstancedMesh` gasta 4 com a matriz); o shader **não compilava** e a multidão sumia, **sem erro no SwiftShader** (a demo não roda no smoke). Corrigido: as três cores num atributo só (RGB de 8 bits por canal empacotado num float: 24 bits cabem exatos) e os três números do vértice juntos (`aVert`): 14 atributos. O teste `MultidaoDesenho.test.ts` agora **trava a conta** (3 do three + 4 da matriz + os declarados ≤ 16).
2. **O custo seguia quem nasceu, não quem está presente:** desenhar "tudo que já nasceu" mandava **350 mil triângulos** no fim da fase (quem já saiu continuava na contagem). As **vagas de instância** (uma por figurante ao nascer, devolvida ao cair ou sair; a contagem é a marca d'água das vagas em uso) cortaram para **182 mil**.

## Os números (mediana de 3 rodadas, 3.000 de cota, GPU integrada desta máquina)

| Ponto da fase | Sem a multidão | Com a multidão | Triângulos enviados |
|---|---|---|---|
| Início (tick 4.500, ~1.000 na Praça) | 11,2 ms (p50) | **12,4 ms** | 111 mil (31 mil do mapa) |
| Meio (tick 11.000) | 12,3 ms | **14,3 ms** | 182 mil |
| Fim (tick 17.500, o pico de gente) | 12,4 ms | **14,0 ms** | 182 mil |

- **O custo da multidão no quadro: de 1,2 a 2,0 ms** na mediana, sempre dentro dos 16,7 ms de 60 fps (fps de 63 a 74 com a multidão, contra 72 a 81 sem).
- **O desenho segue em 3 chamadas** (um por tipo); o jogo inteiro roda de 118 a 122 desenhos (o resto é o mapa e os Mechs).

## O que a medida não diz, e o que NÃO foi atingido (R13)

- **O teto da ficha de ≤ 80 mil triângulos na vista mais cheia NÃO foi atingido:** a vista mais cheia manda ~182 mil (o mapa leva 31 mil e **cada figurante ~110**). O critério que decide (o quadro de 60 fps na GPU integrada) **foi** atingido, mas com folga pequena (14 ms de 16,7); **numa GPU mais fraca que esta, falta margem**. O caminho já desenhado na ficha: **placa (impostor) de longe**, menos caixas por figurante (hoje: tronco, duas pernas, dois braços e a cabeça com focinho e chifres) e o **teto da qualidade** (`limitar()` existe e é testado, mas **ainda não está ligado** ao `core/Quality.ts`).
- **`varrer-nan` (a trava do NaN, `FERRAMENTAS.md` § 4.1):** 0 de 480 poses com pixel não finito com a multidão da demonstração na cena da Praia (`--extra "multidao=1&cota=3000&t=9000"`).
- **A medida é da demonstração** (Cidade Neon, o jogador parado, a multidão não é atingida pelos tiros, não há prédio): o jogo da fase tem mais coisa na cena.
- **p95 de 28 a 32 ms** com e sem a multidão: são os soluços da máquina compartilhada (editor, navegador, outras sessões), não da multidão (o p95 sem ela é igual).
- **Os 118 a 122 desenhos incluem o jogo todo;** o teto da ficha (70 desenhos) era para a cena da fase, que ainda não existe.
