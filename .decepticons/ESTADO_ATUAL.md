> **Arquivo:** o que tem mais de dois dias mora em `.decepticons/arquivo/estado-*.md` (nada se perdeu; `npm run arquivar` move mais). Procure por busca, não leia inteiro.


## EM BRANCH — NÃO ESTÁ NO AR: a geração 3 do movimento dos Mechs (Claude, P319, branch `claude/movimento-gen3`, sem PR ainda)

**O pedido (06/11):** a skill teardown (peças mecânicas em código) foi o ponto de partida; o Comandante corrigiu o rumo: nada de detalhe miúdo nem geometria nova, só **molejo** e pé plantado, sem pesar a renderização. **Feito:** `passadaGen3.ts` (passada com o pé plantado, alcance limitado pelo comprimento da perna, pelve contínua), `molejo.ts` (mola amortecida para tronco, pelve e coice), `passadaRig.ts` (mede a perna no rig real, serve aos `.glb` também), ligado no `MechBase` atrás de `mech:gen3` (restrito). **Desligado, cada Mech anda como antes.** Sem triângulo, draw call ou material novos.
**Achados:** a primeira versão tinha um degrau de ~1 rad na pelve (agora o mínimo é contínuo) e afundava 1,2 m no Arara (agora o alcance cabe na perna). Com o pé plantado a 9 m/s, o Vector-09 dá ~2 passos por segundo por perna, mais que hoje: é a consequência física, e o Comandante julga no vídeo.
**Falta:** bancada de movimento, medida de CPU com 16 Mechs, vídeo antes × depois e o PR. **Próxima sessão começa com:** a bancada de movimento, depois o PR.
## EM BRANCH — NÃO ESTÁ NO AR: a higienização e o inacabado dos outros agentes (Claude, P317 e P318, branch `claude/higiene-p317-p318`)

**O pedido (06/11):** *"pega o que está inacabado no gemini, no codex, e até no qwen ou deepseek, e conclua"* e *"será que devemos dar uma higienizada…?"*. **Resposta: sim, onde se mede.** O código está limpo (34 marcadores de pendência em 16 arquivos, 2 supressões de tipo, 429 arquivos de código para 348 de teste, `tsc` estrito limpo, build minificado e o teto de 500 KB cobrado pelo check). O que estava sujo eram arquivos e o ambiente.
**Feito neste PR:** (1) **8,7 MB que iam ao ar sem uso saíram:** `lancer-l1.glb` e `lr-7l-bastion.glb` (8,2 MB; o Lancer usa `TZLA1.glb` e o Bastion, `LR7L.glb`) e três áudios que o `Game` baixava em toda abertura e ninguém tocava (`ambient_action`, `ui_bass`, `shot_heavy`: 475 KB); `client/public` foi de 35,1 para 26,6 MB. **Duas travas** (`amostrasDoJogo.test.ts`, `modelosDoJogo.test.ts`) reprovam o estado antigo e passam no novo. (2) Documentos arquivados (`npm run arquivar -- --aplicar`, sem perder linha). (3) Correção do P316: do narrador só o "Combate!" tem voz (as 9 rodadas usam a voz robótica do navegador; 9 falas ficam mudas), e a IA de bordo ganhou 6 falas irônicas (o `METAGAME.md` pedia "fria, sarcástica"): 189 falas de rádio. (4) Código morto do kit retrô (`porta`) removido.
**Ambiente:** a `node_modules` estava **incompleta** (7 pacotes faltando) e nenhuma worktree rodava teste: `npm install` consertou. **Worktrees:** 72, 62 com `HEAD` já na `main`; removi 10 limpas e o ambiente **negou** a remoção do resto em lote (sinal respeitado: parei). Restam 43 limpas e mergeadas; o ensaio está em `.tmp\limpeza-worktrees.ps1` (rode com `-Aplicar`: recusa pasta suja, protege a do servidor, não apaga branch). Duas pastas ficaram pela metade com a interrupção: `wt-claude-janeiro2` foi restaurada (0 diferença do `HEAD`) e `wt-claude-armas2` é só uma pasta órfã com o atalho do `node_modules`.
**O inacabado (P317):** mortos, já na `main` por outro caminho: `gemini/sons-androides`, `setas-inimigos`, `primeira-partida`, `modo-hud-audio`, `multiplayer-sync`; do Codex, `medicao-gpu` (a `main` tem as medições de GPU por mapa) e `weapon-mk-visuals` (conflita em 5 arquivos centrais, 1.161 commits atrás). Qwen e DeepSeek: nada pendente. **Pedem decisão do Comandante:** `codex/estacoes-taticas` (conflita em `Arena.ts`, o mapa reformado desde então) e os três trabalhos de bunker sem commit (`wt-codex-bunker*`: mexem na simulação, e o Bunker está EM BREVE). A moldura de cockpit do Gemini vai em PR próprio, restrita e medida.
**Próxima sessão começa com:** a moldura do cockpit (PR próprio), o jogo tocar o rádio gravado com a música abaixando sob a voz (P316 parte 2), e a decisão do Comandante sobre as estações táticas e o bunker.

## Na `main` desde 06/11 (PR #516), no ar após o deploy: o roteiro do rádio de campo e o Estúdio pronto para a gravação (Claude, P316)

**O pedido (06/11):** os sons, as falas e o rádio inimigo interceptado, com a gravação do Comandante no Estúdio no dia seguinte (ver P316 a P318 em `ORDENS_DO_COMANDO.md`). **Entrega (parte 1):** `client/src/audio/radio.json` (189 falas em 7 canais: Controle, Computador de bordo, Pilotos, Rádio inimigo interceptado, Androides, IAs rebeldes e Gritos; só português; com a intenção de cada estilo, os diálogos de comando e resposta e o gatilho no jogo); `ROTEIRO_DE_GRAVACAO.md` gerado dele (`npm run roteiro`); o Estúdio lista por canal, mostra a intenção, o diálogo e o tratamento sugerido, e grava as falas novas como o narrador (mp3 + manifesto; o gerador pago nunca as toca); **3 efeitos novos** (robô, bitcrush, fase) e **6 tratamentos novos** (Grande Irmão, Interceptação, Androide, Robô retrô, Talkbox, Chip 8-bit) como ponto de partida; o gosto é do ouvido dele. **Provas:** 111 testes dos arquivos tocados, inclusive o ffmpeg real rodando a cadeia de cada tratamento e a gravação e o processamento de uma fala de rádio de ponta a ponta; typecheck limpo. **Também:** `AUDITORIA_SONS.md` (achados: **do narrador só o "Combate!" tem voz: as 9 rodadas caem na voz robótica do navegador e 9 falas ficam realmente mudas** e **4 armas não têm som** — gás, trilho, EMP, escopeta) e o **kit retrô** `npm run sons-retro` (72 candidatos sintetizados por código, 36 sons × 2 leituras, 8 bits e rave, um por arma, mais aviso, comando e 2 temas de trilha; já em `.tmp/SOUNDS/ARMAS/` com o prefixo `RETRO_`; 16 testes de segurança). **Falta (R13):** o jogo ainda **não toca** o rádio (PR seguinte) e **nenhum som sintetizado foi trocado**: trocar é decisão do ouvido do Comandante; ninguém ouviu nada (o Claude não ouve).
**Para o Comandante usar amanhã:** a pasta principal (`D:\DECEPTICONS`) tem trabalho do Gemini sem commit e está num branch velho: depois do merge, atualize-a antes de abrir o Estúdio (o Claude diz como no fim da sessão).
**Próxima sessão começa com:** o que o Comandante gravar e ouvir; depois o PR do jogo tocar o rádio (gancho em `Game.ts` por `match.onFala`).

## Na `main` desde 02/11 (PR #515): a música de combate, corte 1 (Claude, P315)

**O pedido (02/11):** "melhorar os áudios, sons, música, etc". **Auditoria:** a arena não tinha música nenhuma (o único som de fundo, `ambient_bram`, não está nos arquivos); a única trilha é a do 8 de Janeiro. **Entrega (corte 1):** uma música de combate original, sintetizada no navegador (sem arquivo de terceiros): lá menor a 108 BPM, quatro compassos. O colchão do pad fica sempre; baixo, bumbo, caixa e chimbal entram conforme a energia do combate, que sobe com os acertos e os abates e cai com o tempo. Liga com a partida, carrega fora do pacote de partida, e cala na pausa. **Prova:** bancada `medicoes/musica-combate.mjs` no navegador, 7 verificações; o nível de som é medido na saída: no combate, RMS 0,067 contra 0,046 no calmo. Testes da energia e do padrão (14). **Falta:** a mixagem com as vozes do narrador (abaixar a música na fala), a música nos menus, faixas por mapa, e o gosto, que é do Comandante. **Próxima sessão começa com:** o ouvido do Comandante sobre o balanço; depois a mixagem com as vozes (P315, corte 2), numa branch nova a partir da `main`.

## Wargame com modo e DEMO, um só lugar de configuração, a chuva nas costas (Claude, P292, P293, P294, branch `claude/console-ajustar`)

**O pedido (31/10):** "o wargame como DEMO, com o modo que eu escolher; o AJUSTAR repetido; o canhão e a chuva do Colossus; resolva tudo". **Entrega:** o painel WARGAME tem MODO e [ DEMO ]; o console tem um só lugar de configuração (JOGO, CONTROLES, GRÁFICOS E SOM); a chuva de mísseis vai para as costas do Colossus-01, com o disparo pelo caminho do foguete. **Provas:** `Match.roteiroModo.test.ts` (os 4 modos rodam como espectador por 20 s), testes de encaixes (chuva nas costas dispara como foguete; fábrica volta igual do texto), CommandConsole e i18n, typecheck limpo. **Falta:** a prova no Chrome dos três (memória); o olho do Comandante no desenho das costas; SALVAR guardar o modo.
**Próxima sessão começa com:** o Chrome desta entrega; depois o desenho do canhão das costas (com a foto que o Comandante apontar) e o modo no SALVAR.

## O Wargame com câmera de verdade (Claude, P291, branch `claude/wargame-camera`)

**O pedido (31/10):** "apertei C e saiu; não consegui mudar a câmera; quero a visão aérea lenta e a troca a cada tantos segundos". **Entrega:** na partida do Wargame as teclas de câmera não saem da cena; a primeira visão é uma órbita aérea lenta sobre o centro; **1** órbita, **2** troca sozinha a cada 20 s, **3** segura o plano; o botão da HUD vira **SAIR DO WARGAME E JOGAR**. **Provas:** +4 testes da órbita e da troca automática (`camera/SpectatorCam.test.ts`), typecheck e 61 testes do HUD/Wargame verdes. **Falta:** a prova no Chrome (a máquina estava sem memória virtual para o navegador; a bancada `medicoes/wargame-painel.mjs` já existe) e o olho do Comandante.
**Próxima sessão começa com:** a prova no Chrome; depois P292 (o modo de partida no painel) e P294 (a auditoria das armas do Colossus, que pede engenharia no `Armament`).

# ESTADO ATUAL — CYBERMECH

## O Wargame diz quem vai a cada ponto, e o console sem repetição (Claude, P290 e P287 primeiro corte, branch `claude/wargame-elenco`)

**O pedido (30/10):** "o menu do wargame tá muito cru, não sei qual mech vai em cada ponto". **Entrega:** o mapa mostra cada robô **numerado onde nasce**, as ordens como **anéis com o número da batida** e a **seta** de quem vai (batida em foco); a lista **"quem é quem"** (número, chassi, nome); cada batida é **QUEM** (o lado inteiro ou **UM robô**) **/ FAZ / ONDE** ("perto de VORCARIS"), com legenda e câmera recolhidas. Contrato novo `alvo` (partida e link; o link antigo segue igual). **Provas:** +25 testes (contrato e link, partida: a ordem chega ao robô certo mesmo com andróide na frente da lista, elenco e mapa), 4 mutações derrubadas; Chrome real (`medicoes/wargame-painel.mjs`: o link leva o alvo e, na partida, só o robô escolhido recebe a ordem; foto `arte/wargame-painel-claude.png`). **No mesmo PR (P287, primeiro corte):** no console a Sala de Controle deixou de se chamar ESQUADRÃO (o nome é dos bots) e o item FICHA DE CADA BOT, que abria a mesma janela do botão ESQUADRÃO, saiu; a auditoria está em `AUDITORIA_INTERFACE.md` § 4. **Falta:** o olho do Comandante; editar o elenco dentro da janela.
**Próxima sessão começa com:** P289 (o botão de cada arma configurável no Hangar: contrato de rede; a análise e o plano em duas etapas estão na linha P289 de `ORDENS_DO_COMANDO.md`), depois a revisão geral de menus (P287).

