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

---

## 4. Medir travadas com GPU real

**Quando:** o dono diz que o jogo "está lento" ou "travando", ou antes de entregar efeito visual novo. **O CI e o SwiftShader não servem:** renderizam por software, a ~1 fps, e não mostram o custo de compilar shader (na Iris Xe, ~1,5 s por programa).

**Método (09/10):** Chrome do sistema com GPU de verdade (`--ignore-gpu-blocklist --use-angle=d3d11 --disable-frame-rate-limit --disable-gpu-vsync`), tela de laptop (1536×864 a 1,25× = 1920×1080; 1920×1080 a 1,5× = 2880×1620) e qualidade fixa em `alta` (a automática rebaixaria a imagem no meio da medida). Em vez de só a média de fps (que esconde congelamentos), registra **cada quadro acima de 80 ms com a fase da partida** (parado, atirando). Para achar a causa de uma travada: perfil de CPU pelo CDP (`Profiler.start`, amostragem de 1 ms) alinhado à janela de cada travada, e ganchos em `WebGL2RenderingContext` que medem `getProgramInfoLog` (onde o driver bloqueia ao terminar de compilar) e registram o código do shader. Armadilha: o aquecimento e a resolução mudam o resultado; compare só execuções com a mesma configuração, alternadas (base, nova, base, nova), porque o notebook esquenta.

**Onde estão os scripts:** `.tmp/ferramentas/` desta máquina (`medir-travadas.mjs`, `medir-quadros.mjs`, `capturar-arena.mjs`), fora do git (G15). Se forem úteis a outro agente, vale promovê-los a `scripts/` com teste.

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
