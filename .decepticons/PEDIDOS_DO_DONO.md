# PEDIDOS DO DONO — o registro de tudo que foi pedido, e em que pé está

> Criado em 10/10/2026 (Claude), depois de uma auditoria das 177 mensagens do dono em 10 conversas (23/09 a 10/10) cruzadas com
> `ROADMAP.md`, `ESTADO_ATUAL.md`, `STATUS_REAL.md` e `HISTORICO_DE_DECISOES.md`. **É a lista que o dono lê para saber se algo foi
> esquecido.** Regra para todo agente (AGENTS.md, regra 17): pedido novo do dono entra aqui **no mesmo dia**, com ID, e o estado é
> atualizado a cada PR que o toca. O que ficou só no chat não existe para os outros agentes.

**Legenda:** ✅ feito · 🟡 parcial (o que falta está dito) · 🔧 em andamento · ⏸ parado (registrado, sem data) · 🅿 estacionado de propósito ·
❓ **sem registro até 10/10** (pedido que só estava no chat).

**Só CYBERMECH.** Pedidos de outros projetos (SEDE, SERAFIM, PIPELINESTUDIO) moram nos repositórios deles.

## 1. Jogo e combate

| ID | Data | Pedido (nas palavras do dono, resumido) | Estado | Onde está / o que falta | Como o dono confere |
|---|---|---|---|---|---|
| P01 | 23/09 | Mais capricho nas físicas, sempre com CPU baixa | 🟡 | Regra permanente (G1–G5); destroços e barricadas prontos. "Física caprichada" nunca foi medida | Jogar, painel de desempenho (`'`) |
| P02 | 23/09 | IA nos inimigos | ✅ | `BotController`; `STATUS_REAL` "Bots inimigos (IA)" | Modo Arena |
| P03 | 25/09 | Bots com jeitos diferentes (brabo, manso, fujão) e mais configuração | 🟡 | Personas e dificuldade prontas; a configuração fina é limitada | Configurações |
| P04 | 25/09 | Nome das IAs nos bots e guia visual dos robôs | ✅ | `ESTILO_ROBOS.md` | Ver os bots |
| P05 | 25/09 | Calibrar o primeiro robô: rápido demais, tiro sem respiro, calor rigoroso | ✅ | `combat/balance.ts` e Potências | Jogar |
| P06 | 03/10 | Painel de edição completa: potência, alcance, vida, calor | ✅ | Configurações → POTÊNCIAS | Abrir o painel |
| P07 | 29/09 | **Chassis com formatos de verdade diferentes (modelo War Robots), não "quadradão"** | 🟡 | **Números e papéis: feito em 10/10** (os 10 chassis distintos, `CHASSIS_PAPEL`). **A forma ainda não**: 5 chassis de malha importada; quadrúpede, esteira e quatro braços esperam o dono escolher o 1º arquétipo (`ROADMAP`) | Hangar: trocar de chassi e jogar; comparar silhuetas |
| P08 | 29/09 | Colossus jogável, grande, que não "flutue" | ✅ | Jogável; o "flutuar" era o afundamento do P09, já corrigido | Jogar de Colossus |
| P09 | 29/09 | (achado ao investigar o P08) Mech parado afunda no chão | ✅ | **Corrigido em 10/10**: uma linha em `MechBase.fixedUpdate` e `MechParado.test.ts` (7 de 9 testes falham contra o código antigo) | Ficar parado 10 s: os pés não descem |
| P10 | 29/09 | Colossus com piloto e 1–2 artilheiros nas armas direcionais | ⏸ | `ROADMAP` #combate "Mech com dois operadores"; sem contrato de rede | — |
| P11 | 28/09 | Mechs de tamanho 4 e 5 (10× e 20× maiores) | ❓ | Só a escala 3 existe (Colossus, 14 m) | — |
| P12 | 29/09 | Mechs de tamanho 1 e 2 novos, e outras armas | ✅ | Arara-B1, Onça-B2; escopeta, trilho, EMP, chuva, rotatória, elétrica | Hangar |
| P13 | 30/09 | Poder jogar num time de bots | 🟡 | Offline pronto; **online ausente** (o roster de rede não descreve aliado) | Modo Arena |
| P14 | 02/10 | Mão sem dedos e suporte que troque de arma fácil | ✅ | Encaixe no pulso; Hangar | Hangar |
| P15 | 03/10 | Marauder com 2 blasters e 2 lança-mísseis nos ombros; Lancer com escopeta e escudo | ✅ | `STATUS_REAL` Marauder e Lancer | Hangar |
| P16 | 04/10 | Míssil que sobe e cai como chuva, arma diferente do casulo | ✅ | Morteiro nas costas | Hangar, braço esquerdo |
| P17 | 09/10 | Metralhadora rotatória | 🟡 | No ar; **não vista nem ouvida em partida real** | Hangar |
| P18 | 09/10 | Tiros elétricos: choque, lento, e parado se o tiro for bem dado | 🟡 | No ar; tela e som no PR #207 | Hangar |
| P19 | 09/10 | Lança-chamas | 🔧 | Dono confirmou em 10/10 ("faça o lança-chamas e o lança-gelo"); em fila no Claude, depois do gelo (`ARMAS_ELEMENTAIS.md`) | — |
| P20 | 09/10 | Arma de gelo; fogo e gelo se anulam | 🔧 | Dono confirmou em 10/10; é a próxima arma (a regra de anular já existe) | — |
| P21 | 09/10 | Fogo queimando o cenário (chão e prédios) | ⏸ | Pergunta registrada e **sem resposta do dono**; o padrão adotado é "não" (custa CPU e rede) | **Responder** |
| P22 | 01/10 | Combos e jogadas por chassi (rolar de lado, voar e atacar de cima) | 🅿 | `ROADMAP`: "ideia do dono, não é escopo aprovado" | Decidir |
| P23 | 06/10 | Estilos de jogo como eixo da evolução (tankar, rush, furtivo) | 🟡 | Os papéis por chassi (tanque, escaramuçador, duelista, assalto, plataforma de fogo) existem desde 10/10; **a evolução do jogador** (um mesmo chassi ganhando jeitos de lutar) segue só ideia | Decidir |
| P24 | 27/09 | CTF Vermelho × Azul 2v2 | 🟡 | Treino offline pronto (`?modo=ctf`); **online não existe** | `?modo=ctf` |
| P25 | 28/09 | Missões em fases e ondas | ✅ | Modo Sobrevivência | `?modo=survival` |
| P26 | 06/10 | Câmeras de espectador (outros jogadores, torre, portas) | 🔧 | `STATUS_REAL`: ausente. Há uma worktree do Gemini ativa para isso (10/10), ainda sem PR | — |
| P27 | 06/10 | Painel de campanhas (oponentes, missões e tarefas salvas) | ⏸ | `STATUS_REAL`: ausente | — |
| P53 | 25/09 | Usar LLMs (Groq, Gemini, DeepSeek) por API nos bots? "ou não faz sentido?" | ❓ | A pergunta não tem resposta registrada. Os bots hoje são regras e personas, sem LLM | — |
| P54 | 10/10 | **Painel admin completo**: gerenciar o jogo em poucas telas (campanha, bots adversários, a configuração de cada um, apelidos, pilotos, módulos, armas) | ⏸ | Plano escrito em `PAINEL_ADMIN.md` (cinco telas, contratos primeiro); **nada construído ainda**. Metade já existe espalhada (Configurações, Potências, Hangar, nomes); falta o dado novo: a ficha de cada bot e a campanha | Decidir as 5 perguntas da seção 5 do plano |
| P55 | 10/10 | Prompt para fazer o próximo robô no Tripo3D "do jeito certo" | 🟡 | Prompt pronto para colar em **`.decepticons/PROMPT_TRIPO3D.md`** (texto-base, 4 formatos e o passo a passo no Tripo; o roteiro longo está em `MECHS_IMPORTADOS.md` §7); **falta o dono gerar o robô e mandar o `.glb`**. Ele citou um robô de 4 braços que já existe: o nome do arquivo ainda não foi confirmado | Mandar o arquivo |
| P57 | 10/10 | (achado) O Quadra-V2 não tem malha própria: usa o corpo do Vector-09 (a entrada dele no carregador está desligada) | ⏸ | `quadra-v2.glb` existe e não é carregado; religar e inspecionar é barato (`MECHS_IMPORTADOS.md` §7). **Sem isso o papel de escaramuçador não aparece na silhueta** | — |
| P58 | 10/10 | Enviar direto para o GitHub, sem travar, "do jeito que funcionava até ontem" (o dono, Claude e Codex) | ✅ | `npm run publicar` e `scripts/gh.mjs` (21 testes; fallback provado com token inválido). **Rodou de ponta a ponta no #215** (recusou o merge com CI vermelho, mergeou sozinho depois da correção). A causa de o token do `gh` morrer não foi provada | Ver os PRs saírem sozinhos |
| P59 | 10/10 | **Abrir o Bunker** (fase nova do Codex, já no ar) | ✅ | No ar desde o #213. O link era pequeno e ficava no fim (o dono não o achou); agora é o botão **[ EXPLORAR O BUNKER ]** abaixo de ABRIR HANGAR | `www.selvamkt.com.br/cybermech/jogar/?mapa=bunker` |
| P56 | 10/10 | (achado) Dois `.glb` de 78 MB dentro do repositório | ✅ | Removidos em 10/10 (os originais seguem na pasta do dono) | — |

