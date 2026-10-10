# C3 — custo de render na Vega 11

Codex, 09/10/2026. Base `00311f8e5640b9564d86ae50dfbcddd0d26f6436` (#200). Caracterização concluída; homologação G12 continua em aberto. Reprodução: `node .decepticons/medicoes/render-c3.mjs`; temporários em `.tmp/c3/`. Build instrumentado não é publicado.

Build de produção instrumentado só na bancada; Edge headless, GPU real; 1280×720, pixelRatio 1, qualidade média fixa, MSAA 4×; Arena pausada; Hangar com rotação normal; ABBA bloom/sem bloom, 12 s por janela após 1,5 s; combate offline 20 s com bots e mouse sintético; relógio de frame não é tempo de GPU.

GPU: ANGLE (AMD, AMD Radeon(TM) RX Vega 11 Graphics (0x000015DD) Direct3D11 vs_5_0 ps_5_0, D3D11). Boot desta execução: 11.4 s; heap estimado 42.3 MiB. Sistema: 6092 MiB RAM.

| Janela | n | quadro p50/p95/p99 ms | CPU p50/p95 ms | travadas >50/>100/>300 ms | draws p50 | RAM livre antes/depois MiB |
|---|---:|---|---|---|---:|---|
| arena-0-bloom | 374 | 33.3 / 50.3 / 66.8 | 6.1 / 9.9 | 32 / 0 / 0 | 119 | 265 / 375 |
| arena-1-sem-bloom | 434 | 16.9 / 50.1 / 66.7 | 6.4 / 9.2 | 22 / 2 / 1 | 106 | 340 / 367 |
| arena-2-sem-bloom | 347 | 33.3 / 50.1 / 66.7 | 7.6 / 12.3 | 30 / 1 / 1 | 106 | 400 / 740 |
| arena-3-bloom | 416 | 16.9 / 66.7 / 83.3 | 8.1 / 13.7 | 47 / 2 / 0 | 119 | 640 / 893 |
| hangar-0-bloom | 195 | 66.6 / 67.1 / 466.6 | 7.1 / 11.8 | 124 / 3 / 2 | 103 | 364 / 336 |
| hangar-1-sem-bloom | 390 | 16.8 / 66.6 / 183.3 | 4.9 / 8.4 | 33 / 6 / 1 | 90 | 378 / 353 |
| hangar-2-sem-bloom | 252 | 49.9 / 66.6 / 166.6 | 5.9 / 8.6 | 58 / 5 / 2 | 90 | 823 / 497 |
| hangar-3-bloom | 294 | 49.9 / 66.6 / 83.3 | 5.7 / 7.9 | 68 / 0 / 0 | 103 | 821 / 675 |
| combate | 447 | 33.4 / 66.6 / 100.0 | 8.6 / 15.3 | 105 / 4 / 2 | 121 | 453 / 575 |

Não houve novos programas nas nove janelas nem `pageerror`. Recursos GPU contados: 169 geometrias/29 texturas nas cenas estáveis; 191/32 ao fim do combate. Isso não mede VRAM.

## Decisão a partir da evidência

O bloom custa 13 submissões nesta configuração (119→106 Arena; 103→90 Hangar), mas as repetições não estabelecem melhora consistente de frame time. Preservar bloom e Quality; nenhum ganho percentual de FPS é reivindicado. Render/compositor merece investigação: CPU do compositor domina as medianas medidas, mas não equivale a tempo da GPU. Bots/Mech/HUD têm medianas pequenas no ensaio; não mover IA/física para workers por palpite.

C4 seguinte: unir por prédio as 16 faixas estáticas de neon em três desenhos, preservando geometria/cores/colisão/janelas. Provar imagem e draw calls em câmeras fixas; não assumir que isso elimina travadas. C2 de modelos/remotos fica separado, sem expandir preload indiscriminadamente. C5/C6 aguardam orçamento ou contratos aplicáveis.

## Limitações e retomada

- Não é homologação de 60 FPS; 12 s por janela não cobre estabilidade térmica prolongada.
- RAM livre varia; agentes externos não foram encerrados. Nenhum check iniciado pelo Codex durante a coleta.
- Hangar gira normalmente: A/B não tem enquadramento idêntico em cada frame.
- Uma inicialização com cache de driver prévio: boot não caracteriza download frio nem produção.
- CPU medida inclui submissão e possíveis bloqueios do driver; extensão de timer existe, mas GPU não foi cronometrada nesta execução.
- performance.memory é estimativa do heap JS; renderer.info conta recursos, não bytes de VRAM nem RAM total.
- Sem rede real, remoto ou celular físico; combate com bots/sintético não certifica experiência do jogador.

Próximo fechamento C3: execução longa sem carga concorrente, enquadramento fixo, timer de GPU assíncrono, pelo menos três rodadas alternadas e modelos/online; teste manual no navegador visível. Não matar processos alheios nem alterar Quality fora do contrato do Gemini.
