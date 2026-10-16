# GAME DESIGN — CYBERMECH

> O que o jogo é e por que cada decisão existe. As regras técnicas derivadas
> (G11–G14: economia de dados, requisitos, resiliência, código) moram em `PROTOCOLO_UNIVERSAL.md`.
> v1 — sessão de definição de 2026-09-23 (o dono aceitou os padrões propostos).

---

## PITCH

Abre o link, está jogando em segundos. Sem instalar, sem conta. Um shooter de Mechs em que você
arranca o inimigo peça por peça e derruba a cobertura dele.

**Diferencial:** destruição do cenário + dano por parte do Mech (perna quebrada = lento, cabeça = cego).
Toda prioridade de feature passa por aqui.

---

## TEMA E ESCALAS (decisão do dono, 2026-09-25)

**Tema:** IAs se rebelaram. A humanidade pilota Mechs para defender a cidade contra as máquinas rebeldes,
do robô do tamanho de uma pessoa ao Mech tomado pelas IAs.
**Universo em proposta** (`UNIVERSO.md`, 25/09): as IAs caçam chips, energia e dados; a SERAFIM responde ao incidente
com Mechs; a camada de inteligência fala a língua de CTI (incidente, TTPs, IOCs, boletins). Aguarda as decisões do dono.

| Escala | O que é | Hoje no jogo | Como luta |
|---|---|---|---|
| **1** | Robôs autônomos do tamanho dos humanoides e quadrúpedes de hoje (~1,6 m) | **Andróide de combate** (KUEN, DIPSIK, MISTRAU): casco branco, visor vermelho, blaster no antebraço. **Técnico** (ENTRÓPICO): visor amarelo, conserta os Mechs | **Mais chato do que perigoso:** cai com 2 tiros de plasma ou **2 pisões** de Mech; ataca com **motosserra**, que só corta encostado e pega as pernas do Mech; muito ágil (arranca na hora, pula duas vezes, desvia com dash) |
| **2** | Mechs de combate (~5 m) | **Vector-09** (o jogador) e Mechs rebeldes (CLAWD, GEMINAI, CHAD-GPT) | Blindado, dano por parte, calor na arma, foguetes |
| **3** | Gigantes: máquinas de cerco (14 m) | **Colossus-01** (chefe da missão e chassi solo pilotável) | Lento e blindado; **leva as armas pesadas dos Mechs como armas leves** (P82); as médias e pesadas dele são versões futuras de tamanho 3 |
| **4** | Gigantes maiores (futuro) | ainda não | a definir; as leves dele serão as pesadas do tamanho 3 |

- **Armas por tamanho (dono, 11/10, P82):** toda arma é **leve, média ou pesada**, e a classe é relativa a quem carrega: a pesada do tamanho 2 (o padrão do jogo) é a leve do tamanho 3 (`ARSENAL.md`, `combat/weaponClass.ts`). Versões de arma para os tamanhos 3 e 4 são futuras.
- **Nomes (dono, 25/09: "pra ficar mais engraçado"):** as IAs rebeldes levam nomes de IAs de verdade (`BOT_NAMES` em `combat/BotSystem.ts`), com o nome e a personalidade sobre a cabeça. São marcas registradas: antes do lançamento, decidir se viram paródias.
- **Guia visual e briefing para IA de imagem:** `ESTILO_ROBOS.md`.
- O visual segue a regra da produção: tudo gerado por código. Nada de marca real: os robôs lembram os de hoje sem copiar nenhum.
- Próximo na escala 1: um quadrúpede (cão-robô), mais rápido e mais baixo, que obriga a mirar para baixo.

