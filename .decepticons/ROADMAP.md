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
- [x] Fichas propostas do Mech leve e pesado, andróide e 4 armas; stats não existentes seguem pendentes #mechs
- [x] Calor com fôlego: ~15 tiros segurando, trava de ~2 s, superaquecido anda a 75% #combate
- [x] Potências: painel do dono por arma e por clã, com o efeito na luta e aviso de apelação, salvo e por link #combate
- [x] Diretor de ataque com fila justa: fim do turno vai para o fim da fila, quem espera mais vai primeiro #ia
- [x] Conceitos visuais fornecidos pelo dono e traduzidos em blueprints procedurais leve/médio/pesado; 9 malhas articuladas por rig, captura de silhuetas no PR (Codex) #mechs
- [x] Inimigos configuráveis: quantidade de Mechs e andróides, técnico, personalidade de cada Mech e quantos atacam juntos #ux
- [x] Setas de inimigos fora da tela (Gemini; concluído pelo Claude com a revisão) #ux
- [x] Sons dos andróides: tiro e pouso, mais baixos de longe (Gemini; integrado pelo Claude) #som
- [x] Zonas de cura e resfriamento na arena (dono: "preciso de um lugar pra recuperar a vida, ou um resfriador pra ter mais fôlego"): vantagem de posicionamento igual para os dois lados, custo de rede zero #combate
- [ ] Abertura da rodada ("RODADA 1 · 3·2·1 · COMBATE!") com locução sintetizada (Gemini) #ux
- [ ] Aviso de ABATE e de sequência de abates, com som próprio (Gemini) #ux
- [ ] Tela de carregamento com barra de progresso e dicas (Gemini) #ux
- [ ] Medir o FPS num notebook com GPU integrada, com o painel de desempenho (pré-requisito do multiplayer; dono) #desempenho
- [x] Render dos robôs: 9 draw calls por Vector-09 e por andróide, uma malha combinada por pivô articulado (antes ~34), com as peças ainda destacáveis (Codex, PR #43) #desempenho
- [x] Sinais visuais de calor no rig: emissivo progressivo e vapor no superaquecimento, sem alocação por frame e até 10 draw calls (Codex; check verde) #mechs
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
- [ ] M5: tiros autoritativos com compensação de latência; eventos de acerto, parte e abate #combate
- [ ] M6: entrada pelo link com código da sala + apelido; reconexão automática (G13) #rede
- [ ] Telas do online: apelido, código da sala, jogadores, placar e ping (Gemini) #ux
- [ ] Medir banda por sala e tick do servidor contra as metas do G11 e do G14 #desempenho

## 🔵 FASE 5 — Modos, missões e novidades semanais (o jogo que puxa o jogador de volta amanhã)

Ver `VISAO.md`: novidades quase toda semana, cada uma com balanço nos testes; o que atrai gente pra testar, se desafiar e voltar.

- [x] **Interface CTF e Placar de Times (CtfHud):** placar Azul vs Vermelho, badges de posse de bandeira, banners de evento animados (`showEventBanner`), com testes #modos
- [x] **Sobrevivência solo em Ondas:** cinco hordas progressivas (20 abates no total), briefing/intervalo, derrota/vitória, estatísticas e reinício; pool fixo de até 3 Mechs + 3 andróides, seletor na pausa e HUD de missão. Online fica para um contrato de rede próprio #modos
- [x] **CTF Vermelho × Azul — treino offline jogável:** uma bandeira em cada base, dois defensores, captura só com a própria bandeira em casa, queda/retorno, portador 15% mais lento, três capturas ou desempate em 8 min; regra pura no `Match`, HUD, bases/bandeiras holográficas em cinco draw calls e seletor na pausa #modos
- [ ] **CTF 2v2 online autoritativo:** times no contrato de sala, eventos de bandeira/captura no protocolo, bots preenchendo vagas e validação de banda; o treino offline não anuncia suporte de rede #rede
- [ ] **Missões em fases (cooperativo ou solo):** 3-5 fases com objetivos crescentes (defesa, escolta, invasão), com um evento de rede novo (`OBJECTIVE_STATE`) e um mapa por missão #modos
- [ ] **Deathmatch por equipes 4v4 e 8v8:** escala do online atual, com equilíbrio de composição (o servidor evita "todos os pesados de um lado") #modos
- [ ] **Modo streamer:** sala de código fixo, câmera de espectador, sobreposição para OBS #negocio
- [ ] **Decidir câmera de abate no PvP:** seguir o adversário revela sua posição; escolher entre liberar, atrasar/limitar ou manter ausente no competitivo #rede
- [ ] **Nova arma toda semana** (com teste de balanço em `combat/balance.ts`; nenhuma abaixo do TTK do arsenal atual, nenhuma acima do teto de dano por segundo) #combate
- [~] **Colossus-01, primeira máquina de cerco:** visual de escala 3 (14 m) fechado e o **bot do boss no jogo** — fecho da Sobrevivência offline (onda 6), com pool pré-alocado, vaga própria no recorte da onda, perfil de cerco e dano por parte (as pernas caem antes do torso). Próximo: máquina de fases e pontos fracos próprios, HUD de chefe, arma assinatura; depois, sandbox/Hangar e o modo assimétrico. #mechs
- [ ] **Ferret-X (gancho + sucata) e pesado de escala 2:** chassis novos com blueprints e stats no `entities/chassis.ts` #mechs
- [ ] **Personalização visual (cosmética, nunca combate):** apelido, cor da carcaça, decalque, pintura por parte, salva no navegador antes da conta (`hangar/loadout.ts` estende com uma seção "aparência") #negocio
- [ ] **Placar e nomes vindos do servidor** com histórico de partidas do jogador (na sua sessão, sem conta ainda) #ux
- [ ] **Painel de balanço na sala de controle:** quantas partidas cada arma venceu, tempo médio até morte, distribuição de dano; alimenta as decisões semanais de ajuste #negocio
- [x] **Desafios diários e progressão (DailyChallenges):** Nível de Piloto, barra XP, Créditos ₵, 3 missões diárias com recompensas ("5 abates com plasma", "causar 500 de dano", "derrotar 3 andróides"), salvas localmente e integradas no `Game.ts` #modos
- [x] **Modo sobrevivência e MissionHUD:** interface completa (briefing tático com digitação, HUD de onda, sirenes de alarme, banner ONDA LIMPA e resumo de estatísticas/medalhas) #modos

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
- [~] **Legibilidade do alvo (dano por parte visível):** a **leitura em painel** está no jogo — ao mirar um inimigo aparecem as 6 partes, o calor e as bandeiras (`SUPERAQUECIDO · TRAVADO`, `EM DASH`), tudo lido do que **já vem no estado** (19 B por unidade, `shared/net/state.ts`; **0 B a mais**), em `ui/TargetPanel.ts` com captura real em `arte/alvo-legivel.png` (Qwen, 28/09). **Falta a outra metade:** fumaça e faísca na parte avariada, o Mech mancando visto de longe, a arma destruída pendurada e o vapor de quem vai travar — frente visual (Codex). Proposta e números em `DIVERSAO.md` § 7 #combate
- [ ] **Recibo da partida e cartão compartilhável:** precisão, partes destruídas, dano por calor, travamentos por superaquecimento, onda alcançada — no fim da rodada, com uma imagem local para mandar no link. Proposta em `DIVERSAO.md` § 7 e § 8 #ux
- [ ] **Marcador de alvo (ping):** uma tecla marca o alvo para o time; viaja como evento, sem estado novo. Proposta em `DIVERSAO.md` § 6 #modos
- [ ] **Catálogo por encaixe e as células vazias da grade de situações:** hoje cada braço aceita exatamente uma arma (`ARM_SLOTS`, `chassis.ts:124`); abrir 2–3 opções por braço e cobrir precisão, controle e suporte. Proposta e grade em `DIVERSAO.md` § 4 e § 5 #combate
- [ ] **Ficha própria dos três Mechs rebeldes:** CLAWD (longo), GEMINAI (pesado) e CHAD-GPT (rápido) compartilham `VECTOR09_STATS` e diferem só na persona (`BotSystem.ts:141`); números e metas (Claude), silhueta (Codex), ficha (Qwen). Proposta em `DIVERSAO.md` § 4 #ia
- [ ] **Modificador semanal:** uma flag de regra e uma linha de HUD ("sem foguetes", "calor dobrado", "caça ao técnico") como novidade barata que força build diferente. Proposta em `DIVERSAO.md` § 9 #modos
- [ ] **Mech com dois operadores** (27/09 — expandido): papéis possíveis: Piloto (movimento, dash, pulo), Artilheiro (mira independente, terceira arma exclusiva no topo do Mech), Mecânico (reparo em tempo real de partes danificadas). Um bot pode ocupar qualquer papel. Alternância rápida Piloto⇔Artilheiro por tecla. Serve para testes A/B de balanceamento com combinações bot×humano. Interface (HUD de papel, câmera do artilheiro, indicador de mecânico): **Gemini**. Contrato `MechInput` dual + autoridade de rede: **Claude** #mechs
- [ ] **Drones voadores pequenos** (27/09 — expandido): sub-escala 1, proporcionais ao androide (que é escala 1 = ~1,6 m), portanto visualmente pequenos perto dos Mechs de escala 2 (~5,3 m). Modelos e efeitos de voo: **Codex**. HUD de status da frota e câmera de visão do drone: **Gemini** #mechs
- [ ] **Missões de sobrevivência por fases** (27/09 — expandido): referência *Project Zomboid*, ondas crescentes de androides humanoides + Mechs rebeldes, mapa com setores que fecham, solo ou co-op. Lógica de ondas no servidor: **Claude**. Interface completa (briefing, HUD de onda, resumo final): **Gemini** #modos
- [ ] Rádio das IAs rebeldes: provocações geradas por modelo de linguagem no servidor, entre rodadas (nunca decidindo o combate) #ia
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
