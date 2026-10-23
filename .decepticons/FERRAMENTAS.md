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

**Narração (F8, P230):** a mesma gravação **com a sua voz**. Aperte **F8** (em vez do F9): o indicador diz `REC · NARRAÇÃO`; fale; **F8** de novo para parar. Funciona **offline e online**. O microfone entra só no arquivo (você não se ouve em eco no jogo) e é o aparelho escolhido em Configurações > GRÁFICOS E SOM > CHAT DE VOZ; só vale para **conta de maior de 18 anos** (convidado e menor recebem um aviso no canto). Se o microfone não abrir, o aviso diz para testá-lo ali. **Bluetooth mãos-livres** (o Padrão do fone Captain 300) soa baixinho e derruba o som do fone enquanto grava: para narrar use o microfone do notebook ou um USB. **Canais de voz (P237):** T fala com todos; **segurar Y** só com o time; **segurar U** só com o jogador escolhido; **G** troca o escolhido (remapeáveis em CONTROLES). O canal do time só funciona quando a sala tiver times (hoje o servidor não os atribui: o HUD avisa). Prova: `node .decepticons/medicoes/voz-canais.mjs` (Chrome real, 13 verificações).

**Ganho e saúde do microfone (P237):** Esc > GRÁFICOS E SOM > CHAT DE VOZ > **Ganho do microfone** (0,5x a 4x) vale no chat, no teste e na narração; no [ TESTAR ] a dica sugere o valor quando a voz está baixa. O HUD mostra a barra do nível e avisa "SEM SOM NO MICROFONE" quando ele abre mas entrega silêncio total. O jogo reabre o microfone sozinho quando o fone cai. Prova: `node .decepticons/medicoes/voz-microfone.mjs` (Chrome real, 17 verificações) e `voz.mjs` (26). **Se o Windows mesmo não ouve o microfone** (o Gravador de Voz também não), o defeito é do fone/Bluetooth, não do jogo: ver `VOICE_CHAT.md` § 5g.

**Diagnóstico da voz (P237):** a voz "não chega ao outro PC"? Esc > GRÁFICOS E SOM > CHAT DE VOZ > **[ VER E COPIAR ]** mostra e copia o relatório (conta, microfone, cada ligação com a rota de rede e os bytes de áudio) com uma CONCLUSÃO em português; cole numa conversa. Quem está fora da voz (convidado, menor, sem idade, voz desligada) vê o motivo no canto da tela. Prova: `node .decepticons/medicoes/voz-diagnostico.mjs` (Chrome real, 9 verificações). **A tecla da narração é o F8** (o F10 é do Windows e do navegador).

**Efeito na voz (P231):** Configurações > GRÁFICOS E SOM > CHAT DE VOZ > **Efeito na minha voz** (Sem efeito, Locutor militar, Lorde sombrio, Grande Irmão) vale na narração e na prévia "ouvir a minha voz" do teste do microfone (use fones; trocar o efeito com o teste ligado muda na hora). **Não muda o sotaque** e não vale no chat. Para afinar: `PREDEFINICOES_DE_VOZ` em `client/src/voice/EfeitosDeVoz.ts` é uma tabela de números; depois `node .decepticons/medicoes/efeitos-de-voz.mjs` mede tom, filtros, cauda, eco, pico e custo no Chrome (ajuste as réguas se mudar de propósito). **Provas:** `node .decepticons/medicoes/gravacao-narrada.mjs` (o `GameRecorder` no Chrome real, ffmpeg mede a voz e o jogo no arquivo) e `gravacao-narrada-jogo.mjs` (o jogo de verdade, convidado e adulto).

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

**Ligar (12/10): `npm run mesa`** na raiz do projeto — liga a mesa de montagem e abre no navegador
(`http://127.0.0.1:4199/.tmp/video/editor.html`); se ela já estiver ligada, só abre; **Ctrl+C** na janela desliga. Sem terminal: dois cliques em
`scripts\ligar-mesa.cmd`. Pelo console de comando (modo Comandante, monitor COMANDO), o item **MESA DE VÍDEO** verifica se está ligada e, se não estiver,
mostra o comando com botão de copiar. (O jeito antigo, `node .tmp/video/servir.mjs`, continua valendo: é o que o `npm run mesa` chama.)
Só local (G15: nada fora do projeto; a pasta `.tmp/video/` não vai para o git nem para o site, então a mesa só liga na máquina em que ela existe).

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

### 3.1 O que falta: o take do F9 nascer dentro da mesa (ordem P97, 12/10)

**Pedido do Comandante:** *"gravamos os takes de jogos usando a tecla F9 e quero que esses takes estejam disponíveis na
mesa pra eu finalizar e fazer manualmente as edições pra publicarmos algo de alta qualidade, gráficos ultrahd, som"*.

**O que já existe:** o `F9` **já grava com som** (o áudio do próprio `AudioSystem` é misturado num
`MediaStreamAudioDestinationNode`; VP9 a 16 Mbps, `client/src/core/GameRecorder.ts`) e trava a qualidade no máximo
enquanto grava. A mesa **já tem** a cena `clipe`, com seletor de arquivo e o campo "início" (onde cortar).

**Os dois atritos que a ordem manda tirar:**

