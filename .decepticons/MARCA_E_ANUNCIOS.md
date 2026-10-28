# MARCA E ANÚNCIOS — a Serafim Web dentro do jogo (P266)

> **Leia antes de mexer em outdoor, banner, logo ou holograma de qualquer mapa.** Ordem do Comandante (28/10): "Vamos usar os nossos produtos, nosso branding, pra fortalecer nossa
> marca." As fases do jogo divulgam os produtos dele, com a arte e os textos que o produto de verdade diz.

## 1. O que existe

- **Os anúncios** (`client/public/anuncios/*.webp`, 512×1024, na vertical, ~47 KB cada, 10 arquivos, 467 KB): nascem em `scripts/anuncios/*.html` (HTML/CSS/SVG, as fontes do site) e são fotografados pelo Chrome
  por `npm run anuncios`. **O catálogo** (`client/src/brand/anuncios.ts`, dado puro) diz qual anúncio existe, a imagem, a cor de acento e o texto de cada slide.
- **O desenho** (`client/src/environment/Outdoors.ts`): qualquer lista de outdoors vira painéis de LED (grade fina, varredura, falha de sinal na troca, névoa) com um brilho aditivo em volta, em poucas chamadas
  instanciadas. Não sabe de mapa: quem posiciona é o layout de cada fase (`CidadeNeonLayout.ts`, na Cidade Neon).
- **O holograma** (`client/src/environment/HologramaSerafim.ts`): a logo em 3D (camadas somadas, giro lento) flutuando sobre o Prédio Serafim da Arena (36 m, ~62 m do chão), com anel no teto, feixe e aura.
  A textura é `client/public/brand/serafim-logo-holo.webp` (RGB sobre preto, 37 KB).

| Id | Quem divulga | O que diz (o produto afirma o mesmo) | Cor |
|---|---|---|---|
| `odp-olho` | Olho do Pai | OLHO DO PAI · rastreamento de celular 24h · odp.serafimweb.com | laranja |
| `odp-gps` | Olho do Pai | GPS AO VIVO 24H · rastreamento em tempo real | azul |
| `odp-ping` | Olho do Pai | PING < 5 s · localização na hora | verde-limão |
| `odp-sos` | Olho do Pai | BOTÃO SOS · segurança imediata · alerta automático por impacto | magenta |
| `odp-familia` (alterna 4 slides, 4,5 s cada) | Olho do Pai | SEGURANÇA PARA SUA FAMÍLIA · RASTREAMENTO DE CELULARES ANDROID com histórico de movimentação · CERCAS VIRTUAIS · odp.serafimweb.com, "Proteção com ciência. Sem modo oculto." | ciano |
| `swb` | Serafim Web | SOFTWARE BUREAU · aplicativos, sites, jogos, correção de código, segurança digital · serafimweb.com | ciano |
| `logo` | Serafim Web | a logo plana (a arte `vetorserafim.png`) | ciano |

**Toda arte que fala do Olho do Pai traz `odp.serafimweb.com`** (ordem do Comandante).

## 2. O texto só afirma o que o produto afirma

Fonte: README, landing e tutorial do Olho do Pai em `D:\SERAFIMHUB\odpv9\web` (a landing é `odp.serafimweb.com`) e o site da Serafim Web em `D:\SERAFIMHUB\serafimweb`. O que está nos anúncios: ping "em menos de
5 s" (o tutorial documenta "menos de 5 s", 1 a 2 s com o app aberto — **por isso o anúncio diz `< 5s`, não `< 3s`**), GPS 24 h, atualização a cada poucos segundos, botão SOS manual e alerta automático por
impacto, cercas virtuais com aviso na entrada e na saída, histórico de rotas, app para Android, "Proteção com ciência. Sem modo oculto." **Não entra:** preço, oferta com prazo, "modo oculto", iOS, qualquer número
que o produto não documente. `client/src/brand/anuncios.test.ts` trava isso (o catálogo tem a URL certa, texto por arquivo, arquivo existente e dentro do teto de peso).

## 3. Como mudar ou criar um anúncio

1. Edite (ou crie) `scripts/anuncios/<id>.html` — a base visual é `_comum.css`/`_comum.js` (radar, olho, selos) e `_familia.css` (os 4 slides). Texto novo: confira o produto antes (§ 2).
2. `npm run anuncios` (todos) ou `npm run anuncios -- --so <id>`; `--folha` monta uma folha de contato em `.tmp/anuncios/`; `--q 0.7` muda a qualidade do WebP; falha se um arquivo passar de 140 KB.
3. Novo anúncio: uma linha em `ANUNCIOS` (`brand/anuncios.ts`) e o peso dele no baralho do layout (`BARALHO`, em `CidadeNeonLayout.ts`). Dois anúncios iguais nunca ficam lado a lado (o teste confere).
4. A **logo mestre** (`scripts/anuncios/marca/vetorserafim.png`, 500×500 com alfa) é a fonte; vem de `D:\SERAFIMHUB\serafim13\vetorserafim.png` (`npm run anuncios -- --logo <caminho>` troca). A textura do holograma
   (`brand/serafim-logo-holo.webp`) é regerada a cada rodada: RGB sobre preto, porque o WebP com alfa pesava 100 KB ou mais e este, 37 KB.

