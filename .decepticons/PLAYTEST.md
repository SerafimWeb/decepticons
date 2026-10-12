# Próximo ciclo de evolução

Objetivo: descobrir se montar o robô, acertar um tiro carregado e temporizar a barreira gera decisões legíveis e vontade de repetir. Nenhuma métrica mede diretamente dopamina ou serotonina.

## Roteiro offline (servidor público dispensado)

1. Jogue duas rodadas na mesma dificuldade/arena com plasma + foguetes, sem códigos.
2. Repita com trilho + EMP. Observe se o tempo de carga e o efeito de calor são compreensíveis.
3. Instale a barreira frontal no módulo extra; mantenha ambas as armas. Use E durante aproximação, vire para a ameaça e solte para recuperar. Compare dano recebido pela frente e pelos flancos.
4. Experimente o Banco separadamente; essa rodada é assistida e não entra na comparação normal.
5. Exporte o diagnóstico no painel detalhado; registre também, em texto, onde houve confusão, se quis repetir e qual instante pareceu mais satisfatório.

Não comparar builds de versões/dificuldades diferentes como se fossem um experimento controlado. Tempo até primeiro abate, abandono e quadros lentos ajudam a localizar atrito; não demonstram causalidade nem diversão isoladamente.

## Decisão para conteúdo novo

Se jogadores não entendem carga/energia, melhorar feedback e treino antes de arena nova. Se o combate já é claro, mas as rotas se repetem, prototipar uma pequena arena com cobertura lateral e variação de altura para testar as duas armas e a barreira. Esfera e escudo metálico devem entrar após esta leitura, com contrapartida de carga/energia e compatibilidade documentadas. O escudo metálico ocupa uma mão, conforme decisão do dono.

Pendência externa: coletar feedback humano e um diagnóstico comparável. Simulação automática não deve ser apresentada como validação de diversão.


## Esfera e equipe offline — 06/10, Codex

1. No Hangar, plasma MK I + foguetes MK I + esfera = 11 t no Vector. Ctrl liga/desliga sem segurar; Espaço pula e Shift dá dash. Compare frente/costas com o gerador frontal.
2. Arena offline: observe ESCOLTA·PLASMA e SUPRESSOR·EMP saindo do spawn; 1 acompanhar, 2 foco sob a mira, 3 defender onde o jogador está. Botões equivalentes no toque. Sem alvo, 2 deve avisar e preservar a ordem anterior.
3. Caminhe atrás dos três prédios; repita ordens, morra/renasça e mude de rodada. Registrar travamento em becos, fogo bloqueado por aliado e afastamento excessivo; desvio local não é navegação global.
4. Mech sem braços/pernas ou superaquecido continua sujeito às regras. A ordem não dá visão através de paredes e foco perdido por cinco segundos volta à escolta.
5. Compare novas armas no Hangar e filtro por chassi na Oficina. Conferir peso, modelos procedurais, aviso de GLB integrado e falta de defesa real no escudo metálico.

Servidor público offline não é dependência desta validação. Testes de autoridade usam somente localhost.


## O que olhar no jogo hoje — 12/10, Qwen (dez minutos, em ordem)

**Objetivo:** numa passada só, ver o que entrou e o que mudou de texto — e achar o que estiver errado. Isto **não** é teste de carga nem de rede: é **olho**. O que se procura aqui é **texto que mente** e **rótulo que não corresponde ao botão**.

1. **A entrada (30 s).** Abra o jogo: o título é **CYBERMECH** e a tela de início é a **sala de comando**. Passeie pelos monitores — cada um abre a sua tela, e nenhum assunto aparece duas vezes.
2. **O Bunker tem quatro andares (1 min) — a correção de hoje.** Pausa → **MAPA**: a dica do BUNKER deve dizer **"Mapa de quatro andares"** (dizia "3 andares"). Com `?comandante=1`, **COMANDO → TEATRO DE OPERAÇÕES → marcador do BUNKER**: o resumo deve dizer **"Quatro andares"**. *(Se entrar no Bunker, conte os pisos: 0, 14, 28 e 42 m.)*
3. **Montar o esquadrão (3 min) — o motor da P91 ganhou tela.** Console → **PILOTOS → [ ESQUADRÃO ]** (ou COMANDO → FICHA DE CADA BOT): some inimigos e aliados (`+ MECH`, `+ ANDRÓIDE`, `+ TÉCNICO`), escolha **chassi, arma, personalidade e dificuldade** robô por robô, veja a **carga** no pé (LEVE a EXTREMA), **[ SALVAR E REINICIAR ]** e **[ COPIAR LINK ]**. Fechar a janela **não** perde o rascunho. **O que olhar:** a lista de armas só oferece o que cabe no chassi; e, no Bunker, o aviso de que o mapa corta em 11 corpos.
4. **Ataque 1 e Ataque 2 (2 min).** Hangar → **Marauder**: os encaixes devem dizer **BRAÇO DIREITO · ATAQUE 1** e **OMBROS · ATAQUE 2**; nos robôs pequenos, **braço direito no 1 e esquerdo no 2**. Em partida, o HUD nomeia o Ataque 2 (**ATQ 2 · TELEGUIADO**). **O que olhar:** se o rótulo do encaixe corresponde ao botão que atira nele.
5. **As missões no teatro (2 min).** No **TEATRO**, clique nas cinco: **CIDADE NEON** e **BUNKER** levam ao jogo; **ESTAÇÃO DE CABOS**, **BARRAGEM** e **FÁBRICA DE CHIPS** aparecem como **EM CONSTRUÇÃO**, sem link — é de propósito (R13), e é onde as missões novas vão morar.
6. **O que ainda NÃO existe (para não caçar o que não tem).** As **missões** da ordem P99 (escolta, ataque, defesa de base, contraataque) estão em **ficha** — regra e tela especificadas, nada construído; a **chegada dos takes do `F9` na mesa** (P97) é do Claude; e o **painel admin** do #259 está fora do ar (o brief dele está no `ESTADO_ATUAL`).

**Se algo aqui estiver diferente do que este roteiro diz, é achado:** anote a tela e a hora (aqui embaixo, no chat ou no registro de ordens). Texto, eu corrijo; regra, vai para quem tem o território.

