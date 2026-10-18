# AMAZÔNIA — OPERAÇÃO RIO VIVO (P180)

> **A ordem do Comandante (17/10):** *"vamos já planejar e construir a próxima fase: próximo cenário, que vai ser no rio Amazonas, uma mineradora acabando com o rio, envenenando,
> poluindo, explorando as populações indígenas e expulsando-as dos seus territórios. Há uma enorme força de defesa deles e teremos que desmantelar, invadir com androides e destruir
> por dentro. Já até criei o modelo (`heavy industrial walker 3d model`): é um mech maior que o nosso tamanho 4 (Colossus v4), então o cenário precisa ser bem maior que o que estamos
> fazendo, e manter a eficiência e a contenção de consumo para não ficar travando. Faça sua melhor versão desse modelo: ele deve se mexer (eu não inseri o RIG: tenho que fazer ou você faz?)"*
> e, em seguida: *"podemos usar aquela imagem da serpente dos rios amazônicos como referência para a fase, mostrando que **acima desse super mech o rio é limpo e vivo, e depois dessa
> máquina o rio fica poluído, sujo, com óleo e envenenado**"*.
>
> **Resposta sobre o rig:** quem faz sou eu (Blender sem janela, por script, reproduzível em `scripts/blender/`); o Comandante não precisa rigar. **A imagem da serpente não chegou**
> (nem na conversa, nem nas pastas): pendência abaixo.
>
> **Relação com `fichas/cenario-amazonas.md` (outra sessão do Claude, 17/10, mesma ordem P180):** a ficha é o **contrato da missão** (as zonas pelo que fazem, as cinco fases, as forças, o
> lado que muda a missão, o Relatório de Consequências) e **vale**; este documento acrescenta o que veio depois, na conversa do Comandante: **o DRAGA-01 (o modelo dele, riggado e andando)**,
> **o rio como termômetro da fase**, o **tamanho e o orçamento do mapa** e a ordem de construção. **Uma correção de fato à ficha:** ela supunha que o modelo que o Comandante criou era o do
> *cenário*; ele disse, no chat, que **o modelo é o do robô** (`MODELOS 3D\heavy industrial walker 3d model`), então **o cenário (a geometria) é construído em código** (§ 5), e a lista de pontos
> nomeados da ficha (§ 5 dela: `spawn_jogador`, `torre_{n}`, `gerador_cerca`, `bomba_{n}`, `valvula_{n}`, `draga`, `territorio`…) vira o **layout do mapa em dado**, como `PraiaLayout.ts`. **O nome provisório
> é o da ficha, OPERAÇÃO RIO VIVO** (o Comandante dá o final).
>
> Este documento é **a proposta de Claude**; o Comandante corta o que discordar (regra 10 do `AGENTS.md`). Modelo de redação: `CAMPANHAS_E_CHEFES.md` § 0 (**sátira exagera, fato é fato**:
> toda afirmação factual do jogo tem fonte em `fichas/fatos-mineracao-amazonia.md`; o que não tem é sátira, dita como sátira).

## 1. A ideia numa frase

**O rio é o termômetro da fase.** (A ficha já previa "o rio corre limpo" quando o envenenamento para; aqui a ideia vira o placar contínuo.) A montante (acima) do **DRAGA-01** o rio é limpo e vivo; a jusante (depois) ele é sujo, com óleo, espuma e veneno. O Draga **anda rio acima**, rumo à
**aldeia**: onde ele pisa, o rio morre. Cada peça que o jogador desmonta **cura um trecho do rio**, e o placar da fase é visível a olho nu: a água.

## 2. A história e o tom

- **O vilão é arquétipo, não empresa real** (mesma regra do Banco Vorcaris): a mineradora é **AURUM**, do **Grupo Vorcaris** (o banco do Império, que já financia os ataques nos outros capítulos:
  a fase mostra *para onde vai o dinheiro*). O **DRAGA-01** é a dragagem móvel dela: uma plataforma de processamento sobre quatro pernas que anda no leito e nas margens.
