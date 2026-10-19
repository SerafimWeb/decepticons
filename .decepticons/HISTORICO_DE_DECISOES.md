> **Arquivo:** as entradas com mais de dois dias moram em `.decepticons/arquivo/historico-*.md` (nada se perdeu; `npm run arquivar` move mais). Procure por busca, não leia inteiro.


## [2026-10-18] "Esqueci a senha": link de uso único por e-mail, página própria, sem entrar sozinho (Claude, P206)

**Ordem:** *"faça o esqueci a senha; não vamos dar CNPJ por enquanto pois não temos e o jogo é indie, feito por uma pessoa apenas"*.

**Decisões:**
1. **Resposta igual e antes do trabalho.** O pedido devolve 202 sempre e só depois consulta o banco e envia; a diferença de tempo entre "tem conta" e "não tem" era o jeito mais barato de descobrir e-mails cadastrados. Com limites por IP, por conta e por dia, porque "esqueci a senha" é a rota que um script usa para encher a caixa de alguém e a cota do provedor.
2. **O token vai no fragmento (`#`), não na pergunta (`?`).** O fragmento não é enviado ao servidor nem no Referer: não cai no log da Cloudflare, da Hostinger nem do jogo. A página o tira da barra de endereço ao abrir.
3. **O banco guarda só a impressão digital** (SHA-256, como as sessões). Quem lê o banco ou um backup não consegue usar um link vivo.
4. **Trocar a senha encerra todas as sessões** da conta: quem tinha a senha velha, ou uma sessão esquecida em outro aparelho, perde o acesso. **E não entra sozinho:** voltar ao jogo e digitar a senha nova é um passo a mais que custa 10 s e evita que um link vazado vire uma sessão pronta.
5. **Página estática própria (`/redefinir/`) em vez de abrir o jogo:** o link chega num e-mail e o jogo é um carregamento de 3D; a página é leve, sem Google nem cookies (carrega um segredo) e funciona em celular. A senha e o token vão no corpo do POST, nunca na URL.
6. **Provedor de e-mail atrás de uma interface** (`Mailer`): o Resend hoje (grátis, uma chamada HTTPS, sem biblioteca nova), outro amanhã sem mexer no resto. **Sem chave, não finge:** o servidor responde 503 e o jogo diz para pedir ajuda; o `npm run admin -- link-senha` cobre o intervalo.
7. **Sem CNPJ, a política diz a verdade:** o controlador é uma pessoa física que desenvolve o jogo de forma independente. O que a LGPD ainda pede, o nome do encarregado, ficou para o Comandante decidir. Resend entra como destinatário (Estados Unidos). A `POLITICA_VERSAO` **não mudou** (mesmo dia, 18/10): a mudança só acrescenta um recurso que envia e-mail apenas a quem o pede; contas criadas antes da mudança não aceitaram essa linha, e isto está dito para a revisão do texto.
8. **Não feito:** o e-mail de aviso "sua senha foi trocada" (entra com o envio ligado).

## [2026-10-18] O servidor avisa antes de reiniciar, e o jogo insiste por 10 minutos (Claude, P204)

**Ordem:** *"será que temos que adicionar uma imagem dizendo que estamos reiniciando o servidor ou em manutenção… com um contador na tela… se for reinício, dizer que volta em 1 ou 2 minutos? ou potencialmente mais?"*

**Decisões:**
1. **Avisar com 10 s de antecedência, só se há gente na sala.** Cada deploy reinicia o servidor (até commit de documento) e já havia jogador real do outro lado; 10 s dão tempo de terminar um tiro, e sala vazia não espera nada. A atualização automática espera até 25 s a porta liberar (`parar-servidor.ps1`), então os 10 s cabem.
2. **"Volta em cerca de 1 minuto"** (60 s), porque medi **16, 23, 28 e 50 s** entre "pedindo reinício" e "religou" hoje; **se passar, a tela diz "demorando mais que o previsto" e continua tentando** em vez de inventar um número maior. Prometer 2 minutos para um reinício de 20 s ensina o jogador a desconfiar do aviso.
3. **Sem mudar o protocolo:** o aviso é uma mensagem nova que cliente antigo ignora, e o corte usa o código de fechamento 4010 com o tempo no motivo. Uma página velha em cache continua jogando; só não vê o contador.
4. **A insistência longa só vale para quem já entrou numa sala** (10 min, a cada 5 s). Quem abre o link com o servidor desligado volta ao offline em ~19 s como antes, em vez de ficar preso numa tela de espera.
5. **Queda sem aviso não tem previsão e a tela diz isso** ("sem previsão de volta"), com o tempo fora subindo e, depois de 30 s, o jogo offline à mão. Não chutar um prazo que ninguém sabe.
6. **Não feito:** manutenção agendada escrita pelo dono e aviso na landing (a landing é estática na Hostinger e não conhece o estado do servidor).

## [2026-10-18] Arquivar os documentos vivos, o monitor da Cloudflare e o servidor que ainda fica (Claude, P203)

**Ordem:** *"ARQUIVAR… é gratuito mesmo? se vc for no serafim13, BATBOT… veja se nosso sistema de avisos pelo telegram já não é melhor que uptime robot… bora limpar pra tornar mais leve… sera que compensa formatar [o PC velho]… ou logo teremos que pagar um servidor vps?"*

**Decisões:**
1. **Arquivar por data, sem reescrever:** o que tem mais de dois dias sai do `ESTADO_ATUAL` e do `HISTORICO` **tal e qual** para `.decepticons/arquivo/` (quinzena); o painel lê os dois lugares. Uma ferramenta com teste (`npm run arquivar`), não um corte à mão, para qualquer agente repetir. **A `ORDENS` não foi arquivada:** a maior parte é das últimas 48 h; a regra nova é a linha curta (~600 caracteres).
2. **Os títulos fora do formato (`## 06/10 — Codex: …`) seguem a entrada de colchetes anterior**, porque o painel só separa entradas pelo `## [`; senão a contagem de pedidos mudaria (o teste pegou isso na primeira execução).
3. **Monitor: o alerta de túnel da Cloudflare**, não o Telegram do serafim13 (o watchdog roda a cada 6 h, pelo GitHub Actions, sem pagamento no repositório do jogo) e não o UptimeRobot como primeira escolha (o Telegram dele é pago e o plano grátis é não comercial pelos termos de terceiros). Cobre PC desligado, internet fora e túnel parado; **não cobre** o processo do servidor morrer com o túnel de pé (o UptimeRobot em `/status` cobriria, como segunda camada).
4. **Servidor: não migrar agora.** Uma VPS pequena (1 vCPU, 4 GB) custa cerca de R$ 25 a 48 por mês e resolve A1 e A13 juntas, mas obriga a reescrever o atualizador (hoje feito para Windows); o PC velho serve se tiver 4 GB, disco SSD e cabo de rede, e copia o que já existe. Com um jogador de teste e a conexão fluindo, o ganho não paga o trabalho. **Gatilho para migrar:** jogadores simultâneos de verdade (20 a 30 seguidos) ou a primeira queda por memória.

## [2026-10-18] As regras dos bots online são do dono, no painel; o padrão online é de iniciante (Claude, P201 e P202)

**Ordem:** *"MUITO DIFÍCIL os bots inimigos… pressão adversária… controlar esse tipo de coisa através do painel admin que só eu tenho"*.

**Decisões:**
1. **A causa estava no código, não no gosto:** a sala online não aplicava o limite de atacantes. Corrigir o padrão (iniciante: fácil, 2 Mechs, 1 andróide, 1,5 atacantes) **e** dar o controle ao dono: o próximo teste pode pedir o contrário.
2. **As regras moram no servidor, não no jogador:** é a autoridade da sala (G13). O painel só as lê e as grava, pela porta que já exige a chave do dono ou uma conta admin (a mesma régua de erros por IP). **Nenhum papel novo de "superadmin":** o `is_admin` que já existe é o dono.
3. **Aplica ao vivo onde dá:** dificuldade, pressão e número de Mechs trocam na sala de pé; os andróides só nas salas novas (a sala não cria nem remove corpo no meio da partida: G4/G5). Dizer isso na tela é melhor do que fingir que vale tudo na hora.
4. **Três receitas de um clique** (INICIANTE, PADRÃO, DESAFIO): o dono está testando com gente de verdade e quer trocar de postura sem pensar em quatro números.
5. **O alarme do painel é o de quem opera:** "PROBLEMA" com 0 jogadores, por causa do PC saturado, levou o dono a duvidar do servidor. Sem gente jogando, o atraso do laço é aviso e a dica diz de quem é a culpa.

## [2026-10-18] As pendências do lançamento: o que o Comandante decidiu e o que ficou com ele (Claude, P199 e P200)

**Ordem:** *"por enquanto vamos manter assim… email é volkov@serafimweb.com… me passe as orientações pra enviar ao cloudflare… me ensine como criar a chave… temos que sempre manter limpo tudo… conclua as pendências. não precisa ficar procurando problema ou inventando mais trabalho"*.

**Decisões:**
1. **A1 mantido:** o servidor segue no PC de trabalho até o Comandante terminar o jogo; o risco é dele e está dito em `AUDITORIA_SEGURANCA.md` (A1). As travas de hoje (porteira, limite por conta, cópia de segurança, atualizador) não mudam.
2. **O e-mail do encarregado fica em arquivo versionado** (`contato-privacidade.txt`): o repositório é privado e a página pública já o publica de qualquer forma.
3. **Parar a tarefa "CYBERMECH servidor" não para o servidor** (descoberto ao tentar mascarar o `servidor.log` antigo: o uptime não zerou). Ele sobe por um ajudante do WMI. A instrução de limpeza do `DEPLOY.md` § 4c foi corrigida; o log antigo segue como estava até o servidor ser parado de verdade.
4. **Não arquivar os documentos grandes sem o "pode" do Comandante:** ele pediu para não mexer em arquivos além do necessário, e o painel lê `ESTADO_ATUAL` e `HISTORICO`. A medida (1,7 MB nos 5 documentos vivos) e a proposta estão no `ESTADO_ATUAL.md`.
5. **Higiene permanente (P200):** código, documento ou dado sem uso na área que o PR tocou sai no mesmo PR; números que o site publica (testes, módulos) saem do repositório, nunca digitados. Entrou no R17 do `AGENTS.md`.

## [2026-10-18] A visibilidade: um catálogo no código, as exceções no servidor, e o em-desenvolvimento nasce restrito (Claude, P191)

