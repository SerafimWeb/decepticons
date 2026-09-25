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

| Escala | O que é | Hoje no jogo | Como luta |
|---|---|---|---|
| **1** | Robôs autônomos do tamanho dos humanoides e quadrúpedes de hoje (~2 m) | **Andróide rebelde** (A-01, A-02…): casco branco, visor vermelho, blaster no antebraço | Pequeno, frágil (3 tiros de plasma), tiro fraco, mas **muito ágil**: arranca na hora, pula duas vezes, desvia com dash; chega perto e zigue-zagueia |
| **2** | Mechs de combate (~5 m) | **Vector-09** (o jogador) e Mechs rebeldes (KESTREL, MAKO, VIPER) | Blindado, dano por parte, calor na arma, foguetes |
| **3** | Máquinas de cerco (futuro) | ainda não | a definir (Colossus-01) |

- O visual segue a regra da produção: tudo gerado por código. Nada de marca real: os robôs lembram os de hoje sem copiar nenhum.
- Próximo na escala 1: um quadrúpede (cão-robô), mais rápido e mais baixo, que obriga a mirar para baixo.

---

## VITRINE (o que a landing mostra ao jogador)

> A landing do site (`/cybermech/`) lê esta lista. Só entra o que está REAL no `STATUS_REAL.md`: feature nova no ar
> → uma linha aqui; feature que saiu → sai daqui. Formato: `- **Título:** frase curta para quem vai jogar.`

- **Dano por parte:** arranque uma perna e o inimigo manca; as duas e ele para; destrua a cabeça e ele fica cego.
- **Bots que caçam você:** três pilotos que patrulham, cercam atirando de lado e recuam quando estão avariados.
- **Rodadas de 5 minutos:** todos contra todos, placar no Tab e rodada nova sozinha, com a arena inteira de novo.
- **Cobertura que quebra:** as barricadas viram destroços; a proteção do inimigo não dura para sempre.
- **Dash e pulo duplo:** um Mech pesado que ainda assim escapa, flanqueia e muda de altura.
- **Três câmeras:** terceira pessoa, cockpit em primeira pessoa e visão tática de cima.
- **Mira do seu jeito:** calibração pelo movimento real do mouse, entrada crua e teclas remapeáveis.
- **Som feito na hora:** efeitos sintetizados pelo próprio navegador, sem arquivos pesados para baixar.
- **Foguetes no braço esquerdo:** quatro no carregador e dano em área; exploda no pé do inimigo para arrancar a perna.
- **IAs rebeldes de dois tamanhos:** Mechs blindados e andróides pequenos e ágeis que chegam perto, pulam e desviam.

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

---

## PRINCÍPIOS DE ARQUITETURA (pedido do dono)

Economia de dados, requisitos baixos, leveza, resiliência, código estratégico. As regras
mensuráveis estão em `PROTOCOLO_UNIVERSAL.md`:
- **G11:** economia de dados (orçamento de banda, snapshots, quantização)
- **G12:** requisitos mínimos e qualidade adaptativa
- **G13:** resiliência (reconexão, autoridade, falha isolada)
- **G14:** código estratégico (simulação única, teste por regra, custo explícito)
