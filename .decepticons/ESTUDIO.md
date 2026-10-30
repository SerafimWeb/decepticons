# ESTÚDIO — a ferramenta local onde o Comandante edita o que o jogo toca e mostra (P150, P155)

> **Ordem do Comandante (16/10):** *"vamos evoluir mais essa interface do gerenciamento do som. Quero mais opções (eu enviar um novo som e ficar salvo e registrado corretamente como se tivesse sido adicionado por você); quero também aumentar ou diminuir o pitch e velocidade do som pra editar ele, além de poder cortar, esticar, comprimir, etc. Da mesma forma que temos a MESA pra editar vídeos, teremos também o ESTÚDIO pra editar os sons, e futuramente uma forma de editar os Mechs 3D, armas, tiros (cor, shape, cauda, explosão, força, etc)."*
> **Estado:** os módulos **SONS** (§ 2) e **VOZES** (§ 3.1) estão prontos. **TIROS E ARMAS** e **MECHS 3D** estão desenhados (§ 3.2 e § 3.3), não construídos. Claude, 16/10.

## 1. A ideia

A **Mesa** (`npm run mesa`) monta vídeo. O **Estúdio** (`npm run estudio`, ou dois cliques em `scripts\ligar-estudio.cmd`) edita **o que o jogo toca e mostra**. Os dois são **ferramentas locais**: só ligam neste PC, não vão para o site. A regra é a mesma da Mesa: o Comandante **ajusta com o olho e o ouvido**, o Estúdio **grava arquivos de dados**, e o **jogo lê esses arquivos**. O Claude não precisa estar no meio de cada ajuste de gosto, e os testes cobram só a **estrutura** (o que existe, o que está em faixa segura), **nunca o gosto**: nada que o Comandante escolher trava o `npm run check`.

Uma janela, abas: **SONS** · VOZES · TIROS E ARMAS · MECHS 3D. Cada aba é um **módulo**.

## 2. O que existe: o módulo SONS

| O quê | Como |
|---|---|
| **Cortar** | Arrastar na **onda**; as bordas se ajustam; "aparar silêncio" acha onde há som sozinho. |
| **Efeitos** (por clipe) | **Velocidade** (0,5× a 2×: estica ou comprime a duração) **ou duração alvo** (o campo calcula a velocidade); **tom** (±12 semitons, independente da velocidade, com o `rubberband` do ffmpeg); **graves** e **agudos** (dB); **passa-alta** e **passa-baixa** (Hz); **redução de ruído**; **saturação**; **compressor** (leve, médio, forte); **eco**; **tocar ao contrário**; **fade de entrada** e de saída. Há **predefinidos** (grave e pesado, agudo e estalado, metálico, eco de arena, rádio sujo, esmagado, mais curto e seco, mais longo e arrastado) como ponto de partida. |
| **Prévia** | "▶ Prévia" manda o clipe **como está na tela** (salvo ou não) para o servidor, que roda **o mesmo ffmpeg do arquivo final** (mesma cadeia, mesma normalização) e devolve o som, **sem gravar nada no jogo**. A onda do resultado aparece embaixo. |
| **No ritmo da arma** | "▶▶" repete o som no intervalo de tiro da arma escolhida (a rotatória a 0,05 s, o canhão a 2,6 s): é onde um som de arma falha (um tiro cobrindo o outro). |
| **Importar** | Arrastar um arquivo de áudio para a página (ou "importar som…"): ele é **guardado** em `.tmp/SOUNDS/ARMAS`, vira **um clipe com nome próprio** (`arma_<nome>`, único), com corte inicial, é **registrado** em `scripts/sons-armas.json`, **processado** (mp3 em `client/public/audio/armas/`) e **aberto na tela**, pronto para escolher numa arma. É exatamente o que o Claude faria à mão. Arquivo corrompido é recusado e não deixa lixo. |
| **Armas** | Uma tabela com **todas as armas do jogo** (lida do catálogo): qual **clipe** toca em cada uma (qualquer clipe em qualquer arma), **ganho**, **altura** (pitch da arma: menos = mais grave e mais longo) e **duração máxima**. Arma sem clipe usa o som sintetizado de sempre. O lança-chamas e a motosserra (som contínuo) ainda não aceitam amostra. |
| **Processar / Salvar** | "Salvar tudo" grava `scripts/sons-armas.json` (cortes e efeitos) e `client/src/audio/armasSom.json` (a tabela). "Processar" gera os mp3. Um painel avisa **o que ainda não foi para o jogo publicado** (lê o git) e o que dizer ao Claude: **"publica os sons"**. |

