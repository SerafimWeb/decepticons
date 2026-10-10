# C2 — shaders do chassi antes de exibir — Codex, 10/10/2026

Base `44401f6` (#208), worktree `wt-codex-c2-ready`. Reprodução: `node .decepticons/medicoes/hangar-preparar-trocas.mjs`. Build de produção, Edge headless, ANGLE/Vega 11, 1280×720, qualidade média. Baseline remove apenas a instalação do callback novo; mesma cena/código restante. Seleção por cliques reais nos cards do Hangar, seis escolhas em cada variante.

| Escolha | Antes: programas depois de exibir | Depois: programas antes / depois de exibir |
|---|---:|---:|
| Gênesis-01 | 1 | 1 / 0 |
| Lancer-L1 | 0 | 0 / 0 |
| LR7L Bastion | 0 | 0 / 0 |
| Marauder | 1 | 1 / 0 |
| Vector-09 | 0 | 0 / 0 |
| Marauder novamente | 0 | 0 / 0 |

Ambas terminam com 50 programas, 175 geometrias e 42 texturas (boot: 48/169/29). Zero pageerror e perda/restauração de contexto em ambas. Dados em `hangar-preparar-trocas-2026-10-10.json`; captura final `arte/hangar-trocas-preparadas-codex.png`, inspecionada. Ao testar no site: abrir Hangar, escolher Gênesis/Marauder, alternar rapidamente e voltar; durante a preparação o modelo anterior permanece, depois aparece a escolha vigente.

**Contrato/custo:** `HangarScene.prepareModel(root): Promise<boolean>`; `graphicsPreparing` pode ser consultado pela UI do Gemini. Só uma preparação ativa e a última pendente; escolha antiga não troca o pedestal. `compileAsync` recebe o modelo mais a cena real como `targetScene`, preservando luzes/ambiente e alvo HDR. Espera limitada a 5 s por operação, falha/timeout libera modelo pelo primeiro uso. Prazo é soft: chamada síncrona do driver não é interrompível. Modelos bem preparados são reutilizados. Sem scene/clone adicional, download/preload extra ou trabalho novo por frame/tick. Alocações só por escolha; cache dos modelos continua limitado ao catálogo existente.

**Limites:** preparação é de shader do chassi ao entrar no pedestal. Geometria/texturas ainda podem ser enviadas no primeiro desenho. Troca de arma/nível no chassi já mostrado e remotos permanecem abertos. Não há novo aviso visual de carga na UI; não alterar em paralelo os arquivos do Gemini/Claude. Não mede bytes de VRAM, GPU time ou ganho de FPS, e não é playtest em celular físico.

**R17 para Gemini:** a captura em 1280×720/Marauder mostra o rodapé de aplicar montagem abaixo da área capturada. Os cliques em cards passaram; não certificar acesso a todos os botões por essa evidência. Preservado nesta frente de render; revisar overflow/altura do Hangar, junto do achado móvel anterior.