## A ficha do esquadrão na língua do Hangar (Claude, P288, branch `claude/esquadrao-ficha`)

**O pedido (30/10):** "os chassis nessa aba do esquadrão não são todos do hangar… só dá pra escolher a arma direita ou esquerda (e agora há ombros e costas)". **Entrega:** o **Chassi** é uma lista só (Mechs na ordem do Hangar + andróide + técnico; trocar refaz o robô e guarda apelido e dificuldade), as ranhuras têm os nomes do Hangar (Braço direito/esquerdo, Costas, Ombros) e **o bot atira os encaixes extras** (o Onça tem os ombros; o titã segue com a arma de fábrica, e a ficha diz). O link leva os encaixes; o antigo segue igual. **Provas:** +27 testes (contrato, editor, simulação do bot atirando os ombros com cadência), 3 mutações derrubadas, Chrome real (`medicoes/esquadrao-ficha.mjs`, 13 verificações; fotos em `arte/esquadrao-ficha-*`). **Falta:** o olho do Comandante; online não provado numa sala (usa a mesma simulação); o botão de cada arma (P289) e o Wargame (P290).
**Próxima sessão começa com:** P289 (o botão de cada arma; o P290, o Wargame, já está feito acima).

## O microfone do Estúdio (Claude, P286, branch `claude/estudio-microfone`)

**O pedido (30/10):** "quero gravar os áudios, mas não consegui gravar, ficou mudo o microfone… continue evoluindo o estúdio". **Causa (medida neste PC):** a aba VOZES abria sempre o aparelho padrão do Windows, hoje o ponto USB "Microfone (Captain 300)", que entrega zero absoluto; só o fone Bluetooth tem sinal. **Entrega:** lista de microfones reais com escolha exata e lembrada, medidor em dB com veredito, PROCURAR O QUE FUNCIONA, ganho de entrada, parada em 2 s de silêncio e o servidor recusa tomada muda (422). **Provas:** +27 testes (`server/estudioMic.test.ts`, `estudio-vozes.test.ts`), 1 mutação derrubada, bancada no Chrome (`medicoes/estudio.mjs`, agora com um segundo navegador de microfone mudo: para sozinho e não guarda nada). **Falta:** o olho e o ouvido do Comandante (gravar de verdade; o aparelho que funciona hoje é o fone Bluetooth).
**Na mesma mensagem (P287 a P290, registradas em `ORDENS_DO_COMANDO.md`):** unificar Esquadrão, Wargame e Hangar (chassis e encaixes iguais, o botão de cada arma configurável, o Wargame dizendo qual robô vai a cada ponto). Cada uma em PR próprio.
**Próxima sessão começa com:** P288 (a ficha do esquadrão com os chassis e encaixes do Hangar), depois P289 e P290.

## Os encaixes extras de peso: o Colossus-01 e o Onça (Claude, P282 e P285, branch `claude/colossus-slots`)

**O pedido (29/10 e 30/10):** três slots no Colossus-01 (costas e dois ombros), com o teto de classe por encaixe, e dois ombros no Onça. **Entrega:** `combat/encaixesExtras.ts` (a regra pura), `MOUNTS` com as costas, o `Armament` com o cronômetro e a carga de cada extra, o Hangar com as ranhuras novas, o texto da montagem na versão 3 (só quando há extra), e o desenho com os nós das costas e dos ombros. **Provas:** +20 testes e 2 mutações à mão derrubadas; no Chrome (GPU) o Hangar mostra as cinco ranhuras do Colossus, o cerco nas costas dispara pelo clique direito e o canhão pelo esquerdo, e a foto por trás mostra a arma fora do corpo. **Falta:** o olho do Comandante; o Onça no jogo; o tiro dos extras no servidor (usa a mesma regra, mas não foi provado online).
**Próxima sessão começa com:** P283 (o quadro como objetivo dos dois times, com técnico aliado).

## O canhão de cerco que carregava e não atirava (Claude, P284, branch `claude/canhao-de-cerco`)

**O pedido (29/10):** "o canhão de cerco carrega mas não faz nada". **Causa:** no Ataque 2 (clique direito ou Q) o `Armament` zerava a carga no tick da soltura, e o cerco só atira ao soltar. **Conserto:** `segurandoCarga` em `combat/Armament.ts`; vale também online (o servidor roda o mesmo `Armament`, depois do reinício). **Provas:** +5 testes, 1 mutação derrubada, e no Chrome (Colossus-V4) o clique direito antes não soltava o obus e agora solta. **Falta:** o olho dele.
**Próxima sessão começa com:** P283 (o quadro como objetivo e o técnico aliado) e P282 (Colossus-01: costas e ombros).

## A fase escura e a visão noturna (Claude, P281, branch `claude/visao-noturna`)

**O pedido (29/10):** *"quero jogar na fase escura e ver só os olhos, os fogos, os rastros e explosões, e que isso reflita nos objetos e mechs… só o ARARA, o Lancer e os andróides têm visão noturna nativa; os outros usam como módulo extra"*; e, sobre o número de jogadores: *"vamos manter, sem alterar protocolo novo"* (a banda segue em 15 unidades; o P280, o meu time online, ficou congelado).
**Entrega:** a escuridão (0 a 1) é a vida que falta ao quadro de luz (`Match.escuridao`; o chip FASE ESCURA do Comandante a força); a cena escurece (`fx/FaseEscura.ts`), **as luzes da cidade se apagam** e só aparecem os olhos, os rastros, o fogo e as explosões, que **iluminam o que está perto** (3 luzes pontuais num pool). Visão noturna = chassi (Arara, Lancer, andróides) ou **módulo extra** no Hangar (0,5 t, no lugar do gerador); com ela a tela fica verde. Sem ela, os bots veem 30% do alcance no escuro, exceto quem acabou de atirar (G14). **Restrita** (`modo:fase-escura`), **só Cidade Neon offline**, sem protocolo novo.
**Provas:** +47 testes (regras, chassis, Hangar, bots no escuro, cena, cidade), Chrome na GPU real (Vega 11): capturas `.decepticons/arte/fase-escura-*`; pacote de partida 488,0 KB (folga 12 KB).
**Falta:** o olho do Comandante (piso das luzes, verde, força das luzes dos tiros); a praia, o Bunker, a Amazônia e o 8 de Janeiro; o online; o quadro como objetivo + técnico aliado (P283); os 3 encaixes do Colossus-01 (P282).
**Próxima sessão começa com:** o que o Comandante achar do escuro; P283 (o quadro como objetivo e o técnico aliado) e P282 (Colossus-01: costas e ombros), cada um em PR próprio.

## Quem entrou nas salas (Claude, P275, branch `claude/quem-entrou`)

**O pedido (29/10):** "temos q registrar o login ou nick deles pra eu saber de fato quem e quando estava nas salas". **Entrega:** o diário de presença (`server/presenca.ts`, `presenca.json`, 30 dias, sem IP): apelido, conta (número; o painel mostra `c***@exemplo.com`), sala, mapa, entrou, saiu; a seção **QUEM ENTROU** na janela SERVIDOR e `GET /admin/presenca` (só o dono). LGPD: apagar a conta apaga as entradas; baixar os dados as leva; política e inventário atualizados, **`POLITICA_VERSAO` = 2026-10-29.1**. **Provas:** +25 testes, 6 mutações derrubadas, Chrome (GPU) com 4 jogadores e uma conta. **Endurecido no mesmo dia (revisão de segurança automática; `claude/presenca-endurecida`):** a saída roda na mesma fila da sala (sem visita "na sala agora" que ninguém fecha), tetos separados para convidados e contas (2.000 + 2.000), a volta em 2 min junta na mesma entrada, uma visita aberta conta no máximo 12 h; +6 testes, 4 mutações derrubadas. **Falta:** o olho do Comandante; busca por apelido ou conta.
**Próxima sessão começa com:** P280 (o meu time online: aliados na sala, dividem os 15 do P273) e P281 (apagão e visão noturna).

## As luzes das caixas sem o halo que andava (Claude, P277, branch `claude/luzes-sem-tremor`)

**O pedido (29/10):** "as luzes e os detalhes nos containers e boxes ficam borradas, brilhando e se movendo conforme eu ando". **Causa (fotografada na Vega 11):** o contorno de 1 px de cada caixa a ×3 de HDR: passa do limiar do bloom a cada passo da câmera, vira um halo largo que lava o corpo da máquina e anda de pixel em pixel. **Conserto:** contorno ×1,5 nas máquinas (`BRILHO_DO_CONTORNO_DE_MAQUINA`) e ×1,8 nas arestas dos contêineres (`BRILHO_DAS_ARESTAS_DO_MOBILIARIO`); +4 testes; antes e depois em `.decepticons/arte/luzes-*`. **Falta:** o olho do Comandante; os prédios da praça seguem a ×3 (se o halo deles também incomodar, a mesma constante).
**Próxima sessão começa com:** a opinião dele sobre as caixas; P275 (quem entrou nas salas), P280 (o meu time online), P281 (apagão e visão noturna).

## O teto de robôs online sobe para 6/6/1 (Claude, P273, branch `claude/teto-de-robos`)

**O pedido (29/10):** "será q precisamos manter o limite de 3 mechs e 3 androides? … mais bots, pra mais emoção". **Medido** (`CAPACIDADE.md`): CPU do servidor < 1 ms/tick com 26 robôs; Vega 11 desenha 13 robôs como 7 (p50 10,4 × 10,6 ms); **a banda (8 KB/s por jogador) é o limite: 15 unidades.** **Entrega:** o esquadrão online vai a **6 Mechs, 6 andróides, 1 técnico** (`ROOM_BOT_*`, `ROOM_UNITS` 15); +1 teste (1 a 8 humanos nunca passam de 15), 3 mutações derrubadas. **Decisão do dono em aberto:** para mais que 15 unidades, subir a meta de banda (24 unidades = 11,9 KB/s) ou o delta (protocolo novo). **Falta:** o aliado online ("o meu time", P280) divide esta mesma conta de 15 unidades.
**Próxima sessão começa com:** o que o Comandante achar da sala com 13 robôs; P280 (o meu time online), P275 (quem entrou), P277 (o borrão das luzes), P281 (apagão e visão noturna).

## O cabeçalho do console e a data do build (Claude, P278 e P279, branch `claude/cabecalho-e-build`)

**Os pedidos (29/10):** "adicione no rodapé a data e hora do último build" e "o online · sala arena… está por cima do cabeçalho; os botões do cabeçalho, mais intuitivos e coesos". **Entrega:** o rodapé mostra o instante do build (`buildInfo.ts`, o `site.mjs` grava `VITE_BUILD_EM`); o selo online mora no cabeçalho (`#cc-online`, `Game.escreverStatusOnline`) e o do HUD some com o console aberto; os botões em dois grupos (piloto, azul; Comandante, amarelo, com SAIR vermelho); a 1280 px os grupos descem para duas linhas. **Provas:** +6 testes, Chrome (GPU) a 1280 e 1920, online contra um servidor local, 0 erros de console; capturas em `.decepticons/arte/`. **Em fila, uma por PR:** teto de robôs e o meu time online (P273, P280); quem entrou na sala (P275); o borrão das luzes (P277); o apagão com visão noturna (P281). (O P276, o tiro que não acertava online, já está na `main`.)

## Os tiros que não acertavam online: o modo da sala (Claude, P276, branch `claude/modo-da-sala`)