## 2. Rede, servidor e contas

| ID | Data | Pedido | Estado | Onde está / o que falta | Como o dono confere |
|---|---|---|---|---|---|
| P28 | 26/09 | Qualquer pessoa clica em online e entra na mesma sala, de qualquer país | 🟡 | Funciona (`Jogo online M4`), mas o servidor é o PC de casa: a entrada levou 59 s com a máquina sem memória (1,4 s quando calma) | Duas abas ou dois aparelhos |
| P29 | 28/09 | Servidor que reinicia e se atualiza sozinho, com inteligência | ✅ | Parada por arquivo, religar, retomada da verificação cortada (#189–#192, #208) | Log `atualizacao.log` |
| P30 | 28 e 29/09 | **Gerenciar o servidor pelo site do jogo** (inclusive dormindo ou viajando) | ❓ | Só existe o `/metricas`, que **lê** números e não comanda nada | — |
| P31 | 26 e 28/09 | **Fluidez "nível Roblox", mapas gigantes, 10× e 100× jogadores** | ❓ | `CAPACIDADE.md`: benchmark local de 10/50/100 clientes; não homologa a internet nem a disponibilidade | — |
| P32 | 29/09 | Migrar de SQLite para Supabase no futuro | ❓ | Hoje as contas estão em SQLite no servidor | — |
| P33 | 28/09 | Login e contas | 🔧 | Backend pronto e testado; **a tela de criar conta e entrar não existe; pedido enviado ao Gemini em 10/10** (pedida ao Gemini em 28/09) | — |
| P34 | 04/10 | Analytics | ✅ | `/metricas/` privada e telemetria | Token em `D:\DECEPTICONS\.tmp\servidor\metricas-token.txt` |

## 3. Interface, visual e som

| ID | Data | Pedido | Estado | Onde está / o que falta | Como o dono confere |
|---|---|---|---|---|---|
| P35 | 24/09 | HUD sci-fi, militar, hacker, cyberpunk "das antigas" | ✅ | `STATUS_REAL` HUD | Jogar |
| P36 | 24/09 | Tela para calibrar o mouse com precisão | 🟡 | Pronta; **"a tela ainda não foi usada no navegador"** | `[ CALIBRAR MOUSE ]` |
| P37 | 24 e 25/09 | Celular: controles e mira boa | 🟡 | `STATUS_REAL` "Controles touch / mobile" parcial | Testar no celular |
| P38 | 25/09 | Prédios coloridos, estilo Tron | ✅ | Paleta neon | Arena |
| P39 | 26/09 | Hangar à altura da foto de referência | 🟡 | `STATUS_REAL` "Hangar" parcial; o julgamento é visual, do dono | Hangar |
| P40 | 09/10 | Tela e som das armas elementais | 🟡 | Arte e sons do Gemini mergeados (#201); a ligação ao jogo está no PR #207 | — |
| P41 | 29/09 | Onboarding e tutoriais, inclusive o de gerir, gravar e editar vídeo | 🟡 | O de jogar existe; **o de gerir/gravar não foi verificado** | — |

## 4. Site, vídeo, negócio e universo

| ID | Data | Pedido | Estado | Onde está / o que falta | Como o dono confere |
|---|---|---|---|---|---|
| P42 | 24 a 29/09 | Landing profissional, nunca dois botões de ação juntos, carrossel de fotos | ✅ | Landing | `/cybermech/` |
| P43 | 29/09 | Trocar, apagar e reordenar as imagens do site sem código | ⏸ | `ESTADO_ATUAL`, Decisões em aberto | — |
| P44 | 28/09 | Gravar a gameplay nativa, em alta qualidade | ✅ | `F9` (`GameRecorder`) | `F9` no jogo |
| P45 | 28 e 29/09 | Criador de vídeo (`/mesa`) com Remotion e GSAP; "o vídeo trava, pula frames" | 🟡 | `FERRAMENTAS.md`; a qualidade do vídeo final não foi confirmada pelo dono | `/mesa` |
| P46 | 01/10 | Relatórios técnicos mais profissionais, landing menos prolixa | 🟡 | Refatoração de documentos feita em 01 e 02/10; o julgamento é do dono | Ler `ESTADO_ATUAL` |
| P47 | 23/09 | Modelo de negócio, viralizar, lives | ⏸ | `ROADMAP` #negocio (7 itens abertos) | — |
| P48 | 26/09 | **Referência DEFILADE** ("conseguiremos chegar nesse nível de detalhe?") | ❓ | Nenhum documento cita o jogo; `REFERENCIA_VISUAL.md` tem MechArena e War Robots | — |
| P49 | 26 e 29/09 | Universo: Brasil no centro, BRICS, big techs, termos de CTI; fábricas (Arara Foundry, **Vanta, da Faria Lima**, outras) | 🟡 | `UNIVERSO.md`; a Arara Foundry está nos documentos, **a Vanta não** | — |

## 5. Processo

| ID | Data | Pedido | Estado | Onde está | 
|---|---|---|---|---|
| P50 | 30/09 | Testar direto no site, sem ficar preso em branch | ✅ | AGENTS.md, regras 13 e 14 |
| P51 | 03/10 | Um agente nunca mexe em outro projeto, pasta ou chat | ✅ | AGENTS.md, regra 12 |
| P52 | 01/10 | Recuperar o espaço do disco C: | ✅ | Feito em 01/10 |

## 6. Placar de resultado (o jogo está melhorando de verdade?)

O painel da sala de controle conta **tarefas feitas**; este placar conta **resultado**. Cada número tem a fonte e o valor medido em 10/10.
Atualize a cada fase. Se os números não mexem, o trabalho é cosmético, mesmo que as tarefas fechem.

| Medida | Valor em 10/10 | Fonte | Meta |
|---|---|---|---|
| Tempo para entrar numa sala online | 1,4 s (máquina calma) a **59 s** (estrangulada) | `.tmp/teste-wss.mjs` contra produção | < 3 s sempre |
| Itens do `STATUS_REAL` reais / parciais / ausentes | 59 / 39 / 5 (1 demonstração) | `STATUS_REAL.md` | parciais caindo |
| Itens "entregues mas **não vistos em partida real**" | 17 | `STATUS_REAL.md` | 0 depois de uma sessão de validação |
| Bugs de física abertos | 0 (o P09 foi corrigido em 10/10) | `ESTADO_ATUAL` | 0 |
| Chassis com números distintos | **10 de 10** (10/10; eram 4 de 10) | `entities/chassis.ts`, `ChassisPapeis.test.ts` | 10 de 10, com papéis **sentidos em partida** |
| Pedidos do dono sem registro (❓) | 6 (P11, P30, P31, P32, P48, P53), mais a Vanta dentro do P49 | este arquivo | 0 |
| Pedidos do dono parados há mais de 14 dias (⏸) | 1 (P47, de 23/09); os demais são de 29/09 em diante | este arquivo | 0 sem decisão |
| Para onde vai o esforço de código | 48% documentação e site, 22% regras, 7% rede, 4% visual do mundo | `git log --numstat` desde 23/09 | regras + rede acima de 50% |
| Jogadores simultâneos já vistos sem problema | benchmark local de 10/50/100; na internet, **nenhum teste com gente** | `CAPACIDADE.md` | uma sessão com 5 pessoas |

## 7. Como pedir uma melhoria substancial

> **Hoje:** o que você vê ou sente. **Quero:** um resultado que eu consiga conferir. **Limite:** CPU, rede ou prazo.

Exemplo: "Os 6 chassis jogam igual. Quero que cada um tenha um papel (tanque, rush, furtivo), visível na tabela de números e sentido
no jogo. Sem custo de CPU." O agente responde com a **prova**: um teste de simulação, um número no placar e um clipe curto (`F9`).
Cosmético de propósito? Diga. Vale perguntar "isso vale mais que o item X?".
