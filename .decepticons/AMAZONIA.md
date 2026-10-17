# AMAZÔNIA — OPERAÇÃO RIO ENVENENADO (P178)

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
> Este documento é **a proposta de Claude**; o Comandante corta o que discordar (regra 10 do `AGENTS.md`). Modelo de redação: `CAMPANHAS_E_CHEFES.md` § 0 (**sátira exagera, fato é fato**:
> toda afirmação factual do jogo tem fonte em `fichas/fatos-mineracao-amazonia.md`; o que não tem é sátira, dita como sátira).

## 1. A ideia numa frase

**O rio é o termômetro da fase.** A montante (acima) do **DRAGA-01** o rio é limpo e vivo; a jusante (depois) ele é sujo, com óleo, espuma e veneno. O Draga **anda rio acima**, rumo à
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

## 6. A missão (em atos)

1. **O perímetro (desmantelar a defesa):** o Draga anda **rio acima** protegido por um **escudo** que três **geradores** (espalhados na margem e na mina) alimentam. Destruir os três derruba o
   escudo; enquanto está de pé, o Draga recebe 90% menos dano. A força de defesa é a da fase 1: **Mechs, androides e torres** (as torres são regra pura, estáticas e baratas).
2. **O avanço (parar o Draga):** com o escudo caído, **derrubar as pernas** o para (cada perna que cai o freia; as quatro o deixam no chão). Ele **atira** com os canhões do convés enquanto anda.
3. **A invasão (destruir por dentro):** com o Draga parado, **androides aliados** entram por uma **escotilha do casco** (entre as pernas) e **plantam a carga nos núcleos** (a barra sobe com cada
   androide dentro, como a injeção dos cabos, ao contrário); o jogador os escolta. É o **primeiro uso do androide como ponta de lança** (P149: "lugares só de andróide e drone").
4. **O rio se cura:** o Draga cai e a frente de limpeza corre rio abaixo até o fim: **vitória**.

**Derrota:** o Draga chegar à **aldeia** (o núcleo da fase, mesma regra de `NucleoDaEstacao`).
**Nada disso existe ainda no código:** é o roteiro. Cada ato é **módulo puro em `sim/` com teste de simulação** (G14), como o capítulo 1.

## 7. A ordem de construção (um PR por parte, cada um no ar)

| Parte | O que entrega | Estado |
|---|---|---|
| **A — o Draga** | o `.glb` riggado (script de Blender), o andar do quadrúpede (função pura, com teste), o `WalkerVisual`, a bancada de fotos e um **link de demonstração** no jogo (`?walker`) | **feita (17/10)** |
| **B — o rio e o mapa** | o mapa `amazonia` (terreno em pedaços, floresta instanciada, o rio com a frente de limpeza), a bancada de custo e o teto de desenhos em teste | — |
| **C — o Draga na partida** | o chefe com os números, os módulos de dano (as quatro pernas), o rastejo, a barra do chefe e a chegada à aldeia (derrota) | — |
| **D — a defesa** | os geradores do escudo, as torres, a força de defesa e o ato 1 | — |
| **E — a invasão** | a escotilha, os androides, os núcleos e a cura do rio (atos 3 e 4) | — |

## 8. Decisões em aberto (do Comandante)

1. **O nome:** DRAGA-01 é o nome de trabalho (a draga é a máquina real do garimpo de rio). Se o Comandante quiser que ele seja o **Leviatã** que a P165 deixou "para discutir", é troca de texto.
2. **A imagem da serpente:** colar no chat ou largar em `D:\imagens cybermech\` (e dizer o nome): sem ela, o rio serpenteia mas não ganha o desenho da serpente.
3. **Mineradora fictícia, Grupo Vorcaris:** o vilão é arquétipo (AURUM / Vorcaris), nunca uma empresa real. Confirmar.
4. **O tamanho do mapa (2.400 × 900 m):** é proposta; o teto é o orçamento do § 5, que a bancada vai medir.
5. **A derrota na aldeia:** o jogador perde se o Draga chegar à aldeia (como a estação da praia). Confirmar.

## 9. Pendências (R13)

- O arquivo do dono (`.glb` cru) fica em `D:\imagens cybermech\MODELOS 3D\`; o jogo usa a cópia riggada em `client/public/models/` (o original não é tocado).
- Os fatos da ficha estão marcados 🟡 até ler as fontes primárias.
- Só offline (como o capítulo 1): o online precisa do contrato de times (P81) e do teto de 8 personagens.
