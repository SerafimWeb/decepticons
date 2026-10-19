# FICHA · CENÁRIO — 8 DE JANEIRO (Praça dos Três Poderes · Brasília · DF)

> **Status:** proposta · **Autor:** Claude · **Atualização:** 2026-10-19 · **Etiqueta:** `#cenarios`
> **A ordem (P217, 19/10):** *"uma nova fase que vai girar em torno dos ataques golpistas do 8 de janeiro à sede dos poderes em Brasília. São milhares de manifestantes de verde e amarelo, usando cabeças de gado, é o mod deles. Eles são os golpistas que tentaram tomar o poder à força, mas os militares não aderiram a essa tentativa de golpe. Nós vamos chegar lá e eliminar os golpistas na base do tiro, porrada e bomba."* O pino já está no mapa do console, em Brasília, **no lugar onde estava o Bunker**, que foi para Corumbá · MS.
> **O que esta ficha é:** o contrato da fase **antes** do primeiro polígono (`fichas/README.md`; o Bunker e a Praia ensinaram o custo de construir primeiro e conversar depois). Fixa **o que a fase FAZ**, **a conta do desempenho** (a parte nova e perigosa: **milhares** de figurantes) e **as perguntas ao Comandante**. **Nada aqui está no jogo ainda:** o pino diz EM BREVE.

## 1. O que a fase é, em uma frase

**Defender os três prédios da Praça dos Três Poderes de uma multidão de verde e amarelo que marcha pela Esplanada para tomá-los à força**, com tiro, bomba e porrada, até a multidão se desfazer ou o tempo acabar. É uma missão **de defesa de lugar** (a gêmea da estação de cabos, `fichas/ataque-e-defesa.md`), com **uma diferença que muda tudo**: o inimigo é **uma massa**, não uns poucos robôs.

## 2. O que a fase FAZ (não o que ela parece)

