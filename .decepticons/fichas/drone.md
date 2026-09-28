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
- **Como entra na partida (dono, 27/09):** o **cenário ideal é o drone ser adição ao Mech** — não consome vaga de Mech nem de andróide; se não couber, conta como **uma unidade do time** (vaga de andróide)
- **Pilotagem (dono, 27/09):** os **dois modos** — pilotado pelo jogador **ou** piloto automático
- **Papel em uma frase:** um par extra de olhos, de tiros fracos ou de conserto, que voa, é **mais ágil que o andróide** e muda o ponto de vista da luta

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
| **Bateria (autonomia)** | `?` s de voo — proposta: 60 a 90 s | — | decisão do dono: **tem bateria, como drone de verdade** — não fica a partida inteira no ar |
| **Recarga** | pousar numa **plataforma no alto de um prédio** e esperar `?` s | — | ideia do dono: a recarga vira **ponto de disputa no alto** — e um motivo para a arena ter altura |

## 5. Armas e módulos de fábrica
- **DRONE-R:** nenhuma arma. Sensor: vê e, se aprovado, **compartilha a visão** com os aliados.
- **DRONE-A:** 1 blaster leve (o mesmo dos andróides).
- **DRONE-C:** nenhuma arma. Módulo de conserto de alcance curto.

## 6. Como o jogador comanda e como a IA usa
- **Comando (decidido pelo dono, 27/09):** o drone aceita **os dois modos** — **pilotado** (você voa) ou **piloto automático**
  (ele cumpre a função sozinho). A função é do drone: quem pilota não vira artilheiro.
- **Custo por modo (§ 8.2):** no automático, a trilha é pré-calculada no nascimento e o voo custa **~0 B/s**; no pilotado, o
  comando entra no canal de entrada e o estado vai no ritmo da unidade — a decisão de **quantos drones por partida** é que
  diz se cabe.
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
8. **"A bateria não permite a partida inteira no ar"** — o tempo total de voo é menor que a duração de uma partida.
9. **"Recarregar exige pousar numa plataforma elevada"** — no chão da arena não recarrega.

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
**Respondidas em 27/09:** (1) **os dois modos** — pilotado pelo jogador ou piloto automático; (4) tem **bateria** limitada e
recarrega pousando no alto de um prédio; e o cenário ideal é o drone ser **adição ao Mech**, não uma vaga a menos no time (§ 1).

**Em aberto:**
1. **Quantos** e **como entra** na partida: habilidade com recarga, item de partida ou escolha no Hangar?
2. O **DRONE-C conserta as partes** (como o técnico ENTRÓPICO) ou dá "vida" genérica? É metade ou o dobro do técnico?
3. **Abater um drone conta ponto** no placar (hoje o placar é por abate de Mech)?
4. O **reconhecimento compartilha a visão** com os aliados (marca inimigos no HUD deles) ou serve só para quem o solta?
5. **Bateria:** quantos segundos de voo e quanto tempo de recarga? A plataforma é **disputada** pelos dois times ou cada lado
   tem a sua?
6. **Bateria vazia:** o drone pousa sozinho (e pode ser recuperado) ou cai e é destruído?
7. **Piloto automático:** ele segue o dono, patrulha um perímetro ou vai para onde a função for melhor? E como o dono o
   chama de volta ou assume o controle no meio do voo?
