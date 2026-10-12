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

## Reprodução e critérios de escala

npm run capacity -- --seconds=30

O script só cria servidores em 127.0.0.1, com portas efêmeras e contas em memória; encerra os processos e grava .tmp/capacity-results.json. Aceita 10–600 s por estágio. Não faz parte de cada check: executar após mudanças de simulação/rede relevantes.

Para homologar: repetir por 30–60 minutos no hardware de hospedagem, com diferentes mapas/montagens, tiros acertando e explosões concentradas; medir RTT/jitter/perda em rede real, p95/p99 do ciclo inteiro, memória estabilizada e reconexões. Critérios propostos: manter 60/20 Hz, rede no budget e CPU com pelo menos 30% de folga no pico; ajustar SLO a partir do primeiro playtest. Os 400 slots da proteção são limite de segurança, não capacidade comprovada.

Se um processo saturar: distribuir salas em processos, depois hosts com afinidade por sala. SQLite, arquivos de métricas e agregação central precisam de desenho antes de múltiplos hosts. Não prometer escala horizontal só porque existem salas independentes.
