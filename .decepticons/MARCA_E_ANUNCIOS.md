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
3. Novo anúncio: uma linha em `ANUNCIOS` (`brand/anuncios.ts`), o peso dele no baralho do layout (`BARALHO`, em `CidadeNeonLayout.ts`) e, se ele alterna, o id em `ANUNCIOS_QUE_ALTERNAM` (`shared/outdoors.ts`: é a lista que o painel e o servidor conhecem; o teste `CidadeNeonCenario.test.ts` confere que andam juntas). Dois anúncios iguais nunca ficam lado a lado no começo (o teste confere). Cada imagem nova é um amostrador no shader: o WebGL2 garante 16.
4. A **logo mestre** (`scripts/anuncios/marca/vetorserafim.png`, 500×500 com alfa) é a fonte; vem de `D:\SERAFIMHUB\serafim13\vetorserafim.png` (`npm run anuncios -- --logo <caminho>` troca). A textura do holograma
   (`brand/serafim-logo-holo.webp`) é regerada a cada rodada: RGB sobre preto, porque o WebP com alfa pesava 100 KB ou mais e este, 37 KB.

## 4. Onde aparece (o que o layout faz)

- **Cidade Neon** (mapa `arena`, e o WARGAME): 40 outdoors verticais (1:2) nas fachadas da frente e da segunda fila, dos quais **26 ficam no ar por padrão** (o painel OUTDOORS ▸ muda: § 4.2); **o prédio que hospeda um outdoor no ar não tem janela acesa** (o painel é o destaque, sem poluir; se o outdoor sai do ar, as janelas voltam).
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

## 4.2 O painel OUTDOORS e a troca de imagem (P267, 28/10)

- **Cada outdoor alterna** entre as 9 imagens que entram na troca (o catálogo na ordem: Olho do Pai ×4, a família em 4 mensagens, o bureau): todos andam num anel único, cada um começa num ponto (o anúncio que o layout deu a ele) e anda um passo a cada período, cada um no seu tempo (fase por outdoor) e com falha de sinal na
  troca (os últimos 14% do período). **A logo plana é fixa** (a marca). O brilho em volta e o reflexo no chão têm a cor da imagem de agora.
- **O painel** (chip **OUTDOORS ▸** no console, modo Comandante; `ui/OutdoorsPanel.ts`): **quantos aparecem** (0 a 40; as logos planas são as últimas a sair, depois os maiores), **de quanto em quanto tempo trocam** (5–30 s; atalhos 10 s e 15 s) e **quais anúncios entram** (pelo menos um fica). Cada mexida
  aparece na hora na cidade; **SALVAR PARA TODOS** grava no servidor e vale para todo jogador; **FECHAR** desfaz o que não foi salvo. Padrão sem nada gravado (ou sem servidor): 26 outdoors, 12 s, todos os anúncios.
- **Onde mora:** o contrato e o validador em `shared/outdoors.ts`; o armazém em `server/outdoors.ts` (arquivo `outdoors.json` na pasta de dados); `GET /outdoors` público; `POST /admin/outdoors` só com a chave do dono. A cidade busca a configuração uma vez ao montar (`carregarOutdoors`), e o painel a aplica na hora (`aplicarOutdoors`).
- **Custo:** os painéis são uma malha só e o brilho outra (antes 7 + 1): menos chamadas de desenho; quem escolhe a imagem é o shader (um relógio); mudar a configuração mexe em uns poucos uniformes e em três atributos pequenos. Medido na Vega 11 (28/10): GPU por quadro igual à do P266 dentro do ruído, com 18 a 28 chamadas de desenho a menos; pacote de partida 479,4/500 KB (o painel e a ponte com o servidor pesam ~0,7 KB; o painel em si é um pedaço sob demanda).
- **Fonte:** a **Azonix** (a do título do jogo) está no "SOFTWARE BUREAU" dos dois banners da Serafim. Ela **não tem acento nem cedilha**: texto em português com til ou cedilha fica na Chakra (a lista de serviços do bureau).

## 5. PENDENTE — a Estação dos Cabos (ordem do Comandante, 28/10)

> "Salve isso, pois nos prédios da fase Estação dos Cabos vou querer inserir esses banners também (em menos frequência)."