## 4. Onde aparece (o que o layout faz)

- **Cidade Neon** (mapa `arena`, e o WARGAME): 40 outdoors verticais (1:2) nas fachadas da frente e da segunda fila; **o prédio que hospeda um outdoor não tem janela acesa** (o painel é o destaque, sem poluir).
  Dois desses 40 são as **logos planas de destaque** (uma no norte, perto do eixo e visível por inteiro de quem nasce; uma no oeste — escolhidas por um layout em duas passadas, e o teste confere que nenhum prédio
  da praça as esconde); os outros 38 saem do baralho, em que o Olho do Pai domina (peso 5 + 4 + 4 + 4 + 5 contra 3 do bureau). **O holograma da logo** flutua no Prédio Serafim.
- **Baixam em segundo plano** (`TextureLoader`, com fade quando chegam) e só para quem abre esse mapa; se uma imagem não baixar, o painel fica apagado e o jogo segue (aviso no console).
- **Qualidade baixa** (G12): sem a grade de LEDs e sem o brilho em volta, e o holograma desenha no máximo metade das camadas (que de qualquer jeito caem com a distância até a câmera).

## 4.1 O que custa (medido em 28/10 na AMD Vega 11 do Comandante, janela 1549×925@1,25, rodadas alternadas main × branch)

- **GPU:** cerca de +1 ms por quadro (+8%) com os 40 outdoors, o brilho em volta e o holograma (13,0→12,5 ms no nascimento, 15,9→17,6 do alto, 10,6→12,0 na avenida), dentro do ruído de ±2 ms entre rodadas. Uma camada de cada vez
  (6 ciclos, máquina quieta): outdoors com o brilho ~0,5 ms no nascimento e ≤ 0,3 ms nas outras vistas, reflexo no chão 0 a 0,5 ms, holograma ~0. **O holograma é custo de preenchimento:** com as 17 camadas somadas, de
  baixo dele custava +3 a +9 ms; o número de camadas cai com a distância da câmera (`fatiasPorDistancia`: 17 longe, 4 perto, brilho compensado) e a qualidade baixa desenha no máximo metade.
- **CPU:** nada alocado por quadro (o relógio, o giro do holograma e uma distância). **Pacote de partida:** 478,7 KB/500 KB (a cidade é um pedaço sob demanda).
- **Rede e memória:** as 10 imagens (467 KB) e a textura do holograma (37 KB) baixam em segundo plano só para quem abre a Cidade Neon; ~28 MB de textura na GPU (512×1024 com mipmaps; 384×768 cairia para ~16 MB).
- **Como medir de novo:** `npm run build`, uma cópia da `main` buildada em outra pasta e o A/B alternado (FERRAMENTAS § 4); `varrer-nan.mjs --mapa arena --pitches -0.2,0.1,0.6,0.9` para o NaN (0/512 poses).

## 5. PENDENTE — a Estação dos Cabos (ordem do Comandante, 28/10)

> "Salve isso, pois nos prédios da fase Estação dos Cabos vou querer inserir esses banners também (em menos frequência)."

**Estado: não feito.** O catálogo e o desenhista de painéis (`Outdoors.ts`) não dependem de mapa, então a tarefa é só (1) escolher na Estação dos Cabos (`Praia*.ts`, `PraiaLayout.ts`) quais fachadas recebem painel e em que
altura, (2) montar a lista de `OutdoorDaCena` com a frequência menor (um terço do que há na Cidade Neon é um bom começo), (3) ligar no pedaço sob demanda da Praia, **para o pacote de partida não crescer**
(teto de 500 KB, `npm run peso`; as imagens só baixam para quem abre aquele mapa). Reaproveitar os mesmos arquivos de `public/anuncios/`: nada a baixar a mais para quem já abriu a Cidade Neon.

## 6. Pendências e cuidados

- **Textos pelos olhos do Comandante:** o conteúdo foi tirado do produto, mas quem decide frases e ordem dos slides é ele; mudou? Edite a página HTML e rode `npm run anuncios`.
- **Marca real em arte do jogo** inverte a decisão da PR1 da Cidade Neon ("glifos inventados, nenhuma marca real") **só para os outdoors e o holograma** — os letreiros de bandeira e os neons seguem com glifos inventados.
- **O Olho do Pai é um produto de rastreamento de pessoas.** O anúncio mostra o que ele diz de si (ciência do rastreado, "sem modo oculto"); nada que sugira vigilância às escondidas. Não acrescentar texto que contrarie isso.