**Para o jogo:** depois de salvar e processar, `npm run dev` e atire; para ir ao site, **peça ao Claude para publicar** (o Estúdio não faz commit: o `ESTADO_ATUAL` e o `npm run check` são do fluxo do projeto, e um botão que os pulasse seria perigoso).

### Segurança (é um servidor de arquivos no PC do dono)

Escuta **só em 127.0.0.1**; recusa `Host` e `Origin` que não sejam o dele (contra DNS rebinding e página de fora); só lê e grava **arquivos de áudio com nome simples** nas pastas dos módulos; **valida tudo antes de gravar** (e grava de forma atômica); corpo com teto de tamanho; os scripts da página só são servidos da própria pasta do Estúdio. A guarda mora **uma vez** no núcleo (`scripts/estudio.mjs`) e vale para todos os módulos. As travas têm teste com mutação. O `git` que o Estúdio chama (as pendências) roda **sem as variáveis `GIT_*`** (`ambienteSemGit`): o hook de commit e o de push as herdam, e com elas o git ignora a pasta pedida. Quem escrever um teste que rode `git` faz o mesmo (e nunca usa `git config`: identidade por `-c`); ver `HISTORICO_DE_DECISOES.md`, 16/10.

## 3. Como o Estúdio cresce: o contrato de um módulo

**Um módulo = um arquivo de dados + um validador + uma prévia + um processador**, e três regras:

1. **Os dados são JSON no repositório**, lidos pelo jogo (no build) e escritos pelo Estúdio. Nada de estado escondido na ferramenta.
2. **Os testes cobram estrutura, não gosto** (ids que existem, valores em faixa segura, arquivos que o jogo carrega). O gosto é do Comandante e mora no dado.
3. **A prévia usa o mesmo código do jogo final** (a mesma cadeia de ffmpeg para o som; o mesmo desenho do Three.js para o tiro e o Mech), para o que se vê no Estúdio ser o que sai no jogo.

Tecnicamente: `scripts/estudio.mjs` é o núcleo (guarda, página, arquivos estáticos, `/api/estado`, `/api/pendencias`); cada módulo é `scripts/estudio/modulo-<id>.mjs` (exporta `{ id, titulo, estado(), rotas(ctx), pastasDoGit }`) com as rotas em `/api/<id>/...`, mais `scripts/estudio/<id>.js` para a aba. A onda, o áudio, as mensagens e o painel de pendências são do `nucleo.js` e valem para todas as abas.

### 3.1 VOZES (P151): pronto

A aba do narrador: as **19 falas × 4 sotaques**, cada uma marcada como **● gravada por você**, **◆ voz gerada (ElevenLabs)** ou **○ sem áudio**. **Gravar direto no navegador** (o microfone; em `127.0.0.1` é permitido): a fala aparece em letras grandes, com a **intenção** (grave e firme / grito curto e explosivo / seco e tenso), um **medidor de nível** que fica vermelho se estourar, e **parada automática em 10 s**. A gravação chega como webm sem duração (é o que o MediaRecorder entrega), o servidor a **converte para WAV mono 44,1 kHz** e a guarda como **tomada numerada** (`combate-1.wav`, `combate-2.wav`...) em `.tmp/SOUNDS/VOZ/<sotaque>/`; a tomada já abre **aparada** na onda. Dá para **importar** uma gravação feita fora (celular).

**O microfone (P286, 30/10):** acima do botão Gravar há a lista dos **microfones reais** (nunca a "Mixagem estéreo", que grava o som do computador), com a escolha **exata** lembrada neste navegador; **testar o microfone** mostra o nível em dB e diz em palavras (silêncio total / há sinal mas sem voz / bom / estourando); **procurar o que funciona** abre cada aparelho por 1,2 s e escolhe o que tem sinal; o **ganho** (×1 a ×8) serve ao fone Bluetooth, que é baixinho (o teste sugere o valor). Dois segundos de zero absoluto **param a gravação** e dizem o que fazer, e o servidor **recusa a tomada em silêncio total** (422). Por quê: em 30/10 o aparelho padrão do Windows era um ponto USB morto e a gravação saía muda sem aviso. As contas estão em `scripts/estudio/microfone.js` (testadas em `server/estudioMic.test.ts`).

