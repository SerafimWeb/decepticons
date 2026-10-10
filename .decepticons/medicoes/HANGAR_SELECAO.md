# C2 — primeiro uso de escolhas posteriores no Hangar

Codex, 09/10/2026. Base `8f98e19` (#205). Build de produção, Edge headless, GPU real ANGLE/Vega 11, 1280×720, qualidade média. Reproduzir na raiz: `node .decepticons/medicoes/hangar-selecao.mjs`; saídas só em `.tmp/hangar-selecao/`. Dados válidos em `hangar-selecao-2026-10-09.json`.

| Escolha, nesta ordem | Novos programas | Geometrias após | Texturas após |
|---|---:|---:|---:|
| Vector-09 inicial | — | 169 | 29 |
| Gênesis-01 | 1 | 170 | 33 |
| Lancer-L1 | 0 | 171 | 37 |
| LR7L Bastion | 0 | 172 | 41 |
| Marauder | 1 | 176 | 42 |
| Voltar ao Vector-09 | 0 | 176 | 42 |
| Voltar ao Marauder | 0 | 176 | 42 |

48 programas no início, 50 no fim. Sem pageerror ou evento de perda/restauração de contexto na execução válida. Uma primeira tentativa, com identificação de GPU ausente e queda dos contadores, foi descartada; o coletor agora rejeita contexto perdido/restaurado. Não interpretar queda de recursos naquela tentativa como otimização.

**Limites:** seleção direta da cena com o loadout inicial do Vector, sem validar compatibilidade/UI; não mede todos os encaixes/níveis de armas. GLBs já vêm do preload existente; a sequência reutiliza programas entre modelos e não equivale a quatro boots frios independentes. Tempos síncronos de `show` estão nos dados e não incluem upload/compilação/desenho. Cache do driver e carga concorrente impedem atribuir ganho de FPS/boot. Contagem de recursos não representa bytes de VRAM. Remotos, latência e celular físico não testados.

**Decisão:** não adicionar preload gráfico de todos os modelos neste corte. Próximo C2 exige orçamento explícito de memória/espera e preparação antes de expor a nova montagem, protegendo a última seleção. Medir separadamente arma/nível e criação de remoto com contrato da frente de rede.

**Correção preparatória:** `warmUpShaders` restaura o render target anterior imediatamente após `compileAsync`, em vez de sempre impor `null`. Quatro regressões cobrem sucesso, rejeição, exceção síncrona e timeout com outro alvo ativo; o boot atual continua voltando à tela quando o alvo anterior é `null`. Uma leitura adicional do alvo por preparação; nenhum trabalho novo por frame/tick, geometria, textura ou draw call. Não significa que o aquecimento tardio esteja implementado.
