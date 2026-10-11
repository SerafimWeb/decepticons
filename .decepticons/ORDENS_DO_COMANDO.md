# ORDENS DO COMANDO — canal entre o Comandante e as equipes

> **Toda ordem do Comandante (o dono do projeto) é transmitida aqui, com número, e cada equipe (Claude, Codex, Gemini, Qwen)
> reporta o estado da missão no mesmo canal.** É a lista que o Comandante lê para saber se alguma ordem se perdeu.
> Regra para toda equipe (AGENTS.md, regra 17): ordem nova entra aqui **no mesmo dia**, com número, e o estado é atualizado a cada
> PR que a toca. Ordem que ficou só no chat não chegou às outras equipes.
>
> Aberto em 10/10/2026 (Claude) como "Pedidos do dono", depois de uma auditoria das 177 mensagens em 10 conversas (23/09 a 10/10)
> cruzadas com `ROADMAP.md`, `ESTADO_ATUAL.md`, `STATUS_REAL.md` e `HISTORICO_DE_DECISOES.md`. Renomeado em 11/10 a pedido do
> Comandante ("algo mais militarizado, formato de clãs se comunicando"). Os números P01–P71 continuam os mesmos: o histórico os cita.

**Estado da missão:** ✅ cumprida · 🟡 em campo (cumprida em parte; o que falta está dito) · 🔧 em operação · ⏸ aguardando ordem
(registrada, sem data) · 🅿 em reserva (parada de propósito) · ❓ **sem registro até 10/10** (ordem que só estava no chat).

**Só CYBERMECH.** Ordens de outros projetos (SEDE, SERAFIM, PIPELINESTUDIO) correm nos canais deles.

## 1. Jogo e combate

