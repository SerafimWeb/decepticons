# RÁDIO E EMISSORES DE SOM — o som que vive no mundo (P210)

> **Estado:** desenho escrito, **nada construído**. Ordem do Comandante (19/10): *"se um jogador estiver ouvindo música no pc, e eu me aproximar dele, quero poder ouvir a música, ou se ele estiver ouvindo rádio (assim poderemos implementar elementos como rádio, ou autofalantes em loop passando uma mensagem, ou até uma rádio mesmo ao vivo 24 hs (ao entrar em determinados prédios, ou numa área específica da fase, etc)"*.
> As perguntas que **dependem do Comandante** estão marcadas com ⚖ na seção 5. Nada abaixo foi medido: são estimativas de projeto, e dizem onde.

## 1. A resposta curta

São **cinco coisas diferentes**, com custo, risco e esforço muito diferentes. A visão do Comandante (rádio, autofalante, prédio, área) se resolve **sem** capturar o áudio do computador de ninguém:

| # | O que é | Rede entre jogadores | Custo | Direitos autorais | Celular | Recomendação |
|---|---|---|---|---|---|---|
| 1 | **Emissor do mundo** (autofalante em laço, rádio num prédio): o mapa diz onde e o que toca; cada jogador toca sozinho, de perto | nenhuma | um arquivo de áudio, baixado só por quem chega perto | só o do que **nós** escolhermos | sim | **construir primeiro** |
| 2 | **Rádio 24 h sincronizada**: a programação é uma lista de arquivos que toca **pelo relógio** (todos ouvem o mesmo ponto, como numa rádio ao vivo) | nenhuma | hospedagem de arquivos (já temos), sem servidor de transmissão | só o do que nós escolhermos | sim | **em seguida**: é a "rádio ao vivo 24 h" **sem custo** |
| 3 | **Rádio que o jogador carrega**: ele sintoniza uma estação do jogo e quem chega perto a ouve saindo do robô dele | um número (a estação) por jogador | zero | só estações do jogo | sim | depois |
| 4 | **Fluxo ao vivo de verdade** (uma rádio de internet, Icecast ou AzuraCast) | nenhuma | um **servidor de transmissão** no ar o tempo todo (CPU e banda de saída contínuas) | ⚖ pesado: licença da música | sim | só se houver conteúdo e servidor |
| 5 | **Música do PC do jogador** (capturar o áudio do computador e mandar por WebRTC) | sim, uma cópia por ouvinte | o upload do jogador × ouvintes | o jogo vira o canal de uma execução pública | **não** | **não** em salas públicas |

## 2. Por que o caso 5 (a música do PC do jogador) é o pior

- **Só existe no navegador de computador** (Chrome e Edge): `getDisplayMedia` com áudio pede que o jogador escolha uma aba ou a tela e marque "compartilhar áudio". Firefox, Safari e **qualquer celular** não oferecem.
- **Rede (estimativa, não medida):** música a 64 a 128 kbps por ouvinte. Na malha da voz, 7 ouvintes são ~0,5 a 0,9 Mbps de **subida** do jogador: derruba muita conexão doméstica. A voz custa 24 kbps.
- **Eco:** o cancelador de eco do navegador trata a música como eco e tenta apagá-la; desligá-lo piora a voz.
- **Direitos:** tocar música comercial para desconhecidos é execução pública. No Brasil o ECAD cobra de quem a promove; nos EUA, o DMCA. Quem repassa o áudio é o nosso jogo.
- **Privacidade:** o áudio do sistema leva notificações, chamadas e vídeos que o jogador não pensou em dividir.
- **Moderação:** ninguém pode "ouvir" o que passa para filtrar.
- Se o Comandante ainda quiser: **só desktop, só salas privadas entre amigos, com aviso e consentimento**, e por último.

## 3. O desenho dos emissores (casos 1, 2 e 3)

Um módulo à parte (G3), `client/src/audio/Emissores.ts`, ligado ao `Game.ts` por callbacks, **pedaço sob demanda** (a dieta de JS, P187). Os emissores vêm do mapa (o `PraiaLayout.ts` já declara os postes de CFTV e os portões):

```ts
interface Emissor { id: string; x: number; y: number; z: number; raio: number; volume: number;
  fonte: { tipo: 'laco' | 'programacao' | 'fluxo'; url: string }; zona?: Caixa /* o prédio */ }
```

