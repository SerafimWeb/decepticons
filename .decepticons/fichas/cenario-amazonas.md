# FICHA · CENÁRIO — A MINERADORA NO RIO (Amazônia)

> **Status:** proposta · **Autor:** Claude · **Data:** 2026-10-17 · **Ordem:** P180 · **Etiqueta:** `#cenarios`
> **A ordem do Comandante (17/10):** *"pra começar podemos focar a próxima missão no próximo cenário, que vai ser no rio Amazonas: uma mineradora acabando com o rio, envenenando, poluindo, explorando as populações indígenas e expulsando-as dos seus territórios. Há uma enorme força de defesa deles e teremos que desmantelar, invadir com andróides e destruir por dentro. Já até criei o modelo e estou nessa frente em outro chat."*
> **O que esta ficha é:** o **contrato da missão**: o que ela FAZ, as fases, as forças e o que o jogo precisa ter. **O modelo do cenário (a geometria, o visual) é do Comandante, no outro chat**: esta ficha **não o constrói nem o redesenha**; diz o que a missão **precisa encontrar nele** (§ 5) para ligar a lógica sem retrabalho (o aprendizado do Bunker, `cenario-cabos.md` § 1).
> **Nome provisório:** **OPERAÇÃO RIO VIVO**. O Comandante dá o nome final.
> **Atualização (Claude, 17/10, no chat do Comandante; ver `AMAZONIA.md`):** **o modelo que o Comandante criou é o do robô** (`MODELOS 3D\heavy industrial walker 3d model`), **a Draga**, e não o do cenário: ele já está **riggado e andando** (`?walker`, parte A). **O cenário (a geometria) será construído em código**, com o orçamento do `AMAZONIA.md` § 5, e os pontos nomeados da § 5 desta ficha viram o layout do mapa em dado. Duas ideias novas vieram na conversa: **o rio é o termômetro da fase** (limpo e vivo a montante da Draga, sujo, com óleo e envenenado a jusante, curando conforme as peças caem) e **a Draga anda** (rio acima, rumo à aldeia). Esta ficha segue valendo como o contrato da missão.

## 1. A história em um parágrafo

Uma mineradora instalada na margem de um afluente do Amazonas **envenena o rio** (rejeito e mercúrio), **polui** o que as pessoas bebem e comem, **explora** a mão de obra e **expulsa** os povos indígenas do território. O que protege a operação é uma **enorme força de segurança corporativa**: perímetro, torres, drones, Mechs de contrato. A SERAFIM e a **Guarda da Floresta** (os povos, como protagonistas) não conseguem entrar de frente: o jogador **abre a brecha por fora** e **os andróides entram pelo interior para destruir a operação por dentro**.

**O lado político da missão** (`LADO_E_PEDAGOGIA.md`): é o primeiro cenário onde **o lado muda o que se faz** (§ 6). O **fato** que ancora a história (garimpo e mineração ilegais, contaminação por mercúrio, a crise sanitária nos territórios indígenas) **entra só com fonte** (`LADO_E_PEDAGOGIA.md` § 5): **sátira exagera, fato é fato**.

## 2. O que o cenário tem de FAZER (não como parece, o que faz)

| Zona | O que faz na missão |
|---|---|
| **A margem e as balsas de dragagem** | o **primeiro contato**: as balsas e as dragas armadas protegem o acesso pelo rio; o jogador as derruba para abrir a margem |
| **O perímetro** (cerca elétrica, torres, portões) | a **brecha**: derrubar o gerador da cerca abre a passagem para os andróides |
| **A cava a céu aberto** e **as rampas** | o **combate de Mech**: espaço aberto, desnível, o jogador atrai a força de defesa para longe do interior |
| **A planta de beneficiamento e os dutos** | o **interior**: os **andróides** passam por **dutos e comportas** onde o Mech não cabe; é onde o jogo ganha a escala 1 |
| **A bacia de rejeitos** (barragem) | o **alvo final**: as **válvulas e bombas** que, destruídas, **param o envenenamento** (e fazem a água correr limpa) |
| **O território** (a aldeia, a roça, a margem) | **o que está em jogo**: a Guarda da Floresta o defende; **nunca é alvo**; mostra o que será salvo ou perdido |
| **A pista de pouso e o cais** | os **reforços** do inimigo chegam por ali (as ondas) |

## 3. A missão em fases (a forma do jogo, igual à dos capítulos de `CAMPANHAS_E_CHEFES.md` § 3)

