# MODELADOR — o Claude faz o papel do Blender (P323, 07/11/2026)

> A ordem do Comandante: *"quero que você faça o papel do Blender! essa é a missão... pra não precisarmos mais ir lá e usar o Tripo + Blender, e centralizarmos aqui esse job, assim evoluiremos mais rápido os mechs, design, armas, movimentação"*.
> Este arquivo é a fonte única do **como**: o laço de trabalho, o orçamento, o que o código alcança e o que não, e o plano da personalização. Quem vai modelar um Mech ou uma arma lê este arquivo, depois `ESTILO_ROBOS.md` (o estilo), `ARSENAL.md` (a lista do que tocar) e `REFERENCIA_VISUAL.md`.

## 1. O princípio

O modelo de um robô ou de uma arma **nasce em código, no repositório**, e se ajusta na aba **MECHS 3D do Estúdio** (`npm run estudio`; ferramenta do Comandante, local, nunca página pública). Tripo e Blender continuam existindo só para o que código não alcança (§ 4). O que o código dá e o `.glb` solto não dá: o robô já nasce com juntas, dano por parte, calor, cor do time, o movimento da geração 3 e as bocas de tiro do chassi; mexer num número ajusta tudo junto; não baixa arquivo; fica no git com teste.

## 2. O laço (o método do `teardown` com a crítica por imagem)

1. **Referência → números.** A imagem-alvo (as do Comandante ficam em `.tmp/referencias/`, só nesta máquina) vira medidas: proporções (cabeças de altura, largura de ombro, comprimento de coxa e canela), cores da paleta, onde há brilho.
2. **Números → código.** O kit de peças (`entities/meshKit.ts` e o kit de casco da geração 3) monta o corpo; cada peça é função dos números do blueprint. Nada de coordenada solta e sem nome.
3. **Código → fotos e medidas.** Folha de 4 ângulos (frente, lado, costas, 3/4) mais as medidas que o olho não vê: triângulos, malhas (draw calls), simetria, caixas dos pivôs, peça fora do corpo. O defeito de proporção se corrige com um número, nunca com a câmera.
4. **Crítica.** O Claude olha a folha e lista o que está duro, torto, solto ou pesado; o **Comandante julga no Estúdio** (o gosto é dele; o olho do Claude erra detalhe espacial, como o de qualquer crítico por visão: o estudo LL3M diz o mesmo). Medida sempre acompanha a foto.
5. **Ajuste e de novo**, no máximo três rodadas antes de mostrar.

Ferramentas: `npm run mech:folha -- --modelo <id> [--luz estudio|jogo]` (a folha de seis tomadas de um modelo parado: o passo 3; **julgue nas duas luzes**, § 9), `npm run mech:movimento` (o corpo andando, geração 2 ao lado da 3, em número e em vídeo), a aba MECHS 3D, `npm run mech:inspecionar -- arquivo.glb` e `npm run mech:bocas -- <id>` (para malha importada).

## 3. O orçamento (vale para todo modelo novo)

- **Draw calls:** um pivô articulado = uma malha (`batchRigMeshes`); o rig procedural usa ~10. **Articulação nova entra por atributo de vértice e shader no lote, nunca por pivô com malha** (foi assim o tornozelo, P322: `mechFoot`, zero draw call). Uma arma = uma malha (`weaponModels.test.ts`).
- **Triângulos:** poucos milhares por Mech (a GPU mínima é integrada; G12). Chanfro leve nas bordas (aresta 100% dura "parece barata"), cor por vértice, brilho por vértice; sem textura, sem detalhe miúdo (`ESTILO_ROBOS.md`).
- **Pacote de partida:** 500 KB gzip, teto que não sobe (folga real de ~2 KB; o `smoke` é o juiz, não o `npm run peso`). Modelo novo entra **sob demanda** (`import()` num pedaço de partida), nunca no `main.ts`.
- **Simulação:** o visual não muda regra. Tamanho de cápsula, zonas de dano e bocas de tiro são dado do chassi (`chassis.ts`), nunca da malha (G14).
- **Funcionalidade nova nasce restrita** (P191): robô, arma, peça, visor no catálogo `core/funcionalidades.ts` com `padrao: 'restrito'`.