- **A rota da multidão:** ela nasce a **oeste**, no fim da Esplanada, e marcha **para leste**, ao longo do Eixo Monumental, até a Praça (que fica na ponta leste, junto ao espelho d'água). O jogador começa **na Praça**: o mapa é uma **linha** (a Esplanada é o corredor; a Praça, o fim dele), como a estação de cabos, não uma arena redonda.
- **Os três prédios** (o Congresso, o Planalto e o Supremo) têm **integridade** (uma barra cada). Cada figurante que **chega à fachada** a desgasta devagar (depredação); **integridade zero = o prédio cai e a missão acaba**. É o que dá ao jogador **por que correr** de um lado a outro da Praça (o mesmo papel das três estações da escolta).
- **As marchas** (a fase tem **5 minutos**, a regra do projeto): **cinco ondas** de multidão, cada uma maior (400 → 3.000 figurantes no total em campo na última), com **intervalo curto** entre elas. **Vence** quem chega ao fim do tempo com os três prédios de pé; a pontuação é o número de **dispersados**.
- **O agitador** (o arquétipo do **manipulador**, `CAMPANHAS_E_CHEFES.md`: "o influenciador, o farsante, como chefe"): um **carro de som** no meio de cada marcha. Quebrá-lo **derruba a coesão** da marcha (a massa hesita e recua). É o alvo que o jogador **escolhe** em vez de varrer a massa inteira.
- **Os aliados:** androides da SERAFIM guardam **um prédio cada** (os que já existem: `BotController`). A linha de enredo: **os quartéis não vieram** (o fato que o Comandante pediu: ver § 7); só a SERAFIM está ali.
- **O arsenal é o que já existe** ("tiro, porrada e bomba"): **tiro** = qualquer arma de hoje; **bomba** = a granada, os mísseis e a chuva de mísseis, que ganham sentido novo **contra massa** (um acerto derruba um aglomerado); **porrada** = ver a **pergunta 3**.
- **Violência estilizada, sem sangue** (a regra do projeto): o figurante atingido **tomba e some** num sopro, como o andróide.

## 3. A massa: o problema técnico (o que a ficha existe para decidir)

**Física e IA individual para milhares de corpos não cabem** (G4/G5, performance primeiro). A regra desta fase: **a multidão não é uma lista de Mechs**. É **um sistema de dados** (`sim/Multidao.ts`, módulo puro com teste de simulação, G14), assim:

| Camada | Quantos | O que é | Custo |
|---|---|---|---|
| **A massa** | até **3.000** em campo (capacidade de 5.000) | vetores tipados (`Float32Array` de x, z, vx, vz; `Uint8Array` de vida e estado): **sem objeto por figurante, sem corpo do Rapier, sem controlador de personagem** (G6) | **cada figurante se move a cada 3º tick** (um terço do total por tick: ~1.000 atualizações por tick com a massa cheia, sem alocar) |
| **A frente** | até **120** | os que estão perto do jogador ou dos prédios: mais detalhe no desenho (braços, bandeira), a mesma simulação | só o desenho muda |
| **O acerto** | — | **grade espacial** (células de 4 m): o tiro e a explosão consultam **só as células tocadas**, nunca a lista inteira | tiro: O(1); explosão: O(células no raio) |
| **O desenho** | **2 chamadas** | `InstancedMesh` (ou geometria instanciada com atributos por instância: posição, direção, fase e estado; o balanço do andar e o tombo na **vertex shader**), **sem sombra própria**; a distância longa vira **placa (impostor)** | ~60 triângulos por figurante de perto, 2 de longe |
| **O determinismo** | — | posição e vida só no tick de 60 Hz, **`rng` com semente** (G1/G2); nada de `Math.random` ou `Date.now` | — |

**O que não vai para a rede:** a massa **não** é sincronizada (G11: ≤ 8 KB/s por jogador; 3.000 figurantes a 20 Hz custariam ~20× isso). **A fase nasce offline** (como o Bunker, a Praia e a Amazônia: `MAPAS_SO_OFFLINE`), e o multijogador da fase, se o Comandante quiser, vira uma decisão **própria** (a massa como **semente + marcha**, determinística nos dois lados, sem mandar posição).

**O custo, dito em números a medir** (§ 4): a conta de bolso acima dá **~0,1 ms por tick** de CPU para a massa e **~60 mil triângulos** na vista mais cheia; **são estimativas** (R13) até a bancada medir.

## 4. Os números de aceitação (a bancada, como no Bunker e na Amazônia)

| O que se mede | Como | Teto |
|---|---|---|
| Colisores estáticos | contagem no build | **< 310** (o teto do Bunker): os três prédios são **caixas e cascas simples** (o Congresso: duas torres e duas cúpulas; o Planalto e o Supremo: caixas com colunata só de desenho) |
| CPU por tick com a massa cheia | 3.000 figurantes em marcha + o jogador atirando (a medição da P91) | **≤ 0,3 ms** só da massa; **sem regressão** no resto |
| Desenhos e triângulos na vista mais cheia | a Praça com a última marcha | **≤ 70 desenhos**, **≤ 80 mil triângulos** |
| GPU p50 e p95 | `medicoes/amazonia-gpu.mjs` adaptado (Edge/Chrome com GPU real, sem vsync, rodadas intercaladas e mediana) | **p50 dentro do quadro de 60 fps na GPU integrada** (G12); p95 **registrado, não escondido** |
| Alocação por quadro | contador de `new` durante uma marcha | **zero** (G4/G5) |
| Qualidade adaptativa | `core/Quality.ts` (G12) | o teto da massa **desce** com a qualidade (alta 3.000 · média 1.800 · baixa 800) |
| Memória | tamanho dos desenhos | **sem textura nova grande**; a cabeça de gado é **geometria**, não imagem |

**Evidência obrigatória no PR do cenário:** a bancada (formato de `medicoes/AMAZONIA.md`), as capturas em `.decepticons/arte/` e o **teste de simulação** da massa (andar até a fachada, depredar, tombar com a explosão, o agitador derrubado derruba a coesão, determinismo com a mesma semente).

## 5. O visual (a identidade fica para o Codex e para o olho do Comandante)

- **O lugar:** a **Brasília modernista** em baixo polígono: o Congresso (duas torres gêmeas entre duas cúpulas, uma côncava e outra convexa), o Planalto e o Supremo de colunata branca, o espelho d'água, o Eixo Monumental com os ministérios em fila ao fundo. **Cenário real, edifícios públicos**: sem pessoa real e sem símbolo de partido.
- **A multidão:** camisa **verde e amarela**, bandeiras, bonés (o que `CAMPANHAS_E_CHEFES.md` já fixou: "sem arma de fogo; bandeira, extintor, cadeira"), e **a cabeça de gado** que o Comandante pediu (*"é o mod deles"*): é uma **máscara de geometria** (focinho e chifres) sobre o mesmo corpo. **Decisão herdada do `CAMPANHAS_E_CHEFES.md`: o rótulo "gado" fica fora do texto do jogo**; o visual já diz.
- **A máscara é dado e tem botão de desligar** (a mesma precaução da skin da Colossus V1): se uma loja ou plataforma reclamar, ela sai **sem mexer no código** (a fase continua com a camisa).
- **Fora do alvo, por escolha da casa:** **criança** nunca vira alvo ou arma, e **religião e quem a pratica ficam fora** (o alvo é a **máquina de manipulação** e o evento político, não a fé): `CAMPANHAS_E_CHEFES.md`, "o elenco de NPCs".

## 6. Os passos (um PR cada, com o que cada um entrega sozinho)

1. **Este PR:** o pino do 8 DE JANEIRO no mapa (EM BREVE), o Bunker em Corumbá, a ficha. ✅
2. **`sim/Multidao.ts`** (a massa pura, **com teste de simulação**) + a bancada de CPU. Sem desenho: o número decide se a § 3 aguenta.
3. **O desenho da massa** (instanciado, impostor, a máscara) + a bancada de GPU na GPU real (`varrer-nan`, `FERRAMENTAS.md` § 4.1, porque é shader novo).
4. **O mapa** (a Praça e a Esplanada, residente, colisores < 310) + a captura.
5. **A missão** (as cinco marchas, as integridades, o agitador, o objetivo na tela no padrão do P194) + o mapa entra no catálogo de visibilidade como **restrito** (`mapa:janeiro`): só o Comandante vê até liberar.

## 7. Fatos: o que o jogo pode afirmar (a regra "sátira exagera, fato é fato")

**Nenhuma afirmação factual entra no jogo sem ficha com fonte** (`CAMPANHAS_E_CHEFES.md` § 0). Hoje esta fase **só afirma** o **nome** (a data), o **lugar** (a Praça dos Três Poderes, Brasília) e a **moldura narrativa do próprio jogo** (a SERAFIM defende os prédios). Ficam **🟡 sem fonte**, e portanto **fora de qualquer texto até haver `fichas/fatos-8-de-janeiro.md`**:

- *"os militares não aderiram"* (a linha de enredo "os quartéis não vieram");
- o que foi depredado e como, e o **número** de pessoas (a palavra "milhares" é do Comandante e serve para a **escala visual**, não para uma cifra no jogo);
- qualquer descrição jurídica do que ocorreu (as fontes são as decisões e os relatórios públicos; a ficha de fatos as lista).

## 8. Perguntas ao Comandante (cada uma com a minha proposta)

1. **Só offline por enquanto?** *Proposta:* sim (a massa não vai para a rede: § 3). O multijogador da fase é uma decisão à parte.
2. **Como a fase se ganha?** *Proposta:* **sobreviver aos 5 minutos com os três prédios de pé** (a pontuação são os dispersados), e não "matar todos".
3. **"Porrada": qual é a ação?** *Proposta:* **a investida do Mech** (a esquiva que já existe) atropelando a massa, e a **chapa de escudo** empurrando; sem arma de corpo a corpo nova. Se o Comandante quiser um **bastão**/arma de impacto, vira uma arma nova (`ARSENAL.md`), PR à parte.
4. **Os nomes dos prédios no jogo:** **os nomes das instituições** (O CONGRESSO, O PLANALTO, O SUPREMO) ou **arquétipos** (a regra do `UNIVERSO.md` § 2-A: "nomes: arquétipos fictícios")? *Proposta:* nomes genéricos de lugar e função, sem o nome de nenhuma pessoa.
5. **O figurante é pessoa estilizada ou "casca" (androide com a máscara)?** *Proposta:* **pessoa estilizada, sem rosto** (silhueta e roupa, a cabeça de gado como máscara), tombando e sumindo, sem sangue. **Risco registrado:** é uma fase em que se **atira em manifestantes de um evento real**; a máscara em dado e a fase **restrita** no painel de visibilidade são a rede de segurança (§ 5, § 6 passo 5).
6. **O lado:** a fase é **só da Aliança** (o campo que defende as instituições); o Consórcio não tem versão dela. *Proposta:* sim.
