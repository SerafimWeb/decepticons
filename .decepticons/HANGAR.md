# HANGAR — especificação técnica (em projeto)

> Documento de design do sistema de montagem de Mechs. Dono do tema: Claude (simulação, contrato, equilíbrio);
> tela inicial implementada pelo Codex em `client/src/ui/HangarMenu.ts`. O resumo para o jogador fica em `GAME_DESIGN.md`, seção HANGAR
> (a landing lê de lá). Criado em 2026-09-25, a pedido do dono: "quero começar a projetar nosso HANGAR pra receber
> os mechs"; "3 níveis de poder em cada arma; dano realista, sem apelação; a diferença vem da técnica, das
> habilidades e da customização de cada jogador".

## 1. Objetivo

Dar a cada jogador um Mech montado do seu jeito **sem que ninguém fique simplesmente mais forte**. Montar é
escolher trocas: mais poder de fogo custa blindagem, mobilidade ou calor. A habilidade decide a luta; o Hangar
decide o estilo.

**Princípios (não negociáveis):**
1. **Orçamento fechado.** Todo chassi tem uma carga máxima; tudo o que se monta pesa. Não existe peça "de graça".
2. **Uma regra para todos os níveis.** MK I, MK II e MK III seguem a mesma tabela (`combat/weapons.ts`, `TIERS`).
3. **Metas de equilíbrio travadas por teste.** Nenhuma montagem passa do limite de tempo para derrubar (seção 4).
4. **Conquistado jogando, nunca comprado** (`GAME_DESIGN.md`, "Não é pay-to-win").
5. **Mesma simulação no cliente e no servidor** (G14): a validação da montagem é uma função pura em `shared/`.

## 2. Modelo de dados (contrato)

Estado em 25/09 (fim do dia): **o que já está no código** está marcado ✅; o resto é proposta.

| Tipo | Onde | O que carrega |
|---|---|---|
| `WeaponStats` ✅ | `combat/weapons.ts` | arma já no nível: dano, cadência, calor por tiro, carregador, velocidade, alcance ótimo/máximo, queda com a distância, raio de explosão, massa |
| `TIERS` ✅ | `combat/weapons.ts` | a regra dos níveis: MK II = ×1,2 dano, ×1,15 calor, ×1,5 massa; MK III = ×1,4, ×1,3, ×2 |
| `Loadout` ✅ | `combat/weapons.ts` | `{ primary, secondary }`: o que vai em cada braço. Hoje cada chassi traz o de fábrica (`MechStats.loadout`) e o Mech expõe `mech.loadout` |
| `ChassisHeat` ✅ | `combat/heat.ts` | o dissipador do chassi: resfriamento, atraso, limite de volta. **Um dissipador para todas as armas** |
| `MechStats` + `weaponCapacity` ✅ | `entities/chassis.ts` | os números de cada chassi sem 3D (o servidor e o site leem daqui) e a **carga de armas**: Vector-09 = 11 t |
| `LoadoutSpec` ✅ | `hangar/loadout.ts` | o que viaja e se salva: `{ v: 1, chassis, right: { id, tier }, left: { id, tier } \| null }`; texto curto `v1.vector09.plasma-2.rockets-0` (`loadoutKey`/`parseLoadoutKey`) para link e rede. Módulos e blindagem entram numa versão 2 do formato |
| `validateLoadout(spec)` ✅ | `hangar/loadout.ts` | regra pura, sem 3D: formato, chassi, arma, nível, encaixe (energia no direito, munição no esquerdo), carga ≤ capacidade, nível liberado. Devolve o `Loadout` pronto ou o motivo (`formato`, `chassi`, `arma`, `nível`, `encaixe`, `carga`, `bloqueado`). Vai para `shared/` com a separação do multiplayer |

**Encaixes:** braço direito = arma de **energia** (tiro principal, limitado pelo calor); braço esquerdo = arma de
**munição** (carregador que recarrega sozinho). Ombros e torso = **módulos**. Perna não leva nada: é mobilidade.
O desenho do encaixe e da arma (o "punho" sem dedos, o módulo de arma, o roteiro do próximo robô): `MECHS_IMPORTADOS.md`.

