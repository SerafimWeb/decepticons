# BENCHMARK — o CYBERMECH contra as seis referências de mech

> **Pedido do Comandante (15/10/2026, ordem P129):** *"pegue essa orientação para fazermos um benchmark antes de
> lançarmos nosso game"*. A orientação é o mapeamento de **seis concorrentes/referências do gênero** que ele trouxe
> do chat (o `benchmark_cybermech.json` e a matriz), cobrindo plataforma, sensação de massa, loop de combate,
> dores do jogador e as lacunas de mercado.
> **Como ler (a regra que dá valor a este documento):** o mapeamento do Comandante é a **pauta** — o que o mercado
> faz. A coluna do **CYBERMECH é o estado real** (`STATUS_REAL.md` e o código, R13), não a intenção. Onde o
> mapeamento descreve o nosso jogo como se já fosse o alvo, este documento **separa o que existe do que é
> promessa** — porque publicar promessa como fato é exatamente a mentira que o protocolo proíbe (R13, regra 14).
> Escrito por **Qwen**, 2026-10-15. **Nenhuma linha de jogo mudou neste PR:** é medição e posicionamento.

---

## 0. A resposta curta

1. **Onde ganhamos de todos os seis:** entrar **sem instalar** (navegador), **sem pay-to-win**, e com a
   **profundidade de combate** que só o MechWarrior tem (calor crítico, dano por parte, 10 chassis) — num pacote que
   abre em segundos. É o cruzamento que ninguém do gênero ocupa: **profundidade de simulador, fricção de site.**
2. **Onde perdemos (e o mapeamento aponta certo):** **não temos rotação independente de torso e pernas** — a
   "divisória de águas" que o próprio mapeamento cita entre jogo genérico e jogo respeitado —, e **não temos o
   número de GPU numa máquina fraca**, que é justamente o que a promessa "roda em qualquer navegador" depende.
3. **O número que falta é um só, e é medível hoje:** o **tempo de quadro numa GPU integrada** (p50/p95). É a
   pendência de R13 que se repete em cada entrega visual (`PRAIA.md`, `BUNKER.md`, `REFERENCIA_VISUAL.md` § 7.2,
   etapa A). Sem ele, o benchmark técnico fica pela metade.
4. **O gargalo do lançamento não é técnico, é de gente:** o placar do `ORDENS_DO_COMANDO.md` § 6 registra
   **"na internet, nenhum teste com gente"**. Um benchmark não enche sala; o caminho do vídeo/itch.io/portal é que
   enche (decisão já tomada pelo Comandante, P47).

---

## 1. O alvo — o que o CYBERMECH se propõe a ser

Extraído de `IDENTITY.md` § 1/§ 4/§ 6 e `VISAO.md` (não é invenção deste documento):

| Eixo | Alvo declarado |
|---|---|
| Plataforma | **Navegador**, WebGL2 + WebAssembly — Zero-friction, sem instalar, sem conta para jogar |
| Stack | Vite 8 · TypeScript 7 `strict` · Three.js 0.186 · Rapier3D 0.20 SIMD (Wasm) |
| Pilares | Simulação **determinística a 60 Hz** (uma só, cliente e servidor), **calor** e **dano por parte**, latência baixa |
| Piso de hardware | **GPU integrada** (G12); celular pelo toque |
| Modelo | **Nunca pay-to-win** — o que se vende, um dia, é aparência (`VISAO.md`) |
| Métrica de sucesso | O jogador **volta amanhã** (retenção D1) |

Custos que o projeto respeita e que **também são** argumento de mercado: JS ≤ 500 KB gzip, Wasm ≤ 900 KB gzip
(R7), ≤ 8 KB/s de download por jogador (G11), servidor autoritativo (G7/G13).

---

## 2. As seis referências

Do mapeamento do Comandante, resumido. **Nota de honestidade (R13):** o mapeamento veio de um chat e **eu não
consegui conferir os fatos de terceiros daqui** (sem acesso a cada jogo). Fica registrado como **pauta do
Comandante, não como fato auditado** — e as duas inconsistências que eu vi estão marcadas *(a conferir)*.

