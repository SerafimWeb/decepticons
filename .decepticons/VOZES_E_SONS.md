# VOZES E SONS — o narrador, o `npm run vozes` e o que falta (P146)

> **Ordem do Comandante (15/10):** *"no ElevenLabs, principalmente os comandos e frases de início da partida, round 1, etc, killing frenzy, you die,
> esse tipo de coisa, com sotaque russo, chinês, inglês, brasileiro, etc, tipo uma boa voz de narrador do Mortal Kombat; os sons das armas, eu enviei
> diversos sons de referência"*. Antes: *"os SONS estão bem merdas ainda"*. **Estado:** o **narrador está no jogo** e as **4 vozes estão escolhidas**; só "combate" foi gerado nos 4 sotaques (os outros 72 clipes esperam um comando seu, § 2);
> os **sons de arma** (15 referências que ele largou em `.tmp/SOUNDS/ARMAS`) **já estão no jogo para 7 armas** (§ 3). Claude, 15/10.

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
   (`br`, `en`, `ru`, `cn`). As vozes de hoje, todas da **sua conta** (escolhidas pelo Claude em 15/10; troque quando quiser): **`br` Eliel** (brasileiro, grave e comandante: é o narrador que você escolheu em 14/10, P113, `y3X5…`), **`en` Chuck Miller** (americano, grave e rouco: o tom de narrador de luta), **`ru` Dracula** (sotaque russo, grave e sombrio) e **`cn` Adam** (robótico, mandarim de Pequim). Alternativas já listadas em `scripts/vozes.config.json`. **Sotaque sem voz é pulado.**
   *Dica de voz:* para o tom de narrador de luta, procure vozes graves e dramáticas ("deep", "narrator", "trailer"); o gerador já usa estabilidade baixa e estilo alto
   (`falas.json` > `estilos`), que dão a ênfase teatral.
3. **Ver o custo antes:** `npm run vozes -- --custo` (não gasta nada). O catálogo inteiro tem **menos de 500 caracteres por sotaque**: os quatro sotaques cabem folgados no plano grátis.
4. **Gerar:** `npm run vozes -- --gerar --sim` (sem o `--sim` ele só mostra o plano). Opções: `--sotaque ru,cn`, `--so combate,rodada_1`, `--refazer`. O que já existe **não é gerado de novo**
   (o crédito se gasta uma vez por frase); um teto de 3.000 caracteres barra acidente (`--max-caracteres N`).
5. **Ouvir:** abra o jogo com `?narrador=ru` (ou o sotaque que gerou), entre na partida e passe a rodada. Gostou? **Commite os `.mp3` e o manifesto** (a pasta `vozes/` já é liberada no `.gitignore`).

**Prefere gerar no site do ElevenLabs** (o estúdio de texto para voz)? Salve cada fala como `client/public/audio/vozes/<sotaque>/<chave>.mp3` (a chave é a do catálogo: `combate`, `rodada_1`, `abate_3`...) e rode
`npm run vozes -- --manifesto` para o jogo passar a conhecê-las.

## 3. Os sons das armas: o que entrou no jogo

As 15 referências chegaram em `.tmp/SOUNDS/ARMAS/` (efeitos gerados no ElevenLabs; o nome de cada arquivo é o pedido). **O Claude não ouve áudio**: decidiu pelo **nome** e pelo **perfil de energia** (medido de 26 em 26 ms: onde o som realmente
ataca e onde acaba). Os originais vêm muito quentes (pico em 0 dB) e com rabos de silêncio; alguns têm quase um segundo de quase-silêncio no começo (latência que um jogo não aguenta).

| Arma | Referência | Corte | Como toca |
|---|---|---|---|
| **Blaster** (e o padrão das armas de energia sem som próprio) | Single shot from futuristic | 0 a 0,62 s | ganho 0,8 |
| **Plasma** (0,22 s entre tiros) | Violent sharp plasma | 0 a 0,45 s (de 4 s: só o ataque) | ganho 0,8, no máximo 0,4 s |
| **Canhão pesado** | A massive M1 Abrams | 0 a 2,0 s | ganho 0,9 |
| **Canhão de cerco** | o mesmo estouro | — | **22% mais grave** (e mais longo): pesa mais |
| **Foguetes** (0,3 s entre disparos) | Missile launch sound | 0 a 0,9 s | ganho 0,75 |
| **Míssil teleguiado** | Radar-guided missile | 0 a 1,5 s | ganho 0,8 |
| **Chuva de mísseis** | Rocket launcher missile | 0,85 a 2,25 s (**sem o silêncio do começo**) | ganho 0,85 |

**Como funciona:** `npm run sons` lê `scripts/sons-armas.json` (qual referência, qual trecho), **apara, normaliza** (média -18 dB, pico -1 dBFS), converte para **mono em mp3** e grava em `client/public/audio/armas/` (85 KB no total). `AudioSystem.playArma(id)` toca a
amostra pela tabela `client/src/audio/armasSom.ts`; **arma sem amostra, ou com a amostra ainda carregando, cai no som sintetizado de sempre** (o jogo nunca fica mudo). Não precisa de chave nem gasta crédito.

**Para ouvir e decidir:** `npm run ouvir` abre uma página com um botão por arma (**NOVO** × **ANTES**, onde existia arquivo) e as 4 vozes do narrador, **e as referências que ficaram de fora**, com a sugestão de uso de cada uma.
Quem julga é o seu ouvido. Trocar um som é mudar `fonte`, `de` e `ate` no `scripts/sons-armas.json` e rodar `npm run sons` de novo.

**O que ficou de fora (de propósito):**
- **Rotatória (20 tiros por segundo) e canhão automático:** a referência "Short burst" é uma **rajada de 3 s**; tocá-la a cada tiro sobrepõe. Pede um **som em laço enquanto o gatilho está apertado** (o jogo já tem o laço sintetizado da rotatória): próximo PR.
- **Os dois sabres, os radares e os bipes:** o jogo **não tem arma de sabre** (o corpo a corpo é a motosserra) nem **aviso de míssil vindo** (o radar e o bipe seriam esse aviso). Ficam guardados para quando essas coisas existirem; a página os toca e sugere o uso.
- **Railgun, arco elétrico, gelo, sônico, lança-chamas:** seguem sintetizados.

O ElevenLabs também gera **efeitos por texto** (`/v1/sound-generation`): serve para as armas sem referência. **Decisão do Comandante** depois de ouvir: quais ficam, quais troca, e se quer efeito gerado para as que sobraram.

## 4. Custo

Nenhum por quadro nem por tick. Por fala: um teste de texto e uma consulta a um `Map`. Os clipes (~20 KB cada) são pedidos **uma vez, sob demanda, só do sotaque escolhido**, e só os que o manifesto lista.
O bundle ganha dois JSON pequenos (o catálogo e o manifesto).

## 5. Ligado a

`ORDENS_DO_COMANDO.md` P146 e P113 · `client/public/audio/README.md` (como entra um sample) · `PILOTOS_LLM_E_INTELIGENCIA.md` § 3-B (o rádio das IAs por LLM usaria esta mesma voz) ·
`CAMPANHAS_E_CHEFES.md` (cada capítulo terá o seu cartão e a sua fala de abertura, geradas por aqui).
