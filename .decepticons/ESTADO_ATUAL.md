# ESTADO ATUAL — CYBERMECH

**Status:** 🟡 EM DESENVOLVIMENTO: single-player jogável contra bots, no ar em https://www.selvamkt.com.br/cybermech/
**Última atualização:** 2026-09-25
**Iteração atual:** fim da Fase 3 (Vitrine e polimento: tela do Hangar, polimento de interface e som) e começo da Fase 4 (multiplayer: M1 feita em parte, `MULTIPLAYER.md`, seção 8)

---

## ÚLTIMA SESSÃO FEZ (24–25/09)
- **Proposta do universo (Claude; dono: "geopolítica geral, big techs, segurança digital, pois somos SERAFIM, e termos do CTI"):** `UNIVERSO.md` com a premissa (as IAs caçam chips, energia e dados; a SERAFIM responde ao incidente com Mechs), geopolítica fictícia com o Brasil no centro, consórcios fictícios, o glossário de CTI aplicado ao jogo (incidente, TTPs do ATT&CK, C2, Red × Blue × Purple, boletins TLP:CLEAR) e mecânicas sugeridas. Frente nova `#universo`. Aguarda as decisões da seção 7.
- **Peso, escala e fôlego (Claude; dono: "andróides parecem grandes"; "Mechs rápidos para o peso"; "o calor está muito rigoroso, pouco desempenho para fugir e combater contra 3"):**
  - Andróides de 1,6 m (eram 2 m); o modelo escala com a altura do chassi.
  - Vector-09 a 9 m/s (era 12), arrancada e freada de ~0,3 s (inércia), dash 34 m/s. Passada proporcional à perna; passos com som (o `playStep` do Gemini passou a tocar) e tremor leve; Mech gigante perto de quem é pequeno treme a câmera a cada passo.
  - Calor com fôlego: ~15 tiros de plasma segurando (eram 12), trava de ~2 s (era 2,4), correr quase não esquenta, superaquecido anda a 75% (era 50%). O combo continua acima de 2,5 s (varredura de 960 calibragens contra as regras de equilíbrio).
  - Achados no diretor de ataque (R17): o turno só passava quando o atacante superaquecia (quem terminava o turno ganhava a vaga de novo por estar mais perto), e quem ganhava a vaga de longe largava no caminho. Agora: fim do turno vai para o fim da fila, quem espera há mais tempo vai primeiro, e a vaga vale durante a aproximação.
