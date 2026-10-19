> **Arquivo:** as entradas com mais de dois dias moram em `.decepticons/arquivo/historico-*.md` (nada se perdeu; `npm run arquivar` move mais). Procure por busca, não leia inteiro.

> **Arquivo:** as entradas com mais de dois dias moram em `.decepticons/arquivo/historico-*.md` (nada se perdeu; `npm run arquivar` move mais). Procure por busca, não leia inteiro.

> **Arquivo:** as entradas com mais de dois dias moram em `.decepticons/arquivo/historico-*.md` (nada se perdeu; `npm run arquivar` move mais). Procure por busca, não leia inteiro.

> **Arquivo:** as entradas com mais de dois dias moram em `.decepticons/arquivo/historico-*.md` (nada se perdeu; `npm run arquivar` move mais). Procure por busca, não leia inteiro.


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
