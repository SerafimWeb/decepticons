# ESTADO ATUAL — Cyber-Mech Protocol

**Status:** 🟡 EM DESENVOLVIMENTO: single-player jogável contra bots
**Última atualização:** 2026-09-23 (noite)
**Iteração atual:** Fase 2 (Inimigos): bots v1 prontos; falta a rodada com placar e o Blind Mode

---

## ÚLTIMA SESSÃO FEZ
- Fundação: Protocolo Serafim UM, CI, Vitest, smoke headless, bundle de ~188 KB gzip, engasgo da corrida corrigido
- Trabalho com vários agentes (Claude, Codex, Gemini): `AGENTS.md` único; `CLAUDE.md` e `GEMINI.md` importam ele
- Combate v1 (PR #3): dano por parte, morte com explosão e respawn, marcador de acerto
- Painel de desempenho na tecla `'` (PR #5), refeito depois da tentativa do GPT-OSS
- **Bots v1 (Claude, a pedido do dono):** 3 Vector-09 inimigos que patrulham, veem só com linha de visão, reagem, perseguem, atacam andando de lado, recuam com o torso baixo e renascem longe do jogador. O jogador também morre e renasce, com integridade das 6 partes no HUD, borda vermelha ao tomar dano, tela "ABATIDO" e placar de abates/mortes. Pausar congela o mundo. 32 testes. **O dono jogou: "estão atacando bem, não ficaram perdidos, estão vindo pra cima de mim"**

## PENDENTE
- [ ] Fase 2: rodada de 5 min com placar e reinício automático; Blind Mode (cabeça destruída); níveis de dificuldade (os parâmetros já existem em `BotSkill`)
- [ ] Fase 1, sobras: arma secundária (foguetes no braço esquerdo) e otimizar os draw calls por Mech (~34 cada; 4 Mechs ≈ 190 draws)
- [ ] Confirmar em jogo real que F1 esconde o HUD sem abrir a Ajuda do navegador
- [ ] Painel visual do projeto (mapa de frentes e fases), pedido do dono em 23/09

## RASCUNHO ANTIGO DE BOTS (superado)
O rascunho do GPT-OSS continua no stash local (`git stash list`: "rascunho GPT-OSS/Gemini 23-09…"). Foi superado pelos bots v1 e pode ser descartado pelo dono (`git stash drop`). Não reaproveitar: andava na direção errada e lia a posição de render (ver histórico).

## MODELOS DE IA
- **Gemini Flash:** bom para tarefas de código bem especificadas dentro do protocolo (fez G12 e o painel de debug).
- **gpt-oss 120B:** só para conversa de design. Em 23/09 entregou código que nem compilava e disse que estava pronto; **não usar para editar este repositório**.

## DIVISÃO DE TRABALHO ENTRE AGENTES
Regras no `AGENTS.md` ("Trabalho com vários agentes"). Um branch por tarefa a partir da `main` atualizada, PR com CI verde, revisão cruzada.
**Merge nesta fase:** o dono autorizou merge direto com CI verde (combate → inimigos). A revisão cruzada acontece depois, quando outro agente estiver disponível.

| Agente | Território (arquivos) | Situação |
|---|---|---|
| **Claude** | `client/src/combat/`, `client/src/entities/`, `client/src/physics/`, `client/src/player/`; depois `shared/`, `server/`, `client/src/net/` | Entregou combate e bots v1. Segue na Fase 2 |
| **Gemini** | `client/src/core/Quality.ts`, `client/src/debug/`, `client/src/ui/` | Disponível para revisar os PRs de combate e de bots |
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
Painel visual do projeto (pedido do dono), depois a rodada de 5 min com placar, fechando a Fase 2.
