# FICHA · VECTOR-09 (médio)

> **Status:** no jogo · **Autor:** Claude · **Data:** 2026-09-25
> Exemplo preenchido do `MODELO_ROBO.md`. Números de 25/09, lidos de `entities/chassis.ts` e da simulação de equilíbrio
> (`combat/balance.ts`); se divergirem, vale o código.

## 1. Identidade
- **Nome e código:** VECTOR-09
- **Escala:** 2 (Mech, 5,3 m)
- **Classe:** médio (assalto)
- **Lado:** os dois: é o Mech do jogador e o chassi que as IAs rebeldes tomaram (CLAWD, GEMINAI, CHAD-GPT)
- **Papel em uma frase:** o Mech de linha de frente: aguenta a troca de tiros, quebra cobertura e esmaga andróides.

## 2. Fantasia de jogo
- **Pilotar é:** sentir o peso: arranca e freia com inércia, cada passo treme a câmera. Administrar o calor: rajadas
  curtas e parar para esfriar rendem mais que correr com o gatilho apertado. Escolher onde atirar: a perna cai em 2 s,
  o torso em quase 6.
- **Enfrentar é:** ver um prédio andando: de andróide, ele ocupa a tela de baixo para cima e cada passo treme o chão.
- **O que só ele faz:** pisão: andando para cima de um andróide encostado, dois passos esmagam.
- **Fraqueza clara:** calor. Quem dispara tudo correndo trava por ~2 s sem pulo nem dash. E as pernas: sem as duas,
  ele para.

## 3. Silhueta e visual
- **Conceito de referência:** o modelo de hoje, feito por código (`entities/Vector09.ts`); a prancha do dono em
  `.tmp/arte/`, figuras 1 e 2, é a candidata para a nova versão
- **Silhueta em 3 palavras:** compacto, ombros largos, canhão à frente
- **Blueprint do kit de Mechs:** a preencher quando o kit existir (fila do Codex, item 1)
- **As 6 partes e as juntas estão visíveis?** sim; cada parte pode ser arrancada e cai como destroço
- **Encaixes:** plasma no braço direito, casulo de foguetes (4 tubos) no esquerdo; ombros livres para módulos
- **Paleta:** `playerPaint` (amarelo) no jogador, `enemyPaint` (vermelho escuro) nos rebeldes, visor verde ou vermelho
- **Orçamento:** 9 draw calls (PR #43)

## 4. Números

| Campo | Valor | Por quê |
|---|---|---|
| Altura / raio da cápsula (m) | 5,3 / 1,3 | três vezes a altura de um andróide |
| Velocidade (m/s) | 9 | dono, 25/09: "rápido demais para o peso" (era 12) |
| Aceleração no chão (m/s²) | 30 | ~0,3 s para arrancar e frear: inércia |
| Pulo (m/s) e pulos | 13, 2 | ~2,6 m por pulo |
| Dash: velocidade (m/s), duração (s), recarga (s) | 34, 0,18, 3 | escapa ~6 m |
| Vida: torso, cabeça, cada braço, cada perna | 300, 100, 120, 150 | a perna cai antes: mirar nela rende |
| Carga de armas (t) | 11 | MK III num braço obriga MK I no outro |
| Calor: resfriamento (/s), corrida (/s), pulo, dash | 0,7, 0,06, 0,03, 0,07 | 25/09: fôlego para lutar contra 3 |

## 5. Armas de fábrica
- **Braço direito:** canhão de plasma MK I
- **Braço esquerdo:** casulo de foguetes MK I
- **Carga usada:** 7 t de 11 t

## 6. Como a IA usa
- **Personalidades:** brabo (CLAWD), soldado (GEMINAI), fujão (CHAD-GPT); manso disponível nas configurações
- **Distância de ataque e distância mínima:** 38 m e 14 m (o brabo chega mais perto, o manso fica mais longe)
- **Comportamento especial:** ataca andando de lado em rajadas, recua avariado, para para esfriar e reveza o ataque
  com os outros (no máximo 2 atacando juntos)

## 7. Metas de equilíbrio (travadas por teste)
- O plasma MK I derruba o torso dele em 5 a 7,5 s (hoje 5,7 s; a perna, em 2,0 s).
- Nenhuma arma sozinha o derruba em menos de 4,5 s (hoje o mínimo é o plasma MK III: 4,6 s).
- Nenhum combo dos dois braços o derruba em menos de 2,5 s (hoje: MK I 3,1 s; MK III 2,6 s).
- Correr sozinho não ferve; rajadas longas andando fervem, parando na pausa não.
- Leva ~0,3 s para chegar na velocidade máxima; o andróide leva ~0,1 s.

## 8. Som
- **Passo:** batida grave e pesada a cada pé (`playStep`); o Gemini vai deixar mais grave e com variação
- **Tiro e dano:** disparo de plasma, lançamento de foguete, estalo de parte arrancada

## 9. Custo de CPU e riscos
- Character controller do Rapier por tick (só no Mech local, G6); animação procedural por quadro sem alocação.
- Risco: com o peso novo, o dono ainda não disse se ficou lento demais.

## 10. Perguntas para o dono
1. 9 m/s ficou bom, ou o Mech médio deve ser um pouco mais rápido quando existirem o leve e o pesado?