**Estado: não feito.** O catálogo e o desenhista de painéis (`Outdoors.ts`) não dependem de mapa, então a tarefa é só (1) escolher na Estação dos Cabos (`Praia*.ts`, `PraiaLayout.ts`) quais fachadas recebem painel e em que
altura, (2) montar a lista de `OutdoorDaCena` com a frequência menor (um terço do que há na Cidade Neon é um bom começo), (3) ligar no pedaço sob demanda da Praia, **para o pacote de partida não crescer**
(teto de 500 KB, `npm run peso`; as imagens só baixam para quem abre aquele mapa). Reaproveitar os mesmos arquivos de `public/anuncios/`: nada a baixar a mais para quem já abriu a Cidade Neon.

## 6. Pendências e cuidados

- **Textos pelos olhos do Comandante:** o conteúdo foi tirado do produto, mas quem decide frases e ordem dos slides é ele; mudou? Edite a página HTML e rode `npm run anuncios`.
- **Marca real em arte do jogo** inverte a decisão da PR1 da Cidade Neon ("glifos inventados, nenhuma marca real") **só para os outdoors e o holograma** — os letreiros de bandeira e os neons seguem com glifos inventados.
- **O Olho do Pai é um produto de rastreamento de pessoas.** O anúncio mostra o que ele diz de si (ciência do rastreado, "sem modo oculto"); nada que sugira vigilância às escondidas. Não acrescentar texto que contrarie isso.

## 7. Publicidade dinâmica de terceiros nos outdoors (P271, 28/10): resposta de viabilidade

**A pergunta do Comandante:** transformar a textura do banner num *slot dinâmico* (imagens por API ou uma rede de anúncios 3D/Web, como a Anzu ou a Bidstack), o *Dynamic In-Game Advertising* (DIGA), para vender impressões (CPM) em 1 ou 2 banners. **Dá, mas há duas vias, e só uma cabe hoje:**

- **A. Slot patrocinado próprio (recomendada, pequena):** 1 ou 2 dos 40 outdoors viram "patrocinados" no painel OUTDOORS: o Comandante escolhe a imagem (e o período de exibição), o servidor a guarda como já guarda a configuração dos outdoors (`shared/outdoors.ts`, `POST /admin/outdoors`), o outdoor leva o rótulo "PATROCINADO" e o servidor **soma impressões e tempo visível**, só em número agregado (o mesmo molde da telemetria de produto, `PRIVACIDADE.md`: nada por pessoa), para ele mostrar o relatório ao anunciante. Sem SDK, sem script de terceiro, sem cookie, sem custo no pacote de partida (o outdoor já alterna imagens). O que se mede é a **visibilidade** (o outdoor ocupa X% da tela por mais de 1 s, conta feita no cliente e somada no servidor), o padrão que o mercado usa para impressão em jogo; **clique não existe** num outdoor 3D de um jogo de tiro.
- **B. Rede de anúncios de terceiros (Anzu, Bidstack):** a Anzu só tem caminho documentado para a web pelo **Bridge SDK da Playgama** (Unity WebGL, Cocos e JavaScript, parceria de 2025), e a Bidstack saiu de uma administração judicial em 2024: o que sobra é um contrato comercial e um SDK de terceiro dentro do jogo. Cada um pesa: o **pacote de 500 KB** (teto do dono), a **CSP** do site (scripts e imagens de fora), a **política de privacidade e a LGPD** (a rede coleta identificador de aparelho), e **o jogo tem conta de menor de idade**: o **ECA Digital (Lei 15.211/2025, em vigor desde 17/03/2026)** limita a publicidade direcionada a menores e exige o modelo mais protetivo por padrão. Só valeria com anúncio **contextual** (sem perfil) e depois de uma revisão jurídica.

