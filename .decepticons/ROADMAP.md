# ROADMAP — CYBERMECH

> Visão macro. O detalhe da semana fica em `ESTADO_ATUAL.md`; o estado real das features, em `STATUS_REAL.md`;
> o porquê de cada fase, em `GAME_DESIGN.md`.
> **Ordem decidida pelo dono em 2026-09-23:** combate → inimigos → multiplayer (ver histórico).
> **Reorganizado em 2026-09-24 (pedido do dono):** antes do multiplayer, uma fase de vitrine e polimento (som, celular, site com o case). As sobras da Fase 1 foram para ela.
>
> **Este arquivo alimenta o painel de missão** (`npm run painel`), e o `npm run check` reprova se ele sair do formato:
> - Fase: `## <emoji> FASE N — Título`; a fase em foco leva `(atual)` no título (só uma).
> - Item: `- [x]` feito, `- [~]` em andamento, `- [ ]` a fazer, terminando com **uma** etiqueta da tabela de frentes.
> - Ideias sem fase ficam em `## 💡 IDEIAS`, com o mesmo formato.

---

## FRENTES

| Etiqueta | Frente | O que cobre |
|---|---|---|
| `#jogabilidade` | Jogabilidade | movimento, câmeras, sensação de controle |
| `#modos` | Modos de jogo | CTF, missões em fases, deathmatch por equipes, desafios diários |
| `#combate` | Combate e armas | dano, armas, projéteis, retorno de acerto |
| `#ia` | Inimigos e IA | bots, dificuldade, comportamento dos pilotos |
| `#mechs` | Design dos Mechs | classes de Mech, modelos, animação |
| `#cenarios` | Cenários | arenas, destruição, ambientação |
| `#ux` | Interface e experiência | HUD, menus, primeira partida |
| `#som` | Som | efeitos, música, mixagem |
| `#rede` | Multiplayer | servidor, salas, netcode |
| `#desempenho` | Desempenho e resposta | FPS, hardware fraco, tamanho do download |
| `#base` | Base técnica | protocolo, testes, CI, deploy |
| `#negocio` | Lançamento e negócio | viralização, portal, monetização |
| `#universo` | Universo e narrativa | premissa, facções, geopolítica, termos de CTI, fichas das IAs, boletins |

---

## ✅ FASE 0 — Fundação
- [x] Vector-09: movimento, pulo duplo, dash, canhão de plasma #jogabilidade
- [x] 3 câmeras (3ª, 1ª, tática) #jogabilidade
- [x] Câmera de abate offline: segue o bot matador durante o respawn, enquadra os destroços no primeiro segundo, `V` cancela e a volta à câmera do jogador é suavizada; online aguarda decisão de PvP #jogabilidade
- [x] Arena com barricadas destrutíveis e destroços (só cosméticos) #cenarios
- [x] Loop de 60 Hz fixo com render interpolado #base
- [x] Protocolo Serafim UM: memória, hooks, smoke, budget, CI, Vitest #base
- [x] Game design v1 + princípios G11–G15 #negocio
- [x] Engasgo da corrida corrigido com teste #jogabilidade
- [x] (Gemini) Qualidade adaptativa (G12), painel de debug, HUD que some com F1 #desempenho
- [x] Bundle de 1.182 → 188 KB gzip (Rapier com `.wasm` separado) #desempenho

## ✅ FASE 1 — Combate
- [x] Dano por parte: a parte sai da altura e do lado do impacto na cápsula (sem colisor extra); dano em parte destruída vai para o torso #combate
- [x] Projéteis acertam Mechs; o tiro atravessa destroços (só cosméticos) #combate
- [x] Efeitos: perna = lento, duas pernas = imóvel, braço direito = sem plasma, torso = morte #combate
- [x] Morte com explosão (a carcaça vira destroço) e respawn #combate
- [x] Alvos de treino (Mechs parados) para testar o combate antes dos bots #ia
- [x] Retorno de acerto: marcador, parte destruída anunciada, flash de dano, peça arrancada vira destroço #combate
- [x] Testes de simulação para cada regra de dano (G14) #base

## ✅ FASE 2 — Inimigos
- [x] `BotController`: gera o mesmo `MechInput` que o jogador (patrulha, persegue, atira, recua) #ia
- [x] Visão por raycast, erro de mira e tempo de reação por dificuldade, RNG com semente (G2) #ia
- [x] Jogador morre e renasce; renascimento longe dos inimigos (`Respawner`) #combate
- [x] HUD do próprio Mech (6 partes), borda de dano, tela "ABATIDO", abates/mortes #ux
- [x] Painel de missão do projeto, gerado deste arquivo #base
- [x] Painel no visual de HUD cyberpunk das antigas (Shadowrun, BattleTech): mapa hexagonal, slots críticos, ficha técnica do Mech lida do código #base
- [x] Site do projeto: jogo + painel em cybermech.online, publicado a cada merge ("build do dia") #base
- [x] Rodada de 5 min com placar (Tab), intervalo de 10 s e reinício automático com a arena restaurada #jogabilidade
- [x] Blind Mode (cabeça destruída) #ux
- [x] Níveis de dificuldade: fácil, normal (a de hoje, aprovada pelo dono) e difícil, trocáveis durante a partida #ia
- [x] Configurações (contrato + aplicação no jogo): sensibilidade, inverter Y, campo de visão, qualidade, dificuldade, painel de desempenho, teclas remapeáveis; salvas no navegador #ux
- [x] Tela de configurações (Gemini, sobre o contrato `core/Settings.ts`) #ux

