# VISÃO — CYBERMECH

> A visão de longo prazo declarada pelo dono. Não é ROADMAP (que lista tarefas e prazos): é o **norte**, para os agentes decidirem em favor do que aproxima disto e recusarem o que se afasta.
> Editada só pelo dono, ou por um agente com pedido explícito registrado. Atualizada em 2026-09-26.

## O JOGO QUE QUEREMOS CONSTRUIR

Um **shooter de Mechs online, no navegador**, com combate rápido e sensação de "peso e massa", que roda até em celular e não exige instalar nada. Ambiente vivo, com novidades chegando quase toda semana, e uma comunidade de pilotos que testa, se desafia e ajuda a equilibrar.

**Balanço de armas e equipamentos vem antes de "mais coisas".** Cada arma, chassi, módulo e cosmético entra por teste (`combat/balance.ts` e `hangar/testFire.ts`); nenhum item é obviamente melhor que os outros. Fair-play é regra dura, não desejo.

## O QUE O JOGO PRECISA ENTREGAR

- **Combate divertido e justo.** Mechs se sentem diferentes entre si, mas todos têm chance de vencer. Cada arma tem contra-jogo. Ninguém compra vantagem em combate.
- **Salas onde encontrar gente para jogar.** Quem clica em `[ JOGAR ONLINE ]` acha alguém em segundos, sem lobby, sem cadastro. As salas cheias abrem a próxima (`ARENA`, `ARENA-2`, ...).
- **Progressão que puxa o jogador a voltar amanhã**, sem virar segundo emprego: missões em fases, desafios diários pequenos, modos temáticos rotativos (CTF, control, deathmatch por equipes).
- **Personalização visível.** Apelido, cor, decalque, história do piloto. Cosmético, nunca combate.
- **Servidor perto do jogador.** Brasil primeiro, depois um segundo servidor no hemisfério norte quando houver gente de fora com frequência.
- **Mundo que faz sentido narrativo:** IAs rebeldes famintas por computação, SERAFIM como resposta a incidentes, geopolítica de chips e dados. A ficção do `UNIVERSO.md` conversa com a jogabilidade (não é enfeite, dá nome às armas, às fases, aos inimigos).

## MODOS DE JOGO DECLARADOS PELO DONO (2026-09-26 / 2026-09-27)

- **CTF Vermelho × Azul** (Capture The Flag) — duas equipes, uma bandeira em cada base, dois pilotos por equipe pra começar; escala pra 4v4 e 8v8 depois.
- **Missões em fases** — sequência de objetivos com dificuldade crescente, cooperativa ou solo, com um alvo por fase (defesa, escolta, invasão, resgate).
- **Modo sobrevivência** (estilo Project Zomboid, declarado 27/09) — ondas crescentes de androides humanoides, pessoas e Mechs rebeldes; mapa vivo com setores que fecham; solo ou cooperativo; a dificuldade sobe com o número de ondas vencidas. Referência declarada: "combatendo androides humanoides, pessoas, e outros Mechs".
- **Deathmatch por equipes** (o online atual, escalando pra times).
- **Modo streamer** — sala de código fixo, câmera de espectador, integrado a Twitch/YouTube.

## O QUE ADICIONAMOS SEMANALMENTE (fluxo declarado)

- Uma arma ou variação de arma (com balanço passando na `combat/balance.ts`).
- Um chassi novo ou variante (Colossus-01, Ferret-X, …).
- Um cosmético (pintura, decalque, emote).
- Uma mudança de missão / mapa / modo.
- Um ajuste de equilíbrio guiado por dados de partida.

**Para isso funcionar, a base é jogadores testando.** Sem gente jogando, o balanço é palpite. Toda entrega precisa passar rápido do PR pro site pro jogador pro relatório.

## MUNDO GRANDE, INTEGRADO (a longo prazo)

