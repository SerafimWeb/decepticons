# ARQUIVO — ESTADO_ATUAL (quinzena 2026-10-b)

> Texto movido sem alteração de `ESTADO_ATUAL.md` por `npm run arquivar`. Não editar: o vivo é o documento principal.

<!-- arquivo -->

## AMAZÔNIA, PARTE C: O DRAGA-01 COM CORPO — a missão do rio é jogável — Claude, 17/10 (branch `claude/amazonia-draga`, P180)

**A ordem do Comandante (17/10):** *"há uma enorme força de defesa deles e teremos que desmantelar, invadir com androides e destruir por dentro"*; *"continua iterando até concluir essas pendências"*. A parte C é **o Draga-01 de verdade na partida**: com corpo, dano, marcha e a missão que ele cria.

**O que entrou (`AMAZONIA.md` § 5.2 tem os números):**
1. **O corpo** (`entities/DragaMech.ts`, `dragaStats.ts`): um `MechBase` como o Colossus (36 m por 10 m de cápsula, canhão de cerco no convés), com um rig vazio de bípede e o desenho de quatro pernas (`WalkerVisual`) por cima. **Os dois módulos de perna são os dois lados**; a perna da frente cai primeiro; um lado caído o deixa a 50%, os dois a 30% (rasteja).
2. **A marcha e o cérebro** (`sim/DragaMarcha.ts`, `combat/DragaController.ts`): ele anda os 1.550 m do leito até a aldeia em ~10 minutos, vira devagar (14°/s), e atira em quem estiver a 320 m com a visada livre; tudo determinístico.
3. **A missão** (`sim/MissaoDoRio.ts`, `Match.rio`): **`?mapa=amazonia&modo=survival`** (o seletor de mapas já leva a ela). Derrubar o Draga vence; ele chegar à linha da aldeia perde; **o jogador morrer não perde**. Sem ondas, rebeldes nem quadro de luz: o Draga é o único inimigo. **`&marcha=0.8`** começa com o Draga 80% do caminho andado (para testar o fim).
4. **A tela:** a barra do chefe com o nome, a fase e os dois lados; a célula **ALDEIA · DRAGA A n m · n MIN** com a barra da marcha; os avisos a 1.000, 500, 250 e 100 m; o fim ("O RIO VIVE" / "A ALDEIA CAIU"); e o rio se limpando para a foz depois da vitória (só desenho).
5. **Carregado sob demanda:** o corpo, o cérebro e o `.glb` só baixam para quem abre a missão (`ChefeCarregado`).
6. **A ficha de fatos** (`fichas/fatos-mineracao-amazonia.md`): o que o jogo pode afirmar como fato sobre o garimpo e a mineração (o mercúrio no peixe, a emergência Yanomami, o garimpo nas terras indígenas, as dragas do Madeira, os rejeitos de Barcarena), cada um com a frase que o jogo pode dizer e a que **não** pode, as fontes e o que é sátira. **Tudo 🟡: só o resumo de uma busca; ler as fontes primárias antes de virar texto.** Nenhum fato entrou no jogo ainda; a expulsão dos povos **não foi levantada**.

**Provas:** testes do corpo no chão de verdade (anda os 1.550 m em ~10 minutos, segue o rio, perna caída = metade da velocidade, canhão com erro de mira determinístico, visada, alcance), da missão, da partida inteira (derrota, vitória, recomeço, o jogador morrendo, o placar) e do HUD. **Mutação à mão: 59 de 60 pegas** (a que escapa é equivalente). **Visto no jogo de verdade** (Chrome sem GPU, `arte/amazonia-missao-draga-c1-claude.jpg` e `amazonia-missao-fim-c1-claude.jpg`): a barra do Draga, a célula da aldeia, os avisos, as pernas amarelas do Draga entre as árvores perto da aldeia, e a derrota quando ele cruza a linha.

**Custo de CPU:** por tick, o Draga é um `MechBase` a mais (um character controller) e o cérebro faz uma conta de rumo e um laço sobre os alvos (≤ 8); quando atira, um raio. **O JS de partida está em 490,7 / 500 KB** (a parte C pagou ~2 KB de HUD, fases e a fiação do `Match`; a dieta de JS da `main`, P-dieta, tinha devolvido a folga: antes de somar, 499,2): **o que a parte D e a E trouxerem só da missão deve carregar sob demanda** (a folga é de 9,3 KB).

**Onde o Comandante confere:** **`cybermech.online/jogar/?mapa=amazonia&modo=survival`** (o seletor de mapas, AMAZÔNIA · RIO VIVO, leva direto): você nasce na aldeia e o Draga está a 1.650 m, marchando para lá. Para ver o fim rápido: **`&marcha=0.9`** (ele chega à aldeia em ~2 minutos: derrube-o antes ou veja a derrota).

**Falta (R13):** **ainda não é a fase inteira**: sem **escudo, geradores, torres, força de defesa** (parte D) e sem **invasão com androides nem cura de verdade** (parte E). Os números de equilíbrio (tronco 4.800, pernas 1.600, o canhão de cerco que mata um Vector-09 em um tiro certeiro) são **de partida, não validados com jogadores**. O Draga **não tem som de passo nem de tiro próprios, nem explosão ao cair** (ele some como os outros Mechs). **A floresta densa esconde o Draga do chão** (só se vê acima das copas, no rio e nas clareiras). **Não medido em GPU de verdade.** **A imagem da serpente não chegou.**

**Próxima sessão começa com:** a **parte D** (os geradores do escudo, as torres da margem, a força de defesa e o ato 1), **carregada sob demanda** (a folga de JS é de 9,3 KB).

## A PRODUÇÃO ESTAVA 2,5 H NO CÓDIGO VELHO: A VERIFICAÇÃO DO ATUALIZADOR REPROVAVA NO ESCURO — Claude, 17/10 (branch `claude/atualizador-log`)

**O que achei (e provei de ponta a ponta):** depois dos merges #371 e #372, o servidor de produção **não atualizou**: o `atualizacao.log` mostrava seis `FALHOU (testes de server/ e shared/)`. Os mesmos testes passavam na minha worktree. Fiquei quieto e a rodada seguinte **verificou em 40 s e religou no código novo** (protocolo 20); a primeira cópia do banco de contas apareceu em `D:\DECEPTICONS\.tmp\servidor\backups\contas-2026-10-18.db` (abre e traz a conta). **Causa:** o meu barulho (check do push, navegador, auditorias) e duas rodadas se atropelando em `.tmp/vitest`, não código quebrado.

**Feito:** o atualizador deixava a saída do teste que falhou se perder (`stdio: 'inherit'`). Agora grava as **últimas 40 linhas** no `atualizacao.log` quando um comando falha (`ultimasLinhas` em `scripts/atualizador.mjs`, 3 testes). O servidor só passa a usar isto depois da próxima atualização que ele verificar. `DEPLOY.md` ganhou a seção do episódio e a regra de operação: **depois de cada merge, ficar quieto** (sem check, sem suíte, sem navegador) até o log mostrar `servidor religou no código novo`.

**Custo de CPU:** zero.

**Falta (R13):** o atualizador **pode** reprovar de novo sob carga: a verificação roda os testes da máquina inteira numa máquina compartilhada. Uma saída mais robusta (repetir a verificação uma vez antes de desistir, ou rodar só em janela de silêncio) é decisão de quem opera a máquina; deixei só a **visibilidade**, que é o que faltava para decidir.

**Próxima sessão começa com:** o que o Comandante julgar. **A Amazônia (P180) está com outra sessão: não mexer.**

## O ONLINE CAÍA PARA QUEM JOGA POR VPN: A PORTEIRA DESCARTA O PICO EM VEZ DE CORTAR — Claude, 17/10 (branch `claude/guard-rajada`, P184)

**O relato do Comandante (17/10):** *"não tô conseguindo jogar online, dá erro e cai a conexão... não consigo jogar CONTRA meu outro PC usando VPNs diferentes"*.

**O que o `servidor.log` mostra:** quatro cortes **"taxa alta demais"**, dois deles dos IPs **212.8.252.70** e **185.177.124.221** (as duas VPNs do teste), com o servidor saudável no momento do corte; e o tempo médio do tick com picos de **298 e 1.093 ms** (uma média móvel: são travadas de segundos). **O PC do servidor é o mesmo em que se trabalha** e tem 6 GB com ~400 MB livres (o processo do servidor estava com 11 MB na memória, paginado): quando o laço do Node congela, as mensagens de todos chegam juntas na volta, e a porteira cortava **no primeiro excesso**. Quem jogava pela VPN (mais jitter) era o primeiro a cair.

**Corrigido (`server/guard.ts`):** o excesso de mensagens passa a ser **descartado** (nada é decodificado: custo de uma conta) e a conexão segue; só o **abuso de verdade** corta (o descarte acumulado passa de 600, caindo 60 por segundo: uma inundação cai em instantes, uma travada de segundos não). A folga subiu de 30 para 120 mensagens. O log passa a dizer `descarte de <ip>: pico de mensagens (a conexão segue)`. **Testes:** o balde (veredito ok/descarte/corte, o pico que passa, a inundação cortada, o excesso sustentado cortado e o leve nunca), o servidor de verdade (um pico de 45 mensagens não derruba; 80 derrubam); **mutação à mão: 7 de 7**.

**O que o código não resolve (e o que fazer):**
1. **O túnel da Cloudflare cai quando a VPN do PC do servidor muda** (o `jogo.cybermech.online` devolveu **502** por um tempo hoje: o túnel estava fora): não troque a VPN do PC do servidor com gente jogando; se o jogador é este mesmo PC, prefira outro PC como cliente.
2. **Memória do PC do servidor:** com menos de 1 GB livre o servidor trava por segundos. Feche o IDE e os navegadores enquanto joga, e **peça-me para não rodar teste nem build pesado enquanto você joga** (os meus testes e o `npm run check` do push usam todo o processador e a memória).
3. **Testar dois PCs sem VPN:** pela rede de casa (`HOST=0.0.0.0`, `ws://IP-DESTE-PC:2567`; ver `DEPLOY.md`).

**Onde o Comandante confere:** depois do merge o atualizador reinicia o servidor (~1 minuto fora): jogue de dois PCs na mesma sala (`?sala=ARENA`); se algum pico passar, o `servidor.log` mostra `descarte de ...` e **ninguém cai**.

**Falta (R13):** **não provei com a VPN dele** (só com o teste do servidor de verdade e a leitura do log): se ainda cair, o próximo passo é gravar no log o motivo do fechamento de cada conexão (código e quem fechou). Não mexi no túnel nem na prioridade do processo do servidor (o Windows negou: ele roda como serviço).

## IDIOMA, SEGUNDA RODADA: OS MODOS DE JOGO (A PRAIA, A BANDEIRA, O DOMÍNIO) — Claude, 17/10 (branch `claude/idioma-modos`, P173)

**Por que:** a auditoria do Hangar deixou claro que o teste de cobertura não via o que o jogo monta na tela. Auditei **no navegador, em japonês, cada modo** (sobrevivência, bandeira, domínio e a praia, **nunca a Amazônia: está com outra sessão**). Os três primeiros já estavam limpos; **a missão da praia (Cabos Abertos) tinha ~15 textos na tela e dezenas nos avisos**.

**Feito:** **74 textos novos nas seis línguas** (811 por língua): o HUD da praia (porto, ponte, estação, rede, cabos, portas, quadro de luz, a água), os avisos (cabo tomado, cortado, liberado, porta arrombada, cidade no escuro…), o briefing da missão, o chefe (fase, pernas, as três falas), a bandeira (`// PILOTO …`, `// RETORNADA À BASE`), o domínio, as conquistas, o briefing e o terminal do Banco Vorcaris, o "arraste os botões" do toque e o respawn. **Prova no navegador:** a auditoria em japonês de praia e sobrevivência só devolve nomes próprios (`arte/idioma-praia-ja-claude.png`). O teste de cobertura ganhou os 70 casos. **De passagem:** o arpão em japonês tinha dois termos (ハープーン e アンカー銃); ficou ハープーン nos dois.

**Sobre o arpão nos chassis pesados (P181), a conclusão depois de ler o código:** todos os médios têm o mesmo "peso" (raio 1,3), então o Marauder puxa qualquer médio e mais leve (regra "do seu peso ou mais leve"); **só o Onça (1,6) e os titãs (3,6 e 5) são mais pesados, e não têm encaixe de ombro** (o encaixe do Marauder é medido no desenho importado, `shoulderPods`). Dar ombros ao Onça exige encaixe procedural e o desenho do lançador: **é trabalho visual que precisa do olho do Comandante**; fica como decisão dele (abaixo).

**Custo de CPU:** zero.

**Falta (R13):** (a) revisão nativa das traduções; (b) o texto do rádio e do briefing das missões por onda e a tela final de cada modo (só aparecem jogando até o fim); (c) **decisão do Comandante:** ombros no Onça para ele ser o melhor usuário do arpão (trabalho visual), ou deixar o arpão para o Marauder.

**Próxima sessão começa com:** o que o Comandante julgar. **A Amazônia (P180) está com outra sessão: não mexer.**

## ONDE FICAM OS LOGINS, E A CÓPIA DE SEGURANÇA QUE NÃO EXISTIA — Claude, 17/10 (branch `claude/contas-onde`, P183)

**O Comandante (17/10):** *"onde os logins serão salvos se não temos supabase? como está isso? onde estão os arquivos pra eu conferir?"*.

**Resposta (o que existe de verdade):** os logins ficam em **`D:\DECEPTICONS\.tmp\servidor\contas.db`**, um arquivo SQLite no PC do servidor (`node:sqlite`, sem serviço de nuvem, decisão dele de 28/09). Guarda e-mail, o **hash `scrypt`** da senha, o **hash** do token de cada sessão e o progresso (nível, XP, créditos, apelido). O código que lê e escreve é o `server/contas.ts` (o único com SQL); as rotas, `server/Server.ts`; o contrato, `shared/net/auth.ts`. **Hoje há 1 conta** (de teste, criada às 13:12). Está tudo descrito em `DEPLOY.md` (§ "Contas: onde estão, o que guardam e como restaurar").

**Achado (R17): não existia cópia de segurança.** Um arquivo corrompido ou apagado por engano levava as contas de todos os pilotos.

**Feito:**
1. **`server/backupContas.ts`:** uma cópia **consistente** (`VACUUM INTO`, não pega o banco no meio de uma escrita) por dia em `.tmp\servidor\backups\contas-AAAA-MM-DD.db`, as **últimas 14**; o `Server` a faz ao subir e a cada 6 h (a do dia é substituída pela mais nova). Falha na cópia só registra no log: o jogo não cai.
2. **Testes (7) e 2 mutações pegas:** o nome é do dia (UTC); a retenção apaga só as mais velhas e **ignora arquivo que não é cópia**; a cópia é um banco de verdade (abre, autentica a senha, traz o progresso); a segunda rodada do dia a substitui; o servidor copia ao subir.
3. **`DEPLOY.md`:** a tabela de onde está cada coisa, o que o banco guarda, como **restaurar** e como contar as contas sem expor e-mail. Também corrigi o texto velho ("ainda não tem tela"): a tela e a sincronização do progresso estão no ar desde 17/10.

**Custo de CPU:** uma cópia de um arquivo de ~40 KB a cada 6 h.

