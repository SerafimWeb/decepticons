# DADOS DA ARENA PARA ROBÔS DE VERDADE: proposta (P71)

> Criado em 11/10/2026 (Claude), a partir de uma pergunta do dono: como aproveitar o que acontece na arena para treinar
> robôs humanoides de verdade, gerar valor (civil ou de defesa) e embutir esse conhecimento no humanoide que ele pretende comprar,
> e o que é "o JEV".
> **Estado: direção aprovada pelo Comandante em 11/10** ("quero sim que nosso game sirva pra treinamentos de humanoides, IAs, etc.").
> Nada construído ainda; a etapa D0 (seção 6) é a próxima. O "JEV" ele vai mandar.

> **Decisão do Comandante (11/10) que estreita o escopo deste plano:** só as **nossas IAs**. Nada de armazenar ou capturar
> dado de jogador que possa gerar problema de **LGPD**; o gravador e o treino usam **apenas os bots**. Com isso o portão de
> consentimento da **D0** deixa de existir (não há dado pessoal). Detalhe no companheiro `PILOTOS_LLM_E_INTELIGENCIA.md` (P75), §5.

## 1. O diagnóstico, sem enfeite

- **Os bots de hoje não aprendem.** `BotController` é uma máquina de estados (patrulha, caça, ataque, recuo, resfriar, espreita)
  com números calibrados à mão (`BOT_SKILLS`). Não há aprendizado deles para extrair. **O valor está no que os humanos fazem**
  contra eles e entre si. **Atualização (Comandante, 11/10):** o dado que vamos usar é **só o dos bots** (bot × bot), sem
  capturar o lado humano — ver a decisão no topo e `PILOTOS_LLM_E_INTELIGENCIA.md` §5.
- **O corpo não transfere.** O Mech é um controlador de personagem (cápsula do Rapier) com animação desenhada por cima. Um humanoide
  real se equilibra com torque em dezenas de juntas, contato, atrito e atraso de motor. Andar, equilibrar e pegar objetos se treinam
  em simulador de física articulada (Isaac Lab, MuJoCo) e com teleoperação, e quem faz isso é o fabricante. Dado do jogo não ajuda aí.
- **A decisão transfere.** Para onde ir, quando recuar, onde se abrigar, quem priorizar, como reagir à surpresa, como coordenar com
  o time. É a camada de cima, a 2–10 Hz. É a aposta da General Intuition (spin-off da Medal: US$ 134 mi em out/2025; depois, segundo
  a imprensa, US$ 320 mi a US$ 2,3 bi), que treina agentes com clipes de jogo e diz ter levado o mesmo modelo a um robô quadrúpede.

## 2. O que o CYBERMECH já tem e quase ninguém tem

- **Estado exato + ação, sem precisar de visão computacional.** A Medal tem vídeo e teclas; nós temos o mundo inteiro (posição, mira,
  vida, calor, linha de visão) porque o servidor é autoritativo (G13) e a simulação é uma só (G14).
- **A ação é pequena:** um comando ocupa 9 bytes (`shared/net/input.ts`). A 60 Hz são 540 B/s, **~2 MB por hora de jogo por jogador**.
  O estado já sai codificado a 20 Hz (`SNAPSHOT_HZ`) com teto de 8 KB/s (G11): **no máximo ~29 MB por hora de sala**, antes de compactar.