**Funções da escala 1** (dono, 25/09). Os humanoides fazem o que um humano faria no campo de batalha:
| Função | O que faz | Situação |
|---|---|---|
| Combate | Enxame chato: chega perto, zigue-zagueia, atira fraco | no jogo |
| **Técnico** | Conserta os Mechs rebeldes com um feixe (a parte mais avariada que ainda existe); foge do jogador; escolta quando não há o que consertar. **Alvo prioritário** | no jogo |
| Coletor | Junta peças dos destroços para reconstruir partes arrancadas (o técnico sozinho não traz parte de volta) | planejado |
| Logística | Leva munição e foguetes aos Mechs | planejado |
| **Piloto** | Embarca em máquinas vazias do hangar e pilota, como um humano (Mech sem piloto fica parado; matar o piloto desliga o Mech) | planejado, junto com o Hangar |

---

## VITRINE (o que a landing mostra ao jogador)

> A landing do site (`/cybermech/`) lê esta lista. Só entra o que está REAL no `STATUS_REAL.md`: feature nova no ar
> → uma linha aqui; feature que saiu → sai daqui. Formato: `- **Título:** frase curta para quem vai jogar.`

- **Dano por módulo:** ataque braços, pernas, cabeça ou torso. Cada parte tem sua própria integridade e influencia a capacidade de combate.
- **Gestão térmica:** disparos e manobras acumulam calor. Controle o ritmo de ataque e o resfriamento para evitar o superaquecimento.
- **Arsenal configurável:** combine armamentos e níveis MK dentro da capacidade de carga do chassi. Salve e compartilhe sua montagem por link.
- **Mobilidade tática:** use dash, saltos e cobertura para abrir ângulos de ataque e escapar da linha de tiro.
- **Oponentes com perfis distintos:** enfrente unidades agressivas, de apoio e de emboscada. Ajuste a composição dos esquadrões nas opções de partida.
- **Cobertura destrutível:** barricadas se fragmentam sob ataque. Reavalie sua posição conforme a arena se transforma.
- **Desafios Diários e Progressão:** suba o Nível de Piloto, acumule Créditos ₵ e resgate recompensas cumprindo 3 missões diárias.
- **Cobertura que quebra:** as barricadas viram destroços; a proteção do inimigo não dura para sempre.
- **Dash e pulo duplo:** um Mech pesado que ainda assim escapa, flanqueia e muda de altura.
- **Três câmeras:** terceira pessoa, cockpit em primeira pessoa e visão tática de cima.
- **Mira do seu jeito:** calibração pelo movimento real do mouse, entrada crua e teclas remapeáveis.
- **Áudio de combate:** sons de armas e efeitos acompanham os disparos, impactos e alertas da partida.
- **Foguetes no braço esquerdo:** quatro no carregador e dano em área; exploda no pé do inimigo para arrancar a perna.
- **Calor que decide a troca de tiros:** tiro, corrida, pulo, dash e até levar tiro esquentam o Mech; parado ele esfria em dobro. Quem administra o calor causa mais dano; quem dispara tudo correndo trava.
- **Montagens compartilháveis:** configure seu Mech no Hangar e compartilhe a combinação por link.
- **Dano que respeita a distância:** o plasma perde força depois de 60 m; chegar perto rende, mas expõe.
- **IAs rebeldes de dois tamanhos:** Mechs blindados e andróides pequenos e ágeis que chegam perto, pulam e desviam.
- **Motosserras e pisões:** os andróides grudam nas suas pernas com motosserras; ande para cima deles e dois passos esmagam.
- **Ajuste as potências:** mude o dano, a vida e a velocidade de cada arma e de cada lado, veja na hora o que isso faz com a luta e mande o link do seu ajuste para quem quiser.
- **Jogue a pé:** troque o Mech por um andróide de 1,6 m com blaster e motosserra e enfrente Mechs com mais que o triplo da sua altura.
- **Técnicos inimigos:** andróides de visor amarelo consertam os Mechs rebeldes; derrube eles primeiro.

---

## HORIZONTE (em estudo; sem data prometida)

> Direções futuras; não representam funcionalidades disponíveis nem compromisso de entrega.

