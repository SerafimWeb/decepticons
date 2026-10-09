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

### Windows: o processo de uma tarefa agendada (S4U) não é encerrável de fora, e `Stop-ScheduledTask` deixa o filho órfão

**Descoberto:** 2026-10-09 (a mesma causa já tinha derrubado o online em 04/10) | **Aplicação:** `scripts/parar-servidor.ps1`, `server/parada.ts`, o reinício da atualização automática

**Descrição:** o servidor roda numa tarefa registrada como S4U (sem senha guardada). O `Stop-ScheduledTask` mata só o `cmd.exe` que a tarefa lançou; o `node` que ele lançou continua vivo, órfão, segurando a porta e os binários nativos (o `npm ci` dá EPERM). E o processo vive na sessão de logon da tarefa: um PowerShell comum, mesmo do mesmo usuário, recebe **"Acesso negado"** ao tentar ler o `StartTime` ou encerrá-lo (medido com `Stop-Process` e `taskkill`); a atualização automática, que também é uma tarefa S4U, de outra sessão, está no mesmo caso. Por isso "parar e religar a tarefa" nunca reiniciou nada.

**Padrão:** processo que não se deixa matar de fora precisa **sair sozinho**. O servidor vigia um arquivo de pedido (barato: `existsSync` a cada 2 s, fora do tick), apaga o pedido velho que achar ao subir (senão o servidor novo sai ao nascer), salva e sai com código 0. Testar com um servidor real numa porta de teste, não só com operações de mentira. E nunca declarar "reinício automático" sem ver o uptime do `/status` zerar.

### Cabeçalho de proxy só vale de quem é o proxy (`CF-IPCountry`, `CF-Connecting-IP`)

**Descoberto:** 2026-10-04 | **Aplicação:** `server/guard.ts` (`clientIp`, `clientCountry`), `server/Server.ts`

**Descrição:** o país (e o IP real) que a Cloudflare informa chega num cabeçalho comum; quem estiver na porta do servidor sem passar pelo túnel pode mandar o mesmo cabeçalho. Por isso os dois só são lidos quando o soquete direto é o localhost (o `cloudflared` roda na mesma máquina). Qualquer outra origem cai em `??`. Sem essa regra, um script na LAN (se o `HOST` for aberto num playtest) encheria a tabela de países com o que quiser. Coberto por `clientCountry` em `guard.test.ts` e por uma mutação que afrouxa a validação do código do país (os testes pegam).

**Padrão:** dado de proxy = confiar só quando o par da conexão é o proxy. Valide o formato mesmo assim (2 letras, `XX` e lixo viram `??`), porque o que entra num contador ou num mapa nunca pode ser texto livre (limite de 80 países por evento e dia, o resto vira `??`).

### Armadilha: `append()` do DOM não devolve nada

**Descoberto:** 2026-10-04 | **Aplicação:** `scripts/metricas.mjs`

`tabela.append(el('thead')).firstChild.append(x)` quebra com "Cannot read properties of undefined": `Node.append` devolve `undefined`, não o nó. Quem pegou foi o `site --check` (que abre a página de verdade); o `tsc` e os testes do servidor não veem JavaScript de página. Regra: página com script próprio ganha teste no navegador no `site.mjs`.

### Pendência: `site --check` com `VITE_GAME_SERVER` definida falha em "Entrar no cockpit abre jogar/"

**Descoberto:** 2026-10-04 | **Status:** 🟡 não investigado | **Impacto:** só quem roda o check local com a variável de produção

Com `VITE_GAME_SERVER=wss://…` no ambiente, o `--check` morre em `waitForURL(jogar/)` depois do clique em `a.play-btn` (30 s). Sem a variável passa. A landing de produção muda quando há servidor (botão de jogar online no lugar do offline, 29–30/09), e o teste pode estar clicando no botão errado ou esperando a URL antiga. Não conferi se o deploy do CI roda o check com a variável (o `check` do PR roda sem ela e passa); falta alinhar o teste ou o botão. Não é desta tarefa.

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

### Fix: o Coice dos Braços Saltava Metros nos Robôs Importados

**Descoberto:** 2026-10-03 (relato do dono sobre o Gênesis: o braço "dá um salto muito grande, ficou meio feio e elástico demais para um robô de metal") | **Status:** ✅ Corrigido | **Impacto:** a cada tiro o braço, com a arma, saía do corpo; no Marauder, que ganhou arma no braço no #150, estava assim desde então

