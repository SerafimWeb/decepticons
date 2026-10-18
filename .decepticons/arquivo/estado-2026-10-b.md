# ARQUIVO — ESTADO_ATUAL (quinzena 2026-10-b)

> Texto movido sem alteração de `ESTADO_ATUAL.md` por `npm run arquivar`. Não editar: o vivo é o documento principal.

<!-- arquivo -->

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