| # | Jogo | Estúdio | O que é | A dor que ele deixa |
|---|---|---|---|---|
| 1 | **War Robots** | Pixonic | Cover shooter arcade 6v6 | Pay-to-win severo, power creep, performance degradada |
| 2 | **Mech Arena** | Plarium | Arena shooter 5v5, TTK baixo | **Sem sensação de peso** ("brinquedo de plástico"), ambientes estéreis |
| 3 | **MechWarrior (MW5 / MWO)** | Piranha Games | Simulador tático de tanque bípede | Barreira de entrada altíssima, engine/download pesados, netcode velho |
| 4 | **Armored Core VI** | FromSoftware | Ação 3D omnidirecional frenética | Exige hardware de ponta, multiplayer secundário |
| 5 | **Hawken** | *(o mapeamento diz "Reloaded Studios / 505 Games"; o original foi da **Adhesive Games** — a conferir)* | Arena FPS de ritmo intermediário | Servidores mortos; PvE raso nos reboots |
| 6 | **Vox Machinae** | Space Bullet Dynamics | Simulação tática com manuseio analógico (VR/flat) | Nicho; ação devagar demais para partida casual |

> O `id` do item 6 no mapeamento é `custom-mech-wars-or-vox-machinae` (mistura dois jogos) enquanto o título e o
> estúdio são do Vox Machinae *(a conferir com o Comandante se a pauta era um ou os dois)*.

### 2.1 O que o mapeamento acerta sobre o gênero

- **A massa é o divisor.** Mech Arena e War Robots são criticados por movimento arcade sem peso; MechWarrior e Vox
  Machinae são elogiados por inércia e manuseio. O público do gênero reclama da falta de peso nos jogos fáceis e da
  barreira nos difíceis — **o espaço entre os dois é onde o CYBERMECH cabe** (`VISAO.md`: "sensação de peso e massa"
  com "sem instalar nada").
- **Calor é identidade.** Nos dois jogos que o público respeita (MechWarrior, Hawken), o calor é mecânica central.
  Os jogos de maior alcance (War Robots, Mech Arena) trocaram calor por cooldown/munição. **Nós já temos calor**
  (`combat/heat.ts`) — o mapeamento só não sabia que existia.
- **A partilha de dois braços de mercado** que o mapeamento propõe — de um lado *profundidade tática*, do outro
  *acesso instantâneo* — descreve exatamente a proposta do `IDENTITY.md`. O benchmark **confirma o posicionamento**.

### 2.2 O que o mapeamento erra ou idealiza

- **Ele descreve o CYBERMECH no futuro do indicativo.** Na matriz dele, a nossa coluna já é o alvo maduro:
  "rotação de torso/pernas: Sim", "locomoção física real", "termo: crítica". Ou seja, o mapeamento foi escrito
  **descrevendo a promessa**, não o jogo. A § 3 abaixo é a correção.
- **`target_fps` 60 e `max_frame_time_ms` 16,6 ele trata como característica; nós tratamos como meta medida.**
  A diferença é o que separa o marketing honesto (R13) da propaganda.

---

## 3. A matriz de features — com a nossa coluna honesta

Legenda: **REAL** funciona de ponta a ponta · **PARCIAL** existe incompleto · **AUSENTE** não existe ·
*"—"* não se aplica. A fonte de cada linha é o código ou o `STATUS_REAL.md`.