**Causa:** `MechBase.animate` escrevia o coice em `rig.<braço>.position.z` (0,35 e 0,5). Num rig procedural isso é metro para trás (o grupo do braço está no referencial do torso). Num rig importado é o `position` do osso: no referencial do pai (eixos do exportador), na unidade do arquivo e multiplicado pela escala do modelo. O mesmo número virava metros na direção errada.

**Medição (deslocamento do braço com o coice no máximo, em metros no mundo):**

| Chassi | direito, antes | esquerdo, antes | depois |
|---|---|---|---|
| Gênesis-01 | 1,86 (35% da altura), para baixo | 2,66, para cima | 0,35 e 0,50 para trás |
| Lancer-L1 | 1,86, para cima | 2,65, para cima | idem |
| LR-7L Bastion | 3,37 (64%), para trás e de lado | 4,82 (91%), para cima | idem |
| Marauder | 2,49, para trás e para baixo | 3,56, para cima | idem |
| Vector-09 (procedural) | 0,35 para trás | 0,50 para trás | igual |

**Correção:** `MechRig.setRecoil(direito, esquerdo)` opcional, em metros para trás (+Z do Mech). O rig importado escreve o deslocamento do osso no referencial do pai, dividido pela escala acumulada dele; rig sem `setRecoil` mantém o caminho antigo. Três testes novos (osso torto, arquivo em centímetros e em metros, integração com o `MechBase`); sem a compensação de escala dois falham. Captura: `arte/coice-antes-depois.png`.

**Ainda aberto (gosto):** o recuo ficou igual ao do Vector-09 (0,35 m, volta linear em 111 ms). Se ainda parecer elástico, são dois números em `MechBase.animate` (0,35 e 0,5; `dt * 9` e `dt * 5`) e valem para todos os chassis. O Hangar não aciona o coice, então só a partida mostra.

---

### Achado: o Ombro "Quebrado" do Marauder era o Ângulo do Braço, não a Pele

**Descoberto:** 2026-10-03 (relato do dono: "braço mole, muito pra baixo, parece que o ombro está quebrado") | **Status:** ✅ Corrigido no Marauder | **Impacto:** a junta do ombro parecia amassada

**Causa:** a ombreira (a "coroa" hexagonal) está presa ao osso do braço. Com o braço baixado a 81° da T-pose ela gira junto e a pele suave a amassa contra o tronco.

**Testado e descartado:** pele rígida (cada vértice seguindo só o osso de maior peso). Em vez de limpar, a ombreira vira estilhaços pontudos: a malha depende da mistura de pesos nas juntas.

**Correção:** o braço fica ~50° abaixo da horizontal e o antebraço dobra para a frente (arma em punho). Para dizer isso sem encadear ângulos, `armRest` passou a ser por **direção** (`{ upper, fore? }`, no referencial do Mech, espelhado por lado). Comparação: `arte/marauder-ombro-antes-depois.png`.

**Lição:** com pele suave de auto-rig, o ângulo útil a partir da T-pose é pequeno (~50°); passar disso pede a ombreira presa ao tronco no arquivo, ou outro desenho.

---

### Achado: a Arma Não Aparecia no Modelo; Trocar de Arma Só Trocava Números

**Descoberto:** 2026-10-02 (relato do dono: o Marauder com "braço mole e reto", sem parecer que segura arma) | **Status:** ✅ Corrigido no Marauder, 🟡 aberto nos demais | **Impacto:** a montagem do Hangar não se via no robô

**Causa:** `MechBase.equip` só guardava o `Loadout` e zerava o calor; nenhum desenho mudava com a arma. Os Mechs procedurais têm o cano (direito) e o casulo (esquerdo) fixos no antebraço, para qualquer arma e nível; o Marauder importado não tinha nada, só uma mão de humano com dedos.

**Correção:** o encaixe de arma no pulso (`weaponMount.ts`) e os módulos de arma (`weaponModels.ts`); a mão e os dedos somem e o desenho muda com a arma e o nível. Contrato e roteiro em `MECHS_IMPORTADOS.md`.

**Ainda aberto:** só o Marauder usa o encaixe; os procedurais continuam com arma fixa no antebraço, e Gênesis, Lancer e Bastion trazem a arma no modelo.

---

### Limitação: o Ponto de Tiro da Simulação Vem do Desenho, e o Servidor Desenha Todo Mech como Vector-09

**Descoberto:** 2026-10-02 (ao ligar a arma no Marauder) | **Status:** ✅ Corrigido para o Marauder (03/10); os demais chassis usam a medida do próprio rig, igual nos dois lados | **Impacto:** online, o tiro do Marauder nasce num ponto diferente do cano que o jogador vê

