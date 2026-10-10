# C4 — faixas neon em uma malha por prédio

Codex, 09/10/2026. Base `5187152814c8397248f72486c4c067f035d061c1` (#204). Continuidade autorizada depois da C3. Reprodução: `node .decepticons/medicoes/faixas-neon.mjs`; build e PNGs em `.tmp/faixas-neon/`.

As 16 caixas estáticas (5+3+8) passam a três InstancedMesh, com a mesma geometria/material e as mesmas alturas/dimensões. 1 KiB de instanceMatrix no total, StaticDrawUsage, montadas só na criação. Sem download, geometria ou luz novos. BoundingBox/Sphere cobrem todas as faixas. Cinco testes protegem transformações, limites de culling e término da criação.

GPU: ANGLE (AMD, AMD Radeon(TM) RX Vega 11 Graphics (0x000015DD) Direct3D11 vs_5_0 ps_5_0, D3D11). 1280×720, pixelRatio 1, qualidade média, HDR/MSAA4 e bloom. Mesma página e câmera, loop parado, DOM oculto; reconstrução runtime da implementação anterior. `gl.finish` só garante conclusão para capturar pixels; não mede FPS.

| Vista | desenhos antes/depois | triângulos antes/depois | pixels diferentes /921600 | maior diferença de canal /255 |
|---|---|---|---:|---:|
| terceira | 119 / 106 | 16004 / 16004 | 142 | 23 |
| primeira | 99 / 86 | 14198 / 14198 | 0 | 0 |
| tatica | 141 / 128 | 17324 / 17324 | 1 | 50 |
| lateral | 125 / 112 | 16040 / 16040 | 0 | 0 |
| perto-banco | 57 / 46 | 10476 / 10476 | 0 | 0 |
| translucido | 141 / 128 | 17324 / 17324 | 5 | 7 |

Inspeção visual: silhuetas/faixas/janelas preservadas nas seis vistas; diferenças pontuais registradas no JSON, não chamar imagens de idênticas. Primeira pessoa, lateral e perto do Banco foram idênticas; terceira pessoa alterou 142 pixels (~0,0154%), vista alta um pixel, translúcida cinco. Maior erro médio de canal 0,001567/255. Corpos com opacidade 0,18 e depthWrite desligado exercitam a translucidez; não é playtest de todos os modos de câmera. Zero pageerror.

## Limites e próximos passos

- Não é benchmark de FPS; gl.finish e captura são exclusivos da bancada.
- Instancing muda a sequência de multiplicações na GPU; há diferenças pontuais de rasterização, não igualdade bit a bit.
- Culling é por prédio, não por andar: outras vistas podem submeter faixas fora do enquadramento. As seis vistas medidas não aumentaram triângulos.
- Sem GPU dedicada obrigatória ou alteração de simulação, colisores, janelas, bloom, Quality, armas ou rede.
- Baseline runtime reconstrói as caixas originais em double; DOM sobreposto é escondido; primeiro ensaio sem esconder UI foi descartado.
- Limite de comparação (até 0,1% de pixels alterados e erro médio de canal ≤0,01/255) não substitui inspeção das imagens.

Ver no site após merge/deploy: `/cybermech/jogar/` → entrar na Arena → olhar faixas horizontais dos três prédios; tecla V alterna câmera. Nenhuma nova tecla ou regra. C3 permanece PARCIAL para homologar 60 FPS/tempo GPU/estabilidade térmica; C2 de variantes/remotos exige seu ensaio/contrato, sem aumentar preload por palpite. Novos efeitos C5/C6 precisam respeitar esse orçamento.
