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
- **O que a voz expõe (e a política de privacidade ainda não diz):** WebRTC direto entre jogadores significa que **cada jogador da sala pode ver o IP dos outros** (nos endereços do SDP), e o **STUN do Google recebe o IP** de quem entra na voz. Hoje, sem voz, o IP só fica no servidor (mascarado nos registros). **Antes de liberar `tela:voz`:** (1) acrescentar à `/privacidade/` (`scripts/privacidade.mjs`) uma linha na tabela "O que guardamos" e uma em "Com quem compartilhamos" (texto sugerido abaixo), (2) mudar `POLITICA_VERSAO` (`shared/net/auth.ts`) e (3) atualizar `PRIVACIDADE.md`. O texto é do Comandante revisar: a política é rascunho e não é parecer jurídico.
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

## 6. O que falta

1. **O ouvido do Comandante:** a bancada prova que o áudio chega e que o volume cai com a distância; **se a voz soa bem** (eco, volume, o alcance de 12 a 160 m) é dele. Os números do alcance são proposta (`ALCANCE_DA_VOZ`).
2. **Dois aparelhos pela internet:** a bancada liga dois Chrome na mesma máquina; **falta provar entre redes diferentes** (o STUN e o NAT de verdade). Se algum par não ligar, a tela diz "N SEM CONEXÃO".
3. **TURN** (relé para quem a rede barra): só se um jogador real reclamar. Caminho sem custo de assinatura: `coturn` no PC do servidor ou numa VPS gratuita (decisão do Comandante).
4. **Canal TIME:** depende dos times no protocolo online (hoje não existem).
5. **Mudo por jogador e denúncia**, para quando houver gente de fora.
6. **SFU** (servidor de mídia): só se salas com mais de 5 pessoas falando virarem comuns; a malha cobre as salas de 8 com poucos falando.
7. **Celular de verdade** (Android e, principalmente, iPhone): a seção 5b prova o botão e o toque no Chrome emulado; o áudio no Safari do iPhone **não foi provado**.
8. **A política de privacidade** (seção 4) antes de liberar.
9. **Liberar:** painel de visibilidade > `tela:voz` > público.