- **Laboratório controlado:** bots com persona, dificuldade e semente dão experimentos repetíveis ("como humanos reagem a um flanco
  com reação de 0,3 s contra 0,9 s").
- **A interface do comando já é a de um robô.** `moveX`, `moveZ`, `yaw` são o mesmo formato do comando de locomoção de alto nível
  dos humanoides comerciais (velocidade para frente, para o lado, giro). O "cérebro" que aprende no jogo fala a língua do "corpo" que vem
  de fábrica.

## 3. O formato: gravador de voo

Por partida, no servidor: versão do jogo (commit), semente, mapa, modo, montagens, e por tick os comandos de cada piloto; mais o estado
a 20 Hz que a rede já codifica; mais os eventos (acerto, abate, bandeira, onda). Arquivo por episódio, num formato aberto que se converte
para os de robótica (observação, ação, recompensa, fim de episódio).

- **Custo de CPU:** copiar bytes já codificados para um buffer pré-alocado (G4) e gravar no fim da partida. Perto de zero por tick.
- **A observação tem de ser "honesta":** o que um sensor real veria (linha de visão, alcance, ruído), não a onisciência do jogo. Sem
  isso o que se aprende não roda num robô. O `BotController` já usa raio de visão a 10 Hz e raio de audição; é o ponto de partida.
- **Morrer no jogo custa segundos; no mundo real custa o robô.** O dado de partida com renascimento ensina imprudência. O dado
  valioso vem de modos sem renascimento (sobrevivência, resgate) ou tem de ser pesado por isso.
- **Sem versão gravada, o replay quebra** a cada mudança de equilíbrio ou física. Gravar o estado, além da ação, protege.

## 4. Os modelos, em ordem de realismo

1. **Bot fantasma (clonagem de comportamento):** bots que jogam como os nossos melhores bots (bot × bot). Treino fora do servidor; no servidor, uma rede
   pequena a 10 Hz por bot custa microssegundos. Primeiro produto, e prova o pipeline sem robô nenhum.
2. **Modelo de mundo:** prevê o próximo estado dado a ação, e deixa o bot "imaginar" antes de agir. É aqui que entra o JEPA (seção 5).
3. **Política tática hierárquica:** alto nível (decidir) aprendido no jogo; baixo nível (andar) do fabricante do robô.

## 5. "JEV"

Não achamos nada com esse nome. O mais provável é **JEPA / V-JEPA 2** (Meta, junho de 2025): modelo de mundo de 1,2 bi de parâmetros,
treinado em vídeo sem rótulo e depois em ~62 h de dados de robô; planejou pegar e colocar objetos em ambientes novos (65–80% de acerto,
em braço robótico, não em humanoide). A ideia: prever o *resumo* do próximo momento, não os pixels. Serve para o item 2 da seção 4;
o nosso dado já é estado, então dá para treinar um preditor no estilo JEPA com muito menos computação que em vídeo. Se o dono
mandar o link do que ouviu, esta seção é corrigida.

## 6. Etapas, cada uma com o gatilho para começar

| Etapa | O que | Gatilho |
|---|---|---|
| D0 | Gravador de voo no servidor, **só das nossas IAs** (os bots) — sem dado de jogador, então **sem portão de consentimento/LGPD** (decisão do Comandante, 11/10) | O dono aprovar |
| D1 | Bot fantasma treinado com partidas reais | Milhares de horas de partida gravadas (estimativa) |
| D2 | Arena aberta para cérebros de fora: um agente externo joga pelo mesmo protocolo de comando, com ranking | D1 provar o pipeline |
| D3 | Robô real: gêmeo digital do ambiente (escaneado) vira mapa; política de alto nível do jogo + locomoção do fabricante; teleoperação pelo jogo | O dono ter o robô |

## 7. Linhas que este plano não cruza

- **Nada de comportamento de tiro num robô físico que decide sozinho usar força.** Isso é arma, é produto controlado e é a linha
  vermelha do debate sobre autonomia letal. Defesa, aqui, quer dizer: simulação e treino de operadores, apoio à decisão, adversário
  imprevisível para testar autonomia, reconhecimento, desarme de explosivos, logística. Humano no comando.
- **Nada de dado de jogador** (decisão do Comandante, 11/10): o gravador e o treino usam **só as nossas IAs**; nenhum dado
  pessoal é capturado nem vendido.
- **Trapaça envenena o dado:** partida com mira automática ou exploração de falha sai do conjunto.
