# FICHA · ANDRÓIDE A-1 (escala 1)

> **Status:** proposta · **Autor:** Codex · **Data:** 2026-09-27
> Ficha visual/documental das variantes que já usam o rig `Android.ts`. Os valores diferem entre rebelde e piloto; vale a tabela de `chassis.ts`.

## 1. Identidade
- **Nome e código:** ANDRÓIDE A-1 (`android` para piloto; inimigo de combate e técnico usam o corpo base)
- **Escala:** 1, humanoide, 1,6 m
- **Classe:** leve / apoio (técnico)
- **Lado:** IA rebelde e jogador no Hangar
- **Papel em uma frase:** unidade pequena que pressiona de perto; a variante técnica repara Mechs aliados.

## 2. Fantasia de jogo
- **Pilotar é:** movimentar-se depressa, usar a escala humana para escapar e aproximar-se para a motosserra.
- **Enfrentar é:** rastrear um alvo pequeno que tenta entrar nas pernas do Mech.
- **O que só ele faz:** cortar pernas a curta distância; o técnico conserta Mechs em vez de atacar.
- **Fraqueza clara:** pouco alcance e baixa resistência (o piloto tem mais vida que a variante rebelde).

## 3. Silhueta e visual (Codex)
- **Conceito de referência:** modelo atual em `entities/Android.ts`.
- **Silhueta em 3 palavras:** humanoide, estreito, ágil.
- **Blueprint:** rig próprio em `Android.ts`, escala por `stats.height / MODEL_HEIGHT`.
- **Formas:** casco claro de torso e cabeça; braços finos; mochila de baterias; faixa luminosa no visor; ferramenta/canônico/motosserra no antebraço. As juntas de cabeça, torso, braços e pernas correspondem às seis partes da simulação.
- **Paleta:** rebelde vermelho (`PALETTE.signal` no visor); técnico amarelo; piloto visor verde. Casco `PALETTE.bone`.
- **Armas:** rebelde de combate leva motosserra; técnico, ferramenta de reparo; piloto, blaster direito e motosserra esquerda.
- **Orçamento:** 9 draw calls por unidade, conforme `STATUS_REAL.md`; peças combinadas por pivô e destacáveis.

## 4. Números existentes (não são uma nova proposta)

| Campo | Rebelde / técnico | Piloto | Origem |
|---|---:|---:|---|
| Altura / raio | 1,6 / 0,36 m | 1,6 / 0,36 m | `ANDROID_STATS` / `PILOT_ANDROID_STATS` |
| Velocidade / aceleração no chão | 10,5 m/s / 120 m/s² | igual | `chassis.ts` |
| Pulo / quantidade | 10 m/s, 2 | igual | `chassis.ts` |
| Dash | 30 m/s, 0,14 s, recarga 1,4 s | igual | `chassis.ts` |
| Vida: torso, cabeça, braços, pernas | 32, 13, 16, 19 | 96, 40, 48, 57 | `chassis.ts` |
| Carga | 1,5 t | 3 t | `chassis.ts` |
| Calor: resfria / corre / pulo / dash | 0,7/s / 0,08/s / 0,02 / 0,05 | igual | `chassis.ts` |

## 5. Armas de fábrica
- **Rebelde:** motosserra no braço direito; arma curta descrita em `weapons.ts`.
- **Técnico:** ferramenta de reparo; não é arma de combate.
- **Piloto:** blaster MK I à direita e motosserra MK I à esquerda; carga de 2 t de 3 t.

## 6. Como a IA usa
- **Personalidades:** rebelde de combate e técnico de suporte.
- **Distância de ataque / mínima:** motosserra: contato entre cápsulas, até 1,2 m; o técnico aproxima-se para reparar.
- **Comportamento especial:** o combate tenta grudar e circular; o técnico repara e foge. Ver `BotController.ts` e `RepairSystem` para comportamento real.

## 7. Metas de equilíbrio (existentes)
- O blaster deve permanecer uma ameaça fraca contra blindagem de Mech: a oficina estima 36 s de fogo perfeito contra torso de 300 HP.
- A motosserra só corta encostado; seu alcance de regra é 1,2 m.
- Um Mech pelo menos duas vezes mais alto pode esmagar um andróide em dois pisões, conforme os testes de combate.

## 8. Som (Gemini)
- **Passo:** leve, curto, agudo/metálico; menos grave que o Mech.
- **Tiro e dano:** blaster curto; serra contínua/cortes; técnico com sinal de reparo.

## 9. Custo de CPU e riscos
- Mesmo character controller local; os remotos são interpolados. O corpo usa 9 draw calls. Alvo pequeno exige que a câmera e a mira assistida não deem vantagem indevida.

## 10. Perguntas para o dono
1. Aprova que o A-1 pilotável mantenha o casco claro enquanto o visor distingue verde, vermelho e amarelo?
2. A motosserra deve manter a lâmina longa atual ou parecer ferramenta industrial mais pesada?