- **Quem está do nosso lado:** o **povo da aldeia** (alvo a proteger, nunca alvo a atirar: sem arma, sem criança em perigo mostrada, a regra do § 0 da campanha). A aldeia é o "núcleo" da fase.
- **A serpente (Cobra Grande / Boiúna):** o mito dos rios amazônicos como **guardiã do rio**. A leitura que proponho, **até a imagem chegar**: o rio, visto de cima, serpenteia; a água limpa é
  a serpente viva (verde-azulada, com brilho) e a poluída é a serpente envenenada (marrom e preta, com óleo). **Não afirmo nada do desenho da imagem que eu não vi.**
- **O que o jogo afirma como fato** está na ficha `fichas/fatos-mineracao-amazonia.md` (mercúrio do garimpo, rejeitos, terras indígenas, o que é a lei). O quadro é **misto**: garimpo ilegal
  e mineração industrial são coisas diferentes, e o jogo não mistura nem acusa sem fonte.

## 3. A mecânica central: o rio que cura

`limpezaDoRio(x)`: uma função **pura** (G14) do eixo do rio: **1 a montante da frente de limpeza, 0 a jusante**, com uma faixa de mistura. A frente é:
- no começo, **a posição do Draga** (o veneno nasce nele; a água acima dele é limpa);
- a cada peça desmontada, **a frente de cura avança rio abaixo** (os trechos de jusante ficam limpos: o rio se recompõe), até a vitória (o rio inteiro limpo).

O desenho é **um uniforme** (a posição da frente) lido pelo shader da água: cor, espuma, brilho de óleo, transparência e a vida (peixes, vitórias-régias) **a montante**; sem CPU por quadro além de um número.

## 4. O DRAGA-01 (o modelo do Comandante)

**O arquivo** (`MODELOS 3D/heavy industrial walker 3d model.glb`, medido em 17/10): **693 KB, 27.033 triângulos**, uma malha só **sem esqueleto, sem pele e sem textura** (um material cinza),
537 partes soltas. **É um quadrúpede**: quatro pernas articuladas (cada uma com coxa, canela e pé separados), um **casco** entre as pernas, um **disco giratório** (a plataforma gira sobre as
pernas), a **cabine de comando** na frente com radar, o **convés** com tubulações, **dois guindastes** e uma **chaminé**. Não é humanoide: o contrato do `MECHS_IMPORTADOS.md` (11 ossos de
Mixamo, antebraço, encaixe de arma no pulso) **não se aplica**; ele ganha o próprio contrato (§ "O rig do quadrúpede", abaixo).

**O tamanho:** **38 m de altura, 38 m de comprimento e 20 m de largura** (o Colossus v4 tem 20 m; o Vector-09, 5,3 m). Entra como **tamanho 5** do chassi (o `RobotSize` hoje vai a 4).

**O rig (Claude fez, por script de Blender: `scripts/blender/rig-walker.py`):** 18 ossos: `raiz`, `casco`, `deck` (o disco e tudo o que está em cima: gira), `guindaste_esq`, `guindaste_dir`, `radar` e, **por perna**,
`coxa`, `canela`, `pe` (4 × 3: `fl`, `fr`, `rl`, `rr`). **Pele rígida por parte** (cada uma das 537 peças vai inteira a um osso: é peça de máquina, não carne, e a junta não amassa), **cor nos vértices** (uma
malha, **um desenho**: amarelo de segurança no casco, aço escuro nas pernas, ferrugem e fuligem embaixo, luzes de aviso) e **sem textura** (o download não cresce).

**A animação (procedural, sem clipe):** o andar de um **quadrúpede pesado em quatro tempos** (dianteira esquerda, traseira direita, dianteira direita, traseira esquerda: sempre três pés no
chão), com o passo casado com a velocidade (o pé não escorrega), o balanço do casco, o **convés que gira para a mira**, os guindastes que oscilam e o radar que gira. Perna destruída:
**a perna cai e o casco afunda e inclina**; as quatro caídas, ele **arrasta o casco**.

