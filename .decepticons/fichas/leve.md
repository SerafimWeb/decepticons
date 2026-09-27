# FICHA · FERRET-X (leve)

> **Status:** proposta · **Autor:** Codex · **Data:** 2026-09-27
> Proposta visual baseada em `entities/mechBlueprint.ts`; Ferret-X ainda não é um chassi jogável. Números de gameplay permanecem `?` até Claude simular e o dono aprovar.

## 1. Identidade
- **Nome e código:** FERRET-X (`ferret` no blueprint)
- **Escala:** 2, ~4,5 m de referência visual
- **Classe:** leve, batedor
- **Lado:** IA rebelde; candidatura futura ao Hangar
- **Papel em uma frase:** reconhecer, flanquear e sair antes que o Mech pesado consiga alinhar o tiro.

## 2. Fantasia de jogo
- **Pilotar é:** rápido e responsivo; usar pernas longas e dash para trocar de ângulo; escolher quando entrar no alcance curto.
- **Enfrentar é:** acompanhar uma silhueta estreita que muda de direção depressa, mas cai quando exposta.
- **O que só ele faz:** explorar e reocupar posições com rapidez (proposta de papel, sem habilidade exclusiva definida).
- **Fraqueza clara:** pouca blindagem e menor tolerância a troca frontal; proposta a validar em teste.

## 3. Silhueta e visual (Codex)
- **Conceito de referência:** `.tmp/arte/` — figuras 3 e 4 da prancha do dono; blueprint atual deriva a silhueta, a confirmar no playtest.
- **Silhueta em 3 palavras:** estreito, alto, digitígrado.
- **Blueprint do kit de Mechs:** `LIGHT_MECH_BLUEPRINT` (`mechBlueprint.ts`).

| Parâmetro | Valor |
|---|---|
| Altura total de referência | 4,5 m |
| Torso | 1,28 × 1,03 × 0,94 m |
| Pernas | digitígradas; coxa 0,39 m de largura, segmentos 0,92 / 1,08 m |
| Ombreiras | estreitas, 0,56 × 0,55 × 0,62 m |
| Cabeça | sensor compacto 0,56 × 0,43 × 0,56 m; antena 0,24 m |
| Respiros | 3 por lado, distribuídos no torso |
| Detalhe de silhueta | mochila estreita; pés alongados |

- **As 6 partes e juntas estão visíveis?** sim no rig gerado; conferir leitura da cabeça e das juntas na captura de jogo.
- **Encaixes:** não definidos no contrato de chassi atual; não assumir armas exclusivas antes da aprovação.
- **Paleta:** rebelde `enemyPaint` / visor vermelho; jogador, se aprovado, `playerPaint` / visor verde.
- **Orçamento:** 9 malhas combinadas por pivô (até 10 draw calls); sem textura externa.

## 4. Números (proposta; Claude valida)

| Campo | Proposta | Referência Vector-09 | Por quê |
|---|---:|---:|---|
| Altura / raio da cápsula | ? | 5,3 / 1,3 m | Blueprint visual não define colisor |
| Velocidade | ? | 9 m/s | Evitar criar vantagem sem teste |
| Aceleração no chão | ? | 30 m/s² | Depende da sensação desejada |
| Pulo / quantidade | ? | 13 m/s, 2 | Não inferir da silhueta |
| Dash | ? | 34 m/s, 0,18 s, recarga 3 s | Precisa entrar no balanço da classe |
| Vida (torso/cabeça/braços/pernas) | ? | 300/100/120/150 | Perfil de sobrevivência requer metas |
| Carga / calor | ? | 11 t; resfriamento 0,7/s | Contrato e balanceamento ainda não existem |

## 5. Armas de fábrica
- **Braços:** ? (slots não definidos para `ferret` em `ARM_SLOTS`).
- **Carga usada:** ? de ?.

## 6. Como a IA usa
- **Personalidades possíveis:** soldado ou fujão são candidatas; escolha final de Claude.
- **Distância de ataque / mínima:** ?.
- **Comportamento especial:** flanqueio é fantasia, não comportamento implementado; exige teste de simulação próprio.

## 7. Metas de equilíbrio
- Sobrevive menos que o Vector-09 à troca frontal, mas tem rota de fuga clara.
- Não vence por velocidade sem custo: medir taxa de sobrevivência, dano causado e tempo exposto por classe.
- Claude define valores e testes antes de entrar em `chassis.ts`.

## 8. Som (Gemini)
- **Passos:** metálicos e rápidos, menos graves que o Mech médio.
- **Tiro e dano:** dependem da arma aprovada.

## 9. Custo de CPU e riscos
- O blueprint gera geometria na criação; 9 malhas por rig, sem malha nova por frame. IA, física e rede dependem da futura implementação de gameplay.
- Risco: silhueta alta/estreita pode não comunicar blindagem leve à distância; verificar em preto e em escala de jogo.

## 10. Perguntas para o dono
1. O Ferret-X será jogável desde o primeiro lançamento ou só inimigo?
2. Aprova a silhueta digitígrada como batedor? Quais figuras da prancha devem guiar o modelo final?
3. Qual papel ou contrapartida deseja em relação ao Vector-09?
