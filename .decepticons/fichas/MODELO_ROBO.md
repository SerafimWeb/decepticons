# FICHA · <NOME> (<classe>)

> **Status:** rascunho | proposta | aprovada | no jogo · **Autor:** <agente> · **Data:** <AAAA-MM-DD>
> Copie este arquivo para `fichas/<nome>.md`. Números com unidade (m, m/s, s, t). Onde não souber, escreva "?" e
> ponha a dúvida na última seção: melhor uma pergunta do que um número inventado.

## 1. Identidade
- **Nome e código:** <ex.: VECTOR-09>
- **Escala:** 1 (humanoide, ~1,6 m) | 2 (Mech, ~5 m) | 3 (cerco)
- **Classe:** leve | médio | pesado | apoio
- **Lado:** jogador (Hangar) | IA rebelde | os dois
- **Papel em uma frase:** <o que ele faz na luta>

## 2. Fantasia de jogo
- **Pilotar é:** <3 frases: a sensação>
- **Enfrentar é:** <o que o outro jogador sente>
- **O que só ele faz:** <uma coisa>
- **Fraqueza clara:** <a contramedida que qualquer jogador aprende>

## 3. Silhueta e visual (Codex)
- **Conceito de referência:** `.tmp/arte/<arquivo>`, figura <n>
- **Silhueta em 3 palavras:** <ex.: largo, curvado, pernas dobradas>
- **Blueprint do kit de Mechs** (números que montam o modelo):

| Parâmetro | Valor |
|---|---|
| Altura total (m) | |
| Largura × profundidade do torso (m) | |
| Pernas | reta / dobrada; comprimento coxa e canela (m) |
| Ombreiras | nenhuma / pequena / grande |
| Cabeça | tipo e tamanho |
| Respiros de calor | onde, quantos |
| Antena / detalhe de silhueta | |

- **As 6 partes e as juntas estão visíveis?** sim / não (cabeça, torso, braços, pernas: cada uma pode ser arrancada)
- **Encaixes:** braço direito (energia), braço esquerdo (munição), ombros (módulos)
- **Paleta:** nomes do `core/palette.ts` (verde é do jogador, vermelho das IAs)
- **Orçamento:** draw calls (máximo 10), triângulos

## 4. Números (proposta; Claude confere e passa para `entities/chassis.ts`)

| Campo | Proposta | Referência: Vector-09 | Por quê |
|---|---|---|---|
| Altura / raio da cápsula (m) | | 5,3 / 1,3 | |
| Velocidade (m/s) | | 9 | |
| Aceleração no chão (m/s²) | | 30 | |
| Pulo (m/s) e pulos | | 13, 2 | |
| Dash: velocidade (m/s), duração (s), recarga (s) | | 34, 0,18, 3 | |
| Vida: torso, cabeça, cada braço, cada perna | | 300, 100, 120, 150 | |
| Carga de armas (t) | | 11 | |
| Calor: resfriamento (/s), corrida (/s), pulo, dash | | 0,7, 0,06, 0,03, 0,07 | |

## 5. Armas de fábrica
- **Braço direito:** <arma, nível>
- **Braço esquerdo:** <arma, nível>
- **Carga usada:** <t> de <t>

## 6. Como a IA usa (se for bot)
- **Personalidades possíveis:** brabo | manso | fujão | soldado | outra (descreva)
- **Distância de ataque e distância mínima (m):**
- **Comportamento especial:**

## 7. Metas de equilíbrio (cada uma vira um teste)
- <ex.: "o plasma MK I derruba o torso dele em 4 a 6 s">
- <ex.: "corre mais que o Vector-09, mas cai com metade dos tiros">
- <ex.: "nenhum combo dele derruba um Vector-09 em menos de 2,5 s">

## 8. Som (Gemini)
- **Passo:** <grave, pesado, metálico...>
- **Tiro e dano:**

## 9. Custo de CPU e riscos
- <o que ele custa a mais por tick ou por quadro; o que pode dar errado>

## 10. Perguntas para o dono
1. <pergunta>