**Medido no arquivo riggado (17/10):** **984 KB, 27.032 triângulos, 18 ossos, uma malha com pele e cor nos vértices, um desenho**; as 537 peças soltas foram classificadas por posição e conferidas em foto (casco 111, convés 376, quatro pernas de 11 a 13 peças cada, guindastes 9 e 10, radar 5); **nenhum vértice ficou sem osso**. A marcha anda a 2,6 m/s com o **passo de 5 m**. O arquivo original do Comandante não foi tocado.

**Como entra na simulação:** um **chefe** (como o Colossus-01) com números próprios (`WALKER_BOSS_STATS`: tamanho 5, 38 m, cápsula larga, muita vida em cada perna e no casco). O desenho do
Draga é **só do cliente** (o servidor nunca carrega `.glb`, G14): a simulação vê um corpo com os números dele e o cliente põe a malha em cima, seguindo a posição e o rumo (`WalkerVisual`).
Os **módulos de dano** são os que o jogo já tem: **as pernas da esquerda e da direita** (duas cada), o **casco** (torso) e a **cabine** (cabeça).

## 5. O mapa (muito maior que a praia, e barato)

**Tamanho proposto: 2.400 × 900 m** (a praia tem 640 × 240: **14 vezes a área**). O rio corre de oeste (montante, a aldeia) a leste (jusante), serpenteando.

| Zona (de oeste a leste) | O que tem |
|---|---|
| **A aldeia e a floresta viva** | as malocas, as canoas, a floresta densa, a água limpa; **o ponto a proteger**; o jogador nasce aqui |
| **A margem fortificada** | cerca, torres de vigia, as baterias, os geradores do escudo |
| **A mina a céu aberto** | a cratera em degraus (relevo, não caixas), as esteiras, os caminhões, a planta de processamento e a **lagoa de rejeitos** |
| **O leito do Draga** | o rio largo e raso, por onde o Draga anda; a frente do veneno |
| **O rio morto (jusante)** | a floresta queimada e a água preta, com óleo |

**O orçamento (o teto que o Comandante pediu: "eficiência e contenção de consumo"):**
- **Desenhos ≤ 70** por vista, **triângulos ≤ 250 mil**, **colisores estáticos ≤ 400**, **um colisor de altura para o terreno todo** (como a praia). Teto de personagens da sala (8) inalterado.
- **Terreno em pedaços de 400 m com três níveis de detalhe** (célula de 6, 12 e 24 m por distância); só os pedaços da câmera são desenhados. Um colisor só, em altura.
- **Floresta é instanciada** (três tipos de árvore, copa em dois níveis de detalhe, **cartões de longe**), agrupada em células de 100 m: **o desenho escolhe as células da câmera** (G4: sem
  alocar por quadro). Teto de 4.000 árvores visíveis.
- **A água é UMA malha e UM shader** (a cor da limpeza, o óleo, a espuma): sem reflexo em tempo real e sem partícula por gota.
- **Névoa de umidade** (visibilidade ~700 m) para o mapa grande não pedir desenho de longe; o céu do ciclo do dia (P161) serve.
- **O Draga é um desenho (uma malha com pele) e 27 mil triângulos**; as pernas se mexem por osso, não por geometria nova.
- **Nada pesado por quadro:** o rio, as nuvens, as folhas e o óleo se mexem **no shader** (um uniforme de tempo e um da frente do rio). A IA e a simulação seguem a 60 Hz determinísticas.

### 5.1 Como ficou na parte B (medido; a bancada é `medicoes/amazonia.mjs`, refazível)

