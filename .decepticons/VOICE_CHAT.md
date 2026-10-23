# VOICE CHAT — o chat de voz do CYBERMECH (P205)

> **Estado:** construído e provado em Chrome de verdade (`medicoes/voz.mjs`); **restrito** (`tela:voz`, padrão do catálogo de visibilidade, P191): só o modo Comandante vê e usa, até ele soltar no painel.
> O plano veio do Comandante em 18/10 (decisões: microfone aberto por padrão com apertar-para-falar opcional, áudio espacial, canais TODOS e TIME, TURN a critério técnico). Na mesma hora ele pediu: **"simples, sem custo inicial e eficiente"**. Este documento diz o que foi feito, **onde e por que o código difere do plano**, o que foi medido e o que falta.

## 1. O que é

Os jogadores humanos de uma sala falam com o microfone. O áudio vai **direto de um navegador ao outro** (WebRTC, UDP, malha: cada um liga com cada um); o servidor do jogo só repassa a **oferta** e a **resposta** da conexão (uma de cada por par, na entrada). Não passa áudio pelo servidor, não toca no tick de 60 Hz (G1/G2), não sobe o `PROTOCOL_VERSION` e não pesa no teto de rede do jogo (G11: a voz é separada do orçamento de 8 KB/s).

## 2. O que difere do plano, e por quê

| O plano dizia | O que foi feito | Por quê |
|---|---|---|
| Seis mensagens (30 a 35) com `ICE` à parte e `READY` com canal | **Três** (30 `PRONTO`, 31 `LISTA`, 32 `SINAL`) | O SDP sai **já com os endereços** (espera a coleta, no máximo 2,5 s): uma oferta e uma resposta por par, **nenhum candidato por mensagem**. Menos mensagens, e a rajada de candidatos nunca chega perto da porteira (60 msgs/s, `guard.ts`) |
| O servidor **valida** o `from` | O servidor **troca** o id do remetente pelo de verdade | Não há o que validar: o cliente só diz o destino. Ninguém se passa por outro |
| (não mencionava) mensagem de 1 KB | `maxPayload` do `ws` sobe a 3075 **só para a voz**; mensagem de jogo acima de 1 KB continua derrubando a conexão (G7) | Um SDP de áudio com endereços passa de 1 KB (o teste usa 2,4 KB). `Server.ts` corta o resto como antes |
| TURN do Metered.ca (500 GB grátis) | **Sem TURN**, só o STUN público do Google | "Sem custo inicial": o Metered pede cadastro e credenciais. Quem está atrás de rede que barra a conexão direta (o plano estima ~15%; **não medido aqui**) fica **sem voz** e a tela diz "N SEM CONEXÃO". TURN próprio (coturn) entra quando um jogador real reclamar |
| "Opus DTX cuida do silêncio ≈ 0 kbps" | O DTX **não vem ligado**: o SDP leva `usedtx=1;useinbandfec=1;maxaveragebitrate=24000` (`voice/opus.ts`) | O Chrome sozinho manda ~50 pacotes por segundo mesmo calado. **Medido** na bancada (seção 5) |
| `PannerNode` com HRTF | `equalpower` | O HRTF custa bem mais em GPU e CPU integradas (requisito mínimo do jogo, G12) e, para voz, o ganho é pequeno; o `equalpower` já dá o lado |
| Canais TODOS e TIME | **Só TODOS** | O protocolo online **não tem time** (`shared/net` não carrega equipe; `allies: false` na sala): filtrar por time não tem o que filtrar. Entra junto com os times online (CTF) |
| Tecla T: segurar (PTT) | T **segura** no modo "segurar para falar" e **alterna o mudo** no modo "sempre aberto" | Com o mouse travado no jogo não dá para clicar em botão; uma tecla só para os dois modos. Trocável em Configurações > Controles |
| Ícone de alto-falante nas placas de nome | Uma linha no canto de baixo à esquerda com o estado do microfone e **quem está falando** | A placa de nome é canvas do `Nameplates.ts`; a linha do HUD resolve sem mexer nele |
| Microfone pedido ao entrar | Igual, **mas só se a funcionalidade estiver liberada** | Entrou no catálogo como `restrito` (regra do P191); sem isso nenhum visitante veria o pedido de microfone |
| Bundle ~4 KB gzip no pacote de todos | **Pedaço sob demanda** (`import()` no `Game.ts`): **3,5 + 0,7 KB gzip**, baixados só por quem liga a voz numa sala online. O JS de partida ficou em **495,4 de 500 KB** (com a voz estática estava em 498,2: a dieta de JS, P187) | O jogador que não usa voz (o público, enquanto `tela:voz` for restrita) nunca baixa nada dela |