**Falta (decisão do Comandante, R13):** a cópia fica **no mesmo disco do PC** (a regra G15 impede o projeto de gravar fora da pasta dele): protege de arquivo corrompido ou apagado, **não** de o disco morrer. Levar `backups\` de vez em quando para um pen drive ou para a nuvem pessoal dele é um `Copy-Item` de arquivos pequenos. **O banco guarda e-mails** (dado pessoal, LGPD): vale uma política de privacidade na página quando o cadastro abrir ao público. O servidor de produção só passa a copiar depois de reiniciar com este código (o atualizador reinicia sozinho no merge).

**Próxima sessão começa com:** o que o Comandante julgar; depois o Relatório de Consequências e os ombros dos chassis pesados (P181). **A Amazônia (P180) está com outra sessão: não mexer.**

## DIETA DE JS: OS PAINÉIS OPCIONAIS DO CONSOLE SAEM DO DOWNLOAD DE PARTIDA — Claude, 17/10 (branch `claude/dieta-js`, R7)

**O problema:** o JS de partida (o que todo jogador baixa para abrir o jogo) estava em **499,7 / 500 KB**: qualquer módulo novo, de qualquer agente, travaria o `npm run check` de todo mundo. Em uma semana eu tinha estourado o teto três vezes (o `‹ valor ›`, o Arquivo, o idioma).

**Feito:**
1. **Cinco painéis viram pedaços sob demanda** (`import()` no primeiro clique, `core/sobDemanda.ts`): **Esquadrão** (6,8 KB gzip), **Campanhas** (3,6), **Arsenal** (3,8), **Servidor** (6,2) e **Câmeras** (2,8). O `Game` não os importa mais de forma estática; o clique baixa o pedaço, cria o painel e abre (sem rede, avisa no console e o próximo clique tenta de novo).
2. **JS de partida: 499,7 → 486,2 KB** (folga de **13,8 KB**). Os pedaços sob demanda ficam abaixo de 7 KB cada (teto: 150 KB).
3. **Prova no navegador de verdade** (build de produção servido): antes do clique **nenhum** desses cinco pedaços é pedido; depois do clique cada um baixa e o painel abre; zero erros. Testes (`sobDemanda.test.ts`): a fábrica cria uma vez, o erro não fica guardado, um painel que falha não derruba o jogo, e o `Game` não importa mais os cinco de forma estática.

**Custo de CPU:** menos que antes (o download e a análise do JS dos painéis só acontecem para quem os abre).

**Regra para todos os agentes** (agora no `PROTOCOLO_UNIVERSAL.md`, R7): **tela ou painel opcional entra por `import()` no clique; texto estático longo vai para JSON em `public/`.** O próximo candidato, se a folga acabar: o `HangarMenu` (28 KB minificados) e o `HangarScene` (16 KB), que hoje o `Game` aquece no boot (pré-compilação de shaders): tirá-los do boot é uma decisão de experiência (o primeiro "H" passaria a esperar o pedaço), não só de bundle.

**Próxima sessão começa com:** o que o Comandante julgar; depois o Relatório de Consequências, a Amazônia (P180) e os ombros dos chassis pesados (P181).

## AMAZÔNIA, PARTE B: O RIO E O MAPA — o cenário de 2,4 km com o rio como termômetro — Claude, 17/10 (branch `claude/amazonia-mapa`, P180)

**A ordem do Comandante (17/10):** *"vamos já planejar e construir a próxima fase: o rio Amazonas, uma mineradora acabando com o rio… o cenário precisa ser bem maior… manter a eficiência e a contenção de consumo"* e *"acima desse super mech o rio é limpo e vivo, e depois dessa máquina o rio fica poluído, sujo, com óleo e envenenado"*; depois, *"continua iterando até concluir essas pendências"*.

**O que entrou (parte B do `AMAZONIA.md`, § 5.1 tem os números):**
1. **O mapa `amazonia`** (`client/src/environment/Amazonia*.ts`): 2.400 × 900 m, **o terreno numa função só** lida pela malha e pelo colisor (24 pedaços de 300 m, um colisor de altura), **6.594 árvores instanciadas** com dois níveis de detalhe, as estruturas (a aldeia, a planta, a margem fortificada com 8 torres, as máquinas da cava, a lagoa de rejeitos) fundidas numa malha, a água num shader só. **Carregado sob demanda** (`mapasSobDemanda.ts`): quem joga a Cidade Neon não baixa nada dele.
2. **O rio é o termômetro:** a **frente** (`AmazoniaRio.ts`) é um número; a montante o rio é limpo (verde-azulado, espuma branca, a floresta viva), a jusante é morto (água preta com óleo iridescente, a copa seca, o chão queimado). **O Draga-01 desce o leito rio acima a 2,6 m/s, a frente anda com ele** e ele para a 240 m da aldeia depois de uns 9 minutos. **É DEMO** (só desenho, sem corpo).
3. **Ligado ao jogo:** `?mapa=amazonia&modo=deathmatch`, o link do seletor de mapas (AMAZÔNIA · RIO VIVO), a missão **RIO VIVO** no mapa-múndi do console (o lugar é proposta, no Pará), a campanha (etapa na Amazônia), os nascimentos (o jogador na aldeia, os outros ao longo da margem sul), o radar e o minimapa com a planta e os marcos. Só offline e só Deathmatch.
4. **Achados no caminho (R17, consertados):** (a) `UniformsUtils.merge` **copia o valor** do uniforme, então a água e a lagoa nunca leriam a frente nem o tempo (o teste de uniformes compartilhados pegou); (b) **a chave da campanha não lia os mapas Praia e Amazônia e o link da etapa só levava `mapa=` para o Bunker**: uma etapa na Praia abria a Cidade Neon (já existia; consertado, com teste); (c) **o céu saía preto no jogo** (a câmera do jogo vai a 800 m e o domo tinha 2.200 m; a bancada tinha a câmera dela e não via): agora o mapa traz o `alcanceDaCamera` (1.500 m) e a bancada usa o mesmo.
5. **A bancada** (`medicoes/amazonia.mjs`: fotos de 9 vistas e contagem; `medicoes/amazonia-jogo.mjs`: o jogo real, com a câmera dele) e as capturas em `arte/amazonia-*-b1-claude.jpg`.

**Provas:** **2.892 testes em 279 arquivos** passam (os do mapa: terreno, rio, floresta, estruturas, mapa montado com o orçamento, registro sob demanda, a partida na Amazônia com o Mech andando no relevo, radar, minimapa, campanha, nascimentos, link). **Mutação à mão: 69 de 71 pegas**; as 2 que escapam são equivalentes (a guarda de declive da floresta repete o que a fórmula de densidade já faz; a guarda do nascimento repete a da aldeia). **Medido na bancada** (SwiftShader, sem GPU): **29 a 55 desenhos** (teto 70), **102 a 227 mil triângulos** (teto 250 mil), 58 colisores (teto 400). JS de partida **497,2 / 500 KB** (o mapa tem 7 KB sob demanda; o `ServerPanel` também passou a ser sob demanda).

**Custo de CPU:** por quadro, o `update` escreve um número (o tempo), o `observar` percorre 24 pedaços (um `hypot` cada, sem alocar) e leva o céu junto; o Draga é um desenho com 18 ossos; a simulação não ganhou nada (o mapa é só terreno e paredes). Nenhum `new` por quadro.

**Onde o Comandante confere:** **`cybermech.online/jogar/?mapa=amazonia&modo=deathmatch`** (ou o seletor de mapas, AMAZÔNIA · RIO VIVO): você nasce na aldeia, na margem sul do rio, no meio da floresta. **Ande para leste pela margem** (os pontos de nascimento ficam a cada 170 m) até a frente do veneno: a água fica preta e a floresta seca. Sem jogar: `node .decepticons/medicoes/amazonia.mjs --vistas draga,jusante` e as fotos em `.decepticons/arte/amazonia-draga-b1-claude.jpg` (o rio limpo, o Draga no meio da curva e o morto atrás).

**Falta (R13):** **não é fase, é mapa de Deathmatch**: sem missão, defesa, geradores do escudo, invasão com androides nem cura do rio (partes C a E). **O Draga é DEMO** (sem corpo: não ataca, não leva tiro, não bloqueia). **O orçamento é de contagem** (SwiftShader), **falta medir quadros por segundo numa GPU de verdade** (G12). O chão de cima mostra um desenho de espinha de peixe; sem som ambiente, pássaros nem partículas; a floresta troca a árvore pelo bloco a 260 m (pode estalar). **A imagem da serpente não chegou** (reenviar ou largar em `D:\imagens cybermech\` e dizer o nome). **Uma pasta de resto na raiz do disco** (`C:\.tmp`, de um erro meu do script do Blender, já corrigido) **precisa ser apagada por você** (minha ferramenta não deixa eu apagar fora do projeto). **Uma trava mudou (a do JS por fase, da parte A):** continua valendo o veto do Comandante.

**Próxima sessão começa com:** a **parte C** (o Draga como chefe com corpo na simulação: as quatro pernas como módulos de dano, o rastejo, a barra do chefe e a derrota na aldeia), e o `fichas/fatos-mineracao-amazonia.md` (as fontes dos fatos antes de qualquer texto de missão).

## IDIOMA: O HANGAR, O ESQUADRÃO, AS CAMPANHAS E O HUD DEIXAM DE FALAR PORTUGUÊS — Claude, 17/10 (branch `claude/idioma-telas`, P173)

**O Comandante (17/10):** *"idioma tem que ficar logo no início […] pra pessoa já selecionar o idioma nativo dele"*. Escolhida a língua, as telas avançadas ainda caíam no português: **auditoria no navegador de verdade, em japonês** (`.tmp/auditar-idioma.mjs`, que abre cada tela e lista o texto sem tradução) achou ~250 textos no Hangar, no Esquadrão, nas Campanhas e no HUD.

**Feito:**
1. **232 textos novos em cada uma das seis línguas** (737 por língua): o Hangar inteiro (rótulos, unidades, chassis, módulos, as quatro chapas, os papéis de cada chassi), o Esquadrão, as Campanhas e o HUD da partida (a vista 1ª/3ª pessoa/tática, as ordens aos aliados, o contato).
2. **As dicas das 22 armas do Hangar** (`public/dicas-do-hangar.json`) com tradução: o encaixe agora traduz **cada pedaço** da frase (a dica, o aviso dos ombros, o das costas, o do tamanho 3, a regra da chapa) antes de juntar, porque a frase muda caso a caso e não tem uma chave só.
3. **Composição genérica `{0} · {1}` e `{0} · {1} · {2}`**: o jogo escreve muito texto como "MÉDIO · ASSALTO · Equilíbrio entre alcance e mobilidade." ou "PADRÃO · 3,0 t"; as chaves de composição traduzem **cada parte pelo que o dicionário já sabe** (as descrições dos chassis já estavam traduzidas e não apareciam por estarem coladas). **Duas regras novas no motor (`i18n.ts`):** (a) entre dois padrões que servem ao mesmo texto, vence o de **mais texto fixo** (antes contava o tamanho do regex, que conta cada lacuna); (b) uma chave **sem " · "** não engole uma composição (`ESCALA {0}` não pega "ESCALA 3 · CERCO · …").
4. **Teste de cobertura que exige que nada em português sobre** (`i18n.test.ts`: só nomes próprios e unidades): as dicas, ~18 textos compostos do Hangar, o HUD, o Esquadrão e as Campanhas. **Prova no navegador de verdade:** a auditoria em japonês caiu de ~250 textos para os nomes próprios, as telas do dono e os rótulos de acessibilidade do mapa; capturas `arte/idioma-hangar-*-claude.png`.

**Custo de CPU:** zero (a tradução é por mapa em memória, com cache; o JS cresce o `traduzir` do Hangar, dentro do orçamento).

**Falta (R13):** (a) **revisão por falante nativo** (as traduções são minhas, como as da landing e do Arquivo); (b) as **telas do dono** (Arsenal, Estúdio, Servidor, Painel Admin) e os rótulos de acessibilidade do mapa seguem em português de propósito; (c) o **texto de rádio e de briefing das missões** não foi auditado (só abre jogando a missão); (d) a **voz do narrador** segue em português.

**Próxima sessão começa com:** o que o Comandante julgar; depois o Relatório de Consequências, a Amazônia (P180) e os ombros dos chassis pesados (P181).

## O ARQUIVO: SEIS FICHAS QUE ENSINAM, NAS SETE LÍNGUAS — Claude, 17/10 (branch `claude/arquivo`, P179 camada 2)

**O Comandante (17/10):** *"devemos explicar o que são [o nazifascismo] e como se manifestam, a rede de mentiras, os interesses obtusos por trás das elites, a manutenção do medo […] pelo menos SUTILMENTE E ELEGANTEMENTE, pedagogicamente"*. A camada 1 (o seletor de lado) já estava no ar; esta é a camada 2 do `LADO_E_PEDAGOGIA.md`.

**Feito:**
1. **O Arquivo** (`ui/ArquivoPanel.ts`): o chip **ARQUIVO ▸** (console completo e pausa, ao lado do selo do lado) abre a placa com a lista das **seis fichas** à esquerda (a marcada em barra dourada com chevron) e a ficha à direita: **o que é, como aparece, como se defender e as fontes**. Setas do teclado (circular), Esc fecha, Enter não vira "jogar", sem rolagem em 1280×720. A ficha 6, **as incoerências**, é **sátira declarada** e a tela avisa ("SÁTIRA DECLARADA · NÃO AFIRMA FATO"). **Opcional, nunca uma porta** (P133): não aparece sozinho.
2. **Sete línguas, em arquivos:** `client/public/arquivo/<língua>.json` (pt, en, es, fr, ja, zh, ru); língua sem arquivo cai no inglês e depois no português. **Fora do pacote de JS:** o conteúdo é JSON e o **painel é um pedaço sob demanda** (`import()` no clique do chip, 1,65 KB gzip), por causa do orçamento de partida (499,6 / 500 KB).
3. **Testes (`ArquivoPanel.test.ts`, 10):** o JSON quebrado não passa; seis fichas na mesma ordem e com o mesmo número de sinais em todas as línguas; só as incoerências são sátira; toda ficha tem fonte; teto de tamanho (cabe sem rolagem); **nenhum nome de político ou bilionário vivo em nenhuma língua**; a ligação (chip, `import()`, tecla). **Prova no navegador de verdade** (`arte/arquivo-*-claude.png`): abre, setas, circular, Esc, japonês carrega o arquivo dele, só o `pt.json` é pedido antes.
4. **De passagem (R17):** `algoPorCima` agora inclui o `.lado-modal` (o seletor de lado e o Arquivo): as teclas do console não valem com eles por cima.

**Custo de CPU:** zero fora do clique (um `fetch` de 3,5 KB na primeira abertura de cada língua e o pedaço de 1,65 KB).

**O que o Comandante precisa saber (R13):** (a) **as fontes estão citadas de memória** (Eco 1995, Paxton 2004, Stanley 2018, Arendt 1951, RAND 2016, Cohen 1972, Herman e Chomsky 1988): **um revisor humano confere título, ano e trecho antes de a tela ir ao ar**; (b) **nenhum caso real nem número** entra sem fonte que o Comandante dê; (c) as traduções (es, fr, ja, zh, ru) são minhas e **pedem falante nativo**; (d) o **orçamento de JS de partida está em 499,6 / 500 KB**: texto longo vai para JSON em `public/`, recurso opcional vira `import()`; quem estourar o teto trava o `npm run check` de todos.

**Falta:** o **Relatório de Consequências** (fim da missão com números lidos de ficha) e a **campanha do Consórcio** (P179 camadas 3 e 4); o Arquivo como **primeira pergunta depois da primeira rodada** segue decisão do Comandante (`LADO_E_PEDAGOGIA.md` § 7.6).

**Próxima sessão começa com:** o que o Comandante julgar (o texto das fichas é dele); depois o Relatório de Consequências, a Amazônia (P180) e os ombros dos chassis pesados (P181).

## O PAR SOLO / MULTI NA PRIMEIRA TELA — Claude, 17/10 (branch `claude/solo-multi`, P182)

**O Comandante (17/10):** na segunda captura dos jogos antigos ele escreveu à mão **MULTI** sobre o "2Players". A primeira tela dos jogos antigos é uma pergunta de duas respostas grandes.

**Feito:**
1. **A primeira tela agora tem o par.** O botão verde segue sendo o **SOLO** (com a nota "SOLO · contra os bots" embaixo) e, logo abaixo, a chapa azul fria **MULTI** ("online, com outros pilotos", tecla O) que **acende em barra dourada** sob o mouse ou com o foco. Clicar abre o lobby online (`OnlineLobby`), pelo mesmo botão que o monitor da REDE já usa: a regra de entrar online continua num lugar só (`OnlineSwitch`). Só aparece com servidor no build e fora de uma sala; some quando o console completo acende (o monitor da REDE já tem o botão: nada repetido). Textos nas sete línguas.
2. **Provado no navegador de verdade** (`arte/primeira-tela-solo-multi-claude.png`, `arte/primeira-tela-multi-dourado-claude.png`): o par aparece na primeira visita, o clique abre o lobby sem "jogar" por baixo, fechar volta ao par, o japonês traduz, "EXPLORAR HANGAR E MODOS" faz o par sumir, zero erros. Teste (`CommandConsole.test.ts`): o HTML, a delegação do clique e o CSS.

**Custo de CPU:** zero (um botão e um clique; a tela enxuta já não acende os monitores).

**Falta (R13):** (a) a **placa** (borda forte, rebites) no console e na pausa; (b) a barra dourada nas **listas do console**; (c) o **olho do Comandante** sobre o par: o MULTI pode ir ao lado do botão verde em vez de embaixo (só CSS).

**Próxima sessão começa com:** o que o Comandante julgar; depois o Arquivo (P179), a Amazônia (P180) e os ombros dos chassis pesados (P181); as dicas de arma do Hangar sem tradução (entrada abaixo).

## A INTERFACE DOS JOGOS ANTIGOS NAS CONFIGURAÇÕES: A LINHA EM BARRA DOURADA E O `‹ VALOR ›` — Claude, 17/10 (branch `claude/interface-antiga`, P182)

**O Comandante (17/10):** *"veja esses exemplos de interface de jogos antigos, eu acho muito boas!"* (duas capturas do Aero Fighters; `REFERENCIA_VISUAL.md` § 8 tem a leitura e o que levamos). *"continue iterando"*.

**Feito:**
1. **`ui/Passo.ts`: o seletor `‹ valor ›`.** Veste um `<select>` que **continua existindo, escondido**: o jogo segue lendo e escrevendo `select.value`, ouvindo `change`; o `‹ valor ›` espelha o que o select diz (por clique, pelas setas do teclado, por mudança de código e pelo texto traduzido) e o muda com **um passo, circular**, sem abrir lista. Nove nas Configurações: qualidade, dificuldade, narrador, quantidades e personalidades dos inimigos. **O idioma fica como lista** (sete línguas).
2. **A linha selecionada em barra dourada com chevron** (`❯`) nas Configurações: a linha sob o mouse ou com o foco, como na referência (barra dourada de ponta a ponta, texto escuro, o passo em fundo escuro).
3. **Testes (`Passo.test.ts`, 8):** o passo circular, o rótulo, o limite de opções, o estilo e a ligação (o select do idioma não vira passo). **Prova no navegador de verdade** (`arte/interface-passo-*-claude.png`): os nove passos existem, o select está escondido e **acompanha** (clique, duas voltas, mudança por código, seta do teclado) e a troca para o japonês **refaz o texto** dos passos.

4. **Orçamento de JS (R7): o pacote chegou a 500,03 KB (limite 500).** As dicas de arma do Hangar saíram do código para `public/dicas-do-hangar.json` (carregado ao abrir o Hangar): **498,49 KB**, folga de 1,5 KB. Texto estático longo novo vai para JSON em `public/`, não para o pacote (`HISTORICO_DE_DECISOES.md`).

**Custo de CPU:** zero fora do clique (um observador de opções por seletor, que só dispara quando o texto das opções muda) e um `fetch` de 3,5 KB na primeira abertura do Hangar.

**Achado aberto (R17):** as 22 dicas de arma do Hangar **não têm tradução** nas seis línguas (o Hangar fala português em qualquer idioma): traduzir cada dica em `public/dicas-do-hangar.json` + dicionários, e o teste de cobertura passa a checar.

**Falta (R13):** (a) o par **SOLO / MULTI** na primeira tela (a anotação dele sobre "2Players"): *feito na entrada acima*; (b) a **placa** (borda forte, rebites) no console e na pausa; (c) a linha em barra dourada **no console** (as listas de operação); (d) o **olho do Comandante**: se a "pele" agradar, (a) a (c) seguem; se ele quiser mais perto da chapa dos jogos antigos, é só CSS.

**Próxima sessão começa com:** o que o Comandante julgar; depois SOLO / MULTI (P182), o Arquivo (P179) e a Amazônia (P180).

## AMAZÔNIA, PARTE A: O DRAGA-01 ANDA — o plano, o rig e a marcha do quadrúpede — Claude, 17/10 (branch `claude/amazonia-mina`, P180)

**A ordem do Comandante:** *"vamos já planejar e construir a próxima fase: o rio Amazonas, uma mineradora acabando com o rio… Já criei o modelo (`heavy industrial walker 3d model`): é um mech maior que o Colossus v4, então o cenário precisa ser bem maior… faça sua melhor versão desse modelo: ele deve se mexer (eu não inseri o RIG: tenho que fazer ou você faz?)"* e *"acima desse super mech o rio é limpo e vivo, e depois dessa máquina o rio fica poluído, sujo, com óleo e envenenado"*. **Resposta: o rig é meu; o Comandante não precisa rigar.**

**Feito:**
1. **O plano** (`AMAZONIA.md`): a mecânica central (**o rio é o termômetro da fase**: limpo a montante do Draga, envenenado a jusante, curando conforme as peças caem), a história (mineradora AURUM, do Grupo Vorcaris: arquétipo, nunca empresa real), o mapa de 2.400 × 900 m com o orçamento (≤ 70 desenhos, ≤ 250 mil triângulos, ≤ 400 colisores), a missão em quatro atos (desmantelar o escudo, derrubar as pernas, invadir com androides, o rio se cura), as partes A a E e as decisões em aberto. A ordem é a **P180**.
2. **O rig do Draga-01** (`scripts/blender/rig-walker.py`, Blender sem janela em `D:\blender\blender.exe`): o arquivo do Comandante é **um quadrúpede de 27 mil triângulos, uma malha só, sem esqueleto, sem pele e sem textura** (537 peças soltas). O script classifica cada peça pela posição (conferida em foto), mede as juntas das quatro pernas nas próprias peças e monta **18 ossos com pele rígida por parte** (a junta não amassa) e **cor nos vértices** (amarelo nas coxas, aço nas canelas, creme no convés, laranja nos guindastes, sujeira para baixo): **984 KB, um desenho**. O original não é tocado; o jogo usa `client/public/models/draga-01.glb`. Reproduzível.
3. **A marcha** (`entities/walkerGait.ts`, função pura): **quatro tempos** (dianteira esquerda, traseira direita, dianteira direita, traseira esquerda; pisada de 75%: **sempre três pés no chão**), passo de **5 m** casado com a velocidade (o pé não escorrega), balanço do casco (um mergulho por passo), convés que gira para a mira, guindastes que oscilam e radar que gira; **perna caída**: o joelho dobra, o casco afunda e inclina para o lado dela. Sem alocar por quadro.
4. **O desenho** (`entities/WalkerVisual.ts`): carrega o `.glb`, escala para **38 m** (tamanho 5), liga cada osso a uma junta que gira nos eixos do Mech (a mesma `AxisCorrectedJoint` dos robôs importados), **mede o sinal do joelho olhando o tornozelo subir** (perna a perna) e aplica a pose. Só do cliente: o servidor nunca carrega `.glb` (G14).
5. **A demonstração** (`debug/WalkerDemo.ts`): **`?walker`** no link põe o Draga andando em círculo de 70 m em volta de onde você nasceu, com o convés mirando em você, em qualquer mapa. **É DEMO**: ainda não é inimigo (não tem corpo na simulação, não atira, não leva tiro).
6. **A bancada** (`medicoes/walker.mjs`): fotografa o Draga de várias vistas e em fases da marcha, ao lado do Vector-09 (a régua de escala).
7. **O orçamento de JS por fase** (`scripts/orcamentoDeJs.mjs`, o `smoke` e 8 testes em `server/orcamentoDeJs.test.ts`): o Draga estourou o teto de 500 KB gzip do push (a `main` já estava em 499,8 KB), então o código dele é **carregado sob demanda** (`?walker`) e o `smoke` passou a medir **dois** tetos: o **de partida** (o que todo jogador baixa; segue 500 KB) e o de cada **pedaço sob demanda** (150 KB). Sem `?walker` nada do Draga é baixado (provado no build de produção). **Muda uma trava do projeto: o Comandante pode vetar** (`HISTORICO_DE_DECISOES.md`, 17/10). **A folga da partida é de 0,1 KB.**

**Provas:** **43 testes**: 16 da marcha pura (a ordem dos passos, nunca dois pés no ar, o quadril contínuo, o pé que não escorrega, a pose sem alocar, a perna caída, o dado torto), **23 do rig com o arquivo REAL carregado em Node** (os 18 ossos, o orçamento de triângulos e de peso, pele rígida de peso 1, 38 m e frente em -Z, quadril positivo leva o pé à frente, o joelho que levanta o pé em cada perna, o pé chato, o convés que gira, 20 s andando sem dois pés no ar e sem escorregar, a inclinação do casco, o radar, o arquivo sem osso que é acusado, duas instâncias independentes) e 4 da demonstração. 34 de 34 mutações à mão pegas. **Descoberta útil:** o `GLTFLoader` roda em Node quando o arquivo não tem textura, então o rig se testa sem navegador. Capturas: `arte/walker-*-a1-claude.jpg` (as vistas, a marcha em quatro fases, as pernas caídas, a escala) e `arte/walker-jogo-praia-s40-claude.jpg` (no jogo de verdade).

**Onde o Comandante confere:** **`?walker`** (e `?mapa=praia&modo=deathmatch&walker`): o Draga anda em círculo à sua frente, de 38 m, e mira o convés em você. Para ver sem jogar: `node .decepticons/medicoes/walker.mjs --fases 0,0.2,0.4,0.6 --vistas lado`.

**Falta (R13):** **tudo o que é o resto do plano** (partes B a E: o rio e o mapa, o Draga como chefe com corpo, a defesa, a invasão). Do próprio Draga: sem som de passo nem poeira (o gancho `onFootstep` existe); sem fumaça na chaminé; o material é simples (sem janelas acesas); o dano por parte ainda não aparece no desenho (só a perna caída, por número); **a imagem da serpente não chegou**.

**Próxima sessão começa com:** a **parte B**, o mapa `amazonia` e o rio com a frente de limpeza (`AMAZONIA.md` §§ 3 e 5).

## A LANDING FALA SETE LÍNGUAS, COM A FAIXA DE IDIOMAS NO TOPO — Claude, 17/10 (branch `claude/landing-idiomas`, P178)

**A ordem do Comandante (17/10):** *"idioma tem que ficar logo no início da landing, pra pessoa já selecionar o idioma nativo dele"*.

**Feito:**
1. **A faixa de idiomas é a primeira coisa da página** (`<nav class="lang-strip">`, antes da navegação): as sete línguas pelo nome nativo, a escolhida em destaque; **enquanto o visitante não escolhe, a faixa fica realçada** (o convite). Trocar traduz a página inteira na hora.
2. **`scripts/site/idioma-landing.js`** (JavaScript puro, sem build: a landing é estática): a mesma ideia do jogo (P173), português como texto de origem, dicionário por língua com lacunas `{n}` para o que o gerador preenche (os números saem do código do jogo). Traduz os textos, `title`/`aria-label`/`alt`, o `<title>` e a descrição. **Escolha: `?lang=` → a salva → a do navegador (fora de navegador de teste) → português**; a escolha vai para `cybermech.lang`, **a mesma chave do jogo**, então quem escolhe na landing **já entra no jogo na língua dele**.
3. **`scripts/site/locales/*.json`: 208 textos por língua** (en, es, fr, ja, zh, ru), copiados para ao lado da página pelo gerador (`scripts/landing.mjs`).
4. **Testes (`server/idiomaLanding.test.ts`):** o tradutor da landing e o do jogo **dão a mesma resposta** (exata, padrões, lacunas traduzidas, margens, espaços quebrados, escolha da língua); os seis dicionários têm as mesmas chaves, sem vazio e com as mesmas lacunas; **a landing de verdade é montada** e confere a faixa como primeira coisa do corpo, o módulo e os dicionários ao lado, e que **90% ou mais dos textos têm tradução** (texto novo sem tradução aparece aqui antes de ir ao ar). O tradutor do jogo ganhou o mesmo fallback de espaços quebrados.

**Custo de CPU/peso:** zero no jogo. Na landing: um módulo de ~4 KB e, só para quem escolhe outra língua, um JSON de ~14–22 KB; a tradução roda uma vez por troca (a página é estática, sem observador).

**Falta (R13):** (a) **as traduções são da Claude e precisam de revisão por falante nativo** antes de divulgar fora do Brasil; (b) a Oficina, a Sala de controle e as demais páginas internas seguem em português; (c) as imagens com texto (as fotos de cena) não são traduzidas; (d) alemão e coreano (os outros mercados da P171) são um JSON novo cada.

**Próxima sessão começa com:** o que o Comandante julgar; depois o Arquivo e o Relatório de Consequências (P179), a missão da Amazônia (P180) quando o modelo chegar, e a linha selecionada em barra dourada nas Configurações (P182).

## DE QUE LADO VOCÊ JOGA? O SELETOR DE LADO, O ARPÃO POR PESO E O PLANO DA AMAZÔNIA — Claude, 17/10 (branch `claude/lado-e-arpao-peso`, P178 a P182)

**O Comandante (17/10)** mandou, numa mensagem só, cinco ordens: o idioma logo no início da **landing** (P178); **perguntar o lado** (Aliança × Consórcio) e **ensinar** o que é o fascismo, a rede de mentiras e o medo, de modo sutil e pedagógico (P179); a **missão da Amazônia** (a mineradora no rio; o modelo é dele, em outro chat) (P180); a regra do **arpão** (o robô mais leve não puxa o mais pesado) (P181); e **referências de interface de jogos antigos** (P182).

**Feito neste PR:**
1. **P181, o arpão por peso (código, REAL):** `HookSystem.pesoDe` (o raio da cápsula): o alvo mais pesado que o atirador não é preso; igual e mais leve são. Substitui o limite fixo de 2,4 m (`breakRadius` saiu da arma). 4 testes e 3 mutações; a dica, o Arsenal e o Hangar dizem a regra nas sete línguas.
2. **P179, o seletor de lado (código, DEMO):** o selo **LADO** no console e na pausa; a pergunta no estilo da placa de metal (P182); o painel **"o discurso e o custo"** para o Consórcio. Teclado (setas, Enter, Esc), traduzido, sem porta (o primeiro acesso não pergunta nada). **Não muda o combate.** Visto no navegador de verdade (`arte/lado-*-claude.png`).
3. **Documentos de design:** `LADO_E_PEDAGOGIA.md` (a pergunta, as quatro camadas, as regras que protegem a ideia, o Arquivo e o que ensinar, as decisões dele), `fichas/fascismo-e-propaganda.md` (a base do Arquivo, **fontes a conferir por um revisor**), `fichas/cenario-amazonas.md` (a missão em cinco fases e o que o modelo dele precisa trazer) e a § 8 de `REFERENCIA_VISUAL.md` (a leitura das duas capturas e o que levamos).
4. **O registro:** as cinco ordens em `ORDENS_DO_COMANDO.md` (P178 a P182; a P177 é de outra sessão).

**Custo de CPU:** zero (HTML/CSS e um clique; a regra do arpão é uma comparação por aperto).

**Falta (R13):** (a) **P178, a landing em outras línguas** (próximo PR); (b) o **Arquivo**, o **Relatório de Consequências** e a **campanha do Consórcio** (P179); (c) **a missão da Amazônia** (P180), à espera do modelo; (d) **ombros nos chassis pesados**, sem os quais o arpão por peso não rende nas mãos de um robô grande (P181); (e) a linha selecionada em barra dourada, o `‹ valor ›` e o par **SOLO / MULTI** (P182); (f) as **decisões do Comandante** em `LADO_E_PEDAGOGIA.md` § 7 (nomes reais ou arquétipos; quanto o Consórcio é jogável; o Arquivo opcional; quem revisa os textos de fato; onde publica).

**Próxima sessão começa com:** a landing em outras línguas (P178).

## AS OUTRAS FASES, PARTE E: A CIDADE NEON GANHA O TRANSFORMADOR DO BANCO VORCARIS E A BARRA DO CHEFE — Claude, 17/10 (branch `claude/outras-fases`, P177, P164, P165)

**A ordem do Comandante:** *"CONTINUA SEGUINDO A PARTE B, C e a D, e melhore as outras fases além da estação cabos"*, e da P164: *"um tipo de circuito que podemos repetir nas diferentes fases… além de chefes especiais com contexto em cada outra fase"*.

**Feito (na missão em ondas da Cidade Neon, a Arena em `?modo=survival`, que é a missão padrão do jogo):**
1. **O circuito do quadro de luz se repete** (`sim/QuadroDeLuz.ts`): a regra pura agora tem **lugar e vida próprios** (`new QuadroDeLuz(ponto, vidaMax)`; sem argumentos é o do porto da praia, 240). O **transformador do Banco Vorcaris** (`environment/ArenaLayout.ts`: x -13, z -33, a leste da porta do banco, **480 de vida**) é a segunda instância. A mesma regra: **da onda 2 em diante o primeiro andróide vivo é o saboteiro**; **o Colossus da onda 6 vai direto a ele** (peso 4: apaga o de 480 em ~20 s) e, com o transformador apagado, **é solto e volta ao comportamento de sempre**; o jogador ou um aliado perto, sem rebelde em cima, recupera (8 por segundo, até dois; volta a ligar com 25%, 120).
2. **A cidade escurece com a energia** (`environment/Arena.ts`): as arestas, as faixas e as janelas dos três prédios, a plataforma e a rampa, as torres do horizonte e **a placa do BANCO VORCARIS** caem até 12% (`PISO_DA_LUZ_DA_CIDADE`: no escuro, não cego); com o transformador **apagado as zonas de cura e de resfriamento deixam de funcionar e o desenho delas some** (a mesma regra da praia).
3. **O desenho** (`environment/ArenaQuadro.ts`): uma cabine de aço com as arestas no azul do banco, uma tela voltada para o meio da arena e um **farol de 9 m** para achá-la de longe: **verde** ligado, **laranja trêmulo** sabotado, **vermelho piscando** apagado; com colisor. **Quatro desenhos**, só na missão em ondas.
4. **O HUD de missão fora da praia** (`ui/PraiaHud.ts` em modo `soMissao`): a célula **"TRANSFORMADOR · BANCO VORCARIS"**, a **barra do chefe** e os avisos do topo, sem o que é só da praia (a faixa da costa, a rede, os cabos, as portas, o cartão, a água, o marcador). **Antes desta parte o Colossus da Arena não tinha barra nenhuma.** A **regra dita do chefe muda com o alvo**: nos cabos da praia ("Ele vai cortar os cabos. Derrube as pernas."), no transformador da Cidade Neon ("Ele vai apagar o transformador do banco. Derrube as pernas.").

**Provas:** **37 testes novos**: 5 na regra pura (vida e lugar próprios, a vida maior segura mais, a volta aos 25% da vida dele, a fração, o reparo e o teto), 4 do layout (o armário não encosta em prédio, barricada, plataforma, zona nem nascimento), **6 de partida** (`Match.arena.test.ts`: só a missão em ondas tem o transformador, a onda 1 sem saboteiro e a 2 com um, o saboteiro chega e o depreda, as zonas caem e o jogador as religa, o Colossus o apaga e é solto, `restartMission`), **12 do desenho e da cidade** (a energia linear, o piso, as zonas, a placa do banco, o horizonte, sem o transformador nada muda) e **9 do HUD de missão** (com um DOM de mentira) mais 1 da regra dita por alvo. A suíte inteira passa. 54 de 56 mutações à mão pegas (as duas que escaparam são equivalentes: a histerese da energia só poupa custo, e dar ordem a um bot morto não muda o jogo). Capturas: `arte/arena-banco-e1-q0_1_1-claude.jpg` (ligado), `…q1_0.4_0.4…` (sabotado), `…q2_0_0…` (apagado, a cidade no escuro), `arena-cidade-e1-q*` (a cidade nos três estados), `arena-chefe-e1-q0_1_1` (o Colossus mascarado ao lado do banco) e **`arena-jogo-onda6-e1-s30-claude.jpg` (o HUD no jogo de verdade)**.

**Onde o Comandante confere:** `?modo=survival` (a Arena é o mapa padrão; `&onda=2` para o saboteiro, `&onda=6` para o Colossus): o banco é o prédio com a placa BANCO VORCARIS, e o transformador fica a leste da porta dele, com o farol verde de 9 m. Veja a célula do transformador no topo do HUD; deixe o saboteiro chegar e a cidade escurecer; corra lá e recupere. Para ver sem jogar: `node .decepticons/medicoes/arena.mjs --vistas banco,cidade --quadro "2:0:0"` (estado:vida:energia).

**Equilíbrio (R13): a missão padrão ficou mais exigente.** Sem o transformador as zonas de cura caem (não se perde a missão por isso, ao contrário do núcleo da praia). Nenhum número foi validado jogando: a vida (480), o peso do Colossus e a volta aos 25% são linhas de tabela.

**Falta:** dano a tiro no transformador; o transformador não aparece no minimapa; **Bunker, Bandeira e Domínio ainda não têm circuito** (a Cidade Neon do Deathmatch segue a de sempre); a Cidade Neon não tem ciclo do dia (é noturna por desenho); **o chefe com contexto próprio de cada fase** (o Banco Vorcaris como fábrica dos bots, P165) segue desenhado, não feito; o interior do banco (P149); só offline.

**Próxima sessão começa com:** o ajuste fino jogando dos dois mapas (praia e Cidade Neon) e a próxima fase da lista: o **Bunker** (que hoje só tem Deathmatch) ou o **Capítulo 4, SANÇÃO** no banco (o congelamento e as chaves de rota, `CAMPANHAS_E_CHEFES.md` § 2).

## CAPÍTULO 1, PARTE D: A COLOSSUS EM TRÊS FASES, A BARRA DO CHEFE E A MÁSCARA — Claude, 17/10 (branch `claude/cap1-parte-d`, P165, P147)

**A ordem do Comandante:** *"CONTINUA SEGUINDO A PARTE B, C e a D"* e, da P165, *"os Colossus V1, quero que você coloque uma MÁSCARA DO TRUMP nele (uma skin, que não será a padrão, apenas quando ele for o chefe)"*.

**Feito (na missão em ondas da praia, o Colossus da onda 6):**
1. **As fases do chefe** (`sim/FasesDoChefe.ts`, regra pura, G14): **ANDA** (as duas pernas de pé) → **MANCA** (uma caiu: metade da velocidade, a regra de sempre do `MechBase.mobility`) → **RASTEJA** (as duas caíram) → **CAIU** (o tronco zerou). **Não criei sistema de dano novo:** a fase sai da vida das pernas e do tronco que o dano por parte já tem. O que é só do chefe: **ele rasteja** (`MechBase.crawls`, 30% da velocidade; num Mech comum, perna destruída segue como torre imóvel) e **escolhe o alvo**.
2. **O alvo do titã:** o **cabo mais perto que ainda não foi cortado** (peso 4: corta em ~17 s, cada cabo cortado drena a rede); com os três cortados, **a porta principal do prédio**. Quem derruba as pernas o para; rasteja e continua atirando e depredando, **então é outra luta, de perto e sem pressa, mas ainda indo ao cabo**. O `Match` o manda por `dirigirOsInvasoresAosAlvos` (a mesma ordem `hold` dos manifestantes).
3. **A barra do chefe no HUD** (`ui/PraiaHud.ts`): só com o Colossus em campo. Título "COLOSSUS-01 · FASE n DE 3 · ANDA/MANCA/RASTEJA", a barra do tronco, as duas pernas (PERNA ESQ / PERNA DIR, riscadas quando caem) e **a regra da fase dita numa linha** ("Ele vai cortar os cabos. Derrube as pernas." / "Uma perna caiu: ele manca. Derrube a outra." / "Rasteja e atira. Acabe com ele antes que o último cabo caia."). Avisos no topo: "UMA PERNA CAIU · ELE MANCA", "RASTEJA · ACABE COM ELE", "COLOSSUS-01 CAIU". O DOM só muda quando a fase, as pernas ou a barra (passos de 1%) mudam.
4. **A máscara** (`entities/mascaraDoChefe.ts`): a **caricatura** do Trump (sátira política, pedido do Comandante), **só no Colossus que é o chefe da missão**; o Colossus que o jogador monta no Hangar não a tem. **12 caixas e 3 materiais, criados uma vez** na montagem do chefe: rosto laranja chapado, nariz saltado, sobrancelhas, fendas dos olhos e da boca, o topete dourado que cai para a frente e as laterais. **1,3× a cabeça** (a cabeça tem 1,65 m numa máquina de 14 m; no tamanho dela não se lia de longe). **Desligável: `?mascara=0`** (ou `off`/`nao`) no link tira; sem o parâmetro ela entra.

**Provas:** **8 testes da regra pura** (`FasesDoChefe.test.ts`: a fase pelas pernas, a perna ferida de pé que não muda a fase, os códigos e os textos do HUD, o rastejo a 30% onde um Mech comum fica imóvel, o cabo mais perto e o desempate, o cabo cortado que não vale, os três cortados (vai à porta), os avisos); **5 de partida** (`Match.chefe.test.ts`: só a onda 6 traz o chefe, que rasteja e veste a máscara, e o `?mascara=0` a tira; ele corta o cabo em ~17 s e segue para o próximo; as pernas mudam a fase e o que rasteja ainda anda, devagar, ao cabo; o tronco zerado o derruba; com os três cabos cortados vai à porta principal); **5 da máscara** (o link, as peças e o grupo, o desenho na frente da cabeça, a escala com o rosto no meio, idempotente e fora do Hangar). **19 de 19 mutações à mão pegas**. Capturas: `arte/praia-cabecadochefe-d1-d30-claude.jpg` (a cabeça do Colossus com a máscara) e `arte/praia-chefe-d1-d30-claude.jpg` (o titã inteiro no cais).

**Decisões desta parte (também no HISTORICO):** só o chefe rasteja; o alvo é o cabo mais perto ainda de pé e depois a porta principal; o jogador pode **kitar** (afastar o titã dos cabos atirando e correndo: é permitido, é uma estratégia); a máscara é 1,3× e desligável; **o risco jurídico e de plataforma de caricaturar uma figura pública segue registrado em `CAMPANHAS_E_CHEFES.md` § 0 e o botão de desligar fica**.

**Onde o Comandante confere:** `?modo=survival&mapa=praia&onda=6` (a onda do chefe): veja a barra no topo, derrube uma perna e leia o aviso e a regra mudarem; `&mascara=0` tira a máscara. Para ver sem jogar: `praia.mjs --arte --sufixo d1 --dias 0.3 --vistas cabecadochefe,chefe --chefe "20,27"` (e `--sem-mascara`).

**Falta (R13):** **o equilíbrio jogando** (a vida e a velocidade do chefe, os 30% do rastejo, o peso 4 nos cabos); **dano a tiro nos cabos, nas portas e no quadro**; a missão só offline (o pool de 13 personagens passa dos 8 de uma sala, G11); a ficha de fato da Enel como cartão no jogo; as vozes (a chave do ElevenLabs foi exposta e precisa ser girada pelo Comandante); **as outras fases** (Arena/Cidade Neon, Bunker, Domínio) ainda não ganharam a melhoria que o Comandante pediu.

**Próxima sessão começa com:** **melhorar as outras fases além da estação de cabos** (a ordem de 17/10), e o ajuste fino jogando do capítulo 1.

## O IDIOMA E A CONTA SAEM DO FUNDO DO MENU PARA O CANTO DA PRIMEIRA TELA — Claude, 17/10 (branch `claude/atalhos-idioma-conta`, P176)

**O Comandante (17/10):** *"nao achei o arpao no hangar, nem a mudança das linguas, nem login"*.

**O que conferi antes de mexer:** abri o **site de produção** num navegador de verdade (sessão limpa, build `bbbc1d8`): o seletor de idioma existe e troca o jogo para o japonês na hora; o bloco da conta existe; o Marauder está destravado e o **Arpão magnético** está na lista de ombros. **Estava tudo no ar, mas escondido:** a primeira tela é a "enxuta" (P133) e só mostra *CLIQUE PARA JOGAR* e *EXPLORAR HANGAR E MODOS*; o idioma e a conta ficavam em Explorar → Ajustar → aba JOGO → rolar, e o arpão exige escolher o Marauder (o último chassi) e abrir a lista dos ombros.

**Feito:** (1) **`<nav class="cc-atalhos">` no canto da primeira tela e da pausa**: o seletor de língua e o botão **[ CONTA ]**; o botão abre as Configurações na aba JOGO **já rolada até a conta** (`data-settings-foco`); (2) os dois seletores de idioma (o do canto e o das Configurações) andam juntos (`i18n.ts`: conjunto de seletores); (3) o botão some enquanto o jogo carrega (não teria o que abrir) e no modo Comandante (o canto é do selo dele); (4) traduções do botão e da dica nas seis línguas (482 textos por língua); (5) teste: o idioma e a conta estão **dentro do `#overlay`, antes do cabeçalho** (um canto que volte para o fundo do menu quebra o teste).

**Custo de CPU:** zero (dois elementos de HTML e um `scrollIntoView` no clique).

**Falta (R13):** (a) **o arpão continua só no Marauder, dentro da lista de ombros**: é a regra (só ele tem ombros), mas não há nada na primeira tela nem no Hangar do Vector-09 que diga isso; se o Comandante quiser, dá para pôr um aviso no cartão do chassi ou uma dica no Hangar; (b) **o olho do Comandante**: se depois do Ctrl+F5 ainda não aparecer, ele precisa dizer **onde está jogando** (site ou pasta local); (c) a landing do site (`/`) segue só em português.

**Próxima sessão começa com:** o que o Comandante disser jogando; a decisão da P171 (ritmo oficial, cosmético de explosão).

## CAPÍTULO 1, PARTE C: O PORTO — os contêineres de desembarque e o quadro de luz da cidade — Claude, 17/10 (branch `claude/cap1-parte-c`, P163, P164)

**As ordens do Comandante:** *"o porto é onde os inimigos chegam, eles devem sair dos contêineres (e na campanha de ondas isso deve ser bem explícito)"* e *"no porto, tem que ter um botão ou chave ou sistema que devemos proteger, para acender as luzes da cidade… um tipo de circuito que podemos repetir nas diferentes fases"*.

**Feito (na missão em ondas da praia):**
1. **Os contêineres de desembarque** (`PraiaLayout.ts`, `PraiaPorto.ts`): três contêineres laranja no cais (a coluna leste do pátio, fileiras z = -48, -32 e -16), a porta para o leste. **Quando a onda entra em campo as portas se abrem para fora** (~2 s, as folhas acendem em laranja de alerta) e **os Mechs e os andróides rebeldes nascem pelas bocas deles**; entre as ondas fecham. Antes os rebeldes nasciam na areia, a ~200 m da estação; agora **a mais de 460 m**: o ritmo mudou (a massa de manifestantes chega em poucos segundos e as máquinas ~45 s depois).
2. **O quadro de luz da cidade** (`sim/QuadroDeLuz.ts`, regra pura, G14): o armário de força na **ponta oeste do cais, a mais de 500 m da estação**. **Da onda 2 em diante o primeiro andróide vivo é o saboteiro**: atravessa o cais e o depreda (peso por tipo; um andróide sozinho leva 80 s). **A energia da cidade é a vida do quadro**: as luzes públicas (bulbos, halos, janelas, poças, feixes) viram o **ciclo do dia vezes a energia**; com o quadro **apagado a cidade fica no escuro e as zonas de cura e de resfriamento deixam de funcionar** (e o desenho delas some). O jogador que chega, sem rebelde em cima, recupera (8/s, até dois; volta a ligar com 25%).
3. **O que o jogador vê:** o painel do armário (verde ligado, laranja trêmulo sabotado, vermelho piscando apagado), uma célula no HUD sob as portas e o aviso no topo ("QUADRO DE LUZ SOB SABOTAGEM · A CIDADE VAI AO ESCURO", "CIDADE NO ESCURO · AS ZONAS DE CURA CAÍRAM", "QUADRO DE LUZ RECUPERADO · A LUZ VOLTOU").

**Provas:** **11 testes da regra pura** (inclui determinismo e invariantes sob 36 mil ticks e o interruptor das zonas); **6 de partida** (`Match.quadro.test.ts`: só a praia tem o quadro, as ondas nascem nas bocas dos contêineres, as portas abrem com a onda em campo, a onda 1 não sabota e a 2 manda o saboteiro, o quadro apagado derruba as zonas e o jogador as religa, `restartMission`); **9 do desenho e dos avisos** (a abertura andando, as folhas abrindo para o leste, o painel, as luzes da cidade sem energia mesmo de noite, as zonas que somem, o teto de desenhos); o layout (os contêineres, as bocas, o quadro). **19 de 19 mutações à mão pegas.** Capturas: `arte/praia-conteineres-c1-d100-claude.jpg` (as portas abertas, dois andróides nas bocas, à noite), `arte/praia-quadro-c1sabotado-d100-claude.jpg` e `arte/praia-quadro-c1apagado-d100-claude.jpg`.

**Onde o Comandante confere:** `?modo=survival&mapa=praia`: veja as portas dos contêineres abrirem no cais quando a onda começa (vá até lá pelo calçadão) e os rebeldes saírem por elas; na onda 2 (`&onda=2`) olhe o HUD: o quadro entra sob sabotagem; corra até o armário na ponta oeste do cais (uns 40 s) e recupere. Para ver sem jogar: `praia.mjs --desembarque --vistas conteineres` e `--quadro "2:0:0" --vistas quadro`.

**Falta (R13):** **o equilíbrio jogando** (o saboteiro leva 80 s; a viagem do jogador, uns 40; os rebeldes agora andam 460 m: cada número é linha de tabela); dano a tiro no quadro, nas portas e nos cabos; **a parte D (a Colossus em três fases, a barra do chefe e a máscara)**; os lugares só de andróide e drone (P149); a ficha de fato da Enel como cartão no jogo. Só offline.

**Próxima sessão começa com:** a **parte D** (a Colossus), e as outras fases.

## CAPÍTULO 1, PARTE B: A INVASÃO DO PRÉDIO — o manifestante, as duas portas e a rua dos fundos — Claude, 17/10 (branch `claude/cap1-parte-b`, P163, P166)

**A ordem do Comandante:** *"os mesmos manifestantes e humanoides inimigos ficam invadindo o prédio da estação, e tem que ter uma entrada principal, e também uma entrada na rua dos fundos (pra dar mais possibilidades de ataque e vulnerabilidade)"*, e *"CONTINUA SEGUINDO A PARTE B, C e a D, e melhore as outras fases"*.

**Feito (na missão em ondas da praia):**
1. **O manifestante** (`entities/chassis.ts`, `entities/Android.ts`): o vândalo humano dos eventos reais que o Comandante pediu (o Capitólio, 6/1/2021; os Três Poderes, 8/1/2023): **camisa amarela, boné e bandeira**, pele sem rosto de ninguém, **sem arma de fogo**. Corpo de andróide, **mais fraco e mais lento** (cai com um tiro certeiro no tronco); a "arma" é a pancada de bandeira, **metade da motosserra**. Pool de 5 no `BotSystem`; os planos das ondas 2 a 6 trazem **2, 3, 3, 5 e 3**; **só na praia** (a Arena e o Bunker seguem como eram).
2. **As duas portas do prédio** (`sim/PortasDaEstacao.ts`, regra pura, G14): a **entrada principal** (fachada sul) e a **dos fundos** (fachada norte), 400 de vida cada. Todo rebelde a menos de 7 m a **força** (Mech e manifestante 1, andróide 0,4, Colossus 4: três manifestantes arrombam uma porta em ~33 s); **arrombada, drena a rede da estação** (12/s cada) e só se **recupera** com o jogador ou um aliado perto e sem invasor em cima (8/s, até dois; volta aos 30%). Porta forçada não se recompõe sozinha.
3. **Duas frentes ao mesmo tempo:** os manifestantes nascem **três pela avenida** (a oeste, entrada principal) e **dois pela rua dos fundos** (atrás do muro norte, entrada dos fundos); cada vaga do pool tem o alvo dela (a porta principal, a dos fundos ou um cabo) e recebe a ordem `hold` do Domínio; os andróides seguem para os cabos (parte A).
4. **O que o jogador vê:** a porta fica **laranja e treme** forçada e, **arrombada, escura, aberta de lado e piscando em vermelho**; duas células no HUD sob os cabos e o aviso no topo ("ENTRADA DOS FUNDOS ARROMBADA · INVASORES DENTRO").

**Provas:** **12 testes da regra pura** das portas (estrutura, o peso de cada invasor, a porta forçada que não se recompõe, o conserto e o teto de dois, o invasor que impede o conserto, determinismo e invariantes sob 36 mil ticks); **9 testes de partida** (`Match.portas.test.ts`: o manifestante mais fraco e sem arma de fogo, o plano das ondas, só a praia tem o pool, a onda 3 ativa os 3 com um pela rua dos fundos, a ordem `hold`, o grupo dos fundos que chega sozinho à porta, a porta que o jogador recupera, o dreno da rede isolado e o `restartMission`); **8 do desenho e dos avisos**; a Arena segue com o plano de sempre. **15 de 16 mutações à mão pegas** (a que escapou é equivalente: a guarda `defesa > 0` era redundante, porque o reparo já é zero sem defensor; uma segunda escapou na primeira rodada, o teste do dreno estava frouxo, foi reforçado e agora pega). Capturas: `arte/praia-manifestantes-b1-d0-claude.jpg` (cinco manifestantes ao lado de um andróide), `arte/praia-portafrente-b1-d60-claude.jpg` e `arte/praia-portafundos-b1-d60-claude.jpg` (a da frente forçada, a dos fundos arrombada).

**Onde o Comandante confere:** `?modo=survival&mapa=praia&onda=2`: os manifestantes saem pela avenida e pela rua dos fundos; olhe o prédio pelos dois lados; deixe um grupo forçar uma porta e veja a célula do HUD mudar; chegue perto da porta, sem invasor, para recuperar. Para ver sem jogar: `praia.mjs --portas "1:0.45,2:0" --vistas portafrente,portafundos` e `--manifestantes "186,26;188.5,29" --vistas manifestantes`.

**Falta (R13):** **o equilíbrio jogando** (cada número é linha de tabela em `PortasDaEstacao.ts`; os manifestantes chegam primeiro, em poucos segundos, e as máquinas depois); **o pool soma 13 personagens, mais que os 8 character controllers de uma sala (G11)**: vale offline e **a missão online terá de caber no teto**; dano a tiro nas portas e nos cabos; **a parte C (o porto: os contêineres que abrem e soltam os inimigos, e o quadro de luz)** e **a D (a Colossus em três fases, a barra do chefe e a máscara)**; os lugares só de andróide e drone (P149).

**Próxima sessão começa com:** a **parte C** (o porto), depois a **D** (a Colossus), e as outras fases.

## OS REBELDES ATIRAM O LASER E O PAINEL CONTA O RITMO DE CONTEÚDO — Claude, 17/10 (branch `claude/bots-laser`, P175)

**A ordem do Comandante (17/10):** *"…e pendências abertas recentes"*. Duas dessas pendências estavam escritas no estado e na análise do War Robots (P171).

**Feito:**
1. **O bot atira o laser** (`BotSystem`, `sim/esquadrao.ts`, `Match`): o esquadrão aceita o laser como arma do bot (`armaServeAoBot`, antes recusava feixe) e o bot manda **um pulso por `fireInterval`** pelo `Match.beamPulse` (o mesmo do jogador: acha o primeiro alvo, aplica o dano com as defesas do caminho, acende o desenho e, no servidor, vira evento de tiro para os outros clientes). Mão principal e mão esquerda. A direção é a que o cérebro mirou (com o erro de mira da dificuldade), então o bot erra como erra com plasma. Sem a partida atrás (`pulso` ausente), o bot com laser fica calado, nunca quebra.
2. **Sala de controle → Ritmo de conteúdo** (`scripts/site/dados.mjs` `conteudoPorSemana`, `painel.mjs`, `sala.mjs`): cada **arma** e cada **chassi** do jogo conta uma unidade na semana (segunda-feira) em que o merge que o trouxe entrou na `main`; os ids saem do código, as datas do git (`--first-parent -S`). Hoje: **30 unidades, 7,3 por semana** nas semanas completas (21/09: 6, 28/09: 6, 05/10: 10, 12/10: 8 até agora). É o número que a análise do War Robots pedia ("o produto é a cadência").
3. **Testes (+12):** `botLaser.test.ts` (6: o esquadrão aceita o laser; pulsos na principal e na esquerda com física de verdade, intervalo, dano, determinismo) e `ritmoDeConteudo.test.ts` (6: cada arma conta uma vez, semanas seguidas desde a segunda-feira, a unidade cai na semana da data, média sem a semana corrente). **8 mutações pegas** (5 no bot, 3 no ritmo).

**Custo de CPU:** o bot com laser faz um raycast por pulso (7,7 por segundo enquanto atira, como o jogador); só quando o esquadrão lhe dá o laser (o padrão do jogo não muda). O painel roda no build do site (uns 40 chamadas de `git log`), nada no jogo.

**Falta (R13):** (a) **D7 e DAU/MAU** no painel: pedem um id anônimo por visita (hoje a telemetria conta eventos por IP, sem pessoa); decisão do Comandante (LGPD); (b) a **meta oficial** de conteúdo (2 por semana, 1 evento a cada 6) segue com ele (P171); (c) o **bot não usa o arpão** (só há ombros no Marauder, e o bot não os tem); (d) o ritmo não conta o que não é arma nem chassi (mapas, pilotos, eventos); (e) a bancada de celular e o desenho do evento mínimo (P171).

**Próxima sessão começa com:** o que o Comandante julgar (as línguas, o login, o arpão, o laser dos bots) e as decisões da P171 (ritmo oficial, inglês antes de monetização: respondida, cosmético de explosão).

## O LOGIN DO JOGADOR, COMPLETO: a conta leva o progresso para outro aparelho — Claude, 17/10 (branch `claude/login`, P174)

**A ordem do Comandante (17/10):** *"quero também que concluamos sobre o LOGIN"*. A conta, o limite de tentativas e o formulário já existiam, mas **nada ligava o formulário ao jogo** e a conta não guardava nada do piloto.

**Feito:**
0. **Achado e corrigido no formulário (R17):** o `LoginPanel` (nunca ligado antes) refazia o painel inteiro no `blur`, o que destruía o campo para onde o foco ia e **o botão sob o clique**: clicar em ENTRAR logo depois de digitar a senha **perdia o clique**. Agora o `blur` só mostra o aviso no lugar (`_mostrarValidacao`), com 2 testes (e uma mutação pega).
1. **No servidor:** `GET`/`PUT /conta/progresso` (só com sessão, corpo até 8 KB, validado por `validarProgresso`: nível 1–999, XP 0–999, créditos até 1 bilhão, montagem até 4 KB, apelido pelo mesmo filtro da sala online; campo a mais do cliente é descartado); tabela `progresso` (uma linha por conta, substituída a cada `PUT`). **Achado e corrigido (R17):** `/conta/eu` não respondia ao **preflight do CORS** (o jogo em `cybermech.online` chama o servidor em outra origem com o cabeçalho da sessão); agora responde, e a rota nova também.
2. **No cliente:** `net/sessao.ts` (`SessaoPiloto`: token por servidor, entrar/criar/sair, restaurar ao abrir, **mescla** e envio com 5 s de calma; rede fora nunca trava nem apaga nada), `net/progressoLocal.ts` (liga a sessão ao que o navegador já guardava: nível/XP/créditos, apelido, montagem; **nenhuma chave nova de progresso**), `ui/ContaSettings.ts` (o `LoginPanel`, já pronto, nas Configurações → JOGO → CONTA DO PILOTO), `DailyChallenges.snapshot/restore/onSave`, `ContaCliente.lerProgresso/gravarProgresso`.
3. **A regra da junção** (`mesclarProgresso`, pura): quem tem **mais nível e XP vence por inteiro** (os créditos andam com o nível: somar dobraria o ganho de quem usa dois aparelhos); empate, o gravado por último; apelido e montagem do outro cobrem o que faltar. Aparelho novo recebe o da conta; convidado que jogou antes de criar a conta **não perde nada**.
4. **Idiomas:** os textos do formulário e as mensagens de erro entraram nas seis línguas (475 textos por língua; o teste cobre a validação e as frases de estado).
5. **Testes (+64):** `progresso.test.ts` (contrato e mescla), `conta-progresso-http.test.ts` (o servidor de verdade: 401, 400, 413, isolamento entre contas, preflight, origem), `sessao.test.ts` (21: junção nos dois sentidos, rede fora, restaurar, sair, envio com calma), `progressoLocal.test.ts` e `auth.test.ts` (o cliente). **18 mutações: 16 pegas e 2 equivalentes** (cancelar o envio ao sair e agendar sem sessão não mudam nada que se veja: sem token a sincronização não faz nada). **Prova no navegador de verdade** (`arte/login-*-claude.png`): um convidado de nível 5 (300 XP, 1234 créditos, apelido ANA) cria a conta num "aparelho"; um navegador limpo entra com ela e **recebe nível, XP, créditos e apelido**; sair não apaga nada do aparelho.

**Custo de CPU/rede:** zero no jogo; uma ida ao servidor ao entrar (um `GET`, e um `PUT` se algo mudou) e **um `PUT` por janela de 5 s de calma** depois de uma mudança de progresso (pouquíssimas por partida). Servidor: um `SELECT`/`INSERT` por chamada; nenhum custo por tick (G13).

**Falta (R13, em `STATUS_REAL.md`):** (a) **o olho do Comandante**; (b) o **ranking** (C4) e o **clã** (C2) do plano; (c) um convite "gostou? guarde seu progresso" depois da primeira partida (a conta só aparece nas Configurações); (d) **recuperar senha** (não há e-mail de recuperação); (e) apelido único; o apelido da conta passa a valer na caixa do lobby **depois de recarregar**; (f) as missões do dia ficam só no navegador; (g) **LGPD:** o e-mail é guardado (o mínimo); falta o "apagar minha conta".

**Próxima sessão começa com:** o que o Comandante julgar do login e das línguas; depois as pendências recentes (bots com o laser; contadores do painel).

## O ARPÃO MAGNÉTICO CHEGA AO JOGO: a arma que prende e puxa — Claude, 17/10 (branch `claude/arpao-no-ar`, P77 3ª parte, protocolo 20)

**O que era:** o porte do arpão de 12/10 (`claude/arpao-magnetico`) nunca entrou na `main`; refeito sobre a `main` de hoje (a sessão anterior deixou o porte parcial local).

**Feito:**
1. **A arma (`harpoon`, só de ombro):** raio de 45 m que morde 10 e **prende o primeiro inimigo à vista**, puxando-o a 9 m/s por até 1,6 s; um aperto a cada 4 s; os dois ombros dividem um cabo. **Contrajogo:** o dash do alvo corta o cabo, a parede também, o Colossus (raio > 2,4 m) o arrebenta, aliado e dono nunca são presos. Regra em `combat/HookSystem.ts` (G14: a mesma offline e no servidor; só o tick fixo; pool de 8).
2. **Ligação:** `Armament` → `PlayerController.hook` → `Match.hookShot` (jogo e `NetPilot` do servidor); `onHook` vira evento de tiro; **protocolo 20** (`harpoon` no fim de `NET_WEAPONS`); `OnlineSession` desenha o raio do arpão de outro jogador (`Match.drawHook`).
3. **Desenho:** `fx/HookVisuals.ts` (o cabo preso, um `InstancedMesh`, pulsa; ciano o seu, vermelho o do inimigo) e o raio do disparo pelo `BeamVisuals`; modelo 3D (bobina e cano com garras), ícone do Hangar, retícula, som (`armasSom.json`), dica de primeiro uso, ficha do Arsenal e o "Testar" do Hangar.
4. **Testes (46 novos):** `HookSystem.test.ts` (prender, `breakRadius`, cabo dividido, pool, puxar, e cada causa de soltar: tempo, chegou, dash, morte, estouro, parede, sem dano ligado), `harpoon.test.ts` (dados, Armament, `Match.hookShot` com física: parede, alcance, o primeiro à vista, aliado, cliente online, `drawHook`) e `HookVisuals.test.ts` (instâncias, cor, NaN). **13 mutações pegas** (limite do raio, dash, puxar sem dano, intervalo da parede, chegada, estouro, segundo ombro, aliado, cliente online, alcance, mordida, Armament, cor).

**Custo de CPU:** um raycast por aperto (a cada 4 s) e **um raycast a cada 6 ticks por cabo preso** (no máximo 8); um `push` por tick por cabo; no desenho, dois `setMatrixAt` por cabo (uma chamada de desenho). Nenhum `new` por tick/quadro (G4/G5).

**Falta (R13):** (a) **o olho do Comandante** (o puxão e o cabo); (b) o **cabo preso de outro jogador** não é desenhado no online (só o raio do disparo); (c) o **bot não usa o arpão**; (d) drone de ombro, ultrassônico e ombros para Bastion/Colossus (P77).

**Próxima sessão começa com:** o login (P174) e as pendências recentes (bots com o laser; contadores do painel).

## O JOGO FALA SETE LÍNGUAS — Claude, 17/10 (branch `claude/idiomas`, P173)

**A ordem do Comandante (17/10):** *"sim, vamos JÁ colocar a opção para outras línguas (inglês, japonês, espanhol, francês, chinês, russo)"*.

**Feito:**
1. **`client/src/i18n/i18n.ts`:** o texto de origem é o português (nenhum módulo de interface precisou mudar); cada língua é um JSON em `client/public/locales/` (`{ "texto em português": "tradução" }`, com lacunas `{0}` para o que o jogo preenche). `traduzir()` é pura (busca exata, padrões com lacuna, cache de 2000); a camada de DOM traduz a página e **observa** (`MutationObserver`) o que o jogo escreve depois (HUD, avisos, menus), inclusive `title`/`aria-label`. **A troca é ao vivo** (cada nó guarda o original), sem recarregar.
2. **Escolha:** `?lang=` do link → a escolha salva (`cybermech.lang`) → a língua do navegador (**só fora de navegador de teste**, para as bancadas e o smoke seguirem comparando português) → português. Seletor em Configurações → JOGO → *Idioma · Language* (sempre bilíngue, para quem está perdido).
3. **445 textos por língua** (en, es, fr, ja, zh, ru): menus, configurações, controles, HUD de combate, avisos de missão, bandeira e domínio, dica de cada arma, nome das armas, modos, setores, desafios, tela de carregamento (com as dicas) e os 3 textos que o CSS escreve (`content`, por `:lang()`).
4. **Testes (26, `i18n.test.ts`):** seis dicionários com **as mesmas chaves**, sem vazio, com as mesmas lacunas, e cada língua na sua escrita; **cobertura por teste**: a dica e o nome de **cada arma** (arma nova sem tradução quebra o teste), os rótulos das configurações, as dicas do carregamento e **todo texto do `index.html`**. Cinco mutações pegas (detecção em navegador de teste, lacuna não traduzida, ordem de especificidade, cache, margens).

**Custo de CPU:** zero em português. Fora dele, um observador de mutações (o HUD troca texto, no pior caso, por quadro) e uma busca em tabela com cache; **nada na simulação** (G1/G2). Peso: o JS cresce ~3 KB; cada dicionário é um JSON de ~20–27 KB (7–9 KB com gzip) que só baixa quem escolheu a língua (G12).

**Falta (R13, está em `STATUS_REAL.md` como PARCIAL):** (a) **revisão por falante nativo** (as traduções são do Claude); (b) a **voz do narrador** segue em português/sotaques; (c) textos desenhados em canvas (placas de nome, mapa-múndi) e as fichas longas do Hangar; (d) a landing do site (`scripts/site/`) continua só em português; (e) a vírgula decimal das dicas (`0,85 s`) não vira ponto em inglês.

**Próxima sessão começa com:** o login (P174), o arpão magnético (P77) e as pendências recentes (bots com o laser; contadores do painel).

## O SITE VIROU PORTAL DE JOGO: sistema de design, fotos cinematográficas dos Mechs reais e as três páginas no mesmo visual — Claude, 16/10 (branch `claude/landing-referencia`, P172)

**A ordem do Comandante (16/10):** *"quero bem parecido com as imagens de referência"*, depois *"falta acabamento UX e UI, mais estiloso, mais único, sair dos padrões"* + a orientação de um profissional (resumida no `DESIGN_SYSTEM_SITE.md`).

**Feito:**
1. **`DESIGN_SYSTEM_SITE.md` + `scripts/site/hud.mjs`:** paleta oficial (preto industrial, amarelo `#ffd000`, branco técnico), **Chakra Petch** (títulos) + **Barlow** (texto), hospedadas no próprio site; componentes reutilizáveis (`hudNav`, `sectionHeading`, `featureCard`, `gameButton`, `pageHero`…); revelar ao rolar, paralaxe do herói e fade entre câmeras, só CSS, com `prefers-reduced-motion`.
2. **Fotos dos Mechs REAIS** (`.decepticons/medicoes/cena-cinematica.mjs`, ~10 s cada): Colossus-V4, Vector-09 e Marauder (os `.glb` e o procedural do jogo) num hangar com luz, névoa, brilho e faíscas; herói, duelo, a escala dos quatro chassis, o Marauder do Hangar e o desenho de cada arma. A **posição das partes na foto** (régua de 20 m, os 6 marcadores do Hangar) sai da projeção 3D e a landing posiciona os rótulos por ela. Substitui o `landing-assets.mjs` do Codex.
3. **Landing:** herói com o Colossus de 20 m e a régua, seletor de câmeras com o que cada uma faz, quatro recursos da VITRINE, "Sem pay-to-win" (as 4 linhas do GAME_DESIGN), Hangar com os 6 módulos do Marauder (blindagem do código), os **quatro tamanhos de robô na mesma escala** (Andróide 1, Vector-09 2, Colossus-01 3 lado a lado e o Colossus-V4 4 por trás, discreto: ordem do Comandante durante a sessão), seis armas com tabela de 3 níveis, três modos, esquadrão, controles e FAQ. O botão de jogar do cabeçalho só aparece depois do herói (nunca dois CTAs juntos). Texto menor que 12 px não existe mais.
4. **Oficina e sala de controle:** mesmo sistema. A sala ganhou cartas por IA (commits, entregas, últimas atividades), **mapa de calor por dia da semana e hora** e registro de entregas/commits **filtrável por quem fez**, tudo do git; "Como um pedido vira jogo".
5. **Teste do site (`site.mjs --check`):** conta recursos, armas, partes do Hangar e compromissos; troca de câmera; **toda imagem da página responde 200**; o clique no CTA do herói.

**Custo de CPU:** nenhum no jogo. Página: imagens estáticas, animações só de CSS (opacity/transform), um observador que desliga cada bloco depois de revelá-lo. Peso: herói 265 KB, 5 fontes ~100 KB.

**Falta (R13):** (a) **o olho do Comandante**; (b) o herói é **foto**, não 3D ao vivo (decisão de custo; a foto é regenerável); (c) os modelos das armas do jogo são simples, por isso as fotos de arma são sóbrias (a arte conceitual das referências não foi usada: não é o jogo); (d) as ilustrações do esquadrão são recortes da referência do Comandante; (e) páginas próprias de **Hangar/Arsenal** com comparador e **Pilotos** (não existe no jogo) ficam para o próximo PR.

**Próxima sessão começa com:** o veredito do Comandante sobre o visual; depois, o que ele apontar (a lista de (e)).

## O CHECKPOINT DAS EXPLOSÕES E AS LIÇÕES DO WAR ROBOTS — Claude, 16/10 (branch `claude/checkpoint-explosoes`, P170 e P171)

**O Comandante (16/10, depois de jogar):** *"as explosões das armas estão ficando INCRÍVEIS! mantenha essa qualidade e marque esse ponto como um checkpoint"*; e colou a reportagem dos US$ 1 bilhão do War Robots.

**Feito:** (1) **checkpoint** `checkpoint/explosoes-v1` (tag no `54c6972`), `CHECKPOINTS.md` (o que faz o olhar, a prova guardada, os 4 passos de conferência e a regra de não regredir) e a bancada versionada `medicoes/explosoes.mjs`; (2) `LICOES_WAR_ROBOTS.md`: a reportagem em números e o que muda no que fazemos (cadência de ~2 unidades de conteúdo por semana e um evento a cada ~6 semanas, celular primeiro, Brasil como volume, retenção como número, copiar o mecanismo e não o pay-to-win, estilos de explosão como primeiro cosmético).

**Falta:** a decisão do Comandante sobre o ritmo oficial, o inglês e o primeiro cosmético (`LICOES_WAR_ROBOTS.md` § 4); contar conteúdo e D7/DAU-MAU no painel; o arpão magnético (P77) está num porte parcial local (`claude/arpao-no-ar`, não empurrado).

**Próxima sessão começa com:** o que o Comandante decidir; senão, o desenho do evento mínimo.

## CADA ARMA COM A SUA DICA DE PRIMEIRO USO — Claude, 16/10 (branch `claude/dicas-por-arma`, P160 parte 5)

**Por quê:** uma dica só ("FOGUETES: DANO EM ÁREA") aparecia para toda arma de munição, inclusive a granada, o enxame e o cruzador. No texto, a arma nova era o foguete.

**Feito:** `ui/dicasDeArma.ts` (uma frase por arma, com os números da própria arma) e `Onboarding.armaEmUso`: na primeira vez que o jogador atira com uma arma, a frase dela aparece por 6 s e não volta (guardado no navegador). A caixa da dica agora cresce com o texto.

**Provas:** 6 testes (`ui/dicasDeArma.test.ts`); e o jogo de verdade na GPU real: a granada mostrou "GRANADA: CAI NO ANEL VERDE (ATÉ 80 M); MIRE ATRÁS DA COBERTURA E ELA PASSA POR CIMA" e ficou gravada (`arte/armas-dica-granada-claude.jpg`).

**Onde o Comandante confere:** Hangar → uma arma nova → jogar e atirar: a dica aparece na primeira vez (para ver de novo, limpar os dados do site no navegador).

**Próxima sessão começa com:** o que o Comandante disser jogando as partes 1 a 5 da P160.

## CAPÍTULO 1, PARTE A: OS CABOS DE DADOS — andróides injetam, cabos são tomados ou cortados, o jogador libera e conserta; e a ficha de fatos das privatizações — Claude, 16/10 (branch `claude/cap1-cabos`, P162, P163, P166)

**A ordem do Comandante (16/10):** *"privatizações de serviços públicos essenciais, eletricidade, água e esgoto, saúde, segurança, petrobras… pode prosseguir com o capítulo 1"* — e, mais cedo, os cabos como pontos de invasão (*"os inimigos precisam se conectar aos cabos… os androides precisam se conectar a algum ponto do cabo, e os outros ficam protegendo… enquanto temos que atacar e liberar o acesso e a programação orgânica das redes"*) e a fase da estação em três frentes.

**Feito (na missão em ondas da praia, `?modo=survival&mapa=praia`):**
1. **`sim/CabosDeDados.ts`** (regra pura, G14): três cabos, um ponto de conexão cada no pátio (z 40). O **andróide rebelde** ligado ao ponto **injeta** (um sozinho leva 40 s, três ~13 s; o quarto só faz companhia); injeção cheia = cabo **TOMADO**, que **drena a rede da estação** (10/s cada, e a rede não se recompõe). Tomado só se **libera** com defensor perto e sem andróide ligado (~12 s). O **rebelde pesado** em cima do ponto **depreda** o cabo (~67 s para cortar); **cortado também drena** (8/s); o defensor **conserta** (10/s, até dois; volta aos 25%).
2. **`Match`:** conta quem está perto de cada ponto (um laço sobre os rebeldes, aliados e jogadores, sem alocar), **manda os andróides rebeldes aos pontos** com a ordem `hold` do Domínio (um por cabo, replanejado a cada segundo) e soma o dreno dos cabos ao da rede (`NucleoDaEstacao.fixedUpdate` ganhou o dreno extra, que também acende a pressão do alerta).
3. **O que o jogador vê:** o **brilho do cabo** vira vermelho piscando com a injeção (e falha com a vida baixa); sobe um **letreiro com caveira** desenhada em canvas ("INJETANDO FAKE NEWS", "DESINFORMAÇÃO EM MASSA", "ROBÔ DE OPINIÃO", "MANIPULANDO A REDE", "REDE COMPROMETIDA", "CABO CORTADO"), três letreiros em alturas diferentes; **três células no HUD** sob a rede da estação (vida e injeção) e o **aviso no topo** ("CABO 2 TOMADO · A REDE ESTÁ SENDO ENVENENADA").
4. **`fichas/fatos-privatizacoes.md`**: os cinco casos pedidos (Eletrobras e Enel; Sabesp; as organizações sociais de saúde e a PF; o Compaj, com o contraponto de Minas; a Petrobras, que não foi privatizada) com **o que o jogo pode dizer, o que não afirma e a fonte**. **O resultado é misto**, e a ficha diz isso: nenhum cartão afirma "privatizou, ficou pior e mais caro". As fontes primárias ainda não foram lidas.

**Provas:** **16 testes da regra pura** (`CabosDeDados.test.ts`: a injeção, o teto de três, a recuada, o cabo tomado que não se libera sozinho, a liberação por um e por dois defensores, o dano, o cabo cortado que não injeta, o conserto, o depredador que impede o conserto, a independência dos cabos, o reset, e **determinismo e invariantes sob 36 mil ticks de entrada aleatória**); **6 testes de partida** (`Match.cabos.test.ts`, no Match de verdade: só existem na missão em ondas da praia, os andróides vão aos pontos com `hold`, o andróide parado se liga e o cabo é tomado e drena além do invasor, o jogador libera, o Mech depreda e o jogador conserta, `restartMission` zera); o dreno extra do núcleo, os avisos do HUD, o letreiro (frases, opacidade, alturas, sem DOM) e o uniforme do shader. **12 de 12 mutações à mão pegas.** Os testes antigos da praia passam sem mudança.

**Onde o Comandante confere:** jogar `?modo=survival&mapa=praia` e olhar os três cabos no pátio (entre a escotilha e a fachada): os andróides da onda 1 vão cada um a um cabo e se ligam; deixe um ligado e veja a barra e o letreiro; chegue perto sem andróide para liberar. Capturas: `arte/praia-cabos-c1-d72-claude.jpg` e `arte/praia-cabosdalinha-c1-d72-claude.jpg` (um cabo injetando, um tomado, um cortado, no início da noite). Para ver sem jogar: a bancada `praia.mjs --cabos "1:0.6:1,2:1:0.7,3:0:0"`.

**Falta (R13):** **o equilíbrio jogando** (cada número é linha de tabela em `CabosDeDados.ts`; a onda 1 agora tem dois andróides que vão aos cabos, e eles já contavam como invasores dentro dos muros); a **parte B** (a segunda entrada do prédio e o **manifestante** como NPC), a **C** (o porto, os contêineres e o quadro de luz) e a **D** (a Colossus em três fases); os lugares só de andróide e drone (P149); o dano **a tiro** nos cabos; as **fontes primárias** da ficha de fatos. **Só offline**: a missão em ondas não vai para a rede (como o núcleo). A varredura de NaN na GPU real **não rodou de novo** com o brilho dos cabos aceso (a ferramenta não carrega a missão em ondas); o shader novo não tem `pow` sem guarda.

**Próxima sessão começa com:** o que o Comandante achar do equilíbrio dos cabos; senão, a **parte B** (o prédio com a segunda entrada e o manifestante), e o **quadro de luz** do porto (P164) ligado no `lampadas`.

## LANDING E PRIMEIRO ACESSO — entrega P169 (Codex, 16/10)

Branch de origem `codex/landing-primeiro-acesso`, pasta `.tmp/wt-codex-landing`; `main` fc2d1ba integrada, preservando os explosivos dos bots. A disponibilização ocorre pelo merge desta revisão na `main` e pelo publicador com checksum. Não considerar o branch isolado como publicado. Território: landing, tema/painel público, verificações do site, texto/CSS do primeiro acesso e `client/public/press/`.

Landing com abertura industrial preto/amarelo, câmeras interativas, seis sistemas de combate, três chassis com números e links da montagem real, modos e guia inicial. Fotografias geradas com os rigs do Vector-09, Marauder e Colossus-V4; thumbnails de cenário são capturas existentes. A Oficina mantém as tabelas extensas. A fila interna de decisões e os trechos operacionais deixam de ser republicados; o painel local conserva esses dados. Registro literal do dono preservado.

Validação inicial: `npm run check` verde (2.420 testes); desktop 1440×1000/1280×720 e celular 390×844 sem overflow, imagens ausentes ou erro JavaScript. Primeiro acesso e expansão do console conferidos. Revisão cruzada realizada; foco de teclado dos CTAs corrigido. O hook do push revalida a integração final. Provas em `medicoes/LANDING_P169.md` e `arte/*landing-codex*`. Nenhuma alteração de simulação ou rede.

Próxima sessão começa pelo julgamento visual do Comandante e pela medição do funil de primeira partida; ganho de conversão/retorno ainda não medido. Caminhos: raiz de `cybermech.online` e `/jogar/?primeira`.

## OS REBELDES LANÇAM EXPLOSIVOS: salvas de foguetes e granadas contra você — Claude, 16/10 (branch `claude/bots-explosivos`, P160 parte 4)

**A ordem (16/10):** *"bote pra torar na iteração das armas"*.

**Feito:** o Mech bot lança a arma **explosiva** da mão esquerda em **salvas** (`BotController.useExplosives`, `BotSystem.launch`): o casulo de foguetes de fábrica do Vector-09 inimigo (que nunca era usado), e o que o esquadrão der (granadas, teleguiado, lançador leve, cruzador, chuva), pelos mesmos sistemas do jogador. Dois tiros por salva, pausa de 7 s no normal (pela dificuldade e pela personalidade), mira no pé de onde o alvo vai estar, nunca de perto. O lançamento do bot toca o som da arma, mais baixo de longe. O editor de esquadrão passou a oferecer as armas explosivas na mão esquerda do bot.

**Medido (90 s, jogador parado):** offline padrão, 50 explosões em vez de 3 e o jogador apanha menos (os aliados também lançam); Arena do servidor, +34% de dano. As fotos da partida padrão foram refeitas (`esquadraoPadrao.test.ts`, como o teste manda).

**Provas:** 7 testes e **8 mutações à mão, 8 pegas** (`combat/botExplosivos.test.ts`: a pausa por dificuldade e personalidade, a distância mínima (também com o rebelde colado a 9 m: a mutação que tirava a regra escapou até esse teste existir), salvas de até 2 a cada 0,3 s com a pausa entre elas e nunca de perto, o mesmo jogo dá os mesmos lançamentos, desligado não lança, o esquadrão com granadas lança granadas).

**Onde o Comandante confere:** jogar a Arena: os rebeldes soltam pares de foguetes (fita de fumaça e bola de fogo); um esquadrão com granadas na mão esquerda dos rebeldes (editor de esquadrão).

**Próxima sessão começa com:** o que o Comandante disser jogando; os bots com o laser.

## O LANÇAMENTO DE HOJE (P168): o que está de pé, o que segura e o que é do Comandante — Claude, 16/10 (branch `claude/lancamento-lista`)

**A ordem (16/10):** *"vamos lançar nosso jogo hoje ainda"*. Verificado **hoje às 14h50**, não de memória:
- **O site está no ar com o que está na `main`:** `cybermech.online` responde 200 e o pedaço do jogo com o ciclo do dia (`Game-BG1f9Idc.js`) no ar é **byte a byte o do build local** (`PUBLICADO: c88515b`, conferido por checksum).
- **O servidor de jogo responde:** `https://jogo.cybermech.online/status` devolve 200 pela Cloudflare.
- **O jogo e as armas:** 20 armas, a praia com o ciclo do dia, as missões em ondas e o esquadrão (offline) estão na `main`; o `npm run check` rodou verde no push.

**O que NÃO existe, e o jogador sente:**
1. **Login e ranking (P145):** não foram construídos. O jogo roda **anônimo**; sem ranking, o jogador não tem o que voltar para melhorar. *É a maior lacuna de retenção.*
2. **As falas do narrador:** **4 de 76 clipes** existem (o "combate" nos 4 sotaques). O resto fica **mudo** (só "rodada" e "combate" caem na voz do navegador). Falta o Comandante rodar **`npm run vozes -- --custo`** e depois **`-- --gerar --sim`** (72 clipes), ou gravar as falas no Estúdio (aba VOZES).
3. **Aviso de privacidade (LGPD):** **não há página** no site. O jogo manda telemetria de partida para o servidor; antes de divulgar para gente de fora precisa de um texto curto dizendo o que se guarda. *Posso escrever o rascunho; o e-mail de contato e a decisão do que guardar são do Comandante.*
4. **O dia no online:** cada jogador vê o dia pelo relógio do próprio mapa (o servidor já manda `restanteS`; falta ligar).

**O que é só do Comandante (nada disto eu consigo fazer):**
- **Girar a chave do ElevenLabs** (foi colada no chat em 15/10) e rodar a geração das vozes.
- **Cloudflare, no painel:** limite de requisições em `/conta/*`, Bot Fight Mode, DNSSEC; tirar `jogo.selvamkt.com.br` do túnel quando quiser (o endereço novo já funciona).
- **Jogar e julgar:** o ciclo do dia (`?mapa=praia&dia=0.55`), o som das armas e as vozes.
- **Divulgar:** o placar de resultado diz *"na internet, nenhum teste com gente"*: **o lançamento é o primeiro teste**. Recomendação: **lançamento brando hoje** (um grupo pequeno, com o servidor em `/status` aberto ao lado), e só depois o vídeo.

**Próxima sessão começa com:** o que o Comandante responder sobre a lista acima; senão, **login e apelido (P145)** e o **aviso de privacidade**, e o capítulo 1 em fases (P162 a P165).

## O CICLO DO DIA DA PRAIA: pôr do sol no começo, noite com as luzes acesas em 5 minutos; e as ordens da campanha registradas — Claude, 16/10 (branch `claude/campanha-cabos`, P161 a P168)

**As ordens do Comandante (16/10):** o cenário estava claro demais para a hora do sol e com a iluminação pública toda acesa de dia (*"o melhor seria que o cenário começasse de dia e no final do tempo já estivesse de noite… aí as luzes acendem"*); e, lendo o `CAMPANHAS_E_CHEFES.md`, **a história da campanha** (os cabos como pontos de invasão, as três frentes da estação, o quadro de luz, o banco, a máscara da Colossus, o elenco, o norte educativo). E: *"vamos lançar nosso jogo hoje ainda"*.

**Feito (P161, no jogo):**
1. **`environment/CicloDoDia.ts`** (puro, com teste): a curva do dia de 0 a 1 (sol de 0,085 acima do mar a −0,24; a noite fecha quando ele está bem abaixo; as lâmpadas acendem **depois** do pôr do sol), a escolha do relógio (**missão em ondas**, depois **rodada de 5 minutos**; no intervalo a noite fica fechada; Domínio, Bandeira e online usam o relógio do mapa) e o `?dia=` do link.
2. **`Praia.setProgressoDoDia`**: muda a altura do sol e da lua (o azimute **não** muda: as sombras assadas continuam valendo), as três luzes (o sol apaga e avermelha, a hemisférica esfria, a lua sobe), a névoa (rosa → roxo → azul-noite) e a luz de ambiente. Começa **mais escura que antes** (o pedido).
3. **O céu** ganhou o céu da noite, **estrelas** (um ramo do shader que só roda de noite), nuvens de vulto e a lua subindo; **o mar** escurece, perde o caminho de sol e a espuma apaga; **as fachadas** deixam de refletir o sol que se pôs e **acendem mais janelas** com as lâmpadas.
4. **A iluminação pública acende poste por poste**: cada adereço público (poste, refletor, torre de vigia, varal da barraca, farol) tem **o seu instante**; o **bulbo desenhado na malha**, o **halo**, as **poças no chão**, os **feixes** dos refletores e o **farol** ligam juntos. A sinalização (aviso das antenas, boias, navios, semáforos) fica sempre ligada. De dia é só um fio de brilho.
5. **Achado e corrigido no caminho (R17):** o mar lia uma **cópia congelada** do uniforme de tempo (`UniformsUtils.merge` clona), então as ondas ficavam paradas no instante 0. Agora leem o mesmo uniforme da praia.

**Provas:** 19 testes novos (`CicloDoDia.test.ts`: a curva, o relógio, o `?dia=`, as lâmpadas públicas e a sinalização, e a praia de verdade: luzes, névoa, uniformes de céu e mar, o azimute, o bulbo e o halo no mesmo instante, valor torto); **0 NaN em 720 poses na GPU real** (`varrer-nan.mjs --dia 0 / 0.55 / 1`); a contagem de desenhos **não mudou** (51 a 52); capturas em `arte/praia-sol-d*-claude.jpg` e `arte/praia-orla-d*-claude.jpg` (d0 = pôr do sol, d55 = as luzes acendendo, d100 = noite).

**Onde o Comandante confere:** jogar a praia (`?mapa=praia`, ou o modo de ondas) e esperar; ou `?mapa=praia&dia=0`, `&dia=0.55` (as luzes acendendo) e `&dia=1` (noite).

**A campanha (P162 a P167): registrada, não construída.** `CAMPANHAS_E_CHEFES.md` § 0 tem agora as respostas do § 5, o Capítulo 1 em três frentes (cabos com dano e reparo, os pontos de conexão e a injeção com o efeito de dados, o prédio com duas entradas, o porto de onde os inimigos saem dos contêineres e o quadro de luz da cidade), os lugares só de andróide e drone, o capítulo do banco, a máscara da Colossus V1 como skin de chefe e o elenco. **Duas coisas que Claude não fará e o Comandante pode contestar (P166):** criança com arma e personagem desenhado como evangélica (religião fica fora do alvo, a regra do § 2); e o "mulheres" do código do banco. A regra de redação nova: **sátira exagera, fato tem fonte na ficha.**

**Falta (R13):** o julgamento do Comandante (brilho, cores e tempo do dia: são linhas de tabela em `Praia.ts`); o **relógio da rodada no online** (hoje cada jogador vê o dia pelo relógio do próprio mapa; o servidor já manda `restanteS`); o **quadro de luz do porto** (P164); a construção do capítulo 1 em fases; a tela de entrada e o link de convite (P167); login e ranking (P145).

**Próxima sessão começa com:** o capítulo 1 em fases (os pontos de conexão como módulo puro com teste em `sim/`, o dano e o reparo dos cabos); e a **lista do que ainda segura o lançamento** (P168).

## O "TESTAR" DO HANGAR COM A CARA DO JOGO: cada arma testada como ela é — Claude, 16/10 (branch `claude/hangar-testar-efeitos`, P160 parte 3)

**Por quê:** em 15/10 o Comandante disse das armas novas que "pareciam armas antigas". O "Testar" do Hangar desenhava todo tiro com o mesmo traço (ciano na energia, laranja na munição).

**Feito:** `hangar/TestShots.ts` passa cada tiro do teste pela camada de efeitos do jogo (clarão da boca, brilho, rastro em fita, clarão do acerto, faíscas da arma, explosão com corpo, feixe do laser, raio do trilho), na **trajetória da família**: reta na velocidade da arma, a salva do lançador leve com o desvio, os **nove balins** da escopeta em cone, o **arco** do cruzador e o **arco** da granada. O contador de dano do teste passou a contar os balins (R17).

**Provas:** 8 testes (`hangar/TestShots.test.ts`: o arco da granada termina no alvo, o cruzador sobe, os nove balins em pontos diferentes, o laser na hora, o foguete com rastro e explosão, a salva espalhada, o teto do pool, o dano dos balins). Fotos do Hangar na GPU real: `arte/armas-hangar-teste-foguetes-claude.jpg`, `-enxame-`, `-escopeta-`, `-granada-`.

**Onde o Comandante confere:** Hangar → escolher a arma → **▶ TESTAR · 4 S**.

**Próxima sessão começa com:** os bots usarem as armas explosivas (foguetes, granadas, lançador leve) — hoje o inimigo só atira energia.

## O LANÇA-GRANADAS: o primeiro tiro com gravidade, que sobe por cima da cobertura, e a mira prevista em arco — Claude, 16/10 (branch `claude/lanca-granadas`, P160 parte 2b, protocolo 19)

**Feito:** arma nova **`grenade`** (Lança-granadas, média, 3,5 t; braço e ombros do Marauder). A granada **cai no ponto da mira**: o lançador sai no arco baixo (42 m/s) e, se a cobertura o barra, **sobe a elevação (35° a 75°) e regula a carga** para passar por cima e cair no ponto (até 80 m no plano). **Explode no robô**, **tabela na parede**, **crava no chão** e estoura 0,35 s depois (a ~2 m de onde a mira marcou). 34 de dano no centro (48 no MK III), 5 m de explosão, 4 por carga, 1,6 s por granada. Com a arma equipada, a **mira prevista**: o arco em pontinhos e o anel do tamanho da explosão. Rede: **protocolo 19** (um evento de tiro por granada, com a direção da mira; o outro cliente refaz o arco). Modelo 3D (tambor de seis câmaras), ícone, retícula, ficha, som (o do canhão, mais agudo, no Estúdio), oficina e site.

**Provas:** 12 testes (`combat/grenade.test.ts` e o do servidor em `server/room.test.ts`), **12 mutações à mão, 12 pegas** (a primeira rodada achou um teste fraco: sem o ramo da granada no servidor, o tiro virava um foguete reto que também acertava; o teste agora exige a granada no sistema de granadas). Capturas: `arte/armas-granada-bancada-claude.jpg` (o arco subindo por cima do muro com a mira prevista; e sem muro) e `arte/armas-granada-gpu-claude.jpg` (no jogo, na GPU real).

**Onde o Comandante confere:** Hangar → Vector-09 → braço esquerdo → **Lança-granadas** (ou os ombros do Marauder); jogando, o anel verde mostra onde cai; mirar atrás de uma barricada e ver o arco subir.

**Falta (R13):** os bots não usam; ninguém jogou (os números são proposta); o desenho da granada de outro jogador é refeito pelo cliente.

**Próxima sessão começa com:** o que o Comandante disser depois de jogar as partes 1, 2a e 2b da P160; depois, os bots usarem as armas novas (lançador leve, cruzador, laser, granadas).

## A ESCOPETA SAI EM BALINS: nove num cone, a queda vem da geometria — Claude, 16/10 (branch `claude/armas-balistica`, P160 parte 2a)

**Feito:** a escopeta (`shotgun`) sai em **nove balins de 6 num cone de 3,4°** (`pellets`), nascidos no `ProjectileSystem.fire` (vale para o jogador, os bots, o servidor e o tiro de outro jogador, com **um** evento de tiro por disparo e o mesmo desenho fixo, sem sorteio). Medido com física de verdade, o disparo inteiro: **54 até 10 m**, 45 aos 15–20 m, 32 aos 25–30 m, 15 aos 40 m (só 5 balins pegam: o cone tem 4,8 m), 10 aos 50 m. Tempo para derrubar um torso de perto igual ao de antes (4,0 s / 3,2 s). Os balins que acertam juntos viram **um** número de dano e **um** som. Fichas (Hangar, ARSENAL, site) mostram "9 × 6".

**Provas:** 7 testes novos (`combat/pellets.test.ts`: nove projéteis, um evento, o primeiro no centro, todos no cone, mesmo desenho a cada disparo, pool cheio; com física, 9 de 9 a 6 m e no máximo 5 a 40 m) e os de equilíbrio da escopeta reescritos para o disparo inteiro.

**Onde o Comandante confere:** Hangar → um braço com **Escopeta** (ou o Lancer) → atirar num inimigo de perto (um "54") e de longe (os balins espalham).

**Falta:** a parte 2b da P160 (arma de arco com gravidade); o julgamento do Comandante sobre a escopeta mais forte entre 15 e 30 m.

**Próxima sessão começa com:** a parte 2b da P160 (granada que quica, com a trajetória prevista na mira; protocolo de rede novo).

## A CARA DOS TIROS: explosão com corpo, rastro em fita, clarão e marca por família de arma, e o Mech destruído que explode — Claude, 16/10 (branch `claude/armas-impacto`, P160 parte 1)

**A ordem do Comandante (16/10):** *"use a capacidade máxima do modelo OPUS 5.5, e evolua nossas armas, balísticas, shape, cor, potência, alcance, dano, pra ficar realmente BOM o nosso jogo. pense se temos que implementar novos estilos, tipos, formas, etc. … vejo diversos jogos feitos com gpt astra, claude opus 5.5, em 3d, e acho eles ABSURDAMENTE FODAS"*.

**Diagnóstico:** o arsenal já tem 20 armas; o que separava o jogo era a **sensação** de cada tiro. A explosão era só uma nuvem de pontos que somava luz (a "fumaça" também somava, então nunca escurecia), o rastro de míssil uma fila de pontinhos, todo tiro de energia a mesma risca, o trilho uma linha de 1 px, e nada ficava onde o tiro batia.

**Feito (só desenho: nenhum número de arma mudou):**
1. **Explosão com corpo** (`fx/Explosions.ts`): clarão, **bola de fogo low-poly que ferve** e esfria do amarelo ao vermelho, **fumaça escura de verdade** (mistura normal, acesa por dentro pelo fogo no começo, que sobe e se desfaz), **estilhaços em brasa** que voam, quicam e esfriam, faíscas, e no chão o **clarão no asfalto**, a **onda de choque** e o **queimado**. Escala com o raio da arma (míssil leve pequeno, cruzador grande). O **Mech destruído explode** do tamanho dele (`WeaponFx.wreck`).
2. **Rastro em fita contínua** (`fx/Ribbons.ts`): a fumaça (que abre, ondula e sobe) e a língua de fogo do motor em foguete, teleguiado (azul-frio), míssil leve (fita fina), cruzador (fita grossa que desenha o arco), bombas da chuva e obus do canhão.
3. **Clarão da boca, brilho da cabeça e clarão do acerto por família** (`fx/Billboards.ts`, tabela `fx/weaponLook.ts`): plasma como bola de luz verde com núcleo, metal em brasa com língua de pólvora, trilho azul, elétrica que pisca, gelo, EMP em aro; o inimigo em cor de aviso.
4. **Marcas** (`fx/Marks.ts`): furo quente na cor do tiro que esfria, geada do gelo, queimado do laser — só em superfície parada.
5. **Raio iônico do trilho** (era 1 px) e o **feixe do laser** com borda macia e energia correndo (`fx/BeamVisuals.ts`).
6. **Tranco de câmera** que escala com a explosão (`explosionShake`: o cruzador a 70 m ainda sacode; antes parava aos 40 m para qualquer uma).
7. A simulação de tiro só **avisa** (`ShotFx`, campo opcional `fx`); o servidor não monta nada. A varredura de NaN ganhou `--efeitos` (`FERRAMENTAS.md` § 4.1).

**Provas:** 19 testes novos (`fx/WeaponFx.test.ts`: tetos dos pools, vida, nada de NaN nos buffers, a fita de lado para a câmera, marca só em superfície parada, cor do inimigo diferente da do jogador; `combat/shotFx.test.ts`: o contrato com os quatro sistemas de tiro, e que sem `fx` o servidor segue igual) com **23 mutações à mão, 23 pegas**; `npm run check` verde (2 357 testes); **GPU real (AMD): 0 de 192 poses com NaN com os efeitos acesos**; custo **0,45 ms por quadro sob carga extrema** (170 fitas, 219 peças de explosão, 160 cartazes, 80 marcas), 9 desenhos para todos os efeitos, nada alocado por quadro; JS **472,3 KB** de 500. Capturas: `arte/armas-impacto-bancada-claude.jpg` (15 quadros com os sistemas de verdade), `arte/armas-impacto-gpu-mech-destruido-claude.jpg` e `arte/armas-impacto-gpu-fumaca-claude.jpg` (o jogo na GPU real).

**Onde o Comandante confere:** jogar e atirar com **foguetes** (botão 2 do Vector-09), **plasma**, **trilho** e **canhão**; destruir um Mech; atirar numa parede e ver a marca.

**Falta (R13):** o julgamento do Comandante jogando (tamanho, cor, duração: tudo é linha de tabela); o Hangar ("Testar") ainda usa o traço de teste dele; o desfoque de dash. **Parte 2 da P160 (próximo PR):** balística e estilos novos — a **escopeta com balins de verdade** (hoje é um projétil só) e uma arma de **arco com gravidade**, com teste de simulação e a bancada de equilíbrio.

**Próxima sessão começa com:** a parte 2 da P160 (balins da escopeta primeiro).

## A ABA VOZES DO ESTÚDIO: gravar a própria voz, tratar e pôr no jogo, com a sua voz protegida do gerador — Claude, 16/10 (branch `claude/estudio-vozes`, P151)

**A pergunta do Comandante (15/10):** *"a voz do 'combate' em português está muito ruim… será que devo gravar e enviar pra editarmos minha própria voz com efeitos?"*. Respondido que sim; agora **é só gravar no Estúdio**.

**Feito:**
1. **Gravar no navegador:** a fala em letras grandes com a intenção (grave, grito, seco), **medidor de nível** (fica vermelho se estourar), **parada automática em 10 s**, microfone **cru** (sem cancelamento de eco, supressão de ruído nem ganho automático: o tratamento é nosso). O MediaRecorder entrega **webm sem duração**: o servidor o **converte para WAV mono 44,1 kHz** (duração real) e o guarda como **tomada numerada** em `.tmp/SOUNDS/VOZ/<sotaque>/`. A tomada nova já abre **aparada**. **Importar** uma gravação feita fora também funciona.
2. **Tratar:** **os mesmos efeitos dos sons** (a interface de efeitos virou um componente do núcleo, `efeitosUi`, e a aba SONS passou a usá-lo: uma só verdade), com **cinco predefinidos de voz** (Locutor grave, Arena, Rádio de comando, Limpo, Demônio), **redução de ruído** para microfone, e a **prévia com o motor real**.
3. **Salvar como a fala do jogo:** grava `scripts/vozes-gravadas.json`, processa o mp3 (**-16 dB de média**, nível de voz) em `client/public/audio/vozes/<sotaque>/<chave>.mp3` e põe a fala no manifesto: **o jogo já a toca**. A voz gerada que estava ali fica em `_elevenlabs/`; **"Voltar para a voz gerada"** a devolve, byte a byte.
4. **A sua voz é protegida:** o `npm run vozes` **nunca regera** uma fala gravada por você, **nem com `--refazer`** (o resumo avisa quantas protegeu).
5. O validador de clipes ganhou **regras de voz** (nome `<chave>.mp3`, até 8 s depois dos efeitos; as de arma seguem com 4 s).

**Provas:** **12 testes** novos do servidor (o webm do navegador convertido, a taxa e o mono do WAV, a numeração, o lixo recusado sem deixar arquivo, a validação, o processar com a cópia da voz gerada, o reverter, a prévia sem gravar nada) com **6 mutações à mão, 6 pegas**; e a **bancada `medicoes/estudio.mjs`** estendida com o **microfone de teste do Chrome**: gravar, aparar, ligar o predefinido, prévia, salvar, conferir o mp3 trocado e voltar para a voz gerada byte a byte (**29 verificações** no total, numa cópia). Captura: `arte/estudio-vozes.png`.

**Falta (R13):** **o Comandante gravar** (nenhuma fala sua existe ainda; o Claude não ouve áudio: a escolha do predefinido e dos números é do ouvido dele); o **microfone real** depende da permissão do navegador (a página avisa se negada); o **Voice Changer** do ElevenLabs (gasta crédito: fica com `npm run vozes`); o **item no console de comando** (P156); as abas **TIROS E ARMAS** e **MECHS 3D** (P157).

**Próxima sessão começa com:** o que o Comandante responder depois de gravar; senão, o item do Estúdio no console de comando (P156), e o apelido (P145).

## O ESTÚDIO VIRA UM HUB: importar sons que já saem registrados, efeitos (tom, velocidade, compressor, eco…) e prévia com o motor real — Claude, 16/10 (branch `claude/estudio-v2`, P155 a P157)

**As ordens do Comandante (16/10):** *"vamos evoluir mais essa interface do gerenciamento do som: eu enviar um novo som e ficar salvo e registrado corretamente como se tivesse sido adicionado por você; aumentar ou diminuir o pitch e a velocidade, cortar, esticar, comprimir, etc. Da mesma forma que temos a MESA pra editar vídeos, teremos também o estúdio, e futuramente editar os Mechs 3D, armas, tiros (cor, shape, cauda, explosão, força)"*.

**Feito:**
1. **Importar e registrar:** arrastar um arquivo para a página o guarda, cria **um clipe com nome único** (`arma_<nome>`, com sufixo se repetir), corta o começo, o **registra** no mapa, o **processa** e o **abre**, pronto para escolher numa arma. Arquivo corrompido é recusado e **não deixa lixo**.
2. **Motor de efeitos (`scripts/efeitosLib.mjs`):** por clipe, **velocidade** (0,5× a 2×) ou **duração alvo**, **tom ±12 semitons independente da velocidade** (`rubberband`; sem ele, `asetrate` + `atempo`), graves, agudos, passa-alta, passa-baixa, **redução de ruído**, **saturação**, **compressor** (leve, médio, forte), **eco**, **reverso** e **fades**; tudo limitado e validado. **A prévia e o arquivo final usam a mesma cadeia** (`cadeiaBase`), e o volume é medido **depois** dos efeitos; a duração que vale (limite de 4 s, fade, duração máxima da arma) é a de **depois** da velocidade; a cauda do eco e do tempo é cortada na duração final.
3. **Prévia (`POST /api/sons/previa`):** roda o ffmpeg com o clipe como está na tela (salvo ou não) e devolve o som, **sem gravar nada no jogo** e sem deixar arquivo; a onda do resultado aparece; "▶▶ no ritmo" usa a prévia (o som de verdade, com os efeitos).
4. **Hub de módulos:** o núcleo (`scripts/estudio.mjs`) guarda a segurança **uma vez** (127.0.0.1, Host e Origin, nome de arquivo, teto, gravação atômica) e serve a página, os scripts e o estilo; **SONS** é `scripts/estudio/modulo-sons.mjs`; as abas **TIROS E ARMAS** e **MECHS 3D** aparecem "em breve". `scripts\ligar-estudio.cmd` (dois cliques), como a Mesa. Um painel mostra **o que ainda não foi para o jogo publicado** (lê o git) e o que dizer: **"publica os sons"**. O Estúdio **não publica** de propósito.
5. **`ESTUDIO.md`:** a visão, o contrato de um módulo (dado + validador + prévia + processador), a segurança e o desenho de **VOZES** (gravar no navegador), **TIROS E ARMAS** (cor, forma, cauda, explosão, brilho em dado + cena do Three.js; a **força** com o relatório de equilíbrio ao lado e teste de simulação) e **MECHS 3D** (visualizador, encaixes, importar `.glb` pelo `mech:inspecionar`).

**Provas:** **32 testes** (o motor de efeitos, a montagem do ffmpeg, o servidor inteiro com o ffmpeg de verdade) com **6 mutações à mão, 6 pegas**; e a **bancada `medicoes/estudio.mjs`** (17 verificações num Chrome real, com as referências reais, numa **cópia**: ela chegou a sujar a pasta real de referências na primeira versão, corrigi e removi o arquivo de teste). Capturas: `arte/estudio-de-sons-efeitos.png`.

**Falta (R13):** **o Comandante usar** (o Claude não ouve áudio: a prévia, a escolha dos efeitos e o ritmo são do ouvido dele); a aba **VOZES** (gravar a própria voz no navegador, P151); o **item no console de comando** (P156); as abas **TIROS E ARMAS** e **MECHS 3D** (P157).

**Próxima sessão começa com:** a aba VOZES (P151), se o Comandante confirmar a prioridade; senão, o que ele disser depois de usar o estúdio.