- **O terreno é uma função só** (`AmazoniaTerreno.ts`), lida pela malha **e** pelo colisor de altura: o que se vê é o que se pisa. Grade de 6 m (400 × 150 células), **24 pedaços de 300 m de 5.000 triângulos**, um nível de detalhe só (a ideia dos três níveis do plano saiu: com o alcance de 1.500 m e a névoa o terreno inteiro dá ≤ 120 mil triângulos, e três níveis custariam emenda e código). Encosta máxima de 0,50 (26,6°), medida na grade inteira.
- **O rio** é o desenho em dado (`AmazoniaLayout.ts`: eixo que serpenteia, 78 m a montante e 140 m a jusante, leito de 5,5 m) e **uma malha com um shader**; a **frente** (`AmazoniaRio.ts`, pura, testada) é UM número que o shader da água, o do chão, o da folhagem e o das estruturas leem (a mesma curva suave em JS e em GLSL, a banda é de 70 m de cada lado: o veneno não é uma parede).
- **A floresta:** **6.594 árvores** (`AmazoniaFloresta.ts`: determinísticas, rareiam em volta da mina e da planta, não existem no rio, na aldeia, na cava, na lagoa nem na encosta íngreme), **duas malhas instanciadas por pedaço**: a árvore de perto (52 triângulos, até 260 m) e o bloco de longe (10 triângulos, até 1.050 m); o `observar` só troca `visible` (sem alocar).
- **As estruturas** (`AmazoniaAderecos.ts`, dado puro: **220 peças**, 53 sólidas): a aldeia (maloca grande, 13 casas, 5 canoas), a planta (3 galpões, 2 silos, 6 tanques, chaminé, esteira), a margem fortificada (cerca de 40 postes e **8 torres de vigia**), as máquinas da cava e a casa de bombas da lagoa; fundidas numa malha só.
- **Colisores estáticos: 58** (1 de altura, 4 paredes, 53 estruturas; teto 400). **Medido na bancada** (SwiftShader: só contagem, não tempo): **29 a 55 desenhos** (teto 70) e **102 a 227 mil triângulos** (teto 250 mil; a pior vista é a aldeia, 226.748). O mapa monta em ~0,3 a 1,4 s.
- **Sob demanda:** o código do mapa (7 KB gzip, mais o terreno) só baixa para quem o escolhe (`mapasSobDemanda.ts`); o JS de partida ficou em **497,2 / 500 KB** (o `ServerPanel` também passou a ser sob demanda: 6,2 KB).
- **A câmera:** a do jogo vai a 800 m e o mapa tem 2.400 m: na Amazônia ela vai a **1.500 m** (`alcanceDaCamera`) e o domo do céu tem 1.200 m. **Sem isso o céu saía preto no jogo** (só o jogo real mostrou; a bancada tinha a câmera dela).

### 5.2 Como ficou na parte C (a missão jogável, sem escudo nem defesa)