**O pedido (29/10):** "meus tiros parecem que não estão pegando nos inimigos… também não consigo pisar neles". **Causa:** o link dele tinha `modo=survival` (o JOGAR ONLINE só acrescenta `sala` e `nome`) e o cliente montava a Sobrevivência local por cima da sala: as ondas "ALVOS 0/2" eram robôs fantasma (sem dano nem pisão), e o servidor jogava Deathmatch. **Conserto:** `modoDaSala` (`shared/net/mapa.ts`) é a conta única do servidor e do cliente; online, a Sobrevivência só vale no 8 de Janeiro; o mesmo código com ou sem `modo=survival` é a MESMA sala; o seletor de modo mostra o que roda. **Provas:** +3 testes (contrato, cliente, servidor de verdade), 3 mutações à mão derrubadas, e no Chrome (GPU) contra um servidor local: HUD "RODADA", 0 robôs locais, um tiro do jogador tirou 13 de vida do andróide da sala.
**Junto neste PR:** as nove ordens da mensagem de 29/10 registradas (P273 a P281) e a resposta da publicidade (P274, `MARCA_E_ANUNCIOS.md` § 7.1). **Em fila, uma por PR:** rodapé com a data do build (P278) e cabeçalho (P279); teto de robôs e o meu time online (P273, P280); quem entrou na sala (P275); o borrão das luzes (P277); o apagão com visão noturna (P281).

## Os supercomputadores da praça (Claude, P272, branch `claude/supercomputadores`)

**O pedido (28/10):** "essas caixas do centro do cenário… supercomputadores… macminis gigantes… servidores blindados… que chame atenção pela beleza".
**Entrega:** `environment/Supercomputadores.ts`: as 6 barricadas e os 2 quiosques viram **mini-Mac gigante, rack blindado, banco de servidores e nó quântico** (a variante sai do formato), do tamanho exato do colisor; LEDs que respiram no shader e apagam sem o transformador. Só no navegador, pelo cenário da cidade (`Destructibles.estilizar`); o servidor e as regras seguem com a caixa.
**Custo (Vega 11, rodadas alternadas main × branch, mediana de 3):** GPU p50 13,1→12,9 (nascimento), 16,5→17,0 (alto), 11,2→11,4, 11,0→11,5, 11,1→11,5 ms (dentro do ruído de ±2); **+16 chamadas de desenho**; 0/480 poses com NaN na GPU real; pacote de partida 482,4→482,5 KB. **Testes:** +8 (o desenho cabe no colisor, o orçamento de triângulos, as luzes, o shader sem `pow`/`sqrt`/`log`, o gancho nas barricadas em pé e nas que voltam).
**Falta:** o olho do Comandante (gostou da linguagem? mais cor? os contêineres e os três prédios do meio também?).
**Próxima sessão começa com:** o que o Comandante pedir sobre as máquinas; a decisão sobre a publicidade dinâmica (P271: `MARCA_E_ANUNCIOS.md` § 7).

## O esquadrão das salas online e o Ajustar sem INIMIGOS/NOMES (Claude, P270, PRs 1 e 2)

**O pedido (28/10):** "quando eu jogo online, queria poder configurar os times no botão ESQUADRÃO… esse botão compete com o Ajustar" (último item antes de lançar). **Respostas dele:** só o Comandante monta, para todas as salas; uma porta só, o ESQUADRÃO.
**Entrega (PR 1, só servidor; a janela vem no PR 2):** `client/src/sim/esquadraoOnline.ts` (o contrato: teto da sala = 3 Mechs, 3 andróides, 1 técnico, sem aliados nem titãs; `esquadraoParaOnline`, `esquadraoDasRegras`, `montagemDoBot`), `server/esquadraoOnline.ts` (o armazém, `esquadrao-online.json`), as rotas `GET /admin/esquadrao` e `POST /admin/esquadrao/gravar` (chave do dono), `ArenaRoom` montando a partida com o esquadrão e dizendo no roster o chassi e a arma de cada robô (`BotSystem.kitOf`), e `remotoDoRoster.ts` desenhando o robô de IA com ele. **Vale nas salas novas** da Cidade Neon e da Estação dos Cabos; sem esquadrão salvo, as regras de sempre. **Sem subir o protocolo.**
**PR 2 (a janela):** no modo Comandante e online, o botão **ESQUADRÃO** abre o **ESQUADRÃO DAS SALAS ONLINE** (`SquadPanel` em modo online, `squadOnline.ts` liga ao servidor; inimigos e ficha, sem aliados, 3 prontos, o teto no pé); **SALVAR PARA TODOS** grava (a chave é a da janela SERVIDOR); a sala vazia com o esquadrão de antes **fecha na hora**. **INIMIGOS e NOMES saíram do Ajustar** (cabe sem rolagem) e **"Atacam ao mesmo tempo"** foi para o pé da janela, offline e online.
**Testes:** +35 nos dois PRs (21 e 14) e **8 mutações à mão (PR 1), todas reprovadas**; **bancada no Chrome (GPU real) contra um servidor local de verdade:** sem a chave a janela abre com o motivo e sem gravar; com ela, monta um Marauder brabo (ALFA), grava, o servidor guarda, a sala nova nasce com ele (o cliente vê o chassi na montagem) e o Ajustar não tem mais as duas seções; 0 erros de console. **Falta:** o olho e a mão do Comandante, jogando online com um esquadrão dele.
**Próxima sessão começa com:** o que o Comandante estranhar na janela; as outras duas ordens do dia (P271 e P272, em `ORDENS_DO_COMANDO.md`): as caixas do centro viram supercomputadores (em campo) e a publicidade dinâmica nos outdoors (aguarda a decisão dele).

## EM BRANCH — NÃO ESTÁ NO AR: o cérebro do time dos bots (Claude, P269, branch `claude/ia-time`)

**O pedido (28/10):** bots mais estratégicos: "combinar" ataque e defesa, "como se se comunicassem". **Entrega:** `CerebroDoTime.ts` (um por lado): **pinça** (fixador de frente, 1–2 flanqueadores de lados opostos sem atirar, sinal "VAI!", golpe de 5 s com vaga extra), **reagrupar**
(patrulha espalhada se junta) e as falas no feed; `BotController` ganhou `tarefa`/`segurarFogo`/`golpe`; o diretor ignora quem segura fogo e conta o flanco da pinça no cerco. Interruptor `ia:time` (`funcionalidades.ts`): **RESTRITO**, vale também no servidor (`ArenaRoom.aplicarVisibilidade`).
**Medido (bancada bot×bot, 40 duelos 4×4):** o time com cérebro vence **45% / 38% / 45%** (fácil/normal/difícil): **sem ganho de força**; FOCO no mais fraco = 3% no normal (descartado). Dano no jogador parado: fácil 0,0%, normal +4,1%, difícil −19,5%. Por isso restrito: o Comandante julga jogando (como conferir: ORDENS P269).
**Testes:** +12 (`CerebroDoTime.test.ts`: pinça forma e golpeia, vaga extra só no golpe, fácil não faz pinça, interruptor solta a tarefa, determinismo, reagrupar) e `regras.test.ts`; as fotos de `esquadraoPadrao.test.ts` foram refeitas e o interruptor desligado reproduz as antigas. **Falta:** cobertura mútua, recuar e curar, Bandeira, voz, falas online (`ORDENS P269`).
**Próxima sessão começa com:** a opinião do Comandante depois de jogar com `ia:time` ligado; se confirmar "mais esperto", liberar no painel; se não, o próximo experimento da bancada (cobertura mútua, sem teto de atacantes).


## A praça urbana: cobertura e combate de perto dentro da praça (Claude, P268, branch `claude/praca-urbana`)

**O pedido (28/10), respondendo se os prédios iam dentro da praça ou fora dela:** "na praça, pra dar cobertura, e reduzir o alcance, fazer combate urbano com diferentes espaços de conflito e que permita diversas estratégias; não precisa lotar, só mais alguns prédios e elementos, tipo uma praça de playground porém urbana".
**Entrega:** `environment/ArenaUrbana.ts` (dados puros): **9 prédios** de 8 a 16 m, **5 contêineres** de 5,2 m, **2 quiosques** que quebram, o **playground** (plataforma de 3 m, 4 degraus de 0,6 m, rampa de 23°, um cubo), em quatro espaços: Beco do Mercado (SE), Pátio (NE), Playground (NO), Contêineres (linhas).
`environment/ArenaMapa.ts` mede a planta (alcance, conexão, frestas). **Alcance (a olho de Mech):** pares a 30–60 m que se enxergam **83% → 60%**, a 60–100 m **67% → 36%**; vista média nos 12 nascimentos **64 → 47 m**; 9,7% da praça coberta.
**Mexe no jogo, não só no desenho:** colisores novos no servidor também; **protocolo 24**; 12 pontos extras de nascimento andaram (`sim/nascimentos.ts`); as fotos do esquadrão padrão foram refeitas; o quiosque tem os ids 6 e 7 (os das barricadas antigas não mudam).
**Custo (Vega 11, janela do Comandante, rodadas alternadas main × branch, mediana de 3):** GPU p50 igual dentro do ruído (nascimento 12,7 → 12,8 ms; alto 16,9 → 17,0; avenida 11,4 → 11,1; Pátio 10,9 → 10,7; a vista do Mercado subiu 9,8 → 11,2 ms com o p95 igual, 21,1 → 20,9); chamadas de desenho +8 a +21 (nascimento 118 → 139); abertura do jogo 2114 → 2255 ms (ruído). CPU: nada por quadro; pacote de partida **480,7 KB/500 KB**. **Verificado:** **+23 testes** (`ArenaUrbana.test.ts`: não lota, nada em cima de nascimento/zona/ponto de Domínio/bandeira/titã/transformador, vão zero ou ≥ 3,8 m, todos os nascimentos ligados para o Mech e o Marauder, o Colossus cruza até o transformador e a pista dele fica livre, o alcance cai, o Mech sobe os degraus e a rampa e desce, os quiosques quebram); 8 mutações à mão, todas reprovadas (prédio sobre nascimento, fresta que prende, contêiner na pista do Colossus, prédio sobre o ponto do titã, degrau de 0,9 m, rampa e prédios sem colisor, quiosques antes das barricadas); bots nas partidas sem aumento de travamento (offline 2/48 janelas contra 3/45 da main; servidor 0/61 nos dois).
**Falta:** o olho do Comandante (densidade, onde mexer); o playtest com gente nos becos (os de 7 m ficam fechados ao Colossus de propósito: refúgio); mais playground (balanço, passarela) e a Estação dos Cabos.
**Próxima sessão começa com:** o que o Comandante estranhar na praça.

## Os outdoors alternam e ganham um painel do Comandante (Claude, P267, branch `claude/outdoors-painel`)

**O pedido (28/10), depois de ver o P266 no ar ("absurdamente BOM!"):** "tá meio poluído": um painel para configurar **quantas imagens aparecem**; as imagens **trocam a cada 10 ou 15 s**; **mais prédios pequenos e médios** (a fase tem muito espaço vazio); **a Azonix nos banners da Serafim**.
**Entrega:** o chip **OUTDOORS ▸** (modo Comandante) abre `OutdoorsPanel.ts`: quantos aparecem (padrão **26 de 40**), o período (5–30 s, padrão **12**; atalhos 10 s e 15 s) e quais anúncios entram; cada mexida aparece na hora, **SALVAR PARA TODOS** grava no servidor
(`shared/outdoors.ts`, `server/outdoors.ts`, `GET /outdoors` público, `POST /admin/outdoors` com a chave do dono), FECHAR desfaz o que não foi salvo. **Cada outdoor alterna** entre as 9 imagens num anel (a logo plana fica fixa), com falha de sinal na troca; o brilho e o reflexo no chão
seguem a imagem de agora; o prédio de um outdoor que sai do ar volta a acender as janelas. `Outdoors.ts` passou a **uma malha só** de painéis (eram 7). **Azonix** no "SOFTWARE BUREAU" (a lista com acento ficou na Chakra: a Azonix não tem cedilha nem til).
**Custo (Vega 11, janela do Comandante, rodadas alternadas main × branch, mediana de 3):** GPU por quadro igual dentro do ruído de ±2 ms desta máquina (13,0→13,2 ms no nascimento, 16,9→16,6 do alto do prédio Serafim, 11,3→11,2 rente à avenida, 10,2→9,9 de baixo do holograma, 10,7→9,9 de perto de uma logo plana); **18 a 28 chamadas de desenho a menos** (147→129 parado, 157→129 do alto, 79→62 na avenida); abertura do jogo 2,4→2,2 s. CPU: nada por quadro; pacote de partida **479,4 KB/500 KB**; **0/512 poses com NaN** na GPU real (8 pontos × 16 guinadas × 4 inclinações). **Testes:** +23 (`Outdoors.test.ts`, `OutdoorsPanel.test.ts`, `server/outdoors.test.ts` e os da cidade); 8 mutações à mão, todas reprovadas; prova no Chrome com o mouse de verdade (painel, salvar, desfazer, sem a chave).
**Falta (precisa da resposta do Comandante):** os **prédios pequenos e médios** — dentro da praça jogável (com colisão no servidor, os bots e o WARGAME) ou só enfeite fora dela? **Também aberto:** os banners na Estação dos Cabos (`MARCA_E_ANUNCIOS.md` § 5); a licença da `Azonix.otf`.
**Próxima sessão começa com:** a resposta sobre os prédios.