- **Mapas maiores e mais jogadores:** ampliar capacidade após medir custo de servidor, banda e render, com otimizações graduais para preservar latência e hardware integrado.
- **Tripulação de dois operadores:** piloto conduz o Mech; artilheiro opera mira e armas. Bots poderão ocupar uma função em testes.
- **Drones voadores pequenos:** unidades de reconhecimento menores que os andróides; escala e regras ainda serão definidas.
- **Transporte de unidades:** veículos e plataformas para levar Mechs, andróides e tropas pelo cenário.
- **Missões de sobrevivência em fases:** operações contra andróides humanoides, humanos e Mechs, inspiradas no ritmo de sobrevivência de *Project Zomboid*. Persistência, objetivos e formato ainda serão definidos.

As ideias são detalhadas em `METAGAME.md` § 10 e permanecem sem prioridade aprovada até decisão do dono.

---

## PRODUÇÃO: TUDO EM CÓDIGO (decisão do dono, 2026-09-24)

O dono dirige e as IAs constroem; nada é feito à mão, peça por peça. O investimento vai para jogabilidade,
criatividade e para a configuração dos robôs (o que testa a habilidade real do jogador), não para anos de modelagem.
- **Sem Unity:** seria reescrever o jogo, e o download passaria de ~1 MB para dezenas de MB. Abrir o link e jogar em segundos é o pitch.
- **Sem modelagem manual no Blender:** os Mechs são montados por código a partir de peças (`entities/meshKit.ts`). Mech novo, arma nova ou pintura nova = parâmetros, não horas de arte. O estilo low-poly neon é escolha, e é legível até num celular.
- **Som sintetizado, texturas e animação procedurais:** nenhum arquivo pesado, tudo versionado e revisável como código.
- **Se um dia faltar detalhe:** peças mais ricas também saem de código (geometria procedural, ou scripts que geram glTF), sem trabalho artesanal.
- **Onde a variedade nasce:** no Hangar (montar o Mech com chassi, armas e módulos equilibrados), não em modelos únicos feitos à mão.

---

## PRINCÍPIO: NÃO É PAY-TO-WIN (decisão do dono, 2026-09-24)

O jogo é feito para ser **muito bom e todo mundo querer jogar**, não para vender vantagem.
- **Nada que se compra ganha partida.** Dano, vida, velocidade, armas, mira e acesso a Mechs de combate são iguais para todos e se conquistam jogando.
- Se um dia houver dinheiro envolvido, é só estética (pintura, neon, decalques, efeitos) ou apoio ao projeto, nunca atributo de combate.
- Anúncio (se houver) nunca interrompe a partida: só entre rodadas.
- Qualquer proposta de feature que quebre isto é recusada, não importa quanto renda.

---

## DECISÕES

| Tema | Decisão | O que isso fixa na engenharia |
|---|---|---|
| Jogadores por sala | **8** | Servidor simula 8 Mechs a 60 Hz; orçamento de rede por sala (G11) |
| Modo inicial | **Todos contra todos, rodadas de 5 min** | Placar por rodada; sem times, sem objetivo |
| Entrada | **Entra e sai a qualquer hora, sem lobby** | Sala sempre aberta até 8; respawn rápido; sem matchmaking complexo |
| Contas | **Convidado com apelido** | Sem banco de dados, sem LGPD pesada na Fase 1 |
| Plataforma | **Desktop (mouse + teclado) primeiro; celular em construção** (o dono pediu em 24/09) | Toque gera o mesmo `MechInput` do teclado: a simulação não sabe de onde veio o comando |
| Distribuição | **Portal de jogos primeiro + link próprio** | SDK do portal, download pequeno |

**A definir no playtest:** tempo de respawn, dano e vida por parte, mapa (1 arena por enquanto).

---

## HANGAR (primeira tela disponível; módulos e progressão seguem planejados)

