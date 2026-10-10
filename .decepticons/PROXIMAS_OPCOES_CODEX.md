# Opções após C2 — 09/10/2026

Plano de trabalho proposto pelo Codex, sem alterar VISAO ou atribuir tarefas automaticamente às sessões externas. C1 (#198), C3 de caracterização (#204) e C4 (#205) estão mergeadas, com deploy verde confirmado. C2 mede escolhas posteriores e corrige restauração do alvo; preparação tardia continua PARCIAL.

| Prioridade | Opção e resultado esperado | Frente / dependência |
|---|---|---|
| 1 | C2: preparar a nova montagem antes de exibi-la, com limite de espera/memória, cancelamento lógico da seleção anterior e fallback | Codex; contrato de indicação de carga com Gemini antes de alterar UI |
| 2 | C3: tempo de GPU, ensaio longo e cenários GLB/combate, com percentis e identificação de carga concorrente | Codex; janela de máquina disponível e playtest em hardware alvo |
| 3 | C2: variantes de armas/níveis e primeiro aparecimento de remoto com dois clientes | Codex + contrato de criação do Claude; não aquecer todo catálogo no boot |
| 4 | C6: efeito 3D de choque/atordoamento com pool e teto, ligado ao estado autoritativo já entregue | Codex; contrato elétrico #199/#203 existente, custo medido; Gemini mantém som/HUD |
| 5 | C5: cenário mais legível, materiais/silhuetas e adereços instanciados, um corte visual por vez | Codex; REFERENCIA_VISUAL, comparação e orçamento antes de efeitos novos |
| 6 | Fechar feedback de acerto ao atirador, escudo/drones online e consistência física/reconciliação | Proposta para Claude; auditar estado atualizado antes de implementar |
| 7 | Revisar Hangar móvel, alcance de ações, menus e redução de tremor; finalizar câmeras de espectador | Gemini; ramo de câmeras identificado, execução/entrega devem ser confirmadas no repositório |
| 8 | Atualizar dependência transitiva vulnerável source-map-js e revalidar lockfile/build | Proposta para Claude na frente de build; achado R17 já registrado |
| 9 | Playtest com jogadores externos, fluidez percebida e retorno; distribuição em portal | Dono + agentes; critérios e identificação de retorno definidos antes da coleta |

Próxima execução Codex começa pelas opções 1/2; não exige escolher cada detalhe no chat. Opções 4/5 só ampliam efeitos com orçamento verificado. Escala maior de salas, transporte novo e rewind precisam de contrato/testes próprios; não decorrem automaticamente das referências War Robots/Mech Arena. Qwen/DeepSeek podem revisar independentemente evidências e regressões, se o dono despachar essa frente.