## Telões: o vídeo dava 404 no site publicado (Claude, branch `claude/telao-caminho-do-video`)

**Achado (28/10, na prova ao vivo do P266, console do Chrome em cybermech.online):** `ArenaTelao.ts` montava o vídeo como `/telao/<arquivo>` (absoluto na raiz do site), mas o jogo vive em `/jogar/` e os clipes
estão em `jogar/telao/` (200 lá, 404 na raiz): quando o Comandante escolhia um vídeo para um telão da Cidade Neon, ele nunca tocava no site (só no dev). **Conserto:** `${import.meta.env.BASE_URL}telao/<arquivo>`, o mesmo que os
outdoors já usam. **Teste:** +1 em `ArenaTelao.test.ts` (base `/jogar/`; falha contra o caminho antigo, conferido por mutação). Não confirmei com o vídeo tocando no site: a prova é o 404 sumir do console depois do deploy.

## A marca da Serafim na Cidade Neon: outdoors dos produtos e o holograma da logo (Claude, P266, branch `claude/outdoors-da-marca`)

**O pedido (28/10), depois de ver a cidade ("ficou tudo muito bom"):** a logo (`vetorserafim.png`) como o holograma principal, em 3D, sobre o Prédio Serafim, e plana mais 2 vezes no cenário; os outros outdoors divulgando os
produtos dele — Olho do Pai (com `odp.serafimweb.com`) e o Serafim Web Software Bureau —, na vertical e com um que alterna; prédio com outdoor sem janela acesa; "mais qualidade nos prédios".
**Entrega:** 10 imagens verticais (467 KB; `npm run anuncios` as gera de `scripts/anuncios/*.html`; o catálogo é `client/src/brand/anuncios.ts`); 40 outdoors no lugar dos telões inventados (`Outdoors.ts`: painéis de LED
instanciados com brilho aditivo; as duas logos planas vêm de um layout em duas passadas, e ficam à vista de quem nasce); o holograma 3D da logo (`HologramaSerafim.ts`: 36 m, até 17 camadas, giro lento, anel e feixe no teto,
aura) com o número de camadas caindo com a distância da câmera. Fatos que o texto pode afirmar e a pendência da Estação dos Cabos: `MARCA_E_ANUNCIOS.md`.
**Custo (GPU real, AMD Vega 11, janela do Comandante 1549×925@1,25, rodadas alternadas main × branch, mediana de 3):** GPU por quadro: 13,0→12,5 ms no ponto de nascimento, 15,9→17,6 do alto do prédio Serafim, 10,6→12,0 rente à avenida, 8,6→9,7 de baixo do holograma, 8,6→9,5 de perto de uma logo plana — cerca de +1 ms (+8%), dentro do ruído de ±2 ms entre rodadas desta máquina; chamadas de desenho 125/144/69/57/55 contra 141/136/68/48/45 da main nas mesmas cinco vistas. Ligando e desligando uma camada de cada vez: os outdoors com o brilho em volta custam ~0,5 ms no nascimento e ≤ 0,3 ms nas outras vistas, o reflexo no chão 0 a 0,5 ms, o holograma ~0 (com 4 a 10 camadas) — mínimo e quartil baixo de 6 ciclos de 2,5 s com a máquina quieta. CPU: nada alocado por quadro
(o relógio, o giro do holograma e uma distância); pacote de partida **478,7 KB/500 KB** (as imagens e a textura do holograma, 505 KB, baixam em segundo plano só para quem abre esse mapa; ~28 MB de textura na GPU).
**Verificado:** 0/512 poses com NaN na GPU real (8 pontos × 16 guinadas × 4 inclinações, inclusive olhando para cima, onde estão o holograma e o topo dos outdoors). +21 testes (`anuncios.test.ts`, `HologramaSerafim.test.ts` e os da cidade); smoke OK; fotos `arte/cidade-neon-marca-*-claude.jpg`.
**Falta (o Comandante escolhe a ordem):** os banners na **Estação dos Cabos**, em menor frequência (registrado em `MARCA_E_ANUNCIOS.md` § 5); **mais qualidade nos prédios** (pódios e recuos, passarelas entre as torres, o
topo, o detalhe da fachada): o próximo PR. O ping mostra `< 5s` (o tutorial do produto documenta menos de 5 s; o exemplo dele dizia `< 3s`).
**Decisão em aberto:** `Azonix.otf` (o título do jogo, P135) não consta em `client/public/fonts/LICENCAS.txt`: confirmar a licença de uso comercial (não é deste PR; os anúncios usam Chakra Petch e Barlow, ambas OFL).
**Próxima sessão começa com:** o olho do Comandante na cidade; depois a qualidade dos prédios.

## publicar: PR já mergeado antes não é mais "falha" (Claude, branch `claude/publicar-ja-mergeado`)

