# ESTADO ATUAL — Cyber-Mech Protocol

**Status:** 🟡 EM DESENVOLVIMENTO: protótipo single-player funcional, fundação pronta
**Última atualização:** 2026-09-23
**Iteração atual:** início da Fase 1 (multiplayer autoritativo)

---

## ÚLTIMA SESSÃO FEZ
- Protocolo Serafim UM aplicado: `.decepticons/`, `CLAUDE.md`, hooks, repositório `SerafimWeb/decepticons` (privado) com CI verde no GitHub (ubuntu-24.04, actions v7)
- Bundle JS de 1.182 → 182 KB gzip (Rapier com `.wasm` separado)
- `npm run check` = typecheck + Vitest + build + budget + boot real no browser headless
- **Engasgo da corrida corrigido**: causa medida (erosão da margem do controller do Rapier), contorno isolado em `MechBase.unstickFromGround`, teste que reprova a lógica antiga
- Destroços só cosméticos; bugs de evicção de destroços e vazamento de geometria corrigidos
- Game design v1 (`GAME_DESIGN.md`) + princípios G11–G14 (economia de dados, requisitos, resiliência, código)
- Trabalho com dois agentes (Claude + Codex): `AGENTS.md` como instrução única, o `CLAUDE.md` importa ele, cópia do Protocolo Serafim UM dentro do repositório
- G15, projeto autocontido: temporários só em `.tmp/`; o smoke não escreve mais no temp do Windows

## PENDENTE
- [ ] **Jogar e confirmar** (R16): a corrida não engasga mais; conferir as 3 câmeras, rampa e barricadas
- [ ] Fase 1, passo 1: separar `MechBase` em simulação (sem render) + visual, primeiro passo de `shared/`
- [ ] Decidir se o tiro atravessa destroços (na Fase 1)

## DIVISÃO DE TRABALHO ENTRE AGENTES
Regras de convivência no `AGENTS.md` ("Trabalho com dois agentes"). Um branch por tarefa, PR com CI verde, revisão cruzada, merge pelo dono.

| Agente | Território (arquivos) | Tarefas, em ordem |
|---|---|---|
| **Claude** | `shared/`, `server/`, `client/src/entities/`, `client/src/physics/`, `client/src/net/` (novo) | 1. Contrato (`MechInput`, validador G7, schema de estado) + separar `MechBase` em simulação/visual → `shared/`. 2. `server/` Colyseus + prediction/interpolação no cliente. |
| **Codex** | `client/src/ui/`, `client/src/fx/`, `client/src/core/Quality.ts` (novo), `client/src/debug/` (novo) | 1. Revisar os PRs do Claude. 2. Qualidade adaptativa (G12). 3. Painel de debug leve (FPS, tempo de tick, draw calls). 4. HUD que some com uma tecla (base do modo streamer). |
| **Zona compartilhada** | `client/src/core/Game.ts`, `package.json`, `.decepticons/` | Só linhas de fiação e PR pequeno. Quem mergear depois faz rebase e roda `npm run check`. |

**Próximo agente a trabalhar:** Claude, na tarefa 1. O Codex entra depois, pela revisão desse PR.

## DECISÕES EM ABERTO
| Decisão | Situação |
|---|---|
| Hospedagem do servidor | Recomendação em `DEPLOY.md` (PC de casa + Cloudflare Tunnel para playtest; Oracle Always Free São Paulo para público). Decidir ao fim da Fase 1. |
| Tiro × destroços | Fase 1 |

## BLOQUEIOS
- Nenhum.

## PRÓXIMA SESSÃO COMEÇA COM
Separar `MechBase` em `MechSim` (estado + `fixedUpdate`, sem Three.js de cena) e `MechView` (rig, animação, interpolação), mantendo `MechBase.test.ts` verde. É a base de `shared/`.
