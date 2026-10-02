# ACHADOS TÉCNICOS (R17) — CYBERMECH

Descobertas técnicas reais: bugs, limitações, workarounds, insights que fizeram diferença. Diferentes de decisões de design — estes são **fatos do sistema**.

---

## 🔴 Bloqueadores Abertos

### Mech Parado Afunda no Chão sem Limite

**Descoberto:** 2026-09-29 | **Status:** 🔴 Não corrigido | **Impacto:** Cosmético, visível com Colossus-01

**Descrição:** Um Mech parado (sem input de movimento) afunda continuamente no chão. Colossus-01 (14 m) afunda 2,16 m em 3 s; Vector-09 (~1 m em 1 s). O padrão nunca estabiliza.

**Diagnóstico Isolado:**
```
test: "MechBase parado afunda no chão"
setup: PhysicsWorld real, Mech no chão plano, sem input 3 s
medição: simPos.y desce monotonicamente sem limite
causa: unstickFromGround só dispara com intenção de movimento horizontal
  (DesiredInput.moveX >= 1e-3 || moveZ >= 1e-3)
  Parado, nunca dispara. Margem de CONTROLLER_OFFSET (5 cm) erode sem contenção.
```

**Tentativas Testadas e Descartadas:**
1. Escalar `CONTROLLER_OFFSET` pelo raio do chassi — melhora pouco; ainda afunda 1,85 m em 3 s.
2. Travar `m.y` para nunca superar `_desired.y` do tick — elimina saltos grandes, mas causa vazamento constante (~0,5 m/s, continua para sempre).

**Workaround Atual:** Nenhum. Bots param para esfriar (movimento → afundamento mínimo). Colossus é mais visível porque fica parado mirando.

**Próximos Passos:** Reescrever `unstickFromGround` para cobrir o caso parado — talvez ancorar `simPos.y` num valor de referência enquanto `grounded` e velocidade vertical ≈ 0. Precisa de tempo dedicado ao character controller do Rapier.

---

## 🟡 Limitações Conhecidas

### Parte Destruída Não Some em Malha Importada

**Descoberto:** 2026-09-30 | **Status:** 🟡 Aceito | **Impacto:** Fidelidade visual

**Descrição:** Mechs procedurais têm 6 malhas separadas (torso, cabeça, pernas L/R, braços L/R), cada uma pode ficar invisível quando destruída. Malhas importadas (Gênesis-01, `.glb`) são uma peça única ligada ao esqueleto por peso de pele — destruir uma parte não a torna invisível.

**Por Quê:** A hierarquia de renderização (qual peça mostrar/esconder) vem da separação de malhas, não de tags de osso. Uma malha única não tem essa separação.

**Workaround:** Flash de dano (`hullMaterials.emissive`) funciona igual (cobre o corpo inteiro). Fidelidade reduzida aceitável por agora.

**Resolução Futura:** Gerar malha separada por parte no pipeline de IA 3D, ou usar textura + discard shader para cada parte (mais pesado).

---

### Destroços Causam Divergência Cliente-Servidor

**Descoberto:** 2026-09-23 | **Status:** 🟡 Aceito | **Impacto:** Determinismo

**Descrição:** Destroços (corpos dinâmicos no Rapier) são simulados no cliente; o servidor roda sem eles. Mesma entrada → outputs diferentes pela ordem interna de corpos do Rapier.

**Por Quê:** Corpos dinâmicos mudam a estrutura interna de Broadphase do Rapier. Cliente adiciona destroços a cada impacto; servidor não. A ordem interna diverge; raycast e contato retornam resultados diferentes.

**Workaround:** Servidor roda `Match` sem Destroços (visualmente feito no cliente). Previsão do cliente usa destroços; correção do servidor ignora. Funciona; sem sincronização de destroços na rede (como deve ser).

**Resolução:** Já tratada no design (destroços são cosméticos, nunca viajam na rede). Nada a fazer — é por desenho.

---

### Bug Real de Rotação Composta em Apêndice Decorativo

**Descoberto:** 2026-09-29 | **Status:** ✅ Corrigido | **Impacto:** Antes: cauda da Onça-B2 dobrando sobre si mesma