## 4. O que o código alcança e o que não (honesto)

**Alcança:** hard-surface estilizado e limpo: silhueta forte, chanfros, placas separadas por frestas, blocos de cor, faixas e visores emissivos, peças que se repetem (respiros, listras), armas em três níveis.
**Não alcança:** o acabamento fotográfico de um render de IA (curvas orgânicas, dedos, textura de metal gasto); criatura, rosto, tecido. Para isso o Blender (instalado em `D:\blender`; o Claude roda por script, sem janela, e exporta `.glb`) ou o Tripo seguem melhores, pela via do `.glb` (`MECHS_IMPORTADOS.md`). **Em 07/11 o Blender por script virou o motor do acabamento dos robôs de herói** (§ 10). A geração 3 do movimento ainda não vale para `.glb` (falta o tornozelo e a medida da perna no rig importado).

## 5. A personalização que o Comandante quer (visão de 07/11): em camadas, do barato ao caro

Pedido: peças readaptáveis entre Mechs, itens especiais, armas diferenciadas, pinturas, marcas, camuflagens, visores, boosters, pacotes de munição, blindagens.

| Camada | O que é | O que já existe | O que falta e custa |
|---|---|---|---|
| 1. Visual | pintura, marcas (decalques), camuflagem, forma e cor do visor | pintura do casco (P305, `casco`), cor do visor | só desenho: o decalque e a camuflagem vão por cor de vértice ou textura minúscula no lote; a escolha entra na montagem salva e no link `?build=` (e, para o outro jogador ver, no contrato de rede) |
| 2. Módulos com efeito | booster, pacote de munição, blindagem | os encaixes extras das costas e dos ombros (P282), o escudo físico | cada módulo é regra de jogo: equilíbrio, peso na carga, contrato de rede e validação no servidor (G14: um teste de simulação por regra) |
| 3. Peças trocáveis entre Mechs | cabeça, braço, perna com encaixe padrão | nada (cada chassi é um blueprint) | a mais cara: muda estatística, rede e servidor; exige o **contrato de encaixe** (dimensões de cada soquete, escala permitida) e um catálogo de peças; só depois das camadas 1 e 2 |

Ordem: 1 (junto com o modelo-base novo da geração 3), depois 2, depois 3. Tudo restrito até o Comandante liberar.

## 6. Trazendo do Tripo ou do Blender "do jeito ideal" (proposta, a confirmar com o primeiro arquivo)

Para entrar numa linha de peças (e não como robô inteiro de esqueleto, que custou uma sessão de correção por robô): **peças rígidas separadas**, sem esqueleto nem pele — cabeça, tronco, pelve, braço (esquerdo e direito), coxa, canela, pé, mochila; a **origem de cada peça na junta** (ombro, cotovelo, quadril, joelho, tornozelo, pescoço); **Y para cima e −Z para a frente**; em **metros**, com a altura final do chassi; **até ~3 mil triângulos** no total; **cor por vértice** ou quatro materiais nomeados (casco, estrutura, luz, vidro), sem textura; **nós vazios** nos encaixes (`encaixe_mao_d`, `encaixe_mao_e`, `encaixe_ombro_d`, `encaixe_ombro_e`, `encaixe_costas`), com a boca no −Z; **um `.glb` por robô**, sem animação, câmera nem luz. Se o formato mudar, este arquivo muda primeiro.

## 7. Referências pesquisadas (07/11)

- **Blender MCP** (o Claude comandando o Blender; o vídeo "Claude AI Animated THIS in Blender"): a ideia certa para o acabamento; o veredito e a divisão do trabalho estão no § 10 (por script, sem MCP, para começar).
- **LL3M** (UChicago, arXiv 2508.08228): código → render de vários ângulos → crítico por visão → verificação; base do laço do § 2.
- **`three-bvh-csg`**: corte booleano em Three.js; só como ferramenta de build (peso no pacote).
- **Bevel + normais ponderadas, painéis em placas (plating/Greebler):** o acabamento de hard-surface de jogo; a versão barata daqui é o chanfro e a fresta entre placas.

