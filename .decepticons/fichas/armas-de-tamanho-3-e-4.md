# FICHA · ARMAS DE TAMANHO 3 E 4 (as dos gigantes)

> **Status:** proposta · **Autora:** Qwen (ficha) · **Atualização:** 2026-10-12 · **Etiqueta:** `#combate`
> **O que esta ficha é:** o **projeto** das armas que os gigantes carregam — **quais** e com **que números** —, para
> completar o que a ordem **P82** deixou como "futuramente" e destravar o **robô de tamanho 4** (ordem **P100**, que
> ressuscitou a **P11**).
> **O contrato já existe** e **não se repete aqui:** a regra da classe (a pesada do tamanho N é a leve do N+1) está em
> `combat/weaponClass.ts` e o passo a passo de criar uma arma de tamanho 3 está em `ARSENAL.md` §"Como criar a versão de
> tamanho 3". Esta ficha é o **projeto** que o passo a passo pede — o nome, o papel e os números de cada uma.
> **O que a ficha NÃO faz:** não escolhe o que construir por você. As propostas estão na § 3 e as perguntas, na § 6.
> **Nota de franqueza (R13):** **nada disto existe**, e o portão é conhecido: **hoje nenhuma arma cabe num robô de
> tamanho 4** (todas são `size: 2`) — sem esta ficha, o robô novo da P100 entra no Hangar sem arma.

## 1. Por que a ficha vem antes da arma

Criar uma arma é barato (`ARSENAL.md`: um `WeaponId`, uma linha em `WEAPON_FIT`, os números na `BASE`, o encaixe na lista
do chassi, e um teste que trava). O caro é **errar o número**: arma de gigante erra para cima e vira a única escolha
(o contrário do fair-play que o jogo promete). E há uma armadilha de escala: **o tamanho do robô cresce, mas a arena
não** — a Arena tem 200 m hoje, então uma arma "2× maior" que também atira "2× mais longe" transforma o Colossus num
sniper que ninguém alcança. A ficha existe para dizer **o que escala e o que não escala**, antes de alguém digitar a
`BASE`.

## 2. A regra de escala que eu proponho (o que cresce, e por quê)

Um passo de tamanho **dobra** o robô (o Colossus, tamanho 3, tem 14 m). A arma dele, então, é a arma do tamanho de um
robô 2× maior — mas o **jogo** continua com inimigos que correm 9 m/s numa arena de 200 m. A escala certa é a que muda
**peso e impacto**, não a que muda **alcance**:

| O que | Fator por passo de tamanho | Por quê |
|---|---|---|
| **Dano** | **× 1,8** | um tiro do gigante tira uma parte; dois tiros não matam do outro lado do mapa |
| **Calor** | **× 1,5** | o gigante esquenta mais devagar do que dispara mais forte — senão a arma de tamanho 3 tem sempre a melhor economia |
| **Peso** | **× 2** | é o que **obriga a escolha**: o gigante carrega **muito** e ainda assim escolhe entre "duas pesadas" e "uma pesada e o resto" |
| **Alcance** | **× 1,3** (teto) | **a arena não cresceu**: o teto existe para o gigante não virar um atirador de fora da briga |
| **Cadência** | **× 0,75** | mais lento, ou o dano maior vira dano por segundo maior e a arma é "a melhor em tudo" |
| **Classe** | a regra já existe (`classAt`) | **nenhuma linha de regra muda** — a arma entra como `size: 3` e o resto é consequência |

**A âncora de peso (concreta):** o Colossus tem **24 t** de carga (`FERRAMENTAS.md` § 2). Com peso ×2, uma arma pesada de
tamanho 3 fica em **~10 t**: **duas pesadas = 20 t** e sobram 4 t para o módulo — ou **uma pesada + duas médias** para
quem quer variedade. **É a decisão que faz o gigante ser um gigante**, e ela nasce do peso, não de uma trava nova.

## 3. As armas que eu proponho (primeiro corte)

### Para o tamanho 3 (o Colossus, que hoje só tem as pesadas dos Mechs como leves)

| Proposta | Classe | Escala de | Papel e contra-jogo | Números (proposta, sobre a de origem) |
|---|---|---|---|---|
| **CANHÃO DE CERCO** (`siege`) | **pesada** | canhão pesado (1 tiro de 90) | **O tiro do gigante:** um obus que abre um buraco. Contra-jogo: **2,6 s entre tiros** é uma eternidade contra um rush, e o recuo empurra o próprio gigante | dano **160** (90 × 1,8), calor 0,45, **peso 10 t**, alcance 1,3× o do canhão, cadência 0,75× |
| **ROTATÓRIA PESADA** (`heavyRotary`) | **média** | rotatória | **Fogo de supressão de gigante:** sobe a cadência em 2 s e trava no calor. Contra-jogo: não tem carregador, o calor é o limite, e ela **não derruba uma perna de longe** (alcance 1,3×, dano baixo por tiro) | dano **8** por tiro, 12 tiros/s no topo, **peso 6 t** |

### Para o tamanho 4 (o robô da P100 — depois do rig)

