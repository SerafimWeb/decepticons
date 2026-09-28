# FICHA · ONDAS (modo sobrevivência)

> **Status:** proposta · **Autor:** Qwen (a pedido do dono, 27/09/2026, pelo pedido do Gemini: "crie a ficha de
> balanço das Ondas — quantidade de inimigos e vida por onda") · **Data:** 2026-09-27
> **O que esta ficha é:** o **balanço** do modo sobrevivência — quantos inimigos por onda, de que tipo, com quanta
> vida e com quantos atacando ao mesmo tempo. Não é a máquina de estados (Claude, `sim/Match.ts`), nem o HUD
> (Gemini, `ui/MissionHUD.ts`), nem o visual (Codex).
> **O que o dono já decidiu** (`ROADMAP.md`, Fase 5): "ondas de inimigos **crescentes** (andróides, Mechs rebeldes,
> 'pessoas'), mapa vivo com setores que fecham, **solo ou cooperativo**; **a cada onda a IA fica mais agressiva e
> nova**; **termina quando o piloto cai**. Tela de briefing, HUD de onda, resumo final com estatísticas."
> Onde eu não sei, está `?` — melhor uma pergunta do que um número inventado.

## 1. Identidade em uma frase
O modo em que o piloto **não tem placar a favor**: ele segura o máximo de ondas até cair. A onda não é um enxame, é
uma **fila com pressão crescente** — o que muda de uma onda para a outra é quantos ainda faltam, que tipo entrou na
fila e quantos atacam juntos.

## 2. O que a onda pode e não pode fazer (as regras do motor)

Três tetos do jogo de hoje mandam no desenho, e ignorá-los daria um modo que não roda:

| Teto | De onde vem | O que isso obriga na onda |
|---|---|---|
| **3 Mechs e 3 andróides na arena, no máximo** | `LIMITS` de `core/Settings.ts` (`enemyMechs` 0–3, `enemyAndroids` 0–3) | a onda **não** pode nascer cheia: ela é uma **fila** que repõe conforme os corpos caem |
| **No máximo 4 atacando ao mesmo tempo** | `maxAttackers` (0,5–4; padrão 2) | a dificuldade cresce por **simultaneidade** (de 1 a 4), nunca por todos de uma vez |
| **32 unidades por sala, id de 1 byte** | `MAX_UNITS` (`shared/net/constants.ts`) | onda grande **reaproveita id** de quem morreu; nada de guardar cadáver na lista |

**Consequência de desenho, e é a regra nº 1 desta ficha: a onda é uma fila com teto de corpos vivos.** O total da
onda é grande; o que está na arena ao mesmo tempo é pequeno. É o que mantém o custo de CPU e de rede igual ao da
partida normal (§ 6).

## 3. A tabela de balanço (proposta)

Números de referência: **andróide rebelde** = 32 de torso (`chassis.ts`), cai em 2 tiros de plasma MK I;
**Mech rebelde** = chassi do Vector-09, 300 de torso; **técnico** = o andróide de apoio que conserta Mech. "Vida
total" é a soma dos torsos da onda — é o número que o `balance.timeToKill` da oficina consegue medir.

| Onda | Andróides | Mechs | Técnico | Atacam juntos | Vida total | Duração alvo (a calibrar) | Ameaça no HUD |
|---|---|---|---|---|---|---|---|
| 1 | 3 | — | — | 1 | 96 | 25–35 s | BAIXO |
| 2 | 4 | — | — | 1 | 128 | 30–40 s | BAIXO |
| 3 | 5 | — | — | 2 | 160 | 35–50 s | MÉDIO |
| 4 | 6 | 1 | — | 2 | 492 | 50–65 s | MÉDIO |
| 5 | 8 | 1 | sim | 2 | 556 | 60–75 s | MÉDIO |
| 6 | 9 | 1 | sim | 3 | 588 | 65–80 s | ALTO |
| 7 | 10 | 2 | sim | 3 | 920 | 80–100 s | ALTO |
| 8 | 12 | 2 | sim | 3 | 984 | 85–105 s | ALTO |
| 9 | 13 | 2 | sim | 4 | 1 016 | 90–110 s | ALTO |
| 10 | 14 | 3 | sim | 4 | 1 348 | 110–140 s | CRÍTICO |
| 11 | 16 | 3 | sim | 4 | 1 412 | 115–145 s | CRÍTICO |
| 12+ | +2 por onda (teto de 16 na fila) | 3 | sim | 4 | — | — | CRÍTICO |