**Causa:** `MechBase.muzzleLocal` é medido no desenho do rig (`rig.muzzle`, no construtor). O servidor cria o Mech de qualquer chassi como `new Vector09({ stats, loadout })` (`server/ArenaRoom.ts`), com o desenho padrão do Vector-09 escalado à altura, enquanto o cliente do jogador usa o rig do chassi (`Game.ts`). Dois desenhos, dois pontos de tiro: quebra o G14 (uma simulação só).

**Medição (pés, yaw 0, Marauder, plasma MK I):** cliente (1,12; 3,49; −2,20) m, servidor (1,50; 2,73; −1,62) m: diferença de cerca de 1 m.

**Correção feita (03/10, PR do Marauder com duas armas):** a boca de cada encaixe é dado do chassi (`MechStats.muzzles`, `entities/chassis.ts`), igual no cliente e no servidor; o desenho é que se confere contra o dado, não o contrário: `npm run mech:bocas` carrega o `.glb`, mede as quatro bocas e sai com código 1 se alguma passar de 15 cm do dado (entra no `npm run check`). Os chassis procedurais não precisam: cliente e servidor têm o mesmo corpo e a mesma medida. Os foguetes do Vector-09 também passaram a sair da boca esquerda no servidor, como no cliente (antes saíam da direita).

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

### Chassi com letra maiúscula no id era recusado online e ignorado no link

**Descoberto:** 2026-10-03 (escrevendo o teste de sala do Lancer) | **Status:** ✅ Corrigido | **Impacto:** entrar online com Lancer-L1, LR-7L Bastion ou Quadra-V2 era recusado como 'montagem'; o link `?build=` desses chassis era ignorado (o jogo abria com a montagem de fábrica)

**Descrição:** o texto da montagem (`v1.chassi.arma-nível.arma-nível`) e a regra do servidor (`BUILD_RE`) só aceitavam minúsculas e números, e os ids `lancerL1`, `lr7lBastion` e `quadraV2` têm maiúscula.

**Diagnóstico:** o teste de sala entrando com `v1.lancerL1.shotgun-0.-` foi recusado. Nenhum teste passava o texto de montagem por todos os chassis, só por exemplos.

**Correção/Workaround:** `parseLoadoutKey` e `BUILD_RE` aceitam letras dos dois tamanhos e números. Teste de ida e volta (`loadoutKey` → `parseLoadoutKey`) para **todos** os chassis, e o teste de sala. Conferi que o teste tem dentes: estraguei a regra e ele falhou.

**Lição:** regra de formato que valida um id de dado precisa de um teste que passe por todos os ids reais, não por um exemplo.

### Arma que não é foguete no braço esquerdo nunca dispara (Arara e Onça)

**Descoberto:** 2026-10-03 (lendo o caminho do gatilho para a escopeta) | **Status:** ✅ Corrigido (03/10, PR do Marauder com duas armas) | **Impacto:** o Hangar oferece blaster no braço esquerdo da Arara-B1 e plasma no esquerdo da Onça-B2, mas apertar o botão do braço esquerdo não faz nada

**Descrição:** o gatilho do braço esquerdo é sempre um `RocketLauncher` (`combat/trigger.ts`), que vive de carregador e recarga. Blaster e plasma têm `magazine: 0`: o carregador nasce com 0 e `tryFire()` nega para sempre. O servidor (`NetPilot`) tem o mesmo caminho. A escolha existe em `ARM_SLOTS` (`arara`: esquerdo `['rockets','blaster']`; `onca`: esquerdo `['plasma','rockets']`). O inverso (foguete no braço direito da Onça) sai pelo caminho do projétil comum do braço direito; não conferi se explode.

**Diagnóstico:** leitura de `PlayerController.fixedUpdate`, `NetPilot.fixedUpdate` e `trigger.ts`. Não rodei uma partida com essas montagens; a conta é direta (`ammo = weapon.magazine = 0`).

**Correção/Workaround:** o gatilho segue o tipo da arma, não o lado do corpo (`combat/Armament.ts`, a regra única do jogador e do servidor): energia atira no ritmo dela, foguete usa o carregador, motosserra corta. Teste de regra (blaster no gatilho esquerdo atira) com mutação conferida.

**Lição:** o lado do corpo não diz que tipo de arma vai ali. O gatilho devia sair do tipo da arma (energia, munição, corpo a corpo), e o `ARM_SLOTS` só decide o que o Hangar oferece.

### Tiro paralelo de mãos afastadas errava o alvo no servidor

**Descoberto:** 2026-10-03 (teste de sala do Marauder) | **Status:** ✅ Corrigido | **Impacto:** online, a mão esquerda e os lançadores de ombro do Marauder errariam quase todo alvo

