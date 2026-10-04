# ARSENAL — como criar e configurar armas e robôs

> Escrito em 04/10 depois de criar a escopeta (PR #154) e a chuva de mísseis, para ninguém redescobrir a lista. Robô importado:
> `MECHS_IMPORTADOS.md`. Encaixes e gatilhos: `combat/mounts.ts`. O que cada coisa é de verdade hoje: `STATUS_REAL.md`.

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
   arma (a chuva tem `barrage`), nunca um `if (id === ...)` espalhado.
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
6. **Desenho:** `entities/weaponModels.ts` (o `switch` do `build`). Só aparece nos robôs com encaixe de arma desenhado (hoje o
   Marauder); os procedurais (Vector-09, Onça, Colossus, Arara) mostram o cano ou o casulo fixo, e o Lancer, a arma do `.glb` dele.
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
- **Dados:** `CHASSIS` e `ARM_SLOTS` em `entities/chassis.ts` (vida, velocidade, calor, carga, o que cada encaixe aceita) e, se o
  robô atira por mais de uma mão ou tem ombros, `triggers` e `muzzles` (`combat/mounts.ts`).
- **Mais de um gatilho por lado, ombros:** já existe (Marauder). Peito, cabeça e costas são ideia (`ROADMAP.md`).
- **Corpo que não é bípede** (cão-robô, esteira, drone): ideia, ainda sem plano de corpo no código (`ROADMAP.md`).

## O que ainda não é dado puro (honestidade)

Comportamentos de arma são código. O caminho para uma arma nova ser **só dado** é uma lista de padrões de disparo (reto, em arco,
chuva, rajada, feixe) escolhidos por um campo da arma, cada um com seu sistema testado. Hoje há dois (reto e chuva). Um editor
visual que cria arma e robô sem mexer em código **não existe**; as POTÊNCIAS são o mais perto disso.
