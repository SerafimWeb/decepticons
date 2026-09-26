# FICHAS DE DESIGN — CYBERMECH

> Uma ficha por robô e por arma: o que ele é, como se joga com ele e contra ele, a silhueta e os números.
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
| `leve.md` | robô leve (batedor) | prancha do dono, figuras 3 e 4 (`.tmp/arte/`) | a fazer (Codex) |
| `pesado.md` | robô pesado | prancha do dono, figuras 5 e 6 | a fazer (Codex) |
| `androide.md` | escala 1: rebelde, técnico e pilotado | o andróide de hoje | a fazer (Codex) |
| `plasma.md`, `foguetes.md`, `blaster.md`, `motosserra.md` | armas de hoje | `combat/weapons.ts` | a fazer (Codex, números copiados do código) |
