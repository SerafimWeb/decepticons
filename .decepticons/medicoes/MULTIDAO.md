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
