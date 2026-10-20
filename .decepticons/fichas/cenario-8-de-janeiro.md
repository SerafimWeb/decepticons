# FICHA · CENÁRIO — 8 DE JANEIRO (Praça dos Três Poderes · Brasília · DF)

> **Status:** proposta, **v2 (19/10): as respostas do Comandante entraram** · **Autor:** Claude · **Etiqueta:** `#cenarios`
> **A ordem (P217, 19/10):** *"uma nova fase que vai girar em torno dos ataques golpistas do 8 de janeiro à sede dos poderes em Brasília. São milhares de manifestantes de verde e amarelo, usando cabeças de gado, é o mod deles. Eles são os golpistas que tentaram tomar o poder à força, mas os militares não aderiram a essa tentativa de golpe. Nós vamos chegar lá e eliminar os golpistas na base do tiro, porrada e bomba."* O pino está no mapa do console, em Brasília, **onde era o Bunker**, que foi para Corumbá · MS.
> **As respostas (P219, 19/10):** *"pode começar só offline, mas quero que dê pro online também: todas as fases devem dar pra jogar online, todos os modos valem pra todas as fases"* (isto virou a **P218**, `MULTIPLAYER.md` § 12) · *"vencer é manter os prédios de pé e expulsar ou neutralizar todos eles (mas eles chegam toda hora em ônibus lotados, e principalmente surgem das tampas de esgoto e saem das lixeiras)"* · *"porrada é que vamos ter que eliminar eles"* · os manifestantes são **pessoas com cabeça de gado**; entre eles há **carecas idosos** e **rapazes de peruca loira** (caricaturas, § 5) e **androides** · *"os androides entram em combate conosco, os outros fogem. Eles fazem cocô em cima das mesas do palácio e nossos androides têm que limpar."*
> **v3 (P222, 19/10): a fase é realista e compacta.** O Comandante mandou usar referências reais do dia (a trama golpista, a tentativa de golpe, a depredação), **saguões fechados onde só androides e gente entram (o Mech fica de fora)** e um mapa **menor** (224 × 160 m). **Os fatos que o jogo pode afirmar, com a fonte, estão em `fichas/fatos-8-de-janeiro.md`; onde esta ficha diz "os militares não aderiram" (§ 7), vale a correção dela: a frase NÃO vai ao jogo.** O mapa está em `environment/PracaLayout.ts`.
> **O que esta ficha é:** o contrato da fase **antes** do primeiro polígono (`fichas/README.md`). **Nada aqui está no jogo ainda:** o pino diz EM BREVE.

## 1. A fase em uma frase

**Manter os três prédios da Praça dos Três Poderes de pé e esvaziar a Praça**: uma multidão de verde e amarelo chega sem parar (de ônibus, dos bueiros e das lixeiras), tenta entrar nos prédios e sujá-los, e o jogador a **elimina ou expulsa** com tiro, bomba e porrada, enquanto os androides aliados **limpam o que ela suja**. É uma defesa de lugar (a gêmea da estação de cabos), com **uma diferença que muda tudo**: o inimigo é **uma massa**.

## 2. O que a fase FAZ (não o que ela parece)

**Quem aparece (os figurantes):**

| Tipo | Parte da massa | Comportamento |
|---|---|---|
| **GADO** (pessoa com cabeça de gado, verde e amarelo) | ~75% | marcha até um prédio, **depreda** (desgasta a integridade) e **suja** as mesas; **foge** se levar tiro por perto ou se o jogador chega a poucos metros |
| **CARECA** (idoso careca, de colete, verde e amarelo) | ~12% | mais lento e aguenta 2 acertos; **foge** |
| **PERUCA** (rapaz de peruca loira, verde e amarelo) | ~8% | mais rápido; **foge** mais cedo (filma de longe e sai correndo) |
| **ANDROIDE REBELDE** (misturado à multidão) | ~5% (no máximo 6 vivos de uma vez) | **é o único que luta**: ataca o jogador e os aliados (os `Android` e o `BotController` de hoje, com a vida, o tiro e a rede que eles já têm) |

