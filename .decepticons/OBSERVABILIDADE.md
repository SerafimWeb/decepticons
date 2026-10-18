# Observabilidade e experiência — 06/10/2026

Há instrumentação implementada, mas a operação premium ainda não está finalizada. O servidor público está offline por orientação do dono. Esta entrega valida contratos e persistência local, sem atestar recebimento em produção.

## O que cada camada faz

- CI: typecheck, testes de simulação/HTTP, bundle, boot, bocas dos rigs e site/CSP. Contagem de testes não é cobertura nem disponibilidade. Indicadores derivados do workflow são proxies do pipeline; não são DORA de incidentes de produção.
- Cliente: tempo de boot, erros JS/promessas, perda de contexto WebGL, quadros ativos e lentos (>33,34 ms), p95 aproximado do tempo de quadro em bins de 1 ms com teto de 100 ms. Diagnóstico exportável no painel detalhado (tecla apóstrofo), com as últimas 20 rodadas. Frames ocultos, pausa e Hangar não entram no acumulador.
- Partidas: duração ativa, conclusão/abandono, primeiro abate, abates/mortes/dano, quadros lentos; agrupamento por versão, modo, montagem, online/offline e assistência por códigos ou potências alteradas. Troca de equipamento encerra o segmento anterior. Dados declarados pelo cliente, sem autoridade sobre créditos ou ranking. No online o fechamento usa ARENA_RESET: inclui o intervalo anterior ao reinício, pois a fase da rodada ainda não viaja na rede. Não comparar essa duração diretamente com a duração offline.
- Servidor: /partida-metricas valida formato/carga, limita corpo e taxa; grava somente agregados em partidas.json. Leitura no /metricas privado existente inclui RSS, salas e jogadores. O site /metricas exibe grupos, inclusive estado sem dados. Contadores de entrada/funil já existentes permanecem; aba+sequência evitam duplicação de reenvio.
- Serafim13: reutiliza sinal-erro existente para falhas do cliente publicado, com projeto cybermech, versão e contexto. Integração limitada aos hostnames oficiais; falha de envio não interrompe gameplay. Endpoint verificado no código do Serafim13; recebimento/persistência central e alertas ainda não homologados.

## Limites e privacidade

Nenhum POST por quadro. Diagnóstico usa histograma fixo; escudo simula no tick e desenha no pool. No máximo 20 erros enviados por carregamento, intervalo mínimo 1 s; e-mails e query/hash de URLs são removidos, mensagem/stack limitados. Não enviamos conta, nome, token, texto de código do banco ou identificador persistente de jogador.

Histórico: 20 rodadas locais. Fila: 12 resumos, validade 24 h, tentativa a cada 30 s e retorno da rede, timeout 3 s; pode descartar relatórios antigos ao exceder o limite. Deduplicação dos relatórios: 4096 IDs em RAM por até 24 h; reinício/evicção pode permitir recontagem. Eventos simples: 4096 IDs/10 min. Agregados: até 128 combinações, com contador droppedGroups; persistidos a cada 60 s e no fechamento. Agregados são cumulativos, não uma retenção de 24 h. Múltiplas abas ainda podem disputar a fila local; não há promessa de entrega exatamente uma vez.

## Ainda falta para operação premium

1. Confirmar um erro controlado chegando ao Serafim13 e atribuído à versão certa; configurar/validar alertas, responsáveis e recuperação.
2. Quando autorizado retomar servidor, publicar versão compatível, validar métricas remotas e disponibilidade por monitor externo, sem confundir site disponível com jogo disponível.
3. Medir dispositivos/rede reais, erros por sessão, falhas de entrada, reconexão e latência p95/p99. CAPACIDADE.md contém só a caracterização local.
4. ~~Definir política explícita para identificação entre sessões antes de retenção D1/D7.~~ **Decidido (P185, 18/10):** a identificação entre sessões é **a conta** (a pessoa criou o login); o convidado continua anônimo. A retenção D1/D7, o DAU/WAU/MAU e os minutos por piloto saem da tabela `atividade` (`server/contas.ts`), no bloco `usuarios` do `/metricas`. **Falta a política de privacidade** (`PRIVACIDADE.md`). GA instalado não prova cobertura, consentimento ou qualidade da coleta.
5. Evoluir retenção/agregação e entrega conforme volume; testes de restauração de SQLite/métricas e runbook de incidente. Não foi criado serviço duplicado de erros em paralelo ao Serafim13.

Validação atual: testes de scrub/limites, simulação de escudo, HTTP com relatório válido/inválido/excessivo, deduplicação e reinício; prova de exportação no navegador. Ver PLAYTEST.md para usar os números sem substituir julgamento do jogador.