**Passo a passo da via A, se ele quiser:** (1) um campo "patrocinador" no painel OUTDOORS (arquivo de imagem no servidor, rótulo, período), (2) o outdoor marcado como slot (1 ou 2 na Cidade Neon), (3) a conta de visibilidade no cliente e o contador agregado no servidor (evento novo na lista fechada da telemetria), (4) uma linha no inventário de dados (`PRIVACIDADE.md`). **Nada disto foi feito: aguarda a decisão do Comandante** (e, se for a via B, um parecer jurídico antes de qualquer código). Fontes: [Playgama e Anzu levam anúncios reais a jogos web](https://gamesbeat.com/playgama-and-anzu-bring-real-world-ads-to-web-games/); [ECA Digital entra em vigor](https://www.congressoemfoco.com.br/amp/noticia/117235/eca-digital-entra-em-vigor-o-que-muda-com-a-nova-lei).

### 7.1 O que se cadastra e o que se instala em cada via (P274, 29/10)

A pergunta do Comandante: "tenho que me cadastrar em algo, ou instalar algum contador de visualização?". **Fichas: 🟢 lido na fonte original · 🟡 dito pela própria empresa ou por blog do setor · 🟠 não achei a regra publicada (perguntar ao comercial antes).**

| | A. Slot patrocinado próprio | B1. Anzu (pelo Bridge SDK da Playgama) | B2. Google H5 Games Ads (AdSense) |
|---|---|---|---|
| **Cadastro** | **Nenhum em rede de anúncios.** Vende-se direto ao anunciante; a empresa que vende (Serafim Web ou Selva MKT) emite a nota e o contrato. | Conta de desenvolvedor na Playgama (developer.playgama.com); o jogo sobe como HTML5 e é testado (a Playgama diz em 24 h) 🟡. Critério de elegibilidade e mínimo de público para receber anúncio de outdoor: 🟠. | Conta AdSense e **aprovação no beta** da Ad Placement API 🟡 (o Google não publica a lista completa de critérios 🟠). |
| **Instala** | **Nada de terceiro.** O contador é nosso (abaixo). | O **Bridge SDK** (script de terceiro; roda no navegador, sem wrapper, WebGL/Canvas) 🟡. A parceria é desenhada para jogos publicados na Playgama: jogo hospedado só no nosso site pode não ser aceito 🟠. | O código do AdSense mais o da Ad Placement API (script de terceiro) 🟡. |
| **O que mostra** | O **outdoor 3D** do jogo (o que ele pediu). | Anúncio **dentro do mundo** (outdoor 3D), o mais parecido com o pedido. | **Não é outdoor:** intersticial (entre fases) e **premiado** (o jogador escolhe ver, em troca de algo); a política do Google proíbe interromper o combate 🟡. |
| **Risco ao jogo** | Nenhum: não pesa no pacote, não abre conexão de fora, sem dado pessoal. | Pacote (500 KB), CSP, LGPD e **ECA Digital** (o jogo tem conta de menor) e dependência de uma rede de fora: se cair, o jogo precisa abrir igual (carregar sem travar e com o outdoor de sempre de reserva). | Os mesmos de B1, e o jogador de menor exige o tratamento de público infantil do Google (a confirmar na política) 🟠. |
| **Quanto rende** | O que se negocia: **com pouco público, venda por período fixo** (patrocínio por semana ou mês), não por mil impressões (CPM); CPM só faz sentido com volume. Sem anunciante, zero. | Pelo mercado de leilão, sem piso garantido; abaixo de certo volume a rede nem entra 🟠. | Idem: leilão, sem piso 🟠. |

**O contador de visibilidade (a via A, tudo nosso).** O padrão do setor para anúncio **dentro de jogo** é o *Intrinsic In-Game Advertising Measurement Guidelines* do IAB/MRC (ago/2022) 🟢, e dá para contar assim, no próprio cliente, sem SDK: a impressão conta quando **≥ 50% dos pixels** do outdoor aparecem **por ≥ 1 segundo contínuo**, ele ocupa **≥ 1,5% da tela** (só a parte visível) e o **ângulo** não passa de **55° em nenhum eixo** (recomendado); com algo na frente (a oclusão), abaixo de 50% não vale; como o jogador anda, o guia aceita medir a cada 200 ms e contar quando **3 de 5** leituras do segundo estiverem visíveis. O cliente soma e o servidor guarda só o **total por dia e por outdoor** (impressões visíveis e segundos): nada por pessoa. Fonte: [IAB, In-Game Advertising Measurement Guidelines (31/08/2022)](https://www.iab.com/wp-content/uploads/2022/08/In-Game-Advertising-Measurment-Guidelines_08.31.2022.pdf), seções de *Viewability* e *Ad Angle*.

**Recomendação, na ordem:** (1) **a via A com 1 outdoor** e **um patrocinador de verdade** (venda direta: a primeira venda diz se há mercado, e não custa nada ao jogo); (2) só depois, se ele quiser receita sem vender, o **anúncio premiado** (B2) em momentos de pausa; (3) a rede de outdoor em jogo (B1) **só com volume de jogadores** e um parecer jurídico sobre o ECA Digital. **Nada de código nesta rodada: a escolha é dele.** Fontes: [Playgama: requisitos técnicos](https://playgama.com/blog/business-faqs/what-are-the-technical-requirements-to-publish/); [Google: política do H5 Games Ads](https://support.google.com/publisherpolicies/answer/11975916); [Google: cadastro da Ad Placement API](https://developers.google.com/ad-placement/docs/signup).
