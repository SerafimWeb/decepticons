# ARQUIVO — ESTADO_ATUAL (quinzena 2026-10-b)

> Texto movido sem alteração de `ESTADO_ATUAL.md` por `npm run arquivar`. Não editar: o vivo é o documento principal.

<!-- arquivo -->

## MESCLADO NA MAIN (26/10): OS ROBÔS ACENDIAM COMO LÂMPADA AO TOMAR TIRO (Claude, PR #466, P259)

**O Comandante jogou o que saiu no P258 e achou mais um (de imediato, antes de confirmar os outros):** "os robos ainda estao ficando com LUZ quando tomam tiro... tanto eu quanto os outros robos se iluminam, isso ta artificial, e nao ta bom! é apenas pra receberem os EFEITOS VFX do tiro, e nao pra acenderem como uma lampada!!!!! adicione mais qualidade e encontre esse evento pra controlar e melhorar ele." Também perguntou por que o site mostrava o commit `ac828b6` em vez do `3b72c17` que acabou de mesclar — **não era bug**: o `atualizacao.log` e o `publicar-site-console.log` do servidor (`.tmp/wt-servidor-prod`) provam que `3b72c17` foi publicado 1 min depois do print dele (o ciclo automático leva ~6–7 min do merge até o site atualizar: verificar + religar o servidor + montar e enviar o site).
**O achado:** `MechBase.ts:update()` — o "flash de dano" (`hitFlash`, setado para `1` em `damagePart()` a cada acerto, decaindo a `dt*6`) escreve direto no `emissive` de **todos** os `hullMaterials` do robô: `fr = hitFlash*1.4 + tint.r`. Um emissivo de **1,4** (acima de 1,0, já em faixa HDR) somado à cor toda do casco é, literalmente, acender o corpo inteiro — e como o casco é **um material só, batido num lote** (`batchRigMeshes`, G4/G5: sem isso o jogo pagaria um draw call a mais por Mech), não dá pra acender só a peça atingida sem desfazer esse lote. **Vale para qualquer `MechBase`:** o jogador e todo bot (`Android extends MechBase`), exatamente "eu e os outros robôs".
**Corrigido:** cortados os multiplicadores de pico de 1,4/0,35/0,2 para 0,35/0,09/0,05 (~75% menos), mantendo a mesma proporção de cor (vermelho-alaranjado) — ainda dá pra perceber o acerto, sem acender como lâmpada. Não mexi na velocidade do decaimento (já rápida, ~0,17 s) nem tentei o flash por peça (exigiria quebrar o lote do casco — custo de desenho a mais por Mech, fora de escopo para este pedido).
**Provas:** `npm run check` verde.

## MESCLADO NA MAIN (27/10): O CONGELADO VIRAVA UM BLOCO DE LUZ BRANCA (Claude, PR #467, P260)

**O Comandante jogou o P259 no ar e mandou dois prints: "sera q estamos falando da mesma 'luz' que acende no robô? veja o print...como ele fica iluminado quando toma tiros!... o brilho total deve ser amenizado, pois nem todo jogador va ter a visao de reduzir o brilho da configuracao."** Os dois prints são da câmera de vigilância/espectador mirando um alvo **congelado** (arma de gelo): o robô aparece quase todo branco, sem silhueta, com neve ao redor.
**O achado:** não era mais o `hitFlash` do P259 (esse já estava cortado e correto). Era `fx/StatusVisuals.ts` — as partículas do estado congelado (`VAPOR` e `SHARD`, cor de propósito acima de 1,0 para acender o bloom, herdado do 11/10: "o congelamento não se percebia"). O cursor que solta a rajada gira por **todas as 6 partes do corpo em ~0,6 s**, e cada rajada dura até 0,9 s — então, a qualquer instante sob congelamento sustentado, várias partes têm vapor+caco acesos ao mesmo tempo, e o halo de bloom de cada partícula se soma ao do vizinho até cobrir o robô inteiro, exatamente como nos prints.
**Corrigido:** cor e tamanho de `VAPOR`/`SHARD`/`CHILL` cortados (ex.: `SHARD` de pico 2,1 para 1,05 — no limiar do bloom, não acima dele; tamanho de 2,6 para 2,0) — o gelo ainda aparece (a cor, a forma de floco/vapor, e o tingimento azul-gelo do casco em `statusTint.ts`, intocado) sem virar halo contínuo. Não toquei em fogo/choque/atordoamento (sem queixa nova sobre eles; fogo já foi reforçado em 11/10 por estar fraco demais — mexer de novo arrisca reabrir aquilo).
**Provas:** `npx vitest run StatusVisuals.test.ts mechTint.test.ts statusTint.test.ts` verde (22 testes); `npm run check` verde.

## MESCLADO NA MAIN (26/10): O TIRO ATRAVESSAVA A MULTIDÃO ONLINE, O FLASH DE DANO E AS JANELAS DOS PRÉDIOS (Claude, PR #465, P258)

**O Comandante jogou de verdade (26/10) e achou quatro coisas de uma vez:** "o brilho quando eu tomo tiro ainda ta muito forte... fico todo aceso e dou uma piscada que chega a embaçar a tela"; "na fase do 8, tentei jogar mas meu tiro nao pegava no manifestante"; "na fase neon, o brilho dos predios fica irregular, ele parece com defeito"; e perguntou se dá pra salvar o token de `/metricas` no login em vez de digitar sempre.
**O tiro não pegava no manifestante (achado grave, de antes de hoje):** `Multidao.atirar()` só funciona na autoridade (`if (!this.autoridade) return -1`) — e **todo cliente online é espelho**, nunca autoridade; a multidão não tem corpo físico, então quando `atirar()` devolvia -1 o projétil não tinha em quê colidir e **atravessava a multidão sem nenhum efeito, nem visual**, desde que a missão ficou jogável online (P251, 23/10) — só ninguém tinha disparado de verdade num cliente online até o Comandante testar hoje. **Corrigido:** extraí a conta geométrica pura de `atirar()` (`primeiroNaMira`, sem efeito nenhum) e criei `naMira()`, que qualquer um pode chamar — o espelho agora usa `naMira()` para o tiro **parar e soltar a faísca** na hora certa; quem morre de verdade continua vindo só do evento do servidor (G11 intocado, zero posição nova na rede). 2 testes novos (`Multidao.test.ts`, `Match.janeiro.test.ts` com `damage: false`).
**O flash de dano:** `#damage-vignette` (`styles.css`) ia a 120px de raio de desfoque e 55% de opacidade, sem nenhum teto por taxa de tiro — sob fogo sustentado cada acerto novo prendia de novo a opacidade no máximo antes do anterior sumir, ficando preso aceso. Cortado para 60px/30%.
**As janelas da Cidade Neon "com defeito":** não era mais o shader instável (aquilo o P255 já corrigiu) — era o sorteio de cada janela ser **independente da vizinha**, sem nenhuma coerência por andar: ~48% de chance cada uma, formando manchas aleatórias que leem como "glitch", não como prédio. Corrigido: cada andar sorteia sua própria ocupação em volta da mesma média (0,48), criando andares mais cheios e mais vazios (como um prédio de verdade) em vez de ruído por janela; janela apagada também ganhou um resto de brilho (0,05) em vez de preto puro, suavizando o contraste que o bloom exagerava.
**O token de `/metricas`:** o código já guarda em `localStorage` por servidor e recarrega sozinho (`scripts/metricas.mjs`) — não achei bug. O mais provável é o Brave (visto no print dele) limpando dados do site, ou ele acessando de mais de um aparelho. Ligar à conta/login (em vez do navegador) é possível, mas mexe em autenticação/privilégio (risco alto, P19a): fica pra um PR dedicado, com a rigor que a regra pede, em vez de entrar de carona aqui.
**Fora desta entrega, de propósito:** "concluir os modelos de jogo" da Cidade Neon (mapa vazio, ~12 objetos contra 150–300 da Praia/Praça) e o motoboy kamikaze (corpo não-bípede, estado de IA novo) são conteúdo novo, não bug — pedem decisão de escopo do Comandante antes (já registrado em P255).
**Provas:** `npm run check` verde (typecheck, suíte inteira, build, smoke, site).
**O Comandante jogou (26/10) e achou mais um: os robôs (ele e os outros) acendiam como lâmpada ao tomar tiro — ver P259 acima. O escopo da Cidade Neon (mapa vazio, motoboy) segue esperando ele confirmar depois de testar os consertos.**

## MESCLADO NA MAIN (26/10): O SELETOR DE MAPA PERDIA A MISSÃO DO 8 DE JANEIRO (ONLINE E OFFLINE), E O BRILHO BAIXA DE NOVO (Claude, PR #464, P257)

**O Comandante:** "ainda nao consegui jogar na fase 8 de janeiro, online, na missao contra os manifestantes. quero jogar nessa missao online com meus amigos!!!!" — e, à parte, "ainda to achando que os tiros geram muita luz... temos q tornar isso mais sutil".
**A causa do 8 de Janeiro (achada no código, não só suposta):** `MapLinks.ts:mapHref()` — a função por trás de TODO clique num pino do mapa de operações (`WorldMap.ts`, visível a qualquer jogador, não só ao Comandante) — tirava o `modo` da URL ao trocar de mapa, e só forçava `modo=survival` para a Amazônia. O 8 de Janeiro nunca ganhou esse tratamento: clicar no pino (online ou offline) levava a um Deathmatch vazio da Praça, nunca à missão contra a multidão — nem existia teste cobrindo `janeiro` nesta função. **Corrigido:** `mapHref` agora força `modo=survival` para o 8 de Janeiro também, online (preserva a sala — é assim que o amigo que já está lá se encontra, P251) e offline; o hint do seletor parou de dizer "(em construção)". 2 testes novos (`MapLinks.test.ts`).
**O brilho:** mais uma rodada depois do P256 (Qwen): o Comandante ainda achou forte depois de testar. Segui a recomendação que o próprio P256 deixou escrita ("baixar o padrão do brilho") em vez de reabrir o sistema de cartazes: `glow` (bloom global, `Settings.ts`) de 0,6 → 0,45. Não toquei no `MUZZLE_FRIENDLY_SCALE`/HDR do P256 nem separei o lote de desenho do clarão — é o próximo corte **se ainda** achar forte depois deste.
**Provas:** `npm run check` verde.
**O Comandante jogou (26/10) e achou mais três coisas — ver P258 acima.**

## OS TIROS FICAM SUTIS: MENOS CLARÃO NA BOCA E BLOOM MAIS ESTREITO — Qwen, 24/10 (branch `qwen/tiros-luz-sutil`, P256)

**O Comandante:** "ainda to achando que os tiros geram muita luz e atrapalha um pouco o jogo... temos q tornar isso mais sutil e elegante e gostoso de jogar" — e pediu objetividade, sem ler e testar tudo.
**A causa (medida no código, não no olho):** o clarão da boca é um cartaz aditivo que nasce a **25 cm do cano, à frente da câmera** — o do canhão de cerco ia a 7,5 m de diâmetro com pico HDR 2,2; o da boca do trilho a 4,2. Somava-se o bloom global com limiar 0,9 e raio 0,5, que abria halo largo por cima do alvo.
**Feito:** (1) teto de HDR dos efeitos de tiro de **4,2 → 2,7**, com o do jogador em ≤ 2,0 e o do inimigo mais aceso (ele é o aviso); (2) clarões da boca ~25% menores e de 0,05 s, e o **do próprio cano a 72%** do tamanho (`MUZZLE_FRIENDLY_SCALE` em `fx/WeaponFx.ts`) — é o que fica entre a câmera e o alvo; (3) pólvora do canhão/cerco de 2,2 → 1,6 e leques de 7,5/5,5 m → 5,0/4,0 m; (4) bloom: limiar **0,9 → 1,05** e raio **0,5 → 0,38**, constantes em `fx/bloomSeguro.ts` que o teste lê em vez de repetir o número.
**Provas:** 53 testes focados verdes (`glare`, `WeaponFx`, `steelWeapons`), typecheck verde; `glare.test.ts` ganhou duas regras novas (teto de HDR e nenhuma boca acima de 2,6 m). **Medido em quadro** (mesmo mapa, 12 quadros segurando o tiro, YAVG): o pico de luz do tiro sobre a cena caiu de **+5,9** para **+1,4**, e a cena inteira ficou ~14% menos lavada. Capturas: `arte/tiro-luz-antes-p256-qwen.jpg` e `arte/tiro-luz-depois-p256-qwen.jpg` (feitas em página de teste com o jogo real, R13 — **eu não leio imagem: o veredito estético é do Comandante**).
**Onde conferir:** `/jogar/` na Cidade Neon, segurando o tiro de plasma; e `/jogar/?mapa=arena&comandante=1`.
**Próxima sessão começa com:** o olho do Comandante jogando. Se ainda achar forte, o corte seguinte é separar o desenho do clarão do resto (hoje todo clarão da cena é um lote só, `fx/Billboards.ts`) ou baixar o padrão do "brilho" nas configurações (hoje 0,6).

## JANELAS DOS PRÉDIOS ESTÁVEIS, FLASH DE IMPACTO MENOR, DOC DO CHÃO CORRIGIDA — Claude, 24/10 (branch `claude/cidade-neon-vfx-predios`, P255, PR 2 de 2)

**Continuação do P255** (PR 1, os telões, já na `main`): os outros achados do Comandante.
**Prédios "com luz falhada":** o shader das janelas (`BuildingWindows.ts`) lia a normal da face pelas derivadas de tela da posição (`dFdx`/`dFdy`) — instável em coordenadas grandes do mundo (os prédios ficam a dezenas de metros da origem), exatamente o tipo de coisa que lê como "falhado". Trocado pela normal do próprio vértice (constante por face, mais barata, sem essa instabilidade). Também subi `litShare` de 0,3 para 0,48: com poucas janelas acesas e espalhadas, a fachada não formava grade nenhuma reconhecível — a captura nova (`arte/arena-banco-p255-claude.jpg`, contra a de 08/10 em `arte/janelas-predios-antes-depois-claude.jpg`) lê como prédio, não como pontos soltos; `.decepticons/medicoes/arena-2026-10-24.json` é só a contagem de desenhos/triângulos da mesma vista (sem GPU real), não a imagem.
**Efeitos "muito impactantes":** o clarão de impacto do canhão de plasma (a arma de partida do Marauder) ia a 2,2× o tamanho do núcleo; em fogo automático contra o mesmo alvo, vários clarões aditivos (`fx/Billboards.ts`) se somam, e a soma virava um borrão branco cobrindo a tela — o mesmo problema que `fx/Explosions.ts` já tinha resolvido para a bola de fogo (mistura normal em vez de somar luz), mas que não tinha chegado ao sistema de cartazes compartilhado (um desenho só para todo o clarão da cena — não dá para trocar só o do impacto sem separar o desenho, mais caro). Reduzi o multiplicador para 1,4× (a área cresce ao quadrado: ~60% menos cobertura de tela) como primeira passada, sem mexer no sistema compartilhado. **Pede o olho do Comandante jogando de verdade** — se ainda achar forte, o próximo passo é reduzir também o muzzle flash ou considerar separar o desenho do impacto do resto.
**"Piso abaixo do chão":** investigado — a nota antiga em `FERRAMENTAS.md` dizia "não corrigido", mas **foi corrigido em 10/10** (`MechParado.test.ts`, P09 ✅). Corrigi a nota. O relato novo do Comandante (23/10) pode ser um caso diferente: o conserto de 10/10 só cobre o Mech **parado**; não tentei um conserto às cegas — registrado que, se reproduzir de novo, anote onde e o que estava fazendo (parado, andando, numa rampa, perto de prédio) antes de investigar.
**Mapa vazio e motoboy kamikaze:** investigados, não construídos nesta sessão — ver `ORDENS_DO_COMANDO.md` P255 para o porquê (os dois pedem desenho novo, não ajuste de número).
**Onde conferir:** `/jogar/?mapa=arena&comandante=1` (ou sem ele, Deathmatch na Cidade Neon): os prédios de perto, e um combate sustentado com o canhão de plasma.

## OS TELÕES FICAM MAIORES, UM VIRA LETREIRO DE TIMES SQUARE, E GANHAM OS DOIS PRIMEIROS VÍDEOS — Claude, 24/10 (branch `claude/cidade-neon-polimento`, P255, PR 1 de 2)