## 3. Como funciona

```text
        jogador A                       servidor                     jogador B
  PRONTO(1) ───────────────────────►  guarda A na voz
                                      LISTA [A] ───────────► (A)
                                                          PRONTO(1) ◄──── B entra
  LISTA [A,B] ◄─────────────────────  LISTA [A,B] ──────────────────────► LISTA [A,B]
  (id menor oferece)
  SINAL(oferta → B) ────────────────►  troca o id: "de A" ──► SINAL(oferta de A)
                                                           ◄── SINAL(resposta de B)
  SINAL(resposta de B) ◄────────────  troca o id: "de B"
  ═══════════════ áudio Opus direto (UDP), sem passar pelo servidor ═══════════════
```

- **Quem oferece:** o id menor. Nunca os dois ao mesmo tempo.
- **Um transceptor de áudio de ida e volta por ligação.** O microfone entra e sai por `replaceTrack` (apertar-para-falar, mudo, microfone que só chega depois do "permitir" do navegador) **sem renegociar**. Por isso quem **recusa o microfone entra como ouvinte** e quem o libera depois começa a falar sem refazer a ligação (provado na bancada).
- **Áudio espacial:** cada colega passa por um `PannerNode` na posição do robô dele; o ouvinte é o seu robô, olhando para onde a câmera olha. **Volume cheio até 12 m, cai em linha reta e some em 160 m** (`ALCANCE_DA_VOZ`). Reaproveita o `AudioContext` do jogo (um contexto só).
- **Quem fala:** um `AnalyserNode` por colega, lido a 10 Hz (só o indicador da tela; nada vai pela rede).
- **Carregamento:** o `Game.ts` só baixa o pedaço da voz quando o jogador a quer **e** está numa sala online **e** a funcionalidade está liberada; o `WELCOME` que passou antes do download é reposto com o id guardado.
- **Reconexão:** quando a conexão com a sala cai, as ligações fecham e, na volta, o chat entra na voz de novo **sem pedir o microfone outra vez**.
- **Código:** `shared/net/voz.ts` (contrato), `server/voz.ts` (relé, ligado em `ArenaRoom.ts`), `client/src/voice/` (`VoiceChat`, `MicController`, `VoiceSpatial`, `VoiceHud`, `opus`), configurações em `Settings.ts` (`voiceOn`, `voiceMode`, `voiceVolume`, tecla `ptt`).

## 4. Segurança e privacidade

- **O relé só repassa e só confere a forma:** `SINAL` precisa começar com `v=0`, caber em 3 KB e ter tipo conhecido; o destino precisa estar **na voz da mesma sala**; cada jogador tem um teto de **30 mensagens de voz por janela de 10 s** (a porteira geral da conexão continua valendo). Nada de decodificar SDP no servidor.
- **A voz não é gravada nem guardada em lugar nenhum.** O servidor nunca a recebe.
- **O que a voz expõe, e a política diz (19/10):** WebRTC direto entre jogadores significa que **cada jogador da sala pode ver o IP dos outros** (nos endereços do SDP), e o **STUN do Google recebe o IP** de quem entra na voz. A `/privacidade/` (`scripts/privacidade.mjs`) ganhou uma linha na tabela "O que guardamos", uma em "Com quem compartilhamos" e um item em "Em poucas palavras"; `POLITICA_VERSAO` passou a `2026-10-19` e o `PRIVACIDADE.md` ganhou a linha. **O Comandante liberou `tela:voz` ao público antes de a política mudar** (o servidor mostrava `tela:voz: publico` em 19/10); o texto é rascunho a revisar, não parecer jurídico.
- **Chave de desligar:** o painel de visibilidade (`tela:voz`) liga e desliga a voz para todos sem republicar o jogo; o cliente reaplica quando o servidor muda.
- **Ainda não existe** mudo por jogador nem denúncia: um jogador abusivo só se resolve pelo desligamento geral ou saindo da sala (pendência abaixo).

Texto sugerido para a política:
- *Tabela, "Você usa o chat de voz":* "O áudio do seu microfone, enquanto você fala, **direto para os outros jogadores da sala** (nunca passa pelo nosso servidor e nada é gravado). Os outros jogadores da sala podem ver o seu endereço IP, porque a conexão é direta entre os navegadores." — *Para quê:* "Conversar com quem joga com você (execução do serviço; você liga e desliga em Configurações)." — *Por quanto tempo:* "Só durante a conversa."
- *Compartilhamento:* "**Google (STUN):** o seu navegador pergunta a um servidor público do Google qual é o seu endereço na internet, para o chat de voz conseguir conectar. Só quando o chat de voz está ligado."