- **A missão é a Sobrevivência da Amazônia** (`?mapa=amazonia&modo=survival`; o link do seletor de mapas já leva a ela, e o Deathmatch do mapa é escolha do seletor de modo): o jogador nasce na aldeia e o **Draga-01 é o único inimigo**. Não tem ondas, rebeldes nem quadro de luz (a defesa dele é a parte D).
- **O corpo é um `MechBase`** (`entities/DragaMech.ts`), como o Colossus: cápsula cinemática de 36 m por 10 m, character controller, dano por parte, calor e o canhão de cerco (360 de dano a cada 4,5 s, alcance de 400 m). **Os dois módulos de perna são os dois lados** (cada lado = duas pernas do desenho): **a perna da frente cai primeiro** (de 100% a 50% de vida do módulo) e a de trás depois; um lado caído o deixa a **50%** da velocidade, os dois a **30%** (rasteja). Tronco de 4.800, pernas de 1.600, cabeça de 600 e braços de 900: **números de partida, não validados**.
- **A marcha** (`sim/DragaMarcha.ts`, pura): ele olha para o ponto do leito 70 m rio acima e vira a 14°/s; de pernas inteiras anda os **1.550 m** até a linha da aldeia em **~10 minutos** (2,6 m/s). **Atira** em quem estiver a até 320 m com a visada livre (a primeira salva 3 s depois da largada), com erro de mira de ~2,6° e a semente do chefe (determinístico).
- **O fim** (`sim/MissaoDoRio.ts`, pura): **vitória** se o Draga cai; **derrota** se o corpo dele cruza a linha da aldeia (90 m das últimas casas). **O jogador morrer não perde**: renasce na aldeia. Se os dois acontecem no mesmo tick, vale a vitória. Ao acabar o mundo congela e o rio **se limpa correndo para a foz** (só desenho; a cura de verdade é a parte E).
- **A tela** (`ui/PraiaHud.ts`): a barra do chefe (`DRAGA-01 · FASE n DE 3`, os dois lados e a regra da fase), a célula **ALDEIA · DRAGA A n m · n MIN** com a barra da marcha (laranja a 50%, vermelha a 80%) e os avisos a 1.000, 500, 250 e 100 m.
- **Para testar o fim sem esperar dez minutos:** `&marcha=0.8` (de 0 a 0,95) começa com o Draga já 80% do caminho andado; `&marcha=0.95` o deixa a 77 m da linha (perde em ~30 s sem ninguém para o derrubar).
- **Carrega sob demanda** (`ChefeCarregado` em `mapasSobDemanda.ts`): o corpo, o cérebro e o desenho (o `.glb` de 984 KB) só baixam para quem abre a missão; o Deathmatch da Amazônia não paga por eles.
- **A floresta esconde o Draga do chão:** de dentro da mata só se vê o que passa das copas (as árvores chegam a 29 m e o Draga tem 38). Ele aparece inteiro no rio e nas clareiras (a aldeia, a planta). É uma escolha de ambiente a conferir com o Comandante.

### 5.3 Como ficou na parte D1 (o escudo e os geradores)

- **Os geradores** (`environment/AmazoniaGeradores.ts`, no pedaço sob demanda do Draga): **três torres de força** (`AMAZONIA_GERADORES`): a **CERCA** (x -100, na margem norte, atrás das torres), a **PLANTA** (x 20, no flanco sul dela, junto à água) e a **CAVA** (x 260, entre a planta e a mina). Cada uma é um **alvo destrutível** (`Destructibles.addExterno`, o mesmo dos coqueiros da praia, P138): a caixa é um **sensor** (o tiro e a explosão a acertam, o Mech atravessa), **1.500 de vida** (o plasma de fábrica leva ~30 s; o canhão pesado, ~10 s), solta destroços e faíscas ao cair. **O desenho** são seis malhas (um corpo e um brilho cada), sem nada por quadro. O teste confere que nenhuma cai no rio, a menos de 12 m da água nem a menos de 8 m de uma estrutura sólida.
- **O escudo** (`sim/EscudoDoDraga.ts`, pura): **enquanto algum gerador estiver de pé o Draga recebe 10% do dano** (`DragaMech.escudo`, escrito pelo `Match` a cada tick; vale para o tiro, a explosão e o dano por segundo: fogo, choque e gelo não são atalho). **Cai com o último gerador e não volta** (rodada nova os devolve). O número (10%) e a vida (1.500) são **proposta de equilíbrio**: o Comandante ajusta em `ESCUDO_DO_DRAGA`.
- **A tela:** a barra do chefe ganha a linha `ESCUDO · 3 DE 3 GERADORES` (vira `ESCUDO CAIU`), a regra dela é "O escudo o protege: derrube os geradores." enquanto ele estiver de pé, a linha da missão pede os geradores, e cada gerador que cai sobe o aviso (`GERADOR CAIU · RESTAM 2`, `ESCUDO DO DRAGA CAIU`).
- **A ordem do jogador:** o Draga larga em x = 700 e anda 2,6 m/s; o jogador, na aldeia (x -960), corre ~1.300 m até a cava. **A defesa em si (as torres armadas, os Mechs e os androides) é a parte D2**: hoje os geradores estão sozinhos.

### 5.4 Como ficou na parte D2 (as torres armadas e a força de defesa)

