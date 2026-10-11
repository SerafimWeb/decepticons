# AUDITORIA DE INTERFACE — o que está confuso, repetido ou sobrando

> Pedido do dono (10/10): *"o jogo está ficando incrível, mas preciso que você agora olhe ele na ÍNTEGRA. O painel de pausa tem botões repetidos, redundantes e desnecessários… muita informação. Deveria ser mais clean, objetivo e sem nada errado nem repetido. Precisa organizar TODOS os painéis. O Hangar também merece uma melhoria."*
> Quem mexer em tela, HUD ou menu lê isto antes (Passo Zero) e segue os princípios da seção 2.

**Como foi feito:** o jogo real, aberto num Chrome headless, fotografado estado por estado: início/pausa, Hangar (1280×720, 1366×768, 1920×1080), Configurações, lobby online, combate, placar, os três modos, Bunker e celular (844×390 e 390×844). As capturas "antes" estão em `arte/ui-antes-*-claude.png`, as "depois" em `arte/ui-depois-*-claude.png`.

## 1. Achados, tela por tela

### Início / pausa (é a mesma tela) — **refeita no PR `claude/ui-inicio-pausa`**

| # | Achado | Estado |
|---|---|---|
| A1 | Cinco botões iguais empilhados no meio (Hangar, Bunker, Online, Configurações, Ajuda) e o "clique para jogar" era **texto sem destaque**. Quem clicava no meio da tela abria as Configurações sem querer | Feito: **um** botão JOGAR grande; Hangar, Online e Configurações numa fileira |
| A2 | O **HUD da partida aparecia por trás** do painel (sinais vitais, rodada, câmera, dash) e se misturava com o texto | Feito: o HUD some enquanto a pausa está à vista |
| A3 | **FPS / TICK / DRAWS** à mostra para todo jogador, por cima do rodapé | Feito: desligado por padrão (Configurações > "Painel de desempenho"); fica escondido atrás da pausa |
| A4 | Três cartões grandes de modo, com a descrição de **todos**, mais Bunker como botão à parte: três lugares para dizer "o que jogar" | Feito: **MODO** (3 botões) e **MAPA** (Arena/Bunker) lado a lado, com **uma** linha de descrição do modo ativo |
| A5 | "Ajuda e controles" repetia o remapeamento de teclas das Configurações | Feito: saiu; uma linha de teclas no rodapé (e a do toque no celular) |
| A6 | Perfil, créditos e três missões somavam **1.107 px** de altura numa tela de 720: rolagem para ver o fim | Feito: cartão compacto numa segunda coluna; **tudo cabe em 1280×720 sem rolagem** |
| A7 | Faixa "SERVIDOR FORA DO AR · MODO OFFLINE" colada no canto, por cima do HUD; assinatura de versão por cima do painel de desempenho | Feito: a linha do servidor desce para a coluna de jogar; a assinatura vai para o rodapé |
| A8 | No celular, o título se sobrepunha ao subtítulo e o painel cortava | Feito: duas colunas no celular deitado, uma coluna no celular em pé |

### Configurações — **refeitas no PR `claude/ui-configuracoes-abas` (UI-2)**

| # | Achado |
|---|---|
| B1 | **10 seções numa rolagem única de 2.245 px**, vendo 489 por vez (22%): Controles, Toque, Gráficos, Jogabilidade, Inimigos, Nomes na tela, Potências, Áudio, Remapeamento |
| B2 | Mistura o que todo jogador usa (sensibilidade, volume, qualidade) com ajustes avançados de teste (potências por arma, contagem de inimigos) |
| B3 | O seletor "Mechs rebeldes" aparece cortado pelo rodapé do modal |
| B4 | "Painel de desempenho no canto" é de desenvolvedor e fica entre opções de jogo |

