# FICHA · COLOSSUS-01 (pesado)

> **Status:** proposta · **Autor:** Codex · **Data:** 2026-09-27
> Proposta visual baseada em `entities/mechBlueprint.ts`; não é chassi jogável. Stats e armas ficam pendentes de simulação e aprovação.

## 1. Identidade
- **Nome e código:** COLOSSUS-01 (`colossus` no blueprint)
- **Escala:** 2, ~6,5 m de referência visual (a escala 3, cerco, é uma decisão separada).
- **Classe:** pesado
- **Lado:** IA rebelde; candidatura futura ao Hangar
- **Papel em uma frase:** avançar sob fogo, sustentar a linha e abrir espaço para aliados.

## 2. Fantasia de jogo
- **Pilotar é:** comandar massa, antecipar curvas e escolher o momento de avançar; cada troca de direção deve parecer deliberada.
- **Enfrentar é:** ver um casco largo aproximar-se, buscar flanco e atingir as pernas ou outra fraqueza validada.
- **O que só ele faz:** manter presença na linha de frente (sem habilidade exclusiva proposta).
- **Fraqueza clara:** silhueta grande, aceleração e reposicionamento ainda por definir; deve haver resposta para jogadores leves.

## 3. Silhueta e visual (Codex)
- **Conceito de referência:** `.tmp/arte/` — figuras 5 e 6 da prancha do dono; correspondência visual a validar.
- **Silhueta em 3 palavras:** largo, blindado, compacto.
- **Blueprint:** `HEAVY_MECH_BLUEPRINT` (`mechBlueprint.ts`).

| Parâmetro | Valor |
|---|---|
| Altura de referência | 6,5 m |
| Torso | 2,62 × 1,72 × 1,88 m |
| Pernas | retas/compactas; coxa 0,76 m; segmentos 1,34 / 1,28 m |
| Ombreiras | grandes, 1,04 × 0,88 × 1,08 m |
| Cabeça | baixa, 0,86 × 0,58 × 0,88 m; antena curta de 0,08 m |
| Respiros | 4 por lado |
| Detalhe de silhueta | mochila larga (1,42 × 1,04 × 0,78 m) e pés de 1,42 m |

- **As 6 partes e juntas estão visíveis?** sim no rig por pivôs; conferir leitura da cabeça sob ombros largos.
- **Encaixes:** não há slots definidos para `colossus`; layout do braço esquerdo no blueprint é visual genérico, não arma aprovada.
- **Paleta:** `enemyPaint` / vermelho para IA; `playerPaint` / verde para eventual jogador.
- **Orçamento:** 9 malhas por pivô, até 10 draw calls; sem textura externa.

## 4. Números (proposta; Claude valida)

| Campo | Proposta | Referência Vector-09 | Por quê |
|---|---:|---:|---|
| Altura / raio da cápsula | ? | 5,3 / 1,3 m | A altura visual não define colisão |
| Velocidade / aceleração | ? | 9 m/s / 30 m/s² | Peso deve ser sentido sem tornar o alvo imóvel |
| Pulo / quantidade | ? | 13 m/s, 2 | Mobilidade é escolha de classe |
| Dash | ? | 34 m/s, 0,18 s, recarga 3 s | Necessário avaliar contrajogo |
| Vida por parte | ? | 300/100/120/150 | Não extrapolar vida só pela escala |
| Carga / dissipação | ? | 11 t / 0,7 por s | Armas e carga ainda sem contrato para o chassi |

## 5. Armas de fábrica
- **Braço direito / esquerdo:** ?; encaixes ainda não definidos.
- **Carga usada:** ? de ?.

## 6. Como a IA usa
- **Personalidades possíveis:** soldado ou brabo, a decidir por Claude.
- **Distância de ataque / mínima:** ?.
- **Comportamento especial:** pressionar a linha é intenção de design, não regra implementada.

## 7. Metas de equilíbrio
- A vantagem de blindagem deve custar mobilidade, carga ou outra oportunidade identificável.
- Nenhuma arma ou combo pode ultrapassar os limites já travados em `combat/balance.ts`.
- Claude define metas mensuráveis e testes antes de criar o chassi.

## 8. Som (Gemini)
- **Passos:** lentos, graves e distintos do Vector-09.
- **Tiro e dano:** dependem do arsenal aprovado.

## 9. Custo de CPU e riscos
- Geometria procedural combinada ao construir o rig; sem custo adicional por frame além do rig atual.
- Risco: proporções grandes podem ocultar o horizonte, estourar hitboxes ou reduzir FPS; medir draw calls, triângulos, câmera e legibilidade.

## 10. Perguntas para o dono
1. Colossus-01 é Mech pesado de ~6,5 m ou máquina de cerco de escala 3?
2. Qual arma ou papel deve ser sua assinatura visual?
3. Aprova as figuras 5 e 6 como referência principal?