| Característica | War Robots | Mech Arena | MechWarrior | AC6 | **CYBERMECH (real em 15/10/2026)** |
|---|---|---|---|---|---|
| Plataforma | Mobile/PC | Mobile/PC | PC/Console | PC/Console | **Navegador** — REAL |
| Tempo até o primeiro tiro | Download | Download | Setup longo | Setup/horas | **Sem instalar** — REAL na proposta; o boot medido (**6,4 a 7,1 s** em duas execuções de hoje) é de bancada por software, **não de GPU real** (R13) |
| Inércia / física de massa | Baixa | Quase nula | Altíssima | Média/alta | **PARCIAL** — cápsula **cinemática** (G6), não corpo rígido. A massa aparece em **número** (velocidade por chassi, resistência ao empurrão de 25% a 100%, passo), não em dinâmica. Recuo é **cosmético**; centro de massa/inércia de verdade é futuro (`METAGAME.md` § `mass-distribution`) |
| Rotação torso × pernas | Não | Não | Sim | Sim | **AUSENTE** — `MechBase.applyFacing` gira a **raiz inteira** (pernas junto); o torso só inclina (`pitch × 0,25`) e leva o *tranco* do tiro. **É a lacuna que o mapeamento chama de divisor** |
| Mecânica de calor | Não (cooldown) | Não (munição) | Crítica | Stagger | **REAL** — `combat/heat.ts`: superaquece (3/4 da velocidade, sem pulo nem dash), zonas de resfriamento, anel de fogo aquece, gelo esfria |
| Dano localizado por parte | Cosméticos | — | Sim (por componente) | — | **REAL** — 6 partes; perna lenta, duas pernas imóvel, braço sem arma, torso mata |
| Bípedes vs quadrúpedes | Cosmético | Raros | Bípede | Tipos de perna | **AUSENTE** — a mesma cápsula para todos; o Quadra-V2 existe como arquivo e **não é carregado** (P57); o quadrúpede de verdade pede esqueleto novo (`ROADMAP` `#mechs`) |
| Cenários | Vários | Estéreis | Grandes | Grandes | **PARCIAL** — Arena (200 m), Bunker (4 pisos), Praia dos Cabos (640 × 240 m). Amplitude boa; profundidade visual abaixo do alvo (`REFERENCIA_VISUAL.md`) |
| Multiplayer autoritativo | Sim | Sim | Sim | Sim | **REAL** — Node + ws, 60 Hz, snapshots a 20 Hz |
| Compensação de latência (acertar o que se viu) | Sim | Sim | Sim | Sim | **AUSENTE** — `FINDINGS.md` M5; é a maior diferença de **sensação** online |
| Progressão / retenção | Gacha | Gacha | DLC | Missões | **AUSENTE** — `QUIMICA_DO_JOGO.md` § 5 (o nível que não sobe, o recorde que não é salvo, a missão que não progride) |
| Monetização | Gacha/P2W | Gacha | Compra única | Compra única | **Nada à venda** — princípio "nunca pay-to-win" é REAL como princípio |

---

## 4. Os benchmarks técnicos — o que o mapeamento pede × o que está medido

As metas do mapeamento (`critical_technical_benchmarks`) contra os **nossos números medidos**. Nenhum número
abaixo foi estimado: cada um traz a fonte e a data.

| Meta do mapeamento | **Nosso número** | Fonte / data | Veredito |
|---|---|---|---|
| `target_fps` **60** | Não medido em integrada. Vega 11 (13/10): p50/p95/p99 de **33,4 / 66,6 / 100 ms**, com travada > 300 ms | `REFERENCIA_VISUAL.md` § 7.1 (09/10) | ⚠ **pendente** — é a pendência nº 1 (§ 6) |
| `max_frame_time_ms` **≤ 16,6** | idem. No Bunker (Vega 11, 10/10): p50 de **13,9 a 16,1 ms**, p95 de **15,5 a 62,6 ms** | `medicoes/BUNKER.md` | ⚠ **pendente** (p95 com outliers) |
| `max_draw_calls_per_frame` **≤ 120** | **44 a 52** por vista na praia; **18 a 67** no Bunker. Teto da ficha: **67** | `medicoes/PRAIA.md` (15/10), `BUNKER.md` (10/10) | ✅ **folgado** |
| `initial_payload_target_mb` **< 35 MB** | Boot = **JS 447,4 KB + Wasm 719,4 KB** gzip. Os 8 robôs `.glb` (**25,87 MB**) carregam **por robô**, não no boot (`importedMechAssets.ts`) | `npm run smoke` (15/10) + `dist/` | ✅ **folgado** |
| `netcode_target_tickrate` **30–60 Hz** | **60 Hz** fixo na simulação (G1), snapshots a **20 Hz** quantizados (G11) | `PROTOCOLO_UNIVERSAL.md` G1/G11 | ✅ |
| Telemetria de apoio (minha) | Triângulos: **133.885 a 134.661** (praia); **9.964 a 14.482** (Bunker) — colisores **167**, teto 310; CPU por quadro na praia: **3 rotações** (o resto é GPU) | `PRAIA.md`, `BUNKER.md`, `STATUS_REAL.md` | ✅ dentro do teto |
| Testes de simulação (G14) | **2.050** em 208 arquivos | `npm test` (15/10) | ✅ |

