# ESTADO ATUAL — CYBERMECH

**Status:** 🟡 EM DESENVOLVIMENTO: single-player jogável contra bots, no ar em https://www.selvamkt.com.br/cybermech/
**Última atualização:** 2026-09-25
**Iteração atual:** Fase 3 (Vitrine e polimento): som, celular, kill feed e o site com o case; depois a Fase 4 (multiplayer)

---

## ÚLTIMA SESSÃO FEZ (24–25/09)
- **FX de explosões e impactos (Remoratrader/Codex):** pontos com tamanho e expansão por partícula; fogo, faíscas, fumaça, poeira e impacto ganharam escalas e durações distintas. O pool tem teto explícito de 3000, sobrescreve as partículas mais antigas e usa buffers tipados fixos (sem alocação no update por frame).
- **Plano do multiplayer (Claude):** `MULTIPLAYER.md` com pré-requisitos, arquitetura, orçamento de banda (~4 KB/s por jogador, meta de 8), contratos e etapas M0–M8. A Fase 4 do ROADMAP virou as etapas. Revisão cruzada do PR #40 (Gemini) postada no GitHub: conflito com a main e uma alocação por quadro.
- **Contrato do Hangar (Claude):** montagem validada (encaixe, carga de 11 t, nível), salva no aparelho, trocada no renascimento, e link de build `/jogar/?build=…`. Chassis sem 3D em `entities/chassis.ts`. A landing mostra as 9 combinações com link para jogar. **A tela do Hangar (Gemini) está liberada:** API em `HANGAR.md`, seção 2.
- **Gestão nos bastidores (Claude; dono: "ferramentas de gerenciamento de projeto, gestão de entregas, planejamento, gráficos que digam muito"):** quadro Agora/Próximo/Depois com código por item, burn-up, linha do tempo das fases com estimativa, matriz frentes × fases e as quatro métricas DORA (hoje: ~20 deploys por dia, ~6 min do commit ao ar, 2,4% de falha, ~14 min para recuperar).
- **Calor completo e a Oficina (Claude; dono: "oficina mecânica de alto padrão"; "tudo aumenta o calor; os mechs precisam PARAR pra resfriar"):**
  - Tiro (coeficiente de cada arma), corrida, pulo, dash e dano esquentam o mesmo dissipador; parado esfria em dobro; superaquecido trava armas, pulo e dash e anda na metade. Bots param para esfriar.
  - Página `/cybermech/oficina/`: bancada gerada pela simulação do jogo (calor por ação, 6 exercícios de 20 s, placar, tempo por parte, dano × distância, chassis). Achado: rajadas curtas parando na pausa rendem ~64% mais dano que correr atirando.
- **Armas calibradas e o Hangar em projeto (Claude; dono: "3 níveis de poder em cada arma; dano realista, sem apelação; começar a projetar o HANGAR"):**
  - Arsenal em dados (`combat/weapons.ts`) com MK I, II e III na mesma regra; poder custa carga (dano por tonelada cai a cada nível).
  - Dano recalibrado com metas travadas por 15 testes: plasma MK I derruba um Vector-09 em ~6 s de acerto perfeito (antes ~2 s); nenhum combo abaixo de 2,5 s. Plasma perde força depois de 60 m.
  - Calor passou a ser do Mech: plasma e foguetes esquentam o mesmo dissipador.
  - Cadência exata: o tiro não arredonda mais para o tick.
  - Hangar especificado em `HANGAR.md`; a página do jogo ganhou a seção "Hangar" (planta do Mech, arsenal, regras de equilíbrio, plano), com números lidos do código.
