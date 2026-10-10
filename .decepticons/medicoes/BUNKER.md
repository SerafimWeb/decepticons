# Bunker profundo — bancada Codex, 10/10/2026

Base atualizada da `main`, branch `codex/bunker-vertical`. A revisão atende P60: poço aberto de 58 m, quatro pisos separados por 14 m (0/14/28/42), átrio vertical, galerias laterais escuras, oito rotas por faixa (quatro rampas em cada ligação), degraus visuais, quatro poços de elevador/cabines, passagem secreta no terceiro patamar e quatro ninhos de sniper no superior. As rampas têm colisor contínuo e chapas de degrau sem colisor, para o controller atravessar sem pulo ou ressalto. Os dois desenhos instanciados são estáticos; sem novas luzes ou atualizações por frame/tick. O teto dos testes limita os colisores estáticos do mapa a menos de 310.

## Evidência de simulação

10 testes focados verdes. Cobrem seleção offline do mapa, quatro pisos e spawns, três subidas por cada uma das duas orientações de rampa, respawn, galerias/oclusão, passagem secreta e linha de tiro do sniper até o átrio. A navegação testada é de Mech com Rapier e sem pulo. Não prova navegação de bots.

## Bancada visual e GPU

Capturas do mapa real em `.decepticons/arte/bunker-poco-codex.png`, `bunker-atrio-codex.png`, `bunker-tunel-secreto-codex.png` e `bunker-atirador-codex.png`. Medição Edge headless, 1280×720, AMD RX Vega 11 (D3D11), compositor incluído, 30 renders de aquecimento e 12 amostras de timer WebGL por vista:

| Vista | Desenhos | Triângulos | GPU p50 | GPU p95 |
|---|---:|---:|---:|---:|
| Poço | 67 | 14.482 | 16,13 ms | 62,63 ms |
| Átrio | 36 | 11.468 | 13,89 ms | 51,28 ms |
| Túnel secreto | 18 | 9.964 | 14,12 ms | 15,49 ms |
| Posto de sniper | 47 | 12.748 | 11,32 ms | 16,35 ms |

Os outliers de p95 do poço e átrio são relevantes; 12 amostras são caracterização de cena, não homologam 60 FPS, sessão prolongada, temperatura ou IA. Sem A/B com a Arena. A execução mais recente sem erro de página está em `medicoes/bunker-2026-10-10.json`; coletor em `medicoes/bunker.mjs`.

## Como jogar

Arena offline → `[ EXPLORAR BUNKER // 4 NÍVEIS ]` ou `?mapa=bunker`; WASD pelas galerias e rampas, V muda a câmera. O modo online, CTF e Sobrevivência continuam na Arena. Poços/cabines de elevador são cenográficos nesta etapa; rampas ligam os andares de forma jogável.

## Ainda não validado

CI/PR/deploy, playtest do dono, navegação vertical da IA, elevadores móveis e leitura do cenário pela câmera tática.
