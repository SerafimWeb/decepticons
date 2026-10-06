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
