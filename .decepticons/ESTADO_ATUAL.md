# ESTADO ATUAL — CYBERMECH

> **Arquivo:** o que tem mais de dois dias mora em `.decepticons/arquivo/estado-*.md` (nada se perdeu; `npm run arquivar` move mais). Procure por busca, não leia inteiro.

> **Arquivo:** o que tem mais de dois dias mora em `.decepticons/arquivo/estado-*.md` (nada se perdeu; `npm run arquivar` move mais). Procure por busca, não leia inteiro.

> **Arquivo:** o que tem mais de dois dias mora em `.decepticons/arquivo/estado-*.md` (nada se perdeu; `npm run arquivar` move mais). Procure por busca, não leia inteiro.

> **Arquivo:** o que tem mais de dois dias mora em `.decepticons/arquivo/estado-*.md` (nada se perdeu; `npm run arquivar` move mais). Procure por busca, não leia inteiro.

> **Arquivo:** o que tem mais de dois dias mora em `.decepticons/arquivo/estado-*.md` (nada se perdeu; `npm run arquivar` move mais). Procure por busca, não leia inteiro.

> **Arquivo:** o que tem mais de dois dias mora em `.decepticons/arquivo/estado-*.md` (nada se perdeu; `npm run arquivar` move mais). Procure por busca, não leia inteiro.

> **Arquivo:** o que tem mais de dois dias mora em `.decepticons/arquivo/estado-*.md` (nada se perdeu; `npm run arquivar` move mais). Procure por busca, não leia inteiro.

> **Arquivo:** o que tem mais de dois dias mora em `.decepticons/arquivo/estado-*.md` (nada se perdeu; `npm run arquivar` move mais). Procure por busca, não leia inteiro.

## A MISSÃO DO 8 DE JANEIRO ESTÁ PRONTA NO NAVEGADOR: A ABERTURA E O ROTEIRO PARA LIBERAR — Claude, 20/10 (branch `claude/janeiro-abertura`, P233)

**O Comandante (20/10):** *"conclua essa missão para finalizarmos e lançar o game!"*. **Feito:** a missão ganha a **abertura** (os primeiros 12 s: *"8 de janeiro de 2023. Uma multidão sai do acampamento diante do quartel e invade os Três Poderes para pedir a ruptura da ordem democrática. Defenda os prédios."*, a frase 🟢 que a ficha de fatos define; um teste a trava na ficha, palavra por palavra) e o **roteiro para liberá-la** (`LANCAMENTO.md` § 0). **A missão, de ponta a ponta no navegador (offline):** a abertura → a multidão chega pelas fontes e marcha às fachadas → os androides rebeldes (de preto) atacam → o jogador atira, assusta e investe → os prédios apanham da fachada e da sujeira → vence com os três de pé e a Praça vazia, ou perde → a nota (expulsos × eliminados) → o Relatório de Consequências com os fatos 🟢 e as fontes. **Tudo restrito** (`mapa:janeiro`, `tela:relatorio`).
**O que o Comandante faz para liberar (nenhum é código):** (1) **conferir os quatro fatos do Relatório nos documentos primários** e **um advogado rever a fase**; (2) **fechar o `?comandante=1`**; (3) **jogar uma vez** e dizer se os androides rebeldes e o desgaste dos prédios estão no ponto (os números são palpite); (4) SERVIDOR → VISIBILIDADE: `mapa:janeiro` e `tela:relatorio` para público. **Fica para a primeira atualização:** os faxineiros como agentes (a faxina é abstrata), a missão online, o Relatório em outras línguas, as falas do briefing no Estúdio. **A Estação dos Cabos não mudou** (espera o playtest dele ou a escolha do que melhorar).
**Provas:** 3 testes novos da abertura; 4 capturas da missão e do Relatório em `arte/janeiro-missao-*.png`; no Chrome com a GPU real, 0 erro de página.
**Próxima sessão começa com:** o que o playtest do Comandante achar (a calibragem dos rebeldes e do desgaste, o texto), ou os faxineiros agentes; ou a melhoria da Estação dos Cabos, se ele disser qual.

## O RELATÓRIO DE CONSEQUÊNCIAS DO 8 DE JANEIRO — Claude, 20/10 (branch `claude/janeiro-relatorio`, P233)

**O Comandante (20/10):** *"CONTINUA!!!!!"* (o 8 de Janeiro é a prioridade; "fase completa"). **Feito:** o fim da missão ganha o chip **RELATÓRIO ▸** (o mesmo da Amazônia: `ui/RelatorioPanel.ts`, pedaço sob demanda, só no clique), agora com **duas missões**: o resumo (`ResumoDaPraca`), o arquivo (`relatorio/janeiro/<língua>.json`, só português por ora; outras línguas caem no inglês e depois no português) e as linhas de "o que aconteceu" (`linhasDaPraca`: o desfecho, expulsos, eliminados, rebeldes, mesas limpas, a % não letal, o tempo). **Os fatos** são só os 🟢 da ficha `fichas/fatos-8-de-janeiro.md` (§ 5, a política de texto): **O DIA** (8/1/2023, a multidão do acampamento, a intervenção federal), **A CONTA DOS DANOS** (na ordem de R$ 30 milhões, balanço de jul/2025), **A RESPONSABILIZAÇÃO** ("mais de 600", penas de 3 a 17 anos) e **A TRAMA GOLPISTA** (o STF condenou os réus; "o golpe não se consumou"; a nota **desmente** a frase "os militares não aderiram"). **Sem nome de pessoa**; cada fato diz a fonte (com endereço), quando e **o que isto não diz**; a aba **O QUE É FICÇÃO** diz o que o jogo inventou (a multidão são tipos, a sujeira é humor, os números são do jogo, as faixas são em branco).
**Provas:** 6 testes novos (o arquivo vale com as chaves da Praça e não com as do rio; **cada fonte está na ficha de fatos**; nenhum nome de pessoa nos textos; o que a ficha libera e nada além, "mais de 600" no texto e o número exato só na nota; cabe na tela; as linhas e a ligação no `Game`); **no Chrome com a GPU real** (`medicoes/janeiro-missao.mjs`): o chip aparece depois da derrota e o painel abre com a fonte e "o que isto não diz" (`arte/janeiro-missao-relatorio.png`).
**Falta (R13):** **a revisão humana de cada fato no documento primário** e **a revisão jurídica** (a ficha de fatos § cabeçalho e a ficha de cenário § 9; **antes de liberar `mapa:janeiro` e `tela:relatorio` ao público**); as fontes são **secundárias** (reportagens; a pesquisa foi por busca na web em 19/10); só em português; os faxineiros como agentes; a missão online; o equilíbrio jogando.
**Onde conferir:** jogue `/jogar/?mapa=janeiro&modo=survival&comandante=1` até o fim (ou deixe um prédio cair) e clique em **RELATÓRIO ▸** no console.
**Próxima sessão começa com:** a calibragem dos rebeldes e do desgaste com o playtest do Comandante; os faxineiros agentes; o briefing da missão (o texto da ficha § 5, item 2) e as falas dele no Estúdio.

## OS ANDROIDES REBELDES DA MISSÃO DO 8 DE JANEIRO — Claude, 20/10 (branch `claude/janeiro-rebeldes`, P233)

**O Comandante (20/10):** *"CONTINUA!!!!!"* (a missão do 8 de Janeiro é a prioridade). **Feito:** os **androides rebeldes** (o único inimigo que luta, ficha § 2) entram na missão: um pool de **6** do `BotSystem` (`androidSpawns` da Praça, de **preto**: `androidPaint`), que entram em campo **no cronograma da multidão** (`Multidao.androides`: os ~5% da cota que são rebeldes, no tick e no ônibus agendados) por `BotSystem.entrarAndroide` (nada é criado no tick, G4/G5). Sem vaga (6 vivos), o próximo espera. Eles **contam na Praça**: seguram a vitória (por chegar ou vivos) e a derrota por tempo; os derrubados vão para o placar (`rebeldes`), fora da nota não letal. O painel mostra `REBELDES n` e a linha de cima conta a Praça com eles. O reinício os tira de campo e o cronograma recomeça.
**Provas:** 4 testes novos no `Match` (entram no cronograma, nunca mais que 6 vivos, contam na Praça e nos por chegar, derrubar um conta e libera a vaga, o reinício) e 1 da regra; **no Chrome com a GPU real** (`medicoes/janeiro-missao.mjs`): 6 rebeldes em campo aos 34 s, **106 fps (p95 17 ms), 63 desenhos, 25 mil triângulos**; foto de um rebelde atacando o Mech em `arte/janeiro-missao-rebelde.png`. **Atenção (R13):** em 75 s parados, 6 rebeldes **derrubaram o Mech**: o equilíbrio dos rebeldes (quantos, quando, a vida e o dano deles) é palpite e é a primeira coisa a calibrar no playtest. O erro de rede `ERR_CONNECTION_REFUSED` que a bancada mostrou é o servidor de jogo local desligado, não a missão.
**Falta (R13):** os **faxineiros como agentes** (a faxina segue abstrata); a missão online, as armas de feixe e de chama contra a multidão, o contador ABATES do HUD e o equilíbrio jogando.
**Onde conferir:** `/jogar/?mapa=janeiro&modo=survival&comandante=1`: aos ~30 s os androides de preto começam a chegar; ou `?...&depurar` e `__game.match.rebeldesVivos`.
**Próxima sessão começa com:** (o Relatório já entrou: seção acima) a calibragem dos rebeldes com o playtest do Comandante e os faxineiros agentes.

## O MICROFONE QUE CAI: O JOGO VÊ, DIZ E REABRE SOZINHO; GANHO DO MICROFONE — Claude, 20/10 à noite (branch `claude/voz-microfone-e-canais`, P237, PR 2 de 3)

**O Comandante (20/10, 22h):** *"novamente o microfone parou de funcionar… não tô conseguindo nem ouvir o microfone no Windows agora! o fone tá funcionando mas o microfone não! prossiga com o próximo ciclo e resolva definitivamente esse bug do voice chat!"* **Achado (Windows, só leitura):** todos os pontos do Captain 300 ativos, sem mudo, nível alto; nenhum app segura o microfone; o Gravador de Voz do Windows (22:04) abriu e não recebeu som: **é o fone/Bluetooth, abaixo do jogo**; o jogo não consegue consertar um fone. **Feito (PR 2):** `voice/EnvioDeVoz.ts` (grafo de Web Audio só do chat: microfone → ganho → limitador → analisador → uma **porta por colega**), `voice/saudeDoMic.ts` (vigia: silêncio total por 8 s = "sem-som"; faixa parada = "sem-entrega"; sugestão de ganho), `VoiceChat`: ganho, **reabertura automática** (1,5/3/6/12/24 s, `devicechange`, nada se recusado ou desligado), `mute`/`unmute` da faixa; HUD com a barra de nível e o alerta; Configurações > CHAT DE VOZ > **Ganho do microfone** (0,5x a 4x: chat, teste com a dica, narração). **Provado:** testes (saudeDoMic 15, EnvioDeVoz 8, VoiceChat +13, HUD +5, MicTest +5, GameRecorder +3, Settings +1), **14 de 14 mutações pegas**, e no Chrome real: `voz.mjs` **26/26 pelo grafo novo**, `voz-microfone.mjs` (17: ganho x3 = +9,5 dB no outro lado, microfone derrubado reaberto em 1,6 s, silêncio total aos 8,0 s) e `voz-teste-mic.mjs` (o controle na tela real). **Falta:** PR 3 (canais Todos / Time / Jogador; o "time" espera o contrato de rede) e **o Comandante resolver o fone** (mudo/braço do microfone, testar a entrada USB e a Hands-Free, e se for Bluetooth, remover e parear de novo).

**Próxima sessão começa com:** o que o Comandante disser do fone; PR 3 (canais): as portas por colega já existem no `EnvioDeVoz`, falta a regra (teclas, alvo privado, time) e o HUD.

## A VOZ AO VIVO: O JOGO PASSA A DIZER POR QUE NÃO FUNCIONA, E A NARRAÇÃO VAI PARA O F8 — Claude, 20/10 (branch `claude/voz-ao-vivo`, P237, PR 1 de 3)

**O Comandante (20/10):** o efeito de voz funcionou no teste, mas a voz não chegou ao outro PC ao lado; o F10 (a narração) abria o painel admin do Hangar; o Captain 300 soa baixo; e ele quer escolher falar com o time, com todos ou com um jogador. **Achados:** (1) **F10 é tecla do Windows/navegador** (o menu): a narração passou para o **F8**. (2) **A voz funciona** entre dois navegadores (`voz.mjs` 26/26; no Brave a conexão fecha em < 1 s), mas o jogo **não dizia por que** quem ficava fora da voz estava mudo. **Feito (PR 1):** aviso no canto com o motivo; o HUD diz "n na sala sem voz"; `Configurações > CHAT DE VOZ > [ VER E COPIAR ]` (`voice/Diagnostico.ts`, `VoiceChat.diagnostico()`) mostra e copia o relatório com a rota de rede de cada ligação e a CONCLUSÃO. **Provado:** testes (Diagnostico 13, VoiceHud, elegibilidade, VoiceChat +4) e no Chrome real `medicoes/voz-diagnostico.mjs` (9 verificações: convidado vê o aviso; dois adultos "Tudo certo"; adulto com convidado na sala conclui a causa). **Falta:** PR 2 (ganho do microfone, nível ao vivo) e PR 3 (canais todos / time / jogador; o time precisa do contrato de rede: salas sem times hoje). O Comandante precisa **falar** no teste com o ponto USB do Captain 300 (o Windows o mostra ativo e sem mudo, 92%, mas sem voz ele entrega zero): se a barra mexer, ele é o melhor microfone; se não, vale o Bluetooth com o ganho do PR 2.

**Próxima sessão começa com:** PR 2 (ganho do microfone: ajuste nas Configurações, aplicado ao chat, ao teste e à narração) e PR 3 (canais); antes, perguntar ao Comandante o que o diagnóstico concluiu nos dois PCs.

## A MISSÃO DO 8 DE JANEIRO, JOGÁVEL (v1, OFFLINE) — Claude, 20/10 (branch `claude/cabos-e-janeiro`, P233)

**O Comandante (20/10):** *"quero na sequência evoluir a missão do 8 de janeiro (essa é nossa prioridade atual, entregarmos essa fase completa)"*. **Feito (passo 5 da ficha, primeira metade):** `?mapa=janeiro&modo=survival&comandante=1` joga a missão. **A regra** (`sim/MissaoJaneiro.ts`, pura, 13 testes): três prédios com integridade 1.000 que cai com quem está na fachada (1,4/s por figurante) e com cada mesa suja do saguão (1,0/s); parte de quem chega suja uma mesa (18%, sem sorteio ao vivo, G2); os faxineiros limpam uma mesa em 3 s (**abstratos** na v1: N por prédio, sem andar); vence com os três de pé e a Praça vazia, perde com um prédio a zero ou o tempo passado; a nota é `expulsos ÷ (expulsos + eliminados)`. **No `Match`:** a multidão (`sim/Multidao.ts`) avança por tick (relógio da missão, o mesmo no servidor e no cliente), o tiro do jogador a acerta (`ProjectileSystem.contraMassa`; o tiro hostil a atravessa), a explosão a derruba e assusta, o jogador por perto (6 m) a assusta e o dash (a "porrada") leva quem está no caminho; o fim sai pelo aviso de missão; o reinício volta tudo (`Multidao.reiniciar`, `MultidaoDesenho.recomecar`). **Na tela** (`environment/JaneiroJogo.ts`, pedaço sob demanda): a multidão desenhada, as mesas sujas (montinhos) e o painel dos três prédios (barras que mudam de cor), a linha da missão e a nota no fim. **Pacote de partida:** a multidão e a regra moram em `sim/MissaoJaneiroPedaco.ts`, carregado com o mapa (`exigirMissaoJaneiro`); o pacote ficou em 468,9 KB de 500.

**Provas:** 13 testes da regra + 10 do `Match` (o tiro do jogador acerta e o hostil não, a explosão, a investida, o susto, parado perde entre 1 e 4 min, o fim congela o mundo, o reinício, a mesma semente) + o reinício do desenho; **no Chrome com a GPU real** (`medicoes/janeiro-missao.mjs`): **175 fps (p95 9 ms), 40 desenhos, 30 mil triângulos, 0 erro de página**, a multidão chegando às fachadas, o tiro derrubando, a tela de derrota. Capturas: `arte/janeiro-missao-*.png`.

**Falta (R13):** os **faxineiros de verdade** (andar até a mesa; vulneráveis); o **Relatório de Consequências com fatos e fontes** e a **revisão jurídica** (não é código); a **missão online** (O4); as armas de feixe, chama e o canhão sônico não atingem a multidão; o contador ABATES do HUD não conta a multidão; o teto da qualidade (`limitar`) não está ligado ao `Quality.ts`; **os números são palpite** (parado o jogador perde aos ~174 s de 300): falta jogar. **A Estação dos Cabos não mudou** (precisa do playtest do Comandante ou da escolha do que melhorar: P233).

**Onde o Comandante confere:** `/jogar/?mapa=janeiro&modo=survival&comandante=1` (só você vê; para liberar: SERVIDOR → VISIBILIDADE → `mapa:janeiro`). Tente: ficar na frente do Congresso atirando; deixar tudo para a multidão e ver um prédio cair em ~3 min; assustar à distância (a multidão foge a 6 m) e ver a nota "não letal".

**Próxima sessão começa com:** (os androides rebeldes já entraram: seção acima) o Relatório com as fontes e os faxineiros agentes; ou o que o playtest do Comandante achar.