**Achado (28/10, no #474 da Cidade Neon):** o PR foi mergeado por fora enquanto o `npm run publicar` esperava o CI; o script leu `MERGED` e saiu com **código 1 e "nada foi mergeado"**, embora o resultado fosse o
desejado (quem lê "falhou" pode refazer o trabalho). **Conserto (`scripts/publicar.mjs`):** `MERGED` = sucesso (devolve o merge, não chama `pr merge`, e ainda apaga o branch, porque o `MERGED` está confirmado);
não espera mais a mergeabilidade de um PR que não está aberto (voltava `UNKNOWN`, 60 s à toa); o branch que o merge do GitHub já apagou vira "já estava apagado" (antes: "apague à mão"). PR **fechado sem
merge** continua falha. **Testes:** +4 em `server/publicar.test.ts` (3 falham contra o script antigo, conferido; o 4º guarda que o fechado não afrouxou).

## A Cidade Neon vira uma cidade — PR2: torres, telões, ruas e chão molhado (Claude, P264, branch `claude/cidade-neon-cidade`)

**O pedido (28/10), depois de ver a PR1:** "eu quero que o cenário fique nesse nível dos exemplos que enviei. ainda tá muito longe disso" (os 4 quadros de uma cidade cyberpunk à
noite) e "os postes eu achei meio frágeis... só se tiver o desenho das ruas, pois nesse quadriculado não achei bom não". **Achado:** a PR1 pôs enfeite solto num chão quadriculado e num
horizonte de caixas sem janela; os quadros mostram o contrário, a praça **dentro de uma cidade** (leitura em `REFERENCIA_VISUAL.md` § 9).
**Entrega (7 arquivos `CidadeNeon*.ts`, só desenho, um pedaço sob demanda):** (1) três filas de torres em volta (221 caixas — 129 torres, 55 coroas e 37 antenas — numa chamada de desenho: janelas finas, neon nas quinas e
coroas, lojas no térreo, névoa em camadas); (2) 47 telões que passam anúncios (troca a cada 6–13 s com falha de sinal, grafismos animados), letreiros de bandeira (glifos inventados, uns
queimados) e desenhos em tubo de neon; (3) **a rua desenhada** no lugar do quadriculado (calçadão, avenida em anel com faixas, meio-fio, faixas de pedestre), postes de 10 m na calçada (uns
piscam e falham) e bueiros com vapor; (4) **chão molhado**: poças e o reflexo de cada telão e poste no asfalto por um truque de vertex shader, sem desenhar a cena duas vezes. Saíram a
`ArenaAderecos.ts` da PR1, o horizonte antigo (80 caixas + estrelas) e a captura da PR1; as janelas dos 3 prédios do meio ficaram finas e de luz branca tingida; névoa e horizonte, mais turquesa.
**Custo (GPU real, a AMD Vega 11, janela do Comandante 1549×925@1,25, rodadas alternadas main × branch, mediana de 3):** GPU por quadro 12,5→12,1 ms parado, 16,1→16,3 do alto, 9,6→10,9 rente
à avenida; triângulos 47,9 mil→30 mil; abertura do jogo +~0,8 s (compilar shaders na tela de carregamento); pacote de partida **478,4/500 KB** (baixou 3 KB), a cidade é um pedaço de 15 KB gzip;
zero luz dinâmica, zero colisor (o servidor não tem a cidade: colisor só no cliente desalinharia a predição online), nada alocado por quadro.
**Verificado:** 0/672 poses com NaN na GPU real; +40 testes (`CidadeNeonLayout/Cenario/Shaders.test.ts`: nada invade a praça, interface vértice/fragmento dos shaders, a luz da cidade cai com o
transformador); smoke OK; fotos `arte/cidade-neon-{cidade,avenida,alto,letreiros}-claude.jpg`.
**Falta (o Comandante diz o que vem primeiro):** pista elevada e passarelas, hologramas, tráfego de veículos voadores, chuva, mobília de rua, os 3 prédios do meio da praça (ainda caixas); só 8
anúncios (o padrão repete). **Próxima sessão começa com:** o olho do Comandante jogando, e o que ele estranhar.

## WARGAME: não tinha como sair (Claude, P265, branch `claude/wargame-sair`)

**Testou o P263 (o conserto de não jogar sem querer) e achou que ainda ficava "travado":** trocar de mapa pelo
seletor normal não escapava do WARGAME (`MapLinks.ts:mapHref()` carregava o `?wargame=` antigo junto com o mapa
novo — corrigido, sempre tira o parâmetro) e os quatro lugares que soltam a câmera de espectador (tecla C, botão
"voltar ao mech", ⎵/Esc, botão de câmera) eram cópias quase iguais que não sabiam que, no WARGAME, isso não basta
(`wargameAtivo` trava o controle de propósito) — unificados num `sairDoWargame()` só, que recarrega sem o link.
**Provado no Chrome:** depois de C, segurando W, o Mech andou 6,17 m (zero antes). **Testes:** +1 em `MapLinks.test.ts`.
**Em paralelo no mesmo pedido, nasceu o P264** (atmosfera cyberpunk da Cidade Neon) — branch separada, ver acima.

## WARGAME: o Comandante ainda jogava, e os bots pareciam fracos (Claude, P263, branch `claude/pos-wargame`)

**Jogou o P262 pela primeira vez e achou dois problemas:** "ele me colocou como player! quero nao precisar eu jogar,
apenas eles... achei meio burros os npcs tambem!" **Achado:** `Game.ts:setPlaying()` religava `player.active` toda
rodada, sem checar o modo WARGAME — a câmera de espectador escondia a visão, mas WASD/mira/tiro continuavam vivos
por trás dela (a bancada anterior nunca simulou tecla nem clique, só UI). Corrigido com um `wargameAtivo` que trava
`player.active = false` o episódio inteiro; **provado segurando W + clique por 1 s: deslocamento do Mech = 0**.
Os dois esquadrões também saem do `BOT_SKILL_NORMAL` (calibrado para ser justo contra humano) para `BOT_SKILLS.dificil`
(sem jogador para proteger, não há motivo pra segurar a IA). **Testes:** +1 em `Match.roteiro.test.ts`; `npm run
typecheck` e os arquivos afetados verdes; `npm run check` completo no hook do push.
**Falta:** o resto de "muito básico" — o Comandante não detalhou o quê; fica para quando ele apontar.
**Em paralelo, o mesmo pedido trouxe a ordem P264 (atmosfera cyberpunk-distópica da Cidade Neon): ver `STATUS_REAL.md`
e `ORDENS_DO_COMANDO.md` para o que está em andamento.**

## WARGAME completo — painel, mapa clicável, câmera e legenda (Claude, P262, PR 2/2, branch `claude/wargame-mapa`)

**O PR1 (abaixo) já tinha a simulação; este PR entrega o resto, tudo de uma vez** — na prática, o que o plano
original separava em PR2 (mapa) e PR3 (painel/link/câmera) virou **um PR só**: o mapa clicável só serve dentro do
painel, e o painel só vale a pena com o mapa — testar/entregar os dois pela metade não dava nada demonstrável ao
Comandante (regra 16: toda entrega visível fecha com o caminho para vê-la).
**O que entra:** `client/src/ui/RoteiroMapa.ts` (o mapa clicável, 100% em cima do `TacticalRadar` já existente —
mesma planta, mesmas cores de ponto; a conta de tela virou `transformeDoRadar`, exportada e com teste de ida-e-volta);
`client/src/ui/WargamePanel.ts` (o painel: elenco **padrão**/**o meu** como a tela CAMPANHA já faz, lista de
batidas — tick, ordem+ponto marcado no mapa, legenda, câmera —, salvar/link `?wargame=`, EXECUTAR);
`client/src/core/RoteiroStore.ts` (guardar no aparelho, molde de `CampanhaStore`); `client/src/ui/WargameCaptionOverlay.ts`
(a legenda na tela, CSS adaptado de `CutsceneJaneiro.ts`); o chip `WARGAME ▸` no Modo Comandante (mesma família de
TELÕES/VISIBILIDADE — ferramenta só do dono, não entra no catálogo `funcionalidades.ts`); e o `Game.ts` detecta
`?wargame=`, entra direto no modo espectador (reaproveita o `SpectatorCam`/CFTV já pronto, zero câmera nova) e
**esconde o HUD do jogador** (`hud.toggleVisibility()`, o mesmo botão do F1 — não faz sentido mostrar vida/munição
de um Mech que ninguém pilota).
**Decisão que mudou do plano original:** o Mech do Comandante continua nascendo normal (`addPlayer` de sempre,
zero risco nos ~78 lugares de `Game.ts` que dependem de `this.mech`); só ganhou `espectador: true` no `Match`, que
tira os `players` da mira dos bots — mais barato e seguro que tentar eliminar o Mech do jogador (registrado em
`HISTORICO_DE_DECISOES.md`).
**Verificado no Chrome de verdade (não só o smoke):** `.tmp/wargame-check.mjs` (script de bancada, fora do
repositório) monta um episódio de 2 batidas pelo painel inteiro (nomear, elenco, marcar duas ordens no mapa,
legenda, câmera fixa), aperta EXECUTAR, entra no jogo e deixa rodar — **zero erro de página** em duas rodadas.
Capturas: `arte/wargame-painel-claude.jpg` (o painel com as duas batidas marcadas) e `arte/wargame-episodio-claude.jpg`
(o episódio rodando: os dois esquadrões em contato, a legenda "O ATAQUE COMEÇA" na tela, sem HUD de jogador).
**Falta (v2, não bloqueia):** a ordem `focus` (mirar num Mech específico, não um ponto); outros mapas além da
Arena (`camerasDoMapa` só tem câmeras fixas nela); mais itens no mapa/robô novo (P255, à parte).
**Testes:** `TacticalRadar.test.ts` (4, a conta de tela), `RoteiroStore.test.ts` (8). `npm run check` verde, inclui
o orçamento do pacote (480/500 KB, `WargamePanel` sob demanda e fora do que todo jogador baixa).

## WARGAME PR 1/2 — o roteiro e a simulação, sem tela ainda (Claude, P262, branch `claude/wargame`)

**O pedido do Comandante:** transformar a gameplay num "filme"/episódio roteirizado — dois times com objetivos,
ele monta e aperta PLAY, grava com F9. Confirmado na conversa: os bots agem **naturalmente** (mesma IA de combate
de sempre; o roteiro só dá ordem de alto nível em momentos-chave, "como um técnico gritando da lateral"), autoria
por **clique num mapa fixo**, um **painel só** no Modo Comandante, botão EXECUTAR cai na tela de jogo sem o
Comandante controlar o Mech (só troca de câmera, como o CFTV já faz).
**Este PR1:** `client/src/sim/Roteiro.ts` (contrato tick-indexado + `RoteiroStepper`, zero alocação fora das
batidas de verdade — G4/G5 — + link `?wargame=`, no molde de `campanha.ts`/`esquadrao.ts`) e `Match.ts` ganha
`MatchOptions.roteiro`/`espectador` + `aplicarRoteiro()`, disparando `BotController.receiveOrder('hold'|'follow', …)`
em cada tick marcado — **o mesmo jeito que `Match.ts` já usa hoje** para a Resistência e o Domínio (`brainOf(m)
.receiveOrder('hold', ponto, null)`, 4 chamadas existentes). **Achado confirmado lendo o código:** com `players`
vazio (sem `addPlayer`), os dois esquadrões já se caçam sozinhos (`refreshEnemyTargets`/`allies.targets`) — zero
mudança de regra precisou disso, só o roteiro por cima. `espectador: true` exclui os `players` da mira dos bots
(para o PR3, quando o Mech do Comandante existir mas ficar parado assistindo).
**Testes:** `Roteiro.test.ts` (20), `Match.roteiro.test.ts` (4: nasce sem jogador, batida sem ordem não toca bot,
3 batidas disparam nos ticks certos em ordem, sem roteiro nada dispara). `npm run check` verde.
**Falta (PR2/PR3):** o mapa clicável de autoria, o painel WARGAME, o link no boot do `Game.ts`, a câmera (reaproveita
o `SpectatorCam`/CFTV já pronto) e a legenda. Nada disto aparece no jogo ainda — é só a simulação por baixo.

## EM BRANCH — NÃO ESTÁ NO AR: CAPA DE GELO NO CONGELADO, CHOQUE/ATORDOAMENTO MAIS FRACOS, MOTOSSERRA MAIS BAIXA (Claude, branch `claude/gelo-choque-som`, P261, 27/10)

**O Comandante, depois de jogar o P260:** "quando o robô receber a carga de gelo suficiente pra congelar, seria bom adicionar um efeito de gelo nele, sutil (...) seria mais como uma capa de gelo, uma cobertura (...) pra ficar bonito e realista. acho que a luz ainda continua piscando forte em geral. O barulho do ataque da motoserra pelos droids está MUITO ALTO! VAMOS MELHORAR o som e luz em geral pra lançarmos."
**Capa de gelo (pedido novo):** `meshKit.ts:frostShell()` — uma malha a mais por Mech (torso, 15–20% maior, material translúcido), invisível e sem custo fora do estado congelado; sobe em ~0,35 s ao congelar, desce em ~1,3 s ao derreter. Ligada em `mechBlueprint.ts` (Vector-09, Ferret, pesado, Colossus) e `Android.ts` (inclui os manifestantes/rebeldes do 8 de Janeiro). **Achado no caminho:** criar a malha ANTES de `batchRigMeshes()` a varreria junto com o resto do casco (ela remove e funde todo `THREE.Mesh` de cada pivô) — criada depois, fica de fora do lote e intacta. Orçamento de draws articulados do blueprint subiu de 10 para 11 (`mechBlueprint.test.ts`, de propósito).
**"A luz ainda pisca forte em geral":** o único liga/desliga puro do jogo (degrau, não curva) era o tingimento do estado **chocado** em `statusTint.ts` — um estrobo de verdade a ~5 Hz, intocado nas rodadas anteriores (P258–P260 trataram vinheta, flash de dano e gelo). Pico cortado de 0,66 para 0,42 de azul (choque) e de 0,6 para 0,4 (atordoamento); as partículas `SPARK`/`STARS` (`StatusVisuals.ts`) eram as mais acesas do jogo (pico 2,5) — cortadas para perto do limiar do bloom, como o gelo no P260. **Também removido:** `meshKit.ts` tinha um `setHitFlash` de ~~código morto~~, sem nenhum chamador, ainda com o multiplicador antigo (1,4) do P259 — achado ao investigar esta rodada, apagado (P200, higiene).
**A motosserra:** `AudioSystem.ts:playChainsaw()` — 5 cortes/s por andróide, sem limite entre vários atacando junto; ganho do motor e do chiado agudo cortados em ~40%.
**Provas:** `npm run check` em andamento.
**Próxima sessão começa com:** abrir o PR; a capa de gelo é a primeira vez que um Mech ganha uma malha extra condicional — vale de referência se outro estado pedir o mesmo.

## EM BRANCH — NÃO ESTÁ NO AR: A CUTSCENE-PILOTO DO 8 DE JANEIRO — Claude, 23/10 (branch `claude/cutscene-piloto-janeiro`, P245)

**O Comandante (22/10):** pediu auditoria e2e completa + cutscenes em vídeo, cinematográficas, com VFX, contando o LORE por missão. **Achado:** a auditoria já tinha sido feita nas últimas 24h por outra sessão (`RESILIENCIA.md` P239, `AUDITORIA_SEGURANCA.md` P242); conferi segredos e histórico do git de novo, nada novo — não dupliquei o resto (detalhe em `ORDENS_DO_COMANDO.md` P245). **Cutscene: feito (prova de conceito).** Não existia câmera por trilha/keyframe no projeto (a câmera só segue o jogador); entraram `camera/CameraPath.ts` (trajetória por quadros-chave, pura, 8 testes) e `camera/CutsceneDirector.ts` (assume a câmera, no padrão do `KillCam`), e `debug/CutsceneJaneiro.ts` com o roteiro da abertura do 8 de Janeiro (Esplanada → Congresso → Praça, ~24 s), legenda = a mesma frase 🟢 já revisada da missão (nenhum texto novo). `npm run cutscene` grava em vídeo real (Playwright + GPU real + ffmpeg): rodei uma vez, vídeo de 1,7 MB em `.tmp/video/cutscenes/janeiro-abertura.mp4` (local, G15) e o quadro de prova em `arte/cutscene-janeiro-piloto.png`. Tudo sob demanda: 0 KB a mais no pacote de partida (`npm run peso` confirma). **Sem tocar no escopo congelado** (`LANCAMENTO.md` §0): é ferramenta de conteúdo, não mapa/missão/modo novo. **De carona, dois achados corrigidos por serem baratos e bloquearem o push de todo mundo:** travessia de caminho e bind em todas as interfaces no servidor local do `scripts/cutscene.mjs` (revisão automática de segurança); e `server/backupContas.test.ts` que falhava sempre nesta máquina (idade do backup podia dar negativa por arredondamento de mtime — travada em `Math.max(0, …)`).
**Falta (R13):** a câmera não evita atravessar geometria (roteiro desenhado à mão); sem som/narração (custaria ElevenLabs — decisão do Comandante — ou ele grava no Estúdio); é uma cutscene fixa, não um sistema geral.
**Próxima sessão começa com:** o que o Comandante achar do resultado (`arte/cutscene-janeiro-piloto.png` ou rodando `npm run cutscene`) — estender a outras missões, aprovar narração, ou parar por aqui.

## EM BRANCH — NÃO ESTÁ NO AR: A VOZ FICA LIVRE NA FASE DE TESTES E A "MIXAGEM ESTÉREO" NUNCA É MICROFONE — Claude, 21/10 (branch `claude/voz-livre`, P241)

**O Comandante (21/10):** a voz não saía no jogo (o F8 gravava) e, com uma segunda conta de adulto, ninguém se ouvia; mandou soltar a regra de 18 anos ("vamos apenas não dar acesso ao microfone [aos menores]… LIBERA VOZ PRA CONVIDADO E CONTA SEM IDADE") e colou o relatório do diagnóstico. **O relatório mostrou a causa:** aparelho **"Mixagem estéreo (Realtek)"** (grava o som do PC, nível 0,000) e **0 pessoas na sala** (sala ou mapa diferentes). **Feito:** (1) `VOZ_SO_PARA_ADULTO_DECLARADO = false` (`shared/net/auth.ts`): convidado e conta sem idade falam e ouvem, o **menor só ouve** (sem microfone); a P211 volta mudando a linha (testes provam as duas); (2) a política pública passou a `2026-10-21.1`; (3) `abrirMicrofone` **recusa a mixagem** e abre o microfone de verdade; (4) o diagnóstico mostra a **sala e o mapa** e explica "sozinho na sala"; (5) a conta só vale para a voz depois de restaurada (`sessaoPronta`).
**Provas:** unitários + 8 de 8 mutações; Chrome real `medicoes/voz-idade.mjs` (convidado e sem idade falam; o menor só ouve e não pede o microfone; quem era convidado e vira menor tem o microfone largado). **Limite dito:** o áudio vai entre os navegadores, então só o cliente impede o microfone do menor, e um menor que joga como convidado fala. **Não visto (R13):** o ouvido do Comandante entre dois PCs **na mesma sala e no mesmo mapa**. **Decisão dele antes de abrir ao público:** manter solta ou voltar à P211 (`LANCAMENTO.md` item 4).

## Resumo Executivo

| Aspecto | Status |
|---|---|
| **Projeto** | 🟡 Fase 5 em andamento — multiplayer sob verificação (M4 pronto, M5–M6 planejados) |
| **Jogo** | Retorno do servidor público ao protocolo 6 registrado em 09/10, com ciclos de reinício provados (PRs #189–#192); disponibilidade neste instante não consultada nesta auditoria. Offline: Arena + Sobrevivência + CTF |
| **Build** | Último check local (11/10, Gemini): 969 testes verdes em 124 arquivos, typecheck, build, budget, smoke e site verdes |
| **Última sessão** | 11/10 (Gemini, branch `gemini/cameras-espectador`): Câmeras de vigilância CFTV e espectador (Prédio Serafim, Vorcaris, Drones, Mechs, tecla C e botão no HUD). 10/10 (Gemini): LoginPanel (P33). |
| **Próximo** | painel de campanhas personalizadas (ver `ROADMAP.md`); drones e escudo físico completos no servidor online; playtest do dono: esfera, aliados, escudo físico, Prédio Serafim e drones; dono julga o Marauder (Hangar e partida); M5: cliente online ler `EVENT.HIT`; projeto da compensação de latência (`FINDINGS.md`) |
| **Release** | URL: https://www.selvamkt.com.br/cybermech/ — publicado a cada merge na `main` |

---

**Última atualização:** 2026-10-11 | **Versão:** v0.5.0-beta | **Status:** 🟡 EM DESENVOLVIMENTO

## EM BRANCH — NÃO ESTÁ NO AR (nem no site, nem no jogo)

> **Regra deste documento a partir de 27/09:** só entra em "ÚLTIMA SESSÃO FEZ" o que está na **`main`**. O que ainda está
> em branch mora aqui — e **é por isso que o dono não vê no site**: branch não publica, PR aberto não publica, só o merge na
> `main` publica (o deploy roda sozinho). Se não está no site, procure nesta tabela.

| Branch | O que carrega | PR | Desde |
|---|---|---|---|
| `gemini/marauder-rig-fix` (só local) | **Obsoleto**: o único conteúdo novo (o GLB) foi para `claude/marauder-rig`; o resto já está na `main`. Pode ser apagado quando o dono quiser | — | 01/10 |
| `gemini/game-hq` | **O painel admin do Gemini** (11/10): o **backend** em SQLite e API (`server/Server.ts`, `server/contas.ts`, `net/auth.ts`, `shared/net/auth.ts`), o **painel no frontend** (`ui/AdminPanel.ts` — arquivo novo, 144 linhas, integrado ao Hangar com **cadeados** e modal) e a **flag de `status`** para esconder Mechs em desenvolvimento na oficina (`entities/chassis.ts`, `entities/MechBase.ts`, `ui/HangarMenu.ts`). *(A linha antiga aqui dizia "Estruturação oficial do Game HQ (`HQ.md`)" — o `HQ.md` **já está na `main`**; o que o branch carrega agora é o painel.)* **Diagnóstico (Qwen, 12/10): 327 commits atrás; 4 conflitos** (`.decepticons/ESTADO_ATUAL.md`, `entities/MechBase.ts`, `entities/chassis.ts`, `ui/HangarMenu.ts` — os três de código são do Claude) e o resto entra limpo. Brief no topo deste arquivo | **#259** (aberto, `CONFLICTING`) | 11/10 |
| `gemini/rig-fix` | Corrige a orientação errada de modelos importados (`clonedScene` no `AxisCorrectedJoint`), que deixava Mechs Tripo e Mixamo com pés virados. Desabilita `quadraV2` temporariamente do carregador enquanto a malha ZEROCIRCUIT.glb está corrompida. | — | 01/10 |
| — | **Nada fora da `main` (28/09).** O login e a gravação entraram (#115, #117); o #110 virou obsoleto (só um retalho do `ESTADO_ATUAL.md`) e foi fechado; e os três branches órfãos do Gemini de 25/09 — `primeira-partida`, `setas-inimigos`, `sons-androides`, sem PR e com o conteúdo refeito na `main` — foram declarados mortos e apagados (regra 15). | — | 28/09 |

---

> O histórico de entregas que ficava aqui está em `.decepticons/arquivo/estado-em-branch.md`.

## PENDENTE
- [x] **Dono (04/10):** a recuperação do servidor foi feita à tarde (servidor na `wt-servidor-prod`, dados em `D:\DECEPTICONS\.tmp\servidor`), e a `node_modules` da pasta principal foi refeita em 09/10.
- [x] **Dono (09/10, feito):** reiniciar uma vez como administrador (servidor de produção no protocolo 6). Daqui em diante o reinício é automático e sem administrador (`DEPLOY.md`, seção "09/10").
- [ ] **Dono:** jogar no celular (deitado) e dizer se a mira e o tiro ficaram bons (forte ou fraca demais?); no PC, testar configurações, calibração e som
- [ ] **Dono:** conferir no jogo as novas formas e proporções do Vector-09; dizer se a leitura de leve/médio/pesado bate com as imagens de referência
- [ ] **Dono:** testar o Hangar em desktop e celular: MK III deve atualizar a carga, aplicar armas no respawn, trocar piloto e copiar um link que abre a mesma montagem
- [ ] **Dono:** jogar com as motosserras (andróides colados nas pernas) e pisar neles (ande para cima de um encostado)
- [ ] **Dono:** pôr o servidor público no ar 24 h: escolher o domínio, criar o túnel nomeado da Cloudflare, rodar `scripts\servidor-windows.ps1` e criar a variável `GAME_SERVER_URL` no GitHub (`DEPLOY.md`, "Servidor público 24 h")
- [ ] **Dono:** jogar online com alguém: `npm run server` no PC, o túnel do Cloudflare (`DEPLOY.md`, "Servidor de jogo") e o link `/jogar/?sala=ARENA&servidor=https://….trycloudflare.com&nome=…` para os dois. Dizer como ficou a sensação (atraso, correções, tiros)
- [ ] **Dono:** abrir o Hangar novo (pausa → `[ ABRIR HANGAR ]`): galpão, interface, testar disparo, atalhos 1 a 4, no computador e no celular. O que ainda está longe da imagem de referência?
- [ ] **Dono:** mexer nas potências (configurações → POTÊNCIAS) e dizer se falta algum controle (pontaria dos bots, tamanho do carregador, número de pulos...); quando achar um ajuste bom, mande o link: vira o padrão com teste
- [ ] **Dono:** jogar de andróide (pausa → `[ PILOTAR ANDRÓIDE ]`): a câmera passa a sensação de Mech gigante? Vida, blaster e motosserra estão justos?
- [ ] **Dono:** jogar com o diretor de ataque (no máximo 2 atacando juntos) e as personalidades; dizer se ficou fácil demais (dá para subir "Atacam ao mesmo tempo" nas configurações)
- [ ] **Dono:** jogar com o calor novo (~15 tiros segurando, trava de ~2 s, superaquecido anda a 75%) e o Mech mais pesado (9 m/s, com inércia e passos): ficou bom para lutar contra 3? Se ainda apertar, o próximo ajuste é o resfriamento
- [ ] **Dono:** jogar com as armas novas (menos dano, calor compartilhado com os foguetes) e dizer se a luta ficou lenta ou rápida demais; decidir as perguntas do fim do `HANGAR.md`
- [ ] **Dono:** ouvir a vinheta da marca no jogo (som, volume, duração) e ver a abertura da landing (numa aba anônima ela roda de novo)
- [ ] Confirmar em jogo real que F1 esconde o HUD sem abrir a Ajuda do navegador
- [ ] **Dono:** decidir a separação simulação × render × efeitos (`MULTIPLAYER.md`, seção 9) e as 4 decisões da seção 10
- [ ] **Dono:** jogar com as zonas de cura (canto sudeste) e resfriamento (canto noroeste) contra 3 Mechs + 3 andróides; dizer se +20 vida/s e 0,35 calor/s deixam a luta justa, ou se ainda precisa baixar `enemyMechs`/`enemyAndroids` nas configurações enquanto isso
- [ ] **Dono:** abrir `/cybermech/jogar/?modo=survival`, completar ou perder uma tentativa e dizer se o salto 2→6 inimigos, os intervalos e a ausência de respawn ficaram justos
- [ ] **Dono:** na Arena offline, deixar um bot abater o jogador e avaliar a câmera de abate; `V` deve sair na hora e o respawn deve voltar sem corte brusco
- [ ] **Dono:** abrir o Lancer-L1 (Hangar, ou `?build=v1.lancerL1.shotgun-0.-`), atirar de perto e de longe e dizer se a escopeta tem o peso que você descreveu (alcance menor que o blaster, dano alto colado no inimigo); decidir se o escudo passa a bloquear dano

- [ ] **Dono:** abrir o Marauder (Hangar, ou `?build=v1.marauder.blaster-0.blaster-0.rockets-0`): os dois blasters nas mãos e os dois lançadores nos ombros ficaram como você imaginou? Atirar com o botão esquerdo (as duas mãos) e com o direito ou Q (os dois foguetes) e dizer se o blaster segura a luta ou se esquenta demais (é o primeiro número para mexer em POTÊNCIAS)

## RASCUNHO ANTIGO DE BOTS (superado)
O rascunho do GPT-OSS continua no stash local (`git stash list`: "rascunho GPT-OSS/Gemini 23-09…"). Foi superado pelos bots v1 e pode ser descartado pelo dono (`git stash drop`). Não reaproveitar: andava na direção errada e lia a posição de render (ver histórico).

## MODELOS DE IA
- **Gemini Flash:** bom para tarefas de código bem especificadas dentro do protocolo (fez G12, painel de debug, Blind Mode, tela de configurações e som). Costuma esquecer o PR: conferir se o branch virou PR.
- **Codex (OpenAI):** bom em render e desempenho (#43: draw calls 34 → 9; #44: explosões). Mudança visual pede captura de tela no PR: o #43 deixou os robôs brancos até o primeiro dano sem o check perceber (corrigido no #48).
- **Qwen (Alibaba, via API DeepSeek):** transversal — qualidade, documentação e testes: auditoria de arquitetura, relatórios do processo e segunda opinião na revisão cruzada. Não toca no caminho crítico de simulação/rede (território do Claude); roda `npm run check` antes de declarar pronto.
- **gpt-oss 120B:** só para conversa de design. Em 23/09 entregou código que nem compilava e disse que estava pronto; **não usar para editar este repositório**.

## DIVISÃO DE TRABALHO ENTRE AGENTES
Regras no `AGENTS.md` ("Trabalho com vários agentes"). Um branch por tarefa a partir da `main` atualizada, cada agente na sua pasta (regra 12), PR com CI verde e merge pelo próprio agente (regra 13). As etiquetas do PR dizem a frente e o agente.
**Merge nesta fase:** o dono autorizou merge direto com CI verde. A revisão cruzada acontece depois.

| Agente | Território (arquivos) | Situação |
|---|---|---|
| **Claude** | `client/src/combat/`, `client/src/entities/`, `client/src/physics/`, `client/src/player/`, `scripts/`, `.github/`, `vite.config.ts`; depois `shared/`, `server/`, `client/src/net/` | Em atividade, confirmado pelo dono em 09/10: efeitos de estado e armas elementais (`ARMAS_ELEMENTAIS.md`). A sincronização online dos modos continua na frente de rede quando o contrato existir. O relato anterior de falta de crédito é histórico. |
| **Gemini** | `client/src/ui/`, `client/src/audio/`, `client/src/styles.css`, `client/index.html`, `client/src/debug/`, `client/src/core/Quality.ts` | Em branch `gemini/tela-login`: (1) LoginPanel (P33 — tela de autenticação e criar conta, 8 testes verdes, CSS); (2) correção do codinome no painel público (`scripts/painel.mjs`). Próximo: tela e som das armas elementais (`ARMAS_ELEMENTAIS.md`, seção 7). |
| **Codex** | visual e render do mundo 3D (`client/src/fx/`, `environment/`, modelos e rigs), pós-processamento, câmeras, desempenho e revisão cruzada | Feito: render, blueprints, Hangar/treino, calor/avaria visual, Sobrevivência/CTF offline e câmera de abate; #194 reduziu passadas do Hangar e protegeu seleção. C1 #198, C3 #204 e C4 #205 publicadas/deploy confirmado; C2 #206 em branch enquanto aberto, diagnóstico e restauração do alvo, check local verde. Próximos: C2 limitado e homologação prolongada C3; C5/C6 após orçamento/contratos em `EVOLUCAO_TECNICA.md`. Preservar simulação/rede do Claude e UI/áudio do Gemini. |
| **Gemini** | `client/src/ui/`, `client/src/audio/`, `client/src/styles.css`, `client/index.html`, `client/src/debug/`, `client/src/core/Quality.ts` | Feito: Som dos passos, volume de bots ecoando e Gênesis-01 não aparecendo offline/online. Branch consolidado e mergeado (PR #136). **Entregue em 09/10 (#201): T1–T5 das armas elementais; a ligação ao jogo é do Claude (`claude/ligar-ui-armas`).** Pedido de 09/10, já entregue: tela e som das armas elementais (`ARMAS_ELEMENTAIS.md`, seção 7: indicadores de estado, bordas de tela, painel do alvo, ícones do Hangar, medidor da rotatória, sons). |
| **Codex** | visual e render do mundo 3D (`client/src/fx/`, `environment/`, modelos e rigs), pós-processamento, câmeras, desempenho e revisão cruzada | Feito: render, blueprints, Hangar/treino, calor/avaria visual, Sobrevivência/CTF offline e câmera de abate; #194 reduziu passadas do Hangar e protegeu seleção. C1 #198, C3 #204 e C4 #205 publicadas/deploy confirmado; C2 #206 publicada; #209 prepara shader do chassi antes de exibir, fila limitada, check local verde; publicação deste corte exige merge/deploy. Próximos: C2 limitado e homologação prolongada C3; C5/C6 após orçamento/contratos em `EVOLUCAO_TECNICA.md`. Preservar simulação/rede do Claude e UI/áudio do Gemini. |
| **Qwen** | transversal — documentação (`.decepticons/`), testes de simulação (novos `*.test.ts`), relatórios do processo (`scripts/painel.mjs`, `scripts/site/`, o site) e auditoria de arquitetura (segunda opinião na revisão cruzada). Não mexe em `client/src/{sim,combat,entities,physics,player,net}`, `server/` nem `shared/` sem combinar com o dono do território | Entrou no time em 26/09 (oficialização no painel e na etiqueta). Próximo: relatório de saúde técnica (cobertura, débito da seção 9, budget, tick) para a divulgação |
| **Zona compartilhada** | `client/src/core/Game.ts`, `package.json`, `.decepticons/` | Só fiação e PR pequeno; quem mergear depois junta a `main` e roda `npm run check` |

## DECISÕES EM ABERTO
| Decisão | Situação |
|---|---|
| ~~**Uma chave só para o servidor? (12/10, P93)**~~ **DECIDIDO em 13/10 (P106): aceitar também a sessão `is_admin`.** O Comandante pediu "unifique as contas"; a sessão vale em todas as rotas, o token do dono segue como chave de emergência (não depende do banco). Segue o texto original: | O painel do servidor aceita **só o token do dono** (`metricas-token.txt`, que só existe no PC dele); o painel de chassis do Gemini (#259, no ar) usa a **sessão de uma conta `is_admin`**. Hoje cada painel tem a sua chave e as rotas não se cruzam. **Decidir:** manter assim (recomendado: reiniciar o servidor com a chave que só existe no PC dele é mais forte), aceitar também a sessão `is_admin` nas rotas `/admin/estado` e as outras (uma linha em `server/admin.ts`), ou o contrário. |
| **Enxugar a papelada? (13/10, Claude, a pedido do Comandante: "tenho a impressão de que temos muitas regras")** | **Medido nas minhas entregas de hoje:** a documentação é de 15 a 25% dos bytes de cada PR (6.800 a 15.200 B de doc contra 28 a 97 mil B de código); cada PR repete o mesmo fato em até **sete arquivos** (`ESTADO_ATUAL`, `ROADMAP`, `ORDENS`, `STATUS_REAL`, `HISTORICO`, `PAINEL_ADMIN`, `DEPLOY`); `ESTADO_ATUAL.md` tem 1.500 linhas e o `HISTORICO` 2.700 (o Passo Zero manda ler os dois); todo PR começa **no topo** dos mesmos arquivos, então dois agentes batem em conflito (aconteceu hoje no #292); e a regra de formato do ROADMAP só reprovou **depois de 6 min de check**. As regras de **engenharia** (G1/G2, G14, R2, R13) não atrapalham: são o que segura a qualidade. **Proposta (o dono decide):** (1) um fato, um lugar: `ORDENS` (o que ele pediu e o estado) e `STATUS_REAL` (o que funciona) viram a verdade; o `ESTADO_ATUAL` encolhe para "agora / próximo" (≤ 100 linhas, sobrescrito, o ensaio de cada PR vai no corpo do PR); (2) as entradas novas entram **no fim**, ou em um arquivo por agente, para acabar com o conflito; (3) um `npm run docs:check` de 1 s (o formato do ROADMAP e das ORDENS) antes do check de 6 min; (4) o Passo Zero cai para três leituras fixas e o resto por tarefa. Nada disso foi mudado: o AGENTS.md só se edita com registro e decisão do dono. |
| **O PC de casa sem memória hospeda o servidor de jogo (09/10, medido)** | A máquina tem 6 GB e vive com 300–500 MB livres (navegadores, ChatGPT, Antigravity, Defender, três agentes de código); o servidor chegou a 9 MB residentes e uma entrada demorou **59 s** (12 s minutos depois; 1,4 s quando a máquina estava calma). O SSD é um SATA de entrada que desacelera sob paginação. Um jogador de verdade desistiria. **Decidir:** (a) tirar o servidor desta máquina (VPS pequena; o código e o túnel já estão prontos, `DEPLOY.md`); (b) manter aqui e dar folga (mais RAM, ou fechar o ChatGPT e abas do navegador enquanto o servidor estiver aberto ao público); (c) manter como está só para testes do dono. Enquanto isso o servidor só serve para teste com poucos amigos. |
| **Armas elementais (pedido do dono, 09/10)** | Metralhadora rotatória, elétrica (choque, lentidão, atordoamento no tiro bem dado), lança-chamas e gelo. Plano, números de partida, custo de rede e divisão de trabalho em `ARMAS_ELEMENTAIS.md`; **o dono respondeu em 09/10** ("tiro bem dado" = cabeça ou 3 acertos seguidos em 1,4 s; atordoamento de 0,8 s com imunidade de 4 s; fogo e gelo se anulam; Mech grande resiste): sim a todas. **Só fogo no cenário segue sem resposta** (padrão: não; a porta fica aberta). Ordem: contrato dos efeitos de estado (#199, feito) → rotatória (#200, feito) → **elétrica (PR-C, feito)** → lança-chamas → gelo; tela e som com o Gemini em paralelo (o dono cola o pedido da seção 7 no chat dele). Codex só depois, para os efeitos 3D (hoje na auditoria de desempenho). |
| **Nome do jogo: AVARIA (11/10; era SINGULARIA desde 07/10)** | Em teste **só no título da capa** do jogo, a pedido do Comandante ("Singularia não ficou bom; Avaria tem mais a ver e é mais bacana de ler"). O resto segue CYBERMECH (aba do navegador, carregamento, Hangar, linha de versão, site, URLs, chaves do `localStorage`, nome da pasta de documentos). **O dono decide** se gosta; se sim, a troca geral vira um passo à parte (com migração do `localStorage` e redirecionamento das URLs). **Do dono, fora do código:** busca de marca no INPI (classes 9 e 41), busca em Steam/itch/lojas e compra do domínio. Detalhe em `HISTORICO_DE_DECISOES.md`, 07/10. |
| Drones e torres na partida | A banda aperta antes do formato: a sala cheia de hoje (12 robôs) já usa 6,2 KB/s dos 8,0 KB/s disponíveis por jogador. **Decidir:** drone por jogador (não cabe hoje), um drone por esquadrão, ou habilidade com recarga; e se vale o pacote que barateia (registro curto de unidade leve + estado a 5 Hz + **trilha pré-calculada**, com a conta no `METAGAME.md`, § 8.1). **Zonas de cura/resfriamento já implementadas** (Claude, 27/09, `combat/Zone.ts`): custam 0 B, valem também no online. Torres seguem pendentes: precisam de vida/calor num estado curto e disparo por evento (§ 9). |
| Hospedagem do servidor | Dono (26/09): começar com o PC de casa 24 h. Falta decidir o **domínio do endereço fixo**: um domínio só do jogo na Cloudflare (recomendado, ~R$ 40/ano) ou levar o DNS do `selvamkt.com.br` para a Cloudflare (grátis, mas mexe no site da Selva MKT). Oracle ou VPS depois, com o mesmo código. Seguem abertas: mira assistida no PvP e bots nas salas (`MULTIPLAYER.md`, seção 10). |
| Mira assistida no multiplayer | Hoje é só do toque e só contra bots. Com gente de verdade, toque x mouse na mesma sala precisa de regra: manter (padrão dos jogos de tiro no celular), reduzir contra humanos ou separar salas por tipo de controle. Decidir na Fase 4. |
| Separação simulação × render × efeitos | Proposta e criteria de aceitação em `MULTIPLAYER.md`, seção 9. Recomendação: tiro do jogador e yaw pela simulação antes da M4; o resto quando memória do servidor ou correções visíveis pedirem. |
| Universo (`UNIVERSO.md`, seção 7) | Brasil no centro, no contexto dos BRICS, já decidido. Premissa, roteiro, quanto de CTI entra (só textos ou também mecânicas) e nomes dos consórcios: com o dono, no chat do SERAFIM. Nada muda no jogo antes do aval. |
| Bots contra bots | Hoje os bots só caçam o jogador. No modo "todos contra todos" eles deveriam se enfrentar também: basta passar todos os Mechs em `BotSystem.targets`. |
| Câmera de abate no PvP | O corte offline segue o bot que matou. No online isso revelaria a posição do adversário durante 3 s. **Decidir:** liberar como ferramenta de conteúdo, atrasar/limitar a visão, ou manter ausente em partidas competitivas. Até a decisão, o online conserva a câmera normal e `STATUS_REAL.md` marca AUSENTE. |
| Revisão do status do servidor (#106) | Corrigir duas arestas do PR #105: impedir cadeias duplicadas de polling quando `visibilitychange` ocorre durante `fetch`, e definir a política de CSP para o `/status` de um `?servidor=` explícito. O cache de 1 s e a ausência de tráfego com aba oculta foram aprovados. |
| Colossus-01: arma e encontro | O dono fechou escala 3 e 14 m. Faltam a assinatura de arma, a máquina de fases, valores de combate e a forma do modo assimétrico; o próximo PR do Codex inicia pelo encontro offline determinístico. |
| Mech de tripulação (piloto + 1–2 artilheiros nas armas direcionais do Colossus) | Pedido do dono (29/09), priorizado por ele: **"Colossus jogável (solo) primeiro"** — feito (ver ÚLTIMA SESSÃO FEZ). Este item é a etapa 2: vários jogadores num corpo só. Ainda não tem contrato de rede nem decisão de arquitetura (G6 diz que Mech remoto não roda o character controller — precisa decidir quem simula o quê). Não iniciado. |
| **Estilos de jogo como eixo da evolução (dono, 06/10)** | O dono quer armas e robôs configurados para que, ao evoluírem, abram mais jeitos de lutar: tankar e combate próximo, rush e lutar até o fim, ataque furtivo e jogadas como as do xadrez. Hoje **só os bots** têm estilos (`PERSONAS` em `BotController.ts`: brabo, fujão, manso, soldado); para o jogador, a evolução é uma escada só (`TIERS`) e o chassi não evolui. Texto completo e caminho sugerido no `ROADMAP.md`. **Decidir:** quais estilos entram primeiro; se a evolução é por arma, chassi ou piloto; se a furtividade vale no online (custa banda, G11). Relacionado à linha abaixo. |
| **Chassis: os números têm papel, a forma ainda não (10/10)** | Os 10 chassis agora têm números distintos e um papel cada (`CHASSIS_PAPEL`, `ChassisPapeis.test.ts`). **O que continua com o dono:** escolher o **primeiro arquétipo de forma** (quadrúpede, esteira, canhão no lugar da cabeça, quatro braços; `ROADMAP`, "variedade estrutural") e **jogar e dizer se os papéis estão certos** (os números são proposta). |
| Framework modular de chassis/peças além do Hangar de armas | Pedido do dono (29/09): "criar, editar, evoluir (ou estragar)" os robôs à gosto do jogador — hoje o Hangar só cobre armas por braço (`loadout.ts`); trocar/editar chassi, peças e evolução persistente é maior. **Progresso parcial:** o catálogo de chassis cresceu (Arara-B1, Onça-B2, Colossus-01, além de Vector-09/Andróide), então já dá para *escolher* entre mais modelos — mas ainda não dá para o jogador *criar/editar* um chassi próprio nem evoluí-lo com o tempo. Não iniciado; precisa de escopo antes de construir (afeta rede, persistência de conta, balanceamento). |
| **Modelagem dos chassis: pipeline híbrido, primeiro chassi de verdade no ar (GÊNESIS-01, 30/09)** | Decisão (ver `HISTORICO_DE_DECISOES.md`, 29/09): sai do 100% procedural depois do teto real provado (protótipo tanque/barril, "pilha de moeda"); entra malha gerada por IA (Tripo3D). **Feito:** `GLTFLoader` + `SkeletonUtils.clone` no ponto de montagem do rig (`importedMechRig.ts`, `importedMechAssets.ts`), GÊNESIS-01 escolhível no Hangar e jogável numa partida de verdade — ver ÚLTIMA SESSÃO FEZ. Ainda em aberto: nome/ficha definitivos (hoje empresta 100% do Vector-09), fluxo pra gerar/receber mais chassis assim (hoje é manual: dono gera no Tripo, manda o arquivo, eu rigo o código em volta), orçamento de download por chassi (cada `.glb` ~3 MB). |
| Aliados na Arena online (rede) | **Feito offline** (30/09, ver ÚLTIMA SESSÃO FEZ). Falta só o servidor: `ArenaRoom.ts` desliga `allies` de propósito porque o roster de rede não sabe descrever um aliado pros outros jogadores ainda (ficariam invisíveis, fora de sincronia). `STATUS_REAL.md` marca AUSENTE no online até o roster aprender. |
| Vídeo promocional por prompt/botões no `/mesa` | **Feito (29/09):** a mesa já tinha o formulário; ganhou "gerar por IA" (escreve o roteiro a partir de uma frase, ancorado nos fatos do projeto) e a cena `clipe` (mistura gameplay real gravado no F9 com as cenas desenhadas, cortado por `ffmpeg`). Ver `.decepticons/FERRAMENTAS.md`. |
| Gerenciar as imagens do site sem código (deletar, reordenar, trocar) | Pedido do dono (29/09), depois de achar 3 fotos idênticas na landing (causa real: `capture()` falhando em silêncio — corrigido no mesmo PR, agora falha alto e nunca mais publica foto errada) e pedir um carrossel: **o carrossel entrou** (`scripts/landing.mjs`, gira sozinho entre as capturas que existirem). O que falta é maior — um jeito de escolher/ordenar/remover imagens sem editar `SHOTS` no código. Hoje as capturas são 100% automáticas (o robô entra no jogo e fotografa a cada deploy); um painel de curadoria manual é uma ferramenta nova, não uma correção. Não iniciado; precisa de decisão (onde mora a lista — arquivo versionado editável por formulário local, ou algo mais) antes de construir. |
| **Publicar de um branch põe código não mergeado no ar (14/10, Qwen)** | O `npm run publicar-site` publica o **HEAD da pasta onde roda** — é assim que o atualizador publica a `main` da worktree do servidor, e é o que permite publicar à mão de qualquer pasta. O risco ficou visível hoje: o publish das **20:02:35** (14/10) foi do `8cb80d5`, o HEAD da **pasta principal**, que estava no branch `qwen/o-mapa-da-praia`, e não da `main` — o log passou a avisar quando isso acontece, mas **avisar não impede**. **Decidir:** (a) recusar publicar quando o HEAD não é a `origin/main` (com `--forcar` para quem sabe o que faz — recomendado, alinha com a regra 14: só o merge publica); (b) deixar como está, agora com o aviso no log; (c) publicar sempre a `origin/main` (a pasta não escolhe mais, `--se-mudou` compara com ela). |

## BLOQUEIOS
- Nenhum (o site voltou ao ar em 14/10, 17:53).

## PRÓXIMA SESSÃO COMEÇA COM

- **Claude (09/10):** **PR-D, o lança-chamas `flamer`** (fluxo contínuo em cone de 25° e 14 m que atinge todos no cone, 6 s de combustível e 4 s de recarga, `inflicts: 'burn'`, bandeira `FX_FLAMING` no lugar de um evento por tiro, natureza `termico`; o fogo não passa pela chapa que segura mais da metade, como o choque). Depois o gelo (`cryo`, `inflicts: 'chill'`, natureza `criogenico` que entra em `DamageType` e nas tabelas dos escudos). **Quando o Gemini entregar T1–T5** (o dono relata), ligar no `Game.ts`: `StatusBadges.update` a partir de `status.forEachActive`, `TargetPanel`, `WEAPON_ICON_NOVAS`/`HINT_NOVAS` nos `Record`s do Hangar, `HUD.setSpin(armament.spinLevel)` e os sons. Os números de cada arma são a entrada dela em `BASE` (`weapons.ts`, um lugar só) e `STATUS` (`StatusEffects.ts`); a bancada `combat/balance.ts` mede o resultado.
- **Codex (09/10):** auditoria em EVOLUCAO_TECNICA.md; começar pela medição de frame time e primeiro uso de Hangar/GLB. Energia (#171), esfera/Ctrl/aliados offline (#173) e escudo físico já entregues; faltam playtest e limites online descritos no STATUS_REAL. Retorno de produção ao protocolo 6 registrado em 09/10; disponibilidade não consultada nesta tarefa. Não declarar escala homologada.

- **Claude (03/10):** o Marauder está feito (ver ÚLTIMA SESSÃO FEZ). O que sobra dele: **jogador remoto desenhado com o chassi dele** e o encaixe no evento de tiro (`ROADMAP.md`, `FINDINGS.md`); o **escudo do Lancer** que bloqueia tiro, se o dono quiser; e, com a regra de tiro única e a boca como dado, trazer o encaixe de arma aos Mechs procedurais.
- **Gemini:** **limpar a tela de pausa** (o dono marcou na captura: informação demais, coisas redundantes) e
  **telas de carregamento melhores**. Dois defeitos já diagnosticados pelo Claude em 28/09, para começar por eles:
  1. **`mission-summary` é um id disputado por dois módulos.** `client/index.html:51` tem um `<p id="mission-summary">`
     **dentro do `#overlay`** (a pausa), e `MissionHUD._getOrCreate('mission-summary')` reaproveita esse mesmo nó em vez
     de criar o dele dentro do `#hud` — então o resumo da missão nasce dentro da tela de pausa. Some-se a isso o CSS
     duplicado: `styles.css` define `#mission-summary` duas vezes (a linha de texto da pausa, e o painel de tela cheia
     do MissionHUD com `position:absolute; inset:0; z-index:900`), e a segunda vence. Sugestão: o nó antigo da pausa
     vira `#round-summary` (HUD.ts + index.html + CSS) e o MissionHUD passa a criar o dele.
  2. **O briefing abre atrás da pausa.** `#mission-briefing` tem `z-index:900` mas vive dentro do `#hud`, e o `#overlay`
     vem depois no DOM sem `z-index` — logo a pausa pinta por cima. É por isso que na captura do dono o
     `[ clique para jogar ]` aparece em cima do título da missão, e o `[ INICIAR MISSÃO ]` não recebe clique nenhum
     (a pausa inteira é um botão de retomar). Decidir qual das duas telas manda enquanto as duas estão abertas.
- **Gemini:** **tela de criar conta / entrar** (dono, 28/09: "partir para login?"). O backend já está pronto e
  testado (`claude/login-esqueleto`, mergeado): `client/src/net/auth.ts` (`ContaCliente`) tem `criar(email,
  senha)`, `entrar(email, senha)`, `sair(token)`, `eu(token)` — todos devolvem `{token, email}` ou `{erro:
  string}` prontos para mostrar, nunca lançam. Falta só a tela: um par de campos (e-mail, senha), os botões
  criar/entrar, e onde guardar o `token` no navegador (`localStorage`, o padrão do resto do jogo — `Settings`,
  `Hangar`, `DailyChallenges` já fazem assim) para o `eu()` confirmar a sessão ao abrir o jogo. Sugestão de
  lugar: um item novo em `[ CONFIGURAÇÕES ]` ou um botão ao lado do `[ JOGAR ONLINE ]` na pausa — decisão
  sua de UX. **Sem progressão migrada ainda** (decisão do dono): a tela só precisa provar entrar/sair
  funcionando; XP/créditos continuam em `localStorage` por enquanto.
- **Gemini:** depois: telas do online e calor no HUD; acompanhar o deploy do `gemini/modo-hud-audio`.
- **Codex (06/10):** sinais de avaria entregues na `main` pelo PR #164, CI verde. Começar pelo playtest offline/online/importados (a captura é de bancada), depois seguir o próximo corte abaixo. O visual do Colossus, o boss da onda 6 e o chassi solo já foram entregues; não refazê-los. Próximo corte de implementação: fases/pontos fracos/câmera do encontro offline, respeitando as decisões de arma e modo assimétrico ainda abertas; depois cosméticos e silhuetas. MK I/II/III dos módulos de arma importados já têm diferenças visuais (`MECHS_IMPORTADOS.md` § 4).
- **Claude (atualizado 30/09):** as duas frentes que estavam "sem começar" na sessão anterior **saíram e já
  estão na `main`** — pipeline híbrido de malha importada (GÊNESIS-01, chassi de verdade e jogável) e aliados
  na Arena offline (2 bots no time do jogador). Ver ÚLTIMA SESSÃO FEZ para os dois. O que ficou: (1) **aliados
  no online** — servidor desliga de propósito (`MatchOptions.allies: false`), falta o roster de rede aprender
  a descrever um aliado; (2) ~~Mech parado afunda no chão~~ (corrigido em 10/10; ver "DECISÕES EM
  ABERTO", precisa de tempo dedicado ao character controller do Rapier); (3) **arma de assinatura por
  fabricante** (ofereci propor 2-3 conceitos concretos — Vanta/guerra eletrônica, Forge/impacto — dono
  ainda não respondeu); (4) **Mech de tripulação do Colossus** (piloto + artilheiros, priorizado pelo dono
  para depois do solo, que já está no ar). Mais antigo ainda: definir e implementar o contrato autoritativo
  para escolher o modo da sala e transportar as transições de onda/objetivo; completar o online; sincronizar
  máquina de estados de Ondas da simulação.
- **Qwen:** a fila do `DIVERSAO.md` § 10 — **item 2 (conserto da progressão)** e adiante; o item 1 já tem a metade de HUD no jogo (painel do alvo) e a metade visual (sinais no próprio modelo) segue com a frente visual.
- **Dono (primeiro de tudo, 28/09):** **reiniciar o servidor de jogo de casa** para ele passar a responder
  `/status` — até lá a página diz "SERVIDOR ONLINE · SEM CONTAGEM DE PILOTOS" (online, sem o número).
- **Dono:** Testar no site o Seletor de Modo, a abertura do Briefing da Missão (`KeyM` / `KeyB` ou selecionar Sobrevivência), os alarmes de onda, as medalhas de conquista e o jogo offline de Sobrevivência/CTF. Decidir o universo (`UNIVERSO.md`, seção 7), a seção 9 e as decisões da seção 10 do `MULTIPLAYER.md`.
