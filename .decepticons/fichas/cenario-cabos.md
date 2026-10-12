# FICHA · CENÁRIO — ESTAÇÃO DE CABOS (Fortaleza · CE)

> **Status:** proposta · **Autora:** Qwen (ficha) · **Atualização:** 2026-10-12 · **Etiqueta:** `#cenarios`
> **O que esta ficha é:** a especificação do **primeiro cenário com rota** — o mapa das missões que precisam de caminho:
> a **escolta** da `fichas/escolta.md` na versão longa e o **contraataque**. É o contrato entre o **dono** (aprova), o
> **Codex** (constrói o cenário e mede) e o **Claude** (pontos validados e a fiação no `Game`).
> **Por que esta e não outra:** o console **já promete cinco missões** (`ui/theater.ts`) e três estão "EM BREVE" — e a
> **ESTAÇÃO DE CABOS é a única cujo lugar está confirmado**: Fortaleza é a chegada dos cabos submarinos no `UNIVERSO.md`,
> e o próprio teste do teatro trava isso (`theater.test.ts`: "só a estação de cabos tem o lugar confirmado; o resto é
> proposta"). A ordem **P99** (12/10) pediu **cenários maiores**; este é o primeiro a ganhar ficha.

## 1. Por que a ficha vem antes de construir

O Bunker ensinou o custo de construir primeiro e conversar depois: ele nasceu, o dono jogou e pediu outra coisa — mais
profundidade, mais alturas, **"uma fase bem desenhada pra combates épicos"** (P60) — e a segunda rodada foi um PR
inteiro (`codex/bunker-vertical`). Uma ficha que fixa **o que o cenário tem de FAZER** (quantas estações, quantas
vias, onde dói) antes da geometria é o que evita essa segunda rodada — e é o que a regra 5 do `AGENTS.md` chama de
contrato antes de paralelizar.

## 2. O que este cenário tem de ter — o que ele FAZ, não o que ele parece

- **A rota:** partida → **duas estações de conserto** → **um choke** (a passagem estreita onde a escolta sofre) →
  **a extração**. São os pontos que a missão #1 usa na versão longa.
- **A base:** a mesma extração vista ao contrário — é o que permite o **contraataque** ("defender e depois retomar")
  sem um segundo mapa.
- **Duas vias entre cada estação.** Uma curta e exposta, outra longa e coberta. **É a decisão que o dono pediu**
  ("jogadas mais interessantes"): num corredor único a escolta só sabe ir em frente.
- **Altura para emboscada:** um posto elevado que enxerga o caminho (o mesmo papel que o ninho de sniper do Bunker).
- **Cobertura quebrável no choke** (`environment/Destructibles.ts`): a passagem muda de forma na partida.
- **Uma zona de cura/resfriamento em cada estação** (`combat/Zone.ts`): a escolta para, conserta e respira — é o que
  amarra este cenário ao que **já existe** no jogo.
- **A história:** cabos submarinos chegando ao litoral, instalação portuária, o Atlântico Sul como recurso ("dados").
  A identidade visual é do **Codex**; aqui só se diz **o que não pode** (§ 5) e que o cenário tem de contar isso.

## 3. O tamanho — a conta, não o chute

- **A Arena tem 200 m** e o **Bunker** é um poço de 58 m com quatro pisos. Este é **rota**, não arena nem poço:
  proponho **~500 m de comprimento por ~140 m de largura** (área ≈ 2,5× a Arena), com até **14 m de desnível** entre o
  nível do mar e a estação alta.
- **A trava que importa: este é o maior cenário que ainda cabe SEM streaming.** O `VISAO.md` põe o mundo com streaming
  e *interest management* na **Fase 7**; este cenário tem de ser **residente**, como os outros dois. Por isso os
  números de aceitação são os do Bunker, medidos do mesmo jeito (§ 4).
- **Tetos declarados:** colisores estáticos **abaixo de 310** (o teto que o Bunker já respeita), **nenhuma luz nova**
  e **nenhuma atualização por frame** — o cenário é estático.

## 4. Os números de aceitação (a bancada, como no Bunker)

| O que se mede | Como | Teto |
|---|---|---|
| Colisores estáticos | contagem no build dos colisores | **< 310** (o teto do Bunker) |
| Desenhos e triângulos por vista | as quatro vistas-chave: partida, estação, choke, extração | dentro da faixa do Bunker (**18 a 67 desenhos**; 10 a 15 mil triângulos por vista) |
| GPU p50 e p95 | Edge headless 1280×720, GPU integrada, 30 renders de aquecimento e 12 amostras por vista (o método do `medicoes/BUNKER.md`) | p50 dentro do quadro; **p95 registrado, não escondido** |
| CPU por tick | 32 corpos na sala (a medição da P91) | **sem regressão** — o cenário é estático |
| Memória | tamanho dos desenhos instanciados | **sem textura nova grande** (o contraexemplo são os `.glb` de 78 MB) |

**Evidência obrigatória no PR do cenário:** a bancada em `medicoes/` (no formato de `medicoes/BUNKER.md`) e as
capturas em `.decepticons/arte/`. **O julgamento visual é do dono** — eu não leio imagem.

## 5. Os testes (o que o CI pode provar)

1. **"Todo ponto de nascimento do mapa novo passa pela validação da física"** — folga de **3,4 m** para o maior Mech,
   fora de prédio e fora das zonas: o mesmo teste que a **P91** criou para os 36 pontos extras e os 16 dos aliados, e
   **que falha se um prédio for movido** sem refazer a lista.
2. **"Toda estação da rota é alcançável a pé"** (Rapier, Mech sem pulo) — o padrão do teste do Bunker.
3. **"Entre duas estações há duas rotas"** — a promessa da § 2 travada por grafo, não por olho.
4. **"O choke tem cobertura, e a cobertura é destrutível"** (`Destructibles`).
5. **"Cada estação tem uma zona de cura/resfriamento dentro do raio de parada"** (liga ao `combat/Zone.ts`).
6. **"As rampas sobem sem pulo"** — a lição do Bunker: colisor contínuo na rampa, degrau **só visual**.
7. **"Os colisores estáticos ficam abaixo de 310."**
8. **"O mapa é estático: nada de `new` por frame e nenhuma luz nova."**
9. **"A extração e a base são o mesmo ponto"** — é o que permite o contraataque sem mapa novo.
10. **"O mapa abre por `?mapa=cabos`"** — o `MapId` entra em `environment/Bunker.ts`, como os dois que já existem.

## 6. O que reusa, e o que é novo

| Peça | Já existe | Falta |
|---|---|---|
| Construtor de cenário | `environment/Arena.ts` (a Arena) e o construtor do Bunker | o da estação (**Codex**) |
| Barricadas destrutíveis | `environment/Destructibles.ts` | posicioná-las no choke |
| Zonas de cura e resfriamento | `combat/Zone.ts` (testado) | uma por estação |
| Validação de pontos | **P91**: `sim/nascimentos.ts` + o teste pela física | a lista do mapa novo |
| Lição de rampa | `medicoes/BUNKER.md` (colisor contínuo; degrau sem colisor) | aplicar |
| Registro do mapa | `MapId` e `mapFromSearch` (`environment/Bunker.ts`) | o id `cabos` |
| O console já aponta | `ui/theater.ts`: **ESTAÇÃO DE CABOS**, Fortaleza · CE, recurso `dados`, `proposta: false`, **sem `mapa`** | `mapa: 'cabos'` e os modos da missão |
| Rede | — | **nada**: cenário estático não gasta byte por tick |

**Conferido no código em 12/10/2026 (auditoria desta ficha):** `environment/Bunker.ts:7` — `export type MapId =
'arena' | 'bunker'` (é aqui que o `cabos` entra) — e `:9`, o `mapFromSearch`; `environment/Arena.ts:72` —
**`halfSize = 100`**, ou seja a Arena tem **200 m de ponta a ponta**, que é a régua desta ficha;
`sim/nascimentos.ts:82` — *"o Bunker tem **12 pontos** no total e o primeiro é do jogador: os outros **11** são de quem
nasce com ele"* — com `:83`, onde a capacidade do mapa sai dessa conta, e `:118`, *"**nenhum ponto serve a dois
corpos**"*, que é exatamente o que o teste 1 desta ficha exige do mapa novo. **Tudo confere.**

**Uma inconsistência achada de passagem (R17 — registrada, não corrigida: `ui/` é do Gemini):** o resumo do **Bunker**
no teatro do console diz **"Três andares de concreto e aço"**, mas o mapa tem **quatro pisos** (0/14/28/42 m —
`medicoes/BUNKER.md`) e o próprio seletor do jogo diz **"4 NÍVEIS"**. É uma palavra em `ui/theater.ts`; fica anotada
para quem tem o território — ou para a lista da **P94**, já que o Gemini está sem créditos.

## 7. Perguntas para o dono

1. **É este o primeiro cenário com rota?** (proposta: sim — é o único lugar já confirmado no `UNIVERSO.md`, e o console já o mostra no teatro.)
2. **O tamanho:** ~500 m de comprimento (2,5× a Arena) é o que você chama de "cenário maior", ou é mais — e aí entramos na **Fase 7**, que é a do streaming?
3. **Duas vias por trecho** (proposta) ou um corredor único, mais simples de desenhar?
4. **O mesmo mapa serve duas missões** — escolta na ida, contraataque na volta? (proposta: sim; economiza um cenário inteiro.)
5. **Fortaleza** (mar, cabos submarinos, instalação portuária): há alguma referência visual que você quer que o Codex siga?
6. **Ordem:** o cenário entra **antes** ou **depois** da missão #1 na Arena/Bunker? (a ficha da missão diz, de propósito, que ela **não** depende deste cenário)
7. **Nome:** "ESTAÇÃO DE CABOS" fica, ou o mapa ganha um nome próprio — como a Arena virou **CIDADE NEON**?