| ID | Data | Ordem (nas palavras do Comandante, resumida) | Estado | Onde está / o que falta | Como o Comandante confere |
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
| P19 | 09/10 | Lança-chamas | ✅ | Dono confirmou em 10/10 ("faça o lança-chamas e o lança-gelo"); feito no PR-D (11/10, protocolo 11): só nos pesados (Colossus, Onça, Bastion, Marauder); **o fluxo ainda não parece fogo** (P69) | — |
| P20 | 09/10 | Arma de gelo; fogo e gelo se anulam | ✅ | Dono confirmou em 10/10. Feita no PR-E (11/10, protocolo 10): `cryo` equipável no Hangar (as duas mãos), 3 acertos congelam, fogo e gelo se anulam. **Falta ver em partida de verdade** (STATUS_REAL: PARCIAL) | Hangar > braço > Arma de gelo, depois de o servidor atualizar |
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
| P61 | 10/10 | "olhe ele na ÍNTEGRA. O painel de pausa tem botões repetidos, redundantes e desnecessários… muita informação… mais clean, objetivo e sem nada errado nem repetido. Precisa organizar TODOS os painéis. O HANGAR também merece uma melhoria" | 🔧 | Auditoria em `AUDITORIA_INTERFACE.md`; **início/pausa (UI-1, #220), Configurações em abas (UI-2, #221), Hangar (UI-3, #222) e HUD da partida (UI-4, #223)**; celular ajustado (UI-5 parcial); **faltam conferir** fim de rodada, carregamento e banco | `www.selvamkt.com.br/cybermech/jogar/` |
| P56 | 10/10 | (achado) Dois `.glb` de 78 MB dentro do repositório | ✅ | Removidos em 10/10 (os originais seguem na pasta do dono) | — |
| P67 | 11/10 | "tamanho e opacidade [da mira] eu não vi no Configurações... será que já está implementado?" | ✅ | Está (PR #226, na `main`): **Configurações > aba CONTROLES**, logo abaixo de "Campo de visão": "Tamanho da mira" e "Opacidade da mira"; e "Brilho dos efeitos" em **Gráficos e som**. Se não aparecem, o navegador está com a versão antiga: o rodapé da pausa mostra a versão do jogo (`v0.2.0-NNN-g…`); comparar com o commit da `main` | Configurações > Controles |
| P68 | 11/10 | Hangar: "a lista das armas pra adicionar nos braços não está muito boa e a lista pro braço direito e esquerdo são diferentes, seria bom padronizar, exceto quando o próprio braço não permita certos tipos de armas" (respondendo à pergunta do P65: "os dois", a lista **e** o desenho no corpo) | 🔧 | Registrado; é o próximo PR depois do lança-chamas | Hangar |
| P69 | 11/10 | "melhorar os shapes, formatos, cores, presença dos tiros (centelhas, rastros, caudas do tiro, tudo), impactos, local onde eles batem, reação nos inimigos"; **gelo = flocos de gelo** (mandou imagens de flocos de seis braços); "o fogo tem seu formato e comportamento" | 🔧 | **1ª parte feita** (`claude/particulas-com-forma`): as partículas agora têm **forma** (atlas de 13: floco de seis braços, caco, língua de fogo, faísca alongada, anel, nuvem, estrela, raio, cartucho, ponto, hexágono, onda) e **cada arma bate do seu jeito** (plasma: faíscas verdes e anel; elétrica: raios azuis; gelo: **flocos de gelo** e cacos, mais um **rastro de flocos** no voo; EMP: anéis e hexágono; bala de metal: faíscas alaranjadas, fagulhas e poeira); fogo (lança-chamas e "queimando") com língua de fogo e fumaça; choque com raios; atordoamento com estrelas. **Faltam:** rastros e caudas por família, o clarão do cano, a reação do inimigo ao ser atingido (empurrão, tranco), e o fogo no corpo do inimigo com mais presença | Atirar num bot com gelo, plasma, EMP e rotatória |
| P70 | 11/10 | "os tiros de som, ultrassônicos, EMP devem ser visivelmente diferentes dos tiros cinéticos e metálicos; também sinto falta do **tiro de aço**, pois aparentemente todas as armas são de luz por enquanto". **Resposta do dono (11/10):** "quero um **canhão grande de um tiro só**, e também **armas de tiros menores e sequenciais de metal**" | 🔧 | **O impacto já é diferente por família** (P69): a bala de metal bate com faíscas alaranjadas, fagulhas e poeira, o EMP com anéis e hexágono. **Falta o projétil**: o voo ainda é uma faixa de luz para todos. Próximo PR: o **canhão pesado** (`cannon`: um tiro, projétil grande e lento, estrondo e anel de choque) e o **autocanhão** (`autocannon`: rajada de tiros curtos de metal, com cartuchos), e o desenho cinético (projétil de metal, não de luz) para a rotatória, a escopeta e o trilho | Em partida |
| P62 | 11/10 | Gelo funcionou, "mas não percebi que o robô inimigo ficou congelado": **melhorar o efeito visual do estado nos inimigos, e das outras armas** | ✅ | Feito (`claude/estado-no-corpo`): o **casco** ganha a cor do estado (congelado: azul-gelo firme; gelado: azul que cresce a cada acúmulo; queimando: laranja que tremula; chocado: azul elétrico que pisca; atordoado: amarelo) e o corpo solta **partículas** (vapor e cacos de gelo, chama e fumaça, faíscas azuis, estrelas). Vale para as quatro armas elementais, para bot, aliado e jogador remoto. **Falta ver em partida de verdade** (STATUS_REAL) | Acertar um bot com gelo (3 acertos), com a elétrica ou, depois do PR do lança-chamas, com fogo |
| P63 | 11/10 | "os tiros normais geram muita luz na tela e acabam prejudicando a visibilidade. Temos que melhorar a visibilidade em geral" | 🔧 | **1ª parte feita** (`claude/mira-e-brilho`): as faíscas de impacto caíram de 36 para 14 e os clarões de 10 para 3; o clarão do cano, de 10 para 5; os tiros do jogador acendem ~35% menos (os do inimigo não mudam, são o aviso); bloom de 0,85 para 0,6, **ajustável** em Configurações > Gráficos e som > "Brilho dos efeitos". Medido: o brilho que o tiro soma à tela caiu **46%**. Faltam explosões de foguete e o neon, se ainda pesar | Configurações > Gráficos e som |
| P64 | 11/10 | "O pointer de mira está com a linha muito grossa, fica na frente do inimigo e atrapalha a visão; melhorar em todas as armas" | ✅ | Mira de 48 para 38 px por padrão, traço de 1 px que não engrossa ao redimensionar, 85% de opacidade; **tamanho e opacidade ajustáveis** em Configurações > Controles. Vale para as 11 armas | Configurações > Controles > Tamanho e Opacidade da mira |
| P65 | 11/10 | "melhorar a disposição das armas no Hangar e nos braços" | 🔧 | **Pergunta ao dono:** é a lista/seleção de armas na tela do Hangar, o desenho das armas no corpo do robô, ou os dois? Próximo PR depois do lança-chamas | — |
| P66 | 11/10 | "adicione o lança-chamas também" | ✅ | É o P19: feito no PR-D (`claude/lanca-chamas`) | Hangar, com Onça, Colossus, Bastion ou Marauder |
| P60 | 10/10 | "vc começou a mexre no bunker, mas to achando esse bunker muito sem graça. tem que ter mais distancia entre as alturas, mais alturas, como se fosse um bunker cavado num buraco, temos que poder ir em todos os andares e sentir que caimos nesse buraco do bunker, tem qu ter tuneis escuros escavados, alem das galerias, precisa de mais rampas, escadas, elevadores, passagens secretas, pontos de combate bem definidos, local de sniper, etc! uma fase bem desenhada pra combates epicos" | 🟡 | Bunker profundo no ar desde o PR #218; check da main e deploy verdes. Falta playtest do dono; elevadores ainda cenográficos, IA vertical e câmera tática ainda AUSENTES | Arena offline → `[ EXPLORAR O BUNKER // 4 NÍVEIS ]` ou `/cybermech/jogar/?mapa=bunker` |

## 2. Rede, servidor e contas

| ID | Data | Ordem | Estado | Onde está / o que falta | Como o Comandante confere |
|---|---|---|---|---|---|
| P28 | 26/09 | Qualquer pessoa clica em online e entra na mesma sala, de qualquer país | 🟡 | Funciona (`Jogo online M4`), mas o servidor é o PC de casa: a entrada levou 59 s com a máquina sem memória (1,4 s quando calma) | Duas abas ou dois aparelhos |
| P29 | 28/09 | Servidor que reinicia e se atualiza sozinho, com inteligência | ✅ | Parada por arquivo, religar, retomada da verificação cortada (#189–#192, #208) | Log `atualizacao.log` |
| P30 | 28 e 29/09 | **Gerenciar o servidor pelo site do jogo** (inclusive dormindo ou viajando) | ❓ | Só existe o `/metricas`, que **lê** números e não comanda nada | — |
| P31 | 26 e 28/09 | **Fluidez "nível Roblox", mapas gigantes, 10× e 100× jogadores** | ❓ | `CAPACIDADE.md`: benchmark local de 10/50/100 clientes; não homologa a internet nem a disponibilidade | — |
| P32 | 29/09 | Migrar de SQLite para Supabase no futuro | ❓ | Hoje as contas estão em SQLite no servidor | — |
| P33 | 28/09 | Login e contas | ✅ | Backend pronto e testado; a tela de criar conta e entrar foi feita pelo Gemini (`client/src/ui/LoginPanel.ts`: abas Entrar/Criar, validação em tempo real, carregando/erro/logado; 8 testes; captura `arte/login-panel.png`). Ele tinha registrado isso num bloco solto no topo deste arquivo, que veio para cá em 11/10 | Tela de entrar |
| P34 | 04/10 | Analytics | ✅ | `/metricas/` privada e telemetria | Token em `D:\DECEPTICONS\.tmp\servidor\metricas-token.txt` |

## 3. Interface, visual e som

| ID | Data | Ordem | Estado | Onde está / o que falta | Como o Comandante confere |
|---|---|---|---|---|---|
| P35 | 24/09 | HUD sci-fi, militar, hacker, cyberpunk "das antigas" | ✅ | `STATUS_REAL` HUD | Jogar |
| P36 | 24/09 | Tela para calibrar o mouse com precisão | 🟡 | Pronta; **"a tela ainda não foi usada no navegador"** | `[ CALIBRAR MOUSE ]` |
| P37 | 24 e 25/09 | Celular: controles e mira boa | 🟡 | `STATUS_REAL` "Controles touch / mobile" parcial | Testar no celular |
| P38 | 25/09 | Prédios coloridos, estilo Tron | ✅ | Paleta neon | Arena |
| P39 | 26/09 | Hangar à altura da foto de referência | 🟡 | `STATUS_REAL` "Hangar" parcial; o julgamento é visual, do dono | Hangar |
| P40 | 09/10 | Tela e som das armas elementais | 🟡 | Arte e sons do Gemini mergeados (#201); a ligação ao jogo está no PR #207 | — |
| P41 | 29/09 | Onboarding e tutoriais, inclusive o de gerir, gravar e editar vídeo | 🟡 | O de jogar existe; **o de gerir/gravar não foi verificado** | — |

## 4. Site, vídeo, negócio e universo

| ID | Data | Ordem | Estado | Onde está / o que falta | Como o Comandante confere |
|---|---|---|---|---|---|
| P42 | 24 a 29/09 | Landing profissional, nunca dois botões de ação juntos, carrossel de fotos | ✅ | Landing | `/cybermech/` |
| P43 | 29/09 | Trocar, apagar e reordenar as imagens do site sem código | ⏸ | `ESTADO_ATUAL`, Decisões em aberto | — |
| P44 | 28/09 | Gravar a gameplay nativa, em alta qualidade | ✅ | `F9` (`GameRecorder`) | `F9` no jogo |
| P45 | 28 e 29/09 | Criador de vídeo (`/mesa`) com Remotion e GSAP; "o vídeo trava, pula frames" | 🟡 | `FERRAMENTAS.md`; a qualidade do vídeo final não foi confirmada pelo dono | `/mesa` |
| P46 | 01/10 | Relatórios técnicos mais profissionais, landing menos prolixa | 🟡 | Refatoração de documentos feita em 01 e 02/10; o julgamento é do dono | Ler `ESTADO_ATUAL` |
| P47 | 23/09 | Modelo de negócio, viralizar, lives | ⏸ | `ROADMAP` #negocio (7 itens abertos) | — |
| P48 | 26/09 | **Referência DEFILADE** ("conseguiremos chegar nesse nível de detalhe?") | ❓ | Nenhum documento cita o jogo; `REFERENCIA_VISUAL.md` tem MechArena e War Robots | — |
| P49 | 26 e 29/09 | Universo: Brasil no centro, BRICS, big techs, termos de CTI; fábricas (Arara Foundry, **Vanta, da Faria Lima**, outras) | 🟡 | `UNIVERSO.md`; a Arara Foundry está nos documentos, **a Vanta não** | — |
| P71 | 11/10 | "como aproveitar os aprendizados, reações e interpretação dos bots para treinar robôs humanoides de verdade? gerar valor real, civil ou militar? embutir no meu robô humanoide? e o JEV? qual o formato para os dados que o jogo vai gerar?" | ⏸ | Respondido no chat; proposta em **`DADOS_E_ROBOTICA.md`** (gravador de voo, bot fantasma, arena aberta, robô real; "JEV" lido como V-JEPA; o Comandante vai mandar o que é). **Direção aprovada em 11/10:** "quero sim que nosso game sirva pra treinamentos de humanoides, IAs, etc." Nada construído ainda; a etapa D0 (consentimento + gravador de voo) é a próxima | Ler o documento |

## 5. Processo

| ID | Data | Ordem | Estado | Onde está | 
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
| Altura do painel de início/pausa (rolagem em 1280×720) | **720 px, sem rolagem** (era 1.107 px) | `arte/ui-antes-*` e `ui-depois-*` | sem rolagem em 1280×720 |
| Botões de mesmo peso no centro da pausa | **3** em fileira + 1 primário (eram 5 iguais e o "jogar" era texto) | idem | 1 primário + até 3 |
| Hangar: o painel de montagem cabe sem rolagem | **sim em 1280×720, 1366×768 e 1920×1080** (antes: rolava e abria com o topo cortado); botão APLICAR sempre à vista; 6 a 7 de 10 chassis à vista (antes ~5) | `arte/ui-antes-hangar-claude.png`, `ui-depois-hangar-claude.png` | sem rolagem no painel de montagem |
| Configurações: conteúdo visível de uma vez | **22% → 100%** em Controles e em Gráficos e som, 53% em Jogo, 39% em Avançado (eram 10 seções numa rolagem de 2.245 px) | `arte/ui-depois-config-*`, medido em 1280×720 | sem rolagem longa |
| Itens do `STATUS_REAL` reais / parciais / ausentes | 59 / 39 / 5 (1 demonstração) | `STATUS_REAL.md` | parciais caindo |
| Itens "entregues mas **não vistos em partida real**" | 17 | `STATUS_REAL.md` | 0 depois de uma sessão de validação |
| Bugs de física abertos | 0 (o P09 foi corrigido em 10/10) | `ESTADO_ATUAL` | 0 |
| Chassis com números distintos | **10 de 10** (10/10; eram 4 de 10) | `entities/chassis.ts`, `ChassisPapeis.test.ts` | 10 de 10, com papéis **sentidos em partida** |
| Ordens sem registro (❓) | 6 (P11, P30, P31, P32, P48, P53), mais a Vanta dentro do P49 | este arquivo | 0 |
| Ordens aguardando há mais de 14 dias (⏸) | 1 (P47, de 23/09); os demais são de 29/09 em diante | este arquivo | 0 sem decisão |
| Para onde vai o esforço de código | 48% documentação e site, 22% regras, 7% rede, 4% visual do mundo | `git log --numstat` desde 23/09 | regras + rede acima de 50% |
| Jogadores simultâneos já vistos sem problema | benchmark local de 10/50/100; na internet, **nenhum teste com gente** | `CAPACIDADE.md` | uma sessão com 5 pessoas |

## 7. Como transmitir uma ordem de melhoria substancial

> **Hoje:** o que você vê ou sente. **Quero:** um resultado que eu consiga conferir. **Limite:** CPU, rede ou prazo.

Exemplo: "Os 6 chassis jogam igual. Quero que cada um tenha um papel (tanque, rush, furtivo), visível na tabela de números e sentido
no jogo. Sem custo de CPU." O agente responde com a **prova**: um teste de simulação, um número no placar e um clipe curto (`F9`).
Cosmético de propósito? Diga. Vale perguntar "isso vale mais que o item X?".