1. **O passo manual de copiar o arquivo.** Hoje o `.webm` baixa na pasta de downloads e o dono copia na mão para
   `.tmp/video/clipes/` (jeito 3, passo 2, acima). **Proposta:** ao parar a gravação, o `GameRecorder` **entrega o take
   à mesa** por um `POST` para o servidor local dela (`http://127.0.0.1:4199`), que grava o arquivo em
   `.tmp/video/clipes/` — e o take já aparece na lista do seletor. **Com a mesa desligada, o comportamento de hoje
   continua** (baixa o arquivo): uma gravação não pode se perder por a mesa estar fechada.
2. **A edição manual de verdade.** Hoje o canvas só desenha um **marcador** na cena de clipe, e quem corta e costura é
   o `render.mjs`/`ffmpeg`, por fora, na exportação. Para "finalizar na mão" falta pelo menos: **prévia do take**
   (um `<video>` no lugar do marcador), o campo **fim** (hoje só existe o início) e o **UHD** (a saída é 1080p60; um
   `--altura 2160` no `render.mjs`, com o custo de tempo medido).

**Ordem de trabalho sugerida (do mais barato ao mais caro):** **(a)** o `POST` do take para a mesa; **(b)** o campo
*fim* e a prévia do clipe; **(c)** o preset UHD na exportação; **(d)** a resolução de captura no "modo captura"
(1×/1,5×/2×) — **com cuidado:** em 29/09 forçar a resolução acima do teto travou e perdeu quadro
(`HISTORICO_DE_DECISOES.md`, "F9 travava e perdia quadro"), então medir antes de fixar o padrão.

**Quem toca:** o gravador é do **Claude** (dono do `GameRecorder`, P44); a mesa é **local** (`.tmp/video/`, fora do
git), então a ponta que recebe o arquivo é feita nesta máquina, e o `.tmp/video/LEIAME.md` é o manual dela.

**Como o Comandante confere:** gravar um take (`F9`), parar, e ver o arquivo **já na lista da mesa** — sem copiar
nada na mão.

### 3.2 O primeiro vídeo do canal: "o processo" (Qwen, 12/10 · ordem P47)

**O que é:** o roteiro do **vídeo #1 do canal** — *como este jogo é feito* — com **11 cenas e ~52 s**, pronto para
exportar. É o único vídeo de lançamento que **não depende de take gravado (`F9`)** nem de código novo: dá para
publicar antes de a ordem **P97** (os takes dentro da mesa) ficar pronta.

**Onde está:** a mesa lê `.tmp/video/roteiros/` (local, G15). A **cópia versionada** — a fonte da verdade do texto — é
`.decepticons/video/o-processo.js`; são o mesmo arquivo (mudou um, copie para o outro). Os quadros do vídeo estão em
`arte/video-o-processo-*.png`.

**Como ver/exportar:** `npm run mesa` → **escolher "o-processo" no menu do topo** → **validar** → exportar. O roteiro
de 15 s do dono foi preservado como roteiro nomeado **`cybermech-15s`** (também no menu): alternar não perde nada.

**O portão deu verde:** `node .tmp/video/validar.mjs o-processo` → **11 cenas · 51 s · sem travas**. Todo número é o
número do jogo, lido pelo `fatos.mjs` (1455 testes, 245 PRs, 20 módulos / 89 dependências, 60 Hz, 0,74 ms por tick).

**Três regras que este roteiro segue de propósito:**
- **Nenhum byte e nenhum KB/s** (a peça de 15 s tem a cena da banda; esta não). O vídeo é material público e a decisão
  de 27/09 vale aqui: mostra-se o **ritmo** (60 Hz, 20 Hz) e a **contagem de testes**, não o tamanho das coisas.
- **Nenhuma feature que o `STATUS_REAL.md` marque PARCIAL, DEMO ou AUSENTE** (R13) — é trava do validador.
- **Nada do codinome interno** em texto de tela (o site reprova, e o validador também).

**Como foi gravado — e a medição que importa:** `node .tmp/video/record.mjs 720 30` grava **em tempo real numa janela
com GPU** (52 s → 56 MB, `.tmp/video/o-processo.webm`). **O `render.mjs` (quadro a quadro, 1080p60) é impraticável em
software nesta máquina:** em 10 minutos de tentativa saiu ~1 quadro, porque o headless compõe pela CPU — o mesmo motivo
do § 4. Para 1080p60, aponte o `RENDER_BROWSER` para um Chrome **com GPU** e deixe rodando.

**O que falta para o episódio longo (6 a 10 min):** **narração** (voz; a decisão das vozes por ElevenLabs é a da P75) e
os **takes de gameplay** (P97). **O julgamento visual é do dono:** eu não leio imagem.

**O que o dono pode mexer — e o que a mesa não faz.** A mesa edita o **roteiro**, não o vídeo: corrigir um detalhe é
mexer no campo e **exportar de novo** (~1 min a 720p30). O que muda de graça:

| O dono quer | Onde |
|---|---|
| Trocar a frase | o campo de texto da cena (`titulo`, `sub`, `citacao`, `rodape`, `legenda`) |
| Mudar um número | `leituras`, `contadores`, `usado`, `meta` — mas o **validador confere contra o código**, e é isso que impede número velho de ir ao ar |
| Cena mais longa ou mais curta | `segundos` da cena (a peça inteira se re-cronometra sozinha) |
| Trocar a ordem | mover o bloco da cena para cima ou para baixo |
| Tirar uma cena **sem apagar** | `pular: true` — no "o-processo" há **duas prontas e desligadas**: o `clipe` e o `veredito` |
| Trocar as imagens | a lista `imagens` (o seletor mostra o que existe em `/arte`, `/brand`, `/loading`, `/capturas`, `/rascunho`) |
| O enquadramento | `formato` no topo (`paisagem`, `retrato`, `quadrado`) — o mesmo texto serve aos três |