**Descrição:** Cada segmento de apêndice (ex.: cauda de 3 segmentos) é filho do anterior. Setei a rotação de cada segmento para um ângulo **absoluto acumulado** — mas como cada filho rotaciona relativo ao pai (que já está rotacionado), o Three.js somava novamente em cada elo.

**Efeito Real:** Cauda com zigue-zague violento em vez de curva suave.

**Diagnóstico:** Logueei `getWorldPosition()` de cada segmento após `updateMatrixWorld()` — valores de Z oscilavam (2.62→2.90→2.66→2.60) em vez de crescer monot

ônico.

**Correção:** Cada segmento recebe só o INCREMENTO de ângulo, não o total acumulado.

**Lição:** Cadeia pai→filho em Three.js somam automaticamente. Increment local, não absolute global.

---

## 🟢 Achados Úteis (Insights Reaproveitáveis)

### Técnica: Apêndice Decorativo (Zero Custo de CPU)

**Descoberto:** 2026-09-29 | **Aplicação:** Cauda (Onça-B2), cabeça-torre (futuro), esteiras

**Descrição:** Geometria puramente cosmética, construída **uma vez** na montagem do modelo. Sem `MechPart`, sem entrar em animação, sem mudar dano → **0 alocação por frame** (G4) e **zero risco ao gameplay**.

**Padrão:**
1. Define a forma em `mechBlueprint.ts` (ex.: `tail: { segments, baseRadius, length, droop }`).
2. Builder constrói uma malha simples (3 cilindros, decretos, pendurados).
3. Não toca em `MechBase.ts`, `damage.ts`, ou regra de physics.

**Aplicações Futuras:** Canhão no lugar da cabeça (já pronto em código), esteiras, canhão pendente entre pernas.

---

### Padrão: Carregamento Assíncrono de Asset sem Bloquear

**Descoberto:** 2026-09-30 | **Aplicação:** `importedMechAssets.ts`, samples de áudio

**Descrição:** Asset caro (`.glb` 3.3 MB, sample 2 MB) carrega **assincronamente no boot**, mas **instanciação é síncrona** no loop.

**Padrão:**
- `preload()` → caro, assíncrono, cacheado por ID
- `tryInstantiate()` → retorna `null` se não pronto; síncrono se pronto
- `whenReady()` → espera (promessa) se preciso

**Benefício:** Boot não trava; Mech nunca aparece quebrado (cai pra fallback). Pronto a tempo porque há delay entre "entrar no Hangar" e "iniciar partida".

---

### Descoberta: Content Security Policy Bloqueia `blob:` (GLTFLoader)

**Descoberto:** 2026-09-30 | **Status:** ✅ Corrigido | **Impacto:** Causa: malha sem textura

**Descrição:** `GLTFLoader` decodifica textura embutida em `.glb` criando object URL (`blob:...`) e buscando nele. CSP da landing bloqueava `blob:` no `connect-src`.

**Sintoma:** Malha carrega, nenhuma textura (branca).

**Correção:** `scripts/site.mjs` libera `blob:` na CSP.

**Lição:** Teste local (sem CSP) passa; `site --check` (com CSP real) pega. Sempre testar contra CSP de produção.

---

### Fix: Flash de Dano Inicializa Correto (Cor Branca)

**Descoberto:** 2026-09-23 | **Status:** ✅ Corrigido | **Impacto:** Antes: Mechs apareciam brancos até primeiro dano

**Descrição:** Material de flash iniciava branco (`new THREE.Color()` = branco) em vez de preto. Mechs (Vector-09 amarelo, rebeldes vermelho) apareciam brancos até levar dano.

**Correção:** Inicializa preto. Flash acontece após impacto.

**Lição:** Verificar cor default do Three.js; não assume preto.

---

### Fix: WebSocket Global do Node Era Instável sob Carga

**Descoberto:** 2026-09-27 | **Status:** ✅ Corrigido | **Impacto:** Testes falhavam aleatoriamente ("flake")

