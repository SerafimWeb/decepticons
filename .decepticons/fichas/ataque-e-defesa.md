# FICHA · MISSÕES EM FASES — ATAQUE e DEFESA DE BASE (e o contraataque, no fim da defesa)

> **Status:** proposta · **Autora:** Qwen (ficha) · **Atualização:** 2026-10-12 · **Etiqueta:** `#modos`
> **O que esta ficha é:** a regra canônica das **duas missões que faltavam** dos quatro tipos que a ordem **P99** nomeou —
> **ataque** e **defesa de base** — mais o **contraataque**, que não precisa de missão própria: ele **nasce no fim da
> defesa** (perder a base e retomar é a mesma missão virada ao contrário).
> **As outras duas já têm papel:** a **escolta** em `fichas/escolta.md` (com o contrato de tela) e o **cenário** em
> `fichas/cenario-cabos.md` — onde a **extração da escolta é a base da defesa** (um cenário, duas missões).
> **O contrato:** o **Claude** faz a regra no `Match` e os testes; o **Gemini**, o briefing e o HUD; o **Codex**, o
> cenário. Esta ficha é o papel comum (regra 5 do `AGENTS.md`: contrato antes de paralelizar).
> **Franqueza (R13):** **nada disto existe hoje**, e o `MissionHUD` segue **DEMO**.

## 1. Por que a ficha vem antes da regra

Pela mesma razão da ficha da escolta: os `it()` nascem **no PR que cria a regra**, e duas pessoas (ou dois agentes)
construindo em paralelo precisam do mesmo papel. Aqui há um agravante: estas duas missões **compartilham o núcleo** —
mudar o "núcleo" (vida, raio de posse, tempo de posse) mexe nas duas, então a decisão tem de estar escrita **antes**,
não descoberta no meio.

## 2. As regras

### 2.1 ATAQUE — tomar o que o inimigo segura

- **O objetivo:** **derrubar o núcleo** de uma instalação inimiga e **segurar a posse** dele por **20 s**.
- **Três fases:**
  1. **As defesas externas:** barricadas e torres **destrutíveis** (`environment/Destructibles.ts`, já existentes) —
     não precisam cair todas; elas existem para custar tempo e posição.
  2. **O núcleo:** uma estrutura com **vida própria** (um número no contrato, não uma parte de Mech), derrubada por
     fogo concentrado. Enquanto está de pé, ele **atira** (uma torre de defesa).
  3. **A posse:** com o núcleo caído, alguém do **nosso lado** tem de **ficar dentro do raio** por **20 s
     corridos**; inimigo dentro do raio **pausa** a contagem (não reinicia — reiniciar é punição demais para 2 s de
     invasão). Vale **jogador ou aliado** — é o que faz o esquadrão (P91) valer.
- **Ganha:** o núcleo cai **e** a posse completa. **Perde:** o tempo total acaba.
- **O contra-jogo:** o **diretor de ataque que já existe** manda ondas para **entrar no raio** e retomar.

### 2.2 DEFESA DE BASE — segurar; se cair, retomar

- **O objetivo:** manter o **nosso núcleo** de pé por **N ondas**.
- **Estágios:**
  1. **Preparação (15 s):** o jogador se posiciona. As barricadas são **as do cenário** (já colocadas) — não há
     construção em partida (isso seria outro jogo).
  2. **As ondas:** o **diretor de ondas** (`sim/SurvivalWaves.ts`, com o orçamento de 1 a 2,5 atacantes simultâneos e a
     fila justa) manda atacantes cujo **alvo preferido é o núcleo** — quem passa pela defesa vai nele.
  3. **Se o núcleo cai, a missão não acaba:** ela vira **contraataque** — retomar o raio (a **mesma regra de posse do
     ataque**) enquanto as ondas continuam. **É o quarto tipo que o Comandante pediu, e ele sai de graça.**
  4. **O chefe:** na última onda, o **Colossus-01** — como na Sobrevivência.
- **Ganha:** as N ondas vencidas com o núcleo **de pé ou retomado**. **Perde:** o núcleo cai **e** a retomada não
  acontece dentro do tempo do contraataque.
- **O que reusa, e é quase tudo:** o **diretor de ondas**, a **zona de cura/resfriamento** (`combat/Zone.ts`), os
  **destrutíveis**, o **esquadrão** (P91) — e, aqui, o **técnico** ganha função de verdade: ele conserta o núcleo? (ver
  § 7, pergunta 2).

## 3. O que isso custa (banda e CPU)

- **Offline primeiro**, como as outras três: **zero byte de rede** neste corte (o `OBJECTIVE_STATE` é do PR do online).
- **CPU por tick: nenhuma a mais.** O núcleo é uma **estrutura estática com vida**; a conferência (núcleo vivo, quem
  está no raio, tempo de posse, onda atual) roda no **pulso lento** das outras regras de missão (0,25 s), sem alocação
  (G4). O que atira é a torre, que é uma unidade como as que já existem.
- **Arte nova: nenhuma.** O cenário da `fichas/cenario-cabos.md` já traz a base, e os destrutíveis já existem.

## 4. Os testes (cada linha é um `it()`)

1. **"A missão de ataque não começa sem núcleo"** (contrato).
2. **"O núcleo tem vida própria e só cai por dano"** — e a vida dele **não** é uma parte de Mech (o dano por parte não
   se aplica a estrutura).
3. **"A torre do núcleo atira enquanto ele está de pé, e para quando cai."**
4. **"Só a posse do nosso lado conta"** — inimigo dentro do raio **pausa** a contagem, e a contagem **retoma** quando
   ele sai (não reinicia).