**O que ela ainda NÃO faz (é a ordem P97):** editar um **clipe gravado** — a cena `clipe` só tem o campo `início` (sem
prévia e sem `fim`), e quem corta é o `render.mjs`/`ffmpeg` na exportação. E o vídeo gravado em tempo real **não é
editado quadro a quadro**: corrigir é roteiro → exportar de novo.

---

## 3.5 Cutscene-piloto do 8 DE JANEIRO (`npm run cutscene`, P245)

**O que é:** prova de conceito de câmera cinematográfica por trajetória (não é o `/mesa`: aquele monta vídeo promocional 2D; isto é uma câmera que voa pelo jogo de verdade, no mapa real). `npm run build && npm run cutscene` serve o `dist/`, abre `?mapa=janeiro&modo=survival&comandante=1&cutscene=janeiro-abertura&depurar` numa GPU real (Chrome/Edge, como as `medicoes/*.mjs`), grava ~24 s com o Playwright e converte para `.mp4` com o `ffmpeg` do projeto (`scripts/sonsRodar.mjs`, o mesmo do Estúdio).

**Onde fica:** o vídeo em `.tmp/video/cutscenes/janeiro-abertura.mp4` (G15, temporário — gere de novo quando quiser, não é commitado); um quadro de prova sempre vai para `.decepticons/arte/cutscene-janeiro-piloto.png`. Sem `ffmpeg` instalado, fica só o `.webm` bruto (todo navegador moderno abre).

**O módulo (sob demanda, não pesa no pacote de partida):** `client/src/camera/CameraPath.ts` (trajetória por quadros-chave, pura, testada) + `CutsceneDirector.ts` (assume a câmera como o `KillCam`) + `client/src/debug/CutsceneJaneiro.ts` (o roteiro: hoje só a abertura do 8 de Janeiro, legenda = a mesma frase 🟢 já revisada da missão). Ver `STATUS_REAL.md` P245 para os limites (sem evitar colisão com geometria, sem som).

---

## 4. Medir travadas com GPU real

**Quando:** o dono diz que o jogo "está lento" ou "travando", ou antes de entregar efeito visual novo. **O CI e o SwiftShader não servem:** renderizam por software, a ~1 fps, e não mostram o custo de compilar shader (na Iris Xe, ~1,5 s por programa).

**Método (09/10):** Chrome do sistema com GPU de verdade (`--ignore-gpu-blocklist --use-angle=d3d11 --disable-frame-rate-limit --disable-gpu-vsync`), tela de laptop (1536×864 a 1,25× = 1920×1080; 1920×1080 a 1,5× = 2880×1620) e qualidade fixa em `alta` (a automática rebaixaria a imagem no meio da medida). Em vez de só a média de fps (que esconde congelamentos), registra **cada quadro acima de 80 ms com a fase da partida** (parado, atirando). Para achar a causa de uma travada: perfil de CPU pelo CDP (`Profiler.start`, amostragem de 1 ms) alinhado à janela de cada travada, e ganchos em `WebGL2RenderingContext` que medem `getProgramInfoLog` (onde o driver bloqueia ao terminar de compilar) e registram o código do shader. Armadilha: o aquecimento e a resolução mudam o resultado; compare só execuções com a mesma configuração, alternadas (base, nova, base, nova), porque o notebook esquenta.

**Onde estão os scripts:** `.tmp/ferramentas/` desta máquina (`medir-travadas.mjs`, `medir-quadros.mjs`, `capturar-arena.mjs`), fora do git (G15). Se forem úteis a outro agente, vale promovê-los a `scripts/` com teste.

### 4.1 NaN na GPU real: a tela preta que só a GPU de verdade mostra (`medicoes/varrer-nan.mjs`, P130/P136, 15/10)

**Quando:** depois de mexer em **shader de efeito** (halo, cortina, névoa, água, céu, janela, qualquer `ShaderMaterial` ou `onBeforeCompile`) e **antes de entregar**. O SwiftShader (smoke, CI, bancada `praia.mjs`) **não vê NaN**; um NaN num pixel só vira um retângulo preto quando o bloom o espalha.

```bash
npm run build && node .decepticons/medicoes/varrer-nan.mjs                       # 10 pontos do mapa × 48 poses; sai com 1 se achar pixel não finito
node .decepticons/medicoes/varrer-nan.mjs --w 1549 --h 925 --q alta --bloom      # a janela do Comandante; --bloom mede com o bloom LIGADO (prova a rede de segurança)
node .decepticons/medicoes/varrer-nan.mjs --efeitos                               # P160: acende os efeitos de arma em volta do Mech (explosões, fitas, marcas, cartazes, feixes)
```

**Efeito de arma novo (P160):** shader que só aparece durante um tiro não entra na conta de uma varredura parada; use `--efeitos` (a cada 6 poses
acende, num anel em volta do Mech, explosões no chão e no ar, a do Mech destruído, mísseis com fita, tiros com brilho e marca, o raio do trilho e o
feixe do laser, pelo `window.__game.weaponFx`). Em 16/10: 0 de 192 poses com NaN.