- **Marca SERAFIM WEB (Claude; dono: "ar de grande estúdio"; "nossa marca por 1 a 2 segundos, como SEGA, Konami, PlayStation"):**
  - **Vinheta no jogo** (`client/src/brand/`): no primeiro "clique para jogar", tela preta, o emblema acende, o letreiro abre e toca uma vinheta sonora sintetizada (sopro, impacto grave, acorde com eco), ~1,9 s. Clique ou tecla pula. Roda no primeiro clique porque o navegador só libera som depois de um gesto.
  - **Abertura na landing:** chuva de pontos verdes em matriz com o emblema e o letreiro, ~2 s, uma vez por sessão; pula com clique, toque ou tecla; não roda com "reduzir movimento".
  - **Assinatura discreta:** "um jogo SERAFIM WEB" na pausa; versão do build no canto da pausa (`CYBERMECH v0.2.0-… · © 2026 SERAFIM WEB`, lida do `git describe`); "SERAFIM WEB apresenta" na landing; © nos rodapés; `<meta name="author">`. Nada no HUD de combate.
  - Arquivos em `client/public/brand/`: emblema de `serafim13/vetorserafim.png` e letreiro com o fundo tirado por código (~56 KB juntos).
- **Andróides "rápidos, mas fracos" e o técnico (Claude, pedido do dono):**
  - Andróides de combate: 2 tiros derrubam, tiro de 4, mira solta.
  - **T-01** conserta os Mechs rebeldes com um feixe amarelo e foge do jogador. Alvo prioritário.
  - Funções futuras da escala 1 no GAME_DESIGN: coletor, logística e piloto de máquinas.
  - A arena agora tem 8 unidades (o tamanho de sala). Código de direção comum aos cérebros em `combat/steer.ts`.
- **Cidade estilo Tron (dono: "volte o ciano, o pink, vermelho aceso, amarelo fluorescente; sci-fi espacial"):** prédios, barricadas e horizonte multicoloridos, grade ciano e céu estrelado; verde segue sendo do jogador e vermelho das IAs
- **Tema e escalas (dono, 25/09: "temos que defender contra IAs rebeldes"):** escala 1 = robôs do tamanho dos humanoides de hoje; escala 2 = Mechs como o Vector-09 (GAME_DESIGN, "TEMA E ESCALAS")
- **Andróides rebeldes, escala 1 (Claude):** 3 na arena, pequenos, frágeis e muito ágeis; a IA ganhou perfil de luta por tipo (o andróide chega perto, zigue-zagueia e desvia com dash). O dano de cada tiro agora vem da arma de quem atira
- **CYBERMECH (dono, 25/09):** o jogo passou a se chamar CYBERMECH, sem o "Protocol": jogo, site, documentos e pacote
- **Paleta neon multicolorida (dono: "verde neon, vermelho, diversas cores"):** HUD e tiro do jogador em verde neon; IAs rebeldes em vermelho; prédios verde, amarelo e branco; fogo e foguetes em laranja. O site continua no âmbar de terminal
> As sessões anteriores estão no `HISTORICO_DE_DECISOES.md` (cofre) e nas entregas dos bastidores.
- **Primeira partida guiada (Gemini):**
  - Módulo `Onboarding.ts` adicionado com dicas de texto no rodapé sem cobrir a mira.
  - Gatilhos contextuais disparados pelo `Game.ts` (ex: ao andar, mirar no inimigo, atirar foguetes, ou receber dano).
  - Dicas somem automaticamente em 5s e só aparecem na primeira vez (guardadas no `localStorage`).
- **Calibragem do Vector-09 (Claude; dono: "muito rápido; o tiro precisa de um respiro, não dá pra ficar direto assim pra não apelar"):**
  - Andar de 16 para 12 m/s, arrancada menos instantânea, dash de 50 para 42 com recarga de 3 s.
  - Cadência de 7 para 5,5 tiros/s e **calor na arma**: ~12 tiros seguidos superaquecem e travam ~2,4 s; em rajadas não trava. Vale para jogador e bots.
  - De quebra: um raio de visão perdido (erro numérico do Rapier) zerava a reação do bot; agora ele só esquece o alvo depois de 2 falhas seguidas.
