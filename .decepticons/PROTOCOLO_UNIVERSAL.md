# PROTOCOLO UNIVERSAL — CYBERMECH

**Referência de regras técnicas e specs de engenharia.** Versão condensada; detalhe completo em seções específicas (links abaixo).

## Protocolo Serafim UM: Regras R1–R17

Canônico: `D:\SERAFIMHUB\serafim13\protocolo-serafim-um/`. Cópia: `.decepticons/PROTOCOLO_SERAFIM_UM.md`.

| Regra | Status | Aplicação aqui |
|---|---|---|
| R1–R3 | ✅ | SSOT em `.decepticons/`, sem secrets, sem duplicata (`_v2`, etc). |
| R4 | ⚙️ | TypeScript `strict`. Validação manual (sem alocação) na borda de rede; Zod frio. |
| R5–R6 | — | N/A: sem banco de dados. |
| R7 | ✅ | JS ≤ 500 KB gzip, Wasm ≤ 900 KB gzip (verificado em `npm run check`). |
| R8–R15 | ✅ | Deploy (DEPLOY.md), isolamento, secrets por nome (GitHub), automação (hooks + CI), sem mentira (STATUS_REAL.md), SSOT por dado, verificação pré-push. |
| R16 | ⚙️ | Prova no browser real (multiplayer: 2+ clientes com latência simulada). |
| R17 | ✅ | Achados registrados, bugs corrigidos (ver FINDINGS.md). |

**Omitidas:** Skill 23 (requer React; não usado). Skill 12 (SEO) aplica-se depois do deploy público.

---

## Specs de Engenharia: G1–G15

Detalhes técnicos em documentos específicos: [`SPECS_*.md`](../ESPECIFICACOES.md).

| Spec | Meta | Implementação |
|---|---|---|
| **G1: Loop** | 60 Hz fixo, ≤4 ticks/frame | `FIXED_DT`, render interpolado, sem gameplay em taxa de render |
| **G2: Determinismo** | `fixedUpdate` = `MechInput` + estado | Sem `Math.random`, `Date.now` em simulação; RNG com semente (`core/rng.ts`) |
| **G3: Modular** | Sistema independente → callback | Todos em `core/Game.ts`; conversa via `onHit`, `onBreak`, etc. |
| **G4: Zero aloc** | Sem `new` por frame/tick | Pools fixos, `_tmp` em escopo, typed arrays |
| **G5: Draw calls** | InstancedMesh 1 call/tipo | Tetos: partículas 3000, destroços 240, projéteis 64 |
| **G6: Física** | Mech = cápsula cinemática | Destroços cosmético; remoto só interpola. Ver `PhysicsWorld.ts` |
| **G7: Rede** | Servidor autoritativo | Validação manual (sem aloc); `shared/` sem DOM/WebGL |
| **G8: Budget** | 60 FPS em GPU integrada | JS/Wasm dentro dos tetos; LCP não medido |
| **G9: Rapier** | Versões iguais | `rapier3d-simd-compat` Node; `rapier3d-simd` browser; atualizar ambas |
| **G10: Estilo** | IDs inglês, comentários pt-BR | Densidade = código existente (porquê, não óbvio) |
| **G11: Dados** | ≤8 KB/s ↓, ≤2 KB/s ↑ | Estado binário 20 Hz, delta, quantizado; sem destroços/FX na rede |
| **G12: Hardware** | GPU integrada, WebGL2 | Qualidade adaptativa (pixelRatio → bloom) |
| **G13: Resiliência** | Reconexão auto, falha isolada | Validação + rate limit; reconexão ~15 s |
| **G14: Estratégia** | Uma simulação, teste por regra | `shared/` roda cliente+servidor; teste Node (padrão `MechBase.test.ts`) |
| **G15: Autocontido** | Nada fora da pasta | `.tmp/` só, sem sistema temp; conhecimento em `.decepticons/` |

---

## Comandos Essenciais

```bash
npm install              # Hooks em .githooks/
npm run dev              # Dev server http://localhost:5173
npm test                 # Vitest (simulação no Node)
npm run check            # typecheck + testes + build + budget (obrigatório pré-push)
npm run smoke:dev        # Boot headless contra dev server
npm run server           # Servidor de jogo ws://localhost:2567
npm run site             # Site em .tmp/site/ (landing, oficina, sala-de-controle, jogar)
npm run painel           # Painel de controle em .tmp/painel/
```

---

**Ligado:** `AGENTS.md` (multi-agente), `GAME_DESIGN.md` (visão), `DEPLOY.md` (infraestrutura).  
**Mudou uma regra?** Registre em `HISTORICO_DE_DECISOES.md`.

*Versão 2.0 | refatorada 2026-10-01 | referência rápida*