## 8. O padrão do corpo da geração 3 (ordem de 07/11, travado por teste)

O Comandante, olhando o Gavião: "esse espaço entre o tronco e as pernas, vamos eliminar a partir da terceira geração" e "os pés dos mechs afundam no solo". Os robôs antigos não se consertam no desenho; **todo corpo novo nasce neste padrão**, e o `corpoGen3.contrato.test.ts` o trava (um corpo novo entra na lista `CORPOS_GEN3` e herda os testes):

1. **Sem vão entre o tronco e as pernas, em qualquer pose.** O núcleo escuro do abdômen desce para dentro do cinto da pelve, e o topo do cinto chega ao pivô do tronco (o tronco só inclina `pitch × 0,25` mais a mola, uns 10°). O teste joga raios horizontais pela cintura e pelos quadris nas poses extremas (tronco ±17° de inclinação e ±14° de giro, quadril ±0,9 rad) e exige que **nenhum** passe direto: é o que o olho vê.
2. **A sola pisa o chão.** O vértice mais baixo da malha depois do giro do tornozelo (o teste emula o shader do lote, com as mesmas contas) fica a menos de 2 cm do piso na corrida e a menos de 1% da altura no pior quadro do roteiro inteiro (o toque do pouso). Vale para os quatro robôs de código e para todo corpo novo.
3. **Ombreira de placas anguladas** (a tampa em tronco de pirâmide e as lâminas que caem junto do braço), nunca cúpula nem bola; joelheira em duas placas; **acento de perigo pequeno e raro** (o laranja do print 4 são riscos, não barras).
4. **Orçamento:** no máximo 10 malhas e menos de 6 mil triângulos.
5. **Desenho por números:** o corpo lê `blueprint.estilo`; o painel DESENHO da aba (só no Gavião) edita e `desenhoGaviao.json` guarda. A perna não muda de comprimento, então a passada não depende do desenho.

**Armadilhas:** `MechRig` expõe `RigJoint`, não `Object3D` (os testes convertem); depois de mover o `root`, chame `root.updateMatrixWorld(true)` antes de medir (sem isso o vértice sai relativo ao `root` e não ao chão, e um "afundamento na decolagem" que não existia me enganou em 07/11); `has-text` do Playwright casa por substring (dois botões "DESFAZER" quebraram a prova); a posição do tronco no rig é `pelve + 0,3`, e o conteúdo do tronco que começa acima disso deixa vão.

## 9. Julgue na luz do jogo (achado de 07/11)

A arena é escura e fria (ambiente a 0,25, tom ACES a 1,1, hemisférica azul-clara, contraluz ciano): um casco de `0x5b6169` sai **quase preto** na tela do jogo, e na caixa de luz do Estúdio ele parecia bom. A prévia tem as duas luzes: **ESTÚDIO** (suave, para julgar a forma) e **COMO NO JOGO** (a da arena, para julgar a cor e o contraste); `npm run mech:folha -- --luz jogo` fotografa na do jogo. O aço de fábrica do Gavião é `0x7d838b` por isso. Todo modelo novo é aprovado **nas duas**.

## 10. O motor de geometria do acabamento (decisão de 07/11, depois da conversa do Comandante com um especialista)

O especialista disse que caixas empilhadas em Three.js dão o "vale da estranheza" e que o caminho é orquestrar um programa de modelagem de verdade (Blender por MCP, geração de malha por IA, CAD paramétrico). **O diagnóstico procede em parte**: o teto do kit em código é real (o chanfro de um segmento lê como papelão, as faces são planas, o material não tem profundidade). A parte "o modelo de linguagem não tem intuição espacial" é mais fina: o erro é modelar **às cegas**; com render, olhada e correção por número o laço funciona (LL3M); o que falta ao kit são as **ferramentas** (bevel com normal ponderada, booleano de fresta, AO gravado no vértice), não um cérebro melhor. Veredito por ferramenta:

