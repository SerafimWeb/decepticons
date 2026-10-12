# O PROCESSO — roteiro narrado (o episódio longo do canal)

> **O que é:** o texto para **narrar** o vídeo #1 do canal (o "o processo" de 6 a 10 min que o kit prometeu em
> `PUBLICACAO_E_MONETIZACAO.md` § 4.1). O teaser de 52 s é outro arquivo — `.decepticons/video/o-processo.js`.
> **Como usar:** grave a narração (voz; a decisão das vozes por ElevenLabs é a da ordem **P75**), monte na **mesa** as
> cenas de cada bloco e exporte. Os tempos são alvo, não trilho: a mesa re-cronometra sozinha.
> **Autor:** Qwen, 12/10/2026 · **Nada gravado ainda** — este documento é o papel.

## As quatro regras deste roteiro (e por que)

1. **O áudio diz o arredondado; a tela diz o número exato.** O `validar.mjs` da mesa confere os números **das cenas**
   contra o código — áudio gravado não tem como ser revalidado. Então a narração fala *"mais de mil testes"* e a cena
   mostra o número de hoje (1455, conferido na hora de exportar). **Se um dia o número da tela mudar, a voz continua
   verdadeira.**
2. **Nenhum byte, nenhum KB/s.** O vídeo é material público: vale a decisão de 27/09 — mostra-se o **ritmo** (60 Hz,
   20 estados por segundo) e a **contagem de testes**, não o tamanho das coisas.
3. **Nada do codinome interno** em texto de tela ou na voz (o site reprova, e o validador trava).
4. **Nada que o `STATUS_REAL.md` marque PARCIAL, DEMO ou AUSENTE como pronto (R13), e nenhuma data prometida.**

## Os oito blocos

| # | Tempo | Bloco | O que aparece (modelo da mesa) |
|---|---|---|---|
| 1 | 0:00–0:25 | A pergunta | `boot` + `letreiro` |
| 2 | 0:25–1:20 | O jogo | `galeria` (hangar, arena, blueprint, tiros) |
| 3 | 1:20–2:40 | O pedido vira jogo | `esteira` |
| 4 | 2:40–4:00 | Uma simulação só | `ritmo` + `equipe` |
| 5 | 4:00–4:40 | A sala de comando | `galeria` (console, teatro de operações) |
| 6 | 4:40–5:40 | O que a gente não faz | `ritmo` (o que este jogo não é) |
| 7 | 5:40–7:00 | O que está no ar, e o que vem | `galeria` + `esteira` |
| 8 | 7:00–7:40 | Jogue | `final` |

### 1 · A pergunta (0:00–0:25)

> Este jogo é feito por um estúdio e quatro agentes de inteligência artificial. Não é uma demonstração: é o jogo —
> que roda no navegador e é publicado toda semana. O que você vai ver agora é **como** ele é feito: do pedido à
> partida.

### 2 · O jogo (0:25–1:20)

> CYBERMECH é um jogo de Mechs. Você escolhe um robô no hangar, monta as armas em cada encaixe, e cai numa arena com
> outros jogadores — sem instalar nada, de qualquer computador. A ideia é teimosa e simples: entrar em segundos, lutar
> cinco minutos, e ter vontade de voltar amanhã.
>
> E não há vantagem comprada: cada arma tem o seu contra-jogo, e o que se vender um dia será **aparência** — nunca
> dano, nunca vida.

### 3 · O pedido vira jogo (1:20–2:40)

> Aqui está a parte que ninguém vê. O Comandante — é assim que o dono do projeto aparece no console — diz o que quer.
> Isso vira uma **ordem registrada**, com número. A ordem vira um **contrato**: o que já existe, o que precisa
> nascer, quem faz o quê. O contrato vira um **branch**, um **PR** e uma bateria de testes.
>
> Se o check passa, o merge publica o jogo sozinho, em minutos. Se não passa, não entra. Um pedido feito de manhã pode
> estar no ar antes do almoço — e o que o Comandante pede fica registrado, para nenhuma equipe precisar adivinhar.

### 4 · Uma simulação só (2:40–4:00)

