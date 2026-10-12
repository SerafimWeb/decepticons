# QUÍMICA DO JOGO — o que faz o piloto voltar amanhã

> **Ordem do Comandante (12/10):** *"melhorar a jogabilidade, a dopamina, a serotonina, a adrenalina, a oxitocina e a sensação de
> bem-estar, de cumprir missão, tarefas, com dificuldade suficiente pra instigar o jogador a tentar de novo, mudar configurações,
> customizar seus robôs… aproveitar conceitos, contextos e aprendizados dos outros games de sucesso (Minecraft, Fortnite, COD,
> Valorant, Battlefield, War Robots, Mech Arena, Doom) pra que o nosso jogo se torne ainda maior que os anteriores."*
>
> **O que isto é:** análise e plano, com o estado lido do código da `main` em 12/10. **O que isto não é:** escopo aprovado nem
> promessa de entrega. Nada entra sem a decisão do dono, e valem as regras de sempre: teste por regra (G14), nada que se compre
> ganha partida, e **nenhuma feature nova custa CPU no tick de 60 Hz** (G4/G5) nem byte de rede sem contrato.
>
> **Companheiro de:** `DIVERSAO.md` (a **ordem de prioridade** — este documento não repete a dela, e sim responde *por que ela
> funciona emocionalmente* e acrescenta o que falta), `GAME_DESIGN.md` (o que o jogo é), `VISAO.md` (o norte), `PLAYTEST.md`
> (como se mede) e `METAGAME.md` § 10 (o horizonte). Autor: Qwen.

---

## 1. A tese, e o que ela proíbe de fazer

O diferencial do CYBERMECH **não é catálogo, é consequência**: não importa só o que você tem, e sim **o que a sua escolha custa**
(calor, peso, perna quebrada, cobertura que sumiu). A química do jogo sai daí — de decisão com consequência **legível** —, não de
enfeite. Toda proposta deste documento passa pelo filtro do `DIVERSAO.md` § 3: **cria escolha?** · **torna a consequência
visível?** · **encurta o ciclo?**

**Aviso honesto (R13):** nenhuma métrica mede "dopamina" (o `PLAYTEST.md` já diz isso). Dá para projetar as **condições** que
produzem cada sensação e medir **proxies** (§ 7). Nada aqui é "coloca um botão e o jogador fica feliz".

---

## 2. As cinco químicas: o que já existe e onde dói

| Química | O que a produz no jogador | O que o CYBERMECH **já entrega** (`main`, 12/10) | O buraco |
|---|---|---|---|
| **Dopamina** (busca, novidade, "mais um") | recompensa imprevisível + progresso visível | marcador de acerto, parte destruída anunciada, kill feed, explodir a carcaça, dash encaixado | **o progresso de longo prazo não anda:** `addXp` só é chamado dentro de `claimReward` (`ui/DailyChallenges.ts:138`, revalidado hoje) — o nível **não sobe jogando**. A **sequência de abates** é item pendente do `ROADMAP` ("Aviso de ABATE e de sequência de abates, com som próprio (Gemini)") |
| **Serotonina** (status, maestria, "eu sou bom nisso") | prova durável de habilidade | painel do alvo (legibilidade), 3 dificuldades, bots com personalidade, o Colossus | **sem recorde** (o `waveReached` existe e chega ao HUD por `Game.ts:977`, mas nenhum melhor é salvo), **sem selo de maestria** por arma/chassi, **sem tabela pessoal** de estatísticas |
| **Adrenalina** (risco, urgência, o perigo sentido) | tensão com saída | calor que trava, partes que caem, borda de dano, dash, câmera de abate, boss da 6ª onda | é o eixo **mais bem servido**; falta apenas a leitura de "estou por um fio" (aviso claro de vida baixa) |
| **Oxitocina** (vínculo, pertencer, confiança) | jogar **com** alguém, e confiar nele | aliados offline com ordens (1/2/3), o técnico que conserta, rádio do clã dos bots, o combo gelo-amigo + anel de fogo | **o online é todos contra todos:** nenhum humano é aliado de outro (P81, aguardando ordem). Sem **ping de alvo**. Sem **reanimar/reparar** aliado |
| **Bem-estar / dever cumprido** (significado, começo-meio-fim) | um objetivo claro, com vitória e resumo | Sobrevivência (6 ondas, briefing, HUD, resumo e medalhas), CTF offline | **o deathmatch não tem objetivo** (só placar); **sem recibo da partida** (`DIVERSAO.md` § 7.2); missões em fases só no papel |

