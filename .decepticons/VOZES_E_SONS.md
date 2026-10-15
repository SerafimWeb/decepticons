# VOZES E SONS — o narrador, o `npm run vozes` e o que falta (P146)

> **Ordem do Comandante (15/10):** *"no ElevenLabs, principalmente os comandos e frases de início da partida, round 1, etc, killing frenzy, you die,
> esse tipo de coisa, com sotaque russo, chinês, inglês, brasileiro, etc, tipo uma boa voz de narrador do Mortal Kombat; os sons das armas, eu enviei
> diversos sons de referência"*. Antes: *"os SONS estão bem merdas ainda"*. **Estado:** o **narrador está no jogo** (PARCIAL: falta gerar as vozes);
> os **sons de arma esperam as referências** (não chegaram a esta máquina). Claude, 15/10.

## 1. O que está pronto

| Peça | Onde | O que faz |
|---|---|---|
| Catálogo de falas | `client/src/audio/falas.json` | 19 falas: **rodada 1 a 9**, **combate**, **abates 2 a 6** (duplo, killing frenzy, rampage, unstoppable, legendary), **você morreu**, **hostis chegando**, **estação segura**, **rede caiu**. Texto em português (`br`) e inglês (`en`; `ru` e `cn` usam o mesmo inglês: **o sotaque é da voz**). Frases originais. |
| O narrador | `client/src/audio/Narrador.ts` | escolhe o clipe, o sotaque, evita sobreposição (prioridade) e repetição (1,2 s). Só da tela (G1/G2). |
| A escolha do jogador | Configurações > Gráficos e som > **Voz do narrador** | Brasileiro · Inglês · Sotaque russo · Sotaque chinês · **Mistura** (um sotaque por fala) · Sem narrador. Padrão: Brasileiro. `?narrador=ru` na URL força (teste, vídeo). |
| O gerador | `npm run vozes` (`scripts/vozes.mjs`) | gera um `.mp3` por fala e por sotaque com o ElevenLabs, em `client/public/audio/vozes/<sotaque>/`, e atualiza o manifesto `client/src/audio/vozesGeradas.json` (é por ele que o jogo sabe o que pedir: **sem 404**). |
| Os gatilhos | `core/Game.ts` | "Rodada N" e "Combate!" (`RoundOverlay.anunciar`), sequência de abates 2+ (o `KillBanner`), "você morreu" (offline e online), "hostis chegando" (onda 2 em diante), "estação segura" / "rede caiu" (a missão com núcleo). |

**Enquanto não há clipe gerado:** "Rodada N" e "Combate!" seguem na voz do navegador, em português, **como antes**. As falas novas (abate, morte, missão) ficam **mudas**
(o banner na tela continua): a voz robótica do navegador anunciando cada abate seria pior que o silêncio.

## 2. Como gerar as vozes (uma vez; leva uns 5 minutos)

1. **A chave do ElevenLabs**, só na variável de ambiente da janela (nunca no repositório, nunca no chat; R2). No PowerShell, na pasta do projeto:
   `$env:ELEVENLABS_API_KEY = "sua-chave"` (some ao fechar a janela).
2. **Escolher uma voz por sotaque.** `npm run vozes -- --listar` mostra as vozes **da sua conta** (id, nome, sotaque); `npm run vozes -- --biblioteca "russian"` procura na biblioteca
   pública (melhor esforço; adicione a voz que gostar à sua coleção no site do ElevenLabs e confirme com `--listar`). Ponha os ids em `scripts/vozes.config.json`
   (`br`, `en`, `ru`, `cn`). Hoje só o `en` tem voz: a do narrador que você escolheu em 14/10 (`y3X5crcIDtFawPx7bcNq`, P113). **Sotaque sem voz é pulado.**
   *Dica de voz:* para o tom de narrador de luta, procure vozes graves e dramáticas ("deep", "narrator", "trailer"); o gerador já usa estabilidade baixa e estilo alto
   (`falas.json` > `estilos`), que dão a ênfase teatral.
3. **Ver o custo antes:** `npm run vozes -- --custo` (não gasta nada). O catálogo inteiro tem **menos de 500 caracteres por sotaque**: os quatro sotaques cabem folgados no plano grátis.
4. **Gerar:** `npm run vozes -- --gerar --sim` (sem o `--sim` ele só mostra o plano). Opções: `--sotaque ru,cn`, `--so combate,rodada_1`, `--refazer`. O que já existe **não é gerado de novo**
   (o crédito se gasta uma vez por frase); um teto de 3.000 caracteres barra acidente (`--max-caracteres N`).
5. **Ouvir:** abra o jogo com `?narrador=ru` (ou o sotaque que gerou), entre na partida e passe a rodada. Gostou? **Commite os `.mp3` e o manifesto** (a pasta `vozes/` já é liberada no `.gitignore`).

**Prefere gerar no site do ElevenLabs** (o estúdio de texto para voz)? Salve cada fala como `client/public/audio/vozes/<sotaque>/<chave>.mp3` (a chave é a do catálogo: `combate`, `rodada_1`, `abate_3`...) e rode
`npm run vozes -- --manifesto` para o jogo passar a conhecê-las.

## 3. Os sons das armas: o que falta

O Comandante diz que **enviou sons de referência**. **Eles não chegaram a esta máquina**: não há arquivo novo de áudio no projeto, em `Downloads`, `Desktop` ou `D:\imagens cybermech`
(só os 11 de 28/09 em `client/public/audio/` e faixas de música em `.tmp/SOUNDS/`), e um áudio colado no chat **não chega ao Claude** (e o Claude **não ouve** arquivo de áudio: só mede duração, volume e formato).

**O que fazer:** largue os arquivos em **`.tmp/SOUNDS/armas/`** (G15: dentro do projeto), **um por arma, com o nome do que ela é** (`plasma.wav`, `metralhadora.mp3`, `foguete.wav`, `canhao_pesado.wav`, `lanca_chamas.wav`,
`arpao.wav`...), e avise. O Claude então (o `ffmpeg` já está instalado aqui): **apara o silêncio, normaliza o volume, converte para `.mp3`** leve, registra cada um no `Game.ts` e libera no `.gitignore`
(as duas coisas, ou o site toca o sintetizado: `client/public/audio/README.md`). **Quem julga o som é o ouvido do Comandante:** o PR traz o caminho para ouvir (arma, tecla).

O ElevenLabs também gera **efeitos sonoros por texto** (`/v1/sound-generation`, ex.: "futuristic plasma cannon shot, heavy bass"): é a alternativa para as armas sem referência.
**Decisão do Comandante:** quais armas ficam com a referência dele, quais com efeito gerado e quais seguem sintetizadas.

## 4. Custo

Nenhum por quadro nem por tick. Por fala: um teste de texto e uma consulta a um `Map`. Os clipes (~20 KB cada) são pedidos **uma vez, sob demanda, só do sotaque escolhido**, e só os que o manifesto lista.
O bundle ganha dois JSON pequenos (o catálogo e o manifesto).

## 5. Ligado a

`ORDENS_DO_COMANDO.md` P146 e P113 · `client/public/audio/README.md` (como entra um sample) · `PILOTOS_LLM_E_INTELIGENCIA.md` § 3-B (o rádio das IAs por LLM usaria esta mesma voz) ·
`CAMPANHAS_E_CHEFES.md` (cada capítulo terá o seu cartão e a sua fala de abertura, geradas por aqui).