O tratamento usa **os mesmos efeitos dos sons** (tom, graves, agudos, passa-alta e passa-baixa, **redução de ruído**, saturação, compressor, eco...) com cinco predefinidos de voz (**Locutor grave**, **Arena**, **Rádio de comando**, **Limpo**, **Demônio**) e a **mesma prévia com o motor real**. **"Salvar como a fala do jogo"** grava `scripts/vozes-gravadas.json` (de qual tomada, que trecho, que efeitos), processa o mp3 em `client/public/audio/vozes/<sotaque>/<chave>.mp3` (nível de voz: -16 dB de média) e põe a fala no manifesto `vozesGeradas.json`: **o jogo já a toca**, sem mais nada. A voz gerada pelo ElevenLabs que estava ali fica guardada em `_elevenlabs/` e **"Voltar para a voz gerada"** a devolve, byte a byte.

**A sua voz é protegida:** o `npm run vozes` (gerador do ElevenLabs) **nunca regera uma fala gravada por você**, nem com `--refazer` (e o resumo avisa quantas protegeu). Fica fora, de propósito: o botão do ElevenLabs "Voice Changer" (você grita e a voz do Eliel sai com a sua energia), que gasta crédito e fica com `npm run vozes`.

### 3.2 Depois: TIROS E ARMAS (a parte visual e de força)

O que já existe no jogo para apoiar: `fx/muzzleFx.ts` (o clarão da boca), `fx/impactFx.ts` (o impacto), `fx/particleShapes.ts` (as formas das partículas), o desenho dos projéteis em `combat/ProjectileSystem.ts`, as explosões em `fx/` e os **números** de cada arma em `combat/weapons.ts` (dano, intervalo, calor) com o equilíbrio em `combat/balance.ts` e `tuning/power.ts`. Hoje esses valores moram **no código**. O caminho:

1. **Tirar do código para um dado:** `client/src/fx/tirosVisuais.json` (por arma: **cor** do projétil e do clarão, **forma** e tamanho, **cauda** (comprimento, desbotar, cor), **explosão** (raio visual, partículas, cor, luz), **brilho**), lido pelo desenho existente. O jogo continua igual até o Comandante mexer.
2. **A aba:** uma **cena do Three.js** com um alvo e o Mech, a arma escolhida **atirando em laço** (o mesmo `ProjectileSystem`), e controles para cada campo, com a prévia ao vivo. "Salvar" grava o JSON.
3. **Os números de força** (dano, alcance, recarga, calor) ficam em **um painel à parte, com o relatório de equilíbrio do `balance.ts` ao lado**: o Estúdio mostra o que o ajuste faz com a meta de equilíbrio, e **a regra do jogo continua protegida por teste de simulação (G14)**. Mexer na força muda a **jogabilidade**: não é só gosto, então a validação aqui é a do `balance.ts`, e uma mudança de força vai com o **teste de simulação** que já existe.
4. **Custo de CPU:** só o que o jogo já paga hoje (os mesmos pools, G4/G5); o Estúdio roda fora do jogo.

### 3.3 Depois: MECHS 3D

O que já existe: `entities/chassis.ts` (os números dos chassis), `entities/meshKit.ts` (o desenho dos Mechs gerados) e o contrato dos robôs importados (`.glb`: `.decepticons/MECHS_IMPORTADOS.md`, `npm run mech:inspecionar`, `npm run mech:bocas`). O caminho: um **visualizador 3D** (o mesmo `Hangar` já monta e gira o robô) com **cores por parte**, **encaixes de arma** (a boca de cada encaixe é medida e conferida), escala e animação, gravando num dado por chassi. **Importar um `.glb` novo** pelo Estúdio passaria pelo `mech:inspecionar` (o contrato do arquivo) antes de entrar. Cada robô já custou uma sessão de correção por falta desse contrato: o Estúdio o torna automático.

## 4. Fora do Estúdio, de propósito

- **Publicar** (commit, PR, merge, site): fica com o fluxo do projeto (`npm run publicar`), que tem as travas (o `check`, o `ESTADO_ATUAL`, o painel público sem o codinome). O Estúdio mostra o que falta publicar e o que dizer.
- **Gastar crédito** (ElevenLabs): continua em `npm run vozes`, com o custo mostrado antes e a chave só em variável de ambiente. O Estúdio não guarda chave nenhuma.

## 5. Ligado a

`VOZES_E_SONS.md` (o catálogo, o narrador, as vozes) · `ORDENS_DO_COMANDO.md` P150, P151, P155 a P157 · `FERRAMENTAS.md` § 3 (a Mesa) · `STATUS_REAL.md` (o estado de cada coisa) · `client/public/audio/README.md` (como entra um som).