**Ordem:** *"um painel COMPLETO DE TUDO… selecionar o que os jogadores normais veem… quais mantenho secretos/restritos ao admin, em estágio de teste/desenvolvimento (tipo o botão lado, arquivo)"*.

**Decisões:**
1. **Catálogo no código, exceções no servidor.** O que existe e o padrão de cada coisa moram em `funcionalidades.ts` (revisável no PR, com teste); o servidor guarda **só o que o dono mudou**. Assim o catálogo cresce com o código sem migração, e um servidor sem arquivo vale os padrões.
2. **O que está em desenvolvimento nasce RESTRITO** (a regra nova para todo agente, em `AGENTS.md`): LADO, ARQUIVO e RELATÓRIO passam a restritos **agora**, porque são os exemplos que o Comandante deu. É uma mudança de comportamento no site (o jogador deixa de vê-los) e está dita no `ESTADO_ATUAL`; basta um clique no painel para liberar.
3. **Robôs e armas entram sozinhos, já públicos** (vêm de `CHASSIS` e `WEAPON_IDS`): o painel nunca fica desatualizado, e nada some por esquecimento.
4. **O que já está montado fica** no Hangar mesmo se a arma ou o robô foi restringido: o jogador não perde o que tinha equipado.
5. **Não é cadeado, e o painel diz isso.** O modo Comandante é um interruptor do navegador (decisão de 11/10); a visibilidade é a **vitrine**, não a segurança. O que mexe no servidor segue protegido pela chave do dono.
6. **Um link restrito volta ao padrão** (Arena, Deathmatch) antes de o jogo montar, no `main.ts`, para nenhum canto do código precisar saber (o mapa e o modo vêm da URL em vários lugares).
7. **A consulta ao servidor espera 1,5 s e não trava a largada**; a última resposta fica no navegador.

## [2026-10-18] Segurança de acesso para o lançamento: auditoria, privilégio, trilha e os mapas fechados (Claude, P196 a P198)

**Ordem:** "congele o escopo [...] controle de acesso, privilégio, autenticação, métricas para auditoria interna, analytics, observabilidade, governança [...] lançar com apenas a fase estação dos cabos, cidade neon livres [...] troque o nome rio vivo para terras raras; faça auditoria se nossa arquitetura está segura".

**Decisões:**
1. **O código está em condição de lançar; o que bloqueia o público é operacional** (`AUDITORIA_SEGURANCA.md`): o servidor e as chaves de publicação no mesmo PC de trabalho (A1) e a cópia de segurança das contas no mesmo disco (A13). Até lá, **beta fechado**. A auditoria é do Claude, não teste de invasão por terceiro: está escrito no próprio documento.
2. **Administrador só pelo PC do servidor** (`npm run admin`): nenhuma rota HTTP promove ninguém. O privilégio mais alto exige o mesmo acesso que já dá tudo, e cada promoção entra na trilha.
3. **A conta, e não só o IP, é o que se protege no login:** 10 senhas erradas em 15 min trancam a conta (inclusive o "apagar a conta"). Aceito o preço (quem erra de propósito pode trancar por 15 min).
4. **A trilha de auditoria guarda só o número da conta** (nunca e-mail nem IP) por 400 dias e mostra a recusa à porta do dono, não só o acesso: o que interessa a quem audita é a tentativa que falhou.
5. **A configuração global só aceita chaves conhecidas** (antes a rota pública entregava qualquer nome guardado).
6. **Os mapas fechados são de produto, não de segurança:** o jogo roda no navegador de quem joga. Liberar a Terras Raras é acrescentar o id em `MAPAS_DO_LANCAMENTO`. O Bunker, que o Comandante não citou, ficou fechado (a Operação Neon perde a etapa dele em vez de rodar noutro mapa com o título errado); basta uma linha para abrir.
7. **O renome de "Rio Vivo" para "Terras Raras" já tinha sido feito por outra sessão (P187)** na mesma tarde, com o mesmo resultado (jogo, seis línguas, documentos de estado): a minha cópia foi descartada na junção e ficou a dela. **As ordens P187 a P190 da LGPD e das métricas, e as P191 a P194 deste dia, foram renumeradas para P192 a P198** porque a outra sessão registrou P187 a P191 sem saber das minhas (o pedido do painel único foi fundido no P191 dela).
8. **Mutação à mão só onde errar custa caro** (ordem P195): nesta rodada, 20 mutações na segurança de acesso (e nenhuma no bloqueio de mapas, que é regra de produto com teste comum).

## [2026-10-18] O MSAA do composer sai (FXAA no lugar), o jogador nasce perto e a ordem vai para a tela (Claude, P187 a P190)

**Ordem:** *"ficou meio travado, pesado… temos sempre que corrigir e melhorar o DESEMPENHO"*; *"mais de um minuto pra chegar correndo lá"*; *"melhorar a descrição dos objetivos da missão na própria tela"*; *"mude o nome do rio vivo pra terras raras"*.

**Decisões:**
1. **Medir antes de cortar.** A suspeita do Comandante (muitas árvores, mapa grande) estava errada: o cenário todo escondido ganhava ~2 ms. **A bancada na GPU real achou o MSAA 4× do alvo HDR**: ~17 dos 27 ms, em todos os mapas. Tirei o MSAA e pus um **FXAA** depois do tone mapping. A diferença visual é pequena (conferida em recortes lado a lado); o ganho é de 2,3 a 2,8×. **O requisito de GPU integrada (G12) passa a valer na Alta também**, não só na Automática.
2. **A qualidade automática ganhou um 3º degrau (0,75×)** em vez de mudar o limiar: o limiar de 50 fps estava certo, faltava degrau para a GPU mais fraca.
3. **O mapa continua grande; o jogador é que nasce perto.** Encurtar o mapa mexeria no terreno, na floresta, nos geradores e nas torres, e a aldeia perderia o sentido de "lá longe". O **posto avançado** resolve a corrida de 100 s para ~40 s sem tocar no cenário, e a missão fica coerente: a Resistência está na linha de frente e o Draga marcha para a aldeia atrás dela.
4. **A ordem vem até o jogador, em vez de ele ir até o texto:** ordem curta no topo, uma dica, **marcadores no mundo com distância e seta na borda**. O texto de um quadro de ajuda ninguém lê; o losango verde com "CERCA · 320 m" todo mundo segue.
5. **A barra do chefe parou de repetir a ordem** (a linha de regra e a de escudo saíram com o escudo de pé; a aldeia entrou na barra). Princípio "nada repetido" da `AUDITORIA_INTERFACE.md`.
6. **Dieta de JS pelo leitor de `.glb`** (13 KB): é o maior peso que só quem abre um robô usa, e a troca é uma linha (import dinâmico), sem mudar comportamento.
7. **Renomear a fase é só texto do jogador:** os nomes internos (`rio`, `MissaoDoRio`, `amazonia`) ficam, para não quebrar o histórico.

## [2026-10-18] A lista de lançamento: o resto espera (Claude, P191 e P194)

**Ordem:** o Comandante perguntou por que as iterações são tão demoradas e pediu orientação para lançar logo; no mesmo recado, um painel único para controlar tudo.

**Decisões (o Comandante aprovou o rumo no mesmo dia, P195 a P198: escopo congelado, mutação só onde errar custa caro, lançar com Cidade Neon e Estação dos Cabos, "Rio Vivo" vira "Terras Raras", feito pela outra sessão):**
1. **O que impede o lançamento cabe em seis itens** (`LANCAMENTO.md`): servidor fora do PC de trabalho, teste com gente de fora, política revisada, "esqueci a senha", primeira partida em 1 minuto, plano dos 7 primeiros dias. **Times, o painel único, o Google Analytics na página, ranking e o resto ficam congelados.**
2. **O painel único não é construído agora:** já foi pedido em 10/10 (P54), existe em partes, e nada nele é necessário para lançar. A ordem, quando chegar a hora: aba de tiros e armas do Estúdio, depois a ficha dos bots.
3. **O ritmo:** uma ordem por vez com "pronto quando"; **pista rápida** (sem mutação à mão nem prova no Chrome) para o que não tem risco; mutação e prova ponta a ponta só para conta, rede, dado pessoal e dinheiro; e arquivar o histórico antigo (o `ESTADO_ATUAL.md` tem 3.001 linhas e é lido no começo de toda conversa).
4. **O `AGENTS.md` (Passo Zero 12) passa a mandar ler o `LANCAMENTO.md`** ao escolher o que fazer a seguir.
5. **O P81 (times na sala online) fica pausado:** não está no caminho curto.

## [2026-10-18] Métricas de nível profissional: a audiência por conta própria, sem IP e sem o Google por enquanto (Claude, P193)

**Ordem:** "teria como trazer as infos do google analytics pra essa página [...] pra eu saber QUEM e DE ONDE vêm as conexões, se vieram por link, se digitaram a url, se logou, se jogou sem logar [...] quanto tempo passou jogando, o IP e localização, tudo que não invada a privacidade, mas nos traga dados valiosos. quero métricas nível PROFISSIONAL".

**Decisões:**
1. **A audiência sai do nosso servidor, em categorias, e não do Google:** o Google Analytics só enxerga quem aceita cookies (a faixa nova do P192 vai derrubar a amostra) e só as páginas do site; o nosso funil enxerga a landing **e o jogo**, sem cookie. Trazer o GA para a página exige uma **chave de serviço do Google** que só o dono cria: fica como pedido dele, e eu ligo e provo ponta a ponta quando ela chegar.
2. **IP: não. Cidade: não. Estado: sim, se a Cloudflare entregar.** O IP é dado pessoal e não ajuda em nada que se mede em soma; a política diz que não é guardado. A cidade identifica em cidade pequena. O estado do Brasil vem do `cf-region-code` (só do túnel, só as 27 siglas) e exige o dono ligar "Add visitor location headers".
3. **Tudo é categoria de lista fechada, com teto de valores por dia:** o servidor recusa qualquer categoria que não conheça e soma o excedente em `(outros)`. Nada de texto livre, nada de id de aba (que só serve para não contar o reenvio e nunca é guardado).
4. **"Novo ou recorrente" sem identificar ninguém:** uma **data** (o dia da primeira visita) no navegador, que **nunca é enviada**: só a faixa que ela produz ("voltou há 2 a 7 dias"). É a mesma data para todo mundo que chegou naquele dia. Está na política.
5. **A origem acompanha a pessoa da landing até o jogo** pela aba (`sessionStorage`): quem veio do Instagram para a landing e clicou em jogar é "rede social" também no jogo, e não "interno". Sem isso o funil por canal quebrava na porta do jogo.
6. **A classificação é uma só:** a landing é HTML estático, mas o build embute o mesmo código TypeScript do jogo (`audiencia-landing.mjs`); um teste prova que o embutido e a classe do jogo dão o mesmo resultado nos seis jeitos de chegar. Dois códigos "parecidos" fariam o painel dizer duas coisas para a mesma pessoa.
7. **A audiência do jogo baixa sob demanda** (2 KB gz fora do JS de partida): o JS de partida estava em 496,2 / 500 KB.
8. **O teto do corpo do evento subiu de 256 para 1024 bytes** (a visita cheia tem ~400); contexto torto é descartado e o evento continua valendo.
9. **A qualidade gráfica ao terminar entra nas rodadas:** é o dado que diz onde o computador do jogador não dá conta (G12), o que mais importa para o requisito mínimo.