- **As torres** (`sim/TorresDeVigia.ts`, pura; as oito de `TORRES_DA_MARGEM`, com a boca do canhão 5 m fora da cabine): `TORRES_DE_VIGIA` = **alcance 170 m, rajada de 4 tiros, 0,16 s entre os tiros, 2,4 s de espera, erro máximo de mira 0,035 rad**. A visada é **um raio na física, só quando a torre está pronta para atirar** (o barranco do rio e as estruturas escondem quem anda no leito: é a cobertura natural). O tiro é a **automática de aço** com dano 8 e alcance 190, **sem dono**, que acerta o jogador (e quem estiver no caminho). **As torres só atiram enquanto o gerador da CERCA (o primeiro) está de pé**; derrubado, calam e não voltam.
- **A força de defesa** (`AMAZONIA_GUARDA`): **3 Mechs** (x -82, 46 e 282) e **6 androides** (x -122, -112, 4, -2, 236 e 250), todos do lado norte do rio, junto aos geradores. É o `BotSystem` com `defensores` ligado: **seguram o posto** (o mesmo modo da retaguarda), **não renascem**, e o Draga é o único que marcha. Nascem **no chão do ponto** (`alturaDoChao`, a altura do terreno do mapa: y = 0 enterrava os Mechs e derrubava os androides do mundo).
- **O sono:** sem alvo a **420 m** (além do alcance das torres e das armas de fábrica) e sem dano nos últimos **6 s**, o robô da defesa **não pensa nem anda**: custa o teste de distância e mais nada. **O chefe nunca dorme.** Medido: a missão inteira custa ~3,2 ms por tick (sem o sono e sem o chão certo eram 9 ms).
- **A tela:** a barra do chefe diz `TORRES DA MARGEM ARMADAS` / `TORRES DA MARGEM SEM ENERGIA`.
- **O que o jogador sente:** cruzar o rio entre a aldeia e a cerca é **atravessar fogo de cobertura**; a saída é derrubar a CERCA (o primeiro gerador, atrás das torres) ou ir pela margem onde as torres não alcançam. O número é proposta: o Comandante ajusta em `TORRES_DE_VIGIA` e `AMAZONIA_GUARDA`.

### 5.5 Como ficou na parte E (a invasão)

- **A Resistência** (`AMAZONIA_RESISTENCIA`, 3 pontos junto de onde o jogador nasce): **CAIPORA, IARA e CURUPIRA**, andróides aliados (`BotSystem` com `escort` e `plantadores`, o mesmo sistema de aliados da Arena; sem drones). Acompanham o jogador; caídos, renascem na aldeia em 4 s (**na missão do rio o `Respawner` tem um ponto só, a aldeia**: com aliados na lista, o "mais longe dos vivos" mandaria quem morre para o outro lado do mapa).
- **A escotilha** (`sim/InvasaoDoDraga.ts`, pura): abre **quando o escudo cai** e não fecha. Fica no **flanco direito do casco**, a `INVASAO.ladoDaEscotilhaM` = **13 m** do eixo (o raio do corpo é 10 m); com o Draga olhando para -X é o lado **sul**. **A carga:** cada andróide a menos de `raioDaEscotilhaM` = **8 m** soma `1/30` por segundo (**um leva 30 s; os três, ~10 s**), no máximo 3 contam; sem ninguém junto recua `1/45` por segundo. **Cheia, detona** (`CombatSystem.detonar`): o Draga cai, o abate conta, a missão vence. As folgas (8 m, parar a 1,5 m) existem porque o Draga anda 2,6 m/s e o andróide segue de trás.
- **A ordem aos andróides** (`Match.fixedUpdateInvasao`): `hold` até a escotilha, reemitida só quando ela anda 6 m (reemitir a cada tick zera a memória de obstáculos). **`BotController.plantador`**: com `hold`, o robô **fica no ponto** (sem orbitar o alvo, sem recuar para esfriar): sem isto eles rondavam o Draga a 12 m.
- **O canhão do Draga só mira Mechs** (`DragaController`): andróide é pequeno demais para o radar dele. **Os outros inimigos (guarda, torres) não têm essa folga.**
- **A tela e o cenário:** a linha `INVASÃO · CARGA n% · n DE 3 DENTRO` e o aviso `ESCOTILHA ABERTA · OS ANDRÓIDES ENTRAM` (que vem antes do aviso do escudo, a ordem do que fazer agora); no cenário (`environment/AmazoniaEscotilha.ts`, sob demanda): um **anel verde** do tamanho do raio, um **disco** que cresce com a carga e um **farol** de 60 m.
- **O que o jogador sente:** derrubar os geradores deixa de ser só tirar o escudo: **abre a porta**. A Resistência que o acompanha vira a ponta de lança; ele a escolta (a guarda a ataca no caminho) e escolhe se espera os 10 s da carga ou atira no tronco. Os números são proposta: o Comandante ajusta em `INVASAO`.
- **Ainda não é a cura de verdade:** o rio se limpa correndo para a foz depois da vitória (só desenho); a cura com consequência (o Relatório de Consequências e o Consórcio) é a etapa seguinte.

