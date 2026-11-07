# AUDITORIA DO HANGAR — contrato, seleção de armas e botões (P319, passo 1, 06/11)

> **Pedido do Comandante (06/11):** *"precisamos rever o contrato, a lógica da usabilidade do hangar, da seleção de armas, setup dos botões, pois ainda há falhas e descompassos, itens ainda mal elaborados ou incompletos, e sinto que ainda pode ter uma concorrência ou algo quebrado, ou talvez coisas duplicadas, redundantes… vamos passo a passo."*
> **Como foi feita:** um agente auditor leu o código da `main` (`f0a7334`) **sem executar nada**; depois **eu reconferi**: os achados de maior peso foram **reproduzidos executando a função** (teste temporário, já removido) e os demais, relidos no trecho citado. **Nada foi corrigido neste passo:** cada correção vai num PR próprio, na ordem do plano (§ 3).
> **As linhas são de `f0a7334`** e vão derivar: procure pelo trecho citado, não pelo número.

**A marca de cada achado:** ✅ **reproduzido** (executei o código e o defeito apareceu) · 📖 **relido** (li o trecho e a cadeia até o defeito; não executei) · 🔎 **do auditor** (o trecho existe; o efeito não foi reproduzido) · ❓ **não reconferido** (só o relato do auditor).

## 1. A resposta sobre o contrato

**Não existe uma fonte única para o botão de cada arma.** O que cabe em cada encaixe (direita, esquerda, ombros, costas) vem de `ARM_SLOTS`, e essa parte está boa. Já **qual botão dispara qual encaixe** vem de três lugares que não conversam: os gatilhos do chassi (`mounts.ts`), os `botoes` da montagem (`loadout.ts`) e os rótulos do HUD, que ainda supõem "direita = botão 1". O cliente e o servidor usam a **mesma função de validação**, mas o cliente valida o objeto e o servidor valida a **chave de texto**, e essa chave perde dados (achado 2): é onde o contrato quebra.

## 2. Os achados (17)

### Quebrado

**1. A cor comprada some ao reabrir o Hangar** · 📖 relido
`HangarMenu.ts:950`, `copySpec` copia `v`, `chassis`, `right`, `left`, `botoes`, `module`, `layout`, `shoulders` e os encaixes extras, **mas não `pintura`**. `open()` (:512) refaz o rascunho com ela, e `apply(this.draft)` grava o rascunho inteiro (`Hangar.ts:86-92`). Efeito: comprar uma cor, APLICAR, reabrir: a tela marca "DE FÁBRICA · EM USO"; ao trocar uma arma e APLICAR, a montagem é gravada **sem a cor**. É dinheiro (Créditos) gasto numa compra que some. Correção: copiar todos os campos (`structuredClone`). Teste: `copySpec(s)` igual a `s` em todos os campos, para uma montagem com todos eles preenchidos.

**2. A chave de texto perde módulo e layout, e às vezes não volta** · ✅ reproduzido
`loadout.ts:298-309` escolhe a versão da chave pelo `spec.v`, não pelo conteúdo.
- **A:** montagem v4 **sem botão escolhido** e com módulo (o que sobra depois de clicar "PADRÃO DO CHASSI") é **válida**, mas a chave sai na versão 1 (`:302` manda o v4 sem botão para v1 quando não há encaixe extra) e **o módulo some na ida e volta** (executei). Online o servidor monta o robô sem o escudo ou a visão noturna. O Marauder perde o layout `L1` pelo mesmo caminho (deduzido do código, não executado).
- **B:** Colossus-01 (v3) com as costas esvaziadas é **válido**, mas gera `v3.colossus01.cannon-0.-` (a versão 3 com o corpo da 1); `parseLoadoutKey` exige nove grupos (`:352`) e devolve **`null`**. O JOIN é recusado (`ArenaRoom.ts:346`).
- Correção: escolher a versão pelo **conteúdo** (módulo, layout, extras, botões), numa função só. Teste: ida e volta exaustiva (chassi × módulo × layout × extras × botões × cor). **Risco alto** (rede): o servidor já lê v1 a v4, então não precisa de protocolo novo.