1. **A brecha (o Mech).** Derrubar as balsas e as torres da margem e o **gerador da cerca**. Cada torre tem vida (o mecanismo dos cabos e dos coqueiros, P138).
2. **A distração (o Mech).** Atrair e segurar a força de defesa na cava: o **arpão** aqui rende (juntar os Mechs de contrato para a onda sônica e o fogo, e **só puxa quem é do seu peso ou mais leve**: a regra do dono, P181).
3. **A infiltração (os andróides).** Uma **equipe de andróides** (o chassi `android` já é pilotável) entra pelos **dutos**; **quem joga troca para o andróide** (ou o comanda). Cenário de **escala 1**: corredores estreitos, o inimigo em volta.
4. **Destruir por dentro.** Os andróides plantam e disparam as cargas nas **bombas e válvulas** da bacia de rejeitos e no **reator/gerador** da planta, enquanto o Mech segura o lado de fora. **A missão acaba quando o envenenamento para**, não quando o último inimigo cai.
5. **O Relatório de Consequências.** O que aconteceu com o rio e com o território, **com números lidos de ficha e fonte** (`LADO_E_PEDAGOGIA.md` § 3.3, camada 3).

## 4. As forças (a "enorme força de defesa")

| Força | Papel | Observação |
|---|---|---|
| **Segurança corporativa** (andróides de guarda) | o enxame do dia a dia; patrulha o perímetro | o inimigo básico, em ondas |
| **Mechs de contrato** | o grosso: pesados e médios, atiram em rajadas | os rebeldes do jogo, com a pintura do Consórcio |
| **Torres e drones** | cobertura do perímetro e da cava | os "ninhos" da `cenario-cabos.md` |
| **A Draga** (chefe proposto) | um **titã de dragagem** (escala 3 ou 4) na margem, que bombeia o rio | personifica a máquina de extração; **cai pelas pernas e pelo gerador**, como o Colossus dos cabos |
| **A Rede Verdade Plena** (a mídia, sátira) | a **voz do rádio inimigo** que nega o que se vê ("não há contaminação") | narrativa, não combate |

## 5. O que o jogo precisa e o que o modelo precisa trazer

**O que o jogo precisa ter (e o que já tem):**

| Mecânica | Estado |
|---|---|
| O **andróide pilotável** (escala 1) e a troca de quem se controla | o chassi existe; **a troca no meio da missão não existe** |
| **Objetivos destrutíveis** com vida (torres, bombas, válvulas, gerador) | existe (os cabos, os coqueiros: `environment/Destructibles.ts`, P138) |
| **Zona de água/rio** com efeito (veneno que fere; água limpa que cura) | a água da praia (P126: freia e afoga) existe; **o veneno não** |
| **Ondas com contêiner de desembarque** (a pista e o cais) | existe (a frente 3 dos cabos) |
| **O rádio e o cartão da missão** (texto, voz) | existe (`ui/praiaHudData.ts`); **o texto desta missão é de Claude** |
| **O Relatório de Consequências** | **não existe** (camada 3 do `LADO_E_PEDAGOGIA.md`) |

**O que o modelo do Comandante precisa trazer (os nomes dos pontos, para a lógica ligar sem retrabalho):** `spawn_jogador`, `spawn_androides` (a boca dos dutos), `spawn_inimigo_{margem,cava,planta}`, `torre_{n}`, `gerador_cerca`, `portao_{n}`, `bomba_{n}` e `valvula_{n}` (os alvos finais), `draga` (o chefe), `territorio` (a aldeia: zona que **não leva dano**), `extracao`. **Se o modelo já tem outros nomes, a Claude adapta a lista ao que ele tiver**; o que importa é cada função ter **um ponto marcado**.

## 6. O lado muda a missão (camada 4 de `LADO_E_PEDAGOGIA.md`)

| | **Aliança** | **Consórcio** |
|---|---|---|
| **Objetivo** | invadir e **desmantelar** a operação (as fases 1 a 4) | **defender o perímetro** e a bacia contra a invasão (as mesmas fases, de cabeça para baixo) |
| **Vitória** | o envenenamento para | a operação segue |
| **O que o jogo mostra depois** | o rio volta; o território fica | **o Relatório de Consequências**: o que "a operação segue" custou |

**Mesmo mapa, outra missão:** sem segundo cenário. A Aliança joga de fora para dentro; o Consórcio, de dentro para fora.

## 7. Quem faz o quê

| Quem | O quê |
|---|---|
| **Comandante** (outro chat) | o **modelo do cenário**: geometria e visual |
| **Claude** | esta ficha, a missão (fases, objetivos, ondas), o texto (cartão, rádio, Relatório), os testes de simulação, a fiação no `Game` (`theater.ts`, o cartão da missão) |
| **Codex/Gemini** | o que o Comandante repassar do visual e do som (vozes: `VOZES_E_SONS.md`) |

## 8. O que só o Comandante decide

1. **O nome da missão** e do cenário (provisório: OPERAÇÃO RIO VIVO).
2. **A Draga** como chefe (ou outro).
3. **A troca para o andróide:** o jogador **controla** o andróide (uma segunda "vida" da missão) ou **comanda a equipe** de longe? A recomendação: **controla** (é o que o chassi `android` já permite e dá a escala 1).
4. **O quanto o fato entra:** só texto de rádio e cartão, ou também o Relatório com números (que exige a fonte, `LADO_E_PEDAGOGIA.md` § 5).
5. **O modelo:** quando ele estiver pronto, em que pasta e formato (`.glb`? cena do jogo?), para a Claude conferir os pontos da § 5.