| Ferramenta | Veredito |
|---|---|
| **Blender por script (`bpy`, sem janela)** | **Adotado como o motor do acabamento.** Já está aqui: `D:\blender\blender.exe` 5.2.2 (com o addon do Tripo) e o `scripts/blender/rig-walker.py` já gerou o rig do Draga e fotografou por render sem janela; **o MCP não é preciso para começar** (ele só soma a janela ao vivo, pesada nesta máquina de pouca memória). |
| **Tripo/Meshy (imagem para 3D)** | Para **detalhe esculpido, em peças** (capacete, peitoral, mão), não o robô inteiro (o `.glb` inteiro custou uma sessão de correção por robô e vem só na geração 2). Por API é pago; o Comandante prefere grátis, então segue o fluxo dele no navegador (§ 6). |
| **CadQuery / OpenSCAD** | **Não agora.** O Blender cobre bevel, booleano e normal ponderada; o CadQuery pede o OpenCascade (pesado) e ainda passaria pelo Blender para o sombreamento. Volta se um dia precisarmos de engrenagem ou rosca com tolerância. |
| **Three.js em código (o kit)** | **Fica** para o ajuste ao vivo na aba (o painel DESENHO), para os inimigos baratos e para o que o Comandante quer mexer por número. Medido: `toCreasedNormals` pondera igual e quantiza a 1 cm (funde os vértices de um chanfro de 2 cm), e o `RoundedBoxGeometry` custa ~300 triângulos por placa: **o chanfro bom não sai barato em Three.js**; no Blender o bevel com normal ponderada é nativo. |

**A divisão do trabalho:** o **Blender** (script `bpy`) faz o corpo de herói: placas com bevel e normal ponderada, fresta por booleano, AO e desgaste gravados na cor do vértice (o lote já carrega cor, rugosidade, metal e emissão por vértice: zero draw call), esqueleto com os nomes do rig, um `.glb` por robô e a ficha em JSON. **O jogo** o carrega pelo caminho do `.glb` importado, que precisa antes da **geração 3 para malha importada** (o rig importado não tem tornozelo nem a medida da perna). O **kit em código** fica como está; o **Tripo** entra em peças.

**Próximo passo, a Prova Blender (um PR):** o peito, a ombreira e o capacete do Gavião por `bpy`, exportados e carregados na aba na mesma luz, ao lado da versão de código; o Comandante escolhe. Se ganhar, o kit do Blender vira o caminho dos robôs de herói.

## 11. O que vem (visão de 07/11, ainda sem código)

- **Famílias de movimento** (guerreiros, não só bípedes: quadrúpede, octópode, dinossauro mecânico, voador, rolador). O que já existe: `walkerGait.ts` (o quadrúpede do Draga: quatro tempos, função pura e testada) e a geração 3 (bípede). Cada família = um rig + uma função de marcha pura (G1/G2/G14) + o corpo. O que custa de verdade é o contrato de **simulação** de quem não anda na cápsula de pernas (voador: altura e empuxo; rolador: curva e inércia). Ordem: primeiro as que reusam a cápsula (quadrúpede, octópode, dinossauro), depois voador e rolador, que pedem física e rede novas. A posição de tiro (firmar as pernas, agachar, absorver o coice) é animação da mesma família.
- **Peças que se soltam** (latarias, escudos, partes que caem em vez dos cubos). Viável e barato: o destroço de hoje é um `InstancedMesh` de caixas com corpos do Rapier (até 240, 24 por quebra, `DebrisSystem.ts`) e a perda de uma parte já chama `tearOff` (`CombatSystem.ts`). Passo 1: a própria malha do pivô (cabeça, braços, coxas, canelas, tronco e pelve já são uma malha cada) vira o destroço e cai, sem geometria nova. Passo 2: a placa que sai por dano (máscara por vértice no lote, como o tornozelo, e destroço em pool com teto e balística, sem corpo do Rapier). Só visual (G14): nasce do evento de dano que já existe.
- **Inimigos humanoides** (referência do Comandante: um esqueleto exposto de filme). O desenho daquele robô é propriedade de terceiros: a **linguagem** (pistões, caixa torácica, coluna de discos, juntas à mostra) é referência, e o desenho é original da CYBERMECH. Tamanho de Mech usa o orçamento do Gavião; infantaria em bando pede orçamento próprio (até 6 malhas e 1.500 triângulos, instanciada).
