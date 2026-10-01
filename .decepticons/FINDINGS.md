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

## 🔵 Em Aberto — M5 (Tiros Autoritativos)

### Raycast de Acerto no Servidor

**Descoberto:** 2026-10-01 | **Status:** 🔵 Em progresso | **Impacto:** Bloqueador de multiplayer (M5)

**Descrição:** O servidor valida cadência e dispara projétil, mas **não calcula acerto** — o cliente faz tudo. M5 move essa responsabilidade para o servidor.

**O que falta:**
1. **Raycast com compensação de latência:** reposicionar cápsulas dos Mechs ao timestamp do comando do atirador (até 150 ms atrás)
2. **Hit detection:** raycast do tiro com cápsulas compensadas → qual Mech/parte foi atingida
3. **Evento HIT:** criar `EVENT.HIT` com shooter, target, part, damage
4. **Cliente:** receber evento, aplicar dano e efeitos

**Estrutura (servidor):**
- `NetPilot.fireWithValidation()` → chama `Match.fireWithHitDetection(origin, dir, shooter, weapon)`
- `Match.fireWithHitDetection()` → raycast, encontra target+part, cria evento HIT
- `ArenaRoom` → broadcast evento aos clientes

**Estrutura (cliente):**
- `applyNetEvent(EVENT.HIT)` → lookup de shooter e target pela roster, aplica `combat.onProjectileHit()`

**Workaround atual:** Cliente dispara e calcula; servidor só cria visual (sem validação de verdade).

**Próximos passos:** Implementar raycast (v1: sem compensação), depois v2 com compensação de latência.

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