**Como ler a curva:** as três alavancas entram nesta ordem, e cada uma tem o seu momento — (1) **fila maior** nas
ondas 1–3, (2) **mistura** (o primeiro Mech) na onda 4 e o segundo na 7, (3) **simultaneidade** (2 → 3 → 4 atacando
juntos) nas ondas 3, 6 e 9. O técnico entra na 5, quando já existe Mech para consertar. **Nada disso aumenta a vida
de um inimigo** (§ 4).

**Ritmo pretendido:** a onda 1 é tutorial; a 5 é o primeiro marco do HUD (a medalha de sobrevivência já usa
`waveReached >= 5`); a 10 é onde a maioria deve cair; um piloto bom chega à 10–12 em **12–18 min**. A duração alvo é
`?` de propósito: quem mede o relógio é o Claude, na simulação (a oficina já tem `drill` e `timeToKill` para isso) —
o número que entra no código é o que ele medir, e a ficha é corrigida para bater com o código.

## 4. "Vida por onda": o que cresce e o que **não** cresce

- **Cresce:** a **vida total** da onda (soma dos torsos) e a **pressão** (simultaneidade + mistura). A vida *por
  inimigo* é fixa: andróide 32, Mech 300.
- **Não cresce:** **nenhum inimigo recebe multiplicador de vida.** Inflar a vida de quem já existe quebra as metas de
  dano por parte que o jogo todo respeita ("um andróide cai em 2 tiros de plasma") e transforma a leitura da luta em
  aritmética: o jogador deixa de saber que dois tiros derrubam. Se um dia precisar de inimigo mais duro, o caminho é
  **chassi novo** (Ferret-X, Colossus-01 — `ROADMAP`, Fase 5), com ficha própria, e não um `×1,5` invisível.
- **Agressividade sobe com a onda** (decisão do dono no ROADMAP: "a cada onda a IA fica mais agressiva e nova"): isso
  é do diretor de ataque (precisão, tempo de reação, quantos atacam juntos) — **não** é vida, e sim as mesmas
  alavancas que o `EnemySettings` já expõe.

## 5. Metas de equilíbrio (cada uma vira um teste)

1. **"A onda 1 não usa Mech."** A rampa começa em andróide: quem nunca jogou precisa da primeira vitória.
2. **"Nenhuma onda passa dos tetos do motor":** ≤ 3 Mechs e ≤ 3 andróides vivos, ≤ 4 atacando juntos, ≤ `MAX_UNITS`.
3. **"Onda limpa exige fila vazia":** `onWaveClear` só dispara com o contador zerado **e** nenhum spawn pendente —
   nunca com um inimigo morto ainda na fila de reposição.
4. **"O total da onda é a soma exata dos corpos":** o `totalEnemies` que o HUD recebe bate com quantos nascem na
   onda (nem a mais, nem a menos).
5. **"A vida por inimigo não muda com a onda":** na onda 1 e na 11, um andróide cai em 2 tiros de plasma MK I e um
   Mech rebelde tem 300 de torso. (É o teste que proíbe o `×1,5` invisível.)
6. **"O técnico conserta, não ressuscita":** nenhum inimigo morto volta — senão a onda nunca fecha.
7. **"A onda é determinística":** mesma semente → mesma fila, mesma ordem de nascimento, mesmos pontos de entrada.
8. **"A pausa entre ondas dá tempo de usar a zona de cura":** o intervalo é ≥ o tempo de recuperar a parte mais
   avariada na zona (senão a pausa não serve para nada e o modo vira sorte).
9. **"Nenhuma onda lê relógio real nem sorteio":** tudo por tick e por `rng.ts` (G1/G2).
10. **"O modo termina quando o piloto cai"** (decisão do dono): `onMissionEnd` recebe `survived: false` no abate do
    jogador, com a onda alcançada — sem vidas extras, sem respawn.
