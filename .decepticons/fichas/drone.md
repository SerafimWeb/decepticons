# FICHA · DRONE TÁTICO (apoio, escala 1)

> **Status:** proposta · **Autor:** Qwen (a pedido do dono, da decisão de 27/09/2026) · **Data:** 2026-09-27
> Três classes, uma por função: **reconhecimento**, **ataque** e **recuperação**. O dono decide o papel e o escopo; os
> números de gameplay são do **Claude** (conferidos na simulação, com as metas da seção 7 travadas por teste); o visual é
> do **Codex**; o som e o HUD são do **Gemini**. Fonte: `METAGAME.md` § 8 (o papel) e § 8.2 (a banda).
> Onde eu não sei, está `?` — melhor uma pergunta do que um número inventado.

## 1. Identidade
- **Nome e código:** DRONE TÁTICO — `DRONE-R` (reconhecimento), `DRONE-A` (ataque), `DRONE-C` (conserto)
- **Escala:** 1 (humanoide, ~1,6 m), **com 1 a 2 m de largura** — do tamanho do andróide em silhueta, abaixo dele em massa
- **Classe:** apoio
- **Lado:** jogador; a IA rebelde pode usar a mesma classe depois (os dois)
- **Papel em uma frase:** um par extra de olhos, de tiros fracos ou de conserto, que voa e muda o ponto de vista da luta

## 2. Fantasia de jogo
- **Pilotar é:** estar acima da confusão — a arena vista de cima, o Mech pequeno lá embaixo. É a emoção que o dono pediu
  ("dar mais emoção e uma nova perspectiva de jogo"), não poder de fogo.
- **Enfrentar é:** um zumbido fininho no alto, fácil de ignorar por dez segundos — e caro se ignorar, porque ele vê o que
  você não vê (ou conserta o que você acabou de quebrar no Mech ali do lado).
- **O que só ele faz:** voar. Atirar de um ângulo que o Mech não alcança e consertar/olhar sem expor um Mech.
- **Fraqueza clara:** é **fraco e frágil** — o tiro dele é o do andróide e ele cai com um tiro de plasma. A contramedida
  que qualquer jogador aprende em uma partida é *olhar para cima*.

## 3. Silhueta e visual (Codex)
- **Conceito de referência:** `?` — não existe modelo de drone hoje (conferido; o Codex confirmou que a malha e os efeitos
  são dele). Falta a prancha do dono ou um rascunho do Codex.
- **Silhueta em 3 palavras:** `?` (proposta: pequeno, largo de hélices, sem pescoço)
- **Blueprint do kit** (números que montam o modelo):

| Parâmetro | Proposta | Por quê |
|---|---|---|
| Altura total (m) | 1,2 a 1,6 | escala do andróide, como o dono pediu |
| Largura × profundidade (m) | 1 a 2 × 0,8 | "1 a 2 metros de largura" (dono) |
| Sustentação | hélices ou turbinas (sem pernas) | é voador: a silhueta não pode lembrar um Mech |
| Corpo | uma peça (a "cabeça" com o sensor) | |
| Sensor/olho | visível de longe | é o reconhecível da classe |
| Antena / detalhe | `?` | |
| Draw calls (máx.) | 4 | pode haver vários em cena ao mesmo tempo |
| Triângulos | `?` | manter abaixo do andróide |
| Paleta | verde do jogador / vermelho das IAs (`core/palette.ts`) | mesma convenção do resto |

- **Partes arrancáveis:** **uma só** (o drone morre inteiro). É a diferença estrutural dele para o Mech: sem torso, braços e
  pernas para arrancar, sem barra por parte — o que também simplifica a rede (o registro leve da § 8.2 não carrega partes).

## 4. Números (proposta — o Claude confere na simulação e passa ao código)

| Campo | DRONE | Referência: ANDRÓIDE A-1 (do código) | Por quê |
|---|---|---|---|
| Altura / raio (m) | ? / ? | 1,6 / 0,36 | o drone é mais largo: o raio sai do tamanho da malha aprovada |
| Velocidade (m/s) | 12 `?` | 10,5 | voador e frágil: fugir é a defesa dele |
| Aceleração (m/s²) | ? | 120 | |
| Subida/descida (m/s) | ? | — | o eixo que o Mech não tem |
| Dash: velocidade, duração, recarga | sem dash `?` | 30 / 0,14 / 1,4 | dash em voador é difícil de ler |
| Vida | 18 `?` | torso 32 · cabeça 13 · braços 16 · pernas `?` | meta: **um tiro de plasma derruba** |
| Arma (DRONE-A) | **blaster leve** (o do andróide): dano 4, cadência 0,4 s, alcance ótimo 25 m, máximo 120 m | o mesmo blaster | decisão do dono: "o tiro dele é igual ao do andróide" |
| Conserto (DRONE-C) | ? /s | técnico ENTRÓPICO: `?` | |
| Calor | sem dissipador próprio `?` | dissipa 0,7/s | proposta: **pente/recarga** no lugar do calor |
| Autonomia de voo | ? | — | sem limite, um drone é vantagem permanente: precisa de um teto |

