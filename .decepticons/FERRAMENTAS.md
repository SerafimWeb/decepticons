# FERRAMENTAS — CYBERMECH

> Guia de operação das ferramentas acessórias: gravar gameplay, montar vídeo promocional,
> pilotar o Colossus. Não é sobre o jogo em si (`GAME_DESIGN.md`) nem sobre infraestrutura
> (`DEPLOY.md`) — é "como o dono realiza a tarefa", passo a passo.

---

## 1. Gravar gameplay (F9)

**O quê:** `canvas.captureStream()` + `MediaRecorder` direto do WebGL — grava só os pixels do
jogo, no framerate real, com o áudio do jogo embutido. Não precisa do OBS.

**Como usar:** dentro de uma partida, aperte **F9**. Um indicador `● REC` pulsando aparece no
canto. Aperte **F9** de novo para parar — o arquivo `.webm` baixa sozinho na sua pasta de
downloads (`cybermech-AAAA-MM-DD_HH-mm-ss.webm`).

**De propósito escondido:** a tecla não está na tela de "Ajuda e Controles" nem em nenhum menu —
decisão de 28/09 ("não vamos deixar os usuários fazerem suas próprias gravações, primeiro vamos
só nós usarmos"). Só quem sabe da tecla grava; ninguém mais carrega ou mede nada por causa disso.

**Enquanto grava, o jogo trava a qualidade no máximo** (mesma trava que a opção "alta" usa) e
desliga o rebaixamento automático — sem isso, a própria gravação derruba o FPS e a qualidade
adaptativa reage piorando a imagem no meio do take (o mesmo problema do OBS que a tecla existe
para evitar, causado pelo próprio jogo). **Se um dia voltar a travar ou perder quadro:** já
aconteceu uma vez (29/09) por forçar a resolução acima desse teto — ver
`HISTORICO_DE_DECISOES.md`, entrada "F9 travava e perdia quadro", antes de investigar do zero.

**Código:** `client/src/core/GameRecorder.ts` (módulo independente, ligado em `Game.ts`).

---

## 2. Pilotar o Colossus-01

Desde 29/09, o Colossus-01 (a máquina de cerco de 14 m, antes só o boss da Sobrevivência) também
é um chassi do Hangar. Para jogar com ele: **Hangar → chassi COLOSSUS-01** (aparece na lista ao
lado do Vector-09 e do Andróide), ou entre direto com o link
`?build=v1.colossus01.plasma-2.rockets-0`.

**De propósito não balanceado** contra os bots (1200 de vida no torso, 24 t de carga) — é para
sentir a escala antes de qualquer ajuste fino.

**Se parecer "flutuando" ou andando mal:** é um bug físico real, já encontrado e ainda não
resolvido (não é a sua conexão nem o seu PC) — ver a seção 4 abaixo.

**Próxima etapa (não feita ainda):** o Mech de tripulação — um piloto mais 1–2 artilheiros
controlando as armas direcionais do Colossus, em partidas com mais de um jogador.

---

## 3. Montar vídeo promocional (`/mesa`)

**Abrir:** `node .tmp/video/servir.mjs` (na raiz do projeto) — abre a "mesa de montagem" no
navegador. Só local (G15: nada fora da pasta do projeto; a mesa não sobe para o site).

A mesa tem três jeitos de montar um vídeo, do mais simples ao mais automático:

1. **Formulário:** lista de cenas à esquerda, prévia ao vivo no meio, campos da cena à direita.
   Muda o texto, a prévia acompanha. `Ctrl+S` salva. Nove modelos prontos (abertura, letreiro,
   citação virando entrega, números do tick, banda de rede, galeria de imagens, equipe, citação
   de fora, encerramento) mais o `clipe` do item 3.2.
2. **Gerar por IA:** escreva o que o vídeo deve mostrar numa frase, na caixa "Gerar por IA" —
   a Claude escreve o roteiro inteiro **ancorado nos fatos reais do projeto** (números de rede,
   testes, PRs, o que o `STATUS_REAL.md` marca como pronto), corrige sozinha se o portão de
   qualidade travar algo, e devolve pronto pra revisar (não salva sozinho). Precisa de
   `ANTHROPIC_API_KEY` no ambiente antes de abrir a mesa — **nunca no arquivo** (R2):
   ```powershell
   $env:ANTHROPIC_API_KEY = "sk-..."
   node .tmp/video/servir.mjs
   ```
3. **Clipe de gameplay real:** mistura um trecho gravado de verdade (F9, item 1) com as cenas
   desenhadas, no mesmo vídeo — bom para caçadas, combates, qualquer coisa que precise ser jogo
   de verdade, não motion graphics.
   1. Grave com F9 (item 1); o `.webm` baixa na pasta de downloads.
   2. Copie o arquivo para `.tmp/video/clipes/` (a pasta nasce sozinha quando precisa).
   3. Na mesa, adicione uma cena `clipe`: o campo "arquivo" tem um seletor com o que está na
      pasta; "início" é onde cortar dentro do arquivo (segundos).
   O canvas só desenha um marcador nessa cena (sincronizar vídeo com o `seek()` quadro a quadro
   seria frágil); quem corta e costura de verdade é o `render.mjs`, com `ffmpeg`, por fora do
   canvas, na hora de exportar.

**Exportar:** `node .tmp/video/render.mjs --fps 60` (1080p60 com trilha) — ou pelo botão da mesa.
Três enquadramentos no mesmo roteiro: `--formato paisagem|retrato|quadrado` (site/YouTube,
Reels/TikTok/Shorts, feed).

**Detalhe técnico completo, exemplos e o que ainda falta:** `.tmp/video/LEIAME.md` — **esse
arquivo não vai para o git** (mora em `.tmp/`, G15), só existe nesta máquina. Se for mexer na
mesa de outra máquina, comece lendo-o de novo por lá; o que está aqui neste `FERRAMENTAS.md` é
o resumo permanente, o `LEIAME.md` é o manual completo e local.

---

## 4. Considerações conhecidas (não são bug novo se você achar de novo)

- **Mech parado afunda lentamente no chão, sem limite** (achado 29/09, não corrigido). Reproduz
  com qualquer Mech parado tempo suficiente; mais visível no Colossus (grande, parado mirando)
  do que no Vector-09. Causa isolada e documentada (o contorno do "engasgo do Rapier" de 23/09
  só cobre o caso em movimento, não o parado) — antes de investigar do zero, leia
  `HISTORICO_DE_DECISOES.md`, entrada de 29/09 "Colossus-01 vira chassi solo pilotável" (a seção
  "achado, não corrigido"). Precisa de alguém com tempo dedicado ao character controller do
  Rapier.
- **Gerar por IA não entra na versão publicada da mesa** (só local) — precisaria expor a chave
  de API no navegador, de propósito não fizemos isso.
