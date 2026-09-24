# ESTADO ATUAL — Cyber-Mech Protocol

**Status:** 🟡 EM DESENVOLVIMENTO: single-player jogável contra bots
**Última atualização:** 2026-09-24
**Iteração atual:** Fase 2 (Inimigos) fechada; controles e configurações prontos. Próximo: sobras da Fase 1 (foguetes, draw calls), som, depois Fase 3 (multiplayer)

---

## ÚLTIMA SESSÃO FEZ
- Fundação: Protocolo Serafim UM, CI, Vitest, smoke headless, bundle de ~188 KB gzip, engasgo da corrida corrigido
- Trabalho com vários agentes (Claude, Codex, Gemini): `AGENTS.md` único; `CLAUDE.md` e `GEMINI.md` importam ele
- Combate v1 (PR #3): dano por parte, morte com explosão e respawn, marcador de acerto
- Painel de desempenho na tecla `'` (PR #5), refeito depois da tentativa do GPT-OSS
- **Site no ar: https://www.selvamkt.com.br/cybermech/** (painel de missão na raiz, jogo em `/jogar/`). Publica sozinho a cada merge na `main`. Secrets configurados pelo Claude a partir do setup do CAPTIA, com autorização do dono. Testado em produção num Chrome real: painel → Jogar → jogo, sem erros
- **Rodada de 5 min com placar (Tab) e reinício automático**, fechando a Fase 2; bots com indicativos
- **Painel de missão com cara de HUD cyberpunk das antigas** (pedido do dono: "militar, hacker, Shadowrun, BattleTech"): terminal de fósforo âmbar com varredura de CRT, rota das fases num mapa hexagonal, frentes como "sistemas da unidade" com slots críticos, ficha técnica do Vector-09 lida do código do jogo e o carimbo "SEM PAY-TO-WIN" lido do GAME_DESIGN
- **Painel de missão** (pedido do dono): página gerada do `ROADMAP.md` com a rota das fases, as 11 frentes (nível, progresso, itens) e as conquistas (PRs mergeados). `npm run painel` gera em `.tmp/painel/`; o `npm run check` reprova roadmap fora do formato. Vai para o site junto com o jogo
- **Bots v1 (Claude, a pedido do dono):** 3 Vector-09 inimigos que patrulham, veem só com linha de visão, reagem, perseguem, atacam andando de lado, recuam com o torso baixo e renascem longe do jogador. O jogador também morre e renasce, com integridade das 6 partes no HUD, borda vermelha ao tomar dano, tela "ABATIDO" e placar de abates/mortes. Pausar congela o mundo. 32 testes. **O dono jogou: "estão atacando bem, não ficaram perdidos, estão vindo pra cima de mim"**
- **Tela de Configurações (#ux) (Gemini):** Implementado o componente `SettingsMenu` em `client/src/ui/SettingsMenu.ts`, botão `[ CONFIGURAÇÕES ]` no overlay de pausa, modal cyberpunk/terminal no `index.html` e estilos em `styles.css`. Permite controle de sliders de sensibilidade e FOV, checkboxes de inverter Y e painel de desempenho, selects de qualidade e dificuldade, remapeamento interativo das 7 teclas (com swap automático e bloqueio de RESERVED_KEYS) e botão de restaurar padrão. Integrado à `main` pelo Claude (o branch não tinha PR e conflitava com a rodada); revisão cruzada aprovada.
- **Estande de calibração do mouse (Claude, pedido do dono: "no jogo é muito rápido para a configuração fina"):** `[ CALIBRAR MOUSE ]` na pausa e na tela de configurações. Faixa de bússola com o mouse preso e o jogo parado; "gravar 1 volta" transforma o gesto real em sensibilidade; DPI + cm/360; ±1%/±10%; entrada crua (sem a aceleração do Windows) ligada por padrão. **A escala mudou:** 1,00x agora = ~25 cm por volta a 800 DPI (antes ~9 cm, rápido demais); o slider vai de 0,10x a 5,00x. Esc no remapeamento de tecla agora cancela
- **Kill feed e indicador de direção do dano (#ux) (Gemini):** Implementados `ui/KillFeed.ts` (pool fixo de 4 slots, 5s de visibilidade, nomes via `textContent`, destaque para o jogador) e `ui/DamageIndicator.ts` (arco vermelho animado por CSS, função pura de cálculo com testes unitários em `ui/DamageIndicator.test.ts`). Ligação no `Game.ts`.
- **Regra 13 no `AGENTS.md`:** agente termina com PR → CI verde → merge, e o merge publica o site sozinho (o dono testa em produção)

## PENDENTE
- [ ] Dono testar a calibração do mouse no site (gravar 1 volta, conferir no jogo)
- [ ] Fase 1, sobras: arma secundária (foguetes no braço esquerdo) e otimizar os draw calls por Mech (~34 cada; 4 Mechs ≈ 190 draws)
- [ ] Confirmar em jogo real que F1 esconde o HUD sem abrir a Ajuda do navegador

## RASCUNHO ANTIGO DE BOTS (superado)
O rascunho do GPT-OSS continua no stash local (`git stash list`: "rascunho GPT-OSS/Gemini 23-09…"). Foi superado pelos bots v1 e pode ser descartado pelo dono (`git stash drop`). Não reaproveitar: andava na direção errada e lia a posição de render (ver histórico).

## MODELOS DE IA
- **Gemini Flash:** bom para tarefas de código bem especificadas dentro do protocolo (fez G12, painel de debug, Blind Mode e a tela de configurações).
- **gpt-oss 120B:** só para conversa de design. Em 23/09 entregou código que nem compilava e disse que estava pronto; **não usar para editar este repositório**.

## DIVISÃO DE TRABALHO ENTRE AGENTES
Regras no `AGENTS.md` ("Trabalho com vários agentes"). Um branch por tarefa a partir da `main` atualizada, PR com CI verde, revisão cruzada.
**Merge nesta fase:** o dono autorizou merge direto com CI verde (combate → inimigos). A revisão cruzada acontece depois, quando outro agente estiver disponível.

| Agente | Território (arquivos) | Situação |
|---|---|---|
| **Claude** | `client/src/combat/`, `client/src/entities/`, `client/src/physics/`, `client/src/player/`, `scripts/`, `.github/`, `vite.config.ts`; depois `shared/`, `server/`, `client/src/net/` | Livre: próxima tarefa a escolher (foguetes, draw calls ou som) |
| **Gemini** | `client/src/ui/`, `client/src/styles.css`, `client/index.html`, `client/src/debug/`, `client/src/core/Quality.ts` | **Concluído:** Kill feed e indicador de direção do dano. PR mergeado. |
| **Codex** | a combinar | Sem crédito até 24/09. Ao voltar: revisar os PRs já mergeados |
| **Zona compartilhada** | `client/src/core/Game.ts`, `package.json`, `.decepticons/` | Só fiação e PR pequeno; quem mergear depois faz rebase e roda `npm run check` |

## DECISÕES EM ABERTO
| Decisão | Situação |
|---|---|
| Hospedagem do servidor | Recomendação em `DEPLOY.md`. Decidir na Fase 3 (multiplayer). |
| Bots contra bots | Hoje os bots só caçam o jogador. No modo "todos contra todos" eles deveriam se enfrentar também: basta passar todos os Mechs em `BotSystem.targets`. Decidir junto com a rodada/placar. |

## BLOQUEIOS
- Nenhum.

## PRÓXIMA SESSÃO COMEÇA COM
Dono: testar no site a tela de configurações e a calibração do mouse. Gemini: kill feed + indicador de direção do dano (só `ui/`, prompt pronto no chat de 24/09). Claude: foguetes (arma secundária) ou som, a escolher pelo dono. **Cada agente no seu worktree** (regra 12) e **do PR ao site sem esperar** (regra 13).
