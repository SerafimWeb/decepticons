# BANCO VORCARIS

Pedido do dono em 06/10: logo e nome azuis luminosos no andar de cima de um prédio; chegar à porta abre terminal de códigos. Recompensas de créditos e reforços, offline e online.

## Onde fica

Arena atual, prédio à esquerda da área central: centro (-28, -35), fachada voltada para +Z. Letreiro a 24 m de altura e porta na face sul. Atendimento a até 4 m de (-28, 0, -25), somente no térreo e com robô vivo. Não é preciso entrar no volume do prédio.

## Configurar os códigos

Edite a tabela `BANK_CODES` em `shared/bank/codes.ts`. Chaves são letras/números em maiúsculas, sem espaços nem acentos. Digitar "134 milhões", "134 MILHOES" ou "134milhoes" produz a mesma chave. Máximo de 64 caracteres. Não são senhas: são cheats intencionais do jogo autorizados pelo dono.

| Código inicial | Recompensa |
|---|---|
| 134 MILHÕES | +134.000.000 créditos na progressão existente |
| OFICINA | até 300 de reparo na parte presente mais avariada e remoção do calor; não recria membros arrancados |
| TURBO | dano de armas +25% por 30 segundos de simulação; renova sem empilhar e desaparece na morte/respawn |

O intervalo de 300 ticks (5 s de jogo) limita a repetição do mesmo código. Códigos diferentes podem ser combinados numa visita. Offline, o atendimento pausa o mundo; é preciso voltar à arena para o relógio avançar. Online, a arena continua ativa. Fechar o terminal não o abre de novo até se afastar da porta e retornar.

## Regra e integração

`BankAccount` é a mesma validação offline e no código do servidor: vida, posição de simulação, tabela e intervalo. O cliente online envia só o texto e recebe o resultado pelo WebSocket binário; não escolhe o valor nem aplica dano/reparo por conta própria. Mensagens 5/16 são opcionais; snapshot continua 19 bytes/unidade. `CombatBoost` usa o tick fixo e afeta projéteis, explosões e corpo a corpo, incluindo cenário; não amplia o calor EMP nem pisão. O dano considera o bônus ativo no instante do impacto.

Créditos usam `DailyChallenges`, salvos no navegador como a progressão já existente; o Hangar mostra o saldo. Não há migração de créditos para contas nem loja de compra de módulos nesta entrega. Isso continua pendente. O contador online é visual e aproximado; o servidor decide a duração real no tick fixo. Os códigos online só funcionam quando o servidor usar este código atualizado.

## Custo e verificação

Letreiro/porta estáticos: 8 meshes adicionais, sem luz dinâmica, animação ou colisão nova. Proximidade O(1) no render e relógio no tick; dois números no módulo de bônus por Mech. DOM de duração muda no máximo uma vez por segundo. Resgates são eventos raros; nenhum byte novo por snapshot.

Servidor público offline hoje por orientação expressa do dono. Não consultar, reiniciar, atualizar ou depender dele; validações de rede somente em sala local efêmera. Playtest público aguarda o retorno do servidor.
