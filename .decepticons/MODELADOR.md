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

Ferramentas: `npm run mech:folha -- --modelo <id>` (a folha de seis tomadas de um modelo parado: o passo 3), `npm run mech:movimento` (o corpo andando, geração 2 ao lado da 3, em número e em vídeo), a aba MECHS 3D, `npm run mech:inspecionar -- arquivo.glb` e `npm run mech:bocas -- <id>` (para malha importada).

## 3. O orçamento (vale para todo modelo novo)

- **Draw calls:** um pivô articulado = uma malha (`batchRigMeshes`); o rig procedural usa ~10. **Articulação nova entra por atributo de vértice e shader no lote, nunca por pivô com malha** (foi assim o tornozelo, P322: `mechFoot`, zero draw call). Uma arma = uma malha (`weaponModels.test.ts`).
- **Triângulos:** poucos milhares por Mech (a GPU mínima é integrada; G12). Chanfro leve nas bordas (aresta 100% dura "parece barata"), cor por vértice, brilho por vértice; sem textura, sem detalhe miúdo (`ESTILO_ROBOS.md`).
- **Pacote de partida:** 500 KB gzip, teto que não sobe (folga real de ~2 KB; o `smoke` é o juiz, não o `npm run peso`). Modelo novo entra **sob demanda** (`import()` num pedaço de partida), nunca no `main.ts`.
- **Simulação:** o visual não muda regra. Tamanho de cápsula, zonas de dano e bocas de tiro são dado do chassi (`chassis.ts`), nunca da malha (G14).
- **Funcionalidade nova nasce restrita** (P191): robô, arma, peça, visor no catálogo `core/funcionalidades.ts` com `padrao: 'restrito'`.

## 4. O que o código alcança e o que não (honesto)

**Alcança:** hard-surface estilizado e limpo: silhueta forte, chanfros, placas separadas por frestas, blocos de cor, faixas e visores emissivos, peças que se repetem (respiros, listras), armas em três níveis.
**Não alcança:** o acabamento fotográfico de um render de IA (curvas orgânicas, dedos, textura de metal gasto); criatura, rosto, tecido. Para isso o Blender (instalado em `D:\blender`; o Claude roda por script, sem janela, e exporta `.glb`) ou o Tripo seguem melhores, pela via do `.glb` (`MECHS_IMPORTADOS.md`). A geração 3 do movimento ainda não vale para `.glb` (falta o tornozelo e a medida da perna no rig importado).

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

- **Blender MCP** (o Claude comandando o Blender; o vídeo "Claude AI Animated THIS in Blender"): mesma ideia, por outra ferramenta; aqui o código no repositório ganha porque o robô já nasce ligado ao jogo.
- **LL3M** (UChicago, arXiv 2508.08228): código → render de vários ângulos → crítico por visão → verificação; base do laço do § 2.
- **`three-bvh-csg`**: corte booleano em Three.js; só como ferramenta de build (peso no pacote).
- **Bevel + normais ponderadas, painéis em placas (plating/Greebler):** o acabamento de hard-surface de jogo; a versão barata daqui é o chanfro e a fresta entre placas.
