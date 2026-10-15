# IDENTITY — CYBERMECH

> A alma do projeto: o quê, para quem, como fala, como parece.
> As regras técnicas ficam em `PROTOCOLO_UNIVERSAL.md`.

---

## 1. SOBRE O PROJETO

**Nome público:** CYBERMECH (até 25/09: "Cyber-Mech Protocol"; o dono tirou o "Protocol")
**Codinome interno:** DECEPTICONS (nome da pasta e da memória `.decepticons/`)
**Cliente:** projeto próprio
**Estúdio:** SERAFIM WEB. Marca discreta: vinheta de abertura (uma vez, pulável, nunca no meio do combate) e © na versão e nos rodapés. Arquivos em `client/public/brand/` (emblema de `serafim13/vetorserafim.png` e letreiro)
**Propósito:** shooter de Mechs multiplayer que roda no navegador, leve o bastante para muitos jogadores simultâneos em hardware comum.
**URL de produção:** `https://cybermech.online/` (jogo em `/jogar/`; ver `DEPLOY.md`)
**Início:** 2026-09-23

---

## 2. TOM E AUDIÊNCIA

**Audiência:** jogadores de PC no navegador, com mouse e teclado.
**Tom da UI:** tático, cyberpunk, estética de terminal. Rótulos curtos em MAIÚSCULAS, colchetes (`[ clique para jogar ]`), separador `//`.
**Idioma:** UI e comentários em pt-BR; identificadores de código em inglês.
**Proibido em qualquer material público:** "Decepticons", "Transformers" e nomes de personagens da franquia. São marcas da Hasbro, e o codinome é só interno.

---

## 3. IDENTIDADE VISUAL

Fonte canônica das cores de UI: variáveis em `client/src/styles.css`.

**Neon tático, multicolorido** (dono, 25/09: "verde neon, vermelho, pode usar diversas cores, só não fica apenas em azul e roxo"). Mundo 3D em `client/src/core/palette.ts`; interface nas variáveis do `styles.css`. O site do projeto segue no âmbar de terminal.

| Papel | Cor |
|---|---|
| Fundo | `#06080a` quase preto |
| Destaque (HUD, mira, tiro do jogador, título) | `#39ff6a` verde neon |
| Quente (fogo, foguetes, barricadas) | `#ff8a1f` laranja |
| Atenção | `#ffe14d` amarelo |
| Alerta (IAs rebeldes, dano, alvo na mira) | `#ff2d3d` vermelho |
| Texto claro | `#eef2e8` branco |
| Cidade (prédios, barricadas, horizonte), estilo Tron | ciano `#00e5ff`, pink `#ff2bd6`, amarelo fluorescente `#e8ff1a`, vermelho, verde, laranja; grade ciano; céu estrelado |
| Jogador | `#e0a21a` amarelo de perigo, visor verde |
| IAs rebeldes | `#8c1f22` vermelho escuro, visor vermelho |

**Leitura de combate acima de tudo:** verde é sempre do jogador e vermelho sempre das IAs; a cidade pode usar todas as cores. **Nunca só azul e roxo.** Nova cor entra primeiro no `palette.ts` / `:root`, nunca solta no código. **Em revisão (P131, 15/10):** o Comandante decidiu que **os times passam a ser identificados por cor** (vermelho, verde, azul, amarelo, branco e preto) e que **o vermelho deixa de ser o inimigo padrão** — a regra acima vale até esta ordem ser executada.

**Fonte:** monoespaçada do sistema (`Consolas`, `Courier New`). **Uma exceção (P135, 15/10):** o **título do jogo** usa a **Azonix** (`client/public/fonts/Azonix.otf`, 12 KB, só o `h1` do console) — o resto segue sem webfont para não pesar o carregamento.
**Render:** brilho via bloom HDR (cores > 1.0 passam do limiar); geometria procedural e Mechs GLB importados, conforme MECHS_IMPORTADOS.md.

---

## 4. STACK

| Camada | Escolha |
|---|---|
| Build / dev | Vite 8 (Rolldown) |
| Linguagem | TypeScript 7 (`strict`) |
| Render | Three.js 0.186 (WebGL2, EffectComposer + UnrealBloom) |
| Física | Rapier3D 0.20 SIMD (Wasm): character controller cinemático |
| Servidor | Node + ws, simulação autoritativa compartilhada a 60 Hz; snapshots a 20 Hz |
| Persistência | Contas em node:sqlite; métricas agregadas em JSON; progressão ainda no navegador |
| Deploy | site estático na Hostinger (`cybermech.online`) por rsync/SSH a cada merge na `main` |
| CI | hooks git locais (`.githooks/`) + GitHub Actions (`ci.yml`, ubuntu-24.04) em `SerafimWeb/decepticons` (privado) |
| Node | `>=22.12.0` (requisito de node:sqlite) |

---

## 5. CONTEXTO DE NEGÓCIO

**Modelo de receita:** DECIDIDO em 2026-09-23: combinar os modelos para viralizar, em etapas (link de sala → modo streamer/lives → portal com anúncio entre rodadas → cosméticos). Detalhe em `GAME_DESIGN.md`. Opções avaliadas:

| Opção | Precisa de | Encaixe |
|---|---|---|
| Portal de jogos web (CrazyGames, Poki etc.) com anúncios via SDK do portal | integrar o SDK e cumprir os requisitos do portal | **Recomendado para começar.** O portal hospeda o cliente e traz jogadores, que é o maior problema de um jogo multiplayer novo. Sem conta e sem pagamento. |
| Anúncios no próprio site | tráfego próprio | só se já houver audiência |
| Cosméticos (pintura, decalques, neon, efeitos de dash; nunca stats) | contas, persistência, pagamento, LGPD | **segundo passo**, quando a retenção justificar |
| Passe de temporada | cosméticos + ritmo de conteúdo | depois dos cosméticos |
| Jogo pago (itch.io/Steam) | wrapper desktop | ruim no começo: cobrar para entrar esvazia as salas |
| Apoio (Ko-fi, Patreon) | pouco | complemento, não modelo |

**Métrica de sucesso candidata:** o jogador volta no dia seguinte (retenção D1) e joga 3+ partidas na primeira sessão.
**Usuários e papéis:** jogador offline/online; cadastro e sessão por e-mail/senha no SQLite. Créditos/XP ainda no aparelho; sem papéis administrativos no jogo.
**O que o projeto NÃO deve fazer:** exigir instalação, GPU dedicada ou download pesado antes de jogar. **Nunca ser pay-to-win** (princípio do dono; ver `GAME_DESIGN.md`).

---

## 6. RESTRIÇÕES

- **Performance primeiro:** toda feature (principalmente física) mantém CPU baixa com muitos jogadores. Custo de CPU explicado ao propor a feature.
- **Modular:** cada sistema é um módulo independente, ligado em `client/src/core/Game.ts`.
- **Budget de download:** JS ≤ 500 KB gzip, Wasm ≤ 900 KB gzip (verificado no `npm run check`).
- **Só o navegador:** nada de plugin, app nativo ou WebGPU obrigatório.

---

*IDENTITY.md v1.1 | CYBERMECH | 2026-09-25*