## 6. A missão (em atos)

1. **O perímetro (desmantelar a defesa):** o Draga anda **rio acima** protegido por um **escudo** que três **geradores** (espalhados na margem e na mina) alimentam. Destruir os três derruba o
   escudo; enquanto está de pé, o Draga recebe 90% menos dano. A força de defesa é a da fase 1: **Mechs, androides e torres** (as torres são regra pura, estáticas e baratas).
2. **O avanço (parar o Draga):** com o escudo caído, **derrubar as pernas** o para (cada perna que cai o freia; as quatro o deixam no chão). Ele **atira** com os canhões do convés enquanto anda.
3. **A invasão (destruir por dentro):** com o Draga parado, **androides aliados** entram por uma **escotilha do casco** (entre as pernas) e **plantam a carga nos núcleos** (a barra sobe com cada
   androide dentro, como a injeção dos cabos, ao contrário); o jogador os escolta. É o **primeiro uso do androide como ponta de lança** (P149: "lugares só de andróide e drone").
4. **O rio se cura:** o Draga cai e a frente de limpeza corre rio abaixo até o fim: **vitória**.

**Derrota:** o Draga chegar à **aldeia** (o núcleo da fase, mesma regra de `NucleoDaEstacao`).
**Atos 1 a 3 existem no código** (partes D1, D2 e E); o ato 4 (a cura) é só desenho por ora. Cada ato é **módulo puro em `sim/` com teste de simulação** (G14), como o capítulo 1.

## 7. A ordem de construção (um PR por parte, cada um no ar)

| Parte | O que entrega | Estado |
|---|---|---|
| **A — o Draga** | o `.glb` riggado (script de Blender), o andar do quadrúpede (função pura, com teste), o `WalkerVisual`, a bancada de fotos e um **link de demonstração** no jogo (`?walker`) | **feita (17/10)** |
| **B — o rio e o mapa** | o mapa `amazonia` (terreno em pedaços, floresta instanciada, o rio com a frente de limpeza), a bancada de custo e o teto de desenhos em teste | **feita (17/10)**: `?mapa=amazonia&modo=deathmatch`; o Draga desce o leito e o rio muda com ele (DEMO) |
| **C — o Draga na partida** | o chefe com os números, os módulos de dano (as quatro pernas), o rastejo, a barra do chefe e a chegada à aldeia (derrota) | **feita (17/10)**: `?mapa=amazonia&modo=survival` é a missão do rio; derrubar o Draga vence, ele chegar à aldeia perde |
| **D1 — o escudo e os geradores** | os três geradores (alvos destrutíveis), o escudo do Draga (90% menos dano enquanto houver gerador de pé), a barra do chefe com a contagem e os avisos | **feita (18/10)**: `?mapa=amazonia&modo=survival`; veja § 5.3 |
| **D2 — as torres e a força de defesa** | as oito torres da margem armadas (calam com a CERCA), 3 Mechs e 6 androides de defesa que seguram o posto e dormem longe | **feita (18/10)**: `?mapa=amazonia&modo=survival`; veja § 5.4 (o JS de partida está em 493,3 de 500 KB) |
| **E — a invasão** | a escotilha, os androides da Resistência e a carga que detona o Draga por dentro (ato 3) | **feita (18/10)**: `?mapa=amazonia&modo=survival`; veja § 5.5 (o JS de partida está em 495,7 de 500 KB: a próxima parte paga com dieta) |
| **F1 — o Relatório de Consequências** | o chip RELATÓRIO ▸ depois da missão: o que aconteceu, três fatos do mundo real com fonte e o que é ficção (P179 camada 3) | **feita (18/10)**: abre depois de `?mapa=amazonia&modo=survival`; `fichas/fatos-mineracao-amazonia.md` § 0 |
| **F2 — a cura com consequência e o Consórcio** | o rio curado de verdade e a campanha invertida (a Aliança invade, o Consórcio defende; P179 camada 4) | — |