## 5. Armas e módulos de fábrica
- **DRONE-R:** nenhuma arma. Sensor: vê e, se aprovado, **compartilha a visão** com os aliados.
- **DRONE-A:** 1 blaster leve (o mesmo dos andróides).
- **DRONE-C:** nenhuma arma. Módulo de conserto de alcance curto.

## 6. Como o jogador comanda e como a IA usa
- **Comando (proposta):** uma tecla de função solta/traz o drone; a **função é do drone**, não do jogador — quem pilota não
  vira artilheiro.
- **Trilha:** pré-calculada no nascimento (patrulha) — é o que faz o drone custar ~0 B/s em voo (§ 8.2). Voo livre só se o
  dono escolher drone **pilotado** (aí o custo sobe, ver § 10).
- **Determinismo (G2):** trilha e escolha de alvo com `rng.ts`, nunca `Math.random`; nada de DOM na simulação (G1/G2).
- **IA (se a IA usar drones):** prioridade de alvo pelo que já está ferido (`METAGAME.md` § 8, vindo do STERM).

## 7. Metas de equilíbrio (cada uma vira um teste)
1. **"Um tiro de plasma MK I derruba um drone."** (fragilidade é a contramedida)
2. **"Um DRONE-A sozinho não causa mais dano por segundo que um andróide rebelde."** (teto do blaster: 10/s)
3. **"Um DRONE-A sozinho não derruba um Vector-09 em menos de 25 s."** (o drone não decide partida)
4. **"Um DRONE-C não conserta mais rápido que o técnico ENTRÓPICO."** `?` (o técnico como teto)
5. **"Oito drones na sala cabem no orçamento de banda"** — é o teste de infraestrutura da § 8.2 (10 bytes a 5 Hz).
6. **"O drone é determinístico: mesma semente, mesmo trajeto."** (a trilha é pré-calculada)
7. **"Um drone não marca inimigo atrás de parede."** (só vale se o reconhecimento compartilhar visão)

## 8. Som (Gemini)
- **Voo:** zumbido contínuo, mais agudo perto e mais grave longe (dá a dica de posição que o jogador precisa).
- **Tiro:** o do blaster, mais fino.
- **Dano e queda:** estalo curto + silêncio (avisar que o drone caiu importa mais que o som em si).

## 9. Custo de CPU e riscos
- **Banda:** 10 bytes a 5 Hz = **60 B/s por drone**; 8 drones = **480 B/s** — a sala vai de 6,2 para 6,7 KB/s de 8,0 (83%).
  Com trilha pré-calculada, ~0 B/s em voo. **Um drone pilotado a 20 Hz e um por jogador não cabe** (3,6 KB/s).
- **CPU:** o custo real é o **desvio de obstáculo** (raycast no Rapier por drone); medir com a sala cheia antes de fixar
  quantos drones por partida. Sem alocação por tick (pools, vetores pré-alocados — G4).
- **Render:** malha pequena, mas oito delas viram draw calls: manter o teto da seção 3.
- **Risco de design:** enxame dominando a partida (mitigado por fragilidade + autonomia) e a "punição de olhar para cima"
  (quem pilota drone perde a noção do chão) — é o que faz a classe ser tática e não obrigatória.

## 10. Perguntas para o dono
1. O drone é **pilotado por você** (você voa) ou **automático** (segue você e cumpre a função)? Isso decide o custo: o
   pilotado a 20 Hz custa 456 B/s (não cabe um por jogador); o automático com trilha pré-calculada custa quase zero.
2. **Quantos** e **como entra** na partida: habilidade com recarga, item de partida ou escolha no Hangar?
3. O **DRONE-C conserta as partes** (como o técnico ENTRÓPICO) ou dá "vida" genérica? E ele é metade ou o dobro do técnico?
4. O drone tem **autonomia** (bateria/tempo de voo) ou voa a partida toda?
5. **Abater um drone conta ponto** no placar (hoje o placar é por abate de Mech)?
6. O **reconhecimento compartilha a visão** com os aliados (marca inimigos no HUD deles) ou serve só para quem o solta?