- **Paleta âmbar industrial (Claude; dono: "azul e roxo é a assinatura de feito com IA"):**
  - Jogo e site na mesma identidade: âmbar, laranja de sódio, vermelho de alerta, branco quente e aço.
  - Inimigos verde-oliva com visor e tiros vermelhos.
  - Mundo 3D pelo `core/palette.ts`; interface por tokens com nome de papel (`--accent`, `--hot`, `--alert`, `--ink`).
- **Controles de toque, terceira volta (Claude; dono: "a mira ainda falha; botões num shape quadrado, tenho que segurar na ponta"):**
  - Botões redondos em arco em volta do polegar, com FOGO para dentro da tela.
  - "Ajustar controles" na pausa: arrastar cada botão e mudar o tamanho, salvo no aparelho (`ui/touchLayout.ts`, com testes de não sobreposição em 7 telas).
  - Velocidade do dedo suavizada: o ganho oscilava com os eventos irregulares.
  - A mira assistida solta o alvo quando o jogador puxa para longe.
- **Foguetes no braço esquerdo (Claude, pedido do dono):** casulo de 4 tubos; botão direito ou Q (remapeável) no PC, FOGUETE no toque; 4 no carregador (1 a cada 2,2 s); explosão de 6 m com dano que cai com a distância, na parte mais perto (no pé acerta a perna); indicador no HUD; 7 testes. Botão PLACAR no toque (o Tab do celular)
- **Bastidores com a atividade da equipe (Claude, pedido do dono: "cara de equipe empenhada"):** commits de cada agente, mapa de calor por hora, fluxo dos últimos 40 commits e entregas, pedidos do dono atendidos. Tudo lido do git e dos PRs; nada inventado
- **Produção: tudo em código (decisão do dono):** sem Unity e sem modelagem manual; Mechs gerados por código, som sintetizado. A variedade vem do Hangar (GAME_DESIGN)
- **Mira no celular (Claude, depois do teste do dono: "dificuldade de mirar e atirar"):**
  - Tiro automático: atira sozinho quando a mira acende.
  - Mira assistida só no toque: freia perto do inimigo, puxa de leve, acompanha e antecipa o voo do plasma.
  - Dedo com resposta lenta/rápida; mira acende sobre inimigos (celular e PC); vibração.
  - Nova seção "Toque (celular)" na tela de configurações para desligar a mira assistida e o tiro automático.
  - De quebra: o `raycast` alocava objetos a cada chamada (mira e cada projétil, todo quadro/tick); agora reaproveita (G4).
- **Celular refeito (Claude, depois do teste do dono: "não entrou no jogo, botões um sobre o outro, direcional preso"):**
  - O toque começa a partida: antes, as áreas de toque cobriam a pausa e engoliam o toque.
  - Direcional analógico que nasce onde o polegar encosta; mirar arrastando à direita; FOGO segura e mira junto.
  - PULO, DASH, CAM e pausa numa grade que não sobrepõe, com tamanho proporcional à tela.
  - Tela cheia deitado, pausa ao trocar de app; tela de pausa com instruções de toque e sem "calibrar mouse".
  - Notebook com tela de toque continua no mouse: o modo é o jeito que o jogador entrou.
  - O `npm run check` joga num celular emulado.