**De onde vêm (as fontes, posições fixas do mapa):** **ônibus** (chegam pelo Eixo e descarregam um grupo grande de uma vez), **tampas de esgoto** (os bueiros abrem e soltam figurantes por alguns segundos) e **lixeiras** (soltam poucos de cada vez, ao longo da fase). As fontes são **dado do mapa** e o ritmo de cada uma sai do cronograma da fase (semente e tick, G1/G2): não é sorteio ao vivo. O jogador pode **fechar** uma tampa de bueiro ficando sobre ela por alguns segundos? *(pergunta aberta 3)*.

**Como termina:**
- **Vence:** os **três prédios de pé** e a Praça **vazia** (todos os figurantes **eliminados** ou **expulsos**, isto é, chegaram ao limite do mapa fugindo) **depois que a cota de chegadas da fase acabou**. A cota é finita (5 minutos, a regra do projeto): a chegada contínua é a cota sendo despejada pelas fontes.
- **Perde:** um prédio chega a **integridade zero**, ou o **tempo acaba** com figurantes na Praça.
- **Pontuação:** eliminados, expulsos, e **mesas limpas** (a limpeza conta).

**Os prédios** (o Congresso, o Planalto e o Supremo; os nomes são a pergunta 1) têm **integridade**. O figurante que **chega à fachada** a desgasta devagar; ao entrar no saguão aberto **suja uma mesa** e sai correndo.

**A sujeira (as mesas):** cada prédio tem um saguão com **seis mesas** (posições fixas). Cada mesa suja é uma **marca estilizada** (um montinho, sem texto) e **desgasta a integridade do prédio devagar enquanto estiver lá**. Os **androides aliados** (os técnicos que já existem, `tool: 'repair'`, com a roupa de faxina) vão até a mesa suja e **limpam em ~3 s**; o jogador protege a limpeza e escolhe a prioridade (defender a fachada ou a faxina). É o que dá ao jogador **por que correr** de um prédio a outro.

**O arsenal é o que existe:** o **tiro** (qualquer arma), a **bomba** (granada, mísseis, chuva de mísseis: contra massa, um acerto derruba um aglomerado) e a **porrada** (eliminar à mão: a **investida do Mech** e a **chapa de escudo** empurrando, sem arma nova; se o Comandante quiser um bastão, vira uma arma à parte). **Violência estilizada, sem sangue**: o figurante atingido **tomba e some** num sopro.

**Os modos** (P218: todos os modos valem em todas as fases): a **missão** acima é a **Sobrevivência** do 8 DE JANEIRO. Nos outros modos a multidão entra **como ambiente** (200 a 600 figurantes que fogem e não depredarão): **Deathmatch** e **Bandeira** na Praça; **Domínio** com os três prédios como pontos de controle. *(pergunta aberta 4)*.

## 3. A massa: o problema técnico, e a ideia que resolve o CPU e o online de uma vez

**Milhares de corpos com física e IA individual não cabem** (G4/G5, G6). A multidão **não é uma lista de Mechs** nem de objetos. Cada figurante é **uma linha de dados** (`sim/Multidao.ts`, módulo puro com teste de simulação, G14), e a ideia central é esta:

> **A posição de um figurante é uma função do tempo**, não um estado que se integra a cada tick. Cada um nasce com `(fonte, tickDeNascimento, tipo, alvo, semente)` e a posição em qualquer tick `t` é `f(esses dados, t)`: caminha em linha reta da fonte ao alvo, com um balanço calculado da semente. **Só o que muda por causa do jogador é guardado:** *morreu no tick d* e *fugiu no tick f* (a partir de f, a posição é a de f mais a corrida ao limite do mapa).

O que isso compra:

| Pergunta | Resposta |
|---|---|
| **CPU?** | **não há integração por figurante por tick.** Posições só são calculadas **sob demanda** (uma vez a cada 2 ticks, num vetor, para os acertos e para a regra "alguém chegou à fachada"): 3.000 avaliações ≈ dezenas de µs. O **desenho** calcula a posição **na vertex shader** a partir do tick atual (uniforme) e dos atributos por instância: **zero CPU por figurante por quadro** |
| **Rede (G11: ≤ 8 KB/s por jogador)?** | **não se manda posição.** O cliente recebe o cronograma da fase (semente, uma vez) e **eventos**: *morreu(id)*, *fugiu(id, tick)*, *mesa suja/limpa*, *integridade do prédio*. Quem entra no meio recebe o **mapa de bits dos mortos** (3.000 bits ≈ 375 B) e a lista dos que fugiram. Dezenas de B/s, não milhares |
| **Determinismo?** | o servidor e o cliente avaliam **a mesma função** (a trigonometria do balanço sai de uma tabela de inteiros, para não depender da plataforma: a mesma precaução da simulação do `shared/`) |
| **Acerto?** | o tiro e a explosão varrem o vetor de posições do tick (3.000 itens) ou uma **grade espacial de 4 m** reconstruída a cada 3 ticks; sem alocar |

| Camada | Quantos | O que é |
|---|---|---|
| **A massa** | até **3.000** em campo (capacidade de 5.000) | vetores tipados (`Float32Array`/`Uint8Array`/`Uint16Array`): **sem objeto por figurante, sem corpo do Rapier, sem controlador de personagem** |
| **Os androides rebeldes** | no máximo **6 vivos** | entidades de verdade (o `Android` de hoje), sincronizadas pelo roster e pelo estado que já existem |
| **O desenho** | **2 a 4 chamadas** (uma por tipo) | geometria instanciada; o andar, o tombo e a corrida na **vertex shader**; sem sombra própria; a distância longa vira **placa (impostor)** |

**O custo, dito em números a medir** (§ 4): a conta de bolso dá **≤ 0,1 ms por tick** para a massa e **~60 mil triângulos** na vista mais cheia; **são estimativas** (R13) até a bancada medir.

## 4. Os números de aceitação (a bancada, como no Bunker e na Amazônia)

| O que se mede | Como | Teto |
|---|---|---|
| Colisores estáticos | contagem no build | **< 310**: os prédios são caixas e cascas simples (o Congresso: duas torres e duas cúpulas; os outros dois: caixas com colunata só de desenho) |
| CPU por tick com a massa cheia | 3.000 figurantes + o jogador atirando (a medição da P91) | **≤ 0,3 ms** só da massa; **sem regressão** no resto |
| Desenhos e triângulos na vista mais cheia | a Praça na última chegada | **≤ 70 desenhos**, **≤ 80 mil triângulos**. **Medido (19/10, `medicoes/MULTIDAO.md`): a multidão são 3 desenhos e ~182 mil triângulos no pico (31 mil do mapa + ~110 por figurante): o teto NÃO foi atingido, e o quadro (14 ms, a multidão custa 1,2 a 2 ms) cabe nos 60 fps** |
| GPU p50 e p95 | `medicoes/amazonia-gpu.mjs` adaptado (GPU real, sem vsync, rodadas intercaladas e mediana) | **p50 dentro do quadro de 60 fps na GPU integrada** (G12); p95 **registrado, não escondido** |
| Alocação por quadro | contador de `new` durante uma chegada | **zero** (G4/G5) |
| Rede | o tráfego de uma sala com a massa cheia | **≤ 8 KB/s por jogador** (G11), medido com o servidor de verdade |
| Qualidade adaptativa | `core/Quality.ts` (G12) | o teto da massa **desce** com a qualidade (alta 3.000 · média 1.800 · baixa 800) |
| Memória | tamanho dos desenhos | **sem textura nova grande**; a cabeça de gado é **geometria**, não imagem |

**Evidência obrigatória no PR do cenário:** a bancada (formato de `medicoes/AMAZONIA.md`), as capturas em `.decepticons/arte/` e o **teste de simulação** da massa: a mesma semente dá a mesma multidão; a posição por tick bate com a avaliada ao longo do caminho; o tiro mata o que está na mira e só ele; o que foge sai do mapa; a cota acaba; as fontes despejam no ritmo do cronograma; o servidor e o cliente avaliam igual.

## 5. O visual (a identidade fica para o Codex e para o olho do Comandante)

