# FICHA · CHASSI DE TAMANHO 4 (o titã) — os números que faltam

> **Status:** proposta · **Autora:** Qwen (ficha) · **Atualização:** 2026-10-12 · **Etiqueta:** `#mechs`
> **O que esta ficha é:** os **números** do robô de tamanho 4 — altura, velocidade, carga, vida —, que **não existem
> em lugar nenhum** e que o arquivo do dono (ordem **P100**) precisa para entrar. Segue o modelo da casa
> (`fichas/MODELO_ROBO.md`), com uma diferença: **a silhueta já existe** (o `.glb` do dono); o que falta é o resto.
> **O que a ficha NÃO faz:** não conserta o rig (o roteiro está em `MECHS_IMPORTADOS.md` §8) e não decide o que é do
> dono (§ 7). **Nada disto existe no jogo**, e o portão conhecido é: **nenhuma arma cabe no tamanho 4** hoje — a
> `fichas/armas-de-tamanho-3-e-4.md` propõe as primeiras.
> **Nome:** o arquivo é `colossusv4` e o trabalho em andamento o chama de **TITÃ**. O nome é do dono (§ 7).

## 1. Identidade

- **Nome e código:** a definir (`TITÃ` é o nome de trabalho) · **Tamanho:** **4** (o `RobotSize` do `chassis.ts` já vai até 4)
- **Classe:** a maior de todas — **cerco pesado**
- **Lado:** jogador (Hangar), **chefe**, ou os dois — decisão do dono (§ 7)
- **Papel em uma frase:** a **fortaleza que anda** — chega devagar, ocupa o espaço e troca tiros que os outros não
  sobrevivem; quem o enfrenta não troca tiro, **circula e flanqueia**.

## 2. Fantasia de jogo

- **Pilotar é:** sentir o peso de um prédio. Cada passo é um evento; virar custa; o tiro sai com um trovão e um recuo
  que **empurra o próprio titã**.
- **Enfrentar é:** o chão treme antes de você ver — e a resposta certa não é atirar mais forte, é **usar o que ele não
  faz**: mudar de altura, entrar por onde ele não passa, esperar os 6 s da recarga de 20 t.
- **O que só ele faz:** carregar as armas de **tamanho 4** (a lança de cerco, na ficha das armas).
- **Fraqueza clara:** é **lento e enorme**. Toda cobertura da Arena foi desenhada para robôs de 5 a 14 m.

## 3. Os números (proposta; o Claude mede e passa para `entities/chassis.ts`)

Referências **reais** (lidas do código): andróide **1,6 m** (tamanho 1) · Vector-09 **5,3 m**, **9 m/s**, **11 t**
(tamanho 2) · Colossus-01 **14 m**, **5 m/s**, **24 t** (tamanho 3).

| Campo | Proposta | Colossus (3) | Vector-09 (2) | Por quê |
|---|---|---|---|---|
| **Altura** | **~22 m** (alternativa **~36 m**, ver § 4) | 14 m | 5,3 m | o passo 2→3 multiplica por **2,6**; o 3→4 pode repetir (36) ou ser mais suave (22) |
| **Raio da cápsula** | **altura/2 − folga** | 3,6 m | 1,3 m | **o Rapier não aceita raio maior que a metade da altura** (`chassis.ts`) |
| **Pé-de-escada** (`stepHeight`) | **~3,5 m** | 2,4 m | 0,9 m | senão ele **não sobe a própria rampa** (a lição das rampas do Bunker) |
| **Velocidade** | **3,5 m/s** | 5 m/s | 9 m/s | o titã é lento **de propósito**: dá tempo de circular e de fugir da linha de tiro |
| **Carga** | **40 t** | 24 t | 11 t | a **lança** pesa 20 t: **duas = 40**, ou uma lança + um casulo (32) e um módulo |
| **Vida (torso / perna)** | ~**1,7×** o Colossus | — | — | o número exato é medido contra o `balance.ts` (não se inventa aqui) |
| **Dash** | **sem dash** (ou um avanço curto) | — | 34 m/s | o dash de um titã seria um **teleporte** de 22 m; a graça dele é chegar andando |

## 4. A régua entre os tamanhos (e uma correção na P11)

O passo real medido no código: **1,6 → 5,3 (×3,3) → 14 (×2,6)**. A **P11** pediu "tamanhos 4 e 5 **10× e 20×
maiores**" — o que daria **53 m e 106 m**. Isso quebra em três lugares, e é bom dizer por quê:

- **A Arena tem 200 m** (`Arena.ts`, `halfSize = 100`): um robô de 53 m ocupa **um quarto** da arena em largura, e a
  cobertura desenhada para 5 a 14 m deixa de existir;
- **O Rapier trava antes:** raio ≤ altura/2 → um titã de 53 m teria cápsula de 26 m, e a física contra os prédios
  vira um teste de tolerância;
- **A câmera e o Hangar** foram feitos para 14 m no máximo: a 3ª pessoa num robô de 53 m é uma vista aérea, e a garagem
  some.
- **A alternativa da ficha:** **22 m** (passo mais suave, 1,6×) ou **36 m** (o mesmo 2,6× do passo anterior) — as duas
  caibam na Arena; a decisão é do dono (§ 7), e a P11 merece ser **revisada** com o número escolhido.

## 5. O que já existe, e o que falta

| Peça | Já existe | Falta |
|---|---|---|
| O contrato do tamanho | `RobotSize` até 4, `CHASSIS_SIZE`, `classAt` (`weaponClass.ts`) | nada |
| O arquivo do robô | `colossusv4.glb` (8,6 MB, 98 mil triângulos) | **o re-rig** (faltam 4 dos ossos que o jogo anima; o roteiro está em `MECHS_IMPORTADOS.md` §8) |
| As armas dele | — | a `fichas/armas-de-tamanho-3-e-4.md` propõe as primeiras (a lança de 20 t) |
| O registro do chassi | `CHASSIS`, `IMPORTED_CHASSIS`, `ARM_SLOTS` (`chassis.ts`) | a entrada do titã (depois do rig) |
| O Hangar | agrupa por classe pela regra (tamanho 4 vê as pesadas do 3 como leves) | a lista `ARM_SLOTS` dele |
| Os testes de papel | `ChassisPapeis.test.ts` (nenhum chassi melhor em tudo) | os testes desta ficha (§ 6) |
| A arte e as capturas | — | o **julgamento visual é do dono** (eu não leio imagem) |

## 6. Os testes (cada linha é um `it()`)

1. **"O titã não é melhor que o Colossus em tudo"** — o teste que já existe (`ChassisPapeis`) varre o tamanho 4 também: mais vida e mais carga, **menos velocidade**.
2. **"A cápsula respeita a altura"** — raio ≤ altura/2 (a trava do Rapier), com folga declarada.
3. **"O pé-de-escada sobe a rampa da própria Arena"** — o valor tem de vencer as rampas e degraus que o jogo já tem, com física real.
4. **"A carga comporta exatamente as montagens propostas"** — duas lanças (40 t) **cabem**; duas lanças + um módulo de 3 t **não cabem**.
5. **"Sem dash"** (ou com o avanço curto declarado): o titã não pode ter o dash de 34 m/s dos Mechs (o teste trava o campo, não a intenção).
6. **"O rig do arquivo tem os quatro ossos que faltavam"** (`torso`, `head`, `leftHand`, `rightHand`) e o antebraço para o encaixe — o teste do inspetor (`mech:inspecionar`) roda no `check`.
7. **"O titã custa o que promete"** — o custo de CPU por tick com um titã em cena (a física é mais um corpo grande; medir como a P91 mediu os 32 corpos).

## 7. Perguntas para o dono

1. **A altura:** **~22 m** (passo suave) ou **~36 m** (repete o passo de 2,6× do Colossus)? E a **P11** deve ser revisada (o "10× e 20×" dela daria 53 m e 106 m, que não caibam na Arena de 200 m)?
2. **A velocidade de 3,5 m/s** (o Colossus tem 5, o Vector-09, 9) é o peso certo, ou ele quer um titã mais ágil?
3. **A carga de 40 t** (duas lanças de 20 t) é a tensão que você quer, ou o titã deve carregar mais (e aí ele carrega **tudo**, e a escolha desaparece)?
4. **Ele é de quem?** Jogador (Hangar), **chefe** de missão, ou os dois? (O Colossus é os dois; o titã no Hangar pede a garagem e a câmera maior.)
5. **Sem dash** (proposta) ou com um avanço curto?
6. **O nome:** **TITÃ** fica (é o que o trabalho em andamento usa), ou ele ganha nome próprio como MARAUDER e BASTION?
7. **Quem faz o re-rig:** você manda o `.glb` novo (o pedido está em `MECHS_IMPORTADOS.md` §8), e a ficha é atualizada com os números finais antes de o chassi entrar.