- **Site:** "Dan" no lugar de "diretor"; sem "feito em público" (pedido do dono)
- **Kill feed e indicador de direção do dano (Gemini, integrados pelo Claude):** o branch não tinha PR. Na revisão, o indicador errava o lado com a câmera virada (o teste supunha o yaw ao contrário do jogo); corrigido, com teste que usa a frente e a direita do jogo. O kill feed saiu de cima do rótulo da câmera e do botão de pausa do toque
- **Site em duas páginas (Claude, pedido do dono: "virar um case de desenvolvimento do game"):**
  - `/cybermech/` é a landing do jogo: capa, galeria, o que tem no jogo (seção VITRINE do `GAME_DESIGN`), ficha do Vector-09, controles, sem pay-to-win, o que está sendo construído.
  - `/cybermech/bastidores/` é o case: equipe (entregas e linhas por agente, das etiquetas dos PRs), como um pedido vira jogo, Protocolo Serafim UM, evolução (testes e linhas por merge, lidos do git), mapa da campanha, frentes, diário de decisões e entregas.
  - **Capturas automáticas:** o deploy entra no jogo headless, joga ~20 s e fotografa as três câmeras. As fotos viram a capa, a galeria e a prévia do link.
  - Conferido em produção (PR #19): capturas feitas pelo runner do CI, entregas lidas do GitHub.
- **Celular (Gemini, PR #17):** controles de toque no ar; ainda não conferidos num celular real
- **Planejamento reorganizado (pedido do dono):** nova **Fase 3: Vitrine e polimento** (som, celular, kill feed, site com o case, foguetes, draw calls). O multiplayer passou a ser a Fase 4. Fases 0, 1 e 2 fechadas
- **Gestão no GitHub (Claude):** cada PR ganha sozinho as etiquetas da frente (pelos arquivos) e do agente (pelo branch): `.github/labeler.yml` + workflow `etiquetas.yml`. Os 17 PRs antigos foram etiquetados. Modelo de PR (o que muda, custo de CPU, como testar no site) e notas de versão agrupadas por frente (`.github/release.yml`)
- **Acentos quebrados no site corrigidos (Claude):** a página saía sem `<!doctype>` e `<meta charset>`; o check agora reprova charset errado, modo quirks e o codinome interno na página pública
- **Som (Gemini, PR #15):** efeitos sintetizados na Web Audio API, sem arquivos: tiro, impacto, explosão com volume por distância, dash, pouso, parte destruída e chiado do Blind Mode
- **Tela de configurações (Gemini) e estande de calibração do mouse (Claude):** no ar. A escala da sensibilidade mudou: 1,00x ≈ 25 cm por volta a 800 DPI
- **Regra 13:** agente termina com PR → CI verde → merge, e o merge publica o site sozinho
- **Som dos foguetes e Volume (Gemini):** som sintetizado adicionado para lançamento de foguetes; controle de volume mestre adicionado às configurações.

## PENDENTE
- [ ] **Gemini:** atualizar o `STATUS_REAL` e o `ROADMAP` quando entregar (o PR #17 entrou sem mexer neles). O celular foi refeito pelo Claude a pedido do dono: antes de mexer em `ui/TouchControls.ts`, puxe a `main`
- [ ] **Gemini:** Próxima tarefa: setas-inimigos (ui/OffscreenIndicators.ts). Seta vermelha na borda da tela para inimigos fora da visão. Um PR por tarefa, a partir da `main` atualizada.
- [ ] **Dono:** jogar no celular (deitado) e dizer se a mira e o tiro ficaram bons (forte ou fraca demais?); no PC, testar configurações, calibração e som
- [ ] **Dono:** jogar com o calor completo (correr atirando ferve em ~2 s; parado esfria em dobro) e dizer se ficou punitivo demais
- [ ] **Dono:** jogar com as armas novas (menos dano, calor compartilhado com os foguetes) e dizer se a luta ficou lenta ou rápida demais; decidir as perguntas do fim do `HANGAR.md`
- [ ] **Dono:** ouvir a vinheta da marca no jogo (som, volume, duração) e ver a abertura da landing (numa aba anônima ela roda de novo)
- [ ] **Gemini:** o branch `gemini/sons-androides` saiu de uma `main` antiga e está sem PR: juntar a `main` (`git merge origin/main`), rodar `npm run check` e abrir o PR (regra 13)
- [ ] Fase 3: draw calls por Mech (~34 cada)
- [ ] Confirmar em jogo real que F1 esconde o HUD sem abrir a Ajuda do navegador

## RASCUNHO ANTIGO DE BOTS (superado)
O rascunho do GPT-OSS continua no stash local (`git stash list`: "rascunho GPT-OSS/Gemini 23-09…"). Foi superado pelos bots v1 e pode ser descartado pelo dono (`git stash drop`). Não reaproveitar: andava na direção errada e lia a posição de render (ver histórico).

## MODELOS DE IA
- **Gemini Flash:** bom para tarefas de código bem especificadas dentro do protocolo (fez G12, painel de debug, Blind Mode, tela de configurações e som). Costuma esquecer o PR: conferir se o branch virou PR.
- **gpt-oss 120B:** só para conversa de design. Em 23/09 entregou código que nem compilava e disse que estava pronto; **não usar para editar este repositório**.

## DIVISÃO DE TRABALHO ENTRE AGENTES
Regras no `AGENTS.md` ("Trabalho com vários agentes"). Um branch por tarefa a partir da `main` atualizada, cada agente na sua pasta (regra 12), PR com CI verde e merge pelo próprio agente (regra 13). As etiquetas do PR dizem a frente e o agente.
**Merge nesta fase:** o dono autorizou merge direto com CI verde. A revisão cruzada acontece depois.

| Agente | Território (arquivos) | Situação |
|---|---|---|
| **Claude** | `client/src/combat/`, `client/src/entities/`, `client/src/physics/`, `client/src/player/`, `scripts/`, `.github/`, `vite.config.ts`; depois `shared/`, `server/`, `client/src/net/` | Contrato do Hangar e plano do multiplayer no ar. Próximo: M1 (separar simulação e render, `shared/`) |
| **Gemini** | `client/src/ui/`, `client/src/audio/`, `client/src/styles.css`, `client/index.html`, `client/src/debug/`, `client/src/core/Quality.ts` | Sons dos andróides (branch sem PR). Fila, um PR cada: setas de inimigos fora da tela, abertura da rodada (3·2·1), aviso de ABATE e sequência, tela de carregamento, temperatura no HUD (marca de 70%, "RESFRIANDO" com `mech.coolingBoost`), sons de calor, fim de rodada com estatísticas, música (prompts no chat de 25/09) |
| **Codex** | visual e render do mundo 3D, `client/src/fx/`, o visual de `environment/` e dos rigs (`entities/meshKit.ts`, modelos; não os stats), pós-processamento, desempenho de render; revisão cruzada dos PRs | Revisou #36–#39 sem encontrar falha reproduzível; Vector-09 otimizado para 9 draw calls por rig; explosões e impactos agora têm escala animada e pool com teto de 3000, sem alocação no update por frame |
| **Zona compartilhada** | `client/src/core/Game.ts`, `package.json`, `.decepticons/` | Só fiação e PR pequeno; quem mergear depois junta a `main` e roda `npm run check` |

## DECISÕES EM ABERTO
| Decisão | Situação |
|---|---|
| Hospedagem do servidor | Recomendação em `DEPLOY.md`; plano em `MULTIPLAYER.md` (seção 8, com mais três decisões: mira assistida no PvP, bots nas salas, código da sala). Decidir antes da etapa M8. |
| Mira assistida no multiplayer | Hoje é só do toque e só contra bots. Com gente de verdade, toque x mouse na mesma sala precisa de regra: manter (padrão dos jogos de tiro no celular), reduzir contra humanos ou separar salas por tipo de controle. Decidir na Fase 4. |
| Bots contra bots | Hoje os bots só caçam o jogador. No modo "todos contra todos" eles deveriam se enfrentar também: basta passar todos os Mechs em `BotSystem.targets`. |

## BLOQUEIOS
- Nenhum.

## PRÓXIMA SESSÃO COMEÇA COM
Claude: etapa M1 do multiplayer (separar simulação e render, criar `shared/`). Dono: as 4 decisões do fim do `MULTIPLAYER.md` e medir o FPS numa GPU integrada. Gemini: tela do Hangar contra `game.hangar` (API em `HANGAR.md`). Codex: confirmar CI/merge do PR de FX e ficar disponível para revisão cruzada. Gemini: PR dos sons dos andróides, depois a fila de polimento. Dono: ouvir a vinheta e jogar no celular.