**API para a tela (Gemini):** `game.hangar` (`hangar/Hangar.ts`):
- `current`: a montagem atual (salva no aparelho em `cybermech.hangar.v1`, ou a de um link `?build=`, ou a de fábrica);
- `check(spec)`: validação na hora (carga usada, capacidade, motivo da recusa);
- `report(spec)`: números da simulação para a tela: carga, tempo para derrubar um torso, em quantos segundos ferve correndo com tudo disparando, dano em 20 s;
- `apply(spec)`: salva e agenda; o Mech troca de armas no próximo renascimento (ou na rodada nova), inteiro e frio;
- `key`: o texto do link para compartilhar; `onChange`: avisa quando a montagem muda;
- `armOptions('right' | 'left', chassis)` e `TIERS`: o que listar em cada braço de cada chassi (`ARM_SLOTS` em `entities/chassis.ts`); `factorySpec(chassis)`: a montagem de fábrica de um chassi.

**Segundo chassi (25/09): `android`,** o andróide pilotado: blaster no braço direito, motosserra no esquerdo, carga de 3 t (os dois no MK III não cabem). Trocar de chassi troca o modelo inteiro: hoje o botão da pausa salva e recarrega a partida; a tela do Hangar pode fazer igual.

**Carga de 11 t no Vector-09 (25/09):** das 9 combinações de plasma e foguetes cabem 6. MK III num braço obriga MK I no outro; MK II nos dois cabe. **Achado:** com os dois braços disparando, todas as montagens derrubam um torso em 3,3–3,5 s, porque o calor do Mech é o limite. O nível decide nas rajadas de uma arma só (plasma MK III 5,0 s contra 6,2 s do MK I). Quem administra o calor ganha, não quem subiu de nível.

## 3. Chassis (proposta, a calibrar no playtest)

| Chassi | Classe | Carga | Blindagem | Velocidade | Dissipador | Estado |
|---|---|---|---|---|---|---|
| **Arara-B1** (era "Ferret-X" nesta proposta) | leve · escala 1 | 8 t | torso 200 | 13 m/s | padrão | **no jogo** (29/09, Arara Foundry) |
| **Vector-09** | médio · escala 2 | 18 t | 100% (torso 300) | 9 m/s | 0,7/s | **no jogo** (armas de fábrica: 7 t) |
| **Onça-B2** | pesado · escala 2 | 16 t | torso 450 | 6 m/s | padrão | **no jogo** (29/09, Arara Foundry) |
| **Colossus-01** | cerco · escala 3 (decidido: não é o "pesado" desta linha) | 24 t | torso 1200 | 5 m/s | padrão | **no jogo** (29/09), não balanceado contra bots de propósito |

**Blindagem extra:** a carga que sobra das armas vira blindagem (proposta: 1 t = +30 de vida, distribuída pelo
jogador entre as partes, com teto por parte). É isso que fecha a conta: MK III nos dois braços deixa o Mech
sensivelmente mais frágil.

**Módulos (proposta):** dissipador extra (+15% de resfriamento), radar (vê mais longe), escudo frontal
(absorve dano por alguns segundos, recarrega), kit de reparo (conserta uma parte uma vez por vida). Cada um com
massa e, quando fizer sentido, os mesmos três níveis.

## 4. Equilíbrio (no código desde 25/09)

Medido pela simulação do jogo (`combat/balance.ts`: cadência, calor e carregador no tick fixo), com **todos os
tiros no torso** de um Vector-09 (300). É o teto teórico: no jogo, errar e se mover deixam tudo mais lento.

