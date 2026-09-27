# FICHA · MOTOSSERRA (`chainsaw`)

> **Status:** proposta · **Autor:** Codex · **Data:** 2026-09-27
> Números copiados de `client/src/combat/weapons.ts`; a lâmina é visual e não define alcance/hitbox.

## 1. Identidade
- **Tipo:** corpo a corpo; não dispara projétil.
- **Encaixe:** braço direito do rebelde/técnico quando aplicável; braço esquerdo do A-1 pilotável.
- **Papel:** punir Mech que deixa o andróide encostar, cortando as pernas.

## 2. Fantasia de jogo
- **Atacar é:** arriscar a aproximação para manter contato e aplicar cortes rítmicos.
- **Levar é:** perceber um inimigo pequeno colado às pernas e responder antes de ficar preso.
- **Contramedida:** manter distância, mirar no andróide e pisar nele se chegar perto.

## 3. Números do MK I

| Campo | Valor | Observação |
|---|---:|---|
| Dano | 4 | por corte |
| Intervalo / cortes por segundo | 0,20 s / 5 | corpo a corpo |
| Calor por corte | 1,2% | dissipador do A-1 |
| Alcance | 1,2 m | distância entre cápsulas; sem projétil |
| Explosão / carregador / recarga | — | não se aplica |
| Massa | 1,5 t | MK I |

## 4. Equilíbrio
- 20 de dano teórico por segundo; uma perna de Vector-09 (150 HP) leva ~7,5 s se todos os cortes acertarem.
- O alcance curto e o pisão de dois passos formam o contrajogo; conservar essas regras.

## 5. Visual (proposta Codex)
- **Modelo:** lâmina frontal longa integrada ao antebraço, motor no punho e dentes laranja, como em `Android.ts`.
- **Boca e efeito:** dentes com emissivo sodium; faíscas só no evento de impacto, reutilizando o pool de FX.
- **MK I / II / III:** I lâmina simples; II proteção do motor; III carcaça robusta com dentes mais luminosos. Não aumentar comprimento para não comunicar alcance maior.

## 6. Som (Gemini)
- Motor mecânico em loop enquanto ataca; cortes secos e graves no contato, com atenuação por distância.

## 7. Custo e riscos
- Sem projéteis ou raycast por quadro; o teste de contato segue no sistema corpo a corpo existente. Efeitos de impacto devem respeitar o pool global de 3000 partículas.

## 8. Perguntas para o dono
1. Quer a mesma lâmina para rebelde e piloto, ou uma versão visual industrial diferente para o jogador?
