# A PRAIA DOS CABOS — bancada, 14/10/2026 (Claude, P127)

Branch `claude/praia-comprida`. A fase foi refeita (640 × 240 m, a praia ao longo do mapa); esta é a **bancada de custo** que a ficha `fichas/cenario-cabos.md` § 4 pede, no formato do `BUNKER.md`.

## O que foi medido, e com que honestidade

- **Medido:** os **desenhos** e os **triângulos** de cada vista-chave (o mapa real, o mesmo pipeline do jogo: ACES, bloom, MSAA 4×, ambiente) e o **tempo de montagem** do cenário no navegador; **colisores** pelo teste (`Praia.test.ts` conta no Rapier).
- **NÃO medido:** o **tempo de GPU** (p50/p95). A bancada roda no Chrome headless com **SwiftShader** (GPU em software), que não representa uma GPU integrada. Para o p50/p95 num aparelho de verdade, o método é o do `medicoes/BUNKER.md` (Edge, 1280×720, 30 renders de aquecimento e 12 amostras de timer). **Fica como pendência (R13).** O custo por pixel mais pesado do mapa é conhecido: o shader do **mar** (≈ 70 operações por pixel) e o **céu** (8 consultas de ruído nas nuvens); os dois têm um **interruptor de qualidade** (`Praia.setDetalhe`), ligado à qualidade baixa e ao último degrau do rebaixamento automático.

## Os números (bancada: `.decepticons/medicoes/praia.mjs`, resultado em `praia-2026-10-14.json`)

| Vista | Desenhos | Triângulos |
|---|---:|---:|
| Geral (de cima) | 50 | 86.493 |
| Mar (da água para a costa) | 57 | 88.331 |
| Praia (de ponta a ponta da areia) | 60 | 89.855 |
| Orla (calçadão) | 59 | 89.819 |
| Avenida | 59 | 89.819 |
| Ponte Metálica | 50 | 87.069 |
| Porto | 39 | 74.682 |
| Estação (de fora) | 44 | 71.432 |
| Pátio da estação | 43 | 71.066 |
| Rua da cidade | 47 | 86.337 |

- **Desenhos: 39 a 60** por vista, dentro da faixa da ficha (**18 a 67**, a do Bunker). São um por **material de bloco** (11) e um por **camada de adereço** (cada tipo é uma malha instanciada, não um desenho por coqueiro), mais o terreno, o mar, o céu, os dois feixes de luz e as gaivotas.
- **Triângulos: 71 a 90 mil**, acima da faixa do Bunker (10–15 mil) **de propósito**: o mapa é ~11× o poço do Bunker. O grosso é o **terreno** (~27 mil, uma malha só, 4 m por célula) e os **131 coqueiros** (~184 triângulos cada). Os testes travam o custo por tipo (`Praia.test.ts`: o coqueiro < 260, o carro < 260; o total dos adereços < 90 mil). Em jogo, a câmera vê parte disso.
- **Colisores estáticos: 135** — 130 sólidos (prédios, muros, contêineres, barracas, o navio, os guindastes, os carros...) + 4 paredes + **1 colisor de altura para o chão inteiro** (as dunas e a rampa do mar são relevo, não caixas). Teto da ficha: **310**.
- **Montagem:** 50 a 160 ms no navegador (uma vez, no carregamento).
- **CPU por quadro: zero na cena.** O `Praia.update` escreve **um número** (o tempo); o mar, as nuvens, as palmas, as velas, as gaivotas e as boias se mexem **no vertex/fragment shader**. O HUD da fase só escreve no DOM o que mudou (5 Hz na faixa da costa; o marcador, só quando anda meio pixel) e não aloca.
- **Download:** nenhuma imagem nova — as "texturas" (janelas, pedra portuguesa, nervuras, lajes) são shader em coordenadas do mundo.

## Rodada 2 — luz, sombra e vida (15/10/2026, Claude, P128)