**Feito:** abas **JOGO** (dificuldade, inimigos, nomes na tela), **CONTROLES** (mouse, câmera, toque, teclas), **GRÁFICOS E SOM** (qualidade, volume) e **AVANÇADO** (potências por arma e o painel de desempenho, que é de quem testa o jogo). A janela tem altura fixa (não pula ao trocar de aba) e o rodapé "Restaurar padrão" fica sempre à vista. Medido em 1280×720: Controles e Gráficos e som cabem **sem rolagem**; Jogo mostra 53% e Avançado 39% do conteúdo de uma vez (eram 22% do total numa rolagem só). O contrato HTML↔módulo está em `settingsTabs.test.ts` (seção sem aba válida, aba sem botão ou o painel de desempenho fora do Avançado reprovam o `check`).

### Hangar — **refeito no PR `claude/ui-hangar` (UI-3)**

O Hangar é a tela mais rica e já tem identidade forte; o que faltava era **tirar repetição e corte**.

| # | Achado |
|---|---|
| C1 | **CARGA aparece duas vezes** (cabeçalho "7,0 / 11 t" e o quadro "CARGA DO CHASSI 7,0 / 11 t") |
| C2 | **X e VOLTAR** fazem a mesma coisa (e o Esc também) |
| C3 | O campo do link vem **cortado** ("http://127.0.0.1:") e ocupa o lugar do que importa; só o botão COPIAR LINK basta |
| C4 | Os quatro slots mostram "VAZIO · salvar" **truncado** |
| C5 | A lista de chassis tem 1.153 px de conteúdo em 566 visíveis: o Gênesis-01 e os outros ficam escondidos atrás de rolagem |
| C6 | O painel direito abre rolado: "MÓDULO EXTRA" (e uma linha técnica em fonte minúscula: "Ctrl: ligar/desligar · frontal: 5 s / 120° · esfera…") vem **antes** dos braços, que são o que o jogador veio mexer |
| C7 | O braço aparece três vezes: cartão do encaixe, rótulo "BRAÇO DIREITO · ARMAMENTO" e o seletor; os níveis MK, o "TESTAR DISPARO" e o "TREINO DE MIRA" empilhados pedem hierarquia (um primário, o resto secundário) |

**Feito no UI-3:** o chip de CARGA do topo saiu (o quadro "CARGA DO CHASSI" já mostra), o de PILOTO também (repetia o nome do robô no centro); o VOLTAR saiu (o × e o Esc já voltam); o campo do link ficou invisível e sobrou só o botão COPIAR LINK (o campo continua no DOM para o plano B "selecione e Ctrl+C"); os slots dizem "+ SALVAR" e cabem; a lista de chassis ficou compacta (6 a 7 de 10 à vista em 1280×720 e 1366×768, os 10 em 1920×1080); o painel de montagem abre **no topo** (um bug antigo: o foco automático no APLICAR rolava o painel até o fim) e o **MÓDULO EXTRA desceu para depois dos braços**, com as durações dentro das opções do seletor; TESTAR e TREINO DE MIRA ficaram lado a lado; o APLICAR MONTAGEM ficou **preso no fundo do painel** e nunca mais sai da tela.
**Achados extras do UI-3:** três "caminhos de montagem" sem função (ARMAS, já selecionado e sem ação; BLINDAGEM "em breve", que **já existe** como chapa de metal na mão esquerda; MÓDULOS, que só rolava até o seletor logo abaixo); códigos de enfeite ("HGR-01", "CFG-02") e uma frase de enchimento ("Números lidos do chassi e do arsenal do jogo"). Tudo removido.

### HUD da partida — **ajustado no PR `claude/ui-hud-partida` (UI-4)**

> **Retratação (11/10):** a primeira versão desta auditoria dizia que os sinais vitais do canto esquerdo "repetiam o painel do alvo" da direita. **Estava errado.** O da esquerda é do **seu** Mech; o da direita (`TargetPanel`) só aparece com a mira num inimigo e mostra o **alvo** (nome, partes, calor, estados elementais). São informações diferentes, e o painel do alvo é o que deixa o jogador decidir onde atirar. Os dois ficam. O HUD da partida já estava bom; os problemas reais eram de **legibilidade e alinhamento**, não de excesso.

