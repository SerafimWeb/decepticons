# RANKING E LOGIN — o plano (P141)

> **Ordem do Comandante (15/10):** *"o fluxo de primeiro acesso tem que ser chegando já numa partida, e se gostar, vai continuar jogando e configurar pouco a pouco, adicionar nome, qual clã quer entrar, se foi convidado por algum clã, etc, mudar o robô, mudar a arma, customizar o robô e armas, evoluir os robôs e armas, etc, enquanto sobe no ranking (temos que organizar esse lance do ranking e login também né?)"*
> **Resposta:** sim. Este arquivo organiza o que existe, o que falta e o que o Comandante precisa decidir. Claude, 15/10. Nada aqui, além da tela de primeiro acesso, está construído.

## 1. O princípio (decidido pelo Comandante)

**Nada de porta.** O primeiro acesso cai numa partida (feito: a tela enxuta, P133). Identidade, nome, clã, conta e ranking vêm **depois**, em camadas, e **cada camada é opcional**: quem só quer jogar nunca vê um formulário. O login só aparece no momento em que o jogador **quer guardar o que ganhou**.

## 2. O que já existe (verificado no código em 15/10)

| Peça | Onde | Estado |
|---|---|---|
| Contas de piloto (e-mail + senha com `scrypt`, sessão de 30 dias, só o hash do token no banco) | `server/contas.ts` (SQLite, `node:sqlite`) | **Funciona e o jogador já a usa** (P174, 17/10): Configurações → JOGO → CONTA DO PILOTO; o painel do dono segue pelo `client/src/net/admin.ts` |
| Limite de tentativas de login (8 a cada 10 min por IP) | `server/login.ts` | Funciona |
| Apelido para a sala online | `ui/OnlineLobby.ts` (`cybermech-name` no navegador, `?nome=` na URL) | Funciona; é só texto, **sem unicidade e sem filtro** |
| Progressão do piloto (nível, créditos, missões diárias) | `ui/DailyChallenges.ts` (`cybermech_pilot_progression`, no navegador) | Funciona; **com conta, nível, XP e créditos acompanham o piloto** (`net/sessao.ts`, P174); as missões do dia ficam só no navegador. Sem conta, apagou o navegador, perdeu |
| Montagem do robô e das armas | `hangar/` (`cybermech.hangar.v1`, no navegador; link `?build=`) | Funciona, só local |
| Métricas de partida | `server/PlayMetrics.ts`, `shared/net/playMetrics.ts` | **Agregadas**: contam partidas, não pessoas |
| Placar da rodada | `sim/` + HUD | Só da rodada que acabou |
| **Ranking** | — | **Não existe** |
| **Clã** (de jogadores) | — | **Não existe.** (Os "clãs" que o código conhece são os dos **bots**: `tuning/power.ts`) |

## 3. As camadas (cada uma só depende da anterior)

**C0 · Convidado (primeiro acesso).** Já é assim: nada guardado, nada pedido. *Entrega:* feita (P133).

**C1 · O piloto sem conta.** Um **id local** (aleatório, no navegador) e um **apelido**. O apelido nasce gerado ("PILOTO-4F2A") e o jogador troca quando quiser, num campo da pausa; vale na partida offline (o placar mostra) e na sala online (já existe o `?nome=`). *Precisa:* filtro de apelido (tamanho, caracteres, lista de palavras proibidas: o jogo vai a público). *Custo:* zero de servidor.

**C2 · Clã, sem conta.** Uma **tag de 3 a 4 letras** que o jogador escolhe ou recebe por **link de convite** (`?cla=ABC`): o convite só preenche a tag; **não há "dono do clã" nem lista de membros no servidor ainda**. Aparece no placar e no nome ("[ABC] PILOTO"). *Decisão do Comandante (§ 5):* quem cria clã e quem o administra.