> Debaixo do desenho existe uma **simulação**. Ela roda sessenta vezes por segundo, e roda igual no seu computador e
> no servidor: é o mesmo código. Nada nela depende do acaso nem do relógio — dois jogadores fazendo os mesmos
> movimentos vivem exatamente a mesma partida.
>
> É por isso que dá para **testar**: cada regra do jogo nasce com um teste que a prova. São mais de mil testes hoje, e
> nenhum deles é enfeite — quando a gente erra, quem avisa é o teste, não o jogador. E quando o número do vídeo
> discordar do número do jogo, **vale o número do jogo**.

### 5 · A sala de comando (4:00–4:40)

> O menu não é um menu: é uma **sala de comando**. De lá você vê o teatro de operações com as missões no mapa do
> mundo, o seu Mech, os pilotos, os números da rede — e, com uma tecla, a mesa onde a gente monta os vídeos. É a mesma
> tela para jogar e para operar o jogo.

### 6 · O que a gente não faz (4:40–5:40)

> Três coisas a gente não faz. Não cobra vantagem: o jogo é o mesmo para todo mundo. Não interrompe o combate com
> anúncio. E não pede instalação, placa de vídeo dedicada, nem conta para entrar — o mínimo é um navegador.
>
> Isso não é generosidade: é a decisão que mantém a arena cheia. Arena vazia não tem graça para ninguém.

### 7 · O que está no ar, e o que vem (5:40–7:00)

> O que já está no ar: a arena, o modo sobrevivência em ondas, a captura de bandeira contra bots, o hangar com
> dezenas de combinações de arma e chassi — e o **esquadrão**, em que você monta os inimigos e os aliados da partida,
> robô por robô, com chassi, arma, personalidade e dificuldade.
>
> O que vem: **missões com objetivo** — escoltar, atacar, defender uma base. A primeira é uma escolta: você protege um
> técnico que conserta os seus aliados, e ele é justamente o alvo que os inimigos preferem. Depois, cenários maiores,
> com caminho, emboscada e extração.
>
> E do lado de fora, o vídeo: os takes saem de dentro do jogo, e a montagem é aqui, na mesa.

### 8 · Jogue (7:00–7:40)

> CYBERMECH está no ar, aberto, e toda semana entra coisa nova — uma arma, um robô, um cenário, um ajuste de
> equilíbrio. Você pode jogar agora, sem cadastro: o endereço está aqui embaixo.
>
> E se você quiser ver o jogo **por dentro** — o processo, os números, quem fez o quê —, o site mostra tudo à vista.
> É um jogo feito à vista de todos. É assim que a gente quer que continue.

## Produção (o que fazer com este texto)

- **A voz:** uma só, calma e técnica, a mesma em todo o canal. Números pedem uma pausa depois ("mais de mil
  testes —"). Se a chave do ElevenLabs estiver no ambiente, a mesa já serve; a escolha da voz é do Comandante.
- **O que a mesa monta sozinha:** os oito blocos — os modelos `boot`, `letreiro`, `esteira`, `ritmo`, `equipe`,
  `galeria` e `final` já existem, e as imagens das galerias estão em `.decepticons/arte/` (`/arte/…`).
- **O que precisa do jogo (`F9`):** os blocos 2 e 7 ficam **muito** melhores com take real. Depende da ordem **P97**
  (o take chegar sozinho na mesa). **Sem take, o vídeo sai assim mesmo** — só menos vivo.
- **Capítulos do YouTube** (a partir de 3, com 10 s cada): use os tempos da tabela como títulos.
  0:00 A pergunta · 0:25 O jogo · 1:20 O pedido vira jogo · 2:40 Uma simulação só · 4:00 A sala de comando ·
  4:40 O que a gente não faz · 5:40 O que está no ar · 7:00 Jogue.
- **O pacote de publicação** (título, descrição, miniatura, o que não dizer) é o mesmo do § 4.2 de
  `PUBLICACAO_E_MONETIZACAO.md`; a descrição ganha a lista de capítulos.
- **A narração é do Comandante** (a decisão das vozes é dele, P75). O que este documento entrega é o papel: ele lê,
  corta, muda de ordem — e o que for gravado é dele.
