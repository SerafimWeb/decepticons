# ESTADO ATUAL — Cyber-Mech Protocol

**Status:** 🟡 EM DESENVOLVIMENTO: protótipo single-player funcional
**Última atualização:** 2026-09-23
**Iteração atual:** Fase 1 — Combate (nova ordem: combate → inimigos → multiplayer)

---

## ÚLTIMA SESSÃO FEZ
- Fundação: Protocolo Serafim UM, CI, Vitest, smoke headless, bundle de 182 KB gzip, engasgo da corrida corrigido
- Trabalho com vários agentes (Claude, Codex, Gemini): `AGENTS.md` único; `CLAUDE.md` e `GEMINI.md` importam ele
- (Gemini) Qualidade adaptativa (G12), painel de debug e HUD que some com F1. O Claude reaplicou o trabalho na base certa, sem os temporários, e corrigiu 3 bugs da revisão: degrau de qualidade sem efeito, DRAWS mostrando 1, F1 abrindo a Ajuda do navegador
- Brechas do protocolo fechadas: regra de base do branch, assinatura com o nome real do agente, hook barrando `.tmp/`, `dist/` e `node_modules/`

## PENDENTE
- [ ] **Jogar e confirmar** (R16): corrida lisa, as 3 câmeras, F1 esconde o HUD sem abrir a Ajuda do navegador
- [ ] Fase 1 — Combate (itens no `ROADMAP.md`)

## DIVISÃO DE TRABALHO ENTRE AGENTES
Regras no `AGENTS.md` ("Trabalho com vários agentes"). Um branch por tarefa a partir da `main` atualizada, PR com CI verde, revisão cruzada.
**Merge nesta fase:** o dono autorizou o Claude a mergear PRs com CI verde (combate → inimigos). A revisão cruzada acontece depois do merge, quando outro agente estiver disponível.

| Agente | Território (arquivos) | Situação |
|---|---|---|
| **Claude** | `client/src/combat/`, `client/src/entities/`, `client/src/physics/`, `client/src/player/`; depois `shared/`, `server/`, `client/src/net/` | Fase 1 — Combate, depois Fase 2 — Inimigos |
| **Codex** | a combinar | Sem crédito até 24/09. Ao voltar: revisar os PRs de combate já mergeados |
| **Gemini** | `client/src/core/Quality.ts`, `client/src/debug/`, `client/src/ui/` | Entregou G12, painel e F1. Disponível para revisão |
| **Zona compartilhada** | `client/src/core/Game.ts`, `package.json`, `.decepticons/` | Só fiação e PR pequeno; quem mergear depois faz rebase e roda `npm run check` |

## DECISÕES EM ABERTO
| Decisão | Situação |
|---|---|
| Hospedagem do servidor | Recomendação em `DEPLOY.md`. Decidir na Fase 3 (multiplayer). |

## BLOQUEIOS
- Nenhum.

## PRÓXIMA SESSÃO COMEÇA COM
Fase 1 — Combate: modelo de dano por parte (puro e testado), projéteis acertando Mechs e alvos de treino na arena.