**Descrição:** Teste de "teto por IP" usava `WebSocket` global do Node (undici). Sob 31 workers em paralelo, a conexão que o servidor fecha logo após o handshake não disparava `close` — a `Promise.all` dos três `closed` ficava pendurada.

**Diagnóstico:** Trocou para `WebSocket` do pacote `ws` (mesmo do servidor). Teste reescrito pra abrir vagas em sequência (a terceira é sempre recusada, sem corrida).

**Resultado:** 5 execuções seguidas, concorrência total, zero flake (antes: 3 de 4 falhavam).

**Lição:** Undici (`node --fetch`) nem sempre é bom para testes de WebSocket. `ws` é mais previsível.

---

### Fix: Pointer Lock Falha Silenciosamente no Headless

**Descoberto:** 2026-09-28 | **Status:** 🟡 Diagnosticado, workaround aplicado | **Impacto:** Landing screenshots vazias

**Descrição:** `capture()` clicava no título para começar a partida (precisa de Pointer Lock) mas nunca checava se funcionou. Falhava em silêncio; o headless capturava a tela de pausa 3 vezes (parecendo cópia).

**Sintoma:** 3 fotos iguais na landing.

**Workaround:** Até 8 tentativas com a aba em primeiro plano, **confirma de verdade** (`document.pointerLockElement`), falha alto se não conseguir.

**Raiz Não Isolada:** Pointer Lock falha sob certos builds de Chromium headless; causa exata desconhecida. Não reproduz de forma consistente.

**Lição:** Sempre confirme o que você assume (Pointer Lock bem-sucedido, foto tirada).

---

### Fix: Bloqueio de Sonda de Status Aguardava Task Pendurada

**Descoberto:** 2026-09-28 | **Status:** ✅ Corrigido | **Impacto:** Landing demorava 4 s carregando

**Descrição:** `/status` de um servidor fora do ar abortava com prazo de 4 s, mas o corpo da resposta nunca chegava. `Promise.all([...JSON])` aguardava indefinidamente.

**Correção:** Reaplicar abort no `fetch` mesmo se já teve timeout, e esperar `closed` com prazo explícito.

---

### Fix: Os Quatro Chassis Importados Andavam e Miravam no Sentido Invertido

**Descoberto:** 2026-10-01 (relato do dono: "continua de braços abertos" e "as pernas parecem andar pra trás") | **Status:** ✅ Corrigido | **Impacto:** passada de costas, joelho dobrando para o lado errado e braço abaixando ao olhar para cima, em Gênesis-01, Lancer-L1, LR-7L Bastion e Marauder

**Causa raiz:** `AxisCorrectedJoint` media os eixos X/Y "relativos ao modelo" (`clonedScene`), que o `preload` já gira 180° por `rotationY: Math.PI`. Esse é o referencial do **arquivo** (frente em +Z); a animação de `MechBase.animate`/`applyFacing` assume o do **Mech** (frente em -Z: `hip.rotation.x` positivo leva o pé para a frente). Com os eixos medidos no referencial errado, todo ângulo saía com o sinal trocado. A mudança que introduziu isto tinha o comentário "os joelhos continuam dobrando pra frente", que é exatamente o contrário do que ela fazia. Os testes existentes usavam `model` sem rotação e nunca pegariam o caso.

**Medição nos quatro `.glb` reais (deslocamento no eixo Z do mundo, frente = -Z):**

| Chassi | `hip +0.5` → joelho (certo < 0) | `joelho -0.8` → pé (certo > 0) | `pitch +0.5` → mão (certo < 0) |
|---|---|---|---|
| antes, todos | +0,29 a +0,78 | −0,36 a −1,27 | +0,61 a +1,56 (Marauder: ≈ 0, braço em T) |
| depois: Gênesis-01 | −0,44 | +1,07 | −0,51 |
| depois: Lancer-L1 | −0,65 | +0,37 / +0,45 | −0,73 |
| depois: LR-7L Bastion | −0,85 / −0,60 | +0,48 / +0,72 | −2,19 |
| depois: Marauder | −0,75 | +1,16 | −0,64 |