## [2026-10-18] LGPD: os direitos do titular entram no jogo, e o Google Analytics passa a pedir licença (Claude, P192)

**Ordem:** "faça os ajustes de apagar conta, baixar dados, tudo que a LGPD obrigue, pra que estejamos todo de acordo".

**Decisões:**
1. **Os direitos do art. 18 são botões do jogo, não e-mails:** baixar os dados, apagar a conta e desligar a medição resolvem na hora e sem depender de ninguém (e sem o dono ter de mexer no banco à mão). O que sobra para o encarregado é o que o jogo não resolve (e a página diz isso enquanto o contato não existe).
2. **Apagar pede a senha de novo e usa a mesma régua de tentativas do login:** uma sessão esquecida aberta num PC emprestado não pode virar o apagamento (nem o jeito de adivinhar a senha) de ninguém.
3. **Criar conta exige o aceite e a idade, no servidor também:** o servidor recusa o corpo sem as duas caixas ou com a política de outra versão, e guarda quando e qual versão a pessoa aceitou (a prova do consentimento). Quem já tinha conta fica sem aceite registrado (nulo): a política vale para elas pelo uso, e o aceite entra quando for pedido de novo.
4. **Idade: "18 anos ou autorização do responsável":** escolha minha, conservadora (a LGPD, art. 14, pede consentimento específico de um responsável para criança); o dono confirma ou muda. **Jogar sem conta continua sem dado pessoal.**
5. **O IP nunca vai inteiro para o log e o e-mail saiu dele:** achei `conta criada: <e-mail>` no log e IPs inteiros nas linhas de corte. Agora `212.8.252.x` (a rede aparece, a casa não) e "conta criada (número N)".
6. **O registro técnico virou arquivo por dia, apagado depois de 30 dias, escrito pelo próprio servidor** e não pelo redirecionamento da tarefa: medi que o Windows não deixa apagar, renomear nem esvaziar um arquivo que um `>>` mantém aberto (EBUSY nas três). O `servidor.log` antigo só pode ser limpo com a tarefa parada (pendência do dono).
7. **Google Analytics só depois do "Aceitar":** achei a tag fixa em **`client/index.html`**, ou seja, **dentro do jogo**, setando cookie em todo mundo (inclusive em quem tinha conta). A faixa do site pergunta, a escolha fica na chave `cybermech.cookies` e **o jogo só carrega o Google com o "sim"**; no jogo não há faixa (não cobre a tela de ninguém), então quem chega direto ao jogo não é medido pelo Google (as nossas contagens, sem cookie, medem).
8. **A política é rascunho meu, escrito a partir do código (`PRIVACIDADE.md` é o inventário):** diz o que é verdade hoje e nada além. **Não é parecer jurídico**; o dono (e, de preferência, um advogado) revisa. Sem e-mail inventado: o contato do encarregado entra por um arquivo ou variável do dono.

## [2026-10-18] O Relatório de Consequências: opcional, com fonte aberta, e a ficha corrigida pela leitura (Claude, P179 camada 3)

**Ordem:** *"o fim da missão mostra o que aconteceu com o rio, com os povos, com a água, com números lidos de ficha"* (camada 3 do P179) e a pendência da ficha: ler a fonte primária antes de virar texto.

**Decisões:**
1. **O Relatório é um chip, não uma tela que abre sozinha.** A regra do Comandante é "nenhuma partida é interrompida por sermão" e "nada de porta": o chip aparece (e pisca) quando a missão acaba, e quem quer abre. O ensino mora **entre** as partidas.
2. **Só entra o que foi lido na fonte, e o jogo diz o limite de cada fato** ("O QUE ISTO NÃO DIZ"): estudo de três aldeias não é "o povo"; o número do MapBiomas mede área, não legalidade; a portaria não atribui cada morte ao garimpo. **A ficha de fatos ganhou o § 0 com a conferência** e **corrigiu três erros meus de 17/10** (625% era 632%; "570" e "495 (92%)" eram contas diferentes; o estudo Munduruku era de três aldeias).
3. **Número de mortes Yanomami fora, de propósito:** os "570" e os "495 (92%)" divergem no recorte (menores de 5 anos ou todas as idades), no ano e na fonte (Sumaúma, documento do Senado, ofício da PF, Cimi). **Entra a declaração de emergência** (🟡+: o título, o número e a data estão em fontes oficiais; o texto da portaria não abriu). Quando alguém abrir o ofício, o número pode voltar com a fonte certa.
4. **Uma trava de teste liga o jogo à ficha:** cada endereço de fonte do jogo tem de estar na ficha, e todo fato tem `https`, data e "o que isto não diz". Assim a regra "fato tem fonte" não depende de memória.
5. **A honestidade sobre a cura:** a aba "O QUE É FICÇÃO" diz que o rio se curar em minutos é gesto de vitória, não ciência, e que o jogo não afirma que a recuperação seja rápida (a ficha pedia isso).
6. **Conteúdo em JSON por língua, painel sob demanda** (a mesma receita do Arquivo): zero no JS de partida além do chip. **As seis traduções são minhas e pedem a revisão de uma pessoa de fora**, como o Arquivo.

## [2026-10-18] A invasão: a Resistência planta a carga, o canhão só mira Mechs e o "hold" vira para valer (Claude, P180 parte E)

**Ordem:** *"invadir com andróides e destruir por dentro"* + *"prossiga"*.

**Decisões:**
1. **Os andróides são aliados fixos da missão (a Resistência, 3), não o esquadrão do jogador:** a missão do rio é determinística e o esquadrão é opção de Arena; o contrato do ato 3 pede andróides, e eles têm de existir. Reuso o `BotSystem` de aliados (escolta, rádio, anéis, "quem é amigo" já ligados), em vez de um sistema novo.
2. **A escotilha abre com o escudo caído e carrega por presença** (a regra dos cabos, ao contrário): sem tela de interação nova, o jogador vê a barra subir e a escolta. **Os dois caminhos ficam abertos** (tiro no tronco ou carga): a invasão não é obrigatória, só mais segura.
3. **O canhão do Draga só mira Mechs** (andróide é pequeno demais para o radar de tiro). Sem isto o canhão (360 de dano, explosão de 5 m) matava os três andróides no flanco antes da carga fechar: a invasão seria quase impossível. É uma **regra de equilíbrio do chefe da C**, registrada aqui: o Comandante pode trocá-la por uma zona cega do canhão (mas aí o jogador também se protege colado ao casco).
4. **`plantador` no `BotController`:** a ordem `hold` do Domínio deixa o robô orbitar o alvo em volta do ponto (até 10 m); o andróide da escotilha precisa **ficar**. Flag própria, sem mexer no comportamento de ninguém mais.
5. **Respawn único na missão do rio:** com aliados na lista, o `Respawner` (que escolhe o ponto mais longe dos vivos) mandaria o jogador para o outro lado do mapa ao morrer. Um ponto só (a aldeia).
6. **A cura de verdade fica para depois** (parte F: Relatório de Consequências e Consórcio): a E entrega o ato 3; o ato 4 segue como desenho.
7. **O pacote de partida está a 4,3 KB do teto** (495,7 de 500): a regra da missão do rio (torres, invasão) é candidata a sair do pacote inicial.

## [2026-10-18] A defesa da Amazônia: torres que calam com a CERCA, guarda que segura o posto e dorme longe (Claude, P180 parte D2)

**Ordem:** *"há uma enorme força de defesa deles e teremos que desmantelar"* + *"a amazônia já foi entregue em partes, prossiga"*.

**Decisões:**
1. **As torres são regra pura, não robôs** (`TorresDeVigia`): um laço de 8 e uma semente; **um raio de visada só quando uma está pronta para atirar**. Robô com cérebro seria 8 character controllers parados: o plano (§ 6) já dizia "regra pura, estáticas e baratas".
2. **As torres calam com a CERCA** (o primeiro gerador), **não com o escudo inteiro**: o jogador tem uma escolha (cruzar sob fogo, ou ir à cerca primeiro) e o gerador que ele já tem de derrubar passa a pagar duas vezes. O Draga e as torres ficam acoplados só pelo `Match` (o gerador 0).
3. **A guarda segura o posto e não renasce** (`defensores`, que liga o modo retaguarda que a praia já tinha): o Draga é o relógio da missão, e uma defesa que corre atrás do jogador o tira dos geradores, que é o ponto. Derrubado, fica derrubado: desmantelar é o verbo.
4. **A guarda DORME** (420 m, 6 s depois do último motivo): é o que paga os 9 robôs; o chefe fica de fora (a marcha dele não pode parar). **A regra é de custo, não de jogo:** quem está a mais de 420 m nem vê a guarda.
5. **Nascer no chão** é do mapa, não do bot (`alturaDoChao`, a altura do terreno): o raio na física **não serve** para achar o chão no nascimento (o pipeline de consultas do Rapier é vazio antes do primeiro passo).
6. **Os números são proposta** (dano 8, rajada de 4, 170 m, 3 Mechs e 6 androides): o Comandante ajusta em `TORRES_DE_VIGIA` e `AMAZONIA_GUARDA`.

## [2026-10-18] As métricas dos pilotos com conta: o que o servidor mede e o que fica de fora (Claude, P185)