**Como reproduzir (leitor cético):**

```bash
npm run smoke                       # orçamento JS/Wasm gzip + boot headless
node .decepticons/medicoes/praia.mjs    # desenhos e triângulos da praia (21 vistas)
node .decepticons/medicoes/bunker.mjs   # desenhos, triângulos e GPU do Bunker
```

O método de medição de GPU de tela real (Edge, 1280×720, aquecimento + amostras de timer) está em
`medicoes/BUNKER.md` — é o mesmo que a § 6 pede para fechar a pendência.

---

## 5. O gap — onde ganhamos e onde perdemos

### 5.1 O que o benchmark confirma que ganhamos

1. **Fricção zero.** Nenhum dos seis entra por URL. Nosso payload inicial é ordens de grandeza menor que um
   download de loja, e não exige conta. É o argumento que o mapeamento repete em todos os competidores.
2. **Profundidade sem pesadez.** Calor crítico + dano por parte (a essência do MechWarrior) entregues com
   acesso de site. É a lacuna de mercado que o próprio mapeamento nomeia.
3. **Fair-play como produto.** Contra a dor nº 1 de War Robots e Mech Arena (pay-to-win), o "nunca pay-to-win"
   do `VISAO.md` é um **posicionamento**, não só um princípio de engenharia. É o ângulo de marketing mais forte
   que o mapeamento revelou.
4. **A simulação única e determinística** (G14) é o alicerce técnico que torna multiplayer honesto possível — e o
   que a base frustrada dos gacha caça.

### 5.2 O que o benchmark expõe como lacuna real

| Lacuna | Peso | Por que importa para o lançamento |
|---|---|---|
| **Rotação independente de torso e pernas** — AUSENTE | **alto** | É *a* resposta ao "brinquedo de plástico" do Mech Arena e *a* credencial do MechWarrior. Sem ela, o jogo é um shooter de veículo com skin de robô; prometer isso hoje seria mentira (R13) |
| **GPU numa integrada** — NÃO MEDIDO | **alto** | Toda a promessa "roda em qualquer navegador" (G8/G12) apoia-se neste número. Sem ele, não há como afirmar performance no material de lançamento |
| **Compensação de latência** — AUSENTE | médio | É o que faz o tiro online "acertar o que se viu"; sem ela, o online parece injusto (achado M5) |
| **Progressão/retenção** — AUSENTE | médio | A métrica de sucesso é o D1; hoje não há o que traz o jogador de volta (`QUIMICA_DO_JOGO.md` § 5) |
| **Profundidade visual** — PARCIAL | médio | O alvo admitido é o MechArena (`REFERENCIA_VISUAL.md`); há plano e ordem, falta execução |
| **Gente na sala** — zero | **alto** | Nenhum benchmark substitui um jogador de fora. É o item que trava todas as frentes de dinheiro (`PUBLICACAO_E_MONETIZACAO.md` § 3) |

### 5.3 A oportunidade por competidor (do mapeamento, revisada)

- **Contra War Robots e Mech Arena:** *"mira, física de terreno e termodinâmica vencem quem gasta"* — promessa
  **verdadeira** hoje, porque nada é vendido. Mantê-la é regra de produto, não só de marketing.
- **Contra MechWarrior:** *"a profundidade deles, sem a barreira deles"* — verdadeira em calor e dano por parte;
  **não** em rotação de torso (§ 5.2), e o material público não pode sugerir que a temos.