**Segunda causa, só do Marauder:** o `.glb` vem em **T-pose** (braços a 90° dos lados, direção ombro→mão `±0,996, −0,07, 0,06`). Girar um braço horizontal em X só o rola sobre si mesmo: a mão se movia 0,06 m com a mira. Saída: `armRest` no `ImportedChassisConfig` (baixa e adianta o braço no referencial do Mech antes de congelar o repouso; o lado vem da geometria, não do nome do osso). Marauder em repouso: `±0,20, −0,89, −0,41`.

**Correção:** `createJoint` passa `model` (o grupo que o jogo gira pelo yaw) como referencial, nunca `clonedScene`. Oito testes novos em `importedMechRig.test.ts` usam um esqueleto sintético girado 180° pelo mesmo caminho do `preload` (`instantiateImportedMechRig`); com o erro reintroduzido, seis deles falham.

**Lição:** teste de eixo e sinal precisa de um modelo **girado**, como o de produção. Um teste com `new THREE.Object3D()` identidade aprova o erro.

---

## 🟡 M5 (Tiros Autoritativos) — evento HIT entregue; compensação de latência ausente

### O servidor já decidia o acerto; o raycast paralelo do M5-v1 estava errado e foi removido

**Descoberto:** 2026-10-01 | **Status:** 🟡 Parcial | **Impacto:** o evento HIT existe no servidor; o cliente ainda não o consome e não há compensação de latência

**O que o código realmente faz:** o `Match` do servidor (mesma simulação, G14) já decide todo acerto: o plasma é um raycast do segmento por tick contra a física (`ProjectileSystem`), o dano sai por parte (`damage.ts`) e o cliente online só recebe a vida no estado. O M5 não precisava de um segundo raycast.

**O que o M5-v1 (PR anterior, já na `main`) fez de errado:** `Match.fireWithHitDetection`/`findHitPart` rodavam **além** do projétil. A projeção usava `origin - pos` (sinal invertido), então o "acerto" só valia a menos de 1,5 m da boca da arma; e, se valesse, o dano seria aplicado **duas vezes** (projétil e raycast). Além disso alocava `Map`, `clone()` e `new` por tick (viola G4) e não tinha teste de simulação (viola G14). O M5-v2 (histórico de posições) usava o tick do cliente como se fosse o do servidor e só entrava no cálculo da distância, nunca na decisão de acerto: a "compensação" não compensava nada.

**Correção (01/10):** `fireWithHitDetection`, `findHitPart`, o histórico de posições e o parâmetro `room` do `NetPilot` foram removidos. O `ArenaRoom` agora liga `Match.onMechHit` (que só dispara **depois** que a regra de dano aplicou) ao `EVENT.HIT`: quem levou, de quem, a parte (`NET_PARTS`) e o dano realmente aplicado. Uma única via de dano. Dois testes em `server/room.test.ts`: o evento leva os campos certos, e um tiro real acerta uma vez só com o evento igual à vida perdida pelo alvo.

**Ainda ausente (R13):**
1. **Cliente consumir `EVENT.HIT`:** marcador de acerto e indicador de dano no online (hoje o evento viaja, ninguém o lê). Território do Gemini (`ui/`), contrato já pronto.
2. **Compensação de latência:** exige decisão de projeto antes do código. Os projéteis são físicos (140 m/s), não hitscan; voltar a posição dos alvos só faz sentido com mapa de tick cliente↔servidor, histórico em pool pré-alocado (G4), teto de rebobinada (≤ 150 ms) e a escolha de se o plasma vira hitscan. Proposta a escrever em `MULTIPLAYER.md` e aprovar com o dono.

---

## Template: Como Registrar um Achado

```markdown
### [Nome Descritivo]

**Descoberto:** YYYY-MM-DD | **Status:** 🟢/🟡/🔴 | **Impacto:** [uma frase]

**Descrição:** O que é.

**Diagnóstico:** Como descobrir, medição, causa raiz.

**Correção/Workaround:** O que foi feito ou pode ser feito.

**Lição:** O que aprender disso (reutilizável).
```

---

*Versão 1.0 | 2026-10-01 — Refactoring de ESTADO_ATUAL.md*
