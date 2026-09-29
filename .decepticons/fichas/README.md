# FICHAS DE DESIGN — CYBERMECH

> Uma ficha por robô, por arma **e por modo de jogo**: o que ele é, como se joga com ele e contra ele, a silhueta
> (ou o ritmo) e os números.
> É o documento que o dono aprova antes de qualquer coisa entrar no jogo. Modelos: `MODELO_ROBO.md` e `MODELO_ARMA.md`.
> Exemplo preenchido: `vector-09.md`.

## Como uma ficha anda

| Status | Quem | O que acontece |
|---|---|---|
| `rascunho` | qualquer agente | copiou o modelo e está preenchendo |
| `proposta` | quem preencheu | todas as seções preenchidas; abre PR só com a ficha (etiqueta `#mechs` ou `#combate`) |
| `aprovada` | **dono** | aprovou a ficha (ou pediu mudanças no PR) |
| `no jogo` | Claude (números e testes) + Codex (visual) + Gemini (som) | virou código, com as metas da seção "Metas de equilíbrio" travadas por teste |

## Quem preenche o quê

- **Codex:** identidade, fantasia, **silhueta e visual** (conceito de referência, blueprint do kit de Mechs, paleta,
  draw calls) e uma **proposta** para os números.
- **Claude:** confere os números na simulação (Oficina, varredura contra as regras de equilíbrio), escreve as metas que
  viram teste e passa para `entities/chassis.ts` e `combat/weapons.ts`.
- **Gemini:** a seção de som.
- **Dono:** aprova, e responde às perguntas do fim de cada ficha.

**Regra de ouro:** a ficha propõe, o código decide. Se o número da ficha e o do código divergirem, vale o código
(`entities/chassis.ts`, `combat/weapons.ts`), e a ficha é corrigida.

## Fichas a fazer

| Ficha | Tipo | Referência | Situação |
|---|---|---|---|
| `vector-09.md` | robô médio (jogador) | o Mech de hoje | ✅ exemplo preenchido |
| [`leve.md`](leve.md) | robô leve (batedor) | prancha do dono, figuras 3 e 4 (`.tmp/arte/`) | proposta Codex; stats de gameplay aguardam Claude e dono |
| [`pesado.md`](pesado.md) | máquina de cerco, escala 3 | Colossus-01, 14 m | visual Codex implementado; encontro, stats e som aguardam próximos PRs |
| [`androide.md`](androide.md) | escala 1: rebelde, técnico e pilotado | rig de `Android.ts` | proposta Codex; números copiados do código |
| [`plasma.md`](plasma.md), [`foguetes.md`](foguetes.md), [`blaster.md`](blaster.md), [`motosserra.md`](motosserra.md) | armas de hoje | `combat/weapons.ts` | propostas Codex; números copiados do código |
| [`drone.md`](drone.md) | escala 1, três classes por função: reconhecimento, ataque e conserto | decisão do dono de 27/09 (`METAGAME.md` § 8 e § 8.2) | proposta Qwen; **silhueta (Codex) e números (Claude) aguardam**; 6 perguntas abertas para o dono |
| [`ondas.md`](ondas.md) | **modo** sobrevivência: o balanço das ondas (quantidade, tipo e vida por onda) | declaração do dono de 27/09 (`ROADMAP.md`, Fase 5) | proposta Qwen; **a máquina de estados é do Claude** e o HUD, do Gemini; 7 perguntas abertas para o dono |
| [`ctf.md`](ctf.md) | **modo** CTF Vermelho × Azul: regras e **a especificação dos 15 testes** | decisão do dono no `ROADMAP.md` (Fase 5: 2v2, 3 capturas ou mais em 8 min) | proposta Qwen; **os `it()` nascem no PR da regra (Claude)**; 7 perguntas abertas para o dono |

As fichas marcadas como **proposta** não aprovam mudanças de gameplay. O Ferret-X e o Colossus-01 ainda não têm
stats/slots no código; decisões abertas nunca viram número implementado sem teste e aprovação.