## A LINHA FINAL: LANÇAR COM O QUE JÁ É REAL (CIDADE NEON + ESTAÇÃO DOS CABOS) — Claude, 20/10 (branch `claude/lancamento-enxuto`, P232)

**O Comandante (20/10):** *"devemos focar em apenas UMA delas pra lançar logo e depois continuamos os detalhes das outras?"* **Decisão (em `LANCAMENTO.md` § 0):** sim. Lança-se com o escopo de 18/10, que o código já cumpre: só `mapa:arena` e `mapa:praia` são públicos no catálogo; a **Estação dos Cabos** é a missão de vitrine. **Terras Raras** (real offline; abre no painel sem deploy) e **8 de Janeiro** (a missão não existe, ≈ 7 PRs e revisão jurídica) ficam EM BREVE. O **co-op online** (A1 a A3 do `CAMINHO_DO_LANCAMENTO.md`) é a primeira atualização, não o lançamento. **Regra para os agentes:** nenhum mapa, missão, arma ou modo novo até o lançamento; só bloqueio, bug do playtest e ordem do Comandante.

**Conferido na produção em 20/10 (R13):** o atalho `?comandante=1` está **aberto** (`deploy-site.json` sem `comandantePorLink`), a `tela:voz` está **pública** no `/status` (sem a denúncia que o `CAMINHO_DO_LANCAMENTO.md` § 5 exige), o site e o servidor respondem. O código de segurança já foi auditado (`AUDITORIA_SEGURANCA.md`); o que bloqueia o público é operacional e do Comandante.

**Falta (do Comandante):** jogar uma vez a Sobrevivência da Cidade Neon e a missão da Estação dos Cabos até o fim; convidar 5 a 10 pessoas; dizer "pode fechar" (o `?comandante=1`); voltar a voz a `restrito` no painel; o nome do encarregado na política; o DKIM/DMARC (`LANCAMENTO.md` § 7B).

**Próxima sessão começa com:** o que o playtest do Comandante achar (no máximo 1 PR de equilíbrio); depois o "pode fechar" (escrever `"comandantePorLink": false` em `.tmp/servidor/deploy-site.json` e publicar) e a leitura do `/metricas` no teste com gente de fora.

## A NARRAÇÃO: F8 GRAVA A PARTIDA COM A SUA VOZ — Claude, 20/10 (branch `claude/narracao`, P230)

**O Comandante (20/10):** *"não consegui ouvir NO jogo. é só no online que o áudio funciona? e se eu quiser jogar offline e ir narrando?"* O chat de voz é só online (ninguém se ouve) e o F9 nunca gravou o microfone. **Feito:** **F8** grava a partida **com a voz de quem joga**, offline ou online (`GameRecorder`: o microfone entra só na mistura da gravação, nunca na saída do jogo; `Game.ts` abre o aparelho escolhido só para conta de maior de 18 anos, `microfoneDaNarracaoLiberado`; indicador "REC · NARRAÇÃO"; parar solta o microfone; sem o áudio do jogo ainda, não grava e avisa). **Provado:** 12 testes do gravador + 2 da regra, 8 de 8 mutações pegas, `medicoes/gravacao-narrada.mjs` (Chrome real, ffmpeg mede o arquivo: voz −13,5 dB na narração e −77 dB no F9; nunca na saída) e `medicoes/gravacao-narrada-jogo.mjs` (o jogo de verdade: convidado barrado com aviso, adulto grava, o tom do microfone está no arquivo). **Falta:** o Comandante gravar um take e ouvir; os efeitos de voz (P231, PR seguinte).

**Os efeitos de voz (P231, branch `claude/efeitos-de-voz`):** **Efeito na minha voz** (Sem efeito, Locutor militar, Lorde sombrio, Grande Irmão) nas Configurações, aplicado à narração (F8) e à prévia do teste do microfone, **não ao chat**. `voice/EfeitosDeVoz.ts` (sob demanda; os números são uma tabela, `PREDEFINICOES_DE_VOZ`), ligado por `GameRecorder.alternar(microfone, fábrica)`, `Game.abrirNarracao` e `MicTest.trocarEfeito`. **Provado:** 14 + 12 + 21 testes, 8 de 8 mutações, e no Chrome real `medicoes/efeitos-de-voz.mjs` (29 verificações), `gravacao-narrada.mjs` (14) e `gravacao-narrada-jogo.mjs` (13). **Falta:** o ouvido do Comandante (eu não ouço): afinar a tabela se pedir; decidir se o efeito vale também no chat.

**Próxima sessão começa com:** o que o Comandante disser depois de ouvir os efeitos (afinar a tabela); depois o que ainda está aberto na voz (denúncia, idade no chat de texto, aviso às contas antigas).

## O DEPLOY DO ACTIONS DESLIGADO — Claude, 19/10 (branch `claude/actions-sem-deploy`, P221)

**O Comandante (19/10):** sem gastar o Actions à toa, mantendo tudo funcionando. **Feito:** o job `deploy` do `ci.yml` só roda com a variável `DEPLOY_PELO_ACTIONS = true` (ausente = "pulado", não vermelho); o site segue pelo PC. Secret não tocado. **Falta:** decidir se o `check` também deixa de rodar no push da `main` (é repetição do que o PR já provou; as métricas de deploy dos bastidores leem essas execuções).
## O MICROFONE DE VERDADE: A ESCOLHA DA LISTA ERA IGNORADA — Claude, 20/10 (branch `claude/mic-real`, P229)

**O Comandante (20/10):** o teste do microfone continuava mudo no jogo, embora o microfone funcionasse no Windows. **Medido no PC dele (Brave, fone Captain 300):** o jogo pedia o aparelho como `ideal` e o navegador **ignorava a escolha** (abria sempre o padrão); o limite de "captando" deixava de fora o fone Bluetooth; e o **"Microfone (Captain 300)" USB entrega zero absoluto** (mudo ou desligado no Windows). **Feito:** pedido `exact` (teste e chat), medição em ponto flutuante, "Aparelho em uso: …" e "Silêncio total" no painel. **Provas:** a classe `MicTest` de verdade contra os microfones reais do PC (`medicoes/mic-real.mjs`: Padrão e Headset **ok**, USB **silêncio total**, escolha respeitada), Chrome com microfone falso 15/15, 7 mutações pegas. **Para o Comandante:** escolha **Padrão** ou **Headset (Captain 300 Hands-Free…)**; o "Microfone (Captain 300)" USB está mudo no Windows (Configurações de som > Entrada). **Falta (R13):** avisar no chat (fora do teste) que o aparelho está mudo; ouvido real entre dois aparelhos.


## O PACOTE DE PARTIDA: NEM TUDO PRECISA ESTAR NOS 500 KB (A ESTAÇÃO DOS CABOS SAIU DELE) — Claude, 20/10 (branch `claude/praia-sob-demanda`, P227/P228)

**A pergunta do Comandante:** *"nesses 500 KB, será que tudo é realmente fundamental estar ali? temos que ser econômicos, estratégicos e sempre otimizar tudo antes de continuar desenvolvendo."* **A resposta, medida** (`npm run peso`, o gzip estimado por arquivo-fonte do pacote que todo jogador baixa): o pacote tinha **~510 KB** (no teto) e **tinha o que só alguns usam**: o cenário da **Estação dos Cabos** (Praia, ~25 KB: céu, mar, porto, gente, luzes, sombras) e o **HUD de missão** (~9 KB: só a Sobrevivência e a Praia o usam), baixados também por quem joga o Deathmatch na Cidade Neon. **Feito:** os dois viraram pedaços **sob demanda** (o padrão da Amazônia e da Praça: `mapasSobDemanda.ts`, interfaces `InstanciaDaPraia` e `HudDaMissao`; `Game.create` os baixa antes de montar a partida). **Resultado: de ~510 KB para 463,9 KB (folga de 36 KB).** **Provas:** 1.336 testes dos arquivos tocados passam; **no Chrome**, nos 4 casos (Cidade Neon em Deathmatch **não baixa** nenhum dos dois; Cidade Neon em Sobrevivência baixa só o HUD; a Estação dos Cabos, em Deathmatch e em Sobrevivência, baixa os dois), **0 erros de página** e a cena desenha.
**O que ainda pesa e não é de todo mundo** (candidatos, por tamanho): **Hangar** (`HangarMenu` 8,9 + `HangarScene` 4,9 + `weaponModels` 3,3 + `mechBlueprint` 2,8 ≈ 20 KB; o jogo o pré-compila de propósito ao jogar, então sob demanda exige mexer nisso), **`PraiaLayout` e os dados da missão da Praia** (~10 KB, usados pela simulação e pelo radar), `TouchControls` (2 KB, só toque), `SpectatorCam` (2 KB), `SettingsMenu` (2,9 KB). **Regra para quem vem:** antes de acrescentar código de cliente, `npm run peso`; o que só alguns jogadores usam (um mapa, um modo, uma tela, um dispositivo) entra **sob demanda**, com o `import()` dentro de um pedaço de partida (não no `main.ts`: o `smoke` conta como "de partida" tudo o que o próprio `index` cita).
## O TOKEN QUE NÃO SOME E O PAINEL DO SERVIDOR COM O MAPA DE CADA SALA — Claude, 20/10 (branch `claude/painel-do-servidor`, P227)

**Achado:** o botão **[ SAIR DO PAINEL ]** do painel do servidor **esquecia o token** deste aparelho (a dica dizia, mas o nome mandava "fechar"): era por isso que o Comandante digitava o token de novo. **Feito:** (1) `[ FECHAR ]` fecha e mantém o token; "esquecer token" virou botão discreto com confirmação (`ServerPanel`); (2) **sem o token do dono, `TokenDoDono.ler()` devolve a sessão da conta deste aparelho**: o servidor já aceita a sessão de uma conta de administrador no lugar do token (P106), então quem entrou na conta de administrador não digita token no painel do servidor, no de visibilidade nem no mural; (3) a sala no painel mostra o **nome do mapa** (`ESTAÇÃO DE CABOS`) em vez do sufixo cru. **Provas:** 2 testes novos (a sessão como fallback e o token do dono que manda; o nome do mapa). **Falta:** o resto da "evolução do painel" (o Comandante não detalhou): propostas no PR.

## O DEPLOY AINDA PARAVA: O TESTE DO HOOK (GIT + BASH DE VERDADE) ESTOURAVA 30 s — Claude, 20/10 (branch `claude/timeout-dos-testes-de-hook`)

**O que o log do atualizador mostrou depois do #418** (`atualizacao.log`, 20/10): a verificação do `b102548` reprovou às 05:35 e às 05:39 (UTC). Na segunda, com a máquina calma, **855 de 856 testes passaram** (302 s) e o único reprovado foi `server/juncaoJaVerificada.test.ts`, o de ponta a ponta que monta um repositório e roda o hook `pre-push` com `git` e `bash` de verdade: **estourou os 30 s**. É o mesmo arquivo que reprovou às 04:36, às 05:35 e no push local. Alguns fatos que explicam a sequência: (1) o `--retry=2` do #418 **não ajuda aqui**, porque o atualizador roda o próprio código de antes do merge e a verificação reprovada volta o disco para o código velho; (2) um **limite de espera de teste vale no mesmo ciclo em que chega** (o arquivo de teste é lido depois do merge), por isso a correção é esta.

**O que entrou:** `{ timeout: 120_000 }` nos três blocos que usam `git`/`bash` de verdade (`avaliarJuncao` e o hook de ponta a ponta em `juncaoJaVerificada.test.ts`; o hook em `hookPrePush.test.ts`). O limite global (30 s) não mudou. Provado: um teste descartável confirmou que o vitest 5 aplica o `timeout` do `describe` (também com `.skipIf`) por cima do global; os 23 testes dos dois arquivos passam em 45 s.

**Feito pelo Comandante (20/10):** rodou `.\scripts\servidor-atualizar.ps1` como administrador e a tarefa "CYBERMECH atualizar" agora tem o limite de **20 min** (`PT20M`, conferido: estado Ready, último resultado 0). Isso acaba com as rodadas cortadas em 5 min e o atropelo da pasta `.tmp/vitest`.

**Próxima sessão começa com:** conferir no `atualizacao.log` que o `b102548` (e o `4728d23`, da voz) chegaram: `OK: …` e `servidor religou no código novo`; depois que o log da subida não traz mais `Cannot access 'auditoria'`.

## O DEPLOY PARAVA POR TESTE LENTO E O LOG MENTIA NA SUBIDA — Claude, 20/10 (branch `claude/faxina-e-retry`)

