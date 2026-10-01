# TECH HEALTH — CYBERMECH

Saúde técnica do projeto. Atualizado a cada merge na `main`.

---

## 🟢 Health Score: 8/10

| Aspecto | Score | Nota |
|---|---|---|
| **Tests** | 10/10 | 300+ testes, 386 commits, zero regressão medida |
| **Coverage** | 8/10 | Simulação testada; render/UI coberto via `site --check` |
| **Performance** | 8/10 | 60 FPS estável em GPU integrada; LCP não medido |
| **Rede** | 7/10 | M4 pronto; M5 (autoridade de tiro) e M6 planejados |
| **Code Reuse** | 8/10 | Uma simulação (G14); modular (G3); sem duplicação |
| **Debt** | 6/10 | 3 bloqueadores conhecidos; 5+ itens em aberto |

---

## 🟢 Passing Checks

✅ Budget: JS 188 KB gzip (limite 500), Wasm 735 KB (limite 900)  
✅ CI: 100% dos testes passam; PRs requerem CI verde  
✅ Build: Sem warnings; typecheck estrict  
✅ Deploy: Auto-publicado na `main`; CSP aplicada; Pointer Lock verificado  
✅ Determinismo: Simulação idêntica cliente-servidor (G2)  
✅ Alocação: Sem `new` no caminho quente (verificado com Vitest)  

---

## 🟡 Warnings (Conhecidos, Tolerados)

⚠️ **Padrão afunda no chão:** Colossus-01 desce 2 m em 3 s. Não mata gameplay (bots param para esfriar), mas cosmético ruim em Mech parado. Workaround: nenhum. Causa: character controller cinemático não trata caso parado.

⚠️ **Parte destruída não some importada:** Malha `.glb` é uma peça; não pode sumir. Workaround: flash de dano cobre. Resolve: gerar partes em arquivo, ou texture+discard.

⚠️ **LCP não medido:** Qualidade adaptativa roda, mas sem benchmarks de carregamento real. Cobre: `site --check` headless.

⚠️ **Mira no PvP não decidida:** Toque tem assistida; mouse trata igual online e offline. Reservado: revelar posição do matador na câmera de abate no PvP.

---

## 🔴 Blockers (Impedem Feature)

❌ **Multiplayer Sync:** Roster de rede não descreve aliado — impossível jogar co-op online. Offline ok. Registrado: STATUS_REAL.md AUSENTE.

---

## 📊 Métricas de Entrega (DORA)

| Métrica | Valor | Alvo | Status |
|---|---|---|---|
| Deploys/dia | ~20 | ≥1 | ✅ |
| Lead time (commit → ar) | ~6 min | <15 min | ✅ |
| Taxa falha CI | 2.4% | <5% | ✅ |
| Tempo recuperação | ~14 min | <60 min | ✅ |

---

## 📈 Tendência

- **Últimos 7 dias:** 150+ commits, 12 PRs mergeados, 0 incidentes
- **Última sessão (30/09–01/10):** Painel admin, rig fix, HQ doc, 3 novos chassis
- **Próxima (01/10+):** Specs técnicas, landing refactor, multiplayer sync

---

## 🎯 Metas para Próxima Iteração

- [ ] Afundar no chão: diagnóstico isolado + proposta de correção (Rapier)
- [ ] Roster de rede: adicionar unidade "aliado" para online co-op
- [ ] Landing: condensar features, remover prolixidade
- [ ] M5: autoridade de tiro no servidor
- [ ] Specs: 3+ sistemas documentados (Physics, Combat, Network)

---

*Atualizado: 2026-10-01 | Próxima atualização: 2026-10-08*
