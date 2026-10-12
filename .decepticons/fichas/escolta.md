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
- **Quem é o técnico:** o **ENTRÓPICO** já existe no jogo (`combat/TechnicianController.ts`): vai até o Mech
  mais avariado, **conserta ~8 de vida/s** com um feixe amarelo (parte arrancada não volta), **não atira**
  (`wantsToFire = false`) e, **sem avaria, escolta**. **Conferido no código em 12/10:** o controlador **já recebe a
  lista de quem ele conserta** (`new TechnicianController(mech, allies)`, `BotSystem.ts:257`) e é o `BotSystem` que
  aplica o conserto (`BotSystem.ts:522`). Hoje essa lista são **os Mechs rebeldes** — e o papel `t` existe **só do
  lado inimigo** (`sim/esquadrao.ts:99`, `PAPEIS_DO_LADO`; a lista de técnicos dos **aliados é `[]`**). Ou seja: a
  missão precisa de **um ajuste pequeno e localizado**, não de uma regra nova.
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
  dono na § 7, pergunta 3.
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
2. **"O técnico conserta o aliado mais avariado, e nunca o inimigo"** — o alvo sai da **lista que ele recebe**
   (`allies`): o teste alimenta as duas listas e prova que ele só toca a do mesmo lado. A regra de lado
   (`Match.sameSide`, `Match.ts:426`) é a que a P78 já usa no gelo e no anel de fogo.
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
| O técnico e o feixe | `combat/TechnicianController.ts`: anda até o mais avariado, foge a **16 m** (`FLEE_RADIUS`), volta a **24 m** (`SAFE_RADIUS`), escolta a **9 m** (`ESCORT_RANGE`), reavalia a cada **0,5 s**; **o conserto é aplicado pelo `BotSystem`** (`BotSystem.ts:522`) e o quanto conserta é `REPAIR_RATE × power.clans.technician.damage` — **dá para ajustar no painel de Potências** | **alimentar a lista com os aliados do jogador** (o controlador já conserta quem está na lista que recebe) |
| Técnico do nosso lado | o papel `t` existe, mas **só nos inimigos**: `sim/esquadrao.ts` — `PAPEIS_DO_LADO:99`, `tecnicos: []` nos aliados, teto de 2 técnicos no total | **é código, não configuração:** aceitar `t` nos aliados (uma linha em `PAPEIS_DO_LADO`, mais o limite e a fiação no `BotSystem`) — **do Claude**, porque `sim/` é o território dele |
| Prioridade de alvo | `GAME_DESIGN.md` § 3: "Técnico: **alvo prioritário**" | travar por teste dentro da missão |
| Aliados e times | `Match.sameSide` (P78) e os aliados da Arena offline | — |
| Zonas de cura e resfriamento | `combat/Zone.ts` (testado) | — |
| Briefing e HUD de objetivo | `ui/MissionHUD.ts` — **DEMO** (R13): testado isolado, com **dado de exemplo**. O contrato dele é **por onda** (`onWaveStart` / `onWaveProgress` / `onWaveClear` / `onMissionEnd`) | **o HUD da missão precisa de nomes próprios** (objetivo, fase, vida do técnico) e de ligação de verdade — **Gemini**, contra os nomes que esta ficha fixa |
| Cenário | Arena (200 m) e **Bunker** (4 níveis, 11 pontos de nascimento) | o mapa com rota (item `#cenarios` da P99) — **não é pré-requisito** |
| Rede | — | `OBJECTIVE_STATE` fica para o PR do online |
| Diretor de ataque | os inimigos já revezam em fila justa (máx. 2 atacando juntos) | a composição por fase (dados) |

**Conferido no código em 12/10/2026 (auditoria desta ficha, R17):** `combat/TechnicianController.ts` (as constantes
acima, os estados `escort | repair | flee` e `wantsToFire = false`); `combat/BotSystem.ts:257` (o controlador nasce com
a lista de quem conserta) e `:522` (o conserto é aplicado ao `repairTarget`); `sim/esquadrao.ts:99`
(`PAPEIS_DO_LADO`) e `:471` (os técnicos dos aliados são `[]`); `sim/Match.ts:426` (`sameSide`); `ui/MissionHUD.ts`
(contrato por onda). **Duas afirmações da primeira versão desta ficha estavam erradas** — *"a P91 já aceita técnico
aliado"* (não aceita: só inimigo) e *"escolher o alvo pelo lado"* (o alvo já vem de uma lista; o que falta é
alimentá-la do lado certo). Corrigidas acima, com o endereço de cada uma.

