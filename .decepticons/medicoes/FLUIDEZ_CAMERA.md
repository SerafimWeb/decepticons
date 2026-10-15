# Fluidez e recuperação da câmera — P109

Codex, 14/10/2026. Continuação autorizada pelo Comandante (“sim, prossiga”). Base `900d277` (#297), worktree `codex/fluidez-camera`. Este corte mede a base e corrige a recuperação da câmera; não conclui as etapas de cenário e rede de `REFERENCIA_VISUAL.md` §7.

## Método de desempenho

`node .decepticons/medicoes/fluidez-camera.mjs baseline 300 3`: build de produção instrumentado somente na bancada, Edge headless com **GPU física Vega 11 / Direct3D11**, viewport 1280×720, pixelRatio 1, qualidade média fixa com bloom. Três contextos novos, cada um com 10 s de aquecimento e 300 s de coleta. Vector-09/plasma padrão, quatro inimigos e dois aliados, dificuldade normal. Percurso por comandos virtuais: quadrado relativo à mira, giro lento, tiro em pulsos, dash/pulo a cada 24 s. Morte, dano, colisão e fim de rodada continuam habilitados. Sem áudio (volume zero).

Buffers fixos de 100 mil amostras; tempo de `Game.frame()` por `performance.now()`, intervalos por rAF e GPU por `EXT_disjoint_timer_query_webgl2` com quatro consultas reutilizadas, sem esperar resultado. CPU do método não inclui a instrumentação anterior/posterior nem espera entre quadros. Tempo de GPU é a região do quadro submetida dentro da consulta; não equivale ao intervalo de apresentação na tela. Nenhum check/build adicional foi iniciado pelo Codex durante as três coletas; processos de outras sessões foram preservados. Memória total da máquina: 6.092 MiB.

**Resultados (53.798 quadros):** relatório consolidado em `FLUIDEZ_CAMERA.json`. Relatórios locais: `.tmp/fluidez-camera/baseline/results.json` e `.tmp/fluidez-camera/baseline-combate/results.json`. A ordem do array identifica a sessão; na primeira versão do coletor a chave `round` era o número da rodada do jogo (não o índice da sessão); o script publicado separa `session` e `gameRound`.

| Sessão | Frame p50 / p95 / p99 (ms) | Máximo (ms) | Pausas >50 / >100 / >300 ms | CPU p50 / p95 (ms) | GPU p50 / p95 (ms) | RAM livre antes / depois (MiB) |
|---|---|---:|---|---|---|---|
| 1 | 16,7 / 16,8 / 16,9 | 400,2 | 4 / 2 / 2 | 5,6 / 7,6 | 12,02 / 14,01 | 861 / 748 |
| 2 | 16,7 / 16,8 / 16,9 | 383,5 | 2 / 1 / 1 | 5,8 / 7,8 | 11,92 / 13,62 | 976 / 915 |
| 3 | 16,7 / 16,8 / 16,9 | 50,0 | 0 / 0 / 0 | 5,7 / 7,6 | 12,06 / 13,54 | 909 / 1103 |

Zero programas novos, zero `pageerror`, zero ocorrências `GPU_DISJOINT`; resolução e bloom permaneceram fixos. O banco pausou um quadro por abertura nas sessões corrigidas: 2 e 1 ocorrências, contabilizadas. As três terminaram jogando. O alvo de percentis foi atingido **neste ensaio**, mas o alvo de zero pausas >100 ms **falhou em duas sessões**. Logo, não há homologação de 60 FPS estáveis. Não comparar esses números como ganho sobre C3 de 09/10: código, percurso, duração e carga do sistema são diferentes. São números da base **antes** da correção da câmera.

**Controle da bancada:** a segunda sessão inicial entrou no Banco VORCARIS e terminou pausada (`playing: false`, captura com o diálogo e relógio em 2:32). Foi descartada como medição de combate; a terceira foi interrompida. A primeira completou combate/rodada. Duas repetições usam **o mesmo build baseline congelado** (`baseline-combate 300 2 --baseline-build`) e dispensam o menu do banco no quadro seguinte, sem resgatar nada; contam `bankDismissals` e `pausedFrames`, e reprovam a coleta se ela ficar pausada. O jogo publicado não recebe essa instrumentação nem mudança no banco.

## Ajuste da câmera

Antes, o raio que deixa de atingir uma parede faz o afastamento saltar de `hit.distance - 0.4` para a distância total em um quadro. Agora a aproximação continua imediata, e a recuperação usa `1 - exp(-12 * dt)` (90% em ~0,19 s). Rotação da mira e posição de referência do Mech continuam imediatas; somente a distância relativa da câmera muda gradualmente. Trocar para terceira pessoa inicializa a distância de novo. Zoom para perto continua imediato; zoom para longe também se beneficia da recuperação gradual.

**Custo:** um número por câmera e uma exponencial por quadro enquanto recupera distância; nenhuma alocação, geometria, draw call ou consulta física adicional no frame. Não altera simulação, tiro, rede, dano, velocidade, FOV ou sensibilidade. Não reivindica aumento de FPS.

**Provas executadas:** seis testes de comportamento passaram (colisão imediata; saída sem salto e giro imediato; equivalência temporal a 30/60/144 Hz; nova obstrução durante recuperação e troca de modo; zoom/dt zero; parede com Rapier real). O teste de saída **falhou na implementação anterior** na asserção que barra o salto de distância, e passou na nova. Logs locais: `.tmp/camera-regressao-antes.log` e `.tmp/camera-testes.log`.

`node .decepticons/medicoes/camera-cobertura.mjs` compara o build baseline congelado com o código atual: percorre 14 m junto à face sul do prédio ciano em 120 passos de 1/60 s, preserva o ângulo da câmera e mede o maior aumento da distância entre quadros. É **ensaio isolado de câmera**: posições do Mech são prescritas para repetir exatamente o caminho, com cena e raycast reais; não mede controller ou latência de mouse. Capturas ficam em `.tmp/camera-cobertura/`; a sequência pode ser montada a 60 quadros/s pelo FFmpeg, mas **isso não é gravação de FPS real**. Nenhuma captura sequencial roda durante o benchmark de desempenho. O roteiro atualiza o índice de colisores do Rapier antes do primeiro raio e reprova se não houver obstrução e recuperação; a primeira tentativa sem esse passo foi descartada (nenhum raio acertava a parede).

| Percurso, câmera voltada para sul | Maior aumento da distância em um passo: antes / depois | Evidência |
|---|---|---|
| Prédio ciano, de (-28, 0, -24) a (-14, 0, -24) | 0,5014 / 0,4224 m | `camera-predio.json` |
| Barricada alta verde, de (22, 0, 34) a (36, 0, 34) | 2,5490 / 0,7489 m (~71% menor) | `camera-barricada.json`; reproduzir com argumento `barricada` |

O efeito depende da geometria: no prédio grosso o raio desliza pela lateral; na barricada fina ele perde o obstáculo de uma vez. A melhora de 71% é **do maior passo de afastamento nesse segundo roteiro**, não de FPS, latência, tremor total ou todos os movimentos de câmera. Na barricada, distância inicial/final idênticas: 2,1788 / 7,7363 m; último quadro com 52 draws e 12.592 triângulos em ambas as versões. Zero `pageerror` nos dois percursos.

Capturas versionadas: `arte/camera-cobertura-antes-codex.png` e `arte/camera-cobertura-depois-codex.png`. Comparativo: `arte/camera-cobertura-codex.mp4`, antes à esquerda/depois à direita, **0,5×** (passos de 1/60 s montados a 30 fps), sem áudio. São quadros renderizados de um ensaio controlado, não gameplay gravado em tempo real.

**Como conferir no jogo:** Arena → JOGAR → terceira pessoa (`V`) → andar lateralmente com uma cobertura alta ou parede atrás do Mech, mantendo a mira para o lado oposto da parede. Ao sair da borda, o afastamento se recupera gradualmente. A roda do mouse para afastar a câmera também permite sentir a recuperação; aproximar continua imediato. Comparar conforto em uma partida real ainda é tarefa do dono.

## Limites e próxima etapa

- Headless/GPU real não substitui playtest humano no navegador visível, teste térmico de horas, outro chassi ou dois clientes online.
- O percurso usa comandos por tempo de parede: sob travada, ticks podem ser descartados pelo limite existente; não é replay determinístico para comparação de regras.
- A coleta de 300 s inclui o intervalo de fim de rodada (a sessão aquece 10 s antes); as capturas finais podem mostrar o placar. Deslocamento acumulado pode incluir reposicionamento de respawn; não é distância exclusivamente caminhada.
- O boot é local, com cache de driver/browser diferente entre contextos; não mede download público a frio.
- Um intervalo de quadro longo não revela sua causa sozinho. GPU, CPU do método e sistema/driver têm relógios diferentes; não atribuir pausas à RAM, física ou shader sem correlação.
- A câmera ainda usa o raio existente, não um volume da lente. Este corte não resolve toda possibilidade de clipping em quinas nem altera a distância mínima de 0,5 m.
- Próximo: investigar pausas persistentes com registro temporal, repetir em navegador visível e seguir a prova de acabamento de um setor da Arena. Homologação de 60 FPS permanece condicionada aos resultados e ao playtest do dono.