## 5. Provas

**Testes (rodam no `npm run check`), 81 novos:** o contrato (6), o relé (9), a sala e a rede de verdade com o teto de tamanho (5), o Opus no SDP (5), o microfone (5), o áudio espacial (9), a malha P2P com conexão falsa (27), o HUD e o texto nas seis línguas (9), as configurações (5) e a `OnlineSession` contra o servidor de verdade (1). **Mutação à mão: 34 defeitos plantados, 33 pegos**; o que escapou (a voz nascer pública em vez de restrita) virou teste do catálogo.

**Bancada em Chrome de verdade (`node .decepticons/medicoes/voz.mjs`)**, com um servidor de jogo de verdade, o `NetClient`, o `VoiceChat` e o áudio espacial do jogo, e microfone falso (um arquivo de tom ou de silêncio):

| O que foi medido | Resultado |
|---|---|
| Dois navegadores se ligam por WebRTC (a sinalização passou pelo servidor, o áudio foi direto) | sim, nos dois sentidos |
| Mudo (T no modo aberto) e apertar-para-falar (T segurado) | a faixa fecha e o outro lado **deixa de ouvir**; abre e ouve de novo |
| **Voz espacial:** volume a 5 m, a 100 m e a 200 m (RMS depois do panner) | **0,282 → 0,114 (0,41×) → 0** (a queda em linha reta entre 12 e 160 m) |
| Microfone recusado | entra como ouvinte: **ouve** o outro, o outro **não** o ouve |
| Microfone que chega depois da ligação (8 s) | o outro passa a ouvi-lo **sem renegociar** (`replaceTrack`) |
| Quem fecha a aba | some da voz dos outros e a ligação é desfeita |
| Restrições reais do microfone do jogo (eco, ruído, ganho automático) | aceitas pelo Chrome |
| **Custo na rede falando** (por colega) | **52 pacotes/s, 37 kbps** com os cabeçalhos RTP (a carga é o teto de 24 kbps) |
| **Custo na rede calado, microfone aberto** (por colega) | **5,5 pacotes/s, 1,9 kbps** — é o DTX; sem ele seriam ~50 pacotes/s |

Os dados estão em `medicoes/voz-<data>.json`; a bancada sai com código 1 se qualquer verificação falhar. Capturas do **jogo de verdade** em `?comandante=1` (com um colega falando, `medicoes/voz-jogo.mjs`): `arte/voz-hud-jogo-claude.png` (o indicador no canto de baixo à esquerda: "MICROFONE ABERTO: [T] MUDA" e "▶ BRAVO") e `arte/voz-configuracoes-claude.png` (Configurações > GRÁFICOS E SOM > CHAT DE VOZ, com o selo TESTE).

## 5b. No celular (P209, 19/10)

**Ouvir e falar sozinho?** **Ouvir: sim**, sem fazer nada: o toque em "jogar" já libera o áudio do navegador (o mesmo `AudioContext` do jogo), e a voz dos colegas toca. **Falar: sim**, no modo padrão "microfone aberto": o navegador pergunta uma vez pelo microfone e, aceito, ele transmite. **Antes do P209 faltava o resto:** no celular não existe a tecla T, então ninguém conseguia **silenciar** nem usar o **segurar para falar**.

**O botão de microfone** (`voice/VoiceHud.ts`, CSS `.voz-mic`): aparece **só no modo toque**, com o jogo rodando e a voz ativa, no canto direito, **sob PAUSA e PLACAR** (a coluna do polegar direito; o direcional e os botões de combate não mudam de lugar). Fica **acima** da camada de mira (z-index): o toque chega nele. **Tocar** alterna o mudo (modo "sempre aberto"); no modo "segurar para falar" (Configurações > GRÁFICOS E SOM > CHAT DE VOZ) a voz sai **enquanto o dedo estiver nele**. O símbolo e a cor dizem o estado (no ar, mudo, em espera, pedindo, sem microfone) e o texto do indicador fala do botão, sem citar tecla.

**Microfone recusado sem querer:** tocar no botão **pede o microfone de novo** (e o microfone nasce aberto), sem recarregar o jogo. Se o navegador guardou a recusa, o jogador libera nas permissões do site e toca de novo. (O teste achou um defeito aqui: o mesmo toque também alternava o mudo, e o microfone nascia mudo.)

