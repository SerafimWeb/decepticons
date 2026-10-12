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

### Celular e outras telas — UI-5, **parcial** (PR `claude/ui-celular-ordens`)

| # | Achado | Estado |
|---|---|---|
| E1 | **No celular deitado, o painel de ordens aos aliados ficava em cima do analógico esquerdo.** A metade esquerda da tela inteira é a zona de movimento (`.tc-move`, 45% da largura), e o painel (que captura o toque) ocupava o canto inferior esquerdo; a regra que o movia para cima só valia abaixo de 700 px, e telefones deitados têm 800 a 930. Quem tocava ali apertava um botão de ordem em vez de andar | Feito: no toque o painel sobe para logo abaixo do bloco de status. Medido em 844×390, 667×375 e 932×430: o painel termina em y=223 e o analógico começa em y=251, 261 e 289 |
| E2 | Lobby online: simples e correto (apelido e código da sala). Não pede o nome duas vezes | Sem mudança |
| E3 | Fim de rodada (`RoundOverlay`), carregamento e terminal do banco | **Não conferidos em captura** (o fim de rodada só aparece depois de 5 minutos de partida e não há atalho de teste). Ficam como pendência declarada; o código do fim de rodada é só contagem e quatro números |
| E4 | O bloco de status do canto esquerdo ocupa 144 px de altura no celular (10 linhas) | Sem mudança: avaliar com o dono se as barras por parte são necessárias no toque |

### Console de comando — UI-6 (11/10, P86 a P89): a tela de início e de pausa virou uma sala de comando

O Comandante pediu um painel "com todos os botões e configurações em um só espaço", a partir de duas imagens de sala de comando. **Substitui a tela do UI-1** (início/pausa), mantendo os princípios da seção 2 (uma ação primária, nada repetido, nada de informação de desenvolvedor, sem rolagem em 1280×720).

| # | Princípio | Como o console cumpre |
|---|---|---|
| F1 | **Uma ação primária por tela** | o **botão verde** (placa listrada, tecla Enter) é o único grande; os monitores abrem uma tela cada, em escala menor. O clique em qualquer monitor **não** começa a partida (a pausa inteira era o botão de jogar); o título e a parede continuam sendo "jogar" |
| F2 | **Cada informação em um lugar só** | o modo mora na mesa; o **mapa (Arena/Bunker) mora no teatro** (a fileira MAPA saiu); a vida de cada parte mora no esquema do Mech; os pilotos num monitor só |
| F3 | **Informação de desenvolvedor fora do jogador** | Potências, Mesa, Sala de controle, Oficina e o que está em construção só no **modo Comandante** |
| F4 | **Cabe sem rolagem** | medido em 1024×700, 1280×720, 1366×768, 1920×1080 e 2560×1440 (`rolagem 0`); **celular: uma coluna que rola**, com o botão de jogar logo depois do título |
| F5 | **Escala tipográfica** | todo texto é "tamanho × `--k`" (1,0 no laptop, 1,2 no 1080p, 1,5 no 1440p, 1,15 no celular); os textos do mapa e do radar, em canvas, leem a mesma escala |
| F6 | **Teclado e acessibilidade** | atalhos desenhados nos botões (Enter, H, O, Z), que **nunca roubam** uma tecla que o jogo usa com a pausa à vista (teste); anel de foco por dentro dos botões chanfrados; `aria-label` nos monitores e nos marcadores; "menos movimento" desliga as animações |
| F7 | **Estados honestos** | **tela de carregamento mínima** (título, rótulo e o botão apagado, que mostra o progresso) até o botão ficar pronto, e só então os monitores aparecem e acendem em cascata; o que não existe diz "em construção" (R13) |

**Achados enquanto construía (R17):** (a) o `clip-path` dos chanfros corta o anel de foco do teclado: nos botões chanfrados o anel vai por dentro; (b) um botão que ficou com o foco do mouse (ou escondido) engolia o Enter: só o foco de teclado (`:focus-visible`) ou um campo de texto segura as teclas; (c) `KeyM`, `KeyB` e `KeyC` já valem com a pausa à vista (briefing e CFTV): os atalhos novos não os usam; (d) o relatório do fim de rodada (`#round-summary`) agora é uma faixa acima do mapa, não por cima dele.
**Capturas:** `arte/console-comando-claude.jpg` (o que o jogador vê), `console-comandante-claude.jpg` (modo Comandante em 1080p, com o Bunker escolhido), `console-mundo-claude.jpg` (zoom MUNDO), `console-celular-claude.jpg`, `console-carregando-claude.png` (a tela de carregamento real). **Limite:** fotografado em Chrome headless (SwiftShader); o julgamento de fluidez e de beleza em GPU real é do Comandante.

### Janela do esquadrão — UI-7 (12/10, P91): montar a partida pela tela

Uma janela por cima do console (mesmo vocabulário das Configurações: moldura verde, cabeçalho laranja, botões de terminal), aberta por **[ ESQUADRÃO ]** no monitor PILOTOS (e pela ficha do Comandante). Como cumpre os princípios da seção 2:

| # | Princípio | Como a janela cumpre |
|---|---|---|
| G1 | **Uma ação primária** | **[ SALVAR E REINICIAR ]** é o botão cheio e brilhante; AJUSTES DO JOGO, COPIAR LINK e DESFAZER são secundários e do mesmo tamanho pequeno; fica apagado enquanto nada mudou |
| G2 | **Cada informação em um lugar só** | o nome da lista é o que vai para a partida (com a personalidade); a carga e a contagem moram no pé, uma vez; o chassi e a arma moram na ficha, não na lista (a lista só resume) |
| G3 | **Sem informação de desenvolvedor** | a carga é LEVE, MÉDIA, ALTA ou EXTREMA com uma dica em palavras; o peso e os milissegundos ficam nos documentos |
| G4 | **Cabe sem rolagem em 1280×720** | a janela inteira cabe de 1024×700 a 1920×1080 (o que rola são as **listas**, com 24 linhas); no celular vira uma coluna que rola, com o botão de salvar sempre alcançável |
| G5 | **Estados honestos** | o botão se apaga com o motivo online e nas missões; o + de cada lado se apaga com o motivo do limite (tracejado); o que não cabe no mapa é dito antes de salvar |
| G6 | **Teclado** | Esc fecha; setas movem a escolha; Delete tira; os campos têm rótulo; o console não dá Enter por trás dela |

**Capturas:** `arte/esquadrao-editor-claude.jpg`, `esquadrao-editor-cerco-claude.jpg` (o teto, carga extrema), `esquadrao-editor-celular-claude.jpg`. **Limite:** Chrome headless (SwiftShader); a janela não prende o foco do Tab.

### Janela do servidor — UI-8 (12/10, P93): olhar e mexer no servidor pela tela

Uma janela por cima do console, do mesmo molde da do esquadrão, aberta por **COMANDO → SERVIDOR**. Como cumpre os princípios da seção 2:

| # | Princípio | Como a janela cumpre |
|---|---|---|
| G1 | **Uma ação primária** | a janela é de leitura: o que se vê primeiro é o selo (NO AR) e os oito cartões; as quatro ações do pé são do mesmo tamanho e **REINICIAR** (a perigosa) é a única em vermelho e pede confirmação em palavras |
| G2 | **Cada informação em um lugar só** | o número vive no cartão, a história dele no gráfico, e os detalhes das salas e do log em suas listas; o veredito só aparece depois de AVALIAR, uma vez |
| G3 | **Sem informação de desenvolvedor** | é a **tela do dono**, atrás do modo Comandante e de um token: aqui o milissegundo e o KB/s são o assunto, mas cada checagem traz uma frase de dica ("o Node demorou a voltar: outro programa pesado na máquina") |
| G4 | **Cabe sem rolagem em 1280×720** | conferido de 1024×700 a 1920×1080 (a janela e o rodapé à vista; o que rola é o log) |
| G5 | **Estados honestos** | TESTAR se apaga **com o motivo** com gente jogando; REINICIAR avisa quando o servidor roda à mão (só desliga); sem token a janela pede o token e não mostra nada; sem servidor no build o item se apaga |
| G6 | **Teclado** | Esc fecha (ou cancela a confirmação do REINICIAR); o campo do token tem rótulo; Enter entra |

**Capturas:** `arte/servidor-painel-claude.jpg` e `servidor-relatorios-claude.jpg`. **Limite:** Chrome headless (SwiftShader); a janela não prende o foco do Tab.

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
| UI-1 | Início / pausa | **feito** (`claude/ui-inicio-pausa`); **substituído em 11/10 pelo console de comando (UI-6)** |
| UI-2 | Configurações em abas | **feito** (`claude/ui-configuracoes-abas`) |
| UI-3 | Hangar: tirar repetição e corte | **feito** (`claude/ui-hangar`) |
| UI-4 | HUD da partida: legibilidade e alinhamento (o painel de vida duplicado era um achado errado; ver a retratação) | **feito** (`claude/ui-hud-partida`) |
| UI-5 | Celular, lobby, fim de rodada, carregamento, banco | **parcial** (celular feito; fim de rodada, carregamento e banco sem captura) |
| UI-6 | Console de comando (início e pausa) | **feito** (`claude/console-comando`, P86 a P89) |
| UI-7 | Janela do esquadrão (monitor PILOTOS → ESQUADRÃO) | **feito** (`claude/esquadrao-editor`, P91) |
| UI-8 | Janela do servidor (monitor COMANDO → SERVIDOR) | **feito** (`claude/servidor-admin`, P93) |

Território: `client/src/ui/`, `styles.css` e `index.html` são do Gemini (`ESTADO_ATUAL`, divisão de trabalho). O dono pediu esta revisão ao Claude diretamente em 10/10; o Gemini tem a tela de login (`gemini/tela-login`) em andamento, com CSS próprio no fim do `styles.css`: os dois PRs mexem em trechos diferentes. Quem chegar depois junta a `main` e roda o `npm run check`.