> Especificação técnica completa em `HANGAR.md`. Esta lista é a **especificação do Hangar**, não uma seção da
> landing: a landing mostra o Hangar pelos números do próprio jogo (planta dos encaixes, arsenal nos três
> níveis e a grade de montagens, de `dados.mjs → jogo()`), e a lista abaixo não se repete lá (dono, 27/09/2026).

- **Chassi:** escolha no Hangar entre o Vector-09 médio e o andróide A-1 leve; a troca de piloto recarrega a partida.
- **Encaixes:** monte as armas compatíveis nos braços e escolha entre MK I, MK II e MK III. Ombros e torso ficam reservados para módulos futuros.
- **Carga:** o peso das armas precisa caber no limite do chassi. O Hangar mostra o espaço livre e bloqueia uma montagem acima da capacidade.
- **Três níveis de poder:** toda arma tem MK I, MK II e MK III com a mesma regra (+20% de dano por nível, mais calor e +50% de peso). O MK III bate mais forte, mas rende menos por tonelada.
- **Calor do Mech:** todas as armas esquentam o mesmo dissipador. Disparar tudo junto trava o Mech antes de terminar o serviço: nenhum combo derruba de uma vez.
- **Simulação:** carga, calor, dano em 20 s e tempo estimado para derrubar um torso são atualizados na tela com os valores padrão do jogo. Ajustes experimentais de POTÊNCIAS não entram na previsão.
- **Salvo no aparelho:** a montagem fica no navegador e pode ser compartilhada por link. As armas novas entram no próximo respawn; mudar de piloto recarrega a partida.
- **Conquistado jogando:** a progressão ainda está planejada; o protótipo atual libera todos os níveis para teste. Nunca haverá vantagem comprada. À venda, só pintura e neon.

---

## LOOP DE JOGO

Entra pelo link → nasce → acha um inimigo → mira nas partes (perna, cabeça, braço) → derruba a
cobertura dele → morre ou mata → renasce em segundos → fim da rodada: placar → próxima começa sozinha.

---

## VIRALIZAÇÃO E RECEITA

O melhor de cada modelo, em ordem. Cada etapa só entra quando a anterior provar tração.

1. **Link de sala compartilhável:** "joga comigo" = uma URL com o código da sala. Zero fricção: sem conta, sem download.
2. **Modo streamer** (o dono vai fazer lives): sala com código fixo para a audiência entrar, câmera de espectador e HUD que some com uma tecla para tela limpa.
3. **Portal de jogos** (CrazyGames, Poki etc.): o portal traz o tráfego que um multiplayer novo não tem. Anúncios pelo SDK do portal **só entre rodadas**, nunca no meio do combate.
4. **Cosméticos** (pintura, neon, decalques, efeito de dash; **nunca atributo de combate**): quando a retenção justificar contas e pagamento.
5. **Passe de temporada:** depois dos cosméticos, se houver ritmo de conteúdo.

**Por que a destruição ajuda a viralizar:** parede explodindo e Mech perdendo a perna rendem clipe curto por si só. Não precisa de sistema de replay.

**Métrica de sucesso:** volta no dia seguinte (D1) e joga 3+ rodadas na primeira sessão.

> Esta lista é o **plano**; onde cada item encosta no código de hoje, qual peça falta e em que ordem eu faria,
> está em `DIVERSAO.md` (Qwen, 28/09).

---

## PRINCÍPIOS DE ARQUITETURA (pedido do dono)

Economia de dados, requisitos baixos, leveza, resiliência, código estratégico. As regras
mensuráveis estão em `PROTOCOLO_UNIVERSAL.md`:
- **G11:** economia de dados (orçamento de banda, snapshots, quantização)
- **G12:** requisitos mínimos e qualidade adaptativa
- **G13:** resiliência (reconexão, autoridade, falha isolada)
- **G14:** código estratégico (simulação única, teste por regra, custo explícito)