| Meta | Valor hoje | Teste |
|---|---|---|
| Plasma MK I derruba em 5 a 7,5 s de gatilho apertado | 6,2 s | `weapons.test.ts` |
| Nenhuma arma sozinha, em nenhum nível, abaixo de 4,5 s | 5,0 s (plasma MK III) | idem |
| Nenhum combo dos dois braços abaixo de 2,5 s (o calor compartilhado segura) | 3,1 s (MK III + MK III) | idem |
| Combinar os braços rende (combo < 75% do plasma sozinho) | 3,5 s contra 6,2 s | idem |
| MK III de 10% a 40% mais rápido que o MK I | plasma 18%, foguetes 35% | idem |
| Dano por tonelada cai a cada nível (poder custa carga) | plasma 11,9 → 8,3 → 7,0 | idem |
| Mirar na perna rende (perna < metade do tempo do torso) | 2,0 s | idem |
| Arma leve não ameaça Mech (blaster do andróide > 25 s) | 36 s | idem |

**Por que o calor é do Mech, e não de cada arma:** com calor separado, plasma MK III + foguetes MK III
derrubavam um Mech em 0,9 s (tudo descarregado de uma vez). Com um dissipador só, disparar os dois braços
esquenta o Mech inteiro, ele trava antes de terminar o serviço, e o combo fica em ~3 s. É também o mais
realista: o calor de toda arma sai pelo mesmo chassi.

**Dano e distância:** o plasma tem dano cheio até 60 m e cai em linha reta até 40% a 200 m, onde se desfaz. O
foguete não perde força com a distância, mas é lento (75 m/s): de longe, dá tempo de desviar. A explosão cai
do centro (100%) até a borda do raio (0).

## 5. Progressão (proposta)

- Tudo do combate se libera **jogando**: experiência por rodada (abates, partes arrancadas, técnicos derrubados).
- Ordem sugerida: MK II das armas de fábrica → segundo chassi → módulos → MK III.
- Sem compra, sem atalho pago. Vender, só pintura e neon (`GAME_DESIGN.md`).
- Sem conta (convidado): o progresso fica no aparelho. Com contas (Fase 6), vai para o servidor.

## 6. Tela do Hangar (primeira versão, Codex; substituída pelo Hangar 2.0, seção 6b)

Fluxo implementado: tela inicial ou pausa → `[ ABRIR HANGAR ]` → escolher Vector-09 ou andróide A-1 → selecionar
braço direito/esquerdo no painel ou no hotspot da silhueta → escolher nível MK e, no braço esquerdo, esvaziar o
encaixe → conferir carga, calor, TTK e dano → `[ APLICAR MONTAGEM ]`. A montagem usa `game.hangar`; segue validada
e salva em `cybermech.hangar.v1`. Troca de arma entra no próximo respawn; troca de piloto aplica a montagem de
fábrica e recarrega a partida sem reaplicar um `?build=` antigo. O link mostrado na tela codifica o rascunho atual.

**Prévia:** quando o chassi selecionado é o piloto atual, a tela mostra o Mech real da partida pausada pelo
renderer existente. O rig é reduzido e levantado só durante a tela e gira lentamente no eixo; ao sair, escala e
pose voltam ao jogo. Não há segundo renderer, cena extra nem malha nova. Ao pré-selecionar um chassi diferente,
aparece uma silhueta esquemática até aplicar/recarregar, evitando mostrar o modelo errado.

**Leituras:** carga, calor, dano e TTK vêm da simulação padrão (`game.hangar.report`), não incluem ajustes
experimentais do painel POTÊNCIAS. Aplicar um nível inválido por carga é bloqueado pela validação do contrato.
Ombros e torso aparecem como slots futuros, sem fingir que módulos já existem. A versão inicial foi verificada
no browser em desktop para seleção, alteração de carga, persistência MK III e troca de piloto; falta playtest do
dono em desktop e celular.

## 6b. Hangar 2.0 (Claude, desde 26/09)