**3. Editar numa certa ordem trava o APLICAR, com aviso errado** · ✅ reproduzido (a recusa) + 📖 relido (a causa); o resto é do auditor
`HangarMenu.ts:690` (módulo) e `:625` (layout) fazem `this.draft = { ...this.draft, v: 2, … }`, rebaixando uma montagem v4 (li as duas linhas). Aí `loadout.ts:269` recusa com `'botões só na versão 4 da montagem'` (a recusa eu executei). **Do auditor, não reconferido:** esvaziar um encaixe que tinha botão deixa o botão órfão (`loadout.ts:274`) e o controle some da tela (:809); para qualquer erro, `:856` diz só "Ajuste a carga". Repro: BOTÃO 2 no braço direito e depois trocar o módulo. Correção: **uma única `normalizar(spec)`** em toda edição, que também limpa o botão de encaixe vazio. Teste: redutor puro com edições em sequência.

**4. O link de build entra demais** · 📖 relido (a parte do `Hangar.ts`), 🔎 do auditor (o resto)
`Hangar.ts:44-47` relê o `?build=` e o **grava por cima da montagem salva a cada carga da página**. Só a troca de chassi tira o parâmetro (`HangarMenu.ts:711`); trocar o MODO (`Game.ts:1070-1073`), `reloadWithout('sala')` e o F5 o mantêm. Repro: abrir `?build=v1.vector09.plasma-1.rockets-1`, aplicar plasma MK III, trocar o modo: a montagem volta ao MK II. O link também traz cor não comprada (`.P6`) e arma restrita (a validação só confere `pinturaValida`, `loadout.ts:206`). Correção: consumir o parâmetro com `history.replaceState`, perguntar antes de sobrescrever a montagem salva e descartar a cor que o piloto não tem. Teste: função pura `consumirLink(href)`.

### Descompasso

**5. O HUD e a pausa nomeiam o botão errado** · 🔎 do auditor
`Game.ts:200-201` (`primaryLabel` e `secondaryLabel` vêm de `l.primary`/`l.secondary`) e `HUD.ts:262` (`this.rockets.hidden = text === null`) supõem o desenho antigo. Repro 1: braço esquerdo no botão 1: o cartão "ATAQUE 1" diz plasma, mas o clique solta foguete. Repro 2: Colossus-01 de fábrica: o cartão "ATAQUE 2" some e a pausa diz "sem arma", mas o clique direito solta a chuva. Os encaixes extras nunca aparecem no HUD. Correção: função pura `armasPorBotao(loadout, triggers)` usada pelo HUD, pela pausa e pelo toque. Teste: unitário dela.

**7. "TUDO NO 1 · PRINCIPAL NO 2" com uma arma só deixa o botão 1 vazio** · 📖 relido
`loadout.ts:117`: `const principal = armados.includes('back') ? 'back' : 'rightHand'` e `:120`: `out[slot] = slot === principal ? 2 : 1`. Com **uma** arma armada (Lancer-L1 de fábrica), ela é a "principal" e vai para o **botão 2**; o clique esquerdo não faz nada. Correção: arma única fica no 1. Teste: `botoesDoPreset(factorySpec('lancerL1'), 'tudo1')`.

**13. Rótulos que não batem com o jogo** · ❓ não reconferido
`HangarMenu.ts:293` diz "Ctrl liga e desliga" (a tecla é remapeável); `ShieldHUD.ts:50` diz "SEGURE FOGUETE" (o botão de toque se chama "ATQ 2"); `HangarMenu.ts:451`: o treino de mira nas costas diz "OMBROS"; `:827`: o Lancer sem chapa aparece como "ESCUDO"; `:855`: "O escudo ainda não bloqueia dano" é um ramo que nunca roda. Correção: usar `keyLabel` e `SLOT_LABEL` e apagar o ramo morto.