**O que aconteceu hoje:** o merge do HSTS (#414) levou **três ciclos** do atualizador para ir ao ar: a verificação (`test.mjs run --no-isolate server shared`) reprovou às 01:36 e às 01:51 com testes **diferentes** (timeouts de 20 a 30 s no `mural`, uma corrida de tempo no `mapas`), todos passando sozinhos em 24 s; na terceira, com a máquina quieta, passou em 2 min e o servidor religou (protocolo 21, 0 jogadores). O PC do dono estava com CPU a 92% e 420 MB de RAM livre (navegador, Antigravity, outros agentes). É o terceiro episódio igual (17/10, 19/10, 20/10).

**O que entrou:**
- **`--retry=2` na verificação do atualizador** (`scripts/atualizador.mjs`): um teste que estoura o tempo sob carga é repetido até 2 vezes; **falhar 3 vezes seguidas continua reprovando**. Provado com um teste descartável (reprova sem a opção, passa com ela) e travado em `server/atualizador.test.ts`.
- **O aviso falso do log** `não consegui varrer sessões e atividade vencidas: Cannot access 'auditoria' before initialization`, que aparecia a cada reinício desde 18/10: o `faxinar()` rodava antes do `const auditoria`. O `try/catch` o engolia e `auditoria.podar()` rodava logo depois, então **o comportamento não mudava**; só o log mentia. A primeira faxina agora roda depois de a auditoria existir. Teste em `server/dados.test.ts` (reprovava antes do conserto).

**Custo de CPU:** nenhum no jogo (nada disso corre no laço de 60 Hz). O retry só gasta tempo quando um teste falha.

**Limite honesto:** o retry não cura máquina sufocada (os workers do Windows ainda morrem por falta de memória: 0xC0000409 e o `tsgo` com errno 1455 também aconteceram hoje). A regra de ficar quieto depois de um merge continua. O remédio de verdade é o PC do dono ter RAM/arquivo de paginação de sobra; decisão dele.

## O HSTS DO SITE: A CLOUDFLARE NÃO O COBRIA, O SITE É SERVIDO PELA HOSTINGER — Claude, 19/10 (branch `claude/hsts-do-site`, P207)

**O Comandante (19/10):** *"o cloudflare também já fiz"*. **Conferi:** o `cybermech.online` (o site) responde com `Server: hcdn` (a CDN da Hostinger): **não passa pela Cloudflare**; só o `jogo.cybermech.online` passa. Logo o HSTS da Cloudflare não cobre o site (e o `jogo.` ainda não manda o cabeçalho). **Feito:** `Strict-Transport-Security: max-age=15552000` (180 dias, sem `includeSubDomains` nem `preload`) no `.htaccess` do site (`scripts/site.mjs`), conferido pelo `site --check`. Já vale quando o site for publicado. A opção "visitor location headers" da Cloudflare vale para o `jogo.` (é lá que o servidor lê o estado); aparece em "De onde vêm" quando entrarem visitas do Brasil.

## JOGAR COM O MICROFONE: O CAMINHO ATÉ A VOZ — Claude, 20/10 (branch `claude/voz-conta-facil`, P227)

**O Comandante (20/10):** o microfone funciona no Windows mas não conseguiu usar nem testar no jogo; aprovou as decisões pendentes da voz. **Causa:** o portão de idade escondia a voz sem dar caminho. **Feito:** botão [ CRIAR CONTA ] / [ INFORMAR MINHA IDADE ] na seção do chat de voz; Chrome real 36/36. **Para jogar com voz:** criar a conta (ou informar a idade, se a conta é antiga) em Configurações > GRÁFICOS E SOM > CHAT DE VOZ; depois TESTAR e entrar numa sala online. **Falta (R13):** mudo por jogador, aviso às contas antigas, idade no chat de texto, a prova positiva em produção (a rede daqui para o servidor está intermitente).

## O MUDO POR JOGADOR NO CHAT DE VOZ — Claude, 20/10 (branch `claude/voz-mudo`, P228)

**Feito:** em Esc > REDE, cada piloto tem **[ SILENCIAR VOZ ]** (aparece só para quem está na voz); silenciar desliga a faixa dele (custo zero), o indicador de quem fala some, e vale até sair da sala. 7 mutações pegas e a prova no Chrome real (`medicoes/voz-jogo.mjs`: o botão aparece, silencia o BRAVO falando e desfaz). **A bancada achou um defeito meu:** o botão só aparecia no próximo evento da sala, porque ninguém repintava a lista ao entrar na voz; corrigido. **Falta (R13):** a denúncia (decisão do Comandante: para onde vai a queixa) e o mudo sem pausar a partida.


## O HOOK NÃO REFAZ O CHECK DEPOIS DE UMA JUNÇÃO PURA COM A MAIN — Claude, 19/10 (branch `claude/hook-juncao`, P225)

**O Comandante (19/10):** economizar os 10 a 25 minutos do laço de push, com boas práticas. **Feito:** `scripts/juncaoJaVerificada.mjs` + o hook: depois de uma junção com a `main`, não refaz o check se a `main` entrou por cima de uma árvore já verificada e cada arquivo que mudou veio inteiro dela (ou é `.md`); mesclado dos dois lados roda tudo; `CYBERMECH_CHECK_COMPLETO=1` desliga (o `publicar --sem-ci` liga). 7 mutações pegas e a regra aplicada a junções reais. **Falta (R13):** só se confirma de verdade no próximo push depois de uma junção; os locales mesclados ainda rodam o check (próximo degrau no HISTORICO).


## O ACTIONS ECONÔMICO, SEM PERDER SINAL — Claude, 19/10 (branch `claude/ci-economico`, P223)

**O Comandante (19/10):** economizar o Actions "de forma inteligente, profissional, sem miséria". **Feito:** medi antes (235 min em um dia; a cota de ~2.000 durava ~8 dias) e cortei só a repetição: o push na `main` não refaz o check na árvore que o PR já provou (`scripts/ciJaProvado.mjs`, na dúvida roda tudo), etiquetas só ao abrir, rascunho não roda, e `npm run ci:consumo` mede. O check do PR e o hook seguem completos. **Falta (R13):** só se confirma de verdade no primeiro merge depois deste PR (o job do push deve terminar em ~1 min com "já passou no check do PR"); medir de novo com `npm run ci:consumo`.

> **Arquivo:** o que tem mais de dois dias mora em `.decepticons/arquivo/estado-*.md` (nada se perdeu; `npm run arquivar` move mais). Procure por busca, não leia inteiro.

## O ANALYTICS PEGAVA A PROPRIEDADE ERRADA: AGORA EXIGE O CÓDIGO DO CYBERMECH — Claude, 19/10 (branch `claude/analytics-propriedade-certa`, P207)

**O Comandante (19/10):** *"já liguei a admin api, tem como você testar?"*. **Testei, e achei um problema:** o Google aceita a chave e a Admin API responde, mas a conta de serviço **só enxerga a propriedade "odpandroid"** (o app Android do Olho do Pai, no "Default Account for Firebase"), não a do CYBERMECH (`G-2CCHDCEC7X`). A regra antiga ("a única propriedade") a escolheria e o `/metricas/` mostraria números do app Android como se fossem do jogo.

**O que entrou:** a descoberta só aceita a propriedade com um fluxo web do `G-2CCHDCEC7X` (`GA_MEDICAO_ID`; um teste confere que servidor, site e jogo usam o mesmo). Sem ela, o estado novo "propriedade-errada" diz os nomes que a conta enxerga e onde dar o acesso, e **nenhum relatório é pedido à propriedade errada**. `ga-propriedade.txt` continua valendo sem conferir. **Provas:** 7 testes novos (o caso real de hoje, ambíguo, ID escrito, código por variável, paridade do código) e **4 mutações à mão pegas**.

**Falta (dele, 2 minutos):** no Analytics, abrir a propriedade do **CYBERMECH** e dar **Leitor** ao e-mail da conta de serviço (`LANCAMENTO.md § 6C`); se essa propriedade ainda não existir, criar uma com fluxo web para `cybermech.online`. O servidor percebe em 30 s, sem reiniciar.

**Próxima sessão começa com:** conferir o `/metricas/` depois do acesso (hoje responde "só enxerga odpandroid").

> **Arquivo:** o que tem mais de dois dias mora em `.decepticons/arquivo/estado-*.md` (nada se perdeu; `npm run arquivar` move mais). Procure por busca, não leia inteiro.

## A PRAÇA DOS TRÊS PODERES: O MAPA DO 8 DE JANEIRO NO AR, COM A MULTIDÃO DESCENDO A ESPLANADA (PASSO 4 DA FICHA) — Claude, 19/10 (branch `claude/praca-mapa`, P217)

**O que foi feito:** o **chão** da fase do 8 DE JANEIRO, jogável no **Deathmatch** (offline e online) e **restrito ao Comandante** (`mapa:janeiro`).

**1. O mapa** (`environment/PracaLayout.ts`, dados puros, no pacote de partida, 3 KB; `environment/PracaMapa.ts`, desenho e colisores, **sob demanda**, 1,3 KB gzip): a **Esplanada** de 270 m com os ministérios (duas fileiras de caixas brancas com faixa de vidro), a avenida e os gramados; o **Congresso** (a laje, a **rampa** que sobe a 5 m, as **torres gêmeas**, a cúpula e a tigela); a **Praça** com o monumento no meio, o espelho d'água e o canteiro de cobertura; o **Planalto** ao norte e o **Supremo** ao sul, com a colunata voltada para a Praça; o lago a leste; a cerca do limite. **Colisores: abaixo de 310** (o teto do Bunker; o teste trava). Céu e luz de fim de tarde, estáticos: nada anima, nenhuma atualização por quadro.
**2. As fontes da multidão estão no mapa:** os dois **ônibus** parados na Esplanada, os quatro **bueiros** e as três **lixeiras** (`PRACA_FONTES`), as saídas e a frente de cada prédio (`PRACA_PREDIOS`). **Os nomes no jogo são os dos poderes** (LEGISLATIVO, EXECUTIVO, JUDICIÁRIO): a proposta da ficha (pergunta 1), sem nome de instituição nem de pessoa; **o Comandante ainda não confirmou**.
**3. A multidão no mapa de verdade:** `?mapa=janeiro&comandante=1&multidao=1&cota=2500&t=9000`: a demonstração sai dos ônibus, bueiros e lixeiras reais e marcha até a frente dos três prédios.
**4. Ligações:** o mapa é uma opção do seletor e do mapa-múndi (o pino **8 DE JANEIRO** agora abre o mapa, para quem o vê), entra no radar, no minimapa, no online (`MAPAS_ONLINE`, etapa O1 do P218: `?sala=X&mapa=janeiro`), no catálogo de visibilidade e nas campanhas (só o Deathmatch). As fotos: `.decepticons/arte/praca-*.png`.

**Provas:** 6 testes do mapa (o teto de colisores, os pontos de nascimento livres de bloco e de parede, os três prédios e as fontes dentro do mapa, o link, **a partida montando no mapa** com o jogador de pé no chão, e **a rampa subindo com um Mech de verdade** da Esplanada até a laje) e os testes antigos que enumeravam os mapas atualizados. **Na GPU real:** de **105 a 176 fps** nas seis vistas-chave (42 a 102 desenhos; 5 a 41 mil triângulos), e de **105 a 167 fps com 2.500 de multidão** (`medicoes/praca-fotos.mjs`).

**Falta (R13):** **os prédios não têm integridade e a missão não existe** (o passo 5 da ficha: as marchas, a sujeira nas mesas, os androides rebeldes e faxineiros, o objetivo na tela); o mapa só abre o **Deathmatch** (a Sobrevivência cai na Cidade Neon até a missão existir); o **mural de câmeras** do Comandante desenha a planta da Cidade Neon para qualquer sala; os ônibus, bueiros e lixeiras são **desenho e colisor**, não fontes vivas (quem despeja é o cronograma da fase); a arte é de caixas e cascas (o Codex pode refinar); o Congresso, o Planalto e o Supremo **não têm interior**; **o servidor não recusa mapa restrito** (só o cliente filtra: aceito na etapa O1).

**Onde o Comandante confere:** `/jogar/?mapa=janeiro&comandante=1` (só você vê; para liberar: SERVIDOR → VISIBILIDADE → `mapa:janeiro`), e `&multidao=1&cota=2500&t=9000` para ver a multidão descendo a Esplanada; no mapa-múndi, o pino 8 DE JANEIRO. Online: dois navegadores em `?sala=ARENA&mapa=janeiro&comandante=1`.

**Próxima sessão começa com:** a missão (passo 5 da ficha): a cota de chegadas ligada à `Multidao`, as integridades dos três prédios, a sujeira nas mesas e os faxineiros, os androides rebeldes e o objetivo na tela; e as respostas do Comandante às perguntas abertas da ficha.

## PROCESSO MAIS LEVE E O CI VERMELHO — Claude, 19/10 (branch `claude/processo-leve`, P220)

**O Comandante (19/10):** as iterações estão "MUITO grandes… overengineered?"; pediu as 5 regras de processo leve e que eu olhasse o GitHub vermelho.

**Feito:** (1) `AGENTS.md` **regra 19**: rigor proporcional ao risco (alto: servidor + teste + até 8 mutações + 1 bancada; baixo: só o teste de sempre), sem suíte inteira à mão antes do push, cada fato escrito uma vez, o menor PR que resolve. (2) O **hook de push não repete o check na mesma árvore** (`.tmp/check-ok/`; 8 testes, 3 mutações). (3) **O vermelho do CI tinha duas causas** (detalhe no HISTORICO): o teste `estudio-vozes` (503 sem `ffmpeg` no runner) e o smoke (`localhost:2567` recusado no runner); as duas reproduzidas e corrigidas. O CI voltou a rodar (2 a 4 min).

**Atenção:** o CI gasta minutos medidos; com a cota de volta, push repetido pode esgotá-la. Se parar, `publicar --sem-ci` (P105). **Falta (R13):** o verde do CI só vale quando o PR e a `main` passarem de verdade (o `npm run check` para no primeiro erro, e já apareceu um segundo vermelho atrás do primeiro).

**Próxima sessão começa com:** conferir o CI da `main` depois do merge; depois o mudo por jogador (voz) ou o que o Comandante mandar.

## O E-MAIL DO "ESQUECI A SENHA" PELO SMTP DA HOSTINGER, SEM SERVIÇO NOVO — Claude, 19/10 (branch `claude/email-smtp`, P206 parte 2)

**O Comandante (19/10):** a Cloudflare perguntou que "chave" guardar e ele não entendeu; *"como configuro o Resend também?"*. **Resposta:** o Resend não é preciso. O `cybermech.online` já usa o e-mail da Hostinger (MX e SPF conferidos no DNS): basta uma caixa. Na Cloudflare **não há nada a fazer** (o agente dela se confundiu com o plano B).

**O que entrou:**
1. **`MailerSmtp`** (`server/email.ts`): cliente SMTP de ~100 linhas com `node:tls` (TLS direto, porta 465; AUTH PLAIN ou LOGIN; UTF-8 em base64; recusa destinatário com quebra de linha ou vírgula), sem biblioteca nova. O Resend continua como alternativa.
2. **`npm run email -- iniciar | estado | testar <e-mail>`** (`server/emailCli.ts`): cria o `email.json` com a Hostinger preenchida (senha de exemplo que nunca vale), mostra o estado sem a senha e manda uma mensagem de teste pelo mesmo caminho do servidor, com a dica do que conferir se falhar.
3. **O servidor relê o `email.json` quando ele muda** (`MailerDaPasta`): ligar, trocar a senha ou desligar não exige reiniciar (e reiniciar derruba quem joga).

**Provas:** 13 testes com um **servidor SMTP de mentira de verdade** (socket que fala o protocolo e guarda o que recebeu) mais 6 da configuração e da ferramenta; **5 mutações à mão pegas** (destinatário sem validar, assunto sem tirar a quebra de linha, senha de exemplo valendo, autenticação aceitando recusa, arquivo nunca relido). **Não provado:** a Hostinger de verdade (falta a caixa e a senha).

**Falta (dele):** criar a caixa `nao-responda@cybermech.online` no hPanel (E-mails), `npm run email -- iniciar`, trocar a senha no Bloco de Notas e `npm run email -- testar seu@email.com` (`LANCAMENTO.md § 7`). **A política** já cita a Hostinger como quem entrega o e-mail (no lugar do Resend), sem mudar a `POLITICA_VERSAO` (mesmo conjunto de dados).

**Próxima sessão começa com:** o que o `npm run email -- testar` disser; se cair no spam, o DKIM/DMARC do domínio.

## A MULTIDÃO DO 8 DE JANEIRO: A SIMULAÇÃO PURA E O DESENHO NA GPU REAL (PASSOS 2 E 3 DA FICHA), VISTA NO JOGO — Claude, 19/10 (branch `claude/multidao`, P217 e P219)

**O que foi feito:** `client/src/sim/Multidao.ts`, a multidão da fase como **módulo puro de simulação** (sem tela, sem Rapier, sem DOM; G1, G2, G14), e a medida de CPU (`medicoes/MULTIDAO.md`).

**1. A ideia (a da ficha, § 3):** a posição de um figurante é **função do tempo**. Cada um nasce com fonte, tick, tipo, prédio-alvo e semente; a posição em qualquer tick é calculada (linha reta com um balanço de seno em parábolas por partes, sem `Math.sin`). Só o que o jogador causa é estado: `morreu(id, tick)` e `fugiu(id, tick)`. A chegada à fachada, a fuga automática depois do tempo na fachada e a saída pelo limite do mapa são **eventos agendados** (ponteiros sobre vetores ordenados).
**2. O que ele tem:** o cronograma de chegadas por **ônibus** (grupos grandes), **bueiros** (jatos) e **lixeiras** (fios), a cota finita da fase, os tipos GADO, CARECA e PERUCA (vida, velocidade e altura próprias), os androides rebeldes **agendados** (a missão os cria), o tiro (a linha da mira contra um cilindro, com a cabeça), a explosão (mata no raio, assusta até o dobro), o susto por perto (de 6 em 6 ticks), `contarNaFachada` (o que a missão usa para desgastar a integridade), os contadores que formam a vitória (`terminou`: cota despejada e Praça vazia) e **o modo espelho** para o cliente online: só aplica os eventos do servidor, e quem entra no meio da fase recebe o estado compacto (um bit por figurante mais as fugas).
**3. A medida:** **0,043 ms por tick** com as posições de todos recalculadas todo tick e 10 tiros por segundo (2.828 figurantes, pico de 1.465 na Praça), contra a estimativa da ficha de ≤ 0,3 ms.

**4. O desenho** (`environment/MultidaoDesenho.ts`, passo 3): três malhas instanciadas (**gado** com a cabeça de chifres, **careca** de colete e bigode, **peruca** loira; só **tipos**, nenhum nome, marca ou texto) com a **posição calculada na vertex shader** a partir do tick (a mesma conta da simulação, em GLSL), o balanço do andar, o gingado de quem grita na fachada, o tombo e a correria da fuga. **As vagas de instância:** cada figurante ganha uma ao nascer e a devolve ao cair ou sair: o custo na GPU segue quem está **presente**. Cada tipo tem **botão de desligar a máscara** (`MascarasDaMultidao`).
**5. A demonstração no jogo:** `?multidao=1` (+ `&cota=N` de 100 a 5.000, `&t=T` começa a fase no tick T, `&semente=N`), carregada sob demanda (7 KB gzip, fora do pacote de partida), na Cidade Neon: a multidão chega de ônibus, bueiros e lixeiras, marcha até três alvos a leste, para na fachada e foge; **quem chega a 6 m do jogador foge**. **É DEMO** (R13): os tiros do jogador ainda não a atingem, não há prédio nem integridade.
**6. A GPU real** (`medicoes/multidao-gpu.mjs`, `medicoes/MULTIDAO.md`): a multidão custa **de 1,2 a 2 ms** no quadro (14 ms de 16,7 no pico, com 3.000 de cota) e **achou dois defeitos que o SwiftShader não vê:** o shader tinha **17 atributos por vértice (o limite é 16): não compilava e a multidão sumia**, e o custo seguia quem **nasceu**, não quem está presente (350 mil triângulos; as vagas cortaram para 182 mil).

**Provas:** 15 testes de simulação + 9 do desenho (as três malhas, a conta dos 16 atributos, a cor empacotada, as vagas: o custo é o máximo de gente ao mesmo tempo, a fuga e o tombo chegam à vaga, quem entra no meio da fase só desenha quem está na Praça) + `ShadersSemNaN`. Os 15 de simulação: a mesma semente é a mesma multidão; a cota fecha; a mistura de tipos; a posição sem saltos e o destino no tick marcado; o ciclo completo sem jogador (todos chegam, fogem e saem; a Praça esvazia; `terminou`); pular ticks dá o mesmo que andar um a um; o tiro (de lado, de cima, errando, alcance); o gado cai com dois golpes e o ferido foge; a explosão; o susto; **o espelho chega ao mesmo lugar** que a autoridade e **quem entra no meio da fase fica igual**; o custo.

**Falta (R13):** **o teto de 80 mil triângulos da ficha NÃO foi atingido** (182 mil no pico; o critério de 60 fps foi, com folga pequena: **numa GPU mais fraca falta margem**): falta o **impostor de longe**, menos caixas por figurante e o **teto da qualidade** (`limitar()` existe e é testado, mas não está ligado ao `Quality.ts`); **o `varrer-nan` (shader novo, `FERRAMENTAS.md` § 4.1) deu 0 de 480 poses com NaN, mas na Praia com a multidão da demonstração, não no mapa da fase (que não existe)**; os tiros do jogador não atingem a multidão na demonstração, e **não há mapa, prédio nem missão** (passos 4 e 5); os números de vida e velocidade são os da ficha, sem balanço de jogo; a rede não foi medida.

**Onde o Comandante confere:** `/jogar/?multidao=1&cota=3000&t=9000` (em `?comandante=1` ou no PC dele): a multidão a meio caminho, já cheia; o jogador anda por entre ela e ela foge; as fotos em `.decepticons/arte/multidao-*.png`.

**Próxima sessão começa com:** o impostor de longe e o teto da qualidade (para chegar ao teto de triângulos), depois o mapa da Praça (passo 4); ou o que o Comandante responder às cinco perguntas da ficha.

## A IDADE E A VOZ SÓ PARA MAIORES DE 18 ANOS — Claude, 19/10 (branch `claude/idade-e-voz`, P211)

**O Comandante (19/10):** *"no início, perguntar a IDADE pra fazer o cadastro… menores de 18 anos NÃO TÊM ACESSO ao microfone nem aos áudios dos outros jogadores, apenas o áudio do jogo."*

**O que mudou:** o **cadastro pede o mês e o ano de nascimento** (duas listas, obrigatórias na tela; guardado `AAAA-MM`, sem o dia, e o servidor devolve só a faixa: `adulto`, `menor`, `sem-idade`). **Só conta de maior de 18 anos entra na voz, e quem decide é o servidor:** o `PRONTO` da voz leva o token da sessão e o relé confere a idade (`RelayDeVoz.autorizar`, padrão negar). Convidado, conta sem idade e conta de menor ficam **sem microfone e sem ouvir os outros**: o cliente esconde os controles (e o teste do microfone), nem pede o microfone ao navegador e mostra a frase certa; o áudio do jogo segue. Quem já tinha conta informa o mês e o ano **uma vez** na aba JOGO (`POST /conta/nascimento`; a data **não muda**, 409 na segunda vez) e a voz abre na hora, sem recarregar. Maioridade conta pelo mês: quem faz 18 **neste mês** ainda não é adulto.

**Junto:** política `2026-10-19.2` (e a data "em vigor" lê só o prefixo da versão), inventário `PRIVACIDADE.md`, a data no "Baixar meus dados", ação `nascimento_informado` na trilha (sem a data), tradução nas 6 línguas (e 18 frases da conta (P192) que tinham ficado só em português), o formulário da conta virou pedaço sob demanda (o JS de partida segue abaixo do teto), todas as bancadas de voz entram agora com conta de adulto (`vozLib.tokenDeConta`).

**Provas:** **Chrome real, 30 de 30** (`medicoes/voz-idade.mjs`: adulto liga ao colega; convidado e menor **nunca pedem o microfone** e ninguém se liga a eles; conta sem idade informa e a voz abre na hora; cadastro pela tela como adulto e como menor; **cliente adulterado** que manda o token de um menor, ou nenhum, é recusado pelo servidor); **3.569 testes verdes** (331 arquivos), com testes novos de contrato, relé, sala com contas reais, HTTP, migração de banco antigo, sessão, formulário e i18n; **32 mutações à mão, todas pegas**. Fotos em `arte/idade-cadastro-claude.png` e `arte/idade-menor-sem-voz-claude.png`.

**Limite (R13):** **a idade é declarada, não verificada**: quem mente na data entra como adulto. Verificar de verdade exigiria documento ou terceiro (custo, dado sensível). **Contas que já existiam estão "sem idade" e ficam sem voz até informarem**; a política promete avisar mudanças e o jogo ainda não tem um aviso para isso (a frase nas Configurações cumpre o papel por ora). Mudo por jogador e denúncia seguem sem existir.

**Decisão do Comandante:** quer algo mais forte que a data declarada? (tem custo e pede dado sensível). Até lá a regra reduz o risco, não o elimina.

**Próxima sessão começa com:** o mudo por jogador (o risco mais próximo da voz pública), ou a decisão do Comandante sobre a rádio (P210/P213).

## OS PILOTOS NA REDE: VER O HANGAR DO OUTRO E CONVERSAR POR TEXTO SEM SAIR DO HANGAR — Claude, 19/10 (branch `claude/chat-de-texto`, P216)

**O Comandante (19/10):** *"no painel REDE, quando tiver mais de um jogador online, coloque os nomes dos jogadores ali disponíveis pra podermos clicar neles, ver o hangar deles, fazer chat por texto com eles (sem sair do hangar)"*.

**1. A mensagem de texto (protocolo 33 e 34, sem subir o `PROTOCOL_VERSION`):** `shared/net/texto.ts` (formato, `limparTexto`: sem controle, sem quebra de linha, sem caractere que inverte a direção, até 160 caracteres) e `server/texto.ts` (`RelayDeTexto`: **só repassa**, com o **remetente trocado pelo id de verdade**, o texto já limpo, só a **outras pessoas** da sala (bot não é destino), **6 mensagens por 10 s por jogador**, nada guardado). A sala (`ArenaRoom`) só liga o relé. Servidor velho descarta o tipo; cliente velho nunca recebe.
**2. A lista na REDE:** `ui/RedePilotos.ts` (bundle inicial, minúscula): quando há outra pessoa na sala, cada nome vira um botão (nome, chassi, mensagens não lidas). `OnlineSession.pilotos()` entrega só pessoas.
**3. O Hangar do outro:** `HangarMenu.visitar(spec)` abre o Hangar com a montagem dele em **só leitura** (abas e encaixes se olham; chassi, nível, módulo, presets e APLICAR ficam travados; Esc e VOLTAR AO MEU HANGAR saem). O galpão 3D mostra o robô dele.
**4. A conversa (sem sair do Hangar):** `ui/VisitaPanel.ts` (**sob demanda**, R7) no lugar dos números: o histórico (60 linhas), o campo, ENVIAR, **SILENCIAR** (só neste cliente) e o aviso "devagar" antes de o servidor cortar. Tudo por `textContent`. O dado (`net/Conversas.ts`) mora no jogo desde o começo: a mensagem que chega com a tela fechada vira "não lida" e um **aviso curto** no canto durante a partida.
**5. Nasce restrito:** `tela:chat` no catálogo de visibilidade (P191): só o Comandante vê a lista, a visita e os avisos até liberar no painel; quem não vê descarta a mensagem que chegar.

**Provas:** 3 testes do texto (limpeza, formato, UTF-8 torto, grande demais), 3 do relé (remetente trocado, destinos inválidos, teto por janela), 1 com **servidor de verdade e dois jogadores** (Alfa escreve a Bravo, chega com o id e o nome certos, a lista só tem pessoas, texto sujo chega limpo, escrever a um bot não chega a ninguém), 3 das conversas e 1 do contrato do HTML e do catálogo.

**Falta (R13):** **não vi a tela no navegador** (a máquina estava sem memória: só testes e tipos): o Comandante confere; **sem denúncia** e sem moderação além do teto, do tamanho e do silenciar (o chat nasce restrito por isso); **os textos da visita e da lista estão só em português** (o `aria-label` da lista já tem as seis línguas; o resto fica sob `data-i18n="nao"` até o Comandante liberar `tela:chat` ao público: traduzir antes); telas estreitas mostram só a conversa na visita; sem som de mensagem nova; sem canal da sala inteira (só mensagem direta).

**Onde o Comandante confere:** dois navegadores em `?sala=ARENA` (o dele com `?comandante=1`, o outro com outro nome): pausa → REDE → o nome do outro → o Hangar dele, a conversa ao lado. Para o outro jogador também ver: SERVIDOR → VISIBILIDADE → `tela:chat` → PÚBLICO.

**Próxima sessão começa com:** o que o Comandante vir no teste de dois navegadores; depois a fase 8 DE JANEIRO (P217).

## O TESTE DO MICROFONE, O AVISO DE "SOZINHO NA VOZ", E A RESPOSTA SOBRE YOUTUBE E JUKEBOX — Claude, 19/10 (branch `claude/teste-do-microfone`, P212 e P213; P211 em andamento)

**O Comandante (19/10):** *"estou tentando testar o microfone mas não consegui! não saiu som. Seria bom ter um campo de testes?"*; só maiores de 18 na voz (P211); e uma **jukebox num prédio** com link do YouTube, "só se não pesar" (P213).

**P212, feito:** a causa provável é que **sozinho na sala ninguém te ouve** e o indicador não avisava. Agora: painel **TESTAR O MICROFONE** nas Configurações (aparelho, barra de nível, "ouvir a minha voz", motivo de cada falha; para sozinho ao fechar, trocar de aba ou em 2 min), aparelho que vale também para o chat (troca no meio da voz), e o indicador diz **"NINGUÉM MAIS NA VOZ: TESTE O MICROFONE EM CONFIGURAÇÕES"**. **Provas:** Chrome com microfone falso (`voz-teste-mic.mjs`, **14 de 14**, inclusive "parar solta o microfone de verdade" e o navegador que bloqueia), **15 de 15 mutações**, foto `arte/voz-teste-microfone-claude.png`.

**P213, só resposta e desenho (`RADIO_E_EMISSORES.md` § 7):** **o YouTube é problema** (o player tem de ficar visível e não separa o áudio; vem vídeo pesado; não toca no espaço; leva o IP de todo mundo perto ao Google; conteúdo sem moderação). Recomendo o terminal com **o catálogo do jogo** e "Sugerir um link". **Só entra se não pesar**: a primeira entrega tem de medir menos de 1 ms por quadro e no máximo 8 KB/s por emissor.

**O gate do push e a memória (mesmo PR):** dois pushes foram barrados por workers do Vitest mortos (`0xC0000409`), sem relação com o código: a **memória virtual do Windows estava no teto** (1,6 GB livres de 24) porque **seis sessões do Claude Code abertas mantinham 48 processos node dos servidores MCP da Hostinger (3,1 GB)**. **Peço ao Comandante: feche as sessões antigas do Claude Code** (é o que mais ajuda). No código, o `npm test` passou a contar a memória virtual livre e a usar 1 worker quando aperta (`CYBERMECH_WORKERS=1` força); 6 mutações pegas.

**P211 (idade):** feito no PR seguinte (seção acima): cadastro com mês e ano de nascimento; menores sem microfone nem a voz dos outros, **imposto no servidor**.

**Falta (R13):** (a) ~~P211~~ (feito); (b) **decisões do Comandante** sobre a jukebox (§ 7.5: YouTube fora, catálogo e licenças, qual prédio); (c) ninguém testou a voz entre dois aparelhos reais pela internet.

**Próxima sessão começa com:** ~~o portão de idade (P211)~~ (feito).

## O SEGUNDO TESTE ONLINE: O OUTRO JOGADOR VIA TODO MUNDO COMO VECTOR-09, E A JANELA DAS REGRAS POR TRÁS DA DO SERVIDOR — Claude, 19/10 (branch `claude/online-modelos`, P214 e P215)

**O Comandante (19/10), depois do segundo teste online (Colossus V4 num PC, Marauder no outro):** *"o outro jogador sempre me vê como vector 9 amarelo… ele não me vê como outro modelo"*; e a janela REGRAS DAS SALAS abria **por trás** da do servidor.

**1. A causa do robô errado (achada no código):** `Game.makeRemote` só distinguia o andróide: **toda outra pessoa virava Vector-09**, com os números do Vector-09. O servidor sempre soube o chassi (o roster leva a montagem); só o desenho errava.
**2. O que mudou:** `net/remotoDoRoster.ts` (função pura, testável) monta o **chassi da montagem** de quem entra: a malha importada (Marauder, Colossus V4, Lancer…) quando já baixou, senão a silhueta do chassi (`BLUEPRINT_BY_CHASSIS`), sempre com as armas e **os números dele**. A malha que ainda baixa deixa o robô **pendente**: o jogo o refaz quando ela chega (`OnlineSession.refazerRemoto`), sem esperar uma nova entrada na sala.
**3. A janela por trás:** `.vis-modal` (REGRAS e VISIBILIDADE) subiu de `z-index` 80 para 2100 (a do servidor é 2000).

**Provas:** 4 testes (todo chassi chega com os números dele e a silhueta certa; a malha que baixa deixa pendente; montagem torta cai no Vector-09 de fábrica; com a malha pronta sai o `ImportedMech` com os números do Marauder).

**Falta (R13):** **não vi dois navegadores jogando juntos** (testes de unidade e tipos, sim): o Comandante confere com o Marauder e o Colossus V4; o nome e a barra de vida do outro seguem como eram; a cor do Mech importado vem do arquivo (não há tinta de time nele).

**Onde o Comandante confere:** dois navegadores em `?sala=ARENA`, cada um com um chassi diferente: cada um vê o outro com o modelo dele. `?comandante=1` → SERVIDOR → REGRAS DAS SALAS: abre por cima.

**Próxima sessão começa com:** a lista de pilotos da REDE com o hangar deles e o chat de texto (P216), e a fase 8 DE JANEIRO (P217).

## A POLÍTICA DE PRIVACIDADE PASSOU A DESCREVER O CHAT DE VOZ, QUE O COMANDANTE JÁ LIBEROU AO PÚBLICO — Claude, 19/10 (branch `claude/privacidade-voz`, P205)

**O que aconteceu:** o `/status` do servidor mostrava `"tela:voz":"publico"` (o Comandante soltou a voz no painel de visibilidade) **antes** de a política mudar; eu tinha deixado o texto pronto como pendência de "antes de liberar". Com a voz pública, a pendência virou lacuna: a política dizia "o IP não é guardado" e nada dizia que **os outros jogadores da sala veem o IP** nem que o **STUN do Google** o recebe.

**Feito:** (1) `/privacidade/`: um item em "Em poucas palavras", uma linha em "O que guardamos" ("Você usa o chat de voz") e o **STUN do Google** em "Com quem compartilhamos"; (2) `POLITICA_VERSAO` → `2026-10-19` (quem for criar conta aceita a versão nova; o navegador com a velha é mandado recarregar); (3) `PRIVACIDADE.md`; (4) `server/politicaDeVoz.test.ts` renderiza a página de verdade e exige o IP, o STUN, a linha da tabela e a versão (**5 de 5 mutações pegas**), para a política não voltar a ficar sem a voz.

**Falta (R13):** (a) o Comandante **revisar o texto** (rascunho, não é parecer jurídico); (b) **mudo por jogador e denúncia**: a voz está aberta a desconhecidos, **inclusive a convidados sem conta (menores)**, sem moderação nenhuma; (c) a política promete avisar no jogo as mudanças que afetem contas existentes e **esse aviso não existe**: as contas antigas não foram reavisadas da versão nova (decisão do Comandante: aviso no jogo, ou aceitar que só vale para quem cria conta daqui para a frente).

**Próxima sessão começa com:** o mudo por jogador (o risco mais próximo da voz pública) ou a decisão do Comandante sobre a rádio (P210).

## O CHAT DE VOZ NO CELULAR: UM BOTÃO DE MICROFONE NA TELA, E O DESENHO DA RÁDIO E DOS EMISSORES DE SOM — Claude, 19/10 (branch `claude/voz-celular`, P209 e P210)

**O Comandante (19/10):** *"jogadores usando celular vão conseguir ouvir e falar automaticamente? como vai ser pra apertar o PTT se o celular é limitado de botões? quero maximizar a experiência"* e a visão da **música/rádio/autofalantes no mundo**.

**Respondido pelo código:** no celular **ouvir já era automático** e **falar também** (microfone aberto), mas **não havia como silenciar nem segurar-para-falar** (sem tecla T). **Agora há um botão de microfone** (`VoiceHud`, CSS `.voz-mic`) só no modo toque, sob PAUSA e PLACAR, acima da camada de mira: **tocar alterna o mudo; no modo "segurar", vale com o dedo nele**; sem microfone, tocar o pede de novo (**o teste achou um defeito: o toque também alternava o mudo e o microfone nascia mudo**). O texto do toque não cita tecla (3 textos novos nas 6 línguas).

**Provas:** `medicoes/voz-celular.mjs`: Chrome com tela de toque (915×412), toque de verdade pelo CDP, **12 de 12** (o botão aparece, está **por cima** da mira, tocar alterna, segurar fala, o colega aparece falando sozinho); foto `arte/voz-celular-claude.png`; testes do botão, do texto e das traduções; **11 de 11 mutações à mão pegas** (a primeira rodada deixou escapar uma por teste fraco, que reforcei, e uma equivalente, que simplifiquei no código). **Não provado em aparelho real:** o **iPhone** é o risco (áudio WebRTC no Web Audio do Safari).

**P210, a rádio (só desenho, `RADIO_E_EMISSORES.md`):** a visão se resolve com **emissores de som no mundo** (autofalante em laço, rádio de prédio ou de área, só os 3 mais próximos tocam) e uma **rádio 24 h sincronizada pelo relógio** (sem servidor, sem custo); **a música do PC do jogador** (`getDisplayMedia`) só roda no computador, custa upload × ouvintes e traz direitos autorais e privacidade: **recomendo não**. Nada construído.

**Falta (R13):** (a) o celular de verdade (Android, iPhone); (b) **a sua decisão** sobre a rádio (§ 5 do documento: de onde vem a música, fluxo ao vivo ou programação, a rádio que o jogador carrega); (c) tudo o que já faltava da voz (a política de privacidade antes de liberar `tela:voz`, o canal TIME).

**Próxima sessão começa com:** a decisão do Comandante sobre a rádio (E1: o emissor de laço, com a voz do narrador na Estação dos Cabos), ou o teste num celular real.

## AS PERMISSÕES DOS AGENTES VIRARAM LISTA FECHADA, COM TRAVA NO `npm run check` — Claude, 19/10 (branch `claude/qwen-permissoes`, P208)

**O Comandante (19/10):** *"aperte, autorizado sim, resolva esses alerta das permissoes ao qwen. toda hora vc reclama disso e nao resolve!"*. O alerta automático de segurança apontava o `.qwen/settings.json` (uma edição local, sem commit, alheia a este trabalho) por liberar `powershell *`, `cmd *` e `git *`: valem por qualquer comando, sem aprovação.

**Feito:** (1) o arquivo voltou ao padrão commitado **mais só comandos específicos de olhar o git** (`git status`, `git branch --list`, `git ls-remote --heads origin`, `git diff --stat`, `git merge origin/main`, `git fetch origin`, `timeout 600 npm run *`); saíram `powershell *`, `cmd *`, `git *`, `git checkout/merge/branch/ls-remote/fetch *` e `timeout *` (que também roda qualquer coisa). O arquivo alargado ficou em `.tmp/qwen-settings-local-widened-19-10.json`. (2) **A trava** (`scripts/permissoesDosAgentes.mjs` + `server/permissoesDosAgentes.test.ts`, 10 testes, **10 de 10 mutações pegas**): nenhum arquivo de permissões de agente pode liberar interpretador, envoltório ou verbo perigoso do git com coringa; o Qwen tem **lista fechada** (acrescentar é mexer no arquivo e na lista no mesmo PR); a única exceção do Comandante é o `git push` do Claude (o `publicar`), por texto exato e só no arquivo dele.

**Falta (R13):** o que continua liberado ao Qwen por decisão do fluxo do `AGENTS.md`: `rmdir *` (`cmd /s` apaga árvore; a junção de `node_modules` é o caso), `git worktree *` (`remove --force`), `git commit *` (`--no-verify`), `git add *`, `npm run *` (qualquer script do `package.json`). Apertar mais obriga o Qwen a pedir aprovação a cada branch e cada limpeza: decisão do Comandante.

**Próxima sessão começa com:** o chat de voz no celular (P209) e o desenho da rádio (P210).

## O `SERVIDOR.LOG` ANTIGO FOI LIMPO, E OS DOCUMENTOS ARQUIVADOS DE NOVO — Claude, 18/10 (branch `claude/docs-fechamento`, P204)

**O Comandante (18/10):** *"pode limpar o log sim, se tiver alguém, ela tenta de novo!"*. **Feito:** com `scripts\parar-servidor.ps1` (o servidor avisa quem joga, salva e sai), o `servidor.log` teve **1 e-mail e 16 IPs de rede mascarados no lugar** (mesmo tamanho; conferido 0 e 0) e o `scripts\ligar-servidor.ps1` religou e conferiu o `/status`. O que atrapalhou antes: **`Stop-ScheduledTask` não derruba o servidor** (deixa o `node` órfão); a instrução foi corrigida no `DEPLOY.md` § 4c. **`npm run arquivar`** de novo (o ESTADO passou de 150 KB): o antigo foi para `.decepticons/arquivo/`.

**Em produção agora (conferido):** aviso de reinício (#390), esqueci a senha (#392: `POST /conta/esqueci` responde 503 `sem-email` até haver a chave do Resend, como projetado) e o Analytics no `/metricas/` (#393: responde "falta o ID da propriedade", e a chave não vaza).

**Falta (dele):** a chave do Resend (`LANCAMENTO.md § 7`), o ID da propriedade do Analytics (§ 6C), a opção de estado e o HSTS na Cloudflare (§ 6B), o nome do encarregado na política. **Aviso técnico:** o JS de partida do jogo está em **496,1 de 500 KB**: o próximo recurso do jogo tem de entrar como pedaço sob demanda.

## O GOOGLE ANALYTICS DENTRO DO `/METRICAS/`: PRONTO NO CÓDIGO, FALTA UM NÚMERO — Claude, 18/10 (branch `claude/analytics-nas-metricas`, P207)

**O Comandante (18/10):** *"ligue o metricas, quero tudo devidamente configurado na melhor e mais técnica estrutura"* (e mandou `100530709581858880369`, que é o **`client_id` da conta de serviço**, não o ID da propriedade do Analytics: tem 21 dígitos; o da propriedade tem 9 ou 10).

**O que entrou:**
1. **`server/analytics.ts`:** a conta de serviço (`ga-chave.json`, fora do git) assina um JWT RS256 com `node:crypto`, troca por um token de 1 hora (`analytics.readonly`) e chama a Data API (`batchRunReports` + `runRealtimeReport`). **Sem biblioteca nova.** Cache de 10 min (2 min depois de erro), pedidos simultâneos viram um só, e o `/metricas` **nunca espera o Google mais que 4 s** ("carregando" e a vez seguinte já tem). A chave e o token nunca saem (log, resposta, detalhe do erro: sequências longas viram "…").
2. **Só somas por categoria:** as dimensões são data, canal, país, aparelho. Nada de usuário, IP, cidade ou página (o que a política promete, e o teste trava).
3. **A página** (seção "Google Analytics"): 4 cartões (usuários e novos, sessões e engajadas, tempo médio, **no site agora**), tabelas de canal, país, aparelho e o dia a dia, e **uma frase para cada estado** (sem chave, chave ilegível, falta o ID, carregando, erro do Google com o que fazer, servidor antigo). Diz que só enxerga quem aceitou os cookies do site. Nome vindo do servidor nunca vira HTML.
4. **O ID da propriedade:** de `ga-propriedade.txt` (só números, aceita `properties/`), da variável `CYBERMECH_GA_PROPRIEDADE`, ou **descoberto sozinho** pela Admin API **se a conta enxergar uma só** (a API tem de estar ligada no projeto; hoje não está).
5. **De brinde:** o teste "histórico do painel" do `admin-http.test.ts` (`amostras.length > 2` sem esperar) reprovou o deploy do atualizador em 18/10 por timing sob carga; agora espera as amostras.

**Provas:** 16 testes com um Google de mentira que **confere a assinatura do JWT com a chave pública**; **5 mutações à mão pegas** (sem cache de token, outro algoritmo de assinatura, sem mascarar sequências longas, sem juntar pedidos simultâneos, ID da variável sem validar); no Chrome, `site --check` desenha os cartões, as tabelas e recusa HTML vindo do servidor. **Já provado na máquina do Comandante:** a chave é válida e o Google aceitou a conta (emitiu o token).

**Falta (dele), uma das duas:** (a) pôr o ID da propriedade (Analytics → Administrador → Detalhes da propriedade, 9 ou 10 dígitos) em `D:\DECEPTICONS\.tmp\servidor\ga-propriedade.txt`; ou (b) ligar a **Google Analytics Admin API** no projeto `cybermech-online` (console.cloud.google.com → APIs e serviços → Biblioteca), e o servidor descobre sozinho. O servidor relê os arquivos a cada 30 s: **não precisa reiniciar**. **Não provado ainda:** os números de verdade do Google (falta o ID).

**Próxima sessão começa com:** conferir o `/metricas/` depois do ID; a limpeza do `servidor.log` antigo.

## O "ESQUECI A SENHA": LINK POR E-MAIL, PÁGINA PRÓPRIA E SEM CNPJ NA POLÍTICA — Claude, 18/10 (branch `claude/esqueci-a-senha`, P206)

**O Comandante (18/10):** *"faça o esqueci a senha; não vamos dar CNPJ por enquanto pois não temos e o jogo é indie, feito por uma pessoa apenas"*.

**O que entrou:**
1. **O pedido** (`POST /conta/esqueci`): responde **202 igual exista a conta ou não** e **antes** do trabalho (banco e envio), então nem o texto nem o tempo dizem se o e-mail tem conta. Limites: **5 por hora por IP**, **3 por hora por conta** e **50 e-mails por dia** no total (a cota grátis do Resend é 100). Sem e-mail configurado: 503 `sem-email` e o jogo diz para pedir ajuda pelo contato da Privacidade.
2. **O link:** 32 bytes aleatórios; o banco guarda só a **impressão digital (SHA-256)**; vale **30 min** e **uma vez**; um pedido novo cancela o anterior. Ele vai **depois do `#`** (`/redefinir/?lang=pt#TOKEN`): o fragmento não vai a servidor nenhum nem no Referer.
3. **A troca** (`POST /conta/redefinir`): confere o link, grava a senha nova (scrypt, sal novo) e **encerra todas as sessões da conta**; duas trocas com o mesmo link ao mesmo tempo, só uma passa. **Não entra sozinho:** manda voltar ao jogo e entrar com a senha nova.
4. **A página `/redefinir/`** (`scripts/redefinir.mjs`, sete línguas, `noindex`, **sem Google nem cookies**): tira o token da barra de endereço ao abrir, valida a senha, e mostra a frase certa para link vencido, limite e servidor fora do ar. Provada no navegador sem rede de verdade (`site --check`).
5. **No jogo:** "Esqueci a senha" no painel de login (modo novo, sem aba nem botão primário a mais), nas 6 línguas.
6. **E-mail:** `server/email.ts` (provedor trocável; o Resend por `fetch`, sem biblioteca; chave só em `.tmp/servidor/email.json` ou `CYBERMECH_EMAIL_CHAVE`, nunca no git), textos em 7 línguas.
7. **Sem e-mail ainda? `npm run admin -- link-senha <e-mail>`** gera o mesmo link (30 min, uso único) para o Comandante entregar à pessoa.
8. **Auditoria:** `senha_recuperacao_pedida`, `senha_redefinida`, `link_senha_gerado`, com o número da conta, nunca o e-mail nem o token. **Política:** o controlador agora é "uma pessoa física, sem empresa nem CNPJ por ora"; nova linha na tabela e o Resend como destinatário (EUA).

**Provas:** 22 testes do fluxo com o servidor de verdade (pedir → e-mail → trocar → senha velha falha, sessão antiga cai, link não serve duas vezes; resposta igual com e sem conta; limites; auditoria sem o e-mail; falha do provedor) + 5 do cliente; **5 mutações à mão pegas** (sem prazo, sem encerrar as sessões, vários links por conta, sem a trava de uso único, limite por conta frouxo).

**Falta (dele):** ligar o envio de e-mail: conta no Resend, verificar o domínio `cybermech.online` e guardar a chave (`LANCAMENTO.md § 7`). **Até lá**, o jogo avisa que a recuperação por e-mail não está ativa e o `link-senha` resolve na mão. **Não feito:** e-mail de aviso "sua senha foi trocada" (boa prática; entra com o envio ligado) e o nome da pessoa na política (a LGPD pede a identidade do encarregado; ele decide).

**Próxima sessão começa com:** a leitura do Google Analytics no `/metricas/` (falta o ID numérico da propriedade) e a limpeza do `servidor.log` antigo.

## O CHAT DE VOZ: ÁUDIO DIRETO ENTRE OS JOGADORES, SEM SERVIDOR DE MÍDIA, SEM CUSTO E PROVADO EM CHROME DE VERDADE — Claude, 18/10 (branch `claude/voice-chat`, P205)

**O Comandante (18/10):** trouxe o plano do VOICE CHAT (microfone aberto + apertar-para-falar, áudio espacial, canais ALL + TEAM, TURN a critério técnico) e, ao mandar seguir: *"quero q seja simples, sem custo inicial e eficiente"*.

**O que entrou** (`VOICE_CHAT.md` tem tudo, inclusive onde o código **difere do plano** e por quê):
1. **A voz vai direto de um navegador ao outro** (WebRTC, malha); o servidor **só repassa** a oferta e a resposta (`server/voz.ts`: 3 mensagens 30–32, o remetente é trocado pelo id de verdade, SDP conferido, teto de 30 mensagens por 10 s). **Não sobe o protocolo**, não toca no tick, não gasta banda do jogo.
2. **Sem custo:** só o STUN público do Google (**sem TURN**: quem tem rede que barra a conexão direta fica sem voz e a tela diz "N SEM CONEXÃO"). Opus a 24 kbps **com DTX no SDP** (o plano supunha que viria sozinho: não vem).
3. **Cliente** (`client/src/voice/`): microfone aberto com **T alternando o mudo**, ou **segurar T** (modo nas Configurações, tecla trocável); voz espacial (volume cheio até 12 m, some em 160 m, `equalpower`); quem recusa o microfone **entra como ouvinte**; reconexão da sala refaz a voz sem pedir o microfone outra vez. Indicador no canto de baixo à esquerda, seção CHAT DE VOZ nas Configurações, tudo nas 6 línguas. **Pedaço sob demanda** (3,5 + 0,7 KB gzip, só baixa quem liga a voz numa sala): o JS de partida ficou em **495,4 de 500 KB**.
4. **Nasce RESTRITA** (`tela:voz`, regra do P191): só o modo Comandante (`?comandante=1`) vê e usa até o painel de visibilidade soltar; **é também a chave de desligar** sem republicar.

**Provas:** bancada em **Chrome de verdade** (`medicoes/voz.mjs`, 26 verificações: o áudio chega nos dois sentidos, mudo e PTT cortam, **a 100 m cai a 0,40 e a 200 m some**, recusa vira ouvinte, microfone tardio entra sem renegociar, **falando ~50 pacotes/s e calado ~5 com o DTX**) + a captura do jogo real (`arte/voz-hud-jogo-claude.png`); testes de unidade, de sala e da sessão contra o servidor de verdade; **33 de 34 mutações à mão pegas** (a 34ª virou teste).

**Falta (R13):** (a) **o ouvido do Comandante** (a bancada prova que o áudio chega e o volume cai; se soa bem é dele); (b) **dois aparelhos em redes diferentes** (a bancada liga dois Chrome na mesma máquina); (c) **canal TIME** (o protocolo online não tem time; entra com o CTF online); (d) **mudo por jogador**; (e) **ANTES DE LIBERAR `tela:voz`: a política de privacidade** — a voz mostra o IP aos outros jogadores da sala e o STUN do Google o recebe; o texto pronto, a troca de `POLITICA_VERSAO` e o `PRIVACIDADE.md` estão em `VOICE_CHAT.md` § 4; (f) TURN próprio só se um jogador real reclamar.

**Próxima sessão começa com:** o veredicto do Comandante (testar com dois navegadores em `?comandante=1`); depois o canal TIME junto com os times online, ou o que ele mandar.

## O SERVIDOR AVISA ANTES DE REINICIAR: TELA COM CONTADOR, E O JOGO INSISTE EM VOLTAR — Claude, 18/10 (branch `claude/aviso-de-reinicio`, P204)

**O Comandante (18/10):** *"será que temos que adicionar uma imagem dizendo que estamos reiniciando o servidor ou em manutenção (e dizer se temos previsão de retornar, atualizado automaticamente, com um contador na tela, e se for reinício do servidor, dizer que volta em 1 ou 2 minutos? ou potencialmente mais?)"*. Sim, e entrou.

**O que entrou:**
1. **O servidor avisa e só então corta** (`server.fecharComAviso`, usado pelo painel e pela atualização automática): com gente na sala manda o aviso `AVISO` (mensagem nova, `shared/net/messages.ts`; cliente antigo a ignora, **sem mudar o protocolo**), espera **10 s** (`REINICIO_AVISO_S`) e corta com o código **4010** e o tempo previsto de volta (**60 s**, `REINICIO_VOLTA_EM_S`: medi 16 a 50 s nos deploys de hoje). Sem ninguém, reinicia na hora.
2. **A tela** (`ui/ConnectionNotice.ts`, frases em `ui/avisoDeConexao.ts`, nas 6 línguas): "ATUALIZAÇÃO DO SERVIDOR · corte em 0:07"; depois do corte "SERVIDOR REINICIANDO · volta em ~0:58" descendo; passou da previsão, "DEMORANDO MAIS QUE O PREVISTO · fora há …"; queda sem aviso (PC, internet, túnel) "CONEXÃO PERDIDA · fora há …", e **depois de 30 s o botão "JOGAR OFFLINE ENQUANTO ISSO"**. Quem nunca entrou na sala não ganha a tela (cai no offline em ~19 s, como sempre).
3. **A insistência:** antes o jogo desistia em ~15 s e pedia para recarregar; agora quem já estava na sala tenta de novo **a cada 5 s por até 10 minutos** (`PERSISTENCIA_PADRAO_MS`) e volta sozinho.

**Provas:** 4 testes novos no `online.test.ts` (aviso → corte 4010 → previsão → volta sozinho; queda sem aviso desiste só no fim da persistência; quem nunca entrou não insiste; sala vazia não espera), 1 no codec, 8 das frases; **2 mutações à mão pegas** (tirar a trava de "já entrou" e nunca insistir). **Ponta a ponta no Chrome contra um servidor local** (`medicoes/aviso-reinicio.mjs`, 8 de 8): o aviso conta 0:07, depois do corte 0:58, o servidor volta e a tela some sozinha, a queda sem aviso mostra o botão offline com 35 s. Capturas em `.decepticons/arte/aviso-reinicio-*-claude.jpg`.

**Falta:** ver num reinício de produção de verdade (o próximo deploy com gente na sala); um aviso de **manutenção agendada** escrito pelo dono (hoje só o reinício é anunciado); o aviso na landing do site (a Hostinger não sabe do servidor).

**Próxima sessão começa com:** o "esqueci a senha" e a leitura do Google Analytics nas métricas (ordem P204).

## OS DOCUMENTOS FICARAM 6× MAIS LEVES, O MONITOR É O DA CLOUDFLARE E A CHAVE DO GOOGLE JÁ FUNCIONA — Claude, 18/10 (branch `claude/arquivar-docs`, P203)

**O Comandante (18/10):** *"ARQUIVAR"*; não conseguiu criar o monitor no UptimeRobot e perguntou se é grátis e se o sistema do Telegram (serafim13, BatBot) já não serve; ativou a Google Analytics Data API e deu a conta de serviço; perguntou se vale formatar um PC velho como servidor ou contratar uma VPS; e mandou prosseguir.

**O que entrou:**
1. **`npm run arquivar`** (`scripts/arquivar-docs.mjs`, teste em `server/arquivarDocs.test.ts`): o que tem mais de dois dias do `ESTADO_ATUAL` e do `HISTORICO` foi para `.decepticons/arquivo/` (um arquivo por quinzena). **ESTADO 641 → 152 KB, HISTORICO 645 → 70 KB.** Provado nos documentos de verdade: **0 linhas perdidas** (cada linha não vazia do original está no vivo ou no arquivo) e o painel dá os mesmos números (361 decisões, 393 leituras, 111 pedidos); ele agora lê o vivo e o arquivo. A seção "EM BRANCH" ficou só com a tabela. `AGENTS.md` manda ler **só o topo** e escrever curto (ordem em ~600 caracteres, sessão em ~25 linhas). A `ORDENS` (192 KB) ficou: 123 KB dela são das últimas 48 h, e o remédio ali é a linha curta, não arquivo.
2. **Monitor:** o UptimeRobot grátis dá 50 monitores a cada 5 min **só com e-mail** (o Telegram é de plano pago; e o grátis é, pelos termos de terceiros, para uso não comercial). O sistema do Telegram do serafim13 **não serve para isto**: o `serafim-watchdog` roda **a cada 6 h** pelo GitHub Actions (a detecção levaria até 6 h, e o GitHub Actions está sem pagamento, ao menos no repositório do jogo), e o BatBot é outro produto (varredura de segurança de clientes). **Recomendado: o "Tunnel Health Alert" da própria Cloudflare** (grátis, e-mail, sem conta nova): passo a passo em `LANCAMENTO.md § 6A`.
3. **Chave do Google:** o arquivo é válido e o **Google aceitou a conta** (emitiu o token); falta só o **ID numérico da propriedade** para a leitura dos dados (`LANCAMENTO.md § 6C`).
4. **Servidor em outro computador:** medido, o servidor é leve (100 jogadores ≈ 26% de **um** núcleo, 375 MB, 4,4 KiB/s por jogador): o PC velho não precisa ser bom, mas **não é para fazer agora** (`LANCAMENTO.md § 6D`).

**Falta (dele):** o ID da propriedade do Analytics; o alerta de túnel na Cloudflare; razão social/CNPJ e nome do encarregado; "esqueci a senha"; 5 a 10 pessoas de fora. O `servidor.log` antigo segue como estava (precisa parar o processo do servidor).

**Próxima sessão começa com:** o ID da propriedade do Analytics (conferir a leitura e, se ele quiser, ligar os números no `/metricas/`); senão, as métricas dos primeiros jogadores de verdade.

## O PRIMEIRO TESTE ONLINE: OS BOTS DIFÍCEIS DEMAIS, AS REGRAS NO PAINEL E O "PROBLEMA" QUE ERA O PC — Claude, 18/10 (branch `claude/regras-online`, P201 e P202)

**O Comandante (18/10), depois de jogar online com uma pessoa da internet:** *"achamos MUITO DIFÍCIL os bots inimigos… não conseguimos trocar direito devido à pressão adversária… precisamos melhorar a logística de controlar esse tipo de coisa através do painel admin que só eu tenho"*; e a janela do servidor marcava PROBLEMA ("atraso do laço (p99) 107,9 ms").

**1. A causa dos bots difíceis (achada no código):** a sala online usava o padrão de uma partida solo (3 Mechs e 2 andróides, dificuldade normal) e **a sala não aplicava o limite de atacantes** (`maxAttackers` ficava infinito): **todos os bots atacavam duas pessoas ao mesmo tempo**. É o oposto do jogo solo, que limita a 2.
**2. O que mudou:** o padrão online agora é **de iniciante** (fácil, 2 Mechs, 1 andróide, 1,5 atacantes juntos) e **o dono ajusta no painel**: janela SERVIDOR → **[ REGRAS DAS SALAS ]**: dificuldade, Mechs, andróides, pressão; receitas INICIANTE / PADRÃO / DESAFIO; **APLICAR** vale na hora nas salas de pé (dificuldade, pressão e Mechs; os andróides valem nas salas novas). Guardado no servidor (`regras-online.json`), sobrevive ao reinício. **Porta:** só a chave do dono ou a sessão de uma conta admin (`PAINEL_ADMIN.md` § 7).
**3. O "PROBLEMA" do painel não era o servidor** (`server/admin.ts`): o Node demorou a olhar a fila porque o **PC estava saturado** (as compilações, os testes das duas sessões, o navegador); o TESTAR, com gente de mentira, deu 15,8 ms. **Agora, numa janela sem ninguém jogando, o atraso do laço vira aviso (não problema)** e o painel diz que foi outro programa; com gente jogando vale a régua inteira.

**Provas:** 5 testes (o padrão de iniciante e as receitas, o que vem de fora é puxado para os limites, o armazém em arquivo e o aviso às salas, a sala nova e a sala de pé aplicando, as rotas do dono com o servidor de verdade: 401 sem chave, o POST puxa para os limites e o GET devolve o que vale).

**Falta (R13):** **não vi a janela REGRAS DAS SALAS no navegador** (testes, tipos e o servidor de verdade, sim): o Comandante confere; **o efeito sobre o jogo online (a sensação de dificuldade) é do Comandante julgar**: os números de iniciante são proposta; falta escalar por quantidade de gente, ajustar **por sala** e o dano dos bots; os andróides só mudam nas salas novas; a conta "superadmin" é o `is_admin` que já existia (nenhum papel novo).

**Onde o Comandante confere:** jogue online (`ARENA`), abra `?comandante=1` → COMANDO → SERVIDOR → **[ REGRAS DAS SALAS ]**, escolha INICIANTE ou DESAFIO e APLICAR: a sala de pé muda sem reiniciar.

**Próxima sessão começa com:** o que o Comandante julgar depois do segundo teste online.

## AS PENDÊNCIAS DO LANÇAMENTO: O QUE O COMANDANTE DECIDIU, O E-MAIL DO ENCARREGADO E O PASSO A PASSO DO QUE SÓ ELE FAZ — Claude, 18/10 (branch `claude/pendencias-lancamento`, P199 e P200)

**O Comandante (18/10), respondendo à lista do que faltava:** manter o servidor neste PC por ora (ele está terminando o jogo para deixar o PC só como servidor); o e-mail do encarregado é `volkov@serafimweb.com`; quer as orientações da Cloudflare e como criar a chave do Google; "já estou divulgando, conclua as pendências"; e pediu para manter tudo limpo, enxuto e com boas práticas, perguntando se a contagem de "mais de 3.500 testes" estava duplicada e se há algum bug que torna as conversas longas e caras.

**O que entrou:**
1. **O e-mail do encarregado** em `.decepticons/contato-privacidade.txt` (versionado): a política `/privacidade/` passa a mostrá-lo nos dois lugares em que o contato aparece.
2. **`LANCAMENTO.md § 6`:** o passo a passo do monitor externo (A14), da Cloudflare (estado do visitante e HSTS) e da chave de serviço do Google, com o estado de cada pendência.
3. **A contagem de testes está certa, não duplicou:** o Vitest rodou **3.284 testes em 310 arquivos** (o check de hoje, antes do #385); o site mostra 3.265 (sala de controle) e 3.252 (oficina) porque cada página conta as linhas `it(` com uma regex um pouco diferente; são 312 arquivos de teste e os 7 nomes repetidos estão em pastas diferentes. **"3.500" não aparece em nenhuma página nem documento** do repositório.
4. **Por que as conversas pesam (medido, não é bug de código):** os 5 documentos vivos somam **1,7 MB** (`ESTADO_ATUAL` 638 KB e 3.134 linhas, `HISTORICO` 645 KB e 3.852, `ORDENS` 192 KB, `STATUS_REAL` 156 KB, `ROADMAP` 90 KB); cada PR edita os cinco e briga no topo com os outros agentes; o check do push roda em silêncio de 6 a 10 min numa máquina compartilhada e reprova por carga. **Proposta, que espera o "pode" dele:** arquivar o que tem mais de 30 dias em `.decepticons/arquivo/` (o painel lê ESTADO e HISTORICO e passaria a ler o arquivo também).
5. **A regra de higiene (P200)** entrou no R17 do `AGENTS.md`: o que ficou sem uso na área que o PR tocou sai no mesmo PR.

**Não feito, e por quê:** o `servidor.log` antigo (1 e-mail e 16 IPs de rede) **segue como estava**. O Windows o trava com o servidor no ar (EBUSY) e **parar a tarefa não derruba o servidor** (verificado: o uptime não zerou; ele sobe por um ajudante do WMI). Nada foi alterado e o servidor não foi reiniciado. O servidor novo não escreve nada pessoal nesse arquivo.

**Falta (dele):** conta no monitor externo; ligar a opção na Cloudflare; a chave do Google; razão social/CNPJ e o nome do encarregado na política; "esqueci a senha" (sem serviço de e-mail, lança avisando que a senha não se recupera); 5 a 10 pessoas de fora.

**Próxima sessão começa com:** o "arquivar" do Comandante, se vier; senão, olhar as métricas dos primeiros jogadores de verdade.

## O PAINEL DE VISIBILIDADE: O QUE OS JOGADORES VEEM E O QUE FICA EM TESTE — Claude, 18/10 (branch `claude/visibilidade`, P191)

**O Comandante (18/10):** *"um painel COMPLETO DE TUDO… pra eu poder selecionar o que os jogadores normais veem na tela (quais robôs, armas, fases, detalhes) e quais eu mantenho secretos/restritos ao admin, em estágio de teste… (tipo o botão "lado", "arquivo")"*.

**O que entrou** (`PAINEL_ADMIN.md` § 6): um **catálogo de funcionalidades** (fases, modos, botões e telas, **todos os robôs e todas as armas**) com um padrão `publico` ou `restrito`; o **servidor** guarda as exceções (`visibilidade.json`, sobrevive ao reinício; `GET /visibilidade` público, `POST /admin/visibilidade` só com a chave do dono); o **jogo** aplica (o restrito some para o jogador e aparece com o selo TESTE para o Comandante; link de fase ou modo restrito volta ao padrão); o **painel** (chip VISIBILIDADE ▸, só no modo Comandante): lista de tudo, PÚBLICO | RESTRITO em cada linha, SALVAR PARA TODOS, SÓ NESTE NAVEGADOR, VER COMO JOGADOR, RESTAURAR PADRÕES.

**Fusão com o lançamento (PR #384, outra sessão):** o `Lancamento.ts` dela (a lista fixa de dois mapas) **agora pergunta ao catálogo**: a Cidade Neon e a Estação dos Cabos nascem públicas, o Bunker e a Terras Raras restritos, e **o painel é quem libera um mapa** (sem código). O pino "EM BREVE", o filtro das campanhas e o link que cai na Cidade Neon dela seguem iguais.

**Mudança de comportamento a saber:** **ARQUIVO, ESCOLHA O LADO e RELATÓRIO agora nascem RESTRITOS** (são os exemplos que o Comandante deu de "em desenvolvimento"): o jogador normal **não os vê mais** até o Comandante os liberar no painel (modo Comandante: `?comandante=1`, chip VISIBILIDADE ▸, trocar para PÚBLICO, SALVAR PARA TODOS). Tudo o mais continua como estava (público).

**Provas:** testes do contrato, do armazém em arquivo, das rotas com o servidor de verdade (401 sem chave, 400 com lixo, o que o dono grava aparece no GET), do catálogo (todo robô e toda arma do jogo está nele; o que está em desenvolvimento nasce restrito), da visibilidade (jogador × Comandante, exceção do servidor, cache, falhas de rede, link de fase restrita, DOM) e do painel (só as exceções vão ao servidor).

**Custo:** zero no laço do jogo; uma consulta HTTP ao abrir (1,5 s no máximo, sem travar). O painel é pedaço sob demanda.

**Falta (R13):** **não é cadeado** (quem ligar o modo Comandante vê tudo); **os modais do console de comando** (Potências, Arsenal, Campanha, Mesa, Servidor) ainda não estão no catálogo; a mudança chega ao jogador **na próxima abertura do jogo**; o painel foi **visto no navegador** (`arte/visibilidade-painel-claude.png`), mas o **SALVAR PARA TODOS contra o servidor de produção** só foi exercitado com o servidor de teste (a chave do dono é do Comandante); a lista de robôs mostra os nomes do jogo (VECTOR-09…); só as funcionalidades catalogadas são controláveis.

**Onde o Comandante confere:** `…/jogar/?comandante=1` → **EXPLORAR HANGAR E MODOS ▸** → chip **VISIBILIDADE ▸** (amarelo, no canto de cima). Troque algo para RESTRITO, **VER COMO JOGADOR**, e depois **SALVAR PARA TODOS** (precisa da chave do dono: a janela SERVIDOR guarda).

**Próxima sessão começa com:** o que o Comandante julgar; depois o objetivo na tela dos outros modos e mapas (P190) e a Praia abaixo de 60 fps (P188).

## O LANÇAMENTO: AUDITORIA DE SEGURANÇA, PRIVILÉGIOS, TRILHA DE AUDITORIA, GOVERNANÇA E OS MAPAS FECHADOS — Claude, 18/10 (branch `claude/lancamento-seguranca`, P196 a P198)

**O Comandante congelou o escopo** (`LANCAMENTO.md`) e pediu: acesso, privilégio, autenticação, auditoria interna, observabilidade, governança, **lançar só com CIDADE NEON e ESTAÇÃO DOS CABOS**, "Rio Vivo" virar "Terras Raras" e **uma auditoria de segurança**.

**O que entrou:**
1. **`AUDITORIA_SEGURANCA.md`:** 1.368 pedidos hostis contra um servidor de verdade (0 falhas, `.decepticons/medicoes/abuso-servidor.mjs`), `npm audit` (0 vulnerabilidades), segredos, rotas, autenticação, privilégios. **Conclusão: o código está em condição de lançar; o que bloqueia o público é operacional e do Comandante: A1 (servidor e chaves de publicação no mesmo PC de trabalho) e A13 (cópia das contas no mesmo disco).**
2. **Corrigido:** a configuração global só aceita chaves conhecidas; **limite de falhas por conta** (10 em 15 min, login e apagar); **teto de 10 sessões** por conta; **trilha de auditoria** de 400 dias, sem e-mail nem IP, na seção "Auditoria interna" do `/metricas/`; **`npm run admin`** como único caminho para administrador.
3. **`GOVERNANCA.md`:** a matriz de privilégios, quem é dono de quê, como uma regra muda, o que se guarda e por quanto tempo, e o que fazer quando dá errado (servidor caído, token vazado, vazamento de dados com o aviso à ANPD).
4. **Mapas do lançamento:** só CIDADE NEON e ESTAÇÃO DOS CABOS livres; **Bunker e TERRAS RARAS "EM BREVE"** (o modo Comandante abre todos). O renome de "Rio Vivo" para "Terras Raras" outra sessão já tinha feito (P187): aqui só se conferiu que nada ficou para trás.

**Provas:** 16 testes de segurança de acesso com o servidor de verdade; **mutação à mão: 20 de 20** (só na segurança de acesso, por ordem do Comandante); 6 testes do bloqueio de mapas; o abuso medido.

**Falta (do Comandante, para o lançamento público):** o **servidor fora do PC de trabalho** (A1), a **cópia de segurança fora do PC** (A13), o **monitor externo** (A14), o **encarregado** e a política revisada, o **"esqueci a senha"**, o **HSTS** na Cloudflare e o **teste com 5 a 10 pessoas de fora**.

**No ar (conferido em 18/10, 15:08):** PR #384 na `main` (b2c6f3e); o atualizador religou o servidor no código novo e o site foi publicado e conferido por soma. Ao vivo: `GET /config?chave=segredo` → 400 (a conhecida segue 200), `/metricas` sem o token → 401 e **com o token traz o bloco `auditoria`** (o acesso do dono e a recusa do anônimo já aparecem). O atualizador recusou o deploy **duas vezes** nesse dia por `server/estudio.test.ts` (preparo acima dos 10 s do Vitest com a máquina ocupada): o `hookTimeout` agora é 30 s como o `testTimeout`.

**Próxima sessão começa com:** o que o Comandante decidir sobre o servidor (item 8 de `LANCAMENTO.md`); nada novo antes disso.

## TERRAS RARAS: O JOGO FICOU 2,5× MAIS RÁPIDO, A MISSÃO COMEÇA PERTO E O OBJETIVO ESTÁ NA TELA — Claude, 18/10 (branch `claude/terras-raras`, P187 a P190)

**O Comandante (18/10), depois de jogar:** *"ficou meio travado, pesado… será que há muitos elementos na fase? […] demorou mais de um minuto pra eu chegar correndo lá […] temos que melhorar a descrição dos objetivos da missão na própria tela […] temos sempre que corrigir e melhorar o DESEMPENHO"* e *"mude o nome do rio vivo pra terras raras"*.

**1. O que travava (medido, não suposto).** Criei a bancada na GPU de verdade (`medicoes/amazonia-gpu.mjs`, AMD Vega 11, **a janela dele: 1549×925 a 1,25× = 1936×1156 pixels**), mediu-se cada coisa por vez:
- **Cenário não era o culpado:** com as árvores, o terreno, a água, o céu e as estruturas **todos escondidos**, o quadro só ganhava ~2 ms (de 14 a 12). 6.594 árvores, 2,4 km de mapa e 221 mil triângulos cabem folgados.
- **O culpado: o MSAA 4× do alvo HDR do composer** (`Game.ts`): **~17 dos 27 ms de cada quadro**. O bloom, o cobertor de ondas e o tone mapping desenham tela cheia *dentro* do alvo multiamostrado e cada um paga a resolução das amostras. **Valia para todos os mapas:** a Arena também dava 22 fps na qualidade Alta.
- **A troca:** o alvo HDR sem MSAA e um **FXAA** de uma passada depois do tone mapping (`fx/Fxaa.ts`). **Visualmente equivalente** (comparei recortes lado a lado). Custo do FXAA: ~1,5 ms.
- **Resultado (a janela dele, qualidade Alta):** **Amazônia 27 → 66 fps** (o render do quadro, de 24-27 ms para 10,5 ms), **Arena 22 → 61 fps**, **Praia 25 → 47 fps**. Na qualidade Automática (a padrão) o jogo se estabilizava em 35 a 63 fps com engasgos de 64 ms (p95); agora a Alta já segura 60+.
- **Mais um degrau na qualidade automática** (`core/Quality.ts`): depois de 1,0× e de desligar o bloom, **0,75×** (para GPU integrada mais fraca que a dele).

**2. O mapa é grande demais para uma missão de poucos minutos: o posto avançado.** O jogador nascia na aldeia (x = -960) e o primeiro gerador ficava a 920 m: **100 s de corrida**. Agora ele nasce e renasce num **posto avançado** (`AMAZONIA_POSTO_AVANCADO`, x = -300, na margem sul): **360 m da cerca = ~40 s**, fora do alcance das torres (a mais perto fica a 205 m, elas atiram a 170); a **Resistência** nasce junto. A aldeia segue sendo o que o Draga ameaça (a barra da aldeia continua). O Deathmatch da Amazônia mantém os pontos de sempre. Teste: o posto está em terra firme, fora do alcance das torres e a menos de 450 m da cerca.

**3. O objetivo na tela** (`environment/AmazoniaObjetivos.ts`, no pedaço sob demanda da Amazônia): **uma ordem no topo** (`DERRUBE OS GERADORES · 1 DE 3`, depois `DERRUBE O DRAGA-01`), **uma dica** logo abaixo (`Siga o marcador: CERCA, a 320 m.` / `A Resistência planta a carga: 45%. Proteja-a ou derrube o Draga a tiro.`) e **marcadores no mundo**: um losango sobre cada gerador (o mais perto, maior e pulsando, com nome e distância; os outros só o losango), sobre o Draga e sobre a escotilha aberta; **fora da tela o marcador gruda na borda com uma seta** apontando para onde ir, e aparece **por cima da mata**. A barra do Draga **parou de repetir a ordem** (a linha de regra e a de escudo saíram com o escudo de pé: "nada repetido") e **a célula da aldeia entrou na barra** (com as linhas novas das torres e da invasão ela ficava por cima delas: bug meu de 18/10, achado na captura).

**4. Renomeado: TERRAS RARAS** (seletor, teatro, campanha, Relatório e as seis línguas).

**5. Dieta de JS** (ver `ORDENS_DO_COMANDO.md` P192–P195): o leitor de `.glb` (13 KB gzip) agora só baixa quando o primeiro robô é pedido. **Pacote de partida: 486,2 de 500 KB** (estava em 498,1).

**Provas:** o teste do posto (terra firme, fora das torres, < 450 m), 10 do objetivo (a ordem e a dica em cada passo, os metros, os marcadores: rótulo, destaque, gerador caído some, borda e seta, a missão parada esconde tudo), os da barra do chefe reescritos, a cobertura de idioma, e a medição na GPU salva em `medicoes/amazonia-gpu-2026-10-18.json`. Capturas do jogo de verdade na GPU: `arte/terras-raras-objetivo-claude.png`, `terras-raras-escotilha-claude.png`.

**Custo de CPU:** zero a mais no tick; no quadro, até cinco projeções de marcador (texto a 4 Hz).

**Onde o Comandante confere:** `…/jogar/?mapa=amazonia&modo=survival`: o jogo deve estar **fluido na Alta e na Automática**; você nasce no posto (a cerca está logo ali), a ordem e o losango verde com a distância mostram o caminho.

**Falta (R13):** **o objetivo na tela só existe em TERRAS RARAS** (a praia, a Cidade Neon, a Bandeira e o Domínio ainda têm só o texto de antes: P190 fica 🟡); **a Praia ainda roda a 47 fps** na janela dele (125 mil triângulos e os shaders dela: há o que ganhar); o painel de visibilidade (P191) é o PR seguinte; o FXAA suaviza um pouco as bordas (mais que o MSAA), **o Comandante julga a olho**; a bancada mede quadros, não o toque da mão: se ainda sentir peso, diga em que ponto do mapa.

**Próxima sessão começa com:** o painel de visibilidade (P191); depois o objetivo na tela dos outros modos e a Praia.

## LGPD (P192) E MÉTRICAS DE NÍVEL PROFISSIONAL (P193): BAIXAR OS DADOS, APAGAR A CONTA, POLÍTICA, GOOGLE ANALYTICS COM LICENÇA, E DE ONDE VÊM AS VISITAS — Claude, 18/10 (branch `claude/lgpd-conta`)

**A ordem do Comandante (18/10):** *"faça os ajustes de apagar conta, baixar dados, tudo que a LGPD obrigue, pra que estejamos todo de acordo"*.

**O que entrou:**
1. **No jogo (Configurações → Conta):** criar conta exige **aceitar a política e declarar a idade** (o servidor também; guarda quando e qual versão); logado há **Meus dados**: **baixar tudo** (JSON), **apagar a conta** (com a senha, numa transação: conta, progresso, atividade e sessões) e **desligar o registro da atividade** (apaga o que havia).
2. **No site:** `/privacidade/` (a política), o rodapé com o link em todas as páginas e a **faixa de cookies**: o **Google Analytics só liga depois do "Aceitar"**. **Achado:** a tag estava **fixa dentro do jogo** (`client/index.html`); agora o jogo só a carrega com o "sim" guardado.
3. **No servidor:** **IP mascarado** no log (`212.8.252.x`), **e-mail fora do log**, e o **registro técnico em arquivo por dia, apagado sozinho depois de 30 dias** (`server/registro.ts`; o painel do servidor lê dele). Novos números do dono: contas criadas, logins, falhas de senha, contas apagadas e dados baixados (só contagem).

4. **A audiência (P193):** o `/metricas/` ganhou **De onde vêm** (digitou o endereço, busca, rede social, outro site, campanha `utm_*`; o funil de cada canal, os sites que mandam gente, as campanhas), **Quem chega** (novo ou recorrente, com conta ou convidado, aparelho, navegador, sistema, idioma, estado do Brasil) e **Quanto se joga** (duração das rodadas e a qualidade gráfica ao terminar). **Só categorias; sem IP, sem cidade, sem id de pessoa.** O Google Analytics **não** entrou na página: precisa da chave de serviço do dono (passos na ordem P193).

**Provas:** testes do banco (aceite, exportar sem segredos, apagar só a conta certa, medição), do HTTP com o servidor de verdade (aceite exigido, versão velha, baixar, apagar com senha errada e certa, a sessão morre, a outra conta intacta, oposição, contagens, preflight, **log sem e-mail**), do cliente (corpo do criar, baixar, apagar, medição; a sessão esquece a conta apagada e **mantém o progresso do aparelho**), do painel de login (as duas caixas, "Meus dados", a confirmação de apagar que não destrói o campo ao digitar) e do registro (dia de Brasília, poda de 30 dias, nunca lança); **o check do site prova no navegador a faixa de cookies** (nada do Google antes da escolha; aceitar liga; a escolha vale na visita seguinte; recusar apaga `_ga`; o jogo não tem a tag fixa). **Mutação à mão: LGPD 32 de 32, audiência 38 de 38, faixa de cookies no navegador do check 7 de 7.** **Ponta a ponta no Chrome (a landing e o jogo reais na mesma origem, contra um servidor local):** a visita do Instagram com link marcado vira canal, site de origem e campanha na landing, o jogo herda a origem, a partida conta com conta ou convidado, a duração e a qualidade entram nas rodadas. Capturas em `.decepticons/arte/` (`lgpd-*-p187-claude.jpg`, `metricas-audiencia-p188-claude.jpg`).

**Custo de CPU:** zero no tick. Um `SELECT` pequeno por visita/rodada de quem tem conta (a checagem da medição); o registro escreve uma linha por evento (a cada 10 s por sala, como o log de antes).

**ATENÇÃO (R13):** o **texto da política é rascunho meu**, escrito a partir do código; **não é parecer jurídico**. **Falta o contato do encarregado** (escreva um e-mail em `.decepticons/contato-privacidade.txt` e a página o mostra) e a razão social. **Não existe recuperação de senha** (exige serviço de e-mail). O **`servidor.log` antigo** ainda tem IPs inteiros e um e-mail (só se apaga com a tarefa parada).

**Onde o Comandante confere:** `cybermech.online/privacidade/`; no jogo, Configurações → Conta (criar conta mostra as duas caixas; logado mostra Meus dados); no site, a faixa de cookies na primeira visita.

**Achados no caminho (R17):** o GA era fixo dentro do jogo; o e-mail ia para o log; `limparExpiradas` nunca era chamada; **a primeira partida de cada visita nunca contava em "partidas iniciadas"** (corrigido).

**O Comandante congelou o escopo (18/10, P194 a P198):** a lista de lançamento está em `LANCAMENTO.md` (10 itens: auditoria de segurança, acesso e privilégio, autenticação, trilha de auditoria, analytics e observabilidade, governança, mapas do lançamento, servidor fora do PC de trabalho, teste com gente de fora, política revisada). **No lançamento só CIDADE NEON e ESTAÇÃO DOS CABOS (a Praia dos Cabos) ficam livres; Bunker e TERRAS RARAS (a Amazônia, ex-"Rio Vivo") ficam "EM BREVE".** O P81 e o painel único estão congelados.

**Próxima sessão começa com:** `LANCAMENTO.md` item 1 (a auditoria de segurança) e, em seguida, os itens 2 a 7 (privilégio, autenticação, trilha de auditoria, observabilidade, governança, mapas do lançamento).

## AMAZÔNIA, PARTE F1: O RELATÓRIO DE CONSEQUÊNCIAS, E OS FATOS CONFERIDOS NA FONTE — Claude, 18/10 (branch `claude/amazonia-consequencias`, P179 camada 3 e P180)

**O Comandante (17/10):** o Relatório de Consequências era a camada 3 do P179 (*"o fim da missão mostra o que aconteceu com o rio, com os povos, com a água, com números lidos de ficha"*) e a ficha de fatos da P180 pedia "ler a fonte primária antes de virar texto".

**O que entrou:**
1. **O chip `RELATÓRIO ▸`** no console (ao lado do ARQUIVO): **só aparece quando a missão do rio acaba** (pisca até o primeiro clique) e some quando ela recomeça. **Nada interrompe a partida e nada abre sozinho** ("nenhuma partida é interrompida por sermão"). Carrega sob demanda, como o Arquivo: o painel (2,1 KB) e o texto (`public/relatorio/<língua>.json`, ~5 KB) só baixam no clique.
2. **O painel** (`ui/RelatorioPanel.ts`), cinco abas no estilo do Arquivo: **O QUE ACONTECEU** (o desfecho; a aldeia; o rio; quantos geradores caíram; quantos andróides da Resistência sobraram; o tempo; "por dentro" ou "a tiro"), **três fatos do mundo real** (o mercúrio no cabelo e no peixe, o garimpo em terras indígenas, a emergência Yanomami), cada um com **a data, a fonte com o endereço (abre em outra aba) e o quadro "O QUE ISTO NÃO DIZ"**, e **O QUE É FICÇÃO** (o Draga, o escudo, a Resistência, a mineradora-arquétipo, os números de equilíbrio e **"no jogo o rio se cura em minutos: gesto de vitória, não ciência"**). **Sete línguas.**
3. **A conferência na fonte** (`fichas/fatos-mineracao-amazonia.md` § 0): **abri o estudo Munduruku (nota técnica ENSP/Fiocruz e WWF-Brasil, nov. 2020), a página do MapBiomas e a cronologia do MPF**. **A leitura corrigiu a ficha de 17/10:** o MapBiomas diz **632%**, não 625%; o estudo Munduruku é de **200 pessoas em três aldeias** de uma terra indígena (não "do povo"); **os números de mortes Yanomami misturavam recortes** ("570" e "495 (92%)" não são a mesma conta: 495 são 92% de 538 óbitos de menores de 5 anos) e **divergem entre as fontes: o jogo não cita nenhum**; os "131 barcos queimados" e as "300 balsas" do Madeira **não estão nas fontes primárias achadas** (o MapBiomas fala em mais de 151 balsas por imagem de satélite em 25/10/2021: ler a nota antes de usar). **A portaria da emergência Yanomami ficou 🟡+** (o título, o número e a data estão em fontes oficiais, mas o texto não abriu: 403): o jogo diz **só o que o título confirma**.
4. **A regra "fato tem fonte", com trava:** o teste exige que **cada endereço de fonte do jogo esteja registrado na ficha**, que todo fato tenha `https`, data e "o que isto não diz", que os números batam com o lido (632%, 57,9%, 200 pessoas, 6 µg/g) e que o **número de mortes Yanomami não apareça**.

**Provas:** 16 testes (o formato e as sete línguas, as fontes, os números, os tetos de tamanho, as linhas de "o que aconteceu" em vitória por dentro, vitória a tiro e derrota, a ligação do chip e o painel fora do JS de partida); **5 mutações à mão pegas** (por dentro/a tiro trocados, fonte sem https, fato sem "o que não diz", vitória/derrota trocadas, recomeço sem apagar o resumo). Visto no navegador de verdade, em português e em japonês: cabe sem rolagem em 1280×720 (`arte/relatorio-aconteceu-pt-claude.png`, `relatorio-mercurio-pt-claude.png`, `relatorio-mercurio-ja-claude.png`).

**Custo de CPU:** zero fora do clique. **JS de partida: 495,9 de 500 KB** (+0,25 KB: o chip e o resumo no `Game`).

**Onde o Comandante confere:** jogue a missão do rio até o fim (`…/jogar/?mapa=amazonia&modo=survival&marcha=0.95` perde em ~30 s sem ninguém para derrubá-lo; ou derrube os geradores e plante a carga) e abra **EXPLORAR HANGAR E MODOS**: o chip **RELATÓRIO ▸** pisca no canto de cima, ao lado de ARQUIVO.

**Falta (R13):** **os textos pedem a conferência de uma pessoa de fora** (a regra de `LADO_E_PEDAGOGIA.md` § 7.4), **inclusive as seis traduções, que são minhas**; **a portaria Yanomami** (abrir o texto), **a nota técnica do MapBiomas sobre o Madeira**, **Barcarena** (a cronologia está lida; falta o laudo) e **o factsheet dos 77% a menos de 500 m de um rio** não entraram; o relatório **não muda com o lado** (Aliança ou Consórcio): a parte do Consórcio vem com a campanha invertida; o chip mora no **console completo** (como o ARQUIVO): no menu compacto da primeira partida ele não aparece; **a cura de verdade do rio** segue só desenho.

**Próxima sessão começa com:** o que o Comandante julgar; depois a campanha do Consórcio (P179 camada 4), a dieta de JS e abrir os documentos que faltam.

## AMAZÔNIA, PARTE E: A INVASÃO — os andróides da Resistência plantam a carga no Draga — Claude, 18/10 (branch `claude/amazonia-invasao`, P180)

**O Comandante (17/10):** *"há uma enorme força de defesa deles e teremos que desmantelar, invadir com andróides e destruir por dentro"*; *"prossiga"*. As partes C, D1 e D2 deram o Draga, o escudo e a defesa; a E dá **o que o jogador faz depois que a defesa cai**.

**O que entrou (`AMAZONIA.md` § 5.5):**
1. **A Resistência:** **3 andróides aliados** (CAIPORA, IARA e CURUPIRA) nascem na aldeia junto do jogador e o acompanham. Caídos, renascem na aldeia em 4 s. (Antes a missão do rio não tinha aliado nenhum; sem drones; só offline.)
2. **A escotilha** (`sim/InvasaoDoDraga.ts`, regra pura): **quando o escudo cai** abre uma escotilha no **flanco do casco** (13 m do eixo, do lado sul quando ele olha para o oeste; acompanha o Draga). Os três andróides **vão até ela sozinhos** (ordem `hold`; chegam a pé, cruzando o campo) e **plantam a carga**: **cada andróide a menos de 8 m soma 1/30 por segundo** (um sozinho: 30 s; os três: ~10 s; a barra sobe com cada um, como a injeção dos cabos, ao contrário). Sem ninguém junto a carga recua devagar (45 s para zerar). **Cheia, detona: o Draga cai por dentro** (`CombatSystem.detonar`: seis bolas de fogo em volta do casco, o abate conta) e a missão acaba em vitória, pela regra de sempre.
3. **O canhão do Draga só mira Mechs:** andróide é pequeno demais para o radar de tiro dele. É o que deixa a Resistência chegar (a guarda e as torres **não** têm essa folga). **Os dois caminhos seguem abertos:** derrubar o tronco a tiro (como na C) ou plantar a carga por dentro (ou misturar).
4. **`BotController.plantador`:** a ordem `hold` vira para valer: o robô vai ao ponto e **fica nele** (sem orbitar o alvo nem recuar para esfriar). Sem isto os andróides orbitavam o Draga e ficavam a 12 m da escotilha.
5. **A tela:** a barra do chefe ganha `INVASÃO · CARGA 45% · 2 DE 3 DENTRO` (só com a escotilha aberta); o aviso `ESCOTILHA ABERTA · OS ANDRÓIDES ENTRAM` sobe uma vez; **no cenário**, um **anel verde** no chão junto ao casco, um **disco** que cresce com a carga e um **farol** que se vê de longe (`environment/AmazoniaEscotilha.ts`, no pedaço sob demanda). **Idioma:** 2 textos novos por língua nas seis línguas.
6. **O renascimento do rio:** com a Resistência entre os rastreados, o "ponto mais longe dos vivos" mandaria o jogador (e os andróides) para o outro lado do mapa ao morrer; **na missão do rio todo mundo renasce na aldeia** (o ponto dela é o único da lista).

**Provas:** 12 testes da regra (a escotilha fechada com escudo de pé, abrir uma vez, 30 s contra 10 s, o teto de 3, o recuo, a detonação única, a geometria do flanco), **10 da partida** (a Resistência existe e nasce nos pontos, a escotilha acompanha o Draga, **os andróides cruzam o campo a pé e chegam**, a carga cheia derruba o Draga: vitória e abate, o canhão ignora andróides e mira o Mech, o jogador renasce na aldeia, recomeçar fecha tudo), 3 do HUD e 2 de lugar (ninguém nasce no rio nem dentro de estrutura). **8 mutações à mão: 7 pegas** (escotilha sempre aberta, o canhão mirando andróide, sem plantador, sem detonação, recomeço sem reiniciar, respawn pelo ponto mais longe, abrir sem o escudo cair); **a que escapa é equivalente** (contar "qualquer aliado" em vez de "andróide": na missão só há andróides aliados). Captura: `.decepticons/arte/amazonia-escotilha-e1-claude.jpg` (a escotilha aberta com a carga a 45%; a bancada ganhou a vista `escotilha`).

**Custo de CPU:** por tick, um laço sobre ≤ 3 andróides e uma soma; a ordem `hold` só é reemitida quando a escotilha anda 6 m. **Medido: a missão inteira custa ~1,4 ms por tick** (guarda dormindo, Resistência andando: ~1,0 ms com a escotilha aberta). **JS de partida: 495,7 de 500 KB** (a E somou 2,4 KB: a regra, a fiação do `Match`, o HUD e o `detonar`; **folga de 4,3 KB: a próxima parte que mexer no pacote de partida tem de pagar com dieta**, por exemplo tirando a regra da missão do rio do pacote inicial).

**Onde o Comandante confere:** `…/jogar/?mapa=amazonia&modo=survival&marcha=0.5` (o Draga já no meio dos geradores): derrube os três geradores (a cerca em x -100, a planta em x 20, a cava em x 260): o aviso `ESCOTILHA ABERTA` sobe, o farol verde aparece no flanco sul do Draga e a Resistência (que estava com você na aldeia) corre até ele; com a carga em 100% o Draga explode por dentro. Ou ignore a Resistência e o derrube a tiro.

**Falta (R13):** **a cura de verdade do rio** (a limpeza no fim segue só desenho; o Relatório de Consequências e o Consórcio, P179 camadas 3 e 4, são a próxima etapa); **o equilíbrio** (13 m, 8 m, 30 s por andróide, 45 s de recuo, 3 andróides, 4 s de renascimento) é **proposta**, não validado com jogadores; **não joguei a invasão até o fim a olho** (o headless roda a ~0,25× do tempo): a captura é do cenário; **os andróides da guarda ainda atiram na Resistência no caminho** (e as torres só miram o jogador); a Resistência não tem voz nem rádio; **só offline**; sem som da detonação além do comum.

**Próxima sessão começa com:** o que o Comandante julgar; depois o Relatório de Consequências / Consórcio e uma **dieta de JS** (4,3 KB de folga).

## AMAZÔNIA, PARTE D2: AS TORRES ARMADAS E A FORÇA DE DEFESA — Claude, 18/10 (branch `claude/amazonia-guarda`, P180)

**O Comandante (17/10):** *"há uma enorme força de defesa deles e teremos que desmantelar"*; *"a amazônia já foi entregue em partes, prossiga"*. A D1 deu os geradores sozinhos; a D2 põe **quem os defende**.

**O que entrou (`AMAZONIA.md` § 5.4):**
1. **As oito torres de vigia da margem ficaram armadas** (`sim/TorresDeVigia.ts`, regra pura): cada uma, com um alvo a até **170 m** e a visada livre, solta uma **rajada de 4 tiros** (0,16 s entre eles) a cada **2,4 s**, com erro de mira sorteado de uma semente (determinístico) e começo escalonado (as oito não atiram juntas). O tiro é um projétil sem dono (dano 8, alcance 190): **fogo de cobertura que atravessa o rio**. **Calam quando o gerador da CERCA cai** (é ele que as alimenta): o jogador escolhe entre cruzar sob fogo e ir derrubá-la.
2. **A força de defesa** (`AMAZONIA_GUARDA`): **3 Mechs e 6 androides** em volta dos geradores, do lado norte do rio. **Seguram o posto** (não correm atrás do jogador nem para a aldeia) e **não renascem**: derrubado, fica derrubado. O Draga marcha sem a escolta de ninguém.
3. **Dormem** (`BotSystem`): sem alvo a **420 m** e sem dano, a guarda **não pensa nem anda** (zero CPU por tick); acorda com um alvo mais perto, ou com dano, e fica acordada **6 s** depois do último motivo. **O chefe nunca dorme** (a marcha dele é o relógio da missão).
4. **Nascem no chão** (`BotSystem.alturaDoChao`): o mapa de relevo não admite y = 0 (o robô nascia enterrado e os androides caíam do mundo: 9 ms por tick; agora **~3,2 ms**).
5. **A tela:** a barra do chefe ganhou a linha `TORRES DA MARGEM ARMADAS` / `TORRES DA MARGEM SEM ENERGIA` (muda de cor). **Idioma:** 2 textos novos por língua nas seis línguas; o teste de cobertura os cobre.
6. **Provas:** 7 testes da regra das torres e 8 da partida (a guarda existe e segura o posto, não renasce, a torre atira e acerta, cala sem a CERCA, não atira a 1.000 m, o Mech da guarda troca tiro, a guarda dorme e acorda); **3 mutações à mão pegas** (torres sempre ligadas, sem sono, sono que nunca acorda por perto). O teste "o Draga atira" do `Match.rio` passou a contar só os tiros do canhão dele (as torres também atiram em quem anda no leito).

**Custo de CPU:** por tick, as torres são um laço de 8 e **um raio só quando uma está pronta para atirar**; a guarda (9 robôs) dorme longe, e perto custa o que um bot custa; a missão inteira **~3,2 ms por tick**. **JS de partida: 493,3 de 500 KB** (a regra das torres, o sono e a fiação do `Match` somaram 1,6 KB; folga 6,7 KB): a E carrega sob demanda.

**Onde o Comandante confere:** `…/jogar/?mapa=amazonia&modo=survival`: ande até a margem sul do rio, de frente para o norte, para sentir o fogo das torres (a cerca em x -100, a planta em x 20, a cava em x 260); derrube a CERCA e as torres calam (a linha da barra do chefe vira `SEM ENERGIA`); os Mechs e androides só se mexem quando você chega a menos de 420 m. Para testar sem esperar: `&marcha=0.5`.

**Falta (R13):** **E:** a invasão com androides e a cura de verdade; **o equilíbrio** (dano 8, rajada de 4 a cada 2,4 s, 170 m, 3 Mechs e 6 androides) é **proposta**, não validado com jogadores; **não joguei a defesa até o fim a olho** (o headless roda a ~0,25× do tempo) e **não fotografei a guarda de perto**; **as torres não têm som, clarão de boca nem desenho de tiro próprios** (usam o projétil comum); o aviso do alto da tela **não** diz que a CERCA derrubou as torres (a linha da barra do chefe diz; o aviso do gerador que caiu ocupa o alto).

**Próxima sessão começa com:** a **E** (a invasão com androides e a cura do rio); depois o Relatório de Consequências e o Consórcio (P179 camadas 3 e 4).

## AS MÉTRICAS DOS PILOTOS: QUANTOS ENTRAM, QUANTO JOGAM, QUEM VOLTA — Claude, 18/10 (branch `claude/metricas-usuarios`, P185)

**A pergunta do Comandante (17/10):** *"tem como termos as métricas dos usuários, quantos entram, quantos minutos jogam, quantas mortes, etc? [...] depois implementarmos melhores práticas de marketing orientado pelas nossas informações de usuários?"*

**Resposta curta: sim, e agora o servidor mede.** Já existiam as contagens anônimas (visitas, cliques, partidas, país, pico). **O que entrou:**
1. **Por conta:** a tabela `atividade` (uma linha por conta por dia: abriu o jogo, rodadas, segundos, abates, mortes). Dela saem **DAU/WAU/MAU**, **quem de fato jogou**, **minutos por piloto**, contas novas por dia e a **retenção D1 e D7**. Alimentada pela rodada que o navegador manda **com a sessão** e por abrir o jogo com a sessão guardada.
2. **Para todos (com e sem conta):** rodadas, minutos, abates e mortes **por dia** e **por mapa e modo**, a **onda** em que a rodada parou e a **vitória ou derrota** das missões (o relatório de partida ganhou `map`, `wave` e `won`, opcionais).
3. **A tela do dono:** `/metricas/` ganhou **Pilotos com conta** e **O que se joga**; o `/metricas` traz o bloco `usuarios`. **Só contagens: nenhum e-mail nem número de conta.**
4. **A faxina:** o servidor passou a varrer sessões vencidas e atividade de mais de 400 dias ao subir e a cada 6 h (`limparExpiradas` existia e ninguém chamava).

**Provas:** testes de conta (cenário com dia de Brasília e virada às 03:00 UTC, retenção do dia exato, banco vazio, faxina), de agregação (tetos, reenvio, arquivo antigo), HTTP de ponta a ponta com o servidor de verdade (conta + rodada com sessão, reenvio, sessão inventada, preflight, visita) e do cliente (a sessão só vai ao servidor dono dela). **Mutação à mão: 32 de 32 pegas.** **E ponta a ponta no navegador** (o fio do `Game.ts`, sem teste de unidade): o jogo de verdade no Chrome, com a sessão de uma conta, na Amazônia (`marcha=0.95`) e na Praia (Sobrevivência) mandou ao servidor local `map`, `wave`, `won` e a sessão; o `/metricas` mostrou 1 piloto que jogou, 3 rodadas, 4 min, por mapa e dia (captura: `.decepticons/arte/metricas-pilotos-p185-claude.jpg`, com os números dessa prova).

**Custo de CPU:** zero no tick e no quadro do jogo. O cliente soma dois números por rodada (onda, desfecho); o servidor faz um `INSERT` pequeno por rodada de quem tem conta e um por abertura do jogo; a leitura (`metricasUsuarios`) só roda quando o dono abre o `/metricas`.

**ATENÇÃO (privacidade, R13):** a atividade por conta é **dado pessoal novo**. **O jogo ainda não tem política de privacidade, "apagar minha conta" nem "baixar meus dados"**, e o Google Analytics já está nas páginas. O inventário do que é guardado está em `PRIVACIDADE.md`; **antes de trazer jogadores o dono precisa decidir e publicar a política** (a proposta técnica de apagar/exportar está lá, construo quando ele mandar).

**Falta:** o chassi e o lado por conta; vitória em Bandeira e Domínio (precisa do time do jogador no online, P81); o que o marketing faz com os números (só vale com jogadores medidos).

**Onde o Comandante confere:** `cybermech.online/metricas/` (token em `.tmp/servidor/metricas-token.txt`, ou entrando com a conta de admin): seções **Pilotos com conta** e **O que se joga**. **Os números só começam a encher depois que o site e o servidor atualizarem** e pilotos com conta jogarem; antes disso as seções mostram zeros.

**Próxima sessão começa com:** o **time do jogador na sala online (P81)**: é o que falta para Bandeira 2v2 online, para os lados Aliados × Consórcio (P186) e para a vitória nesses modos.

## AMAZÔNIA, PARTE D1: O ESCUDO DO DRAGA E OS TRÊS GERADORES — Claude, 18/10 (branch `claude/amazonia-defesa`, P180)

**O Comandante (17/10):** *"a amazônia já foi entregue em partes, prossiga"* (a parte C estava pronta e testada num branch local sem PR: **publiquei como veio, #375**, e a produção já religou nela).

**O que entrou (§ 5.3 do `AMAZONIA.md`):**
1. **Os geradores** (`environment/AmazoniaGeradores.ts`): três torres de força (CERCA, PLANTA e CAVA) que se **quebram a tiro** (`Destructibles.addExterno`, o mesmo registro dos coqueiros): 1.500 de vida cada, destroços e faíscas ao cair, seis malhas de desenho. Carregam com a missão (sob demanda).
2. **O escudo** (`sim/EscudoDoDraga.ts`, pura): **com algum gerador de pé o Draga recebe 10% do dano**, por tiro, explosão ou dano por segundo (`DragaMech.escudo`); cai com o último e não volta (rodada nova os devolve).
3. **A tela:** a barra do chefe diz `ESCUDO · 3 DE 3 GERADORES` (e `ESCUDO CAIU`), a regra vira "derrube os geradores", e cada queda avisa.
4. **Idioma (o que a auditoria rigorosa achou):** a Amazônia da parte C **não tinha tradução** na barra do chefe, na aldeia, nos avisos da marcha e nos fins de missão; entraram **28 textos por língua**. **Duas correções no motor do tradutor** (`i18n.ts`): a composição aninhada passa a ter **duas voltas** ("MECH · Lançador EMP MK I") e uma chave sem " · " **não engole** um " · " na borda da lacuna ("ANDRÓIDE " + "· manso" saía meio traduzido).
5. **Provas:** o teste de regra (11 casos, mutações de ligação pegas), o de lugar (nenhum gerador no rio nem dentro de estrutura), o do HUD e o de cobertura de idioma; captura do cenário (`arte/amazonia-gerador-d1-claude.jpg`, `amazonia-geradores-d1-claude.jpg`; a bancada ganhou as vistas `gerador` e `geradores`).

**Custo de CPU:** zero por quadro (um número por tick na regra; o HUD só mexe no DOM quando a contagem muda); seis desenhos e três sensores. **JS de partida: 491,7 de 500 KB.**

**Onde o Comandante confere:** `…/jogar/?mapa=amazonia&modo=survival` (a missão do rio): a barra do chefe diz `ESCUDO · 3 DE 3 GERADORES`; atire no Draga e veja o dano quase não andar; corra para leste pela margem (a cerca em x -100, a planta em x 20, a cava em x 260) e derrube as três torres de força. Para testar sem esperar: `&marcha=0.5`.

**Falta (R13):** **D2:** as torres da margem armadas e a **força de defesa** (Mechs e androides); **E:** a invasão com androides e a cura de verdade; **o equilíbrio** (10%, 1.500) é proposta; **não joguei a missão até o fim a olho** (o headless roda a ~0,25× do tempo): a captura é do cenário; os fatos da ficha da mineração seguem 🟡.

**Próxima sessão começa com:** o que o Comandante julgar; depois a **D2** (as torres e a força de defesa).

## O ONLINE VOLTA SOZINHO QUANDO CAI, E O QUE FALTA PARA LANÇAR — Claude, 18/10 (branch `claude/reconexao-online`, P184 b)

**O Comandante (17/10 à noite):** *"consegui conectar 2 pcs diferentes na mesma sala da arena! deu certo!"* (a correção da porteira, P184); e pediu **as métricas dos usuários** (P185), **a ideia dos lados Aliados × Consórcio** (P186) e que **o online funcione por inteiro antes de tudo**.

**O que entrou (`client/src/net/OnlineSession.ts`, `NetClient.ts`):** **reconexão automática (G13)**: quando a conexão cai (a VPN trocou, o túnel soluçou, o servidor travou ou reiniciou, a porteira cortou), a sessão limpa a sala velha, avisa **"ONLINE · CONEXÃO CAIU · RECONECTANDO (n/6)"** no canto (o mundo segue; nada cobre a tela) e tenta de novo com esperas de **0,3, 0,7, 1,5, 3, 5 e 5 s** (~15 s); volta à sala como piloto novo (a previsão reposiciona o Mech). **Recusa** (versão, sala cheia, montagem) **não reconecta**; seis falhas seguidas viram "caiu: recarregue". **Achado de caminho:** o `NetClient` só avisava o fim da conexão no `close`, e uma conexão recusada só dá `error` em alguns ambientes (o Node dos testes): agora avisa **uma vez**, venha o que vier. **Testes:** o servidor de verdade cai e volta no mesmo endereço (a sessão reconecta e vê os robôs), duas quedas seguidas, esgotar as tentativas, recusa sem reconexão, encerrar cancela, e o aviso único do `NetClient`; **mutação à mão: 10 de 10**.

**O que falta para o online ser lançado (a lista honesta, do `ROADMAP.md` e do `STATUS_REAL.md`):**
1. ✅ **Dois PCs, VPNs diferentes, mesma sala** (provado pelo Comandante, 17/10) e ✅ **reconexão automática** (esta entrega).
2. **Times na sala online (P81)**: dois amigos no mesmo time; é o contrato de que o CTF 2v2 online e os **lados Aliados × Consórcio** (P186, `LADO_E_PEDAGOGIA.md` § 3.5) dependem. **É o próximo passo técnico.**
3. **Métricas dos usuários (P185):** retenção, usuários únicos e tempo por conta (a primeira fatia entra a seguir).
4. **Jogador remoto desenhado com o chassi da montagem dele** (hoje todo humano aparece como Vector-09 para os outros).
5. **Homologar online com rede real e carga** (capacidade, latência e perda, duração prolongada) antes de prometer escala; **o PC do servidor é o de trabalho e tem 6 GB**: para o lançamento o servidor precisa de **máquina própria** (decisão e custo dele; ver `DEPLOY.md`).
6. **Ranking e a política de privacidade (LGPD)** antes de trazer público.
7. Já em dia: login, contas, cópia de segurança do banco, mural, porteira tolerante a picos.

**Onde o Comandante confere:** derrube a conexão de propósito (trocando a VPN, ou desligando e ligando a rede por alguns segundos) com a partida aberta: o canto mostra **RECONECTANDO (1/6)…** e o jogo **volta à sala sozinho**; recarregar a página só é preciso depois de seis falhas.

**Falta (R13):** **não testei com a VPN dele** (só com o servidor de verdade nos testes); o placar da sessão **zera** na volta (o servidor trata como piloto novo); o jogador volta **no ponto de nascimento** da sala; a partida em andamento no servidor (a rodada) segue sem ele durante a queda.

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
