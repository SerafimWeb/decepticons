# PROTOCOLO UNIVERSAL — CYBERMECH

**Referência de regras técnicas e specs de engenharia.** Versão condensada; detalhe completo em seções específicas (links abaixo).

## Protocolo Serafim UM: Regras R1–R17

Canônico: `D:\SERAFIMHUB\serafim13\protocolo-serafim-um/`. Cópia: `.decepticons/PROTOCOLO_SERAFIM_UM.md`.

| Regra | Status | Aplicação aqui |
|---|---|---|
| R1–R3 | ✅ | SSOT em `.decepticons/`, sem secrets, sem duplicata (`_v2`, etc). |
| R4 | ⚙️ | TypeScript `strict`. Validação manual (sem alocação) na borda de rede; Zod frio. |
| R5–R6 | — | SQLite de contas existente: migrações, backup e restauração precisam de evidência; progresso ainda local. |
| R7 | ✅ | JS ≤ 500 KB gzip, Wasm ≤ 900 KB gzip (verificado em `npm run check`). |
| R8–R15 | ✅ | Deploy (DEPLOY.md), isolamento, secrets por nome (GitHub), automação (hooks + CI), sem mentira (STATUS_REAL.md), SSOT por dado, verificação pré-push. |
| R16 | ⚙️ | Prova no browser real (multiplayer: 2+ clientes com latência simulada). |
| R17 | ✅ | Achados registrados, bugs corrigidos (ver FINDINGS.md). |

**Omitidas:** Skill 23 (requer React; não usado). SEO já se aplica à landing pública; não comprova acessibilidade nem desempenho de combate.

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
| **G7: Rede** | Servidor autoritativo Node + ws | Validação na borda; regras compartilhadas de cliente/servidor |
| **G8: Budget** | 60 FPS em GPU integrada | JS/Wasm dentro dos tetos; LCP não medido |
| **G9: Rapier** | Versões iguais | `rapier3d-simd-compat` Node; `rapier3d-simd` browser; atualizar ambas |
| **G10: Estilo** | IDs inglês, comentários pt-BR | Densidade = código existente (porquê, não óbvio) |
| **G11: Dados** | ≤8 KB/s ↓, ≤2 KB/s ↑ | Snapshots completos binários a 20 Hz, quantizados; delta/interest management ainda futuros |
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


## Adaptação operacional do jogo — 06/10/2026

A cópia PROTOCOLO_SERAFIM_UM.md é referência e não é editada por tarefa. Este documento adapta sua aplicação ao Cybermech. Nenhum status de conformidade substitui uma evidência.

- Equipamentos: IDs e versão viajam na montagem; cliente e servidor validam compatibilidade e carga total. Energia é distinta de calor. Defesa direcional é decidida pela simulação fixa; visual só representa o estado. Preservar leitura de montagens antigas e versionar mudanças de rede.
- Observabilidade: separar dados de CI, desempenho local, experiência real e analytics. Registrar versão, ambiente e procedência. Nunca chamar pipeline verde de disponibilidade do jogo nem número de eventos de jogadores únicos.
- Coleta: amostragem limitada, filas e retenção com teto, sem envio por quadro, sem credenciais, e-mails ou query de URL nos relatórios. Falha de coleta não impede jogar. Duplicação, rejeição e perda precisam ser visíveis; partidas com cheats são separadas das normais.
- Escala: 8 humanos por sala é limite de produto; 400 conexões é limite de proteção. Certificar capacidade exige carga ativa (movimento/tiro), duração, máquina/versão, CPU/memória, ritmo de ticks/snapshots, desconexões e tráfego. Teste local curto é caracterização, não homologação de produção.
- Liberação online: cliente/servidor compatíveis, teste de reconexão e sob latência/perda, playtest com hardware alvo e plano de recuperação. Enquanto o servidor público estiver offline por orientação do dono, somente testes efêmeros locais; nenhuma tentativa de subir ou atualizar produção.
- Evolução premium: cada incremento fecha comportamento jogável, verificação funcional/visual, custo de desempenho, limitações e caminho para testar. Conteúdo novo deve responder a evidências do playtest; retenção D1 exige uma política explícita de identificação entre sessões e não pode ser deduzida dos contadores anônimos atuais.
