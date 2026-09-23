# IDENTITY — Cyber-Mech Protocol

> A alma do projeto: o quê, para quem, como fala, como parece.
> As regras técnicas ficam em `PROTOCOLO_UNIVERSAL.md`.

---

## 1. SOBRE O PROJETO

**Nome público:** Cyber-Mech Protocol
**Codinome interno:** DECEPTICONS (nome da pasta e da memória `.decepticons/`)
**Cliente:** projeto próprio
**Propósito:** shooter de Mechs multiplayer que roda no navegador, leve o bastante para muitos jogadores simultâneos em hardware comum.
**URL de produção:** nenhuma (sem deploy; ver `DEPLOY.md`)
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

| Papel | Cor |
|---|---|
| Fundo | `#06030d` |
| Primária (HUD, neon) | `#00e5ff` ciano |
| Secundária (títulos, grid) | `#ff2bd6` magenta |
| Destaque (dash pronto, barricadas, propulsores) | `#ff6a00` laranja |
| Apoio (subtítulo, prédios) | `#9a8cff` / `#9a5cff` violeta |

**Fonte:** monoespaçada do sistema (`Consolas`, `Courier New`), sem webfont para não pesar o carregamento.
**Render:** neon via bloom HDR (cores > 1.0 passam do limiar); geometria procedural com primitivas, sem assets externos por enquanto.

---

## 4. STACK

| Camada | Escolha |
|---|---|
| Build / dev | Vite 8 (Rolldown) |
| Linguagem | TypeScript 7 (`strict`) |
| Render | Three.js 0.186 (WebGL2, EffectComposer + UnrealBloom) |
| Física | Rapier3D 0.20 SIMD (Wasm): character controller cinemático |
| Servidor (planejado) | Colyseus em Node, rodando a mesma simulação a 60 Hz |
| Deploy | nenhum ainda |
| CI | hooks git locais (`.githooks/`) + GitHub Actions (`ci.yml`, ubuntu-24.04) em `Remoratrader/decepticons` (privado) |
| Node | `^20.19.0 \|\| >=22.12.0` (máquina de dev: 22.14) |

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
**Usuários e papéis:** hoje só o jogador local. Contas, papéis e persistência não existem.
**O que o projeto NÃO deve fazer:** exigir instalação, GPU dedicada ou download pesado antes de jogar.

---

## 6. RESTRIÇÕES

- **Performance primeiro:** toda feature (principalmente física) mantém CPU baixa com muitos jogadores. Custo de CPU explicado ao propor a feature.
- **Modular:** cada sistema é um módulo independente, ligado em `client/src/core/Game.ts`.
- **Budget de download:** JS ≤ 500 KB gzip, Wasm ≤ 900 KB gzip (verificado no `npm run check`).
- **Só o navegador:** nada de plugin, app nativo ou WebGPU obrigatório.

---

*IDENTITY.md v1.0 | Cyber-Mech Protocol | 2026-09-23*
