# CAMPANHAS E CHEFES — a guerra cognitiva em cinco capítulos (P147)

> **Ordem do Comandante (15/10):** *"melhorar nosso storytelling, criar campanhas que tenham um chefe e tenhamos que nos organizar pra lutar
> contra ele, diferentes chefes, diferentes desafios, tentando remeter pelo menos um pouco à vida real e à geopolítica internacional sempre em mira"*
> — e, sobre os nomes: *"você pode usar o que achar melhor"*. **Estado:** desenho escrito por Claude em 15/10; **nada daqui está construído**
> além do Capítulo 1 (parte dele). O Comandante lê, corta e reordena; só então vira código (um capítulo por PR).
> Base do lore: `UNIVERSO.md` § 2-A (somos os **ALIADOS**: o campo anti-imperialista, o BRICS, com o Brasil no centro; a guerra é **cognitiva**,
> uma operação de influência para entregar o país ao **Império do Norte**). **Nomes: arquétipos fictícios** (decisão #9, reconfirmada hoje).

## 1. O princípio: cada chefe é um problema que um jogador sozinho não resolve

Um chefe ruim é uma esponja de vida. Um chefe bom é **um problema de organização**: tem uma regra que obriga o grupo a se dividir, a se
comunicar e a escolher. O que o jogo já tem para isso (verificado no código em 15/10):

- **Ordens ao esquadrão** (`1 Acompanhar · 2 Foco · 3 Defender`, na tela): offline os aliados são bots que obedecem; online o contrato de
  times na sala (P81) ainda não existe, então **o chefe em cooperativo online vem depois do offline**.
- **Dano por parte** (`combat/damage.ts`): pernas, braços, cabeça e torso têm vida própria. Um chefe com **partes** já tem "pontos fracos" de graça.
- **O núcleo** (`sim/NucleoDaEstacao.ts`): uma vida que o grupo defende. É o "tanque" que o chefe ameaça.
- **Andróides** (`entities/Android.ts`) e a **Colossus-01** (`PRAIA_TITA`, o titã de 14 m): corpo e chassi do primeiro chefe.
- **Ondas** (`sim/SurvivalWaves.ts`) e **missões em fases** (`sim/campanha.ts`): a máquina que encadeia os capítulos.

**Papéis** (nomes de função, não de classe; um jogador pode trocar no meio): **LINHA** (Marauder: segura o chefe, absorve), **CORTE** (Vector-09: rápido,
vai nas partes fracas), **SINAL** (o drone e o andróide: marca, hackeia, entra onde o Mech não cabe — **P149**), **BASE** (quem defende o núcleo e repara).
Cada capítulo cobra **dois ou três** desses papéis ao mesmo tempo; é isso que obriga a se organizar.

## 2. O arco: OPERAÇÃO CABOS ABERTOS

A premissa curta (a do cartão da missão, `praiaHudData.ts`): *os cabos submarinos de Fortaleza trazem a internet para o país; forças hostis desembarcam
para invadir a rede e plantar desinformação*. O arco amplia o que o **Império do Norte** faz **além do cabo**: cada capítulo derruba uma peça da máquina de influência,
e a cada vitória o **mapa de operações** (`WorldMap.ts`) acende uma rota do BRICS. A vitória final é **soberania**, não "derrotar o vilão".

| Cap. | Operação | Chefe (arquétipo fictício) | O que existe no mundo real | O problema de organização | Mapa | Custo para construir |
|---|---|---|---|---|---|---|
| **1** | **CABOS ABERTOS** | **O ARROMBADOR** (a Colossus-01, o titã de cerco que o Império pôs na praia) | **Cabos submarinos** carregam quase todo o tráfego entre continentes; Fortaleza é um dos maiores pontos de chegada do Atlântico Sul; cabo cortado ou escutado é arma de guerra e de espionagem | O titã anda para **três nós do cabo**. **CORTE** derruba as pernas (para o andar), **LINHA** o segura longe do núcleo, **BASE** repara o nó que ele atinge. Pernas caídas = ele rasteja e atira: vira outra luta | praia (existe) | **Pequeno:** o chefe já anda e atira; faltam fases, a barra do chefe e o texto |
| **2** | **RUÍDO** | **A GRANJA** (um prédio-fábrica de contas falsas: a "central de ruído") | **Fazendas de bots e de perfis falsos** amplificam mentira para parecer maioria; o dano é fazer o verdadeiro parecer minoria | Ondas de **"civis" falsos** (andróides com cara de gente) misturadas com civis de verdade: **atirar errado custa a missão**. **SINAL** marca quem é falso (o drone lê o "tremor" do holograma); **LINHA** segura a rua; **um andróide entra no prédio** (P149) para colocar a carga e digitar o código da sala de servidores | cidade costeira (hotéis da Beira-Mar; **um prédio de interior**, só para andróide) | **Grande:** o interior com porta (P149), o civil de verdade vs o falso, o terminal de código |
| **3** | **O FEED** | **O ALGORITMO** (um datacenter-colosso estacionário, com um "olho" que recomenda) | **Plataformas** decidem o que milhões veem; o que gera **raiva** rende mais atenção; os **datacenters** gastam energia e água de verdade, e o Brasil atrai os de big techs por causa da energia limpa | O chefe solta **iscas** brilhantes: **atirar nas iscas o cura** (a isca de raiva). A luta é **ignorar a isca** e **cortar as quatro linhas de resfriamento e energia** ao mesmo tempo (quatro pontos, o grupo se divide). Quem cai na isca entra em "bolha" (câmera e minimapa filtrados) | fazenda de servidores à beira de uma barragem (mapa novo, ou a Arena reformada) | **Médio:** a regra da isca (módulo puro com teste), quatro pontos de corte, o filtro de HUD |
| **4** | **SANÇÃO** | **O BANCO VORCARIS** (o banco do Império, que o Comandante já criou na Arena) | **Sanções financeiras** e a dependência do dólar: quem é cortado dos sistemas de pagamento perde comida, remédio e combustível; o BRICS discute **rotas de pagamento próprias** | O cofre **congela** a munição e o reparo de quem chega perto ("bloqueio"). O grupo captura **três chaves de roteamento**; **cada uma capturada abre uma rota alternativa** que devolve munição ao esquadrão (é a "rota do BRICS": cooperar **cria** o recurso que a sanção tirou) | a Arena (o banco), reaproveitada | **Médio:** o congelamento (`heat.ts` e `Armament.ts` já têm gancho de carga), a captura (`Dominio.ts` já existe) |
| **5** | **SOBERANIA** | **O MITO DE VIDRO** (uma persona gerada, de rosto perfeito e discurso de fora; o **arquétipo do manipulador**, não um grupo) | **Deepfakes** e personas artificiais; e a **dependência de satélites** e de infraestrutura estrangeira de comunicação | Um chefe de **três fases** que reusa uma regra de cada capítulo: o rosto tem **muitas cópias** (acertar a verdadeira é o Cap. 2), o sinal vem de um **enlace de satélite** (cortar a estação de solo é o Cap. 1), a plateia **dá raiva** (Cap. 3) e a **munição trava** quando o enlace cai (Cap. 4). A vitória **liga o satélite nacional** (a rota do Brasil acende no mapa) | a praia + a cidade (o final junta os mapas) | **Grande:** é a soma; só depois dos quatro |

**Sobre os nomes e o tom:** "Império do Norte", "Clã do Mito", "Banco Vorcaris", "o Algoritmo", "a Granja" são **arquétipos**: todo mundo reconhece e o jogo não afirma fato sobre pessoa
real (risco jurídico e de plataforma; envelhece menos). **Teatral, não documentário**: o lado do jogador (SERAFIM e os aliados) ri do vilão e leva a ameaça a sério. Religião
fica **fora** do alvo: o manipulador é o **influenciador**, nunca uma fé inteira.

## 3. Como cada capítulo se joga (a forma, igual para todos)

1. **Cartão de missão** (3 linhas, a história) e a **voz de início de combate** (a do narrador, P113/P146): "Operação Ruído. A central está de pé. Andróide, a porta é sua."
2. **Fase 1 — o campo:** ondas e o problema do capítulo, com o rádio do SOC narrando (texto + voz curta, pré-gerada).
3. **Fase 2 — o chefe aparece**, com **barra do chefe** no topo e **uma regra dita numa linha** na tela ("As iscas curam. Corte as quatro linhas.").
4. **Fase 3 — virada:** o chefe muda quando a regra é cumprida (a Colossus rasteja; o Algoritmo apaga os olhos; o cofre abre).
5. **Fim:** o **mapa de operações** acende a rota do BRICS daquele capítulo, o **placar de equipe** mostra quem fez o quê (papéis), e o desbloqueio é **cosmético** (nunca de combate: `PUBLICACAO_E_MONETIZACAO.md`).

## 4. A ordem para construir (um capítulo por PR, cada um jogável sozinho)

| # | PR | O que entrega | Depende de |
|---|---|---|---|
| 1 | **Cap. 1 completo** | a Colossus como chefe em **três fases** (anda → pernas caem → rasteja), **três nós do cabo**, barra do chefe, cartão e voz; **teste de simulação** das fases | só do que existe |
| 2 | **O arco e a tela de campanha** | `sim/campanha.ts` encadeia os capítulos; o mapa de operações acende a rota; salva o progresso (no navegador, depois na conta: P145) | 1 |
| 3 | **Prédios de interior** (P149) | a porta que só o andróide cabe; o objetivo de dentro (carga, refém, código) | 1 |
| 4 | **Cap. 4 SANÇÃO** (o mais barato dos novos: reusa a captura e o calor) | congelamento + chaves de rota | 2 |
| 5 | **Cap. 2 RUÍDO** | a Granja, o civil falso | 3 |
| 6 | **Cap. 3 O FEED** | a isca e as quatro linhas | 2 |
| 7 | **Cap. 5 SOBERANIA** | o chefe de três fases | 4, 5, 6 |
| 8 | **Online cooperativo** | os capítulos em sala com times | contrato de times (P81) |

**Regras de engenharia (valem para todos):** a lógica do chefe é **módulo puro em `sim/`** com teste de simulação (G14), determinística (G1/G2, sem `Math.random`);
o chefe é **uma instância pré-alocada** (G4/G5), sem `new` por quadro; efeitos de brilho do chefe passam pela `varrer-nan.mjs` (P130/P136); o custo de CPU de cada capítulo
vai no PR. O **capítulo 1** pode sair em uma sessão; os outros pedem a decisão abaixo.

## 5. O que só o Comandante decide

1. **A ordem e o corte:** os cinco capítulos, nessa ordem de **construção** (1 → 2 → 3 → 4 → 5 → 6 → 7)? Algum sai ou entra? *Recomendação:* **sim**, e o PR 1 já.
2. **O vilão final:** **O Mito de Vidro** (a persona gerada, arquétipo do manipulador) ou outro (um **comando militar** do Império, mais sóbrio)? *Recomendação:* o Mito de Vidro:
   é o que o Comandante descreveu (manipulação, fake news) e é o mais fácil de rir.
3. **O jogador é sempre o Marauder?** Os papéis pedem trocar entre Mech e andróide no meio da missão (P149). *Recomendação:* **sim, trocar na base** (o Hangar vira "a troca de corpo").
4. **Cooperativo online já no começo ou só offline com o esquadrão?** *Recomendação:* **offline primeiro** (o esquadrão de bots já obedece); o online espera o contrato de times.

## 6. Ligado a

`UNIVERSO.md` § 2-A (a base do lore) · `ORDENS_DO_COMANDO.md` P147 e P149 · `ROADMAP.md` (a fase de campanha) · `PILOTOS_LLM_E_INTELIGENCIA.md` (o rádio e a voz) ·
`PUBLICACAO_E_MONETIZACAO.md` (cosmético, nunca poder) · `fichas/escolta.md`, `fichas/ataque-e-defesa.md` (as fichas de missão que isto estende).