**C3 · Conta (opcional).** E-mail + senha (o servidor já faz). O convidado vira conta **sem perder nada**: o servidor "reivindica" o id local e guarda o que o navegador já tinha (progressão, montagem, apelido, tag). A conta serve para **guardar o progresso entre aparelhos** e para **entrar no ranking global**. *Precisa:* abrir `/conta/criar` ao jogador comum (hoje só o dono usa), recuperar senha, e o que a **LGPD** pede (consentimento, apagar a conta).

**C4 · Ranking.** Só o que o **servidor autoritativo** viu (G13): partida online, pontos calculados no servidor; offline conta para o **ranking de treino local**, nunca para o global (senão o ranking é falsificável pelo console do navegador). *Precisa:* uma tabela `partidas` (conta, modo, pontos, quando) e um `GET /ranking` (leitura de uma tabela pequena a cada ~60 s; **zero custo por tick e banda desprezível**). Temporada de 30 dias, com o topo guardado.

**C5 · Evolução enquanto sobe.** "Evoluir os robôs e armas" já existe em parte (créditos, nível); a ligação ao ranking é que as **recompensas de temporada** (cosméticas, nunca de combate: o `PUBLICACAO_E_MONETIZACAO.md` exclui *pay to win*) saem do ranking.

## 4. A ordem dos PRs (cada um pequeno e útil sozinho)

1. ✅ **Primeiro acesso enxuto** (P133, `claude/primeiro-acesso`).
2. **Apelido** (C1): um campo na pausa e no onboarding da primeira morte ("gostou? dê um nome ao seu piloto"), com o filtro. Mostra no placar da rodada.
3. **Ranking de treino local** (C4 sem servidor): as melhores rodadas do navegador, por modo.
4. ✅ **Contas de jogador** (C3, P174, 17/10): `/conta/criar` aberta (já era), formulário ligado nas Configurações, e a "reivindicação" do progresso do navegador: `GET`/`PUT /conta/progresso` + a mescla (`shared/net/auth.ts` `mesclarProgresso`: quem tem mais nível e XP vence). **Sem id local** (decisão: o navegador é a fonte do que ele já guardava; a conta é uma cópia que o alcança, e nada é apagado ao sair).
5. **Ranking online** (C4): tabela, `GET /ranking`, a tela.
6. **Clã** (C2), depois que o Comandante responder a § 5.

## 5. O que só o Comandante decide

1. **O que pontua no ranking?** Abates, objetivo (a estação defendida, a bandeira, os pontos dominados), sobrevivência, ou uma mistura? *Recomendação:* **objetivo vale mais que abate** (é o que o jogo ensina: "atirar, se esconder, capturar"; P111) e **dano ao time não conta**.
2. **Temporada:** 30 dias, e o que acontece com o topo (um título na tela, um cosmético)?
3. **Clã:** criado por **jogadores** (tag livre, convite por link) ou **fixo do universo** (os jogadores entram numa célula da aliança — ver `UNIVERSO.md` § 2-A: eles são os ALIADOS)? *Recomendação:* **começar com tag livre + convite** (zero administração) e deixar "célula da aliança" como camada de ficção por cima.
4. **Login:** e-mail + senha basta, ou também Google/Discord? *Recomendação:* **e-mail + senha agora** (já pronto no servidor); o social depois, se o público pedir.
5. **O que o jogador sem conta perde?** *Recomendação:* nada do que fez no navegador; só **não entra no ranking global** (o de treino local ele tem).
6. **Apelido repetido:** permitir (com a tag do clã e um número) ou exigir único? *Recomendação:* permitir, desambiguar com o número do piloto (`PILOTO#4F2A`).

## 6. Riscos e custo

- **Ranking falsificável** se contar partida offline: por isso só o servidor autoritativo pontua o global.
- **Apelido ofensivo** em público: o filtro (C1) vem **antes** de qualquer apelido aparecer para outras pessoas.
- **Dado pessoal** (e-mail): LGPD; guardar o mínimo, deixar apagar.
- **CPU/rede:** nenhuma por tick; o ranking é leitura de tabela pequena e o servidor já tem SQLite.
- **O servidor é o PC do dono** (`CAPACIDADE.md`): o ranking global herda a disponibilidade dele; o de treino local não depende de nada.