**14. O painel voltou a esconder a arma (o problema C6 da auditoria de interface)** · ❓ não reconferido
`HangarMenu.ts:288-293`: COR DO CASCO e BOTÃO/PRESETS ficam entre os encaixes e o seletor de arma. Na captura `arte/cor-publica-hangar-claude.jpg` (1280×720) os controles de TESTAR, as barras e o MÓDULO ficam abaixo da dobra; os presets não mostram qual está ativo (:814). **É decisão de desenho do Comandante** (onde cada coisa fica).

### Risco

**6. A chapa de escudo e os encaixes extras disputam o botão 2** · 🔎 do auditor, **decisão do Comandante**
`Armament.ts:141` (`m.guard(secondary && !l.secondary)`) e `mounts.ts:55` (`TRIGGERS_COM_COSTAS` põe `back`, `rightShoulder` e `leftShoulder` no botão secundário). Repro: Colossus-01 com Muralha na mão esquerda: o clique direito **levanta a chapa (robô a 75% da velocidade) e dispara a chuva ao mesmo tempo**; não dá para fazer um sem o outro. Correção, com decisão: a chapa vai para o botão livre, ou recusar extra no botão 2 quando há chapa. **Risco alto** (simulação compartilhada com o servidor).

**8. A montagem da conta entra sem validar e pode trocar o chassi sem recarregar** · 🔎 do auditor (não reproduzido)
`progressoLocal.ts:46` grava o JSON cru no navegador antes do `hangar.apply` (`Game.ts:1095`); `equipPending` (`Game.ts:1563`) não confere o chassi; o Hangar nunca chama `sessao.mudou()` (`Game.ts:1103`); a mescla leva a montagem de quem tem mais XP (`shared/net/auth.ts:302`); montagem salva que deixou de valer vira Vector-09 de fábrica sem aviso (`Hangar.ts:46`). Repro: conta com Colossus-01, aparelho jogando com Vector-09: ao entrar na conta o Hangar mostra "EM USO" no Colossus e o próximo renascimento arma o Vector-09 com o kit do Colossus. **Risco alto** (servidor e conta).

**9. COPIAR LINK leva os parâmetros de quem copia** · 📖 relido (o código), ❓ (o efeito)
`HangarMenu.ts:875`: `const shareUrl = new URL(location.href)` e só `sala` é apagado. Quem copia com `?comandante=1&stream=1&servidor=…` aberto entrega esses parâmetros. Se quem abre o link vira Comandante (`DecisaoDoComandante.ts:28`) depende da variável `VITE_COMANDANTE_POR_LINK` no site, que **não foi conferida**. Correção: montar o link com `origin + pathname` e só o `build`. Teste: função pura.

**10. APLICAR sem mudança recarrega a munição no meio da luta (offline)** · ❓ não reconferido
`Game.ts:1659` → `:1569 this.player.rearm()` → `Armament.ts:122` cria carregadores novos (o calor é mantido de propósito; a munição não). Como o APLICAR já abre com foco (`HangarMenu.ts:522`), basta Esc e Enter. Correção: montagem igual não agenda troca.

**11. Teclas do jogo funcionam com o Hangar aberto e podem colidir com o remapeamento** · ❓ não reconferido
`Game.ts:2225-2277`: L/K (clipe), F8/F9 (gravação), M/B (briefing) e C (CFTV) rodam antes de `if (!this.playing) return`, sem olhar se o Hangar está aberto; `Settings.ts:194` só reserva `['Escape', 'F1', 'Backquote', 'Quote']`. Repro: no Hangar, C liga o CFTV e B toca a sirene; pôr "Ataque 2" na tecla C faz atirar e trocar de câmera juntos. As teclas 1 a 4 não colidem. Correção: ignorar essas teclas com o Hangar aberto e reservá-las no remapeamento. Teste: `validKey('KeyC') === null`.

**12. Cada cor clicada cria um robô novo sem liberar o anterior** · ❓ não reconferido
`HangarScene.ts:641` faz `this.displays.delete(chassis)` sem `dispose`. Correção: recolorir no lugar ou descartar geometria e material. A memória de vídeo **não foi medida**.