5. **"Aliado conta como posse":** com o jogador morto e um aliado no raio, a posse continua.
6. **"A posse completa encerra a missão em vitória"** e o fim diz `mission: 'ataque'`, `fase: 3`.
7. **"Tempo esgotado com o núcleo de pé é derrota"** (declarado no contrato).
8. **"A defesa começa com 15 s de preparação e o diretor só solta a onda 1 depois."**
9. **"Na defesa, o alvo preferido dos atacantes é o núcleo"** — e eles só atacam o jogador quando ele está no caminho.
10. **"O núcleo caído não encerra a defesa: a missão muda para contraataque"** — o HUD e o estado dizem
    `fase: 'contraataque'`.
11. **"A retomada usa a mesma regra de posse do ataque"** — o mesmo código, provado uma vez.
12. **"A defesa é vencida com o núcleo de pé; o contraataque é vencido retomando dentro do tempo."**
13. **"O Colossus entra na última onda"** (a mesma regra da Sobrevivência, provada de novo na missão).
14. **"Zero bytes novos no estado de 20 Hz"** (`shared/net`, junto dos testes de orçamento).
15. **"É determinístico"**: mesma semente e mesmos inputs → mesmos instantes de queda, posse, onda e fim.

## 5. O que já existe, e o que falta

| Peça | Já existe | Falta |
|---|---|---|
| Diretor de ondas | `sim/SurvivalWaves.ts` (orçamento, fila justa, o Colossus na última onda) | o alvo preferido ser o **núcleo** |
| Destrutíveis | `environment/Destructibles.ts` | posicioná-los na base (no cenário) |
| Zona de cura/resfriamento | `combat/Zone.ts` (testada) | uma junto ao núcleo |
| Esquadrão | **P91** (até 24 inimigos e 12 aliados, técnico incluído) | — |
| O cenário com a base | `fichas/cenario-cabos.md` (proposta: a extração da escolta é a base) | construí-lo (**Codex**) |
| O núcleo (estrutura com vida) | — | **é a peça nova desta ficha** (uma estrutura estática com vida, raio e tempo) |
| O briefing e o HUD | `ui/MissionHUD.ts` — **DEMO** | os nomes desta ficha (§ 6) |
| A rede | — | `OBJECTIVE_STATE` no PR do online |

## 6. O que a tela mostra (o contrato, no formato da ficha da escolta)

Os mesmos nomes da escolta, com **três campos a mais** — porque aqui o que se defende é uma **coisa**, não uma pessoa:

| Quando | O dado (o Claude emite) | O que a tela mostra (o Gemini desenha) |
|---|---|---|
| Começa | `onMissionBriefing({ missao: 'ataque' \| 'defesa', ondas: n, nucleo: { vida, raio }, preparacaoS })` | o nome, o objetivo em uma linha, as ondas e a barra do **núcleo** |
| Muda o núcleo | `onObjective({ nucleoVida: 0.6, segurandoS: 12, fase: 'posse' })` | **a barra do núcleo** e, na posse, **`SEGURANDO 12/20 s`** — em números, porque é um relógio |
| O inimigo entra no raio | `onObjective({ segurandoS: 7, pausado: true })` | **`PAUSADO`** — e o número **parado**, não sumindo |
| A onda troca | `onObjective({ onda: 3, de: 4 })` | `ONDA 3/4` |
| O núcleo cai (defesa) | `onObjective({ fase: 'contraataque', segurandoS: 0 })` | **`NÚCLEO CAIU — RETOME`**, em vermelho, com o tempo do contraataque |
| Termina | `onMissionEnd({ venceu, missao, ondas, nucleoVivo, retomado, tempoS })` | o resumo: as ondas, se retomou, e o **recorde** |

**A prova:** teste de contrato como o da escolta — o mesmo `onObjective` duas vezes **não** redesenha; o número de
posse **para** quando pausa e **não volta a zero**; sem núcleo vivo e sem retomada, o resumo diz **derrota**.

## 7. Perguntas para o dono

1. **O núcleo tem vida própria** (um número: ex. 2 000) **ou partes** como um Mech (pernas, torso)? A vida própria é
   mais simples e não colide com o dano por parte; as partes dão o "desmontar" que o jogo já tem.
2. **O técnico conserta o núcleo?** Se sim, a defesa ganha o papel de **proteção** do técnico (como a escolta) — e o
   jogo ganha a tríade: núcleo, técnico e o (cada vez mais) problema.
3. **Quantas ondas na defesa, e quanto tempo de posse no ataque?** Proponho **4 ondas** e **20 s**; os dois números são
   a régua da dificuldade (mais ondas, mais tempo).
4. **O ataque tem torre que atira?** Proponho **uma** (custa ao jogador se aproximar de frente e valoriza o flanco) —
   ou o núcleo é indefeso e o desafio é só a posse?
5. **Onde ficam estas missões?** Na **base da ESTAÇÃO DE CABOS** (o cenário da outra ficha) ou reusando a **Arena**
   com uma base improvisada (mais barato, menos crível)?
6. **Ordem:** qual entra primeiro — a **escolta** (já especificada, sem cenário novo) ou a **defesa** (que precisa da
   base)? A minha leitura é escolta primeiro, defesa na sequência.
7. **Nome das missões:** "ATAQUE" e "DEFESA" bastam, ou elas ganham nome de lugar como as outras (CIDADE NEON, BUNKER,
   ESTAÇÃO DE CABOS)?
