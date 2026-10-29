# Capacidade do Cybermech — evidência de 06/10/2026

O código sustentou 10, 50 e 100 clientes sintéticos locais neste ensaio. Isso permite avançar para um playtest controlado; não certifica capacidade na internet, disponibilidade, GPU do jogador ou operação 24/7. O servidor público offline não foi acessado.

## Ensaio após energia e redução dos bots

Intel i5-1235U, Windows, Node 24.13.0, máquina de 8 GB. Servidor e gerador em processos separados, na mesma máquina. Protocolo 5, base 11b0a1e e alterações ainda não commitadas de codex/energia-observabilidade. Três segundos de aquecimento e 30 segundos medidos por estágio; entrada sequencial; comandos contínuos de movimento/mira/tiro, secundário em rajadas e barreira em metade das montagens. Sem renderização de navegador. O teto por IP foi elevado apenas no ensaio porque todos saem do localhost; proteções de taxa e total permanecem.

| Clientes | Salas | Tick mínimo (Hz) | Snapshot mínimo (Hz) | CPU (% de um núcleo) | RSS (MB) | Payload recebido/jogador (KiB/s) | Quedas |
|---|---:|---:|---:|---:|---:|---:|---:|
| 10 | 2 | 59,99 | 20,00 | 12,0 | 135 | 4,20 | 0 |
| 50 | 7 | 60,00 | 19,99 | 22,9 | 318 | 4,38 | 0 |
| 100 | 13 | 60,01 | 20,00 | 26,2 | 375 | 4,39 | 0 |

P99 de atraso do event loop: 18,9 / 21,9 / 26,1 ms. Médias de Hz não excluem jitter; este ensaio não mede RTT de internet. Payload não inclui TCP/TLS. Salas têm até 8 humanos; 100 pessoas não estão numa única arena.

Dados completos: medicoes/capacidade-energia-2026-10-06.json. Baseline anterior: medicoes/capacidade-baseline-2026-10-06.json (15 s/estágio, protocolo 4, sem escudo). O baseline chegou a 89,8% de um núcleo com 100 clientes. A nova execução teve menos bots e condições/duração diferentes; não é um A/B isolado nem permite atribuir toda a redução de CPU a uma mudança. A ocupação do computador também varia.

## O que o painel do servidor mede (12/10, P93)

O monitor SERVIDOR do console (`DEPLOY.md`, "Painel do servidor") dá duas leituras que **não substituem** o ensaio de carga acima:
- **AVALIAR:** o veredito sobre a última hora observada (tick da pior sala, atraso do laço p99, CPU, memória e o crescimento dela, download por jogador) contra as metas do projeto (G11 a G14) e a **capacidade estimada**: `floor(8,3 / p95 do tick da pior sala)` salas, isto é, quantas cabem em metade do tick de 16,7 ms. **É uma estimativa de CPU**: não conta a banda de casa, a memória nem o túnel, e o painel diz isso ao lado do número.
- **TESTAR:** quatro clientes de mentira numa sala própria, 1 s de aquecimento e 6 s medidos, **de dentro da própria máquina** (não passa pelo túnel nem pela internet). Primeira medida (12/10, máquina de desenvolvimento ocupada): tick 1,7 ms, 20 estados por segundo, 4,1 KB/s por piloto, ping 2 ms, atraso do laço p99 20,6 ms.
Quando o painel e o ensaio discordarem, **vale o ensaio**.

## Reprodução e critérios de escala

npm run capacity -- --seconds=30

O script só cria servidores em 127.0.0.1, com portas efêmeras e contas em memória; encerra os processos e grava .tmp/capacity-results.json. Aceita 10–600 s por estágio. Não faz parte de cada check: executar após mudanças de simulação/rede relevantes.

Para homologar: repetir por 30–60 minutos no hardware de hospedagem, com diferentes mapas/montagens, tiros acertando e explosões concentradas; medir RTT/jitter/perda em rede real, p95/p99 do ciclo inteiro, memória estabilizada e reconexões. Critérios propostos: manter 60/20 Hz, rede no budget e CPU com pelo menos 30% de folga no pico; ajustar SLO a partir do primeiro playtest. Os 400 slots da proteção são limite de segurança, não capacidade comprovada.

