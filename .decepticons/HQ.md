# GAME HQ — CYBERMECH

> **O mapa central do projeto.** Todas as informações do CYBERMECH têm um único endereço oficial. 
> Se não estiver mapeado aqui, não existe no jogo.

## 00 — Vision
*O que o jogo é, pilares fundamentais, quem é o público e qual a fantasia.*
- [Game Vision / One Pager](VISAO.md) — A constituição do jogo, pilares e regras inquebráveis.
- [Universo](UNIVERSO.md) — Ficção, fabricantes e facções que dão contexto à jogabilidade.

## 01 — Game Design Document (GDD)
*Regras, sistemas e loop de gameplay.*
- [Game Design](GAME_DESIGN.md) — Regras centrais, câmera, progressão.
- [Metagame](METAGAME.md) — Como o jogo retém e engaja (XP, créditos, missões diárias).
- [Diversão e Retenção](DIVERSAO.md) — Hipóteses de game design e ganchos de diversão.
- [Hangar e Customização](HANGAR.md) — Regras de montagem e loadout de Mechs.

## 02 — Technical (TDD)
*Arquitetura, protocolos, servidor e infraestrutura.*
- [Protocolo Universal (G1-G15)](PROTOCOLO_UNIVERSAL.md) — Regras de engenharia, ECS, simulação 60Hz.
- [Multiplayer](MULTIPLAYER.md) — Arquitetura de rede, client-side prediction, latência.
- [Deploy e Servidor](DEPLOY.md) — Como rodar o servidor oficial e automação.
- [Regras de Agentes](../AGENTS.md) / [Serafim 1](PROTOCOLO_SERAFIM_UM.md) — Como IAs codificam neste projeto.

## 03 — Art & Audio (Content Bible)
*Direção visual, identidade e catálogo implementável.*
- [Estilo dos Robôs](ESTILO_ROBOS.md) — Linguagem visual, texturas, formas e referências.
- **Fichas de Produto (Mini-PRDs):** Specs combinando visual, metas de balanceamento e status de asset:
  - **Mechs:** [Vector-09](fichas/vector-09.md) | [Modelos e Classes](fichas/MODELO_ROBO.md)
  - **Inimigos:** [Androides](fichas/androide.md) | [Drones](fichas/drone.md)
  - **Armas:** [Plasma](fichas/plasma.md) | [Foguetes](fichas/foguetes.md) | [Motosserra](fichas/motosserra.md) | [Blaster](fichas/blaster.md)

## 04 — Production
*Fila de trabalho, sprints, backlog e status.*
- [Estado Atual (Sprint/Kanban)](ESTADO_ATUAL.md) — O que está sendo feito, PRs abertos e histórico imediato.
- [Roadmap e Milestones](ROADMAP.md) — Para onde o projeto vai e próximas fases.
- [Ferramentas do Dono](FERRAMENTAS.md) — Mesa de gravação, automações auxiliares.

## 05 — Testing & Balance
*Feedback, testes de simulação e equilíbrio de metas.*
- [Status Real (Bug Tracker / Matrix)](STATUS_REAL.md) — Matriz da verdade sobre o que realmente funciona no build atual.
- **Specs Táticas:** Regras implementáveis de game modes [Ondas de Sobrevivência](fichas/ondas.md) | [Regras CTF](fichas/ctf.md).

## 06 — Decisions
*O porquê das coisas.*
- [Histórico de Decisões (Decision Log)](HISTORICO_DE_DECISOES.md) — Por que tal feature entrou ou saiu, e premissas técnicas adotadas.

---
> **Regra de Ouro:** Uma informação tem um único endereço oficial. O Miro pode ilustrar, o Figma desenhar e o GitHub executar, mas o **Game HQ aponta para tudo**.