**Prova:** `medicoes/voz-celular.mjs` (Chrome com tela de toque, 915×412 deitado, toque de verdade pelo CDP, 12 verificações; foto em `arte/voz-celular-claude.png`). **Não provado em aparelho de verdade**: o **iPhone** é o risco (o Safari tem histórico de problemas com áudio WebRTC dentro do Web Audio e exige o gesto para o áudio); Android com Chrome é o caso mais provável de funcionar. Se o iPhone não tocar a voz, o caminho é tocar o fluxo direto num `<audio>` (sem o espacial) só nesse aparelho: decidir depois do teste num aparelho real.

**Custo no celular:** o mesmo de qualquer jogador (Opus a 24 kbps por colega falando, ~2 kbps calado; nada por tick); bateria e dados móveis valem o que vale uma chamada de voz.

## 5c. Testar o microfone (P212, 19/10)

**O problema:** o Comandante testou e **não saiu som**. A causa provável: **o chat de voz só toca para quem está do outro lado**, e sozinho na sala não há ninguém; além disso o indicador dizia "MICROFONE ABERTO" sem avisar que ninguém mais estava na voz, e não havia como saber se o microfone prestava.

**O que há agora** (`voice/MicTest.ts`, pedaço sob demanda; Configurações > GRÁFICOS E SOM > CHAT DE VOZ):
- **Aparelho do microfone:** a lista de aparelhos (ganha os nomes depois da permissão); a escolha vale para o chat de voz também e **troca no meio da voz sem renegociar** (`replaceTrack`). O aparelho salvo que foi desligado cai no padrão.
- **[ TESTAR ]:** abre o microfone com **as mesmas restrições do jogo**, mostra a **barra de nível ao vivo** e diz se está captando ("Funcionando…") ou, passados 4 s sem voz, "Sem sinal". **"Ouvir a minha voz"** devolve o som (com o aviso dos fones: sem eles dá microfonia).
- **Cada falha tem o seu texto:** o navegador bloqueou (como liberar: o cadeado ao lado do endereço), nenhum microfone, em uso por outro programa, e o resto.
- **O microfone nunca fica aberto esquecido:** o teste **para** ao fechar as Configurações, ao trocar de aba, ao esconder a página e **sozinho depois de 2 minutos** (provado no Chrome: a faixa termina de verdade).
- **O indicador do jogo** passou a dizer **"NINGUÉM MAIS NA VOZ: TESTE O MICROFONE EM CONFIGURAÇÕES"** quando você está só, e o aviso some quando alguém entra.

**Prova:** `medicoes/voz-teste-mic.mjs` (Chrome com microfone falso; 14 verificações, inclusive o caso do navegador que bloqueia o microfone); foto `arte/voz-teste-microfone-claude.png`; 15 de 15 mutações à mão pegas.

## 5d. Só para maiores de 18 anos (P211, 19/10) — SUSPENSO na fase de testes (P241, 21/10)

> **Hoje a regra é outra** (ordem do Comandante em 21/10: "essa regra de 18 anos ta muito restritiva… LIBERA VOZ PRA CONVIDADO E CONTA SEM IDADE"): `VOZ_SO_PARA_ADULTO_DECLARADO = false` em `shared/net/auth.ts`. **Convidado e conta sem idade falam e ouvem; o menor declarado entra na voz só para ouvir** (sem microfone: o cliente nunca o pede, `microfoneLiberado`; a narração F8 segue a mesma regra). O servidor admite todos no `PRONTO` (`autorizarPorSessao`, `server/voz.ts`) e o convidado manda o token vazio. **Limite:** o áudio vai entre os navegadores, então só o cliente impede o microfone do menor, e um menor que joga como convidado fala. A política pública mudou junto (`2026-10-21.1`). O texto abaixo descreve a **regra da P211, que volta** com `VOZ_SO_PARA_ADULTO_DECLARADO = true` (os testes provam as duas) e que o Comandante decide antes de abrir ao público (`LANCAMENTO.md`).

**A ordem do Comandante:** *"no início, perguntar a IDADE pra fazer o cadastro do login. Menores de 18 anos NÃO TÊM ACESSO ao microfone nem aos áudios dos outros jogadores, apenas o áudio do jogo."*