**Descrição:** o comando de rede traz só yaw e pitch, calculados pelo cliente a partir da boca da mão **direita** até a mira. O servidor usava essa mesma direção para toda boca. Com as mãos a ~3 m uma da outra, o tiro da esquerda saía paralelo e passava a 3 m do centro do alvo (a cápsula de um Mech tem 1,3 m de raio).

**Diagnóstico:** o teste de sala acertava o blaster direito e errava o esquerdo; a mutação "sem convergência" derruba dois testes.

**Correção:** `NetPilot.aim` acha onde o raio da mão direita bate (um raio por tiro, não por tick) e aponta as outras bocas para esse ponto, como o jogador local já fazia com a câmera.

**Lição:** direção de tiro não é uma só quando há mais de uma boca; o que viaja é a mira, e cada boca se aponta para ela.

### O servidor descarta o pacote inteiro de comandos se vier com mais de 8

**Descoberto:** 2026-10-03 (teste mandava 15 comandos de uma vez) | **Status:** 🟢 Info | **Impacto:** nenhum no jogo; pegadinha de teste

**Descrição:** `MAX_INPUTS_PER_PACKET` é 8 e `decodeInputs` recusa o pacote inteiro acima disso, sem aviso: o piloto fica sem comando (`ack` 0), o Mech parado e o teste "não atira" sem mensagem. O cliente de verdade manda poucos por pacote.

**Lição:** teste de sala manda um comando por tick (`drive` em `server/room.test.ts`).

### Online, o outro jogador é desenhado como Vector-09, e o tiro dele nasce da boca direita

**Descoberto:** 2026-10-03 | **Status:** 🟡 Aberto | **Impacto:** visual: o Marauder (e qualquer chassi importado) aparece para os outros como um Vector-09; os tiros da mão esquerda e dos ombros dele aparecem saindo da mão direita

**Descrição:** `Game.makeRemote` só distingue andróide de Mech e desenha o resto como Vector-09; `OnlineSession.remoteShot` solta o projétil visual da boca direita. O evento de tiro (`SHOT`) carrega a arma e a direção, não o encaixe. O servidor atira certo dos quatro encaixes; só o desenho no cliente remoto é aproximado.

**Correção proposta (não feita):** desenhar o jogador remoto com o chassi da montagem dele (o roster já traz a montagem) e pôr o encaixe no evento `SHOT` (2 bits no byte do índice, `PROTOCOL_VERSION` 3). Mexe em rede e em carregamento de malha: precisa de decisão do dono.

### `npm ci` por uma junção apaga a node_modules de todas as worktrees (e não consegue com o servidor ligado)

**Descoberto:** 2026-10-04 (dono rodou a atualização do servidor à mão) | **Status:** ✅ Corrigido no código; 🔴 recuperação do PC do servidor com o dono | **Impacto:** a `node_modules` compartilhada ficou com 8 pastas vazias por dentro; o servidor no ar sobreviveu na memória, mas não reiniciaria

**Descrição:** o roteiro de `DEPLOY.md` mandava ligar `wt-servidor-prod\node_modules` à do projeto por uma junção (o mesmo que o `AGENTS.md` ensina para worktrees de desenvolvimento). O atualizador roda `npm ci` quando o `package-lock.json` muda; o `npm ci` apaga a pasta inteira antes de reinstalar, e por uma junção apaga a pasta da OUTRA worktree. Parou em EPERM no `rolldown-binding.win32-x64-msvc.node`, que o servidor (`scripts/server.mjs` roda pelo Vite) mantém aberto: o servidor trava o `npm ci` sempre que ele roda.

**Causas encadeadas:** (1) a tarefa de atualização nunca existiu (gatilho `P99999999DT23H59M59S` recusado e erro do `Register-ScheduledTask` que não interrompe o script); (2) a tarefa do servidor apontava para a pasta principal, cujo branch muda a cada `git switch` de qualquer agente; (3) `npm ci` com o servidor ligado.

**Correção:** `atualizador.mjs` (testado) recusa `node_modules` em atalho e para o servidor antes do `npm ci`; os `.ps1` conferem o registro, recusam a pasta principal e o atalho; recuperação passo a passo em `DEPLOY.md`.

**Lição:** script que apaga e reinstala dependências nunca roda por um atalho e nunca com o processo que usa os arquivos ligado; e "registrar tarefa" só é verdade depois de ler a tarefa de volta. Em desenvolvimento a junção da `node_modules` entre worktrees continua válida, mas nunca rode `npm ci` por ela: use `npm install`, ou dê à worktree uma `node_modules` própria.

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