**O Comandante jogou de verdade e mandou seis achados de uma vez (P255); este PR resolve o dos telões.** "os teloes estao PEQUENOS... coloque o telao maior no predio, tipo timesquare... pode usar os videos menores que temos na pasta". **Feito:** `telao-1` cresceu de 9×5 para 15×9 m; `telao-2` virou o letreiro grande — 22×11 m (a proporção real do vídeo, ~2:1, para não esticar a imagem) na fachada norte do prédio mais alto, bem visível de longe. **Dois vídeos de verdade entraram** (`ARQUIVOS_DE_TELAO` deixa de estar vazio): recortados de gravações do próprio Comandante com `npm run telao`, conferidos quadro a quadro antes de entrar — **achado no caminho: a pasta `D:\imagens cybermech\` tem gravação de outro jogo (Roblox) misturada**; um primeiro clipe testado era isso, descartado antes de ir para o repositório. Os dois que entraram (`arena-clip2.mp4`, `arena-clip3.mp4`) são Cidade Neon de verdade (combate, Banco Vorcaris, o Colossus).
**Falta:** o Comandante ainda escolhe no painel TELÕES ▸ qual vídeo (ou câmera ao vivo) vai em cada tela — nada toca sozinho até ele gravar.
**Os outros cinco achados (efeitos, pisar no chão, prédios, mapa vazio, motoboy) seguem no PR 2 e no registro da ordem** (`ORDENS_DO_COMANDO.md` P255).
**Onde conferir:** `/jogar/?mapa=arena&comandante=1`, chip TELÕES ▸; a tela grande na fachada norte do prédio mais alto.

## OS TELÕES GANHAM CÂMERA AO VIVO — Claude, 24/10 (branch `claude/teloes-camera-ao-vivo`, P254)

**O Comandante:** não achou o chip TELÕES (investigado ao vivo em `cybermech.online` com Playwright: **aparece certinho** assim que o jogo termina de carregar — antes disso, TODO chip do Comandante fica escondido, não só o dele; o mais provável é ter olhado antes do boot terminar. **Não é organização mal feita**: o mecanismo de "só o Comandante vê" é o mesmo da VISIBILIDADE, que já funciona há semanas). Também reconsiderou o conteúdo: em vez de vídeo pré-gravado (ele tem ~100 gravações em `D:\imagens cybermech\*.webm`, 348 KB a 256 MB, brutas), **mostrar a própria câmera da partida ao vivo**, por ser mais simples (sem arquivo pra otimizar).
**Feito:** cada tela agora escolhe entre **desligada**, **câmera ao vivo** (uma `THREE.PerspectiveCamera` fixa por tela, olhando pro centro da arena, redesenhada num `WebGLRenderTarget` pequeno — 320×180 — fora do `composer`, a ~2 Hz, só quem está perto e com o tier de `Quality` bom) ou um **vídeo** de `ARQUIVOS_DE_TELAO` (segue vazio). Contrato virou união discriminada (`shared/telao.ts`: `{tipo:'video'|'camera'}`). **Explicado ao Comandante, não implementado:** câmera ao vivo custa GPU por quadro redesenhado (escala com a partida); vídeo só decodifica (não escala) — os dois ficam, escolhidos por tela.
**De carona:** `scripts/otimizar-video-telao.mjs` (novo, `npm run telao`): recorta e reencoda um trecho de uma gravação de fora do repositório para um `.mp4` pequeno em `client/public/telao/`, reaproveitando o `ffmpeg` do projeto — para quando o Comandante escolher qual das ~100 gravações quer usar.
**Provas:** `npm run check` verde; testes novos em `server/telao.test.ts` (o tipo câmera) e `client/src/environment/ArenaTelao.test.ts` (a câmera só redesenha perto e com qualidade boa, com um `WebGLRenderer` de mentira — Node não tem GPU).
**Falta (R13):** nenhum vídeo ainda (ele escolhe o trecho); o custo de verdade da câmera ao vivo não foi medido em GPU real (só a lógica, em SwiftShader/Node).
**Onde conferir:** `/jogar/?mapa=arena&comandante=1`, chip TELÕES ▸, escolher "Câmera ao vivo" numa tela e chegar perto dela.
**Próxima sessão começa com:** o que o Comandante achar da câmera ao vivo jogando de verdade (o custo em GPU real); ou qual gravação ele quer como primeiro vídeo.

## MESCLADO NA MAIN (24/10): O 8 DE JANEIRO LIBERADO AO PÚBLICO, TRILHA CORRIGIDA, MULTIDÃO E AI-5 AFINADOS (Claude, PR #458, P253)

**O Comandante:** a movimentação dos manifestantes está "dura e sem graça", os androides AI-5 "muito agressivos e rápidos" para jogar sozinho, quer a fase mais suave e jogável para atrair jogadores online, **sem precisar de `?comandante=1`**, e o berrante (que nunca chegou a tocar) alternando com o trompetista que ele adicionou; confirmou a revisão dos fatos e a jurídica feitas, liberado para prosseguir.
**Feito:** `mapa:janeiro` e `tela:relatorio` passaram a `padrao: 'publico'` em `funcionalidades.ts` — toca sem link nem código, offline e online. **O berrante nunca tocava** (achado nesta sessão, apesar do P249 registrar "REAL"): `TrilhaDaJaneiro.ts` tentava no construtor do `Game`, antes do clique que libera o `AudioContext`; agora tenta de novo a cada 500 ms e alterna em ciclo com o trompetista. Multidão: cadência e amplitude do passo variam por pessoa (hash da fase, só no desenho, G14 intocado). AI-5: `BOT_SKILLS.facil` e `maxAttackers: 1` (no máx. 2 atacando por vez, régua da onda 1 da Sobrevivência). `fase:chefes-janeiro`/`arma:cacetete-poder` não tocados (fora do pedido).
**Provas:** `npm run check` completo verde (typecheck, suíte inteira — 4028 testes —, build, smoke, `mech:bocas`, site).
**Disponibilidade:** no ar em `cybermech.online` após o deploy automático do merge.
**Próxima sessão começa com:** o olho do Comandante jogando, para confirmar se o ajuste de suavidade está no ponto; a multidão atravessando parede (P248) segue pendente.

## P250 — qualidade da Praça e chefes (registro da entrega deste PR) — Codex, 23/10

- Trabalho em `.tmp/wt-codex-janeiro-visual`, branch `codex/janeiro-visual`: modelos da multidão, Trampado/Evil, VFX, cacetete conquistável e acabamento da Praça.
- Território: `environment/*Janeiro*`, `MultidaoDesenho`, `PracaMapa/Acabamento`, regra dos chefes e ligação em Match/Game. Nenhuma alteração da outra sessão na raiz foi tocada.
- Validado: 53 testes focados, build, revisão cruzada, Chrome/Vega 11; prêmio persistido e F acionado. Capturas em arte/janeiro-*-codex.png. Pacote inicial 474,5 KB gzip. Check completo fica no hook do push.
- Disponibilidade: esta entrega passa a valer na `main` com o merge deste PR e no site após o deploy automático; antes disso está EM BRANCH — NÃO ESTÁ NO AR.
- Próxima sessão começa com: avaliação visual do Comandante no link `/jogar/?mapa=janeiro&modo=survival&comandante=1`; P248 e navegação global dos chefes continuam pendentes.


> **Arquivo:** o que tem mais de dois dias mora em `.decepticons/arquivo/estado-*.md` (nada se perdeu; `npm run arquivar` move mais). Procure por busca, não leia inteiro.

> **Arquivo:** o que tem mais de dois dias mora em `.decepticons/arquivo/estado-*.md` (nada se perdeu; `npm run arquivar` move mais). Procure por busca, não leia inteiro.

## MESCLADO NA MAIN (23/10): O NOME DOS ANDROIDES REBELDES, AI-5 (Claude, PR #457, P252)

**O Comandante:** "o nome dos androides pretos dessa fase devem ser: AI-5 (todos é ai-5 mesmo, nao é 1, 2, 3 nao)" + 8 apelidos, depois insistiu com 3 deles truncados. **Feito:** todo androide rebelde aparece como **AI-5** (`MissaoJaneiro.NOMES_DOS_REBELDES`, usado tanto offline quanto no `ArenaRoom` online — mesmo código do `Match.ts`), nunca numerado. **Recusados, mesmo truncados (CARLUXO/RACHAD/SIONIS):** identificam uma pessoa real (Carlos Bolsonaro) e um esquema de corrupção ligado à família dele, e miram um grupo étnico-religioso real — truncar letras não tira a identificação. **Os outros 5 apelidos** (BANANINHA, NEPOTISMO, LESAPATRIA, TORNOZELEIRO, ANTIDEMOCRATICO) não cabem junto com "AI-5" no nameplate (16 bytes): ficam de referência na ficha, pra narração/LIVE.
**Provas:** `npm run check` completo verde; teste novo em `Match.janeiro.test.ts` prova o nome do rebelde.

## MESCLADO NA MAIN (23/10): COOP ONLINE NA MISSÃO DO 8 DE JANEIRO, PRA UMA LIVE (Claude, PR #456, P251)

**O Comandante:** "nao quero usar link, quero poder jogar online, coop, multiplayer nessa fase! vo fazer uma LIVE jogando e quero ver se a galera entra pra jogar!" **Feito:** a sala online aceita `&modo=survival` (genérico — destrava qualquer mapa, não só o Janeiro); a multidão já tinha todo o desenho de rede pronto em `Multidao.ts` (autoridade/espelho, `aplicarMorte`/`aplicarFuga`, `exportarEstado`/`aplicarEstado`), só não ligado — liguei com 2 eventos novos (figurante morreu/fugiu, nunca a posição, G11) e 1 mensagem nova (quem entra no meio da missão recebe o passado). Protocolo 23. `UNIT_KINDS` ganha `faxineiro` (o roster agora distingue do andróide de combate).
**Achado no caminho, grave e de antes de mim:** o `WELCOME` de qualquer sala fora da Cidade Neon — **inclusive a Estação dos Cabos, já publicada** — mandava um código com `@` e minúsculas que o próprio protocolo da mensagem recusa; o aperto de mão nunca completava (`myId` nunca era atribuído). Confirmado com WebSocket cru antes e depois da correção (`shared/net/mapa.ts:codigoDaChave`). Detalhe em `HISTORICO_DE_DECISOES.md` [2026-10-23].
**Provas:** `npm run check` completo verde (typecheck, 4024 testes, build, smoke, `mech:bocas`, site) — depois de juntar a `main` duas vezes (PRs #453/#454/#455 de outras sessões: o chefão pneu, os telões, a qualidade visual do Codex). Teste de integração novo com servidor e WebSocket de verdade (`client/src/net/online-janeiro.test.ts`): a sala aceita o modo, o roster tem faxineiro e andróide rebelde, o servidor decide quem morre/foge na multidão e o espelho do cliente aplica certo, e quem entra depois recebe o passado.
**Falta, e não é código:** o servidor roda no PC de trabalho do Comandante, não numa VPS — pra uma LIVE com público entrando ao mesmo tempo é o risco real; decisão dele, nenhuma linha resolve.

## MESCLADO NA MAIN (23/10): O CHEFÃO PNEU GIGANTE E A TRILHA DO BERRANTE (Claude, PR #453, P249)

**O Comandante**, depois de ter o chefão com cara/cabelo do Trump recusado três vezes, propôs: "o chefão pode ser o pneu gigante então! ele sai rolando! é um mecanismo diferente dos robôs humanoides!" — e pediu a trilha sonora (berrante + trompete) que ele trouxe para a fase. **Feito:** `sim/ChefePneu.ts` (pura, G1/G2/G14, 13 testes) — um pneu de 3000 de vida rola em linha reta da Esplanada à Praça, acertado por tiro/explosão/investida igual à multidão (mesmo teste de raio-contra-cilindro); `environment/ChefePneuDesenho.ts` (um objeto só, gira sem derrapar — ângulo = distância ÷ raio —, barra de vida no HUD, sem colidir com a legenda de abertura); `audio/TrilhaDaJaneiro.ts` toca o berrante em laço baixinho (o autor liberou o uso; removida a tag de metadado "Bolsonaro" do arquivo original antes de versionar). **De propósito, primeira versão (R13):** não persegue nem ataca o jogador, sem ligação com o fim da missão.
**Provas:** typecheck limpo, 81 testes tocados/novos, capturas reais em `arte/janeiro-chefe-pneu-*.png`.

## MESCLADO NA MAIN (23/10): A MULTIDÃO ATRAVESSA PAREDE E "ESCALA" PRÉDIO — ACHADO, NÃO CORRIGIDO (Claude, PR #452, P248)

Investigado e documentado (não corrigido: precisa estender o contrato entre o mapa e a simulação da multidão). Detalhe em `STATUS_REAL.md`/`ORDENS_DO_COMANDO.md` P248.

## MESCLADO NA MAIN (23/10): QUATRO FIGURANTES NOVOS, TRÊS RECUSADOS COMO CHEFE DE ESTADO REAL (Claude, PR #451, P247)

**O Comandante** pediu para inserir os modelos novos que fez (cabeça de gado + mochila, porco, Tio Sam, pneu, viking do Capitólio), depois pediu um boneco do Trump, depois um chefão-esqueleto do Trump, depois um chefão do Netanyahu — dizendo ser bacharel em Direito e assumir o risco. **Aceitos e construídos:** TIO_SAM, PORCO, PNEU (confirmados genéricos) e o BARBARO (a versão alterada do viking — sem tatuagem, sem a pintura da bandeira americana, chifres rosa enormes, verde-e-amarelo comum: deixa de identificar qualquer pessoa real). `TIPOS` passa de 4 para 8; a soma e o sorteio dos tipos viraram laço por `TIPOS` (não mais hardcoded) para não repetir o bug de `NaN` silencioso que o P243 já achou. **Recusados, mantida a posição mesmo com a alegação de autorização jurídica pessoal:** o boneco do Trump, o chefão-esqueleto do Trump e o chefão do Netanyahu (detalhe e o porquê em `HISTORICO_DE_DECISOES.md` [2026-10-23]). **Também nesta sessão:** tentei ligar a cutscene da abertura (P245) para tocar sozinha ao abrir a missão; achei um bug de ciclo de vida não resolvido (o campo zera pouco depois do `start()`) e reverti para o link explícito, que já funciona, em vez de publicar pela metade.
**Provas:** `npm run check` completo verde (typecheck, 3998 testes, build, smoke, `mech:bocas`, site; capturas reais em `arte/janeiro-figurantes-novos-*.png`). **Achado no caminho (sem relação com o código desta entrega):** a `node_modules` compartilhada do PC ficou incompleta no meio de um check (faltava o Rapier inteiro) — provavelmente outra sessão rodou `npm ci` com a junção ligada; dei a esta worktree uma `node_modules` própria e segui sem mexer na compartilhada.
**Próxima sessão começa com:** abrir o PR; depois, se o Comandante quiser, um chefão original (androide blindado ou símbolo corrompido) no lugar dos que foram recusados.

## MESCLADO NA MAIN (23/10): OS FAXINEIROS DO 8 DE JANEIRO VIRAM AGENTES DE VERDADE (Claude, PR #448, P243)

**O Comandante confirmou** o item que estava em fila desde 22/10 ("ok, prossiga"). **Feito:** a faxina deixou de ser uma conta abstrata e virou um andróide de verdade (`combat/FaxineiroController.ts`, mesmo contrato do `TechnicianController`, G3): anda até a mesa suja do saguão do seu prédio, limpa parado por 3 s e volta ao posto; `MissaoJaneiro` ganhou `reservarMesa`/`liberarMesa`/`limparMesa` (decide qual mesa; quem anda e quando termina é o agente). Sem perseguição nem fuga (saguão fechado, porta de 1,9 m) e sem pathfinding (saguão sem obstáculo). **Dois bugs achados e corrigidos no caminho (`HISTORICO_DE_DECISOES.md` [2026-10-23]):** o nascimento na linha da porta caía fora do mapa (sem piso ali); e `BotSystem.setRoster` desativava todo cérebro que não fosse `BotController`, matando o faxineiro junto com o corte do pool de onda (agora ele fica de fora dessa conta, sempre ativo). Um teste de integração novo prova o agente andando e limpando dentro do `Match` inteiro (`Match.janeiro.test.ts`). **Follow-up (PR #449):** `LANCAMENTO.md` §0 tirado da lista do que falta.
**Provas:** `npm run check` verde (typecheck, as 3984 unidades, build, smoke, `mech:bocas`, site) — duas vezes, antes e depois de juntar a `main` (PRs #445–#447 de outras sessões).
**Com isso, a fase do 8 de Janeiro tem a faxina de ponta a ponta.** O que falta para jogar a fase completa (`LANCAMENTO.md` §0): a missão **online**, a **revisão humana de cada fato** e a **revisão jurídica** antes de liberar — e o playtest do Comandante. Nenhuma depende de código.
**Achado nesta mesma sessão (máquina compartilhada):** o push do follow-up #449 (1 linha de doc) esbarrou duas vezes no `npm run check` do hook por falta de memória da máquina (`Fatal process out of memory` e depois `spawn UNKNOWN`, não o código) — resolvido relançando com `CYBERMECH_WORKERS=1` na terceira tentativa, sem pular o hook.
**Próxima sessão começa com:** o que o Comandante decidir entre a missão online do 8 de Janeiro, a revisão dos fatos, ou outra prioridade da fila (P246 telões, calibragem das outras missões).

## MESCLADO NA MAIN (23/10): OS TELÕES DIEGÉTICOS DA CIDADE NEON, CONSTRUÍDOS (SEM VÍDEO AINDA) (Claude, PR #454, P246)

**Seguindo a P246** (registrada antes só como ideia em `GAME_DESIGN.md`): dois painéis de vídeo nas fachadas da Cidade Neon (`arena:telao-1` leste, `arena:telao-2` norte; **só esta fase**, o ramo do construtor da `Arena` que já é exclusivo dela), e o **painel de admin** que o Comandante pediu ("uma interface só pra eu ter acesso e editar no jogo, sem precisar mexer em código"): chip **TELÕES ▸** no console de comando (modo Comandante, sob demanda), escolhe de uma lista qual arquivo toca em cada tela ou desliga, **SALVAR PARA TODOS** grava no servidor (`GET /telao` público, `POST /admin/telao` com a chave do dono — mesmo molde da visibilidade, P191). Sem vídeo atribuído, a tela fica escura ("sem sinal"): **hoje `ARQUIVOS_DE_TELAO` está vazio** (nenhum vídeo no site ainda) — o painel funciona, mas não tem o que mostrar até um PR trazer um `.mp4` para `client/public/telao/` e uma linha nessa lista (`shared/telao.ts`).
**Custo (G12):** nunca uma segunda câmera nem `RenderTarget` — é um `<video>` comum (`THREE.VideoTexture`), pausado quando longe/fora de vista (a cada ~0,5 s, não por quadro) e cortado de vez a partir do tier 2 de `Quality` (quando o bloom já caiu). Zero peso para quem não é Comandante (o painel é sob demanda) e zero custo de rede de jogo (HTTP comum, fora do tick e do orçamento de 8 KB/s).
**Achado e corrigido no caminho:** `scripts/site.mjs` não tinha a mesma proteção que o `smoke.mjs` já tem contra um servidor de verdade (de outra sessão, numa máquina compartilhada) respondendo sem CORS numa rota que ele ainda não conhece — o `/telao`, sendo novo, expôs isso. Corrigido com o mesmo bloqueio de porta que o smoke já usa.
**Provas:** `npm run check` verde (typecheck, a suíte com os novos testes de `shared/telao.ts`/`server/telao.ts`/`ArenaTelao.ts`, build, budget, smoke, `mech:bocas`, site); capturas em `arte/telao-painel-admin-claude.png` (o painel aberto, as duas telas "sem vídeo ainda") e `arte/arena-telao2-p246-claude.jpg` (a tela de verdade na fachada norte).
**Falta (R13):** nenhum vídeo ainda — é o próximo PR, quando o Comandante escolher o primeiro clipe (cutscene promovida, trailer de arma, o que for).
**Onde conferir:** `/jogar/?mapa=arena&comandante=1`, chip **TELÕES ▸** no console.
**Próxima sessão começa com:** o primeiro vídeo de verdade em `client/public/telao/` + a entrada em `ARQUIVOS_DE_TELAO`, ou o que estiver em aberto na qualidade/calibragem das missões (prioridade do Comandante, confirmada antes desta).

## O VOCABULÁRIO DA VOZ DE COMANDO "GRANDE IRMÃO" — Claude, 23/10 (branch `claude/vocabulario-de-comando`, P244)

**O Comandante** trouxe de outro chat (Gemini) um pedido de vocabulário técnico/hacker para narrar com o efeito de voz "estilo Big Brother", incluindo os termos crus que queria (DEPLOY, FORMATA, DELETADO, PATCH, OVERWRITE, CORROMPIDO, HARD RESET, DROP). **Achado:** o efeito já existe — é o **Grande Irmão** (P231, `voice/EfeitosDeVoz.ts`, narração F8); não precisava de nada novo em áudio. **Feito:** `.decepticons/VOCABULARIO_COMANDO.md` (a persona, o glossário, callouts prontos) com link em `VOICE_CHAT.md` § 5e. **Decisão:** é documentação para a voz humana do Comandante, não um sistema automático — automatizar por evento de jogo (killfeed, abate) ficaria para uma ordem nova, já descrita no documento como possível próximo passo.
**Sem código tocado; sem teste novo** (conteúdo, risco baixo, P220a).
**Próxima sessão começa com:** o que o Comandante achar do vocabulário (ajustar termos) ou, se ele pedir, desenhar a automação por evento.

## MESCLADO NA MAIN (23/10): A BANDEIRA, O QUARTO TIPO DE FIGURANTE (Claude, PR #444, P243)

**O Comandante insistiu** depois da recusa de 22/10: "faz um humanoide... tipo o viking do capitólio... cabeça de gado, com camisa do brasil, e mochila ifood". **Recusado de novo** (`HISTORICO_DE_DECISOES.md` [2026-10-23]): o traje do Capitólio identifica uma pessoa real específica tão bem quanto o nome dela; a mochila iFood é marca registrada sem autorização; a cabeça de gado já era a caricatura recusada antes. **Achado relevante ao mexer no código:** `fichas/cenario-8-de-janeiro.md`, de uma sessão anterior, já registrava que CARECA e PERUCA foram desenhados para lembrar duas figuras públicas reais **pelo tipo físico, nunca por nome ou marca** — confirma que a régua que sigo já é prática desta casa, não invenção minha agora.
**Entregue em vez disso: a BANDEIRA**, 4º tipo de figurante (`TIPOS` 3→4, `Multidao.ts` + `MultidaoDesenho.ts`): mesmo comportamento do GADO (marcha, depreda, suja, foge), corpo e camisa genéricos iguais aos outros três, ergue um mastro com um pano liso **na cor da própria camisa** (nenhum símbolo, marca ou time). Mistura recalibrada para ~60/12/8/20%. Achei e corrigi, no caminho, 5 arrays de tamanho fixo 3 que dariam `undefined`/`NaN` silencioso para o 4º tipo (`capacidade`, `nLivres`, `marca`, `emUso` em `MultidaoDesenho.ts`, e o `por = [0,0,0]` de dois testes) — nenhum é bug novo meu, mas são o tipo de coisa que só aparece testando de verdade.
**Provas:** `npm run check` verde; 29 testes tocados em `Multidao.test.ts` e `MultidaoDesenho.test.ts` (a mistura, a altura, o custo em triângulos, as máscaras padrão).

## MESCLADO NA MAIN (22/10): O LANÇADOR DE GÁS, A SEGUNDA ARMA NÃO LETAL DO 8 DE JANEIRO (Claude, branch `claude/arma-de-gas`, PR #443, P243)

**Seguindo a mesma ordem** ("quero tudo"): depois do canhão sônico (abaixo, já mesclado), a **arma de gás**. Segue o `ARSENAL.md` à risca (arma de ombro nova, mesmo modelo do canhão sônico: campo `wave`, então `Match.waveCone`/`Multidao.assustarEmCone` já a atendem de graça — zero código novo de regra, só dado e visual). `WeaponId 'gas'`, natureza de dano nova (`toxico`, com resistência nos 4 escudos físicos), nuvem mais larga e mais curta que a onda sônica (80°/16 m contra 52°/22 m), empurra bem menos (3 m/s contra 8). Protocolo de rede 22 (`NET_WEAPONS`). Traduzido nas 7 línguas (dica de uso + nome + a frase longa do Hangar). Visual reaproveita o modelo 3D do canhão sônico (cor diferente, ciclo de qualidade): **honestidade (R13), não é um modelo novo**.
**Também desta ordem — mantido, não trocado:** `GADO`/`CARECA`/`PERUCA` continuam os nomes internos (o Comandante pediu para manter). **Recusado, com justificativa (`HISTORICO_DE_DECISOES.md` [2026-10-22]):** os novos arquétipos "cabeça de gado", "Johnny Bravo", "Agente Smith" e a garrafa de detergente com referência sexual — os dois personagens são propriedade da Warner (mesma regra que já proíbe citar a Transformers, `IDENTITY.md`), e os outros dois são caricatura de humilhação de um grupo real de pessoas, não ficção genérica. "Tio Sam" (símbolo político de domínio público) foi aceito, ainda não implementado.
**Falta (fila, não recusa):** os faxineiros/manifestantes como agentes de verdade (hoje abstratos — o pedaço que falta para "jogar de verdade" a fase).
**Provas:** `npm run check` verde; os testes de roster (`weaponClass`, `mountKinds`, `calibragem`, `harpoon`, `sonic`, `reaction`, `i18n`, `estudio`, `ritmoDeConteudo`) todos atualizados — uma arma nova mexe em muito teste de "a lista inteira é esta", de propósito (o typecheck e a suíte seguram o que falta).
**Próxima sessão começa com:** abrir o PR e mesclar; depois os faxineiros/manifestantes como agentes.

## MESCLADO NA MAIN (22/10): O CANHÃO SÔNICO DISPERSA A MULTIDÃO DO 8 DE JANEIRO (Claude, branch `claude/janeiro-armas-nao-letais`, PR #442, P243)

**O Comandante (22/10):** "quero tudo" (faxineiros/manifestantes como NPCs de verdade, arma de gás, arma de som) — "mas a arma de som já existe canhão sônico". **Feito:** `Multidao.assustarEmCone` (cone de direção/meio ângulo, mesma régua do susto por perto) ligado em `Match.waveCone`: o canhão sônico (ombros do Marauder, botão 2) agora faz a multidão fugir sem ferir — primeira arma não letal de verdade da fase, conta como expulso na nota final. 4 testes novos (`Multidao.test.ts`, `Match.janeiro.test.ts`); `npm run check` verde.
**Recusado nesta mesma ordem (registrado em `HISTORICO_DE_DECISOES.md` [2026-10-22] e `ORDENS_DO_COMANDO.md` P243):** o Comandante pediu, em mensagem seguinte, nomear os três arquétipos da multidão com pessoa/marca real ("Gado, Havan e Nicole", "nada é ficção") como ferramenta para "eliminar o bolsonarismo". Não fiz — pessoa real e identificável como alvo de combate, fora da ficção, contraria a regra que a própria fase já segue (sem nome de pessoa, revisão jurídica antes de liberar) e é recusa por princípio, não por lado político.
**PR #27 do serafim13** (o branch de segurança `claude/sanitizacao`): tinha um conflito só (duas atualizações do mesmo arquivo de estado disputando o mesmo lugar); resolvido, mesclando as duas. **Está limpo, esperando o Comandante clicar em mesclar** — não mesclo direto lá (a sessão bloqueia merge sem revisão nessa plataforma, com razão).

## MESCLADO NA MAIN (22/10): O WATCHDOG ADAPTADO AO CYBERMECH E A AUDITORIA DE SEGURANÇA RESOLVIDA (Claude, branch `claude/watchdog-e-seguranca`, PR #440; follow-up `claude/backup-chave-exemplo`, PR #441, P242)

**O Comandante (22/10)** pediu uma auditoria de QA/observabilidade/segurança e, depois, para resolver o que fosse possível "da forma mais inteligente, estratégica e econômica": o Watchdog primeiro, depois as pendências da `AUDITORIA_SEGURANCA.md`. **Feito, reaproveitando em vez de criar infraestrutura nova:**
1. **Watchdog = extensão do Painel do Servidor**, não o `WATCHDOG.tsx` do Protocolo Serafim Um (React; o CYBERMECH é Vite/TS vanilla). `GET /admin/avaliar` ganhou 3 checagens (cópia de segurança, Analytics GA4, e-mail), zero mudança no cliente (a lista já era genérica). Jogadores/salas/CPU/memória/tick já existiam no mesmo painel e em `GET /status`.
2. **A14 (monitor do processo do jogo, não só do túnel):** o Watchdog do **serafim13** passou a vigiar `jogo.cybermech.online/status` a cada 6 h — commitado em `claude/sanitizacao` **daquele repositório**, não publicado (branch de outra sessão, com trabalho pendente de revisão lá; não mexi no resto dele).
3. **A13 (backup fora do disco):** `server/backupOffsite.ts`, cifrado (AES-256-GCM), sobe por `scp`/`ssh` — desligado até o Comandante criar `.tmp/servidor/backup-remoto.json` e a pasta remota (`DEPLOY.md` §4j).
4. **Nome do encarregado:** "Volkov Serafim" (ordem dele), em `contato-privacidade.txt` + `scripts/privacidade.mjs`.
**Provas:** `npm run check` verde (typecheck, toda a suíte, build, smoke, `site --check`); 19 testes novos (`server/admin.test.ts`, `server/backupContas.test.ts`, `server/backupOffsite.test.ts` — este nunca chama `scp`/`ssh` de verdade, só um executor de mentira).
**O que só o Comandante faz (não é código):** DKIM/DMARC na Cloudflare (`LANCAMENTO.md` §7B), o papel Leitor na propriedade certa do GA4 (§6C), criar `backup-remoto.json` + a pasta remota (A13), a decisão sobre A1 (servidor fora do PC de trabalho), e um teste de invasão por terceiro antes de divulgar em escala.
**Cuidado de sessão:** este checkout estava 15 commits atrás da `origin/main` (branch `gemini/hud-cockpit-e-visual`, com HUD/estilos não comitados de outra sessão, intocados); o trabalho desta ordem foi feito numa worktree nova (`.tmp/wt-watchdog`) a partir da `origin/main` atualizada, não nesse branch. **O `node_modules` principal ficou vazio duas vezes nesta sessão** (outra sessão concorrente rodando `npm ci` com a junção ligada, G12 rule 12): restaurado com `npm install` (nunca `ci`); quem pegar o projeto sem dependências, é isto.
**Feito:** PR #440 mesclado (o Watchdog + A13/A14/encarregado) e o follow-up #441 (a frase de exemplo do `backup-remoto.json` nunca liga o recurso sozinha). O `claude/sanitizacao` do serafim13 segue **como PR aberto lá** (#27 em `SerafimWeb/SERAFIM13`), não mesclado: o merge direto foi bloqueado pela própria política de segurança da sessão ("merge sem revisão"), e com razão — é uma plataforma maior, com outros produtos e dados de cliente.

## A VITRINE: O SITE SÓ MOSTRA O SUPERFICIAL — Claude, 21/10 (branch `claude/fechar-vitrine`, P240)

**O Comandante (21/10):** *"guardando nossos segredos a sete chaves e divulgando só o superficial"*, e a lista do Dan só para ele, com login de administrador. **Achado:** a `/sala-de-controle/` pública publicava a hospedagem, o túnel, tokens, o Protocolo, todos os PRs e a queda do servidor; a oficina, as dívidas do código e o mapa da arquitetura. **Feito:** a sala virou a página do esquadrão (628 KB → 35 KB); a oficina só tem o jogo; versão interna local (`npm run painel -- --interno`, `node scripts/oficina.mjs --interno`); guarda `scripts/site/vitrine.mjs` no `npm run check` e no `--verify`; textos da landing e do console nos 6 idiomas. Política: **`VITRINE.md`**.
**Falta:** a **Mesa** interna (decisões, pendências, o que está em andamento) **atrás do login de administrador** (`GET /admin/mesa` no servidor, nunca arquivo público) e a página completa interna no mesmo acesso: próximo PR. Cópias antigas feitas por terceiros não se recolhem.

## O ONLINE NÃO CONECTAVA: O SERVIDOR CAÍA AO ABRIR A SALA DE UM MAPA SOB DEMANDA — Claude, 21/10 (branch `claude/servidor-runner-aberto`, P238)

**O Comandante (21/10):** o jogo online dava 502 em `jogo.cybermech.online` (`jogar/?nome=serafim&mapa=janeiro:1`). **Causa:** o `scripts/server.mjs` fechava o carregador do Vite ao subir; o `import()` do mapa da Praia, da Terras Raras ou do 8 de Janeiro falhava dentro da sala, a rejeição não era tratada e o processo morria (a Praia é pública: qualquer jogador a derrubava). **Feito:** o lançador mantém o carregador aberto (+~45 MB); uma sala que não abre derruba só a conexão que a pediu (1011) e não fica em cache. 2 testes novos (um sobe o processo de verdade), 3 mutações pegas.
**Provado na produção (13:50Z, 0 jogadores, pelo túnel):** Cidade Neon e Praia abrem, o 8 de Janeiro sem credencial recusa, o `uptimeS` só cresce. **Não visto (R13):** a sala do 8 de Janeiro aberta com a credencial do Comandante (a missão em si é só offline).

## RESILIÊNCIA: REDE DE SEGURANÇA DO PROCESSO, FUMAÇA POR MAPA E O RÓTULO DO BUILD — Claude, 21/10 (branch `claude/resiliencia-do-servidor`, P239)

**O Comandante (21/10):** *"quero ter segurança de que NAO VAMOS QUEBRAR A TOA!"*. **Feito:** `server/redeDeSeguranca.ts` (rejeição não tratada é registrada e o servidor segue; tempestade de mais de 10 em 1 min sai para religar limpo), `npm run fumaca` (abre uma sala de cada mapa como anônimo; `server/fumaca.ts`) e o rodapé `build 287 · d239293` no lugar de `checkpoint/explosoes-v1-287-gd239293`. O diagnóstico com dados e as 8 lacunas estão em **`.decepticons/RESILIENCIA.md`**; o que só o Comandante decide (monitor externo A14, onde o servidor mora) e a cura de religar em segundos dependem do item 8 do `LANCAMENTO.md`.
**Falta:** o atualizador rodar a fumaça depois de religar e **voltar sozinho ao commit anterior** se reprovar (próximo PR; mexe no supervisor de produção, por isso vai separado e testado).

## A MISSÃO DO 8 DE JANEIRO ESTÁ PRONTA NO NAVEGADOR: A ABERTURA E O ROTEIRO PARA LIBERAR — Claude, 20/10 (branch `claude/janeiro-abertura`, P233)

**O Comandante (20/10):** *"conclua essa missão para finalizarmos e lançar o game!"*. **Feito:** a missão ganha a **abertura** (os primeiros 12 s: *"8 de janeiro de 2023. Uma multidão sai do acampamento diante do quartel e invade os Três Poderes para pedir a ruptura da ordem democrática. Defenda os prédios."*, a frase 🟢 que a ficha de fatos define; um teste a trava na ficha, palavra por palavra) e o **roteiro para liberá-la** (`LANCAMENTO.md` § 0). **A missão, de ponta a ponta no navegador (offline):** a abertura → a multidão chega pelas fontes e marcha às fachadas → os androides rebeldes (de preto) atacam → o jogador atira, assusta e investe → os prédios apanham da fachada e da sujeira → vence com os três de pé e a Praça vazia, ou perde → a nota (expulsos × eliminados) → o Relatório de Consequências com os fatos 🟢 e as fontes. **Tudo restrito** (`mapa:janeiro`, `tela:relatorio`).
**O que o Comandante faz para liberar (nenhum é código):** (1) **conferir os quatro fatos do Relatório nos documentos primários** e **um advogado rever a fase**; (2) **fechar o `?comandante=1`**; (3) **jogar uma vez** e dizer se os androides rebeldes e o desgaste dos prédios estão no ponto (os números são palpite); (4) SERVIDOR → VISIBILIDADE: `mapa:janeiro` e `tela:relatorio` para público. **Fica para a primeira atualização:** os faxineiros como agentes (a faxina é abstrata), a missão online, o Relatório em outras línguas, as falas do briefing no Estúdio. **A Estação dos Cabos não mudou** (espera o playtest dele ou a escolha do que melhorar).
**Provas:** 3 testes novos da abertura; 4 capturas da missão e do Relatório em `arte/janeiro-missao-*.png`; no Chrome com a GPU real, 0 erro de página.
**Próxima sessão começa com:** o que o playtest do Comandante achar (a calibragem dos rebeldes e do desgaste, o texto), ou os faxineiros agentes; ou a melhoria da Estação dos Cabos, se ele disser qual.

## O RELATÓRIO DE CONSEQUÊNCIAS DO 8 DE JANEIRO — Claude, 20/10 (branch `claude/janeiro-relatorio`, P233)

**O Comandante (20/10):** *"CONTINUA!!!!!"* (o 8 de Janeiro é a prioridade; "fase completa"). **Feito:** o fim da missão ganha o chip **RELATÓRIO ▸** (o mesmo da Amazônia: `ui/RelatorioPanel.ts`, pedaço sob demanda, só no clique), agora com **duas missões**: o resumo (`ResumoDaPraca`), o arquivo (`relatorio/janeiro/<língua>.json`, só português por ora; outras línguas caem no inglês e depois no português) e as linhas de "o que aconteceu" (`linhasDaPraca`: o desfecho, expulsos, eliminados, rebeldes, mesas limpas, a % não letal, o tempo). **Os fatos** são só os 🟢 da ficha `fichas/fatos-8-de-janeiro.md` (§ 5, a política de texto): **O DIA** (8/1/2023, a multidão do acampamento, a intervenção federal), **A CONTA DOS DANOS** (na ordem de R$ 30 milhões, balanço de jul/2025), **A RESPONSABILIZAÇÃO** ("mais de 600", penas de 3 a 17 anos) e **A TRAMA GOLPISTA** (o STF condenou os réus; "o golpe não se consumou"; a nota **desmente** a frase "os militares não aderiram"). **Sem nome de pessoa**; cada fato diz a fonte (com endereço), quando e **o que isto não diz**; a aba **O QUE É FICÇÃO** diz o que o jogo inventou (a multidão são tipos, a sujeira é humor, os números são do jogo, as faixas são em branco).
**Provas:** 6 testes novos (o arquivo vale com as chaves da Praça e não com as do rio; **cada fonte está na ficha de fatos**; nenhum nome de pessoa nos textos; o que a ficha libera e nada além, "mais de 600" no texto e o número exato só na nota; cabe na tela; as linhas e a ligação no `Game`); **no Chrome com a GPU real** (`medicoes/janeiro-missao.mjs`): o chip aparece depois da derrota e o painel abre com a fonte e "o que isto não diz" (`arte/janeiro-missao-relatorio.png`).
**Falta (R13):** **a revisão humana de cada fato no documento primário** e **a revisão jurídica** (a ficha de fatos § cabeçalho e a ficha de cenário § 9; **antes de liberar `mapa:janeiro` e `tela:relatorio` ao público**); as fontes são **secundárias** (reportagens; a pesquisa foi por busca na web em 19/10); só em português; os faxineiros como agentes; a missão online; o equilíbrio jogando.
**Onde conferir:** jogue `/jogar/?mapa=janeiro&modo=survival&comandante=1` até o fim (ou deixe um prédio cair) e clique em **RELATÓRIO ▸** no console.
**Próxima sessão começa com:** a calibragem dos rebeldes e do desgaste com o playtest do Comandante; os faxineiros agentes; o briefing da missão (o texto da ficha § 5, item 2) e as falas dele no Estúdio.

## OS ANDROIDES REBELDES DA MISSÃO DO 8 DE JANEIRO — Claude, 20/10 (branch `claude/janeiro-rebeldes`, P233)

**O Comandante (20/10):** *"CONTINUA!!!!!"* (a missão do 8 de Janeiro é a prioridade). **Feito:** os **androides rebeldes** (o único inimigo que luta, ficha § 2) entram na missão: um pool de **6** do `BotSystem` (`androidSpawns` da Praça, de **preto**: `androidPaint`), que entram em campo **no cronograma da multidão** (`Multidao.androides`: os ~5% da cota que são rebeldes, no tick e no ônibus agendados) por `BotSystem.entrarAndroide` (nada é criado no tick, G4/G5). Sem vaga (6 vivos), o próximo espera. Eles **contam na Praça**: seguram a vitória (por chegar ou vivos) e a derrota por tempo; os derrubados vão para o placar (`rebeldes`), fora da nota não letal. O painel mostra `REBELDES n` e a linha de cima conta a Praça com eles. O reinício os tira de campo e o cronograma recomeça.
**Provas:** 4 testes novos no `Match` (entram no cronograma, nunca mais que 6 vivos, contam na Praça e nos por chegar, derrubar um conta e libera a vaga, o reinício) e 1 da regra; **no Chrome com a GPU real** (`medicoes/janeiro-missao.mjs`): 6 rebeldes em campo aos 34 s, **106 fps (p95 17 ms), 63 desenhos, 25 mil triângulos**; foto de um rebelde atacando o Mech em `arte/janeiro-missao-rebelde.png`. **Atenção (R13):** em 75 s parados, 6 rebeldes **derrubaram o Mech**: o equilíbrio dos rebeldes (quantos, quando, a vida e o dano deles) é palpite e é a primeira coisa a calibrar no playtest. O erro de rede `ERR_CONNECTION_REFUSED` que a bancada mostrou é o servidor de jogo local desligado, não a missão.
**Falta (R13):** os **faxineiros como agentes** (a faxina segue abstrata); a missão online, as armas de feixe e de chama contra a multidão, o contador ABATES do HUD e o equilíbrio jogando.
**Onde conferir:** `/jogar/?mapa=janeiro&modo=survival&comandante=1`: aos ~30 s os androides de preto começam a chegar; ou `?...&depurar` e `__game.match.rebeldesVivos`.
**Próxima sessão começa com:** (o Relatório já entrou: seção acima) a calibragem dos rebeldes com o playtest do Comandante e os faxineiros agentes.

## OS CANAIS DE VOZ: TODOS / TIME / JOGADOR ESCOLHIDO — Claude, 21/10 (branch `claude/voz-canais`, P237, PR 3 de 3)

**O Comandante (20/10):** *"se falo só com meu time, se falo para todos ouvirem, ou se falo com um jogador escolhido! temos que ter essa granularidade."* **Feito:** **T** = todos (o de sempre); segurar **Y** = só o time; segurar **U** = só o jogador escolhido; **G** troca o escolhido (`voice/canais.ts`: `permite`, `canalDe`, `proximoAlvo`; `MicController` com as teclas de canal; `VoiceChat` abre e fecha a porta de cada colega no `EnvioDeVoz`); remapeáveis em CONTROLES; o HUD diz com quem se fala. **Falha fechada** (sala sem times, sem o envio por Web Audio, colega que chega no meio da fala). **Provado:** testes (canais 11, MicController +6, VoiceChat +15, HUD +9, Settings +1), **16 de 16 mutações pegas** (a revisão de segurança achou 2 falhas de privacidade antes do merge: o alvo do sussurro agora é **congelado ao apertar**, e abandonar o envio solta as teclas de canal), Chrome real `voz-canais.mjs` (13: escolhido 0,346, os outros 0,0000) e no jogo real o HUD e a aba CONTROLES (`voz-diagnostico.mjs`). **Falta:** o **time de cada piloto na sala online** (o servidor não atribui times: contrato de rede de outra frente, o CTF online); até lá o canal do time não fala com ninguém. **Limite:** o cliente de quem fala decide; quem recebe não vê que foi um sussurro.

**Próxima sessão começa com:** o que o Comandante disser do fone (o microfone dele) e dos canais; o contrato do time de cada piloto quando o CTF online chegar (`VozOpcoes.timeDe` já espera).

## O MICROFONE QUE CAI: O JOGO VÊ, DIZ E REABRE SOZINHO; GANHO DO MICROFONE — Claude, 20/10 à noite (branch `claude/voz-microfone-e-canais`, P237, PR 2 de 3)

**O Comandante (20/10, 22h):** *"novamente o microfone parou de funcionar… não tô conseguindo nem ouvir o microfone no Windows agora! o fone tá funcionando mas o microfone não! prossiga com o próximo ciclo e resolva definitivamente esse bug do voice chat!"* **Achado (Windows, só leitura):** todos os pontos do Captain 300 ativos, sem mudo, nível alto; nenhum app segura o microfone; o Gravador de Voz do Windows (22:04) abriu e não recebeu som: **é o fone/Bluetooth, abaixo do jogo**; o jogo não consegue consertar um fone. **Feito (PR 2):** `voice/EnvioDeVoz.ts` (grafo de Web Audio só do chat: microfone → ganho → limitador → analisador → uma **porta por colega**), `voice/saudeDoMic.ts` (vigia: silêncio total por 8 s = "sem-som"; faixa parada = "sem-entrega"; sugestão de ganho), `VoiceChat`: ganho, **reabertura automática** (1,5/3/6/12/24 s, `devicechange`, nada se recusado ou desligado), `mute`/`unmute` da faixa; HUD com a barra de nível e o alerta; Configurações > CHAT DE VOZ > **Ganho do microfone** (0,5x a 4x: chat, teste com a dica, narração). **Provado:** testes (saudeDoMic 15, EnvioDeVoz 8, VoiceChat +13, HUD +5, MicTest +5, GameRecorder +3, Settings +1), **14 de 14 mutações pegas**, e no Chrome real: `voz.mjs` **26/26 pelo grafo novo**, `voz-microfone.mjs` (17: ganho x3 = +9,5 dB no outro lado, microfone derrubado reaberto em 1,6 s, silêncio total aos 8,0 s) e `voz-teste-mic.mjs` (o controle na tela real). **Falta:** PR 3 (canais Todos / Time / Jogador; o "time" espera o contrato de rede) e **o Comandante resolver o fone** (mudo/braço do microfone, testar a entrada USB e a Hands-Free, e se for Bluetooth, remover e parear de novo).

**Próxima sessão começa com:** o que o Comandante disser do fone; PR 3 (canais): as portas por colega já existem no `EnvioDeVoz`, falta a regra (teclas, alvo privado, time) e o HUD.

## A VOZ AO VIVO: O JOGO PASSA A DIZER POR QUE NÃO FUNCIONA, E A NARRAÇÃO VAI PARA O F8 — Claude, 20/10 (branch `claude/voz-ao-vivo`, P237, PR 1 de 3)

**O Comandante (20/10):** o efeito de voz funcionou no teste, mas a voz não chegou ao outro PC ao lado; o F10 (a narração) abria o painel admin do Hangar; o Captain 300 soa baixo; e ele quer escolher falar com o time, com todos ou com um jogador. **Achados:** (1) **F10 é tecla do Windows/navegador** (o menu): a narração passou para o **F8**. (2) **A voz funciona** entre dois navegadores (`voz.mjs` 26/26; no Brave a conexão fecha em < 1 s), mas o jogo **não dizia por que** quem ficava fora da voz estava mudo. **Feito (PR 1):** aviso no canto com o motivo; o HUD diz "n na sala sem voz"; `Configurações > CHAT DE VOZ > [ VER E COPIAR ]` (`voice/Diagnostico.ts`, `VoiceChat.diagnostico()`) mostra e copia o relatório com a rota de rede de cada ligação e a CONCLUSÃO. **Provado:** testes (Diagnostico 13, VoiceHud, elegibilidade, VoiceChat +4) e no Chrome real `medicoes/voz-diagnostico.mjs` (9 verificações: convidado vê o aviso; dois adultos "Tudo certo"; adulto com convidado na sala conclui a causa). **Falta:** PR 2 (ganho do microfone, nível ao vivo) e PR 3 (canais todos / time / jogador; o time precisa do contrato de rede: salas sem times hoje). O Comandante precisa **falar** no teste com o ponto USB do Captain 300 (o Windows o mostra ativo e sem mudo, 92%, mas sem voz ele entrega zero): se a barra mexer, ele é o melhor microfone; se não, vale o Bluetooth com o ganho do PR 2.

**Próxima sessão começa com:** PR 2 (ganho do microfone: ajuste nas Configurações, aplicado ao chat, ao teste e à narração) e PR 3 (canais); antes, perguntar ao Comandante o que o diagnóstico concluiu nos dois PCs.

## A MISSÃO DO 8 DE JANEIRO, JOGÁVEL (v1, OFFLINE) — Claude, 20/10 (branch `claude/cabos-e-janeiro`, P233)

**O Comandante (20/10):** *"quero na sequência evoluir a missão do 8 de janeiro (essa é nossa prioridade atual, entregarmos essa fase completa)"*. **Feito (passo 5 da ficha, primeira metade):** `?mapa=janeiro&modo=survival&comandante=1` joga a missão. **A regra** (`sim/MissaoJaneiro.ts`, pura, 13 testes): três prédios com integridade 1.000 que cai com quem está na fachada (1,4/s por figurante) e com cada mesa suja do saguão (1,0/s); parte de quem chega suja uma mesa (18%, sem sorteio ao vivo, G2); os faxineiros limpam uma mesa em 3 s (**abstratos** na v1: N por prédio, sem andar); vence com os três de pé e a Praça vazia, perde com um prédio a zero ou o tempo passado; a nota é `expulsos ÷ (expulsos + eliminados)`. **No `Match`:** a multidão (`sim/Multidao.ts`) avança por tick (relógio da missão, o mesmo no servidor e no cliente), o tiro do jogador a acerta (`ProjectileSystem.contraMassa`; o tiro hostil a atravessa), a explosão a derruba e assusta, o jogador por perto (6 m) a assusta e o dash (a "porrada") leva quem está no caminho; o fim sai pelo aviso de missão; o reinício volta tudo (`Multidao.reiniciar`, `MultidaoDesenho.recomecar`). **Na tela** (`environment/JaneiroJogo.ts`, pedaço sob demanda): a multidão desenhada, as mesas sujas (montinhos) e o painel dos três prédios (barras que mudam de cor), a linha da missão e a nota no fim. **Pacote de partida:** a multidão e a regra moram em `sim/MissaoJaneiroPedaco.ts`, carregado com o mapa (`exigirMissaoJaneiro`); o pacote ficou em 468,9 KB de 500.

**Provas:** 13 testes da regra + 10 do `Match` (o tiro do jogador acerta e o hostil não, a explosão, a investida, o susto, parado perde entre 1 e 4 min, o fim congela o mundo, o reinício, a mesma semente) + o reinício do desenho; **no Chrome com a GPU real** (`medicoes/janeiro-missao.mjs`): **175 fps (p95 9 ms), 40 desenhos, 30 mil triângulos, 0 erro de página**, a multidão chegando às fachadas, o tiro derrubando, a tela de derrota. Capturas: `arte/janeiro-missao-*.png`.

**Falta (R13):** os **faxineiros de verdade** (andar até a mesa; vulneráveis); o **Relatório de Consequências com fatos e fontes** e a **revisão jurídica** (não é código); a **missão online** (O4); as armas de feixe, chama e o canhão sônico não atingem a multidão; o contador ABATES do HUD não conta a multidão; o teto da qualidade (`limitar`) não está ligado ao `Quality.ts`; **os números são palpite** (parado o jogador perde aos ~174 s de 300): falta jogar. **A Estação dos Cabos não mudou** (precisa do playtest do Comandante ou da escolha do que melhorar: P233).

**Onde o Comandante confere:** `/jogar/?mapa=janeiro&modo=survival&comandante=1` (só você vê; para liberar: SERVIDOR → VISIBILIDADE → `mapa:janeiro`). Tente: ficar na frente do Congresso atirando; deixar tudo para a multidão e ver um prédio cair em ~3 min; assustar à distância (a multidão foge a 6 m) e ver a nota "não letal".

**Próxima sessão começa com:** (os androides rebeldes já entraram: seção acima) o Relatório com as fontes e os faxineiros agentes; ou o que o playtest do Comandante achar.

## A LINHA FINAL: LANÇAR COM O QUE JÁ É REAL (CIDADE NEON + ESTAÇÃO DOS CABOS) — Claude, 20/10 (branch `claude/lancamento-enxuto`, P232)

**O Comandante (20/10):** *"devemos focar em apenas UMA delas pra lançar logo e depois continuamos os detalhes das outras?"* **Decisão (em `LANCAMENTO.md` § 0):** sim. Lança-se com o escopo de 18/10, que o código já cumpre: só `mapa:arena` e `mapa:praia` são públicos no catálogo; a **Estação dos Cabos** é a missão de vitrine. **Terras Raras** (real offline; abre no painel sem deploy) e **8 de Janeiro** (a missão não existe, ≈ 7 PRs e revisão jurídica) ficam EM BREVE. O **co-op online** (A1 a A3 do `CAMINHO_DO_LANCAMENTO.md`) é a primeira atualização, não o lançamento. **Regra para os agentes:** nenhum mapa, missão, arma ou modo novo até o lançamento; só bloqueio, bug do playtest e ordem do Comandante.

**Conferido na produção em 20/10 (R13):** o atalho `?comandante=1` está **aberto** (`deploy-site.json` sem `comandantePorLink`), a `tela:voz` está **pública** no `/status` (sem a denúncia que o `CAMINHO_DO_LANCAMENTO.md` § 5 exige), o site e o servidor respondem. O código de segurança já foi auditado (`AUDITORIA_SEGURANCA.md`); o que bloqueia o público é operacional e do Comandante.

**Falta (do Comandante):** jogar uma vez a Sobrevivência da Cidade Neon e a missão da Estação dos Cabos até o fim; convidar 5 a 10 pessoas; dizer "pode fechar" (o `?comandante=1`); voltar a voz a `restrito` no painel; o nome do encarregado na política; o DKIM/DMARC (`LANCAMENTO.md` § 7B).

**Próxima sessão começa com:** o que o playtest do Comandante achar (no máximo 1 PR de equilíbrio); depois o "pode fechar" (escrever `"comandantePorLink": false` em `.tmp/servidor/deploy-site.json` e publicar) e a leitura do `/metricas` no teste com gente de fora.

## A NARRAÇÃO: F8 GRAVA A PARTIDA COM A SUA VOZ — Claude, 20/10 (branch `claude/narracao`, P230)

**O Comandante (20/10):** *"não consegui ouvir NO jogo. é só no online que o áudio funciona? e se eu quiser jogar offline e ir narrando?"* O chat de voz é só online (ninguém se ouve) e o F9 nunca gravou o microfone. **Feito:** **F8** grava a partida **com a voz de quem joga**, offline ou online (`GameRecorder`: o microfone entra só na mistura da gravação, nunca na saída do jogo; `Game.ts` abre o aparelho escolhido só para conta de maior de 18 anos, `microfoneDaNarracaoLiberado`; indicador "REC · NARRAÇÃO"; parar solta o microfone; sem o áudio do jogo ainda, não grava e avisa). **Provado:** 12 testes do gravador + 2 da regra, 8 de 8 mutações pegas, `medicoes/gravacao-narrada.mjs` (Chrome real, ffmpeg mede o arquivo: voz −13,5 dB na narração e −77 dB no F9; nunca na saída) e `medicoes/gravacao-narrada-jogo.mjs` (o jogo de verdade: convidado barrado com aviso, adulto grava, o tom do microfone está no arquivo). **Falta:** o Comandante gravar um take e ouvir; os efeitos de voz (P231, PR seguinte).

**Os efeitos de voz (P231, branch `claude/efeitos-de-voz`):** **Efeito na minha voz** (Sem efeito, Locutor militar, Lorde sombrio, Grande Irmão) nas Configurações, aplicado à narração (F8) e à prévia do teste do microfone, **não ao chat**. `voice/EfeitosDeVoz.ts` (sob demanda; os números são uma tabela, `PREDEFINICOES_DE_VOZ`), ligado por `GameRecorder.alternar(microfone, fábrica)`, `Game.abrirNarracao` e `MicTest.trocarEfeito`. **Provado:** 14 + 12 + 21 testes, 8 de 8 mutações, e no Chrome real `medicoes/efeitos-de-voz.mjs` (29 verificações), `gravacao-narrada.mjs` (14) e `gravacao-narrada-jogo.mjs` (13). **Falta:** o ouvido do Comandante (eu não ouço): afinar a tabela se pedir; decidir se o efeito vale também no chat.

**Próxima sessão começa com:** o que o Comandante disser depois de ouvir os efeitos (afinar a tabela); depois o que ainda está aberto na voz (denúncia, idade no chat de texto, aviso às contas antigas).

## O DEPLOY DO ACTIONS DESLIGADO — Claude, 19/10 (branch `claude/actions-sem-deploy`, P221)

**O Comandante (19/10):** sem gastar o Actions à toa, mantendo tudo funcionando. **Feito:** o job `deploy` do `ci.yml` só roda com a variável `DEPLOY_PELO_ACTIONS = true` (ausente = "pulado", não vermelho); o site segue pelo PC. Secret não tocado. **Falta:** decidir se o `check` também deixa de rodar no push da `main` (é repetição do que o PR já provou; as métricas de deploy dos bastidores leem essas execuções).

## O MICROFONE DE VERDADE: A ESCOLHA DA LISTA ERA IGNORADA — Claude, 20/10 (branch `claude/mic-real`, P229)

**O Comandante (20/10):** o teste do microfone continuava mudo no jogo, embora o microfone funcionasse no Windows. **Medido no PC dele (Brave, fone Captain 300):** o jogo pedia o aparelho como `ideal` e o navegador **ignorava a escolha** (abria sempre o padrão); o limite de "captando" deixava de fora o fone Bluetooth; e o **"Microfone (Captain 300)" USB entrega zero absoluto** (mudo ou desligado no Windows). **Feito:** pedido `exact` (teste e chat), medição em ponto flutuante, "Aparelho em uso: …" e "Silêncio total" no painel. **Provas:** a classe `MicTest` de verdade contra os microfones reais do PC (`medicoes/mic-real.mjs`: Padrão e Headset **ok**, USB **silêncio total**, escolha respeitada), Chrome com microfone falso 15/15, 7 mutações pegas. **Para o Comandante:** escolha **Padrão** ou **Headset (Captain 300 Hands-Free…)**; o "Microfone (Captain 300)" USB está mudo no Windows (Configurações de som > Entrada). **Falta (R13):** avisar no chat (fora do teste) que o aparelho está mudo; ouvido real entre dois aparelhos.

## O PACOTE DE PARTIDA: NEM TUDO PRECISA ESTAR NOS 500 KB (A ESTAÇÃO DOS CABOS SAIU DELE) — Claude, 20/10 (branch `claude/praia-sob-demanda`, P227/P228)

**A pergunta do Comandante:** *"nesses 500 KB, será que tudo é realmente fundamental estar ali? temos que ser econômicos, estratégicos e sempre otimizar tudo antes de continuar desenvolvendo."* **A resposta, medida** (`npm run peso`, o gzip estimado por arquivo-fonte do pacote que todo jogador baixa): o pacote tinha **~510 KB** (no teto) e **tinha o que só alguns usam**: o cenário da **Estação dos Cabos** (Praia, ~25 KB: céu, mar, porto, gente, luzes, sombras) e o **HUD de missão** (~9 KB: só a Sobrevivência e a Praia o usam), baixados também por quem joga o Deathmatch na Cidade Neon. **Feito:** os dois viraram pedaços **sob demanda** (o padrão da Amazônia e da Praça: `mapasSobDemanda.ts`, interfaces `InstanciaDaPraia` e `HudDaMissao`; `Game.create` os baixa antes de montar a partida). **Resultado: de ~510 KB para 463,9 KB (folga de 36 KB).** **Provas:** 1.336 testes dos arquivos tocados passam; **no Chrome**, nos 4 casos (Cidade Neon em Deathmatch **não baixa** nenhum dos dois; Cidade Neon em Sobrevivência baixa só o HUD; a Estação dos Cabos, em Deathmatch e em Sobrevivência, baixa os dois), **0 erros de página** e a cena desenha.
**O que ainda pesa e não é de todo mundo** (candidatos, por tamanho): **Hangar** (`HangarMenu` 8,9 + `HangarScene` 4,9 + `weaponModels` 3,3 + `mechBlueprint` 2,8 ≈ 20 KB; o jogo o pré-compila de propósito ao jogar, então sob demanda exige mexer nisso), **`PraiaLayout` e os dados da missão da Praia** (~10 KB, usados pela simulação e pelo radar), `TouchControls` (2 KB, só toque), `SpectatorCam` (2 KB), `SettingsMenu` (2,9 KB). **Regra para quem vem:** antes de acrescentar código de cliente, `npm run peso`; o que só alguns jogadores usam (um mapa, um modo, uma tela, um dispositivo) entra **sob demanda**, com o `import()` dentro de um pedaço de partida (não no `main.ts`: o `smoke` conta como "de partida" tudo o que o próprio `index` cita).

## O TOKEN QUE NÃO SOME E O PAINEL DO SERVIDOR COM O MAPA DE CADA SALA — Claude, 20/10 (branch `claude/painel-do-servidor`, P227)

**Achado:** o botão **[ SAIR DO PAINEL ]** do painel do servidor **esquecia o token** deste aparelho (a dica dizia, mas o nome mandava "fechar"): era por isso que o Comandante digitava o token de novo. **Feito:** (1) `[ FECHAR ]` fecha e mantém o token; "esquecer token" virou botão discreto com confirmação (`ServerPanel`); (2) **sem o token do dono, `TokenDoDono.ler()` devolve a sessão da conta deste aparelho**: o servidor já aceita a sessão de uma conta de administrador no lugar do token (P106), então quem entrou na conta de administrador não digita token no painel do servidor, no de visibilidade nem no mural; (3) a sala no painel mostra o **nome do mapa** (`ESTAÇÃO DE CABOS`) em vez do sufixo cru. **Provas:** 2 testes novos (a sessão como fallback e o token do dono que manda; o nome do mapa). **Falta:** o resto da "evolução do painel" (o Comandante não detalhou): propostas no PR.

## O DEPLOY AINDA PARAVA: O TESTE DO HOOK (GIT + BASH DE VERDADE) ESTOURAVA 30 s — Claude, 20/10 (branch `claude/timeout-dos-testes-de-hook`)

**O que o log do atualizador mostrou depois do #418** (`atualizacao.log`, 20/10): a verificação do `b102548` reprovou às 05:35 e às 05:39 (UTC). Na segunda, com a máquina calma, **855 de 856 testes passaram** (302 s) e o único reprovado foi `server/juncaoJaVerificada.test.ts`, o de ponta a ponta que monta um repositório e roda o hook `pre-push` com `git` e `bash` de verdade: **estourou os 30 s**. É o mesmo arquivo que reprovou às 04:36, às 05:35 e no push local. Alguns fatos que explicam a sequência: (1) o `--retry=2` do #418 **não ajuda aqui**, porque o atualizador roda o próprio código de antes do merge e a verificação reprovada volta o disco para o código velho; (2) um **limite de espera de teste vale no mesmo ciclo em que chega** (o arquivo de teste é lido depois do merge), por isso a correção é esta.

**O que entrou:** `{ timeout: 120_000 }` nos três blocos que usam `git`/`bash` de verdade (`avaliarJuncao` e o hook de ponta a ponta em `juncaoJaVerificada.test.ts`; o hook em `hookPrePush.test.ts`). O limite global (30 s) não mudou. Provado: um teste descartável confirmou que o vitest 5 aplica o `timeout` do `describe` (também com `.skipIf`) por cima do global; os 23 testes dos dois arquivos passam em 45 s.

**Feito pelo Comandante (20/10):** rodou `.\scripts\servidor-atualizar.ps1` como administrador e a tarefa "CYBERMECH atualizar" agora tem o limite de **20 min** (`PT20M`, conferido: estado Ready, último resultado 0). Isso acaba com as rodadas cortadas em 5 min e o atropelo da pasta `.tmp/vitest`.

**Próxima sessão começa com:** conferir no `atualizacao.log` que o `b102548` (e o `4728d23`, da voz) chegaram: `OK: …` e `servidor religou no código novo`; depois que o log da subida não traz mais `Cannot access 'auditoria'`.

## O DEPLOY PARAVA POR TESTE LENTO E O LOG MENTIA NA SUBIDA — Claude, 20/10 (branch `claude/faxina-e-retry`)

**O que aconteceu hoje:** o merge do HSTS (#414) levou **três ciclos** do atualizador para ir ao ar: a verificação (`test.mjs run --no-isolate server shared`) reprovou às 01:36 e às 01:51 com testes **diferentes** (timeouts de 20 a 30 s no `mural`, uma corrida de tempo no `mapas`), todos passando sozinhos em 24 s; na terceira, com a máquina quieta, passou em 2 min e o servidor religou (protocolo 21, 0 jogadores). O PC do dono estava com CPU a 92% e 420 MB de RAM livre (navegador, Antigravity, outros agentes). É o terceiro episódio igual (17/10, 19/10, 20/10).

**O que entrou:**
- **`--retry=2` na verificação do atualizador** (`scripts/atualizador.mjs`): um teste que estoura o tempo sob carga é repetido até 2 vezes; **falhar 3 vezes seguidas continua reprovando**. Provado com um teste descartável (reprova sem a opção, passa com ela) e travado em `server/atualizador.test.ts`.
- **O aviso falso do log** `não consegui varrer sessões e atividade vencidas: Cannot access 'auditoria' before initialization`, que aparecia a cada reinício desde 18/10: o `faxinar()` rodava antes do `const auditoria`. O `try/catch` o engolia e `auditoria.podar()` rodava logo depois, então **o comportamento não mudava**; só o log mentia. A primeira faxina agora roda depois de a auditoria existir. Teste em `server/dados.test.ts` (reprovava antes do conserto).

**Custo de CPU:** nenhum no jogo (nada disso corre no laço de 60 Hz). O retry só gasta tempo quando um teste falha.

**Limite honesto:** o retry não cura máquina sufocada (os workers do Windows ainda morrem por falta de memória: 0xC0000409 e o `tsgo` com errno 1455 também aconteceram hoje). A regra de ficar quieto depois de um merge continua. O remédio de verdade é o PC do dono ter RAM/arquivo de paginação de sobra; decisão dele.

## O HSTS DO SITE: A CLOUDFLARE NÃO O COBRIA, O SITE É SERVIDO PELA HOSTINGER — Claude, 19/10 (branch `claude/hsts-do-site`, P207)

**O Comandante (19/10):** *"o cloudflare também já fiz"*. **Conferi:** o `cybermech.online` (o site) responde com `Server: hcdn` (a CDN da Hostinger): **não passa pela Cloudflare**; só o `jogo.cybermech.online` passa. Logo o HSTS da Cloudflare não cobre o site (e o `jogo.` ainda não manda o cabeçalho). **Feito:** `Strict-Transport-Security: max-age=15552000` (180 dias, sem `includeSubDomains` nem `preload`) no `.htaccess` do site (`scripts/site.mjs`), conferido pelo `site --check`. Já vale quando o site for publicado. A opção "visitor location headers" da Cloudflare vale para o `jogo.` (é lá que o servidor lê o estado); aparece em "De onde vêm" quando entrarem visitas do Brasil.

## JOGAR COM O MICROFONE: O CAMINHO ATÉ A VOZ — Claude, 20/10 (branch `claude/voz-conta-facil`, P227)

**O Comandante (20/10):** o microfone funciona no Windows mas não conseguiu usar nem testar no jogo; aprovou as decisões pendentes da voz. **Causa:** o portão de idade escondia a voz sem dar caminho. **Feito:** botão [ CRIAR CONTA ] / [ INFORMAR MINHA IDADE ] na seção do chat de voz; Chrome real 36/36. **Para jogar com voz:** criar a conta (ou informar a idade, se a conta é antiga) em Configurações > GRÁFICOS E SOM > CHAT DE VOZ; depois TESTAR e entrar numa sala online. **Falta (R13):** mudo por jogador, aviso às contas antigas, idade no chat de texto, a prova positiva em produção (a rede daqui para o servidor está intermitente).

## O MUDO POR JOGADOR NO CHAT DE VOZ — Claude, 20/10 (branch `claude/voz-mudo`, P228)

**Feito:** em Esc > REDE, cada piloto tem **[ SILENCIAR VOZ ]** (aparece só para quem está na voz); silenciar desliga a faixa dele (custo zero), o indicador de quem fala some, e vale até sair da sala. 7 mutações pegas e a prova no Chrome real (`medicoes/voz-jogo.mjs`: o botão aparece, silencia o BRAVO falando e desfaz). **A bancada achou um defeito meu:** o botão só aparecia no próximo evento da sala, porque ninguém repintava a lista ao entrar na voz; corrigido. **Falta (R13):** a denúncia (decisão do Comandante: para onde vai a queixa) e o mudo sem pausar a partida.

## O HOOK NÃO REFAZ O CHECK DEPOIS DE UMA JUNÇÃO PURA COM A MAIN — Claude, 19/10 (branch `claude/hook-juncao`, P225)

**O Comandante (19/10):** economizar os 10 a 25 minutos do laço de push, com boas práticas. **Feito:** `scripts/juncaoJaVerificada.mjs` + o hook: depois de uma junção com a `main`, não refaz o check se a `main` entrou por cima de uma árvore já verificada e cada arquivo que mudou veio inteiro dela (ou é `.md`); mesclado dos dois lados roda tudo; `CYBERMECH_CHECK_COMPLETO=1` desliga (o `publicar --sem-ci` liga). 7 mutações pegas e a regra aplicada a junções reais. **Falta (R13):** só se confirma de verdade no próximo push depois de uma junção; os locales mesclados ainda rodam o check (próximo degrau no HISTORICO).

## O ACTIONS ECONÔMICO, SEM PERDER SINAL — Claude, 19/10 (branch `claude/ci-economico`, P223)

**O Comandante (19/10):** economizar o Actions "de forma inteligente, profissional, sem miséria". **Feito:** medi antes (235 min em um dia; a cota de ~2.000 durava ~8 dias) e cortei só a repetição: o push na `main` não refaz o check na árvore que o PR já provou (`scripts/ciJaProvado.mjs`, na dúvida roda tudo), etiquetas só ao abrir, rascunho não roda, e `npm run ci:consumo` mede. O check do PR e o hook seguem completos. **Falta (R13):** só se confirma de verdade no primeiro merge depois deste PR (o job do push deve terminar em ~1 min com "já passou no check do PR"); medir de novo com `npm run ci:consumo`.

> **Arquivo:** o que tem mais de dois dias mora em `.decepticons/arquivo/estado-*.md` (nada se perdeu; `npm run arquivar` move mais). Procure por busca, não leia inteiro.

## O ANALYTICS PEGAVA A PROPRIEDADE ERRADA: AGORA EXIGE O CÓDIGO DO CYBERMECH — Claude, 19/10 (branch `claude/analytics-propriedade-certa`, P207)

**O Comandante (19/10):** *"já liguei a admin api, tem como você testar?"*. **Testei, e achei um problema:** o Google aceita a chave e a Admin API responde, mas a conta de serviço **só enxerga a propriedade "odpandroid"** (o app Android do Olho do Pai, no "Default Account for Firebase"), não a do CYBERMECH (`G-2CCHDCEC7X`). A regra antiga ("a única propriedade") a escolheria e o `/metricas/` mostraria números do app Android como se fossem do jogo.

**O que entrou:** a descoberta só aceita a propriedade com um fluxo web do `G-2CCHDCEC7X` (`GA_MEDICAO_ID`; um teste confere que servidor, site e jogo usam o mesmo). Sem ela, o estado novo "propriedade-errada" diz os nomes que a conta enxerga e onde dar o acesso, e **nenhum relatório é pedido à propriedade errada**. `ga-propriedade.txt` continua valendo sem conferir. **Provas:** 7 testes novos (o caso real de hoje, ambíguo, ID escrito, código por variável, paridade do código) e **4 mutações à mão pegas**.

**Falta (dele, 2 minutos):** no Analytics, abrir a propriedade do **CYBERMECH** e dar **Leitor** ao e-mail da conta de serviço (`LANCAMENTO.md § 6C`); se essa propriedade ainda não existir, criar uma com fluxo web para `cybermech.online`. O servidor percebe em 30 s, sem reiniciar.

**Próxima sessão começa com:** conferir o `/metricas/` depois do acesso (hoje responde "só enxerga odpandroid").

> **Arquivo:** o que tem mais de dois dias mora em `.decepticons/arquivo/estado-*.md` (nada se perdeu; `npm run arquivar` move mais). Procure por busca, não leia inteiro.

## A PRAÇA DOS TRÊS PODERES: O MAPA DO 8 DE JANEIRO NO AR, COM A MULTIDÃO DESCENDO A ESPLANADA (PASSO 4 DA FICHA) — Claude, 19/10 (branch `claude/praca-mapa`, P217)

**O que foi feito:** o **chão** da fase do 8 DE JANEIRO, jogável no **Deathmatch** (offline e online) e **restrito ao Comandante** (`mapa:janeiro`).

**1. O mapa** (`environment/PracaLayout.ts`, dados puros, no pacote de partida, 3 KB; `environment/PracaMapa.ts`, desenho e colisores, **sob demanda**, 1,3 KB gzip): a **Esplanada** de 270 m com os ministérios (duas fileiras de caixas brancas com faixa de vidro), a avenida e os gramados; o **Congresso** (a laje, a **rampa** que sobe a 5 m, as **torres gêmeas**, a cúpula e a tigela); a **Praça** com o monumento no meio, o espelho d'água e o canteiro de cobertura; o **Planalto** ao norte e o **Supremo** ao sul, com a colunata voltada para a Praça; o lago a leste; a cerca do limite. **Colisores: abaixo de 310** (o teto do Bunker; o teste trava). Céu e luz de fim de tarde, estáticos: nada anima, nenhuma atualização por quadro.
**2. As fontes da multidão estão no mapa:** os dois **ônibus** parados na Esplanada, os quatro **bueiros** e as três **lixeiras** (`PRACA_FONTES`), as saídas e a frente de cada prédio (`PRACA_PREDIOS`). **Os nomes no jogo são os dos poderes** (LEGISLATIVO, EXECUTIVO, JUDICIÁRIO): a proposta da ficha (pergunta 1), sem nome de instituição nem de pessoa; **o Comandante ainda não confirmou**.
**3. A multidão no mapa de verdade:** `?mapa=janeiro&comandante=1&multidao=1&cota=2500&t=9000`: a demonstração sai dos ônibus, bueiros e lixeiras reais e marcha até a frente dos três prédios.
**4. Ligações:** o mapa é uma opção do seletor e do mapa-múndi (o pino **8 DE JANEIRO** agora abre o mapa, para quem o vê), entra no radar, no minimapa, no online (`MAPAS_ONLINE`, etapa O1 do P218: `?sala=X&mapa=janeiro`), no catálogo de visibilidade e nas campanhas (só o Deathmatch). As fotos: `.decepticons/arte/praca-*.png`.

**Provas:** 6 testes do mapa (o teto de colisores, os pontos de nascimento livres de bloco e de parede, os três prédios e as fontes dentro do mapa, o link, **a partida montando no mapa** com o jogador de pé no chão, e **a rampa subindo com um Mech de verdade** da Esplanada até a laje) e os testes antigos que enumeravam os mapas atualizados. **Na GPU real:** de **105 a 176 fps** nas seis vistas-chave (42 a 102 desenhos; 5 a 41 mil triângulos), e de **105 a 167 fps com 2.500 de multidão** (`medicoes/praca-fotos.mjs`).

**Falta (R13):** **os prédios não têm integridade e a missão não existe** (o passo 5 da ficha: as marchas, a sujeira nas mesas, os androides rebeldes e faxineiros, o objetivo na tela); o mapa só abre o **Deathmatch** (a Sobrevivência cai na Cidade Neon até a missão existir); o **mural de câmeras** do Comandante desenha a planta da Cidade Neon para qualquer sala; os ônibus, bueiros e lixeiras são **desenho e colisor**, não fontes vivas (quem despeja é o cronograma da fase); a arte é de caixas e cascas (o Codex pode refinar); o Congresso, o Planalto e o Supremo **não têm interior**; **o servidor não recusa mapa restrito** (só o cliente filtra: aceito na etapa O1).

**Onde o Comandante confere:** `/jogar/?mapa=janeiro&comandante=1` (só você vê; para liberar: SERVIDOR → VISIBILIDADE → `mapa:janeiro`), e `&multidao=1&cota=2500&t=9000` para ver a multidão descendo a Esplanada; no mapa-múndi, o pino 8 DE JANEIRO. Online: dois navegadores em `?sala=ARENA&mapa=janeiro&comandante=1`.

**Próxima sessão começa com:** a missão (passo 5 da ficha): a cota de chegadas ligada à `Multidao`, as integridades dos três prédios, a sujeira nas mesas e os faxineiros, os androides rebeldes e o objetivo na tela; e as respostas do Comandante às perguntas abertas da ficha.

## PROCESSO MAIS LEVE E O CI VERMELHO — Claude, 19/10 (branch `claude/processo-leve`, P220)

**O Comandante (19/10):** as iterações estão "MUITO grandes… overengineered?"; pediu as 5 regras de processo leve e que eu olhasse o GitHub vermelho.

**Feito:** (1) `AGENTS.md` **regra 19**: rigor proporcional ao risco (alto: servidor + teste + até 8 mutações + 1 bancada; baixo: só o teste de sempre), sem suíte inteira à mão antes do push, cada fato escrito uma vez, o menor PR que resolve. (2) O **hook de push não repete o check na mesma árvore** (`.tmp/check-ok/`; 8 testes, 3 mutações). (3) **O vermelho do CI tinha duas causas** (detalhe no HISTORICO): o teste `estudio-vozes` (503 sem `ffmpeg` no runner) e o smoke (`localhost:2567` recusado no runner); as duas reproduzidas e corrigidas. O CI voltou a rodar (2 a 4 min).

**Atenção:** o CI gasta minutos medidos; com a cota de volta, push repetido pode esgotá-la. Se parar, `publicar --sem-ci` (P105). **Falta (R13):** o verde do CI só vale quando o PR e a `main` passarem de verdade (o `npm run check` para no primeiro erro, e já apareceu um segundo vermelho atrás do primeiro).

**Próxima sessão começa com:** conferir o CI da `main` depois do merge; depois o mudo por jogador (voz) ou o que o Comandante mandar.

## O E-MAIL DO "ESQUECI A SENHA" PELO SMTP DA HOSTINGER, SEM SERVIÇO NOVO — Claude, 19/10 (branch `claude/email-smtp`, P206 parte 2)

**O Comandante (19/10):** a Cloudflare perguntou que "chave" guardar e ele não entendeu; *"como configuro o Resend também?"*. **Resposta:** o Resend não é preciso. O `cybermech.online` já usa o e-mail da Hostinger (MX e SPF conferidos no DNS): basta uma caixa. Na Cloudflare **não há nada a fazer** (o agente dela se confundiu com o plano B).

**O que entrou:**
1. **`MailerSmtp`** (`server/email.ts`): cliente SMTP de ~100 linhas com `node:tls` (TLS direto, porta 465; AUTH PLAIN ou LOGIN; UTF-8 em base64; recusa destinatário com quebra de linha ou vírgula), sem biblioteca nova. O Resend continua como alternativa.
2. **`npm run email -- iniciar | estado | testar <e-mail>`** (`server/emailCli.ts`): cria o `email.json` com a Hostinger preenchida (senha de exemplo que nunca vale), mostra o estado sem a senha e manda uma mensagem de teste pelo mesmo caminho do servidor, com a dica do que conferir se falhar.
3. **O servidor relê o `email.json` quando ele muda** (`MailerDaPasta`): ligar, trocar a senha ou desligar não exige reiniciar (e reiniciar derruba quem joga).

**Provas:** 13 testes com um **servidor SMTP de mentira de verdade** (socket que fala o protocolo e guarda o que recebeu) mais 6 da configuração e da ferramenta; **5 mutações à mão pegas** (destinatário sem validar, assunto sem tirar a quebra de linha, senha de exemplo valendo, autenticação aceitando recusa, arquivo nunca relido). **Não provado:** a Hostinger de verdade (falta a caixa e a senha).

**Falta (dele):** criar a caixa `nao-responda@cybermech.online` no hPanel (E-mails), `npm run email -- iniciar`, trocar a senha no Bloco de Notas e `npm run email -- testar seu@email.com` (`LANCAMENTO.md § 7`). **A política** já cita a Hostinger como quem entrega o e-mail (no lugar do Resend), sem mudar a `POLITICA_VERSAO` (mesmo conjunto de dados).

**Próxima sessão começa com:** o que o `npm run email -- testar` disser; se cair no spam, o DKIM/DMARC do domínio.

## A MULTIDÃO DO 8 DE JANEIRO: A SIMULAÇÃO PURA E O DESENHO NA GPU REAL (PASSOS 2 E 3 DA FICHA), VISTA NO JOGO — Claude, 19/10 (branch `claude/multidao`, P217 e P219)

**O que foi feito:** `client/src/sim/Multidao.ts`, a multidão da fase como **módulo puro de simulação** (sem tela, sem Rapier, sem DOM; G1, G2, G14), e a medida de CPU (`medicoes/MULTIDAO.md`).

**1. A ideia (a da ficha, § 3):** a posição de um figurante é **função do tempo**. Cada um nasce com fonte, tick, tipo, prédio-alvo e semente; a posição em qualquer tick é calculada (linha reta com um balanço de seno em parábolas por partes, sem `Math.sin`). Só o que o jogador causa é estado: `morreu(id, tick)` e `fugiu(id, tick)`. A chegada à fachada, a fuga automática depois do tempo na fachada e a saída pelo limite do mapa são **eventos agendados** (ponteiros sobre vetores ordenados).
**2. O que ele tem:** o cronograma de chegadas por **ônibus** (grupos grandes), **bueiros** (jatos) e **lixeiras** (fios), a cota finita da fase, os tipos GADO, CARECA e PERUCA (vida, velocidade e altura próprias), os androides rebeldes **agendados** (a missão os cria), o tiro (a linha da mira contra um cilindro, com a cabeça), a explosão (mata no raio, assusta até o dobro), o susto por perto (de 6 em 6 ticks), `contarNaFachada` (o que a missão usa para desgastar a integridade), os contadores que formam a vitória (`terminou`: cota despejada e Praça vazia) e **o modo espelho** para o cliente online: só aplica os eventos do servidor, e quem entra no meio da fase recebe o estado compacto (um bit por figurante mais as fugas).
**3. A medida:** **0,043 ms por tick** com as posições de todos recalculadas todo tick e 10 tiros por segundo (2.828 figurantes, pico de 1.465 na Praça), contra a estimativa da ficha de ≤ 0,3 ms.

**4. O desenho** (`environment/MultidaoDesenho.ts`, passo 3): três malhas instanciadas (**gado** com a cabeça de chifres, **careca** de colete e bigode, **peruca** loira; só **tipos**, nenhum nome, marca ou texto) com a **posição calculada na vertex shader** a partir do tick (a mesma conta da simulação, em GLSL), o balanço do andar, o gingado de quem grita na fachada, o tombo e a correria da fuga. **As vagas de instância:** cada figurante ganha uma ao nascer e a devolve ao cair ou sair: o custo na GPU segue quem está **presente**. Cada tipo tem **botão de desligar a máscara** (`MascarasDaMultidao`).
**5. A demonstração no jogo:** `?multidao=1` (+ `&cota=N` de 100 a 5.000, `&t=T` começa a fase no tick T, `&semente=N`), carregada sob demanda (7 KB gzip, fora do pacote de partida), na Cidade Neon: a multidão chega de ônibus, bueiros e lixeiras, marcha até três alvos a leste, para na fachada e foge; **quem chega a 6 m do jogador foge**. **É DEMO** (R13): os tiros do jogador ainda não a atingem, não há prédio nem integridade.
**6. A GPU real** (`medicoes/multidao-gpu.mjs`, `medicoes/MULTIDAO.md`): a multidão custa **de 1,2 a 2 ms** no quadro (14 ms de 16,7 no pico, com 3.000 de cota) e **achou dois defeitos que o SwiftShader não vê:** o shader tinha **17 atributos por vértice (o limite é 16): não compilava e a multidão sumia**, e o custo seguia quem **nasceu**, não quem está presente (350 mil triângulos; as vagas cortaram para 182 mil).

**Provas:** 15 testes de simulação + 9 do desenho (as três malhas, a conta dos 16 atributos, a cor empacotada, as vagas: o custo é o máximo de gente ao mesmo tempo, a fuga e o tombo chegam à vaga, quem entra no meio da fase só desenha quem está na Praça) + `ShadersSemNaN`. Os 15 de simulação: a mesma semente é a mesma multidão; a cota fecha; a mistura de tipos; a posição sem saltos e o destino no tick marcado; o ciclo completo sem jogador (todos chegam, fogem e saem; a Praça esvazia; `terminou`); pular ticks dá o mesmo que andar um a um; o tiro (de lado, de cima, errando, alcance); o gado cai com dois golpes e o ferido foge; a explosão; o susto; **o espelho chega ao mesmo lugar** que a autoridade e **quem entra no meio da fase fica igual**; o custo.

**Falta (R13):** **o teto de 80 mil triângulos da ficha NÃO foi atingido** (182 mil no pico; o critério de 60 fps foi, com folga pequena: **numa GPU mais fraca falta margem**): falta o **impostor de longe**, menos caixas por figurante e o **teto da qualidade** (`limitar()` existe e é testado, mas não está ligado ao `Quality.ts`); **o `varrer-nan` (shader novo, `FERRAMENTAS.md` § 4.1) deu 0 de 480 poses com NaN, mas na Praia com a multidão da demonstração, não no mapa da fase (que não existe)**; os tiros do jogador não atingem a multidão na demonstração, e **não há mapa, prédio nem missão** (passos 4 e 5); os números de vida e velocidade são os da ficha, sem balanço de jogo; a rede não foi medida.

**Onde o Comandante confere:** `/jogar/?multidao=1&cota=3000&t=9000` (em `?comandante=1` ou no PC dele): a multidão a meio caminho, já cheia; o jogador anda por entre ela e ela foge; as fotos em `.decepticons/arte/multidao-*.png`.

**Próxima sessão começa com:** o impostor de longe e o teto da qualidade (para chegar ao teto de triângulos), depois o mapa da Praça (passo 4); ou o que o Comandante responder às cinco perguntas da ficha.

## A IDADE E A VOZ SÓ PARA MAIORES DE 18 ANOS — Claude, 19/10 (branch `claude/idade-e-voz`, P211)

**O Comandante (19/10):** *"no início, perguntar a IDADE pra fazer o cadastro… menores de 18 anos NÃO TÊM ACESSO ao microfone nem aos áudios dos outros jogadores, apenas o áudio do jogo."*

**O que mudou:** o **cadastro pede o mês e o ano de nascimento** (duas listas, obrigatórias na tela; guardado `AAAA-MM`, sem o dia, e o servidor devolve só a faixa: `adulto`, `menor`, `sem-idade`). **Só conta de maior de 18 anos entra na voz, e quem decide é o servidor:** o `PRONTO` da voz leva o token da sessão e o relé confere a idade (`RelayDeVoz.autorizar`, padrão negar). Convidado, conta sem idade e conta de menor ficam **sem microfone e sem ouvir os outros**: o cliente esconde os controles (e o teste do microfone), nem pede o microfone ao navegador e mostra a frase certa; o áudio do jogo segue. Quem já tinha conta informa o mês e o ano **uma vez** na aba JOGO (`POST /conta/nascimento`; a data **não muda**, 409 na segunda vez) e a voz abre na hora, sem recarregar. Maioridade conta pelo mês: quem faz 18 **neste mês** ainda não é adulto.

**Junto:** política `2026-10-19.2` (e a data "em vigor" lê só o prefixo da versão), inventário `PRIVACIDADE.md`, a data no "Baixar meus dados", ação `nascimento_informado` na trilha (sem a data), tradução nas 6 línguas (e 18 frases da conta (P192) que tinham ficado só em português), o formulário da conta virou pedaço sob demanda (o JS de partida segue abaixo do teto), todas as bancadas de voz entram agora com conta de adulto (`vozLib.tokenDeConta`).

**Provas:** **Chrome real, 30 de 30** (`medicoes/voz-idade.mjs`: adulto liga ao colega; convidado e menor **nunca pedem o microfone** e ninguém se liga a eles; conta sem idade informa e a voz abre na hora; cadastro pela tela como adulto e como menor; **cliente adulterado** que manda o token de um menor, ou nenhum, é recusado pelo servidor); **3.569 testes verdes** (331 arquivos), com testes novos de contrato, relé, sala com contas reais, HTTP, migração de banco antigo, sessão, formulário e i18n; **32 mutações à mão, todas pegas**. Fotos em `arte/idade-cadastro-claude.png` e `arte/idade-menor-sem-voz-claude.png`.

**Limite (R13):** **a idade é declarada, não verificada**: quem mente na data entra como adulto. Verificar de verdade exigiria documento ou terceiro (custo, dado sensível). **Contas que já existiam estão "sem idade" e ficam sem voz até informarem**; a política promete avisar mudanças e o jogo ainda não tem um aviso para isso (a frase nas Configurações cumpre o papel por ora). Mudo por jogador e denúncia seguem sem existir.

**Decisão do Comandante:** quer algo mais forte que a data declarada? (tem custo e pede dado sensível). Até lá a regra reduz o risco, não o elimina.

**Próxima sessão começa com:** o mudo por jogador (o risco mais próximo da voz pública), ou a decisão do Comandante sobre a rádio (P210/P213).

## OS PILOTOS NA REDE: VER O HANGAR DO OUTRO E CONVERSAR POR TEXTO SEM SAIR DO HANGAR — Claude, 19/10 (branch `claude/chat-de-texto`, P216)

**O Comandante (19/10):** *"no painel REDE, quando tiver mais de um jogador online, coloque os nomes dos jogadores ali disponíveis pra podermos clicar neles, ver o hangar deles, fazer chat por texto com eles (sem sair do hangar)"*.

**1. A mensagem de texto (protocolo 33 e 34, sem subir o `PROTOCOL_VERSION`):** `shared/net/texto.ts` (formato, `limparTexto`: sem controle, sem quebra de linha, sem caractere que inverte a direção, até 160 caracteres) e `server/texto.ts` (`RelayDeTexto`: **só repassa**, com o **remetente trocado pelo id de verdade**, o texto já limpo, só a **outras pessoas** da sala (bot não é destino), **6 mensagens por 10 s por jogador**, nada guardado). A sala (`ArenaRoom`) só liga o relé. Servidor velho descarta o tipo; cliente velho nunca recebe.
**2. A lista na REDE:** `ui/RedePilotos.ts` (bundle inicial, minúscula): quando há outra pessoa na sala, cada nome vira um botão (nome, chassi, mensagens não lidas). `OnlineSession.pilotos()` entrega só pessoas.
**3. O Hangar do outro:** `HangarMenu.visitar(spec)` abre o Hangar com a montagem dele em **só leitura** (abas e encaixes se olham; chassi, nível, módulo, presets e APLICAR ficam travados; Esc e VOLTAR AO MEU HANGAR saem). O galpão 3D mostra o robô dele.
**4. A conversa (sem sair do Hangar):** `ui/VisitaPanel.ts` (**sob demanda**, R7) no lugar dos números: o histórico (60 linhas), o campo, ENVIAR, **SILENCIAR** (só neste cliente) e o aviso "devagar" antes de o servidor cortar. Tudo por `textContent`. O dado (`net/Conversas.ts`) mora no jogo desde o começo: a mensagem que chega com a tela fechada vira "não lida" e um **aviso curto** no canto durante a partida.
**5. Nasce restrito:** `tela:chat` no catálogo de visibilidade (P191): só o Comandante vê a lista, a visita e os avisos até liberar no painel; quem não vê descarta a mensagem que chegar.

**Provas:** 3 testes do texto (limpeza, formato, UTF-8 torto, grande demais), 3 do relé (remetente trocado, destinos inválidos, teto por janela), 1 com **servidor de verdade e dois jogadores** (Alfa escreve a Bravo, chega com o id e o nome certos, a lista só tem pessoas, texto sujo chega limpo, escrever a um bot não chega a ninguém), 3 das conversas e 1 do contrato do HTML e do catálogo.

**Falta (R13):** **não vi a tela no navegador** (a máquina estava sem memória: só testes e tipos): o Comandante confere; **sem denúncia** e sem moderação além do teto, do tamanho e do silenciar (o chat nasce restrito por isso); **os textos da visita e da lista estão só em português** (o `aria-label` da lista já tem as seis línguas; o resto fica sob `data-i18n="nao"` até o Comandante liberar `tela:chat` ao público: traduzir antes); telas estreitas mostram só a conversa na visita; sem som de mensagem nova; sem canal da sala inteira (só mensagem direta).

**Onde o Comandante confere:** dois navegadores em `?sala=ARENA` (o dele com `?comandante=1`, o outro com outro nome): pausa → REDE → o nome do outro → o Hangar dele, a conversa ao lado. Para o outro jogador também ver: SERVIDOR → VISIBILIDADE → `tela:chat` → PÚBLICO.

**Próxima sessão começa com:** o que o Comandante vir no teste de dois navegadores; depois a fase 8 DE JANEIRO (P217).

## O TESTE DO MICROFONE, O AVISO DE "SOZINHO NA VOZ", E A RESPOSTA SOBRE YOUTUBE E JUKEBOX — Claude, 19/10 (branch `claude/teste-do-microfone`, P212 e P213; P211 em andamento)

**O Comandante (19/10):** *"estou tentando testar o microfone mas não consegui! não saiu som. Seria bom ter um campo de testes?"*; só maiores de 18 na voz (P211); e uma **jukebox num prédio** com link do YouTube, "só se não pesar" (P213).

**P212, feito:** a causa provável é que **sozinho na sala ninguém te ouve** e o indicador não avisava. Agora: painel **TESTAR O MICROFONE** nas Configurações (aparelho, barra de nível, "ouvir a minha voz", motivo de cada falha; para sozinho ao fechar, trocar de aba ou em 2 min), aparelho que vale também para o chat (troca no meio da voz), e o indicador diz **"NINGUÉM MAIS NA VOZ: TESTE O MICROFONE EM CONFIGURAÇÕES"**. **Provas:** Chrome com microfone falso (`voz-teste-mic.mjs`, **14 de 14**, inclusive "parar solta o microfone de verdade" e o navegador que bloqueia), **15 de 15 mutações**, foto `arte/voz-teste-microfone-claude.png`.

**P213, só resposta e desenho (`RADIO_E_EMISSORES.md` § 7):** **o YouTube é problema** (o player tem de ficar visível e não separa o áudio; vem vídeo pesado; não toca no espaço; leva o IP de todo mundo perto ao Google; conteúdo sem moderação). Recomendo o terminal com **o catálogo do jogo** e "Sugerir um link". **Só entra se não pesar**: a primeira entrega tem de medir menos de 1 ms por quadro e no máximo 8 KB/s por emissor.

**O gate do push e a memória (mesmo PR):** dois pushes foram barrados por workers do Vitest mortos (`0xC0000409`), sem relação com o código: a **memória virtual do Windows estava no teto** (1,6 GB livres de 24) porque **seis sessões do Claude Code abertas mantinham 48 processos node dos servidores MCP da Hostinger (3,1 GB)**. **Peço ao Comandante: feche as sessões antigas do Claude Code** (é o que mais ajuda). No código, o `npm test` passou a contar a memória virtual livre e a usar 1 worker quando aperta (`CYBERMECH_WORKERS=1` força); 6 mutações pegas.

**P211 (idade):** feito no PR seguinte (seção acima): cadastro com mês e ano de nascimento; menores sem microfone nem a voz dos outros, **imposto no servidor**.

**Falta (R13):** (a) ~~P211~~ (feito); (b) **decisões do Comandante** sobre a jukebox (§ 7.5: YouTube fora, catálogo e licenças, qual prédio); (c) ninguém testou a voz entre dois aparelhos reais pela internet.

**Próxima sessão começa com:** ~~o portão de idade (P211)~~ (feito).

## O SEGUNDO TESTE ONLINE: O OUTRO JOGADOR VIA TODO MUNDO COMO VECTOR-09, E A JANELA DAS REGRAS POR TRÁS DA DO SERVIDOR — Claude, 19/10 (branch `claude/online-modelos`, P214 e P215)

**O Comandante (19/10), depois do segundo teste online (Colossus V4 num PC, Marauder no outro):** *"o outro jogador sempre me vê como vector 9 amarelo… ele não me vê como outro modelo"*; e a janela REGRAS DAS SALAS abria **por trás** da do servidor.

**1. A causa do robô errado (achada no código):** `Game.makeRemote` só distinguia o andróide: **toda outra pessoa virava Vector-09**, com os números do Vector-09. O servidor sempre soube o chassi (o roster leva a montagem); só o desenho errava.
**2. O que mudou:** `net/remotoDoRoster.ts` (função pura, testável) monta o **chassi da montagem** de quem entra: a malha importada (Marauder, Colossus V4, Lancer…) quando já baixou, senão a silhueta do chassi (`BLUEPRINT_BY_CHASSIS`), sempre com as armas e **os números dele**. A malha que ainda baixa deixa o robô **pendente**: o jogo o refaz quando ela chega (`OnlineSession.refazerRemoto`), sem esperar uma nova entrada na sala.
**3. A janela por trás:** `.vis-modal` (REGRAS e VISIBILIDADE) subiu de `z-index` 80 para 2100 (a do servidor é 2000).

**Provas:** 4 testes (todo chassi chega com os números dele e a silhueta certa; a malha que baixa deixa pendente; montagem torta cai no Vector-09 de fábrica; com a malha pronta sai o `ImportedMech` com os números do Marauder).

**Falta (R13):** **não vi dois navegadores jogando juntos** (testes de unidade e tipos, sim): o Comandante confere com o Marauder e o Colossus V4; o nome e a barra de vida do outro seguem como eram; a cor do Mech importado vem do arquivo (não há tinta de time nele).

**Onde o Comandante confere:** dois navegadores em `?sala=ARENA`, cada um com um chassi diferente: cada um vê o outro com o modelo dele. `?comandante=1` → SERVIDOR → REGRAS DAS SALAS: abre por cima.

**Próxima sessão começa com:** a lista de pilotos da REDE com o hangar deles e o chat de texto (P216), e a fase 8 DE JANEIRO (P217).

## A POLÍTICA DE PRIVACIDADE PASSOU A DESCREVER O CHAT DE VOZ, QUE O COMANDANTE JÁ LIBEROU AO PÚBLICO — Claude, 19/10 (branch `claude/privacidade-voz`, P205)

**O que aconteceu:** o `/status` do servidor mostrava `"tela:voz":"publico"` (o Comandante soltou a voz no painel de visibilidade) **antes** de a política mudar; eu tinha deixado o texto pronto como pendência de "antes de liberar". Com a voz pública, a pendência virou lacuna: a política dizia "o IP não é guardado" e nada dizia que **os outros jogadores da sala veem o IP** nem que o **STUN do Google** o recebe.

**Feito:** (1) `/privacidade/`: um item em "Em poucas palavras", uma linha em "O que guardamos" ("Você usa o chat de voz") e o **STUN do Google** em "Com quem compartilhamos"; (2) `POLITICA_VERSAO` → `2026-10-19` (quem for criar conta aceita a versão nova; o navegador com a velha é mandado recarregar); (3) `PRIVACIDADE.md`; (4) `server/politicaDeVoz.test.ts` renderiza a página de verdade e exige o IP, o STUN, a linha da tabela e a versão (**5 de 5 mutações pegas**), para a política não voltar a ficar sem a voz.

**Falta (R13):** (a) o Comandante **revisar o texto** (rascunho, não é parecer jurídico); (b) **mudo por jogador e denúncia**: a voz está aberta a desconhecidos, **inclusive a convidados sem conta (menores)**, sem moderação nenhuma; (c) a política promete avisar no jogo as mudanças que afetem contas existentes e **esse aviso não existe**: as contas antigas não foram reavisadas da versão nova (decisão do Comandante: aviso no jogo, ou aceitar que só vale para quem cria conta daqui para a frente).

**Próxima sessão começa com:** o mudo por jogador (o risco mais próximo da voz pública) ou a decisão do Comandante sobre a rádio (P210).

## O CHAT DE VOZ NO CELULAR: UM BOTÃO DE MICROFONE NA TELA, E O DESENHO DA RÁDIO E DOS EMISSORES DE SOM — Claude, 19/10 (branch `claude/voz-celular`, P209 e P210)

**O Comandante (19/10):** *"jogadores usando celular vão conseguir ouvir e falar automaticamente? como vai ser pra apertar o PTT se o celular é limitado de botões? quero maximizar a experiência"* e a visão da **música/rádio/autofalantes no mundo**.

**Respondido pelo código:** no celular **ouvir já era automático** e **falar também** (microfone aberto), mas **não havia como silenciar nem segurar-para-falar** (sem tecla T). **Agora há um botão de microfone** (`VoiceHud`, CSS `.voz-mic`) só no modo toque, sob PAUSA e PLACAR, acima da camada de mira: **tocar alterna o mudo; no modo "segurar", vale com o dedo nele**; sem microfone, tocar o pede de novo (**o teste achou um defeito: o toque também alternava o mudo e o microfone nascia mudo**). O texto do toque não cita tecla (3 textos novos nas 6 línguas).

**Provas:** `medicoes/voz-celular.mjs`: Chrome com tela de toque (915×412), toque de verdade pelo CDP, **12 de 12** (o botão aparece, está **por cima** da mira, tocar alterna, segurar fala, o colega aparece falando sozinho); foto `arte/voz-celular-claude.png`; testes do botão, do texto e das traduções; **11 de 11 mutações à mão pegas** (a primeira rodada deixou escapar uma por teste fraco, que reforcei, e uma equivalente, que simplifiquei no código). **Não provado em aparelho real:** o **iPhone** é o risco (áudio WebRTC no Web Audio do Safari).

**P210, a rádio (só desenho, `RADIO_E_EMISSORES.md`):** a visão se resolve com **emissores de som no mundo** (autofalante em laço, rádio de prédio ou de área, só os 3 mais próximos tocam) e uma **rádio 24 h sincronizada pelo relógio** (sem servidor, sem custo); **a música do PC do jogador** (`getDisplayMedia`) só roda no computador, custa upload × ouvintes e traz direitos autorais e privacidade: **recomendo não**. Nada construído.

**Falta (R13):** (a) o celular de verdade (Android, iPhone); (b) **a sua decisão** sobre a rádio (§ 5 do documento: de onde vem a música, fluxo ao vivo ou programação, a rádio que o jogador carrega); (c) tudo o que já faltava da voz (a política de privacidade antes de liberar `tela:voz`, o canal TIME).

**Próxima sessão começa com:** a decisão do Comandante sobre a rádio (E1: o emissor de laço, com a voz do narrador na Estação dos Cabos), ou o teste num celular real.

## AS PERMISSÕES DOS AGENTES VIRARAM LISTA FECHADA, COM TRAVA NO `npm run check` — Claude, 19/10 (branch `claude/qwen-permissoes`, P208)

**O Comandante (19/10):** *"aperte, autorizado sim, resolva esses alerta das permissoes ao qwen. toda hora vc reclama disso e nao resolve!"*. O alerta automático de segurança apontava o `.qwen/settings.json` (uma edição local, sem commit, alheia a este trabalho) por liberar `powershell *`, `cmd *` e `git *`: valem por qualquer comando, sem aprovação.

**Feito:** (1) o arquivo voltou ao padrão commitado **mais só comandos específicos de olhar o git** (`git status`, `git branch --list`, `git ls-remote --heads origin`, `git diff --stat`, `git merge origin/main`, `git fetch origin`, `timeout 600 npm run *`); saíram `powershell *`, `cmd *`, `git *`, `git checkout/merge/branch/ls-remote/fetch *` e `timeout *` (que também roda qualquer coisa). O arquivo alargado ficou em `.tmp/qwen-settings-local-widened-19-10.json`. (2) **A trava** (`scripts/permissoesDosAgentes.mjs` + `server/permissoesDosAgentes.test.ts`, 10 testes, **10 de 10 mutações pegas**): nenhum arquivo de permissões de agente pode liberar interpretador, envoltório ou verbo perigoso do git com coringa; o Qwen tem **lista fechada** (acrescentar é mexer no arquivo e na lista no mesmo PR); a única exceção do Comandante é o `git push` do Claude (o `publicar`), por texto exato e só no arquivo dele.

**Falta (R13):** o que continua liberado ao Qwen por decisão do fluxo do `AGENTS.md`: `rmdir *` (`cmd /s` apaga árvore; a junção de `node_modules` é o caso), `git worktree *` (`remove --force`), `git commit *` (`--no-verify`), `git add *`, `npm run *` (qualquer script do `package.json`). Apertar mais obriga o Qwen a pedir aprovação a cada branch e cada limpeza: decisão do Comandante.

**Próxima sessão começa com:** o chat de voz no celular (P209) e o desenho da rádio (P210).

## O `SERVIDOR.LOG` ANTIGO FOI LIMPO, E OS DOCUMENTOS ARQUIVADOS DE NOVO — Claude, 18/10 (branch `claude/docs-fechamento`, P204)

**O Comandante (18/10):** *"pode limpar o log sim, se tiver alguém, ela tenta de novo!"*. **Feito:** com `scripts\parar-servidor.ps1` (o servidor avisa quem joga, salva e sai), o `servidor.log` teve **1 e-mail e 16 IPs de rede mascarados no lugar** (mesmo tamanho; conferido 0 e 0) e o `scripts\ligar-servidor.ps1` religou e conferiu o `/status`. O que atrapalhou antes: **`Stop-ScheduledTask` não derruba o servidor** (deixa o `node` órfão); a instrução foi corrigida no `DEPLOY.md` § 4c. **`npm run arquivar`** de novo (o ESTADO passou de 150 KB): o antigo foi para `.decepticons/arquivo/`.

**Em produção agora (conferido):** aviso de reinício (#390), esqueci a senha (#392: `POST /conta/esqueci` responde 503 `sem-email` até haver a chave do Resend, como projetado) e o Analytics no `/metricas/` (#393: responde "falta o ID da propriedade", e a chave não vaza).

**Falta (dele):** a chave do Resend (`LANCAMENTO.md § 7`), o ID da propriedade do Analytics (§ 6C), a opção de estado e o HSTS na Cloudflare (§ 6B), o nome do encarregado na política. **Aviso técnico:** o JS de partida do jogo está em **496,1 de 500 KB**: o próximo recurso do jogo tem de entrar como pedaço sob demanda.

## O GOOGLE ANALYTICS DENTRO DO `/METRICAS/`: PRONTO NO CÓDIGO, FALTA UM NÚMERO — Claude, 18/10 (branch `claude/analytics-nas-metricas`, P207)

**O Comandante (18/10):** *"ligue o metricas, quero tudo devidamente configurado na melhor e mais técnica estrutura"* (e mandou `100530709581858880369`, que é o **`client_id` da conta de serviço**, não o ID da propriedade do Analytics: tem 21 dígitos; o da propriedade tem 9 ou 10).

**O que entrou:**
1. **`server/analytics.ts`:** a conta de serviço (`ga-chave.json`, fora do git) assina um JWT RS256 com `node:crypto`, troca por um token de 1 hora (`analytics.readonly`) e chama a Data API (`batchRunReports` + `runRealtimeReport`). **Sem biblioteca nova.** Cache de 10 min (2 min depois de erro), pedidos simultâneos viram um só, e o `/metricas` **nunca espera o Google mais que 4 s** ("carregando" e a vez seguinte já tem). A chave e o token nunca saem (log, resposta, detalhe do erro: sequências longas viram "…").
2. **Só somas por categoria:** as dimensões são data, canal, país, aparelho. Nada de usuário, IP, cidade ou página (o que a política promete, e o teste trava).
3. **A página** (seção "Google Analytics"): 4 cartões (usuários e novos, sessões e engajadas, tempo médio, **no site agora**), tabelas de canal, país, aparelho e o dia a dia, e **uma frase para cada estado** (sem chave, chave ilegível, falta o ID, carregando, erro do Google com o que fazer, servidor antigo). Diz que só enxerga quem aceitou os cookies do site. Nome vindo do servidor nunca vira HTML.
4. **O ID da propriedade:** de `ga-propriedade.txt` (só números, aceita `properties/`), da variável `CYBERMECH_GA_PROPRIEDADE`, ou **descoberto sozinho** pela Admin API **se a conta enxergar uma só** (a API tem de estar ligada no projeto; hoje não está).
5. **De brinde:** o teste "histórico do painel" do `admin-http.test.ts` (`amostras.length > 2` sem esperar) reprovou o deploy do atualizador em 18/10 por timing sob carga; agora espera as amostras.

**Provas:** 16 testes com um Google de mentira que **confere a assinatura do JWT com a chave pública**; **5 mutações à mão pegas** (sem cache de token, outro algoritmo de assinatura, sem mascarar sequências longas, sem juntar pedidos simultâneos, ID da variável sem validar); no Chrome, `site --check` desenha os cartões, as tabelas e recusa HTML vindo do servidor. **Já provado na máquina do Comandante:** a chave é válida e o Google aceitou a conta (emitiu o token).

**Falta (dele), uma das duas:** (a) pôr o ID da propriedade (Analytics → Administrador → Detalhes da propriedade, 9 ou 10 dígitos) em `D:\DECEPTICONS\.tmp\servidor\ga-propriedade.txt`; ou (b) ligar a **Google Analytics Admin API** no projeto `cybermech-online` (console.cloud.google.com → APIs e serviços → Biblioteca), e o servidor descobre sozinho. O servidor relê os arquivos a cada 30 s: **não precisa reiniciar**. **Não provado ainda:** os números de verdade do Google (falta o ID).

**Próxima sessão começa com:** conferir o `/metricas/` depois do ID; a limpeza do `servidor.log` antigo.

## O "ESQUECI A SENHA": LINK POR E-MAIL, PÁGINA PRÓPRIA E SEM CNPJ NA POLÍTICA — Claude, 18/10 (branch `claude/esqueci-a-senha`, P206)

**O Comandante (18/10):** *"faça o esqueci a senha; não vamos dar CNPJ por enquanto pois não temos e o jogo é indie, feito por uma pessoa apenas"*.

**O que entrou:**
1. **O pedido** (`POST /conta/esqueci`): responde **202 igual exista a conta ou não** e **antes** do trabalho (banco e envio), então nem o texto nem o tempo dizem se o e-mail tem conta. Limites: **5 por hora por IP**, **3 por hora por conta** e **50 e-mails por dia** no total (a cota grátis do Resend é 100). Sem e-mail configurado: 503 `sem-email` e o jogo diz para pedir ajuda pelo contato da Privacidade.
2. **O link:** 32 bytes aleatórios; o banco guarda só a **impressão digital (SHA-256)**; vale **30 min** e **uma vez**; um pedido novo cancela o anterior. Ele vai **depois do `#`** (`/redefinir/?lang=pt#TOKEN`): o fragmento não vai a servidor nenhum nem no Referer.
3. **A troca** (`POST /conta/redefinir`): confere o link, grava a senha nova (scrypt, sal novo) e **encerra todas as sessões da conta**; duas trocas com o mesmo link ao mesmo tempo, só uma passa. **Não entra sozinho:** manda voltar ao jogo e entrar com a senha nova.
4. **A página `/redefinir/`** (`scripts/redefinir.mjs`, sete línguas, `noindex`, **sem Google nem cookies**): tira o token da barra de endereço ao abrir, valida a senha, e mostra a frase certa para link vencido, limite e servidor fora do ar. Provada no navegador sem rede de verdade (`site --check`).
5. **No jogo:** "Esqueci a senha" no painel de login (modo novo, sem aba nem botão primário a mais), nas 6 línguas.
6. **E-mail:** `server/email.ts` (provedor trocável; o Resend por `fetch`, sem biblioteca; chave só em `.tmp/servidor/email.json` ou `CYBERMECH_EMAIL_CHAVE`, nunca no git), textos em 7 línguas.
7. **Sem e-mail ainda? `npm run admin -- link-senha <e-mail>`** gera o mesmo link (30 min, uso único) para o Comandante entregar à pessoa.
8. **Auditoria:** `senha_recuperacao_pedida`, `senha_redefinida`, `link_senha_gerado`, com o número da conta, nunca o e-mail nem o token. **Política:** o controlador agora é "uma pessoa física, sem empresa nem CNPJ por ora"; nova linha na tabela e o Resend como destinatário (EUA).

**Provas:** 22 testes do fluxo com o servidor de verdade (pedir → e-mail → trocar → senha velha falha, sessão antiga cai, link não serve duas vezes; resposta igual com e sem conta; limites; auditoria sem o e-mail; falha do provedor) + 5 do cliente; **5 mutações à mão pegas** (sem prazo, sem encerrar as sessões, vários links por conta, sem a trava de uso único, limite por conta frouxo).

**Falta (dele):** ligar o envio de e-mail: conta no Resend, verificar o domínio `cybermech.online` e guardar a chave (`LANCAMENTO.md § 7`). **Até lá**, o jogo avisa que a recuperação por e-mail não está ativa e o `link-senha` resolve na mão. **Não feito:** e-mail de aviso "sua senha foi trocada" (boa prática; entra com o envio ligado) e o nome da pessoa na política (a LGPD pede a identidade do encarregado; ele decide).

**Próxima sessão começa com:** a leitura do Google Analytics no `/metricas/` (falta o ID numérico da propriedade) e a limpeza do `servidor.log` antigo.

## O CHAT DE VOZ: ÁUDIO DIRETO ENTRE OS JOGADORES, SEM SERVIDOR DE MÍDIA, SEM CUSTO E PROVADO EM CHROME DE VERDADE — Claude, 18/10 (branch `claude/voice-chat`, P205)

**O Comandante (18/10):** trouxe o plano do VOICE CHAT (microfone aberto + apertar-para-falar, áudio espacial, canais ALL + TEAM, TURN a critério técnico) e, ao mandar seguir: *"quero q seja simples, sem custo inicial e eficiente"*.

**O que entrou** (`VOICE_CHAT.md` tem tudo, inclusive onde o código **difere do plano** e por quê):
1. **A voz vai direto de um navegador ao outro** (WebRTC, malha); o servidor **só repassa** a oferta e a resposta (`server/voz.ts`: 3 mensagens 30–32, o remetente é trocado pelo id de verdade, SDP conferido, teto de 30 mensagens por 10 s). **Não sobe o protocolo**, não toca no tick, não gasta banda do jogo.
2. **Sem custo:** só o STUN público do Google (**sem TURN**: quem tem rede que barra a conexão direta fica sem voz e a tela diz "N SEM CONEXÃO"). Opus a 24 kbps **com DTX no SDP** (o plano supunha que viria sozinho: não vem).
3. **Cliente** (`client/src/voice/`): microfone aberto com **T alternando o mudo**, ou **segurar T** (modo nas Configurações, tecla trocável); voz espacial (volume cheio até 12 m, some em 160 m, `equalpower`); quem recusa o microfone **entra como ouvinte**; reconexão da sala refaz a voz sem pedir o microfone outra vez. Indicador no canto de baixo à esquerda, seção CHAT DE VOZ nas Configurações, tudo nas 6 línguas. **Pedaço sob demanda** (3,5 + 0,7 KB gzip, só baixa quem liga a voz numa sala): o JS de partida ficou em **495,4 de 500 KB**.
4. **Nasce RESTRITA** (`tela:voz`, regra do P191): só o modo Comandante (`?comandante=1`) vê e usa até o painel de visibilidade soltar; **é também a chave de desligar** sem republicar.

**Provas:** bancada em **Chrome de verdade** (`medicoes/voz.mjs`, 26 verificações: o áudio chega nos dois sentidos, mudo e PTT cortam, **a 100 m cai a 0,40 e a 200 m some**, recusa vira ouvinte, microfone tardio entra sem renegociar, **falando ~50 pacotes/s e calado ~5 com o DTX**) + a captura do jogo real (`arte/voz-hud-jogo-claude.png`); testes de unidade, de sala e da sessão contra o servidor de verdade; **33 de 34 mutações à mão pegas** (a 34ª virou teste).

**Falta (R13):** (a) **o ouvido do Comandante** (a bancada prova que o áudio chega e o volume cai; se soa bem é dele); (b) **dois aparelhos em redes diferentes** (a bancada liga dois Chrome na mesma máquina); (c) **canal TIME** (o protocolo online não tem time; entra com o CTF online); (d) **mudo por jogador**; (e) **ANTES DE LIBERAR `tela:voz`: a política de privacidade** — a voz mostra o IP aos outros jogadores da sala e o STUN do Google o recebe; o texto pronto, a troca de `POLITICA_VERSAO` e o `PRIVACIDADE.md` estão em `VOICE_CHAT.md` § 4; (f) TURN próprio só se um jogador real reclamar.

**Próxima sessão começa com:** o veredicto do Comandante (testar com dois navegadores em `?comandante=1`); depois o canal TIME junto com os times online, ou o que ele mandar.

## O SERVIDOR AVISA ANTES DE REINICIAR: TELA COM CONTADOR, E O JOGO INSISTE EM VOLTAR — Claude, 18/10 (branch `claude/aviso-de-reinicio`, P204)

**O Comandante (18/10):** *"será que temos que adicionar uma imagem dizendo que estamos reiniciando o servidor ou em manutenção (e dizer se temos previsão de retornar, atualizado automaticamente, com um contador na tela, e se for reinício do servidor, dizer que volta em 1 ou 2 minutos? ou potencialmente mais?)"*. Sim, e entrou.

**O que entrou:**
1. **O servidor avisa e só então corta** (`server.fecharComAviso`, usado pelo painel e pela atualização automática): com gente na sala manda o aviso `AVISO` (mensagem nova, `shared/net/messages.ts`; cliente antigo a ignora, **sem mudar o protocolo**), espera **10 s** (`REINICIO_AVISO_S`) e corta com o código **4010** e o tempo previsto de volta (**60 s**, `REINICIO_VOLTA_EM_S`: medi 16 a 50 s nos deploys de hoje). Sem ninguém, reinicia na hora.
2. **A tela** (`ui/ConnectionNotice.ts`, frases em `ui/avisoDeConexao.ts`, nas 6 línguas): "ATUALIZAÇÃO DO SERVIDOR · corte em 0:07"; depois do corte "SERVIDOR REINICIANDO · volta em ~0:58" descendo; passou da previsão, "DEMORANDO MAIS QUE O PREVISTO · fora há …"; queda sem aviso (PC, internet, túnel) "CONEXÃO PERDIDA · fora há …", e **depois de 30 s o botão "JOGAR OFFLINE ENQUANTO ISSO"**. Quem nunca entrou na sala não ganha a tela (cai no offline em ~19 s, como sempre).
3. **A insistência:** antes o jogo desistia em ~15 s e pedia para recarregar; agora quem já estava na sala tenta de novo **a cada 5 s por até 10 minutos** (`PERSISTENCIA_PADRAO_MS`) e volta sozinho.

**Provas:** 4 testes novos no `online.test.ts` (aviso → corte 4010 → previsão → volta sozinho; queda sem aviso desiste só no fim da persistência; quem nunca entrou não insiste; sala vazia não espera), 1 no codec, 8 das frases; **2 mutações à mão pegas** (tirar a trava de "já entrou" e nunca insistir). **Ponta a ponta no Chrome contra um servidor local** (`medicoes/aviso-reinicio.mjs`, 8 de 8): o aviso conta 0:07, depois do corte 0:58, o servidor volta e a tela some sozinha, a queda sem aviso mostra o botão offline com 35 s. Capturas em `.decepticons/arte/aviso-reinicio-*-claude.jpg`.

**Falta:** ver num reinício de produção de verdade (o próximo deploy com gente na sala); um aviso de **manutenção agendada** escrito pelo dono (hoje só o reinício é anunciado); o aviso na landing do site (a Hostinger não sabe do servidor).

**Próxima sessão começa com:** o "esqueci a senha" e a leitura do Google Analytics nas métricas (ordem P204).

## OS DOCUMENTOS FICARAM 6× MAIS LEVES, O MONITOR É O DA CLOUDFLARE E A CHAVE DO GOOGLE JÁ FUNCIONA — Claude, 18/10 (branch `claude/arquivar-docs`, P203)

**O Comandante (18/10):** *"ARQUIVAR"*; não conseguiu criar o monitor no UptimeRobot e perguntou se é grátis e se o sistema do Telegram (serafim13, BatBot) já não serve; ativou a Google Analytics Data API e deu a conta de serviço; perguntou se vale formatar um PC velho como servidor ou contratar uma VPS; e mandou prosseguir.

**O que entrou:**
1. **`npm run arquivar`** (`scripts/arquivar-docs.mjs`, teste em `server/arquivarDocs.test.ts`): o que tem mais de dois dias do `ESTADO_ATUAL` e do `HISTORICO` foi para `.decepticons/arquivo/` (um arquivo por quinzena). **ESTADO 641 → 152 KB, HISTORICO 645 → 70 KB.** Provado nos documentos de verdade: **0 linhas perdidas** (cada linha não vazia do original está no vivo ou no arquivo) e o painel dá os mesmos números (361 decisões, 393 leituras, 111 pedidos); ele agora lê o vivo e o arquivo. A seção "EM BRANCH" ficou só com a tabela. `AGENTS.md` manda ler **só o topo** e escrever curto (ordem em ~600 caracteres, sessão em ~25 linhas). A `ORDENS` (192 KB) ficou: 123 KB dela são das últimas 48 h, e o remédio ali é a linha curta, não arquivo.
2. **Monitor:** o UptimeRobot grátis dá 50 monitores a cada 5 min **só com e-mail** (o Telegram é de plano pago; e o grátis é, pelos termos de terceiros, para uso não comercial). O sistema do Telegram do serafim13 **não serve para isto**: o `serafim-watchdog` roda **a cada 6 h** pelo GitHub Actions (a detecção levaria até 6 h, e o GitHub Actions está sem pagamento, ao menos no repositório do jogo), e o BatBot é outro produto (varredura de segurança de clientes). **Recomendado: o "Tunnel Health Alert" da própria Cloudflare** (grátis, e-mail, sem conta nova): passo a passo em `LANCAMENTO.md § 6A`.
3. **Chave do Google:** o arquivo é válido e o **Google aceitou a conta** (emitiu o token); falta só o **ID numérico da propriedade** para a leitura dos dados (`LANCAMENTO.md § 6C`).
4. **Servidor em outro computador:** medido, o servidor é leve (100 jogadores ≈ 26% de **um** núcleo, 375 MB, 4,4 KiB/s por jogador): o PC velho não precisa ser bom, mas **não é para fazer agora** (`LANCAMENTO.md § 6D`).

**Falta (dele):** o ID da propriedade do Analytics; o alerta de túnel na Cloudflare; razão social/CNPJ e nome do encarregado; "esqueci a senha"; 5 a 10 pessoas de fora. O `servidor.log` antigo segue como estava (precisa parar o processo do servidor).

**Próxima sessão começa com:** o ID da propriedade do Analytics (conferir a leitura e, se ele quiser, ligar os números no `/metricas/`); senão, as métricas dos primeiros jogadores de verdade.

## O PRIMEIRO TESTE ONLINE: OS BOTS DIFÍCEIS DEMAIS, AS REGRAS NO PAINEL E O "PROBLEMA" QUE ERA O PC — Claude, 18/10 (branch `claude/regras-online`, P201 e P202)

**O Comandante (18/10), depois de jogar online com uma pessoa da internet:** *"achamos MUITO DIFÍCIL os bots inimigos… não conseguimos trocar direito devido à pressão adversária… precisamos melhorar a logística de controlar esse tipo de coisa através do painel admin que só eu tenho"*; e a janela do servidor marcava PROBLEMA ("atraso do laço (p99) 107,9 ms").

**1. A causa dos bots difíceis (achada no código):** a sala online usava o padrão de uma partida solo (3 Mechs e 2 andróides, dificuldade normal) e **a sala não aplicava o limite de atacantes** (`maxAttackers` ficava infinito): **todos os bots atacavam duas pessoas ao mesmo tempo**. É o oposto do jogo solo, que limita a 2.
**2. O que mudou:** o padrão online agora é **de iniciante** (fácil, 2 Mechs, 1 andróide, 1,5 atacantes juntos) e **o dono ajusta no painel**: janela SERVIDOR → **[ REGRAS DAS SALAS ]**: dificuldade, Mechs, andróides, pressão; receitas INICIANTE / PADRÃO / DESAFIO; **APLICAR** vale na hora nas salas de pé (dificuldade, pressão e Mechs; os andróides valem nas salas novas). Guardado no servidor (`regras-online.json`), sobrevive ao reinício. **Porta:** só a chave do dono ou a sessão de uma conta admin (`PAINEL_ADMIN.md` § 7).
**3. O "PROBLEMA" do painel não era o servidor** (`server/admin.ts`): o Node demorou a olhar a fila porque o **PC estava saturado** (as compilações, os testes das duas sessões, o navegador); o TESTAR, com gente de mentira, deu 15,8 ms. **Agora, numa janela sem ninguém jogando, o atraso do laço vira aviso (não problema)** e o painel diz que foi outro programa; com gente jogando vale a régua inteira.

**Provas:** 5 testes (o padrão de iniciante e as receitas, o que vem de fora é puxado para os limites, o armazém em arquivo e o aviso às salas, a sala nova e a sala de pé aplicando, as rotas do dono com o servidor de verdade: 401 sem chave, o POST puxa para os limites e o GET devolve o que vale).

**Falta (R13):** **não vi a janela REGRAS DAS SALAS no navegador** (testes, tipos e o servidor de verdade, sim): o Comandante confere; **o efeito sobre o jogo online (a sensação de dificuldade) é do Comandante julgar**: os números de iniciante são proposta; falta escalar por quantidade de gente, ajustar **por sala** e o dano dos bots; os andróides só mudam nas salas novas; a conta "superadmin" é o `is_admin` que já existia (nenhum papel novo).

**Onde o Comandante confere:** jogue online (`ARENA`), abra `?comandante=1` → COMANDO → SERVIDOR → **[ REGRAS DAS SALAS ]**, escolha INICIANTE ou DESAFIO e APLICAR: a sala de pé muda sem reiniciar.

**Próxima sessão começa com:** o que o Comandante julgar depois do segundo teste online.

## AS PENDÊNCIAS DO LANÇAMENTO: O QUE O COMANDANTE DECIDIU, O E-MAIL DO ENCARREGADO E O PASSO A PASSO DO QUE SÓ ELE FAZ — Claude, 18/10 (branch `claude/pendencias-lancamento`, P199 e P200)

**O Comandante (18/10), respondendo à lista do que faltava:** manter o servidor neste PC por ora (ele está terminando o jogo para deixar o PC só como servidor); o e-mail do encarregado é `volkov@serafimweb.com`; quer as orientações da Cloudflare e como criar a chave do Google; "já estou divulgando, conclua as pendências"; e pediu para manter tudo limpo, enxuto e com boas práticas, perguntando se a contagem de "mais de 3.500 testes" estava duplicada e se há algum bug que torna as conversas longas e caras.

**O que entrou:**
1. **O e-mail do encarregado** em `.decepticons/contato-privacidade.txt` (versionado): a política `/privacidade/` passa a mostrá-lo nos dois lugares em que o contato aparece.
2. **`LANCAMENTO.md § 6`:** o passo a passo do monitor externo (A14), da Cloudflare (estado do visitante e HSTS) e da chave de serviço do Google, com o estado de cada pendência.
3. **A contagem de testes está certa, não duplicou:** o Vitest rodou **3.284 testes em 310 arquivos** (o check de hoje, antes do #385); o site mostra 3.265 (sala de controle) e 3.252 (oficina) porque cada página conta as linhas `it(` com uma regex um pouco diferente; são 312 arquivos de teste e os 7 nomes repetidos estão em pastas diferentes. **"3.500" não aparece em nenhuma página nem documento** do repositório.
4. **Por que as conversas pesam (medido, não é bug de código):** os 5 documentos vivos somam **1,7 MB** (`ESTADO_ATUAL` 638 KB e 3.134 linhas, `HISTORICO` 645 KB e 3.852, `ORDENS` 192 KB, `STATUS_REAL` 156 KB, `ROADMAP` 90 KB); cada PR edita os cinco e briga no topo com os outros agentes; o check do push roda em silêncio de 6 a 10 min numa máquina compartilhada e reprova por carga. **Proposta, que espera o "pode" dele:** arquivar o que tem mais de 30 dias em `.decepticons/arquivo/` (o painel lê ESTADO e HISTORICO e passaria a ler o arquivo também).
5. **A regra de higiene (P200)** entrou no R17 do `AGENTS.md`: o que ficou sem uso na área que o PR tocou sai no mesmo PR.

**Não feito, e por quê:** o `servidor.log` antigo (1 e-mail e 16 IPs de rede) **segue como estava**. O Windows o trava com o servidor no ar (EBUSY) e **parar a tarefa não derruba o servidor** (verificado: o uptime não zerou; ele sobe por um ajudante do WMI). Nada foi alterado e o servidor não foi reiniciado. O servidor novo não escreve nada pessoal nesse arquivo.

**Falta (dele):** conta no monitor externo; ligar a opção na Cloudflare; a chave do Google; razão social/CNPJ e o nome do encarregado na política; "esqueci a senha" (sem serviço de e-mail, lança avisando que a senha não se recupera); 5 a 10 pessoas de fora.

**Próxima sessão começa com:** o "arquivar" do Comandante, se vier; senão, olhar as métricas dos primeiros jogadores de verdade.

## O PAINEL DE VISIBILIDADE: O QUE OS JOGADORES VEEM E O QUE FICA EM TESTE — Claude, 18/10 (branch `claude/visibilidade`, P191)

**O Comandante (18/10):** *"um painel COMPLETO DE TUDO… pra eu poder selecionar o que os jogadores normais veem na tela (quais robôs, armas, fases, detalhes) e quais eu mantenho secretos/restritos ao admin, em estágio de teste… (tipo o botão "lado", "arquivo")"*.

**O que entrou** (`PAINEL_ADMIN.md` § 6): um **catálogo de funcionalidades** (fases, modos, botões e telas, **todos os robôs e todas as armas**) com um padrão `publico` ou `restrito`; o **servidor** guarda as exceções (`visibilidade.json`, sobrevive ao reinício; `GET /visibilidade` público, `POST /admin/visibilidade` só com a chave do dono); o **jogo** aplica (o restrito some para o jogador e aparece com o selo TESTE para o Comandante; link de fase ou modo restrito volta ao padrão); o **painel** (chip VISIBILIDADE ▸, só no modo Comandante): lista de tudo, PÚBLICO | RESTRITO em cada linha, SALVAR PARA TODOS, SÓ NESTE NAVEGADOR, VER COMO JOGADOR, RESTAURAR PADRÕES.

**Fusão com o lançamento (PR #384, outra sessão):** o `Lancamento.ts` dela (a lista fixa de dois mapas) **agora pergunta ao catálogo**: a Cidade Neon e a Estação dos Cabos nascem públicas, o Bunker e a Terras Raras restritos, e **o painel é quem libera um mapa** (sem código). O pino "EM BREVE", o filtro das campanhas e o link que cai na Cidade Neon dela seguem iguais.

**Mudança de comportamento a saber:** **ARQUIVO, ESCOLHA O LADO e RELATÓRIO agora nascem RESTRITOS** (são os exemplos que o Comandante deu de "em desenvolvimento"): o jogador normal **não os vê mais** até o Comandante os liberar no painel (modo Comandante: `?comandante=1`, chip VISIBILIDADE ▸, trocar para PÚBLICO, SALVAR PARA TODOS). Tudo o mais continua como estava (público).

**Provas:** testes do contrato, do armazém em arquivo, das rotas com o servidor de verdade (401 sem chave, 400 com lixo, o que o dono grava aparece no GET), do catálogo (todo robô e toda arma do jogo está nele; o que está em desenvolvimento nasce restrito), da visibilidade (jogador × Comandante, exceção do servidor, cache, falhas de rede, link de fase restrita, DOM) e do painel (só as exceções vão ao servidor).

**Custo:** zero no laço do jogo; uma consulta HTTP ao abrir (1,5 s no máximo, sem travar). O painel é pedaço sob demanda.

**Falta (R13):** **não é cadeado** (quem ligar o modo Comandante vê tudo); **os modais do console de comando** (Potências, Arsenal, Campanha, Mesa, Servidor) ainda não estão no catálogo; a mudança chega ao jogador **na próxima abertura do jogo**; o painel foi **visto no navegador** (`arte/visibilidade-painel-claude.png`), mas o **SALVAR PARA TODOS contra o servidor de produção** só foi exercitado com o servidor de teste (a chave do dono é do Comandante); a lista de robôs mostra os nomes do jogo (VECTOR-09…); só as funcionalidades catalogadas são controláveis.

**Onde o Comandante confere:** `…/jogar/?comandante=1` → **EXPLORAR HANGAR E MODOS ▸** → chip **VISIBILIDADE ▸** (amarelo, no canto de cima). Troque algo para RESTRITO, **VER COMO JOGADOR**, e depois **SALVAR PARA TODOS** (precisa da chave do dono: a janela SERVIDOR guarda).

**Próxima sessão começa com:** o que o Comandante julgar; depois o objetivo na tela dos outros modos e mapas (P190) e a Praia abaixo de 60 fps (P188).

## O LANÇAMENTO: AUDITORIA DE SEGURANÇA, PRIVILÉGIOS, TRILHA DE AUDITORIA, GOVERNANÇA E OS MAPAS FECHADOS — Claude, 18/10 (branch `claude/lancamento-seguranca`, P196 a P198)

**O Comandante congelou o escopo** (`LANCAMENTO.md`) e pediu: acesso, privilégio, autenticação, auditoria interna, observabilidade, governança, **lançar só com CIDADE NEON e ESTAÇÃO DOS CABOS**, "Rio Vivo" virar "Terras Raras" e **uma auditoria de segurança**.

**O que entrou:**
1. **`AUDITORIA_SEGURANCA.md`:** 1.368 pedidos hostis contra um servidor de verdade (0 falhas, `.decepticons/medicoes/abuso-servidor.mjs`), `npm audit` (0 vulnerabilidades), segredos, rotas, autenticação, privilégios. **Conclusão: o código está em condição de lançar; o que bloqueia o público é operacional e do Comandante: A1 (servidor e chaves de publicação no mesmo PC de trabalho) e A13 (cópia das contas no mesmo disco).**
2. **Corrigido:** a configuração global só aceita chaves conhecidas; **limite de falhas por conta** (10 em 15 min, login e apagar); **teto de 10 sessões** por conta; **trilha de auditoria** de 400 dias, sem e-mail nem IP, na seção "Auditoria interna" do `/metricas/`; **`npm run admin`** como único caminho para administrador.
3. **`GOVERNANCA.md`:** a matriz de privilégios, quem é dono de quê, como uma regra muda, o que se guarda e por quanto tempo, e o que fazer quando dá errado (servidor caído, token vazado, vazamento de dados com o aviso à ANPD).
4. **Mapas do lançamento:** só CIDADE NEON e ESTAÇÃO DOS CABOS livres; **Bunker e TERRAS RARAS "EM BREVE"** (o modo Comandante abre todos). O renome de "Rio Vivo" para "Terras Raras" outra sessão já tinha feito (P187): aqui só se conferiu que nada ficou para trás.

**Provas:** 16 testes de segurança de acesso com o servidor de verdade; **mutação à mão: 20 de 20** (só na segurança de acesso, por ordem do Comandante); 6 testes do bloqueio de mapas; o abuso medido.

**Falta (do Comandante, para o lançamento público):** o **servidor fora do PC de trabalho** (A1), a **cópia de segurança fora do PC** (A13), o **monitor externo** (A14), o **encarregado** e a política revisada, o **"esqueci a senha"**, o **HSTS** na Cloudflare e o **teste com 5 a 10 pessoas de fora**.

**No ar (conferido em 18/10, 15:08):** PR #384 na `main` (b2c6f3e); o atualizador religou o servidor no código novo e o site foi publicado e conferido por soma. Ao vivo: `GET /config?chave=segredo` → 400 (a conhecida segue 200), `/metricas` sem o token → 401 e **com o token traz o bloco `auditoria`** (o acesso do dono e a recusa do anônimo já aparecem). O atualizador recusou o deploy **duas vezes** nesse dia por `server/estudio.test.ts` (preparo acima dos 10 s do Vitest com a máquina ocupada): o `hookTimeout` agora é 30 s como o `testTimeout`.

**Próxima sessão começa com:** o que o Comandante decidir sobre o servidor (item 8 de `LANCAMENTO.md`); nada novo antes disso.

## TERRAS RARAS: O JOGO FICOU 2,5× MAIS RÁPIDO, A MISSÃO COMEÇA PERTO E O OBJETIVO ESTÁ NA TELA — Claude, 18/10 (branch `claude/terras-raras`, P187 a P190)

**O Comandante (18/10), depois de jogar:** *"ficou meio travado, pesado… será que há muitos elementos na fase? […] demorou mais de um minuto pra eu chegar correndo lá […] temos que melhorar a descrição dos objetivos da missão na própria tela […] temos sempre que corrigir e melhorar o DESEMPENHO"* e *"mude o nome do rio vivo pra terras raras"*.

**1. O que travava (medido, não suposto).** Criei a bancada na GPU de verdade (`medicoes/amazonia-gpu.mjs`, AMD Vega 11, **a janela dele: 1549×925 a 1,25× = 1936×1156 pixels**), mediu-se cada coisa por vez:
- **Cenário não era o culpado:** com as árvores, o terreno, a água, o céu e as estruturas **todos escondidos**, o quadro só ganhava ~2 ms (de 14 a 12). 6.594 árvores, 2,4 km de mapa e 221 mil triângulos cabem folgados.
- **O culpado: o MSAA 4× do alvo HDR do composer** (`Game.ts`): **~17 dos 27 ms de cada quadro**. O bloom, o cobertor de ondas e o tone mapping desenham tela cheia *dentro* do alvo multiamostrado e cada um paga a resolução das amostras. **Valia para todos os mapas:** a Arena também dava 22 fps na qualidade Alta.
- **A troca:** o alvo HDR sem MSAA e um **FXAA** de uma passada depois do tone mapping (`fx/Fxaa.ts`). **Visualmente equivalente** (comparei recortes lado a lado). Custo do FXAA: ~1,5 ms.
- **Resultado (a janela dele, qualidade Alta):** **Amazônia 27 → 66 fps** (o render do quadro, de 24-27 ms para 10,5 ms), **Arena 22 → 61 fps**, **Praia 25 → 47 fps**. Na qualidade Automática (a padrão) o jogo se estabilizava em 35 a 63 fps com engasgos de 64 ms (p95); agora a Alta já segura 60+.
- **Mais um degrau na qualidade automática** (`core/Quality.ts`): depois de 1,0× e de desligar o bloom, **0,75×** (para GPU integrada mais fraca que a dele).

**2. O mapa é grande demais para uma missão de poucos minutos: o posto avançado.** O jogador nascia na aldeia (x = -960) e o primeiro gerador ficava a 920 m: **100 s de corrida**. Agora ele nasce e renasce num **posto avançado** (`AMAZONIA_POSTO_AVANCADO`, x = -300, na margem sul): **360 m da cerca = ~40 s**, fora do alcance das torres (a mais perto fica a 205 m, elas atiram a 170); a **Resistência** nasce junto. A aldeia segue sendo o que o Draga ameaça (a barra da aldeia continua). O Deathmatch da Amazônia mantém os pontos de sempre. Teste: o posto está em terra firme, fora do alcance das torres e a menos de 450 m da cerca.

**3. O objetivo na tela** (`environment/AmazoniaObjetivos.ts`, no pedaço sob demanda da Amazônia): **uma ordem no topo** (`DERRUBE OS GERADORES · 1 DE 3`, depois `DERRUBE O DRAGA-01`), **uma dica** logo abaixo (`Siga o marcador: CERCA, a 320 m.` / `A Resistência planta a carga: 45%. Proteja-a ou derrube o Draga a tiro.`) e **marcadores no mundo**: um losango sobre cada gerador (o mais perto, maior e pulsando, com nome e distância; os outros só o losango), sobre o Draga e sobre a escotilha aberta; **fora da tela o marcador gruda na borda com uma seta** apontando para onde ir, e aparece **por cima da mata**. A barra do Draga **parou de repetir a ordem** (a linha de regra e a de escudo saíram com o escudo de pé: "nada repetido") e **a célula da aldeia entrou na barra** (com as linhas novas das torres e da invasão ela ficava por cima delas: bug meu de 18/10, achado na captura).

**4. Renomeado: TERRAS RARAS** (seletor, teatro, campanha, Relatório e as seis línguas).

**5. Dieta de JS** (ver `ORDENS_DO_COMANDO.md` P192–P195): o leitor de `.glb` (13 KB gzip) agora só baixa quando o primeiro robô é pedido. **Pacote de partida: 486,2 de 500 KB** (estava em 498,1).

**Provas:** o teste do posto (terra firme, fora das torres, < 450 m), 10 do objetivo (a ordem e a dica em cada passo, os metros, os marcadores: rótulo, destaque, gerador caído some, borda e seta, a missão parada esconde tudo), os da barra do chefe reescritos, a cobertura de idioma, e a medição na GPU salva em `medicoes/amazonia-gpu-2026-10-18.json`. Capturas do jogo de verdade na GPU: `arte/terras-raras-objetivo-claude.png`, `terras-raras-escotilha-claude.png`.

**Custo de CPU:** zero a mais no tick; no quadro, até cinco projeções de marcador (texto a 4 Hz).

**Onde o Comandante confere:** `…/jogar/?mapa=amazonia&modo=survival`: o jogo deve estar **fluido na Alta e na Automática**; você nasce no posto (a cerca está logo ali), a ordem e o losango verde com a distância mostram o caminho.

**Falta (R13):** **o objetivo na tela só existe em TERRAS RARAS** (a praia, a Cidade Neon, a Bandeira e o Domínio ainda têm só o texto de antes: P190 fica 🟡); **a Praia ainda roda a 47 fps** na janela dele (125 mil triângulos e os shaders dela: há o que ganhar); o painel de visibilidade (P191) é o PR seguinte; o FXAA suaviza um pouco as bordas (mais que o MSAA), **o Comandante julga a olho**; a bancada mede quadros, não o toque da mão: se ainda sentir peso, diga em que ponto do mapa.

**Próxima sessão começa com:** o painel de visibilidade (P191); depois o objetivo na tela dos outros modos e a Praia.

## LGPD (P192) E MÉTRICAS DE NÍVEL PROFISSIONAL (P193): BAIXAR OS DADOS, APAGAR A CONTA, POLÍTICA, GOOGLE ANALYTICS COM LICENÇA, E DE ONDE VÊM AS VISITAS — Claude, 18/10 (branch `claude/lgpd-conta`)

**A ordem do Comandante (18/10):** *"faça os ajustes de apagar conta, baixar dados, tudo que a LGPD obrigue, pra que estejamos todo de acordo"*.

**O que entrou:**
1. **No jogo (Configurações → Conta):** criar conta exige **aceitar a política e declarar a idade** (o servidor também; guarda quando e qual versão); logado há **Meus dados**: **baixar tudo** (JSON), **apagar a conta** (com a senha, numa transação: conta, progresso, atividade e sessões) e **desligar o registro da atividade** (apaga o que havia).
2. **No site:** `/privacidade/` (a política), o rodapé com o link em todas as páginas e a **faixa de cookies**: o **Google Analytics só liga depois do "Aceitar"**. **Achado:** a tag estava **fixa dentro do jogo** (`client/index.html`); agora o jogo só a carrega com o "sim" guardado.
3. **No servidor:** **IP mascarado** no log (`212.8.252.x`), **e-mail fora do log**, e o **registro técnico em arquivo por dia, apagado sozinho depois de 30 dias** (`server/registro.ts`; o painel do servidor lê dele). Novos números do dono: contas criadas, logins, falhas de senha, contas apagadas e dados baixados (só contagem).

4. **A audiência (P193):** o `/metricas/` ganhou **De onde vêm** (digitou o endereço, busca, rede social, outro site, campanha `utm_*`; o funil de cada canal, os sites que mandam gente, as campanhas), **Quem chega** (novo ou recorrente, com conta ou convidado, aparelho, navegador, sistema, idioma, estado do Brasil) e **Quanto se joga** (duração das rodadas e a qualidade gráfica ao terminar). **Só categorias; sem IP, sem cidade, sem id de pessoa.** O Google Analytics **não** entrou na página: precisa da chave de serviço do dono (passos na ordem P193).

**Provas:** testes do banco (aceite, exportar sem segredos, apagar só a conta certa, medição), do HTTP com o servidor de verdade (aceite exigido, versão velha, baixar, apagar com senha errada e certa, a sessão morre, a outra conta intacta, oposição, contagens, preflight, **log sem e-mail**), do cliente (corpo do criar, baixar, apagar, medição; a sessão esquece a conta apagada e **mantém o progresso do aparelho**), do painel de login (as duas caixas, "Meus dados", a confirmação de apagar que não destrói o campo ao digitar) e do registro (dia de Brasília, poda de 30 dias, nunca lança); **o check do site prova no navegador a faixa de cookies** (nada do Google antes da escolha; aceitar liga; a escolha vale na visita seguinte; recusar apaga `_ga`; o jogo não tem a tag fixa). **Mutação à mão: LGPD 32 de 32, audiência 38 de 38, faixa de cookies no navegador do check 7 de 7.** **Ponta a ponta no Chrome (a landing e o jogo reais na mesma origem, contra um servidor local):** a visita do Instagram com link marcado vira canal, site de origem e campanha na landing, o jogo herda a origem, a partida conta com conta ou convidado, a duração e a qualidade entram nas rodadas. Capturas em `.decepticons/arte/` (`lgpd-*-p187-claude.jpg`, `metricas-audiencia-p188-claude.jpg`).

**Custo de CPU:** zero no tick. Um `SELECT` pequeno por visita/rodada de quem tem conta (a checagem da medição); o registro escreve uma linha por evento (a cada 10 s por sala, como o log de antes).

**ATENÇÃO (R13):** o **texto da política é rascunho meu**, escrito a partir do código; **não é parecer jurídico**. **Falta o contato do encarregado** (escreva um e-mail em `.decepticons/contato-privacidade.txt` e a página o mostra) e a razão social. **Não existe recuperação de senha** (exige serviço de e-mail). O **`servidor.log` antigo** ainda tem IPs inteiros e um e-mail (só se apaga com a tarefa parada).

**Onde o Comandante confere:** `cybermech.online/privacidade/`; no jogo, Configurações → Conta (criar conta mostra as duas caixas; logado mostra Meus dados); no site, a faixa de cookies na primeira visita.

**Achados no caminho (R17):** o GA era fixo dentro do jogo; o e-mail ia para o log; `limparExpiradas` nunca era chamada; **a primeira partida de cada visita nunca contava em "partidas iniciadas"** (corrigido).

**O Comandante congelou o escopo (18/10, P194 a P198):** a lista de lançamento está em `LANCAMENTO.md` (10 itens: auditoria de segurança, acesso e privilégio, autenticação, trilha de auditoria, analytics e observabilidade, governança, mapas do lançamento, servidor fora do PC de trabalho, teste com gente de fora, política revisada). **No lançamento só CIDADE NEON e ESTAÇÃO DOS CABOS (a Praia dos Cabos) ficam livres; Bunker e TERRAS RARAS (a Amazônia, ex-"Rio Vivo") ficam "EM BREVE".** O P81 e o painel único estão congelados.

**Próxima sessão começa com:** `LANCAMENTO.md` item 1 (a auditoria de segurança) e, em seguida, os itens 2 a 7 (privilégio, autenticação, trilha de auditoria, observabilidade, governança, mapas do lançamento).

## AMAZÔNIA, PARTE F1: O RELATÓRIO DE CONSEQUÊNCIAS, E OS FATOS CONFERIDOS NA FONTE — Claude, 18/10 (branch `claude/amazonia-consequencias`, P179 camada 3 e P180)

**O Comandante (17/10):** o Relatório de Consequências era a camada 3 do P179 (*"o fim da missão mostra o que aconteceu com o rio, com os povos, com a água, com números lidos de ficha"*) e a ficha de fatos da P180 pedia "ler a fonte primária antes de virar texto".

**O que entrou:**
1. **O chip `RELATÓRIO ▸`** no console (ao lado do ARQUIVO): **só aparece quando a missão do rio acaba** (pisca até o primeiro clique) e some quando ela recomeça. **Nada interrompe a partida e nada abre sozinho** ("nenhuma partida é interrompida por sermão"). Carrega sob demanda, como o Arquivo: o painel (2,1 KB) e o texto (`public/relatorio/<língua>.json`, ~5 KB) só baixam no clique.
2. **O painel** (`ui/RelatorioPanel.ts`), cinco abas no estilo do Arquivo: **O QUE ACONTECEU** (o desfecho; a aldeia; o rio; quantos geradores caíram; quantos andróides da Resistência sobraram; o tempo; "por dentro" ou "a tiro"), **três fatos do mundo real** (o mercúrio no cabelo e no peixe, o garimpo em terras indígenas, a emergência Yanomami), cada um com **a data, a fonte com o endereço (abre em outra aba) e o quadro "O QUE ISTO NÃO DIZ"**, e **O QUE É FICÇÃO** (o Draga, o escudo, a Resistência, a mineradora-arquétipo, os números de equilíbrio e **"no jogo o rio se cura em minutos: gesto de vitória, não ciência"**). **Sete línguas.**
3. **A conferência na fonte** (`fichas/fatos-mineracao-amazonia.md` § 0): **abri o estudo Munduruku (nota técnica ENSP/Fiocruz e WWF-Brasil, nov. 2020), a página do MapBiomas e a cronologia do MPF**. **A leitura corrigiu a ficha de 17/10:** o MapBiomas diz **632%**, não 625%; o estudo Munduruku é de **200 pessoas em três aldeias** de uma terra indígena (não "do povo"); **os números de mortes Yanomami misturavam recortes** ("570" e "495 (92%)" não são a mesma conta: 495 são 92% de 538 óbitos de menores de 5 anos) e **divergem entre as fontes: o jogo não cita nenhum**; os "131 barcos queimados" e as "300 balsas" do Madeira **não estão nas fontes primárias achadas** (o MapBiomas fala em mais de 151 balsas por imagem de satélite em 25/10/2021: ler a nota antes de usar). **A portaria da emergência Yanomami ficou 🟡+** (o título, o número e a data estão em fontes oficiais, mas o texto não abriu: 403): o jogo diz **só o que o título confirma**.
4. **A regra "fato tem fonte", com trava:** o teste exige que **cada endereço de fonte do jogo esteja registrado na ficha**, que todo fato tenha `https`, data e "o que isto não diz", que os números batam com o lido (632%, 57,9%, 200 pessoas, 6 µg/g) e que o **número de mortes Yanomami não apareça**.

**Provas:** 16 testes (o formato e as sete línguas, as fontes, os números, os tetos de tamanho, as linhas de "o que aconteceu" em vitória por dentro, vitória a tiro e derrota, a ligação do chip e o painel fora do JS de partida); **5 mutações à mão pegas** (por dentro/a tiro trocados, fonte sem https, fato sem "o que não diz", vitória/derrota trocadas, recomeço sem apagar o resumo). Visto no navegador de verdade, em português e em japonês: cabe sem rolagem em 1280×720 (`arte/relatorio-aconteceu-pt-claude.png`, `relatorio-mercurio-pt-claude.png`, `relatorio-mercurio-ja-claude.png`).

**Custo de CPU:** zero fora do clique. **JS de partida: 495,9 de 500 KB** (+0,25 KB: o chip e o resumo no `Game`).

**Onde o Comandante confere:** jogue a missão do rio até o fim (`…/jogar/?mapa=amazonia&modo=survival&marcha=0.95` perde em ~30 s sem ninguém para derrubá-lo; ou derrube os geradores e plante a carga) e abra **EXPLORAR HANGAR E MODOS**: o chip **RELATÓRIO ▸** pisca no canto de cima, ao lado de ARQUIVO.

**Falta (R13):** **os textos pedem a conferência de uma pessoa de fora** (a regra de `LADO_E_PEDAGOGIA.md` § 7.4), **inclusive as seis traduções, que são minhas**; **a portaria Yanomami** (abrir o texto), **a nota técnica do MapBiomas sobre o Madeira**, **Barcarena** (a cronologia está lida; falta o laudo) e **o factsheet dos 77% a menos de 500 m de um rio** não entraram; o relatório **não muda com o lado** (Aliança ou Consórcio): a parte do Consórcio vem com a campanha invertida; o chip mora no **console completo** (como o ARQUIVO): no menu compacto da primeira partida ele não aparece; **a cura de verdade do rio** segue só desenho.

**Próxima sessão começa com:** o que o Comandante julgar; depois a campanha do Consórcio (P179 camada 4), a dieta de JS e abrir os documentos que faltam.

## AMAZÔNIA, PARTE E: A INVASÃO — os andróides da Resistência plantam a carga no Draga — Claude, 18/10 (branch `claude/amazonia-invasao`, P180)

**O Comandante (17/10):** *"há uma enorme força de defesa deles e teremos que desmantelar, invadir com andróides e destruir por dentro"*; *"prossiga"*. As partes C, D1 e D2 deram o Draga, o escudo e a defesa; a E dá **o que o jogador faz depois que a defesa cai**.

**O que entrou (`AMAZONIA.md` § 5.5):**
1. **A Resistência:** **3 andróides aliados** (CAIPORA, IARA e CURUPIRA) nascem na aldeia junto do jogador e o acompanham. Caídos, renascem na aldeia em 4 s. (Antes a missão do rio não tinha aliado nenhum; sem drones; só offline.)
2. **A escotilha** (`sim/InvasaoDoDraga.ts`, regra pura): **quando o escudo cai** abre uma escotilha no **flanco do casco** (13 m do eixo, do lado sul quando ele olha para o oeste; acompanha o Draga). Os três andróides **vão até ela sozinhos** (ordem `hold`; chegam a pé, cruzando o campo) e **plantam a carga**: **cada andróide a menos de 8 m soma 1/30 por segundo** (um sozinho: 30 s; os três: ~10 s; a barra sobe com cada um, como a injeção dos cabos, ao contrário). Sem ninguém junto a carga recua devagar (45 s para zerar). **Cheia, detona: o Draga cai por dentro** (`CombatSystem.detonar`: seis bolas de fogo em volta do casco, o abate conta) e a missão acaba em vitória, pela regra de sempre.
3. **O canhão do Draga só mira Mechs:** andróide é pequeno demais para o radar de tiro dele. É o que deixa a Resistência chegar (a guarda e as torres **não** têm essa folga). **Os dois caminhos seguem abertos:** derrubar o tronco a tiro (como na C) ou plantar a carga por dentro (ou misturar).
4. **`BotController.plantador`:** a ordem `hold` vira para valer: o robô vai ao ponto e **fica nele** (sem orbitar o alvo nem recuar para esfriar). Sem isto os andróides orbitavam o Draga e ficavam a 12 m da escotilha.
5. **A tela:** a barra do chefe ganha `INVASÃO · CARGA 45% · 2 DE 3 DENTRO` (só com a escotilha aberta); o aviso `ESCOTILHA ABERTA · OS ANDRÓIDES ENTRAM` sobe uma vez; **no cenário**, um **anel verde** no chão junto ao casco, um **disco** que cresce com a carga e um **farol** que se vê de longe (`environment/AmazoniaEscotilha.ts`, no pedaço sob demanda). **Idioma:** 2 textos novos por língua nas seis línguas.
6. **O renascimento do rio:** com a Resistência entre os rastreados, o "ponto mais longe dos vivos" mandaria o jogador (e os andróides) para o outro lado do mapa ao morrer; **na missão do rio todo mundo renasce na aldeia** (o ponto dela é o único da lista).

**Provas:** 12 testes da regra (a escotilha fechada com escudo de pé, abrir uma vez, 30 s contra 10 s, o teto de 3, o recuo, a detonação única, a geometria do flanco), **10 da partida** (a Resistência existe e nasce nos pontos, a escotilha acompanha o Draga, **os andróides cruzam o campo a pé e chegam**, a carga cheia derruba o Draga: vitória e abate, o canhão ignora andróides e mira o Mech, o jogador renasce na aldeia, recomeçar fecha tudo), 3 do HUD e 2 de lugar (ninguém nasce no rio nem dentro de estrutura). **8 mutações à mão: 7 pegas** (escotilha sempre aberta, o canhão mirando andróide, sem plantador, sem detonação, recomeço sem reiniciar, respawn pelo ponto mais longe, abrir sem o escudo cair); **a que escapa é equivalente** (contar "qualquer aliado" em vez de "andróide": na missão só há andróides aliados). Captura: `.decepticons/arte/amazonia-escotilha-e1-claude.jpg` (a escotilha aberta com a carga a 45%; a bancada ganhou a vista `escotilha`).

**Custo de CPU:** por tick, um laço sobre ≤ 3 andróides e uma soma; a ordem `hold` só é reemitida quando a escotilha anda 6 m. **Medido: a missão inteira custa ~1,4 ms por tick** (guarda dormindo, Resistência andando: ~1,0 ms com a escotilha aberta). **JS de partida: 495,7 de 500 KB** (a E somou 2,4 KB: a regra, a fiação do `Match`, o HUD e o `detonar`; **folga de 4,3 KB: a próxima parte que mexer no pacote de partida tem de pagar com dieta**, por exemplo tirando a regra da missão do rio do pacote inicial).

**Onde o Comandante confere:** `…/jogar/?mapa=amazonia&modo=survival&marcha=0.5` (o Draga já no meio dos geradores): derrube os três geradores (a cerca em x -100, a planta em x 20, a cava em x 260): o aviso `ESCOTILHA ABERTA` sobe, o farol verde aparece no flanco sul do Draga e a Resistência (que estava com você na aldeia) corre até ele; com a carga em 100% o Draga explode por dentro. Ou ignore a Resistência e o derrube a tiro.

**Falta (R13):** **a cura de verdade do rio** (a limpeza no fim segue só desenho; o Relatório de Consequências e o Consórcio, P179 camadas 3 e 4, são a próxima etapa); **o equilíbrio** (13 m, 8 m, 30 s por andróide, 45 s de recuo, 3 andróides, 4 s de renascimento) é **proposta**, não validado com jogadores; **não joguei a invasão até o fim a olho** (o headless roda a ~0,25× do tempo): a captura é do cenário; **os andróides da guarda ainda atiram na Resistência no caminho** (e as torres só miram o jogador); a Resistência não tem voz nem rádio; **só offline**; sem som da detonação além do comum.

**Próxima sessão começa com:** o que o Comandante julgar; depois o Relatório de Consequências / Consórcio e uma **dieta de JS** (4,3 KB de folga).

## AMAZÔNIA, PARTE D2: AS TORRES ARMADAS E A FORÇA DE DEFESA — Claude, 18/10 (branch `claude/amazonia-guarda`, P180)

**O Comandante (17/10):** *"há uma enorme força de defesa deles e teremos que desmantelar"*; *"a amazônia já foi entregue em partes, prossiga"*. A D1 deu os geradores sozinhos; a D2 põe **quem os defende**.

**O que entrou (`AMAZONIA.md` § 5.4):**
1. **As oito torres de vigia da margem ficaram armadas** (`sim/TorresDeVigia.ts`, regra pura): cada uma, com um alvo a até **170 m** e a visada livre, solta uma **rajada de 4 tiros** (0,16 s entre eles) a cada **2,4 s**, com erro de mira sorteado de uma semente (determinístico) e começo escalonado (as oito não atiram juntas). O tiro é um projétil sem dono (dano 8, alcance 190): **fogo de cobertura que atravessa o rio**. **Calam quando o gerador da CERCA cai** (é ele que as alimenta): o jogador escolhe entre cruzar sob fogo e ir derrubá-la.
2. **A força de defesa** (`AMAZONIA_GUARDA`): **3 Mechs e 6 androides** em volta dos geradores, do lado norte do rio. **Seguram o posto** (não correm atrás do jogador nem para a aldeia) e **não renascem**: derrubado, fica derrubado. O Draga marcha sem a escolta de ninguém.
3. **Dormem** (`BotSystem`): sem alvo a **420 m** e sem dano, a guarda **não pensa nem anda** (zero CPU por tick); acorda com um alvo mais perto, ou com dano, e fica acordada **6 s** depois do último motivo. **O chefe nunca dorme** (a marcha dele é o relógio da missão).
4. **Nascem no chão** (`BotSystem.alturaDoChao`): o mapa de relevo não admite y = 0 (o robô nascia enterrado e os androides caíam do mundo: 9 ms por tick; agora **~3,2 ms**).
5. **A tela:** a barra do chefe ganhou a linha `TORRES DA MARGEM ARMADAS` / `TORRES DA MARGEM SEM ENERGIA` (muda de cor). **Idioma:** 2 textos novos por língua nas seis línguas; o teste de cobertura os cobre.
6. **Provas:** 7 testes da regra das torres e 8 da partida (a guarda existe e segura o posto, não renasce, a torre atira e acerta, cala sem a CERCA, não atira a 1.000 m, o Mech da guarda troca tiro, a guarda dorme e acorda); **3 mutações à mão pegas** (torres sempre ligadas, sem sono, sono que nunca acorda por perto). O teste "o Draga atira" do `Match.rio` passou a contar só os tiros do canhão dele (as torres também atiram em quem anda no leito).

**Custo de CPU:** por tick, as torres são um laço de 8 e **um raio só quando uma está pronta para atirar**; a guarda (9 robôs) dorme longe, e perto custa o que um bot custa; a missão inteira **~3,2 ms por tick**. **JS de partida: 493,3 de 500 KB** (a regra das torres, o sono e a fiação do `Match` somaram 1,6 KB; folga 6,7 KB): a E carrega sob demanda.

**Onde o Comandante confere:** `…/jogar/?mapa=amazonia&modo=survival`: ande até a margem sul do rio, de frente para o norte, para sentir o fogo das torres (a cerca em x -100, a planta em x 20, a cava em x 260); derrube a CERCA e as torres calam (a linha da barra do chefe vira `SEM ENERGIA`); os Mechs e androides só se mexem quando você chega a menos de 420 m. Para testar sem esperar: `&marcha=0.5`.

**Falta (R13):** **E:** a invasão com androides e a cura de verdade; **o equilíbrio** (dano 8, rajada de 4 a cada 2,4 s, 170 m, 3 Mechs e 6 androides) é **proposta**, não validado com jogadores; **não joguei a defesa até o fim a olho** (o headless roda a ~0,25× do tempo) e **não fotografei a guarda de perto**; **as torres não têm som, clarão de boca nem desenho de tiro próprios** (usam o projétil comum); o aviso do alto da tela **não** diz que a CERCA derrubou as torres (a linha da barra do chefe diz; o aviso do gerador que caiu ocupa o alto).

**Próxima sessão começa com:** a **E** (a invasão com androides e a cura do rio); depois o Relatório de Consequências e o Consórcio (P179 camadas 3 e 4).

## AS MÉTRICAS DOS PILOTOS: QUANTOS ENTRAM, QUANTO JOGAM, QUEM VOLTA — Claude, 18/10 (branch `claude/metricas-usuarios`, P185)

**A pergunta do Comandante (17/10):** *"tem como termos as métricas dos usuários, quantos entram, quantos minutos jogam, quantas mortes, etc? [...] depois implementarmos melhores práticas de marketing orientado pelas nossas informações de usuários?"*

**Resposta curta: sim, e agora o servidor mede.** Já existiam as contagens anônimas (visitas, cliques, partidas, país, pico). **O que entrou:**
1. **Por conta:** a tabela `atividade` (uma linha por conta por dia: abriu o jogo, rodadas, segundos, abates, mortes). Dela saem **DAU/WAU/MAU**, **quem de fato jogou**, **minutos por piloto**, contas novas por dia e a **retenção D1 e D7**. Alimentada pela rodada que o navegador manda **com a sessão** e por abrir o jogo com a sessão guardada.
2. **Para todos (com e sem conta):** rodadas, minutos, abates e mortes **por dia** e **por mapa e modo**, a **onda** em que a rodada parou e a **vitória ou derrota** das missões (o relatório de partida ganhou `map`, `wave` e `won`, opcionais).
3. **A tela do dono:** `/metricas/` ganhou **Pilotos com conta** e **O que se joga**; o `/metricas` traz o bloco `usuarios`. **Só contagens: nenhum e-mail nem número de conta.**
4. **A faxina:** o servidor passou a varrer sessões vencidas e atividade de mais de 400 dias ao subir e a cada 6 h (`limparExpiradas` existia e ninguém chamava).

**Provas:** testes de conta (cenário com dia de Brasília e virada às 03:00 UTC, retenção do dia exato, banco vazio, faxina), de agregação (tetos, reenvio, arquivo antigo), HTTP de ponta a ponta com o servidor de verdade (conta + rodada com sessão, reenvio, sessão inventada, preflight, visita) e do cliente (a sessão só vai ao servidor dono dela). **Mutação à mão: 32 de 32 pegas.** **E ponta a ponta no navegador** (o fio do `Game.ts`, sem teste de unidade): o jogo de verdade no Chrome, com a sessão de uma conta, na Amazônia (`marcha=0.95`) e na Praia (Sobrevivência) mandou ao servidor local `map`, `wave`, `won` e a sessão; o `/metricas` mostrou 1 piloto que jogou, 3 rodadas, 4 min, por mapa e dia (captura: `.decepticons/arte/metricas-pilotos-p185-claude.jpg`, com os números dessa prova).

**Custo de CPU:** zero no tick e no quadro do jogo. O cliente soma dois números por rodada (onda, desfecho); o servidor faz um `INSERT` pequeno por rodada de quem tem conta e um por abertura do jogo; a leitura (`metricasUsuarios`) só roda quando o dono abre o `/metricas`.

**ATENÇÃO (privacidade, R13):** a atividade por conta é **dado pessoal novo**. **O jogo ainda não tem política de privacidade, "apagar minha conta" nem "baixar meus dados"**, e o Google Analytics já está nas páginas. O inventário do que é guardado está em `PRIVACIDADE.md`; **antes de trazer jogadores o dono precisa decidir e publicar a política** (a proposta técnica de apagar/exportar está lá, construo quando ele mandar).

**Falta:** o chassi e o lado por conta; vitória em Bandeira e Domínio (precisa do time do jogador no online, P81); o que o marketing faz com os números (só vale com jogadores medidos).

**Onde o Comandante confere:** `cybermech.online/metricas/` (token em `.tmp/servidor/metricas-token.txt`, ou entrando com a conta de admin): seções **Pilotos com conta** e **O que se joga**. **Os números só começam a encher depois que o site e o servidor atualizarem** e pilotos com conta jogarem; antes disso as seções mostram zeros.

**Próxima sessão começa com:** o **time do jogador na sala online (P81)**: é o que falta para Bandeira 2v2 online, para os lados Aliados × Consórcio (P186) e para a vitória nesses modos.

## AMAZÔNIA, PARTE D1: O ESCUDO DO DRAGA E OS TRÊS GERADORES — Claude, 18/10 (branch `claude/amazonia-defesa`, P180)

**O Comandante (17/10):** *"a amazônia já foi entregue em partes, prossiga"* (a parte C estava pronta e testada num branch local sem PR: **publiquei como veio, #375**, e a produção já religou nela).

**O que entrou (§ 5.3 do `AMAZONIA.md`):**
1. **Os geradores** (`environment/AmazoniaGeradores.ts`): três torres de força (CERCA, PLANTA e CAVA) que se **quebram a tiro** (`Destructibles.addExterno`, o mesmo registro dos coqueiros): 1.500 de vida cada, destroços e faíscas ao cair, seis malhas de desenho. Carregam com a missão (sob demanda).
2. **O escudo** (`sim/EscudoDoDraga.ts`, pura): **com algum gerador de pé o Draga recebe 10% do dano**, por tiro, explosão ou dano por segundo (`DragaMech.escudo`); cai com o último e não volta (rodada nova os devolve).
3. **A tela:** a barra do chefe diz `ESCUDO · 3 DE 3 GERADORES` (e `ESCUDO CAIU`), a regra vira "derrube os geradores", e cada queda avisa.
4. **Idioma (o que a auditoria rigorosa achou):** a Amazônia da parte C **não tinha tradução** na barra do chefe, na aldeia, nos avisos da marcha e nos fins de missão; entraram **28 textos por língua**. **Duas correções no motor do tradutor** (`i18n.ts`): a composição aninhada passa a ter **duas voltas** ("MECH · Lançador EMP MK I") e uma chave sem " · " **não engole** um " · " na borda da lacuna ("ANDRÓIDE " + "· manso" saía meio traduzido).
5. **Provas:** o teste de regra (11 casos, mutações de ligação pegas), o de lugar (nenhum gerador no rio nem dentro de estrutura), o do HUD e o de cobertura de idioma; captura do cenário (`arte/amazonia-gerador-d1-claude.jpg`, `amazonia-geradores-d1-claude.jpg`; a bancada ganhou as vistas `gerador` e `geradores`).

**Custo de CPU:** zero por quadro (um número por tick na regra; o HUD só mexe no DOM quando a contagem muda); seis desenhos e três sensores. **JS de partida: 491,7 de 500 KB.**

**Onde o Comandante confere:** `…/jogar/?mapa=amazonia&modo=survival` (a missão do rio): a barra do chefe diz `ESCUDO · 3 DE 3 GERADORES`; atire no Draga e veja o dano quase não andar; corra para leste pela margem (a cerca em x -100, a planta em x 20, a cava em x 260) e derrube as três torres de força. Para testar sem esperar: `&marcha=0.5`.

**Falta (R13):** **D2:** as torres da margem armadas e a **força de defesa** (Mechs e androides); **E:** a invasão com androides e a cura de verdade; **o equilíbrio** (10%, 1.500) é proposta; **não joguei a missão até o fim a olho** (o headless roda a ~0,25× do tempo): a captura é do cenário; os fatos da ficha da mineração seguem 🟡.

**Próxima sessão começa com:** o que o Comandante julgar; depois a **D2** (as torres e a força de defesa).

## O ONLINE VOLTA SOZINHO QUANDO CAI, E O QUE FALTA PARA LANÇAR — Claude, 18/10 (branch `claude/reconexao-online`, P184 b)

**O Comandante (17/10 à noite):** *"consegui conectar 2 pcs diferentes na mesma sala da arena! deu certo!"* (a correção da porteira, P184); e pediu **as métricas dos usuários** (P185), **a ideia dos lados Aliados × Consórcio** (P186) e que **o online funcione por inteiro antes de tudo**.

**O que entrou (`client/src/net/OnlineSession.ts`, `NetClient.ts`):** **reconexão automática (G13)**: quando a conexão cai (a VPN trocou, o túnel soluçou, o servidor travou ou reiniciou, a porteira cortou), a sessão limpa a sala velha, avisa **"ONLINE · CONEXÃO CAIU · RECONECTANDO (n/6)"** no canto (o mundo segue; nada cobre a tela) e tenta de novo com esperas de **0,3, 0,7, 1,5, 3, 5 e 5 s** (~15 s); volta à sala como piloto novo (a previsão reposiciona o Mech). **Recusa** (versão, sala cheia, montagem) **não reconecta**; seis falhas seguidas viram "caiu: recarregue". **Achado de caminho:** o `NetClient` só avisava o fim da conexão no `close`, e uma conexão recusada só dá `error` em alguns ambientes (o Node dos testes): agora avisa **uma vez**, venha o que vier. **Testes:** o servidor de verdade cai e volta no mesmo endereço (a sessão reconecta e vê os robôs), duas quedas seguidas, esgotar as tentativas, recusa sem reconexão, encerrar cancela, e o aviso único do `NetClient`; **mutação à mão: 10 de 10**.

**O que falta para o online ser lançado (a lista honesta, do `ROADMAP.md` e do `STATUS_REAL.md`):**
1. ✅ **Dois PCs, VPNs diferentes, mesma sala** (provado pelo Comandante, 17/10) e ✅ **reconexão automática** (esta entrega).
2. **Times na sala online (P81)**: dois amigos no mesmo time; é o contrato de que o CTF 2v2 online e os **lados Aliados × Consórcio** (P186, `LADO_E_PEDAGOGIA.md` § 3.5) dependem. **É o próximo passo técnico.**
3. **Métricas dos usuários (P185):** retenção, usuários únicos e tempo por conta (a primeira fatia entra a seguir).
4. **Jogador remoto desenhado com o chassi da montagem dele** (hoje todo humano aparece como Vector-09 para os outros).
5. **Homologar online com rede real e carga** (capacidade, latência e perda, duração prolongada) antes de prometer escala; **o PC do servidor é o de trabalho e tem 6 GB**: para o lançamento o servidor precisa de **máquina própria** (decisão e custo dele; ver `DEPLOY.md`).
6. **Ranking e a política de privacidade (LGPD)** antes de trazer público.
7. Já em dia: login, contas, cópia de segurança do banco, mural, porteira tolerante a picos.

**Onde o Comandante confere:** derrube a conexão de propósito (trocando a VPN, ou desligando e ligando a rede por alguns segundos) com a partida aberta: o canto mostra **RECONECTANDO (1/6)…** e o jogo **volta à sala sozinho**; recarregar a página só é preciso depois de seis falhas.

**Falta (R13):** **não testei com a VPN dele** (só com o servidor de verdade nos testes); o placar da sessão **zera** na volta (o servidor trata como piloto novo); o jogador volta **no ponto de nascimento** da sala; a partida em andamento no servidor (a rodada) segue sem ele durante a queda.

## AMAZÔNIA, PARTE C: O DRAGA-01 COM CORPO — a missão do rio é jogável — Claude, 17/10 (branch `claude/amazonia-draga`, P180)

**A ordem do Comandante (17/10):** *"há uma enorme força de defesa deles e teremos que desmantelar, invadir com androides e destruir por dentro"*; *"continua iterando até concluir essas pendências"*. A parte C é **o Draga-01 de verdade na partida**: com corpo, dano, marcha e a missão que ele cria.

**O que entrou (`AMAZONIA.md` § 5.2 tem os números):**
1. **O corpo** (`entities/DragaMech.ts`, `dragaStats.ts`): um `MechBase` como o Colossus (36 m por 10 m de cápsula, canhão de cerco no convés), com um rig vazio de bípede e o desenho de quatro pernas (`WalkerVisual`) por cima. **Os dois módulos de perna são os dois lados**; a perna da frente cai primeiro; um lado caído o deixa a 50%, os dois a 30% (rasteja).
2. **A marcha e o cérebro** (`sim/DragaMarcha.ts`, `combat/DragaController.ts`): ele anda os 1.550 m do leito até a aldeia em ~10 minutos, vira devagar (14°/s), e atira em quem estiver a 320 m com a visada livre; tudo determinístico.
3. **A missão** (`sim/MissaoDoRio.ts`, `Match.rio`): **`?mapa=amazonia&modo=survival`** (o seletor de mapas já leva a ela). Derrubar o Draga vence; ele chegar à linha da aldeia perde; **o jogador morrer não perde**. Sem ondas, rebeldes nem quadro de luz: o Draga é o único inimigo. **`&marcha=0.8`** começa com o Draga 80% do caminho andado (para testar o fim).
4. **A tela:** a barra do chefe com o nome, a fase e os dois lados; a célula **ALDEIA · DRAGA A n m · n MIN** com a barra da marcha; os avisos a 1.000, 500, 250 e 100 m; o fim ("O RIO VIVE" / "A ALDEIA CAIU"); e o rio se limpando para a foz depois da vitória (só desenho).
5. **Carregado sob demanda:** o corpo, o cérebro e o `.glb` só baixam para quem abre a missão (`ChefeCarregado`).
6. **A ficha de fatos** (`fichas/fatos-mineracao-amazonia.md`): o que o jogo pode afirmar como fato sobre o garimpo e a mineração (o mercúrio no peixe, a emergência Yanomami, o garimpo nas terras indígenas, as dragas do Madeira, os rejeitos de Barcarena), cada um com a frase que o jogo pode dizer e a que **não** pode, as fontes e o que é sátira. **Tudo 🟡: só o resumo de uma busca; ler as fontes primárias antes de virar texto.** Nenhum fato entrou no jogo ainda; a expulsão dos povos **não foi levantada**.

**Provas:** testes do corpo no chão de verdade (anda os 1.550 m em ~10 minutos, segue o rio, perna caída = metade da velocidade, canhão com erro de mira determinístico, visada, alcance), da missão, da partida inteira (derrota, vitória, recomeço, o jogador morrendo, o placar) e do HUD. **Mutação à mão: 59 de 60 pegas** (a que escapa é equivalente). **Visto no jogo de verdade** (Chrome sem GPU, `arte/amazonia-missao-draga-c1-claude.jpg` e `amazonia-missao-fim-c1-claude.jpg`): a barra do Draga, a célula da aldeia, os avisos, as pernas amarelas do Draga entre as árvores perto da aldeia, e a derrota quando ele cruza a linha.

**Custo de CPU:** por tick, o Draga é um `MechBase` a mais (um character controller) e o cérebro faz uma conta de rumo e um laço sobre os alvos (≤ 8); quando atira, um raio. **O JS de partida está em 490,7 / 500 KB** (a parte C pagou ~2 KB de HUD, fases e a fiação do `Match`; a dieta de JS da `main`, P-dieta, tinha devolvido a folga: antes de somar, 499,2): **o que a parte D e a E trouxerem só da missão deve carregar sob demanda** (a folga é de 9,3 KB).

**Onde o Comandante confere:** **`cybermech.online/jogar/?mapa=amazonia&modo=survival`** (o seletor de mapas, AMAZÔNIA · RIO VIVO, leva direto): você nasce na aldeia e o Draga está a 1.650 m, marchando para lá. Para ver o fim rápido: **`&marcha=0.9`** (ele chega à aldeia em ~2 minutos: derrube-o antes ou veja a derrota).

**Falta (R13):** **ainda não é a fase inteira**: sem **escudo, geradores, torres, força de defesa** (parte D) e sem **invasão com androides nem cura de verdade** (parte E). Os números de equilíbrio (tronco 4.800, pernas 1.600, o canhão de cerco que mata um Vector-09 em um tiro certeiro) são **de partida, não validados com jogadores**. O Draga **não tem som de passo nem de tiro próprios, nem explosão ao cair** (ele some como os outros Mechs). **A floresta densa esconde o Draga do chão** (só se vê acima das copas, no rio e nas clareiras). **Não medido em GPU de verdade.** **A imagem da serpente não chegou.**

**Próxima sessão começa com:** a **parte D** (os geradores do escudo, as torres da margem, a força de defesa e o ato 1), **carregada sob demanda** (a folga de JS é de 9,3 KB).

## A PRODUÇÃO ESTAVA 2,5 H NO CÓDIGO VELHO: A VERIFICAÇÃO DO ATUALIZADOR REPROVAVA NO ESCURO — Claude, 17/10 (branch `claude/atualizador-log`)

**O que achei (e provei de ponta a ponta):** depois dos merges #371 e #372, o servidor de produção **não atualizou**: o `atualizacao.log` mostrava seis `FALHOU (testes de server/ e shared/)`. Os mesmos testes passavam na minha worktree. Fiquei quieto e a rodada seguinte **verificou em 40 s e religou no código novo** (protocolo 20); a primeira cópia do banco de contas apareceu em `D:\DECEPTICONS\.tmp\servidor\backups\contas-2026-10-18.db` (abre e traz a conta). **Causa:** o meu barulho (check do push, navegador, auditorias) e duas rodadas se atropelando em `.tmp/vitest`, não código quebrado.

**Feito:** o atualizador deixava a saída do teste que falhou se perder (`stdio: 'inherit'`). Agora grava as **últimas 40 linhas** no `atualizacao.log` quando um comando falha (`ultimasLinhas` em `scripts/atualizador.mjs`, 3 testes). O servidor só passa a usar isto depois da próxima atualização que ele verificar. `DEPLOY.md` ganhou a seção do episódio e a regra de operação: **depois de cada merge, ficar quieto** (sem check, sem suíte, sem navegador) até o log mostrar `servidor religou no código novo`.

**Custo de CPU:** zero.

**Falta (R13):** o atualizador **pode** reprovar de novo sob carga: a verificação roda os testes da máquina inteira numa máquina compartilhada. Uma saída mais robusta (repetir a verificação uma vez antes de desistir, ou rodar só em janela de silêncio) é decisão de quem opera a máquina; deixei só a **visibilidade**, que é o que faltava para decidir.

**Próxima sessão começa com:** o que o Comandante julgar. **A Amazônia (P180) está com outra sessão: não mexer.**

## O ONLINE CAÍA PARA QUEM JOGA POR VPN: A PORTEIRA DESCARTA O PICO EM VEZ DE CORTAR — Claude, 17/10 (branch `claude/guard-rajada`, P184)

**O relato do Comandante (17/10):** *"não tô conseguindo jogar online, dá erro e cai a conexão... não consigo jogar CONTRA meu outro PC usando VPNs diferentes"*.

**O que o `servidor.log` mostra:** quatro cortes **"taxa alta demais"**, dois deles dos IPs **212.8.252.70** e **185.177.124.221** (as duas VPNs do teste), com o servidor saudável no momento do corte; e o tempo médio do tick com picos de **298 e 1.093 ms** (uma média móvel: são travadas de segundos). **O PC do servidor é o mesmo em que se trabalha** e tem 6 GB com ~400 MB livres (o processo do servidor estava com 11 MB na memória, paginado): quando o laço do Node congela, as mensagens de todos chegam juntas na volta, e a porteira cortava **no primeiro excesso**. Quem jogava pela VPN (mais jitter) era o primeiro a cair.

**Corrigido (`server/guard.ts`):** o excesso de mensagens passa a ser **descartado** (nada é decodificado: custo de uma conta) e a conexão segue; só o **abuso de verdade** corta (o descarte acumulado passa de 600, caindo 60 por segundo: uma inundação cai em instantes, uma travada de segundos não). A folga subiu de 30 para 120 mensagens. O log passa a dizer `descarte de <ip>: pico de mensagens (a conexão segue)`. **Testes:** o balde (veredito ok/descarte/corte, o pico que passa, a inundação cortada, o excesso sustentado cortado e o leve nunca), o servidor de verdade (um pico de 45 mensagens não derruba; 80 derrubam); **mutação à mão: 7 de 7**.

**O que o código não resolve (e o que fazer):**
1. **O túnel da Cloudflare cai quando a VPN do PC do servidor muda** (o `jogo.cybermech.online` devolveu **502** por um tempo hoje: o túnel estava fora): não troque a VPN do PC do servidor com gente jogando; se o jogador é este mesmo PC, prefira outro PC como cliente.
2. **Memória do PC do servidor:** com menos de 1 GB livre o servidor trava por segundos. Feche o IDE e os navegadores enquanto joga, e **peça-me para não rodar teste nem build pesado enquanto você joga** (os meus testes e o `npm run check` do push usam todo o processador e a memória).
3. **Testar dois PCs sem VPN:** pela rede de casa (`HOST=0.0.0.0`, `ws://IP-DESTE-PC:2567`; ver `DEPLOY.md`).

**Onde o Comandante confere:** depois do merge o atualizador reinicia o servidor (~1 minuto fora): jogue de dois PCs na mesma sala (`?sala=ARENA`); se algum pico passar, o `servidor.log` mostra `descarte de ...` e **ninguém cai**.

**Falta (R13):** **não provei com a VPN dele** (só com o teste do servidor de verdade e a leitura do log): se ainda cair, o próximo passo é gravar no log o motivo do fechamento de cada conexão (código e quem fechou). Não mexi no túnel nem na prioridade do processo do servidor (o Windows negou: ele roda como serviço).

## IDIOMA, SEGUNDA RODADA: OS MODOS DE JOGO (A PRAIA, A BANDEIRA, O DOMÍNIO) — Claude, 17/10 (branch `claude/idioma-modos`, P173)

**Por que:** a auditoria do Hangar deixou claro que o teste de cobertura não via o que o jogo monta na tela. Auditei **no navegador, em japonês, cada modo** (sobrevivência, bandeira, domínio e a praia, **nunca a Amazônia: está com outra sessão**). Os três primeiros já estavam limpos; **a missão da praia (Cabos Abertos) tinha ~15 textos na tela e dezenas nos avisos**.

**Feito:** **74 textos novos nas seis línguas** (811 por língua): o HUD da praia (porto, ponte, estação, rede, cabos, portas, quadro de luz, a água), os avisos (cabo tomado, cortado, liberado, porta arrombada, cidade no escuro…), o briefing da missão, o chefe (fase, pernas, as três falas), a bandeira (`// PILOTO …`, `// RETORNADA À BASE`), o domínio, as conquistas, o briefing e o terminal do Banco Vorcaris, o "arraste os botões" do toque e o respawn. **Prova no navegador:** a auditoria em japonês de praia e sobrevivência só devolve nomes próprios (`arte/idioma-praia-ja-claude.png`). O teste de cobertura ganhou os 70 casos. **De passagem:** o arpão em japonês tinha dois termos (ハープーン e アンカー銃); ficou ハープーン nos dois.

**Sobre o arpão nos chassis pesados (P181), a conclusão depois de ler o código:** todos os médios têm o mesmo "peso" (raio 1,3), então o Marauder puxa qualquer médio e mais leve (regra "do seu peso ou mais leve"); **só o Onça (1,6) e os titãs (3,6 e 5) são mais pesados, e não têm encaixe de ombro** (o encaixe do Marauder é medido no desenho importado, `shoulderPods`). Dar ombros ao Onça exige encaixe procedural e o desenho do lançador: **é trabalho visual que precisa do olho do Comandante**; fica como decisão dele (abaixo).

**Custo de CPU:** zero.

**Falta (R13):** (a) revisão nativa das traduções; (b) o texto do rádio e do briefing das missões por onda e a tela final de cada modo (só aparecem jogando até o fim); (c) **decisão do Comandante:** ombros no Onça para ele ser o melhor usuário do arpão (trabalho visual), ou deixar o arpão para o Marauder.

**Próxima sessão começa com:** o que o Comandante julgar. **A Amazônia (P180) está com outra sessão: não mexer.**

## ONDE FICAM OS LOGINS, E A CÓPIA DE SEGURANÇA QUE NÃO EXISTIA — Claude, 17/10 (branch `claude/contas-onde`, P183)

**O Comandante (17/10):** *"onde os logins serão salvos se não temos supabase? como está isso? onde estão os arquivos pra eu conferir?"*.

**Resposta (o que existe de verdade):** os logins ficam em **`D:\DECEPTICONS\.tmp\servidor\contas.db`**, um arquivo SQLite no PC do servidor (`node:sqlite`, sem serviço de nuvem, decisão dele de 28/09). Guarda e-mail, o **hash `scrypt`** da senha, o **hash** do token de cada sessão e o progresso (nível, XP, créditos, apelido). O código que lê e escreve é o `server/contas.ts` (o único com SQL); as rotas, `server/Server.ts`; o contrato, `shared/net/auth.ts`. **Hoje há 1 conta** (de teste, criada às 13:12). Está tudo descrito em `DEPLOY.md` (§ "Contas: onde estão, o que guardam e como restaurar").

**Achado (R17): não existia cópia de segurança.** Um arquivo corrompido ou apagado por engano levava as contas de todos os pilotos.

**Feito:**
1. **`server/backupContas.ts`:** uma cópia **consistente** (`VACUUM INTO`, não pega o banco no meio de uma escrita) por dia em `.tmp\servidor\backups\contas-AAAA-MM-DD.db`, as **últimas 14**; o `Server` a faz ao subir e a cada 6 h (a do dia é substituída pela mais nova). Falha na cópia só registra no log: o jogo não cai.
2. **Testes (7) e 2 mutações pegas:** o nome é do dia (UTC); a retenção apaga só as mais velhas e **ignora arquivo que não é cópia**; a cópia é um banco de verdade (abre, autentica a senha, traz o progresso); a segunda rodada do dia a substitui; o servidor copia ao subir.
3. **`DEPLOY.md`:** a tabela de onde está cada coisa, o que o banco guarda, como **restaurar** e como contar as contas sem expor e-mail. Também corrigi o texto velho ("ainda não tem tela"): a tela e a sincronização do progresso estão no ar desde 17/10.

**Custo de CPU:** uma cópia de um arquivo de ~40 KB a cada 6 h.

**Falta (decisão do Comandante, R13):** a cópia fica **no mesmo disco do PC** (a regra G15 impede o projeto de gravar fora da pasta dele): protege de arquivo corrompido ou apagado, **não** de o disco morrer. Levar `backups\` de vez em quando para um pen drive ou para a nuvem pessoal dele é um `Copy-Item` de arquivos pequenos. **O banco guarda e-mails** (dado pessoal, LGPD): vale uma política de privacidade na página quando o cadastro abrir ao público. O servidor de produção só passa a copiar depois de reiniciar com este código (o atualizador reinicia sozinho no merge).

**Próxima sessão começa com:** o que o Comandante julgar; depois o Relatório de Consequências e os ombros dos chassis pesados (P181). **A Amazônia (P180) está com outra sessão: não mexer.**

## DIETA DE JS: OS PAINÉIS OPCIONAIS DO CONSOLE SAEM DO DOWNLOAD DE PARTIDA — Claude, 17/10 (branch `claude/dieta-js`, R7)

**O problema:** o JS de partida (o que todo jogador baixa para abrir o jogo) estava em **499,7 / 500 KB**: qualquer módulo novo, de qualquer agente, travaria o `npm run check` de todo mundo. Em uma semana eu tinha estourado o teto três vezes (o `‹ valor ›`, o Arquivo, o idioma).

**Feito:**
1. **Cinco painéis viram pedaços sob demanda** (`import()` no primeiro clique, `core/sobDemanda.ts`): **Esquadrão** (6,8 KB gzip), **Campanhas** (3,6), **Arsenal** (3,8), **Servidor** (6,2) e **Câmeras** (2,8). O `Game` não os importa mais de forma estática; o clique baixa o pedaço, cria o painel e abre (sem rede, avisa no console e o próximo clique tenta de novo).
2. **JS de partida: 499,7 → 486,2 KB** (folga de **13,8 KB**). Os pedaços sob demanda ficam abaixo de 7 KB cada (teto: 150 KB).
3. **Prova no navegador de verdade** (build de produção servido): antes do clique **nenhum** desses cinco pedaços é pedido; depois do clique cada um baixa e o painel abre; zero erros. Testes (`sobDemanda.test.ts`): a fábrica cria uma vez, o erro não fica guardado, um painel que falha não derruba o jogo, e o `Game` não importa mais os cinco de forma estática.

**Custo de CPU:** menos que antes (o download e a análise do JS dos painéis só acontecem para quem os abre).

**Regra para todos os agentes** (agora no `PROTOCOLO_UNIVERSAL.md`, R7): **tela ou painel opcional entra por `import()` no clique; texto estático longo vai para JSON em `public/`.** O próximo candidato, se a folga acabar: o `HangarMenu` (28 KB minificados) e o `HangarScene` (16 KB), que hoje o `Game` aquece no boot (pré-compilação de shaders): tirá-los do boot é uma decisão de experiência (o primeiro "H" passaria a esperar o pedaço), não só de bundle.

**Próxima sessão começa com:** o que o Comandante julgar; depois o Relatório de Consequências, a Amazônia (P180) e os ombros dos chassis pesados (P181).

## AMAZÔNIA, PARTE B: O RIO E O MAPA — o cenário de 2,4 km com o rio como termômetro — Claude, 17/10 (branch `claude/amazonia-mapa`, P180)

**A ordem do Comandante (17/10):** *"vamos já planejar e construir a próxima fase: o rio Amazonas, uma mineradora acabando com o rio… o cenário precisa ser bem maior… manter a eficiência e a contenção de consumo"* e *"acima desse super mech o rio é limpo e vivo, e depois dessa máquina o rio fica poluído, sujo, com óleo e envenenado"*; depois, *"continua iterando até concluir essas pendências"*.

**O que entrou (parte B do `AMAZONIA.md`, § 5.1 tem os números):**
1. **O mapa `amazonia`** (`client/src/environment/Amazonia*.ts`): 2.400 × 900 m, **o terreno numa função só** lida pela malha e pelo colisor (24 pedaços de 300 m, um colisor de altura), **6.594 árvores instanciadas** com dois níveis de detalhe, as estruturas (a aldeia, a planta, a margem fortificada com 8 torres, as máquinas da cava, a lagoa de rejeitos) fundidas numa malha, a água num shader só. **Carregado sob demanda** (`mapasSobDemanda.ts`): quem joga a Cidade Neon não baixa nada dele.
2. **O rio é o termômetro:** a **frente** (`AmazoniaRio.ts`) é um número; a montante o rio é limpo (verde-azulado, espuma branca, a floresta viva), a jusante é morto (água preta com óleo iridescente, a copa seca, o chão queimado). **O Draga-01 desce o leito rio acima a 2,6 m/s, a frente anda com ele** e ele para a 240 m da aldeia depois de uns 9 minutos. **É DEMO** (só desenho, sem corpo).
3. **Ligado ao jogo:** `?mapa=amazonia&modo=deathmatch`, o link do seletor de mapas (AMAZÔNIA · RIO VIVO), a missão **RIO VIVO** no mapa-múndi do console (o lugar é proposta, no Pará), a campanha (etapa na Amazônia), os nascimentos (o jogador na aldeia, os outros ao longo da margem sul), o radar e o minimapa com a planta e os marcos. Só offline e só Deathmatch.
4. **Achados no caminho (R17, consertados):** (a) `UniformsUtils.merge` **copia o valor** do uniforme, então a água e a lagoa nunca leriam a frente nem o tempo (o teste de uniformes compartilhados pegou); (b) **a chave da campanha não lia os mapas Praia e Amazônia e o link da etapa só levava `mapa=` para o Bunker**: uma etapa na Praia abria a Cidade Neon (já existia; consertado, com teste); (c) **o céu saía preto no jogo** (a câmera do jogo vai a 800 m e o domo tinha 2.200 m; a bancada tinha a câmera dela e não via): agora o mapa traz o `alcanceDaCamera` (1.500 m) e a bancada usa o mesmo.
5. **A bancada** (`medicoes/amazonia.mjs`: fotos de 9 vistas e contagem; `medicoes/amazonia-jogo.mjs`: o jogo real, com a câmera dele) e as capturas em `arte/amazonia-*-b1-claude.jpg`.

**Provas:** **2.892 testes em 279 arquivos** passam (os do mapa: terreno, rio, floresta, estruturas, mapa montado com o orçamento, registro sob demanda, a partida na Amazônia com o Mech andando no relevo, radar, minimapa, campanha, nascimentos, link). **Mutação à mão: 69 de 71 pegas**; as 2 que escapam são equivalentes (a guarda de declive da floresta repete o que a fórmula de densidade já faz; a guarda do nascimento repete a da aldeia). **Medido na bancada** (SwiftShader, sem GPU): **29 a 55 desenhos** (teto 70), **102 a 227 mil triângulos** (teto 250 mil), 58 colisores (teto 400). JS de partida **497,2 / 500 KB** (o mapa tem 7 KB sob demanda; o `ServerPanel` também passou a ser sob demanda).

**Custo de CPU:** por quadro, o `update` escreve um número (o tempo), o `observar` percorre 24 pedaços (um `hypot` cada, sem alocar) e leva o céu junto; o Draga é um desenho com 18 ossos; a simulação não ganhou nada (o mapa é só terreno e paredes). Nenhum `new` por quadro.

**Onde o Comandante confere:** **`cybermech.online/jogar/?mapa=amazonia&modo=deathmatch`** (ou o seletor de mapas, AMAZÔNIA · RIO VIVO): você nasce na aldeia, na margem sul do rio, no meio da floresta. **Ande para leste pela margem** (os pontos de nascimento ficam a cada 170 m) até a frente do veneno: a água fica preta e a floresta seca. Sem jogar: `node .decepticons/medicoes/amazonia.mjs --vistas draga,jusante` e as fotos em `.decepticons/arte/amazonia-draga-b1-claude.jpg` (o rio limpo, o Draga no meio da curva e o morto atrás).

**Falta (R13):** **não é fase, é mapa de Deathmatch**: sem missão, defesa, geradores do escudo, invasão com androides nem cura do rio (partes C a E). **O Draga é DEMO** (sem corpo: não ataca, não leva tiro, não bloqueia). **O orçamento é de contagem** (SwiftShader), **falta medir quadros por segundo numa GPU de verdade** (G12). O chão de cima mostra um desenho de espinha de peixe; sem som ambiente, pássaros nem partículas; a floresta troca a árvore pelo bloco a 260 m (pode estalar). **A imagem da serpente não chegou** (reenviar ou largar em `D:\imagens cybermech\` e dizer o nome). **Uma pasta de resto na raiz do disco** (`C:\.tmp`, de um erro meu do script do Blender, já corrigido) **precisa ser apagada por você** (minha ferramenta não deixa eu apagar fora do projeto). **Uma trava mudou (a do JS por fase, da parte A):** continua valendo o veto do Comandante.

**Próxima sessão começa com:** a **parte C** (o Draga como chefe com corpo na simulação: as quatro pernas como módulos de dano, o rastejo, a barra do chefe e a derrota na aldeia), e o `fichas/fatos-mineracao-amazonia.md` (as fontes dos fatos antes de qualquer texto de missão).

## IDIOMA: O HANGAR, O ESQUADRÃO, AS CAMPANHAS E O HUD DEIXAM DE FALAR PORTUGUÊS — Claude, 17/10 (branch `claude/idioma-telas`, P173)

**O Comandante (17/10):** *"idioma tem que ficar logo no início […] pra pessoa já selecionar o idioma nativo dele"*. Escolhida a língua, as telas avançadas ainda caíam no português: **auditoria no navegador de verdade, em japonês** (`.tmp/auditar-idioma.mjs`, que abre cada tela e lista o texto sem tradução) achou ~250 textos no Hangar, no Esquadrão, nas Campanhas e no HUD.

**Feito:**
1. **232 textos novos em cada uma das seis línguas** (737 por língua): o Hangar inteiro (rótulos, unidades, chassis, módulos, as quatro chapas, os papéis de cada chassi), o Esquadrão, as Campanhas e o HUD da partida (a vista 1ª/3ª pessoa/tática, as ordens aos aliados, o contato).
2. **As dicas das 22 armas do Hangar** (`public/dicas-do-hangar.json`) com tradução: o encaixe agora traduz **cada pedaço** da frase (a dica, o aviso dos ombros, o das costas, o do tamanho 3, a regra da chapa) antes de juntar, porque a frase muda caso a caso e não tem uma chave só.
3. **Composição genérica `{0} · {1}` e `{0} · {1} · {2}`**: o jogo escreve muito texto como "MÉDIO · ASSALTO · Equilíbrio entre alcance e mobilidade." ou "PADRÃO · 3,0 t"; as chaves de composição traduzem **cada parte pelo que o dicionário já sabe** (as descrições dos chassis já estavam traduzidas e não apareciam por estarem coladas). **Duas regras novas no motor (`i18n.ts`):** (a) entre dois padrões que servem ao mesmo texto, vence o de **mais texto fixo** (antes contava o tamanho do regex, que conta cada lacuna); (b) uma chave **sem " · "** não engole uma composição (`ESCALA {0}` não pega "ESCALA 3 · CERCO · …").
4. **Teste de cobertura que exige que nada em português sobre** (`i18n.test.ts`: só nomes próprios e unidades): as dicas, ~18 textos compostos do Hangar, o HUD, o Esquadrão e as Campanhas. **Prova no navegador de verdade:** a auditoria em japonês caiu de ~250 textos para os nomes próprios, as telas do dono e os rótulos de acessibilidade do mapa; capturas `arte/idioma-hangar-*-claude.png`.

**Custo de CPU:** zero (a tradução é por mapa em memória, com cache; o JS cresce o `traduzir` do Hangar, dentro do orçamento).

**Falta (R13):** (a) **revisão por falante nativo** (as traduções são minhas, como as da landing e do Arquivo); (b) as **telas do dono** (Arsenal, Estúdio, Servidor, Painel Admin) e os rótulos de acessibilidade do mapa seguem em português de propósito; (c) o **texto de rádio e de briefing das missões** não foi auditado (só abre jogando a missão); (d) a **voz do narrador** segue em português.

**Próxima sessão começa com:** o que o Comandante julgar; depois o Relatório de Consequências, a Amazônia (P180) e os ombros dos chassis pesados (P181).

## O ARQUIVO: SEIS FICHAS QUE ENSINAM, NAS SETE LÍNGUAS — Claude, 17/10 (branch `claude/arquivo`, P179 camada 2)

**O Comandante (17/10):** *"devemos explicar o que são [o nazifascismo] e como se manifestam, a rede de mentiras, os interesses obtusos por trás das elites, a manutenção do medo […] pelo menos SUTILMENTE E ELEGANTEMENTE, pedagogicamente"*. A camada 1 (o seletor de lado) já estava no ar; esta é a camada 2 do `LADO_E_PEDAGOGIA.md`.

**Feito:**
1. **O Arquivo** (`ui/ArquivoPanel.ts`): o chip **ARQUIVO ▸** (console completo e pausa, ao lado do selo do lado) abre a placa com a lista das **seis fichas** à esquerda (a marcada em barra dourada com chevron) e a ficha à direita: **o que é, como aparece, como se defender e as fontes**. Setas do teclado (circular), Esc fecha, Enter não vira "jogar", sem rolagem em 1280×720. A ficha 6, **as incoerências**, é **sátira declarada** e a tela avisa ("SÁTIRA DECLARADA · NÃO AFIRMA FATO"). **Opcional, nunca uma porta** (P133): não aparece sozinho.
2. **Sete línguas, em arquivos:** `client/public/arquivo/<língua>.json` (pt, en, es, fr, ja, zh, ru); língua sem arquivo cai no inglês e depois no português. **Fora do pacote de JS:** o conteúdo é JSON e o **painel é um pedaço sob demanda** (`import()` no clique do chip, 1,65 KB gzip), por causa do orçamento de partida (499,6 / 500 KB).
3. **Testes (`ArquivoPanel.test.ts`, 10):** o JSON quebrado não passa; seis fichas na mesma ordem e com o mesmo número de sinais em todas as línguas; só as incoerências são sátira; toda ficha tem fonte; teto de tamanho (cabe sem rolagem); **nenhum nome de político ou bilionário vivo em nenhuma língua**; a ligação (chip, `import()`, tecla). **Prova no navegador de verdade** (`arte/arquivo-*-claude.png`): abre, setas, circular, Esc, japonês carrega o arquivo dele, só o `pt.json` é pedido antes.
4. **De passagem (R17):** `algoPorCima` agora inclui o `.lado-modal` (o seletor de lado e o Arquivo): as teclas do console não valem com eles por cima.

**Custo de CPU:** zero fora do clique (um `fetch` de 3,5 KB na primeira abertura de cada língua e o pedaço de 1,65 KB).

**O que o Comandante precisa saber (R13):** (a) **as fontes estão citadas de memória** (Eco 1995, Paxton 2004, Stanley 2018, Arendt 1951, RAND 2016, Cohen 1972, Herman e Chomsky 1988): **um revisor humano confere título, ano e trecho antes de a tela ir ao ar**; (b) **nenhum caso real nem número** entra sem fonte que o Comandante dê; (c) as traduções (es, fr, ja, zh, ru) são minhas e **pedem falante nativo**; (d) o **orçamento de JS de partida está em 499,6 / 500 KB**: texto longo vai para JSON em `public/`, recurso opcional vira `import()`; quem estourar o teto trava o `npm run check` de todos.

**Falta:** o **Relatório de Consequências** (fim da missão com números lidos de ficha) e a **campanha do Consórcio** (P179 camadas 3 e 4); o Arquivo como **primeira pergunta depois da primeira rodada** segue decisão do Comandante (`LADO_E_PEDAGOGIA.md` § 7.6).

**Próxima sessão começa com:** o que o Comandante julgar (o texto das fichas é dele); depois o Relatório de Consequências, a Amazônia (P180) e os ombros dos chassis pesados (P181).

## O PAR SOLO / MULTI NA PRIMEIRA TELA — Claude, 17/10 (branch `claude/solo-multi`, P182)

**O Comandante (17/10):** na segunda captura dos jogos antigos ele escreveu à mão **MULTI** sobre o "2Players". A primeira tela dos jogos antigos é uma pergunta de duas respostas grandes.

**Feito:**
1. **A primeira tela agora tem o par.** O botão verde segue sendo o **SOLO** (com a nota "SOLO · contra os bots" embaixo) e, logo abaixo, a chapa azul fria **MULTI** ("online, com outros pilotos", tecla O) que **acende em barra dourada** sob o mouse ou com o foco. Clicar abre o lobby online (`OnlineLobby`), pelo mesmo botão que o monitor da REDE já usa: a regra de entrar online continua num lugar só (`OnlineSwitch`). Só aparece com servidor no build e fora de uma sala; some quando o console completo acende (o monitor da REDE já tem o botão: nada repetido). Textos nas sete línguas.
2. **Provado no navegador de verdade** (`arte/primeira-tela-solo-multi-claude.png`, `arte/primeira-tela-multi-dourado-claude.png`): o par aparece na primeira visita, o clique abre o lobby sem "jogar" por baixo, fechar volta ao par, o japonês traduz, "EXPLORAR HANGAR E MODOS" faz o par sumir, zero erros. Teste (`CommandConsole.test.ts`): o HTML, a delegação do clique e o CSS.

**Custo de CPU:** zero (um botão e um clique; a tela enxuta já não acende os monitores).

**Falta (R13):** (a) a **placa** (borda forte, rebites) no console e na pausa; (b) a barra dourada nas **listas do console**; (c) o **olho do Comandante** sobre o par: o MULTI pode ir ao lado do botão verde em vez de embaixo (só CSS).

**Próxima sessão começa com:** o que o Comandante julgar; depois o Arquivo (P179), a Amazônia (P180) e os ombros dos chassis pesados (P181); as dicas de arma do Hangar sem tradução (entrada abaixo).

## A INTERFACE DOS JOGOS ANTIGOS NAS CONFIGURAÇÕES: A LINHA EM BARRA DOURADA E O `‹ VALOR ›` — Claude, 17/10 (branch `claude/interface-antiga`, P182)

**O Comandante (17/10):** *"veja esses exemplos de interface de jogos antigos, eu acho muito boas!"* (duas capturas do Aero Fighters; `REFERENCIA_VISUAL.md` § 8 tem a leitura e o que levamos). *"continue iterando"*.

**Feito:**
1. **`ui/Passo.ts`: o seletor `‹ valor ›`.** Veste um `<select>` que **continua existindo, escondido**: o jogo segue lendo e escrevendo `select.value`, ouvindo `change`; o `‹ valor ›` espelha o que o select diz (por clique, pelas setas do teclado, por mudança de código e pelo texto traduzido) e o muda com **um passo, circular**, sem abrir lista. Nove nas Configurações: qualidade, dificuldade, narrador, quantidades e personalidades dos inimigos. **O idioma fica como lista** (sete línguas).
2. **A linha selecionada em barra dourada com chevron** (`❯`) nas Configurações: a linha sob o mouse ou com o foco, como na referência (barra dourada de ponta a ponta, texto escuro, o passo em fundo escuro).
3. **Testes (`Passo.test.ts`, 8):** o passo circular, o rótulo, o limite de opções, o estilo e a ligação (o select do idioma não vira passo). **Prova no navegador de verdade** (`arte/interface-passo-*-claude.png`): os nove passos existem, o select está escondido e **acompanha** (clique, duas voltas, mudança por código, seta do teclado) e a troca para o japonês **refaz o texto** dos passos.

4. **Orçamento de JS (R7): o pacote chegou a 500,03 KB (limite 500).** As dicas de arma do Hangar saíram do código para `public/dicas-do-hangar.json` (carregado ao abrir o Hangar): **498,49 KB**, folga de 1,5 KB. Texto estático longo novo vai para JSON em `public/`, não para o pacote (`HISTORICO_DE_DECISOES.md`).

**Custo de CPU:** zero fora do clique (um observador de opções por seletor, que só dispara quando o texto das opções muda) e um `fetch` de 3,5 KB na primeira abertura do Hangar.

**Achado aberto (R17):** as 22 dicas de arma do Hangar **não têm tradução** nas seis línguas (o Hangar fala português em qualquer idioma): traduzir cada dica em `public/dicas-do-hangar.json` + dicionários, e o teste de cobertura passa a checar.

**Falta (R13):** (a) o par **SOLO / MULTI** na primeira tela (a anotação dele sobre "2Players"): *feito na entrada acima*; (b) a **placa** (borda forte, rebites) no console e na pausa; (c) a linha em barra dourada **no console** (as listas de operação); (d) o **olho do Comandante**: se a "pele" agradar, (a) a (c) seguem; se ele quiser mais perto da chapa dos jogos antigos, é só CSS.

**Próxima sessão começa com:** o que o Comandante julgar; depois SOLO / MULTI (P182), o Arquivo (P179) e a Amazônia (P180).

## AMAZÔNIA, PARTE A: O DRAGA-01 ANDA — o plano, o rig e a marcha do quadrúpede — Claude, 17/10 (branch `claude/amazonia-mina`, P180)

**A ordem do Comandante:** *"vamos já planejar e construir a próxima fase: o rio Amazonas, uma mineradora acabando com o rio… Já criei o modelo (`heavy industrial walker 3d model`): é um mech maior que o Colossus v4, então o cenário precisa ser bem maior… faça sua melhor versão desse modelo: ele deve se mexer (eu não inseri o RIG: tenho que fazer ou você faz?)"* e *"acima desse super mech o rio é limpo e vivo, e depois dessa máquina o rio fica poluído, sujo, com óleo e envenenado"*. **Resposta: o rig é meu; o Comandante não precisa rigar.**

**Feito:**
1. **O plano** (`AMAZONIA.md`): a mecânica central (**o rio é o termômetro da fase**: limpo a montante do Draga, envenenado a jusante, curando conforme as peças caem), a história (mineradora AURUM, do Grupo Vorcaris: arquétipo, nunca empresa real), o mapa de 2.400 × 900 m com o orçamento (≤ 70 desenhos, ≤ 250 mil triângulos, ≤ 400 colisores), a missão em quatro atos (desmantelar o escudo, derrubar as pernas, invadir com androides, o rio se cura), as partes A a E e as decisões em aberto. A ordem é a **P180**.
2. **O rig do Draga-01** (`scripts/blender/rig-walker.py`, Blender sem janela em `D:\blender\blender.exe`): o arquivo do Comandante é **um quadrúpede de 27 mil triângulos, uma malha só, sem esqueleto, sem pele e sem textura** (537 peças soltas). O script classifica cada peça pela posição (conferida em foto), mede as juntas das quatro pernas nas próprias peças e monta **18 ossos com pele rígida por parte** (a junta não amassa) e **cor nos vértices** (amarelo nas coxas, aço nas canelas, creme no convés, laranja nos guindastes, sujeira para baixo): **984 KB, um desenho**. O original não é tocado; o jogo usa `client/public/models/draga-01.glb`. Reproduzível.
3. **A marcha** (`entities/walkerGait.ts`, função pura): **quatro tempos** (dianteira esquerda, traseira direita, dianteira direita, traseira esquerda; pisada de 75%: **sempre três pés no chão**), passo de **5 m** casado com a velocidade (o pé não escorrega), balanço do casco (um mergulho por passo), convés que gira para a mira, guindastes que oscilam e radar que gira; **perna caída**: o joelho dobra, o casco afunda e inclina para o lado dela. Sem alocar por quadro.
4. **O desenho** (`entities/WalkerVisual.ts`): carrega o `.glb`, escala para **38 m** (tamanho 5), liga cada osso a uma junta que gira nos eixos do Mech (a mesma `AxisCorrectedJoint` dos robôs importados), **mede o sinal do joelho olhando o tornozelo subir** (perna a perna) e aplica a pose. Só do cliente: o servidor nunca carrega `.glb` (G14).
5. **A demonstração** (`debug/WalkerDemo.ts`): **`?walker`** no link põe o Draga andando em círculo de 70 m em volta de onde você nasceu, com o convés mirando em você, em qualquer mapa. **É DEMO**: ainda não é inimigo (não tem corpo na simulação, não atira, não leva tiro).
6. **A bancada** (`medicoes/walker.mjs`): fotografa o Draga de várias vistas e em fases da marcha, ao lado do Vector-09 (a régua de escala).
7. **O orçamento de JS por fase** (`scripts/orcamentoDeJs.mjs`, o `smoke` e 8 testes em `server/orcamentoDeJs.test.ts`): o Draga estourou o teto de 500 KB gzip do push (a `main` já estava em 499,8 KB), então o código dele é **carregado sob demanda** (`?walker`) e o `smoke` passou a medir **dois** tetos: o **de partida** (o que todo jogador baixa; segue 500 KB) e o de cada **pedaço sob demanda** (150 KB). Sem `?walker` nada do Draga é baixado (provado no build de produção). **Muda uma trava do projeto: o Comandante pode vetar** (`HISTORICO_DE_DECISOES.md`, 17/10). **A folga da partida é de 0,1 KB.**

**Provas:** **43 testes**: 16 da marcha pura (a ordem dos passos, nunca dois pés no ar, o quadril contínuo, o pé que não escorrega, a pose sem alocar, a perna caída, o dado torto), **23 do rig com o arquivo REAL carregado em Node** (os 18 ossos, o orçamento de triângulos e de peso, pele rígida de peso 1, 38 m e frente em -Z, quadril positivo leva o pé à frente, o joelho que levanta o pé em cada perna, o pé chato, o convés que gira, 20 s andando sem dois pés no ar e sem escorregar, a inclinação do casco, o radar, o arquivo sem osso que é acusado, duas instâncias independentes) e 4 da demonstração. 34 de 34 mutações à mão pegas. **Descoberta útil:** o `GLTFLoader` roda em Node quando o arquivo não tem textura, então o rig se testa sem navegador. Capturas: `arte/walker-*-a1-claude.jpg` (as vistas, a marcha em quatro fases, as pernas caídas, a escala) e `arte/walker-jogo-praia-s40-claude.jpg` (no jogo de verdade).

**Onde o Comandante confere:** **`?walker`** (e `?mapa=praia&modo=deathmatch&walker`): o Draga anda em círculo à sua frente, de 38 m, e mira o convés em você. Para ver sem jogar: `node .decepticons/medicoes/walker.mjs --fases 0,0.2,0.4,0.6 --vistas lado`.

**Falta (R13):** **tudo o que é o resto do plano** (partes B a E: o rio e o mapa, o Draga como chefe com corpo, a defesa, a invasão). Do próprio Draga: sem som de passo nem poeira (o gancho `onFootstep` existe); sem fumaça na chaminé; o material é simples (sem janelas acesas); o dano por parte ainda não aparece no desenho (só a perna caída, por número); **a imagem da serpente não chegou**.

**Próxima sessão começa com:** a **parte B**, o mapa `amazonia` e o rio com a frente de limpeza (`AMAZONIA.md` §§ 3 e 5).

## A LANDING FALA SETE LÍNGUAS, COM A FAIXA DE IDIOMAS NO TOPO — Claude, 17/10 (branch `claude/landing-idiomas`, P178)

**A ordem do Comandante (17/10):** *"idioma tem que ficar logo no início da landing, pra pessoa já selecionar o idioma nativo dele"*.

**Feito:**
1. **A faixa de idiomas é a primeira coisa da página** (`<nav class="lang-strip">`, antes da navegação): as sete línguas pelo nome nativo, a escolhida em destaque; **enquanto o visitante não escolhe, a faixa fica realçada** (o convite). Trocar traduz a página inteira na hora.
2. **`scripts/site/idioma-landing.js`** (JavaScript puro, sem build: a landing é estática): a mesma ideia do jogo (P173), português como texto de origem, dicionário por língua com lacunas `{n}` para o que o gerador preenche (os números saem do código do jogo). Traduz os textos, `title`/`aria-label`/`alt`, o `<title>` e a descrição. **Escolha: `?lang=` → a salva → a do navegador (fora de navegador de teste) → português**; a escolha vai para `cybermech.lang`, **a mesma chave do jogo**, então quem escolhe na landing **já entra no jogo na língua dele**.
3. **`scripts/site/locales/*.json`: 208 textos por língua** (en, es, fr, ja, zh, ru), copiados para ao lado da página pelo gerador (`scripts/landing.mjs`).
4. **Testes (`server/idiomaLanding.test.ts`):** o tradutor da landing e o do jogo **dão a mesma resposta** (exata, padrões, lacunas traduzidas, margens, espaços quebrados, escolha da língua); os seis dicionários têm as mesmas chaves, sem vazio e com as mesmas lacunas; **a landing de verdade é montada** e confere a faixa como primeira coisa do corpo, o módulo e os dicionários ao lado, e que **90% ou mais dos textos têm tradução** (texto novo sem tradução aparece aqui antes de ir ao ar). O tradutor do jogo ganhou o mesmo fallback de espaços quebrados.

**Custo de CPU/peso:** zero no jogo. Na landing: um módulo de ~4 KB e, só para quem escolhe outra língua, um JSON de ~14–22 KB; a tradução roda uma vez por troca (a página é estática, sem observador).

**Falta (R13):** (a) **as traduções são da Claude e precisam de revisão por falante nativo** antes de divulgar fora do Brasil; (b) a Oficina, a Sala de controle e as demais páginas internas seguem em português; (c) as imagens com texto (as fotos de cena) não são traduzidas; (d) alemão e coreano (os outros mercados da P171) são um JSON novo cada.

**Próxima sessão começa com:** o que o Comandante julgar; depois o Arquivo e o Relatório de Consequências (P179), a missão da Amazônia (P180) quando o modelo chegar, e a linha selecionada em barra dourada nas Configurações (P182).

## DE QUE LADO VOCÊ JOGA? O SELETOR DE LADO, O ARPÃO POR PESO E O PLANO DA AMAZÔNIA — Claude, 17/10 (branch `claude/lado-e-arpao-peso`, P178 a P182)

**O Comandante (17/10)** mandou, numa mensagem só, cinco ordens: o idioma logo no início da **landing** (P178); **perguntar o lado** (Aliança × Consórcio) e **ensinar** o que é o fascismo, a rede de mentiras e o medo, de modo sutil e pedagógico (P179); a **missão da Amazônia** (a mineradora no rio; o modelo é dele, em outro chat) (P180); a regra do **arpão** (o robô mais leve não puxa o mais pesado) (P181); e **referências de interface de jogos antigos** (P182).

**Feito neste PR:**
1. **P181, o arpão por peso (código, REAL):** `HookSystem.pesoDe` (o raio da cápsula): o alvo mais pesado que o atirador não é preso; igual e mais leve são. Substitui o limite fixo de 2,4 m (`breakRadius` saiu da arma). 4 testes e 3 mutações; a dica, o Arsenal e o Hangar dizem a regra nas sete línguas.
2. **P179, o seletor de lado (código, DEMO):** o selo **LADO** no console e na pausa; a pergunta no estilo da placa de metal (P182); o painel **"o discurso e o custo"** para o Consórcio. Teclado (setas, Enter, Esc), traduzido, sem porta (o primeiro acesso não pergunta nada). **Não muda o combate.** Visto no navegador de verdade (`arte/lado-*-claude.png`).
3. **Documentos de design:** `LADO_E_PEDAGOGIA.md` (a pergunta, as quatro camadas, as regras que protegem a ideia, o Arquivo e o que ensinar, as decisões dele), `fichas/fascismo-e-propaganda.md` (a base do Arquivo, **fontes a conferir por um revisor**), `fichas/cenario-amazonas.md` (a missão em cinco fases e o que o modelo dele precisa trazer) e a § 8 de `REFERENCIA_VISUAL.md` (a leitura das duas capturas e o que levamos).
4. **O registro:** as cinco ordens em `ORDENS_DO_COMANDO.md` (P178 a P182; a P177 é de outra sessão).

**Custo de CPU:** zero (HTML/CSS e um clique; a regra do arpão é uma comparação por aperto).

**Falta (R13):** (a) **P178, a landing em outras línguas** (próximo PR); (b) o **Arquivo**, o **Relatório de Consequências** e a **campanha do Consórcio** (P179); (c) **a missão da Amazônia** (P180), à espera do modelo; (d) **ombros nos chassis pesados**, sem os quais o arpão por peso não rende nas mãos de um robô grande (P181); (e) a linha selecionada em barra dourada, o `‹ valor ›` e o par **SOLO / MULTI** (P182); (f) as **decisões do Comandante** em `LADO_E_PEDAGOGIA.md` § 7 (nomes reais ou arquétipos; quanto o Consórcio é jogável; o Arquivo opcional; quem revisa os textos de fato; onde publica).

**Próxima sessão começa com:** a landing em outras línguas (P178).

## AS OUTRAS FASES, PARTE E: A CIDADE NEON GANHA O TRANSFORMADOR DO BANCO VORCARIS E A BARRA DO CHEFE — Claude, 17/10 (branch `claude/outras-fases`, P177, P164, P165)

**A ordem do Comandante:** *"CONTINUA SEGUINDO A PARTE B, C e a D, e melhore as outras fases além da estação cabos"*, e da P164: *"um tipo de circuito que podemos repetir nas diferentes fases… além de chefes especiais com contexto em cada outra fase"*.

**Feito (na missão em ondas da Cidade Neon, a Arena em `?modo=survival`, que é a missão padrão do jogo):**
1. **O circuito do quadro de luz se repete** (`sim/QuadroDeLuz.ts`): a regra pura agora tem **lugar e vida próprios** (`new QuadroDeLuz(ponto, vidaMax)`; sem argumentos é o do porto da praia, 240). O **transformador do Banco Vorcaris** (`environment/ArenaLayout.ts`: x -13, z -33, a leste da porta do banco, **480 de vida**) é a segunda instância. A mesma regra: **da onda 2 em diante o primeiro andróide vivo é o saboteiro**; **o Colossus da onda 6 vai direto a ele** (peso 4: apaga o de 480 em ~20 s) e, com o transformador apagado, **é solto e volta ao comportamento de sempre**; o jogador ou um aliado perto, sem rebelde em cima, recupera (8 por segundo, até dois; volta a ligar com 25%, 120).
2. **A cidade escurece com a energia** (`environment/Arena.ts`): as arestas, as faixas e as janelas dos três prédios, a plataforma e a rampa, as torres do horizonte e **a placa do BANCO VORCARIS** caem até 12% (`PISO_DA_LUZ_DA_CIDADE`: no escuro, não cego); com o transformador **apagado as zonas de cura e de resfriamento deixam de funcionar e o desenho delas some** (a mesma regra da praia).
3. **O desenho** (`environment/ArenaQuadro.ts`): uma cabine de aço com as arestas no azul do banco, uma tela voltada para o meio da arena e um **farol de 9 m** para achá-la de longe: **verde** ligado, **laranja trêmulo** sabotado, **vermelho piscando** apagado; com colisor. **Quatro desenhos**, só na missão em ondas.
4. **O HUD de missão fora da praia** (`ui/PraiaHud.ts` em modo `soMissao`): a célula **"TRANSFORMADOR · BANCO VORCARIS"**, a **barra do chefe** e os avisos do topo, sem o que é só da praia (a faixa da costa, a rede, os cabos, as portas, o cartão, a água, o marcador). **Antes desta parte o Colossus da Arena não tinha barra nenhuma.** A **regra dita do chefe muda com o alvo**: nos cabos da praia ("Ele vai cortar os cabos. Derrube as pernas."), no transformador da Cidade Neon ("Ele vai apagar o transformador do banco. Derrube as pernas.").

**Provas:** **37 testes novos**: 5 na regra pura (vida e lugar próprios, a vida maior segura mais, a volta aos 25% da vida dele, a fração, o reparo e o teto), 4 do layout (o armário não encosta em prédio, barricada, plataforma, zona nem nascimento), **6 de partida** (`Match.arena.test.ts`: só a missão em ondas tem o transformador, a onda 1 sem saboteiro e a 2 com um, o saboteiro chega e o depreda, as zonas caem e o jogador as religa, o Colossus o apaga e é solto, `restartMission`), **12 do desenho e da cidade** (a energia linear, o piso, as zonas, a placa do banco, o horizonte, sem o transformador nada muda) e **9 do HUD de missão** (com um DOM de mentira) mais 1 da regra dita por alvo. A suíte inteira passa. 54 de 56 mutações à mão pegas (as duas que escaparam são equivalentes: a histerese da energia só poupa custo, e dar ordem a um bot morto não muda o jogo). Capturas: `arte/arena-banco-e1-q0_1_1-claude.jpg` (ligado), `…q1_0.4_0.4…` (sabotado), `…q2_0_0…` (apagado, a cidade no escuro), `arena-cidade-e1-q*` (a cidade nos três estados), `arena-chefe-e1-q0_1_1` (o Colossus mascarado ao lado do banco) e **`arena-jogo-onda6-e1-s30-claude.jpg` (o HUD no jogo de verdade)**.

**Onde o Comandante confere:** `?modo=survival` (a Arena é o mapa padrão; `&onda=2` para o saboteiro, `&onda=6` para o Colossus): o banco é o prédio com a placa BANCO VORCARIS, e o transformador fica a leste da porta dele, com o farol verde de 9 m. Veja a célula do transformador no topo do HUD; deixe o saboteiro chegar e a cidade escurecer; corra lá e recupere. Para ver sem jogar: `node .decepticons/medicoes/arena.mjs --vistas banco,cidade --quadro "2:0:0"` (estado:vida:energia).

**Equilíbrio (R13): a missão padrão ficou mais exigente.** Sem o transformador as zonas de cura caem (não se perde a missão por isso, ao contrário do núcleo da praia). Nenhum número foi validado jogando: a vida (480), o peso do Colossus e a volta aos 25% são linhas de tabela.

**Falta:** dano a tiro no transformador; o transformador não aparece no minimapa; **Bunker, Bandeira e Domínio ainda não têm circuito** (a Cidade Neon do Deathmatch segue a de sempre); a Cidade Neon não tem ciclo do dia (é noturna por desenho); **o chefe com contexto próprio de cada fase** (o Banco Vorcaris como fábrica dos bots, P165) segue desenhado, não feito; o interior do banco (P149); só offline.

**Próxima sessão começa com:** o ajuste fino jogando dos dois mapas (praia e Cidade Neon) e a próxima fase da lista: o **Bunker** (que hoje só tem Deathmatch) ou o **Capítulo 4, SANÇÃO** no banco (o congelamento e as chaves de rota, `CAMPANHAS_E_CHEFES.md` § 2).

## CAPÍTULO 1, PARTE D: A COLOSSUS EM TRÊS FASES, A BARRA DO CHEFE E A MÁSCARA — Claude, 17/10 (branch `claude/cap1-parte-d`, P165, P147)

**A ordem do Comandante:** *"CONTINUA SEGUINDO A PARTE B, C e a D"* e, da P165, *"os Colossus V1, quero que você coloque uma MÁSCARA DO TRUMP nele (uma skin, que não será a padrão, apenas quando ele for o chefe)"*.

**Feito (na missão em ondas da praia, o Colossus da onda 6):**
1. **As fases do chefe** (`sim/FasesDoChefe.ts`, regra pura, G14): **ANDA** (as duas pernas de pé) → **MANCA** (uma caiu: metade da velocidade, a regra de sempre do `MechBase.mobility`) → **RASTEJA** (as duas caíram) → **CAIU** (o tronco zerou). **Não criei sistema de dano novo:** a fase sai da vida das pernas e do tronco que o dano por parte já tem. O que é só do chefe: **ele rasteja** (`MechBase.crawls`, 30% da velocidade; num Mech comum, perna destruída segue como torre imóvel) e **escolhe o alvo**.
2. **O alvo do titã:** o **cabo mais perto que ainda não foi cortado** (peso 4: corta em ~17 s, cada cabo cortado drena a rede); com os três cortados, **a porta principal do prédio**. Quem derruba as pernas o para; rasteja e continua atirando e depredando, **então é outra luta, de perto e sem pressa, mas ainda indo ao cabo**. O `Match` o manda por `dirigirOsInvasoresAosAlvos` (a mesma ordem `hold` dos manifestantes).
3. **A barra do chefe no HUD** (`ui/PraiaHud.ts`): só com o Colossus em campo. Título "COLOSSUS-01 · FASE n DE 3 · ANDA/MANCA/RASTEJA", a barra do tronco, as duas pernas (PERNA ESQ / PERNA DIR, riscadas quando caem) e **a regra da fase dita numa linha** ("Ele vai cortar os cabos. Derrube as pernas." / "Uma perna caiu: ele manca. Derrube a outra." / "Rasteja e atira. Acabe com ele antes que o último cabo caia."). Avisos no topo: "UMA PERNA CAIU · ELE MANCA", "RASTEJA · ACABE COM ELE", "COLOSSUS-01 CAIU". O DOM só muda quando a fase, as pernas ou a barra (passos de 1%) mudam.
4. **A máscara** (`entities/mascaraDoChefe.ts`): a **caricatura** do Trump (sátira política, pedido do Comandante), **só no Colossus que é o chefe da missão**; o Colossus que o jogador monta no Hangar não a tem. **12 caixas e 3 materiais, criados uma vez** na montagem do chefe: rosto laranja chapado, nariz saltado, sobrancelhas, fendas dos olhos e da boca, o topete dourado que cai para a frente e as laterais. **1,3× a cabeça** (a cabeça tem 1,65 m numa máquina de 14 m; no tamanho dela não se lia de longe). **Desligável: `?mascara=0`** (ou `off`/`nao`) no link tira; sem o parâmetro ela entra.

**Provas:** **8 testes da regra pura** (`FasesDoChefe.test.ts`: a fase pelas pernas, a perna ferida de pé que não muda a fase, os códigos e os textos do HUD, o rastejo a 30% onde um Mech comum fica imóvel, o cabo mais perto e o desempate, o cabo cortado que não vale, os três cortados (vai à porta), os avisos); **5 de partida** (`Match.chefe.test.ts`: só a onda 6 traz o chefe, que rasteja e veste a máscara, e o `?mascara=0` a tira; ele corta o cabo em ~17 s e segue para o próximo; as pernas mudam a fase e o que rasteja ainda anda, devagar, ao cabo; o tronco zerado o derruba; com os três cabos cortados vai à porta principal); **5 da máscara** (o link, as peças e o grupo, o desenho na frente da cabeça, a escala com o rosto no meio, idempotente e fora do Hangar). **19 de 19 mutações à mão pegas**. Capturas: `arte/praia-cabecadochefe-d1-d30-claude.jpg` (a cabeça do Colossus com a máscara) e `arte/praia-chefe-d1-d30-claude.jpg` (o titã inteiro no cais).

**Decisões desta parte (também no HISTORICO):** só o chefe rasteja; o alvo é o cabo mais perto ainda de pé e depois a porta principal; o jogador pode **kitar** (afastar o titã dos cabos atirando e correndo: é permitido, é uma estratégia); a máscara é 1,3× e desligável; **o risco jurídico e de plataforma de caricaturar uma figura pública segue registrado em `CAMPANHAS_E_CHEFES.md` § 0 e o botão de desligar fica**.

**Onde o Comandante confere:** `?modo=survival&mapa=praia&onda=6` (a onda do chefe): veja a barra no topo, derrube uma perna e leia o aviso e a regra mudarem; `&mascara=0` tira a máscara. Para ver sem jogar: `praia.mjs --arte --sufixo d1 --dias 0.3 --vistas cabecadochefe,chefe --chefe "20,27"` (e `--sem-mascara`).

**Falta (R13):** **o equilíbrio jogando** (a vida e a velocidade do chefe, os 30% do rastejo, o peso 4 nos cabos); **dano a tiro nos cabos, nas portas e no quadro**; a missão só offline (o pool de 13 personagens passa dos 8 de uma sala, G11); a ficha de fato da Enel como cartão no jogo; as vozes (a chave do ElevenLabs foi exposta e precisa ser girada pelo Comandante); **as outras fases** (Arena/Cidade Neon, Bunker, Domínio) ainda não ganharam a melhoria que o Comandante pediu.

**Próxima sessão começa com:** **melhorar as outras fases além da estação de cabos** (a ordem de 17/10), e o ajuste fino jogando do capítulo 1.

## O IDIOMA E A CONTA SAEM DO FUNDO DO MENU PARA O CANTO DA PRIMEIRA TELA — Claude, 17/10 (branch `claude/atalhos-idioma-conta`, P176)

**O Comandante (17/10):** *"nao achei o arpao no hangar, nem a mudança das linguas, nem login"*.

**O que conferi antes de mexer:** abri o **site de produção** num navegador de verdade (sessão limpa, build `bbbc1d8`): o seletor de idioma existe e troca o jogo para o japonês na hora; o bloco da conta existe; o Marauder está destravado e o **Arpão magnético** está na lista de ombros. **Estava tudo no ar, mas escondido:** a primeira tela é a "enxuta" (P133) e só mostra *CLIQUE PARA JOGAR* e *EXPLORAR HANGAR E MODOS*; o idioma e a conta ficavam em Explorar → Ajustar → aba JOGO → rolar, e o arpão exige escolher o Marauder (o último chassi) e abrir a lista dos ombros.

**Feito:** (1) **`<nav class="cc-atalhos">` no canto da primeira tela e da pausa**: o seletor de língua e o botão **[ CONTA ]**; o botão abre as Configurações na aba JOGO **já rolada até a conta** (`data-settings-foco`); (2) os dois seletores de idioma (o do canto e o das Configurações) andam juntos (`i18n.ts`: conjunto de seletores); (3) o botão some enquanto o jogo carrega (não teria o que abrir) e no modo Comandante (o canto é do selo dele); (4) traduções do botão e da dica nas seis línguas (482 textos por língua); (5) teste: o idioma e a conta estão **dentro do `#overlay`, antes do cabeçalho** (um canto que volte para o fundo do menu quebra o teste).

**Custo de CPU:** zero (dois elementos de HTML e um `scrollIntoView` no clique).

**Falta (R13):** (a) **o arpão continua só no Marauder, dentro da lista de ombros**: é a regra (só ele tem ombros), mas não há nada na primeira tela nem no Hangar do Vector-09 que diga isso; se o Comandante quiser, dá para pôr um aviso no cartão do chassi ou uma dica no Hangar; (b) **o olho do Comandante**: se depois do Ctrl+F5 ainda não aparecer, ele precisa dizer **onde está jogando** (site ou pasta local); (c) a landing do site (`/`) segue só em português.

**Próxima sessão começa com:** o que o Comandante disser jogando; a decisão da P171 (ritmo oficial, cosmético de explosão).

## CAPÍTULO 1, PARTE C: O PORTO — os contêineres de desembarque e o quadro de luz da cidade — Claude, 17/10 (branch `claude/cap1-parte-c`, P163, P164)

**As ordens do Comandante:** *"o porto é onde os inimigos chegam, eles devem sair dos contêineres (e na campanha de ondas isso deve ser bem explícito)"* e *"no porto, tem que ter um botão ou chave ou sistema que devemos proteger, para acender as luzes da cidade… um tipo de circuito que podemos repetir nas diferentes fases"*.

**Feito (na missão em ondas da praia):**
1. **Os contêineres de desembarque** (`PraiaLayout.ts`, `PraiaPorto.ts`): três contêineres laranja no cais (a coluna leste do pátio, fileiras z = -48, -32 e -16), a porta para o leste. **Quando a onda entra em campo as portas se abrem para fora** (~2 s, as folhas acendem em laranja de alerta) e **os Mechs e os andróides rebeldes nascem pelas bocas deles**; entre as ondas fecham. Antes os rebeldes nasciam na areia, a ~200 m da estação; agora **a mais de 460 m**: o ritmo mudou (a massa de manifestantes chega em poucos segundos e as máquinas ~45 s depois).
2. **O quadro de luz da cidade** (`sim/QuadroDeLuz.ts`, regra pura, G14): o armário de força na **ponta oeste do cais, a mais de 500 m da estação**. **Da onda 2 em diante o primeiro andróide vivo é o saboteiro**: atravessa o cais e o depreda (peso por tipo; um andróide sozinho leva 80 s). **A energia da cidade é a vida do quadro**: as luzes públicas (bulbos, halos, janelas, poças, feixes) viram o **ciclo do dia vezes a energia**; com o quadro **apagado a cidade fica no escuro e as zonas de cura e de resfriamento deixam de funcionar** (e o desenho delas some). O jogador que chega, sem rebelde em cima, recupera (8/s, até dois; volta a ligar com 25%).
3. **O que o jogador vê:** o painel do armário (verde ligado, laranja trêmulo sabotado, vermelho piscando apagado), uma célula no HUD sob as portas e o aviso no topo ("QUADRO DE LUZ SOB SABOTAGEM · A CIDADE VAI AO ESCURO", "CIDADE NO ESCURO · AS ZONAS DE CURA CAÍRAM", "QUADRO DE LUZ RECUPERADO · A LUZ VOLTOU").

**Provas:** **11 testes da regra pura** (inclui determinismo e invariantes sob 36 mil ticks e o interruptor das zonas); **6 de partida** (`Match.quadro.test.ts`: só a praia tem o quadro, as ondas nascem nas bocas dos contêineres, as portas abrem com a onda em campo, a onda 1 não sabota e a 2 manda o saboteiro, o quadro apagado derruba as zonas e o jogador as religa, `restartMission`); **9 do desenho e dos avisos** (a abertura andando, as folhas abrindo para o leste, o painel, as luzes da cidade sem energia mesmo de noite, as zonas que somem, o teto de desenhos); o layout (os contêineres, as bocas, o quadro). **19 de 19 mutações à mão pegas.** Capturas: `arte/praia-conteineres-c1-d100-claude.jpg` (as portas abertas, dois andróides nas bocas, à noite), `arte/praia-quadro-c1sabotado-d100-claude.jpg` e `arte/praia-quadro-c1apagado-d100-claude.jpg`.

**Onde o Comandante confere:** `?modo=survival&mapa=praia`: veja as portas dos contêineres abrirem no cais quando a onda começa (vá até lá pelo calçadão) e os rebeldes saírem por elas; na onda 2 (`&onda=2`) olhe o HUD: o quadro entra sob sabotagem; corra até o armário na ponta oeste do cais (uns 40 s) e recupere. Para ver sem jogar: `praia.mjs --desembarque --vistas conteineres` e `--quadro "2:0:0" --vistas quadro`.

**Falta (R13):** **o equilíbrio jogando** (o saboteiro leva 80 s; a viagem do jogador, uns 40; os rebeldes agora andam 460 m: cada número é linha de tabela); dano a tiro no quadro, nas portas e nos cabos; **a parte D (a Colossus em três fases, a barra do chefe e a máscara)**; os lugares só de andróide e drone (P149); a ficha de fato da Enel como cartão no jogo. Só offline.

**Próxima sessão começa com:** a **parte D** (a Colossus), e as outras fases.

## CAPÍTULO 1, PARTE B: A INVASÃO DO PRÉDIO — o manifestante, as duas portas e a rua dos fundos — Claude, 17/10 (branch `claude/cap1-parte-b`, P163, P166)

**A ordem do Comandante:** *"os mesmos manifestantes e humanoides inimigos ficam invadindo o prédio da estação, e tem que ter uma entrada principal, e também uma entrada na rua dos fundos (pra dar mais possibilidades de ataque e vulnerabilidade)"*, e *"CONTINUA SEGUINDO A PARTE B, C e a D, e melhore as outras fases"*.

**Feito (na missão em ondas da praia):**
1. **O manifestante** (`entities/chassis.ts`, `entities/Android.ts`): o vândalo humano dos eventos reais que o Comandante pediu (o Capitólio, 6/1/2021; os Três Poderes, 8/1/2023): **camisa amarela, boné e bandeira**, pele sem rosto de ninguém, **sem arma de fogo**. Corpo de andróide, **mais fraco e mais lento** (cai com um tiro certeiro no tronco); a "arma" é a pancada de bandeira, **metade da motosserra**. Pool de 5 no `BotSystem`; os planos das ondas 2 a 6 trazem **2, 3, 3, 5 e 3**; **só na praia** (a Arena e o Bunker seguem como eram).
2. **As duas portas do prédio** (`sim/PortasDaEstacao.ts`, regra pura, G14): a **entrada principal** (fachada sul) e a **dos fundos** (fachada norte), 400 de vida cada. Todo rebelde a menos de 7 m a **força** (Mech e manifestante 1, andróide 0,4, Colossus 4: três manifestantes arrombam uma porta em ~33 s); **arrombada, drena a rede da estação** (12/s cada) e só se **recupera** com o jogador ou um aliado perto e sem invasor em cima (8/s, até dois; volta aos 30%). Porta forçada não se recompõe sozinha.
3. **Duas frentes ao mesmo tempo:** os manifestantes nascem **três pela avenida** (a oeste, entrada principal) e **dois pela rua dos fundos** (atrás do muro norte, entrada dos fundos); cada vaga do pool tem o alvo dela (a porta principal, a dos fundos ou um cabo) e recebe a ordem `hold` do Domínio; os andróides seguem para os cabos (parte A).
4. **O que o jogador vê:** a porta fica **laranja e treme** forçada e, **arrombada, escura, aberta de lado e piscando em vermelho**; duas células no HUD sob os cabos e o aviso no topo ("ENTRADA DOS FUNDOS ARROMBADA · INVASORES DENTRO").

**Provas:** **12 testes da regra pura** das portas (estrutura, o peso de cada invasor, a porta forçada que não se recompõe, o conserto e o teto de dois, o invasor que impede o conserto, determinismo e invariantes sob 36 mil ticks); **9 testes de partida** (`Match.portas.test.ts`: o manifestante mais fraco e sem arma de fogo, o plano das ondas, só a praia tem o pool, a onda 3 ativa os 3 com um pela rua dos fundos, a ordem `hold`, o grupo dos fundos que chega sozinho à porta, a porta que o jogador recupera, o dreno da rede isolado e o `restartMission`); **8 do desenho e dos avisos**; a Arena segue com o plano de sempre. **15 de 16 mutações à mão pegas** (a que escapou é equivalente: a guarda `defesa > 0` era redundante, porque o reparo já é zero sem defensor; uma segunda escapou na primeira rodada, o teste do dreno estava frouxo, foi reforçado e agora pega). Capturas: `arte/praia-manifestantes-b1-d0-claude.jpg` (cinco manifestantes ao lado de um andróide), `arte/praia-portafrente-b1-d60-claude.jpg` e `arte/praia-portafundos-b1-d60-claude.jpg` (a da frente forçada, a dos fundos arrombada).

**Onde o Comandante confere:** `?modo=survival&mapa=praia&onda=2`: os manifestantes saem pela avenida e pela rua dos fundos; olhe o prédio pelos dois lados; deixe um grupo forçar uma porta e veja a célula do HUD mudar; chegue perto da porta, sem invasor, para recuperar. Para ver sem jogar: `praia.mjs --portas "1:0.45,2:0" --vistas portafrente,portafundos` e `--manifestantes "186,26;188.5,29" --vistas manifestantes`.

**Falta (R13):** **o equilíbrio jogando** (cada número é linha de tabela em `PortasDaEstacao.ts`; os manifestantes chegam primeiro, em poucos segundos, e as máquinas depois); **o pool soma 13 personagens, mais que os 8 character controllers de uma sala (G11)**: vale offline e **a missão online terá de caber no teto**; dano a tiro nas portas e nos cabos; **a parte C (o porto: os contêineres que abrem e soltam os inimigos, e o quadro de luz)** e **a D (a Colossus em três fases, a barra do chefe e a máscara)**; os lugares só de andróide e drone (P149).

**Próxima sessão começa com:** a **parte C** (o porto), depois a **D** (a Colossus), e as outras fases.

## OS REBELDES ATIRAM O LASER E O PAINEL CONTA O RITMO DE CONTEÚDO — Claude, 17/10 (branch `claude/bots-laser`, P175)

**A ordem do Comandante (17/10):** *"…e pendências abertas recentes"*. Duas dessas pendências estavam escritas no estado e na análise do War Robots (P171).

**Feito:**
1. **O bot atira o laser** (`BotSystem`, `sim/esquadrao.ts`, `Match`): o esquadrão aceita o laser como arma do bot (`armaServeAoBot`, antes recusava feixe) e o bot manda **um pulso por `fireInterval`** pelo `Match.beamPulse` (o mesmo do jogador: acha o primeiro alvo, aplica o dano com as defesas do caminho, acende o desenho e, no servidor, vira evento de tiro para os outros clientes). Mão principal e mão esquerda. A direção é a que o cérebro mirou (com o erro de mira da dificuldade), então o bot erra como erra com plasma. Sem a partida atrás (`pulso` ausente), o bot com laser fica calado, nunca quebra.
2. **Sala de controle → Ritmo de conteúdo** (`scripts/site/dados.mjs` `conteudoPorSemana`, `painel.mjs`, `sala.mjs`): cada **arma** e cada **chassi** do jogo conta uma unidade na semana (segunda-feira) em que o merge que o trouxe entrou na `main`; os ids saem do código, as datas do git (`--first-parent -S`). Hoje: **30 unidades, 7,3 por semana** nas semanas completas (21/09: 6, 28/09: 6, 05/10: 10, 12/10: 8 até agora). É o número que a análise do War Robots pedia ("o produto é a cadência").
3. **Testes (+12):** `botLaser.test.ts` (6: o esquadrão aceita o laser; pulsos na principal e na esquerda com física de verdade, intervalo, dano, determinismo) e `ritmoDeConteudo.test.ts` (6: cada arma conta uma vez, semanas seguidas desde a segunda-feira, a unidade cai na semana da data, média sem a semana corrente). **8 mutações pegas** (5 no bot, 3 no ritmo).

**Custo de CPU:** o bot com laser faz um raycast por pulso (7,7 por segundo enquanto atira, como o jogador); só quando o esquadrão lhe dá o laser (o padrão do jogo não muda). O painel roda no build do site (uns 40 chamadas de `git log`), nada no jogo.

**Falta (R13):** (a) **D7 e DAU/MAU** no painel: pedem um id anônimo por visita (hoje a telemetria conta eventos por IP, sem pessoa); decisão do Comandante (LGPD); (b) a **meta oficial** de conteúdo (2 por semana, 1 evento a cada 6) segue com ele (P171); (c) o **bot não usa o arpão** (só há ombros no Marauder, e o bot não os tem); (d) o ritmo não conta o que não é arma nem chassi (mapas, pilotos, eventos); (e) a bancada de celular e o desenho do evento mínimo (P171).

**Próxima sessão começa com:** o que o Comandante julgar (as línguas, o login, o arpão, o laser dos bots) e as decisões da P171 (ritmo oficial, inglês antes de monetização: respondida, cosmético de explosão).

## O LOGIN DO JOGADOR, COMPLETO: a conta leva o progresso para outro aparelho — Claude, 17/10 (branch `claude/login`, P174)

**A ordem do Comandante (17/10):** *"quero também que concluamos sobre o LOGIN"*. A conta, o limite de tentativas e o formulário já existiam, mas **nada ligava o formulário ao jogo** e a conta não guardava nada do piloto.

**Feito:**
0. **Achado e corrigido no formulário (R17):** o `LoginPanel` (nunca ligado antes) refazia o painel inteiro no `blur`, o que destruía o campo para onde o foco ia e **o botão sob o clique**: clicar em ENTRAR logo depois de digitar a senha **perdia o clique**. Agora o `blur` só mostra o aviso no lugar (`_mostrarValidacao`), com 2 testes (e uma mutação pega).
1. **No servidor:** `GET`/`PUT /conta/progresso` (só com sessão, corpo até 8 KB, validado por `validarProgresso`: nível 1–999, XP 0–999, créditos até 1 bilhão, montagem até 4 KB, apelido pelo mesmo filtro da sala online; campo a mais do cliente é descartado); tabela `progresso` (uma linha por conta, substituída a cada `PUT`). **Achado e corrigido (R17):** `/conta/eu` não respondia ao **preflight do CORS** (o jogo em `cybermech.online` chama o servidor em outra origem com o cabeçalho da sessão); agora responde, e a rota nova também.
2. **No cliente:** `net/sessao.ts` (`SessaoPiloto`: token por servidor, entrar/criar/sair, restaurar ao abrir, **mescla** e envio com 5 s de calma; rede fora nunca trava nem apaga nada), `net/progressoLocal.ts` (liga a sessão ao que o navegador já guardava: nível/XP/créditos, apelido, montagem; **nenhuma chave nova de progresso**), `ui/ContaSettings.ts` (o `LoginPanel`, já pronto, nas Configurações → JOGO → CONTA DO PILOTO), `DailyChallenges.snapshot/restore/onSave`, `ContaCliente.lerProgresso/gravarProgresso`.
3. **A regra da junção** (`mesclarProgresso`, pura): quem tem **mais nível e XP vence por inteiro** (os créditos andam com o nível: somar dobraria o ganho de quem usa dois aparelhos); empate, o gravado por último; apelido e montagem do outro cobrem o que faltar. Aparelho novo recebe o da conta; convidado que jogou antes de criar a conta **não perde nada**.
4. **Idiomas:** os textos do formulário e as mensagens de erro entraram nas seis línguas (475 textos por língua; o teste cobre a validação e as frases de estado).
5. **Testes (+64):** `progresso.test.ts` (contrato e mescla), `conta-progresso-http.test.ts` (o servidor de verdade: 401, 400, 413, isolamento entre contas, preflight, origem), `sessao.test.ts` (21: junção nos dois sentidos, rede fora, restaurar, sair, envio com calma), `progressoLocal.test.ts` e `auth.test.ts` (o cliente). **18 mutações: 16 pegas e 2 equivalentes** (cancelar o envio ao sair e agendar sem sessão não mudam nada que se veja: sem token a sincronização não faz nada). **Prova no navegador de verdade** (`arte/login-*-claude.png`): um convidado de nível 5 (300 XP, 1234 créditos, apelido ANA) cria a conta num "aparelho"; um navegador limpo entra com ela e **recebe nível, XP, créditos e apelido**; sair não apaga nada do aparelho.

**Custo de CPU/rede:** zero no jogo; uma ida ao servidor ao entrar (um `GET`, e um `PUT` se algo mudou) e **um `PUT` por janela de 5 s de calma** depois de uma mudança de progresso (pouquíssimas por partida). Servidor: um `SELECT`/`INSERT` por chamada; nenhum custo por tick (G13).

**Falta (R13, em `STATUS_REAL.md`):** (a) **o olho do Comandante**; (b) o **ranking** (C4) e o **clã** (C2) do plano; (c) um convite "gostou? guarde seu progresso" depois da primeira partida (a conta só aparece nas Configurações); (d) **recuperar senha** (não há e-mail de recuperação); (e) apelido único; o apelido da conta passa a valer na caixa do lobby **depois de recarregar**; (f) as missões do dia ficam só no navegador; (g) **LGPD:** o e-mail é guardado (o mínimo); falta o "apagar minha conta".

**Próxima sessão começa com:** o que o Comandante julgar do login e das línguas; depois as pendências recentes (bots com o laser; contadores do painel).

## O ARPÃO MAGNÉTICO CHEGA AO JOGO: a arma que prende e puxa — Claude, 17/10 (branch `claude/arpao-no-ar`, P77 3ª parte, protocolo 20)

**O que era:** o porte do arpão de 12/10 (`claude/arpao-magnetico`) nunca entrou na `main`; refeito sobre a `main` de hoje (a sessão anterior deixou o porte parcial local).

**Feito:**
1. **A arma (`harpoon`, só de ombro):** raio de 45 m que morde 10 e **prende o primeiro inimigo à vista**, puxando-o a 9 m/s por até 1,6 s; um aperto a cada 4 s; os dois ombros dividem um cabo. **Contrajogo:** o dash do alvo corta o cabo, a parede também, o Colossus (raio > 2,4 m) o arrebenta, aliado e dono nunca são presos. Regra em `combat/HookSystem.ts` (G14: a mesma offline e no servidor; só o tick fixo; pool de 8).
2. **Ligação:** `Armament` → `PlayerController.hook` → `Match.hookShot` (jogo e `NetPilot` do servidor); `onHook` vira evento de tiro; **protocolo 20** (`harpoon` no fim de `NET_WEAPONS`); `OnlineSession` desenha o raio do arpão de outro jogador (`Match.drawHook`).
3. **Desenho:** `fx/HookVisuals.ts` (o cabo preso, um `InstancedMesh`, pulsa; ciano o seu, vermelho o do inimigo) e o raio do disparo pelo `BeamVisuals`; modelo 3D (bobina e cano com garras), ícone do Hangar, retícula, som (`armasSom.json`), dica de primeiro uso, ficha do Arsenal e o "Testar" do Hangar.
4. **Testes (46 novos):** `HookSystem.test.ts` (prender, `breakRadius`, cabo dividido, pool, puxar, e cada causa de soltar: tempo, chegou, dash, morte, estouro, parede, sem dano ligado), `harpoon.test.ts` (dados, Armament, `Match.hookShot` com física: parede, alcance, o primeiro à vista, aliado, cliente online, `drawHook`) e `HookVisuals.test.ts` (instâncias, cor, NaN). **13 mutações pegas** (limite do raio, dash, puxar sem dano, intervalo da parede, chegada, estouro, segundo ombro, aliado, cliente online, alcance, mordida, Armament, cor).

**Custo de CPU:** um raycast por aperto (a cada 4 s) e **um raycast a cada 6 ticks por cabo preso** (no máximo 8); um `push` por tick por cabo; no desenho, dois `setMatrixAt` por cabo (uma chamada de desenho). Nenhum `new` por tick/quadro (G4/G5).

**Falta (R13):** (a) **o olho do Comandante** (o puxão e o cabo); (b) o **cabo preso de outro jogador** não é desenhado no online (só o raio do disparo); (c) o **bot não usa o arpão**; (d) drone de ombro, ultrassônico e ombros para Bastion/Colossus (P77).

**Próxima sessão começa com:** o login (P174) e as pendências recentes (bots com o laser; contadores do painel).

## O JOGO FALA SETE LÍNGUAS — Claude, 17/10 (branch `claude/idiomas`, P173)

**A ordem do Comandante (17/10):** *"sim, vamos JÁ colocar a opção para outras línguas (inglês, japonês, espanhol, francês, chinês, russo)"*.

**Feito:**
1. **`client/src/i18n/i18n.ts`:** o texto de origem é o português (nenhum módulo de interface precisou mudar); cada língua é um JSON em `client/public/locales/` (`{ "texto em português": "tradução" }`, com lacunas `{0}` para o que o jogo preenche). `traduzir()` é pura (busca exata, padrões com lacuna, cache de 2000); a camada de DOM traduz a página e **observa** (`MutationObserver`) o que o jogo escreve depois (HUD, avisos, menus), inclusive `title`/`aria-label`. **A troca é ao vivo** (cada nó guarda o original), sem recarregar.
2. **Escolha:** `?lang=` do link → a escolha salva (`cybermech.lang`) → a língua do navegador (**só fora de navegador de teste**, para as bancadas e o smoke seguirem comparando português) → português. Seletor em Configurações → JOGO → *Idioma · Language* (sempre bilíngue, para quem está perdido).
3. **445 textos por língua** (en, es, fr, ja, zh, ru): menus, configurações, controles, HUD de combate, avisos de missão, bandeira e domínio, dica de cada arma, nome das armas, modos, setores, desafios, tela de carregamento (com as dicas) e os 3 textos que o CSS escreve (`content`, por `:lang()`).
4. **Testes (26, `i18n.test.ts`):** seis dicionários com **as mesmas chaves**, sem vazio, com as mesmas lacunas, e cada língua na sua escrita; **cobertura por teste**: a dica e o nome de **cada arma** (arma nova sem tradução quebra o teste), os rótulos das configurações, as dicas do carregamento e **todo texto do `index.html`**. Cinco mutações pegas (detecção em navegador de teste, lacuna não traduzida, ordem de especificidade, cache, margens).

**Custo de CPU:** zero em português. Fora dele, um observador de mutações (o HUD troca texto, no pior caso, por quadro) e uma busca em tabela com cache; **nada na simulação** (G1/G2). Peso: o JS cresce ~3 KB; cada dicionário é um JSON de ~20–27 KB (7–9 KB com gzip) que só baixa quem escolheu a língua (G12).

**Falta (R13, está em `STATUS_REAL.md` como PARCIAL):** (a) **revisão por falante nativo** (as traduções são do Claude); (b) a **voz do narrador** segue em português/sotaques; (c) textos desenhados em canvas (placas de nome, mapa-múndi) e as fichas longas do Hangar; (d) a landing do site (`scripts/site/`) continua só em português; (e) a vírgula decimal das dicas (`0,85 s`) não vira ponto em inglês.

**Próxima sessão começa com:** o login (P174), o arpão magnético (P77) e as pendências recentes (bots com o laser; contadores do painel).

## O SITE VIROU PORTAL DE JOGO: sistema de design, fotos cinematográficas dos Mechs reais e as três páginas no mesmo visual — Claude, 16/10 (branch `claude/landing-referencia`, P172)

**A ordem do Comandante (16/10):** *"quero bem parecido com as imagens de referência"*, depois *"falta acabamento UX e UI, mais estiloso, mais único, sair dos padrões"* + a orientação de um profissional (resumida no `DESIGN_SYSTEM_SITE.md`).

**Feito:**
1. **`DESIGN_SYSTEM_SITE.md` + `scripts/site/hud.mjs`:** paleta oficial (preto industrial, amarelo `#ffd000`, branco técnico), **Chakra Petch** (títulos) + **Barlow** (texto), hospedadas no próprio site; componentes reutilizáveis (`hudNav`, `sectionHeading`, `featureCard`, `gameButton`, `pageHero`…); revelar ao rolar, paralaxe do herói e fade entre câmeras, só CSS, com `prefers-reduced-motion`.
2. **Fotos dos Mechs REAIS** (`.decepticons/medicoes/cena-cinematica.mjs`, ~10 s cada): Colossus-V4, Vector-09 e Marauder (os `.glb` e o procedural do jogo) num hangar com luz, névoa, brilho e faíscas; herói, duelo, a escala dos quatro chassis, o Marauder do Hangar e o desenho de cada arma. A **posição das partes na foto** (régua de 20 m, os 6 marcadores do Hangar) sai da projeção 3D e a landing posiciona os rótulos por ela. Substitui o `landing-assets.mjs` do Codex.
3. **Landing:** herói com o Colossus de 20 m e a régua, seletor de câmeras com o que cada uma faz, quatro recursos da VITRINE, "Sem pay-to-win" (as 4 linhas do GAME_DESIGN), Hangar com os 6 módulos do Marauder (blindagem do código), os **quatro tamanhos de robô na mesma escala** (Andróide 1, Vector-09 2, Colossus-01 3 lado a lado e o Colossus-V4 4 por trás, discreto: ordem do Comandante durante a sessão), seis armas com tabela de 3 níveis, três modos, esquadrão, controles e FAQ. O botão de jogar do cabeçalho só aparece depois do herói (nunca dois CTAs juntos). Texto menor que 12 px não existe mais.
4. **Oficina e sala de controle:** mesmo sistema. A sala ganhou cartas por IA (commits, entregas, últimas atividades), **mapa de calor por dia da semana e hora** e registro de entregas/commits **filtrável por quem fez**, tudo do git; "Como um pedido vira jogo".
5. **Teste do site (`site.mjs --check`):** conta recursos, armas, partes do Hangar e compromissos; troca de câmera; **toda imagem da página responde 200**; o clique no CTA do herói.

**Custo de CPU:** nenhum no jogo. Página: imagens estáticas, animações só de CSS (opacity/transform), um observador que desliga cada bloco depois de revelá-lo. Peso: herói 265 KB, 5 fontes ~100 KB.

**Falta (R13):** (a) **o olho do Comandante**; (b) o herói é **foto**, não 3D ao vivo (decisão de custo; a foto é regenerável); (c) os modelos das armas do jogo são simples, por isso as fotos de arma são sóbrias (a arte conceitual das referências não foi usada: não é o jogo); (d) as ilustrações do esquadrão são recortes da referência do Comandante; (e) páginas próprias de **Hangar/Arsenal** com comparador e **Pilotos** (não existe no jogo) ficam para o próximo PR.

**Próxima sessão começa com:** o veredito do Comandante sobre o visual; depois, o que ele apontar (a lista de (e)).

## O CHECKPOINT DAS EXPLOSÕES E AS LIÇÕES DO WAR ROBOTS — Claude, 16/10 (branch `claude/checkpoint-explosoes`, P170 e P171)

**O Comandante (16/10, depois de jogar):** *"as explosões das armas estão ficando INCRÍVEIS! mantenha essa qualidade e marque esse ponto como um checkpoint"*; e colou a reportagem dos US$ 1 bilhão do War Robots.

**Feito:** (1) **checkpoint** `checkpoint/explosoes-v1` (tag no `54c6972`), `CHECKPOINTS.md` (o que faz o olhar, a prova guardada, os 4 passos de conferência e a regra de não regredir) e a bancada versionada `medicoes/explosoes.mjs`; (2) `LICOES_WAR_ROBOTS.md`: a reportagem em números e o que muda no que fazemos (cadência de ~2 unidades de conteúdo por semana e um evento a cada ~6 semanas, celular primeiro, Brasil como volume, retenção como número, copiar o mecanismo e não o pay-to-win, estilos de explosão como primeiro cosmético).

**Falta:** a decisão do Comandante sobre o ritmo oficial, o inglês e o primeiro cosmético (`LICOES_WAR_ROBOTS.md` § 4); contar conteúdo e D7/DAU-MAU no painel; o arpão magnético (P77) está num porte parcial local (`claude/arpao-no-ar`, não empurrado).

**Próxima sessão começa com:** o que o Comandante decidir; senão, o desenho do evento mínimo.

## CADA ARMA COM A SUA DICA DE PRIMEIRO USO — Claude, 16/10 (branch `claude/dicas-por-arma`, P160 parte 5)

**Por quê:** uma dica só ("FOGUETES: DANO EM ÁREA") aparecia para toda arma de munição, inclusive a granada, o enxame e o cruzador. No texto, a arma nova era o foguete.

**Feito:** `ui/dicasDeArma.ts` (uma frase por arma, com os números da própria arma) e `Onboarding.armaEmUso`: na primeira vez que o jogador atira com uma arma, a frase dela aparece por 6 s e não volta (guardado no navegador). A caixa da dica agora cresce com o texto.

**Provas:** 6 testes (`ui/dicasDeArma.test.ts`); e o jogo de verdade na GPU real: a granada mostrou "GRANADA: CAI NO ANEL VERDE (ATÉ 80 M); MIRE ATRÁS DA COBERTURA E ELA PASSA POR CIMA" e ficou gravada (`arte/armas-dica-granada-claude.jpg`).

**Onde o Comandante confere:** Hangar → uma arma nova → jogar e atirar: a dica aparece na primeira vez (para ver de novo, limpar os dados do site no navegador).

**Próxima sessão começa com:** o que o Comandante disser jogando as partes 1 a 5 da P160.

## CAPÍTULO 1, PARTE A: OS CABOS DE DADOS — andróides injetam, cabos são tomados ou cortados, o jogador libera e conserta; e a ficha de fatos das privatizações — Claude, 16/10 (branch `claude/cap1-cabos`, P162, P163, P166)

**A ordem do Comandante (16/10):** *"privatizações de serviços públicos essenciais, eletricidade, água e esgoto, saúde, segurança, petrobras… pode prosseguir com o capítulo 1"* — e, mais cedo, os cabos como pontos de invasão (*"os inimigos precisam se conectar aos cabos… os androides precisam se conectar a algum ponto do cabo, e os outros ficam protegendo… enquanto temos que atacar e liberar o acesso e a programação orgânica das redes"*) e a fase da estação em três frentes.

**Feito (na missão em ondas da praia, `?modo=survival&mapa=praia`):**
1. **`sim/CabosDeDados.ts`** (regra pura, G14): três cabos, um ponto de conexão cada no pátio (z 40). O **andróide rebelde** ligado ao ponto **injeta** (um sozinho leva 40 s, três ~13 s; o quarto só faz companhia); injeção cheia = cabo **TOMADO**, que **drena a rede da estação** (10/s cada, e a rede não se recompõe). Tomado só se **libera** com defensor perto e sem andróide ligado (~12 s). O **rebelde pesado** em cima do ponto **depreda** o cabo (~67 s para cortar); **cortado também drena** (8/s); o defensor **conserta** (10/s, até dois; volta aos 25%).
2. **`Match`:** conta quem está perto de cada ponto (um laço sobre os rebeldes, aliados e jogadores, sem alocar), **manda os andróides rebeldes aos pontos** com a ordem `hold` do Domínio (um por cabo, replanejado a cada segundo) e soma o dreno dos cabos ao da rede (`NucleoDaEstacao.fixedUpdate` ganhou o dreno extra, que também acende a pressão do alerta).
3. **O que o jogador vê:** o **brilho do cabo** vira vermelho piscando com a injeção (e falha com a vida baixa); sobe um **letreiro com caveira** desenhada em canvas ("INJETANDO FAKE NEWS", "DESINFORMAÇÃO EM MASSA", "ROBÔ DE OPINIÃO", "MANIPULANDO A REDE", "REDE COMPROMETIDA", "CABO CORTADO"), três letreiros em alturas diferentes; **três células no HUD** sob a rede da estação (vida e injeção) e o **aviso no topo** ("CABO 2 TOMADO · A REDE ESTÁ SENDO ENVENENADA").
4. **`fichas/fatos-privatizacoes.md`**: os cinco casos pedidos (Eletrobras e Enel; Sabesp; as organizações sociais de saúde e a PF; o Compaj, com o contraponto de Minas; a Petrobras, que não foi privatizada) com **o que o jogo pode dizer, o que não afirma e a fonte**. **O resultado é misto**, e a ficha diz isso: nenhum cartão afirma "privatizou, ficou pior e mais caro". As fontes primárias ainda não foram lidas.

**Provas:** **16 testes da regra pura** (`CabosDeDados.test.ts`: a injeção, o teto de três, a recuada, o cabo tomado que não se libera sozinho, a liberação por um e por dois defensores, o dano, o cabo cortado que não injeta, o conserto, o depredador que impede o conserto, a independência dos cabos, o reset, e **determinismo e invariantes sob 36 mil ticks de entrada aleatória**); **6 testes de partida** (`Match.cabos.test.ts`, no Match de verdade: só existem na missão em ondas da praia, os andróides vão aos pontos com `hold`, o andróide parado se liga e o cabo é tomado e drena além do invasor, o jogador libera, o Mech depreda e o jogador conserta, `restartMission` zera); o dreno extra do núcleo, os avisos do HUD, o letreiro (frases, opacidade, alturas, sem DOM) e o uniforme do shader. **12 de 12 mutações à mão pegas.** Os testes antigos da praia passam sem mudança.

**Onde o Comandante confere:** jogar `?modo=survival&mapa=praia` e olhar os três cabos no pátio (entre a escotilha e a fachada): os andróides da onda 1 vão cada um a um cabo e se ligam; deixe um ligado e veja a barra e o letreiro; chegue perto sem andróide para liberar. Capturas: `arte/praia-cabos-c1-d72-claude.jpg` e `arte/praia-cabosdalinha-c1-d72-claude.jpg` (um cabo injetando, um tomado, um cortado, no início da noite). Para ver sem jogar: a bancada `praia.mjs --cabos "1:0.6:1,2:1:0.7,3:0:0"`.

**Falta (R13):** **o equilíbrio jogando** (cada número é linha de tabela em `CabosDeDados.ts`; a onda 1 agora tem dois andróides que vão aos cabos, e eles já contavam como invasores dentro dos muros); a **parte B** (a segunda entrada do prédio e o **manifestante** como NPC), a **C** (o porto, os contêineres e o quadro de luz) e a **D** (a Colossus em três fases); os lugares só de andróide e drone (P149); o dano **a tiro** nos cabos; as **fontes primárias** da ficha de fatos. **Só offline**: a missão em ondas não vai para a rede (como o núcleo). A varredura de NaN na GPU real **não rodou de novo** com o brilho dos cabos aceso (a ferramenta não carrega a missão em ondas); o shader novo não tem `pow` sem guarda.

**Próxima sessão começa com:** o que o Comandante achar do equilíbrio dos cabos; senão, a **parte B** (o prédio com a segunda entrada e o manifestante), e o **quadro de luz** do porto (P164) ligado no `lampadas`.

## LANDING E PRIMEIRO ACESSO — entrega P169 (Codex, 16/10)

Branch de origem `codex/landing-primeiro-acesso`, pasta `.tmp/wt-codex-landing`; `main` fc2d1ba integrada, preservando os explosivos dos bots. A disponibilização ocorre pelo merge desta revisão na `main` e pelo publicador com checksum. Não considerar o branch isolado como publicado. Território: landing, tema/painel público, verificações do site, texto/CSS do primeiro acesso e `client/public/press/`.

Landing com abertura industrial preto/amarelo, câmeras interativas, seis sistemas de combate, três chassis com números e links da montagem real, modos e guia inicial. Fotografias geradas com os rigs do Vector-09, Marauder e Colossus-V4; thumbnails de cenário são capturas existentes. A Oficina mantém as tabelas extensas. A fila interna de decisões e os trechos operacionais deixam de ser republicados; o painel local conserva esses dados. Registro literal do dono preservado.

Validação inicial: `npm run check` verde (2.420 testes); desktop 1440×1000/1280×720 e celular 390×844 sem overflow, imagens ausentes ou erro JavaScript. Primeiro acesso e expansão do console conferidos. Revisão cruzada realizada; foco de teclado dos CTAs corrigido. O hook do push revalida a integração final. Provas em `medicoes/LANDING_P169.md` e `arte/*landing-codex*`. Nenhuma alteração de simulação ou rede.

Próxima sessão começa pelo julgamento visual do Comandante e pela medição do funil de primeira partida; ganho de conversão/retorno ainda não medido. Caminhos: raiz de `cybermech.online` e `/jogar/?primeira`.

## OS REBELDES LANÇAM EXPLOSIVOS: salvas de foguetes e granadas contra você — Claude, 16/10 (branch `claude/bots-explosivos`, P160 parte 4)

**A ordem (16/10):** *"bote pra torar na iteração das armas"*.

**Feito:** o Mech bot lança a arma **explosiva** da mão esquerda em **salvas** (`BotController.useExplosives`, `BotSystem.launch`): o casulo de foguetes de fábrica do Vector-09 inimigo (que nunca era usado), e o que o esquadrão der (granadas, teleguiado, lançador leve, cruzador, chuva), pelos mesmos sistemas do jogador. Dois tiros por salva, pausa de 7 s no normal (pela dificuldade e pela personalidade), mira no pé de onde o alvo vai estar, nunca de perto. O lançamento do bot toca o som da arma, mais baixo de longe. O editor de esquadrão passou a oferecer as armas explosivas na mão esquerda do bot.

**Medido (90 s, jogador parado):** offline padrão, 50 explosões em vez de 3 e o jogador apanha menos (os aliados também lançam); Arena do servidor, +34% de dano. As fotos da partida padrão foram refeitas (`esquadraoPadrao.test.ts`, como o teste manda).

**Provas:** 7 testes e **8 mutações à mão, 8 pegas** (`combat/botExplosivos.test.ts`: a pausa por dificuldade e personalidade, a distância mínima (também com o rebelde colado a 9 m: a mutação que tirava a regra escapou até esse teste existir), salvas de até 2 a cada 0,3 s com a pausa entre elas e nunca de perto, o mesmo jogo dá os mesmos lançamentos, desligado não lança, o esquadrão com granadas lança granadas).

**Onde o Comandante confere:** jogar a Arena: os rebeldes soltam pares de foguetes (fita de fumaça e bola de fogo); um esquadrão com granadas na mão esquerda dos rebeldes (editor de esquadrão).

**Próxima sessão começa com:** o que o Comandante disser jogando; os bots com o laser.

## O LANÇAMENTO DE HOJE (P168): o que está de pé, o que segura e o que é do Comandante — Claude, 16/10 (branch `claude/lancamento-lista`)

**A ordem (16/10):** *"vamos lançar nosso jogo hoje ainda"*. Verificado **hoje às 14h50**, não de memória:
- **O site está no ar com o que está na `main`:** `cybermech.online` responde 200 e o pedaço do jogo com o ciclo do dia (`Game-BG1f9Idc.js`) no ar é **byte a byte o do build local** (`PUBLICADO: c88515b`, conferido por checksum).
- **O servidor de jogo responde:** `https://jogo.cybermech.online/status` devolve 200 pela Cloudflare.
- **O jogo e as armas:** 20 armas, a praia com o ciclo do dia, as missões em ondas e o esquadrão (offline) estão na `main`; o `npm run check` rodou verde no push.

**O que NÃO existe, e o jogador sente:**
1. **Login e ranking (P145):** não foram construídos. O jogo roda **anônimo**; sem ranking, o jogador não tem o que voltar para melhorar. *É a maior lacuna de retenção.*
2. **As falas do narrador:** **4 de 76 clipes** existem (o "combate" nos 4 sotaques). O resto fica **mudo** (só "rodada" e "combate" caem na voz do navegador). Falta o Comandante rodar **`npm run vozes -- --custo`** e depois **`-- --gerar --sim`** (72 clipes), ou gravar as falas no Estúdio (aba VOZES).
3. **Aviso de privacidade (LGPD):** **não há página** no site. O jogo manda telemetria de partida para o servidor; antes de divulgar para gente de fora precisa de um texto curto dizendo o que se guarda. *Posso escrever o rascunho; o e-mail de contato e a decisão do que guardar são do Comandante.*
4. **O dia no online:** cada jogador vê o dia pelo relógio do próprio mapa (o servidor já manda `restanteS`; falta ligar).

**O que é só do Comandante (nada disto eu consigo fazer):**
- **Girar a chave do ElevenLabs** (foi colada no chat em 15/10) e rodar a geração das vozes.
- **Cloudflare, no painel:** limite de requisições em `/conta/*`, Bot Fight Mode, DNSSEC; tirar `jogo.selvamkt.com.br` do túnel quando quiser (o endereço novo já funciona).
- **Jogar e julgar:** o ciclo do dia (`?mapa=praia&dia=0.55`), o som das armas e as vozes.
- **Divulgar:** o placar de resultado diz *"na internet, nenhum teste com gente"*: **o lançamento é o primeiro teste**. Recomendação: **lançamento brando hoje** (um grupo pequeno, com o servidor em `/status` aberto ao lado), e só depois o vídeo.

**Próxima sessão começa com:** o que o Comandante responder sobre a lista acima; senão, **login e apelido (P145)** e o **aviso de privacidade**, e o capítulo 1 em fases (P162 a P165).

## O CICLO DO DIA DA PRAIA: pôr do sol no começo, noite com as luzes acesas em 5 minutos; e as ordens da campanha registradas — Claude, 16/10 (branch `claude/campanha-cabos`, P161 a P168)

**As ordens do Comandante (16/10):** o cenário estava claro demais para a hora do sol e com a iluminação pública toda acesa de dia (*"o melhor seria que o cenário começasse de dia e no final do tempo já estivesse de noite… aí as luzes acendem"*); e, lendo o `CAMPANHAS_E_CHEFES.md`, **a história da campanha** (os cabos como pontos de invasão, as três frentes da estação, o quadro de luz, o banco, a máscara da Colossus, o elenco, o norte educativo). E: *"vamos lançar nosso jogo hoje ainda"*.

**Feito (P161, no jogo):**
1. **`environment/CicloDoDia.ts`** (puro, com teste): a curva do dia de 0 a 1 (sol de 0,085 acima do mar a −0,24; a noite fecha quando ele está bem abaixo; as lâmpadas acendem **depois** do pôr do sol), a escolha do relógio (**missão em ondas**, depois **rodada de 5 minutos**; no intervalo a noite fica fechada; Domínio, Bandeira e online usam o relógio do mapa) e o `?dia=` do link.
2. **`Praia.setProgressoDoDia`**: muda a altura do sol e da lua (o azimute **não** muda: as sombras assadas continuam valendo), as três luzes (o sol apaga e avermelha, a hemisférica esfria, a lua sobe), a névoa (rosa → roxo → azul-noite) e a luz de ambiente. Começa **mais escura que antes** (o pedido).
3. **O céu** ganhou o céu da noite, **estrelas** (um ramo do shader que só roda de noite), nuvens de vulto e a lua subindo; **o mar** escurece, perde o caminho de sol e a espuma apaga; **as fachadas** deixam de refletir o sol que se pôs e **acendem mais janelas** com as lâmpadas.
4. **A iluminação pública acende poste por poste**: cada adereço público (poste, refletor, torre de vigia, varal da barraca, farol) tem **o seu instante**; o **bulbo desenhado na malha**, o **halo**, as **poças no chão**, os **feixes** dos refletores e o **farol** ligam juntos. A sinalização (aviso das antenas, boias, navios, semáforos) fica sempre ligada. De dia é só um fio de brilho.
5. **Achado e corrigido no caminho (R17):** o mar lia uma **cópia congelada** do uniforme de tempo (`UniformsUtils.merge` clona), então as ondas ficavam paradas no instante 0. Agora leem o mesmo uniforme da praia.

**Provas:** 19 testes novos (`CicloDoDia.test.ts`: a curva, o relógio, o `?dia=`, as lâmpadas públicas e a sinalização, e a praia de verdade: luzes, névoa, uniformes de céu e mar, o azimute, o bulbo e o halo no mesmo instante, valor torto); **0 NaN em 720 poses na GPU real** (`varrer-nan.mjs --dia 0 / 0.55 / 1`); a contagem de desenhos **não mudou** (51 a 52); capturas em `arte/praia-sol-d*-claude.jpg` e `arte/praia-orla-d*-claude.jpg` (d0 = pôr do sol, d55 = as luzes acendendo, d100 = noite).

**Onde o Comandante confere:** jogar a praia (`?mapa=praia`, ou o modo de ondas) e esperar; ou `?mapa=praia&dia=0`, `&dia=0.55` (as luzes acendendo) e `&dia=1` (noite).

**A campanha (P162 a P167): registrada, não construída.** `CAMPANHAS_E_CHEFES.md` § 0 tem agora as respostas do § 5, o Capítulo 1 em três frentes (cabos com dano e reparo, os pontos de conexão e a injeção com o efeito de dados, o prédio com duas entradas, o porto de onde os inimigos saem dos contêineres e o quadro de luz da cidade), os lugares só de andróide e drone, o capítulo do banco, a máscara da Colossus V1 como skin de chefe e o elenco. **Duas coisas que Claude não fará e o Comandante pode contestar (P166):** criança com arma e personagem desenhado como evangélica (religião fica fora do alvo, a regra do § 2); e o "mulheres" do código do banco. A regra de redação nova: **sátira exagera, fato tem fonte na ficha.**

**Falta (R13):** o julgamento do Comandante (brilho, cores e tempo do dia: são linhas de tabela em `Praia.ts`); o **relógio da rodada no online** (hoje cada jogador vê o dia pelo relógio do próprio mapa; o servidor já manda `restanteS`); o **quadro de luz do porto** (P164); a construção do capítulo 1 em fases; a tela de entrada e o link de convite (P167); login e ranking (P145).

**Próxima sessão começa com:** o capítulo 1 em fases (os pontos de conexão como módulo puro com teste em `sim/`, o dano e o reparo dos cabos); e a **lista do que ainda segura o lançamento** (P168).

## O "TESTAR" DO HANGAR COM A CARA DO JOGO: cada arma testada como ela é — Claude, 16/10 (branch `claude/hangar-testar-efeitos`, P160 parte 3)

**Por quê:** em 15/10 o Comandante disse das armas novas que "pareciam armas antigas". O "Testar" do Hangar desenhava todo tiro com o mesmo traço (ciano na energia, laranja na munição).

**Feito:** `hangar/TestShots.ts` passa cada tiro do teste pela camada de efeitos do jogo (clarão da boca, brilho, rastro em fita, clarão do acerto, faíscas da arma, explosão com corpo, feixe do laser, raio do trilho), na **trajetória da família**: reta na velocidade da arma, a salva do lançador leve com o desvio, os **nove balins** da escopeta em cone, o **arco** do cruzador e o **arco** da granada. O contador de dano do teste passou a contar os balins (R17).

**Provas:** 8 testes (`hangar/TestShots.test.ts`: o arco da granada termina no alvo, o cruzador sobe, os nove balins em pontos diferentes, o laser na hora, o foguete com rastro e explosão, a salva espalhada, o teto do pool, o dano dos balins). Fotos do Hangar na GPU real: `arte/armas-hangar-teste-foguetes-claude.jpg`, `-enxame-`, `-escopeta-`, `-granada-`.

**Onde o Comandante confere:** Hangar → escolher a arma → **▶ TESTAR · 4 S**.

**Próxima sessão começa com:** os bots usarem as armas explosivas (foguetes, granadas, lançador leve) — hoje o inimigo só atira energia.

## O LANÇA-GRANADAS: o primeiro tiro com gravidade, que sobe por cima da cobertura, e a mira prevista em arco — Claude, 16/10 (branch `claude/lanca-granadas`, P160 parte 2b, protocolo 19)

**Feito:** arma nova **`grenade`** (Lança-granadas, média, 3,5 t; braço e ombros do Marauder). A granada **cai no ponto da mira**: o lançador sai no arco baixo (42 m/s) e, se a cobertura o barra, **sobe a elevação (35° a 75°) e regula a carga** para passar por cima e cair no ponto (até 80 m no plano). **Explode no robô**, **tabela na parede**, **crava no chão** e estoura 0,35 s depois (a ~2 m de onde a mira marcou). 34 de dano no centro (48 no MK III), 5 m de explosão, 4 por carga, 1,6 s por granada. Com a arma equipada, a **mira prevista**: o arco em pontinhos e o anel do tamanho da explosão. Rede: **protocolo 19** (um evento de tiro por granada, com a direção da mira; o outro cliente refaz o arco). Modelo 3D (tambor de seis câmaras), ícone, retícula, ficha, som (o do canhão, mais agudo, no Estúdio), oficina e site.

**Provas:** 12 testes (`combat/grenade.test.ts` e o do servidor em `server/room.test.ts`), **12 mutações à mão, 12 pegas** (a primeira rodada achou um teste fraco: sem o ramo da granada no servidor, o tiro virava um foguete reto que também acertava; o teste agora exige a granada no sistema de granadas). Capturas: `arte/armas-granada-bancada-claude.jpg` (o arco subindo por cima do muro com a mira prevista; e sem muro) e `arte/armas-granada-gpu-claude.jpg` (no jogo, na GPU real).

**Onde o Comandante confere:** Hangar → Vector-09 → braço esquerdo → **Lança-granadas** (ou os ombros do Marauder); jogando, o anel verde mostra onde cai; mirar atrás de uma barricada e ver o arco subir.

**Falta (R13):** os bots não usam; ninguém jogou (os números são proposta); o desenho da granada de outro jogador é refeito pelo cliente.

**Próxima sessão começa com:** o que o Comandante disser depois de jogar as partes 1, 2a e 2b da P160; depois, os bots usarem as armas novas (lançador leve, cruzador, laser, granadas).

## A ESCOPETA SAI EM BALINS: nove num cone, a queda vem da geometria — Claude, 16/10 (branch `claude/armas-balistica`, P160 parte 2a)

**Feito:** a escopeta (`shotgun`) sai em **nove balins de 6 num cone de 3,4°** (`pellets`), nascidos no `ProjectileSystem.fire` (vale para o jogador, os bots, o servidor e o tiro de outro jogador, com **um** evento de tiro por disparo e o mesmo desenho fixo, sem sorteio). Medido com física de verdade, o disparo inteiro: **54 até 10 m**, 45 aos 15–20 m, 32 aos 25–30 m, 15 aos 40 m (só 5 balins pegam: o cone tem 4,8 m), 10 aos 50 m. Tempo para derrubar um torso de perto igual ao de antes (4,0 s / 3,2 s). Os balins que acertam juntos viram **um** número de dano e **um** som. Fichas (Hangar, ARSENAL, site) mostram "9 × 6".

**Provas:** 7 testes novos (`combat/pellets.test.ts`: nove projéteis, um evento, o primeiro no centro, todos no cone, mesmo desenho a cada disparo, pool cheio; com física, 9 de 9 a 6 m e no máximo 5 a 40 m) e os de equilíbrio da escopeta reescritos para o disparo inteiro.

**Onde o Comandante confere:** Hangar → um braço com **Escopeta** (ou o Lancer) → atirar num inimigo de perto (um "54") e de longe (os balins espalham).

**Falta:** a parte 2b da P160 (arma de arco com gravidade); o julgamento do Comandante sobre a escopeta mais forte entre 15 e 30 m.

**Próxima sessão começa com:** a parte 2b da P160 (granada que quica, com a trajetória prevista na mira; protocolo de rede novo).

## A CARA DOS TIROS: explosão com corpo, rastro em fita, clarão e marca por família de arma, e o Mech destruído que explode — Claude, 16/10 (branch `claude/armas-impacto`, P160 parte 1)

**A ordem do Comandante (16/10):** *"use a capacidade máxima do modelo OPUS 5.5, e evolua nossas armas, balísticas, shape, cor, potência, alcance, dano, pra ficar realmente BOM o nosso jogo. pense se temos que implementar novos estilos, tipos, formas, etc. … vejo diversos jogos feitos com gpt astra, claude opus 5.5, em 3d, e acho eles ABSURDAMENTE FODAS"*.

**Diagnóstico:** o arsenal já tem 20 armas; o que separava o jogo era a **sensação** de cada tiro. A explosão era só uma nuvem de pontos que somava luz (a "fumaça" também somava, então nunca escurecia), o rastro de míssil uma fila de pontinhos, todo tiro de energia a mesma risca, o trilho uma linha de 1 px, e nada ficava onde o tiro batia.

**Feito (só desenho: nenhum número de arma mudou):**
1. **Explosão com corpo** (`fx/Explosions.ts`): clarão, **bola de fogo low-poly que ferve** e esfria do amarelo ao vermelho, **fumaça escura de verdade** (mistura normal, acesa por dentro pelo fogo no começo, que sobe e se desfaz), **estilhaços em brasa** que voam, quicam e esfriam, faíscas, e no chão o **clarão no asfalto**, a **onda de choque** e o **queimado**. Escala com o raio da arma (míssil leve pequeno, cruzador grande). O **Mech destruído explode** do tamanho dele (`WeaponFx.wreck`).
2. **Rastro em fita contínua** (`fx/Ribbons.ts`): a fumaça (que abre, ondula e sobe) e a língua de fogo do motor em foguete, teleguiado (azul-frio), míssil leve (fita fina), cruzador (fita grossa que desenha o arco), bombas da chuva e obus do canhão.
3. **Clarão da boca, brilho da cabeça e clarão do acerto por família** (`fx/Billboards.ts`, tabela `fx/weaponLook.ts`): plasma como bola de luz verde com núcleo, metal em brasa com língua de pólvora, trilho azul, elétrica que pisca, gelo, EMP em aro; o inimigo em cor de aviso.
4. **Marcas** (`fx/Marks.ts`): furo quente na cor do tiro que esfria, geada do gelo, queimado do laser — só em superfície parada.
5. **Raio iônico do trilho** (era 1 px) e o **feixe do laser** com borda macia e energia correndo (`fx/BeamVisuals.ts`).
6. **Tranco de câmera** que escala com a explosão (`explosionShake`: o cruzador a 70 m ainda sacode; antes parava aos 40 m para qualquer uma).
7. A simulação de tiro só **avisa** (`ShotFx`, campo opcional `fx`); o servidor não monta nada. A varredura de NaN ganhou `--efeitos` (`FERRAMENTAS.md` § 4.1).

**Provas:** 19 testes novos (`fx/WeaponFx.test.ts`: tetos dos pools, vida, nada de NaN nos buffers, a fita de lado para a câmera, marca só em superfície parada, cor do inimigo diferente da do jogador; `combat/shotFx.test.ts`: o contrato com os quatro sistemas de tiro, e que sem `fx` o servidor segue igual) com **23 mutações à mão, 23 pegas**; `npm run check` verde (2 357 testes); **GPU real (AMD): 0 de 192 poses com NaN com os efeitos acesos**; custo **0,45 ms por quadro sob carga extrema** (170 fitas, 219 peças de explosão, 160 cartazes, 80 marcas), 9 desenhos para todos os efeitos, nada alocado por quadro; JS **472,3 KB** de 500. Capturas: `arte/armas-impacto-bancada-claude.jpg` (15 quadros com os sistemas de verdade), `arte/armas-impacto-gpu-mech-destruido-claude.jpg` e `arte/armas-impacto-gpu-fumaca-claude.jpg` (o jogo na GPU real).

**Onde o Comandante confere:** jogar e atirar com **foguetes** (botão 2 do Vector-09), **plasma**, **trilho** e **canhão**; destruir um Mech; atirar numa parede e ver a marca.

**Falta (R13):** o julgamento do Comandante jogando (tamanho, cor, duração: tudo é linha de tabela); o Hangar ("Testar") ainda usa o traço de teste dele; o desfoque de dash. **Parte 2 da P160 (próximo PR):** balística e estilos novos — a **escopeta com balins de verdade** (hoje é um projétil só) e uma arma de **arco com gravidade**, com teste de simulação e a bancada de equilíbrio.

**Próxima sessão começa com:** a parte 2 da P160 (balins da escopeta primeiro).

## A ABA VOZES DO ESTÚDIO: gravar a própria voz, tratar e pôr no jogo, com a sua voz protegida do gerador — Claude, 16/10 (branch `claude/estudio-vozes`, P151)

**A pergunta do Comandante (15/10):** *"a voz do 'combate' em português está muito ruim… será que devo gravar e enviar pra editarmos minha própria voz com efeitos?"*. Respondido que sim; agora **é só gravar no Estúdio**.

**Feito:**
1. **Gravar no navegador:** a fala em letras grandes com a intenção (grave, grito, seco), **medidor de nível** (fica vermelho se estourar), **parada automática em 10 s**, microfone **cru** (sem cancelamento de eco, supressão de ruído nem ganho automático: o tratamento é nosso). O MediaRecorder entrega **webm sem duração**: o servidor o **converte para WAV mono 44,1 kHz** (duração real) e o guarda como **tomada numerada** em `.tmp/SOUNDS/VOZ/<sotaque>/`. A tomada nova já abre **aparada**. **Importar** uma gravação feita fora também funciona.
2. **Tratar:** **os mesmos efeitos dos sons** (a interface de efeitos virou um componente do núcleo, `efeitosUi`, e a aba SONS passou a usá-lo: uma só verdade), com **cinco predefinidos de voz** (Locutor grave, Arena, Rádio de comando, Limpo, Demônio), **redução de ruído** para microfone, e a **prévia com o motor real**.
3. **Salvar como a fala do jogo:** grava `scripts/vozes-gravadas.json`, processa o mp3 (**-16 dB de média**, nível de voz) em `client/public/audio/vozes/<sotaque>/<chave>.mp3` e põe a fala no manifesto: **o jogo já a toca**. A voz gerada que estava ali fica em `_elevenlabs/`; **"Voltar para a voz gerada"** a devolve, byte a byte.
4. **A sua voz é protegida:** o `npm run vozes` **nunca regera** uma fala gravada por você, **nem com `--refazer`** (o resumo avisa quantas protegeu).
5. O validador de clipes ganhou **regras de voz** (nome `<chave>.mp3`, até 8 s depois dos efeitos; as de arma seguem com 4 s).

**Provas:** **12 testes** novos do servidor (o webm do navegador convertido, a taxa e o mono do WAV, a numeração, o lixo recusado sem deixar arquivo, a validação, o processar com a cópia da voz gerada, o reverter, a prévia sem gravar nada) com **6 mutações à mão, 6 pegas**; e a **bancada `medicoes/estudio.mjs`** estendida com o **microfone de teste do Chrome**: gravar, aparar, ligar o predefinido, prévia, salvar, conferir o mp3 trocado e voltar para a voz gerada byte a byte (**29 verificações** no total, numa cópia). Captura: `arte/estudio-vozes.png`.

**Falta (R13):** **o Comandante gravar** (nenhuma fala sua existe ainda; o Claude não ouve áudio: a escolha do predefinido e dos números é do ouvido dele); o **microfone real** depende da permissão do navegador (a página avisa se negada); o **Voice Changer** do ElevenLabs (gasta crédito: fica com `npm run vozes`); o **item no console de comando** (P156); as abas **TIROS E ARMAS** e **MECHS 3D** (P157).

**Próxima sessão começa com:** o que o Comandante responder depois de gravar; senão, o item do Estúdio no console de comando (P156), e o apelido (P145).

## O ESTÚDIO VIRA UM HUB: importar sons que já saem registrados, efeitos (tom, velocidade, compressor, eco…) e prévia com o motor real — Claude, 16/10 (branch `claude/estudio-v2`, P155 a P157)

**As ordens do Comandante (16/10):** *"vamos evoluir mais essa interface do gerenciamento do som: eu enviar um novo som e ficar salvo e registrado corretamente como se tivesse sido adicionado por você; aumentar ou diminuir o pitch e a velocidade, cortar, esticar, comprimir, etc. Da mesma forma que temos a MESA pra editar vídeos, teremos também o estúdio, e futuramente editar os Mechs 3D, armas, tiros (cor, shape, cauda, explosão, força)"*.

**Feito:**
1. **Importar e registrar:** arrastar um arquivo para a página o guarda, cria **um clipe com nome único** (`arma_<nome>`, com sufixo se repetir), corta o começo, o **registra** no mapa, o **processa** e o **abre**, pronto para escolher numa arma. Arquivo corrompido é recusado e **não deixa lixo**.
2. **Motor de efeitos (`scripts/efeitosLib.mjs`):** por clipe, **velocidade** (0,5× a 2×) ou **duração alvo**, **tom ±12 semitons independente da velocidade** (`rubberband`; sem ele, `asetrate` + `atempo`), graves, agudos, passa-alta, passa-baixa, **redução de ruído**, **saturação**, **compressor** (leve, médio, forte), **eco**, **reverso** e **fades**; tudo limitado e validado. **A prévia e o arquivo final usam a mesma cadeia** (`cadeiaBase`), e o volume é medido **depois** dos efeitos; a duração que vale (limite de 4 s, fade, duração máxima da arma) é a de **depois** da velocidade; a cauda do eco e do tempo é cortada na duração final.
3. **Prévia (`POST /api/sons/previa`):** roda o ffmpeg com o clipe como está na tela (salvo ou não) e devolve o som, **sem gravar nada no jogo** e sem deixar arquivo; a onda do resultado aparece; "▶▶ no ritmo" usa a prévia (o som de verdade, com os efeitos).
4. **Hub de módulos:** o núcleo (`scripts/estudio.mjs`) guarda a segurança **uma vez** (127.0.0.1, Host e Origin, nome de arquivo, teto, gravação atômica) e serve a página, os scripts e o estilo; **SONS** é `scripts/estudio/modulo-sons.mjs`; as abas **TIROS E ARMAS** e **MECHS 3D** aparecem "em breve". `scripts\ligar-estudio.cmd` (dois cliques), como a Mesa. Um painel mostra **o que ainda não foi para o jogo publicado** (lê o git) e o que dizer: **"publica os sons"**. O Estúdio **não publica** de propósito.
5. **`ESTUDIO.md`:** a visão, o contrato de um módulo (dado + validador + prévia + processador), a segurança e o desenho de **VOZES** (gravar no navegador), **TIROS E ARMAS** (cor, forma, cauda, explosão, brilho em dado + cena do Three.js; a **força** com o relatório de equilíbrio ao lado e teste de simulação) e **MECHS 3D** (visualizador, encaixes, importar `.glb` pelo `mech:inspecionar`).

**Provas:** **32 testes** (o motor de efeitos, a montagem do ffmpeg, o servidor inteiro com o ffmpeg de verdade) com **6 mutações à mão, 6 pegas**; e a **bancada `medicoes/estudio.mjs`** (17 verificações num Chrome real, com as referências reais, numa **cópia**: ela chegou a sujar a pasta real de referências na primeira versão, corrigi e removi o arquivo de teste). Capturas: `arte/estudio-de-sons-efeitos.png`.

**Falta (R13):** **o Comandante usar** (o Claude não ouve áudio: a prévia, a escolha dos efeitos e o ritmo são do ouvido dele); a aba **VOZES** (gravar a própria voz no navegador, P151); o **item no console de comando** (P156); as abas **TIROS E ARMAS** e **MECHS 3D** (P157).

**Próxima sessão começa com:** a aba VOZES (P151), se o Comandante confirmar a prioridade; senão, o que ele disser depois de usar o estúdio.