**Pedido do dono (26/09):** "a tela do Hangar não está funcionando direito; precisa de muitas camadas de qualidade; a
inspiração veio desta foto e não ficou nada a ver". Referência: `.tmp/arte/hangar-referencia.png` (galpão industrial,
Mech num pedestal com coluna de holograma ciano, lâmpadas quentes, passarelas com Mechs e pessoas, telas de holograma
flutuando, console grande de "caminhos de customização", mesa de controle, barra de topo, atalhos 1 a 4). O dono
decidiu que o Claude refaz, em camadas, um PR por camada, com captura de tela em cada uma.

**Problemas da primeira versão** (vistos no navegador em 26/09): o centro mostrava a câmera do jogo olhando o Mech de
costas no meio da arena, com prédios e bots atrás; o andróide aparecia como desenho esquemático (inconsistente); o
"aplicar" com o mesmo chassi só valia no próximo renascimento (parecia não funcionar); no celular não cabia.

**Camadas:**
1. ✅ **Galpão 3D próprio** (`hangar/HangarScene.ts`): desenhado no lugar da arena enquanto o Hangar está aberto (o jogo
   fica pausado). Piso de placas com bordas ciano, pedestal com anéis e disco de montagem, coluna de holograma dupla com
   linhas de varredura correndo, anel de varredura subindo e descendo pelo Mech, lâmpadas quentes com fachos e tremor,
   luz de frente e contraluz, passarelas, Mechs e andróides escuros parados, telas de holograma com a planta de um Mech,
   névoa. O Mech da montagem fica no pedestal, girando sozinho (uma volta a cada 28 s); arrastar gira. Robô pequeno
   aparece ampliado (mínimo de 3,2 m, como um holograma de montagem). Tudo feito por código, sem arquivo para baixar.
   **Aplicar na hora:** offline, as armas trocam na hora, com o calor de agora (a pausa não esfria o Mech); online, vale
   na próxima entrada na sala (o servidor só conhece a montagem da entrada).
2. ✅ **Interface holográfica** no desenho da referência (`ui/HangarMenu.ts`, reescrita): barra de topo (marca, carga,
   piloto, offline ou a sala online), painel do chassi com a planta de cada robô em traço, console "caminhos de montagem"
   (armas; blindagem e módulos marcados "em breve"), os dois braços com ícone, nível de potência e barras de dano,
   cadência, calor, alcance e carga (a arma nova contra a que está no Mech, com seta de melhora ou piora), faixa de
   leituras embaixo, marcadores dos braços presos a eles (acompanham o giro, com traço até o rótulo), vidro ciano com
   colchetes nos cantos e linhas de varredura, entrada acendendo como holograma. Celular em pé: galpão em cima, um
   painel por vez embaixo, com abas; deitado: Mech à esquerda, painel à direita.
3. ✅ **Testar disparo e montagens 1 a 4:** `▶ TESTAR DISPARO` esconde os painéis, abre a câmera, vira o Mech para o
   alvo do galpão e dispara a arma do braço escolhido por 4 s, no ritmo das regras do jogo (`hangar/testFire.ts` usa a
   bancada da oficina com a hora de cada tiro: cadência, carregador, calor e trava). A tela conta tempo, tiros, dano e o
   calor subindo até travar; no fim, o resumo. Os atalhos 1 a 4 embaixo do pedestal: vazio salva a montagem da tela,
   cheio carrega (teclas 1 a 4), `SALVAR` sobrescreve; salvos em `cybermech.hangar.presets.v1`, validados na leitura.
