# TECH HEALTH — CYBERMECH

> **Verificação de 06/10 (Codex, #164):** 569 testes; JS 301,1 KB gzip e Wasm 719,4 KB; typecheck, build, smoke, bocas e site verdes. As medições antigas abaixo são históricas; FPS em GPU integrada real continua pendente. Ao restaurar as dependências ausentes, `npm audit` apontou `source-map-js` transitivo de desenvolvimento (<1.2.2), GHSA-68fv-2mgg-jv7q (DoS ao ler source maps malformados). `npm audit --omit=dev` não apontou vulnerabilidade de produção. Atualizar essa dependência num PR específico, com check, permanece pendente; nenhuma versão foi alterada nesta entrega.

Saúde técnica do projeto. Atualizado a cada merge na `main`.

---

## Indicadores atuais (06/10, Codex)

| Aspecto | Evidência / limite |
|---|---|
| Testes | 594 casos em 81 arquivos; última suíte ~22 s. Quantidade não prova cobertura, sincronização nem ausência de regressão. |
| Cobertura | Não foi medido percentual de linhas/branches. Simulação e contratos têm casos; render/UI recebe provas no navegador. Não atribuir nota 8/10 ou 10/10 sem métrica. |
| Revisão de utilidade | Amostral, registrada em TESTES.md. ModeSelector tinha testes verdes com fluxo de partida desconectado; correção em branch de UX. Inspeção de Mechs e budget continuam usados por ferramentas/site. |
| Mutação | Regras novas de carga/EMP e proximidade/duração do banco foram quebradas e os testes falharam. Não é um score da suíte inteira. |
| Performance | Budget após UX: JS 307,0 KB / 500 KB e Wasm 719,4 KB / 900 KB gzip. FPS em GPU integrada real permanece pendente; headless/SwiftShader não comprova 60 FPS nessa GPU. |
| CI e entrega | Check/hook e CI completos obrigatórios. Durante edição, executar arquivos afetados; build/smoke/site são fases adicionais, não estão incluídos no número de testes Vitest. |
| Servidor público | Offline em 06/10 por informação do dono; não tocar nem depender dele hoje. Provas de rede somente locais. |

As medições mais antigas neste documento são histórico, não leitura da versão atual.

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

- [x] Landing: condensar features, remover prolixidade (FRENTE B ✅)
- [x] Specs: 4 sistemas documentados (MechBase, Physics, Combat, Network — FRENTE C ✅)
- [ ] Afundar no chão: diagnóstico isolado + proposta de correção (Rapier)
- [ ] Roster de rede: adicionar unidade "aliado" para online co-op
- [ ] M5: autoridade de tiro no servidor

---

*Atualizado: 2026-10-01 | Próxima atualização: 2026-10-08*

### 06/10 — testes temporais no Windows (Codex)

Durante a entrega #166, execuções completas oscilaram em server/evento.test.ts (32 requisições aceitas em vez de até 30), Match.test.ts (12,5 ms por tick vs teto 8) e online.test.ts (barrage não observado em 8 s). Uma execução coincidiu com o teste do site. Os três arquivos passaram isolados (20 testes), e o check completo voltou a passar sem alterar critérios ou código da simulação. Investigar se voltar a ocorrer; não reduzir workers do CI nem aumentar limites sem medir a causa.