| Proposta | Classe | Papel e contra-jogo | Números (proposta) |
|---|---|---|---|
| **LANÇA DE CERCO** (`lance`) | **pesada** | o tiro mais forte do jogo, **um por carregador**, com clarão que denuncia a posição. Contra-jogo: **recarga de 6 s** e o gigante fica parado e visível | dano **290** (160 × 1,8), calor 0,7, **peso 20 t**, alcance 1,3× o do canhão de cerco |
| **CASULO PESADO DE MÍSSEIS** (`heavyBarrage`) | **média** | chuva de mísseis de gigante (a `barrage` escalada): satura uma área. Contra-jogo: o mesmo teto de mísseis no ar e a mesma recarga longa | 12 foguetes por salva, **peso 12 t** |

> **As três que eu NÃO proponho, e por quê:** **nenhuma arma "leve" de tamanho 3 ou 4** (a leve do tamanho 3 **é** a
> pesada do 2 — `ARSENAL.md` diz, e um teste proíbe declarar de novo); **nada de arma de precisão de gigante** (com o
> alcance preso a 1,3× ela seria só um canhão pior); e **nada de escudo/drone de tamanho 3** antes de o gigante ter o
> próprio arsenal (as fases depois desta).

## 4. Os testes (cada linha é um `it()`)

Os dois primeiros **já existem** e são a trava do contrato; os outros nascem com as armas:

1. *(existe)* **"nenhum encaixe oferece arma que o tamanho do chassi não carrega"** — a arma de `size: 3` não aparece no Hangar de um Mech.
2. *(existe)* **"ninguém declara uma leve de tamanho 3"** — a leve do 3 é a pesada do 2.
3. **"A arma de tamanho 3 só cabe no chassi de tamanho 3"** — o Colossus a carrega, o Vector-09 não (e o de tamanho 4 fica para quando existir).
4. **"O peso de uma arma de tamanho 3 é ~2× o da de origem"** — o teste lê a `BASE` das duas e compara com a tolerância declarada (é a âncora da § 2).
5. **"O dano por segundo de uma arma de tamanho 3 não passa o da de origem"** — o teto que impede a arma do gigante de ser "a melhor em tudo" (`balance.ts`).
6. **"O alcance não passa 1,3× o da de origem"** — a trava do sniper de fora da briga.
7. **"O gigante não carrega duas pesadas e ainda um módulo de 4 t"** — a decisão da § 2 é real e medida, não retórica.
8. **"O canhão de cerco derruba um torso de Mech em dois tiros, e não em um"** — a meta do encontro (o poder sem o exagero).
9. **"A lança de cerco é determinística e não vaza estado novo na rede"** — arma nova entra na `NET_WEAPONS` (protocolo) e no orçamento de banda como qualquer outra.

## 5. O que já existe, e o que falta

| Peça | Já existe | Falta |
|---|---|---|
| A regra da classe | `combat/weaponClass.ts` (`classAt`, `classFor`, `fitsSize`) + os 2 testes que a travam | nada |
| O passo a passo | `ARSENAL.md` §"Como criar a versão de tamanho 3" | os nomes e os números (**esta ficha**) |
| O encaixe do gigante | `ARM_SLOTS` do Colossus (só as pesadas dos Mechs) | a linha das armas de `size: 3` |
| A carga do gigante | **24 t** no Colossus (`FERRAMENTAS.md` § 2) | a decisão "duas pesadas ou uma" (a § 2 já a resolve pelo peso) |
| O Hangar | agrupa por classe sozinho (LEVES/MÉDIAS/PESADAS) | nada: arma nova entra no grupo certo pela regra |
| O balanceamento | a `BASE` de `combat/weapons.ts` e as metas de `combat/balance.ts` | os números medidos (o **Claude** faz na Oficina, contra as metas) |
| O robô de tamanho 4 | o contrato (`RobotSize` até 4, `CHASSIS_SIZE`) e o arquivo da P100 (que precisa de re-rig) | o robô **e** as armas dele — **esta ficha é o portão das armas** |
| A arte | os obus/mísseis/rotatória do tamanho 2 (escaláveis como referência) | a arte de cada arma nova (**Codex**), depois do número |

## 6. Perguntas para o dono

1. **Os dois nomes do tamanho 3** — "CANHÃO DE CERCO" e "ROTATÓRIA PESADA" — servem, ou ele quer outro nome (o jogo nomeia pelo que a arma é)?
2. **A regra de escala da § 2** (dano ×1,8, calor ×1,5, peso ×2, alcance ×1,3, cadência ×0,75) é a que ele quer? **É a decisão que define todo o arsenal de gigante** — e ela é uma linha por arma depois.
3. **O peso de ~10 t** (duas pesadas = 20 das 24 t do Colossus) é a tensão certa, ou ele quer o gigante carregando **duas pesadas e mais** (o que pede subir a carga dele, não a arma)?
4. **Qual entra primeiro:** o **canhão de cerco** (um tiro que se sente, fácil de explicar no vídeo) ou a **rotatória pesada** (a que dá para testar sozinha, sem depender de alvo grande)?
5. **O Colossus chefe** (da Sobrevivência) passa a usar as armas de tamanho 3? — hoje ele segue com plasma e foguetes, e trocar mexe no equilíbrio do encontro (é a decisão em aberto da P82).
6. **A lança de cerco** (tamanho 4, um tiro de 290) é o teto que ele quer para o maior robô do jogo, ou parece pouco para 20 t de arma?
7. **Mesma arma, três níveis MK** (como todas): o MK III de uma arma de tamanho 3 continua custando 2× o peso do MK I (a regra de hoje), ou no gigante o peso **não** sobe com o nível?