**A regra (uma só, no servidor):** só entra na voz quem tem **conta** cujo **mês e ano de nascimento** deem **mais de 18 anos completos** (`ehMaiorDeIdade`, `shared/net/auth.ts`). A precisão é o mês: quem faz 18 anos **neste mês** ainda não é adulto (o dia não se sabe, e na dúvida a voz não abre). Convidado (sem conta), conta **sem idade informada** e conta de **menor** ficam de fora: **sem microfone e sem ouvir ninguém**; o áudio do jogo segue normal.

**Como o servidor impõe (o cliente só poupa a viagem):**
- O `PRONTO` leva o **token da sessão** (`[tipo][ligado][token utf8, até 200 bytes]`). `RelayDeVoz` chama o `autorizar(token)` que a sala recebe do servidor (`room.definirAutorizacaoDeVoz`): confere a sessão no banco e a idade da conta. **Padrão: negar** (sem autorizador, ninguém entra). Quem não passa não entra na lista, não recebe `LISTA` nem `SINAL`, e ninguém recebe os dele. Quem **já estava** e manda um `PRONTO` que não vale (sessão vencida) **sai** e os outros recebem a lista nova.
- Um cliente adulterado (que não confere a idade e manda o token de um menor, ou nenhum) é recusado do mesmo jeito **na regra da P211** (testes em `server/voz.test.ts`); na fase de testes todos entram e o `voz-idade.mjs` (cenário 6) diz o limite.
- O cliente (`elegibilidadeDaVoz`, `vozDeveLigar`) só **esconde** os controles (voz e teste do microfone) e **nem pede o microfone** ao navegador quando a conta não é adulta; mostra a frase certa (convidado: *crie uma conta*; sem idade: *informe o mês e o ano*; menor: *sem chat de voz, o áudio do jogo segue normal*).

**O cadastro e a conta:**
- **Criar conta** pede o **mês e o ano** (duas listas; o botão só liga com os dois). O servidor guarda `AAAA-MM`, **sem o dia**, e devolve **só a faixa** (`adulto`, `menor`, `sem-idade`), nunca a data. O campo é opcional **no servidor** (um cliente velho cria a conta "sem idade") e obrigatório **na tela**.
- **Quem já tinha conta** (ou criou por um cliente velho) vê o pedido na aba JOGO e informa **uma vez** (`POST /conta/nascimento`): **a data não muda** (o servidor responde 409 na segunda vez; uma conta de menor não vira adulta com um clique). A trilha registra `nascimento_informado` **sem a data**.
- A data vai no arquivo de **Baixar meus dados** e some quando a conta é apagada. A política passou a `2026-10-19.2`, falando do mês e do ano de nascimento e da voz só para maiores de 18 anos; o `PRIVACIDADE.md` ganhou a linha.
- O formulário da conta virou **pedaço sob demanda** (`import()`); quem restaura a sessão é o próprio jogo, porque a voz precisa da idade antes de a tela existir.

**Prova:** `medicoes/voz-idade.mjs` (Chrome com microfone falso; adulto, convidado, menor, sem idade informando na hora, cadastro pela tela como adulto e como menor, e cliente adulterado); fotos `arte/idade-cadastro-claude.png` e `arte/idade-menor-so-ouve-claude.png`; testes de simulação em `shared/net/auth.test.ts` (as fronteiras do mês), `server/voz.test.ts`, `server/voz-sala.test.ts`, `server/idade-http.test.ts` (contas, HTTP e a sala de verdade com contas reais) e a bateria do cliente; **32 mutações à mão, todas pegas**.

**Limite honesto (R13):** a idade é **declarada** pela pessoa, não verificada. Quem mente na data entra como adulto. Verificar de verdade exigiria documento ou terceiro (custo e dado sensível), contra o pedido do Comandante de ser simples e sem custo. A regra reduz o risco; **não o elimina**, e a política diz que a data é informada pela pessoa.

## 5e. Narração e efeitos na voz (P230 e P231, 20/10)

**Narração (F8):** grava a partida **com a sua voz**, offline e online (`GameRecorder`). O microfone entra só na mistura da gravação, **nunca na saída do jogo** (ninguém se ouve em eco); só **conta de maior de 18 anos** (a mesma regra do chat, `microfoneDaNarracaoLiberado`); parar solta o microfone. O F9 continua sem voz.