## 8. Decisões em aberto (do Comandante)

0. **A Draga anda ou fica na margem?** A ficha (§ 4) propõe a Draga **na margem, bombeando o rio**, que "cai pelas pernas e pelo gerador"; o Comandante pediu que o modelo "**se mexa**", e este plano a faz **andar rio acima rumo à aldeia** (é o que dá o relógio da fase e o rio que muda de cor). As duas cabem: parada na margem enquanto o escudo está de pé e **marchando** quando ele cai? Proposta: **anda desde o começo**, devagar; o Comandante decide.

1. **O nome:** DRAGA-01 é o nome de trabalho (a draga é a máquina real do garimpo de rio). Se o Comandante quiser que ele seja o **Leviatã** que a P165 deixou "para discutir", é troca de texto.
2. **A imagem da serpente:** colar no chat ou largar em `D:\imagens cybermech\` (e dizer o nome): sem ela, o rio serpenteia mas não ganha o desenho da serpente.
3. **Mineradora fictícia, Grupo Vorcaris:** o vilão é arquétipo (AURUM / Vorcaris), nunca uma empresa real. Confirmar.
4. **O tamanho do mapa (2.400 × 900 m):** é proposta; o teto é o orçamento do § 5, que a bancada vai medir.
5. **A derrota na aldeia:** o jogador perde se o Draga chegar à aldeia (como a estação da praia). Confirmar.

## 9. Pendências (R13)

- O arquivo do dono (`.glb` cru) fica em `D:\imagens cybermech\MODELOS 3D\`; o jogo usa a cópia riggada em `client/public/models/` (o original não é tocado).
- Os fatos da ficha estão marcados 🟡 até ler as fontes primárias. **A ficha dos fatos da mineração e do garimpo já existe** (`fichas/fatos-mineracao-amazonia.md`, 17/10): tudo 🟡, e a expulsão dos povos ainda não foi levantada.
- Só offline (como o capítulo 1): o online precisa do contrato de times (P81) e do teto de 8 personagens.
- **Parte B era mapa de Deathmatch; a parte C o faz missão:** com o Draga como chefe de verdade. **Ainda não há** escudo, geradores, torres, força de defesa, invasão com androides nem cura de verdade (partes D e E). No Deathmatch da Amazônia o Draga que desce o leito segue sendo **só desenho** (sem corpo).
- **O orçamento é de contagem, não de tempo:** a bancada roda em SwiftShader (sem GPU). Falta medir quadros por segundo numa GPU de verdade, integrada de preferência (G12).
- **Do visual (parte B):** o chão visto de cima mostra um desenho de espinha de peixe (a diagonal da grade com a ondulação miúda); de perto não se vê. Sem som ambiente, sem pássaros, sem partículas de névoa ou de óleo, sem reflexo na água. A floresta troca a árvore pelo bloco a 260 m (a névoa esconde pouco: pode aparecer o estalo).