- **Jogar de andróide (Claude; dono: "também quero poder jogar com andróides menores, com a impressão de combater um Mech bem maior"):** botão `[ PILOTAR ANDRÓIDE ]` na pausa (ou o link da landing, `?build=v1.android.blaster-0.chainsaw-0`). Andróide de 2 m com blaster no clique esquerdo e motosserra no direito (só encostado), 3× a vida do rebelde; câmera baixa e perto, na escala do andróide, para os Mechs de 5,3 m parecerem enormes. Mech rebelde andando para cima pisa nele (2 passos). A escolha fica no Hangar (chassi `android`).
- **Motosserra e pisão (Claude; pedido do dono):** andróides com motosserra (só corta encostado, pega as pernas), Mech esmaga andróide encostado andando para cima dele (2 passos), nomes sobre a cabeça menores e nítidos.
- **Nomes das IAs nos bots (Claude; pedido do dono):** CLAUDE·BRABO, GEMINI, CHATGPT·FUJÃO, QWEN, DEEPSEEK, ANTHROPIC (técnico), com o nome sobre a cabeça. **Guia visual dos robôs** e textos para a IA de imagem em `ESTILO_ROBOS.md`.
- **M1 do multiplayer (Claude):** `sim/Match.ts`, a partida inteira sem tela; o jogo monta a partida por ela e o servidor vai rodar a mesma. 0,74 ms por tick com a sala cheia. Achado: destroços no mesmo mundo físico mudam a simulação (o servidor roda sem eles).
- **Correção: Mechs brancos (Claude, achado jogando):** depois do PR #43 (Codex), o casco saía todo branco e brilhando até o primeiro dano: a cor do flash de dano nascia branca (`new THREE.Color()`). Agora nasce preta; Vector-09 amarelo e rebeldes vermelhos de volta.
- **Pendências do Gemini concluídas (Claude; o Gemini ficou sem crédito no dia):** setas de inimigos fora da tela (PR #40, com os ajustes da revisão), sons dos andróides com volume pela distância, dicas novas da primeira partida (calor, foguetes, andróides). O PR #40 foi fechado apontando para o do Claude.
- **Bots com personalidade e sem "me juntam" (Claude; dono: "muito difícil, eles são muitos e me juntam"):** brabo, manso, fujão e soldado; diretor de ataque com no máximo 2 atacando juntos (os outros esperam afastados e revezam); padrão com 2 andróides em vez de 3. Tudo configurável na seção "Inimigos" das configurações (Claude fez a seção num PR pequeno, com o aval da regra 4; o Gemini não precisa mais do item 3 da fila dele).

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
- [ ] **Dono:** jogar no celular (deitado) e dizer se a mira e o tiro ficaram bons (forte ou fraca demais?); no PC, testar configurações, calibração e som
- [ ] **Dono:** gerar as pranchas dos robôs numa IA de imagem com os textos do `ESTILO_ROBOS.md` e salvar em `.tmp/arte/`
- [ ] **Dono:** jogar com as motosserras (andróides colados nas pernas) e pisar neles (ande para cima de um encostado)
- [ ] **Dono:** jogar de andróide (pausa → `[ PILOTAR ANDRÓIDE ]`): a câmera passa a sensação de Mech gigante? Vida, blaster e motosserra estão justos? A animação de passo ainda é a do Mech
- [ ] **Dono:** jogar com o diretor de ataque (no máximo 2 atacando juntos) e as personalidades; dizer se ficou fácil demais (dá para subir "Atacam ao mesmo tempo" nas configurações)
- [ ] **Dono:** jogar com o calor novo (~15 tiros segurando, trava de ~2 s, superaquecido anda a 75%) e o Mech mais pesado (9 m/s, com inércia e passos): ficou bom para lutar contra 3? Se ainda apertar, o próximo ajuste é o resfriamento
- [ ] **Dono:** jogar com as armas novas (menos dano, calor compartilhado com os foguetes) e dizer se a luta ficou lenta ou rápida demais; decidir as perguntas do fim do `HANGAR.md`
- [ ] **Dono:** ouvir a vinheta da marca no jogo (som, volume, duração) e ver a abertura da landing (numa aba anônima ela roda de novo)
- [ ] Confirmar em jogo real que F1 esconde o HUD sem abrir a Ajuda do navegador
- [ ] **Dono:** decidir a separação simulação × render × efeitos (`MULTIPLAYER.md`, seção 9) e as 4 decisões da seção 10

## RASCUNHO ANTIGO DE BOTS (superado)
O rascunho do GPT-OSS continua no stash local (`git stash list`: "rascunho GPT-OSS/Gemini 23-09…"). Foi superado pelos bots v1 e pode ser descartado pelo dono (`git stash drop`). Não reaproveitar: andava na direção errada e lia a posição de render (ver histórico).

## MODELOS DE IA
- **Gemini Flash:** bom para tarefas de código bem especificadas dentro do protocolo (fez G12, painel de debug, Blind Mode, tela de configurações e som). Costuma esquecer o PR: conferir se o branch virou PR.
- **Codex (OpenAI):** bom em render e desempenho (#43: draw calls 34 → 9; #44: explosões). Mudança visual pede captura de tela no PR: o #43 deixou os robôs brancos até o primeiro dano sem o check perceber (corrigido no #48).
- **gpt-oss 120B:** só para conversa de design. Em 23/09 entregou código que nem compilava e disse que estava pronto; **não usar para editar este repositório**.

## DIVISÃO DE TRABALHO ENTRE AGENTES
Regras no `AGENTS.md` ("Trabalho com vários agentes"). Um branch por tarefa a partir da `main` atualizada, cada agente na sua pasta (regra 12), PR com CI verde e merge pelo próprio agente (regra 13). As etiquetas do PR dizem a frente e o agente.
**Merge nesta fase:** o dono autorizou merge direto com CI verde. A revisão cruzada acontece depois.

| Agente | Território (arquivos) | Situação |
|---|---|---|
| **Claude** | `client/src/combat/`, `client/src/entities/`, `client/src/physics/`, `client/src/player/`, `scripts/`, `.github/`, `vite.config.ts`; depois `shared/`, `server/`, `client/src/net/` | M1 do multiplayer no ar (partida sem tela). Próximo: M2 (contratos e codec) e M3 (servidor no PC do dono) |
| **Gemini** | `client/src/ui/`, `client/src/audio/`, `client/src/styles.css`, `client/index.html`, `client/src/debug/`, `client/src/core/Quality.ts` | Sem crédito em 25/09; as pendências dele foram concluídas pelo Claude. Ao voltar, um PR cada: 1) passos: o `playStep` dele agora toca a cada passo (`MechBase.onFootstep`, desde o #54); deixar o do Mech grave e pesado, com variação entre os pés, e o do andróide leve; 2) temperatura no HUD (marca de 70%, "RESFRIANDO" com `mech.coolingBoost`) e sons de calor; 3) abertura da rodada (3·2·1) e fim de rodada com estatísticas, com os textos num lugar só para trocar pelo vocabulário de CTI se o dono aprovar o `UNIVERSO.md`; 4) aviso de ABATE e sequência; 5) tela de carregamento; 6) música. **A tela do Hangar passou para o Codex** |
| **Codex** | visual e render do mundo 3D (`client/src/fx/`, o visual de `environment/` e dos modelos em `entities/meshKit.ts` e nos rigs, sem stats nem regras), pós-processamento, desempenho de render; revisão cruzada; **em 25/09, a tela do Hangar** (`ui/HangarMenu.ts`, com prévia 3D) | Feito: draw calls 34 → 9 (#43), explosões e impactos (#44). Fila, um PR cada (recomendação de 25/09; o dono pode reordenar): 1) **kit de Mechs por parâmetros**: um `MechBlueprint` em números (altura, largura e profundidade do torso, perna reta ou dobrada, tamanho das ombreiras, tipo de cabeça, respiros, antena) que monta o rig com as mesmas 6 partes, chanfros e uma textura de painéis gerada por código, sem passar de 10 draw calls; recriar os conceitos do dono (`.tmp/arte/`) como 3 blueprints (leve, médio, pesado) e mostrar as silhuetas lado a lado, em preto, como na prancha. Sem Blender e sem modelo pronto: o visual muda por número; 2) tela do Hangar contra `game.hangar` (`HANGAR.md`, seção 2); 3) calor visível no Mech (blindagem acende ao esquentar, vapor ao superaquecer, com `mech.heatState` e `mech.coolingBoost`); 4) visual de cada nível de arma (MK II e MK III diferentes, trocando no `equip`); 5) revisão cruzada dos PRs #45 a #55 |
| **Zona compartilhada** | `client/src/core/Game.ts`, `package.json`, `.decepticons/` | Só fiação e PR pequeno; quem mergear depois junta a `main` e roda `npm run check` |

## DECISÕES EM ABERTO
| Decisão | Situação |
|---|---|
| Hospedagem do servidor | Recomendação em `DEPLOY.md`; plano em `MULTIPLAYER.md` (seção 10, com mais três decisões: mira assistida no PvP, bots nas salas, código da sala). Decidir antes da etapa M8. |
| Mira assistida no multiplayer | Hoje é só do toque e só contra bots. Com gente de verdade, toque x mouse na mesma sala precisa de regra: manter (padrão dos jogos de tiro no celular), reduzir contra humanos ou separar salas por tipo de controle. Decidir na Fase 4. |
| Separação simulação × render × efeitos | Proposta e critérios de aceitação em `MULTIPLAYER.md`, seção 9. Recomendação: tiro do jogador e yaw pela simulação antes da M4; o resto quando memória do servidor ou correções visíveis pedirem. |
| Nomes de marcas nos bots | CLAUDE, GEMINI, CHATGPT, QWEN, DEEPSEEK e ANTHROPIC são marcas registradas. Antes do lançamento (portais, anúncios), manter ou trocar por paródias (ex.: CLAWD, JEMINI, CHAD-GPT). A troca é a lista `BOT_NAMES`. |
| Universo (`UNIVERSO.md`, seção 7) | Premissa, Brasil no centro do mapa, quanto de CTI entra (só textos ou também mecânicas) e nomes dos consórcios. Nada muda no jogo antes do aval. |
| Bots contra bots | Hoje os bots só caçam o jogador. No modo "todos contra todos" eles deveriam se enfrentar também: basta passar todos os Mechs em `BotSystem.targets`. |

## BLOQUEIOS
- Nenhum.

## PRÓXIMA SESSÃO COMEÇA COM
- **Claude:** M2 (contratos de rede e codec: `NetInput` com yaw e pitch, estado, mensagens), que não depende da separação; depois a M3 (servidor Colyseus no PC do dono, sala por `?sala=`) com a cena descartável e efeitos vazios, conforme a decisão sobre a seção 9 do `MULTIPLAYER.md`.
- **Codex:** kit de Mechs por parâmetros a partir dos conceitos do dono, depois a tela do Hangar, o calor visível, o visual dos níveis de arma e a revisão cruzada dos PRs #45 a #55 (fila na divisão de trabalho).
- **Gemini** (quando voltar o crédito): a fila da divisão de trabalho acima, começando pelos passos e pelo calor no HUD; a tela do Hangar não é mais dele.
- **Dono:** testar no site (peso do Mech, calor novo, andróides menores, jogar de andróide, revezamento dos bots), decidir o universo (`UNIVERSO.md`, seção 7), a seção 9 e as decisões da seção 10 do `MULTIPLAYER.md`, salvar em `.tmp/arte/` os conceitos de robô que quer ver no jogo e medir o FPS num notebook com GPU integrada.