**Efeitos na voz (P231):** `voice/EfeitosDeVoz.ts` (sob demanda). Cadeia de Web Audio: [deslocador de tom] → passa-altas → passa-baixas → graves → presença → distorção → compressor → (seco + eco + reverberação) → **limitador** (o teto que impede de estourar). Predefinições (tabela `PREDEFINICOES_DE_VOZ`): **Locutor militar** (sem mudar o tom; banda de rádio 280 a 3600 Hz, presença, distorção, compressor firme, eco de alto-falante de 42 ms), **Lorde sombrio** (5 semitons abaixo, graves +7 dB, metal, sala curta), **Grande Irmão** (3 semitons abaixo, compressão pesada, salão de 1,4 s). Vale na narração e na prévia do teste; **não no chat** (decisão aberta). Custo: zero fora dessas duas; ligado, a reverberação é a parte cara (~13x tempo real no pior caso medido, ou ~8% de um núcleo), e a voz atrasa de 15 a 25 ms. **Limites:** não faz sotaque; o deslocador tem um trepidar granular de 10 Hz.

**Prova:** `medicoes/efeitos-de-voz.mjs` (29 verificações num `OfflineAudioContext` do Chrome), `gravacao-narrada.mjs` e `gravacao-narrada-jogo.mjs`; fotos `arte/narracao-f10-claude.png` e `arte/voz-efeito-claude.png`.

**O vocabulário da persona (P244):** o léxico que o Comandante fala com o efeito **Grande Irmão** (narração F8) está em `VOCABULARIO_COMANDO.md` — glossário técnico/cru (DEPLOY, FORMATA, DELETADO, PATCH, OVERWRITE, CORROMPIDO, HARD RESET, DROP) e callouts prontos. É referência para a voz humana, não um sistema automático; o documento também diz o que faltaria para o jogo narrar sozinho por evento, se um dia for pedido.

## 5f. Quando a voz não funciona: o aviso e o diagnóstico (P237, 20/10)

**O que o Comandante viveu:** o microfone funcionava no teste, e a voz não chegou ao outro PC ao lado. A voz **funciona** entre dois navegadores (provado), mas o jogo **não dizia por que** uma pessoa ficava fora dela.

**O aviso (`pintarAvisoDeVoz` no `Game`):** numa sala com outras pessoas, enquanto a voz **não** está ligada, o canto inferior esquerdo mostra o motivo (`motivoSemVoz`, `voice/elegibilidade.ts`; as frases moram em `VozNasConfiguracoes.ts`): *convidado* (entre com uma conta de maior de 18 anos), *sem idade* (informe a idade), *menor* (só o áudio do jogo) ou *desligada* (ligue "Conversar por voz"). Some quando a voz liga. **O indicador de quem está na voz** diz também quantos da sala estão **fora** dela ("NINGUÉM MAIS NA VOZ: 1 NA SALA SEM VOZ (PRECISAM DE CONTA DE MAIOR DE 18 ANOS E VOZ LIGADA)", em vez de mandar testar um microfone que estava bom).

**O diagnóstico (`voice/Diagnostico.ts`, `VoiceChat.diagnostico()`):** Configurações > CHAT DE VOZ > **[ VER E COPIAR ]** monta e copia um relatório: a conta (maior de 18 anos, convidado…), o microfone (estado, aparelho, taxa de amostragem, eco/ruído/ganho, modo, mudo, transmitindo), a lista de quem o servidor diz estar na voz e, **por ligação**, o estado, a rota de rede escolhida (`host/udp → host` mesma rede, `srflx` pela internet, `relay` por retransmissor), os bytes de áudio enviados e recebidos, pacotes perdidos e o nível do áudio que chega. Fecha com a **CONCLUSÃO**, a causa mais provável na ordem em que ela costuma ser (sala, conta, voz desligada, microfone recusado, sozinho, ninguém na voz, rede que falhou, mudo, microfone que não envia, áudio que não volta). Só roda quando o jogador pede (`getStats` por ligação, uma vez).

**Limite honesto:** o jogo **não tem servidor de retransmissão (TURN)**: se o roteador ou a rede de um dos lados bloquear a conexão direta, a ligação falha e a conclusão diz isso. Em casa, dois PCs na mesma rede se acham pelo endereço local (medido: menos de 1 s no Brave). **Prova:** `medicoes/voz-diagnostico.mjs` (Chrome real: convidado vê o aviso; dois adultos "Tudo certo"; adulto com convidado na sala conclui a causa) e fotos `arte/voz-aviso-claude.png`, `arte/voz-diagnostico-claude.png`.

## 5g. O microfone que não está bem: ganho, saúde e reabertura (P237 PR 2, 20/10)