- **Só os mais próximos tocam:** no máximo **3** ao mesmo tempo, dentro do raio; entrar no raio liga o `<audio>`, sair desliga. O custo fica limitado, qualquer que seja o número de emissores do mapa.
- **No espaço:** `MediaElementAudioSourceNode` → `PannerNode` (`equalpower`, queda linear, como a voz) → filtro passa-baixa → barramento, no `AudioContext` do jogo (um contexto só). A posição de cada emissor ativo é dada uma vez por quadro, sem alocar (G4).
- **Prédios e áreas:** a `zona` é uma caixa. **Dentro**, volume cheio e sem filtro; **fora**, passa-baixa (~800 Hz) e volume ×0,35, como uma parede. A área específica da fase é a mesma coisa com a caixa ao ar livre.
- **Autofalante em laço com mensagem:** a gravação **é** o laço (10 a 30 s). A voz já existe: o narrador do ElevenLabs e o Estúdio de VOZES geram o mp3; nada de servidor.
- **Rádio 24 h sincronizada:** a programação (arquivos de ~60 s, 64 kbps ≈ 480 KB cada, estimativa) toca no ponto `(relógio do servidor + desvio) mod duração total`. Online o desvio vem do `OnlineSession` (`clockOffset`); offline vale o relógio local. **Só na tela**: o relógio nunca entra na simulação (G1/G2). Todo mundo que está perto ouve o mesmo instante: para o jogador é ao vivo.
- **Rádio que o jogador carrega:** o jogador escolhe uma estação; só o **número dela** viaja (um byte no roster ou numa mensagem nova de rede: decide-se quando chegar; mensagem nova sobe o protocolo, e o servidor tem de estar atualizado antes). Quem chega perto a toca localmente, na posição do robô dele.
- **Fluxo ao vivo de verdade (caso 4):** a mesma peça com `tipo: 'fluxo'`. **Atenção:** o `MediaElementAudioSourceNode` só dá som se o servidor de fluxo mandar CORS; e a Cloudflare tem regras para tráfego de áudio contínuo que ainda precisam ser conferidas antes de apontar um túnel para uma rádio.

**Custos (estimativas de projeto):**
- **CPU:** por emissor ativo, um `<audio>` (decodificação em hardware), um panner e um filtro: desprezível; teto de 3.
- **Rede:** o arquivo só baixa quando o jogador chega perto (cache do navegador); um laço de 20 s a 64 kbps ≈ 160 KB. Um fluxo ao vivo a 64 kbps é **8 KB/s só enquanto perto**, e **soma** ao teto de 8 KB/s de download do jogo (G11): é preciso dizer isso ao jogador.
- **Celular:** o `<audio>` precisa de um gesto para tocar (o "jogar" já é); parar fora do raio poupa dados; uma opção "sem som do mundo" nas Configurações.
- **Servidor:** nada, salvo o caso 3.

**Provas planejadas:** teste puro da escolha dos 3 mais próximos e do ponto da programação pelo relógio; bancada em Chrome com um emissor e dois jogadores (volume por distância e o filtro dentro e fora da zona), como a `medicoes/voz.mjs`.

## 4. Ordem de construção

1. **E1, emissor de laço no mundo** (o módulo, a regra dos 3, o espacial e um autofalante na Estação dos Cabos com a voz do narrador). ~200 linhas + testes. Não depende de nada seu, só do arquivo de áudio.
2. **E2, zonas** (prédio e área: dentro e fora).
3. **E3, rádio sincronizada** (a programação pelo relógio; os primeiros arquivos).
4. **E4, a rádio do jogador** (a mensagem de rede).
5. **E5, fluxo ao vivo** e **E6, música do PC**: só com a sua ordem.

## 5. ⚖ O que só o Comandante decide

1. **De onde vem a música?** Música comercial sem licença **não entra**. Caminhos: autofalantes com a voz do narrador (já pagos); trilhas originais ou geradas por você; bibliotecas com licença que permita uso comercial, conferida arquivo a arquivo.
2. **"Rádio ao vivo 24 h":** programação sincronizada pelo relógio (grátis, **recomendada**) ou servidor de transmissão de verdade (custo e licença).
3. **Música do PC do jogador:** recomendo **não**; se quiser, só desktop, salas privadas e com aviso (seção 2).
4. **Os primeiros lugares:** sugiro a Estação dos Cabos (um rádio no prédio de controle e autofalantes nos portões, que já têm os postes de CFTV).
5. **A rádio que o jogador carrega:** quer? Custa uma mensagem de rede.

## 6. Relação com o chat de voz

A voz (P205) continua **à parte**: é entre jogadores, direta, e a **voz de quem fala tem prioridade** (o som do mundo baixa quando alguém fala por perto, ideia para a E2). Os emissores são do mundo, não dos jogadores. Os dois usam o mesmo `AudioContext` e o mesmo jeito de espacializar.