11. **"A onda não custa caro na rede":** nascer/morrer por evento (`SPAWN`/`KILL` já existem), nenhum campo novo no
    estado de 20 Hz (`shared/net/state.ts`), e a sala online não estoura com a onda em andamento.
12. **"Sem alocação por tick"** (G4): a fila é pré-alocada no começo da onda; repor um corpo não cria objeto.

## 6. Custo de CPU e rede
- **CPU:** o custo de uma onda é o custo dos corpos **vivos**, e o teto de vivos é o de hoje (6 + técnico). O que
  muda entre a onda 1 e a 11 é a **duração**, não o tamanho da cena. O spawner é um índice na fila; repor corpo =
  reusar o id que morreu (`MAX_UNITS` manda nisso).
- **Rede:** **0 B/s de estado novo.** Nascimento e morte já são eventos; o HUD de onda recebe os callbacks
  (`onWaveStart`/`onWaveProgress`/`onWaveClear`/`onMissionEnd`) com primitivos, como o contrato do MissionHUD já
  exige. Em cooperativo futuro, o placar da onda é evento, não campo por tick.
- **Render:** sem inimigo novo, sem malha nova — a onda é composição, e o teto de draw calls não muda.

## 7. Interface (o contrato que já existe)
O `ui/MissionHUD.ts` (Gemini) já traz as bandas de ameaça por onda — **1–2 BAIXO, 3–5 MÉDIO, 6–9 ALTO, 10+ CRÍTICO** —
e as medalhas por `waveReached >= 3` e `>= 5`. A tabela da § 3 foi montada **para caber nessas bandas**: se a curva
mudar, ou muda a tabela, ou muda o `threatLevel` do HUD — as duas coisas não podem divergir em silêncio.
**Falta do lado da interface (pedido do dono já em curso):** seletor de modo, sons de onda, medalhas e o resumo final.

## 8. Divisão
- **Claude:** a máquina de estados em `sim/Match.ts` (fila, spawner progressivo, contador, callbacks) — o pedido do
  Gemini já está com ele. Os números desta ficha entram como **dados** (uma tabela por onda), não espalhados em `if`s.
- **Gemini:** HUD de onda, briefing, resumo final, som e medalhas (já em curso).
- **Codex:** a entrada dos bots no cenário (cápsula/portão/descida) e o "mapa vivo com setores que fecham".
- **Qwen:** esta ficha, as metas acima (que viram teste) e a revisão de balanço depois de o modo existir.

## 9. Perguntas para o dono
1. **Sobrevivência é solo ou cooperativo no primeiro corte?** (O ROADMAP diz "solo ou cooperativo"; se for solo, a
   tabela acima vale como está; em co-op, cada jogador extra soma ~60% de uma onda, e a conta muda.)
2. **A pausa entre ondas tem relógio** (ex.: 10 s e começa sozinha) **ou termina quando o jogador mandar** (aperta
   para chamar a próxima)? A segunda dá tempo de usar a zona de cura, mas some com a tensão.
3. **A onda pode nascer atrás do jogador** (os inimigos entram por pontos fixos do mapa) **ou só em pontos que ele
   vê**? Muda a sensação de "hordas" — e as "pessoas" do ROADMAP precisam de um lugar para vir.
4. **"Setores que fecham"** é meta do primeiro corte ou da segunda onda de trabalho? (Hoje não existe mapa com
   setores; sem isso, o "mapa vivo" fica de fora da ficha.)
5. **A vida por onda fica fixa como está na § 4** (cresce a fila e a pressão, nunca a vida de um inimigo)? Se quiser
   inimigo mais duro por onda, eu prefiro um chassi novo a um multiplicador — mas a decisão é sua.
6. **Placar final:** o que entra no resumo (`onMissionEnd`)? Abates, ondas, tempo, dano causado/recebido, precisão —
   qual desses o dono quer ver e qual vira "número de vaidade"?
7. **XP/nível (painel de Desafios e Progresso, do Gemini)** premia chegar à onda N? Se sim, esta ficha passa a
   alimentar a progressão, e a curva precisa ser estável antes de virar XP.