**O grafo de envio (`voice/EnvioDeVoz.ts`):** a faixa crua do microfone passa por um grafo de Web Audio **só do chat**, num `AudioContext` próprio (a voz não depende do áudio do jogo): **microfone → ganho → limitador (−3 dB, razão 20) → analisador**, e do limitador sai **uma porta (0 ou 1) por colega** até o destino dele, de onde vem a faixa que o WebRTC manda (`replaceTrack`). Dá o **ganho** (0,5x a 4x), a **leitura do nível** (a barra do HUD e a saúde) e as **portas por colega** (a base dos canais). Se o navegador não monta o grafo, ou o contexto fica suspenso por mais de 2,5 s, o chat volta à faixa crua.

**A saúde (`voice/saudeDoMic.ts`):** `ok`; `sem-som` (microfone aberto entregando zero absoluto por 8 s: mudo no fone, fone fora do modo microfone, aparelho morto); `sem-entrega` (o navegador diz a faixa parada: `mute`). Só julga com o microfone **aberto** (mudo e "segurar para falar" solto não contam). O HUD mostra a frase; o diagnóstico (§ 5f) conclui por ela.

**A reabertura (`VoiceChat`):** a faixa que termina (`ended`: o fone Bluetooth some) larga o grafo e a faixa de cada colega e **tenta de novo** em 1,5, 3, 6, 12 e 24 s; `devicechange` (o fone volta) tenta na hora; recusa do jogador e voz desligada não se repetem. As ligações com os colegas não caem.

**O ganho (Configurações > CHAT DE VOZ):** vale no chat, no teste do microfone (a barra mostra o que o chat vai mandar; com voz captada mas baixa a dica diz "suba o ganho para x2,5") e na narração. Fones Bluetooth em modo mãos-livres (16 kHz) costumam pedir ganho.

**O que NÃO é do jogo:** se o Windows mesmo não recebe som do microfone (o Gravador de Voz também não), o defeito é do fone ou do Bluetooth: botão de mudo ou braço do microfone do fone, escolher a entrada certa (USB ou Hands-Free) em Som > Entrada, e, no Bluetooth, remover o fone e **parear de novo** (o modo mãos-livres trava depois de alternar perfis).

**Prova:** `medicoes/voz-microfone.mjs` (Chrome real, 17 verificações: ganho x3 = +9,5 dB no outro lado, x0,5 = −6,1 dB, microfone derrubado reaberto em 1,6 s, silêncio total acusado aos 8,0 s), `voz.mjs` (26/26 pelo grafo novo), `voz-teste-mic.mjs` (o controle na tela real) e `arte/voz-ganho-claude.png`.

## 5h. Canais de voz: todos / time / jogador escolhido (P237 PR 3, 21/10)

**Como se usa:** **T** fala com todos (aberto, ou segurar, como sempre); segurar **Y** fala só com o **time**; segurar **U** fala só com o **jogador escolhido**; **G** troca o escolhido entre os colegas na voz (com um só colega ele já é o alvo). As três teclas se remapeiam em Configurações > CONTROLES. O HUD mostra "CANAIS [Y] TIME · [U] BRAVO · [G] TROCAR" e, enquanto se fala num canal, "FALANDO SÓ PARA O TIME" ou "FALANDO SÓ PARA BRAVO" (borda azul ou magenta). Apertar uma tecla de canal vale mesmo com o microfone mudo; soltar volta ao estado de antes.

**Como funciona (`voice/canais.ts`, `VoiceChat`, `EnvioDeVoz`):** o canal é o que está apertado agora (`canalDe`: privado > time > todos). `permite(canal, colega, regras)` diz se um colega ouve; o `VoiceChat` abre ou fecha a **porta** de cada colega no `EnvioDeVoz` (instantâneo, sem renegociar). **Falha fechada:** sala sem times, eu sem time, ou jogador escolhido que saiu = a tecla do canal não fala com ninguém; **o alvo do sussurro é congelado no instante em que a tecla é apertada** (se ele sai, ou chega outro colega, a voz não muda de destinatário até soltar e apertar de novo); sem o envio por Web Audio as teclas de canal não fazem nada; a porta de um colega que chega no meio da fala nasce no estado do canal de agora; a tecla de canal presa quando o microfone cai é solta; **abandonar o envio por Web Audio solta as teclas de canal antes de a faixa crua voltar**, e soltar a tecla passa sempre.

**O que falta: o time de cada piloto na sala online.** O servidor não atribui times (o `ArenaRoom` nem os cita; `setTeam` só existe na simulação, para o CTF e a Arena offline). `VozOpcoes.timeDe` já espera a resposta; hoje devolve `null`, e o HUD diz "SALA SEM TIMES: NINGUÉM OUVE O CANAL DO TIME". É um contrato de rede (o roster com o time de cada piloto) da frente do CTF online. **Limite honesto:** quem fala decide quem ouve (o servidor só decide quem entra na voz); quem recebe não vê que foi um sussurro; a lista da REDE (`tela:chat`) não tem botão de alvo.