**Ordem:** "tem como termos as métricas dos usuários, quantos entram, quantos minutos jogam, quantas mortes, etc? [...] pra mapearmos e trackearmos tudo, e depois implementarmos melhores práticas de marketing orientado pelas nossas informações de usuários? quero concluir logo as partes técnicas pra poder lançar".

**Decisões:**
1. **O que é "usuário" aqui: a conta.** Retenção (quem volta) e usuários únicos (DAU/WAU/MAU) só se medem com um identificador que dure de um dia para o outro. O convidado **continua anônimo** (só contagens: o dono decidiu isso em 28/09 e 04/10 e nada aqui o desfaz); quem **criou conta** passa a ter a atividade registrada. **Isto é dado pessoal novo** e vai ao ar antes da política de privacidade existir: registrei o inventário (`PRIVACIDADE.md`) e o que falta (política, "apagar a conta", "baixar meus dados") como pendência do dono, sem esconder.
2. **Uma linha por conta por dia** (`atividade`): abriu o jogo, rodadas, segundos, abates, mortes. É o mínimo que responde as perguntas dele (quantos entram, quantos minutos, quantas mortes) e a retenção; nada de linha por rodada nem de histórico de montagens (cresceria sem fim e não responde nada que o dono perguntou). Apaga com 400 dias.
3. **A sessão vai junto da rodada**, no cabeçalho, e **só para o servidor dono do token** (a mesma chave por servidor da sessão: um link com `?servidor=` apontando para outro lugar não recebe o token guardado). Sem sessão, ou com sessão vencida, a rodada vale como a de um convidado: nada se perde, só deixa de ser de alguém.
4. **O painel mostra só contagens:** o bloco `usuarios` não leva e-mail nem número de conta (teste confere).
5. **A retenção é a clássica, do dia exato** (D1 = o dia seguinte, D7 = o sétimo) e **só das contas criadas depois de a medição começar**: sem atividade registrada antes, uma conta velha contaria como "não voltou" e derrubaria o número. As coortes cujo dia ainda não passou ficam de fora.
6. **O que mais interessa a este jogo e entrou:** o **mapa**, a **onda** em que a rodada parou (onde a Sobrevivência perde gente) e a **vitória ou derrota** das missões (a Amazônia vence-se?). Opcionais no contrato: o navegador antigo continua valendo.
7. **De fora, de propósito:** o **chassi por conta** (a montagem já está nos resumos por montagem), o **lado** (P186, ainda não existe) e a vitória em **Bandeira e Domínio** (o cliente ainda não sabe o time do jogador no online: P81). O servidor também passou a **varrer sessões vencidas e atividade velha** ao subir e a cada 6 h: `limparExpiradas` existia e ninguém a chamava.

## [2026-10-18] Os geradores do escudo são alvos destrutíveis, e o escudo é um multiplicador no corpo do Draga (Claude, P180 parte D1)

**Ordem:** *"há uma enorme força de defesa deles e teremos que desmantelar"* + *"a amazônia já foi entregue em partes, prossiga"*.