| # | Achado | Estado |
|---|---|---|
| D1 | (retratado: não havia repetição) | — |
| D2 | **Os rótulos "CALOR" e "DASH" eram cinzas (#999 e #777) e sumiam sobre o cenário** (e sobre o próprio Mech); sem sombra. As três barras do centro de baixo tinham larguras de rótulo diferentes e, centradas uma a uma, **ficavam desalinhadas** (o carregador de foguetes era 4 quadradinhos soltos) | Feito: cores mais claras, sombra, coluna de rótulo fixa; as barras ficam alinhadas e o carregador de foguetes virou uma barra segmentada da mesma largura |
| D3 | O FPS/TICK/DRAWS à mostra para todo jogador | Feito no UI-1 (desligado por padrão) |
| D4 | O painel de ordens aos aliados ("1 · Acompanhar 2 · Foco 3 · Defender") pesava o tempo todo no canto inferior esquerdo; é uma legenda das teclas 1, 2 e 3 | Feito: discreto no mouse (60% de opacidade); no toque seguem botões inteiros |
| D5 | O bloco do canto esquerdo (nome, velocidade, abates, vida por parte) brigava com as linhas de neon do cenário, sem fundo | Feito: fundo translúcido e filete verde |
| D6 | O nome de um inimigo (placa no mundo) aparecia por cima do painel do alvo | Feito: o painel do alvo ficou quase opaco (82%) |

### Outras telas — a revisar (PR UI-5)

Lobby online (simples e correto; o apelido já existe no Hangar: avaliar se pede o nome duas vezes), fim de rodada, placar (bom), carregamento, controles de toque, terminal do banco, calibração de mouse.

## 2. Princípios (valem para qualquer agente que mexa em tela)

1. **Uma tela, um trabalho.** A pausa serve para jogar; o Hangar, para montar; as Configurações, para ajustar. O que não é do trabalho da tela vai embora ou fica um clique adiante.
2. **Uma ação primária por tela**, bem maior que as outras. As secundárias em fileira, pequenas.
3. **Cada informação em um lugar só.** Se dois lugares mostram o mesmo número ou o mesmo botão, um deles sai.
4. **Informação de desenvolvedor não aparece para o jogador por padrão** (FPS, tick, draws, jargão técnico). Fica nas Configurações, em "Avançado".
5. **Menu cabe em 1280×720 sem rolagem.** Se não cabe, o conteúdo vira abas, não uma rolagem longa. Conferir também em 1920×1080 (o bloco cresce) e no celular deitado e em pé.
6. **Nada de HUD de partida por trás de menu.**
7. **Toda mudança de tela traz captura antes e depois** em `arte/` (regra 16 do `AGENTS.md`) e o caminho para ver no site.

## 3. Plano (um PR por tela, na ordem do que o dono vê primeiro)

| PR | Tela | Estado |
|---|---|---|
| UI-1 | Início / pausa | **feito** (`claude/ui-inicio-pausa`) |
| UI-2 | Configurações em abas | **feito** (`claude/ui-configuracoes-abas`) |
| UI-3 | Hangar: tirar repetição e corte | **feito** (`claude/ui-hangar`) |
| UI-4 | HUD da partida: legibilidade e alinhamento (o painel de vida duplicado era um achado errado; ver a retratação) | **feito** (`claude/ui-hud-partida`) |
| UI-5 | Lobby, fim de rodada, celular, banco | próximo |

Território: `client/src/ui/`, `styles.css` e `index.html` são do Gemini (`ESTADO_ATUAL`, divisão de trabalho). O dono pediu esta revisão ao Claude diretamente em 10/10; o Gemini tem a tela de login (`gemini/tela-login`) em andamento, com CSS próprio no fim do `styles.css`: os dois PRs mexem em trechos diferentes. Quem chegar depois junta a `main` e roda o `npm run check`.
