# ESTADO ATUAL — Cyber-Mech Protocol

**Status:** 🟡 EM DESENVOLVIMENTO: single-player jogável contra bots, no ar em https://www.selvamkt.com.br/cybermech/
**Última atualização:** 2026-09-24 (tarde)
**Iteração atual:** Fase 3 (Vitrine e polimento): som, celular, kill feed e o site com o case; depois a Fase 4 (multiplayer)

---

## ÚLTIMA SESSÃO FEZ (24/09)
> As sessões anteriores estão no `HISTORICO_DE_DECISOES.md` (cofre) e nas entregas dos bastidores.
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
- **Som dos foguetes (Gemini):** som sintetizado para o lançamento usando `AudioSystem.playRocketLaunch()` ligado no `player.onRocket`.

## PENDENTE
- [ ] **Gemini:** atualizar o `STATUS_REAL` e o `ROADMAP` quando entregar (o PR #17 entrou sem mexer neles). O celular foi refeito pelo Claude a pedido do dono: antes de mexer em `ui/TouchControls.ts`, puxe a `main`
- [ ] **Gemini:** volume e mixagem nas configurações → primeira partida guiada. Um PR por tarefa, a partir da `main` atualizada
- [ ] **Dono:** jogar no celular (deitado) e dizer se a mira e o tiro ficaram bons (forte ou fraca demais?); no PC, testar configurações, calibração e som
- [ ] Fase 3: foguetes (arma secundária), draw calls por Mech (~34 cada), volume e mixagem nas configurações
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
| **Claude** | `client/src/combat/`, `client/src/entities/`, `client/src/physics/`, `client/src/player/`, `scripts/`, `.github/`, `vite.config.ts`; depois `shared/`, `server/`, `client/src/net/` | Foguetes e atividade da equipe no ar. Próximo: calibrar mira e foguetes com o playtest do dono; depois draw calls por Mech (antes do multiplayer) |
| **Gemini** | `client/src/ui/`, `client/src/audio/`, `client/src/styles.css`, `client/index.html`, `client/src/debug/`, `client/src/core/Quality.ts` | Som dos foguetes, volume e mixagem, primeira partida guiada (prompt no chat de 24/09; nesta ordem, um PR cada) |
| **Codex** | a combinar | Ao voltar: revisão cruzada dos PRs mergeados desde o #12 |
| **Zona compartilhada** | `client/src/core/Game.ts`, `package.json`, `.decepticons/` | Só fiação e PR pequeno; quem mergear depois junta a `main` e roda `npm run check` |

## DECISÕES EM ABERTO
| Decisão | Situação |
|---|---|
| Hospedagem do servidor | Recomendação em `DEPLOY.md`. Decidir na Fase 4 (multiplayer). |
| Mira assistida no multiplayer | Hoje é só do toque e só contra bots. Com gente de verdade, toque x mouse na mesma sala precisa de regra: manter (padrão dos jogos de tiro no celular), reduzir contra humanos ou separar salas por tipo de controle. Decidir na Fase 4. |
| Bots contra bots | Hoje os bots só caçam o jogador. No modo "todos contra todos" eles deveriam se enfrentar também: basta passar todos os Mechs em `BotSystem.targets`. |

## BLOQUEIOS
- Nenhum.

## PRÓXIMA SESSÃO COMEÇA COM
Gemini: juntar a `main` no kill feed e mergear (regra 13). Claude: conferir o site publicado e seguir para foguetes ou draw calls. Dono: testar o som, as configurações e a calibração no site.