## 🟡 FASE 3 — Vitrine e polimento
- [x] **Site no nível de portal de jogo (Claude, P172, 16/10):** sistema de design permanente, fotos cinematográficas dos Mechs reais, landing/oficina/sala de controle no mesmo visual; falta o olho do Comandante, Hangar/Arsenal próprios e Pilotos #ux
- [x] **Landing editorial e primeiro acesso (Codex, P169, 16/10):** identidade preto/amarelo, imagens dos Mechs reais, atributos do catálogo, navegação de câmeras, textos profissionais e guia inicial; check completo e prova visual desktop/celular #ux
- [x] Efeitos sonoros: tiro, impacto, passos pesados, explosão (sintetizados, sem arquivos pesados) #som
- [x] Volume e mixagem nas configurações #som
- [~] Controles de toque e layout para celular (Gemini no PR #17, refeito pelo Claude; o check joga num celular emulado; falta o dono confirmar num celular real) #ux
- [x] Kill feed e indicador de direção do dano (Gemini; integrado e corrigido pelo Claude) #ux
- [x] Celular: mira assistida só no toque (freia perto do inimigo, puxa de leve, acompanha e antecipa o movimento dele) e tiro automático, desligáveis nas configurações #jogabilidade
- [x] Mira que acende sobre um inimigo (toque e mouse) #ux
- [x] Calibragem do Vector-09: menos velocidade (12 m/s) e calor na arma (superaquece e trava; rajadas rendem mais que segurar o gatilho), para jogador e bots #combate
- [x] Paleta neon multicolorida no jogo (verde neon, vermelho, laranja, amarelo; nunca só azul e roxo): jogador amarelo com visor verde, IAs rebeldes vermelhas #cenarios
- [x] Nome do jogo: CYBERMECH (sem o "Protocol") #negocio
- [x] Marca SERAFIM WEB: vinheta de abertura no jogo (emblema, letreiro e som sintetizado, ~2 s, pula com clique) e abertura com chuva de pontos verdes na página do jogo; assinatura discreta na pausa, na versão e nos rodapés #negocio
- [x] Cidade estilo Tron: prédios e barricadas em ciano, pink, amarelo fluorescente, verde; grade ciano; horizonte com faixas neon e céu estrelado #cenarios
- [x] Tema "defender contra IAs rebeldes" e escalas de robô; escala 1: andróide rebelde (~2 m), ágil e frágil, com IA de bando (3 na arena) #ia
- [x] Andróides mais chatos que perigosos (2 tiros derrubam, tiro de 4, mira solta) e o técnico (T-01), que conserta os Mechs rebeldes e foge do jogador #ia
- [x] Vibração no celular ao levar tiro e ao abater #ux
- [x] Botões do toque em arco em volta do polegar (FOGO para dentro da tela) e editor para arrastar e mudar o tamanho, salvo no aparelho #ux
- [~] Ajuste fino da mira no celular com o playtest do dono: velocidade do dedo suavizada; a ajuda solta o alvo quando o jogador puxa para longe #jogabilidade
- [x] Botão de placar no toque (no celular não existe Tab) #ux
- [x] Primeira partida guiada: dicas curtas no jogo (mire nas pernas, andar, foguetes, arco vermelho), uma vez só #ux
- [x] Gestão no GitHub: etiquetas automáticas por frente e por agente, modelo de PR, notas de versão por frente #base
- [x] Página do jogo (landing) e bastidores do desenvolvimento (o case) no site, com capturas do jogo feitas a cada deploy #negocio
- [x] Bastidores com a atividade da equipe: commits por agente, mapa de calor por hora, fluxo de commits e entregas, pedidos do dono atendidos (tudo do git e dos PRs) #negocio
- [x] Arma secundária: foguetes no braço esquerdo (botão direito ou Q; FOGUETE no toque), 4 no carregador, dano em área #combate
- [x] Som dos foguetes: disparo e voo (Gemini) #som
- [~] Narrador do jogo (ordem P146, 15/10): 19 falas em 4 sotaques (br, en, ru, cn) e modo mistura, escolha em Configurações, `npm run vozes` com o ElevenLabs, 34 testes (Claude); **vozes escolhidas e "combate" gerado nos 4 sotaques; faltam 72 clipes** (`npm run vozes -- --gerar --sim`, comando do Comandante) #som
- [~] Sons de arma a partir das referências do Comandante (P146): 7 armas com amostra (`npm run sons`, `npm run ouvir`), 30 testes; **falta o ouvido do Comandante**; ficam a rotatória e o canhão automático (som em laço), os sabres e os radares (sem arma nem aviso ainda) #som
- [~] Estúdio de Sons (ordens P150 e P155, 15 e 16/10): `npm run estudio` — cortar na onda, **efeitos por clipe (tom, velocidade, compressor, eco…)**, **importar e registrar**, prévia com o mesmo ffmpeg do final, tabela de todas as armas; hub de módulos ao lado da Mesa; 32 testes, 6 mutações e uma bancada em Chrome real (Claude); **falta o Comandante usar** #som #ux
- [~] Estúdio, aba VOZES (ordem P151): gravar a própria voz no navegador (medidor, tomadas), tratar com os mesmos efeitos (predefinidos de locutor), salvar como a fala do jogo, proteger do `npm run vozes`, voltar para a voz gerada; 12 testes, 6 mutações e a bancada com o microfone de teste do Chrome (Claude); **falta o Comandante gravar** #som #ux
- [ ] Estúdio, item no console de comando ao lado da MESA DE VÍDEO (ordem P156): verifica se está ligado e mostra o comando; PR próprio por causa da trava de layout #ux
- [ ] Estúdio, abas TIROS E ARMAS e MECHS 3D (ordem P157): cor, forma, cauda, explosão e brilho em dado + cena do Three.js ao vivo; força com o relatório de equilíbrio; importar `.glb` pelo `mech:inspecionar` (desenhadas em `ESTUDIO.md` § 3.2 e § 3.3) #ux #combate
- [ ] Voz própria do Comandante com efeitos (ordem P151, 15/10): ele grava as falas, o Claude monta o processador de locutor (`npm run voz`); alternativa: ElevenLabs Voice Changer #som
- [x] Arsenal em três níveis de poder (MK I, II, III) com a mesma regra; dano recalibrado com metas de tempo para derrubar travadas por teste; calor do Mech compartilhado entre as armas; plasma perde força com a distância #combate
- [x] Projeto do Hangar (chassi, encaixes, carga, níveis, dissipador) e a seção dele na página do jogo, com o arsenal lido do código #mechs
- [x] Calor completo do Mech: tiro (coeficiente por arma), corrida, pulo, dash e dano esquentam; parado esfria em dobro; superaquecido trava armas, pulo e dash; bots param para esfriar #combate
- [x] Oficina no site: bancada de testes gerada pela simulação do jogo (calor por ação, dinamômetro, dano por parte e por distância, chassis) #combate
- [x] Oficina: o grafo da arquitetura (a constelação dos módulos e das dependências, lida dos imports do código; desenhada no cliente sem biblioteca) #base
- [x] Gestão nos bastidores: quadro Agora/Próximo/Depois com código por item, burn-up do escopo, linha do tempo das fases com estimativa, matriz frentes × fases e as quatro métricas DORA de entrega contínua #negocio
- [x] Hangar: contrato da montagem (`LoadoutSpec` + `validateLoadout`, carga de 11 t no Vector-09), montagem salva no aparelho e link de build (`?build=`), com testes #mechs
- [x] Hangar: tela de montagem com preview 3D ao vivo, armas e níveis nos braços, carga, calor, simulação de combate, gravação local e link compartilhável #ux
- [x] Gravação nativa de gameplay em alta qualidade (F9, tecla escondida, só para o dono): captura direto do WebGL, sem OBS, com áudio do jogo (Claude, 28/09) #ux
- [x] Segundo piloto selecionável no Hangar: andróide A-1 com blaster e motosserra (troca recarrega a partida) #mechs
- [x] Hangar 2.0, camada 1: galpão 3D próprio com pedestal de holograma, o Mech girando, armas aplicadas na hora #ux
- [x] Hangar 2.0, camada 2: interface holográfica no desenho da referência, versão de celular #ux
- [x] Hangar 2.0, camada 3: testar disparo num alvo do galpão e montagens salvas 1 a 4 #ux
- [x] Treino manual de mira no Hangar contra andróide móvel que não ataca; mesma sensibilidade do mouse, contagem local de acertos e precisão; PR #95 mergeado e CI verde; aguarda playtest do dono #ux
- [x] Bots com personalidade (brabo, manso, fujão, soldado) e diretor de ataque: no máximo 2 atacando juntos, os outros esperam a vez #ia
- [x] IAs rebeldes com nomes de IAs e o nome sobre a cabeça #ux
- [x] Nomes de paródia no lugar das marcas: CLAWD, GEMINAI, CHAD-GPT, KUEN, DIPSIK, MISTRAU, ENTRÓPICO #universo
- [x] Andróides com motosserra (só corta encostado, pega as pernas do Mech) e pisão dos Mechs (andar para cima de um andróide encostado: 2 passos matam) #combate
- [x] Jogar de andróide: chassi `android` no Hangar (blaster + motosserra), câmera na escala dele para os Mechs parecerem gigantes, troca na pausa #mechs
- [x] Peso dos Mechs (9 m/s, inércia, passos com som e tremor) e andróides de 1,6 m #mechs
- [x] Modelos de ficha de design (robô e arma) e a ficha do Vector-09 como exemplo (pasta `fichas/`) #mechs
- [x] Sala de controle (antigos bastidores): novidades, mesa do Dan e o processo criativo das fichas, lidos dos documentos #base
- [x] Atualização automática do servidor de jogo: puxa a `main` a cada 10 min, só troca o código depois de passar por typecheck e testes, reverte sozinho se falhar; nunca toca o servidor no ar sem verificar antes (Claude, 28/09) #base
- [x] Métricas de produto: funil de cliques da landing, boot, início/fim de partida e troca de modo, contados no servidor de jogo sem IP nem identificação pessoal (Claude, 28/09) #negocio
- [x] Chuva de mísseis com desenho próprio: morteiro nas costas apontando para cima nos Mechs procedurais, em vez do casulo do braço (Claude, 04/10) #combate
- [x] Dados do servidor (banco de contas, métricas, token, log) numa pasta fixa fora da worktree do código, por `CYBERMECH_DADOS` (Claude, 04/10) #rede
- [x] Origem das conexões: país de cada jogador (Cloudflare, só país), por dia, com recusas por motivo e pico de jogadores, gravado em disco e visto na página privada `/metricas/` com token (Claude, 04/10) #negocio
- [x] Fichas propostas do Mech leve e pesado, andróide e 4 armas; stats não existentes seguem pendentes #mechs
- [x] Calor com fôlego: ~15 tiros segurando, trava de ~2 s, superaquecido anda a 75% #combate
- [x] Potências: painel do dono por arma e por clã, com o efeito na luta e aviso de apelação, salvo e por link #combate
- [x] Diretor de ataque com fila justa: fim do turno vai para o fim da fila, quem espera mais vai primeiro #ia
- [x] Conceitos visuais fornecidos pelo dono e traduzidos em blueprints procedurais leve/médio/pesado; 9 malhas articuladas por rig, captura de silhuetas no PR (Codex) #mechs
- [x] Inimigos configuráveis: quantidade de Mechs e andróides, técnico, personalidade de cada Mech e quantos atacam juntos #ux
- [x] Setas de inimigos fora da tela (Gemini; concluído pelo Claude com a revisão) #ux
- [x] Sons dos andróides: tiro e pouso, mais baixos de longe (Gemini; integrado pelo Claude) #som
- [x] Zonas de cura e resfriamento na arena (dono: "preciso de um lugar pra recuperar a vida, ou um resfriador pra ter mais fôlego"): vantagem de posicionamento igual para os dois lados, custo de rede zero #combate
- [x] Abertura da rodada ("RODADA 1 · 3·2·1 · COMBATE!") com locução sintetizada (Gemini) — ligada ao relógio do intervalo; locução pt-BR opcional (Claude, 13/10) #ux
- [x] Aviso de ABATE e de sequência de abates, com som próprio (Gemini) — `combate/killStreak.ts` + `KillBanner` ligados (Claude, 13/10) #ux
- [x] Tela de carregamento com barra de progresso e dicas (Gemini) — a barra e a dica moram na tela de carregamento do console (Claude, 13/10) #ux
- [~] Homologar FPS e frame time num notebook com GPU integrada: diagnóstico de shaders medido na Iris Xe em 09/10; custo estável dos efeitos e playtest do dono ainda pendentes (`EVOLUCAO_TECNICA.md`) #desempenho
- [x] Travadas de 1,5 a 2 s por compilação de shader no primeiro uso: pré-compilação no carregamento, `forceSinglePass` na faixa do tiro e buffer de cor dos destroços (09/10; medido na Iris Xe: 0 programas compilados em jogo, 1 travada ≥ 300 ms contra 3 a 4) #desempenho
- [x] Hangar: reduzir passadas dos hologramas aditivos e impedir GLB atrasado de trocar a seleção atual (Codex, 09/10: Vega 11, 102→94 draw calls no enquadramento medido; três testes de corrida) #desempenho
- [ ] Custo estável dos efeitos visuais novos (céu, chão com textura, janelas, sombra, faixa): medir com A/B alternado na mesma sessão ou timer de GPU e fazê-los respeitar a qualidade adaptativa nas máquinas fracas #desempenho
- [~] Pré-compilar também a cena do Hangar, os robôs `.glb` e os robôs remotos do online: Codex executa C1 (Hangar/montagem atual), C2 cobre criações posteriores; plano e aceite em `EVOLUCAO_TECNICA.md` #desempenho
- [x] Render dos robôs: 9 draw calls por Vector-09 e por andróide, uma malha combinada por pivô articulado (antes ~34), com as peças ainda destacáveis (Codex, PR #43) #desempenho
- [x] Sinais visuais de calor no rig: emissivo progressivo e vapor no superaquecimento, sem alocação por frame e até 10 draw calls (Codex; check verde) #mechs
- [x] **Encaixe de arma no pulso (o punho sem dedos):** as mãos somem e a arma da montagem se encaixa como módulo desenhado (plasma, foguetes, blaster, motosserra × MK I–III), que troca com o nível e a arma no Hangar; hoje só no Marauder; contrato em `MECHS_IMPORTADOS.md` #mechs
- [ ] **Levar o encaixe de arma aos Mechs procedurais** (hoje cano e casulo fixos no antebraço) e **fixar o ponto de tiro por chassi** no `MechStats`, igual no servidor e no cliente (G14; `FINDINGS.md`) #mechs
- [x] **Chuva de mísseis:** a primeira arma de área (sobe e cai em 8 bombas num círculo de 9 m, com aviso no chão), no braço esquerdo do Vector-09, Colossus e Onça e nos ombros do Marauder; módulo `BarrageSystem`, protocolo 3, guia `ARSENAL.md` #combate
- [x] **Marauder com duas armas nas mãos e lançadores nos ombros:** blaster nas duas mãos (botão principal) e um lançador de foguetes em cada ombro (botão secundário), terceiro encaixe OMBROS no Hangar; regra de tiro única do jogador e do servidor (`combat/Armament.ts`), boca de cada encaixe como dado do chassi (`npm run mech:bocas`); o gatilho esquerdo passa a aceitar arma de energia (Arara, Onça) #mechs
- [x] **Escopeta do Lancer-L1:** arma de energia nova (52 de dano, dano cheio só até 8 m, 8% aos 45 m), braço esquerdo com escudo e sem arma (o HUD esconde o bloco de foguetes), online no protocolo 2; o escudo ainda não bloqueia dano #combate
- [x] **Inspetor de robô importado (`npm run mech:inspecionar`):** lê o `.glb`, confere o contrato de `MECHS_IMPORTADOS.md` (skin, ossos, frente, T-pose, mão com dedos, tamanho), sugere a entrada do `IMPORTED_CHASSIS` e fotografa o Hangar e a passada #mechs
- [x] FX: explosões, impactos, fumaça e destroços com escala animada; pool explícito de 3000 partículas sem alocação por frame #desempenho

## 🟠 FASE 4 — Multiplayer autoritativo
- [x] Plano técnico (`MULTIPLAYER.md`): pré-requisitos, arquitetura, orçamento de banda, contratos, etapas M0–M8 #rede
- [x] M1: partida sem tela (`sim/Match.ts`): a partida inteira roda no Node sem WebGL nem DOM, determinística sem destroços, 0,74 ms por tick com a sala cheia. Ainda cria objetos de render e o tiro do jogador sai do modelo desenhado (`MULTIPLAYER.md`, seção 8) #rede
- [ ] Separar simulação, render e efeitos: tiro do jogador e yaw pela simulação, efeitos por eventos, sem objetos de cena na simulação (proposta e critérios em `MULTIPLAYER.md`, seção 9; decisão do dono) #rede
- [x] Landing: seção do online com o ritmo da rede lido do código (a lista de etapas fica na sala de controle; o tamanho em bytes, só no repositório — pedido do dono, 27/09) #negocio
- [x] Landing: título de uma linha só e botões numa linha própria, sem sobrepor o link "como é feito" (Claude, 28/09) #negocio
- [x] M2: contratos de rede (`NetInput`, estado de cada unidade, eventos, mensagens) e codec binário com teste de tamanho: sala cheia em ~6,2 KB/s #rede
- [x] M3: servidor de jogo (`server/`, Node + `ws`): salas por código, a partida a 60 Hz com os bots, estado a 20 Hz, `npm run server` no PC de casa #rede
- [x] M4: jogo online pelo link (`?sala=&servidor=`): previsão do seu Mech com correção pelo servidor, robôs remotos interpolados, tiros e abates dos outros #rede
- [x] Jogar online com um clique: botão na landing e na pausa, sala pública com a próxima abrindo quando enche, volta ao offline com o servidor fora #rede
- [x] Servidor público no ar 24 h: domínio, túnel nomeado da Cloudflare e `GAME_SERVER_URL` no GitHub (dono; 26/09/2026: `jogo.selvamkt.com.br` no túnel Cloudflare, servidor em `127.0.0.1:2567` no PC de casa, tarefa do Windows, PC sem sleep) #rede
- [x] Prova R16: 2+ clientes reais jogando na mesma sala (26/09/2026: dois aparelhos do dono, primeira sessão online ponta a ponta) #rede
- [x] Barricadas quebrando pelo servidor (`PROP_BROKEN`) e volta na rodada nova (`ARENA_RESET`); placar do jogador feito pelos `KILL` do servidor #rede
- [x] Status do servidor na página: `GET /status` no servidor de jogo; a landing e a pausa mostram online/fora do ar e quantos pilotos estão em combate agora, sem abrir conexão de jogo (Claude, 28/09) #rede
- [x] M5 (parcial): o servidor emite `EVENT.HIT` (quem levou, de quem, parte e dano aplicado), com teste de simulação #combate
- [~] M5: completar retorno de `EVENT.HIT`: dano recebido já consumido em `OnlineSession.onEvents`; marcador de acerto do atirador ainda pendente (auditoria Codex, 09/10) #ux
- [ ] M5: compensação de latência; precisa de decisão de projeto antes do código (`FINDINGS.md`, seção M5) #combate
- [ ] M6: entrada pelo link com código da sala + apelido; reconexão automática (G13) #rede
- [ ] Telas do online: apelido, código da sala, jogadores, placar e ping (Gemini) #ux
- [ ] Medir banda por sala e tick do servidor contra as metas do G11 e do G14 #desempenho

## 🔵 FASE 5 — Modos, missões e novidades semanais (atual) — o jogo que puxa o jogador de volta amanhã

Ver `VISAO.md`: novidades quase toda semana, cada uma com balanço nos testes; o que atrai gente pra testar, se desafiar e voltar.

- [x] **Interface CTF e Placar de Times (CtfHud):** placar Azul vs Vermelho, badges de posse de bandeira, banners de evento animados (`showEventBanner`), com testes #modos
- [x] **Sobrevivência solo em Ondas:** cinco hordas progressivas (20 abates no total), briefing/intervalo, derrota/vitória, estatísticas e reinício; pool fixo de até 3 Mechs + 3 andróides, seletor na pausa e HUD de missão. Online fica para um contrato de rede próprio #modos
- [x] **CTF Vermelho × Azul — treino offline jogável:** uma bandeira em cada base, dois defensores, captura só com a própria bandeira em casa, queda/retorno, portador 15% mais lento, três capturas ou desempate em 8 min; regra pura no `Match`, HUD, bases/bandeiras holográficas em cinco draw calls e seletor na pausa #modos
- [ ] **CTF 2v2 online autoritativo:** times no contrato de sala, eventos de bandeira/captura no protocolo, bots preenchendo vagas e validação de banda; o treino offline não anuncia suporte de rede #rede
- [ ] **Missões em fases (cooperativo ou solo):** **pedido do Comandante em 12/10 (P99)** — **cenários maiores** e quatro tipos de missão: **escolta** (proteger quem se move), **ataque**, **defesa de base** e **contraataque** (defender e depois retomar — o tipo novo que o pedido acrescenta à lista original). O plano segue: 3-5 fases com objetivos crescentes, um evento de rede novo (`OBJECTIVE_STATE`) e um mapa por missão; **a primeira missão** é a escolta/defesa do técnico ENTRÓPICO, que reusa o que já existe (`DIVERSAO.md` § 10 #7) — **com um ajuste de contrato** (auditoria de 12/10: o papel `t` existe **só nos inimigos**; o técnico aliado é código, do Claude) — **a ficha dela está pronta:** `fichas/escolta.md` (proposta Qwen, 12/10: três fases, 13 testes especificados, 0 arte nova, offline primeiro) — **e as outras duas também:** `fichas/ataque-e-defesa.md` (proposta Qwen, 12/10: o **ataque**, a **defesa de base** e o **contraataque como o fim da própria defesa**, 15 testes especificados) #modos
- [~] **Cenário de missão com rota** (pedido do Comandante, 12/10 — P99; **o cenário abre no jogo, a ESTAÇÃO DE CABOS é jogável pelo console (P126 passo 4) e já roda a missão em ondas na praia (passo 5): falta o núcleo/contraataque**): escolta e contraataque pedem um **caminho longo**, e a Arena tem 200 m — um mapa de missão maior, com pontos de emboscada e uma base a defender e retomar, **antes** do mundo com streaming e *interest management* dos 32-64 jogadores (Fase 7) — **a ficha está pronta:** `fichas/cenario-cabos.md` (proposta Qwen, 12/10: **ESTAÇÃO DE CABOS**, rota de ~500 m, duas vias por trecho, 10 testes e a bancada no padrão do Bunker) #cenarios
- [x] Registro de pedidos do dono (`ORDENS_DO_COMANDO.md`), regra 17 e placar de resultado: nada que o dono pede fica só no chat, e dá para ver se o jogo melhora de verdade (Claude, 10/10) #base
- [ ] **Painel admin completo** (dono, 10/10; plano em `PAINEL_ADMIN.md`; **a casa dele é o console de comando, de 11/10**): faltam as telas que pedem dado novo (Oponentes, Campanha, Arsenal e chassis, Servidor, Evolução); começa pelos contratos `BotSpec` e `CampanhaSpec`, depois a simulação, depois as telas #ux
- [x] Prompt e roteiro do Tripo3D para o próximo robô, e auditoria das pastas de modelos: dois `.glb` de 78 MB removidos do repositório (Claude, 10/10) #mechs
- [x] Envio automático à prova de token morto: `node scripts/gh.mjs` (fallback para a credencial do Git) e `npm run publicar` (push, PR, CI, merge e limpeza com travas), 21 testes (Claude, 10/10) #base
- [x] Deixar o link do Bunker visível na tela inicial: virou o seletor MAPA (Arena/Bunker) da pausa (Claude, 10/10) #ux
- [x] Auditoria de interface (`AUDITORIA_INTERFACE.md`) e UI-1: painel de início/pausa limpo, cabe em 1280×720, sem HUD por trás (Claude, 10/10) #ux
- [x] **UI-2:** Configurações em abas (Jogo, Controles, Gráficos e som, Avançado), altura fixa, rodapé sempre visível (Claude, 10/10) #ux
- [x] **UI-3:** Hangar sem repetição nem corte (carga duas vezes, X e VOLTAR, link cortado, slots truncados, lista de chassis, módulo antes dos braços, painel aberto rolado) (Claude, 10/10) #ux
- [x] **UI-4:** HUD da partida: rótulos legíveis, barras alinhadas, ordens aos aliados discretas (a "vida duplicada" do achado D1 estava errada e foi retratada) (Claude, 11/10) #ux
- [x] **UI-5 (celular):** o painel de ordens aos aliados saiu de cima do analógico no celular deitado (Claude, 11/10) #ux
- [x] **Console de comando (P86 a P89): a tela de início e de pausa virou uma sala de comando** com monitores (teatro de operações com mapa-múndi tático e as missões, radar tático, seu Mech, pilotos, carreira, rede, configurações), a mesa de operação (modo e botão verde, tecla Enter) e o modo Comandante (`?comandante=1`) com Potências, Mesa de vídeo, Sala de controle e Oficina; escala tipográfica de laptop a 1440p e celular, atalhos no teclado, tela de carregamento e botão que acende pronto; 50 testes (Claude, 11/10) #ux
- [ ] **Console: os lugares das missões** (Manaus, Brasília, Foz do Iguaçu e São Paulo são propostas "a confirmar"; só Fortaleza vem do `UNIVERSO.md`) e as três missões que faltam construir (estação de cabos, barragem, fábrica de chips) #ux
- [ ] **Console: estrangular o desenho 3D da arena com o console à vista** (ele é opaco e o jogo ainda desenha a cena por trás; mexe no `frame()` e no `Quality` adaptativo, e o smoke confere os draws) e **mostrar os jogadores online no radar** #ux
- [x] **Fase 3A e 3B · O mural de câmeras ao vivo (P88):** a janela CÂMERAS AO VIVO do monitor COMANDO (`ui/CameraWall.ts`): um radar por partida aberta, alimentado por um canal só (`/?mural=1`, `shared/net/mural.ts`, `server/mural.ts`: 4 Hz, ~0,45 KB/s por sala, com o token do dono, sem ocupar vaga) (Claude, 12/10) #rede
- [ ] **Fase 3C · A câmera 3D de uma sala (P88):** `OBSERVAR(sala)` (um estado de jogo inteiro, uma sala por vez, só com o token do dono) e a `SpectatorCam` no jogo #rede
- [ ] **`scripts/gh.mjs` também para `gh api` e `gh run`, e um `npm run ci:log`:** hoje o fallback só reautentica em erro de autenticação (401; de propósito: um 404 de verdade não se repete) e, sem token, `gh api` e `gh run` respondem 404 ou 403 anônimos; ler o log de um CI vermelho exigiu um script em `.tmp/` (receita em `FERRAMENTAS.md` §6); o certo é uma ferramenta com teste que mostre o passo e o log do `check` de um PR (Claude, 12/10) #base
- [ ] **Aviso de boot lento no smoke:** imprimir "boot lento" a partir de 20 s (o teto é de 30 s e o CI varia de 8 a 20 s), para a deriva aparecer antes de virar timeout; o console completo visível durante o carregamento já custou +5 s (Claude, 12/10) #base
- [x] **`npm run mesa` e o item MESA DE VÍDEO do console:** liga a mesa de vídeo local (idempotente, abre o navegador, atalho de duplo clique no Windows) e o console verifica se ela está ligada antes de abrir (P92; Claude, 12/10) #ux
- [x] **Fase 1A e 1B · O esquadrão na partida (P91):** o contrato `BotSpec` e `EsquadraoSpec` (`sim/esquadrao.ts`), os pontos de nascimento extras conferidos pela física (`sim/nascimentos.ts`), `Match` e `BotSystem` montam o esquadrão (o padrão é o jogo de hoje, provado por fotos tick a tick), a arma decide a distância de tiro do bot, link `?esquadrao=` e esquadrão salvo no aparelho; teto medido (24 inimigos, 12 aliados, 32 no total) (Claude, 12/10) #modos
- [x] **Fase 1C · O editor do esquadrão no monitor PILOTOS (P91):** a janela do esquadrão (`ui/SquadPanel.ts`, modelo puro em `ui/esquadraoEditor.ts`): duas listas, ficha do robô, seis esquadrões prontos, carga da máquina, SALVAR E REINICIAR, COPIAR LINK e DESFAZER; fecha a "Ficha de cada bot" do monitor COMANDO (`PAINEL_ADMIN.md` §8) (Claude, 12/10) #modos
- [ ] **Esquadrão no servidor e no online (P91):** salas com esquadrão próprio (hoje o servidor segue com 3 Mechs, 3 andróides e o técnico, sem aliados; o roster de rede ainda não descreve aliado) #rede
- [ ] **Teto de vozes do áudio:** com 32 robôs são ~16 passos simultâneos; medir em máquina fraca e, se preciso, limitar as vozes de bot em `AudioSystem` #som
- [x] **Fase 2 · Servidor na interface (P93):** rotas `/admin/*` com token do dono (estado, histórico, log, avaliar, testar, fechar sala, reiniciar; `shared/net/admin.ts` e `server/admin.ts`) e a janela do monitor SERVIDOR (`ui/ServerPanel.ts`): estado ao vivo, gráficos da última hora, salas, log, AVALIAR, TESTAR e REINICIAR (Claude, 12/10) #rede
- [x] **Prova real do REINICIAR em produção (P93):** a 3ª tentativa (12/10, 21:44, 0 jogadores, ajudante pelo WMI) PASSOU: voltou em 16 s (Claude). Histórico: as 2 primeiras FALHARAM. — as 2 primeiras tentativas (12/10, 0 jogadores) FALHARAM (o Agendador não religa quem sai com código ≠ 0; e o ajudante lançado com `spawn` morre com o pai). Conserto: o ajudante criado pelo WMI (PR `claude/religar-wmi`). Repetir com 0 jogadores depois do deploy: `/status` voltando com o uptime zerado em segundos e `religar.log` com "religou"; se falhar, o log diz onde, e o plano C é a tarefa em laço (exige administrador) #rede
- [x] **Publicação do site pelo PC, automática e de graça (P105):** `npm run publicar-site` (montar, `tar` | `ssh`, checksum), disparado pelo atualizador a cada versão nova; `publicar --sem-ci`. Primeira publicação real em 66 s (13/10). Falta ver o disparo automático (Claude, 13/10) #base
- [x] **Uma chave só para o servidor (P106):** a sessão de uma conta `is_admin` vale em `/admin/*`, no mural e em `/metricas`; o login de admin do Hangar guarda a sessão (Claude, 13/10) #rede
- [x] **Fase 4A e 4B · A campanha (P27, P54, P107):** `sim/campanha.ts` (etapas com mapa, modo, esquadrão e meta; link `?campanha=`), a janela CAMPANHA no monitor COMANDO (fábrica, editar cópia, salvar com nome, copiar link), a faixa da etapa e o painel do fim dentro da partida; a Operação Neon de fábrica. Offline (Claude, 13/10) #modos
- [x] **Os Colossus como bots inimigos (P108 a):** `CHASSIS_DOS_BOTS` com os titãs (até 2, só inimigos, só Arena), `combat/titaBot.ts`, `PONTOS_DOS_TITAS` medidos pela física, volta em 60 s (Claude, 13/10) #modos
- [x] **A mão esquerda do bot (P108 b):** `BotSpec.secundaria` no contrato, no link `?esquadrao=`, na IA (atira junto, com a cadência e o calor dela) e na ficha (Claude, 13/10) #modos
- [ ] **Ombros, módulo e layout de ataques do bot (P108 c):** a ficha só deve oferecer o que a IA sabe usar; o módulo primeiro (a IA liga a barreira ao levar dano de frente) #modos
- [x] **Fase 4C · ARSENAL (armas e chassis):** a janela só de leitura no monitor COMANDO, com os números do catálogo; a Evolução é a Sala de Controle do site (já linkada no COMANDO), sem duplicar (Claude, 13/10) #ux
- [ ] **Potências por chassi (P27/P54):** multiplicar vida e passo por chassi, como já se faz por arma e por clã; regra de equilíbrio nova, decisão do Comandante #modos
- [ ] **Fase 5 · Pendências do Gemini e do Codex (P94):** a branch `gemini/game-hq`, os itens `(Gemini)` do roadmap e o que for de código das frentes C2 a C5 do Codex (`PAINEL_ADMIN.md` §8) #ux
- [x] Mira fina (1 px, 38 px, translúcida, ajustável) e menos luz nos tiros (faíscas, clarões, bloom ajustável): medido −46% de brilho somado pelo tiro (Claude, 11/10) #ux
- [x] **Efeito visual do estado no corpo do inimigo:** o casco ganha a cor do estado (azul-gelo, laranja que tremula, azul elétrico, amarelo) e o corpo solta vapor, chama, faíscas e estrelas; o dono não percebeu o congelamento (P62; Claude, 11/10) #combate
- [ ] **Hangar: lista de armas única para os dois braços** (as listas da direita e da esquerda diferem: a rotatória só vai na direita, os foguetes só na esquerda; padronizar, exceto onde o braço não permite) e **melhor disposição das armas no desenho do corpo** (P65/P68; o dono respondeu: "os dois") #ux
- [x] **Partículas com forma e impacto por família de arma:** atlas de 13 formas (floco de seis braços, caco, língua de fogo, faísca alongada, anel, nuvem, estrela, raio, cartucho, ponto, hexágono, onda); plasma, elétrica, gelo, EMP e bala de metal batem cada uma do seu jeito; rastro de flocos no gelo; fogo e choque com forma (Claude, 11/10; P69) #combate
- [x] **Canhão pesado (`cannon`: um obus de aço, 90 de dano a cada 2,6 s, só nos pesados) e canhão automático (`autocannon`: 5 tiros/s de aço, 10 de dano, em todo engate de energia)**, com corpo sólido de aço e cauda quente, clarão de boca (língua de fogo, fumaça, estojo que salta), fumaça no rastro do obus, impacto e som próprios; protocolo 12 (o dono pediu, 11/10: "um canhão grande de um tiro só e armas de tiros menores e sequenciais de metal"; P70; PR `claude/armas-de-aco`). **Falta o tranco/empurrão no alvo atingido (P69)** #combate
- [ ] **Desenho cinético para a rotatória, a escopeta e o trilho** (projétil de metal em vez de faixa de luz: o corpo de aço e o clarão já existem em `fx/kineticShot.ts` e `fx/muzzleFx.ts`, falta ligar a eles), rastros e caudas por família e **reação do inimigo ao ser atingido** (empurrão, tranco) (P69/P70) #combate
- [x] **Gelo com alcance menor (20 m cheio, 55 m no máximo) e rastro de bruma de frio; lança-chamas mais forte, longo e grosso (10 de dano, 20 m, 34°)** e fogo no corpo do inimigo com mais presença (o dono pediu, 11/10: "o gelo está indo muito longe e o fogo muito fraco e curto"; P72; PR `claude/fogo-e-gelo`) #combate
- [x] **Anel de fogo (módulo `fire`, P73):** terceiro módulo de escudo (3 t, 5 s ligado, raio de 7 m): não segura tiro, queima os inimigos num círculo em volta do Mech, **esquenta todos que estão dentro, inclusive quem o solta e os aliados**, e **derrete o inimigo congelado** com um estouro de vapor (combo gelo + fogo); protocolo 13; o dono pediu, 11/10 (PR `claude/anel-de-fogo`) #combate
- [x] **Lança-chamas de 30 / 39 / 48 m por nível, com mais pulsos e mais dano a cada nível; o tiro do Marauder sai da mão certa (evento de tiro com o encaixe, protocolo 14)** (o dono pediu, 11/10: "continua muito fraco e curto, deveria ser upado no MK II e ir mais longe e com mais pressão" e "no Marauder os tiros saíam só pela mão direita"; P76; PR `claude/fogo-longo-e-maos`) #combate
- [x] **Canhão sônico (arma só de ombro, onda em cone que empurra) e o empurrão no corpo (`MechBase.push`)** (o dono pediu, 11/10: "as armas de som combinam em ficar nos ombros"; P77; PR `claude/armas-de-ombro`, protocolo 15) #combate
- [x] **Classes de arma (leve, média, pesada) e o tamanho de cada robô (1 andróide, 2 Mechs, 3 e 4 gigantes); o gigante leva as pesadas dos Mechs como leves; o Hangar agrupa por classe** (o dono pediu, 11/10: "organizar melhor nosso arsenal"; P82) #combate
- [x] **A onda sônica vira anéis transparentes que distorcem o ar (refração, só enquanto há onda no ar), no jogo e no "TESTAR" do Hangar; o cartão do chassi com ombros diz OMBROS** (o dono pediu, 11/10; P83) #combate
- [ ] **Robô de tamanho 4: chegada do modelo, medição e as primeiras armas de tamanho 3 e 4 para ele** (o dono avisou, 11/10: "em breve trarei"; P85) #mechs
- [x] **Tipos de encaixe (braço, ombro, costas, peito, cabeça): cada arma declara onde cabe, cada ranhura tem um tipo e uma classe máxima, e um teste confere as listas de todos os chassis** (o dono perguntou, 11/10: "como fica a diferença entre armas de braço, ombro, costas, peito"; P84) #combate
- [x] **Ataque 1 e Ataque 2: o vocabulário do dono em todo o jogo (Hangar, HUD, menu, configurações, toque) e a regra por robô (pequenos: braço direito = 1, esquerdo = 2; grandes: braços = 1, ombros = 2), conferida por teste** (o dono pediu, 12/10; P95) #ux
- [x] **Layouts de gatilho configuráveis no Hangar e várias armas diferentes no mesmo ataque: o Marauder escolhe entre "braços no 1, ombros no 2" e "direito no 1, esquerdo e ombros no 2"; o layout vai no link, no JOIN e no roster (protocolo 17), e a `Armament` dispara a mão esquerda e os ombros no Ataque 2 cada um com a sua arma** (o dono pediu, 12/10; P95; PR `claude/layout-de-ataques`) #combate
- [ ] **(resto do P95) Mais layouts e mais robôs com opção de layout; costas e peito como encaixes do Ataque 2** (depende dos encaixes novos de § 7) #combate
- [ ] **Criar de verdade os encaixes de costas, peito e cabeça (tipo em `MOUNTS`, boca por robô, desenho, evento de tiro com mais bits, terceiro gatilho) e dar ombros a mais robôs** (P84; depende das três decisões do Comandante em `ARMAS_DE_BOTAO_2.md` § 7) #combate
- [ ] **Versões das armas para os tamanhos 3 e 4 (gigantes): médias e pesadas do tamanho 3, com desenho e números próprios** (o dono, 11/10: "futuramente"; P82; o contrato está em `ARSENAL.md`) #combate
- [ ] **Campanhas com chefe (P147):** o arco OPERAÇÃO CABOS ABERTOS em cinco capítulos, cada chefe um problema de organização (`CAMPANHAS_E_CHEFES.md`); primeiro o **Capítulo 1** (a Colossus em três fases, três nós do cabo, barra do chefe), depois a tela de campanha e os prédios de interior para andróides (P149). **O Comandante respondeu em 16/10 (§ 0 do documento: os cabos como pontos de invasão, as três frentes da estação, o quadro de luz, o banco, o elenco)**; falta construir, começando pelo capítulo 1 em fases #universo #modos
- [ ] **Decidir o armamento do chefe Colossus (hoje plasma e foguetes, médias) à luz das classes: trocar mexe no equilíbrio do encontro** (P82, decisão do Comandante) #combate
- [x] **Míssil teleguiado (arma de ombro): trava no inimigo mais centrado à frente, curva até ele, voa reto sem alvo** (o dono pediu, 11/10: "VARIAR as armas e tecnologias"; P77; PR `claude/missil-teleguiado`, protocolo 16) #combate
- [x] **Armas de míssil e laser (P152, o Comandante, 15/10): lançador de mísseis leve (8, 16 e 32 em sequência, o nível é o tamanho dele), míssil cruzador de longo alcance (arco), raio laser de longo alcance (feixe por pulsos) e o guiado de médio alcance recalibrado; faixas de alcance e recarga cheia fixadas por teste** (PR `claude/armas-e-municoes`, protocolo 18) #combate
- [x] **A cara dos tiros (P160, o Comandante, 16/10): explosão com corpo (bola de fogo low-poly, fumaça escura, estilhaços, onda de choque e queimado no chão), rastro em fita para foguete, míssil, cruzador, bombas e obus, clarão da boca e brilho da cabeça por família de arma, marcas na parede, o raio iônico do trilho e o Mech destruído que explode de verdade** (PR `claude/armas-impacto`; só desenho, regra intacta) #combate
- [x] **Escopeta com balins de verdade (P160, parte 2a): nove balins num cone fixo, um evento de tiro por disparo, dano medido com física de verdade; os balins do mesmo disparo somam num número e num som** (PR `claude/armas-balistica`) #combate
- [x] **Lança-granadas (P160, parte 2b): o primeiro tiro com gravidade; cai no ponto da mira, sobe por cima da cobertura regulando a carga, tabela na parede e crava no chão; a mira prevista em arco; protocolo 19** (PR `claude/lanca-granadas`) #combate
- [x] **O "Testar" do Hangar com a cara do jogo (P160, parte 3): cada tiro do teste com o clarão, o brilho, o rastro, a explosão e os feixes do jogo, na trajetória da família (reta, salva, balins, arco do cruzador, arco da granada); o dano do teste conta os balins** (PR `claude/hangar-testar-efeitos`) #combate
- [x] **Os rebeldes lançam a arma explosiva da mão esquerda (P160, parte 4): salvas de foguetes (o casulo de fábrica do Vector-09), granadas, teleguiado, lançador leve, cruzador e chuva, com carregador de verdade, pausa pela dificuldade e nunca de perto; o esquadrão pode dar essas armas aos bots** (PR `claude/bots-explosivos`) #ia
- [x] **Uma dica de primeiro uso para cada arma (P160, parte 5): a granada, o enxame e o cruzador deixaram de dizer "FOGUETES: DANO EM ÁREA"; cada arma tem a sua frase, uma vez só, com os números da própria arma** (PR `claude/dicas-por-arma`) #ux
- [ ] **Armas novas na mão do Comandante: jogar o lançador leve, o cruzador e o laser, ouvir o som e dizer o número que incomoda; som próprio do lançador leve e do cruzador; os bots passarem a usar o lançador leve e o laser** (`ARSENAL.md`, § Mísseis, laser e a calibragem) #combate
- [x] **Arpão magnético (P77, 3ª parte, 17/10): prende o primeiro inimigo à vista e o puxa; o dash e a parede cortam o cabo, só puxa quem é do mesmo peso ou mais leve (a regra do peso, P181) (protocolo 20)** #combate
- [ ] **Mais armas do botão 2 (drone de ombro, ultrassônico) e ombros para mais robôs (Bastion, Colossus); o cabo do arpão de outro jogador no online; o bot usar o arpão** (P77; custo de cada uma em `ARMAS_DE_BOTAO_2.md`) #combate
- [ ] **Encaixes de costas e de peito** (propulsor, minas, feixe térmico, reparo): contrato novo de encaixe (`MOUNTS` cresce no fim, bocas por chassi, desenho e Hangar) antes das armas (P77) #combate
- [x] **Gelo amigo (P78): o gelo de um aliado esfria o aliado** (tira calor e apaga o fogo, sem dano e sem congelar), com a regra de "mesmo lado" na partida (aliados da Arena offline, times do CTF e `setTeam`); fecha o combo com o anel de fogo (PR `claude/gelo-amigo`) #combate
- [ ] **Times na sala online (P81): dois amigos no mesmo time contra os outros** (o seu combo do anel de fogo com o gelo só vale online com isso): time no JOIN e no roster, balanceamento, fogo amigo e HUD de time; liga o `Match.setTeam` que já existe. Mesmo contrato que o CTF 2v2 online #rede
- [x] **Nome AVARIA no lugar de SINGULARIA** na capa do jogo (o dono pediu, 11/10; P79; PR `claude/nome-avaria`) #ux
- [ ] **Robôs CICUTA2 e ZEROCIRCUIT**: o dono precisa passar pelo Tripo3D (retopologia e rig) e enviar os `…RIG.glb`; os modelos atuais têm 1,9 milhão de triângulos e nenhum osso (P80) #mechs
- [x] **Reação do inimigo ao tiro: todo acerto empurra o alvo e dá um tranco no torso, na medida do dano que passou; o grande resiste; a explosão empurra para longe do centro** (o dono pediu, 11/10: "reação nos inimigos"; P69; PR `claude/reacao-ao-tiro`) #combate
- [ ] **Efeitos dos tiros, o que ainda falta de ponta a ponta:** formato, cor, rastro, cauda, faíscas, impacto e onde batem, por família de arma (P69/P70; a reação do inimigo ao tiro já está feita): **gelo = flocos de cristal de seis braços** (o dono mandou referência); **fogo com forma e comportamento próprios**; **EMP e som visivelmente diferentes** dos cinéticos; **tiro de aço** (cinético, metálico) que hoje não existe: todas as armas são de luz #combate
- [ ] **UI-5 (resto):** conferir em captura o fim de rodada, o carregamento e o terminal do banco (não há atalho de teste para o fim de rodada) #ux
- [ ] **Deathmatch por equipes 4v4 e 8v8:** escala do online atual, com equilíbrio de composição (o servidor evita "todos os pesados de um lado") #modos
- [ ] **Modo streamer:** sala de código fixo, câmera de espectador, sobreposição para OBS #negocio
- [ ] **Decidir câmera de abate no PvP:** seguir o adversário revela sua posição; escolher entre liberar, atrasar/limitar ou manter ausente no competitivo #rede
- [ ] **Nova arma toda semana** (com teste de balanço em `combat/balance.ts`; nenhuma abaixo do TTK do arsenal atual, nenhuma acima do teto de dano por segundo) #combate
- [x] **Armas elementais (pedido do dono, 09/10; plano, números e divisão em `ARMAS_ELEMENTAIS.md`):** efeitos de estado com tempo (queimando, chocado e atordoado, gelado e congelado) como contrato das quatro armas: simulação, servidor e rede, testado (PR-A, Claude, 09/10); nenhuma arma aplica ainda #combate
- [x] Metralhadora rotatória: a cadência sobe de 3 a 20 tiros/s em 1,2 s segurando o gatilho, cone que abre com a rotação, sem carregador (o calor é o freio), sem evento por tiro na rede (protocolo 8); simulação, servidor, Hangar e testes prontos (PR-B, Claude, 09/10); o medidor na mira e o som são do Gemini #combate
- [x] Arma elétrica: deixa o alvo chocado (lento, dano por segundo); o tiro bem dado atordoa 0,8 s e não encadeia; a chapa cerâmica isola e a de aço conduz; simulação, servidor, Hangar e testes prontos (PR-C, Claude, 09/10, protocolo 9); ícone, indicador de estado e som são do Gemini #combate
- [x] Lança-chamas: fluxo contínuo em cone de 14 m que atinge todos os que estão nele, deixa queimando, 6 s de combustível e 4 s de recarga, esquenta quem atira; só nos pesados; simulação, servidor, Hangar e testes prontos (PR-D, Claude, 11/10, protocolo 11) #combate
- [x] Arma de gelo: acúmulos de gelado até congelar (3 acertos, 1,5 s parado com +20% de dano, 5 s de imunidade); fogo e gelo se anulam; a cerâmica isola o frio; simulação, servidor, Hangar e testes prontos (PR-E, Claude, 11/10, protocolo 10) #combate
- [x] Tela e som das armas elementais (Gemini): indicadores de estado, bordas de tela, painel do alvo, ícones e dicas do Hangar, medidor da rotatória e sons #ux
- [~] **Colossus-01, primeira máquina de cerco:** visual de escala 3 (14 m) e o **bot do boss no jogo** — fecho da Sobrevivência offline (onda 6, ou `?modo=survival&onda=6`), com pool pré-alocado, vaga própria no recorte da onda, perfil de cerco e dano por parte (as pernas caem antes do torso). **Equilíbrio medido por teste:** pernas 450 (até 10 s cada), torso 1 200 (até 30 s), e um piloto parado no aberto aguenta mais de 20 s do tiro dele. Próximo: máquina de fases e pontos fracos próprios, HUD de chefe, arma assinatura; depois, sandbox/Hangar e o modo assimétrico. #mechs
- [ ] **Ferret-X (gancho + sucata) e pesado de escala 2:** chassis novos com blueprints e stats no `entities/chassis.ts` #mechs
- [~] **Variedade estrutural de verdade nos chassis (quadrúpede, canhão no lugar da cabeça, 4 braços, esteiras, canhão entre pernas):** técnica de apêndice decorativo provada duas vezes (cauda da Onça-B2, capacidade de cabeça-torre) — zero custo de CPU, sem tocar animação nem dano. Esteiras, canhão-entre-pernas e canhão-cabeça usam essa técnica direto; quadrúpede de verdade e braço extra que dispara pedem esqueleto de animação novo (`MechBase.ts`). Falta o dono escolher qual arquétipo entra primeiro e em qual chassi. #mechs
- [ ] **Personalização visual (cosmética, nunca combate):** apelido, cor da carcaça, decalque, pintura por parte, salva no navegador antes da conta (`hangar/loadout.ts` estende com uma seção "aparência") #negocio
- [ ] **Placar e nomes vindos do servidor** com histórico de partidas do jogador (na sua sessão, sem conta ainda) #ux
- [ ] **Painel de balanço na sala de controle:** quantas partidas cada arma venceu, tempo médio até morte, distribuição de dano; alimenta as decisões semanais de ajuste #negocio
- [x] **Desafios diários e progressão (DailyChallenges):** Nível de Piloto, barra XP, Créditos ₵, 3 missões diárias com recompensas ("5 abates com plasma", "causar 500 de dano", "derrotar 3 andróides"), salvas localmente e integradas no `Game.ts` #modos
- [x] **Modo sobrevivência e MissionHUD:** interface completa (briefing tático com digitação, HUD de onda, sirenes de alarme, banner ONDA LIMPA e resumo de estatísticas/medalhas) #modos
- [ ] **Química do jogo (P96) — consertar os ciclos de recompensa que já existem:** o nível do piloto **não sobe jogando** (`addXp` só é chamado dentro de `claimReward`), o `trackWaveOrRound` (missão "sobreviver 3 ondas") **não tem chamador** e o gancho de "conquistado jogando" (`validateLoadout`) também não; sem isso a dopamina e a serotonina ficam travadas. Plano em `QUIMICA_DO_JOGO.md` § 5 (itens 1 a 3) e `DIVERSAO.md` § 9/§ 10 #modos
- [ ] **Recorde de onda com comemoração (P96):** o `waveReached` já existe e chega ao HUD, mas **nenhum melhor é salvo**; guardar o recorde local e celebrar a marca nova (`QUIMICA_DO_JOGO.md` § 5 #3) #ux
- [x] **Aviso de sequência de abates (P96):** 2/3/4 abates em poucos segundos, com som próprio (constava como item pendente do Gemini) — dopamina e adrenalina baratas (`QUIMICA_DO_JOGO.md` § 5 #4) — feito em 13/10 (Claude) #ux
- [ ] **Maestria por arma e por chassi (P96):** contador de abates por arma com selo no Hangar; **local, 0 byte de rede** (`QUIMICA_DO_JOGO.md` § 5 #5) #ux
- [ ] **Autonomia visível (P96):** perfil de configurações salvo com nome, **código de build curto** (`CM-V9-SNIPER`) e a dica "teste isto" depois de perder; tudo local, nunca vantagem (`QUIMICA_DO_JOGO.md` § 5 #10) #ux
- [ ] **Agressão recompensada (P96):** o abate **encostado** (pisão/serra) devolve energia ou alivia calor — só se passar no `combat/balance.ts` (`QUIMICA_DO_JOGO.md` § 5 #11) #combate #modos

- [x] HUD de combate (ordem P109, 13/10): minimapa da partida de frente-para-cima (75 m, 12 Hz), vida do torso em barra com número e as cinco partes em pílulas, cartões ATAQUE 1 e 2 com nome e nível, anel de dash, rótulo da câmera e CFTV lado a lado; `ui/Minimapa.ts`, `ui/Vitals.ts` e 14 testes (Claude) #ux
- [x] CFTV por mapa (ordem P148, 15/10): `camera/camerasDoMapa.ts`; a praia tem 11 câmeras (portões, torres, teto da estação, hotéis), a Arena 5, o bunker nenhuma; o botão virou "CÂMERAS DO LOCAL · C" e o rótulo "VISTA 3ª PESSOA [V]"; 7 testes com mutação e capturas em `arte/cftv-praia-*.png` (Claude) #ux
- [x] Leitura de combate (P109, frente 2, 14/10): números de dano flutuantes sobre o alvo (pool fixo, offline e online), plaqueta com barra de vida e distância, "recarregando" ao lado da mira; `ui/DamageNumbers.ts` + `ui/Nameplates.ts`, 13 testes (Qwen). Falta o ícone da arma no kill feed (pede `sim/` + protocolo) #ux
- [~] Morrer e voltar (P109, frente 3; inclui a P98): **o painel "seu algoz" feito** (14/10, Qwen) — nome, chassi, vida do torso e as armas do matador durante o contador, offline, com captura em `arte/painel-do-algoz-qwen.jpg`; **falta** a escolha do ponto de nascimento na contagem e o painel no online #ux
- [ ] Cenário com cobertura e cor por zona (P109, frente 4): contêineres, rampas e muretas instanciados e cor por região da Arena, dentro do estilo neon (Codex) #cenarios
- [~] Modo Domínio, pontos de controle A–E (P109 frente 5 e P112, 14/10): offline pronto (`?modo=dominio`: regra pura testada, bots que capturam e guardam, bases, barra de pontos, feixes de luz, minimapa; Claude); faltam o online (`OBJECTIVE_STATE` e times na sala, P81), a campanha e o playtest #modos
- [~] Inteligência tática dos bots (P119, 14/10): passo 1 — papel por arma (curta/média/linha) e a **retaguarda** que segura o setor de nascimento em vez de rushar (`combat/tatica.ts`, 11 testes; só posição, o esquadrão padrão de plasma segue idêntico; Qwen); faltam o jogo em equipe (cobertura, flanco, ataque conjunto) e o playtest do dono #ia
- [x] Todos os robôs, todas as armas que o contrato permite (P120, 14/10): a curadoria de `ARM_SLOTS` virou contrato (tipo de encaixe × tamanho), sem tocar nas regras de disparo; lança-chamas e canhão pesado em todo Mech, o Andróide com as leves, o Colossus-01 com o cerco (Qwen) #mechs #combate
- [x] Canhão de cerco com carga mais rápida e com espera (P124, 14/10): carrega em 2,4 s e **segura a carga** — o tiro sai ao soltar o gatilho, no momento escolhido (`combat/ChargeTimer.ts`, flag `chargeHold` na arma); o trilho segue como era (Qwen) #combate
- [~] Sistema de mira: perfil por arma — a mira assenta (P121, 14/10): tempo de mirar por arma (linha 0,5 s / média 0,32 s / perto 0,18 s) e a mira abre e fecha com o gatilho (`combat/aim.ts`, 8 testes); a **amplitude em 0** (o acerto não muda); falta o playtest e, se o dono quiser, ligar a dispersão (Qwen) #combate
- [~] Táticas pré-selecionadas para o esquadrão (P122, 14/10): o **catálogo** (PELO CENTRO / PELOS FLANCOS / PROTEGER prontas; RECUAR SE… e DISTRAIR reservadas) e o **esquadrão aliado obedecendo** (formação e leash), escolhido por `?tatica=` (`combat/taticas.ts`, 8 testes; Qwen); faltam o seletor na tela e o por-missão #modos #ia
- [~] Amazônia, parte A: o Draga-01 (P180, 17/10): o plano (`AMAZONIA.md`: o rio termômetro, o mapa de 2.400 × 900 m, a missão em atos), o **rig por script de Blender** do modelo do Comandante (um quadrúpede de 27 mil triângulos: 18 ossos, pele rígida por parte, cor nos vértices, 984 KB), a **marcha de quatro tempos** (`walkerGait.ts`, pura), o `WalkerVisual`, a bancada `walker.mjs` e o link `?walker` (DEMO: ainda não é inimigo); 43 testes (o rig se testa com o arquivo real em Node); 34 de 34 mutações à mão pegas. O código do Draga é carregado **sob demanda** e o `smoke` mede o JS de partida e o de cada fase em separado (`scripts/orcamentoDeJs.mjs`). Falta o mapa e o rio (B), o chefe com corpo (C), a defesa (D) e a invasão (E) #modos
- [~] Outras fases, parte E: a Cidade Neon (P177, P164, 17/10): o circuito do quadro de luz se repete (`sim/QuadroDeLuz.ts` com lugar e vida próprios): o **transformador do Banco Vorcaris** (480 de vida) com saboteiro, o Colossus que vai a ele, a cidade e a placa do banco que escurecem com a energia, as zonas de cura que caem sem ela e o desenho (cabine, tela, farol de 9 m); o **HUD de missão** (a célula do transformador e a barra do chefe, que a Arena não tinha, com a regra por alvo); bancada `medicoes/arena.mjs`; 54 de 56 mutações à mão pegas (as duas que escaparam são equivalentes: a histerese da energia só poupa custo, e dar ordem a um bot morto não muda o jogo). Falta o Bunker, a Bandeira e o Domínio, o chefe com contexto próprio de cada fase e o equilíbrio jogando #modos
- [~] Capítulo 1, parte D: a Colossus (P165 e P147, 17/10): `sim/FasesDoChefe.ts` (regra pura com teste: anda, manca, rasteja, caiu; o alvo é o cabo mais perto ainda de pé, depois a porta principal), o titã que **rasteja** (`MechBase.crawls`, 30%), a **barra do chefe** com a regra de cada fase no HUD e a **máscara** (caricatura, 1,3× a cabeça, só no chefe, `?mascara=0` a tira, 12 caixas criadas uma vez); **19 de 19 mutações à mão pegas**. Falta o equilíbrio jogando #modos
- [~] Capítulo 1, parte C: o porto (P163 e P164, 17/10): os **contêineres de desembarque** (três, laranja, no cais; as portas abrem com a onda em campo e os Mechs e os andróides rebeldes saem por elas, a mais de 460 m da estação) e o **quadro de luz da cidade** (`sim/QuadroDeLuz.ts`, regra pura com teste: o saboteiro da onda 2 em diante, a energia das luzes da orla, as zonas de cura sem energia, célula e aviso no HUD, painel desenhado); 19 de 19 mutações à mão pegas. Falta o equilíbrio jogando e a Colossus em fases (D) #modos
- [~] Capítulo 1, parte B: a invasão do prédio (P163, 17/10): `sim/PortasDaEstacao.ts` (regra pura com teste: duas portas, vida, forçar, arrombar, recuperar, dreno da rede), o **manifestante** (corpo de andróide mais fraco, camisa amarela, boné e bandeira, sem arma de fogo; pool de 5, planos das ondas 2 a 6) que chega pela avenida e pela rua dos fundos, as portas desenhadas (laranja forçada, vermelha e aberta arrombada) e as células e avisos do HUD; 15 de 16 mutações à mão pegas (a outra é equivalente). Falta o porto e os contêineres (parte C), a Colossus em fases (D) e o equilíbrio jogando #modos
- [~] Capítulo 1, parte A: os cabos de dados da estação (P162 e P163, 16/10): `sim/CabosDeDados.ts` (regra pura com teste: injeção dos andróides rebeldes, cabo tomado que drena a rede, dano por presença, conserto, liberação), os andróides mandados aos pontos de conexão, o brilho vermelho do cabo, o letreiro de dados com caveira ("INJETANDO FAKE NEWS") e as três células no HUD; 12 de 12 mutações à mão pegas. Falta o equilíbrio jogando, o prédio com a segunda entrada, o porto e os contêineres, o manifestante e a Colossus em fases #modos
- [~] O ciclo do dia da praia (P161, 16/10): `environment/CicloDoDia.ts` (curva pura com teste) e `Praia.setProgressoDoDia`: **começa no pôr do sol e em 5 minutos de partida vira noite**; o céu escurece com estrelas e lua, o mar escurece, a luz do sol apaga, **as luzes da cidade acendem poste por poste** (bulbos, halos, poças, feixes, farol e janelas), `?dia=0..1` fixa a hora; o mar tinha o tempo congelado (corrigido); 0 NaN em 720 poses na GPU real. Falta o julgamento do Comandante e o relógio do servidor no online #cenarios
- [~] A orla de 640 m da PRAIA DOS CABOS (P127, 14/10): a praia **ao longo do mapa** (mar → praia → calçadão → Av. Beira-Mar → cidade), com o porto, a Ponte Metálica e a estação murada; terreno em colisor de altura, céu/mar/palmas/gaivotas na GPU, HUD da fase (faixa da costa, marcador da estação, lugar, aviso da água, cartão da missão), minimapa e radar cientes da praia e as ondas marchando até os portões (Claude); o **núcleo** da estação — a rede que cai pela presença dos invasores e faz a missão falhar (passo 2, Claude); falta o contraataque, o técnico, o playtest e a GPU integrada #cenarios #ux
- [~] A praia ganha luz, sombra e vida (P128, 15/10): sombras assadas, a base da estação como posto de defesa, **luz desenhada** (309 halos, poças, feixes e dois holofotes que giram, sem luz dinâmica), o chão das **zonas de cura e resfriamento**, gente (passantes, ciclistas, banhistas) e pipas — evacuadas na missão —, lanchas e navios rebeldes e cáusticas; 44 a 52 desenhos e 134 mil a 135 mil triângulos (Claude); falta o roleplay (voz do SOC, relatório pós-incidente, placas, som), a câmera tática e a GPU integrada #cenarios #ux
- [~] A PRAIA DOS CABOS — o cenário maior com mar (P126/P114, 14/10): **a regra da água** (`combat/Agua.ts`), o **layout em dado puro** (`environment/PraiaLayout.ts`, 480 × 140 m; 10 testes) e **o mapa que abre** (`environment/Praia.ts` + `?mapa=praia`: fim de tarde com o sol no horizonte, mar claro com ondas na GPU, cidade costeira, dunas; o afogamento ligado; capturas em `arte/praia-p126-*-qwen.jpg`); faltam a **missão** (defender/retomar a estação, proteger os cidadãos), as **zonas** da praia, a bancada de colisores (< 310) e o teste de partida da água — território do Codex assumido pelo Qwen #cenarios #modos
- [ ] Ficha da arma na lista do Hangar com dano, alcance ótimo e recarga (P109; nunca "potência" nem estrelas: não é pay-to-win) #ux

- [x] Dieta de JS: os painéis opcionais do console (Esquadrão, Campanhas, Arsenal, Servidor, Câmeras) viram pedaços sob demanda; JS de partida 499,7 → 486,2 KB (R7) #desempenho
- [x] Cobertura de idioma das telas avançadas (Hangar, Esquadrão, Campanhas e HUD em seis línguas; auditoria no navegador) (decorre do pedido do Comandante, 17/10, P173) #ux
- [x] Idiomas do jogo: inglês, espanhol, francês, japonês, chinês e russo (dicionário JSON + tradutor de DOM, seletor em Configurações e `?lang=`; PARCIAL: narrador, canvas, Hangar longo, landing e revisão nativa) (pedido do Comandante, 17/10, P173) #ux

- [x] Login do jogador completo: criar conta e entrar nas Configurações, a conta guarda nível, XP, créditos, apelido e a montagem do Hangar (`/conta/progresso`) e o convidado vira conta sem perder nada (pedido do Comandante, 17/10, P174) #rede
- [ ] Ranking online e clã (C4 e C2 do `RANKING_E_LOGIN.md`), recuperar senha e apagar conta, e o convite "guarde seu progresso" depois da primeira partida (P174) #rede

- [x] Os rebeldes atiram o laser (um pulso por cadência, pelo `Match.beamPulse` do jogador) e a Sala de controle conta o **ritmo de conteúdo** (armas e chassis por semana, do código e do git) (pendências da P160 e da P171, 17/10, P175) #ia
- [ ] Retenção no painel: **D7** e **DAU/MAU** (pedem um id anônimo por visita: decisão do Comandante, LGPD) (P171/P175) #negocio

- [x] Idioma e conta no canto da primeira tela e da pausa (o Comandante não os achou nas Configurações) (pedido do Comandante, 17/10, P176) #ux

- [x] Landing do site em outras línguas: a faixa de idiomas no topo, os textos traduzidos e a escolha valendo no jogo (pedido do Comandante, 17/10, P178) #ux
- [~] Lado político e pedagogia: o seletor de lado e o Arquivo (seis fichas, sete línguas) estão no jogo; faltam o Relatório de Consequências e a campanha do Consórcio (`LADO_E_PEDAGOGIA.md`) (pedido do Comandante, 17/10, P179) #modos
- [ ] Missão da Amazônia: a mineradora no rio (`fichas/cenario-amazonas.md`); o modelo do cenário é do Comandante, em outro chat (P180) #cenarios
- [x] Arpão por peso: o robô mais leve não puxa o mais pesado (pedido do Comandante, 17/10, P181) #combate
- [~] Interfaces de jogos antigas: **feito** a linha em barra dourada e o `‹ valor ›` nas Configurações e o par SOLO / MULTI na primeira tela; falta a placa no console (`REFERENCIA_VISUAL.md` § 8) (pedido do Comandante, 17/10, P182) #ux
- [ ] Ombros nos chassis pesados (Bastion, Onça, Colossus), para o arpão render nas mãos de um robô grande (P77, P181) #combate

## 🟣 FASE 6 — Universo, fichas e comunicação (do combate para a história)
- [x] Proposta do universo: IAs rebeldes famintas por computação, SERAFIM como resposta a incidentes, geopolítica de chips, energia e dados, termos de CTI (`UNIVERSO.md`) #universo
- [ ] Decisões do dono sobre o universo (`UNIVERSO.md`, seção 7) #universo
- [ ] Textos do jogo na língua de CTI: incidente, contido, linha do tempo, painel do SOC, relatório pós-incidente com MTTR #universo
- [ ] Fichas de ameaça das IAs na landing (TTPs do MITRE ATT&CK, IOCs, contramedidas que ensinam a jogar) #universo
- [ ] Boletins de inteligência (TLP:CLEAR) gerados das entregas, nos bastidores e nas redes #universo
- [ ] SDK do portal (CrazyGames/Poki), anúncio só entre rodadas #negocio
- [ ] Métrica: D1 e rodadas por sessão #negocio

## 🔴 FASE 7 — Mundo vasto e integrado (o horizonte)

Ver `VISAO.md`, seção "Mundo grande, integrado". Aqui só destravamos com jogadores testando de verdade e servidor pago em SP.

- [ ] **Interest management (AoI):** cada jogador recebe só as unidades num raio dele. Destrava 32-64 jogadores por sala #rede
- [ ] **Delta encoding no estado:** só campos que mudaram desde o último ack, corta 30-60% da banda #rede
- [ ] **Capacidade para mapas maiores e mais jogadores:** medir CPU/banda por jogador; combinar AoI, delta e setores carregados sob demanda antes de elevar o teto de sala; sem regressão de latência #rede
- [ ] **Veículos de transporte:** jipe/tanque e plataformas que carreguem Mechs, andróides e tropas; ocupantes sincronizados como passageiros, sem simular tripulação fora da vista #combate
- [ ] **Terreno com streaming:** setores carregados sob demanda; mapa 1-2 km² sem estourar wasm/GPU #cenarios
- [ ] **Destrutíveis v2:** prédios com paredes que caem, sincronizados por `PROP_BROKEN` #cenarios
- [ ] **Multi-região (VPS SP + hemisfério norte):** matchmaking joga cada um na sala mais perto #base
- [x] Esqueleto de contas: criar conta, entrar, sair (e-mail + senha, SQLite no servidor, sem UI ainda) — primeiro corte, sem progressão migrada (Claude, 28/09) #negocio
- [ ] **Contas + LGPD + cosméticos pagos** (nunca atributo de combate; falta a tela e migrar a progressão do `localStorage`) #negocio
- [ ] **Passe de temporada** (se houver tração) #negocio
- [ ] **WebTransport (quando o Firefox terminar):** UDP no navegador, corta jitter em rede ruim #rede

## 💡 IDEIAS

- [x] Complemento da P109: seis prints do MechArena preservados e analisados, critérios de fluidez/movimento/tiro/cenário em `REFERENCIA_VISUAL.md` §7 (Codex, 13/10; documentação, sem ganho de desempenho) #cenarios
- [ ] P109: validar uma arena como referência de qualidade, seguindo as etapas A–D de `REFERENCIA_VISUAL.md` §7; começar por nova medição C3 e percurso de movimento/tiro, reaproveitando o HUD existente #jogabilidade
- [x] P109: caracterização longa em GPU integrada (Codex, 14/10): três sessões válidas de cinco minutos, 53.798 quadros; p99 16,9 ms, pausas isoladas >300 ms ainda impedem homologação; `medicoes/FLUIDEZ_CAMERA.md` #desempenho
- [~] P109: recuperação suave da câmera ao sair de cobertura, sem atraso adicional de rotação (Codex, 14/10): PR #298 na main e publicado, seis testes e comparação na Arena; falta playtest do dono #jogabilidade

- [x] Clareza da montagem (peso por encaixe e nível), treino coerente com a carga e seletor sincronizado com os modos da simulação (Codex, direção autorizada 06/10) #ux
- [ ] Revisar utilidade/cobertura dos testes por frente; execução por impacto durante edição e gate completo nas entregas, sem usar contagem como garantia (Codex, pergunta do dono 06/10) #base
- [x] Canhão de trilho carregável e lançador EMP, com MK I–III, carga, montagem e miras próprias (Codex, pedido 06/10) #combate
- [x] Banco VORCARIS: letreiro azul no andar superior, terminal na porta e catálogo de códigos para créditos/boosts offline e online (pedido 06/10) #jogabilidade
- [x] Miras finas por arma, centro livre e indicação de alvo sem aumento de tamanho (Codex, pedido de 06/10) #ux
- [x] Equipamentos por encaixe e carga: frontal e esfera em módulo extra, Ctrl por toque; escudo físico na mão esquerda com 4 modelos e botão 2 (Claude, 06/10) #combate
- [ ] Escudo físico online completo: integridade e chapa levantada no snapshot (HUD e Mechs remotos) #rede
- [x] Prédio Serafim: monólito brutalista com LED de estado e base de drones no topo, oposto ao Banco VORCARIS (Claude, 06/10) #cenarios
- [x] Drones da base Serafim: patrulha, kamikaze, conserto e recarga, saindo do topo (Claude, 06/10) #ia
- [ ] Drones no servidor online (roster de rede ainda não descreve um drone) #rede
- [x] Instrumentação local de boot/erros/WebGL, quadros lentos e resumos de partida por versão/montagem/cheats, com exportação e testes HTTP/persistência #base
- [~] Observabilidade central no Serafim13 integrada no cliente; confirmar recebimento, alertas e operação real quando os serviços estiverem disponíveis #base
- [x] Benchmark reproduzível localhost para 10/50/100 jogadores ativos em salas de até 8; evidências e limites em CAPACIDADE.md #desempenho
- [ ] Homologar online com rede real, latência/perda, duração prolongada e capacidade com folga antes de prometer escala #rede
- [ ] Playtest comparável das montagens e barreira; priorizar próxima arena/conteúdo pelos resultados (PLAYTEST.md) #jogabilidade
- [~] **Legibilidade do alvo:** painel de partes/calor já no jogo; Codex (06/10) implementou fumaça/faíscas nas partes presentes com até 50% de vida, passada assimétrica conforme a avaria das pernas e vapor nos rigs sem ventilação própria. Zero bytes de rede e nenhum desenho extra; falta playtest real da sensação e do online. Partes destruídas continuam arrancadas: não pendurar uma arma que já caiu. Prova de bancada em `arte/dano-visivel-codex.png`; `DIVERSAO.md` § 10 #combate
- [ ] **Recibo da partida e cartão compartilhável:** precisão, partes destruídas, dano por calor, travamentos por superaquecimento, onda alcançada — no fim da rodada, com uma imagem local para mandar no link. Proposta em `DIVERSAO.md` § 7 e § 8 #ux
- [ ] **Marcador de alvo (ping):** uma tecla marca o alvo para o time; viaja como evento, sem estado novo. Proposta em `DIVERSAO.md` § 6 #modos
- [x] **Catálogo por encaixe ampliado:** Mechs compartilham plasma/blaster/escopeta/trilho/EMP nos engates de energia; peso, mão do escudo, Andróide leve e ombros continuam limitando montagens. Modelos procedurais e Marauder trocam armas; GLBs com arma integrada ainda exigem evolução visual #combate
- [x] **Comando dos aliados na Arena offline:** 1 acompanhar, 2 concentrar fogo, 3 defender; feedback e botões no toque. Correção do render parado, escolta plasma e supressor EMP #jogabilidade
- [x] **Oficina em sincronia com o jogo** (06/10): o guia de robôs, arsenal e escudos é lido do código e o selo de cada recurso, do `STATUS_REAL.md` (nenhum número digitado); mapa da arquitetura clicável por mouse, toque e teclado; exercícios de calor corrigidos (o par de rajadas era um empate) e alcance na mesma escala. O `site --check` clica num módulo do mapa #ux
- [~] **IA com propósito:** formação, apoio ao sofrer ataque, flanco conforme orientação do alvo, busca local de cobertura e desvio de obstáculos. Próximo: navegação global, situações com várias paredes e playtest de ritmo offline #combate
- [x] **Inteligência dos bots (Claude, 11/10, ordem P74):** rádio do clã (contato passado aos companheiros, aviso no feed), caça pelo caminho projetado e varredura antes de desistir, leitura da mira do jogador (troca de lado e dash por dificuldade), cerco pelos flancos de quem espera a vaga, revide em quem atira; percepção honesta (só o que a amostra de visão viu). 8 testes; CPU sem regressão. Próximo: navegação global (rotas com várias paredes e o bunker vertical) e foguetes nos bots #ia
- [ ] **Feixe térmico:** proposta em avaliação, ainda não equipável; definir contrajogo, calor e limites de massa antes de prototipar (o arpão magnético já é equipável, P77) #combate
- [ ] **Ficha própria dos três Mechs rebeldes:** CLAWD (longo), GEMINAI (pesado) e CHAD-GPT (rápido) compartilham `VECTOR09_STATS` e diferem só na persona (`BotSystem.ts:141`); números e metas (Claude), silhueta (Codex), ficha (Qwen). Proposta em `DIVERSAO.md` § 4 #ia
- [ ] **Modificador semanal:** uma flag de regra e uma linha de HUD ("sem foguetes", "calor dobrado", "caça ao técnico") como novidade barata que força build diferente. Proposta em `DIVERSAO.md` § 9 #modos
- [ ] **Mech com dois operadores** (27/09 — expandido): papéis possíveis: Piloto (movimento, dash, pulo), Artilheiro (mira independente, terceira arma exclusiva no topo do Mech), Mecânico (reparo em tempo real de partes danificadas). Um bot pode ocupar qualquer papel. Alternância rápida Piloto⇔Artilheiro por tecla. Serve para testes A/B de balanceamento com combinações bot×humano. Interface (HUD de papel, câmera do artilheiro, indicador de mecânico): **Gemini**. Contrato `MechInput` dual + autoridade de rede: **Claude** #mechs
- [ ] **Drones voadores pequenos** (27/09 — expandido): sub-escala 1, proporcionais ao androide (que é escala 1 = ~1,6 m), portanto visualmente pequenos perto dos Mechs de escala 2 (~5,3 m). Modelos e efeitos de voo: **Codex**. HUD de status da frota e câmera de visão do drone: **Gemini** #mechs
- [ ] **Missões de sobrevivência por fases** (27/09 — expandido): referência *Project Zomboid*, ondas crescentes de androides humanoides + Mechs rebeldes, mapa com setores que fecham, solo ou co-op. Lógica de ondas no servidor: **Claude**. Interface completa (briefing, HUD de onda, resumo final): **Gemini** #modos
- [ ] **Jogadas de Mech: combos e ataques especiais por chassi** (01/10, ideia do dono, **não é escopo aprovado**): cada Mech teria "jogadas" próprias, como as peças do xadrez que se movem e atacam cada uma do seu jeito. Exemplo do dono: um robô que dá 2 saltos + dash por cima do oponente, cai nas costas dele e dá um tiro de "rabo", como uma escopeta: golpe quase fatal contra a maioria dos inimigos, que têm menos proteção atrás. Antes de código: o combo seria uma sequência de comandos reconhecida pela simulação (`sim/`, determinística, G1/G2/G14); pulo e dash já viajam por comando, então reconhecer a sequência não pede campo novo de rede. Dano nas costas é regra nova (hoje o dano resolve esquerda/direita e altura, não frente × costas). O rabo é arma nova (cada braço aceita exatamente uma arma, `ARM_SLOTS`). Outros exemplos do dono (01/10): um Mech que rola lateralmente, outro que voa e ataca de cima para baixo, "diferentes composições". Rolar lateralmente é um dash com direção (hoje o dash já viaja por comando); voar exige decidir o que é "ar" para a física e para o servidor (hoje há pulo duplo, não voo sustentado) #combate #mechs
- [ ] **Estilos de jogo como eixo da evolução de armas e robôs** (06/10, direção do dono, **não é escopo aprovado**): quando armas e chassis começarem a evoluir, a evolução deve abrir mais de um jeito de lutar, não só mais número: quem quer **tankar** e ficar no combate próximo, quem quer **rushar** e lutar até o fim, quem prefere o **ataque furtivo** e as **jogadas** do item acima (como as peças do xadrez). Hoje o jogo tem os ingredientes soltos: o rush (dash, pulo duplo, pisão, escopeta, motosserra), o tanque (Onça-B2 e Colossus-01, escudo metálico, escudo de energia, zonas de cura e resfriamento) e, **só nos bots**, os estilos já prontos em `PERSONAS` (`BotController.ts`): `brabo` (vem para cima e atira até ferver), `fujao` (espreita pelas costas e foge se visto de frente), `manso` (longe) e `soldado`. O que falta para o jogador: (1) a evolução é uma escada só, igual para toda arma (`TIERS`: MK II = +20% de dano, +15% de calor, +50% de massa), sem ramos por estilo; (2) o chassi é fixo (`MechStats`) e não evolui; (3) não há furtividade (visão, ruído, radar) nem dano de costas (ver o item acima); (4) um estilo só vira capacidade se a Oficina o medir. Caminho sugerido, antes de código: evolução como **tabela de modificadores** sobre `WeaponStats` e `MechStats` (a ideia do `TIERS`, com ramos), capacidades novas como **dado do chassi** lido pela simulação comum (G3/G14), nunca `if (chassi === …)` espalhado, e a Oficina medindo cada estilo (tempo para travar, vida efetiva, mobilidade, alcance) e o **contrajogo entre estilos** (duelo entre as personas no `Match`). Perguntas ao dono: quais estilos entram primeiro; se a evolução é por arma, por chassi ou pelo piloto; se a furtividade vale no online (custa banda: o servidor teria de esconder quem não foi visto, G11). Relacionado: a decisão em aberto "Framework modular de chassis/peças" (`ESTADO_ATUAL.md`, sobre evoluir os robôs) e o item "Jogadas de Mech", logo acima #combate #mechs
- [ ] **Facção escolhida pelo jogador** (01/10, ideia do dono, **não é escopo aprovado**): começar com 2 ou 3 facções e acrescentar depois. Duas tensões a decidir: (1) `UNIVERSO.md` § 3 faz do jogador sempre a SERAFIM (neutra, contratada); (2) "clã" já é termo do código com outro sentido (`Clan` em `tuning/power.ts`: grupos de ajuste de potência), então a escolha do jogador deve se chamar **facção**. Perguntas ao dono: quais são as 2–3 facções; se mudam só visual e lore ou também números (bônus entram em `power.ts`, medidos pelo relatório de equilíbrio); se a facção faz parte da montagem (`LoadoutSpec`, link `?build=`) ou do perfil do piloto; como ela aparece no online (roster) #universo #modos
- [ ] **Androides como na foto de referência do dono** (03/10, ideia, **não é escopo aprovado**): humanoides táticos de placas brancas e pretas (e variantes verde-oliva), com viseira ou óculos e fuzil nas duas mãos. A foto também traz cães-robô quadrúpedes com carga, veículos de esteira com torre e drones de quatro hélices. Hoje os androides são feitos de primitivas (`Android.ts`). Caminho sugerido: gerar o humanoide (Tripo3D) com mão que segura, um **encaixe de empunhadura** (a arma presa à mão, com apoio na outra) no lugar do engate de pulso dos Mechs, e um orçamento pequeno de triângulos (até 4 em cena: 3 andróides e o técnico, fora o piloto que escolhe o A-1) #mechs
- [ ] **Planos de corpo além do bípede** (03/10, ideia, **não é escopo aprovado**): quadrúpede (cão-robô), esteira, drone. Hoje o corpo tem seis partes fixas (`MechPart`: torso, cabeça, dois braços, duas pernas), que também é o formato do estado de rede (`NET_PARTS`). Um plano novo mapearia os módulos dele nesses seis espaços, sem mexer na rede, e diria qual módulo desliga qual encaixe de arma. Só vale com um papel de jogo definido (inimigo, apoio, chefe) #mechs
- [ ] **Encaixes de arma além do pulso** (03/10, ideia, **não é escopo aprovado**; os ombros já existem no Marauder desde 03/10): peito, cabeça e costas, no mesmo contrato do pulso (nó, escala, módulo) com uma classe de tamanho. O Hangar já reserva "ombros e torso" (`HANGAR.md`). Antes, o ponto de tiro da simulação precisa virar dado do chassi (`FINDINGS.md`) #combate
- [ ] **Escudo do Lancer que bloqueia tiro** (03/10, ideia, **não é escopo aprovado**): hoje o escudo é só desenho. Bloquear de frente pede um ângulo de cobertura, uma regra para a explosão (contorna?) e para o calor, e um teste de simulação; decidir com o dono antes #combate
- [ ] **Jogador remoto desenhado com o chassi da montagem dele** (03/10, achado): hoje todo humano aparece para os outros como Vector-09, e o tiro dele nasce da boca direita; pede o encaixe no evento de tiro (protocolo 3) e carregar a malha importada do outro jogador (`FINDINGS.md`) #rede
- [ ] Som e aviso sonoro próprios da chuva de mísseis; o desenho do morteiro procedural já foi entregue em 04/10 (ver item concluído na Fase 3) #som
- [ ] Rádio das IAs rebeldes: provocações geradas por modelo de linguagem no servidor, entre rodadas (nunca decidindo o combate) #ia
- [ ] **Comandante e pilotos por LLM (fora do tick)** (ordem P53/P75; plano em `PILOTOS_LLM_E_INTELIGENCIA.md`): comandante que escolhe estratégia entre rodadas (devolve `BotSpec[]`), rádio gerado por modelo e a arena aberta a "cérebros de fora" jogarem pelo comando de 9 bytes; a infra de vários provedores já existe no Protocolo (SKILL 16/17) #ia
- [ ] **A inteligência dos bots como ativo vendável** (ordem P71/P75): o gravador de voo passa a registrar também as decisões dos bots (mesmo `MechInput`), com curadoria e ficha; liga ao produto de `DADOS_E_ROBOTICA.md` (D0→D3) #negocio
- [ ] Derrube o C2: retransmissor na arena que coordena as IAs; destruído, elas atacam desordenadas #universo
- [ ] Módulos com nome de defesa: firewall (escudo), honeypot (isca), sensor de caça (radar), patch (reparo) #universo
- [ ] Arenas dos recursos disputados: estação de cabos submarinos, barragem, fábrica de chips #universo
> Sem fase ainda: o dono prioriza. Propostas do Claude em 2026-09-23, a partir das frentes citadas pelo dono.
- [ ] Música que acompanha a intensidade do combate #som
- [ ] Pilotos com personalidade: agressivo, franco-atirador, cauteloso #ia
- [ ] Bots contra bots no modo todos contra todos #ia
- [ ] Bots com foguetes na dificuldade difícil #ia
- [ ] Escala 1, segundo tipo: quadrúpede rebelde (cão-robô), mais rápido e mais baixo #mechs
- [ ] Escala 1, coletor: junta peças dos destroços para reconstruir partes arrancadas #ia
- [ ] Escala 1, logística: leva munição e foguetes aos Mechs #ia
- [ ] Escala 1, piloto: andróides embarcam em máquinas vazias do hangar (matar o piloto desliga o Mech) #ia
- [ ] Hangar: montar o próprio Mech (chassi, arma de cada braço, módulos), peças geradas por código e equilibradas, sem pay-to-win (prioridade do dono) #mechs
- [x] Parte avariada solta faísca e fumaça antes de cair (Codex, 06/10; pool existente, 10 Hz, teto de 12 unidades por pulso) #mechs
- [ ] Pintura e decalques por jogador (base dos cosméticos) #mechs
- [ ] Prédios que desmoronam em partes, não só barricadas #cenarios
- [x] Referência visual do MechArena registrada (`REFERENCIA_VISUAL.md`, pranchas em `referencias/mecharena/`); decisão do dono em 07/10: elevar a qualidade dentro do estilo atual antes de evoluir #cenarios
- [x] Atmosfera dentro do estilo atual: céu em degradê com brilho no horizonte, névoa colorida e chão com placas de metal (`environment/Atmosphere.ts`, 07/10; custo de GPU ainda sem medida numa GPU integrada real) #cenarios
- [x] Sombra de contato sob os robôs (`fx/ShadowBlobs.ts`, 08/10): um disco macio por unidade num único `InstancedMesh`, sem mapa de sombra; custo em GPU/CPU ainda sem medida numa máquina real (G12) #cenarios
- [x] Janelas acesas nos três prédios da Arena (`environment/BuildingWindows.ts`, 08/10): desenhadas no shader, em coordenadas do mundo, sem geometria, textura nem draw call novo #cenarios
- [ ] Cenário vivo dentro do estilo atual: adereços instanciados (contêineres, letreiros), janelas nas torres do horizonte e no Prédio Serafim #cenarios
- [x] Cauda nos tiros de energia comuns (plasma, blaster, escopeta): faixa que afina para trás, em `fx/ShotStreak.ts` (08/10) #cenarios
- [ ] Efeitos com mais corpo dentro do estilo atual: anel de choque na explosão e desfoque de dash em qualidade alta #cenarios
- [ ] Tela inicial com apelido e escolha de Mech #ux
- [x] Estande de calibração do mouse: gravar uma volta de 360° com o movimento real, cm/360, entrada crua (sem aceleração do sistema) #jogabilidade
- [ ] Suporte a controle (gamepad) #jogabilidade
- [~] Recuo e tremor próprios de cada arma: o tremor de câmera por arma entrou (`combat/fireFeel.ts`, 08/10); falta o solavanco de mira (view kick), que mexe na pontaria e pede playtest do dono #jogabilidade
- [x] Faixas neon dos três prédios em uma malha instanciada por prédio (Codex C4, 09/10): 16→3 malhas; seis vistas com 11–13 desenhos a menos, mesmos triângulos; 1 KiB estático; `medicoes/FAIXAS_NEON.md` #cenarios
- [~] Preparar escolhas posteriores de GLB/montagem e remotos (Codex C2, 10/10): shader do chassi antes de exibir, fila limitada e seleção protegida; A/B Vega 11, zero programas após trocar; faltam upload, variantes de armas e dois clientes; `medicoes/HANGAR_TROCAS_PREPARADAS.md` #desempenho
- [~] Consolidar medição em GPU integrada real (meta do G12): Iris Xe no diagnóstico de shaders; Codex C3 (09/10) mediu nove janelas na Vega 11, percentis e memória em `medicoes/RENDER_C3.md`; caracterização sob pressão de RAM, falta homologação prolongada #desempenho
- [ ] Issues do GitHub como rastreador de bugs, com severidade (trava > bloqueia > grave > leve) e passos para reproduzir #base
- [ ] Teste noturno: bots jogando sozinhos no navegador headless para achar travamentos e erros #base
- [ ] Dependências no painel: mostrar o que trava o quê entre frentes #base
- [ ] Deploy que não apaga as imagens do site quando a captura falha (guardar a última pasta boa ou barrar o deploy sem capturas; o `rsync --delete` levou `capturas/` embora em 08/10) #base

- [ ] Câmeras de espectador: trocar para a visão de outros jogadores e de câmeras fixas (topo do Prédio Serafim, portas dos prédios) (pedido do dono, 06/10) #ux
- [ ] Painel de campanhas: escolher oponentes, missões e tarefas e salvar campanhas personalizadas com nome, como as montagens do Hangar (pedido do dono, 06/10) #modos

- [~] Bunker profundo de quatro níveis (0/14/28/42 m), poço aberto, rampas com degraus, galerias escuras, elevadores, atalho secreto e posições de sniper (Codex, 10/10: no ar desde o PR #218; IA vertical, elevadores móveis, câmera tática e playtest pendentes) #cenarios