- **Contra Armored Core 6:** não competir em frenesi ou densidade poligonal — competir em **fluidez de navegador**
  (o mapeamento diz o mesmo; o nosso teto é honesto, `VISAO.md` "não é AAA gráfico").
- **Contra Hawken:** a estética industrial densa é referência de **atmosfera**; o erro deles foi a infraestrutura —
  a nossa resposta é o servidor autoritativo leve que já roda.
- **Contra Vox Machinae:** extrair a **sensação de peso da suspensão** sem o custo dos controles de simulador.

---

## 6. Prontidão de lançamento — o que o benchmark manda resolver antes

Ordem de prioridade — o que custa caro depois de publicado vem primeiro:

1. **Medir a GPU numa máquina integrada (o número que falta).** Método pronto em `medicoes/BUNKER.md` e em
   `REFERENCIA_VISUAL.md` § 7.2 etapa A (Edge, 1280×720, três sessões de 5 min após aquecimento, alvos propostos:
   60 FPS, p95 ≤ 20 ms, p99 ≤ 33,3 ms). **Bloqueia** dizer no material de lançamento que o jogo roda em máquina
   fraca. *(Dono: Codex/Claude — frente `#desempenho`.)*
2. **Decisão do Comandante sobre a rotação de torso e pernas.** É a lacuna de maior peso de mercado (§ 5.2) e
   custa mexer em `MechBase.ts` (rig, animação) e no protocolo de rede. **Decisão dele, não de um agente.** Sem
   ela, o posicionamento "profundidade de MechWarrior" tem um furo que o Comandante precisa saber que existe.
3. **Encher a sala.** O benchmark não resolve, mas ordena: `PUBLICACAO_E_MONETIZACAO.md` § 5 etapa 0 (uma sessão
   real com 5 pessoas; itch.io; modo treino para o jogador solo). É a condição que destrava tudo o mais.
4. **Nada de prometer o que a `STATUS_REAL.md` marca PARCIAL/AUSENTE.** A matriz da § 3 é o material honesto;
   a matriz do mapeamento (que já nos descreve como prontos) **não pode** virar texto público (regra 14, R13).

---

## 7. O que disto pode virar público (decisão do Comandante)

A `politica-paginas-publicas.md` (27/09) proíbe republicar a engenharia (bytes, KB/s, tetos) e o texto não é
copiável. Olhando por essa régua, o que **pode** virar página pública deste documento:

- **O posicionamento anti-pay-to-win** (o `#1` que o mapeamento revelou) — é venda, não engenharia, e é verdade.
- **"De onde viemos"**: as seis referências como *genealogia* do gênero (sem citar dados internos).
- **O que NÃO seremos** (gacha, power creep) — a mesma linha de `REFERENCIA_VISUAL.md` § 6.2.

O que **não** sai para o público: os números em bytes (JS/Wasm gzip, colisores, KB/s), os triângulos e a matriz
interna de lacunas (§ 5.2) — esta última porque diz aos concorrentes exatamente onde estamos fracos.

**É decisão do Comandante.** Este PR entrega o documento **interno**; a página pública, se ele quiser, é o PR
seguinte e curto.

---

## 8. Ligado a

`IDENTITY.md` § 1/§ 4/§ 5/§ 6 · `VISAO.md` · `STATUS_REAL.md` (a fonte de cada estado) · `REFERENCIA_VISUAL.md`
(o alvo visual, MechArena) · `PUBLICACAO_E_MONETIZACAO.md` § 3/§ 5 (a sequência e o gatilho) · `QUIMICA_DO_JOGO.md`
§ 5 (a lacuna de retenção) · `METAGAME.md` § `mass-distribution` e § 6/§ 7 · `medicoes/PRAIA.md`,
`medicoes/BUNKER.md`, `medicoes/RENDER_C3.md` (as bancadas) · `PROTOCOLO_UNIVERSAL.md` G1/G7/G8/G11/G12/G14 ·
`ORDENS_DO_COMANDO.md` P129 (esta ordem) e § 6 (o placar de resultado).

*BENCHMARK.md v1 | CYBERMECH | 2026-10-15 · Qwen*
