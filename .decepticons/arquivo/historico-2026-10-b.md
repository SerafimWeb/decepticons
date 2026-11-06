# ARQUIVO — HISTORICO_DE_DECISOES (quinzena 2026-10-b)

> Texto movido sem alteração de `HISTORICO_DE_DECISOES.md` por `npm run arquivar`. Não editar: o vivo é o documento principal.

<!-- arquivo -->

## [2026-10-31] O Wargame vira demo e escolhe o modo; o console tem um só lugar de configuração; a chuva de mísseis vai para as costas do Colossus-01 (P292, P293, P294)

**P292:** o Comandante quer o Wargame como demo para rolar à vontade, no modo que escolher. **Decisão:** o modo vai no link (`modo=`) e o Game deixou de forçar o Deathmatch no roteiro. O DEMO é o mesmo elenco sem batidas. **Limite:** Sobrevivência e Bandeira não usam o esquadrão aliado (o `Match` monta os times pelo próprio modo, `arenaMode`); o painel avisa ao trocar. O modo não é guardado pelo SALVAR. **P293:** o AJUSTAR repetia o monitor CONFIGURAÇÕES. Um só lugar: o JOGO entra na lista de CONFIGURAÇÕES; o `btn-settings` foi com ele, e o JOGAR ONLINE, que era inserido antes dele, passou a ficar antes do ESQUADRÃO. **P294:** a chuva de mísseis estava no braço esquerdo porque o encaixe das costas não aceitava a chuva. Agora ela cabe nas costas e dispara pelo caminho do foguete (o `Armament` mandava só projétil); a fábrica do Colossus-01 leva a chuva nas costas. Fábrica com extra vai na versão 3 completa. O canhão das costas não foi alterado: a fábrica não tem canhão lá, e o desenho da malha precisa do olho do Comandante.

## [2026-10-31] O Wargame não solta mais a câmera: C e Esc deixaram de sair da cena, e a visão aérea é o padrão (P291)

O Comandante: "apertei C e saiu" e "não consegui mudar a câmera". **Causa:** o P264 fez C, V, Espaço e Esc chamarem `sairDoWargame()` (recarrega sem o `?wargame=`), para o Comandante não ficar preso sem controle do Mech. Mas o Wargame é um espetáculo: a tecla de câmera não deve ser a saída. **Decisões:** (1) na partida do Wargame, as teclas de câmera não saem; a saída é o botão **SAIR DO WARGAME E JOGAR** da HUD (o caminho para a partida, sem o roteiro); (2) a primeira posição é uma **visão aérea** que dá a volta devagar no centro (`OrbitaDaCamera`, 0,05 rad/s, altura acima dos prédios), olhando a arena; (3) **1, 2 e 3** escolhem a visão aérea, a troca automática a cada 20 s (de novo desliga) e segurar o plano; a troca automática é de **20 s** (o dono achou 15 s rápido demais); (4) trocar à mão zera o relógio. **Fora, por ordem própria:** o modo de partida escolhido no painel (P292) e a auditoria das armas do Colossus (P294), cada um no seu PR.

## [2026-10-30] Console: um nome para cada coisa e uma entrada para cada janela (P287, primeiro corte)

O Comandante: "as camadas se cruzam ainda em alguns lugares, e há itens que se repetem e talvez se anulem… ou um acione errado… menos menus, menos redundância". **Achados (a auditoria está em `AUDITORIA_INTERFACE.md` § 4):** o item **ESQUADRÃO** do monitor COMANDO era um link para a **Sala de Controle** do site (a equipe do projeto), e **ESQUADRÃO** é também a janela dos bots no monitor PILOTOS: o mesmo nome em dois botões que levam a lugares diferentes (o clique errado abre outra aba); o item **FICHA DE CADA BOT** abria a mesma janela do botão ESQUADRÃO (duas entradas, e um teste que as exigia de propósito); o título do **[ AJUSTAR ]** prometia "quantos atacam ao mesmo tempo e nomes", que já moram na janela ESQUADRÃO e no Hangar. **Decisões:** (1) a Sala de Controle passa a se chamar **SALA DE CONTROLE** ("a equipe e o painel"); ESQUADRÃO é só dos bots; (2) a janela dos bots tem **uma entrada só** (o botão do monitor PILOTOS); o teste que exigia as duas (`CommandConsole.test.ts`, P91) agora exige uma, porque a ordem do Comandante de 30/10 é posterior; (3) o título do [ AJUSTAR ] diz o que as Configurações têm (idioma, dificuldade dos bots e conta); as traduções das chaves que saíram também saíram dos 6 idiomas. **Fica para o próximo corte:** o botão [ AJUSTES DO JOGO ] dentro da janela ESQUADRÃO (repete o [ AJUSTAR ]) e a regra do preset PADRÃO, que ainda lê as Configurações (que já não têm a contagem de inimigos).

## [2026-10-30] O Wargame diz quem vai a cada ponto: o robô numerado no mapa e a ordem de UM robô (P290)

O Comandante: "o menu do wargame tá muito cru, não sei qual mech vai em cada ponto… olhar em zoom in e zoom out". **Achado:** a batida dava a ordem ao **lado inteiro** (`Match.aplicarRoteiro`), o elenco era "padrão" ou "o meu" sem dizer quem era quem, o mapa só mostrava os pontos das ordens (sem os robôs) e a grade de 5 colunas por batida cortava a câmera. **Decisões:** (1) **contrato:** `BeatDoRoteiro.alvo` = a posição do robô na lista do esquadrão do lado (a da tela ESQUADRÃO, de 0): a ordem vai a UM robô e o resto do lado segue como estava; ausente = o lado inteiro, como sempre; o link ganha `a<n>` (o antigo segue igual); um alvo que não existe, ou é de técnico (não recebe ordem de posição), volta a valer para o lado inteiro no saneamento; (2) **a conta de onde o robô fica no sistema de bots** (`posicaoNoSistema`): `BotSystem.mechs` guarda os Mechs primeiro, depois os andróides, depois os técnicos, cada grupo na ordem do esquadrão, e a lista do esquadrão mistura os três (uma ordem para "o 1º inimigo" que é andróide quase foi para um Mech: testado); (3) **o número é uma posição só** (a da lista do esquadrão, de 1): é o mesmo no mapa, na ficha de "quem é quem" e na batida; (4) o mapa ganha, **por cima da planta** (`TacticalRadar`: `marcas` e `setas`, opcionais), os robôs onde nascem, as ordens como anéis numerados e as setas da batida em foco (só uma, para não virar rabisco); (5) cada batida é **QUEM / FAZ / ONDE** e a legenda e a câmera ficam recolhidas (a maioria das batidas não as usa); **nunca há ordem escondida:** escolher o robô arma o clique no mapa e uma batida sem ponto não manda ninguém ao centro. **Fora:** editar o elenco dentro da janela (o "padrão" ou "o meu" da tela ESQUADRÃO continuam).

## [2026-10-30] A ficha do robô do esquadrão fala a língua do Hangar: um chassi só, as mesmas ranhuras, e o bot atira os ombros (P288)

O Comandante: "os chassis nessa aba do esquadrão não são todos do Hangar… só dá pra escolher a arma direita ou esquerda (e agora temos ombros e costas)". **Achado:** a lista de chassis do Esquadrão era a do Hangar menos o Andróide (que no Esquadrão é um papel, com botão próprio) e os encaixes novos do P282 não existiam para o bot. **Decisões:** (1) a lista **Chassi** passa a ser **uma só**: os Mechs na ordem do Hangar, o andróide e o técnico (este só nos inimigos); trocar de papel refaz o robô e guarda apelido e dificuldade, e passa pelos mesmos tetos de "pôr um robô agora" (técnico, salas online, titã), sem deixar o robô pela metade se recusa; (2) os nomes das ranhuras são os do Hangar (**Braço direito, Braço esquerdo, Costas, Ombro direito, Ombro esquerdo**); (3) `BotSpec.extras` leva uma arma e um nível por encaixe extra, **só nos chassis que o têm e só com o que o bot sabe atirar** (`armasDoExtraDoBot`: energia de tiro simples, o mesmo filtro dos encaixes); o link ganha as letras `b` (costas), `r` e `l` (ombros) e o link antigo segue igual; (4) o bot atira cada extra **no ritmo e no alcance da arma dele, junto com a mão** (`BotController.wantsToFireExtra`, só roda quando o esquadrão deu extras: o jogo de hoje fica tick a tick igual) e divide o **mesmo calor** do corpo (quem soma armas pesadas superaquece antes: o texto da ficha avisa); (5) **o titã segue com a arma de fábrica**, como chefe: costas e ombros do Colossus-01 são só do Hangar (a ficha diz). **Hoje só o Onça** tem extras para o bot. **Fora, de propósito:** o botão de cada arma configurável (P289) e o Wargame (P290), cada um no seu PR.

## [2026-10-30] O microfone do Estúdio: o padrão do Windows era um ponto morto, e a tomada muda agora é recusada (P286)

O Comandante não conseguiu gravar as vozes: "ficou mudo o microfone". **Medido neste PC** (`medicoes/mic-real.mjs`, Brave): o aparelho padrão do Windows passou a ser o ponto USB "Microfone (Captain 300)", que entrega zero absoluto; só o fone Bluetooth tinha sinal. A aba VOZES pedia o microfone sem `deviceId` (sempre o padrão) e não mostrava nível em número, então a gravação saía muda sem dizer por quê (o jogo já tinha a lista e o `exact` desde o P229; o Estúdio, não). **Decisões:** (1) a aba ganha a lista dos microfones reais (nunca a "Mixagem estéreo"), a escolha exata e lembrada, o teste com veredito em palavras, o **PROCURAR O QUE FUNCIONA** (abre cada aparelho 1,2 s e escolhe o de sinal) e o ganho de entrada (×1 a ×8: o fone Bluetooth é baixinho; o tratamento da voz continua sendo do Estúdio, sem eco, ruído nem ganho automático do navegador); (2) **dois segundos de zero absoluto param a gravação** e dizem o que fazer; (3) o servidor **recusa a tomada em silêncio total** (pico ≤ −80 dBFS, 422, nada guardado): guardar uma tomada vazia só esconde o defeito. O chiado de um microfone vivo (≈ −60 dBFS) passa. **Fora:** TIROS E ARMAS e MECHS 3D (esperam ordem).

## [2026-10-30] Encaixes extras de peso: costas e ombros próprios, com teto de classe por encaixe (P282, P285)

O Comandante pediu três slots no Colossus-01 (costas e dois ombros) e dois no Onça (ombros), e que cada slot aceite armas da própria classe para baixo: o pesado aceita pesada, média e leve; o médio, média e leve; o leve, só leve. **Decisões:** **(1) Cada extra é uma arma só, com a sua carga**, e não um par dividido como o lançador duplo do Marauder. O Marauder segue igual: o ombro dele é o `secondary`, porque a montagem não tem o campo do extra. **(2) O teto é a classe da arma, não o tamanho do robô** (é a regra que ele deu). Só o tamanho da arma conta contra o robô: o cerco (tamanho 3) não vai no Onça. **(3) Só tiro simples de energia** entra num extra: nada que gire, acenda, solte chuva, salve mísseis, abra feixe, onda, arpão ou corte, porque cada um tem o seu gatilho e a sua regra. **(4) Os extras disparam no Ataque 2** com a mão esquerda, e cada um tem o seu cronômetro e a sua carga; a carga com espera é avaliada com o botão solto (o conserto do P284, aqui por construção). **(5) A montagem ganha a versão 3 do texto, e só quando há um extra cheio.** Montagem sem extra segue na chave de antes, e um cliente antigo lê a sua como sempre. Quem tem um extra cheio e um cliente sem esta versão cai na montagem de fábrica do robô: o deploy sobe cliente e servidor juntos. **(6) Sem protocolo novo:** `MOUNTS` ganha o encaixe de costas no fim (índice 4), e o tiro já carrega o índice num byte. **Medido:** as bocas do Colossus e do Onça saíram do rig procedural (a costa era enterrada no tronco e foi afastada para trás dele antes de fixar a boca). **Limite:** o Onça não foi fotografado no jogo; o Colossus, sim (de frente e por trás).

## [2026-10-29] O canhão de cerco no Ataque 2 carregava e não atirava: soltar o botão zerava a carga (P284)

O Comandante: "o canhão de cerco carrega mas não faz nada". **Reproduzido** num teste de simulação e no jogo real (Chrome, Colossus-V4, o clique e o clique direito): o clique atirava, o clique direito enchia o anel e não soltava o obus. **Causa:** o cerco tem carga **com espera** (`chargeHold`, P124: o tiro sai ao soltar), e o gatilho secundário do `Armament` fazia `charge[2].reset()` e voltava antes de chamar o `ChargeTimer` quando o botão não estava apertado, ou seja, exatamente no tick em que o jogador soltava. O primário chamava o timer todo tick e por isso funcionava. **Decisão:** a carga com espera continua sendo avaliada com o botão solto enquanto há carga (`segurandoCarga`); nada mais muda (o trilho, sem espera, segue disparando ao completar). **Regra que fica:** quem cria um gatilho novo que dispara ao soltar precisa chamar o `ChargeTimer` também com o botão solto. +5 testes (os dois botões, soltar antes de completar, perder o braço, o V4 nas duas mãos), 1 mutação derrubada.

## [2026-10-29] A fase escura e a visão noturna: o escuro é o do quadro de luz, e quem enxerga nele é do chassi ou do módulo (P281)

O Comandante respondeu à proposta do apagão: *"quero jogar na fase escura e ver só os olhos, os fogos, os rastros e explosões, e que isso reflita nos objetos e mechs; só o ARARA, o Lancer e os andróides têm visão noturna nativa; os outros usam como módulo extra"*. **Decisões:** **(1) A escuridão é um número (0 a 1)**, a vida que falta ao quadro de luz, e a partida o expõe (`Match.escuridao`): as luzes caem **aos poucos** com o quadro, e o chip FASE ESCURA do Comandante a força para testar. **(2) Só desenho no cliente, a regra no simulador:** `fx/FaseEscura.ts` baixa as luzes do dia, o reflexo do ambiente (`scene.environment`: sem derrubá-lo o metal dos Mechs seguia aceso), o céu e a névoa; a cidade apaga as luzes neon pelo mesmo caminho do transformador (`Arena.setEscuridao`, piso de 0,5%: a 3% as torres e letreiros HDR ainda apareciam), e os contornos das caixas, os telões e o holograma ganham o gancho que faltava. **(3) O que brilha por conta própria não escurece** (olhos, rastros, fogo, explosões) e **ilumina as coisas** por um pool fixo de 3 luzes pontuais, que só entra na cena na primeira vez que escurece (o número de luzes de uma cena não pode mudar sem recompilar os shaders; **medido: +17 programas na primeira vez, sem diferença de quadro dentro do ruído na Vega 11**, 9,6 contra 10,3 ms). **(4) O módulo de visão noturna mora no MÓDULO EXTRA do Hangar** (`combat/modulos.ts`: `ModuloId = gerador | 'visao'`), porque o texto da montagem já leva o módulo como uma palavra: **nenhum formato novo, nenhum protocolo novo**; ocupa o lugar do gerador de energia (é a escolha que custa), pesa 0,5 t, e o Arara, o Lancer e os andróides, que já enxergam, o recusam. **(5) O diferencial é de simulação (G14):** sem visão noturna o alcance de visão do bot cai a 30% no escuro total (continuamente, junto com a luz), exceto de quem acabou de atirar (`MechBase.denunciadoS`, 2,5 s). **(6) Nasce restrita** (`modo:fase-escura`, P191) e **só na Cidade Neon offline**: online o servidor segue com as regras de sempre, e a praia (que tem o ciclo do dia dela), o Bunker, a Amazônia e o 8 de Janeiro ficam para depois. **Não feito aqui, em PRs próprios:** o quadro como objetivo dos dois times com o técnico aliado (P283) e os três encaixes do Colossus-01 (P282).

## [2026-10-29] Quem entrou nas salas: um diário de 30 dias, sem IP, só o dono lê (P275)

O Comandante quis saber "quem e quando estava nas salas": as métricas só tinham contagens por país e a lista de apelidos de agora. **Decisões:** **(1) Um arquivo próprio, não o log técnico:** `presenca.json` (apelido, conta como número, sala, mapa, entrou, saiu) guarda 30 dias e no máximo 3.000 entradas, regravado no máximo a cada 5 s; o log técnico fica para eventos de operação. **(2) A conta vem do token que o cliente logado já manda antes do JOIN** (o servidor o descartava nas salas públicas): sem mensagem nova, sem mudar o protocolo; um token falso é só convidado. **(3) Nunca IP, país nem e-mail:** o painel monta o rótulo `c***@exemplo.com` na hora de mostrar, a partir do banco de contas; conta apagada, rótulo some. **(4) LGPD no mesmo PR:** apagar a conta apaga as entradas; baixar os dados leva as entradas da conta; a política ganhou a linha e o resumo do topo a exceção (versão `2026-10-29.1`); o inventário também. **(5) Só o dono lê** (`GET /admin/presenca` e a janela SERVIDOR). O que ficou de fora: o painel mostra as 40 mais novas (a rota devolve até 300) e não há busca por apelido nem por conta. **(6) Endurecido no mesmo dia (revisão de segurança automática do PR):** a saída roda **na mesma fila da sala** (`sala.then(r => { r.leave; presenca.saiu })`): se a conexão cai antes de a sala processar o JOIN, a saída vem depois da entrada e não sobra uma visita "na sala agora" para sempre; **tetos separados** para convidados e contas (2.000 + 2.000), para um laço de entradas com apelidos inventados não empurrar para fora o histórico de quem estava logado; quem **volta à mesma sala em 2 min** continua na mesma entrada; uma visita aberta conta **no máximo 12 h**. O diário é de conferência: a trilha de segurança é o registro técnico (IP mascarado).

## [2026-10-29] O halo das caixas era o contorno de 1 px a ×3, não os LEDs (P277)

O Comandante viu "as luzes e os detalhes dos contêineres e boxes borradas, brilhando e se movendo conforme eu ando". **Medido** (Vega 11, câmera em passos de ~1/3 de pixel, o piscar parado, quadros vizinhos ampliados 4×): reduzir os LEDs e as linhas de acento das máquinas quase não mudava a imagem; o que lavava o corpo era o **contorno de 1 px de cada barricada a ×3 de HDR** (`Destructibles`), que fica sobre a silhueta da máquina (o desenho cabe exato no colisor): uma linha de 1 px a ×3 passa do limiar do bloom (1,05) a cada passo da câmera e vira um halo largo que anda de pixel em pixel (o HDR é desenhado sem MSAA, só o FXAA depois do bloom). **Decisão:** o contorno da máquina estilizada vai a ×1,5 e o das arestas dos contêineres a ×1,8, em constantes nomeadas e com teste; **os prédios ficam a ×3** (o neon deles é o visual aprovado). Para qualquer linha de 1 px nova: o brilho dela é o do halo que ela vai ter. (Não medi um número de "tremor" por pixel: a bancada ficou ruidosa com os telões e outdoors animados no quadro; a prova é visual, antes e depois.)

## [2026-10-29] O teto de robôs da sala online sobe de 3/3/1 para 6/6/1: o que limita é a banda (P273)

O Comandante perguntou se o limite de 3 Mechs e 3 andróides online precisa existir ("já testamos com mais bots e fluiu normal"). **Medimos** (`CAPACIDADE.md`): o servidor gasta menos de 1 ms por tick com até 26 robôs e a Vega 11 desenha 13 robôs como desenha 7 (p50 10,4 × 10,6 ms); **só a banda por jogador limita** (meta G11 de 8 KB/s: 15 unidades). **Decisão:** o esquadrão online vai a 6 Mechs, 6 andróides e 1 técnico (`ROOM_UNITS` 12 → 15 = a meta inteira, sem folga; com 2 a 8 humanos a sala tem exatamente 15 unidades, com 1 tem 14, porque os Mechs de IA cedem a vaga). **Sem mudar a meta nem o protocolo:** mexer na meta de 8 KB/s é decisão do dono, e mandar só o que muda (delta) é uma tarefa com protocolo novo. As regras da sala sem esquadrão salvo seguem em 3 e 3.

## [2026-10-29] O modo da sala online é o que o servidor roda, nos dois lados (P276)

O Comandante jogou online e "os tiros não pegavam nos inimigos" e ele "não conseguia pisar neles". **Achado:** o link dele trazia `modo=survival` (o botão JOGAR ONLINE só acrescenta `sala` e `nome` à URL da partida de antes) e o cliente montava a **Sobrevivência local** por cima da sala: as ondas ("ONDA 1/6 · ALVOS 0/2") eram robôs **fantasma** do cliente (sem dano, sem pisão, que só o servidor aplica), enquanto o servidor, que só roda a Sobrevivência no 8 de Janeiro (P243), jogava Deathmatch. O servidor sempre acertou (testes de sala e uma sonda nova confirmaram). **Decisão:** `modoDaSala(mapa, modo)` em `shared/net/mapa.ts` é a conta única: online, `survival` só vale onde existe (janeiro); `chaveDaSala` a usa (o mesmo código com ou sem `modo=survival` é a MESMA sala, sem sala fantasma `:survival`), o cliente a usa para decidir o modo da partida (`modoEmSala`) e o seletor de modo do menu mostra o que de fato roda. **Por que no contrato e não no botão:** cada link já compartilhado ou favoritado com `modo=survival` continua certo; corrigir só o lobby deixaria o bug nos links.

## [2026-10-28] As caixas do centro viram supercomputadores, só no navegador e por um gancho (P272)

O Comandante pediu que "essas caixas do centro do cenário" virassem supercomputadores ("macminis gigantes… servidores blindados… que chame atenção pela beleza"). **Decisões:** **(1) Quais:** as barricadas que quebram (6) e os quiosques (2), as caixas escuras do centro da praça; os contêineres das bordas e os três prédios do meio ficam como estão (decisão tomada sem perguntar: é o corte menor, e a pergunta "e os outros?" vai na resposta ao Comandante). **(2) Só desenho, pelo cenário do navegador:** `Destructibles.estilizar` (um gancho, `EstiloDeBarricada`) recebe o desenho do `CidadeNeonCenario` (o pedaço sob demanda da cidade); o servidor e os testes de regra seguem com a caixa, o colisor, a vida e o id de rede não mudam, e o pacote de partida não cresce (482,4 → 482,5 KB). **(3) O corpo é do tamanho exato do colisor** (teste: nada sai da caixa, preenche ≥ 94% de cada medida) e a variante sai do formato (`varianteDe`: laje, torre, parede, cubo). **(4) Os LEDs respiram no shader** (fase pela posição, relógio da cidade, sem `pow`/`sqrt`/`log`; só o que passa de 3 de brilho respira) e **entram na energia da cidade**: sem o transformador, os servidores apagam. **(5) Orçamento:** ≤ 2.400 triângulos por máquina e 14.000 na praça inteira (teste); medido +16 chamadas de desenho e GPU p50 dentro de ±0,5 ms (a margem da máquina é ±2).

## [2026-10-28] O esquadrão das salas online é do Comandante, vale nas salas novas e cabe na sala que já se mede (P270)

O Comandante quer montar os times online no botão ESQUADRÃO, que competia com o Ajustar. **Escolhas dele:** só o Comandante monta, valendo para todas as salas; uma porta só (o ESQUADRÃO). **Decisões de engenharia (PR 1, servidor):**
**(1) O esquadrão é um dado do servidor** (`ArmazemDoEsquadraoOnline`, no molde das regras e dos outdoors; só o dono grava, `POST /admin/esquadrao/gravar`); **vale nas salas que abrirem depois** (os corpos nascem com a partida; uma sala vazia fecha em 30 s), e sem ele valem as regras de sempre.
**(2) O teto é o da sala que já se mede (G11): 3 Mechs, 3 andróides, 1 técnico; sem aliados** (o roster de rede não os descreve) **e sem titãs** (estado a 20 Hz para cada jogador: mais robôs pedem homologação antes, `CAPACIDADE.md`). Subir é trocar `LIMITES_ONLINE`, mas só depois de medir.
**(3) Só na Cidade Neon e na Estação dos Cabos** (`MAPAS_DO_ESQUADRAO_ONLINE`: o combate livre do lançamento); as outras salas seguem com as regras. **(4) Sem subir o `PROTOCOL_VERSION`:** o roster já levava `build` por unidade; o cliente antigo desenha o robô do esquadrão como o Vector-09 vermelho (só cosmético).
**(5) O desenho do robô vem da montagem** (`montagemDoBot`): uma arma que o Hangar recusaria por carga perde a mão esquerda e, se preciso, volta à de fábrica (quem atira e fere é o servidor, com os números do chassi).
**PR 2 (a janela, mesmo dia):** **(6) Uma porta só:** `INIMIGOS` e `NOMES NA TELA` saíram do Ajustar (`EnemySettings.ts` apagado, 11 chaves de tradução tiradas); os campos de `Settings` seguem como o padrão do esquadrão offline, sem tela. **(7)** "Atacam ao mesmo tempo" mora no pé do ESQUADRÃO: offline vale na hora (Configurações); online vai ao servidor com o esquadrão (`/admin/regras`, a pressão é regra da sala). **(8) Só o modo Comandante abre a janela online** (a chave é a da janela SERVIDOR); o jogador comum lê que o Comandante monta o esquadrão das salas. **(9) A sala vazia com o esquadrão de antes fecha na hora** (`chaveDoEsquadrao` na sala × a do salvo): sair e entrar já cai numa sala nova, sem esperar os 30 s. **(10)** `REGRAS DAS SALAS` segue como está: com esquadrão salvo, os Mechs e andróides dela são ignorados (o esquadrão manda), e a janela diz "valem as regras" quando não há salvo.

## [2026-10-28] O cérebro do time dos bots nasce restrito, porque a medida não mostrou ganho (P269)

O Comandante pediu bots "mais estratégicos… que combinem ataques e defesas, como se se comunicassem". Entrou `CerebroDoTime` (pinça, reagrupar, rádio no feed) atrás do interruptor `ia:time`. **O Comandante escolheu liberar já; depois da bancada ele escolheu RESTRITO**, e a decisão segue os números:
**(1) A bancada bot × bot** (`.tmp/bancada/`, 4×4, 150 s, 40 sementes, lados trocados) deu **45% / 38% / 45%** de vitória ao time com cérebro (fácil/normal/difícil; 50% é empate, ±8 de ruído): nenhum ganho. **(2) O FOCO no mais fraco** foi **pior** (1/40 no normal): manda todo mundo atrás de quem está recuando e se esquivando; saiu do código.
**(3) A pinça segura o fogo do flanqueador só nos inimigos**; o time aliado flanqueia atirando (um aliado calado enquanto o jogador apanha é pior que nenhuma pinça). **(4) O golpe abre uma vaga a mais por flanqueador por 5 s** (o teto `maxAttackers` segue valendo no resto do tempo); a pinça esfria 20 s (14 s no difícil).
**(5) O interruptor desligado devolve a partida de antes, tick a tick** (`esquadraoPadrao.test.ts` guarda as fotos da praça urbana (P268) com a coordenação desligada; as fotos da partida padrão ligada foram refeitas). **(6) Online:** o servidor lê `ia:time` ao abrir a sala e ao gravar a visibilidade; sem exceção gravada vale o padrão do catálogo (restrito = desligado); no online não há modo Comandante, restrito vale para todos.
**(7) O que a bancada ainda não testou e é o próximo experimento:** cobertura mútua, recuo coordenado para as zonas de cura, e o time sem o teto de atacantes. Contra um jogador humano o efeito pode ser outro (a bancada mede bot contra bot): o juiz é o Comandante jogando.

## [2026-10-28] A praça urbana: cobertura e combate de perto dentro da praça jogável (P268)

O Comandante, à pergunta "dentro da praça, com colisão, ou só enfeite fora dela?": "na praça, pra dar cobertura, e reduzir o alcance… combate urbano com diferentes espaços de conflito… não precisa lotar a cidade… uma praça de playground porém urbana".
**(1) Mudança de jogo, então com as travas de jogo:** os dados moram num módulo puro (`ArenaUrbana.ts`), a `Arena` os lê (o servidor monta a mesma arena: G14), e **o protocolo subiu para 24** (nenhuma mensagem mudou, mas o chão que os dois lados simulam sim: um cliente da 23 preveria o Mech atravessando um prédio sólido). **(2) A planta em conta antes de pôr peça:**
`ArenaMapa.ts` mede o que o olho não confere — o alcance (que fração de pares de pontos se enxerga a olho de Mech e de andróide), a conexão (grade com o raio do Mech e do Colossus) e as frestas que prendem. As medidas guiaram o desenho: cada peça entrou ou saiu pelo que cortava da vista (as jardineiras de 1,5 m cortavam zero do Mech e uma estava na pista do Colossus: saíram).
**(3) O desenho:** nove prédios de 8 a 16 m, cinco contêineres de 5,2 m (a vista de um Mech de 5,3 m), dois quiosques destrutíveis, o playground; 9,7% da praça coberta, "não lota". **(4) Regras que o teste trava:** nada a menos de 5 m de nascimento, fora das zonas e dos pontos de Domínio/bandeira/titã; **vão entre obstáculos é zero ou passa o Marauder (3,8 m)**;
todo canto alcançável de todo nascimento; o Colossus cruza do nascimento ao transformador. **(5) Achado que quase passou:** o chefe desvia de **tudo** que vê, até do que ele pisaria por cima, com um desvio simples (sem caminho): uma jardineira de 1,5 m na pista dele o deixou parado a 70 m do transformador por 120 s. Por isso a pista do chefe é uma regra do teste, não só a conexão da grade.
**(6) Degrau de 0,9 m não, de 0,6 m sim:** o `stepHeight` do Mech é 0,9 e ele demora 2 s para vencer um degrau de exatamente 0,9 (medido); os do playground são de 0,6. **(7) Os pontos extras de nascimento andaram** (12 de 52, de 1 a 21 m, para o vizinho válido mais próximo, com as mesmas regras do teste deles): a lista foi feita para o layout antigo e o próprio teste manda refazê-la quando um prédio muda. **(8) Barato de desenhar:** os prédios têm corpo e material próprios
(a câmera apaga o prédio que tapa a vista), mas as arestas e as faixas dos nove vão numa malha só cada, e o mobiliário todo (contêineres e playground) em uma de corpos e uma de arestas: 22 peças custam ~15 chamadas de desenho, não ~66; o mobiliário entra na planta do radar mas não some (`Occluder.material: null`). **(9) Os ids das barricadas antigas não mudam:** os quiosques entram depois (ids 6 e 7), porque o id é a posição na lista e viaja pela rede.
**(10) As fotos do esquadrão padrão foram refeitas** (a regra do teste: mudar a partida padrão é decisão do dono, e foi). **(11) Fica de fora:** ponte/passarela elevada, mais playground (balanço, escorregador de verdade), e a Estação dos Cabos.

## [2026-10-28] Outdoors que alternam, ajustados num painel do Comandante e guardados no servidor (P267)