**Decisões:**
1. **Geradores = `Destructibles.addExterno`** (o registro dos coqueiros da praia), não uma regra de proximidade como os cabos e as portas: o jogador **atira** neles (é o que "desmantelar" pede) e o tiro, a explosão e o dash já os acertam sem código novo de combate. A caixa é sensor: o Mech atravessa, as vias do mapa não mudam.
2. **O escudo é um número no corpo do Draga** (`DragaMech.escudo`, 1 sem escudo, 0,1 com ele), aplicado em `damagePart` e `statusDamage`: **todo** caminho de dano passa por aí, então fogo, choque e explosão não são atalho. A regra de "quantos geradores restam" é pura (`EscudoDoDraga`) e o `Match` só escreve o fator a cada tick.
3. **O escudo não volta:** a missão obriga a ir até a defesa antes de enfrentar a máquina; rodada nova devolve tudo. **10% e 1.500 são proposta** do Claude (o Comandante ajusta em `ESCUDO_DO_DRAGA`).
4. **Publiquei a parte C da outra sessão como veio** (#375), em vez de refazê-la: o trabalho estava pronto, testado e sem PR (regra 15). A parte D1 parte da `main` já com ela.
5. **Duas correções do motor do tradutor** que a Amazônia expôs: a composição aninhada com **duas voltas** (um padrão dentro de uma parte) e a guarda do " · " feita **no que a lacuna capturou**, não na expressão (a expressão deixava o " · " na borda passar).

## [2026-10-17] A Amazônia, parte C: o Draga-01 com corpo e a missão do rio (Claude, P180)

**Ordem:** "continua iterando até concluir essas pendências": o chefe de verdade, a marcha até a aldeia e o que o jogador faz.

**Decisões:**
1. **O Draga é um `MechBase`** (como o Colossus), não uma entidade nova: ganha de graça a cápsula, o character controller, o dano por parte, o calor, o canhão, o `crawls` e o registro no combate. O `MechBase` pede um rig de bípede, então o do Draga é de **nós vazios** e o desenho de quatro pernas (`WalkerVisual`) vai por cima, injetado como interface (`VisualDoDraga`): o servidor e os testes de regra nascem sem ele.
2. **Dois módulos de perna para quatro pernas:** cada módulo é **um lado**. O desenho mostra a perna da frente caindo de 100% a 50% da vida do módulo e a de trás de 50% a 0%; a velocidade segue a regra do `MechBase.mobility` (um lado caído 50%, os dois 30%). **Um sistema de dano novo para quatro pernas ficou de fora de propósito**: custaria mexer no HUD, na rede e em todos os testes de dano.
3. **A missão tem módulo próprio** (`MissaoDoRio`), **não reaproveita `SurvivalWaves`**: o fim é o do Draga (cai, ou cruza a linha da aldeia), e a Sobrevivência da Amazônia não tem ondas. O fim sai pelo mesmo `onMissionEnd` das ondas, então a tela de fim e a campanha já funcionam.
4. **A Sobrevivência na Amazônia é a missão do rio:** o link do seletor de mapas leva direto a ela (`modo=survival`); o Deathmatch do mapa é escolha do seletor de modo. A campanha aceita as duas etapas na Amazônia (e não a Bandeira).
5. **O Draga e o rio carregam sob demanda** (`ChefeCarregado`, `carregarChefeSeFor`): o corpo, o cérebro e o desenho só baixam para quem abre a missão. **O JS de partida ficou em 490,7 / 500 KB** (a parte C pagou ~2 KB de HUD, fases e a fiação do `Match`; antes de a dieta de JS da `main` entrar, a soma dava 499,2 e a folga era de 0,8 KB): **a parte D e a E devem manter o que é só da missão sob demanda**.
6. **`?marcha=0.8` é um recurso de teste e de jogo:** começa a missão com o Draga já andado (de 0 a 0,95). Sem ele o Comandante teria de esperar dez minutos para ver o fim; a mesma ideia do `?onda=` da Sobrevivência.
7. **Aviso:** a floresta densa (0,82 de densidade, árvores de até 29 m) **esconde o Draga (38 m) de quem está dentro dela**; ele aparece no rio e nas clareiras. Ficou assim por ser o ambiente; se o Comandante quiser, a margem do rio ganha uma faixa menos densa.

**Prova:** mutação à mão, 60 mutações, **59 pegas**. A que escapa é **equivalente** (o `depois >= antes` do aviso da marcha é redundante com o teste de cruzar a distância). Duas lições: (a) uma cápsula com raio maior que a metade da altura **trava o Rapier** (o teste do raio a pega por um limite, e o corredor de mutação precisa de um tempo máximo por rodada); (b) os dois testes que escaparam de primeira (o Draga seguir o rio e o mundo congelar no fim) só pegavam o número, não o efeito: agora o desvio máximo do eixo do rio na marcha toda é medido (5 m, teto 12) e a posição do Draga no fim.

**Por que registrar:** quem for fazer a defesa (D) e a invasão (E) precisa saber que o Draga é um `MechBase` com dois módulos de perna, que a missão tem módulo próprio e que **o pacote de partida tem 9,3 KB de folga (490,7 de 500)**.

## [2026-10-17] O atualizador do servidor passa a guardar o fim da saída quando a verificação falha (Claude)

**Problema:** a verificação (typecheck + testes de `server/` e `shared/`) reprovou seis vezes e a produção ficou 2,5 h no código velho; o log só dizia "FALHOU", porque a saída ia para o console de uma tarefa agendada. Descobri a causa (concorrência com o trabalho dos agentes) por silêncio e tentativa, não por evidência.

**Decisão:** gravar as **últimas 40 linhas** da saída do comando que falhou no `atualizacao.log` (`ultimasLinhas`, testado). **Não** mudei a política (continua uma tentativa por rodada, voltando ao código verificado se falhar), porque repetir ou esperar silêncio é um trade-off de operação que cabe a quem usa a máquina: com a saída no log, o próximo episódio mostra qual teste caiu e por quê.

## [2026-10-18] O online volta sozinho quando cai; os lados Aliados × Consórcio ficam desenhados e esperam os times (Claude, P184 b, P185, P186)

**Ordem:** o Comandante confirmou que dois PCs de VPNs diferentes jogaram na mesma sala; pediu métricas de usuários e a ideia de lados assimétricos; e **pôs o online na frente de tudo** ("concluirmos tudo necessário pro online gameplay funcionar").

**Decisões:**
1. **Reconexão automática no cliente** (`OnlineSession`): seis tentativas em ~15 s (G13), a sala velha limpa (robôs, previsão, placar), o aviso no canto, **recusa não reconecta** (a resposta do servidor não muda tentando de novo). **Por quê agora:** o Comandante viu o jogo cair e pedir para recarregar; quedas de VPN, túnel e servidor travado são o normal de um jogo em casa, e a G13 já a pedia desde o início. **O servidor não mudou:** a volta é um JOIN novo (o piloto volta no ponto de nascimento e o placar da sessão zera): guardar o piloto entre conexões (um token de retomada) é um degrau a mais que só vale se as quedas continuarem comuns depois da porteira tolerante.
2. **O `NetClient` avisa o fim da conexão UMA vez** (no `error` de uma conexão que não abriu ou no `close`): o Node dos testes não manda o `close` de uma conexão recusada, e sem isso a reconexão nunca desistia.
3. **Métricas (P185):** a base já existe e é anônima; o que faltava (retenção, únicos, tempo por usuário) **só se mede com a conta** e exige a política de privacidade antes de lançar (a decisão de privacidade de `shared/net/telemetry.ts` era "antes de existir login/LGPD": o login existe desde a P174).
4. **Lados jogáveis (P186):** a ideia do Comandante virou o § 3.5 do `LADO_E_PEDAGOGIA.md` (a tabela das duas pontas, os riscos, a ordem de quatro degraus e as alternativas ao nome "Consórcio"); **não construo agora**: depende dos **times na sala online (P81)**, que são o próximo passo técnico e destravam também o CTF 2v2 online.

**Prova:** 5 testes da reconexão contra o servidor de verdade e 3 do aviso único; mutação à mão, 10 de 10.

## [2026-10-17] A porteira descarta o pico em vez de cortar a conexão (Claude, P184)

**Ordem:** "não tô conseguindo jogar online, dá erro e cai a conexão... não consigo jogar CONTRA meu outro PC usando VPNs diferentes".

**Diagnóstico (do `servidor.log`):** quatro "corte de ...: taxa alta demais", dois deles de IPs de VPN, com o servidor saudável; o `tickMs` (média móvel de 2%) em 298 e 1.093 ms, ou seja, travadas de segundos do laço; PC do servidor com ~400 MB livres de 6 GB.

**Decisão:** a porteira **descarta** a mensagem quando o balde esvazia e só **corta** quando o descarte vira abuso (`dropCut` = 600, caindo `msgs` por segundo); a folga subiu de 30 para 120. **Por quê:** o corte no primeiro excesso punia quem esperava o servidor (as mensagens de todos chegam juntas depois de uma travada), e o jogador de VPN, com mais jitter, caía primeiro. Descartar custa uma conta (nada é decodificado) e perder um pacote de entrada só faz a previsão se corrigir; a inundação de verdade ainda cai em instantes (mil mensagens de uma vez cortam em ~700).

**Não resolvido por código:** o túnel da Cloudflare cai com a VPN do PC do servidor (502), e o PC do servidor é o mesmo da bancada de trabalho (memória). Está no `DEPLOY.md` § 4b.

**Prova:** testes do balde e do servidor de verdade; mutação à mão, 7 de 7.

## [2026-10-17] Auditar o idioma também por modo de jogo, e deixar o arpão do Onça para o Comandante (Claude, P173/P181)

**Decisões:**
1. **A auditoria de idioma roda em cada modo** (`?lang=ja&modo=…`, jogando alguns segundos), não só nas telas do console: a missão da praia tinha dezenas de textos em português que nenhuma tela de menu mostra. A Amazônia fica de fora (outra sessão).
2. **Constantes viram chave inteira** ("CIDADE NO ESCURO · AS ZONAS DE CURA CAÍRAM"), **o que tem número vira padrão** ("CABO {0} TOMADO · …"): a tradução da frase inteira sai melhor que parte a parte; a composição `{0} · {1}` fica para o que o código cola.
3. **Ombros no Onça não entram sem o olho do Comandante:** o encaixe de ombro do Marauder é medido no desenho importado; o Onça é procedural, então precisaria de encaixe, boca e lançador desenhados. Hoje o arpão é do Marauder (que puxa qualquer médio e mais leve); o Onça (raio 1,6) seria o melhor usuário, mas é decisão visual dele.

## [2026-10-17] Cópia de segurança do banco de contas dentro da pasta do projeto (Claude, P183)

**Pergunta do Comandante:** onde ficam os logins sem Supabase? A resposta honesta incluía um achado: **o `contas.db` era um arquivo só, no PC do servidor, sem nenhuma cópia.**

**Decisões:**
1. **Cópia diária consistente (`VACUUM INTO`), as últimas 14, na pasta `backups/` ao lado do banco**, feita pelo próprio servidor (ao subir e a cada 6 h). Não depende de tarefa agendada nem de script externo: se o servidor roda, a cópia roda.
2. **Dentro da pasta do projeto, por G15 (regra do dono):** o projeto não grava fora dela. **Consequência dita em voz alta:** a cópia não protege de o disco morrer; levar `backups/` para fora é decisão e ação do dono (`Copy-Item`), não do código.
3. **Falha na cópia só registra:** o jogo e as contas não caem por causa de um backup que falhou.
4. **Nada de Supabase por causa disto:** o SQLite no PC continua sendo a decisão do dono (28/09); a troca de banco (Postgres, se crescer) continua sendo mudar só o `server/contas.ts`.

## [2026-10-17] Os painéis opcionais do console saem do JS de partida (Claude, R7)

**Problema:** o teto de 500 KB gzip do JS de partida estava em 499,7 KB. Cada PR que somava um módulo (o `‹ valor ›`, o Arquivo, o idioma do Hangar) empurrava o total para o limite e travava o `npm run check`; a saída honesta era emagrecer, não subir o teto (R7 é do protocolo).

**Decisão:** o que só abre por clique **não entra no download de partida**. O Esquadrão, as Campanhas, o Arsenal, o Servidor do dono e as Câmeras viram pedaços sob demanda (`import()` + `sobDemanda`), no modelo que o `orcamentoDeJs.mjs` (P180) já previa para as fases. Partida: **499,7 → 486,2 KB**. **O custo:** o primeiro clique de cada painel espera o pedaço (<7 KB gzip, uma requisição); sem rede o painel não abre e o jogo avisa no console.

**Regra que fica:** tela ou painel opcional = `import()`; texto estático longo = JSON em `public/`. **O que não foi feito e por quê:** o Hangar (`HangarMenu` + `HangarScene`, ~43 KB minificados) segue no pacote de partida: o `Game` o aquece no boot para o primeiro "H" não engasgar, e tirá-lo muda essa experiência; fica como a próxima alavanca, decisão de quem mede a sensação.

## [2026-10-17] A Amazônia, parte B: o rio e o mapa (Claude, P180)

**Ordem:** "continua iterando até concluir essas pendências": o cenário do rio, bem maior que o que temos, eficiente, com o rio limpo acima do Draga e envenenado depois dele.

**Decisões:**
1. **O terreno é uma função pura única** (`alturaDoTerreno`), lida pela malha e pelo colisor de altura: o que se vê é o que se pisa (G14), e a grade é uma só para os dois. **24 pedaços de 300 m, um nível de detalhe só** (o plano falava em três; com o alcance de 1.500 m o terreno inteiro dá ≤ 120 mil triângulos, e níveis a mais custariam emenda e código sem ganho medido). Encosta máxima de 0,50, medida na grade inteira.
2. **O rio é o termômetro por UM uniforme** (a frente): o shader da água, o do chão, o da folhagem e o das estruturas leem o mesmo número; `limpezaDoRio` é a mesma conta em JS (pura, testada) e em GLSL (a string é travada por teste). A banda do veneno é de 70 m de cada lado (não é uma parede).
3. **A floresta tem dois níveis por pedaço de 300 m** (a árvore de 52 triângulos até 260 m, o bloco de 10 até 1.050 m) e **rareia em volta da mina e da planta** (o desmatamento é a história da fase).
4. **Mapas grandes carregam sob demanda** (`mapasSobDemanda.ts`): o registro é o único que o pacote de partida enxerga. O `ServerPanel` também passou a ser sob demanda para devolver folga ao teto de partida (**497,2 / 500 KB**): é a mesma política de dois tetos da parte A (o Comandante pode vetar).
5. **O Draga na Amazônia anda rio acima a 2,6 m/s e para a 240 m da aldeia** (~9 minutos): a frente do rio vai com ele. Responde, para esta fase, a decisão em aberto 0 do `AMAZONIA.md` (a Draga **anda desde o começo**); o Comandante ainda pode mudar.
6. **A câmera do mapa:** a do jogo (800 m) cortava o mapa de 2.400 m e deixava o céu preto; o mapa agora traz o `alcanceDaCamera` (1.500 m) e o domo de 1.200 m cabe dentro dele. **Lição:** **a bancada tinha a câmera dela e não via o que o jogo via**; o céu preto só apareceu no jogo real. Agora a bancada usa o mesmo alcance, e `medicoes/amazonia-jogo.mjs` fotografa o jogo.

**Bugs achados pelos testes e consertados:** (a) `THREE.UniformsUtils.merge` copia o valor de cada uniforme: a água e a lagoa nunca leriam a frente nem o tempo (hoje os uniformes do mapa entram por referência, e um teste confere que são o mesmo objeto); (b) a chave da campanha só lia os mapas `a` e `b`, e o link da etapa só levava `mapa=` para o Bunker (uma etapa na Praia abria a Cidade Neon); agora lê `abpz` e leva o mapa de todos os que não são a Cidade Neon.

**Prova:** mutação à mão, 71 mutações, **69 pegas**; as 2 que escapam são equivalentes (a guarda de declive da floresta é redundante com a fórmula de densidade; a guarda do nascimento do jogador é redundante com a da aldeia). Elas ficam no código por segurança contra mudança futura de layout.

**Por que registrar:** quem for fazer o Draga com corpo (C), a defesa (D) ou a invasão (E) precisa saber que o rio lê UMA frente, que o mapa é sob demanda, que a câmera do mapa é maior e que o orçamento de contagem tem folga de 9% no pior ponto (a aldeia).

## [2026-10-17] O idioma se audita no navegador, e a composição "A · B" traduz parte a parte (Claude, P173)

**Problema:** o Comandante quer o jogo no idioma nativo de quem chega. O teste de cobertura (que lê o código) dava tudo verde, mas **o Hangar falava português em japonês**: o texto que o jogo monta (colando "MÉDIO", "ASSALTO" e a descrição com " · ") nunca é uma chave do dicionário, e o teste só olhava as partes.

**Decisões:**
1. **A auditoria de idioma é feita no navegador de verdade** (abre cada tela com `?lang=ja` e lista o texto sem tradução): o que o jogador lê é o que importa, não o que está no código. `.tmp/auditar-idioma.mjs` e `auditar-jogo.mjs` (locais) são o modelo; o **teste de cobertura agora exige que nada em português sobre** (só nomes próprios e unidades), não só que "mudou".
2. **Chaves de composição `{0} · {1}` e `{0} · {1} · {2}`** (as seis línguas): cada parte é traduzida pelo que o dicionário já sabe e a estrutura fica. Um texto composto novo não pede uma chave nova se as partes já têm.
3. **Duas regras no motor do tradutor:** o padrão com **mais texto fixo** vence (antes: o maior regex, que contava as lacunas), e uma **chave sem " · " não engole uma composição**. Sem a segunda regra, `ESCALA {0}` e `{0} aliados` pegavam "ESCALA 3 · CERCO · …" e deixavam o resto em português, com o teste (que só via "mudou") verde.
4. **As frases que o código cola caso a caso** (a dica da arma + o aviso dos ombros + o das costas…) **se traduzem pedaço por pedaço e se juntam** (`traduzir` no `HangarMenu`), em vez de uma chave por combinação possível.
5. **O que fica em português de propósito:** as telas do dono (Arsenal, Estúdio, Servidor), os rótulos de acessibilidade do mapa e os nomes próprios dos robôs.

## [2026-10-17] O Arquivo: conteúdo em JSON por língua, painel sob demanda, tudo opcional (Claude, P179 camada 2)

**Ordem:** mostrar o posicionamento do jogo *"SUTILMENTE E ELEGANTEMENTE, pedagogicamente"* e explicar o que é o fascismo, a rede de mentiras, os interesses das elites e a manutenção do medo.

**Decisões:**
1. **Opcional, nunca porta:** o Arquivo mora num chip no console e na pausa; não abre sozinho, não interrompe partida (P133 e a regra 5 do `LADO_E_PEDAGOGIA.md` § 3.4). Quem quer aprender abre.
2. **Uma ficha, quatro partes:** o que é, como aparece, como se defender, a fonte. **A contramedida é a parte que ensina**: o jogador aprende a reconhecer e a agir, não a ouvir sermão. **A ficha 6 é sátira declarada e a tela diz**: a regra "sátira exagera, fato é fato" aparece para o jogador, não só no documento.
3. **Conteúdo em `public/arquivo/<língua>.json`, não em chave de dicionário:** cada língua é um arquivo que um revisor nativo edita inteiro, sem ficar espalhado em seis dicionários carregados no boot de todo jogador. Língua sem arquivo cai no inglês, depois no português.
4. **Painel como pedaço sob demanda (`import()`):** o JS de partida estava em 499,6 / 500 KB. O orçamento de dois tetos (`scripts/orcamentoDeJs.mjs`, P180) existe para isto: recurso opcional não pesa no download de quem não o usa. **Regra para os próximos: texto longo vai para JSON em `public/`, tela opcional vira `import()`.**
5. **Teste como trava de conteúdo:** nenhum nome de político ou bilionário vivo em nenhuma língua (arquétipos, decisão #9 do `UNIVERSO.md`), só as incoerências como sátira, toda ficha com fonte, o mesmo número de sinais em todas as línguas (a tradução não perde nem inventa um tema).

**O que a decisão não faz:** não revisa as fontes (citadas de memória; **revisor humano antes de ir ao ar**) e não traz casos reais (só com fonte dada pelo Comandante).

## [2026-10-17] O MULTI da primeira tela delega ao botão que já existe (Claude, P182)

**Ordem:** a anotação do Comandante, **MULTI** sobre o "2Players" dos jogos antigos.

**Decisões:**
1. **O botão verde é o SOLO; o MULTI é uma chapa embaixo, não um segundo botão primário.** Princípio de uma ação primária por tela (`AUDITORIA_INTERFACE.md`): a pergunta tem duas respostas, mas Enter continua sendo "jogar contra os bots" (o caminho de quem acabou de chegar). O MULTI é azul frio e só acende em dourado sob o mouse ou com o foco (a linha selecionada da referência).
2. **Delega, não duplica:** o clique chama o `#btn-online` do monitor da REDE (que abre o lobby). O estado (em sala ou não) vai em `data-online` no botão, porque o rótulo muda de língua. A regra de entrar online continua só no `OnlineSwitch`.
3. **Só na primeira tela:** no console completo o monitor da REDE já tem o botão (nada repetido), e sem servidor no build o par não existe (não há MULTI para oferecer).

## [2026-10-17] As dicas de arma do Hangar saem do pacote de JS para um JSON (Claude, P182)

**Problema:** o orçamento de JS (R7, 500 KB gzip) estava em 500,03 KB com o `‹ valor ›`; qualquer módulo novo, de qualquer agente, quebraria o `npm run check`. Subir o orçamento não era o caminho (R7 é do protocolo).

**Decisão:** as 22 dicas de uma linha das armas da tela do Hangar (3,5 KB de texto, `WEAPON_HINT` + `WEAPON_HINT_NOVAS`) moram em `client/public/dicas-do-hangar.json` e chegam por um `fetch` na primeira abertura do Hangar (`ui/dicasDoHangar.ts`; sem rede, a dica fica vazia e a próxima abertura tenta de novo). O pacote caiu para **498,49 KB** (folga de 1,5 KB). `dicasDoHangar.test.ts` guarda a regra que o `Record` do TypeScript dava: uma dica por arma do jogo, nenhuma repetida. **Quem for acrescentar texto estático longo ao pacote deve fazer o mesmo** (JSON em `public/`), e não gastar a folga.

**Achado (R17, ainda aberto):** essas 22 dicas **não estão nos dicionários das seis línguas** (a frase do Hangar é montada com sufixos, e a busca é pelo texto inteiro): o Hangar fala português em qualquer idioma. Agora que o texto é dado, o caminho é traduzir cada dica no arquivo; fica registrado no `ESTADO_ATUAL.md`.

## [2026-10-17] A Amazônia: o plano e o Draga-01 riggado (Claude, P180)

**Ordem:** a próxima fase no rio Amazonas (mineradora, rio envenenado, povos indígenas expulsos), com o modelo "heavy industrial walker" do Comandante, "eu não inseri o RIG: tenho que fazer ou você faz?", e o rio limpo a montante e envenenado a jusante.

**Decisões:**
1. **O rig é do Claude, por script de Blender reproduzível** (`scripts/blender/rig-walker.py`), não manual no Blender do Comandante: ele não precisa mexer, e o arquivo sai igual toda vez. O original em `MODELOS 3D` nunca é tocado.
2. **O Draga é quadrúpede e não segue o contrato do `MECHS_IMPORTADOS.md`** (11 ossos Mixamo, antebraço, encaixe de arma): ele ganha o próprio (18 ossos nomeados pelo papel: `fl_coxa`, `deck`, `radar`…). Forçar um quadrúpede num rig bípede seria mentira no código.
3. **Pele rígida por parte, não pele macia:** o arquivo é uma malha de 537 peças soltas de máquina; cada uma vai inteira a um osso (peso 1). A junta não amassa, o custo é o de um desenho e a classificação (por posição) se confere em foto.
4. **Cor nos vértices, sem textura:** o arquivo vinha cinza; um material só, cor por peça e sujeira para baixo. O download não cresce (984 KB) e o desenho segue sendo um.
5. **Marcha de quatro tempos, pisada de 75%:** uma máquina de 38 m não tira dois pés do chão sem parecer cair; o passo (5 m) casa com a velocidade para o pé não escorregar. É função pura (G14), testada sem navegador.
6. **O desenho é só do cliente:** o servidor nunca carrega `.glb` (G14). O Draga vai ser um chefe com **corpo na simulação** (cápsula e números próprios, como o Colossus) e o `WalkerVisual` segue a posição e o rumo dele; as pernas viram os módulos de dano da esquerda e da direita.
7. **O rio é o termômetro da fase:** a mecânica central pedida pelo Comandante vira uma função pura `limpezaDoRio(x)` e um uniforme no shader da água, sem custo por quadro (parte B).
8. **A vilã é arquétipo** (AURUM, Grupo Vorcaris), nunca empresa real; os fatos entram só com fonte (`fichas/fatos-mineracao-amazonia.md`, a escrever).
9. **O teto de JS passa a ser por fase (muda uma trava do projeto: o Comandante pode vetar).** O `smoke` somava **todo** o JS em 500 KB gzip, e a `main` já estava em ~499,8 KB: o Draga (2,4 KB) estourou o push (501,7 KB), e o mapa da Amazônia (dezenas de KB) estouraria de novo. Subir o teto mandaria o código da Amazônia a quem joga a Cidade Neon. **Agora são dois orçamentos** (`scripts/orcamentoDeJs.mjs`, testado em `server/orcamentoDeJs.test.ts`): **de partida** (o `index`, o que ele cita e os imports estáticos de cada um: o que todo jogador baixa; **o teto de 500 KB segue o mesmo**) e **sob demanda** (os pedaços que só um `import()` de dentro do jogo carrega: cada um até 150 KB gzip). O Draga entra como pedaço sob demanda (`WalkerDemo`, 2,4 KB), e o mapa da Amazônia vai pelo mesmo caminho. **Provado no build de produção:** sem `?walker` nada do Draga é baixado; com ele, o pedaço e o `.glb` chegam com 200. **Risco:** a classificação lê o código gerado (sem plugin); se o formato do pacote mudar, o teste do pedaço real (`WalkerDemo-*` fora da partida) acusa. **A folga da partida é de 0,1 KB**: o próximo código de uso geral volta a estourar; cabe ao Comandante decidir se o teto sobe ou se algo sai.

**Por que registrar:** quem for fazer o mapa, a defesa ou a invasão precisa saber que o Draga é quadrúpede de rig próprio, que o rio é o placar visível e que o desenho é só do cliente.

## [2026-10-17] A landing ganha idiomas com um módulo próprio, igual ao do jogo (Claude, P178)

**Ordem:** *"idioma tem que ficar logo no início da landing, pra pessoa já selecionar o idioma nativo dele"*.

**Decisões:**
1. **A faixa é a primeira coisa da página**, antes da navegação, com os nomes nativos (a pessoa acha a língua dela sem ler nenhuma outra): o visitante estrangeiro que não lê português precisa **reconhecer** a própria língua, não procurar a palavra "idioma". Enquanto ele não escolhe, a faixa fica realçada.
2. **Um módulo de JavaScript puro, não o do jogo:** a landing é uma página estática gerada por script, sem passar pelo build do Vite; trazer o tradutor em TypeScript pediria um segundo empacotamento. Em vez disso o módulo da landing é **a mesma conta, escrita à mão, e um teste os compara** (G14: uma regra só): se um dia divergirem, o `npm test` quebra.
3. **A mesma chave de armazenamento do jogo (`cybermech.lang`):** a landing e `/jogar/` são a mesma origem; quem escolhe na landing entra no jogo na língua dele sem pedir de novo.
4. **O dicionário é da landing, separado do do jogo:** os textos de marketing não pesam no jogo, e os do jogo não pesam na landing. As chaves que o gerador monta com número do código (`{0} de blindagem…`, `Tamanho {0} · {1} m`) são **padrões com lacuna**, para a landing não quebrar quando o número mudar.
5. **O teste da landing é um trinco, não uma trava dura:** 90% de cobertura (texto novo de outra sessão não derruba o `npm test` por uma frase), com a lista do que falta na mensagem de erro.
6. **Páginas internas (Oficina, Sala de controle) ficam em português:** são para a equipe e para quem acompanha o desenvolvimento; traduzi-las é decisão futura.

## [2026-10-17] O lado político entra pela pergunta, pelo custo e pela fonte; o arpão passa a obedecer ao peso (Claude, P179 e P181)

**Ordem:** *"devemos perguntar se quer jogar pelos aliados antimperialistas […] ou fazer campanha para fortalecer o desmatamento, imperialismo e fascismo das elites"*, ensinando o que é o fascismo e como a mentira e o medo funcionam, *"SUTILMENTE E ELEGANTEMENTE, pedagogicamente"*; e *"robôs mais pesados não podem ser puxados por robôs mais leves"*.

**Decisões:**
1. **A pergunta existe, mas não é uma porta.** O primeiro acesso segue caindo numa partida (P133); a pergunta mora num selo do console e da pausa. O padrão é a Aliança. A pergunta automática depois da primeira rodada fica como decisão dele (`LADO_E_PEDAGOGIA.md` § 7).
2. **Escolher o Consórcio nunca é premiado em silêncio:** o painel mostra **o discurso e o custo** (a sátira dos eufemismos) antes de valer, e, nas camadas seguintes, o fim de missão mostra o que a "operação segue" custou. Pedagogia por contraste, não sermão e não propaganda às avessas.
3. **Ensinar é uma ficha com fonte, não uma opinião do jogo:** o Arquivo parte de estudiosos conhecidos (Eco, Paxton, Stanley, Arendt, RAND), citados para um **revisor humano conferir** antes de ir ao ar; casos reais, números e nomes **só com fonte** (a regra "sátira exagera, fato é fato" de `CAMPANHAS_E_CHEFES.md`). Sem símbolos reais do nazismo ou do fascismo: o fascismo aparece **por mecanismo e por arquétipo**.
4. **A Amazônia é do Comandante no modelo e da Claude na lógica:** a ficha fixa o que a missão faz e os **nomes dos pontos** que o modelo precisa trazer, para ligar sem retrabalho (a lição do Bunker). Nada do modelo foi tocado.
5. **O peso do arpão é o raio da cápsula** (o mesmo número que já decide o empurrão): igual puxa igual, o mais leve não puxa o mais pesado. Foi o dado que já existia em todos os chassis; "peso" de verdade (massa) não existe no código, e criar um agora mexeria no Hangar. O custo: os chassis de malha importada com o mesmo raio contam como do mesmo peso.
6. **As capturas de jogos de terceiros não entram no git** (as dos jogos antigos ficam em `.tmp/referencias/`): o git guarda a leitura e o que levamos, não a arte.

## [2026-10-17] As outras fases: o circuito do quadro de luz se repete na Cidade Neon (Claude, P177, P164)

**Ordem:** "melhore as outras fases além da estação cabos" e, da P164, "um circuito que podemos repetir nas diferentes fases" e "chefes especiais com contexto em cada outra fase".

**Decisões:**
1. **A primeira "outra fase" é a Cidade Neon (a Arena), não o Bunker:** a missão padrão do jogo (`campanhaPadrao`) é a sobrevivência na Arena; o Bunker só tem Deathmatch. Melhorar o que a maioria joga primeiro.
2. **O circuito é a mesma classe, não uma cópia:** `QuadroDeLuz(ponto, vidaMax)` (o padrão é o do porto). Uma regra só (G14); o `Match` escolhe a instância por mapa. **O transformador tem 480 de vida** (o do porto, 240): é o coração da cidade, e o Colossus (peso 4) o apaga em ~20 s, o que dá ao jogador uma janela para derrubar as pernas dele.
3. **O Colossus vai ao transformador e é solto quando ele cai:** o contexto do chefe na Arena é "ele apaga a energia do banco". Sem o que depredar, volta ao comportamento normal (senão ficaria parado em cima de um quadro morto).
4. **Escurecer a cidade é mexer em cores, não em luzes:** as arestas, faixas e janelas são emissivas (não leem as luzes da cena), então a energia escala as cores registradas (`Arena.registraLuz`), só quando a energia muda. **O piso é 12%** para o jogador ainda ler os prédios. **A placa do banco cai junto** (é o transformador dele). Os LEDs da torre Serafim ficam de fora (a base do time tem os modos próprios).
5. **O HUD de missão reaproveita o `PraiaHud`** (modo `soMissao`) em vez de um segundo HUD: a célula do quadro, a barra do chefe e os avisos já existiam e ficam iguais; o que é só da praia é escondido por CSS e pulado no código. A regra dita do chefe vem de `regraDaFase(fase, alvo)`: na Cidade Neon não há cabos, e dizer "ele vai cortar os cabos" ali seria mentira.
6. **Nenhuma condição de derrota nova:** o transformador apagado derruba as zonas e a luz, não a missão (o núcleo da praia é que a perde). A missão padrão fica mais exigente; o equilíbrio jogando é pendência.

**Por que registrar:** quem for levar o circuito ao Bunker, à Bandeira e ao Domínio, ou equilibrar a missão, precisa saber que a instância é por mapa, que o escurecimento é de cores registradas e que o Colossus é solto quando o quadro cai.

## [2026-10-17] A Colossus em três fases, a barra do chefe e a máscara (Claude, P165, P147)

**Ordem:** a parte D do capítulo 1 ("CONTINUA SEGUINDO A PARTE B, C e a D") e a máscara da Colossus V1 só como chefe (P165).

**Decisões:**
1. **As fases saem do dano por parte que já existe**, não de um sistema novo: `faseDoChefe` lê a vida das pernas e do tronco (anda, manca, rasteja, caiu). Uma regra só (G14), pura e testável.
2. **Só o chefe rasteja** (`MechBase.crawls`, 30% da velocidade): num Mech comum, perna destruída segue como torre imóvel, que é a regra de equilíbrio de sempre. O rastejo é o que faz "pernas caídas" virar **outra luta** em vez de fim de luta.
3. **O alvo do titã é o cabo mais perto ainda de pé**, e com os três cortados a porta principal. **O jogador pode kitar** (afastar o titã dos cabos atirando e correndo): fica permitido, é estratégia, e o rastejo a 30% a torna viável.
4. **A máscara é 1,3× a cabeça e desligável (`?mascara=0`)**: a caricatura de figura pública é sátira política que o Comandante pediu, e o **risco jurídico e de plataforma** segue registrado (`CAMPANHAS_E_CHEFES.md` § 0). O botão de desligar é o que protege o jogo se uma loja reclamar. Só desenho: não toca colisão, vida nem arma.
5. **A barra do chefe diz a regra da fase numa linha**: o jogador entende o problema sem ler manual.

**Por que registrar:** quem for equilibrar o chefe (vida, 30% do rastejo, peso 4 nos cabos são linhas de tabela) ou levar a missão para a rede precisa saber que a fase é derivada do dano e que o rastejo é só do chefe.

## [2026-10-17] Entrega só conta quando o dono a acha: o idioma e a conta vão para o canto da primeira tela (Claude, P176)

**Ordem:** *"nao achei o arpao no hangar, nem a mudança das linguas, nem login"*.

**Decisões:**
1. **Antes de mexer, conferir o que um visitante vê** (navegador de verdade no site de produção, não o repositório): estava tudo no ar. O defeito era de **descoberta**, não de entrega. Registrado porque a regra 16 do `AGENTS.md` ("toda entrega visível fecha com o caminho para vê-la") foi cumprida no papel (o caminho estava no PR) e falhou na prática: o caminho tinha quatro passos, e o primeiro acesso é de propósito uma tela de uma ação só.
2. **Idioma e conta vão para o canto da primeira tela e da pausa, discretos** (um seletor e um botão pequenos): não quebram o princípio de "uma ação primária por tela" (`AUDITORIA_INTERFACE.md`), porque não competem com *CLIQUE PARA JOGAR*. O princípio "nada de porta" (`RANKING_E_LOGIN.md` § 1) segue: o botão **[ CONTA ]** só abre um bloco opcional.
3. **Dois seletores de idioma, uma escolha:** o conjunto de seletores é do módulo de idioma, então qualquer lugar novo que queira o seletor só chama `ligarSeletorIdioma`.
4. **O arpão não ganhou atalho:** só o Marauder tem ombros (regra de chassi, P77); mudar isso é decisão de design do Comandante, não conserto de visibilidade. Fica como falta declarada.

## [2026-10-17] Os bots atiram o laser e a cadência de conteúdo vira número no painel (Claude, P175)

**Ordem:** as pendências abertas recentes (a P160 deixou "os bots usarem as armas novas"; a P171 pediu "contar conteúdo como se conta código").

**Decisões:**
1. **O bot reaproveita `Match.beamPulse`, não ganha um raio próprio:** uma regra só (G14) para jogador e bot, e no servidor o pulso do bot já vira evento de tiro (`onBeam`). A opção é `pulso` do `BotSystem`, **separada dos `launchers`**: `explosivos: false` desliga o míssil, não o laser.
2. **O laser entra como arma de energia do bot, na cadência dela**, sem o "segurar o gatilho" do jogador: o calor e a pausa da IA já cortam a rajada. Não houve ajuste de equilíbrio (o dano por pulso, 6, cai com a distância e o bot erra a mira da dificuldade).
3. **O arpão não é arma de bot:** só há ombros no Marauder, e o bot não os tem. Fica declarado.
4. **O ritmo de conteúdo mede o que é inequívoco: arma e chassi** (ids do código, datas do git). Mapas, pilotos e eventos ainda não entram (não há lista no código para ler). A média usa as quatro **últimas semanas completas** (a corrente fica de fora: senão ela sempre puxaria a média para baixo).
5. **D7 e DAU/MAU não foram feitos de propósito:** exigem guardar um id por visitante, que é decisão de privacidade do Comandante (LGPD), não de engenharia.

## [2026-10-17] O login do jogador: a conta guarda o progresso do navegador, sem porta e sem id local (Claude, P174)

**Ordem:** *"concluamos sobre o LOGIN"* (camada C3 do `RANKING_E_LOGIN.md`).

**Decisões:**
1. **Sem "id local" aleatório, como o plano previa:** o navegador **já é** a fonte do que ele guardava (nível, créditos, apelido, montagem); a conta é uma **cópia** que o alcança. Um id a mais não resolveria nada e criaria um segundo estado para sincronizar.
2. **A junção é "quem tem mais progresso vence por inteiro"** (nível, depois XP; empate, o último a gravar), com o apelido e a montagem do outro cobrindo os vazios. Somar créditos dos dois lados dobraria o ganho de quem joga em dois aparelhos; o plano diz "não perde nada", e perder o ganho do lado menor é o preço de não permitir esse dobro. A regra é uma função pura testada.
3. **Rede nunca é requisito:** falha de rede não trava nem apaga nada, o token **não** é apagado quando o servidor não responde (sessão vencida e rede fora são indistinguíveis para o cliente), e **sair não apaga o progresso do aparelho**.
4. **O progresso da conta é conforto, não verdade:** não vale para ranking (G13: só o servidor autoritativo pontua o global); quem adulterar só adultera a própria conta. Por isso o servidor valida a **forma** e os limites, não a "legitimidade".
5. **Token por servidor** (como o do admin): um link com `?servidor=` de terceiros nunca recebe o token guardado.
6. **Só nas Configurações, por ora:** o princípio é "nada de porta" (`RANKING_E_LOGIN.md` § 1); o convite depois da primeira partida fica como próximo passo, para não ser feito sem o olho do Comandante.
7. **R17 (achado):** `/conta/eu` nunca respondeu ao preflight do CORS; corrigido junto, porque a rota nova depende da mesma coisa.

## [2026-10-17] O arpão magnético volta, refeito sobre a main de hoje (Claude, P77 parte 3)

**Ordem:** P77 (11/10): *"VARIAR as armas e tecnologias"* nos ombros; o arpão estava num porte de 12/10 que nunca entrou.

**Decisões:**
1. **Não cherry-pick:** o WIP de 12/10 conflitava em ~20 arquivos com a `main`; foi reaplicado à mão só o que valia (a regra `HookSystem`, o modelo) sobre a `main` de hoje, com os ganchos novos (`weaponLook`, `dicasDeArma`, `fireFeel`, `muzzleFx`, `impactFx`: tabelas que obrigam uma linha por arma).
2. **Tiro de varredura, não projétil:** um raio de 45 m (58,5 no MK III: a faixa curta não muda com o nível, `calibragem.test.ts`), como o laser; o cabo é estado do `HookSystem` (pool de 8), não uma entidade física. Barato (um raycast a cada 4 s) e determinístico.
3. **Só o servidor e o jogo offline puxam:** o cliente online só desenha o raio (G14); o puxão chega pelo estado do robô. Por isso o cabo preso de outro jogador **não** é desenhado no online (declarado como falta).
4. **O contrajogo faz parte da arma:** dash corta, parede solta, o Colossus arrebenta o cabo (`breakRadius`), o alvo que foge estoura (125% do alcance). Sem isso o arpão seria "perdeu o controle do robô"; com isso é uma troca (um aperto a cada 4 s por juntar o inimigo).
5. **Dano baixo de propósito (10, 2,5 por s):** o arpão junta, não mata; o valor está nas outras armas de ombro (sônica, fogo, granada, foguete).
6. **Protocolo 20, no fim de `NET_WEAPONS`** (índices antigos intactos); um cliente 19 recusaria o tiro.

## [2026-10-17] O jogo ganha sete línguas, com o português como texto de origem (Claude, P173)

**Ordem:** colocar já o inglês, o japonês, o espanhol, o francês, o chinês e o russo (resposta à P171 (b)).

**Decisões:**
1. **O português fica no código e no HTML; as outras línguas são dicionários JSON** em `client/public/locales/`. Nenhum módulo de interface sabe de idioma (G3), nenhuma chave artificial para manter, e o texto novo nasce em português como sempre. JSON em `public/` e não módulo, porque o teto de JS (500 KB gz, ~480 hoje) não comporta seis dicionários e porque só baixa quem escolheu a língua.
2. **Tradutor de DOM com observador, não `t()` em cada arquivo:** o jogo escreve texto em dezenas de lugares (`textContent`); o observador pega todos sem tocar neles, e a troca de língua é ao vivo (cada nó guarda o original). O custo é só fora do português. `t()` existe para o código que monta texto na mão.
3. **Chaves com lacuna `{n}`** para o que o jogo preenche (número, nome), a tradução reordena; o valor da lacuna também é traduzido (uma volta), para `VENCEDOR: AZUL` virar `WINNER: BLUE`.
4. **Detecção pela língua do navegador só fora de navegador de teste** (`navigator.webdriver`): o smoke e as bancadas comparam textos em português; a escolha explícita (`?lang=`, seletor) vale sempre. Quem tem o navegador em inglês já abre em inglês (o alvo da P171: EUA, Japão, Alemanha, Coreia, Reino Unido).
5. **A cobertura é do teste:** arma nova, rótulo novo de configuração ou texto novo no `index.html` sem tradução **quebram o `npm test`**; é o que impede o dicionário de apodrecer.
6. **Fora do alcance, declarado:** voz do narrador, canvas, fichas do Hangar, a landing; alemão e coreano (os outros mercados da reportagem) ficam como o próximo passo barato (é só um JSON novo).

## [2026-10-17] O porto: os rebeldes nascem nos contêineres, e o quadro de luz liga a cidade às zonas de cura (Claude, P163, P164)

**Situação:** o Comandante pediu que os inimigos saíssem dos contêineres do porto ("bem explícito") e um sistema no porto, a proteger, que acende as luzes da cidade, repetível nas outras fases.

**Decisões:**
1. **Os contêineres de desembarque ocupam vagas do pátio do cais, três em vez de quatro:** a fileira z = 0 tem o farol de 38 m do lado da boca, e a de trás (z = -64) tem as pernas do guindaste; a sonda do terreno e o teste de folga acharam os dois (os 6 pontos de nascimento antigos eram na areia, em chão plano; os novos são no cais, uma laje no nível do chão, e o teste de nascimento passou a medir a folga só em relação ao que passa da altura do joelho). Cada boca solta duas levas (os Mechs na porta, os andróides 3 m à frente).
2. **O nascimento mudou da areia (~200 m da estação) para o cais (>460 m):** é mudança de **ritmo** assumida: os manifestantes (que nascem na avenida e na rua dos fundos) chegam em poucos segundos e as máquinas ~45 s depois. O Colossus fica na avenida até a parte D.
3. **O quadro de luz fica a mais de 500 m da estação, de propósito:** defender os dois não cabe no mesmo jogador, e **o saboteiro** (o primeiro andróide vivo da onda 2 em diante) é o único rebelde que vai para lá. **Ele tem consequência real:** a energia multiplica as luzes (o ciclo do dia manda quantas acenderiam) e, **apagado, derruba as zonas de cura e de resfriamento** (`ZoneSystem.energizadas`): a luz da cidade é o que cura o jogador.
4. **O circuito é uma regra pura repetível** (`QuadroDeLuz`: vida, depredador, defensor, energia): o quadro do banco e o transformador do datacenter são a mesma regra com outra peça.
5. **Lição de teste:** `damage: false` no `Match` desliga também o `crush` (não mata ninguém); o dano de sobra para apagar o quadro precisa de um `dt` grande (um passo de 1 s a 10 de peso tira só 60 de 240); e a mutação "o saboteiro aparece já na onda 1" foi escrita por mim para provar que a onda 1 fica só nos cabos.

**Por que registrar:** quem fizer a parte D (a Colossus) precisa saber que o nascimento agora é no cais e o chefe ainda não, que o quadro liga a cidade às zonas, e que o ritmo das ondas mudou de propósito.

## [2026-10-17] O manifestante é um andróide mais fraco no mesmo pool, as portas são regra pura, e só a praia pede manifestantes (Claude, P163, P166)

**Situação:** o Comandante pediu a invasão do prédio por **duas entradas** e os manifestantes dos eventos reais como NPC.

**Decisões:**
1. **O manifestante é uma variante do `Android`** (`tool: 'bandeira'`, `MANIFESTANTE_STATS`), **não uma entidade nova nem uma multidão sem física**: reaproveita o cérebro corpo a corpo, o tiro, o dano por parte, o placar e os testes de partida. O preço, dito: o pool da missão soma **13 personagens**, mais que os **8 character controllers** que o G11 pede para uma sala. Vale **offline**; **a missão online terá de caber no teto** (ou o manifestante vira agente leve sem controller).
2. **Sem arma de fogo, sem rosto:** a "arma" é a pancada de bandeira (**metade** da motosserra, o mesmo `WeaponStats` com `damage: 2`), e o desenho é genérico (pele, boné e camisa amarela, bandeira verde com losango): ninguém é retratado.
3. **As portas são a mesma ideia dos cabos** (regra pura em `sim/`, o `Match` só conta quem está perto): vida, dano por presença com peso por tipo, conserto de quem defende, **dreno da rede quando arrombada**. Porta forçada **não se recompõe sozinha**, de propósito: é preciso ir lá.
4. **Cada vaga do pool de manifestantes tem o alvo dela** (a vaga decide o lado de onde nasce: avenida ou rua dos fundos), e não a posição de quem está vivo: o grupo dos fundos vai à porta dos fundos sempre, sem atravessar o complexo.
5. **O plano da onda só vale com o pool**: `totalDaOnda(plano, comManifestantes)`. A Arena e o Bunker têm o mesmo plano de ondas e **não** têm manifestantes; sem isto o `Match` da Arena lançava "Pool da missão não cobre o plano da onda" (o teste existente pegou).
6. **Lição de teste:** com o jogador longe, os rebeldes da onda zeram a rede da estação em ~48 s e a missão **acaba** (os bots são desativados) antes de uma porta ceder. Teste de porta mantém a rede cheia a cada segundo, e o dreno das portas é medido **sem os invasores** e **sem os cabos já tomados** (o primeiro teste dele passava só com o dreno dos invasores: a mutação "as portas não entram no dreno" escapou até ele ser reforçado).

**Por que registrar:** quem for fazer a parte C (o porto) e a D (a Colossus), ou levar a missão para a rede, precisa saber que o manifestante divide o pool dos andróides, quem decide o alvo de cada vaga e que o teto de personagens está estourado de propósito offline.