- **O lugar:** a **Brasília modernista** em baixo polígono: o Congresso (duas torres gêmeas entre duas cúpulas), o Planalto e o Supremo de colunata branca, o espelho d'água, o Eixo Monumental, os **ônibus**, as **tampas de esgoto** e as **lixeiras**. **Edifícios públicos reais**; nenhuma pessoa real nem símbolo de partido.
- **O GADO:** camisa **verde e amarela**, bandeiras, bonés; a **cabeça de gado** (*"é o mod deles"*) é uma **máscara de geometria** (focinho e chifres) sobre o mesmo corpo. **O rótulo "gado" fica fora do texto do jogo** (decisão herdada de `CAMPANHAS_E_CHEFES.md`); o visual já diz.
- **O CARECA e a PERUCA são caricaturas de tipos**, descritas pelo Comandante, que **se parecem com duas figuras públicas reais** (um empresário idoso e careca e um deputado de peruca loira). **Regra desta casa para o jogo:** só o **tipo** (careca idoso de colete; rapaz de peruca loira) entra: **nenhum nome, marca, logotipo ou texto** de pessoa ou empresa, nem no desenho, nem no texto, nem no código. *(Isto é uma escolha desta ficha; o Comandante pode contestar.)*
- **Cada tipo tem botão de desligar** (dado, não código): a mesma precaução da skin da Colossus V1. Se uma loja, plataforma ou advogado reclamar, o tipo sai **sem mexer no código** e a fase continua com a camisa verde e amarela.
- **A sujeira** é um montinho estilizado de cor chapada, **sem texto e sem realismo**.
- **Fora do alvo, por escolha da casa:** **criança** nunca vira alvo ou arma, e **religião e quem a pratica ficam fora** (o alvo é a **máquina de manipulação** e o evento político, não a fé): `CAMPANHAS_E_CHEFES.md`, "o elenco de NPCs".

## 6. Os passos (um PR cada, com o que cada um entrega sozinho)

