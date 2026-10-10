# Auditoria da contagem de testes — Codex, 10/10/2026

Pergunta do dono: 819 seria erro de duplicação, porque antes eram pouco mais de 200?

**Resultado:** 819 era a contagem real da execução do PR #206. A base `44401f6` (#208) passou a 828: nove casos adicionais do atualizador do servidor. Neste corte C2 entram mais cinco regressões específicas: quatro de seleção/preparação e uma de contexto de iluminação. A execução completa produziu **833 casos passados em 109 arquivos**, nenhum pendente/falho, nenhum arquivo repetido e nenhuma identidade repetida (`arquivo + nome completo do caso`).

| Execução atual deste corte | Casos |
|---|---:|
| Cliente: combate, modelos, física, Hangar, UI etc. | 659 |
| Contratos compartilhados | 45 |
| Servidor, contas, telemetria, atualizador etc. | 129 |
| Total | 833 |

Dados resumidos: `testes-auditoria-2026-10-10.json`. Relatório completo da execução: `.tmp/testes-executados.json`, na worktree do corte; não publicar todos os resultados só para aumentar documentação. Reproduzir: `node scripts/test.mjs run --reporter=json --outputFile=.tmp/testes-executados.json`, depois `node .decepticons/medicoes/auditar-testes.mjs`. O auditor confronta total do reporter com a soma de `assertionResults`, unicidade dos arquivos e caminhos incluídos.

## De onde veio o crescimento

- 28/09, #102, `165507a`: estado registra check verde com **243 testes**, após Sobrevivência e CTF.
- 06/10, `1d44dc5`: linha Build registra **638 testes**, após novas regras/equipamentos e drones.
- 09/10, #206: gate local e CI confirmaram **819**.
- #208 acrescentou nove, chegando a **828**; este corte acrescenta cinco, chegando a **833**.

Entre `165507a` e `44401f6`, 73 arquivos de testes foram adicionados/alterados (6404 linhas adicionadas, 44 removidas). Entraram suites de armas/efeitos de estado, escudos/energia, aliados/drones, rigs GLB, controles, contas/telemetria, contratos de rede, Hangar, HUD e render. Cada `it.each` gera um caso por entrada; isso é intencional, não uma execução duplicada do arquivo. Um `it` pode ter vários `expect`: essas asserções não são somadas como testes independentes.

`vitest.config.ts` inclui somente `client/src/**/*.test.ts`, `shared/**/*.test.ts`, `server/**/*.test.ts`. As worktrees e temporários ficam fora desses caminhos relativos. `scripts/test.mjs` lança o runner uma vez; não configura repeats/retry/shards nem múltiplos projetos. O check local, o CI do PR e o CI da main executam novamente a suite para validar versões; os totais não são somados.

**Cuidado encontrado durante a auditoria:** `vitest list --json` apresentou 824 entradas na base, com rótulos extraídos de chamadas `testFire` no arquivo homônimo, enquanto a execução real é 828 na base. Não usar aquela listagem estática como árbitro da contagem deste projeto. A prova aqui é o JSON da execução real; nenhuma mudança no runner/configuração para forçar um número.

**Limite:** unicidade na coleta não prova ausência de redundância semântica entre testes diferentes, cobertura completa ou utilidade de cada caso. Isso pede revisão por regra/risco e amostragem dos testes. Quantidade é evidência de execução, não certificação de diversão, FPS, segurança ou disponibilidade de produção. Não remover testes de cenários distintos nem criar casos sem valor para atingir uma meta numérica.
