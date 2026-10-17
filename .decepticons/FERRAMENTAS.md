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

## 5. Considerações conhecidas (não são bug novo se você achar de novo)

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