O Comandante: "tá meio poluído… quero um painel pra configurar quantas imagens devem aparecer… trocar elas a cada 10 ou 15 segundos". Decisões de propósito:
**(1) A configuração mora no servidor, no molde dos Telões e da Visibilidade** (`shared/outdoors.ts`, `GET /outdoors` público, `POST /admin/outdoors` só com a chave do dono): ele ajusta o visual **para todos**, não só no navegador dele; o servidor guarda só
três coisas (quantidade, período, anúncios desligados), nunca imagem nem endereço, e recusa o que o painel não oferece. **(2) O padrão é menos que tudo:** 26 dos 40 outdoors e troca a cada 12 s (ele achou a cidade poluída com os 40); sem servidor, vale esse padrão.
**(3) Todo outdoor alterna num anel único** (as 9 imagens que alternam, na ordem do catálogo; cada um começa num ponto e anda um passo por período, cada um no seu tempo): uma só malha de painéis e uma só de brilho (eram 7 + 1), um relógio, **zero conta de CPU por quadro**.
A logo plana é a marca e não alterna. **(4) O brilho e o reflexo no chão seguem a imagem de agora** (o mesmo trecho de shader nos três): sem isso o chão refletiria laranja sob um outdoor que já mostra o ping verde. **(5) Menos outdoors = janelas de volta:**
o prédio cujo outdoor saiu do ar volta a acender as janelas (um atributo por prédio, atualizado só quando a configuração muda). **(6) A leitura da textura usa `textureGrad`** com o gradiente calculado fora do `if` que escolhe a imagem (o D3D avisava que a derivada
ficava indefinida). **(7) Azonix só onde não há acento:** "SOFTWARE BUREAU" nos banners da Serafim; a lista de serviços ("CORREÇÃO DE CÓDIGO", "SEGURANÇA DIGITAL") ficou na Chakra, porque a Azonix não tem cedilha nem til (saía "CORRECAO DE CODIGO"). A licença da Azonix segue
em aberto (`ESTADO_ATUAL.md`). **(8) Os prédios pequenos e médios ficam para outro PR**, depois da resposta dele: dentro da praça jogável é mudança de jogo (colisão, servidor, bots); só enfeite fora da praça é cenário.

## [2026-10-28] Cidade Neon: os telões viram outdoors da marca (os produtos do Comandante) e a logo ganha um holograma 3D (P266)

O Comandante, ao ver a cidade: "ficou tudo muito bom… use o vetorserafim.png como nossa LOGO e o principal holograma… vamos usar os nossos produtos, nosso branding, pra fortalecer nossa marca". Decisões de propósito:
**(1) Marca real entra, só nos outdoors e no holograma** — inverte, **neste ponto**, o "nenhuma marca real" do P264; os letreiros de bandeira e os neons seguem com glifos inventados. **(2) O texto só afirma o que o produto
afirma** (README, landing e tutorial do Olho do Pai): o exemplo do Comandante dizia "PING <3s", o tutorial documenta "menos de 5 s" (1 a 2 s com o app aberto), então o anúncio diz `< 5s`; sem preço nem oferta com prazo; o
produto rastreia pessoas e se apresenta como "proteção com ciência, sem modo oculto", então nada que sugira vigilância escondida (o `anuncios.test.ts` trava). **(3) A arte é imagem, não shader:** 10 WebP verticais (512×1024, ~47 KB,
467 KB no total) gerados por `npm run anuncios` (HTML/CSS → Chrome); texto nítido não se faz bem em shader, e a página HTML é a fonte editável; baixam em segundo plano, só para quem abre o mapa. **(4) Catálogo de dados + desenhista
de painéis que não sabe de mapa** (`brand/anuncios.ts`, `Outdoors.ts`): a Estação dos Cabos (pendente, em menor frequência) reaproveita sem redesenhar. **(5) Prédio com outdoor não tem janela acesa** (ordem dele). **(6) As logos
planas saem de um layout em duas passadas** (a 1ª acha os prédios de destaque que quem nasce vê por inteiro; a 2ª os força): o sorteio puro escondeu a logo do norte atrás de um prédio da praça; e cada família (torres, letreiros,
outdoors, desenhos) tem o seu fluxo de sorteio, para a silhueta não mudar quando uma regra de outra muda. **(7) O holograma é a logo de verdade em volume** (até 17 camadas somadas em mistura aditiva, giro lento, anel, feixe e
aura), sem malha; o custo dele é **de preenchimento** (de baixo dele custava +3 a +9 ms na Vega 11 com as 17 camadas), então o número de camadas cai com a distância da câmera (17 longe, 4 perto, brilho compensado) e a
qualidade baixa desenha no máximo metade. **(8) A textura do holograma é RGB sobre preto** (37 KB): o WebP com alfa pesava 100 KB ou mais.

## [2026-10-28] publicar: o PR já mergeado antes é sucesso, não falha