Branch `claude/praia-luz-e-vida`. Mesma bancada (`praia.mjs`, resultado em `praia-2026-10-15.json`), com as vistas novas (barraca, portão, cais, escotilha, sombras, ponta do píer, zonas, gente, banhistas, pipas). **Os adereços agora são malhas estáticas fundidas por material (6 desenhos)**; a luz (5), as zonas (2) e a gente (4) são desenhos próprios.

| Vista | Desenhos | Triângulos |
|---|---:|---:|
| Geral (de cima) | 48 | 134.513 |
| Mar (da água para a costa) | 51 | 134.649 |
| Praia (de ponta a ponta da areia) | 52 | 134.661 |
| Orla (calçadão) | 51 | 134.625 |
| Avenida | 51 | 134.625 |
| Ponte Metálica | 47 | 134.657 |
| Porto | 44 | 133.885 |
| Estação (de fora) | 50 | 134.609 |
| Pátio da estação | 50 | 134.609 |
| Rua da cidade | 45 | 134.357 |
| A barraca (varal de lâmpadas) | 49 | 134.601 |
| O portão da estação | 51 | 134.625 |
| O cais | 44 | 133.885 |
| A escotilha | 50 | 134.609 |
| As sombras da areia | 47 | 134.657 |
| A ponta do píer | 46 | 134.393 |
| Zona de cura (calçadão) | 47 | 134.657 |
| Zona de cura (pátio) | 50 | 134.609 |
| Calçadão com gente | 51 | 134.625 |
| Banhistas no mar raso | 46 | 134.393 |
| Pipas no céu | 46 | 134.393 |

- **Desenhos: 44 a 52** por vista (limite da ficha: 67). **Triângulos: 133.885 a 134.661**: +45 mil sobre a rodada anterior (808 adereços no lugar de ~320, 66 pessoas, os halos e as pipas).
- **Colisores: 167** (162 caixas + 4 paredes + o colisor de altura do chão), contra 135; teto da ficha: 310.
- **Sombras assadas:** 652 sombras e 284 manchas de oclusão numa textura de 1280 × 480 (0,5 m), gerada uma vez na carga (~150 ms numa máquina carregada); 1,2 MB de memória; nenhum desenho a mais.
- **CPU por quadro:** o tempo (um número) e **três rotações** (o farol e os dois holofotes); a gente, as pipas, as luzes e as zonas são GPU. A qualidade baixa desliga as poças, os feixes, os holofotes e as cortinas das zonas.
- **NÃO medido:** o tempo de GPU numa integrada (SwiftShader não representa). O custo novo de preenchimento é a **mistura aditiva** dos halos (309), das poças (86) e dos feixes; método para medir: `medicoes/BUNKER.md`.

## Evidência de simulação (G14)

`Match.praia.test.ts` (6, na partida real com Rapier): o jogador nasce em terra e o chão o segura; a **água freia** no fundo; **vadear não afoga** (no raso, 6 s e o casco intacto) e **o fundo afoga** depois de 3 s; a **rampa do píer sobe sem pular** (o Mech chega aos 2,6 m do tabuleiro); e **a onda rebelde marcha para os portões** (a distância até o jogador cai mais de 60 m em 40 s). Medido à parte, sem asserção: o **Colossus** atravessa a avenida em ~50 s. `PraiaLayout.test.ts` (15): ruas e as três vias da orla livres para o raio do Colossus (3,6 m), os três portões do complexo, todos os pontos da partida em chão plano e livre.

## Como ver

- No jogo: `?modo=survival&mapa=praia` (a missão em ondas) ou `?mapa=praia` (combate livre); no console: ESTAÇÃO DE CABOS → ir.
- A bancada: `node .decepticons/medicoes/praia.mjs` (fotos em `.tmp/fotos-praia/`) ou `--arte` (em `arte/praia-<vista>-claude.jpg`).
- Capturas do jogo de verdade (com o HUD): `arte/praia-jogo-*-claude.jpg` (console, início da missão, vadeando, afogando, câmera tática).
