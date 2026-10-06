# Revisão amostral da suíte — 06/10

594 casos em 81 arquivos. Últimas suítes completas: 21,54 s / 22,42 s; uma execução sob carga levou 47,26 s com avisos de encerramento de workers. Build, smoke, medição de bocas e site são fases adicionais do check. Quantidade não mede cobertura nem utilidade.

Achado concreto: ModeSelector.test travava 2 modos e callbacks isolados. A simulação já aceita CTF; o Game ligava o seletor apenas a um briefing demonstrativo. Testes verdes não garantiam mudança da partida. Correção de UX deve usar o contrato gameModeFromSearch, oferecer CTF e provar navegação/partida no navegador.

Inventário conservador de imports dos 81 arquivos encontrou dois módulos sem referência no runtime cliente/servidor. Ambos continuam úteis: inspecaoMech é usado por scripts/inspecionar-mech.mjs; shared/net/budget por scripts/site/dados.mjs e testes de orçamento G11. Não remover por ausência no runtime. Esse inventário não é análise completa de call graph nem prova de cobertura.

Não criar novos testes duplicando ChargeTimer para o treino: reutilizar a regra existente e verificar a integração real no navegador. Manter testes críticos de autoridade, colisão, carga, protocolo e desempenho; atualizar/remover afirmações obsoletas ou testes que só verificam no-op.

Execução durante edição: selecionar os arquivos afetados. Entrega: check completo por regra 6/13 de AGENTS.md e pre-push R15; CI é a segunda validação, necessária ao merge autorizado. Não reduzir suite/limiares por conveniência. Uma futura otimização deve medir custo por fase, separar verificações repetidas com evidência e manter proteção contra regressão.

## Atualização das verificações de UX

ModeSelector agora usa o contrato GameMode e gameModeFromSearch da simulação. Os quatro casos existentes foram atualizados, mantendo 594 casos; não houve aumento de contagem para parecer mais seguro. No navegador, escolher CTF navega e o Game confirma ctf ativo. O treino usa ChargeTimer já testado e a prova verifica clique curto, cancelamento, nova carga e um disparo só depois de 51 ticks. Peso, excesso, ações bloqueadas e menu acessível em tela pequena também são verificações reais.
