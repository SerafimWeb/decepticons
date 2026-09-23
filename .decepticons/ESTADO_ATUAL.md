# ESTADO ATUAL — Cyber-Mech Protocol

**Status:** 🟡 EM DESENVOLVIMENTO: protótipo single-player funcional, fundação pronta
**Última atualização:** 2026-09-23
**Iteração atual:** início da Fase 1 (multiplayer autoritativo)

---

## ÚLTIMA SESSÃO FEZ
- Protocolo Serafim UM aplicado: `.decepticons/`, `CLAUDE.md`, hooks, repositório `Remoratrader/decepticons` (privado) com CI verde no GitHub (ubuntu-24.04, actions v7)
- Bundle JS de 1.182 → 182 KB gzip (Rapier com `.wasm` separado)
- `npm run check` = typecheck + Vitest + build + budget + boot real no browser headless
- **Engasgo da corrida corrigido**: causa medida (erosão da margem do controller do Rapier), contorno isolado em `MechBase.unstickFromGround`, teste que reprova a lógica antiga
- Destroços só cosméticos; bugs de evicção de destroços e vazamento de geometria corrigidos
- Game design v1 (`GAME_DESIGN.md`) + princípios G11–G14 (economia de dados, requisitos, resiliência, código)

## PENDENTE
- [ ] **Jogar e confirmar** (R16): a corrida não engasga mais; conferir as 3 câmeras, rampa e barricadas
- [ ] Fase 1, passo 1: separar `MechBase` em simulação (sem render) + visual, primeiro passo de `shared/`
- [ ] Decidir se o tiro atravessa destroços (na Fase 1)

## DECISÕES EM ABERTO
| Decisão | Situação |
|---|---|
| Hospedagem do servidor | Recomendação em `DEPLOY.md` (PC de casa + Cloudflare Tunnel para playtest; Oracle Always Free São Paulo para público). Decidir ao fim da Fase 1. |
| Tiro × destroços | Fase 1 |

## BLOQUEIOS
- Nenhum.

## PRÓXIMA SESSÃO COMEÇA COM
Separar `MechBase` em `MechSim` (estado + `fixedUpdate`, sem Three.js de cena) e `MechView` (rig, animação, interpolação), mantendo `MechBase.test.ts` verde. É a base de `shared/`.