**Prova:** `medicoes/voz-canais.mjs` (Chrome real, 5 navegadores, 13 verificações: o escolhido recebe 0,346 e os outros 0,0000; sala sem times, ninguém; colega que entra no meio do sussurro, e alvo que sai no meio dele, 0,0000), `voz-diagnostico.mjs` (o HUD e a aba CONTROLES no jogo real) e as fotos `arte/voz-canais-claude.png` e `arte/voz-canais-teclas-claude.png`.

## 5i. Quando a voz não sai: a "Mixagem estéreo" e a sala (P241, 21/10)

**O que o relatório do Comandante mostrou** (Configurações > CHAT DE VOZ > [ VER E COPIAR ], com duas contas de adulto e "ninguém ouve ninguém"): `aparelho: "Mixagem estéreo (Realtek(R) Audio)"`, `nível 0.000`, `na sala (sem contar você): 0`. A **mixagem estéreo** do Windows grava o **som que o computador toca**, não a voz; aberta como microfone, manda silêncio (ou a música e as outras conversas do PC) para a sala. E a sala tinha **ninguém**: dois PCs só se ouvem na **mesma sala (`?sala=`) e no mesmo mapa** (`mapa=` abre outra sala no servidor).

**O que o jogo faz agora:** `abrirMicrofone` (`voice/abrirMicrofone.ts`) **nunca devolve a mixagem**: se o que abriu (o padrão do Windows, ou a escolha salva) tem nome de mixagem (`ehMixagemDoSistema`, `voice/aparelhos.ts`: "mixagem", "stereo mix", "what u hear", "loopback"…), larga e abre o primeiro microfone de verdade (os que parecem microfone vêm primeiro); se só há a mixagem, não abre nada e o diagnóstico diz o motivo. A lista de aparelhos das Configurações também não a oferece. O diagnóstico ganhou a linha `sala online: sim (ARENA · mapa padrão)` e a conclusão "sozinho na sala" agora diz que, se a outra pessoa já entrou, **vocês estão em salas ou mapas diferentes**. **Prova:** `voice/abrirMicrofone.test.ts` (8 testes), `Diagnostico.test.ts`; 8 mutações à mão pegas. **Não provado:** no PC do Comandante (precisa do ouvido dele).

## 6. O que falta

1. **O ouvido do Comandante:** a bancada prova que o áudio chega e que o volume cai com a distância; **se a voz soa bem** (eco, volume, o alcance de 12 a 160 m) é dele. Os números do alcance são proposta (`ALCANCE_DA_VOZ`).
2. **Dois aparelhos pela internet:** a bancada liga dois Chrome na mesma máquina; **falta provar entre redes diferentes** (o STUN e o NAT de verdade). Se algum par não ligar, a tela diz "N SEM CONEXÃO".
3. **TURN** (relé para quem a rede barra): só se um jogador real reclamar. Caminho sem custo de assinatura: `coturn` no PC do servidor ou numa VPS gratuita (decisão do Comandante).
4. **Canal TIME:** depende dos times no protocolo online (hoje não existem).
5. **Mudo por jogador e denúncia**, para quando houver gente de fora.
6. **SFU** (servidor de mídia): só se salas com mais de 5 pessoas falando virarem comuns; a malha cobre as salas de 8 com poucos falando.
7. **Celular de verdade** (Android e, principalmente, iPhone): a seção 5b prova o botão e o toque no Chrome emulado; o áudio no Safari do iPhone **não foi provado**.
8. ~~A política de privacidade~~ (feito em 19/10, seção 4): falta o Comandante **revisar o texto**.
9. **Liberada:** `tela:voz` está pública (painel de visibilidade, feito pelo Comandante), **agora só para contas de maiores de 18 anos** (seção 5d). Sem mudo por jogador nem denúncia (item 5): com a voz aberta a desconhecidos adultos, é o próximo risco.
10. **A idade é declarada, não verificada** (seção 5d): decisão do Comandante se quer algo mais forte (tem custo).
11. **Contas que já existiam:** estão "sem idade" e ficam sem voz até informarem o mês e o ano. A política promete avisar mudanças que afetem contas existentes e **o jogo ainda não tem um aviso para isso**: a frase na aba JOGO e nas Configurações da voz cumpre o papel por ora.