### Redundância e incompleto

**15. O botão ⚙️ "Painel Admin" aparece no Hangar e abre um sistema morto** · 📖 relido (`|| true`), ❓ (se aparece para todos)
`HangarMenu.ts:273` tem o botão `data-action="admin"`; `:779` termina em `|| true`, então a condição de `status` nunca filtra nada. Nenhum chassi tem `status` (`MechBase.ts:74` só declara o tipo) e o jogo ainda pede `chassis_status` ao servidor em todo boot. Duplica o painel VISIBILIDADE (P191). Correção: remover (com a confirmação do Comandante).

**16. O mesmo dado em vários lugares** · ❓ não reconferido
O layout L1 do Marauder (`mounts.ts:49`) faz o mesmo que `botoes {leftHand:2}`: duas chaves para um comportamento; `BotaoSlot` (`loadout.ts:36`) repete `MOUNTS`, e o esquadrão usa outras letras, `b/r/l` (`sim/esquadrao.ts:367`); `rightShoulder` muda de sentido conforme o chassi (`encaixesExtras.ts:32`); `CHASSIS_LABEL` (`HangarMenu.ts:52`, com textos velhos) concorre com `CHASSIS_PAPEL`, que o Esquadrão usa; a lista fixa de `HangarMenu.ts:857` é o mesmo que `IMPORTED_CHASSIS` sem `weaponMounts`; as massas dos módulos estão escritas no HTML (:293). Correção: um enum de encaixe e os textos do chassi num lugar só. **Risco alto** (protocolo).

**17. O P289 está quase todo feito, mas os documentos dizem o contrário** · 📖 relido (os três primeiros pontos), ❓ (o resto)
**Relido por mim:** a linha do P289 em `ORDENS_DO_COMANDO.md:119` termina em "ainda sem código"; `AUDITORIA_INTERFACE.md:174` (G8) diz "Aberto (P289)"; e o `STATUS_REAL.md` **não tem P300 nem P301** (as ordens P300 a P302 existem no `ORDENS_DO_COMANDO`). **Do auditor:** P300 e P301 entregaram o motor, a chave v4 e a tela; a P302 está marcada como pausada embora `{leftHand:1}` já seja aceito (`loadoutBotoes.test.ts:48`). **Falta de verdade:** o HUD (achado 5), o botão 3 e liberar lança-chamas e rotatória na mão esquerda, que seguem barrados mesmo com ela no botão 1 (`chassis.ts:502`). `SPECS_Hangar.md:23-45` descreve uma API que não existe; `HANGAR.md:33-36` e `chassis.ts:311` estão desatualizados.

### O que está bem (o auditor conferiu)

A troca rápida de chassi no pedestal é protegida (`HangarScene.ts:652` e `:688`, com testes) e **nenhum ouvinte é duplicado ao reabrir o Hangar** (todos nascem no construtor, `HangarMenu.ts:316-350`). Logo, a suspeita de "concorrência" do Comandante não se confirma nesses dois pontos; o que parece concorrência é o achado 6 (dois efeitos no mesmo botão) e o achado 8 (duas fontes da montagem: aparelho e conta).

## 2.1 Feito (07/11, passo 1 do plano: achados 1, 3, 7 e 13)

