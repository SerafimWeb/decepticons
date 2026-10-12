# FICHA · MISSÃO EM FASES #1 — "O TÉCNICO" (escolta e defesa)

> **Status:** proposta · **Autora:** Qwen (ficha) · **Atualização:** 2026-10-12 · **Etiqueta:** `#modos`
> **O que esta ficha é:** a regra canônica da **primeira missão em fases** e a matriz de testes — o **contrato** que o
> Claude (regra no `Match`) e o Gemini (briefing, HUD de objetivo e resumo) executam contra o mesmo papel (regra 5 do
> `AGENTS.md`: contrato antes de paralelizar).
> **Por que esta missão, e por que primeiro:** o dono a escolheu por ela **reusar o que já está no jogo**
> (`DIVERSAO.md` § 10 #7 — "a espinha da retenção, regra + HUD, sem arte nova"). A ordem **P99** (12/10) nomeou os
> quatro tipos de missão (escolta, ataque, defesa de base, **contraataque**) e pediu **cenários maiores** — esta ficha
> começa pela **escolta**, que é a que menos precisa de cenário novo.
> **Nota de franqueza (R13):** o `MissionHUD` está marcado **DEMO** hoje (testado isolado, com dado de exemplo nas
> teclas M/B). A ficha abaixo é o que falta para ele deixar de ser demonstração.

## 1. Por que a ficha vem antes da regra

Os testes de uma missão não podem nascer antes da regra (G14 e a regra 5 dizem a mesma coisa por dois ângulos): o
`it()` nasce **no PR que cria a regra**, contra o contrato já fixado. O que esta ficha entrega é **a especificação de
cada teste** — o nome, o que ele monta e o que prova — para o Claude implementar regra e teste no **mesmo PR**, e o
Gemini ligar o briefing e o HUD **contra os mesmos nomes de objetivo**.

## 2. As regras (o que a missão faz)

- **O objetivo:** manter o **técnico de pé** enquanto ele **conserta três avarias** (três Mechs aliados avariados), e
  depois **levá-lo à extração**.
- **Quem é o técnico:** o **ENTRÓPICO** já existe no jogo (`combat/TechnicianController.ts`, 5 testes): vai até o Mech
  mais avariado, **conserta 8 de vida/s** com um feixe amarelo (parte arrancada não volta), **não atira**, e **sem
  avaria, escolta**. Hoje ele é do lado rebelde; na missão ele é **nosso** — e a **P91 já aceita técnico aliado** (o
  esquadrão tem o papel `t` nos dois lados).
- **A tensão sai de graça:** o técnico **já é "alvo prioritário"** (`GAME_DESIGN.md` § 3 — os inimigos o caçam) e é
  **escala 1** (fraco: é um andróide). Escoltar é proteger exatamente o alvo que a IA prefere.
- **As três fases (a escada crescente):**
  1. **Uma avaria, dois inimigos** — ensina a regra: o técnico vai, o jogador cobre.
  2. **Duas avarias e pressão** — os inimigos entram pelo caminho e mirando o técnico; a zona de cura passa a importar.
  3. **A extração** — três avarias, o dobro de inimigos, e o técnico tem de **chegar ao ponto de extração** (e ele
     **foge com dash** quando o inimigo chega perto, como já faz hoje).
- **Ganha:** as três avarias consertadas **e** o técnico na extração.
- **Perde:** o **técnico cai** (ele não renasce nesta missão) ou o tempo acaba.
- **O jogador caindo:** a missão **continua** (respawn na mesma partida) — quem decide é o técnico. Confirmação do
  dono na § 6, pergunta 3.
- **Cenário:** Arena (200 m) na fase 1 e **Bunker** (4 níveis, 11 pontos) nas fases 2 e 3 — a escolta "para cima" é o
  caminho. O **mapa de missão com rota** (item `#cenarios` da P99) **não é pré-requisito** deste corte.

## 3. O que isso custa (banda e CPU)

- **Offline primeiro**, como o CTF e a Sobrevivência: **zero byte na rede**. O `OBJECTIVE_STATE` que o `ROADMAP` pede
  entra no PR do **online**, não neste.
- **CPU por tick: nenhuma a mais.** O estado da missão (consertos, técnico vivo, fase) é conferido no pulso lento das
  outras regras de missão (0,25 s), **sem alocação** (G4).
- **O que o técnico custa** é o que ele já custa: ele já roda na partida (é uma unidade do diretor de ataque).
- **Arte nova: nenhuma.** Feixe, visor e seta amarela do técnico já existem.

## 4. Os testes (cada linha é um `it()`)

1. **"A missão não começa sem um técnico do lado do jogador"** (contrato).
2. **"O técnico conserta o aliado mais avariado, e nunca o inimigo"** — ele passa a escolher o alvo pela mesma regra
   de lado (`Match.sameSide`) que a P78 já usa no gelo e no anel de fogo.
3. **"Cada avaria completa conta uma, e só uma"** — nem duas pelo mesmo alvo, nem uma por pulso de conserto.
4. **"Com as três avarias consertadas a missão não termina"** — ela passa para a **extração** (o objetivo é a saída).
5. **"O técnico chegando à extração com o objetivo cumprido encerra a missão em vitória"**, e o fim diz
   `mission: 'tecnico'`, `fase: 3`.
6. **"O técnico morto encerra a missão em derrota, mesmo com as três avarias consertadas."**
7. **"O jogador morto não encerra a missão"** (respawn; quem decide é o técnico).
8. **"A fase 2 começa quando a primeira avaria termina"** — a escada é do contrato, não do HUD.
9. **"Os inimigos da missão preferem o técnico"** — a prioridade já está em `GAME_DESIGN.md` § 3; o teste a trava.
10. **"Tempo esgotado com objetivo incompleto é derrota"** (o tempo é declarado no contrato).
11. **"Zero bytes novos no estado de 20 Hz"** — teste de orçamento em `shared/net`, junto dos que já existem.
12. **"É determinístico"**: mesma semente e mesmos inputs → mesmos instantes de conserto, de fase e de fim.
13. **"O técnico não atira e não ganha arma"** — é o que faz a escolta ter sentido.

## 5. O que já existe (o reuso, item por item)

| Peça da missão | O que já está no jogo | O que falta |
|---|---|---|
| O técnico e o feixe | `combat/TechnicianController.ts` — 5 testes: anda até o mais avariado, 8 de vida/s, foge a 16 m, volta a 24 m, escolta sem avaria | escolher o alvo **pelo lado** (aliado) |
| Técnico do nosso lado | **P91**: o esquadrão aceita o papel `t` nos dois lados | nada (é configuração) |
| Prioridade de alvo | `GAME_DESIGN.md` § 3: "Técnico: **alvo prioritário**" | travar por teste dentro da missão |
| Aliados e times | `Match.sameSide` (P78) e os aliados da Arena offline | — |
| Zonas de cura e resfriamento | `combat/Zone.ts` (testado) | — |
| Briefing e HUD de objetivo | `ui/MissionHUD.ts` — **DEMO** (R13): testado isolado, com **dado de exemplo** | **ligar o HUD à missão de verdade** (Gemini) |
| Cenário | Arena (200 m) e **Bunker** (4 níveis, 11 pontos de nascimento) | o mapa com rota (item `#cenarios` da P99) — **não é pré-requisito** |
| Rede | — | `OBJECTIVE_STATE` fica para o PR do online |
| Diretor de ataque | os inimigos já revezam em fila justa (máx. 2 atacando juntos) | a composição por fase (dados) |

## 6. Perguntas para o dono

1. **Quem é "nosso" técnico na ficção?** O ENTRÓPICO é um técnico rebelde hoje. A missão defende um **técnico do nosso lado** (a mesma máquina, outro lado), ou o nome muda (um técnico SERAFIM)?
2. **Quantas fases?** Proponho três (uma avaria → duas → extração). Ele quer mais, ou a primeira já com as três avarias de uma vez?
3. **O jogador pode cair e voltar** sem perder a missão (proposta), ou a missão é uma tentativa só, sem respawn (como a Sobrevivência)?
4. **O técnico é consertável?** O jogador pode devolver vida a ele (zona de cura, ou o drone de conserto do `METAGAME.md` § 8), ou ele não se recupera — e a escolta é a defesa inteira?
5. **A extração** é um ponto novo do mapa ou um dos que já existem (a base, uma zona de cura)?
6. **Quando ela entra?** Esta é a "espinha da retenção" — ele quer **antes** do CTF online (P81) ou depois?
7. **Nome:** "O TÉCNICO"? (o jogo nomeia pelo que a coisa é: ARENA, BUNKER, ENTRÓPICO.)