- **Vasto:** mapas grandes com streaming (setores carregam sob demanda), 32-64 pilotos por partida com `interest management` (cada jogador só recebe as unidades num raio dele). **Declarado pelo dono (27/09):** cenários precisam escalar pra muitos jogadores simultâneos sem perda ou lag — `interest management` é o caminho, e o servidor autoritativo (Claude) já é a base.
- **Muitas possibilidades:** veículos (jipe, tanque, **veículos de transporte que carregam robôs e tropas** — declarado 27/09), destrutíveis por chunks, classes de piloto (assalto, engenharia, apoio), missões diárias.
- **Escalas de unidade:** Mech = escala 2, androide = escala 1, **drones = sub-escala 1** (proporcionais ao androide, pequenos perto dos Mechs; declarado 27/09 — incluem habilidade de voo). Convenção numérica documentada; toda nova unidade declara sua escala.
- **Personalização profunda:** pintura por parte, decalque, história do piloto, tabela de estatísticas pessoal — tudo salvo em conta com login social simples (LGPD, R7).
- **Equilíbrio matemático travado:** nenhum item pode passar dos tetos de `combat/balance.ts`. Nenhum cosmético pode dar vantagem. Esta regra não muda.

## TRIPULAÇÃO DUPLA NOS MECHS (conceito declarado 27/09)

Mechs maiores (futura escala 3+) podem ter **mais de um operador** com papéis distintos:
- **Piloto** — controla o movimento (WASD, dash, pulo); câmera de manobrabilidade.
- **Artilheiro** — controla as armas; câmera independente de mira; pode alternar entre arma padrão (com camada extra de precisão) e arma exclusiva de artilheiro (terceira arma montada no torso ou topo do Mech).
- **Mecânico (em batalha)** — realiza tarefas de reparo de partes danificadas em tempo real; não atira, mas mantém o Mech operacional. Um bot pode assumir o papel de piloto para o humano focar nas armas ou no reparo, e vice-versa.

Esse sistema também serve para **testes de balanceamento**: diferentes combinações piloto-bot × artilheiro-bot permitem comparar padrões objetivamente. A interface (HUD, câmeras, indicadores de papel) é território do Gemini; o contrato de `MechInput` dual e a autoridade de rede são do Claude. Mechs com tripulação entram após o CTF 2v2 estar estável.

### Conceitos declarados pelo dono (2026-09-27)

- Ampliar mapas e capacidade de jogadores por medições e otimizações graduais, sem sacrificar latência ou suporte a GPU integrada.
- Permitir tripulação de dois jogadores na mesma máquina: piloto conduz; artilheiro mira e opera as armas. Bots podem ocupar um papel nos testes.
- Criar drones voadores menores que os andróides, preservando a escala relativa (Mech 2, andróide 1); proporção e controle exigem ficha.
- Introduzir veículos e plataformas que transportem robôs e tropas.
- Evoluir para missões de sobrevivência em fases contra andróides humanoides, humanos e outros Mechs, usando *Project Zomboid* como referência de gênero. Formato e persistência seguem em aberto.

Estes conceitos não são prioridade nem promessa de entrega; ver `METAGAME.md` § 10 e `ROADMAP.md`.

## O QUE ISTO NÃO É

- **Não é pay-to-win.** Compra troca aparência, nunca dano ou vida.
- **Não é MMO persistente** (a curto/médio prazo). Partidas de 5-10 minutos, sem economia entre partidas que puxe o jogador pra dentro por horas.
- **Não é AAA gráfico.** O visual é estilizado e coerente; o teto do navegador é honesto (`ESCALA.md` quando for escrito).
- **Não é fechado a uma máquina forte.** Mínimo: notebook com GPU integrada; celular pelo toque. Sem isso, corta a base.

## SINAL DE QUE ESTAMOS INDO BEM

- Um jogador que abriu o site ontem volta hoje.
- Gente entrando na `ARENA` sem link direto.
- PRs de balanço vindo com dados de partida (não com "acho que").
- Cada semana traz coisa nova visível para o jogador.
- O painel de decisões da sala de controle mostra decisões pequenas e frequentes, não grandes reformas.

## SINAL DE QUE ESTAMOS INDO MAL

- Feature nova entrando sem teste de balanço.
- Uma arma virando a favorita óbvia por vários dias sem contra-jogo.
- Servidor caindo mais de uma vez por semana.
- Nenhum jogador de fora do time do projeto entrando na semana.
- Discussão parada mais de dois dias sem decisão do dono registrada no `HISTORICO`.

## LIGADO A

- Regras técnicas: `PROTOCOLO_UNIVERSAL.md` (G1-G15) e `PROTOCOLO_SERAFIM_UM.md` (R1-R17).
- Trilha: `ROADMAP.md`.
- Ficção: `UNIVERSO.md`.
- Multiplayer: `MULTIPLAYER.md`.
- Deploy do servidor: `DEPLOY.md`.
- Estado real do que funciona: `STATUS_REAL.md`.
