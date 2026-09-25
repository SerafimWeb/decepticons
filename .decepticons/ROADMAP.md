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
| `#jogabilidade` | Jogabilidade | movimento, câmeras, modos de jogo, sensação de controle |
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

---

## ✅ FASE 0 — Fundação
- [x] Vector-09: movimento, pulo duplo, dash, canhão de plasma #jogabilidade
- [x] 3 câmeras (3ª, 1ª, tática) #jogabilidade
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
- [x] Site do projeto: jogo + painel em selvamkt.com.br/cybermech, publicado a cada merge ("build do dia") #base
- [x] Rodada de 5 min com placar (Tab), intervalo de 10 s e reinício automático com a arena restaurada #jogabilidade
- [x] Blind Mode (cabeça destruída) #ux
- [x] Níveis de dificuldade: fácil, normal (a de hoje, aprovada pelo dono) e difícil, trocáveis durante a partida #ia
- [x] Configurações (contrato + aplicação no jogo): sensibilidade, inverter Y, campo de visão, qualidade, dificuldade, painel de desempenho, teclas remapeáveis; salvas no navegador #ux
- [x] Tela de configurações (Gemini, sobre o contrato `core/Settings.ts`) #ux

## 🟡 FASE 3 — Vitrine e polimento (atual)
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
- [x] Arsenal em três níveis de poder (MK I, II, III) com a mesma regra; dano recalibrado com metas de tempo para derrubar travadas por teste; calor do Mech compartilhado entre as armas; plasma perde força com a distância #combate
- [x] Projeto do Hangar (chassi, encaixes, carga, níveis, dissipador) e a seção dele na página do jogo, com o arsenal lido do código #mechs
- [x] Calor completo do Mech: tiro (coeficiente por arma), corrida, pulo, dash e dano esquentam; parado esfria em dobro; superaquecido trava armas, pulo e dash; bots param para esfriar #combate
- [x] Oficina no site: bancada de testes gerada pela simulação do jogo (calor por ação, dinamômetro, dano por parte e por distância, chassis) #combate
- [x] Gestão nos bastidores: quadro Agora/Próximo/Depois com código por item, burn-up do escopo, linha do tempo das fases com estimativa, matriz frentes × fases e as quatro métricas DORA de entrega contínua #negocio
- [x] Hangar: contrato da montagem (`LoadoutSpec` + `validateLoadout`, carga de 11 t no Vector-09), montagem salva no aparelho e link de build (`?build=`), com testes #mechs
- [ ] Hangar: tela para montar o Mech (arma e nível em cada braço, barras de carga e calor), salva no aparelho (passou do Gemini para o Codex em 25/09) #ux
- [ ] Segundo chassi para o Hangar ter escolha de verdade #mechs
- [x] Bots com personalidade (brabo, manso, fujão, soldado) e diretor de ataque: no máximo 2 atacando juntos, os outros esperam a vez #ia
- [x] IAs rebeldes com nomes de IAs (CLAUDE, GEMINI, CHATGPT, QWEN, DEEPSEEK, ANTHROPIC) e o nome sobre a cabeça #ux
- [ ] Conceitos visuais dos robôs numa IA de imagem (briefing em `ESTILO_ROBOS.md`, dono) e tradução em peças do `meshKit` (Codex) #mechs
- [x] Inimigos configuráveis: quantidade de Mechs e andróides, técnico, personalidade de cada Mech e quantos atacam juntos #ux
- [x] Setas de inimigos fora da tela (Gemini; concluído pelo Claude com a revisão) #ux
- [x] Sons dos andróides: tiro e pouso, mais baixos de longe (Gemini; integrado pelo Claude) #som
- [ ] Abertura da rodada ("RODADA 1 · 3·2·1 · COMBATE!") com locução sintetizada (Gemini) #ux
- [ ] Aviso de ABATE e de sequência de abates, com som próprio (Gemini) #ux
- [ ] Tela de carregamento com barra de progresso e dicas (Gemini) #ux
- [ ] Medir o FPS num notebook com GPU integrada, com o painel de desempenho (pré-requisito do multiplayer; dono) #desempenho
- [x] Render dos robôs: 9 draw calls por Vector-09 e por andróide, uma malha combinada por pivô articulado (antes ~34), com as peças ainda destacáveis (Codex, PR #43) #desempenho
- [x] FX: explosões, impactos, fumaça e destroços com escala animada; pool explícito de 3000 partículas sem alocação por frame #desempenho

## 🟠 FASE 4 — Multiplayer autoritativo
- [x] Plano técnico (`MULTIPLAYER.md`): pré-requisitos, arquitetura, orçamento de banda, contratos, etapas M0–M8 #rede
- [x] M1: partida sem tela (`sim/Match.ts`): a partida inteira roda no Node sem WebGL nem DOM, determinística sem destroços, 0,74 ms por tick com a sala cheia. Ainda cria objetos de render e o tiro do jogador sai do modelo desenhado (`MULTIPLAYER.md`, seção 8) #rede
- [ ] Separar simulação, render e efeitos: tiro do jogador e yaw pela simulação, efeitos por eventos, sem objetos de cena na simulação (proposta e critérios em `MULTIPLAYER.md`, seção 9; decisão do dono) #rede
- [ ] M2: contratos de rede (`NetInput`, `MechState`, mensagens) e codec binário com teste de tamanho #rede
- [ ] M3: `server/` com Colyseus: `ArenaRoom` para 8, simulação a 60 Hz, estado a 20 Hz com delta (G11); bots completam salas #rede
- [ ] M4: cliente com prediction + reconciliação do Mech local; Mechs remotos interpolam #rede
- [ ] M5: tiros autoritativos com compensação de latência; eventos de acerto, parte e abate #combate
- [ ] M6: entrada pelo link com código da sala + apelido; reconexão automática (G13) #rede
- [ ] Telas do online: apelido, código da sala, jogadores, placar e ping (Gemini) #ux
- [ ] Medir banda por sala e tick do servidor contra as metas do G11 e do G14 #desempenho
- [ ] Prova R16: 2+ clientes reais com latência simulada; playtest pelo PC de casa + Cloudflare Tunnel #rede

## 🔵 FASE 5 — Lançamento e viralização
- [ ] Modo streamer: sala de código fixo, câmera de espectador #negocio
- [ ] Servidor de jogo no ar (Oracle Always Free São Paulo ou outro; ver `DEPLOY.md`) #base
- [ ] SDK do portal (CrazyGames/Poki), anúncio só entre rodadas #negocio
- [ ] Métrica: D1 e rodadas por sessão #negocio

## 🔴 FASE 6 — Monetização e conteúdo
- [ ] Contas + cosméticos (nunca atributo de combate) + pagamento + LGPD #negocio
- [ ] Colossus-01 (demolição no dash) e Ferret-X (gancho + sucata) #mechs
- [ ] Mais arenas #cenarios
- [ ] Passe de temporada (se houver tração) #negocio

## 💡 IDEIAS
- [ ] Rádio das IAs rebeldes: provocações geradas por modelo de linguagem no servidor, entre rodadas (nunca decidindo o combate) #ia
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
- [ ] Parte avariada solta faísca e fumaça antes de cair #mechs
- [ ] Pintura e decalques por jogador (base dos cosméticos) #mechs
- [ ] Prédios que desmoronam em partes, não só barricadas #cenarios
- [ ] Tela inicial com apelido e escolha de Mech #ux
- [x] Estande de calibração do mouse: gravar uma volta de 360° com o movimento real, cm/360, entrada crua (sem aceleração do sistema) #jogabilidade
- [ ] Suporte a controle (gamepad) #jogabilidade
- [ ] Recuo e tremor próprios de cada arma #jogabilidade
- [ ] Medir o FPS numa GPU integrada real (meta do G12) #desempenho
- [ ] Issues do GitHub como rastreador de bugs, com severidade (trava > bloqueia > grave > leve) e passos para reproduzir #base
- [ ] Teste noturno: bots jogando sozinhos no navegador headless para achar travamentos e erros #base
- [ ] Dependências no painel: mostrar o que trava o quê entre frentes #base