`hangar/edicao.ts` (novo, puro, com `edicao.test.ts`): `copySpec` copia **todo** campo (achado 1: a cor sumia); `normalizar` mantém versão, módulo e botões coerentes e tira o botão de encaixe vazio ou de chapa de escudo (achado 3); a tela chama `trocarArma`, `trocarNivel`, `trocarModulo`, `trocarLayout`, `escolherBotao` e `aplicarPreset` em vez de montar o objeto à mão. `botoesDoPreset` deixa a arma única no botão 1 (achado 7; a decisão 2 do § 4 foi tomada pela correção proposta, a ser confirmada). Rótulos (achado 13): o módulo diz a tecla do escudo que o jogador remapeou (`teclaDoEscudo`); o treino de mira diz o encaixe (COSTAS, OMBRO…); o toque diz "SEGURE ATQ 2"; o Lancer sem chapa diz VAZIO (`SHIELD_ARM` e o ramo "o escudo ainda não bloqueia dano" saíram: nunca rodavam). A frase do módulo é a chave `{0} liga e desliga…` nos seis dicionários (casa com qualquer tecla). **Prova no Chrome:** `medicoes/hangar-rascunho.mjs` (a cor continua EM USO ao reabrir, BOTÃO 2 + módulo aplica, a tecla Q aparece no texto, "TUDO NO 1" no Lancer fica no 1; 8 de 8), foto `arte/hangar-rascunho-claude.jpg`. **Efeito colateral bom:** com a `normalizar`, a montagem que o Hangar grava nunca é a "versão 4 sem botão", o caso A do achado 2 (o módulo some na chave) deixa de nascer pelo Hangar; a chave em si continua como está até o passo 2.

## 3. O plano (um PR por passo, na ordem do que o jogador sente)

| # | Passo | Achados | Risco | Como se prova |
|---|---|---|---|---|
| 1 | **O rascunho do Hangar**: `copySpec` completo, uma `normalizar(spec)` em toda edição, preset de arma única, rótulos | 1, 3, 7, 13 | baixo (só interface) | testes puros; uma captura do Hangar |
| 2 | **Chave canônica** com teste exaustivo de ida e volta | 2 | **alto** (rede) | o teste exaustivo, **no máximo 8 mutações à mão** e **1 bancada** com o servidor de verdade |
| 3 | **Links**: consumir o `?build=`, copiar só o `build` | 4, 9 | baixo | funções puras |
| 4 | **HUD e pausa por botão**, incluindo os extras | 5 | baixo | `armasPorBotao` + captura |
| 5 | **Teclas com o Hangar aberto** e APLICAR sem mudança | 10, 11 | baixo | testes puros |
| 6 | **Conta e migração da montagem** | 8 | **alto** (servidor) | testes + bancada |
| 7 | **Chapa × botão 2** | 6 | **alto** (simulação compartilhada) | **depois da decisão do Comandante** |
| 8 | **Limpeza de tela**: ⚙️ morto, `dispose` da cor, a ordem do painel | 12, 14, 15 | baixo | a ordem do painel é gosto dele |
| 9 | **Um vocabulário de encaixe**; o layout vira botões | 16 | **alto** (protocolo) | por último |
| 10 | **Documentos** (17), junto com cada PR acima | 17 | nenhum | — |

## 4. O que é decisão do Comandante

1. **Achado 6:** quando há chapa de escudo, ela vai para o botão livre ou o robô fica proibido de ter arma extra no botão 2?
2. **Achado 7:** com uma arma só, o preset "TUDO NO 1" deve mantê-la no botão 1 (a correção proposta)?
3. **Achado 14:** onde ficam COR DO CASCO e BOTÃO no painel (gosto de desenho).
4. **Achado 15:** pode remover o ⚙️ "Painel Admin" do Hangar (o VISIBILIDADE já faz o trabalho)?

## 5. O que não foi conferido

Nada foi executado pelo auditor. Eu reproduzi por execução só o achado 2 (A e B) e a recusa do achado 3. **Não vi** o efeito visual de C, M e B por cima do Hangar (11), a memória de vídeo (12), o Colossus com dois "morteiros nas costas" (chuva na mão e nas costas), nem se `VITE_COMANDANTE_POR_LINK` está ligada no site (9). **Suspeita sem prova:** se a rodada nova dispara online, uma montagem aplicada online entra no robô local enquanto o servidor segue com a da entrada (`Game.ts:881` lê a chave uma vez só e a reconexão reusa a mesma, `OnlineSession.ts:268`).

## 6. Ligado a

`HANGAR.md` · `SPECS_Hangar.md` · `AUDITORIA_INTERFACE.md` (os sete princípios) · `ORDENS_DO_COMANDO.md` P289, P300 a P302, P319 · `STATUS_REAL.md`.