0. **O online em todas as fases e modos (P218, `MULTIPLAYER.md` § 12):** é a ordem geral do Comandante e **vem antes** do que o 8 DE JANEIRO precisa online. O primeiro corte: **a sala escolhe o mapa** (Deathmatch nos quatro mapas online).
1. **O pino do 8 DE JANEIRO, o Bunker em Corumbá, a ficha** ✅ (PR #402); **a ficha v2 e as ordens P218 e P219** (este PR).
2. **`sim/Multidao.ts`** (a massa como função do tempo, **com teste de simulação**) + a bancada de CPU. ✅ (0,043 ms por tick)
3. **O desenho da massa** (instanciado, a posição na shader, a máscara) + a bancada de GPU na GPU real. ✅ **como demonstração** (`?multidao=1`); **falta** o impostor de longe, o teto da qualidade ligado ao `Quality.ts` e `varrer-nan` (`FERRAMENTAS.md` § 4.1, porque é shader novo).
4. **O mapa** (a Praça e a Esplanada, colisores < 310; os ônibus, os bueiros, as lixeiras) + a captura. ✅ **Deathmatch, offline e online, restrito (`mapa:janeiro`)**; **faltam** as mesas dos saguões e a sujeira (vêm com a missão). Fotos: `.decepticons/arte/praca-*.png`; a bancada `medicoes/praca-fotos.mjs`: de 105 a 176 fps (167 com 2.500 de multidão) na GPU integrada.
5. **A missão** ✅ **v1 offline (P233, 20/10: a cota de chegadas, as integridades, a sujeira com faxina abstrata, o tiro, o susto e a investida, o objetivo e a nota na tela; os androides rebeldes entraram em 20/10; o Relatório de Consequências entrou em 20/10 (só em português); faltam os faxineiros como agentes e a revisão humana dos fatos)** (a cota de chegadas, as integridades, a sujeira e os faxineiros, os androides rebeldes, o objetivo na tela no padrão do P194) + o mapa entra no catálogo de visibilidade como **restrito** (`mapa:janeiro`): só o Comandante vê até liberar.
6. **A missão online** (a sala da Sobrevivência, `MULTIPLAYER.md` § 12, etapa O4): o cronograma e os eventos da § 3.

## 7. Fatos: o que o jogo pode afirmar (a regra "sátira exagera, fato é fato")

**Nenhuma afirmação factual entra no jogo sem ficha com fonte** (`CAMPANHAS_E_CHEFES.md` § 0). Hoje esta fase **só afirma** o **nome** (a data), o **lugar** (a Praça dos Três Poderes, Brasília) e a **moldura narrativa do próprio jogo** (a SERAFIM defende os prédios). Ficam **🟡 sem fonte**, e portanto **fora de qualquer texto até haver `fichas/fatos-8-de-janeiro.md`**:

- ~~*"os militares não aderiram"*~~ **(contestada: o STF condenou militares pelo planejamento da trama; a frase segura é *"o golpe não se consumou"*: `fichas/fatos-8-de-janeiro.md` § 4)**;
- o que foi depredado e como (**a sujeira nas mesas é humor do jogo, não relato do que aconteceu**), e o **número** de pessoas (a palavra "milhares" é do Comandante e serve para a **escala visual**, não para uma cifra no jogo);
- qualquer descrição jurídica do que ocorreu (as fontes são as decisões e os relatórios públicos; a ficha de fatos as lista).

## 8. Decisões do Comandante (19/10) e o que ainda está aberto

**Decididas:** (a) a fase **começa offline, mas é feita para o online** e **todos os modos valem em todas as fases** (P218); (b) **vence** quem mantém os prédios de pé e **expulsa ou neutraliza todos**; as chegadas vêm de **ônibus, bueiros e lixeiras**; (c) **porrada é eliminar**: nenhuma arma nova; (d) o manifestante é **pessoa com cabeça de gado**; (e) há **carecas**, **rapazes de peruca loira** e **androides**; **só os androides lutam, os outros fogem**; (f) a **sujeira nas mesas** e a **faxina dos androides aliados**.

**Abertas (cada uma com a minha proposta):**
1. **Os nomes dos prédios no jogo:** os nomes das instituições (O CONGRESSO, O PLANALTO, O SUPREMO) ou arquétipos? *Proposta:* nomes genéricos de lugar e função, sem o nome de nenhuma pessoa.
2. **O lado:** só a Aliança (o campo que defende as instituições) tem a fase. *Proposta:* sim.
3. **Fechar o bueiro:** o jogador pode **tampar** uma tampa de esgoto ficando sobre ela alguns segundos, para a fonte parar? *Proposta:* sim (dá um papel de "controle de território" além do tiro), mas é a primeira coisa a cortar se pesar no escopo.
4. **A multidão nos outros modos:** como **ambiente** (200 a 600, fogem, não depredam), como na § 2. *Proposta:* sim; o Domínio usa os três prédios como pontos.
5. **O nível da piada:** a sujeira é um montinho estilizado de cor chapada, sem texto. *Proposta:* sim; se o Comandante quiser outra marca (um papel rasgado, uma mancha), troca-se sem mexer na regra.

## 9. Riscos (registrados, não escondidos)

- **Caricaturas de duas figuras públicas reais e uma fase em que se atira em manifestantes de um evento real.** A rede de segurança é: só o **tipo** entra (nenhum nome, marca ou texto), **botão de desligar por tipo**, a fase **restrita** no painel de visibilidade (`mapa:janeiro`) até o Comandante liberar, e **nenhum fato sem ficha com fonte**. **Antes de qualquer liberação ao público recomendo a revisão de um advogado**: o dia 25/10/2026 tem o **segundo turno** das eleições, e a legislação eleitoral e a de honra (injúria, difamação) têm regras sobre representar candidatos e ex-candidatos; as lojas e plataformas têm as suas próprias sobre conteúdo político. **A decisão de manter, mudar o tom ou cortar é do Comandante.**
- **O determinismo entre servidor e cliente** (§ 3): a trigonometria vem de uma tabela de inteiros e o teste compara os dois lados.
- **O escopo:** a fase depende do online por mapa (passo 0) e da massa (passos 2 e 3); nenhum deles existe hoje.
