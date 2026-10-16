# Sons do jogo (samples) — CYBERMECH

O `AudioSystem` toca o sample quando ele existe e cai no gerador sintético quando não existe
(*fallback*). O fallback é silencioso do ponto de vista do erro: **se o arquivo faltar, o jogo não
reclama, só soa diferente** — foi o que aconteceu em 28/09, quando o código de carregamento entrou
na `main` sem os arquivos e o site ficou tocando os sons antigos.

## Duas coisas, sempre as duas

Para um sample tocar no site é preciso:

1. registrá-lo em **`client/src/core/Game.ts`** (`this.audio.loadSample('nome', base + 'audio/arquivo.ext')`);
2. liberá-lo no **`.gitignore` desta pasta** (`!arquivo.ext`).

A pasta ignora tudo por padrão porque é também a bancada onde a matéria-prima cai: arquivos brutos
do Elevenlabs com `#` e espaço no nome, versões descartadas, e uma vez um `.MOV` de 29 MB. Sem o
filtro, um `git add -A` levaria dezenas de MB para o repositório e para o deploy.

## O que está publicado hoje (11 samples, 2,2 MB)

| Nome no código | Arquivo | Onde toca |
|---|---|---|
| `logo_serafim` | `logo_serafim.mp3` | vinheta da marca, no primeiro clique |
| `ui_transition` | `ui_transition.mp3` | transição de tela |
| `ui_bass` | `ui_bass.mp3` | grave de interface |
| `ambient_bram` | `ambient_bram.mp3` | ambiência |
| `ambient_action` | `ambient_action.mp3` | ambiência de combate |
| `shot_plasma` | `shot_plasma.wav` | canhão de plasma |
| `shot_heavy` | `shot_heavy.mp3` | tiro pesado |
| `shot_futuristic` | `shot_futuristic.wav` | tiro do andróide |
| `hit` | `hit.mp3` | impacto na blindagem |
| `step_mech` | `step_mech.mp3` | passo do Mech |
| `step_heavy` | `step_heavy.mp3` | passo pesado |

Formatos: `.mp3` e `.wav`. **Nada de `#`, espaço ou parêntese no nome** — `#` numa URL é separador
de fragmento, e o `fetch` buscaria só o pedaço antes dele.

## Sons ainda sintetizados (sem sample)

Explosão, dash, pouso, foguetes, alarme de calor, motosserra, sirene de onda, bipe de contagem e
vinheta de onda limpa continuam vindo do gerador procedural do `AudioSystem`. Para trocar qualquer
um por sample, siga as duas etapas acima.

## As vozes do narrador (P146)

As falas ("Rodada um", "Combate!", "Killing frenzy!", "Você morreu"...) **não** entram por `loadSample`: ficam em `vozes/<sotaque>/<chave>.mp3` (`br`, `en`, `ru`, `cn`), são geradas por
`npm run vozes` (ElevenLabs) e o jogo só pede as que o manifesto `client/src/audio/vozesGeradas.json` lista (o gerador o reescreve). A pasta `vozes/` já está liberada no `.gitignore`.
Passo a passo, custo e a chave (só em variável de ambiente): `.decepticons/VOZES_E_SONS.md`.

## Os sons de arma (P146)

Ficam em `armas/` (`arma_blaster`, `arma_plasma`, `arma_canhao`, `arma_foguete`, `arma_teleguiado`, `arma_chuva`), são **preparados** por `npm run sons` (apara, normaliza e converte as referências do
Comandante que estão em `.tmp/SOUNDS/ARMAS`, conforme `scripts/sons-armas.json`) e tocados por `AudioSystem.playArma(id)` conforme a tabela de `client/src/audio/armasSom.ts`. Arma sem amostra, ou com a amostra ainda
carregando, cai no som sintetizado. Para **ouvir**: `npm run ouvir`. A pasta `armas/` já está liberada no `.gitignore`; as referências brutas **não** entram no repositório.