Se um processo saturar: distribuir salas em processos, depois hosts com afinidade por sala. SQLite, arquivos de métricas e agregação central precisam de desenho antes de múltiplos hosts. Não prometer escala horizontal só porque existem salas independentes.

## O teto de robôs por sala online: o que limita é a banda, não a CPU nem a GPU (P273, 29/10)

**A pergunta do Comandante:** "será q precisamos manter o limite de 3 mechs e 3 androides? já testamos com mais bots e fluiu normal… seria bom poder termos mais jogadores, ou npcs ou bots". **Medido** (servidor local de verdade, `node scripts/server.mjs`; sala `arena` com esquadrão salvo; humanos simulados lutando; 1.800 ticks = 30 s por caso; a GPU é a AMD Vega 11 do Comandante, Chrome com `--use-angle=d3d11`, janela 1280×720, sem vsync, 15 s por rodada, 3 rodadas alternadas, mediana):

| Sala (Mechs/andróides/técnico de IA + humanos) | Unidades no estado | Tick do servidor (média · p99) | Banda por jogador (KiB/s, sem a moldura) |
|---|---:|---|---:|
| 3/3/1 + 1 | 8 | 0,26 ms · 0,74 ms | 3,27 |
| 3/3/1 + 2 | 9 | 0,59 ms · 2,37 ms | 3,69 |
| **6/6/1 + 1** | 14 | 0,39 ms · 1,01 ms | 5,50 |
| **6/6/1 + 2** | 15 | 0,65 ms · 2,37 ms | 5,91 |
| 6/6/1 + 8 (os Mechs de IA cedem a vaga) | 15 | 0,70 ms · 1,90 ms | 5,99 |
| 10/10/1 + 2 (4 Mechs de IA ficam de fora) | 19 | 0,52 ms · 1,38 ms | 7,39 |
| 12/12/1 + 2 (6 Mechs de IA ficam de fora) | 21 | 0,58 ms · 1,39 ms | 7,76 |

- **CPU do servidor: nunca foi o limite.** O tick de 60 Hz tem 16,7 ms; com até 26 robôs na sala ele gasta menos de 1 ms (o pico solto de 55 ms que apareceu uma vez foi o aquecimento do primeiro caso). Com os 13 robôs de 6/6/1, o custo é quase o mesmo de 7.
- **GPU do cliente (Vega 11):** sala de **7 robôs** (3/3/1): quadro p50 **10,6 ms**, p95 26,6, p99 33,6, 100 chamadas de desenho; sala de **13 robôs** (6/6/1): p50 **10,4 ms**, p95 18,3, p99 30,2, 111 chamadas. **Dentro do ruído:** o Comandante tinha razão, não se sente.
- **O que limita é a banda por jogador (G11, meta de 8 KB/s com a moldura de TCP e TLS):** o estado completo de cada unidade (19 bytes) vai a 20 Hz para cada jogador. A conta do código (`shared/net/budget.ts`, com a moldura): **12 unidades 6,4 KB/s · 15 unidades 7,8 (8,1 com todos com fogo, choque ou gelo) · 16 unidades 8,2 · 20 unidades 10,1 · 24 unidades 11,9 · 28 unidades 13,7 · 32 unidades 15,5 KB/s.**

**Decisão (P273):** o teto do esquadrão online sobe de 3/3/1 para **6 Mechs, 6 andróides e 1 técnico**. Como os Mechs de IA cedem a vaga a quem entra (humanos + Mechs de IA ≤ 8) e andróides e técnico ficam, a sala cheia tem **no máximo 15 unidades com 2 a 8 humanos** (14 com 1) = exatamente o que cabe nos 8 KB/s (`ROOM_UNITS` passou de 12 para 15; o teste trava a conta e que o 16º não cabe). **Sem mudança de protocolo.** **Para passar de 15 unidades há dois caminhos, e a escolha é do dono:** (1) **subir a meta de banda** (G11): com 12 KB/s cabem 24 unidades (a conta de 100 jogadores em salas cheias vai de 6,4 a 9,6 Mbit/s de upload do PC do servidor, a ver contra a internet dele); (2) **mandar só o que mudou** (delta, "M7": uma tarefa própria, com mudança de protocolo: robô longe ou parado deixa de ir a cada estado). O painel de regras da sala (sem esquadrão salvo) segue em 3 Mechs e 3 andróides: o teto novo vale no esquadrão salvo.