**Como funciona:** serve o `dist/`, abre `?mapa=praia&depurar` (o `main.ts` expõe `window.__game` só com esse parâmetro), teletransporta o Mech (`mech.respawn`), gira a câmera (`rig.look`) e lê o buffer HDR da cena. **Armadilhas:** (1) precisa do Chrome com `--use-angle=d3d11` e uma GPU (a desta máquina é a AMD Vega 11); (2) a bancada `praia.mjs` **sai preta** numa GPU real (o canvas fica zerado): não a use para isso; (3) o problema era **intermitente** (a orientação inicial da câmera muda por sessão), então um "não deu nada" de uma sessão só não prova; a varredura de poses prova. **Se achar NaN:** esconda um objeto de cada vez (`scene.traverse` + `visible = false`) e veja qual derruba a contagem — foi assim que a cortina das zonas apareceu.

### 4.2 A bancada da Cidade Neon (`medicoes/arena.mjs`, P177, 17/10)

Fotografa a **Arena real** (`Arena.ts` com o transformador do banco, o mesmo pipeline de render do jogo) de vistas-chave, nos três estados do transformador, e mede desenhos e triângulos. Mesmo molde de `praia.mjs` (Vite dev + Chrome headless, SwiftShader: só contagem, não tempo). `node .decepticons/medicoes/arena.mjs --vistas banco,cidade --quadro "2:0:0"` (o estado:vida:energia do transformador; 0 ligado, 1 sabotado, 2 apagado); `--chefe "-8,-16"` põe o Colossus com a máscara (`--sem-mascara` a tira); `--arte --sufixo e1` grava em `arte/`. **Para o HUD no jogo de verdade** (a célula do transformador e a barra do chefe), abra `?modo=survival&mapa=arena&onda=6` no Chrome headless, clique em `#cta` e espere ~30 s (o SwiftShader roda a ~0,25× do tempo).

### 4.3 O Draga-01: o script de rig e a bancada (`scripts/blender/rig-walker.py`, `medicoes/walker.mjs`, P180, 17/10)