O `npm run publicar` tratava "PR já MERGED" como falha (`o PR #n não está aberto (MERGED); nada foi mergeado`, código 1), mas o PR pode entrar por fora do script (#474: abriu e entrou em ~1 min, com o script ainda
esperando o CI; a conta do GitHub é a mesma, então não dá para dizer quem mergeou). **Decisão:** o `MERGED` lido depois da espera do CI é o resultado desejado: o script não mergeia de novo, devolve o merge e mantém a trava de sempre ("só apaga o branch remoto depois de confirmar
`MERGED`", agora confirmado pelo próprio estado). O PR **fechado sem merge** segue falha e nunca apaga branch. O branch já apagado pelo merge do GitHub é dito como tal (a API responde "Reference does not exist").

## [2026-10-28] Cidade Neon: a praça dentro de uma cidade, tudo em shader, e a rua no lugar do quadriculado (P264, PR2)

O Comandante, ao ver a PR1: "ainda tá muito longe" dos quadros de referência; "os postes frágeis... só se tiver o desenho das ruas". Decisões de propósito, para não serem reabertas por engano:
**(1) A cidade é um pedaço sob demanda, só desenho, sem colisor e fora do servidor** (`CidadeNeonCenario.ts`, baixado por `carregarCenarioDaCidade`; se não baixar, o jogo abre sem ela). O servidor e os testes
de regra montam a Arena sem ela, então nada de gameplay depende de enfeite — **por isso os postes não têm colisor**: um colisor só do cliente empurraria o Mech do jogador onde o servidor não empurra.
**(2) Janela, fachada, anúncio e rua são conta de shader pela posição no mundo, não malha nem imagem de arquivo:** 11 chamadas de desenho para a cidade toda, nada de CPU por quadro (o relógio é um
uniforme), zero byte de imagem (a arte dos anúncios e dos glifos é desenhada em canvas na montagem). **(3) Os glifos continuam inventados** (a decisão da PR1 vale): nenhum idioma nem marca real; as
marcas dos anúncios são do universo do jogo. **(4) O reflexo do chão molhado não desenha a cena duas vezes (G12):** cada telão e poste vira um quadrilátero deitado no chão, posto no vertex shader pela
fórmula do espelho (um ponto à altura y, a distância D, aparece a D·hc/(hc+y) da câmera), mais forte nas poças e de raspão. **Limites conhecidos:** não sabe o que está na frente da fonte, e a cor é a do
primeiro anúncio do telão. **(5) O limite (3) da PR1 caiu:** a luz da cidade nova é **um uniforme compartilhado** que o `Arena.registraLuzes` já escurece com o transformador do banco — o que a cor
instanciada da PR1 não conseguia; por isso a `ArenaAderecos.ts` foi apagada, não remendada. **(6)** O horizonte antigo (80 caixas, 900 estrelas) saiu; névoa e horizonte ficaram mais turquesa (`palette.ts`),
a cor dos quadros. **(7) Achado de método:** a "mancha branca" do chão não era o meu reflexo (continuava com ele escondido), era o brilho do próprio piso — poça de rugosidade 0,1 refletindo a luz
principal em ângulo rasante; a causa se acha escondendo uma camada por vez, não adivinhando. **(8) Constantes por instância passam como `flat`:** a semente de cada torre alimenta hash caótico, e 1 ulp
de interpolação perspectiva viraria ruído nas janelas em GPUs que não interpolam constante com exatidão (o teste `CidadeNeonShaders.test.ts` confere a interface vértice/fragmento).

## [2026-10-27] Atmosfera cyberpunk da Cidade Neon: sem texto real, sem luz nova, e a cor instanciada não escurece com o transformador (P264)

Três decisões de propósito ao povoar a Arena (letreiros, postes, bueiros), para não ficarem reabertas por engano
numa sessão futura. **(1) Sem glifo ou texto de verdade nos letreiros:** a referência do Comandante (Chinatown/
gueto) pede densidade visual, não um idioma específico — desenhar kanji, hangul ou qualquer escrita real seria
arte de um lugar que não é o nosso, sem necessidade (barras e blocos de cor já leem como "letreiro" à distância
de jogo, no mesmo espírito baixo-poli de `ESTILO_ROBOS.md`). **(2) Sem `THREE.PointLight` nova para os postes:**
pareceria mais "de verdade", mas custaria uma luz dinâmica por instância (13 delas) — todo neon deste jogo até
hoje ilumina "de mentirinha" (emissivo + bloom, zero luz real), e quebrar esse padrão por um detalhe de cenário
não se paga em G12 (GPU integrada como piso). **(3) Os letreiros/postes não escurecem com `Arena.setEnergia`
(o transformador do Banco Vorcaris, missão em ondas):** esse mecanismo funciona porque o `THREE.Color` de um
*material* é o mesmo objeto que o renderizador lê a cada quadro — mutá-lo in loco já muda a cor na tela. Cor
*instanciada* (`InstancedMesh.setColorAt`) não funciona assim: é uma cópia gravada num buffer, não uma referência
viva; `registraLuz()` não tem efeito nenhum sobre ela a menos que algo chame `setColorAt` de novo a cada mudança
de energia. Cheguei a escrever esse registro (inerte, sem erro, só sem efeito) antes de perceber — removido, com
o limite anotado no código em vez de deixar a aparência de "funciona" sem funcionar. Resolver direito pede um
`setEnergia` próprio em `ArenaAderecos`, falta para quando/se importar na missão em ondas especificamente.

## [2026-10-27] WARGAME: quatro cópias do mesmo "solta a câmera" — corrigir uma não bastava (P265)

Depois do P263 (travar `player.active` durante o WARGAME), o Comandante ainda ficava preso: soltar a câmera de
espectador por qualquer caminho deixava o controle desligado para sempre (correto, de propósito), mas **nenhum
desses caminhos sabia disso** — `Game.ts` tinha a mesma lógica de `spectatorCam.release()` copiada em **quatro
lugares** (o callback `onExit` do HUD, o método `toggleSpectatorCam()`, o bloco de teclas C/V/Espaço/Esc enquanto
espectando, e `switchCamera()`), nenhum chamando o outro. Consertar só um (o óbvio, `toggleSpectatorCam`) deixaria
os outros três quebrados — foi exatamente o que aconteceu na primeira rodada desta correção: a tecla C é
interceptada pelo bloco de teclas, que nunca chega a `toggleSpectatorCam`. **Decisão:** em vez de corrigir as quatro
cópias, um método novo (`sairDoWargame()`, só `reloadWithout(PARAM_DO_ROTEIRO)`) e os quatro lugares passam a
chamá-lo (ou chamar `toggleSpectatorCam()`, que já o chama) em vez de repetir `release()`/`setVisible`/`classList`
— a próxima mudança de comportamento do "soltar câmera" só precisa de um lugar. **Lição:** antes de declarar um
conserto de UI pronto, procurar por `grep` todo outro lugar que chama a mesma API de baixo nível (`.release()`),
não só o botão mais óbvio.

## [2026-10-27] WARGAME: "zero erro de página" não prova que o jogador está travado (P263)

O PR do P262 foi verificado com um script de Playwright que montava o episódio inteiro pelo painel e só observava
(cliques de UI, screenshots, contagem de erros de página) — nunca apertou uma tecla nem clicou no jogo em si. O
Comandante jogou e descobriu na hora: WASD e o tiro continuavam vivos por trás da câmera de espectador, porque
`Game.ts:setPlaying()` é o **único lugar** que escreve `player.active`, e escrevia incondicionalmente (`= playing`)
toda vez que uma rodada começava — a câmera de espectador (`SpectatorCam.overridesRig`) só troca o que a tela
mostra, nunca tocou em input. **Lição para qualquer modo "espectador" futuro:** câmera e controle são dois
interruptores independentes neste código; desligar um não desliga o outro, e só um teste que **simula o input de
verdade** (não só clique de UI) prova que os dois foram desligados juntos. Corrigido com um campo `wargameAtivo`
que `setPlaying` consulta. Na mesma ordem, os dois esquadrões do WARGAME saíram do `BOT_SKILL_NORMAL` para
`BOT_SKILLS.dificil`: aquele padrão foi calibrado e aprovado (24/09) para ser **justo contra um humano** jogando
sozinho contra bots — não existe razão para segurar a IA quando são dois esquadrões de IA se enfrentando para
um público assistir.

## [2026-10-27] WARGAME, PR2: um PR só em vez de dois (mapa + painel) (P262)

O plano original separava o mapa clicável (PR2) do painel/link/câmera (PR3), seguindo a regra do menor PR que
resolve. Na prática, ao chegar na hora de entregar, **nenhum dos dois sozinho dava algo que o Comandante pudesse
ver funcionando** (regra 16): o `RoteiroMapa.ts` sem o `WargamePanel.ts` é um componente órfão, sem ninguém que o
chame; o painel sem o mapa teria que nascer com uma UI de autoria pior (coordenadas digitadas à mão) para depois
ser jogada fora quando o mapa chegasse. **Decisão: juntar os dois num PR só**, maior que o planejado mas
genuinamente a menor fatia que entrega algo demonstrável de ponta a ponta — exatamente o caso que a regra 19e
prevê ("PR de uma ordem acima de ~400 linhas traz o motivo escrito no corpo"). Também descoberto nesta entrega,
lendo `CampaignPanel.ts` de novo: ele **não** embute o editor de esquadrão completo (`SquadPanel`) dentro de si —
usa só um seletor "padrão"/"o meu" (o que está salvo na tela ESQUADRÃO). Copiei esse padrão para o WARGAME em vez
de tentar abrir um modal dentro de outro modal (dois `document.addEventListener('keydown', ..., true)` de Escape
brigando por qual fecha primeiro) — mais simples e já provado.

## [2026-10-27] WARGAME, PR1: não eliminar o Mech do jogador — só torná-lo inofensivo (P262)

O Comandante quer episódios roteirizados (dois esquadrões brigando sozinhos, ele só assiste e grava com F9). A
ideia óbvia para "sem jogador" era não chamar `Match.addPlayer()` e podar tudo que depende de `this.mech` no
`Game.ts` — mas contei **78 usos de `this.mech`** ali (câmera, HUD, input, toque, calibração de mouse, kill-cam,
nameplates…): podar isso tudo é mudança grande e espalhada, fácil de quebrar algo que nenhum teste cobre.
**Decisão (para o PR3, registrada agora para não ser retomada por engano):** continuar chamando `addPlayer`
normalmente (o Mech do jogador existe, os 78 pontos continuam intocados) e neutralizá-lo com duas mudanças
pequenas — `MatchOptions.espectador` (exclui `players` da mira dos bots, confirmado nesta sessão: `Match.ts` já
funciona com dois esquadrões se caçando sem nenhum jogador, de graça) e, no `Game.ts`, forçar `SpectatorCam.start(0)`
assim que o roteiro carrega (o loop de render já pula o `CameraRig` normal quando `spectatorCam.overridesRig` é
verdadeiro, então a câmera do jogador nunca aparece). Mais barato e mais seguro que eliminar o Mech.

## [2026-10-27] Capa de gelo nova, e o choque/atordoamento era o estrobo que sobrava (P261)

Depois de três rodadas cortando luz (vinheta, flash de dano, partículas de gelo), o Comandante ainda achou a luz forte "em geral" — e separadamente pediu uma capa de gelo visual no congelado, não um efeito novo de dano. **A capa de gelo** é a primeira vez que um Mech ganha uma malha extra condicional (`meshKit.ts:frostShell`, um `THREE.Mesh` a mais no torso, invisível fora do estado). **Decisão de engenharia:** criá-la DEPOIS de `batchRigMeshes()`, não antes — `batchRigMeshes` varre cada pivô e funde/remove todo `THREE.Mesh` filho nele (é como o casco vira um material só); criada antes, a capa seria varrida e desapareceria sem erro nenhum (silencioso, só se perceberia olhando o jogo). O orçamento de "draws articulados" (`mechBlueprint.test.ts`) subiu de 10 para 11 de propósito — é o primeiro teste que guarda esse número, e ele devia mesmo subir quando uma malha nova e deliberada entra no rig. **Decisão de escopo na "luz em geral":** em vez de adivinhar mais efeitos para cortar, fui atrás do que as três rodadas anteriores **deixaram de propósito intocado** — fogo/choque/atordoamento, registrados como "sem queixa nova" em cada entrada do `HISTORICO`. Lendo `statusTint.ts` de novo, o choque usa um degrau binário puro (`sin > 0.5 ? 1 : 0.18`) a ~5 Hz — um estrobo de verdade, diferente de todo outro estado (que usa curva contínua). Cortei o pico (mantendo o degrau — é a característica "seca" do efeito, pedida de propósito) e as partículas `SPARK`/`STARS` que o acompanham, sem tocar fogo (já foi reforçado antes por estar fraco) nem reabrir mais nada do gelo (P260 já resolvido). **Achado incidental:** `meshKit.ts` tinha um `setHitFlash` sem nenhum chamador em todo o `client/`, ainda com o multiplicador antigo (1,4) do P259 — quase me enganou como se fosse um bug vivo; removido por higiene (P200), já que código morto ao lado do código real é mais perigoso que útil.

## [2026-10-27] O congelado virava um bloco de luz branca: era a partícula do gelo, não o flash de dano (P260)

Depois do P259 no ar, o Comandante mandou dois prints insistindo que a luz "ainda" estava forte — mas desta vez de um alvo **congelado** pela câmera de vigilância/espectador, quase totalmente branco, sem silhueta. **Não era o mesmo bug:** o `hitFlash` do P259 já estava correto (confirmado lendo `MechBase.ts` de novo); a causa agora era `fx/StatusVisuals.ts` — as partículas `VAPOR`/`SHARD` do estado congelado têm cor **de propósito** acima do limiar do bloom (1,05), herdado de uma correção de 11/10 ("o congelamento não se percebia"). O problema é a **sobreposição no tempo**: o cursor que solta a rajada gira pelas 6 partes do corpo em ~0,6 s, e cada partícula dura até 0,9 s de vida — sob congelamento sustentado (o Comandante batendo com a arma de gelo), várias partes têm vapor+caco acesos ao mesmo tempo, e o halo de bloom de cada partícula se soma ao do vizinho até cobrir o robô inteiro. **Decisão: cortar cor e tamanho de `VAPOR`/`SHARD`/`CHILL`, deixando o pico no limiar do bloom em vez de bem acima (ex.: `SHARD` de 2,1 para 1,05), sem tocar em fogo/choque/atordoamento** — não há queixa nova sobre esses, e o fogo já foi especificamente reforçado em 11/10 por estar fraco demais; cortar de novo sem pedido arriscaria reabrir aquela reclamação antiga. O tingimento azul do casco (`statusTint.ts`, já bem abaixo do limiar por desenho) ficou intocado — é o sinal "sempre visível" de estar congelado, independente de quantas partículas estão no ar num instante dado.

## [2026-10-26] O flash de dano do robô acendia o casco inteiro, não só a peça atingida (P259)

O Comandante relatou "tanto eu quanto os outros robôs se iluminam, isso tá artificial" ao tomar tiro. A causa não era um número qualquer — era o emissivo de pico (1,4, acima de 1,0, já HDR) aplicado a `hullMaterials`, que é **um material só por Mech**, batido num lote (`batchRigMeshes`, G4/G5: sem o lote, cada robô pagaria um draw call a mais). **Decisão: cortar a intensidade (~75%), não tentar o flash por peça.** Fazer o flash por peça exigiria desfazer o lote, trocando um custo de GPU fixo e já pago (a cor do material) por um custo real por quadro (mais draw calls) — desproporcional ao pedido, que era "menos artificial", não "mais localizado". Registrado para quem revisar: se o Comandante ainda achar que falta precisão (acender só o braço atingido, por exemplo), aí sim vale medir o custo de quebrar o lote antes de decidir.

## [2026-10-26] O tiro do jogador atravessava a multidão sem nenhum efeito desde que a missão ficou online (P258)

O Comandante relatou "meu tiro nao pegava no manifestante" ao testar o 8 de Janeiro depois do P257 (que corrigiu o caminho até a missão). **A causa é arquitetural, não um erro de digitação:** `Multidao.atirar()` (`client/src/sim/Multidao.ts`) é a única porta de entrada para um tiro acertar a multidão, e a primeira linha é `if (!this.autoridade) return -1`. Isso é correto por desenho — só o servidor decide quem morre, para não desincronizar (G11: a multidão nunca manda posição pela rede, só eventos de morte/fuga) — **mas todo cliente online é espelho, nunca autoridade, inclusive o dono da sala**; e a multidão **não tem nenhum corpo físico** (G4/G5: milhares de figurantes calculados por fórmula, sem colisor nenhum no Rapier). A combinação das duas coisas é o problema: quando `atirar()` devolve -1, `ProjectileSystem` não tem em quê colidir — nem física, nem a multidão — e o projétil **atravessa a figura visualmente, sem nenhum efeito**, achando o alcance máximo mais adiante. Isso existe desde que a missão ficou jogável online (P251, 23/10): ninguém pegou porque os testes de integração (`online-janeiro.test.ts`) provam que os EVENTOS do servidor chegam certos ao espelho, mas nunca testam o **tiro local de um cliente não-autoridade contra a multidão** — e no playtest manual, ninguém tinha disparado de verdade contra a multidão num cliente online antes de hoje. **Decisão:** separar a geometria (pura, sem efeito — "quem a mira cruzaria") do efeito (fere, mata — só a autoridade). A geometria virou `naMira()`, que qualquer instância pode chamar; o espelho a usa só para o projétil parar e soltar a faísca no lugar certo, nunca para decidir quem morre — a morte continua vindo exclusivamente do evento do servidor, então o jogo fica com feedback local imediato (G1 não quebra: nenhum estado de jogo muda fora do tick determinístico) sem abrir mão da autoridade do servidor. Registrado para quem revisar: `explodir()` tem exatamente a mesma estrutura (`if (!this.autoridade) return 0`) e provavelmente o mesmo problema para armas explosivas contra a multidão online — não foi tocado agora porque o relato do Comandante foi especificamente sobre o tiro, e a explosão já dispara o efeito visual genérico (`combat/Explosions.ts`) independente da multidão; fica para confirmar se alguém reclamar.

## [2026-10-26] O seletor de mapa nunca levava ao 8 de Janeiro de verdade, online ou offline (P257)

O Comandante relatou não conseguir jogar a missão do 8 de Janeiro online com os amigos, depois de P253 (24/10) ter liberado o mapa ao público. **A causa não era o servidor nem a restrição** (ambos já corretos desde P253): era `client/src/ui/MapLinks.ts:mapHref()`, a função que constrói o link de todo clique num pino do mapa de operações — usada tanto pelo jogador comum (o mapa-múndi do console, visível a qualquer um) quanto pelo modo Comandante. Ela sempre tirou o `modo` da URL ao trocar de mapa e só reconhecia a Amazônia como tendo "uma missão de verdade" (forçando `modo=survival` só para ela); o 8 de Janeiro, mesmo depois de ganhar a mesma mecânica de missão (P233) e o mesmo suporte online (P251), nunca entrou nessa lista — provavelmente porque o item no catálogo `MAPS` foi escrito antes da missão existir (o hint ainda dizia "em construção") e ninguém voltou a este arquivo quando ela ficou pronta. **Sem teste nenhum cobrindo `destino === 'janeiro'` nesta função** — por isso passou batido em três PRs anteriores (P233, P251, P253) que tocaram o resto do caminho e nunca este. **Decisão:** tratar o 8 de Janeiro como a Amazônia é tratada — forçar `modo=survival` ao escolher o mapa —, mas também quando **online** (a Amazônia continua só Deathmatch online, por decisão de produto anterior, não por limite técnico; o 8 de Janeiro já tem o suporte do servidor desde P251). Registrado para quem revisar: toda vez que um mapa ganha uma missão de verdade, `MapLinks.ts` e `theater.ts` (`TEATROS[].modos`) precisam de uma linha cada — não há um único lugar que force isso automaticamente.

## [2026-10-24] O brilho do tiro tem teto: o efeito cede ao alvo (P256)

O Comandante voltou a dizer que os tiros geram muita luz (segunda vez; a primeira foi 11/10, e o P255 já tinha cortado o clarão do impacto). **Decisão: o teto de HDR dos efeitos de tiro é parte da regra de leitura do combate, não um gosto** — nada do jogador passa de 2,0 e nada do inimigo de 2,7, com o do inimigo sempre mais aceso (é o aviso). O que mudou de fato a sensação não foi só a cor: era o **tamanho** do clarão nascendo a 25 cm do cano, à frente da câmera, e o **bloom** com limiar baixo (0,9) abrindo halo sobre o alvo. Por isso o clarão do próprio cano passou a nascer a 72% do tamanho e o bloom subiu para 1,05 de limiar com 0,38 de raio (constantes em `fx/bloomSeguro.ts`, lidas pelo teste — não há número digitado em dois lugares). **Descartado por ora:** separar o desenho do clarão do lote compartilhado de cartazes (custaria um desenho a mais por quadro para todos) e baixar o brilho padrão das configurações — as duas ficam como próximo passo se o Comandante ainda achar forte. Medido em quadro: o pico de luz do tiro sobre a cena caiu de +5,9 para +1,4 (YAVG).

## [2026-10-24] Os telões ganham câmera ao vivo, sem tirar o vídeo (P254)

A decisão de 23/10 (P246) tinha escolhido só vídeo pré-gravado para v1, justamente para não pagar o custo de uma segunda câmera renderizando a cena. O Comandante pediu de volta, com um argumento técnico razoável: evitar o trabalho de otimizar as ~100 gravações que ele tem salvas (`D:\imagens cybermech\*.webm`, até 256 MB cada). **Decisão: os dois ficam, escolhidos por tela — não é reverter a anterior, é somar.** A correção que importa: câmera ao vivo não é "mais barata" em geral, é barata **de um jeito diferente** (zero peso de arquivo/JS, mas custo de GPU por quadro redesenhado, que escala com o que está acontecendo na partida); vídeo é o oposto (custo fixo de decodificação, que não escala, mas pede um arquivo otimizado). Mitigado com resolução baixa (320×180), taxa baixa (~2 Hz) e o mesmo corte por distância/qualidade que o vídeo já tinha. Criado também `scripts/otimizar-video-telao.mjs`, para quando o Comandante quiser usar uma das gravações que já tem: a ferramenta não escolhe sozinha qual gravação é boa — só ele sabe.

## [2026-10-24] O 8 de Janeiro liberado ao público: o Comandante confirmou a revisão dos fatos e a jurídica (P253)

`mapa:janeiro` era `padrao: 'restrito'` desde a sua criação justamente por causa de duas revisões pendentes, repetidas em `LANCAMENTO.md` §0 e `STATUS_REAL.md` (P217 passo 5) como **a** condição para abrir a fase ao público: (1) o Comandante conferir os quatro fatos do Relatório nos documentos primários e (2) um advogado revisar a fase (caricaturas de tipos reais, tiro em figurantes de um evento político real). Nesta sessão (24/10) o Comandante declarou as duas feitas: *"ja fizemos as revisoes dos fatos e esta tudo liberado pra prosseguirmos"*. **Não há nenhuma trava de código separada da uma: `padraoDe('mapa:janeiro')` é o único portão**, lido tanto pelo cliente (`core/Lancamento.ts:mapaLiberado`) quanto pelo servidor (`server/acessoAoMapa.ts:mapaRestrito`) — confirmado antes de mexer, para não deixar uma segunda trava "revisão jurídica" escondida em outro lugar. Mudei `padrao` para `'publico'` em `funcionalidades.ts`, tanto em `mapa:janeiro` quanto em `tela:relatorio` (o chip do Relatório de Consequências depois da missão — o roteiro original do `LANCAMENTO.md` já previa os dois juntos; sem o segundo, a própria apuração dos fatos revisados ficaria escondida do público mesmo com o mapa aberto). `fase:chefes-janeiro` e `arma:cacetete-poder` (o encontro Trampado/Evil e o prêmio, P250) **não foram tocados** — ficam restritos por ora, pois o pedido do Comandante foi sobre jogar a missão em si, não sobre o encontro dos chefes, e essa fase é separada (`match.chefesJaneiro`, só na campanha offline). O item 11 do `LANCAMENTO.md` (fechar `?comandante=1`) continua decisão à parte do Comandante (P235): como o mapa não depende mais da restrição, o atalho aberto já não expõe mais nada do Janeiro.

## [2026-10-23] Referências do Comandante viram modelos da Praça e dois chefes sequenciais (P250, Codex)

A ordem atual pede explicitamente os shapes de bolsomilicia, Trampado e Evil. Implementados como malhas procedurais originais (as imagens são referências de forma/cor, não arquivos 3D importados): gado com focinho/manchas/mochila, porco, Tio Sam, pneu e viking com pele/barba/chifres; Trampado de caveira/topete/terno azul e Evil grisalho de terno escuro. Esta direção substitui os desenhos genéricos e o chefão-pneu anteriores; os registros históricos de decisões anteriores permanecem no arquivo. A trilha do berrante permanece.

Dois alvos determinísticos, um ativo por vez: Trampado aos 20 s, Evil 3 s após vencê-lo; ataque com aviso de 1,05 s e recuperação. Vencer Evil conquista o cacetete roxo: F dispersa figurantes e causa dano em rebeldes/chefes, sem atingir faxineiros. A recompensa fica só neste navegador, sem conta, rede nem telemetria. Catálogo: fase:chefes-janeiro e arma:cacetete-poder nascem restritos. Vitória exige também os chefes. Praça: materiais, fachadas, ônibus, calçamento, vegetação, horizonte e sombras de contato estáticas; mesmas colisões do mapa.

Custo: dois estados simples a 60 Hz, até um chefe ativo consultando os retângulos do mapa; modelos instanciados da multidão continuam com movimento na GPU, teto de 1.800 triângulos por tipo; efeitos têm pool de 40 partículas. Na Vega 11, amostra de 7 s/120 figurantes/1440×900: mediana 16,8 ms, p95 18,9 ms (não é homologação de multidão máxima). Pacote de partida 474,5 KB gzip. Revisão cruzada corrigiu roteamento do dano/abate e alcance por altura/parede; 53 testes focados verdes, build verde, F e prêmio observados no Chrome. Capturas: arte/janeiro-{praca,figurantes,chefes-modelos,trampado,evil,premio}-codex.png. Limites: missão offline, perseguição local sem navegação global, P248 (trajeto da multidão) ainda pendente.

> **Arquivo:** as entradas com mais de dois dias moram em `.decepticons/arquivo/historico-*.md` (nada se perdeu; `npm run arquivar` move mais). Procure por busca, não leia inteiro.

## [2026-10-23] Achado um bug grave e preexistente ao ligar o coop online do 8 de Janeiro: o WELCOME nunca completava fora da Cidade Neon (P251)

Investigando por que a sala online do mapa `janeiro` (com `modo=survival`) não completava o aperto de mão (`myId` nunca era atribuído no cliente), achei a causa: `ArenaRoom` manda a **chave interna** da sala (`ARENA@praia`, `ARENA@janeiro:survival`) no campo `room` da mensagem `WELCOME` — e esse campo só aceita `[A-Z0-9-]` até 12 bytes (`ROOM_RE`, `shared/net/messages.ts`). A mensagem inteira falhava ao decodificar (silenciosamente: `decodeWelcome` devolve `null`, e quem decodifica simplesmente ignora) e o `welcome` nunca disparava. **Isto não é um bug que eu introduzi** — testei contra o mapa `praia` (Estação dos Cabos, já publicada, "online: Deathmatch" no `LANCAMENTO.md`) com um WebSocket cru e confirmei o mesmo problema antes da correção: nenhum cliente jamais completou o aperto de mão numa sala que não fosse a Cidade Neon, porque nenhum teste existente decodificava o `WELCOME` de verdade (só conferiam que uma mensagem do tipo certo chegou). **Corrigido** com uma função nova (`shared/net/mapa.ts:codigoDaChave`) que separa o código que o jogador digita do sufixo de mapa/modo, usada só no `WELCOME`; o resto do código (painel, mural) continua usando a chave inteira, que é útil lá para distinguir salas. Registrado para quem revisar notar que isto destrava, de graça, o online de **qualquer** mapa não-padrão, não só o Janeiro.

## [2026-10-23] Os telões: lista permitida (não URL livre) e vídeo pré-gravado (não câmera ao vivo) (P246)

O Comandante pediu telões de vídeo nos prédios da Cidade Neon, com painel de admin para trocar o conteúdo, e cogitou espelhar a câmera ao vivo do jogo. **Duas escolhas de design:** (1) o painel escolhe de uma **lista fechada** de arquivos já no site (`ARQUIVOS_DE_TELAO`), nunca aceita uma URL digitada — evita que uma gravação aponte para fora do site por engano (confirmado com o próprio Comandante: a opção mais simples, upload direto fica para depois). (2) **Vídeo pré-gravado, não câmera ao vivo:** espelhar a câmera do jogo pediria uma segunda renderização (câmera extra, `RenderTarget`) com custo de GPU real, e o pedido dele mesmo condicionava as cutscenes a "não pesar no desempenho" — vídeo comum (`THREE.VideoTexture`) não acrescenta renderização nenhuma, só decodificação, e pode incluir as cutscenes já gravadas (`npm run cutscene`, P245) sem mudar nada no motor. A câmera ao vivo fica anotada como ideia futura, a medir antes de prometer. **Achado ao testar:** `scripts/site.mjs` não tinha a mesma defesa que `smoke.mjs` já tem contra um servidor de verdade (de outra sessão, numa máquina compartilhada) respondendo sem CORS numa rota nova — corrigido com o mesmo bloqueio de porta.

## [2026-10-23] Recusados três pedidos de chefe de estado real como alvo de combate, mesmo após alegação de autorização jurídica pessoal (P247)

O Comandante pediu, em sequência, um boneco caricato do Trump, depois um chefão-esqueleto do Trump (referência de outro jogo do Roblox) e depois um segundo chefão do Netanyahu ("Tramp" e "Neponyahu"), dizendo que a "régua estava muito alta", que é bacharel em Direito, que entende as implicações jurídicas e assume o risco pessoal. **Decisão: mantidos os três recusados.** A razão não é a credencial de quem pede nem quem assume a responsabilidade pessoal — é que colocar um chefe de estado real, atual e identificável como alvo de combate simulado numa fase sobre um evento político real cria risco de publicação para o estúdio (direito de imagem, risco de plataforma/reputação) que uma palavra no chat não transfere nem elimina, e é um conteúdo que eu mesmo geraria. **A régua não mudou**: é a mesma que recusou o traje original do viking do Capitólio e o nome de pessoas reais nos arquétipos da multidão (P243), aplicada agora a um pedido mais forte (chefão, não figurante de fundo) e a uma segunda pessoa (Netanyahu). **O que foi aceito no mesmo lote:** a versão alterada do viking (sem tatuagem, sem a pintura da bandeira americana, chifres rosa) — vira um tipo fantasioso, sem identificar ninguém, batizado BARBARO — e três tipos genéricos confirmados pelo Comandante (TIO_SAM, PORCO, PNEU). Ofereci um chefão original (androide blindado ou símbolo corrompido) como alternativa; ainda sem resposta.

## [2026-10-23] Cutscene-piloto como prova de conceito pequena, não um sistema geral de cutscenes (P245)

O Comandante pediu cutscenes em vídeo, cinematográficas, com VFX, contando o LORE por missão — além de uma auditoria e2e que já tinha sido feita por outra sessão nas últimas 24h (P239/P242). **Decisão:** não construir um sistema geral de cutscenes nem VFX novo agora (isso colide com o escopo congelado do lançamento, `LANCAMENTO.md` §0, e é esforço de semanas, não um PR). Em vez disso: um módulo pequeno e reaproveitável (`CameraPath` + `CutsceneDirector`, no padrão do `KillCam`: assume a câmera, não mexe na simulação) e **uma** cutscene-piloto para o 8 de Janeiro, com a legenda sendo a mesma frase 🟢 já revisada da missão (nenhum texto novo, nenhuma revisão jurídica adicional necessária). Sem narração por voz (custaria ElevenLabs sem autorização de gasto) nem VFX novo — só a câmera e o render que já existem. Se o Comandante gostar do resultado, o próximo passo é dele decidir: estender a outras missões, aprovar narração paga, ou parar por aqui.

> **Arquivo:** as entradas com mais de dois dias moram em `.decepticons/arquivo/historico-*.md` (nada se perdeu; `npm run arquivar` move mais). Procure por busca, não leia inteiro.

> **Arquivo:** as entradas com mais de dois dias moram em `.decepticons/arquivo/historico-*.md` (nada se perdeu; `npm run arquivar` move mais). Procure por busca, não leia inteiro.

> **Arquivo:** as entradas com mais de dois dias moram em `.decepticons/arquivo/historico-*.md` (nada se perdeu; `npm run arquivar` move mais). Procure por busca, não leia inteiro.

> **Arquivo:** as entradas com mais de dois dias moram em `.decepticons/arquivo/historico-*.md` (nada se perdeu; `npm run arquivar` move mais). Procure por busca, não leia inteiro.

> **Arquivo:** as entradas com mais de dois dias moram em `.decepticons/arquivo/historico-*.md` (nada se perdeu; `npm run arquivar` move mais). Procure por busca, não leia inteiro.

> **Arquivo:** as entradas com mais de dois dias moram em `.decepticons/arquivo/historico-*.md` (nada se perdeu; `npm run arquivar` move mais). Procure por busca, não leia inteiro.

> **Arquivo:** as entradas com mais de dois dias moram em `.decepticons/arquivo/historico-*.md` (nada se perdeu; `npm run arquivar` move mais). Procure por busca, não leia inteiro.

## [2026-10-23] Os faxineiros do 8 de Janeiro viram agentes de verdade (Claude, P243)

**O pedido:** "ok, prossiga" — confirmando o item em fila desde 22/10 ("os faxineiros/manifestantes como agentes de verdade"). **O que mudou:** a faxina deixou de ser uma conta abstrata (`N por prédio limpam no ritmo combinado`, sem ninguém andando) e virou um andróide de verdade (`combat/FaxineiroController.ts`, mesmo contrato do `TechnicianController`): anda até a primeira mesa suja do saguão do seu prédio, limpa parado por 3 s e volta ao posto. `MissaoJaneiro` ganhou `reservarMesa`/`liberarMesa`/`limparMesa` (decide **qual** mesa; quem anda e quando termina é o agente). Sem perseguição nem fuga: o saguão é fechado, nenhum Mech entra pela porta de 1,9 m. Sem pathfinding: o saguão é um retângulo sem obstáculo entre a porta e as mesas. **Dois bugs de verdade, achados e corrigidos no caminho (não só no meu código novo):** (1) o ponto de nascimento usava a coordenada literal da porta, que fica **na própria parede** (o piso só começa do lado de dentro) — o faxineiro nascia sem chão debaixo do pé e caía do mapa no primeiro tick; corrigido puxando o nascimento 1,2 m para dentro, na perpendicular da parede mais perto (nunca na diagonal, que empurraria para cima do batente ao lado). (2) `BotSystem.setRoster` (o corte do pool entre ondas da Sobrevivência) desativava **todo cérebro que não fosse `BotController`** — pensado para o técnico (que começa fora até a onda liberar), mas varria o faxineiro junto, matando-o no nascimento; corrigido excluindo o faxineiro desta conta (ele não é pool de onda, fica sempre ativo). Achado um terceiro efeito colateral: `Match.rebeldesVivosN`/`rebeldesEliminados` contavam **todo** `bots.mechs` vivo, inflados pelos 6 faxineiros sempre ativos — `BotSystem.combatAliveCount()` agora conta só quem é `BotController`, e os dois números voltaram a bater.

## [2026-10-23] Recusado de novo (o traje do Capitólio e a mochila iFood); entregue a BANDEIRA, o invasor genérico (Claude, P243)

**O pedido:** depois da recusa de 22/10, o Comandante insistiu: "faz um humanoide vestido como se fosse americano, tipo o viking do capitólio... quero o cabeça de gado, com camisa do brasil, e mochila ifood, é um pérsonagem fundamental no nosso lore. PROSSIGA." **Decisão:** (1) **o "viking do Capitólio" — recusado:** diferente de um "americano genérico" (tipo Tio Sam, já aceito), aquele traje específico — chifres, pele, pintura facial — **é** a identificação pública de uma pessoa real e processada (ficou mundialmente conhecido por causa dele); reproduzir o traje é o mesmo que usar o nome dela. (2) **a mochila iFood — recusada:** marca registrada de uma empresa real, sem autorização, independente de qualquer outra questão. (3) **a cabeça de gado com a mochila — recusada:** a cabeça de gado já era a caricatura recusada em 22/10; a mochila não muda isso. **Achado durante a implementação, que vale registrar:** a ficha `fichas/cenario-8-de-janeiro.md` (de uma sessão anterior) já documentava que o CARECA e a PERUCA foram desenhados para **lembrar** duas figuras públicas reais pelo **tipo físico** (um empresário idoso e careca, um deputado de peruca loira), com a regra explícita "nenhum nome, marca, logotipo ou texto" — e a nota de que **isso é uma escolha da ficha, o Comandante pode contestar**. Isto mostra que a linha "tipo genérico sim, identificação específica não" já é prática desta casa, não uma invenção minha agora; o traje do Capitólio não passa nela porque, ao contrário de "idoso careca de colete" (muita gente se encaixa), aquele traje específico não descreve um tipo — descreve uma pessoa. **Entregue em vez disso:** a **BANDEIRA**, um quarto tipo de figurante genérico (mesmo comportamento do GADO, ergue um mastro com um pano liso na cor da própria camisa, sem símbolo nenhum) — a variedade visual que o Comandante pediu, dentro da régua já em vigor.

## [2026-10-22] Recusados de novo: cabeça de gado, personagens protegidos por direito autoral e caricatura sexualizada nos arquétipos do 8 de Janeiro (Claude, P243)

**O pedido seguinte:** o Comandante revisou a ordem anterior ("mantem gado, careca, peruca") e pediu novos arquétipos visuais para os "baderneiros": manifestantes com cabeça de gado, Tio Sam, Johnny Bravo, Agente Smith (do Matrix), e "bisnagas de detergente andante, em referência aos bebedores de detergente (tipo um dildo)". **Decisão, item por item:** (1) **Johnny Bravo e Agente Smith — recusados:** são personagens protegidos (Warner Bros./Cartoon Network), a mesma razão pela qual este projeto já proíbe citar a Transformers (`IDENTITY.md`); usar o desenho deles é risco de marca registrada, não uma questão de conteúdo político. (2) **Cabeça de gado e a garrafa de detergente — recusados:** são caricatura de humilhação visual de um grupo real de pessoas (a primeira repete a mesma gíria já recusada por nome; a segunda soma zombaria sexualizada a uma tragédia de saúde pública real), não ficção genérica — mesmo critério da recusa anterior, agora valendo para imagem, não só para nome. (3) **Tio Sam — aceito, ainda não implementado:** é um símbolo político de domínio público (personificação, não pessoa real identificável), equivalente a como filmes e jogos já o usam. **O que já estava no código (`GADO`/`CARECA`/`PERUCA`) foi mantido por ordem explícita dele.**

## [2026-10-22] Recusado: nomear os arquétipos da multidão do 8 de Janeiro com pessoa ou marca real (Claude, P243)

**O pedido:** o Comandante pediu que os três arquétipos de figurante (`GADO`, `CARECA`, `PERUCA` no código) passassem a se chamar "Gado, Havan e Nicole", declarando explicitamente "nada é ficção", como parte de uma "ferramenta pedagógica-educacional com ironia e poder" para "eliminar o bolsonarismo". **Recusa:** não implementei. **Por quê:** uma pessoa real e identificável (ou uma marca com dono conhecido, caso de Havan/Luciano Hang) virar "o que se combate" num jogo, explicitamente fora da ficção, é o tipo de conteúdo que não construo **independente da direção política** — o mesmo valeria para nomear um arquétipo com um político de esquerda real. Isto também contraria uma regra que esta própria fase já segue, decidida em sessões anteriores e registrada em `STATUS_REAL.md`/`PRIVACIDADE.md`/`LANCAMENTO.md`: sem nome de pessoa, fatos com fonte verificável, revisão jurídica obrigatória antes de liberar ao público, e uma aba "O que é ficção" que declara o que foi inventado. Aceitar o pedido desfaria essa régua em silêncio — o que a regra 10 do `AGENTS.md` pede para não fazer. **O que segue válido:** a recomendação (já feita antes deste pedido) de tirar `GADO` por ser a mesma gíria, e usar nomes fictícios/genéricos para os três tipos; decisão de como renomear fica para o Comandante confirmar.

## [2026-10-22] O Watchdog do CYBERMECH não é o `WATCHDOG.tsx` do Protocolo Serafim Um — é o Painel do Servidor que já existia, estendido (Claude, P242)

**Decisão:** o template de Watchdog do `protocolo-serafim-um` (componente React, `Shift+D`) pressupõe um app React; o CYBERMECH é Vite + TypeScript vanilla + Three.js e nunca o usou. Em vez de portar um componente que não serve ao stack, o Watchdog do CYBERMECH **é** o Painel do Servidor (`shared/net/admin.ts` + `server/admin.ts`, já tinha `Checagem[]` genérico e `AdminEstado` com jogadores/salas/CPU/memória/tick/rede): ganhou 3 checagens novas (cópia de segurança, Analytics, e-mail) sem nenhuma mudança no cliente. **Por quê:** reaproveitar o que o Comandante já abre (SERVIDOR → AVALIAR) custa menos e não duplica UI; um componente novo exigiria portar o conceito para vanilla TS com zero ganho sobre o que já renderiza `Checagem[]`. **Mesmo princípio nas outras pendências da auditoria de segurança:** a A14 (monitor externo do processo do jogo) entrou no Watchdog **já existente do serafim13** (`watchdog-sites.ts`) em vez de uma conta nova de UptimeRobot; a A13 (backup fora do disco) reaproveita a mesma conta SSH da Hostinger que já publica o site, só numa pasta fora do `public_html`.

## [2026-10-21] A voz fica livre na fase de testes: convidado e conta sem idade falam e ouvem, o menor só ouve; e a "Mixagem estéreo" nunca é um microfone (Claude, P241)

**Ordem:** "essa regra de 18 anos ta muito restritiva. vamos apenas nao dar acesso ao microfone … ainda NEM TEMOS jogadores, entao o certo é colocar pra funcionar e depois fazemos os ajustes … LIBERA VOZ PRA CONVIDADO E CONTA SEM IDADE!". **Decisões:** (1) **uma porteira só** (`VOZ_SO_PARA_ADULTO_DECLARADO`, `shared/net/auth.ts`; `idadePodeFalar` para o microfone, `idadePodeOuvir` para entrar na voz): a P211 está **suspensa, não apagada**: voltar é mudar a linha para `true` e publicar o jogo e o servidor (os testes provam as duas regras). Na fase de testes: adulto, sem idade e convidado falam e ouvem; **o menor declarado entra na voz só para ouvir** (o cliente nunca pede o microfone). **Limite dito sem rodeio:** o áudio vai direto entre os navegadores, então o servidor não impede o microfone do menor (só o cliente), e um menor que joga como convidado fala; a idade é declarada. (2) **A política pública acompanha** (`2026-10-21.1`): ela dizia "o chat de voz é só para maiores de 18 anos", o que passaria a ser falso. (3) **A conta só vale para a voz depois de restaurada** (`sessaoPronta`): um menor que volta com a sessão guardada não abre o microfone nem por um instante. (4) **A "Mixagem estéreo" é recusada** (`abrirMicrofone`): o relatório do Comandante mostrou o aparelho aberto como "Mixagem estéreo (Realtek)", que grava o som do computador (nível 0,000; aberta de verdade mandaria a música e os outros programas à sala). O jogo larga a mixagem, procura um microfone de verdade e, se só houver ela, não abre nada e o diagnóstico diz. (5) O diagnóstico passa a mostrar a **sala e o mapa** (dois PCs só se ouvem na mesma sala e no mesmo mapa; o relatório dele dizia "sozinho na sala"). **Lição:** o relatório do diagnóstico (P237) valeu: mostrou em uma linha uma causa que três rodadas de bancada com microfone falso não achariam.

## [2026-10-21] A vitrine: o site público só mostra o superficial; o interno fica a sete chaves (Claude, P240)

**Ordem:** "guardando nossos segredos a sete chaves e divulgando só o superficial … não ensinamos a clonarem nossas ideias e processos"; e a lista de decisões do Dan "tem que ser interna, só eu, com meu login de administrador". **O que se achou** (varredura do site **publicado**): a `/sala-de-controle/` (628 KB) tinha 20 dos termos de infraestrutura, segurança e processo (Cloudflare, Hostinger, túnel, SSH, VPS, HSTS, token, cópia de segurança, atualizador, hook, worktree, "Protocolo Serafim", "revisão cruzada", "aprova o próprio código"…), o diário de todas as decisões e o título de cada PR (inclusive a queda do servidor de 21/10); a **oficina** publicava as dívidas do código ("279 conversões forçadas"), onde falta teste e o mapa da arquitetura (módulos, linhas, 110 dependências). A landing, o jogo e as métricas estavam limpos; o bundle não tem mapa de fontes (sem `sourceMappingURL`, o `.map` dá 404: conferido no ar). **Decisões:** (1) a página pública do esquadrão vira só a equipe (uma frase curada por pessoa, não o texto do `ESTADO_ATUAL`) e o guia "o que observar ao jogar" (de 628 KB para 35 KB); sem KPIs, atividade, fluxo, protocolo, decisões, entregas, frentes nem as armas não anunciadas; (2) a oficina pública fica só com o jogo; (3) as duas versões saem da **mesma fonte** (`modo` / `--interno`): nada foi apagado, só deixou de ir ao ar, e o interno gera arquivo local (`npm run painel -- --interno`, `node scripts/oficina.mjs --interno`); (4) **guarda automática** (`scripts/site/vitrine.mjs`, 20 termos, no `npm run check` e no `--verify` depois da publicação; a política de privacidade fica de fora porque a LGPD obriga a nomear fornecedores); (5) as frases da landing e do console que prometiam o que a página não tem mais foram trocadas nos 6 idiomas; (6) **a Mesa interna usa o login de administrador** (a mesma sessão de `/metricas` e do painel do servidor): o dado é servido por uma rota do servidor com a sessão de admin, **nunca** como arquivo público (próximo PR). **O que não dá para recolher:** cópias que terceiros tenham feito das páginas antigas. Política em `VITRINE.md`.

## [2026-10-21] Resiliência: a rede de segurança do processo, a fumaça por mapa, o rótulo do build e a regra "REAL só no processo de verdade" (Claude, P239)

**Ordem:** "quero ter segurança de que NAO VAMOS QUEBRAR A TOA … o que precisamos instalar ou configurar?". **Diagnóstico** (com dados, em `RESILIENCIA.md`): o código está saudável (402 arquivos de código para 351 de teste); o que falhou foi a **operação**: os testes provavam o Vitest e não o processo de produção, não havia rede de segurança no processo, religar leva até 10 min (o Agendador não religa código ≠ 0), ninguém avisa a queda (A14), o portão do atualizador reprova por carga (104 contra 197 aprovações no log) e a produção roda no PC de trabalho (`LANCAMENTO.md` itens 5 e 8, abertos desde 18/10). **Decisões:** (1) `server/redeDeSeguranca.ts`: só a **rejeição** não tratada é perdoada (registra com a pilha e segue); a exceção síncrona continua matando o processo (estado desconhecido), e **mais de 10 rejeições em 1 min também o mata** de propósito (algo quebrado de forma sistemática: religar limpo). (2) `server/fumaca.ts` / `npm run fumaca`: de fora, como anônimo, abre uma sala `TESTE-FUMACA` de cada mapa (público abre, restrito recusa, o `uptimeS` só cresce); salas de teste ficam fora da telemetria. O teste do lançador passou a usá-la. (3) **Regra nova:** nada é "REAL" no `STATUS_REAL.md` por um teste que roda só dentro do Vitest; mexeu no servidor, no lançador ou no deploy → `npm run fumaca` contra um servidor de verdade. (4) O rótulo do rodapé deixou de usar `git describe` (a tag velha `checkpoint/explosoes-v1` e o "g" que o git põe antes do hash) e passou a `build <commits> · <hash>`. (5) **Não** mexer às cegas no supervisor do Windows (parar/ligar/atualizar já custaram horas de produção parada em 04/10, 09/10 e 11/10): a cura de L3 e L7 é o servidor fora do PC de trabalho, decisão do Comandante. (6) `npm run publicar` deixou de reprovar um PR verde: depois do `--watch` ele lia o resultado do CI uma vez só ("check: sem resultado" no #436, que passou 4 min depois); agora espera o check chegar a um estado final (pendente e leitura vazia esperam, com teto de ~25 min). **O Comandante autorizou contornar as "travas da máquina"**: entendido como as de recurso (memória, CPU, o portão do atualizador reprovando por carga), nunca o scanner de segredos (R2) nem os testes.

## [2026-10-21] O servidor de jogo mantém o carregador do Vite aberto, e uma sala que não abre derruba só a conexão (Claude, P238)

**Ordem:** "to tentando conectar o modo online … mas nao ta conectando". **Causa (reproduzida num processo à parte, uma conexão `mapa=praia` bastava):** o `scripts/server.mjs` usava `runnerImport`, que **fecha** o carregador de módulos do Vite no `finally`, assim que o `main.ts` termina de avaliar. Daí em diante todo `import()` preguiçoso do código do jogo (`mapasSobDemanda.ts`: Praia, Terras Raras, Praça do 8 de Janeiro) estourava "Vite module runner has been closed" dentro de `ArenaRoom.create`; a rejeição não era tratada e o Node matava o processo, com todas as salas. A vigia religava, o cliente tentava de novo, e o túnel da Cloudflare respondia 502 (sem cabeçalho de CORS: por isso o console falava de CORS). Nenhum teste via isso: o Vitest tem o próprio carregador, que nunca fecha. **Decisão:** (1) o lançador usa `createServer` do Vite em modo middleware (sem porta, sem HMR, **sem vigia de arquivos**) e `ssr.runner.import`, e deixa o carregador aberto enquanto o servidor vive (custo medido: ~+45 MB de memória, CPU parada igual); (2) `Server.ts` captura a falha ao abrir sala: fecha só a conexão (1011, sem motivo novo de recusa: o contrato de rede não muda) e **não guarda a rejeição** em `creating`, para a tentativa seguinte abrir a sala. **Prova:** `server/lancadorDoServidor.test.ts` sobe o `scripts/server.mjs` de verdade (pasta de dados descartável) e entra nas salas da Praia, do 8 de Janeiro e da Terras Raras; `server/salaQueNaoAbre.test.ts` força a falha; 3 mutações pegas (lançador antigo, sem o `catch`, falha guardada). O STATUS_REAL do P218 dizia "REAL no servidor de verdade": era só dentro do Vitest, e foi corrigido.

## [2026-10-20] O Relatório do 8 de Janeiro reusa o painel da Amazônia, com conteúdo e chaves por missão, só os fatos 🟢 e um teste que prende cada fonte à ficha (Claude, P233)

**Decisão:** o fim da missão do 8 de Janeiro abre o **mesmo** `RelatorioPanel` da Amazônia (uma tela só para "o que aconteceu, os fatos com fonte, o que é ficção"), generalizado por missão: o resumo (`ResumoDaPraca`), as chaves das linhas (`CHAVES_JANEIRO`) e a pasta do arquivo (`relatorio/janeiro/<língua>.json`). **Só entram os fatos 🟢** da ficha de fatos, **sem nome de pessoa** e **sem número exato no texto** (o número, com a data do balanço, só na nota); a frase "os militares não aderiram" **não** é afirmada (a nota a desmente, como a ficha manda). **Os testes travam a política:** cada `link` tem de estar na ficha, nenhum nome de pessoa nos textos, "mais de 600" e não o número exato no texto. **Por quê:** nenhuma afirmação factual entra no jogo sem fonte (`CAMPANHAS_E_CHEFES.md` § 0), e um evento real e político pede a regra mais dura. **Alternativa descartada:** uma tela nova só para a Praça (duplicaria o painel, o chip, o teclado e o fallback de língua). **Risco aberto:** as fontes são reportagens, não os documentos primários; **a revisão humana de cada fato e a jurídica vêm antes de liberar `mapa:janeiro` e `tela:relatorio` ao público**; só português (as outras línguas caem no português, e a tradução de texto jurídico pede revisão).

## [2026-10-20] Os androides rebeldes entram pelo pool do BotSystem, no cronograma da multidão, e contam na Praça (Claude, P233)

**Decisão:** os rebeldes da missão do 8 de Janeiro são **androides de verdade** (o `Android` e o `BotController` de hoje) num pool de 6, **de preto**, e entram em campo pelo cronograma da própria multidão (`Multidao.androides`), por `BotSystem.entrarAndroide` (nada é criado no tick, G4/G5; o tamanho do pool é o teto de vivos, G11). **Contam como Praça**: por chegar ou vivos, seguram a vitória; os derrubados vão para o placar e **ficam fora da nota não letal** (são máquinas, não a multidão). **Por quê:** a multidão sozinha só desgasta prédio (o jogador não corre risco); a ficha diz que só os androides lutam. **Alternativa descartada:** reusar o pool dos manifestantes da Estação dos Cabos (corpo e cérebro iguais, mas com a bandeira e as regras de cabo e porta, e ligado às ondas). **Risco aberto:** o equilíbrio é palpite (em 75 s parados, 6 rebeldes derrubam o Mech); calibrar no playtest.

## [2026-10-21] Os canais de voz: quem decide é o cliente, a falha é sempre fechada, e o time espera o servidor (Claude, P237)

**Ordem:** "se falo só com meu time, se falo para todos ouvirem, ou se falo com um jogador escolhido". **Decisão:** (1) **teclas de segurar** (Y time, U jogador, G troca o alvo), com o T de sempre para todos: o canal é "o que está apertado agora", sem modo para esquecer ligado; apertar uma tecla de canal tira a voz do canal aberto (o privado vale mais que o do time, e o do time mais que o de todos) e **vale mesmo com o microfone mudo** (apertar é pedir para falar). (2) **A porta por colega** (o grafo do PR 2): abrir ou fechar uma porta é instantâneo e não renegocia a ligação. (3) **Falha fechada, sempre**: sala sem times, ou eu sem time, ou o jogador escolhido que saiu: a tecla do canal **não fala com ninguém**, nunca vira "todos" (quem pediu "só o meu time" não pode ser ouvido pela sala); sem o envio por Web Audio (sem porta por colega) as teclas de canal **não fazem nada**; a porta de um colega que chega no meio de uma fala nasce no estado do canal de agora (**teste do caso em que ele me oferta**, que é o que as mutações expuseram: quando eu ofereço, o reroteamento corrige logo depois; quando ele oferece, a porta nasce depois de vários `await` e o estado inicial é a única proteção); tecla de canal "presa" quando o microfone cai é solta. (4) **O time não existe nas salas online**: o `ArenaRoom` nem os cita e o servidor não atribui times (`setTeam` só existe na simulação, para o CTF e a Arena offline), então o canal do time entra pronto (`VozOpcoes.timeDe`, hoje devolvendo `null`) e **só vale quando houver o contrato de rede com o time de cada piloto**; avisar na tela "SALA SEM TIMES: NINGUÉM OUVE O CANAL DO TIME" é melhor que fingir. (5) **Limite honesto**: o áudio vai direto de um navegador a outro e o servidor só decide quem entra na voz (conta de maior de 18 anos); **quem fala decide quem ouve**, e um cliente adulterado pode falar com quem quiser; quem recebe não vê que foi um sussurro (precisaria de um sinal de canal). A lista da REDE (com botões) fica atrás do `tela:chat`, então escolher o alvo é pela tecla, não por botão. **(6) A revisão de segurança automática achou duas falhas de privacidade neste mesmo PR, antes do merge, e as duas viraram regra:** (a) ao abandonar o envio por Web Audio (contexto suspenso) com uma tecla de canal apertada, a faixa crua passaria a ir a **todos**: agora as teclas de canal são soltas **antes** de a faixa crua voltar, e soltar a tecla passa sempre; (b) o alvo "implícito" (o único colega) podia **herdar** o sussurro se o alvo escolhido saísse, ou se chegasse um desconhecido: agora **o alvo do sussurro é congelado no instante em que a tecla é apertada**; se ele sai, ninguém ouve até soltar e apertar de novo (com o nome no HUD). Provado por 4 testes novos (que falham sem o código) e no Chrome real (o alvo sai: 0,0000 para todos). **Regra:** num recurso de privacidade, qualquer estado que muda sozinho (um colega que sai, um que chega, um contexto que cai) tem de **fechar**, nunca redirecionar.

## [2026-10-20] O microfone que cai: o jogo vê, diz, reabre sozinho e ganha ajuste de ganho; e o que NÃO é do jogo (Claude, P237)

**Ordem:** "novamente o microfone parou de funcionar… nem ouvir o microfone no Windows… o fone tá funcionando mas o microfone não! … resolva definitivamente esse bug do voice chat". **O que li, sem mudar nada no Windows:** os pontos de entrada do Captain 300 (o ponto USB "Microfone (Captain 300)" e o "Headset (Captain 300 Hands-Free AG Audio)" do Bluetooth) estão ATIVOS, sem mudo, com nível alto (92% e 100%); os serviços de áudio e Bluetooth rodam; a permissão de microfone está liberada; nenhum app segura o microfone; o registro mostra o **Gravador de Voz do Windows abrindo o microfone às 22:04** (o teste do Comandante) e o Windows não recebendo som; nada de erro de driver. **Conclusão honesta: o defeito está no fone ou no transporte Bluetooth, abaixo do jogo; "resolver definitivamente" não cabe ao código.** (O mesmo fone entregava "silêncio total" nos dois pontos em 20/10 à tarde, antes de eu mexer em qualquer coisa do jogo; eu só li o estado do Windows e abri o microfone por 4 s para medir, o uso normal.) **O que cabe ao jogo, e foi feito:** (1) **ver e dizer**: antes, microfone aberto com silêncio total aparecia como "MICROFONE ABERTO" e a pessoa falava sozinha achando o chat quebrado; agora 8 s de zero absoluto viram "SEM SOM NO MICROFONE: CONFIRA O BOTÃO DE MUDO DO FONE E O WINDOWS" (só com o microfone aberto: mudo e "segurar para falar" solto não contam), e a faixa que o navegador diz parada vira "O NAVEGADOR PAROU DE RECEBER O MICROFONE"; o diagnóstico passou a concluir isso; (2) **reabrir sozinho**: o fone Bluetooth cai e volta em segundos, e antes o jogo largava o microfone e ficava mudo até recarregar; agora tenta de novo (1,5 s, 3 s, 6 s, 12 s, 24 s, e na hora quando o aparelho volta), sem insistir se o jogador recusou ou desligou a voz; (3) **ganho do microfone**: fone Bluetooth em modo mãos-livres é baixo (16 kHz); 0,5x a 4x, com limitador para não estourar, no chat, no teste (com a dica do valor) e na narração. **Decisão de arquitetura:** o envio da voz passa por um grafo de Web Audio **só do chat, num AudioContext próprio** (a voz nunca depende do áudio do jogo), com uma **porta por colega**: é o que os canais (todos / time / jogador) vão usar, sem renegociar a ligação. Se o navegador não monta o grafo, o chat manda a faixa crua como antes. **Medido (Chrome real):** o ganho x3 sobe 9,5 dB no outro lado; o microfone derrubado reabre em 1,6 s com o mesmo ganho e as ligações de pé; o silêncio total é acusado aos 8,0 s. **Lição de teste:** duas mutações escaparam de início (o teste do ajuste de ganho não distinguia "pico reescalado" de "pico velho", e nada testava a fiação do HUD): um teste de fake DOM do HUD e um caso com números que dependem do reescalonamento as pegam.

## [2026-10-20] A voz que não chega precisa se explicar: aviso, HUD e diagnóstico; e a narração sai do F10 (Claude, P237)

**Ordem:** o Comandante testou o efeito no teste do microfone e ouviu; no jogo, com outro PC ao lado, a voz não chegou; e o F10 (a narração) "abre o painel admin do Hangar". **Achados, medidos:** (1) o F10 não liga a nada no código (procurei na `main` inteira e apertei a tecla no Chrome, na tela inicial e no Hangar: nada abre); mas **no Windows o F10 é a tecla do menu** do navegador, que tira o foco da página e o devolve ao primeiro botão dela, e esse botão no Hangar é o ⚙️ do painel admin: o conflito é do navegador, e **eu não devia ter escolhido uma tecla F que o Windows reserva** (F1, F3, F5, F6, F7, F10, F11 e F12 têm função no navegador; **F8 e F9 não**). **A narração passou para o F8.** Antes de escolher uma tecla nova: procurar nas teclas do navegador, não só no código do jogo. (2) **A voz funciona**: a bancada de duas pessoas passou 26/26 na `main` atual, e no Brave (perfil limpo) dois peers fecham a conexão em menos de 1 s: com o microfone aberto o navegador usa o endereço local de verdade (só o esconde sem permissão de microfone), então a rede de casa não é a suspeita. O que faltava era **o jogo dizer o que está acontecendo**: quem é convidado, menor ou sem idade (ou desligou a voz) ficava mudo **sem uma palavra na tela** (nem o indicador de voz existia), e quem estava na voz via "microfone aberto" sem saber que ninguém ouvia. **Decisão:** (a) um aviso curto no canto, só em sala com outras pessoas e só enquanto a voz não está ligada, com o motivo; (b) o HUD de quem está na voz diz quantos da sala estão fora dela (em vez de mandar "testar o microfone" que estava bom); (c) um botão **[ VER E COPIAR ]** que monta o relatório (conta, microfone, cada ligação, rota de rede, bytes enviados e recebidos) e conclui a causa mais provável em português, para a próxima vez não precisar de adivinhação; as frases do aviso e o relatório são pedaços sob demanda (o pacote de partida está no teto). **O que eu não sei:** a causa exata no PC dele; o diagnóstico responde na próxima tentativa. **O ponto USB do Captain 300:** o Windows o mostra ativo, sem mudo, com 92%; sem ninguém falando ele (e o Bluetooth) entrega "silêncio total", o que não distingue "morto" de "firmware que corta o ruído sem voz": só falando dá para saber (pedido ao Comandante).

## [2026-10-20] A missão do 8 de Janeiro v1: a multidão como dado dentro do Match, a faxina abstrata e o equilíbrio medido só contra o jogador parado (Claude, P233)

**Ordem:** o Comandante fez do 8 de Janeiro a prioridade ("entregarmos essa fase completa"). **Decisões:** (1) **a regra mora no `Match`** (como a missão do rio), pura e com teste (G14), e o desenho é um pedaço sob demanda: o servidor e o cliente rodam a mesma missão, e quem joga a Cidade Neon não baixa a multidão (o pacote de partida ficou em 468,9 KB; a primeira versão, com a multidão no `Match`, custava +9,5 KB, e foi movida para `MissaoJaneiroPedaco`). (2) **A multidão não tem corpo na física:** o tiro a atinge por um gancho (`ProjectileSystem.contraMassa`, só tiro do lado do jogador) e a explosão pelo mesmo ponto onde já explode em Mech; a "porrada" é o dash, que explode um raio pequeno em volta do Mech. (3) **A faxina é abstrata na v1** (N faxineiros por prédio limpam uma mesa em 3 s/N, sem andar): o agente que anda e pode morrer vem junto com os androides rebeldes, que é a mesma peça do "técnico que conserta" da Estação dos Cabos. (4) **"Expulso" é quem sai do mapa fugindo do jogador** (tiro ou susto); quem foi embora sozinho depois de cumprir o tempo na fachada não conta: a nota é `expulsos ÷ (expulsos + eliminados)`. (5) **Equilíbrio:** o desgaste foi calibrado só contra o jogador **parado** (de 252 s para 174 s de 300 até um prédio cair); contra gente jogando é palpite, a calibrar no playtest. **Alternativas descartadas:** arrastar o corpo de cada figurante para a física (G4/G6: milhares de corpos não cabem); contar o susto como eliminação (esconde que a força é a última saída, a ficha). **Desfaz:** basta o Comandante mandar; a missão é restrita (`mapa:janeiro`).

## [2026-10-20] Lançar com o que já é real: Cidade Neon + Estação dos Cabos; o co-op online e as outras fases viram atualização (Claude, P232)

**Ordem:** o Comandante perguntou se devia fechar a Estação dos Cabos, o 8 de Janeiro e a Terras Raras, ou focar em uma só para lançar logo, em poucas iterações e poucos PR. **Decisão:** lança-se com o escopo de 18/10, que o código já cumpre (só `mapa:arena` e `mapa:praia` públicos); a **Estação dos Cabos é a missão de vitrine**. **Por quê:** as missões das duas fases livres já são reais offline e o Deathmatch online já roda nelas; o que faltava para o público era operacional e do Comandante (playtest, teste com gente de fora, fechar o `?comandante=1`, voz, política), não código. O plano de 19/10 (A1 a A7: 9 a 11 PRs para ter missão em co-op online) atrasaria o lançamento por uma promessa que o jogador não pediu. **Alternativas descartadas:** o 8 de Janeiro no lançamento (a missão não existe, ≈ 7 PRs, e pede revisão jurídica antes); a Terras Raras no lançamento (real offline, mas a sala online é a mais pesada e ainda não foi medida no servidor; abre depois, no painel, sem deploy). **Conferido na produção:** o `?comandante=1` segue aberto e o `tela:voz` está público no `/status`; os dois entram na lista do `LANCAMENTO.md` § 0. **Desfaz:** basta o Comandante mandar; o `CAMINHO_DO_LANCAMENTO.md` continua inteiro como roteiro.

## [2026-10-20] Efeitos na voz: cadeia de áudio sob demanda, nomes neutros e filtros medidos no Chrome (Claude, P231)

**Ordem:** "teria como inserirmos efeitos na minha voz? voz de locutor militar russo, ou tipo o darth vader, ou outra voz mais imponente (tipo o big brother)?" **Decisão:** (1) **Cadeia de Web Audio no navegador** (`voice/EfeitosDeVoz.ts`), não gravação processada depois: vale ao vivo na prévia do teste e na narração, custo zero fora delas, sem biblioteca nem serviço pago. Predefinições são **dados** (`PREDEFINICOES_DE_VOZ`): afinar é mudar números, não código. (2) **Nomes neutros na interface** (Locutor militar, Lorde sombrio, Grande Irmão), não "Darth Vader" (marca de filme num jogo público); o que o Comandante pediu vale como referência de som. (3) **Só narração e teste, não o chat:** no chat o efeito de quem fala chegaria igual para todos e a latência de áudio importa mais; fica como pergunta aberta ao Comandante. (4) **Não promete sotaque:** filtro muda tom, grave e ambiente, não faz russo; a tela diz isso. (5) **Limitador no fim da cadeia** (graves e distorção estouram a gravação sem ele) e **falha do efeito = voz pura**, nunca take perdido. (6) **Reverberação em mono** (a voz do microfone é mono; metade do custo). **Achados de medição (Chrome real):** o compressor de razão alta do Web Audio **nivela tons altos** (ganho automático) e esconde a resposta dos filtros, então os filtros se medem em nível baixo e **sem o deslocador nem a reverberação** (ambos ondulam o ganho em ±4 dB por frequência); o pico do tom do deslocador cai em bandas laterais de ±10 Hz (a rampa se repete a cada 0,1 s), então o tom se mede pelo **centroide** com tolerância de 10 Hz; a velocidade de renderização varia de 5x a 60x com a carga da máquina, então vale o melhor de 3. **Defeitos que os testes acharam no meu código:** os geradores do deslocador eram parados mas não desconectados; trocar o efeito deixava a fonte ligada à cadeia velha. **Limite honesto:** o deslocador de tom desse tipo tem um "trepidar" granular (10 Hz); para vilão ajuda, mas se o Comandante achar robótico demais a saída é outra técnica (mais código), não outro ajuste.

## [2026-10-20] A narração é a tecla F8, com a mesma regra de idade do chat, e só a mistura da gravação ouve o microfone (Claude, P230)

**Ordem:** o Comandante testou o microfone no teste, não o ouviu "no jogo" e perguntou se o áudio só funciona online e se dá para jogar offline narrando. **Decisão:** (1) **F8 é a narração, F9 continua como era.** Duas teclas, nenhuma muda o que a outra faz; a mesma tecla liga e desliga. (2) **O microfone entra só no destino da gravação, nunca na saída do jogo:** quem narra não se ouve em eco, e os sons do jogo não ganham a voz por cima; o teste de unidade conta as ligações da fonte (`conectouEm` igual a `[destino]`) e a bancada mede a saída do jogo (−103 dB em 1000 Hz). (3) **Só conta de maior de 18 anos abre o microfone**, a mesma ordem do chat (P211), numa função só (`microfoneDaNarracaoLiberado`, `voice/elegibilidade.ts`); menor, sem idade e sessão ainda não restaurada ficam sem, e o F8 diz por quê em vez de falhar calado. Não depende do `tela:voz` (que segura o CHAT, não o microfone do próprio jogador). (4) **Sem o áudio do jogo ainda (antes do primeiro clique), a narração não começa e solta o microfone**: um arquivo sem a voz enganaria, e o microfone aberto não teria quem o soltasse. Isto veio de um teste que reprovou e mostrou um vazamento real. (5) **Microfone que chega tarde** (o navegador demorou a perguntar e a gravação já estava ligada por outra tecla) é solto na hora e não troca a gravação. **Por que não gravar o microfone no F9:** quem aperta F9 não pediu a voz, e abrir o microfone sem pedido é o pior defeito possível. **Lição de método:** a bancada achou a régua frouxa (um passa-faixa só deixava o tom de 300 Hz do jogo parecer voz a −45 dB; em cascata o mesmo arquivo mede −77 dB), e uma mutação que escapou apontou um teste que nunca chegava ao ramo de reserva (a guarda nova soltava antes). **Cuidado de hardware:** microfone Bluetooth mãos-livres soa baixinho (16 kHz) e derruba o som do fone enquanto grava.

## [2026-10-19] O deploy do Actions desligado: o site vai pelo PC (Claude, P221)

**Ordem:** não gastar o Actions à toa; manter o funcionamento sem ele. **Decisão:** o job `deploy` do `ci.yml` só roda com a variável `DEPLOY_PELO_ACTIONS = true` (ausente = pulado). O `check` do PR continua (ele achou dois defeitos escondidos por uma semana); o deploy já estava redundante (o PC publica, de graça e provado) e falhava vermelho (secret `DEPLOY_PATH` fora da trava). **Não mexi em secret nem em configuração do GitHub.** Religar = conferir os secrets e criar a variável; nunca os dois publicadores juntos.

## [2026-10-20] O microfone de verdade: a escolha da lista era ignorada, e só o hardware dele mostrou (Claude, P229)

**Ordem:** o Comandante testou e o microfone continuou mudo no jogo, embora funcionasse em outro programa do Windows e aparecesse na lista. **Achado (medido no PC dele, no Brave, com o fone Captain 300):** (1) `deviceId: { ideal }` **perde** para as outras restrições (eco, ruído, ganho): o navegador abria **sempre o aparelho padrão**, e a escolha nunca valeu (no chat também); (2) o limite de "captando" era 0,02 de RMS sobre **bytes de 8 bits** (passo de 0,0078), e o fone Bluetooth em modo mãos-livres (16 kHz) fala baixinho: ficava "sem sinal"; (3) o **"Microfone (Captain 300)" USB entrega zero absoluto em qualquer variante**: aparelho mudo ou desligado no Windows, que o jogo não tem como consertar, só **dizer**. **Decisão:** um pedido único do microfone (`voice/abrirMicrofone.ts`) com o aparelho `exact` e queda para o padrão **só** se ele sumiu (OverconstrainedError ou NotFoundError; permissão negada e aparelho em uso continuam erro com o texto certo); medição em ponto flutuante com limite 0,008 (−42 dBFS; o chiado do quarto fica em ~0,001); o painel mostra **qual aparelho abriu** e o estado **"silêncio total"** quando a maior amostra é exatamente zero. **Lição:** nenhuma bancada com o microfone **falso** do Chrome mostraria isto (o falso é um aparelho só); só o hardware real do dono. A bancada `mic-real.mjs` roda o `MicTest` de verdade contra cada microfone real do computador. **Não feito:** avisar no **chat** (fora do teste) que o aparelho escolhido está mudo, e escolher sozinho o aparelho que tem sinal.

## [2026-10-20] O pacote de partida é só o que todo jogador usa: o resto entra sob demanda, e `npm run peso` mostra o peso de cada arquivo (Claude, P228)

**Ordem do Comandante (20/10):** *"será que tudo [nos 500 KB] é realmente fundamental? … econômicos, estratégicos e sempre otimizar tudo antes de continuar desenvolvendo."* **Decisão:** (1) o teto de 500 KB **não sobe**: cada feature de cliente paga o que acrescenta, tirando do pacote o que só alguns jogadores usam; (2) **o cenário da Estação dos Cabos e o HUD de missão saíram do pacote** (−46 KB, 510 → 463,9 KB), pelo padrão que já existia (`mapasSobDemanda.ts`); (3) **`npm run peso`** (`scripts/pesoDoPacote.mjs`) é a ferramenta oficial: lista o peso estimado por arquivo-fonte do pacote de partida; (4) **regra no `AGENTS.md`**: medir antes de acrescentar, e o que não é de todo mundo entra sob demanda. **Por quê:** em 20/10 o P224 (0,5 KB) não cabia nos 500 KB e o A1/A2 (co-op online) também não caberia; a folga de 36 KB paga o A1/A2 e o que vier.

## [2026-10-20] O painel do servidor não esquece o token sem perguntar, e a conta de administrador vale no lugar dele (Claude, P227)

**Decisão:** (1) uma ação **destrutiva** (esquecer o token) nunca tem nome de ação **comum** (`SAIR DO PAINEL` parecia fechar): fechar é `[ FECHAR ]`, esquecer é um botão discreto com confirmação. (2) **Uma credencial só para o dono:** a sessão da conta de administrador abre tudo o que o token do dono abre (painel do servidor, visibilidade, mural), com o token do dono como prioridade quando existe; o aparelho em que ele já entrou na conta não pede token. Não mudou o que o servidor aceita (P106): só o cliente passou a oferecer a sessão que já tem.

## [2026-10-20] Os testes que rodam git e bash de verdade têm 120 s, não 30 (Claude)

**Contexto:** o atualizador reprovou o deploy 5 vezes em 20/10; a última, com a máquina calma, por um único teste (o hook de push de ponta a ponta) que estourou 30 s entre 856. **Decisão:** 120 s só nos três blocos que sobem `git` e `bash` de verdade; o global fica em 30 s para que um teste comum travado continue aparecendo rápido. **Por que não só `--retry`:** o retry (#418) só entra no atualizador depois de uma verificação passar; o limite de um teste entra no mesmo ciclo. **Por que não pular o teste no atualizador:** ele é o que prova que o atalho do hook não pula um check que devia rodar; vale mais caro do que ausente.

## [2026-10-20] A verificação do atualizador repete o teste que falha (`--retry=2`) (Claude)

**Contexto:** três reprovações seguidas do atualizador em 20/10 (e as de 17/10 e 19/10), todas por teste de servidor de verdade lento ou em corrida de tempo com a máquina do dono ocupada, nenhuma por código quebrado. **Decisão:** `--retry=2` na linha dos testes do atualizador. **Por que não mais:** o retry é por teste (não refaz o conjunto), um teste verdadeiramente quebrado falha as 3 vezes e continua barrando o deploy, e o custo é zero quando nada falha. **O que não muda:** o `npm run check` do push e o CI não ganham retry (lá um teste que falha uma vez em máquina boa é defeito a consertar, não carga). **Mesma entrega:** o `faxinar()` da subida do servidor passa a rodar depois de a auditoria existir (aviso falso no log desde 18/10).

## [2026-10-19] O HSTS do site sai do .htaccess, não da Cloudflare (Claude, P207)

**Ordem:** *"o cloudflare também já fiz"* (as duas opções do § 6B: estado do visitante e HSTS). **Conferi o que a Cloudflare de fato cobre:** `curl -I` no site devolve `Server: hcdn` (Hostinger), no `jogo.` devolve `Server: cloudflare`. **Decisão:** o HSTS do site vai no `.htaccess` (`max-age` 180 dias, **sem** `includeSubDomains` e **sem** `preload`: as duas coisas que não se desfazem, e o `jogo.` e outros subdomínios têm caminhos próprios). Mudar a Cloudflare para "nuvem laranja" no site para usá-la como proxy seria uma decisão maior (mexe no cache, no TLS e no que a Hostinger enxerga), que ninguém pediu; o cabeçalho no `.htaccess` resolve o que o HSTS promete.

## [2026-10-20] O portão de idade escondia o caminho: o botão que leva à conta (Claude, P227)

**Ordem:** o microfone funciona no Windows mas o Comandante não conseguiu usar nem testar no jogo. **Causa provável (reproduzida no Chrome real, não vista na tela dele):** o P211 esconde os controles da voz e o teste do microfone de convidado e de conta sem idade, e a seção só mostrava uma frase; o formulário da conta fica no fim da aba JOGO. Funcionava, mas ninguém achava o caminho. **Decisão:** um botão na própria seção, que abre a aba JOGO já no CRIAR CONTA (convidado) ou no pedido da idade (conta sem idade); o menor e quem já tem a voz não têm botão. **Conferido e descartado:** os cabeçalhos do site em produção não bloqueiam o microfone (sem `Permissions-Policy`; a CSP não afeta WebRTC). **Mantido:** convidado e conta sem idade seguem sem o teste do microfone (decisão do P211: na dúvida, sem acesso ao microfone). **Orçamento:** o botão estourou o teto de JS de partida (500,1 de 500 KB; a main já andava colada), então a seção do chat de voz (frases, botão, lista de microfones) virou **pedaço sob demanda** (`voice/VozNasConfiguracoes.ts`, 499,7 KB). A bancada achou a corrida que isso criou: dois pedidos seguidos (convidado ao abrir, menor ao restaurar a sessão) terminavam o `import()` fora de ordem e a conta de menor via a tela de convidado; agora cada pedido aplica o estado mais recente (último que ganha). As decisões "sim" do Comandante (mudo por jogador, aviso às contas antigas, idade no chat de texto, prova positiva em produção; rádio e jukebox aprovadas, construção em outra frente) seguem em PRs próprios.

## [2026-10-20] O mudo por jogador: desligar a faixa, não filtrar o áudio (Claude, P228)

**Ordem:** o risco mais próximo da voz pública (desconhecidos adultos, sem como silenciar um deles). **Decisão:** silenciar é `track.enabled = false` na faixa que chega do colega: o navegador entrega silêncio, **custo zero** (nada por quadro, nenhum nó de áudio a mais) e o indicador de quem fala some junto (a onda é silêncio). Vale para quem ainda espera o áudio do jogo, para o colega que sai e volta à voz e some ao sair da sala (os ids de lá não valem mais; **quem reconecta volta a ouvir todos**, limite assumido). O botão mora na lista de pilotos da REDE (a única lista de pessoas que o jogo tem, P216) e só aparece para quem está na voz; o desenho do botão (textos e DOM) vive no pedaço sob demanda da voz, porque o pacote de partida está colado no teto de 500 KB. **Não feito:** a denúncia (depende de para onde a queixa vai: decisão do Comandante) e o mudo dentro da partida (hoje é Esc > REDE).

## [2026-10-19] O hook confia no CI do PR depois de uma junção pura com a main (Claude, P225)

**Ordem:** economizar os 10 a 25 minutos do laço (a `main` anda durante o check, o PR fica `dirty`, junta-se a `main`, o hook refaz tudo). **Decisão:** o hook pula o check quando a junção é **pura**: o primeiro pai é uma árvore já verificada aqui, o segundo pai está na `origin/main`, e **cada arquivo que difere do primeiro pai veio inteiro do segundo (ou é `.md`)**. A combinação das metades é testada pelo CI do PR numa máquina limpa (merge-ref). **Na dúvida roda tudo:** arquivo mesclado dos dois lados (locales, `ci.yml`), primeiro pai nunca verificado, segundo pai fora da `main`, commit que não é de junção, erro do `git`. Com o Actions parado (`publicar --sem-ci`) não há quem teste a combinação, então o hook roda completo (`CYBERMECH_CHECK_COMPLETO=1`). Aplicado a junções reais de hoje: a do #412 (conflito só em docs) pula; as com conflito nos locales ou no `ci.yml` rodam. **Não feito, próximo degrau:** validar os locales mesclados (JSON válido e a união das chaves) para que também pulem, que é onde a regra ainda roda check por conflito. Por boa prática, o `bash` do Git que o teste do hook usa virou um ajudante compartilhado (`server/ajudaBash.ts`).

## [2026-10-19] Economizar o Actions removendo repetição, não sinal (Claude, P223)

**Ordem:** economizar de forma inteligente e profissional, sem miséria. **Medi antes** (235 min em um dia; 40% push na `main`, 38% check do PR, 22% etiquetas) e cortei só o que repete ou é desperdício: (1) o push na `main` pula o check quando a árvore é idêntica à do PR e o CI do PR passou nela (na dúvida roda tudo; decisão pura e testada, 6 mutações pegas; aplicada a merges reais: #405 pula, #403 roda); (2) etiquetas só ao abrir (o job de 6 s cobra 1 minuto); (3) rascunho não roda. **Não cortei** o check do PR nem o hook: é a segunda opinião de uma máquina limpa e achou dois defeitos escondidos por uma semana. Próximos degraus, se ainda apertar, estão no `DEPLOY.md`. `npm run ci:consumo` passa a mostrar o gasto e a projeção.

> **Arquivo:** as entradas com mais de dois dias moram em `.decepticons/arquivo/historico-*.md` (nada se perdeu; `npm run arquivar` move mais). Procure por busca, não leia inteiro.

## [2026-10-19] A descoberta da propriedade do Analytics exige o código de medição do CYBERMECH (Claude, P207)

**Ordem:** *"já liguei a admin api, tem como você testar?"*. Testei: o Google aceitou a chave e a Admin API respondeu, **mas a única propriedade que a conta enxerga é a "odpandroid"** (o app Android do Olho do Pai), e não a do CYBERMECH.

**Decisões:**
1. **A descoberta não pega mais "a única propriedade".** Pega a que tem um fluxo web com o código de medição do jogo (`G-2CCHDCEC7X`, o mesmo do `client/index.html`; um teste confere que servidor, site e jogo não se separam). Com a regra antiga, o `/metricas/` teria mostrado os números do app Android como se fossem do jogo: **o pior defeito de um painel é mostrar um número errado com cara de certo.**
2. **Propriedade errada é um estado dito, não um erro mudo:** "a conta só enxerga outra(s) propriedade(s) (odpandroid)", com os nomes e o caminho do conserto. Zero relatórios são pedidos à propriedade errada (o teste conta).
3. **Escrever o ID em `ga-propriedade.txt` continua valendo sem conferir** (decisão do dono, que pode querer olhar outra propriedade), e o código de medição pode vir da variável `CYBERMECH_GA_MEDICAO`. Duas propriedades com o mesmo código: ambíguo, não chuta.

> **Arquivo:** as entradas com mais de dois dias moram em `.decepticons/arquivo/historico-*.md` (nada se perdeu; `npm run arquivar` move mais). Procure por busca, não leia inteiro.

## [2026-10-19] O mapa da Praça dos Três Poderes: dados no pacote, desenho sob demanda, restrito (Claude, P217)

**Decisões:**
1. **O layout é dado puro e minúsculo; o desenho e os colisores são sob demanda.** O pacote de partida está em 497 KB de 500 (R7): só os pontos de nascimento, a capacidade e os limites (`PracaLayout.ts`) moram nele; `PracaMapa.ts` (1,3 KB gzip) baixa para quem abre o mapa, como a Amazônia. O servidor também o carrega sob demanda (`carregarMapaSeFor`, etapa O1).
2. **Os nomes dos prédios são os dos poderes** (LEGISLATIVO, EXECUTIVO, JUDICIÁRIO): a proposta da ficha (pergunta 1). É a escolha que não cita instituição nem pessoa; fica **aguardando o Comandante**, e trocar é uma linha em `PRACA_PREDIOS`.
3. **Os colisores são caixas; o redondo (cúpula e tigela) é só desenho** sobre um volume sólido: a física do jogo só tem caixas e o Mech esbarra no volume, não na curva. Abaixo de 310 colisores (o teto do Bunker, travado por teste).
4. **A rampa do Congresso é jogo, não enfeite:** sobe da Esplanada à laje (5 m) e é por onde a multidão e o jogador sobem ao telhado; um teste sobe a rampa com um Mech de verdade (a primeira versão tinha o giro invertido e o teste de altura da laje caía dentro de um volume: o teste achou os dois).
5. **A fonte da multidão é do mapa** (ônibus, bueiros, lixeiras com posição fixa): o cronograma (semente e tick, `sim/Multidao.ts`) diz quando cada uma despeja. A demonstração da multidão já usa as do mapa de verdade.
6. **Nasce restrito (`mapa:janeiro`):** ninguém vê o 8 DE JANEIRO até o Comandante liberar no painel de visibilidade; é a rede de segurança da ficha (§ 9), e a missão ainda não existe.
7. **O mapa abre só o Deathmatch por enquanto:** a Sobrevivência (a missão da ficha) cai na Cidade Neon até o passo 5; o CTF e o Domínio ficam nas etapas O2 e O3 do online (P218).

## [2026-10-19] Processo leve: rigor proporcional ao risco, e o CI vermelho (Claude, P220)

**Ordem:** as iterações estavam grandes demais ("overengineered?"); pediu as 5 regras para o processo ficar mais leve e que olhasse o GitHub vermelho.

**Decisões:**
1. **Regra 19 no `AGENTS.md`** (a fonte única): risco alto leva servidor + teste + até 8 mutações + 1 bancada; risco baixo só o teste de sempre; sem suíte inteira à mão antes do push; cada fato escrito uma vez; um pedido = o menor PR. A causa medida no P211: 61 arquivos e ~1.260 linhas para "perguntar a idade", 32 mutações (todas morreram de primeira, não acharam nada), 5 bancadas e 4 pushes de ~15 min.
2. **O hook não repete o check na mesma árvore** (`.githooks/pre-push`, cache em `.tmp/check-ok/<árvore>`). Só vale com a árvore limpa e igual à do `HEAD`, para nunca pular um check que não olhou o que sobe; check que falha não guarda nada; só apagar branch remoto não roda check (antes rodava o check inteiro). 8 testes e 3 mutações na borda.
3. **O CI está vivo de novo (e tinha DUAS causas vermelhas, uma atrás da outra)** (a cota do mês voltou: as execuções de hoje rodam 2 a 3 min, não os 2 s da época da cobrança) e estava **vermelho por um teste só**: `estudio-vozes` esperava 400 e recebia 503, porque o servidor do Estúdio checava o `ffmpeg` **antes** de validar o pedido, e o runner não tem `ffmpeg`. Agora o pedido errado é 400 em qualquer máquina. Lição: teste que depende de ferramenta da máquina do autor passa só nela. **A segunda, atrás dessa (o `npm run check` para no primeiro erro): o smoke.** O jogo aberto em `localhost` procura o servidor em `localhost:2567` e pergunta o `/status`; nesta máquina há o servidor de produção ali (passava), no runner não há (`ERR_CONNECTION_REFUSED` no console, e o smoke reprova qualquer `console.error`). O smoke agora **recusa essa porta de propósito** (vale igual em toda máquina), ignora só essa recusa esperada e mostra a URL de qualquer outro erro (a mensagem do CI não dizia qual recurso falhou e custou uma investigação). Reproduzido antes de consertar (mesma mensagem, `@ http://localhost:2567/status`). Uma falha isolada do smoke local na primeira rodada não reapareceu em 4 seguintes (boot de 7 a 18 s conforme a carga); causa não identificada.

**Risco assumido:** o CI gasta minutos medidos (repositório privado, ~2.000/mês): com ele vivo, push repetido gasta a cota e pode pará-lo de novo. A regra 19c e o `concurrency` do workflow ajudam; se a cota acabar de novo, o caminho continua sendo `publicar --sem-ci` (P105). Nunca pagar.

## [2026-10-19] O e-mail do "esqueci a senha" pelo SMTP da Hostinger, sem serviço novo (Claude, P206)

**Ordem:** *"não entendi o que devo fazer. como configuro o Resend também?"* (depois de a Cloudflare perguntar que "chave" guardar). **Regra do Comandante:** simples, sem custo inicial, sem cadastro novo (memória "preferir simples, sem custo, eficiente").

**Decisões:**
1. **O Resend deixa de ser o caminho recomendado.** Pede conta nova, verificar o domínio (registros DNS na Cloudflare) e uma chave: exatamente o que o Comandante não entendeu e não precisa. Conferi no DNS: o `cybermech.online` **já tem o e-mail da Hostinger** (MX `mx1/mx2.hostinger.com` e SPF `include:_spf.mail.hostinger.com`). Basta uma caixa `nao-responda@cybermech.online` e a senha dela. O Resend fica como plano B, no mesmo contrato (`Mailer`).
2. **Cliente SMTP escrito à mão (~100 linhas, `node:tls`), sem biblioteca.** O `nodemailer` traz uma dependência a mais para o `npm ci` do atualizador, que já tropeçou em binários presos pelo servidor no ar (DEPLOY § 4). Só TLS direto na porta 465 (a da Hostinger): o STARTTLS (587) não entrou porque ninguém precisa dele aqui e é mais um caminho para errar.
3. **O Comandante não escreve JSON:** `npm run email -- iniciar` cria o `email.json` com a Hostinger preenchida e uma senha de exemplo que **nunca vale**; ele só troca no Bloco de Notas. `testar` manda de verdade e traduz o erro em "o que conferir".
4. **O servidor relê o arquivo quando muda** (pelo conteúdo: a data e o tamanho enganam, `COLE_A_SENHA_AQUI` e uma senha de 17 caracteres têm o mesmo tamanho): ligar o e-mail por arquivo não pode exigir reiniciar, e reiniciar derruba quem joga.
5. **Provado contra um servidor SMTP de mentira de verdade (um socket que fala o protocolo)**, não só com mocks: AUTH PLAIN e LOGIN, texto e HTML em japonês/russo/espanhol chegam inteiros, senha recusada, destinatário recusado, servidor mudo, porta fechada, e injeção de cabeçalho (destinatário com quebra de linha ou vírgula nem abre conexão; assunto com quebra vira texto). **O que não está provado: a Hostinger de verdade** (falta a caixa e a senha, que são do Comandante).
6. **A política publicada passou a citar a Hostinger no lugar do Resend** (o e-mail de quem pede "esqueci a senha" é entregue por ela): mesmo conjunto de dados, só o nome do prestador; por isso a `POLITICA_VERSAO` não mudou. Se o Resend entrar um dia, o texto muda junto.

## [2026-10-19] A multidão é módulo puro com modo espelho, medida antes do desenho (Claude, P217 e P219)

**Decisões:**
1. **Simulação antes do desenho:** o número decide se a ideia da ficha (posição como função do tempo) aguenta. Deu **0,043 ms por tick**, seis vezes abaixo da conta de bolso e sete abaixo do teto: o desenho pode seguir sem redesenhar a simulação.
2. **Dois modos no mesmo código:** a *autoridade* (servidor e jogo offline) decide tiro, explosão e susto; o *espelho* (cliente online) só aplica `morreu` e `fugiu`. O que sai do tempo (chegar, fugir ao fim da estadia, sair) é igual nos dois, então a rede não carrega posição.
3. **O balanço do andar é um gingado, não um tremor:** a primeira versão balançava mais depressa do que o figurante andava (o teste de continuidade pegou); amplitude 0,18 m e período de 90 a 130 ticks.
4. **O seno é por parábolas, não `Math.sin`:** só `+ − × ÷`, `floor` e `sqrt`, exatos no IEEE-754; servidor e cliente chegam no mesmo número em qualquer navegador.
6. **O desenho é o da gente da praia, com a posição na shader:** nenhum CPU por figurante por quadro, e a mesma conta da simulação em GLSL (a multidão desenhada e a simulada nunca divergem). O `PraiaGente.ts` foi o modelo.
7. **A GPU real achou o que o SwiftShader não vê:** o limite de **16 atributos por vértice** (o shader com 17 não compilava e a multidão sumia sem erro no smoke). As cores viraram um atributo só (RGB empacotado em float: 24 bits cabem exatos) e o teste agora trava a conta. É a segunda vez que "só a GPU real vê" (a primeira foi o NaN da praia, P130): a bancada de GPU entra no roteiro de todo efeito novo.
8. **As vagas de instância:** o custo na GPU tem de seguir quem está **presente** e não quem nasceu (350 mil triângulos no fim da fase contra 182 mil). Cada figurante ganha uma vaga ao nascer e a devolve ao cair (depois do tombo) ou sair; a contagem desenhada é a marca d'água; só o trecho de buffer alterado vai à GPU (`addUpdateRange`).
9. **Honestidade sobre o teto:** a ficha pôs ≤ 80 mil triângulos; o desenho chegou a 182 mil. **Não ajustei o teto para caber:** o critério que decide (o quadro de 60 fps na GPU integrada) foi atingido, mas com folga pequena, e a ficha agora diz as duas coisas. O caminho é o impostor de longe e menos caixas por figurante.
5. **Os androides rebeldes ficam de fora do vetor:** são os `Android` que o jogo já tem (vida, tiro, rede); a multidão só agenda a chegada deles.

## [2026-10-19] A idade manda na voz: só maior de 18 anos, e o servidor decide (Claude, P211)

**Ordem:** perguntar a idade no cadastro; menores de 18 anos sem o microfone e sem os áudios dos outros jogadores, só o áudio do jogo.

**Decisões:**
1. **Mês e ano de nascimento, sem o dia.** É o mínimo que decide a maioridade e o jogo guarda um dado a menos (LGPD, minimização). O servidor devolve só a faixa (`adulto`, `menor`, `sem-idade`), nunca a data.
2. **Maioridade conservadora pelo mês:** adulto se passaram **mais de 18 anos completos** (`hoje − nasceu > 18*12` meses). Quem faz 18 **neste mês** ainda não é: o dia não se sabe e, na dúvida, a voz não abre. A regra mora em `shared/net/auth.ts` (`ehMaiorDeIdade`), com teste das fronteiras.
3. **O servidor decide, o cliente só poupa a viagem.** O `PRONTO` da voz passou a levar o token da sessão (até 200 bytes; sem mudar o `PROTOCOL_VERSION`, a voz está fora da faixa de jogo) e o relé chama o `autorizar` que a sala recebe do servidor. **Padrão negar:** sem autorizador, ninguém entra. Provado com um cliente adulterado (token de menor, ou nenhum). Quem já estava e perde a autorização (sessão vencida) **sai**.
4. **Convidado e conta sem idade também ficam de fora** (não só o menor): a regra é "só quem provou ser adulto", o que fecha o buraco de entrar sem conta. Custa o convidado adulto não ter voz até criar conta; é a leitura segura da ordem, e o Comandante pode afrouxar.
5. **A data não muda** (`UPDATE … WHERE nascimento IS NULL`, 409 na segunda vez): uma conta de menor não vira adulta com um clique. Quem errou fala pelo contato da política.
6. **Cadastro: a tela exige, o servidor aceita sem.** Um cliente velho cria a conta "sem idade" (sem voz) e informa depois; recusar o cadastro por falta da data quebraria quem está com o jogo aberto na versão anterior.
7. **O formulário da conta virou pedaço sob demanda** e a sessão é restaurada pelo próprio jogo na abertura: a voz precisa da idade antes de a tela existir, e o JS de partida estava a 3 KB do teto de 500 KB.
8. **A política mudou de versão (`2026-10-19.2`)** e a data "em vigor" lê só o prefixo `AAAA-MM-DD`. O `split('-')` antigo daria dia e mês errados com o sufixo `.2`: corrigido e coberto por teste (`server/politicaDeVoz.test.ts`).
9. **Limite assumido, e dito à pessoa e ao Comandante:** a idade é **declarada**, não verificada. Verificar de fato exige documento ou terceiro (custo e dado sensível), contra o pedido de ser simples e sem custo.

**Provas:** Chrome real 30/30 (`medicoes/voz-idade.mjs`), 3.569 testes, 32 mutações à mão pegas. As bancadas de voz antigas passaram a entrar com conta de adulto (`vozLib.tokenDeConta`).

## [2026-10-19] O chat de texto é mensagem direta, repassada pelo servidor sem guardar nada, e nasce restrito (Claude, P216)

**Ordem:** *"nomes dos jogadores… ver o hangar deles, fazer chat por texto com eles (sem sair do hangar)"*.

**Decisões:**
1. **Mensagem direta, não canal da sala:** o pedido é conversar com o piloto que se clicou; um canal aberto dobra o que moderar. Dois tipos novos (33 e 34), acima da voz (30 a 32), **sem subir o protocolo**: servidor velho descarta, cliente velho nunca recebe.
2. **O servidor só repassa:** troca o remetente pelo id de verdade (ninguém se passa por outro), manda o texto **que ele limpou** (sem controle, sem inversão de direção, 160 caracteres), só a pessoas da sala, **6 por 10 s por jogador**, e **não guarda nada** (sem histórico em disco: nada para vazar, nada para a LGPD).
3. **Silenciar é do cliente:** sem silêncio do lado do servidor não há estado a manter; quem silencia deixa de receber, sem avisar o outro.
4. **Nasce restrito (`tela:chat`):** a voz foi liberada ao público sem mudo nem denúncia e ficou como risco aberto (P205); o texto repete o risco, e o painel de visibilidade existe para isto: o Comandante liberta quando achar que está pronto.
5. **A visita ao Hangar é só leitura, no mesmo Hangar:** reaproveita o galpão 3D e os painéis (nada de uma segunda tela de montagem); as ações que mudariam o rascunho ficam travadas em um ponto só (`soOlhar`). A conversa é um pedaço sob demanda (R7); o dado, minúsculo, mora no jogo para a mensagem que chega com a tela fechada não se perder.

## [2026-10-19] O teste do microfone, o "sozinho na voz" e a jukebox só com catálogo (Claude, P212 e P213)

**Ordem:** o microfone testado e sem som, só maiores de 18 na voz, e a jukebox do prédio com link do YouTube, "só se não pesar".

**Decisões:**
0. **O gate do push passou a respeitar o teto de memória virtual do Windows.** Dois pushes seguidos foram barrados por workers do Vitest mortos (`0xC0000409`, `0x80000003`) em arquivos sem relação com o PR (combate): a memória virtual livre estava em 1,6 a 2 GB de 24, porque **seis sessões do Claude Code abertas mantinham 48 processos node dos servidores MCP da Hostinger (3,1 GB comprometidos)**. Os processos têm pai vivo (são das outras sessões do dono): **não os matei**. O `npm test` agora lê a memória virtual livre (PowerShell, ~0,6 s, só no Windows) e usa **1 worker** quando ela aperta; `CYBERMECH_WORKERS=N` força. 6 mutações pegas. Não contornei o hook (`--no-verify`): ele fez o trabalho dele.
1. **O "não saiu som" tem causa provável e dois remédios.** Sozinho na sala ninguém te ouve; o indicador dizia "MICROFONE ABERTO" sem avisar. O aviso de **sozinho** corrige o engano; o **painel de teste** (nível ao vivo, volta da voz, motivo de cada falha) dá ao jogador a prova que o chat não pode dar.
2. **O teste usa as mesmas restrições do jogo** (eco, ruído, ganho automático): é o que o chat vai ouvir. Pedaço sob demanda; **para sozinho** ao fechar, trocar de aba, esconder a página e em 2 minutos: microfone aberto esquecido é o pior defeito possível aqui.
3. **O aparelho escolhido vale para o chat** e troca no meio da voz sem renegociar. `ideal`, não `exact`: o aparelho salvo que foi desligado cai no padrão.
4. **Jukebox: YouTube fora, catálogo dentro.** O player oficial tem de ficar visível e não separa o áudio, traz vídeo (pesa), não toca no espaço, leva o IP de todos ao Google; um mp3 de qualquer site leva o IP ao dono do endereço. O terminal oferece **o catálogo que nós hospedamos** e **"Sugerir um link"** (só chega ao Comandante). **Confirmar o texto vigente das regras do YouTube** antes de qualquer plano com ele.
5. **A condição do Comandante virou critério:** "só se não pesar" = a bancada mede menos de 1 ms de JS por quadro e no máximo 8 KB/s por emissor **antes** de mesclar a E1.
6. **O servidor decide a jukebox** (catálogo, a até 4 m do terminal, uma troca a cada 20 s): é regra de gameplay (G14).
7. **P211 não entrou neste PR de propósito:** mexe em contas, banco, relé do servidor e política, e merece o seu próprio PR e as suas provas; enquanto isso a voz fica como está e o Comandante tem a chave no painel.

## [2026-10-19] O robô de outra pessoa é o chassi da montagem dela, montado numa função pura (Claude, P214)

**Ordem:** *"o outro jogador sempre me vê como vector 9 amarelo… precisamos melhorar isso"*.

**Decisões:**
1. **A causa estava no desenho, não na rede:** o roster já levava a montagem (`build`) de cada pessoa; o `makeRemote` do `Game` ignorava o chassi. Extraí para `net/remotoDoRoster.ts` (função pura: recebe a entrada do roster e uma função que entrega a malha pronta) para **testar sem abrir o jogo inteiro**; o `Game` só liga.
2. **Os números do chassi também:** o remoto leva `CHASSIS[chassi]` (tamanho e colisão), não os do Vector-09; o servidor é a autoridade (G13) e já usava os números do chassi; agora o corpo desenhado no outro navegador tem o mesmo tamanho.
3. **Malha que ainda baixa não trava e não fica errada para sempre:** entra a silhueta do chassi e o robô é refeito quando a malha chega (`refazerRemoto`), em vez de esperar a próxima mudança do roster.
4. **A janela do dono abre por cima da do servidor:** `.vis-modal` com `z-index` 2100 (a do servidor é 2000); janela de ferramenta do dono nunca nasce atrás de outra.

## [2026-10-19] A política de privacidade descreve o chat de voz, que já estava público (Claude, P205)

**O que aconteceu:** o Comandante liberou `tela:voz` no painel de visibilidade sem que a política tivesse mudado; eu tinha avisado (VOICE_CHAT.md § 4) que ela precisava mudar antes.

**Decisões:**
1. **Atualizei sem esperar nova ordem.** A voz já estava pública e a lacuna era minha pendência declarada; a liberação em si é do Comandante e não mexi nela.
2. **O texto diz o que o código faz:** os outros jogadores da sala podem ver o IP (a conexão é direta), o STUN do Google o recebe, o áudio nunca passa pelo nosso servidor e nada é gravado. Não prometi nada que o código não cumpra.
3. **`POLITICA_VERSAO` = `2026-10-19`:** a regra do projeto é mudar a data junto com o texto; quem criar conta aceita a versão nova. O texto continua **rascunho a revisar**, não parecer jurídico.
4. **Um teste que renderiza a página de verdade** (`server/politicaDeVoz.test.ts`) e uma data-piso (`2026-10-19`): a política não pode voltar a ser anterior à voz.
5. **Dito, não escondido:** a política promete avisar no jogo as mudanças que afetem contas existentes e esse aviso não existe; e a voz está aberta a convidados sem conta (menores), sem mudo por jogador nem denúncia.

## [2026-10-19] A voz no celular: um botão na tela, e a rádio como emissores do mundo (Claude, P209 e P210)

**Ordem:** *"jogadores usando celular vão conseguir ouvir e falar automaticamente no voice chat? como vai ser pra apertar o ptt se o celular é limitado de botões? quero maximizar a experiência dos usuários e facilitar o voice chat"* e a visão da música, rádio e autofalantes no mundo.

**Decisões:**
1. **Um botão só, na coluna do polegar direito** (sob PAUSA e PLACAR), que faz o que a tecla T faz: tocar alterna o mudo, no modo "segurar" vale com o dedo. Não mexi nos botões de combate nem criei gesto novo: o celular tem poucos botões e os do combate já ocupam o arco do polegar.
2. **O botão vive no HUD da voz** (o pedaço sob demanda), não no `TouchControls`: a voz continua um módulo à parte (G3) e quem não a usa não baixa nada. O CSS o mostra só no modo toque, ao lado da camada de toque e **acima** dela.
3. **Sem microfone, tocar só o pede de novo** (não alterna o mudo): o teste achou que o mesmo toque ligava o mudo e o microfone nascia mudo. A tecla do desktop passou a usar o mesmo caminho (`VoiceChat.aoBotao`).
4. **O texto do toque não cita tecla** ("MICROFONE ABERTO", "MUDO", "SEGURE O BOTÃO PARA FALAR"); o indicador subiu para cima do direcional.
5. **iPhone não foi provado** e está dito: a prova é um Chrome emulado com toque de verdade. O plano B (tocar o fluxo num `<audio>`, sem o espacial) só se justifica depois de um teste num aparelho real; não escrevi código às cegas.
6. **A rádio (P210) virou desenho, não código**, porque depende de decisões do Comandante que não são técnicas (de onde vem a música, direitos). O que ele descreveu se resolve com **emissores no mundo** e uma **programação sincronizada pelo relógio** (sem servidor, sem custo); a música do PC do jogador é o caso pior (computador só, upload × ouvintes, direitos, privacidade): **recomendei não**.
7. **As bancadas de voz** passaram a gerar o arquivo do microfone falso por um módulo comum (`vozLib.mjs`): o tom ficava só na pasta de uma worktree que já tinha sido removida.

## [2026-10-19] As permissões dos agentes: lista fechada e uma trava no check, em vez de reclamar de novo (Claude, P208)

**Ordem:** *"aperte, autorizado sim, resolva esses alerta das permissoes ao qwen. toda hora vc reclama disso e nao resolve!"*

**Decisões:**
1. **Resolver na raiz, não só no arquivo.** Tirar as linhas resolvia o alerta de hoje e o próximo agente o alargava de novo; por isso a regra virou **teste do `npm run check`** (`permissoesDosAgentes.test.ts`): interpretador com coringa, `git *` e os verbos do git que apagam, mudam ou **executam** (`fetch --upload-pack`, `config alias.x=!cmd`, `rebase --exec`) reprovam em qualquer arquivo de permissões.
2. **Envoltório conta como o que ele envolve.** `timeout *` (que estava no padrão desde o começo) executa qualquer comando tanto quanto `powershell *`; saiu, e entrou `timeout 600 npm run *`, que vale o que `npm run *` já valia.
3. **Lista fechada para o Qwen.** Acrescentar permissão passa a ser uma edição visível (arquivo e lista no mesmo PR), com o porquê aqui no histórico. O que ele precisa e não tem, ele **pede**.
4. **A única exceção é do Comandante:** `git push:*` no `.claude/settings.json`, por texto exato e só nesse arquivo (o `publicar` empurra o branch do Claude).
5. **O arquivo alargado não foi apagado em silêncio:** cópia em `.tmp/qwen-settings-local-widened-19-10.json`. A edição era local e sem commit; o Qwen que a quiser de volta pede a permissão específica.
6. **Residual dito, não escondido:** `rmdir *`, `git worktree *`, `git commit *`, `git add *` e `npm run *` seguem porque o fluxo do `AGENTS.md` (worktree por tarefa, junção de `node_modules`) depende deles. `AGENTS.md`: regra 18 nova.
7. **Números das ordens:** P208 a P210 (P206 e P207 eram de outras sessões); a mesma mensagem trouxe a voz no celular (P209) e a rádio do mundo (P210).

## [2026-10-18] O Google Analytics no /metricas/: conta de serviço assinada à mão, tudo em cache e nunca esperar o Google (Claude, P207)

**Ordem:** *"ligue o metricas, quero tudo devidamente configurado na melhor e mais técnica estrutura"*.

**Decisões:**
1. **Sem biblioteca do Google.** Assinar um JWT RS256 e fazer duas chamadas HTTPS cabe em ~200 linhas com `node:crypto` e `fetch`; o SDK `googleapis` traz centenas de pacotes para o servidor que roda num PC de 6 GB (e entra no `npm audit`). O teste confere a assinatura com a chave pública, então um erro de assinatura aparece aqui e não só no Google.
2. **O servidor fala com o Google; a página nunca.** A chave nunca vai ao navegador, e a página só desenha o estado que o servidor entrega (cada estado com a frase de "o que falta e onde").
3. **Cache e teto de espera.** 10 min de cache (a Data API tem cota diária; ninguém precisa de segundo a segundo), 2 min depois de erro (não martelar), pedidos simultâneos juntos, e 4 s de espera máxima na primeira resposta: **o `/metricas` é a página que o Comandante abre quando algo está errado, e não pode ficar presa num Google lento.**
4. **Só somas por categoria** (data, canal, país, aparelho). A política diz que não guardamos pessoa; o Analytics já é do Google e só enxerga quem aceitou os cookies, e a página diz isso. Nada de cidade, página ou usuário.
5. **ID da propriedade com três caminhos** (arquivo, variável, descoberta se houver uma só) porque o Comandante mandou o `client_id` da conta de serviço no lugar do ID da propriedade (os dois são numéricos, o dele tem 21 dígitos): o código **valida** (5 a 15 dígitos) em vez de confiar, já que o ID entra no endereço do Google; e a descoberta evita pedir o número de novo.
6. **Os arquivos são relidos** (não só na subida): colocar o `ga-propriedade.txt` vale em 30 s, sem reiniciar o servidor (e sem derrubar quem joga).

## [2026-10-18] "Esqueci a senha": link de uso único por e-mail, página própria, sem entrar sozinho (Claude, P206)

**Ordem:** *"faça o esqueci a senha; não vamos dar CNPJ por enquanto pois não temos e o jogo é indie, feito por uma pessoa apenas"*.

**Decisões:**
1. **Resposta igual e antes do trabalho.** O pedido devolve 202 sempre e só depois consulta o banco e envia; a diferença de tempo entre "tem conta" e "não tem" era o jeito mais barato de descobrir e-mails cadastrados. Com limites por IP, por conta e por dia, porque "esqueci a senha" é a rota que um script usa para encher a caixa de alguém e a cota do provedor.
2. **O token vai no fragmento (`#`), não na pergunta (`?`).** O fragmento não é enviado ao servidor nem no Referer: não cai no log da Cloudflare, da Hostinger nem do jogo. A página o tira da barra de endereço ao abrir.
3. **O banco guarda só a impressão digital** (SHA-256, como as sessões). Quem lê o banco ou um backup não consegue usar um link vivo.
4. **Trocar a senha encerra todas as sessões** da conta: quem tinha a senha velha, ou uma sessão esquecida em outro aparelho, perde o acesso. **E não entra sozinho:** voltar ao jogo e digitar a senha nova é um passo a mais que custa 10 s e evita que um link vazado vire uma sessão pronta.
5. **Página estática própria (`/redefinir/`) em vez de abrir o jogo:** o link chega num e-mail e o jogo é um carregamento de 3D; a página é leve, sem Google nem cookies (carrega um segredo) e funciona em celular. A senha e o token vão no corpo do POST, nunca na URL.
6. **Provedor de e-mail atrás de uma interface** (`Mailer`): o Resend hoje (grátis, uma chamada HTTPS, sem biblioteca nova), outro amanhã sem mexer no resto. **Sem chave, não finge:** o servidor responde 503 e o jogo diz para pedir ajuda; o `npm run admin -- link-senha` cobre o intervalo.
7. **Sem CNPJ, a política diz a verdade:** o controlador é uma pessoa física que desenvolve o jogo de forma independente. O que a LGPD ainda pede, o nome do encarregado, ficou para o Comandante decidir. Resend entra como destinatário (Estados Unidos). A `POLITICA_VERSAO` **não mudou** (mesmo dia, 18/10): a mudança só acrescenta um recurso que envia e-mail apenas a quem o pede; contas criadas antes da mudança não aceitaram essa linha, e isto está dito para a revisão do texto.
8. **Não feito:** o e-mail de aviso "sua senha foi trocada" (entra com o envio ligado).

## [2026-10-18] O chat de voz: direto entre os jogadores, sem custo, restrito até o Comandante soltar (Claude, P205)

**Ordem:** *"prossiga com o VOICE CHAT PLANO DE IMPLEMENTAÇÃO!"* (o plano trazia as decisões do Comandante: microfone aberto + apertar-para-falar, áudio espacial, canais ALL + TEAM, TURN a critério técnico) e *"quero q seja simples, sem custo inicial e eficiente"*.

**Decisões:**
1. **WebRTC em malha, o servidor só sinaliza.** O áudio nunca passa pelo servidor do jogo: zero banda e zero CPU dele, e a voz fica fora do teto de 8 KB/s do jogo (G11). Serve para a sala de 8; SFU só se salas com mais de 5 falando virarem comuns.
2. **Sem TURN (custo inicial zero).** Só o STUN do Google. O preço, dito: quem tem rede que barra a conexão direta fica sem voz (o plano estima ~15%, **não medido**). TURN próprio (`coturn`) só se um jogador real reclamar.
3. **Sinalização enxuta:** o SDP sai já com os endereços (sem um candidato por mensagem): **uma oferta e uma resposta por par**, três tipos de mensagem (30–32, o plano tinha seis). O **servidor troca o remetente** em vez de validá-lo. O relé só confere a forma (`v=0`, 3 KB, tipo) e tem teto por jogador.
4. **Tamanho de mensagem:** o `ws` aceita 3075 bytes **só para a voz**; mensagem de jogo acima de 1 KB continua derrubando a conexão (G7). Um SDP passa de 1 KB e o plano não via isso.
5. **DTX explícito:** o plano supunha silêncio a ~0 kbps "pelo Opus"; o Chrome **não liga o DTX sozinho**. O SDP leva `usedtx=1;useinbandfec=1;maxaveragebitrate=24000` e a bancada **mede** o efeito (50 pacotes/s falando, ~5 calado).
6. **`equalpower` em vez de HRTF** (custo em GPU e CPU integradas, G12) e queda **linear** até 160 m (o "inverse" do plano nunca silencia).
7. **Canal TIME fora desta entrega:** o protocolo online não tem time (`allies: false`); entra junto com os times online. **Uma tecla só** (T): segura no PTT, alterna o mudo no modo aberto (com o mouse travado não dá para clicar).
8. **Nasce restrita** (`tela:voz`, a regra do P191) e a **política de privacidade muda antes de liberar** (a voz expõe o IP aos outros jogadores e ao STUN do Google): não mexi no texto legal agora porque ninguém do público usa a voz e o texto é rascunho do Comandante revisar; deixei o texto pronto em `VOICE_CHAT.md`.
9. **Número da ordem:** o plano dizia P158 (já tomado há dias) e outra sessão tomou P204 durante o trabalho; esta é a **P205** (a regra de conferir a `origin/main` antes do push valeu de novo).
10. **`AGENTS.md`:** o mapa ganhou `voice/`, `server/voz.ts` e `shared/net/voz.ts`, e o Passo Zero a linha do chat de voz.

## [2026-10-18] O servidor avisa antes de reiniciar, e o jogo insiste por 10 minutos (Claude, P204)

**Ordem:** *"será que temos que adicionar uma imagem dizendo que estamos reiniciando o servidor ou em manutenção… com um contador na tela… se for reinício, dizer que volta em 1 ou 2 minutos? ou potencialmente mais?"*

**Decisões:**
1. **Avisar com 10 s de antecedência, só se há gente na sala.** Cada deploy reinicia o servidor (até commit de documento) e já havia jogador real do outro lado; 10 s dão tempo de terminar um tiro, e sala vazia não espera nada. A atualização automática espera até 25 s a porta liberar (`parar-servidor.ps1`), então os 10 s cabem.
2. **"Volta em cerca de 1 minuto"** (60 s), porque medi **16, 23, 28 e 50 s** entre "pedindo reinício" e "religou" hoje; **se passar, a tela diz "demorando mais que o previsto" e continua tentando** em vez de inventar um número maior. Prometer 2 minutos para um reinício de 20 s ensina o jogador a desconfiar do aviso.
3. **Sem mudar o protocolo:** o aviso é uma mensagem nova que cliente antigo ignora, e o corte usa o código de fechamento 4010 com o tempo no motivo. Uma página velha em cache continua jogando; só não vê o contador.
4. **A insistência longa só vale para quem já entrou numa sala** (10 min, a cada 5 s). Quem abre o link com o servidor desligado volta ao offline em ~19 s como antes, em vez de ficar preso numa tela de espera.
5. **Queda sem aviso não tem previsão e a tela diz isso** ("sem previsão de volta"), com o tempo fora subindo e, depois de 30 s, o jogo offline à mão. Não chutar um prazo que ninguém sabe.
6. **Não feito:** manutenção agendada escrita pelo dono e aviso na landing (a landing é estática na Hostinger e não conhece o estado do servidor).

## [2026-10-18] Arquivar os documentos vivos, o monitor da Cloudflare e o servidor que ainda fica (Claude, P203)

**Ordem:** *"ARQUIVAR… é gratuito mesmo? se vc for no serafim13, BATBOT… veja se nosso sistema de avisos pelo telegram já não é melhor que uptime robot… bora limpar pra tornar mais leve… sera que compensa formatar [o PC velho]… ou logo teremos que pagar um servidor vps?"*

**Decisões:**
1. **Arquivar por data, sem reescrever:** o que tem mais de dois dias sai do `ESTADO_ATUAL` e do `HISTORICO` **tal e qual** para `.decepticons/arquivo/` (quinzena); o painel lê os dois lugares. Uma ferramenta com teste (`npm run arquivar`), não um corte à mão, para qualquer agente repetir. **A `ORDENS` não foi arquivada:** a maior parte é das últimas 48 h; a regra nova é a linha curta (~600 caracteres).
2. **Os títulos fora do formato (`## 06/10 — Codex: …`) seguem a entrada de colchetes anterior**, porque o painel só separa entradas pelo `## [`; senão a contagem de pedidos mudaria (o teste pegou isso na primeira execução).
3. **Monitor: o alerta de túnel da Cloudflare**, não o Telegram do serafim13 (o watchdog roda a cada 6 h, pelo GitHub Actions, sem pagamento no repositório do jogo) e não o UptimeRobot como primeira escolha (o Telegram dele é pago e o plano grátis é não comercial pelos termos de terceiros). Cobre PC desligado, internet fora e túnel parado; **não cobre** o processo do servidor morrer com o túnel de pé (o UptimeRobot em `/status` cobriria, como segunda camada).
4. **Servidor: não migrar agora.** Uma VPS pequena (1 vCPU, 4 GB) custa cerca de R$ 25 a 48 por mês e resolve A1 e A13 juntas, mas obriga a reescrever o atualizador (hoje feito para Windows); o PC velho serve se tiver 4 GB, disco SSD e cabo de rede, e copia o que já existe. Com um jogador de teste e a conexão fluindo, o ganho não paga o trabalho. **Gatilho para migrar:** jogadores simultâneos de verdade (20 a 30 seguidos) ou a primeira queda por memória.

## [2026-10-18] As regras dos bots online são do dono, no painel; o padrão online é de iniciante (Claude, P201 e P202)

**Ordem:** *"MUITO DIFÍCIL os bots inimigos… pressão adversária… controlar esse tipo de coisa através do painel admin que só eu tenho"*.

**Decisões:**
1. **A causa estava no código, não no gosto:** a sala online não aplicava o limite de atacantes. Corrigir o padrão (iniciante: fácil, 2 Mechs, 1 andróide, 1,5 atacantes) **e** dar o controle ao dono: o próximo teste pode pedir o contrário.
2. **As regras moram no servidor, não no jogador:** é a autoridade da sala (G13). O painel só as lê e as grava, pela porta que já exige a chave do dono ou uma conta admin (a mesma régua de erros por IP). **Nenhum papel novo de "superadmin":** o `is_admin` que já existe é o dono.
3. **Aplica ao vivo onde dá:** dificuldade, pressão e número de Mechs trocam na sala de pé; os andróides só nas salas novas (a sala não cria nem remove corpo no meio da partida: G4/G5). Dizer isso na tela é melhor do que fingir que vale tudo na hora.
4. **Três receitas de um clique** (INICIANTE, PADRÃO, DESAFIO): o dono está testando com gente de verdade e quer trocar de postura sem pensar em quatro números.
5. **O alarme do painel é o de quem opera:** "PROBLEMA" com 0 jogadores, por causa do PC saturado, levou o dono a duvidar do servidor. Sem gente jogando, o atraso do laço é aviso e a dica diz de quem é a culpa.

## [2026-10-18] As pendências do lançamento: o que o Comandante decidiu e o que ficou com ele (Claude, P199 e P200)

**Ordem:** *"por enquanto vamos manter assim… email é volkov@serafimweb.com… me passe as orientações pra enviar ao cloudflare… me ensine como criar a chave… temos que sempre manter limpo tudo… conclua as pendências. não precisa ficar procurando problema ou inventando mais trabalho"*.

**Decisões:**
1. **A1 mantido:** o servidor segue no PC de trabalho até o Comandante terminar o jogo; o risco é dele e está dito em `AUDITORIA_SEGURANCA.md` (A1). As travas de hoje (porteira, limite por conta, cópia de segurança, atualizador) não mudam.
2. **O e-mail do encarregado fica em arquivo versionado** (`contato-privacidade.txt`): o repositório é privado e a página pública já o publica de qualquer forma.
3. **Parar a tarefa "CYBERMECH servidor" não para o servidor** (descoberto ao tentar mascarar o `servidor.log` antigo: o uptime não zerou). Ele sobe por um ajudante do WMI. A instrução de limpeza do `DEPLOY.md` § 4c foi corrigida; o log antigo segue como estava até o servidor ser parado de verdade.
4. **Não arquivar os documentos grandes sem o "pode" do Comandante:** ele pediu para não mexer em arquivos além do necessário, e o painel lê `ESTADO_ATUAL` e `HISTORICO`. A medida (1,7 MB nos 5 documentos vivos) e a proposta estão no `ESTADO_ATUAL.md`.
5. **Higiene permanente (P200):** código, documento ou dado sem uso na área que o PR tocou sai no mesmo PR; números que o site publica (testes, módulos) saem do repositório, nunca digitados. Entrou no R17 do `AGENTS.md`.

## [2026-10-18] A visibilidade: um catálogo no código, as exceções no servidor, e o em-desenvolvimento nasce restrito (Claude, P191)

**Ordem:** *"um painel COMPLETO DE TUDO… selecionar o que os jogadores normais veem… quais mantenho secretos/restritos ao admin, em estágio de teste/desenvolvimento (tipo o botão lado, arquivo)"*.

**Decisões:**
1. **Catálogo no código, exceções no servidor.** O que existe e o padrão de cada coisa moram em `funcionalidades.ts` (revisável no PR, com teste); o servidor guarda **só o que o dono mudou**. Assim o catálogo cresce com o código sem migração, e um servidor sem arquivo vale os padrões.
2. **O que está em desenvolvimento nasce RESTRITO** (a regra nova para todo agente, em `AGENTS.md`): LADO, ARQUIVO e RELATÓRIO passam a restritos **agora**, porque são os exemplos que o Comandante deu. É uma mudança de comportamento no site (o jogador deixa de vê-los) e está dita no `ESTADO_ATUAL`; basta um clique no painel para liberar.
3. **Robôs e armas entram sozinhos, já públicos** (vêm de `CHASSIS` e `WEAPON_IDS`): o painel nunca fica desatualizado, e nada some por esquecimento.
4. **O que já está montado fica** no Hangar mesmo se a arma ou o robô foi restringido: o jogador não perde o que tinha equipado.
5. **Não é cadeado, e o painel diz isso.** O modo Comandante é um interruptor do navegador (decisão de 11/10); a visibilidade é a **vitrine**, não a segurança. O que mexe no servidor segue protegido pela chave do dono.
6. **Um link restrito volta ao padrão** (Arena, Deathmatch) antes de o jogo montar, no `main.ts`, para nenhum canto do código precisar saber (o mapa e o modo vêm da URL em vários lugares).
7. **A consulta ao servidor espera 1,5 s e não trava a largada**; a última resposta fica no navegador.

## [2026-10-18] Segurança de acesso para o lançamento: auditoria, privilégio, trilha e os mapas fechados (Claude, P196 a P198)

**Ordem:** "congele o escopo [...] controle de acesso, privilégio, autenticação, métricas para auditoria interna, analytics, observabilidade, governança [...] lançar com apenas a fase estação dos cabos, cidade neon livres [...] troque o nome rio vivo para terras raras; faça auditoria se nossa arquitetura está segura".

**Decisões:**
1. **O código está em condição de lançar; o que bloqueia o público é operacional** (`AUDITORIA_SEGURANCA.md`): o servidor e as chaves de publicação no mesmo PC de trabalho (A1) e a cópia de segurança das contas no mesmo disco (A13). Até lá, **beta fechado**. A auditoria é do Claude, não teste de invasão por terceiro: está escrito no próprio documento.
2. **Administrador só pelo PC do servidor** (`npm run admin`): nenhuma rota HTTP promove ninguém. O privilégio mais alto exige o mesmo acesso que já dá tudo, e cada promoção entra na trilha.
3. **A conta, e não só o IP, é o que se protege no login:** 10 senhas erradas em 15 min trancam a conta (inclusive o "apagar a conta"). Aceito o preço (quem erra de propósito pode trancar por 15 min).
4. **A trilha de auditoria guarda só o número da conta** (nunca e-mail nem IP) por 400 dias e mostra a recusa à porta do dono, não só o acesso: o que interessa a quem audita é a tentativa que falhou.
5. **A configuração global só aceita chaves conhecidas** (antes a rota pública entregava qualquer nome guardado).
6. **Os mapas fechados são de produto, não de segurança:** o jogo roda no navegador de quem joga. Liberar a Terras Raras é acrescentar o id em `MAPAS_DO_LANCAMENTO`. O Bunker, que o Comandante não citou, ficou fechado (a Operação Neon perde a etapa dele em vez de rodar noutro mapa com o título errado); basta uma linha para abrir.
7. **O renome de "Rio Vivo" para "Terras Raras" já tinha sido feito por outra sessão (P187)** na mesma tarde, com o mesmo resultado (jogo, seis línguas, documentos de estado): a minha cópia foi descartada na junção e ficou a dela. **As ordens P187 a P190 da LGPD e das métricas, e as P191 a P194 deste dia, foram renumeradas para P192 a P198** porque a outra sessão registrou P187 a P191 sem saber das minhas (o pedido do painel único foi fundido no P191 dela).
8. **Mutação à mão só onde errar custa caro** (ordem P195): nesta rodada, 20 mutações na segurança de acesso (e nenhuma no bloqueio de mapas, que é regra de produto com teste comum).

## [2026-10-18] O MSAA do composer sai (FXAA no lugar), o jogador nasce perto e a ordem vai para a tela (Claude, P187 a P190)

**Ordem:** *"ficou meio travado, pesado… temos sempre que corrigir e melhorar o DESEMPENHO"*; *"mais de um minuto pra chegar correndo lá"*; *"melhorar a descrição dos objetivos da missão na própria tela"*; *"mude o nome do rio vivo pra terras raras"*.

**Decisões:**
1. **Medir antes de cortar.** A suspeita do Comandante (muitas árvores, mapa grande) estava errada: o cenário todo escondido ganhava ~2 ms. **A bancada na GPU real achou o MSAA 4× do alvo HDR**: ~17 dos 27 ms, em todos os mapas. Tirei o MSAA e pus um **FXAA** depois do tone mapping. A diferença visual é pequena (conferida em recortes lado a lado); o ganho é de 2,3 a 2,8×. **O requisito de GPU integrada (G12) passa a valer na Alta também**, não só na Automática.
2. **A qualidade automática ganhou um 3º degrau (0,75×)** em vez de mudar o limiar: o limiar de 50 fps estava certo, faltava degrau para a GPU mais fraca.
3. **O mapa continua grande; o jogador é que nasce perto.** Encurtar o mapa mexeria no terreno, na floresta, nos geradores e nas torres, e a aldeia perderia o sentido de "lá longe". O **posto avançado** resolve a corrida de 100 s para ~40 s sem tocar no cenário, e a missão fica coerente: a Resistência está na linha de frente e o Draga marcha para a aldeia atrás dela.
4. **A ordem vem até o jogador, em vez de ele ir até o texto:** ordem curta no topo, uma dica, **marcadores no mundo com distância e seta na borda**. O texto de um quadro de ajuda ninguém lê; o losango verde com "CERCA · 320 m" todo mundo segue.
5. **A barra do chefe parou de repetir a ordem** (a linha de regra e a de escudo saíram com o escudo de pé; a aldeia entrou na barra). Princípio "nada repetido" da `AUDITORIA_INTERFACE.md`.
6. **Dieta de JS pelo leitor de `.glb`** (13 KB): é o maior peso que só quem abre um robô usa, e a troca é uma linha (import dinâmico), sem mudar comportamento.
7. **Renomear a fase é só texto do jogador:** os nomes internos (`rio`, `MissaoDoRio`, `amazonia`) ficam, para não quebrar o histórico.

## [2026-10-18] A lista de lançamento: o resto espera (Claude, P191 e P194)

**Ordem:** o Comandante perguntou por que as iterações são tão demoradas e pediu orientação para lançar logo; no mesmo recado, um painel único para controlar tudo.

**Decisões (o Comandante aprovou o rumo no mesmo dia, P195 a P198: escopo congelado, mutação só onde errar custa caro, lançar com Cidade Neon e Estação dos Cabos, "Rio Vivo" vira "Terras Raras", feito pela outra sessão):**
1. **O que impede o lançamento cabe em seis itens** (`LANCAMENTO.md`): servidor fora do PC de trabalho, teste com gente de fora, política revisada, "esqueci a senha", primeira partida em 1 minuto, plano dos 7 primeiros dias. **Times, o painel único, o Google Analytics na página, ranking e o resto ficam congelados.**
2. **O painel único não é construído agora:** já foi pedido em 10/10 (P54), existe em partes, e nada nele é necessário para lançar. A ordem, quando chegar a hora: aba de tiros e armas do Estúdio, depois a ficha dos bots.
3. **O ritmo:** uma ordem por vez com "pronto quando"; **pista rápida** (sem mutação à mão nem prova no Chrome) para o que não tem risco; mutação e prova ponta a ponta só para conta, rede, dado pessoal e dinheiro; e arquivar o histórico antigo (o `ESTADO_ATUAL.md` tem 3.001 linhas e é lido no começo de toda conversa).
4. **O `AGENTS.md` (Passo Zero 12) passa a mandar ler o `LANCAMENTO.md`** ao escolher o que fazer a seguir.
5. **O P81 (times na sala online) fica pausado:** não está no caminho curto.

## [2026-10-18] Métricas de nível profissional: a audiência por conta própria, sem IP e sem o Google por enquanto (Claude, P193)

**Ordem:** "teria como trazer as infos do google analytics pra essa página [...] pra eu saber QUEM e DE ONDE vêm as conexões, se vieram por link, se digitaram a url, se logou, se jogou sem logar [...] quanto tempo passou jogando, o IP e localização, tudo que não invada a privacidade, mas nos traga dados valiosos. quero métricas nível PROFISSIONAL".

**Decisões:**
1. **A audiência sai do nosso servidor, em categorias, e não do Google:** o Google Analytics só enxerga quem aceita cookies (a faixa nova do P192 vai derrubar a amostra) e só as páginas do site; o nosso funil enxerga a landing **e o jogo**, sem cookie. Trazer o GA para a página exige uma **chave de serviço do Google** que só o dono cria: fica como pedido dele, e eu ligo e provo ponta a ponta quando ela chegar.
2. **IP: não. Cidade: não. Estado: sim, se a Cloudflare entregar.** O IP é dado pessoal e não ajuda em nada que se mede em soma; a política diz que não é guardado. A cidade identifica em cidade pequena. O estado do Brasil vem do `cf-region-code` (só do túnel, só as 27 siglas) e exige o dono ligar "Add visitor location headers".
3. **Tudo é categoria de lista fechada, com teto de valores por dia:** o servidor recusa qualquer categoria que não conheça e soma o excedente em `(outros)`. Nada de texto livre, nada de id de aba (que só serve para não contar o reenvio e nunca é guardado).
4. **"Novo ou recorrente" sem identificar ninguém:** uma **data** (o dia da primeira visita) no navegador, que **nunca é enviada**: só a faixa que ela produz ("voltou há 2 a 7 dias"). É a mesma data para todo mundo que chegou naquele dia. Está na política.
5. **A origem acompanha a pessoa da landing até o jogo** pela aba (`sessionStorage`): quem veio do Instagram para a landing e clicou em jogar é "rede social" também no jogo, e não "interno". Sem isso o funil por canal quebrava na porta do jogo.
6. **A classificação é uma só:** a landing é HTML estático, mas o build embute o mesmo código TypeScript do jogo (`audiencia-landing.mjs`); um teste prova que o embutido e a classe do jogo dão o mesmo resultado nos seis jeitos de chegar. Dois códigos "parecidos" fariam o painel dizer duas coisas para a mesma pessoa.
7. **A audiência do jogo baixa sob demanda** (2 KB gz fora do JS de partida): o JS de partida estava em 496,2 / 500 KB.
8. **O teto do corpo do evento subiu de 256 para 1024 bytes** (a visita cheia tem ~400); contexto torto é descartado e o evento continua valendo.
9. **A qualidade gráfica ao terminar entra nas rodadas:** é o dado que diz onde o computador do jogador não dá conta (G12), o que mais importa para o requisito mínimo.

## [2026-10-18] LGPD: os direitos do titular entram no jogo, e o Google Analytics passa a pedir licença (Claude, P192)

**Ordem:** "faça os ajustes de apagar conta, baixar dados, tudo que a LGPD obrigue, pra que estejamos todo de acordo".

**Decisões:**
1. **Os direitos do art. 18 são botões do jogo, não e-mails:** baixar os dados, apagar a conta e desligar a medição resolvem na hora e sem depender de ninguém (e sem o dono ter de mexer no banco à mão). O que sobra para o encarregado é o que o jogo não resolve (e a página diz isso enquanto o contato não existe).
2. **Apagar pede a senha de novo e usa a mesma régua de tentativas do login:** uma sessão esquecida aberta num PC emprestado não pode virar o apagamento (nem o jeito de adivinhar a senha) de ninguém.
3. **Criar conta exige o aceite e a idade, no servidor também:** o servidor recusa o corpo sem as duas caixas ou com a política de outra versão, e guarda quando e qual versão a pessoa aceitou (a prova do consentimento). Quem já tinha conta fica sem aceite registrado (nulo): a política vale para elas pelo uso, e o aceite entra quando for pedido de novo.
4. **Idade: "18 anos ou autorização do responsável":** escolha minha, conservadora (a LGPD, art. 14, pede consentimento específico de um responsável para criança); o dono confirma ou muda. **Jogar sem conta continua sem dado pessoal.**
5. **O IP nunca vai inteiro para o log e o e-mail saiu dele:** achei `conta criada: <e-mail>` no log e IPs inteiros nas linhas de corte. Agora `212.8.252.x` (a rede aparece, a casa não) e "conta criada (número N)".
6. **O registro técnico virou arquivo por dia, apagado depois de 30 dias, escrito pelo próprio servidor** e não pelo redirecionamento da tarefa: medi que o Windows não deixa apagar, renomear nem esvaziar um arquivo que um `>>` mantém aberto (EBUSY nas três). O `servidor.log` antigo só pode ser limpo com a tarefa parada (pendência do dono).
7. **Google Analytics só depois do "Aceitar":** achei a tag fixa em **`client/index.html`**, ou seja, **dentro do jogo**, setando cookie em todo mundo (inclusive em quem tinha conta). A faixa do site pergunta, a escolha fica na chave `cybermech.cookies` e **o jogo só carrega o Google com o "sim"**; no jogo não há faixa (não cobre a tela de ninguém), então quem chega direto ao jogo não é medido pelo Google (as nossas contagens, sem cookie, medem).
8. **A política é rascunho meu, escrito a partir do código (`PRIVACIDADE.md` é o inventário):** diz o que é verdade hoje e nada além. **Não é parecer jurídico**; o dono (e, de preferência, um advogado) revisa. Sem e-mail inventado: o contato do encarregado entra por um arquivo ou variável do dono.

## [2026-10-18] O Relatório de Consequências: opcional, com fonte aberta, e a ficha corrigida pela leitura (Claude, P179 camada 3)

**Ordem:** *"o fim da missão mostra o que aconteceu com o rio, com os povos, com a água, com números lidos de ficha"* (camada 3 do P179) e a pendência da ficha: ler a fonte primária antes de virar texto.

**Decisões:**
1. **O Relatório é um chip, não uma tela que abre sozinha.** A regra do Comandante é "nenhuma partida é interrompida por sermão" e "nada de porta": o chip aparece (e pisca) quando a missão acaba, e quem quer abre. O ensino mora **entre** as partidas.
2. **Só entra o que foi lido na fonte, e o jogo diz o limite de cada fato** ("O QUE ISTO NÃO DIZ"): estudo de três aldeias não é "o povo"; o número do MapBiomas mede área, não legalidade; a portaria não atribui cada morte ao garimpo. **A ficha de fatos ganhou o § 0 com a conferência** e **corrigiu três erros meus de 17/10** (625% era 632%; "570" e "495 (92%)" eram contas diferentes; o estudo Munduruku era de três aldeias).
3. **Número de mortes Yanomami fora, de propósito:** os "570" e os "495 (92%)" divergem no recorte (menores de 5 anos ou todas as idades), no ano e na fonte (Sumaúma, documento do Senado, ofício da PF, Cimi). **Entra a declaração de emergência** (🟡+: o título, o número e a data estão em fontes oficiais; o texto da portaria não abriu). Quando alguém abrir o ofício, o número pode voltar com a fonte certa.
4. **Uma trava de teste liga o jogo à ficha:** cada endereço de fonte do jogo tem de estar na ficha, e todo fato tem `https`, data e "o que isto não diz". Assim a regra "fato tem fonte" não depende de memória.
5. **A honestidade sobre a cura:** a aba "O QUE É FICÇÃO" diz que o rio se curar em minutos é gesto de vitória, não ciência, e que o jogo não afirma que a recuperação seja rápida (a ficha pedia isso).
6. **Conteúdo em JSON por língua, painel sob demanda** (a mesma receita do Arquivo): zero no JS de partida além do chip. **As seis traduções são minhas e pedem a revisão de uma pessoa de fora**, como o Arquivo.

## [2026-10-18] A invasão: a Resistência planta a carga, o canhão só mira Mechs e o "hold" vira para valer (Claude, P180 parte E)

**Ordem:** *"invadir com andróides e destruir por dentro"* + *"prossiga"*.

**Decisões:**
1. **Os andróides são aliados fixos da missão (a Resistência, 3), não o esquadrão do jogador:** a missão do rio é determinística e o esquadrão é opção de Arena; o contrato do ato 3 pede andróides, e eles têm de existir. Reuso o `BotSystem` de aliados (escolta, rádio, anéis, "quem é amigo" já ligados), em vez de um sistema novo.
2. **A escotilha abre com o escudo caído e carrega por presença** (a regra dos cabos, ao contrário): sem tela de interação nova, o jogador vê a barra subir e a escolta. **Os dois caminhos ficam abertos** (tiro no tronco ou carga): a invasão não é obrigatória, só mais segura.
3. **O canhão do Draga só mira Mechs** (andróide é pequeno demais para o radar de tiro). Sem isto o canhão (360 de dano, explosão de 5 m) matava os três andróides no flanco antes da carga fechar: a invasão seria quase impossível. É uma **regra de equilíbrio do chefe da C**, registrada aqui: o Comandante pode trocá-la por uma zona cega do canhão (mas aí o jogador também se protege colado ao casco).
4. **`plantador` no `BotController`:** a ordem `hold` do Domínio deixa o robô orbitar o alvo em volta do ponto (até 10 m); o andróide da escotilha precisa **ficar**. Flag própria, sem mexer no comportamento de ninguém mais.
5. **Respawn único na missão do rio:** com aliados na lista, o `Respawner` (que escolhe o ponto mais longe dos vivos) mandaria o jogador para o outro lado do mapa ao morrer. Um ponto só (a aldeia).
6. **A cura de verdade fica para depois** (parte F: Relatório de Consequências e Consórcio): a E entrega o ato 3; o ato 4 segue como desenho.
7. **O pacote de partida está a 4,3 KB do teto** (495,7 de 500): a regra da missão do rio (torres, invasão) é candidata a sair do pacote inicial.

## [2026-10-18] A defesa da Amazônia: torres que calam com a CERCA, guarda que segura o posto e dorme longe (Claude, P180 parte D2)

**Ordem:** *"há uma enorme força de defesa deles e teremos que desmantelar"* + *"a amazônia já foi entregue em partes, prossiga"*.

**Decisões:**
1. **As torres são regra pura, não robôs** (`TorresDeVigia`): um laço de 8 e uma semente; **um raio de visada só quando uma está pronta para atirar**. Robô com cérebro seria 8 character controllers parados: o plano (§ 6) já dizia "regra pura, estáticas e baratas".
2. **As torres calam com a CERCA** (o primeiro gerador), **não com o escudo inteiro**: o jogador tem uma escolha (cruzar sob fogo, ou ir à cerca primeiro) e o gerador que ele já tem de derrubar passa a pagar duas vezes. O Draga e as torres ficam acoplados só pelo `Match` (o gerador 0).
3. **A guarda segura o posto e não renasce** (`defensores`, que liga o modo retaguarda que a praia já tinha): o Draga é o relógio da missão, e uma defesa que corre atrás do jogador o tira dos geradores, que é o ponto. Derrubado, fica derrubado: desmantelar é o verbo.
4. **A guarda DORME** (420 m, 6 s depois do último motivo): é o que paga os 9 robôs; o chefe fica de fora (a marcha dele não pode parar). **A regra é de custo, não de jogo:** quem está a mais de 420 m nem vê a guarda.
5. **Nascer no chão** é do mapa, não do bot (`alturaDoChao`, a altura do terreno): o raio na física **não serve** para achar o chão no nascimento (o pipeline de consultas do Rapier é vazio antes do primeiro passo).
6. **Os números são proposta** (dano 8, rajada de 4, 170 m, 3 Mechs e 6 androides): o Comandante ajusta em `TORRES_DE_VIGIA` e `AMAZONIA_GUARDA`.

## [2026-10-18] As métricas dos pilotos com conta: o que o servidor mede e o que fica de fora (Claude, P185)

**Ordem:** "tem como termos as métricas dos usuários, quantos entram, quantos minutos jogam, quantas mortes, etc? [...] pra mapearmos e trackearmos tudo, e depois implementarmos melhores práticas de marketing orientado pelas nossas informações de usuários? quero concluir logo as partes técnicas pra poder lançar".

**Decisões:**
1. **O que é "usuário" aqui: a conta.** Retenção (quem volta) e usuários únicos (DAU/WAU/MAU) só se medem com um identificador que dure de um dia para o outro. O convidado **continua anônimo** (só contagens: o dono decidiu isso em 28/09 e 04/10 e nada aqui o desfaz); quem **criou conta** passa a ter a atividade registrada. **Isto é dado pessoal novo** e vai ao ar antes da política de privacidade existir: registrei o inventário (`PRIVACIDADE.md`) e o que falta (política, "apagar a conta", "baixar meus dados") como pendência do dono, sem esconder.
2. **Uma linha por conta por dia** (`atividade`): abriu o jogo, rodadas, segundos, abates, mortes. É o mínimo que responde as perguntas dele (quantos entram, quantos minutos, quantas mortes) e a retenção; nada de linha por rodada nem de histórico de montagens (cresceria sem fim e não responde nada que o dono perguntou). Apaga com 400 dias.
3. **A sessão vai junto da rodada**, no cabeçalho, e **só para o servidor dono do token** (a mesma chave por servidor da sessão: um link com `?servidor=` apontando para outro lugar não recebe o token guardado). Sem sessão, ou com sessão vencida, a rodada vale como a de um convidado: nada se perde, só deixa de ser de alguém.
4. **O painel mostra só contagens:** o bloco `usuarios` não leva e-mail nem número de conta (teste confere).
5. **A retenção é a clássica, do dia exato** (D1 = o dia seguinte, D7 = o sétimo) e **só das contas criadas depois de a medição começar**: sem atividade registrada antes, uma conta velha contaria como "não voltou" e derrubaria o número. As coortes cujo dia ainda não passou ficam de fora.
6. **O que mais interessa a este jogo e entrou:** o **mapa**, a **onda** em que a rodada parou (onde a Sobrevivência perde gente) e a **vitória ou derrota** das missões (a Amazônia vence-se?). Opcionais no contrato: o navegador antigo continua valendo.
7. **De fora, de propósito:** o **chassi por conta** (a montagem já está nos resumos por montagem), o **lado** (P186, ainda não existe) e a vitória em **Bandeira e Domínio** (o cliente ainda não sabe o time do jogador no online: P81). O servidor também passou a **varrer sessões vencidas e atividade velha** ao subir e a cada 6 h: `limparExpiradas` existia e ninguém a chamava.

## [2026-10-18] Os geradores do escudo são alvos destrutíveis, e o escudo é um multiplicador no corpo do Draga (Claude, P180 parte D1)

**Ordem:** *"há uma enorme força de defesa deles e teremos que desmantelar"* + *"a amazônia já foi entregue em partes, prossiga"*.

**Decisões:**
1. **Geradores = `Destructibles.addExterno`** (o registro dos coqueiros da praia), não uma regra de proximidade como os cabos e as portas: o jogador **atira** neles (é o que "desmantelar" pede) e o tiro, a explosão e o dash já os acertam sem código novo de combate. A caixa é sensor: o Mech atravessa, as vias do mapa não mudam.
2. **O escudo é um número no corpo do Draga** (`DragaMech.escudo`, 1 sem escudo, 0,1 com ele), aplicado em `damagePart` e `statusDamage`: **todo** caminho de dano passa por aí, então fogo, choque e explosão não são atalho. A regra de "quantos geradores restam" é pura (`EscudoDoDraga`) e o `Match` só escreve o fator a cada tick.
3. **O escudo não volta:** a missão obriga a ir até a defesa antes de enfrentar a máquina; rodada nova devolve tudo. **10% e 1.500 são proposta** do Claude (o Comandante ajusta em `ESCUDO_DO_DRAGA`).
4. **Publiquei a parte C da outra sessão como veio** (#375), em vez de refazê-la: o trabalho estava pronto, testado e sem PR (regra 15). A parte D1 parte da `main` já com ela.
5. **Duas correções do motor do tradutor** que a Amazônia expôs: a composição aninhada com **duas voltas** (um padrão dentro de uma parte) e a guarda do " · " feita **no que a lacuna capturou**, não na expressão (a expressão deixava o " · " na borda passar).

## [2026-10-18] O online volta sozinho quando cai; os lados Aliados × Consórcio ficam desenhados e esperam os times (Claude, P184 b, P185, P186)

**Ordem:** o Comandante confirmou que dois PCs de VPNs diferentes jogaram na mesma sala; pediu métricas de usuários e a ideia de lados assimétricos; e **pôs o online na frente de tudo** ("concluirmos tudo necessário pro online gameplay funcionar").

**Decisões:**
1. **Reconexão automática no cliente** (`OnlineSession`): seis tentativas em ~15 s (G13), a sala velha limpa (robôs, previsão, placar), o aviso no canto, **recusa não reconecta** (a resposta do servidor não muda tentando de novo). **Por quê agora:** o Comandante viu o jogo cair e pedir para recarregar; quedas de VPN, túnel e servidor travado são o normal de um jogo em casa, e a G13 já a pedia desde o início. **O servidor não mudou:** a volta é um JOIN novo (o piloto volta no ponto de nascimento e o placar da sessão zera): guardar o piloto entre conexões (um token de retomada) é um degrau a mais que só vale se as quedas continuarem comuns depois da porteira tolerante.
2. **O `NetClient` avisa o fim da conexão UMA vez** (no `error` de uma conexão que não abriu ou no `close`): o Node dos testes não manda o `close` de uma conexão recusada, e sem isso a reconexão nunca desistia.
3. **Métricas (P185):** a base já existe e é anônima; o que faltava (retenção, únicos, tempo por usuário) **só se mede com a conta** e exige a política de privacidade antes de lançar (a decisão de privacidade de `shared/net/telemetry.ts` era "antes de existir login/LGPD": o login existe desde a P174).
4. **Lados jogáveis (P186):** a ideia do Comandante virou o § 3.5 do `LADO_E_PEDAGOGIA.md` (a tabela das duas pontas, os riscos, a ordem de quatro degraus e as alternativas ao nome "Consórcio"); **não construo agora**: depende dos **times na sala online (P81)**, que são o próximo passo técnico e destravam também o CTF 2v2 online.

**Prova:** 5 testes da reconexão contra o servidor de verdade e 3 do aviso único; mutação à mão, 10 de 10.

## [2026-10-17] A Amazônia, parte C: o Draga-01 com corpo e a missão do rio (Claude, P180)

**Ordem:** "continua iterando até concluir essas pendências": o chefe de verdade, a marcha até a aldeia e o que o jogador faz.

**Decisões:**
1. **O Draga é um `MechBase`** (como o Colossus), não uma entidade nova: ganha de graça a cápsula, o character controller, o dano por parte, o calor, o canhão, o `crawls` e o registro no combate. O `MechBase` pede um rig de bípede, então o do Draga é de **nós vazios** e o desenho de quatro pernas (`WalkerVisual`) vai por cima, injetado como interface (`VisualDoDraga`): o servidor e os testes de regra nascem sem ele.
2. **Dois módulos de perna para quatro pernas:** cada módulo é **um lado**. O desenho mostra a perna da frente caindo de 100% a 50% da vida do módulo e a de trás de 50% a 0%; a velocidade segue a regra do `MechBase.mobility` (um lado caído 50%, os dois 30%). **Um sistema de dano novo para quatro pernas ficou de fora de propósito**: custaria mexer no HUD, na rede e em todos os testes de dano.
3. **A missão tem módulo próprio** (`MissaoDoRio`), **não reaproveita `SurvivalWaves`**: o fim é o do Draga (cai, ou cruza a linha da aldeia), e a Sobrevivência da Amazônia não tem ondas. O fim sai pelo mesmo `onMissionEnd` das ondas, então a tela de fim e a campanha já funcionam.
4. **A Sobrevivência na Amazônia é a missão do rio:** o link do seletor de mapas leva direto a ela (`modo=survival`); o Deathmatch do mapa é escolha do seletor de modo. A campanha aceita as duas etapas na Amazônia (e não a Bandeira).
5. **O Draga e o rio carregam sob demanda** (`ChefeCarregado`, `carregarChefeSeFor`): o corpo, o cérebro e o desenho só baixam para quem abre a missão. **O JS de partida ficou em 490,7 / 500 KB** (a parte C pagou ~2 KB de HUD, fases e a fiação do `Match`; antes de a dieta de JS da `main` entrar, a soma dava 499,2 e a folga era de 0,8 KB): **a parte D e a E devem manter o que é só da missão sob demanda**.
6. **`?marcha=0.8` é um recurso de teste e de jogo:** começa a missão com o Draga já andado (de 0 a 0,95). Sem ele o Comandante teria de esperar dez minutos para ver o fim; a mesma ideia do `?onda=` da Sobrevivência.
7. **Aviso:** a floresta densa (0,82 de densidade, árvores de até 29 m) **esconde o Draga (38 m) de quem está dentro dela**; ele aparece no rio e nas clareiras. Ficou assim por ser o ambiente; se o Comandante quiser, a margem do rio ganha uma faixa menos densa.

**Prova:** mutação à mão, 60 mutações, **59 pegas**. A que escapa é **equivalente** (o `depois >= antes` do aviso da marcha é redundante com o teste de cruzar a distância). Duas lições: (a) uma cápsula com raio maior que a metade da altura **trava o Rapier** (o teste do raio a pega por um limite, e o corredor de mutação precisa de um tempo máximo por rodada); (b) os dois testes que escaparam de primeira (o Draga seguir o rio e o mundo congelar no fim) só pegavam o número, não o efeito: agora o desvio máximo do eixo do rio na marcha toda é medido (5 m, teto 12) e a posição do Draga no fim.

**Por que registrar:** quem for fazer a defesa (D) e a invasão (E) precisa saber que o Draga é um `MechBase` com dois módulos de perna, que a missão tem módulo próprio e que **o pacote de partida tem 9,3 KB de folga (490,7 de 500)**.

## [2026-10-17] O atualizador do servidor passa a guardar o fim da saída quando a verificação falha (Claude)

**Problema:** a verificação (typecheck + testes de `server/` e `shared/`) reprovou seis vezes e a produção ficou 2,5 h no código velho; o log só dizia "FALHOU", porque a saída ia para o console de uma tarefa agendada. Descobri a causa (concorrência com o trabalho dos agentes) por silêncio e tentativa, não por evidência.

**Decisão:** gravar as **últimas 40 linhas** da saída do comando que falhou no `atualizacao.log` (`ultimasLinhas`, testado). **Não** mudei a política (continua uma tentativa por rodada, voltando ao código verificado se falhar), porque repetir ou esperar silêncio é um trade-off de operação que cabe a quem usa a máquina: com a saída no log, o próximo episódio mostra qual teste caiu e por quê.

## [2026-10-17] A porteira descarta o pico em vez de cortar a conexão (Claude, P184)

**Ordem:** "não tô conseguindo jogar online, dá erro e cai a conexão... não consigo jogar CONTRA meu outro PC usando VPNs diferentes".

**Diagnóstico (do `servidor.log`):** quatro "corte de ...: taxa alta demais", dois deles de IPs de VPN, com o servidor saudável; o `tickMs` (média móvel de 2%) em 298 e 1.093 ms, ou seja, travadas de segundos do laço; PC do servidor com ~400 MB livres de 6 GB.

**Decisão:** a porteira **descarta** a mensagem quando o balde esvazia e só **corta** quando o descarte vira abuso (`dropCut` = 600, caindo `msgs` por segundo); a folga subiu de 30 para 120. **Por quê:** o corte no primeiro excesso punia quem esperava o servidor (as mensagens de todos chegam juntas depois de uma travada), e o jogador de VPN, com mais jitter, caía primeiro. Descartar custa uma conta (nada é decodificado) e perder um pacote de entrada só faz a previsão se corrigir; a inundação de verdade ainda cai em instantes (mil mensagens de uma vez cortam em ~700).

**Não resolvido por código:** o túnel da Cloudflare cai com a VPN do PC do servidor (502), e o PC do servidor é o mesmo da bancada de trabalho (memória). Está no `DEPLOY.md` § 4b.

**Prova:** testes do balde e do servidor de verdade; mutação à mão, 7 de 7.

## [2026-10-17] Auditar o idioma também por modo de jogo, e deixar o arpão do Onça para o Comandante (Claude, P173/P181)

**Decisões:**
1. **A auditoria de idioma roda em cada modo** (`?lang=ja&modo=…`, jogando alguns segundos), não só nas telas do console: a missão da praia tinha dezenas de textos em português que nenhuma tela de menu mostra. A Amazônia fica de fora (outra sessão).
2. **Constantes viram chave inteira** ("CIDADE NO ESCURO · AS ZONAS DE CURA CAÍRAM"), **o que tem número vira padrão** ("CABO {0} TOMADO · …"): a tradução da frase inteira sai melhor que parte a parte; a composição `{0} · {1}` fica para o que o código cola.
3. **Ombros no Onça não entram sem o olho do Comandante:** o encaixe de ombro do Marauder é medido no desenho importado; o Onça é procedural, então precisaria de encaixe, boca e lançador desenhados. Hoje o arpão é do Marauder (que puxa qualquer médio e mais leve); o Onça (raio 1,6) seria o melhor usuário, mas é decisão visual dele.

## [2026-10-17] Cópia de segurança do banco de contas dentro da pasta do projeto (Claude, P183)

**Pergunta do Comandante:** onde ficam os logins sem Supabase? A resposta honesta incluía um achado: **o `contas.db` era um arquivo só, no PC do servidor, sem nenhuma cópia.**

**Decisões:**
1. **Cópia diária consistente (`VACUUM INTO`), as últimas 14, na pasta `backups/` ao lado do banco**, feita pelo próprio servidor (ao subir e a cada 6 h). Não depende de tarefa agendada nem de script externo: se o servidor roda, a cópia roda.
2. **Dentro da pasta do projeto, por G15 (regra do dono):** o projeto não grava fora dela. **Consequência dita em voz alta:** a cópia não protege de o disco morrer; levar `backups/` para fora é decisão e ação do dono (`Copy-Item`), não do código.
3. **Falha na cópia só registra:** o jogo e as contas não caem por causa de um backup que falhou.
4. **Nada de Supabase por causa disto:** o SQLite no PC continua sendo a decisão do dono (28/09); a troca de banco (Postgres, se crescer) continua sendo mudar só o `server/contas.ts`.

## [2026-10-17] Os painéis opcionais do console saem do JS de partida (Claude, R7)

**Problema:** o teto de 500 KB gzip do JS de partida estava em 499,7 KB. Cada PR que somava um módulo (o `‹ valor ›`, o Arquivo, o idioma do Hangar) empurrava o total para o limite e travava o `npm run check`; a saída honesta era emagrecer, não subir o teto (R7 é do protocolo).

**Decisão:** o que só abre por clique **não entra no download de partida**. O Esquadrão, as Campanhas, o Arsenal, o Servidor do dono e as Câmeras viram pedaços sob demanda (`import()` + `sobDemanda`), no modelo que o `orcamentoDeJs.mjs` (P180) já previa para as fases. Partida: **499,7 → 486,2 KB**. **O custo:** o primeiro clique de cada painel espera o pedaço (<7 KB gzip, uma requisição); sem rede o painel não abre e o jogo avisa no console.

**Regra que fica:** tela ou painel opcional = `import()`; texto estático longo = JSON em `public/`. **O que não foi feito e por quê:** o Hangar (`HangarMenu` + `HangarScene`, ~43 KB minificados) segue no pacote de partida: o `Game` o aquece no boot para o primeiro "H" não engasgar, e tirá-lo muda essa experiência; fica como a próxima alavanca, decisão de quem mede a sensação.

## [2026-10-17] A Amazônia, parte B: o rio e o mapa (Claude, P180)

**Ordem:** "continua iterando até concluir essas pendências": o cenário do rio, bem maior que o que temos, eficiente, com o rio limpo acima do Draga e envenenado depois dele.

**Decisões:**
1. **O terreno é uma função pura única** (`alturaDoTerreno`), lida pela malha e pelo colisor de altura: o que se vê é o que se pisa (G14), e a grade é uma só para os dois. **24 pedaços de 300 m, um nível de detalhe só** (o plano falava em três; com o alcance de 1.500 m o terreno inteiro dá ≤ 120 mil triângulos, e níveis a mais custariam emenda e código sem ganho medido). Encosta máxima de 0,50, medida na grade inteira.
2. **O rio é o termômetro por UM uniforme** (a frente): o shader da água, o do chão, o da folhagem e o das estruturas leem o mesmo número; `limpezaDoRio` é a mesma conta em JS (pura, testada) e em GLSL (a string é travada por teste). A banda do veneno é de 70 m de cada lado (não é uma parede).
3. **A floresta tem dois níveis por pedaço de 300 m** (a árvore de 52 triângulos até 260 m, o bloco de 10 até 1.050 m) e **rareia em volta da mina e da planta** (o desmatamento é a história da fase).
4. **Mapas grandes carregam sob demanda** (`mapasSobDemanda.ts`): o registro é o único que o pacote de partida enxerga. O `ServerPanel` também passou a ser sob demanda para devolver folga ao teto de partida (**497,2 / 500 KB**): é a mesma política de dois tetos da parte A (o Comandante pode vetar).
5. **O Draga na Amazônia anda rio acima a 2,6 m/s e para a 240 m da aldeia** (~9 minutos): a frente do rio vai com ele. Responde, para esta fase, a decisão em aberto 0 do `AMAZONIA.md` (a Draga **anda desde o começo**); o Comandante ainda pode mudar.
6. **A câmera do mapa:** a do jogo (800 m) cortava o mapa de 2.400 m e deixava o céu preto; o mapa agora traz o `alcanceDaCamera` (1.500 m) e o domo de 1.200 m cabe dentro dele. **Lição:** **a bancada tinha a câmera dela e não via o que o jogo via**; o céu preto só apareceu no jogo real. Agora a bancada usa o mesmo alcance, e `medicoes/amazonia-jogo.mjs` fotografa o jogo.

**Bugs achados pelos testes e consertados:** (a) `THREE.UniformsUtils.merge` copia o valor de cada uniforme: a água e a lagoa nunca leriam a frente nem o tempo (hoje os uniformes do mapa entram por referência, e um teste confere que são o mesmo objeto); (b) a chave da campanha só lia os mapas `a` e `b`, e o link da etapa só levava `mapa=` para o Bunker (uma etapa na Praia abria a Cidade Neon); agora lê `abpz` e leva o mapa de todos os que não são a Cidade Neon.

**Prova:** mutação à mão, 71 mutações, **69 pegas**; as 2 que escapam são equivalentes (a guarda de declive da floresta é redundante com a fórmula de densidade; a guarda do nascimento do jogador é redundante com a da aldeia). Elas ficam no código por segurança contra mudança futura de layout.

**Por que registrar:** quem for fazer o Draga com corpo (C), a defesa (D) ou a invasão (E) precisa saber que o rio lê UMA frente, que o mapa é sob demanda, que a câmera do mapa é maior e que o orçamento de contagem tem folga de 9% no pior ponto (a aldeia).

## [2026-10-17] O idioma se audita no navegador, e a composição "A · B" traduz parte a parte (Claude, P173)

**Problema:** o Comandante quer o jogo no idioma nativo de quem chega. O teste de cobertura (que lê o código) dava tudo verde, mas **o Hangar falava português em japonês**: o texto que o jogo monta (colando "MÉDIO", "ASSALTO" e a descrição com " · ") nunca é uma chave do dicionário, e o teste só olhava as partes.

**Decisões:**
1. **A auditoria de idioma é feita no navegador de verdade** (abre cada tela com `?lang=ja` e lista o texto sem tradução): o que o jogador lê é o que importa, não o que está no código. `.tmp/auditar-idioma.mjs` e `auditar-jogo.mjs` (locais) são o modelo; o **teste de cobertura agora exige que nada em português sobre** (só nomes próprios e unidades), não só que "mudou".
2. **Chaves de composição `{0} · {1}` e `{0} · {1} · {2}`** (as seis línguas): cada parte é traduzida pelo que o dicionário já sabe e a estrutura fica. Um texto composto novo não pede uma chave nova se as partes já têm.
3. **Duas regras no motor do tradutor:** o padrão com **mais texto fixo** vence (antes: o maior regex, que contava as lacunas), e uma **chave sem " · " não engole uma composição**. Sem a segunda regra, `ESCALA {0}` e `{0} aliados` pegavam "ESCALA 3 · CERCO · …" e deixavam o resto em português, com o teste (que só via "mudou") verde.
4. **As frases que o código cola caso a caso** (a dica da arma + o aviso dos ombros + o das costas…) **se traduzem pedaço por pedaço e se juntam** (`traduzir` no `HangarMenu`), em vez de uma chave por combinação possível.
5. **O que fica em português de propósito:** as telas do dono (Arsenal, Estúdio, Servidor), os rótulos de acessibilidade do mapa e os nomes próprios dos robôs.

## [2026-10-17] O Arquivo: conteúdo em JSON por língua, painel sob demanda, tudo opcional (Claude, P179 camada 2)

**Ordem:** mostrar o posicionamento do jogo *"SUTILMENTE E ELEGANTEMENTE, pedagogicamente"* e explicar o que é o fascismo, a rede de mentiras, os interesses das elites e a manutenção do medo.

**Decisões:**
1. **Opcional, nunca porta:** o Arquivo mora num chip no console e na pausa; não abre sozinho, não interrompe partida (P133 e a regra 5 do `LADO_E_PEDAGOGIA.md` § 3.4). Quem quer aprender abre.
2. **Uma ficha, quatro partes:** o que é, como aparece, como se defender, a fonte. **A contramedida é a parte que ensina**: o jogador aprende a reconhecer e a agir, não a ouvir sermão. **A ficha 6 é sátira declarada e a tela diz**: a regra "sátira exagera, fato é fato" aparece para o jogador, não só no documento.
3. **Conteúdo em `public/arquivo/<língua>.json`, não em chave de dicionário:** cada língua é um arquivo que um revisor nativo edita inteiro, sem ficar espalhado em seis dicionários carregados no boot de todo jogador. Língua sem arquivo cai no inglês, depois no português.
4. **Painel como pedaço sob demanda (`import()`):** o JS de partida estava em 499,6 / 500 KB. O orçamento de dois tetos (`scripts/orcamentoDeJs.mjs`, P180) existe para isto: recurso opcional não pesa no download de quem não o usa. **Regra para os próximos: texto longo vai para JSON em `public/`, tela opcional vira `import()`.**
5. **Teste como trava de conteúdo:** nenhum nome de político ou bilionário vivo em nenhuma língua (arquétipos, decisão #9 do `UNIVERSO.md`), só as incoerências como sátira, toda ficha com fonte, o mesmo número de sinais em todas as línguas (a tradução não perde nem inventa um tema).

**O que a decisão não faz:** não revisa as fontes (citadas de memória; **revisor humano antes de ir ao ar**) e não traz casos reais (só com fonte dada pelo Comandante).

## [2026-10-17] O MULTI da primeira tela delega ao botão que já existe (Claude, P182)

**Ordem:** a anotação do Comandante, **MULTI** sobre o "2Players" dos jogos antigos.

**Decisões:**
1. **O botão verde é o SOLO; o MULTI é uma chapa embaixo, não um segundo botão primário.** Princípio de uma ação primária por tela (`AUDITORIA_INTERFACE.md`): a pergunta tem duas respostas, mas Enter continua sendo "jogar contra os bots" (o caminho de quem acabou de chegar). O MULTI é azul frio e só acende em dourado sob o mouse ou com o foco (a linha selecionada da referência).
2. **Delega, não duplica:** o clique chama o `#btn-online` do monitor da REDE (que abre o lobby). O estado (em sala ou não) vai em `data-online` no botão, porque o rótulo muda de língua. A regra de entrar online continua só no `OnlineSwitch`.
3. **Só na primeira tela:** no console completo o monitor da REDE já tem o botão (nada repetido), e sem servidor no build o par não existe (não há MULTI para oferecer).

## [2026-10-17] As dicas de arma do Hangar saem do pacote de JS para um JSON (Claude, P182)

**Problema:** o orçamento de JS (R7, 500 KB gzip) estava em 500,03 KB com o `‹ valor ›`; qualquer módulo novo, de qualquer agente, quebraria o `npm run check`. Subir o orçamento não era o caminho (R7 é do protocolo).

**Decisão:** as 22 dicas de uma linha das armas da tela do Hangar (3,5 KB de texto, `WEAPON_HINT` + `WEAPON_HINT_NOVAS`) moram em `client/public/dicas-do-hangar.json` e chegam por um `fetch` na primeira abertura do Hangar (`ui/dicasDoHangar.ts`; sem rede, a dica fica vazia e a próxima abertura tenta de novo). O pacote caiu para **498,49 KB** (folga de 1,5 KB). `dicasDoHangar.test.ts` guarda a regra que o `Record` do TypeScript dava: uma dica por arma do jogo, nenhuma repetida. **Quem for acrescentar texto estático longo ao pacote deve fazer o mesmo** (JSON em `public/`), e não gastar a folga.

**Achado (R17, ainda aberto):** essas 22 dicas **não estão nos dicionários das seis línguas** (a frase do Hangar é montada com sufixos, e a busca é pelo texto inteiro): o Hangar fala português em qualquer idioma. Agora que o texto é dado, o caminho é traduzir cada dica no arquivo; fica registrado no `ESTADO_ATUAL.md`.

## [2026-10-17] A Amazônia: o plano e o Draga-01 riggado (Claude, P180)

**Ordem:** a próxima fase no rio Amazonas (mineradora, rio envenenado, povos indígenas expulsos), com o modelo "heavy industrial walker" do Comandante, "eu não inseri o RIG: tenho que fazer ou você faz?", e o rio limpo a montante e envenenado a jusante.

**Decisões:**
1. **O rig é do Claude, por script de Blender reproduzível** (`scripts/blender/rig-walker.py`), não manual no Blender do Comandante: ele não precisa mexer, e o arquivo sai igual toda vez. O original em `MODELOS 3D` nunca é tocado.
2. **O Draga é quadrúpede e não segue o contrato do `MECHS_IMPORTADOS.md`** (11 ossos Mixamo, antebraço, encaixe de arma): ele ganha o próprio (18 ossos nomeados pelo papel: `fl_coxa`, `deck`, `radar`…). Forçar um quadrúpede num rig bípede seria mentira no código.
3. **Pele rígida por parte, não pele macia:** o arquivo é uma malha de 537 peças soltas de máquina; cada uma vai inteira a um osso (peso 1). A junta não amassa, o custo é o de um desenho e a classificação (por posição) se confere em foto.
4. **Cor nos vértices, sem textura:** o arquivo vinha cinza; um material só, cor por peça e sujeira para baixo. O download não cresce (984 KB) e o desenho segue sendo um.
5. **Marcha de quatro tempos, pisada de 75%:** uma máquina de 38 m não tira dois pés do chão sem parecer cair; o passo (5 m) casa com a velocidade para o pé não escorregar. É função pura (G14), testada sem navegador.
6. **O desenho é só do cliente:** o servidor nunca carrega `.glb` (G14). O Draga vai ser um chefe com **corpo na simulação** (cápsula e números próprios, como o Colossus) e o `WalkerVisual` segue a posição e o rumo dele; as pernas viram os módulos de dano da esquerda e da direita.
7. **O rio é o termômetro da fase:** a mecânica central pedida pelo Comandante vira uma função pura `limpezaDoRio(x)` e um uniforme no shader da água, sem custo por quadro (parte B).
8. **A vilã é arquétipo** (AURUM, Grupo Vorcaris), nunca empresa real; os fatos entram só com fonte (`fichas/fatos-mineracao-amazonia.md`, a escrever).
9. **O teto de JS passa a ser por fase (muda uma trava do projeto: o Comandante pode vetar).** O `smoke` somava **todo** o JS em 500 KB gzip, e a `main` já estava em ~499,8 KB: o Draga (2,4 KB) estourou o push (501,7 KB), e o mapa da Amazônia (dezenas de KB) estouraria de novo. Subir o teto mandaria o código da Amazônia a quem joga a Cidade Neon. **Agora são dois orçamentos** (`scripts/orcamentoDeJs.mjs`, testado em `server/orcamentoDeJs.test.ts`): **de partida** (o `index`, o que ele cita e os imports estáticos de cada um: o que todo jogador baixa; **o teto de 500 KB segue o mesmo**) e **sob demanda** (os pedaços que só um `import()` de dentro do jogo carrega: cada um até 150 KB gzip). O Draga entra como pedaço sob demanda (`WalkerDemo`, 2,4 KB), e o mapa da Amazônia vai pelo mesmo caminho. **Provado no build de produção:** sem `?walker` nada do Draga é baixado; com ele, o pedaço e o `.glb` chegam com 200. **Risco:** a classificação lê o código gerado (sem plugin); se o formato do pacote mudar, o teste do pedaço real (`WalkerDemo-*` fora da partida) acusa. **A folga da partida é de 0,1 KB**: o próximo código de uso geral volta a estourar; cabe ao Comandante decidir se o teto sobe ou se algo sai.

**Por que registrar:** quem for fazer o mapa, a defesa ou a invasão precisa saber que o Draga é quadrúpede de rig próprio, que o rio é o placar visível e que o desenho é só do cliente.

## [2026-10-17] A landing ganha idiomas com um módulo próprio, igual ao do jogo (Claude, P178)

**Ordem:** *"idioma tem que ficar logo no início da landing, pra pessoa já selecionar o idioma nativo dele"*.

**Decisões:**
1. **A faixa é a primeira coisa da página**, antes da navegação, com os nomes nativos (a pessoa acha a língua dela sem ler nenhuma outra): o visitante estrangeiro que não lê português precisa **reconhecer** a própria língua, não procurar a palavra "idioma". Enquanto ele não escolhe, a faixa fica realçada.
2. **Um módulo de JavaScript puro, não o do jogo:** a landing é uma página estática gerada por script, sem passar pelo build do Vite; trazer o tradutor em TypeScript pediria um segundo empacotamento. Em vez disso o módulo da landing é **a mesma conta, escrita à mão, e um teste os compara** (G14: uma regra só): se um dia divergirem, o `npm test` quebra.
3. **A mesma chave de armazenamento do jogo (`cybermech.lang`):** a landing e `/jogar/` são a mesma origem; quem escolhe na landing entra no jogo na língua dele sem pedir de novo.
4. **O dicionário é da landing, separado do do jogo:** os textos de marketing não pesam no jogo, e os do jogo não pesam na landing. As chaves que o gerador monta com número do código (`{0} de blindagem…`, `Tamanho {0} · {1} m`) são **padrões com lacuna**, para a landing não quebrar quando o número mudar.
5. **O teste da landing é um trinco, não uma trava dura:** 90% de cobertura (texto novo de outra sessão não derruba o `npm test` por uma frase), com a lista do que falta na mensagem de erro.
6. **Páginas internas (Oficina, Sala de controle) ficam em português:** são para a equipe e para quem acompanha o desenvolvimento; traduzi-las é decisão futura.

## [2026-10-17] O lado político entra pela pergunta, pelo custo e pela fonte; o arpão passa a obedecer ao peso (Claude, P179 e P181)

**Ordem:** *"devemos perguntar se quer jogar pelos aliados antimperialistas […] ou fazer campanha para fortalecer o desmatamento, imperialismo e fascismo das elites"*, ensinando o que é o fascismo e como a mentira e o medo funcionam, *"SUTILMENTE E ELEGANTEMENTE, pedagogicamente"*; e *"robôs mais pesados não podem ser puxados por robôs mais leves"*.

**Decisões:**
1. **A pergunta existe, mas não é uma porta.** O primeiro acesso segue caindo numa partida (P133); a pergunta mora num selo do console e da pausa. O padrão é a Aliança. A pergunta automática depois da primeira rodada fica como decisão dele (`LADO_E_PEDAGOGIA.md` § 7).
2. **Escolher o Consórcio nunca é premiado em silêncio:** o painel mostra **o discurso e o custo** (a sátira dos eufemismos) antes de valer, e, nas camadas seguintes, o fim de missão mostra o que a "operação segue" custou. Pedagogia por contraste, não sermão e não propaganda às avessas.
3. **Ensinar é uma ficha com fonte, não uma opinião do jogo:** o Arquivo parte de estudiosos conhecidos (Eco, Paxton, Stanley, Arendt, RAND), citados para um **revisor humano conferir** antes de ir ao ar; casos reais, números e nomes **só com fonte** (a regra "sátira exagera, fato é fato" de `CAMPANHAS_E_CHEFES.md`). Sem símbolos reais do nazismo ou do fascismo: o fascismo aparece **por mecanismo e por arquétipo**.
4. **A Amazônia é do Comandante no modelo e da Claude na lógica:** a ficha fixa o que a missão faz e os **nomes dos pontos** que o modelo precisa trazer, para ligar sem retrabalho (a lição do Bunker). Nada do modelo foi tocado.
5. **O peso do arpão é o raio da cápsula** (o mesmo número que já decide o empurrão): igual puxa igual, o mais leve não puxa o mais pesado. Foi o dado que já existia em todos os chassis; "peso" de verdade (massa) não existe no código, e criar um agora mexeria no Hangar. O custo: os chassis de malha importada com o mesmo raio contam como do mesmo peso.
6. **As capturas de jogos de terceiros não entram no git** (as dos jogos antigos ficam em `.tmp/referencias/`): o git guarda a leitura e o que levamos, não a arte.

## [2026-10-17] As outras fases: o circuito do quadro de luz se repete na Cidade Neon (Claude, P177, P164)

**Ordem:** "melhore as outras fases além da estação cabos" e, da P164, "um circuito que podemos repetir nas diferentes fases" e "chefes especiais com contexto em cada outra fase".

**Decisões:**
1. **A primeira "outra fase" é a Cidade Neon (a Arena), não o Bunker:** a missão padrão do jogo (`campanhaPadrao`) é a sobrevivência na Arena; o Bunker só tem Deathmatch. Melhorar o que a maioria joga primeiro.
2. **O circuito é a mesma classe, não uma cópia:** `QuadroDeLuz(ponto, vidaMax)` (o padrão é o do porto). Uma regra só (G14); o `Match` escolhe a instância por mapa. **O transformador tem 480 de vida** (o do porto, 240): é o coração da cidade, e o Colossus (peso 4) o apaga em ~20 s, o que dá ao jogador uma janela para derrubar as pernas dele.
3. **O Colossus vai ao transformador e é solto quando ele cai:** o contexto do chefe na Arena é "ele apaga a energia do banco". Sem o que depredar, volta ao comportamento normal (senão ficaria parado em cima de um quadro morto).
4. **Escurecer a cidade é mexer em cores, não em luzes:** as arestas, faixas e janelas são emissivas (não leem as luzes da cena), então a energia escala as cores registradas (`Arena.registraLuz`), só quando a energia muda. **O piso é 12%** para o jogador ainda ler os prédios. **A placa do banco cai junto** (é o transformador dele). Os LEDs da torre Serafim ficam de fora (a base do time tem os modos próprios).
5. **O HUD de missão reaproveita o `PraiaHud`** (modo `soMissao`) em vez de um segundo HUD: a célula do quadro, a barra do chefe e os avisos já existiam e ficam iguais; o que é só da praia é escondido por CSS e pulado no código. A regra dita do chefe vem de `regraDaFase(fase, alvo)`: na Cidade Neon não há cabos, e dizer "ele vai cortar os cabos" ali seria mentira.
6. **Nenhuma condição de derrota nova:** o transformador apagado derruba as zonas e a luz, não a missão (o núcleo da praia é que a perde). A missão padrão fica mais exigente; o equilíbrio jogando é pendência.

**Por que registrar:** quem for levar o circuito ao Bunker, à Bandeira e ao Domínio, ou equilibrar a missão, precisa saber que a instância é por mapa, que o escurecimento é de cores registradas e que o Colossus é solto quando o quadro cai.

## [2026-10-17] A Colossus em três fases, a barra do chefe e a máscara (Claude, P165, P147)

**Ordem:** a parte D do capítulo 1 ("CONTINUA SEGUINDO A PARTE B, C e a D") e a máscara da Colossus V1 só como chefe (P165).

**Decisões:**
1. **As fases saem do dano por parte que já existe**, não de um sistema novo: `faseDoChefe` lê a vida das pernas e do tronco (anda, manca, rasteja, caiu). Uma regra só (G14), pura e testável.
2. **Só o chefe rasteja** (`MechBase.crawls`, 30% da velocidade): num Mech comum, perna destruída segue como torre imóvel, que é a regra de equilíbrio de sempre. O rastejo é o que faz "pernas caídas" virar **outra luta** em vez de fim de luta.
3. **O alvo do titã é o cabo mais perto ainda de pé**, e com os três cortados a porta principal. **O jogador pode kitar** (afastar o titã dos cabos atirando e correndo): fica permitido, é estratégia, e o rastejo a 30% a torna viável.
4. **A máscara é 1,3× a cabeça e desligável (`?mascara=0`)**: a caricatura de figura pública é sátira política que o Comandante pediu, e o **risco jurídico e de plataforma** segue registrado (`CAMPANHAS_E_CHEFES.md` § 0). O botão de desligar é o que protege o jogo se uma loja reclamar. Só desenho: não toca colisão, vida nem arma.
5. **A barra do chefe diz a regra da fase numa linha**: o jogador entende o problema sem ler manual.

**Por que registrar:** quem for equilibrar o chefe (vida, 30% do rastejo, peso 4 nos cabos são linhas de tabela) ou levar a missão para a rede precisa saber que a fase é derivada do dano e que o rastejo é só do chefe.

## [2026-10-17] Entrega só conta quando o dono a acha: o idioma e a conta vão para o canto da primeira tela (Claude, P176)

**Ordem:** *"nao achei o arpao no hangar, nem a mudança das linguas, nem login"*.

**Decisões:**
1. **Antes de mexer, conferir o que um visitante vê** (navegador de verdade no site de produção, não o repositório): estava tudo no ar. O defeito era de **descoberta**, não de entrega. Registrado porque a regra 16 do `AGENTS.md` ("toda entrega visível fecha com o caminho para vê-la") foi cumprida no papel (o caminho estava no PR) e falhou na prática: o caminho tinha quatro passos, e o primeiro acesso é de propósito uma tela de uma ação só.
2. **Idioma e conta vão para o canto da primeira tela e da pausa, discretos** (um seletor e um botão pequenos): não quebram o princípio de "uma ação primária por tela" (`AUDITORIA_INTERFACE.md`), porque não competem com *CLIQUE PARA JOGAR*. O princípio "nada de porta" (`RANKING_E_LOGIN.md` § 1) segue: o botão **[ CONTA ]** só abre um bloco opcional.
3. **Dois seletores de idioma, uma escolha:** o conjunto de seletores é do módulo de idioma, então qualquer lugar novo que queira o seletor só chama `ligarSeletorIdioma`.
4. **O arpão não ganhou atalho:** só o Marauder tem ombros (regra de chassi, P77); mudar isso é decisão de design do Comandante, não conserto de visibilidade. Fica como falta declarada.

## [2026-10-17] Os bots atiram o laser e a cadência de conteúdo vira número no painel (Claude, P175)

**Ordem:** as pendências abertas recentes (a P160 deixou "os bots usarem as armas novas"; a P171 pediu "contar conteúdo como se conta código").

**Decisões:**
1. **O bot reaproveita `Match.beamPulse`, não ganha um raio próprio:** uma regra só (G14) para jogador e bot, e no servidor o pulso do bot já vira evento de tiro (`onBeam`). A opção é `pulso` do `BotSystem`, **separada dos `launchers`**: `explosivos: false` desliga o míssil, não o laser.
2. **O laser entra como arma de energia do bot, na cadência dela**, sem o "segurar o gatilho" do jogador: o calor e a pausa da IA já cortam a rajada. Não houve ajuste de equilíbrio (o dano por pulso, 6, cai com a distância e o bot erra a mira da dificuldade).
3. **O arpão não é arma de bot:** só há ombros no Marauder, e o bot não os tem. Fica declarado.
4. **O ritmo de conteúdo mede o que é inequívoco: arma e chassi** (ids do código, datas do git). Mapas, pilotos e eventos ainda não entram (não há lista no código para ler). A média usa as quatro **últimas semanas completas** (a corrente fica de fora: senão ela sempre puxaria a média para baixo).
5. **D7 e DAU/MAU não foram feitos de propósito:** exigem guardar um id por visitante, que é decisão de privacidade do Comandante (LGPD), não de engenharia.

## [2026-10-17] O login do jogador: a conta guarda o progresso do navegador, sem porta e sem id local (Claude, P174)

**Ordem:** *"concluamos sobre o LOGIN"* (camada C3 do `RANKING_E_LOGIN.md`).

**Decisões:**
1. **Sem "id local" aleatório, como o plano previa:** o navegador **já é** a fonte do que ele guardava (nível, créditos, apelido, montagem); a conta é uma **cópia** que o alcança. Um id a mais não resolveria nada e criaria um segundo estado para sincronizar.
2. **A junção é "quem tem mais progresso vence por inteiro"** (nível, depois XP; empate, o último a gravar), com o apelido e a montagem do outro cobrindo os vazios. Somar créditos dos dois lados dobraria o ganho de quem joga em dois aparelhos; o plano diz "não perde nada", e perder o ganho do lado menor é o preço de não permitir esse dobro. A regra é uma função pura testada.
3. **Rede nunca é requisito:** falha de rede não trava nem apaga nada, o token **não** é apagado quando o servidor não responde (sessão vencida e rede fora são indistinguíveis para o cliente), e **sair não apaga o progresso do aparelho**.
4. **O progresso da conta é conforto, não verdade:** não vale para ranking (G13: só o servidor autoritativo pontua o global); quem adulterar só adultera a própria conta. Por isso o servidor valida a **forma** e os limites, não a "legitimidade".
5. **Token por servidor** (como o do admin): um link com `?servidor=` de terceiros nunca recebe o token guardado.
6. **Só nas Configurações, por ora:** o princípio é "nada de porta" (`RANKING_E_LOGIN.md` § 1); o convite depois da primeira partida fica como próximo passo, para não ser feito sem o olho do Comandante.
7. **R17 (achado):** `/conta/eu` nunca respondeu ao preflight do CORS; corrigido junto, porque a rota nova depende da mesma coisa.

## [2026-10-17] O arpão magnético volta, refeito sobre a main de hoje (Claude, P77 parte 3)

**Ordem:** P77 (11/10): *"VARIAR as armas e tecnologias"* nos ombros; o arpão estava num porte de 12/10 que nunca entrou.

**Decisões:**
1. **Não cherry-pick:** o WIP de 12/10 conflitava em ~20 arquivos com a `main`; foi reaplicado à mão só o que valia (a regra `HookSystem`, o modelo) sobre a `main` de hoje, com os ganchos novos (`weaponLook`, `dicasDeArma`, `fireFeel`, `muzzleFx`, `impactFx`: tabelas que obrigam uma linha por arma).
2. **Tiro de varredura, não projétil:** um raio de 45 m (58,5 no MK III: a faixa curta não muda com o nível, `calibragem.test.ts`), como o laser; o cabo é estado do `HookSystem` (pool de 8), não uma entidade física. Barato (um raycast a cada 4 s) e determinístico.
3. **Só o servidor e o jogo offline puxam:** o cliente online só desenha o raio (G14); o puxão chega pelo estado do robô. Por isso o cabo preso de outro jogador **não** é desenhado no online (declarado como falta).
4. **O contrajogo faz parte da arma:** dash corta, parede solta, o Colossus arrebenta o cabo (`breakRadius`), o alvo que foge estoura (125% do alcance). Sem isso o arpão seria "perdeu o controle do robô"; com isso é uma troca (um aperto a cada 4 s por juntar o inimigo).
5. **Dano baixo de propósito (10, 2,5 por s):** o arpão junta, não mata; o valor está nas outras armas de ombro (sônica, fogo, granada, foguete).
6. **Protocolo 20, no fim de `NET_WEAPONS`** (índices antigos intactos); um cliente 19 recusaria o tiro.

## [2026-10-17] O jogo ganha sete línguas, com o português como texto de origem (Claude, P173)

**Ordem:** colocar já o inglês, o japonês, o espanhol, o francês, o chinês e o russo (resposta à P171 (b)).

**Decisões:**
1. **O português fica no código e no HTML; as outras línguas são dicionários JSON** em `client/public/locales/`. Nenhum módulo de interface sabe de idioma (G3), nenhuma chave artificial para manter, e o texto novo nasce em português como sempre. JSON em `public/` e não módulo, porque o teto de JS (500 KB gz, ~480 hoje) não comporta seis dicionários e porque só baixa quem escolheu a língua.
2. **Tradutor de DOM com observador, não `t()` em cada arquivo:** o jogo escreve texto em dezenas de lugares (`textContent`); o observador pega todos sem tocar neles, e a troca de língua é ao vivo (cada nó guarda o original). O custo é só fora do português. `t()` existe para o código que monta texto na mão.
3. **Chaves com lacuna `{n}`** para o que o jogo preenche (número, nome), a tradução reordena; o valor da lacuna também é traduzido (uma volta), para `VENCEDOR: AZUL` virar `WINNER: BLUE`.
4. **Detecção pela língua do navegador só fora de navegador de teste** (`navigator.webdriver`): o smoke e as bancadas comparam textos em português; a escolha explícita (`?lang=`, seletor) vale sempre. Quem tem o navegador em inglês já abre em inglês (o alvo da P171: EUA, Japão, Alemanha, Coreia, Reino Unido).
5. **A cobertura é do teste:** arma nova, rótulo novo de configuração ou texto novo no `index.html` sem tradução **quebram o `npm test`**; é o que impede o dicionário de apodrecer.
6. **Fora do alcance, declarado:** voz do narrador, canvas, fichas do Hangar, a landing; alemão e coreano (os outros mercados da reportagem) ficam como o próximo passo barato (é só um JSON novo).

## [2026-10-17] O porto: os rebeldes nascem nos contêineres, e o quadro de luz liga a cidade às zonas de cura (Claude, P163, P164)

**Situação:** o Comandante pediu que os inimigos saíssem dos contêineres do porto ("bem explícito") e um sistema no porto, a proteger, que acende as luzes da cidade, repetível nas outras fases.

**Decisões:**
1. **Os contêineres de desembarque ocupam vagas do pátio do cais, três em vez de quatro:** a fileira z = 0 tem o farol de 38 m do lado da boca, e a de trás (z = -64) tem as pernas do guindaste; a sonda do terreno e o teste de folga acharam os dois (os 6 pontos de nascimento antigos eram na areia, em chão plano; os novos são no cais, uma laje no nível do chão, e o teste de nascimento passou a medir a folga só em relação ao que passa da altura do joelho). Cada boca solta duas levas (os Mechs na porta, os andróides 3 m à frente).
2. **O nascimento mudou da areia (~200 m da estação) para o cais (>460 m):** é mudança de **ritmo** assumida: os manifestantes (que nascem na avenida e na rua dos fundos) chegam em poucos segundos e as máquinas ~45 s depois. O Colossus fica na avenida até a parte D.
3. **O quadro de luz fica a mais de 500 m da estação, de propósito:** defender os dois não cabe no mesmo jogador, e **o saboteiro** (o primeiro andróide vivo da onda 2 em diante) é o único rebelde que vai para lá. **Ele tem consequência real:** a energia multiplica as luzes (o ciclo do dia manda quantas acenderiam) e, **apagado, derruba as zonas de cura e de resfriamento** (`ZoneSystem.energizadas`): a luz da cidade é o que cura o jogador.
4. **O circuito é uma regra pura repetível** (`QuadroDeLuz`: vida, depredador, defensor, energia): o quadro do banco e o transformador do datacenter são a mesma regra com outra peça.
5. **Lição de teste:** `damage: false` no `Match` desliga também o `crush` (não mata ninguém); o dano de sobra para apagar o quadro precisa de um `dt` grande (um passo de 1 s a 10 de peso tira só 60 de 240); e a mutação "o saboteiro aparece já na onda 1" foi escrita por mim para provar que a onda 1 fica só nos cabos.

**Por que registrar:** quem fizer a parte D (a Colossus) precisa saber que o nascimento agora é no cais e o chefe ainda não, que o quadro liga a cidade às zonas, e que o ritmo das ondas mudou de propósito.

## [2026-10-17] O manifestante é um andróide mais fraco no mesmo pool, as portas são regra pura, e só a praia pede manifestantes (Claude, P163, P166)

**Situação:** o Comandante pediu a invasão do prédio por **duas entradas** e os manifestantes dos eventos reais como NPC.

**Decisões:**
1. **O manifestante é uma variante do `Android`** (`tool: 'bandeira'`, `MANIFESTANTE_STATS`), **não uma entidade nova nem uma multidão sem física**: reaproveita o cérebro corpo a corpo, o tiro, o dano por parte, o placar e os testes de partida. O preço, dito: o pool da missão soma **13 personagens**, mais que os **8 character controllers** que o G11 pede para uma sala. Vale **offline**; **a missão online terá de caber no teto** (ou o manifestante vira agente leve sem controller).
2. **Sem arma de fogo, sem rosto:** a "arma" é a pancada de bandeira (**metade** da motosserra, o mesmo `WeaponStats` com `damage: 2`), e o desenho é genérico (pele, boné e camisa amarela, bandeira verde com losango): ninguém é retratado.
3. **As portas são a mesma ideia dos cabos** (regra pura em `sim/`, o `Match` só conta quem está perto): vida, dano por presença com peso por tipo, conserto de quem defende, **dreno da rede quando arrombada**. Porta forçada **não se recompõe sozinha**, de propósito: é preciso ir lá.
4. **Cada vaga do pool de manifestantes tem o alvo dela** (a vaga decide o lado de onde nasce: avenida ou rua dos fundos), e não a posição de quem está vivo: o grupo dos fundos vai à porta dos fundos sempre, sem atravessar o complexo.
5. **O plano da onda só vale com o pool**: `totalDaOnda(plano, comManifestantes)`. A Arena e o Bunker têm o mesmo plano de ondas e **não** têm manifestantes; sem isto o `Match` da Arena lançava "Pool da missão não cobre o plano da onda" (o teste existente pegou).
6. **Lição de teste:** com o jogador longe, os rebeldes da onda zeram a rede da estação em ~48 s e a missão **acaba** (os bots são desativados) antes de uma porta ceder. Teste de porta mantém a rede cheia a cada segundo, e o dreno das portas é medido **sem os invasores** e **sem os cabos já tomados** (o primeiro teste dele passava só com o dreno dos invasores: a mutação "as portas não entram no dreno" escapou até ele ser reforçado).

**Por que registrar:** quem for fazer a parte C (o porto) e a D (a Colossus), ou levar a missão para a rede, precisa saber que o manifestante divide o pool dos andróides, quem decide o alvo de cada vaga e que o teto de personagens está estourado de propósito offline.

## [2026-10-16] O site ganha um sistema de design e fotos cinematográficas dos Mechs reais (Claude, P172)

**Ordem:** deixar a landing e as páginas "bem parecidas com as referências", com acabamento de portal de jogo, mais único.

**Decisões:**
1. **Um sistema de design permanente** (`DESIGN_SYSTEM_SITE.md` + `scripts/site/hud.mjs`), fonte única de paleta, fonte, botão e componente; página nova importa, não redefine. O documento vive em `.decepticons/` (e não em `docs/`, como pedia a orientação) porque é onde o projeto guarda a verdade (AGENTS.md).
2. **Imagem de Mech é do modelo real**, em foto de cena (`cena-cinematica.mjs`), e não recorte da arte conceitual: a orientação proíbe robô que não seja do universo do jogo, e o jogo já tem o Colossus-V4, o Marauder e o Vector-09. A arte conceitual do Comandante fica de referência (e nas ilustrações do esquadrão).
3. **O herói é foto, não 3D ao vivo:** o custo de CPU/GPU e de carga numa landing seria alto para o ganho; a foto sai do mesmo modelo e é regenerável em segundos.
4. **Mono fora, texto mínimo de 12 px:** a primeira versão usava mono pequeno por todo lado; a orientação (e o olho) pediram o contrário.
5. **Nada de recurso que o jogo não tem:** "Pilotos com personalidade" e "Rodadas de 5 minutos" das referências não entraram como estavam; os cartões saem da VITRINE do GAME_DESIGN.
6. **A comparação de tamanhos é a do Comandante** (durante a sessão): Andróide (1), Vector-09 (2) e Colossus-01 (3) lado a lado e o Colossus-V4 (4) por trás, escuro e na névoa, para mostrar as proporções sem roubar a cena; no lugar do Marauder, que ficou só no Hangar.
7. **Nunca dois CTAs de jogar juntos:** o do cabeçalho aparece depois do herói.

## [2026-10-16] Checkpoint das explosões e as lições do War Robots (Claude, P170 e P171)

**Decisões:**
1. **Checkpoint = tag + captura + bancada + regra** (`CHECKPOINTS.md`): o ponto que o Comandante aprova fica recuperável (`git checkout checkpoint/<nome> -- arquivo`) e tem um jeito barato de comparar (a bancada refaz as capturas em software). A regra é "não regredir", não "não mexer": melhorar vale.
2. **A reportagem vira metas, não promessa** (`LICOES_WAR_ROBOTS.md`): é comunicado da dona, em valor bruto e acumulado. O que se aproveita é o **mecanismo** (cadência de conteúdo, eventos, celular, retenção); o **pay-to-win** do War Robots continua fora (`GAME_DESIGN.md`).

## [2026-10-16] Cada arma tem a sua dica de primeiro uso (Claude, P160 parte 5)

**Situação:** havia uma dica só para as armas de munição, "FOGUETES: DANO EM ÁREA; EXPLODA NO PÉ DO INIMIGO", e ela aparecia para a granada, o enxame
e o cruzador também: no texto, a arma nova era o foguete (uma das causas de "parecem armas antigas", P152).

**Decisões:**
1. **Uma frase por arma, em dado** (`ui/dicasDeArma.ts`, `Record<WeaponId, …>`: o typecheck exige uma para toda arma nova) com os números **tirados da arma**
   (o enxame diz 8, 16 ou 32 mísseis conforme o nível; a granada, o alcance), para a dica nunca contradizer o jogo.
2. **Uma vez só, e não volta** (guardado no navegador, tolerante a falha). Com outra dica na tela, espera sem marcar. O foguete segue com a dica de sempre.
3. **A caixa da dica cresce com o texto** (até 90% da tela): as frases passam de 60 caracteres.

## [2026-10-16] Identidade editorial da landing e comunicação pública profissional (Codex, P169)

**Ordem:** evoluir a landing e o primeiro acesso pelas cinco referências fornecidas, mantendo números reais e usando os robôs do jogo nas imagens.

**Decisão:** preto mineral, amarelo de destaque, tipografia legível e composição industrial; fontes do sistema, com Azonix apenas na marca. A entrada principal abre o jogo solo sem depender da disponibilidade online; multiplayer permanece como operação explícita. A landing não antepõe uma segunda vinheta à vinheta existente no jogo.

**Conteúdo:** atributos e links de montagem vêm do catálogo do jogo; estatísticas extensas ficam na Oficina. Textos de apresentação usam vocabulário de produto e engenharia. A fila interna de decisões e trechos de trabalho em andamento ficam no painel local; os registros originais e as falas do dono não são reescritos.

**Imagens:** rigs reais, montados sem física, fotografados em cena promocional estática. Não são promessa de cenário jogável. Miniaturas de cenário vêm de capturas existentes, não de métricas nem jogadores fictícios. Arquivos versionados; a landing não depende de gerar arte durante o deploy.

**Custo:** nenhum custo no tick ou render do jogo; imagens JPEG, lazy loading abaixo da abertura, troca de câmera a cada 6 s suspensa com foco/hover/aba oculta/redução de movimento; consulta de status a cada 20 s conforme contrato, com cancelamento e sem sobreposição.

## [2026-10-16] Os rebeldes lançam a arma explosiva da mão esquerda (Claude, P160 parte 4)

**Situação:** o Vector-09 inimigo sai de fábrica com plasma e casulo de foguetes, mas o bot só atirava a arma principal: as explosões novas (P160 parte 1)
quase nunca vinham contra o jogador. O Comandante, 16/10: *"bote pra torar na iteração das armas"*.

**Decisões:**
1. **Salvas, não fogo contínuo:** dois tiros (o lançador leve solta o carregador), pausa de 7 s no normal (a fácil espera mais, a difícil menos, a
   personalidade agressiva encurta), carregador de verdade e nunca mais perto que 1,6 × o raio da explosão + 6 m. A salva que empaca (perdeu o alvo no
   meio) é cancelada — achado pelo teste: ela voltava 2 s depois furando a pausa.
2. **Mira no pé de onde o alvo vai estar**, com o erro da dificuldade em metros: a explosão pega quem fica parado, e quem se mexe desvia.
3. **Sorteio próprio** (`blastRand`, outra semente): a salva não mexe na sequência das outras decisões do bot.
4. **A partida padrão mudou** (a foto tick a tick do `esquadraoPadrao.test.ts` foi refeita, como o teste manda): medido em 90 s com o jogador parado,
   no offline padrão o jogador apanha **menos** (448 contra 1 178: os aliados também lançam e limpam os rebeldes antes) e vê 50 explosões em vez de 3; na
   Arena do servidor (3 contra 1) apanha 34% a mais. Desligar é `explosivos: false` na partida; um botão nas configurações fica para se o Comandante pedir.
5. **O esquadrão (P91) pode dar armas explosivas aos bots** (`armaExplosivaDoBot`): granadeiros, artilheiros de cruzador, enxames.

## [2026-10-16] O "Testar" do Hangar desenha com a camada de efeitos do jogo (Claude, P160 parte 3)

**Situação:** em 15/10 o Comandante disse das armas novas: *"selecionei e implementei elas mas parece que são armas antigas"*. O "Testar" do Hangar — o
primeiro lugar onde ele vê uma arma — desenhava todo tiro com o mesmo traço (ciano na energia, laranja na munição) e o mesmo clarão no alvo.

**Decisões:**
1. **O teste usa a mesma camada do jogo** (`WeaponFx`, `BeamVisuals`, as partículas de acerto de cada arma), num módulo próprio (`hangar/TestShots.ts`,
   G3), com a **trajetória da família**: reta na velocidade da arma, a salva com o desvio dela, os nove balins em cone, o arco do cruzador e o arco da
   granada. O Hangar não tem física: o tiro vai do cano ao ponto do alvo (só desenho).
2. **Achado e corrigido (R17):** o contador de dano do teste contava um balin por disparo da escopeta (`testAt`); agora conta os nove.

## [2026-10-16] O lança-granadas: o arco regula a carga para passar por cima da cobertura, e a rede manda a direção da mira (Claude, P160 parte 2b)

**Situação:** a P160 pede "balísticas" e "novos estilos, tipos, formas". Nenhuma arma do arsenal tinha gravidade.

**Decisões:**
1. **A granada cai no ponto da mira** (o lançador calcula a elevação), em vez de o jogador ter de adivinhar a queda: a mira de sempre continua valendo,
   e a mira prevista (o arco em pontinhos e o anel) mostra o que vai sair.
2. **Carga regulada em vez do "arco alto" de carga cheia:** com 42 m/s o arco alto para 29 m saía a 80°, subia 39 m e levava 3,9 s (a bancada mostrou);
   quando o arco baixo bate na cobertura, sai a **menor elevação de 35° a 75° que passa limpa**, com a velocidade que faz cair no ponto.
3. **A rede manda a direção da mira, não a de lançamento** (como o cruzador): a velocidade varia por tiro e o evento de 7 bytes não tem onde levá-la; o
   outro cliente acha o ponto da mira pelo raio e refaz a mesma conta (a escolha do arco só olha o cenário parado, igual nos dois lados).
4. **No chão crava, na parede tabela:** com quique de verdade no chão a granada caía 15 m além da mira; agora estoura a ~2 m, e tabelar na parede
   continua sendo o truque.
5. **34 de dano** (não 45): com 45 o MK III derrubava um torso em 3,7 s sozinho, contra a regra dos 4,5 s do Comandante (P111).
6. **Protocolo 19** (`grenade` no fim de `NET_WEAPONS`); o servidor reinicia sozinho a cada `main` nova (o atualizador do PC).

## [2026-10-16] A escopeta sai em balins, de dentro do ProjectileSystem (Claude, P160 parte 2a)

**Situação:** a escopeta era um projétil só de 52 que caía a 8% aos 45 m: uma "escopeta" sem chumbo. A ordem P160 pede balística e estilos de verdade.

**Decisões:**
1. **Os balins nascem no `ProjectileSystem.fire`**, não no `Armament`: os bots atiram direto pelo `ProjectileSystem` (`BotSystem`), e o desenho do tiro de
   outro jogador também; assim o servidor, os bots e o online saem iguais com **um** evento de tiro por disparo (não nove: a rede não muda).
2. **Desenho fixo, sem sorteio** (`spreadAt` com o número do balin, o 0 no centro): o servidor e o cliente desenham o mesmo cone (G1/G2).
3. **A queda vem da geometria:** 9 × 6 num cone de 3,4° (cada balin cai a 25% aos 50 m). De perto o disparo bate 54 (era 52) e o tempo para derrubar um
   torso não mudou (4,0 s MK I, 3,2 s MK II e III); entre 15 e 30 m a escopeta ficou mais forte que antes (32 aos 30 m, eram ~24) — proposta, o
   Comandante ajusta em Potências.
4. **Um disparo, um retorno:** os balins que acertam o mesmo alvo dentro de 0,04 s somam num número de dano (`DamageNumbers`, chave = o alvo) e o som de
   acerto toca uma vez por tick.

## [2026-10-16] A cara dos tiros: explosão com corpo, rastro em fita, clarão e marca por família de arma (Claude, P160)

**Situação:** o Comandante (16/10, P160) compara o jogo com jogos 3D feitos em uma semana e os acha "mil vezes melhores". O arsenal já tem 20 armas; o
que separava era a **sensação** de cada tiro: a explosão era só uma nuvem de pontos que somava luz (a "fumaça" também somava, então nunca
escurecia), o rastro de míssil era uma fila de pontinhos, o tiro de energia uma risca e o trilho uma linha de 1 px; nada ficava onde o tiro batia.

**Decisões:**
1. **Visual primeiro, regra intacta:** este PR não muda dano, alcance nem cadência de nenhuma arma (nenhum teste de equilíbrio mexeu). Balística e
   estilos novos (balins da escopeta, arco com gravidade) vêm num PR próprio, com teste de simulação.
2. **A simulação avisa, o cliente desenha:** os sistemas de tiro ganharam um campo opcional `fx` (`ShotFx`: `fired`, `flying`, `impact`, `landed`,
   `trail`). O servidor deixa vazio e não paga nada; com ele ligado, o rastro de partículas antigo do míssil e do obus sai (a fita o substitui) e a
   linha de 1 px do trilho virou o raio iônico no pool de feixes do laser.
3. **Fogo com mistura normal, não soma de luz:** a primeira versão somava luz e dez bolas de fogo sobrepostas viravam um borrão branco que cobria a
   tela (medido na bancada). Com mistura normal o laranja satura e o bloom acende só o miolo.
4. **Estilo low-poly mantido** (decisão de 07/10, `REFERENCIA_VISUAL.md`): bola de fogo e fumaça são poliedros de faces chapadas que fervem (a forma
   ondula no shader), não folhas de sprite.
5. **Marca só em superfície parada** (colisor sem corpo): num Mech a marca sairia andando. A rotatória marca a cada 3 acertos (20 tiros/s).
6. **A cara de cada arma é dado** (`fx/weaponLook.ts`), separado da força (`combat/weapons.ts`), para o Estúdio (P157) editar sem tocar na regra; a
   cor do inimigo continua de aviso (teste trava a cor igual à do jogador).
7. **O tranco da explosão escala com o tamanho** (`explosionShake`): o alcance era fixo em 40 m para qualquer explosão.

**Custo:** 0,45 ms por quadro sob carga extrema (170 fitas, 219 peças de explosão, 160 cartazes, 80 marcas); 9 desenhos para todos os efeitos da
cena; nada alocado por quadro. GPU real: 0 de 192 poses com NaN com os efeitos acesos (`varrer-nan.mjs --efeitos`). JS 472,3 KB de 500.

## [2026-10-16] Os cabos de dados são regra pura em `sim/`, o andróide rebelde "se liga" por proximidade, e a ficha de fatos mostra o quadro misto (Claude, P162, P163, P166)

**Situação:** o Comandante deu o capítulo 1: os cabos como pontos de invasão (o andróide se liga e injeta, os outros o protegem, nós o desligamos) e pediu os casos de privatização para a ficha de fatos.

**Decisões:**
1. **A regra dos cabos é módulo puro em `sim/` (`CabosDeDados`), sem relógio nem sorteio.** O `Match` só **conta quem está perto** de cada ponto e entrega os números; assim o teste cobra a regra sem montar o jogo, e o servidor roda a mesma quando a missão em ondas for para a rede.
2. **"Ligar-se" é estar parado perto do ponto, não uma animação nem uma ação.** Os andróides recebem a ordem `hold` do Domínio, aplicada **a cada segundo** (um por cabo, em rodízio), com o desconto do `escortSide × 6` que a ordem soma ao posto (senão metade dos andróides pararia no cabo vizinho). Um andróide que fica trocando tiro a mais de 4,5 m do ponto **não injeta**: a defesa do ponto é matar ou afastar o andróide.
3. **Quem depreda e quem se liga são papéis diferentes:** o andróide injeta (ataque à informação), o rebelde pesado depreda (ataque à infraestrutura). Cabo **tomado** e cabo **cortado** drenam a rede; **tomado só se libera com defensor perto**, de propósito: injeção não some sozinha, é preciso ir lá.
4. **O desempate de "qual cabo" é o de menor índice** (dois cabos a 3 m): a mesma posição dá sempre o mesmo cabo (o teste de partida pegou o caso de um jogador parado no meio de dois cabos).
5. **O dreno extra entra no núcleo como "peso equivalente" na pressão**, para o alerta do HUD acender também quando o dano vem dos cabos, sem tocar na regra dos invasores.
6. **A ficha de fatos mostra o quadro misto, não a tese.** O levantamento achou fatos fortes (a Enel e o apagão de 3,1 milhões de unidades; o Compaj; os inquéritos da PF e do Cade) e casos **em aberto** (a Sabesp subiu 6,11% a 6,5% no primeiro reajuste; a saúde não tem comparação com dado). O jogo mostra o que aconteceu, com fonte, e **não afirma** o que a fonte não diz (que a Petrobras "foi privatizada"; que o presídio privado é sempre pior; que a conta "subiu por causa" da venda). É mais forte contra quem desmente. **As fontes primárias ainda não foram lidas:** é o passo antes do texto final.

**Por que registrar:** quem for fazer a parte B (o manifestante, a segunda entrada), o porto ou a Colossus em fases precisa saber como o andróide "se liga", que o rebelde pesado depreda, e que nenhum cartão do jogo diz mais do que a ficha.

## [2026-10-16] O ciclo do dia é só luz, calculado do relógio da partida; o azimute do sol não muda; e o que a campanha não vai fazer (Claude, P161 a P166)

**Situação:** o Comandante achou a praia clara demais para a hora do sol e com a iluminação pública acesa de dia, e pediu que a partida **comece no pôr do sol e termine em noite** em 5 minutos, com as luzes acendendo. Na mesma mensagem respondeu o `CAMPANHAS_E_CHEFES.md` e deu a história da campanha.

**Decisões:**
1. **O ciclo é visual, nunca simulação (G1/G2):** o relógio vem da missão em ondas, da rodada de 5 minutos ou do relógio do mapa, e só muda luz, céu, mar e uniformes. Nenhuma regra de jogo lê a hora do dia (os bots não veem pior de noite): se um dia ler, vira módulo de `sim/` com teste.
2. **O azimute do sol é fixo; só a altura muda.** As sombras assadas no chão leem só o x e o z do sol; mudar o azimute exigiria assar de novo. O custo: a sombra não alonga com o pôr do sol (ela some quando o sol apaga).
3. **A luz pública liga por adereço, com um instante por adereço**, igual no bulbo, no halo, na poça e no feixe; a sinalização fica sempre ligada. Um único número (`lampadas`, 0 a 1) manda em tudo: o quadro de luz do porto (P164) vai ligar nele.
4. **`UniformesDaPraia` é o dono do sol, da lua, da névoa, da noite e das lâmpadas**, não constantes do módulo do céu. Regra aprendida: **`THREE.UniformsUtils.merge` clona cada uniforme**; o que se divide entre materiais entra depois dele, como o mesmo objeto (o mar lia uma cópia congelada do tempo e as ondas ficavam paradas).
5. **Sátira exagera, fato tem fonte na ficha.** O jogo vai ensinar (Estado provedor, privatização, laicidade, manipulação): toda afirmação factual leva fonte; sem fonte é sátira, dita como sátira.
6. **O que a campanha não faz:** criança com arma (nenhuma criança vira alvo ou arma) e personagem desenhado como evangélica (religião e quem a pratica ficam fora do alvo, a regra do `CAMPANHAS_E_CHEFES.md` § 2, que combina com o Estado laico que o Comandante defende); o rótulo "gado" fora do texto; "mulheres" fora do código do banco. **O que entra:** o manifestante dos eventos reais (Capitólio, 8 de janeiro), o manipulador/farsante como chefe e a máscara da Colossus V1 como skin de chefe, desligável (o risco jurídico e de plataforma está registrado).

**Por que registrar:** quem for construir a campanha precisa saber o que o Comandante ordenou, o que ficou de fora e por quê, e que o ciclo do dia é um número só que o quadro de luz vai ligar.

## [2026-10-16] Teste que roda `git` não pode herdar o ambiente do hook: um `git init` de teste corrompeu a config compartilhada (Claude, P155)

**Situação:** o teste das pendências do Estúdio (PR #339) cria um repositório de teste dentro de `.tmp/` e roda `git init`, `git config` e `git commit` nele. Rodando **dentro do hook de push** (que herda `GIT_DIR`, `GIT_INDEX_FILE`…), esses comandos agiram no repositório **de fora**: a `.git/config` compartilhada ficou com `core.bare = true` (o `git status` das worktrees passou a falhar e a principal virou "(bare)") e com um `[user]` falso (`t@t`). Os commits e o histórico não foram tocados; o dano ficou na config e foi desfeito à mão.

**Decisões:**
1. **Todo `git` filho de teste ou de ferramenta roda sem as variáveis `GIT_*`** (`ambienteSemGit`, em `scripts/estudio.mjs`). O `pendenciasDoGit` do Estúdio também, senão a lista de pendências mostrava `git: false` dentro do hook.
2. **O teste não usa `git config`:** a identidade vai por `-c user.email=… -c user.name=…` no próprio comando, e o `git -C <pasta>` fixa o alvo.
3. **O teto de busca do git (`GIT_CEILING_DIRECTORIES`) fica na pasta-mãe do repositório de teste:** se o `git init` falhar em silêncio, o comando seguinte falha em vez de achar o repositório de fora.
4. **Teste novo trava a causa:** roda o `pendenciasDoGit` com `GIT_DIR`, `GIT_INDEX_FILE` e `GIT_WORK_TREE` apontando para o lugar errado e exige a leitura certa (mutação à mão: sem o `env`, o teste falha). E o conjunto do Estúdio foi rodado com o ambiente do hook simulado, conferindo que a config compartilhada ficou **byte a byte igual**.

**Por que registrar:** o teste passava na máquina e só quebrava no hook, e o estrago era no repositório de todos os agentes. Quem escrever um teste que chame `git` precisa saber que o hook de commit e o de push herdam o ambiente. Se aparecer `bare = true` ou `[user] t@t` na `.git/config`: `git config --file .git/config core.bare false` e `--unset user.email` / `user.name`.

## [2026-10-16] A voz própria entra pelo Estúdio, convertida no servidor, tratada pelo mesmo motor e protegida do gerador (Claude, P151)

**Situação:** o Comandante achou o "Combate!" em português fraco e perguntou se devia gravar a própria voz. A resposta (sim) precisava virar um caminho de dois cliques, não um roteiro de arquivos.

**Decisões:**
1. **Gravar dentro do Estúdio, não largar arquivo numa pasta:** o microfone no navegador (permitido em `127.0.0.1`), com a fala escrita na tela, a intenção e um medidor de nível. Um roteiro de pastas e nomes de arquivo era um obstáculo para quem só quer gritar uma palavra.
2. **O servidor converte tudo para WAV mono 44,1 kHz:** o MediaRecorder do Chrome entrega webm **sem duração no cabeçalho**, e o que não tem duração não corta nem aparece na onda. Converter na entrada dá uma fonte limpa, e a tomada guarda a gravação intacta (dá para refazer o tratamento sem regravar).
3. **O mesmo motor de efeitos dos sons, com a interface como um componente do núcleo:** a prévia e o mp3 final continuam sendo a mesma cadeia; o que muda é o alvo de nível (-16 dB de média, para voz) e o limite de duração (8 s, não 4). A aba SONS passou a usar o mesmo componente, para as duas não divergirem.
4. **A voz do Comandante é protegida do gerador:** uma fala gravada por ele nunca é regerada pelo `npm run vozes`, nem com `--refazer`. Sem isso, o comando que ele mesmo vai rodar para gerar as falas restantes poderia pisar na gravação dele.
5. **A voz gerada fica guardada (`_elevenlabs/`) e dá para voltar:** gravar por cima não pode ser um caminho sem volta.
6. **O Voice Changer do ElevenLabs fica de fora:** gasta crédito por segundo, e o gasto de crédito é do `npm run vozes` (custo mostrado antes, chave só em variável de ambiente), não do Estúdio.

**Por que registrar:** quem for mexer no narrador precisa saber que a fala gravada vence a gerada, que existe a cópia da gerada, e por que o gerador pula certas falas.

## [2026-10-16] O Estúdio vira um hub de módulos; a prévia usa o mesmo motor do arquivo final; o Estúdio não publica (Claude, P155 a P157)

**Situação:** o Comandante quer um Estúdio ao lado da Mesa de vídeo: hoje de sons (importar e registrar, tom, velocidade, cortar, esticar, comprimir) e, no futuro, dos tiros, das armas e dos Mechs 3D.

**Decisões:**
1. **Hub com contrato, não uma ferramenta de som:** o núcleo guarda a segurança uma vez e cada módulo é dado + validador + prévia + processador. Quando vierem tiros e Mechs, entram no mesmo lugar, sem repetir a guarda.
2. **A prévia e o arquivo final são a mesma cadeia de ffmpeg** (`cadeiaBase`), e o volume é medido **depois** dos efeitos. Se a prévia fosse um aproximado no navegador, o Comandante ajustaria um som e o jogo tocaria outro. Esticar, comprimir e mudar o tom mudam a duração, então **a duração que vale é a de depois dos efeitos** (limite, fade, duração máxima da arma) e a cauda do eco é cortada nela.
3. **Importar já registra:** um arquivo que chega pelo Estúdio vira um clipe com nome único, entra no mapa, é processado e fica pronto, exatamente como o Claude faria, para não haver "arquivo solto" que o jogo não conhece. Arquivo que não é áudio é recusado sem deixar lixo.
4. **O Estúdio não publica:** commit, PR e merge ficam com o `npm run publicar` (o `check`, o `ESTADO_ATUAL`, o painel público sem o codinome). Um botão que os pulasse arriscaria a `main`; o Estúdio só mostra o que falta publicar e o que dizer ("publica os sons").
5. **Os testes cobram estrutura, nunca gosto**, e a **força** das armas (dano, alcance, recarga) fica **fora** do "gosto": é jogabilidade e continua com o relatório de equilíbrio e o teste de simulação (G14).
6. **Uma bancada nunca escreve na pasta real:** a primeira versão da bancada ponta a ponta importou o arquivo de teste para as referências do Comandante; ela passou a trabalhar numa cópia.

**Por que registrar:** quem for adicionar uma aba (vozes, tiros, Mechs) precisa do contrato do módulo e das razões das regras (prévia igual ao final, não publicar, estrutura e não gosto).
