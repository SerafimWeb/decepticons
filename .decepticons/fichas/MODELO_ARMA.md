# FICHA · <ARMA>

> **Status:** rascunho | proposta | aprovada | no jogo · **Autor:** <agente> · **Data:** <AAAA-MM-DD>
> Copie para `fichas/<arma>.md`. Toda arma tem 3 níveis (MK I, II, III) pela mesma regra de `combat/weapons.ts`
> (`TIERS`): os números abaixo são do MK I.

## 1. Identidade
- **Nome e id:** <ex.: Canhão de plasma, `plasma`>
- **Tipo:** energia (tiro ilimitado, limitado pelo calor) | munição (carregador) | corpo a corpo
- **Encaixe:** braço direito | braço esquerdo | ombro | andróide
- **Papel em uma frase:**

## 2. Fantasia de jogo
- **Atirar é:** <a sensação>
- **Levar é:** <o que o alvo sente e como reage>
- **Contramedida:** <como se escapa dela>

## 3. Números do MK I (proposta; Claude confere e passa para `combat/weapons.ts`)

| Campo | Proposta | Referência: plasma MK I | Por quê |
|---|---|---|---|
| Dano por tiro (ou no centro da explosão) | | 16 | |
| Tiros por segundo | | 4,5 | |
| Calor por tiro (% do dissipador) | | 7% | |
| Velocidade do projétil (m/s) | | 140 | |
| Alcance ótimo / máximo (m) | | 60 / 200 | |
| Dano no alcance máximo (%) | | 40% | |
| Raio da explosão (m) | | 0 | |
| Carregador / recarga por tiro (s) | | 0 / 0 | |
| Massa (t) | | 3 | |

## 4. Metas de equilíbrio (cada uma vira um teste)
- **Tempo para derrubar o torso de um Vector-09 (300)** com todos os tiros no alvo: <faixa em s>
- Sozinha, nenhuma arma derruba um Mech em menos de 4,5 s; com a outra arma do Mech, em menos de 2,5 s.
- MK III derruba de 10% a 40% mais rápido que o MK I; o dano por tonelada cai a cada nível.

## 5. Visual (Codex)
- **Modelo no braço:** <forma, tamanho>
- **Projétil e boca:** <cor, rastro>
- **Diferença entre MK I, II e III:** <o que muda no modelo>

## 6. Som (Gemini)
- **Disparo, impacto, recarga:**

## 7. Custo de CPU e riscos
- <pool de projéteis, raycasts por tick, partículas>

## 8. Perguntas para o dono
1. <pergunta>