**O rig** (Blender sem janela, em `D:\blender\blender.exe`): `blender -b -P scripts/blender/rig-walker.py -- <entrada.glb> <saida.glb> [--fotos <pasta>] [--listar <classes>] [--so-classificar]`. Lê a **cópia** do modelo, classifica as peças soltas em ossos, mede as juntas, monta os 18 ossos com pele rígida e cor nos vértices e exporta. `--so-classificar --fotos <pasta>` só fotografa a classificação (uma cor por osso) para conferir antes de exportar. **Cuidado, armadilha achada em 17/10: no Blender `-b` use SEMPRE caminho absoluto para as fotos e as saídas**: um relativo caiu em `C:\.tmp\` (fora do projeto, G15); o script usa `os.path.abspath`, mas quem chamar `bpy.ops.render.render` com caminho próprio tem de passar absoluto. Defina `TEMP`/`TMP` para `.tmp/captura` ao rodar.

**A bancada:** `node .decepticons/medicoes/walker.mjs --vistas lado,tres-quartos` fotografa o Draga (o mesmo `.glb` e a mesma marcha do jogo) ao lado do Vector-09 (a régua de escala); `--fases 0,0.2,0.4,0.6` uma foto por fase da marcha; `--colapso fl,rr` pernas caídas; `--arte --sufixo a1` grava em `arte/`. **Para ver no jogo de verdade:** `?walker` no link (o Draga anda em círculo à sua frente). **O rig se testa em Node** (`WalkerVisual.test.ts` carrega o `.glb` real: o `GLTFLoader` roda sem navegador quando o arquivo não tem textura).

### 4.4 A bancada da Amazônia e o jogo real (`medicoes/amazonia.mjs`, `medicoes/amazonia-jogo.mjs`, P180 parte B, 17/10)

**A bancada** (mesmo molde de `praia.mjs`: Vite dev + Chrome headless, SwiftShader, só contagem): `node .decepticons/medicoes/amazonia.mjs --vistas geral,aldeia,rio,draga,jusante,mina,planta,lagoa` fotografa o mapa real (o mesmo `Amazonia.ts`) e mede desenhos e triângulos; `--frente 1000` põe a frente do rio onde se pedir (o rio curado até lá); `--sem-draga`; `--arte --sufixo b1` grava em `arte/`. **A câmera da bancada tem o mesmo alcance da do jogo** (1.500 m; só a vista `geral`, sem névoa, passa disso).
**O jogo real:** `node .decepticons/medicoes/amazonia-jogo.mjs 6,12,24 b1` abre `?mapa=amazonia&modo=deathmatch` no jogo de verdade (câmera, HUD e névoa dele), fotografa nos segundos pedidos e lista o que o navegador baixou sob demanda (o mapa e o Draga). **Por que existe:** em 17/10 o céu saía preto no jogo e a bancada, com câmera própria, não mostrava; **bug de câmera ou de HUD só se prova no jogo real**. O pitch da câmera muda entre execuções (não há mouse com trava): tire vários quadros e escolha o que mostra o horizonte.

### 4.6-b A bancada da multidão (`medicoes/multidao-gpu.mjs`, P217, 19/10)

`npm run build && node .decepticons/medicoes/multidao-gpu.mjs --fotos --salvar` (opções: `--cotas 0,1500,3000`, `--t 17500` o tick em que começa, `--rodadas 3`, `--tela 1280x720`): o mesmo ponto da Cidade Neon **sem e com** a multidão (`?multidao=1&cota=N&t=T`), rodadas intercaladas e a mediana, com as fotos em `.decepticons/arte/multidao-N.png`. **Achado que só a GPU real dá:** o limite de **16 atributos por vértice** (o shader não compila e a multidão some, sem erro no SwiftShader do smoke). Resultados em `medicoes/MULTIDAO.md`. **O `varrer-nan` aceita `--extra "multidao=1&cota=3000&t=9000"`** (parâmetros de link a mais): varre a praia com a multidão na cena (0 de 480 poses com NaN em 19/10).

### 4.6-c A bancada da missão do 8 DE JANEIRO (`medicoes/janeiro-missao.mjs`, P233, 20/10)

`npm run build && node .decepticons/medicoes/janeiro-missao.mjs` (opção `--espera 30`: segundos até a multidão chegar): joga a missão de verdade no Chrome com a GPU real (`?mapa=janeiro&modo=survival&comandante=1&depurar`), põe o Mech em frente ao Congresso, espera a multidão, atira, mede o quadro e derruba um prédio para fotografar a derrota (`arte/janeiro-missao-*.png`). Imprime o estado da missão (tick, integridade, presentes, eliminados) e os erros de página. Rodar uma vez por frente, não por mudança.

### 4.6 A bancada de GPU de verdade (`medicoes/amazonia-gpu.mjs`, P188, 18/10): onde o quadro gasta

**Quando:** o Comandante diz "travou/pesou" e você precisa saber **por quê** (cenário? pós-processamento? CPU?). Serve ao `dist/` (`npm run build` antes), abre `?mapa=<mapa>&modo=<modo>&depurar` no Chrome/Edge do sistema com GPU de verdade e **sem limite de quadros nem vsync** (o fps é a capacidade da máquina).

```bash
node .decepticons/medicoes/amazonia-gpu.mjs --telas 1549x925@1.25 --qualidades alta,media,baixa   # a janela do Comandante (1549×925 com a escala 1,25 = 1936×1156 pixels)
node .decepticons/medicoes/amazonia-gpu.mjs --telas 1549x925@1.25 --qualidades alta --matriz --rodadas 5   # a conta do pós-processamento: MSAA, FXAA, bloom e escala, em rodadas alternadas, com a MEDIANA
node .decepticons/medicoes/amazonia-gpu.mjs --so-alta --experimentos                              # esconde uma categoria do cenário por vez (árvores, terreno, água, estruturas, céu)
node .decepticons/medicoes/amazonia-gpu.mjs --mapa arena --modo deathmatch --telas 1549x925@1.25   # a mesma conta nos outros mapas
```

**O que o jogo expõe (`?depurar`):** `window.__game` com `renderer`, `scene`, `composer`, `bloomPass`, `fxaaPass`, `quality`, `mech`, `rig`. A bancada instala um cronômetro em volta de `composer.render` + `gl.finish()`: o **custo de GPU do quadro sem o resto da partida** (o fps cru mistura a GPU com a CPU e oscila com a máquina). **Armadilhas:** (1) **o iGPU divide a máquina com o navegador e o editor abertos**: o fps de uma rodada só varia de 17 a 35; alterne as configurações em rodadas e fique com a **mediana** (`--rodadas 5`), senão a conclusão sai errada; (2) a **escala do Windows muda tudo**: o jogo renderiza `janela × escala` pixels (1,25× em 1549×925 são 2,2 milhões de pixels, 2,4× os de 1280×720): meça na janela do dono, não em 720p; (3) trocar `rt.samples` em tempo de execução pede `rt.dispose()`.

**O achado de 18/10 (a causa de "travado", provada):** MSAA 4× no alvo HDR de meia precisão = **24-27 ms** de GPU por quadro na Vega 11 (a 1936×1156), contra **10,5 ms** sem ele (+1,5 ms do FXAA). **Todo mapa.** O cenário da Amazônia inteiro escondido tirava só ~2 ms. Registro: `medicoes/amazonia-gpu-2026-10-18.json`.

### 4.7 A prova do aviso de reinício no jogo de verdade (`medicoes/aviso-reinicio.mjs`, P204, 18/10)

Um servidor local (porta 2598, dados em `.tmp/aviso-dados`) + o jogo pelo Vite dev + Chrome headless: o jogador entra na sala, o servidor reinicia **com aviso** (conta 0:07, depois do corte 0:58, volta e a tela some) e depois cai **sem aviso** (o contador sobe e, com 30 s, o botão de jogar offline). 8 verificações, saída `TUDO OK`, fotos em `.decepticons/arte/aviso-reinicio-*-claude.jpg`. ~4 min e um Chrome: rode com o servidor de jogo de verdade sem ninguém jogando. Um `querySelector('.net-status')` acha o elemento do `NetHud`, vazio; o do `Game` é o segundo (use `querySelectorAll`).

### 4.8 A bancada do chat de voz (`medicoes/voz.mjs` e `medicoes/voz-jogo.mjs`, P205, 18/10)

`node .decepticons/medicoes/voz.mjs`: um servidor de jogo de verdade (porta 2598) + o Vite + **Chrome com microfone falso** (`--use-file-for-fake-audio-capture`: um WAV de tom ou de silêncio, gerado em `.tmp/voz/`) e páginas `voz-bancada.html` (só rede e voz, o mesmo `NetClient`, `VoiceChat` e áudio espacial do jogo). 26 verificações (o áudio chega, mudo, PTT, distância, recusa, microfone tardio, o DTX por `getStats`), grava `medicoes/voz-<data>.json`, sai com 1 se algo falhar, ~3 min. `voz-jogo.mjs` abre o **jogo de verdade** (`?comandante=1`) com a bancada como colega e fotografa o indicador e as Configurações em `arte/`. **Achados:** (1) o Vite tem a raiz em `client/`: a página da bancada vai por `@fs/`, como as outras (sem isso o navegador cai no `index.html` do jogo e nunca define a bancada); (2) o tom puro do arquivo é "ruído" para a supressão do navegador, então a bancada liga com `dsp=0` (sem eco, ruído e ganho automático); só a rodada do silêncio usa as restrições reais do jogo; (3) o microfone só vira `replaceTrack` depois da ligação: provado com `mic=tarde`.

### 4.9 A bancada da voz no celular (`medicoes/voz-celular.mjs`, P209, 19/10)

O jogo de verdade num **celular emulado** (Chrome com tela de toque, 915×412 deitado, `isMobile` + `hasTouch`, que liga o `(hover: none) and (pointer: coarse)` e o modo toque do jogo), online, com um colega falando (uma página da bancada) e o microfone falso. Toque de verdade: `page.touchscreen.tap` para tocar e **`Input.dispatchTouchEvent` do CDP** para **segurar** (o Playwright só sabe tocar). 12 verificações (o botão aparece, está acima da camada de mira por `elementFromPoint`, tocar alterna, segurar fala, nenhum texto cita tecla), foto em `arte/voz-celular-claude.png`, ~3 min. As três bancadas de voz geram o WAV do microfone falso pelo `vozLib.mjs` (`.tmp/voz/`). **Limite:** não é aparelho de verdade (o iPhone é o risco).

### 4.10 A bancada do teste do microfone (`medicoes/voz-teste-mic.mjs`, P212, 19/10)

O jogo de verdade online, **sozinho** numa sala e depois com um colega (a página da bancada), com microfone falso. Prova o aviso "ninguém mais na voz" (aparece e some), o painel das Configurações (a barra mexe, "funcionando", a lista de aparelhos ganha nome), e que **parar, fechar as Configurações e trocar de aba soltam o microfone de verdade**: a página grava toda faixa que o `getUserMedia` entrega (`addInitScript`) e a bancada confere que terminaram. Um segundo Chrome **sem** a flag `--use-fake-ui-for-media-stream` prova o caso do microfone bloqueado (o painel explica o motivo). 14 verificações, foto em `arte/voz-teste-microfone-claude.png`, ~4 min; precisa de ~400 MB livres.

### 4.11 A bancada da idade e da voz (`medicoes/voz-idade.mjs`, P211, 19/10)

O jogo de verdade online com **cinco jogadores e um colega adulto** (a página da bancada, falando um tom), microfone falso: adulto (a sessão guardada é restaurada), convidado, menor, conta sem idade que informa a idade na aba JOGO, **cadastro pela tela** como adulto e como menor, e **clientes adulterados** (token de menor, nenhum, ou torto). **Na fase de testes (P241)** prova que o convidado e o sem-idade abrem a voz sozinhos e pedem o microfone, que o **menor entra só para ouvir** (a página conta as chamadas do `getUserMedia`: zero; o indicador diz "SÓ OUVINDO"; quem era convidado e vira menor tem o microfone largado), e que o servidor deixa todos entrarem (o limite fica dito). Fotos do cadastro e da conta de menor em `arte/`.

**O que as bancadas de voz aprenderam com a idade:** na regra da P211 o servidor só admitia na voz quem levava o token de uma conta de maior de idade, então toda bancada precisava de conta; **na fase de testes (P241) não precisa**. `vozLib.mjs` tem `tokenDeConta(porta, apelido, nascimento)` (cria a conta pelo HTTP do servidor da bancada e devolve a sessão; `null` = conta sem idade), `guardarSessao(page, porta, token)` (deixa o token no `localStorage` antes de a página abrir: o jogo restaura sozinho) e `apontarJogoPara(porta)` (**o servidor de contas do jogo vem de `VITE_GAME_SERVER`**: ponha-o na porta da bancada **antes** de subir o Vite). A página-colega (`voz-bancada.html`) aceita `?token=`; sem ele o `PRONTO` vai vazio (convidado: o servidor o admite na fase de testes e o recusaria na regra da P211).

### 4.12 A bancada do microfone REAL (`medicoes/mic-real.mjs`, P229, 20/10)

Roda o `MicTest` do jogo (a classe de verdade) contra **cada microfone real do computador**, no Chrome, no Brave ou no Edge: `node .decepticons/medicoes/mic-real.mjs brave 6` (segundos por aparelho; fale durante a medida). Imprime, por aparelho, **qual o navegador abriu**, o estado (ok, sem sinal, **silêncio total**) e a barra; falha se uma escolha abrir outro aparelho. Só lê o nível, não grava. **Por que existe:** as outras bancadas usam o microfone **falso** do Chrome (um aparelho só, que sempre tem sinal) e por isso nunca viram que o jogo ignorava a escolha da lista e que o fone Bluetooth do Comandante ficava mudo. **Receita para um microfone que "funciona no Windows e não no jogo":** rode esta bancada no navegador dele; zero absoluto num aparelho é aparelho mudo ou desligado no Windows (Configurações de som > Entrada > propriedades > níveis), e o jogo só pode dizer isso. **Armadilha:** o `Padrão` do navegador, em fone Bluetooth, é o modo mãos-livres (16 kHz, baixinho): compare o `rmsMax`, não o `rmsMédio`.

### 4.5 A missão do rio e a câmera do jogo com o mouse (P180, parte C)

**Para ver o fim da missão sem esperar dez minutos:** `?mapa=amazonia&modo=survival&marcha=0.9` (de 0 a 0,95: quanto da marcha o Draga já andou). **Para fotografar o jogo com a câmera virada:** o **Pointer Lock funciona no Chrome sem janela**, então `page.mouse.move` gira a câmera do jogo de verdade: **cada ponto do mouse são 0,0008 rad** (a `BASE_SENSITIVITY`) e **mover para a direita vira para a direita** (o rumo cresce no sentido horário a partir do norte, -Z). O Playwright entrega os eventos mesmo com o ponteiro fora da janela. **A mata esconde o Draga do chão:** para vê-lo, olhe do rio, de uma clareira (a aldeia) ou acima das copas; a bancada (`amazonia.mjs --vistas draga`) o mostra de cima do rio.

## 5. Considerações conhecidas (não são bug novo se você achar de novo)

- **O gate do push morre com "Worker exited unexpectedly with exit code 0xC0000409 / 0x80000003" (19/10).** Não é o código: é a **memória virtual do Windows no teto** (RAM + arquivo de paginação; o `FreeVirtualMemory` do WMI chegou a 1,6 GB livres de 24). A causa na máquina do dono: **cada sessão do Claude Code aberta mantém 9 servidores MCP da Hostinger** (~135 MB de memória comprometida cada, com o `npx` de embrulho: 48 processos node, 3,1 GB com seis sessões abertas). **Fechar as sessões antigas libera mais que qualquer ajuste.** O `npm test` agora **conta a memória virtual livre** (`scripts/workersPelaMemoria.mjs`): com o teto apertado roda **1 worker**, e `CYBERMECH_WORKERS=1 npm run check` força. Mais devagar (~10 min), mas passa. Teste: `server/workersPelaMemoria.test.ts`.
- **Mech parado afunda lentamente no chão, sem limite** (achado 29/09, não corrigido). Reproduz
  com qualquer Mech parado tempo suficiente; mais visível no Colossus (grande, parado mirando)
  do que no Vector-09. Causa isolada e documentada (o contorno do "engasgo do Rapier" de 23/09
  só cobre o caso em movimento, não o parado) — antes de investigar do zero, leia
  `HISTORICO_DE_DECISOES.md`, entrada de 29/09 "Colossus-01 vira chassi solo pilotável" (a seção
  "achado, não corrigido"). Precisa de alguém com tempo dedicado ao character controller do
  Rapier.
- **Gerar por IA não entra na versão publicada da mesa** (só local) — precisaria expor a chave
  de API no navegador, de propósito não fizemos isso.

---

## 5a. Fotos promocionais dos Mechs reais para o site (`medicoes/cena-cinematica.mjs`, P172, 16/10)

**Quando:** o site precisa de imagem de Mech, de arma ou de cena (herói da landing, Hangar, régua dos chassis, cartas). **Regra:** a imagem é do **modelo real** do jogo (`client/public/models/*.glb`, o procedural do Vector-09, `weaponModels.ts`); nada de arte inventada como se fosse o jogo.

**Como:** `node .decepticons/medicoes/cena-cinematica.mjs [hero duelo colossusv4 marauder vector09 hangar escala arma-rotary …]` sobe o Vite, abre o Chrome por software (SwiftShader) e grava `client/public/press/cena-<nome>.jpg`; ~10 s por foto. O aleatório das faíscas tem semente: a mesma foto sai igual. A **posição das partes na foto** (topo e base de cada Mech, os 6 pontos do Hangar) é projetada do 3D e gravada em `scripts/site/cena/<nome>.json`: a landing posiciona a régua de 20 m e os marcadores por ela, então **mexeu na câmera? Rode de novo e confira a página**.

**Achados (armadilhas):** (1) o casco branco do Marauder estoura no brilho: o script escurece o tom do material (a malha continua a do jogo); (2) o nevoeiro exponencial come a foto larga (`escala` usa densidade 0,0032; o herói, 0,0105; as fichas, 0,018); (3) o Vector-09 é procedural e simples: a foto dele é sóbria, e é verdade; (4) cone de luz em `MeshBasicMaterial` aditivo parece triângulo chapado: o feixe usa sombreador com borda e ponta esmaecidas; (5) heredoc com crase quebra no Bash desta máquina, escreva o script com o Write e rode.

## 6. CI vermelho: ler o log e medir o boot (para os agentes)

**Ler o log quando o token do `gh` morreu (12/10, PR do console).** `node scripts/gh.mjs pr checks <n>` funciona (cai para a credencial do Git), mas `gh api …` e `gh run …` **não**: sem token o GitHub responde **404** em repositório privado (ou **403 "API rate limit exceeded"**), e o fallback do `scripts/ghSeguro.mjs` só dispara em erro de autenticação (401, "Bad credentials"; de propósito: um 404 de verdade, como um PR que não existe, não deve ser repetido).
A receita é um script em `.tmp/` que roda o `gh` com a credencial do Git **só no ambiente do processo filho**, com as funções do próprio projeto (o token nunca vai para a saída, para argumento de linha de comando nem para arquivo):

```js
// .tmp/ci/gh-com-token.mjs
import { spawnSync } from 'node:child_process';
import { esconder, tokenDoGit } from '../../scripts/ghSeguro.mjs';

const token = tokenDoGit();
if (!token) { console.error('sem credencial guardada no Git'); process.exit(1); }
const r = spawnSync('gh', process.argv.slice(2), { encoding: 'utf8', env: { ...process.env, GH_TOKEN: token }, maxBuffer: 256 * 1024 * 1024 });
process.stdout.write(esconder(r.stdout, token));
process.stderr.write(esconder(r.stderr, token));
process.exit(r.status ?? 1);
```

Uso: `node scripts/gh.mjs pr checks <n>` imprime a URL do job (`…/actions/runs/<run>/job/<job>`); então
`node .tmp/ci/gh-com-token.mjs api repos/SerafimWeb/decepticons/actions/jobs/<job> --jq '[.steps[] | {n: .number, nome: .name, resultado: .conclusion}]'` mostra o passo que falhou e
`node .tmp/ci/gh-com-token.mjs run view <run> --job <job> --log-failed` imprime o log desse passo. Para esperar uma execução (por exemplo o deploy depois do merge), consulte `api repos/SerafimWeb/decepticons/actions/runs/<run> --jq '{status, conclusion}'`
de tempos em tempos, e o deploy só conta quando o passo "Conferir o site publicado" passa (daqui o site pode não responder: memória do 10/10).

**Boot lento no CI.** O smoke (`scripts/smoke.mjs`) dá **30 s** para o botão dizer "clique para jogar"; o CI leva de **8 a 20 s** (execuções de 11/10), então a margem é de uns 10 s. Um console de comando completo visível durante o carregamento somou **+5 s** localmente (6,8 s → 12 a 13 s) e passou dos 30 s no CI:
o custo não estava em script, layout nem estilo (as métricas do renderer quase não mudaram), e sim no compositor por software disputando a CPU com a compilação dos shaders, o requisito de GPU integrada (G12), então pesava em GPU fraca também.
**Regra:** o que aparece enquanto o jogo carrega é mínimo (título e botão); tudo o que for pesado (monitores, canvas, animações) só depois de o botão ficar pronto. E atenção: o `HUD.setReady` roda no construtor do `Game` e o botão **já diz "clique para jogar" antes do aquecimento dos shaders**, que troca o texto por "preparando gráficos" e o restaura no fim;
quem reage a "pronto" tem que esperar o texto assentar (o `CommandConsole` espera 250 ms).
**Como medir:** sirva dois builds (a `main` numa worktree em `.tmp/` e o seu) com os mesmos argumentos do smoke (`--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`, Chrome headless) e **alterne as rodadas** (a máquina oscila de 6 a 9 s na mesma `main`); esconda partes do overlay por CSS injetado depois do `DOMContentLoaded`
para achar o culpado; o CPU por processo sai do CDP (`SystemInfo.getProcessInfo`) e o tempo de layout, estilo e script de `Performance.getMetrics`. Para simular um runner lento, sature núcleos com laços ocupados (6 de 8) e compare de novo.
**Cuidado ao apagar a worktree de teste:** o `node_modules` dela é uma **junção** para o do projeto: remova só o atalho (`[System.IO.Directory]::Delete(caminho, $false)`, não recursivo, que falha em vez de apagar se for um diretório de verdade) e só então `git worktree remove` (AGENTS.md, regra 12).


### 4.6 Abuso contra o servidor (auditoria de segurança, P198)

`node .decepticons/medicoes/abuso-servidor.mjs` (da raiz do projeto): sobe um servidor de jogo de teste (porta 2597, dados em `.tmp/fuzz-dados`, apagados no fim) e dispara **~1.400 pedidos HTTP hostis** (métodos trocados, JSON quebrado, corpos de 100 KB, caminhos com `..` e `%00`, URL de 20 KB, cabeçalhos mentirosos), **8 pedidos crus quebrados no socket** e **7 frames de WebSocket lixo**, mais uma conexão com origem de fora. Passa quando: **nenhuma resposta 5xx, nenhum vazamento de caminho ou pilha, o `/status` responde depois, e a origem de fora é recusada**; sai com código 1 se não. Medido em 18/10: 1.368 pedidos, 0 falhas. Rode antes de um lançamento e depois de mexer em rotas HTTP.

### 4.7 Os administradores (P196)

`npm run admin -- listar | promover <e-mail> | rebaixar <e-mail>`: o **único** jeito de criar ou tirar um administrador (nenhuma rota promove ninguém). Rode **na pasta principal do projeto, no PC do servidor** (ou aponte a pasta com `CYBERMECH_DADOS`); a pessoa precisa ter criado a conta antes; o efeito é imediato e cada mudança entra na trilha de auditoria.