**Leitura:** adrenalina está pronta; dopamina e serotonina estão **travadas por bugs de progressão** (barato de consertar);
oxitocina e o "dever cumprido" dependem de **objetivo e de time** — que é exatamente o que o `DIVERSAO.md` § 10 já põe no topo.

---

## 3. Os dois eixos que atravessam tudo: **flow** e **agência**

O dono pediu duas coisas que não são uma química só, e sim o **jeito** como as cinco se entregam:

**Flow (dificuldade que ensina, não que pune).** Instigar a tentar de novo é manter o jogador na fronteira entre tédio e
frustração — nada de "mais HP" para "aumentar a dificuldade" (regra do `DIVERSAO.md` § 11). O que instiga a tentar de novo:
**quase consegui** (faltou uma perna), **entendi por quê** (o recibo), **sei o que mudar** (a montagem). O jogo já tem o
material: 3 dificuldades trocáveis na partida, bots com personalidade, o Colossus como encontro. Falta o **retorno de aprendizagem**
(o que me matou) e o **caminho de saída** (o que testar diferente).

**Agência (mudar as configurações e customizar o robô É a recompensa).** Autonomia é bem-estar (Deci & Ryan): quem escolhe
controla o próprio prazer. O CYBERMECH já é rico aqui — Hangar com carga e níveis, `?build=` para compartilhar a montagem,
Potências, sensibilidade/FOV/mira/brilho/teclas. O que falta é **tornar a agência visível e social**: um **código de build**
curto (`CM-V9-SNIPER`) e o **recibo** que carimba "esta foi a *sua* build" (§ 5, #2 e #10).

---

## 4. O que aprender de cada jogo — e o que **não** copiar

| Jogo | O que faz melhor | O que o CYBERMECH aproveita (com o que já tem) | O que **não** copiar |
|---|---|---|---|
| **Minecraft** | posse: o mundo é seu, "mais um bloco" | agência total no Hangar — a montagem salva, o `?build=` e o **código de build** (§ 5, #10) | o grind de coleta; aqui é partida, não mundo persistente |
| **Fortnite** | cadência de desafio + identidade visível | desafios diários (depois de consertados) e o **cosmético** (pintura/neon, nunca vantagem) | o passe e o **FOMO** de tempo limitado |
| **COD** | o *juice* do acerto e a progressão por arma (camo) | marcador, kill feed, explosão; falta a **sequência de abates** e a **maestria por arma** (§ 5, #4 e #5) | o TTK de um-tiro-uma-morte — ele apaga o calor e as partes, que são o melhor do jogo |
| **Valorant** | maestria + **identidade de agente** + informação de time | o painel do alvo, as dificuldades, o **ping de alvo** e o papel por chassi | a **ranqueada antes de ter gente** — escada vazia envenena a partida |
| **Battlefield** | **esquadrão**, escala, o caos que vira história | aliados com ordens, o Colossus, a câmera tática; a evolução é **times online** (P81, § 5 #6) | as salas de 64 e o veículo-muleta |
| **War Robots / Mech Arena** | **o loop do Hangar**: montar, sentir a diferença, subir de nível, evento | montagem + carga + MK I–III + Potências + a Oficina que prevê a luta | a **economia de recurso por tempo** (grind) e o **pay-to-win** |
| **Doom** | a fantasia de poder e a **agressão recompensada** | o pisão, o dash, arrancar peças; falta o **retorno da agressão** (§ 5, #11) | o ritmo de um só; aqui é multiplayer |

**A linha que não se cruza:** nenhuma referência justifica **pay-to-win, grind por tempo, FOMO ou TTK de um tiro**. O ativo do
projeto é o contrário disso (`GAME_DESIGN.md`, "não é pay-to-win").

---

## 5. As propostas (custo, dono, como conferir)

> O que já está na fila do `DIVERSAO.md` § 10 vem **marcado** com o número dele (não é proposta nova). As **novas** são as que o
> pedido de química acrescenta. Toda proposta diz o **custo de CPU e de rede** (R13: nada sem isso).

| # | Proposta | Química | Referência | Custo (CPU / rede) | Dono | Como conferir |
|---|---|---|---|---|---|---|
| 1 | **Consertar a progressão** (`addXp` por jogar; dar chamador a `trackWaveOrRound`, hoje órfão; dar chamador a `validateLoadout`) — `DIVERSAO.md` § 10 #2 | dopamina + serotonina | COD / Fortnite | CPU 0 · rede 0 (local) | **Gemini** (`ui/`) | jogar 3 partidas: o nível sobe **sem** resgatar missão |
| 2 | **Recibo da partida + cartão compartilhável** (precisão, partes destruídas, dano por calor, onda) — `DIVERSAO.md` § 10 #4 | bem-estar + serotonina + viral | COD (after-action) | CPU 0 · rede 0 | **Gemini + Claude** | fim de rodada mostra o recibo; um botão gera a imagem |
| 3 | **Recorde de onda e comemoração** (o `waveReached` já existe; falta salvar o melhor e celebrar) | **nova** — serotonina | Minecraft (marca pessoal) | CPU 0 · rede 0 (local) | **Gemini** | sobreviver até a onda 3: aparece "NOVO RECORDE" |
| 4 | **Aviso de sequência de abates** (2/3/4 abates em X s), com som — já é item pendente do `ROADMAP` | **nova** — dopamina + adrenalina | COD / Doom | CPU ~0 (1 linha de HUD) · rede 0 | **Gemini** | matar dois bots em 5 s: o aviso aparece |
| 5 | **Maestria por arma/chassi** (contador de abates por arma; selo ao cruzar um marco) | **nova** — serotonina | COD (camo) | CPU 0 · rede 0 | **Qwen (contrato) + Gemini (tela)** | o Hangar mostra o selo da arma com N abates |
| 6 | **Times na sala online** (o `Match.setTeam` já existe) — **P81** / `DIVERSAO.md` § 10 #3 e #5 | oxitocina | Battlefield / Valorant | CPU baixo · **protocolo novo** | **Claude** | dois navegadores na mesma sala, no mesmo time |
| 7 | **Marcador de alvo (ping)** — 1 tecla, 1 evento, 0 B/s — `DIVERSAO.md` § 10 #5 | oxitocina + estratégia | Valorant / Battlefield | CPU 0 · **1 evento** | **Claude + Gemini** | o time vê o ping no alvo marcado |
| 8 | **Missão em fases #1** (escolta/defesa do técnico ENTRÓPICO, reusa o que existe) — `DIVERSAO.md` § 10 #7 | bem-estar + oxitocina | Battlefield (objetivo) | regra no `Match` · 0 arte | **Claude + Gemini** | jogar a missão: objetivo claro, vitória e resumo |
| 9 | **Modificador semanal** (1 flag + 1 linha de HUD) — `DIVERSAO.md` § 10 #8 | dopamina (novidade) | Fortnite (rotação) | CPU 0 · rede 0 | **Claude + Gemini** | a HUD anuncia o modificador da semana |
| 10 | **Autonomia visível:** perfil de configurações salvo com nome, **código de build** curto e a dica "teste isto" depois de perder | **nova** — dopamina + bem-estar | Minecraft (posse) | CPU 0 · rede 0 (local) | **Gemini + Qwen** | salvar um perfil; ver a sugestão ao perder uma partida |
| 11 | **Agressão recompensada:** o abate **encostado** (pisão/serra) devolve um pouco de energia ou alivia calor | **nova** — adrenalina | Doom (*glory kill*) | **1 regra no `Match`** · rede 0 | **Claude** | o abate corpo a corpo devolve energia **e passa no `combat/balance.ts`** |

**Guardrails das novas:** #3, #5 e #10 são **locais** (não passam pelo fio, não custam rede) e **não dão vantagem** — são
memória e identidade. #11 é a única que **mexe em regra de combate**, então entra só se passar nas metas de equilíbrio (senão é
"combo que cura" desbalanceado, o que o § 11 do `DIVERSAO.md` proíbe na intenção).

---

## 6. A ordem (não substitui a do `DIVERSAO.md`)

A ordem do `DIVERSAO.md` § 10 permanece. Este documento **só acrescenta o porquê emocional** e **quatro itens novos** (3, 4, 5, 10)
que cabem **dentro** dela sem furar a fila:

- Os consertos de progressão (item 1) e o recorde (item 3) são **prerequisito emocional** de tudo o mais: sem eles, o jogador não
  sente que **avançou**, e nenhum conteúdo novo segura ninguém.
- A sequência de abates (item 4) e a maestria por arma (item 5) são **baratos** e moram no `ui/` — caem bem enquanto o Claude
  constrói os contratos das fases 1 a 5 do `PAINEL_ADMIN.md` § 8 (esquadrão, servidor, câmeras).
- O ping (item 7) e os times (item 6) são **a mesma frente** (P81): o ping só vale onde há time; fazer os dois juntos é metade do
  trabalho.
- A autonomia (item 10) fecha o pedido literal do dono ("mudar configurações, customizar robôs") e é 100% local.

---

## 7. Como saber se funcionou (medir, não achar)

Proxies que já existem ou são baratos de instrumentar (a telemetria do servidor já conta boot, partida e modo):

| Proxy | O que mede | Onde sai |
|---|---|---|
| **Rodadas por sessão** | o "mais um" (dopamina) | telemetria de início/fim de partida (já existe) |
| **Volta no dia seguinte (D1)** | retenção — **exige política de identificação entre sessões**, hoje não existe | a construir (§ 7 do `DIVERSAO.md`) |
| **Variedade de montagem** | se a decisão de build existe de verdade | painel de balanço (proposto, `ROADMAP` #negocio) |
| **Recorde de onda** | a escada pessoal (serotonina) | local (novo, item 3) |
| **Taxa de resgate de desafio** | se o desafio diário é alcançável e recompensador | `DailyChallenges` (após o conserto, item 1) |

**Sinal de que deu certo:** o jogador volta amanhã (meta da `VISAO.md`) e a **variedade de build sobe** — porque foi a build dele
que mudou o resultado.

---

## 8. Perguntas para o dono

1. **Autoriza os consertos da progressão (item 1) e o recorde (item 3) na frente do Gemini agora?** São bugs pequenos que
   destravam retenção que já deveria estar no ar.
2. **A agressão recompensada (item 11)** entra no teste de balanço ou fica de fora de propósito?
3. **Cosmético (pintura/neon):** entra **local** (sem conta, só no aparelho) antes da loja, ou espera as contas?
4. **O modificador semanal (item 9)** pode ser o **primeiro evento público** do jogo?
5. **Times online (P81):** autoriza começar? É o que faz a oxitocina existir no multiplayer — e o que destrava o seu combo do
   anel de fogo com o gelo do amigo.

---

## 9. O que **não** fazer (guardrails)

- **Nada de FOMO** (evento com prazo que some), **nada de grind por tempo** (economia que só o tempo paga), **nada de pay-to-win**.
- **Nada de TTK de um tiro:** apaga a negociação (calor + partes), que é o que o jogo tem de melhor.
- **Não inflar vida/dano** para "aumentar a dificuldade" — dificuldade é outro chassi e outro objetivo, não mais HP.
- **Não publicar número que não sai do código** (a credibilidade do case é o ativo, política das páginas públicas).
- **Não abrir ranqueada nem loja** antes de haver gente voltando.

> **Uma frase:** a química do CYBERMECH não vem de mais um botão, e sim de **fechar os ciclos que já existem** (o nível que não
> sobe, o recorde que não é salvo, o objetivo que falta) e de **mostrar o que o jogador fez** (o recibo, o selo, a build dele) —
> porque quem vê a própria marca quer voltar para melhorá-la.
