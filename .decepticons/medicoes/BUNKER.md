# Bunker vertical — bancada Codex, 10/10/2026

Base local 71e4b3f; cenário novo em codex/bunker-vertical. Três pisos a 0/10/20 m, duas rotas de rampa sem salto, átrio de tiro entre níveis e galerias laterais cruzadas. Malha e colisor têm os mesmos dados em Bunker.ts. Dois desenhos estáticos para o cenário inteiro, 60 colisores estáticos, sem atualização própria por tick ou frame.

## Evidência

Seis testes: seleção offline segura, alturas e vão, posições de nascimento, subida física real em ambos os lados, oclusão/passagens e spawn/respawn da partida. Capturas da implementação real em arte/bunker-*.png. Prova controlada no Edge, 1280×720, AMD Vega 11, sem erro de página. Não é playtest manual.

| Vista | Desenhos totais | Triângulos totais | GPU p50 | GPU p95 |
|---|---:|---:|---:|---:|
| Átrio | 27 | 2816 | 12,05 ms | 13,18 ms |
| Galeria | 27 | 2816 | 11,96 ms | 13,38 ms |
| Terceiro andar | 38 | 3048 | 12,65 ms | 13,84 ms |

Timer WebGL assíncrono, 12 amostras por vista após 30 renders de aquecimento, incluindo composer; rejeita disjoint/contexto perdido/timeout. Sem gl.finish. JSON e ferramenta nesta pasta. Piloto oculto para a captura de arquitetura, bots presentes, loop pausado, câmera controlada. Números não homologam 60 FPS, memória, IA, combate prolongado ou temperatura; não são comparação A/B com Arena.

## Como jogar

Prévia de produção local em http://127.0.0.1:5189/?mapa=bunker após build. Também existe EXPLORAR BUNKER na pausa/início da Arena offline. Clique para jogar; WASD para as galerias e rampas, V para câmera. Preferir terceira/primeira pessoa: o teto ainda não é ocultado pela câmera tática. As duas rampas começam junto ao átrio e sobem para o lado norte; o anel superior fecha as rotas pelos dois lados. Cura/resfriamento/banco/drones da cidade não existem neste mapa.

## Pendências

Navegação vertical planejada dos bots (atualmente steering local), homologação longa e dois jogadores com servidor que negocie mapa. CTF/sobrevivência/online continuam na Arena. Entrega local autorizada; nenhum PR/deploy alegado.

## Condições do check

Primeira execução completa passou (864 testes, antes do sexto teste de integração). Repetição após ajustes: 861 passaram/4 testes antigos de online falharam no limite de entrada de 8 s; houve timeouts ao encerrar workers de arquivos sem alteração. Não atribuir isso ao mapa nem esconder a falha. Nova execução local usa VITEST_MAX_WORKERS=2 só no ambiente do processo para reduzir pressão de memória; scripts/test.mjs, vitest.config.ts e CI permanecem intactos. Essa execução passou os 865 testes, mas o smoke excedeu 30 s no page.goto; naquele intervalo havia cerca de 330 MB de RAM livre. A execução final completa passou com dois workers locais e SMOKE_BROWSER apontando para o Edge instalado: 865 testes/113 arquivos, typecheck, build, budget JS 332,9 KB / Wasm 719,4 KB gzip, smoke, bocas e site. Variáveis só no processo; nenhuma mudança no CI, nos testes antigos ou nos limites de timeout. Logs em .tmp/check-bunker*.log.
