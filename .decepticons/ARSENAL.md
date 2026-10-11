# ARSENAL — como criar e configurar armas e robôs

> Escrito em 04/10 depois de criar a escopeta (PR #154) e a chuva de mísseis, para ninguém redescobrir a lista. Robô importado:
> `MECHS_IMPORTADOS.md`. Encaixes e gatilhos: `combat/mounts.ts`. O que cada coisa é de verdade hoje: `STATUS_REAL.md`.

## Classes de arma e tamanhos de robô (11/10, ordem P82 do Comandante)

> *"As armas devem ter 3 diferentes tamanhos (leve, média, pesada), e robôs gigantes usam armas pesadas como leves (pra eles), mas é a arma pesada normal dos outros robôs (os do tamanho 2, padrão principal do jogo). Futuramente faremos versões das armas para o tamanho 3 e 4."*

Duas coisas separadas: a **classe** da arma (o porte dela: leve, média ou pesada; **não é o peso**, que sobe com o nível MK) e o **tamanho** do robô
(`CHASSIS_SIZE` em `entities/chassis.ts`: 1 andróide, **2 Mechs, o padrão do jogo**, 3 e 4 gigantes; é a "escala" do `GAME_DESIGN.md`). Tudo mora em `combat/weaponClass.ts` (a tabela `WEAPON_FIT` e a conta `classFor`).

| Classe (no tamanho 2) | Armas |
|---|---|
| **Leve** | blaster, motosserra, escopeta, arma elétrica (arco), lançador EMP |
| **Média** | canhão de plasma, arma de gelo, canhão sônico, canhão automático, metralhadora rotatória, casulo de foguetes |
| **Pesada** | canhão pesado, lança-chamas, canhão de trilho, chuva de mísseis |

**A regra, uma conta só:** a classe é relativa a quem carrega, e cada passo de tamanho sobe duas classes, então **a pesada do tamanho N é a leve do tamanho N+1**.

| Quem carrega | Leves dele | Médias dele | Pesadas dele |
|---|---|---|---|
| Mech (**tamanho 2**) | as leves da tabela | as médias | as pesadas |
| Gigante (**tamanho 3**, o Colossus) | **as pesadas dos Mechs** (canhão pesado, lança-chamas, trilho, chuva) | *versões de tamanho 3: futuro* | *versões de tamanho 3: futuro* |
| Gigante maior (**tamanho 4**) | as pesadas do tamanho 3 (futuras) | *futuro* | *futuro* |
| Andróide (tamanho 1) | (a conta desce: a leve dos Mechs é a pesada dele) | — | — |

**O que mudou no jogo (P82):**
- O **Hangar agrupa as armas por classe** (LEVES, MÉDIAS, PESADAS) pela classe que o **chassi** enxerga; o andróide fica numa lista só. No Colossus tudo cai em **LEVES**, com a nota "tamanho 3: o que é pesado nos Mechs comuns é leve para ele".
- O **Colossus só oferece as pesadas dos Mechs** (canhão pesado, trilho, lança-chamas na mão principal; canhão, trilho e chuva na outra); plasma, foguetes, automático e rotatória saíram dele: para um gigante são pequenos demais. Os Mechs (tamanho 2) **não perderam nada**.
- O **Colossus do jogador** sai da fábrica com **canhão pesado + chuva de mísseis** (`COLOSSUS_PLAYER_STATS`). **O chefe da missão segue com plasma e foguetes** (`COLOSSUS_BOSS_STATS` intacto): trocar a arma do encontro mexe no equilíbrio dele, decisão em aberto.
- Link `?build=` ou montagem salva do Colossus com arma média ou leve passa a ser recusada (`encaixe`); o servidor cai na montagem de fábrica. A **Arara-B1 é tamanho 2** (o Hangar, o `HANGAR.md` e o `UNIVERSO.md` a chamavam de "escala 1", que é o andróide).
- A ficha de cada arma na landing do site diz a classe.

**Mudar uma arma de classe** é uma linha em `WEAPON_FIT` (e a lista da tabela em `weaponClass.test.ts`); ela troca de grupo no Hangar e, se virar pesada, passa a caber no Colossus sozinha. A classificação de hoje é a proposta do Claude: **leve até ~2,5 t, média 3 a 4 t**, e **pesada**
o que já era só dos chassis pesados por decisão do Comandante (canhão pesado, lança-chamas) mais as duas que mais pesam depois do canhão (trilho e chuva, 5 t). O Comandante ajusta.

**Como criar a versão de tamanho 3 (futuro):** é uma **arma nova** (um `WeaponId` próprio, por exemplo um canhão do tamanho do gigante) com `WEAPON_FIT` `{ class: 'heavy', size: 3 }` e os números em `BASE`; entra na lista do gigante em `ARM_SLOTS` e **não** nas dos Mechs
(o teste `nenhum encaixe oferece arma que o tamanho do chassi não carrega` trava isso). Só precisa existir como **média** e **pesada**: a leve do tamanho 3 já existe, é a pesada do 2 (outro teste proíbe declará-la). Nada na regra muda.

## O que já é só ajustar número (sem código)

**Configurações → POTÊNCIAS** (`tuning/power.ts`): por arma, multiplica dano, cadência, calor e alcance; por clã (jogador, Mechs
rebeldes, andróides), vida, velocidade e calor. Vale para toda arma nova sozinho (a lista vem de `WEAPON_IDS`). O link
`?potencias=` leva o ajuste a outra pessoa. Não cria arma nem robô: só mexe nos números que já existem.

**Números de partida de uma arma** moram na tabela `BASE` de `combat/weapons.ts` (dano, intervalo, calor, carregador, alcance,
raio da explosão, peso). Os três níveis (MK I a III) saem sozinhos da mesma regra; o equilíbrio é travado por teste.

## Arma nova: a lista

Uma arma que **só usa campos que já existem** (dano, cadência, alcance, explosão) pede os passos 1, 4, 5, 6 e 7. Uma que **se
comporta de um jeito novo** (a escopeta não precisou; a chuva de mísseis sim) pede todos.

1. **Dados:** `WeaponId` e uma entrada em `BASE` (`combat/weapons.ts`). Comportamento novo vira um campo opcional e tipado da
   arma (a chuva tem `barrage`), nunca um `if (id === ...)` espalhado. Três tabelas `Record<WeaponId, …>` também exigem a arma nova (o typecheck quebra se faltar): `DAMAGE_TYPE` (natureza do dano), `WEAPON_FIT` (classe e tamanho, `combat/weaponClass.ts`, P82) e `FIRE_KICK` em `combat/fireFeel.ts` (quanto o tiro faz a câmera tremer; 0 para corpo a corpo).
2. **Regra no tick fixo:** projétil comum não precisa de nada. Comportamento novo é um módulo próprio (`combat/XSystem.ts`, como o
   `BarrageSystem`): pool fixo, `fixedUpdate`, `clear`, `render`, callbacks `onFired` e `onExplode`. Liga no `sim/Match.ts` (criar,
   passo, três `clear`, explosão) e no `core/Game.ts` (desenho). Sem `Math.random`, `Date.now` nem DOM (G1/G2): o desenho de
   uma chuva é uma conta do ponto da mira, não um sorteio.
3. **Quem atira:** o jogador local (`PlayerController`) e o servidor (`NetPilot`) usam a mesma regra (`combat/Armament.ts`) e
   cada um só diz **de onde** o tiro sai e **para onde** vai (`ShotSink`). Comportamento novo entra nesses dois `sink`.
4. **Equilíbrio:** `combat/balance.ts` já conta carregador, calor e cadência; arma com efeito próprio diz quanto conta num alvo
   parado (`Barrage.onTarget`) para a bancada não mentir. Escreva as metas em `combat/weapons.test.ts`: sozinha, uma arma que
   derruba um Mech leva mais de 4,5 s; com outra, mais de 2,5 s; arma de apoio, bem mais (a chuva, mais de 10 s).
5. **Hangar:** `ui/HangarMenu.ts` (`WEAPON_HINT`, `WEAPON_ICON`) e **em quais chassis e em qual encaixe ela vai** (`ARM_SLOTS` em
   `entities/chassis.ts`; a carga conta pelo peso e por encaixe: dois ombros pesam o dobro).
6. **Desenho:** `entities/weaponModels.ts` (o `switch` do `build`) vale para os robôs com encaixe de arma desenhado (hoje o
   Marauder). Os procedurais (Vector-09, Onça, Colossus, Arara) desenham a arma no próprio rig, em `entities/mechBlueprint.ts`: o
   braço direito é um cano fixo; o esquerdo, o casulo de foguetes, ou liso quando a arma é a chuva de mísseis, que vira um morteiro
   nas costas (`buildBackMortar`, oculto até ser equipado; o gancho é o `mountWeapons`). **Arma nova num procedural = um grupo
   oculto no rig + um ramo em `mountWeapons`**; nunca mova a boca de simulação por arma (G14, ver o comentário no rig). O Lancer
   usa a arma do `.glb` dele.
7. **Rede** (se a arma atira): `NET_WEAPONS` em `shared/net/events.ts` (**só no fim**) e `PROTOCOL_VERSION` + 1 em
   `shared/net/constants.ts`; `server/ArenaRoom.ts` (o `onFired` do sistema vira o evento de tiro) e
   `net/OnlineSession.ts` `remoteShot` (o desenho do tiro do outro jogador). **Subir o protocolo recusa quem está com a versão
   velha: o servidor precisa estar atualizado antes (`DEPLOY.md`).**
8. **Site:** a landing e a Oficina leem o código (`scripts/site/dados.mjs`); rode `npm run site -- --check` e olhe se a arma
   nova não entrou num número que ela não devia (a carga de fábrica, "uma arma sozinha ≥ ...").
9. **Registro:** `STATUS_REAL.md` (o que é real e o que é só desenho), `HISTORICO_DE_DECISOES.md`, `ESTADO_ATUAL.md`, `ROADMAP.md`.

Teste de mutação nas regras novas (estrague a regra e veja o teste cair) é o que garante que o teste serve.

## Robô novo

- **Malha importada** (a via de hoje): `MECHS_IMPORTADOS.md` do pedido ao gerador ao PR. Comandos: `npm run mech:inspecionar -- arquivo.glb`
  (confere o arquivo) e `npm run mech:bocas -- <id>` (mede de onde cada arma atira e confere com o dado do chassi).
- **Dados:** `CHASSIS`, `CHASSIS_SIZE` (o tamanho: 1 andróide, 2 Mechs, 3 e 4 gigantes) e `ARM_SLOTS` em `entities/chassis.ts` (vida, velocidade, calor, carga, o que cada encaixe aceita) e, se o
  robô atira por mais de uma mão ou tem ombros, `triggers` e `muzzles` (`combat/mounts.ts`).
- **Mais de um gatilho por lado, ombros:** já existe (Marauder). Peito, cabeça e costas são ideia (`ROADMAP.md`).
- **Corpo que não é bípede** (cão-robô, esteira, drone): ideia, ainda sem plano de corpo no código (`ROADMAP.md`).

## O que ainda não é dado puro (honestidade)

Comportamentos de arma são código. O caminho para uma arma nova ser **só dado** é uma lista de padrões de disparo (reto, em arco,
chuva, rajada, feixe) escolhidos por um campo da arma, cada um com seu sistema testado. Hoje há dois (reto e chuva). Um editor
visual que cria arma e robô sem mexer em código **não existe**; as POTÊNCIAS são o mais perto disso.

## Trilho e EMP (06/10, Codex)

`chargeTime` usa `ChargeTimer` em Armament e na bancada: só dispara após a carga inteira, cancelada por soltar o gatilho, perder o braço, trocar montagem ou superaquecer. `empHeat` passa por `EmpEffect` e aquece o alvo conforme a distância; o bloqueio ocorre pela regra existente de superaquecimento, sem impedir caminhar. `tracer` escolhe o desenho no pool de projéteis. Procedurais e Marauder usam os mesmos modelos; a boca física continua a do chassi. Cada nova arma também ganha uma mira em `WeaponReticle`.

O protocolo atual é 6 (catálogo inclui geradores frontal/esférico; formato de pacote do 5). O dono pediu que o servidor público offline não fosse tocado hoje: validação online somente com servidor local efêmero. Quando o servidor público voltar, deve usar este código/protocolo; não houve tentativa de atualização dele nesta entrega.


## Compatibilidade ampliada — 06/10, Codex

ARM_SLOTS compartilha engates de energia entre Mechs; não duplicar listas na UI ou no site. validateLoadout continua árbitro de massa e encaixe. Armament mantém lançadores por mão quando o principal é munição (Onça); rearm renova os carregadores. Procedurais usam weaponModel nas variantes fora do canhão/casulo de fábrica, mantendo a boca física fixa. GLBs integrados ainda não trocam aparência.

Próximas propostas (não equipáveis): feixe térmico contínuo com exigência de mira/calor e arpão magnético com contrajogo/massa/rompimento do cabo. Não são novos IDs do catálogo ainda.

## Estados de fogo, choque e gelo — 09/10, Claude

Arma que **aplica um estado** no alvo usa o campo `inflicts` (`'burn' | 'shock' | 'chill'`) na entrada de `BASE`; o resto é do contrato de
`combat/StatusEffects.ts` (`.decepticons/ARMAS_ELEMENTAIS.md`): o `CombatSystem` aplica no acerto que chega ao corpo, o `Match` faz o tempo
correr antes dos pilotos, o `MechBase` lê `status` (velocidade, travas de tiro, dano recebido), e o servidor manda o byte `fx` de cada unidade.
Números em `STATUS` (um lugar só); resistência por chassi em `MechStats.statusResist`. **Arma que não atira projétil** (lança-chamas,
rotatória) liga `status.flaming`/`status.spinning` no dono em vez de mandar um evento por tiro. A rotatória (`spin` na entrada de `BASE`) é o modelo: a regra fica em `SpinUp` (`trigger.ts`), o desvio em `spread.ts` (por número de tiro, sem sorteio), o servidor sai cedo em `ArenaRoom.shot` quando a arma tem `spin`, e o outro jogador desenha o fluxo pela bandeira, lendo a arma da montagem do roster. A elétrica (`inflicts: 'shock'`, `tracer: 'arc'`) é o modelo das armas de projétil que aplicam estado: o `CombatSystem` só aplica quando pelo menos `STATUS.shieldPass` do dano passou pelas defesas, e a cor da faixa vem do `tracer` (`ProjectileSystem`).

## Armas do botão 2 (ombros, costas, peito) — 11/10, Claude

O mapa de ideias com o custo de cada uma, o que existe hoje por lugar do corpo e o contrato de uma arma de botão 2 estão em **`.decepticons/ARMAS_DE_BOTAO_2.md`**. O canhão sônico (`sonic`) é o modelo de **arma de ombro com efeito de área e empurrão**: campo `wave` na arma (`Wave`: meio ângulo e velocidade do empurrão), `ShotSink.wave`,
`Match.waveCone` (a regra) e `MechBase.push` (o empurrão). Arma nova de ombro = **uma entrada em `ARM_SLOTS[chassi].shoulders`** (e a carga conta por boca); os registros `IMPACT_FX`, `MUZZLE_FX`, `FIRE_KICK`, mira e Hangar quebram o typecheck se faltarem.

## Anel de fogo (módulo de escudo `fire`) — 11/10, Claude

O anel de fogo não é arma: é o terceiro `ShieldId` do gerador de energia (`combat/EnergyShield.ts`, números em `FIRE_RING`). Módulo novo de escudo = uma entrada em `SHIELDS` (o Hangar, a carga e a rede leem dali) +
o que ele **faz**: aqui `combat/FireRing.ts`, chamado pela partida (`Match.ringTick`) quando o gerador marca um pulso (`consumePulse`). O desenho: `ShieldVisuals` (o que fica no chão) e um `fx/…Visuals.ts` próprio
(as partículas), os dois pela bandeira de escudo ligado que já viaja na rede. Falta fazer: o texto do Hangar (`hangar-module-select`) e o rótulo do HUD (`ShieldHUD`) são strings soltas, não leem `SHIELDS`.

## Armas de aço (tiro de metal) — 11/10, Claude

O canhão pesado (`cannon`) e o canhão automático (`autocannon`) são o modelo de **arma de projétil que se vê como metal**, não como luz: `tracer: 'shell'` (obus) ou `'slug'` (projétil fino) na entrada
de `BASE`. O `ProjectileSystem` troca a faixa de luz por um **corpo de aço sólido** (`fx/kineticShot.ts`: `KINETIC` tem as medidas, `buildSlugGeometry` a bala) com a cauda quente atrás (mais
fina que o corpo, senão ela o lava). Três tabelas `Record<WeaponId, …>` a mais pedem uma decisão por arma nova: `MUZZLE_FX` (`fx/muzzleFx.ts`: o clarão da boca; `null` = o genérico do jogador; `casing`
solta o estojo), `IMPACT_FX` (o impacto) e, para o rastro de partículas no voo, `TRAIL_FX` (`fx/impactFx.ts`: gelo e obus). Quem fecha a conta de equilíbrio é a bancada: **arma nova confira o combo
com os foguetes MK III e com ela mesma nas duas mãos** (`steelWeapons.test.ts` é o modelo): a 1ª conta do canhão (100 de dano a cada 2,4 s) violava a meta de 2,5 s. Ao calibrar por `sed`, ancore
no nome da arma (um `sed` por números pegou o lança-chamas junto).

## Natureza do dano — 06/10, Claude

Toda arma declara a natureza do dano em `DAMAGE_TYPE` (`client/src/combat/weapons.ts`): o `Record` quebra o typecheck se faltar. Os escudos físicos (`MetalShield.ts`) resistem por natureza. Arma sônica futura usa `sonico` (o Amortecedor já está pronto para ela).