## 6. O que a tela mostra (o contrato do Gemini, na mesma ficha)

O `MissionHUD` de hoje é do modo Sobrevivência e o contrato dele é **por onda** (`onWaveStart`, `onWaveProgress`,
`onWaveClear`, `onMissionEnd`) — e está marcado **DEMO** (R13). A missão **não cabe nesses nomes**, então aqui está o
contrato dela: o **Claude emite**, o **Gemini desenha**, os dois contra a mesma tabela (regra 5).

| Quando | O dado (o Claude emite) | O que a tela mostra (o Gemini desenha) |
|---|---|---|
| Começa | `onMissionBriefing({ missao: 'tecnico', fases: 3, avarias: 3, tecnico: 'ENTRÓPICO', ameaca: n, extracao: [x,z] })` | O briefing (a casca já existe): o nome, o objetivo em **uma linha**, as fases, quantos inimigos vêm e a tecla de sair |
| Muda o objetivo | `onObjective({ avarias: 1, fases: 3, fase: 1, tecnicoVivo: true })` | **`AVARIAS 1/3` · `FASE 1/3`** — e **nada além disso**: abate não é objetivo desta missão |
| O técnico leva tiro | `onTechnicianHit({ vida: 0.4 })` | **A barra de vida do técnico** (é ela que decide a partida) e o aviso **TÉCNICO SOB ATAQUE** |
| O técnico está fora da tela | — (o jogo já tem a seta amarela dele) | A seta continua; entra o **marcador de objetivo** sobre ele — "é este que você protege" (o desenho é do Gemini) |
| Entra a extração | `onObjective({ fase: 3, extracao: [x,z], tecnicoVivo: true })` | O marcador da **extração**, no mundo e na borda, com a distância |
| Termina | `onMissionEnd({ venceu, avarias, fase, tecnicoVivo, tempoS })` | O **resumo**: as três avarias, a fase alcançada, o tempo e o **recorde** (a `QUIMICA_DO_JOGO.md` § 5 pede o recorde salvo) |

**Três regras que a tela da missão herda de graça:** **nenhum byte na rede** (é offline neste corte — o
`OBJECTIVE_STATE` é do PR do online); **nenhum DOM por quadro** (só quando o número muda; o `MissionHUD` de hoje já se
compromete com "±2 DOM writes/s"); e **nada de informação de desenvolvedor na tela** (`AUDITORIA_INTERFACE.md`: uma
ação primária por tela, nada repetido).

**A prova (é de contrato, não de olho):** o HUD da missão precisa de **teste próprio** — o mesmo `onObjective` duas
vezes seguidas **não** redesenha nada; **sem técnico vivo o resumo diz derrota**; e o resumo lê o **recorde salvo**,
não um número de tela.

**Como o Comandante confere:** jogar a missão e ver o painel (avarias e fase), o aviso quando o técnico apanha e o
resumo no fim — com o briefing saindo por tecla, como na Sobrevivência.

## 7. Perguntas para o dono

1. **Quem é "nosso" técnico na ficção?** O ENTRÓPICO é um técnico rebelde hoje. A missão defende um **técnico do nosso lado** (a mesma máquina, outro lado), ou o nome muda (um técnico SERAFIM)?
2. **Quantas fases?** Proponho três (uma avaria → duas → extração). Ele quer mais, ou a primeira já com as três avarias de uma vez?
3. **O jogador pode cair e voltar** sem perder a missão (proposta), ou a missão é uma tentativa só, sem respawn (como a Sobrevivência)?
4. **O técnico é consertável?** O jogador pode devolver vida a ele (zona de cura, ou o drone de conserto do `METAGAME.md` § 8), ou ele não se recupera — e a escolta é a defesa inteira?
5. **A extração** é um ponto novo do mapa ou um dos que já existem (a base, uma zona de cura)?
6. **Quando ela entra?** Esta é a "espinha da retenção" — ele quer **antes** do CTF online (P81) ou depois?
7. **Nome:** "O TÉCNICO"? (o jogo nomeia pelo que a coisa é: ARENA, BUNKER, ENTRÓPICO.)