4. **Treino manual de mira (Codex, PR #95 mergeado; aguardando playtest do dono):** `◎ TREINO DE MIRA · ALVO MÓVEL` captura o mouse e usa
   o mesmo `CameraRig`/sensibilidade do jogo, com um andróide de escala 1 andando de lado a lado, sem atacar nem
   receber dano de combate. Segurar o botão esquerdo dispara no ritmo da arma selecionada; o raio da câmera só mede
   acerto no alvo e alimenta o contador local (disparos, acertos, precisão). `Esc` libera o mouse e retorna ao Hangar.
   Não substitui o teste balístico de 4 s: não simula dano, calor, dispersão nem projétil em física. O modelo usa a
   animação procedural já existente; movimento determinístico a 2,4 m/s numa faixa de 9 m. Pool de tiros e flashes
   existente, zero objetos por quadro; custo extra de render só durante o Hangar/treino (+o rig do Android, oculto
   fora do treino). Toque não oferece este modo: continua usando o teste de disparo.

**Critérios de aceite de cada camada:** captura de tela no PR (computador e celular), sem erro no console, o jogo
offline e online iguais ao de antes, e nenhum custo por quadro com o Hangar fechado.

## 7. Multiplayer

- O cliente manda só o `LoadoutSpec` (ids e níveis, ~10 bytes) ao entrar e ao trocar, nunca números de dano.
- O servidor roda `validateLoadout` (a mesma função do cliente) e usa **os números dele**: montagem adulterada é
  recusada, não aplicada (G13).
- Os outros jogadores recebem só `{ chassis, arms }` para desenhar o Mech (as armas aparecem no modelo).

## 8. Custo de CPU

Zero por tick além do que já existe: a arma é um objeto congelado lido na hora do tiro (`weapon(id, tier)` não
aloca), o calor é um dissipador por Mech. A queda por distância é uma conta por impacto. A tela do Hangar só roda
com o jogo pausado.

## 9. Etapas (um PR cada)

1. ✅ Arsenal em dados, três níveis, calor do Mech, cadência exata, metas de equilíbrio travadas por teste (Claude).
2. ✅ `LoadoutSpec` + `validateLoadout` + carga por chassi + montagem salva + link `?build=`, com testes (Claude, 25/09).
3. ✅ Tela inicial do Hangar contra o contrato (Codex, 2026-09-26).
4. Blindagem distribuível e o segundo chassi (Claude).
5. Módulos (Claude + Gemini no visual).
6. Progressão (depois do multiplayer, junto com as contas).

## 10. Decisões do dono

- Colossus-01: chassi pesado do Hangar (escala 2) ou máquina de cerco (escala 3)?
- Nível liberado vale para todas as armas daquele tipo, ou cada arma sobe separado?
- No multiplayer, salas separadas por nível de Hangar, ou todos juntos (o orçamento de carga já equilibra)?


O treino móvel aceita somente armas de tiro; a motosserra continua coberta pelo teste de disparo existente.

## Equipamentos defensivos — decisão do dono em 06/10/2026

Planejamento, ainda sem mecânica implementada. O campo de força ocupa um **slot de módulo extra**, preservando uma arma em cada braço. Não confundir com calor: será necessário um reservatório de energia separado, validado no cliente e servidor.

| Equipamento | Comportamento solicitado | Proposta de equilíbrio a validar |
|---|---|---|
| Barreira frontal | Acompanha a mira e o movimento do robô; proteção direcional temporária | Consumo enquanto ligada e ao absorver impacto; flancos e costas vulneráveis |
| Esfera de energia | Cobertura completa, versão mais poderosa | Maior massa, consumo e recuperação; impedir que substitua automaticamente o frontal |
| Escudo metálico removível | Instalação apenas em chassis com suporte compatível, incluindo a evolução do Lancer | Ocupa uma mão e substitui a arma desse braço (confirmado pelo dono); massa e integridade próprias |

O escudo atual do Lancer é visual; não comprova bloqueio de dano. Próxima implementação: contrato versionado de equipamentos por encaixe, capacidade de carga somando armas e módulos, compatibilidade explícita por chassi e migração das montagens antigas. Depois, energia e barreira frontal na simulação compartilhada, com testes direcionais; só então esfera e escudo físico. Números de duração, absorção, recarga e tecla permanecem em aberto.

As duas armas sugeridas em conversa são um canhão de trilho carregável (precisão, aviso visual e calor) e um lançador EMP (controle de energia/escudos, sem paralisar completamente na primeira versão). Autorizadas pelo dono em 06/10; implementação em andamento. O EMP inicial aquece circuitos até existir a reserva energética dos escudos. Novos comportamentos devem ter módulos testados; variantes numéricas permanecem no catálogo central.
