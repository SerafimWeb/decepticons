# LIÇÕES DO WAR ROBOTS — o que a reportagem dos US$ 1 bilhão ensina ao CYBERMECH

> Ordem **P171** (Comandante, 16/10): colou a reportagem *"War Robots achieves $1 billion in lifetime revenue"* (MY.GAMES, 2025) e disse que ela **tem muito a ensinar na orientação do nosso trabalho**.
> **Não duplica:** o `BENCHMARK.md` compara o jogo em si (pay-to-win, power creep, cover shooter); a `PUBLICACAO_E_MONETIZACAO.md` mapeia onde publicar; o `GAME_DESIGN.md` (§ "VIRALIZAÇÃO E RECEITA") fixa a ordem. Aqui fica o que **os números da reportagem** mudam no que fazemos **agora**.
> **Cuidado com a fonte:** é um comunicado da própria dona do jogo. O valor é **bruto** (antes da taxa de loja), **acumulado em dez anos** e não traz receita por pagante nem quanto vem de poder comprado. Serve de bússola, não de promessa.

## 1. Os números, e o que dá para tirar deles

| Dado da reportagem | A conta | O que diz |
|---|---|---|
| US$ 1 bi em 10 anos, ~300 milhões de instalações | ~**US$ 3,3 por instalação**, em média | o jogo não ganha de cada um; ganha de poucos, por muito tempo |
| 4,7 milhões jogam por mês (2024); até 690 mil por dia | **1,6%** das instalações seguem ativas; o dia é ~**15%** do mês | até o gigante retém uma fração pequena: **cada ponto de retenção vale ouro** |
| ~**100 unidades de conteúdo por ano** (robôs, pilotos, armas) e ~**9 eventos** | **~2 unidades por semana** e **um evento a cada ~6 semanas** | o produto é a **cadência**, não um lançamento |
| Conteúdo fresco **em eventos** é o que mais rende | — | evento é motor de receita **e** de volta ao jogo |
| Celular: **95%** das instalações, **94%** da receita; Android tem 3× os jogadores do iOS, mas a receita é quase igual (US$ 455 mi × 442 mi) | o jogador de iOS rende ~**3×** o de Android | o jogo mora no **celular**; Android dá volume, iOS dá valor |
| Maior receita: EUA, Japão, Alemanha, Coreia, Reino Unido. Maior **volume** depois dos EUA: **México (14,5 mi) e Brasil (13 mi)** | EUA: ~US$ 380 mi em 36 mi de instalações (~US$ 10,6 cada) | o Brasil traz **gente**, o dinheiro vem de fora |
| US$ 500 mi aos 7 anos → US$ 1 bi menos de 4 anos depois | o crescimento **acelerou** com a idade | quem fica e mantém o ritmo ganha mais, não menos |
| Menos de 100 jogos de celular na história chegaram a US$ 1 bi | — | a meta nunca é o bilhão: é o **mecanismo** |

## 2. O que fazemos com isso (em ordem do que mais move o jogo)

1. **Contar conteúdo como se conta código.** Meta de trabalho: **2 unidades de conteúdo por semana** (arma, robô, piloto, mapa) e **um evento a cada ~6 semanas**. O custo de uma unidade já caiu: arma nova é **uma linha de tabela** (`combat/weapons.ts`, `fx/weaponLook.ts`, `ui/dicasDeArma.ts`) e o Estúdio vai editar cor, cauda e explosão sem código (P157). *Ação:* o painel conta as "unidades de conteúdo por semana" (hoje a P160 entregou 4 armas em um dia: o ritmo existe, só não é medido). **Feito em 17/10 (P175): Sala de controle → Ritmo de conteúdo** (armas e chassis por semana, do código e do git; 30 unidades até aqui, **7,3 por semana** nas semanas completas: já acima da meta de 2). Falta contar o que não é arma nem chassi (mapas, pilotos, eventos).
2. **Evento como unidade de produto.** Já temos os modos (Deathmatch, Sobrevivência, CTF, Domínio) e os desafios diários. Um **evento** é uma arma ou robô em destaque + uma regra que muda (modificador) por duas semanas, em **dado** (`eventos.json`), sem código novo. *Ação:* o desenho de um evento mínimo (a arma da semana com a missão e o prêmio cosmético).
3. **Celular primeiro, de verdade.** Se 95% do mundo joga no celular, o teste que importa é **um Android comum no Chrome**: toque, fluidez, calor, bateria (G12 já pede GPU integrada, mas ninguém mediu num Android de entrada). *Ação:* uma bancada de celular (o `?depurar` já expõe o jogo) e uma sessão com 5 pessoas no celular (o placar já cobra "nenhum teste com gente").
4. **Brasil é volume e viralização, não caixa.** 13 milhões de instalações e pouca receita por cabeça: o Brasil enche a sala (o que falta a todo multiplayer novo) e o cenário daqui (a **Estação dos Cabos de Fortaleza**, a soberania, o banco Vorcaris) é um diferencial que o War Robots não tem. O dinheiro vem de EUA, Japão, Alemanha, Coreia e Reino Unido: **inglês na landing e no jogo antes de olhar monetização**.
5. **Retenção é o número.** Com 15% de DAU/MAU no gigante, a meta de "volta no dia seguinte (D1) e 3+ rodadas na primeira sessão" (`GAME_DESIGN.md`) continua certa; *Ação:* acrescentar **D7** e **DAU/MAU** ao painel antes de gastar com aquisição. **Pendente (17/10):** exige guardar um **id anônimo por visita** (hoje a telemetria só conta eventos por IP, sem pessoa); é decisão do Comandante (LGPD: o que guardar e por quanto tempo).
6. **Copiar o mecanismo, não o dinheiro.** O War Robots ganha vendendo **poder** (a "Power Rating" que o Comandante recusa como pay-to-win). O que dá para tirar de lá sem trair o jogo: **robôs, pilotos e armas como coleção** (já temos os três) e **eventos**, pagos com **cosmético**. Aqui entra o que construímos hoje: **o olhar do tiro e da explosão é dado** (`fx/weaponLook.ts`), então **"estilos de explosão e de rastro" são produto cosmético** natural (nunca atributo de combate) — o checkpoint `CHECKPOINTS.md` protege a qualidade que o vende.
7. **Ficar dez anos.** A estabilidade do War Robots é operação: atualizar sem derrubar, medir, ter calendário. Já temos o servidor que se atualiza sozinho, a telemetria e a trava de qualidade (`CHECKPOINTS.md`); falta o **calendário** (item 2).

## 3. O que NÃO copiar (e já está decidido)

- **Pay-to-win** (poder por dinheiro): contra o `GAME_DESIGN.md` ("Não é pay-to-win") e a dor nº 1 que o `BENCHMARK.md` aponta nos concorrentes.
- **Gastar com aquisição antes de reter:** a conta de 1,6% de instalações ativas mostra que trazer gente sem reter é encher um balde furado.
- **Versão chinesa separada** (29 lojas): fora do alcance de quem ainda não encheu uma sala.

## 4. O que fica para o Comandante decidir

(a) se a meta de **2 unidades por semana** e **1 evento a cada 6 semanas** vira o ritmo oficial (`ROADMAP.md`); (b) se o **inglês** entra antes da monetização (**respondido em 17/10: sim, e com mais cinco línguas: `ORDENS_DO_COMANDO.md` P173**); (c) se **estilos de explosão e de rastro** viram o primeiro cosmético (precisa de contas, `RANKING_E_LOGIN.md`).
