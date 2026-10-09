# Evolução técnica — CYBERMECH

Auditoria Codex, 09/10/2026. Base: main `96711ea` (#192). Objetivo do dono: evoluir e superar tecnicamente as referências War Robots e Mech Arena. Esta primeira etapa confronta o material trazido no chat com o repositório; não certifica desempenho dos concorrentes nem adota suas estimativas de mercado como fatos.

## Evidência local antes da escolha de tecnologia

| Área | Evidência | Limite / próximo fechamento |
|---|---|---|
| Render | ShaderWarmup e histórico de 09/10: Iris Xe, 1080p, três execuções; 0 programas novos em jogo, 1 travada ≥300 ms | Hangar, GLB e remotos criados depois ainda têm primeiro uso; custo estável ruidoso (±30%). Não comprova 60 FPS sustentados |
| Qualidade | `core/Quality.ts`: média em janela de 2 s, reduz pixelRatio para 1 e depois desliga bloom | Não mede percentis nem tempo de GPU; não substitui ensaio térmico prolongado |
| Rede | `shared/net/constants.ts`: protocolo 6, 60 Hz simulação, 20 Hz estado, 30 Hz input, 8 humanos/sala | MAX_UNITS=32 é capacidade do buffer, não homologação de sala de 32 jogadores |
| Banda | Snapshots completos quantizados; budget automatizado; CAPACIDADE.md registra payload de ~4,39 KiB/s com 100 clientes locais | Payload medido não inclui TCP/TLS; cenário de luta do budget e ensaio de carga são medidas diferentes |
| Predição | `net/OnlineSession.ts`: histórico 256 ticks, tolerância 0,03 m, snap acima de 3 m, correção gradual | Desloca posições após ACK; não restaura estado completo nem reexecuta inputs. O texto antigo do plano descreve uma intenção mais avançada |
| Remotos | Buffer de 32 snapshots; interpolação fixa de 100 ms | Não é buffer adaptativo. Testar jitter, atraso e reconexão antes de alterá-lo |
| Acerto | Servidor emite HIT; cliente consome dano recebido | Retorno ao atirador e compensação de latência ainda incompletos; não ampliar rewind sem regra de justiça |
| Escala | CAPACIDADE.md: 100 clientes em 13 salas, 30 s/estágio, localhost | Não são 100 jogadores numa arena; repetir prolongado e em rede real antes de elevar limite |
| Conteúdo | Escudos, aliados offline, drones offline, Colossus e importados existentes | Seis chassis compartilham números; drones e chapa têm lacunas online; ampliar catálogo não resolve esses contratos |

## Sequência proposta, sem mudar a visão do dono

1. **Fluidez verificável (frente Codex):** cenário reproduzível em Iris Xe, versões identificadas, mesma resolução e montagem, A/B alternado após aquecimento. Registrar p50/p95/p99 de frame time, contagem de travadas >50/100/300 ms, carregamento, draw calls, triângulos e configuração. Incluir Hangar → GLB → partida e entrada de remoto. Critério G12 de 60 FPS continua meta, não resultado. Só atribuir regressão a um efeito quando o A/B a isolar.
2. **Consistência da simulação (frente de controle/rede):** reproduzir o afundamento parado em teste longo, sem reaproveitar remendos já descartados. Registrar altura, grounded e correções de rede. Definir se correção por deslocamento atende ou se precisa de estado restaurável/replay; mudanças de física não entram escondidas num PR de render.
3. **Combate online completo:** terminar feedback HIT, integridade/pose da chapa e roster necessário. Definir armas elegíveis, limite e validação do rewind; não aplicar a projéteis lentos automaticamente. Matriz de atraso/jitter/desconexão com dois clientes reais, resultados por versão.
4. **Mais jogadores, por degraus:** delta por baseline de snapshot confirmado (distinto do ACK de input), recuperação por estado completo e interest management com eventos relevantes. Medir CPU, memória e banda sob combate concentrado; depois propor 16 →32 →64. Não alterar ROOM_SIZE antes da evidência e do contrato.
5. **Transporte e hospedagem:** comparar WebSocket com alternativa de datagramas somente após medir efeito do transporte e verificar suporte atual dos navegadores e da origem. Preservar fallback; nenhuma migração de infraestrutura nesta auditoria. Túnel atual e infraestrutura nova exigem ensaio próprio.

## O que as análises coladas não demonstram

Instancing reduz submissões de desenho; não elimina processamento de vértices, preenchimento e transparência. Worker pode reduzir carga da thread de UI, mas inclui sincronização e transferência: medir antes de mover física. WASM/ofuscação não estabelecem confiança no cliente; segurança vem da autoridade e validação no servidor. Trocar biblioteca de sockets não garante multiplicador de capacidade quando física/IA são o gargalo. Orquestração não torna computação gratuita.

As alegações sobre netcode, tamanho de equipe, receita, consumo de bateria e superioridade dos concorrentes precisam de fontes identificáveis e contexto temporal. A série de outro jogo da Pixonic não prova implementação idêntica no War Robots. Não afirmar superioridade por stack, número de testes ou velocidade de commits.

## Entrega que significa superar

Comparar cenários equivalentes e hardware identificado: tempo até jogar, percentis de frame time, resposta ao input, justiça dos tiros sob latência, banda, recuperação e custo por jogador ativo. Onde não houver instrumentação do concorrente, limitar a comparação ao que se consegue observar; publicar o resultado do CYBERMECH com condições e limitações. Retenção e diversão exigem playtest e métricas de produto próprias (`PLAYTEST.md`, `OBSERVABILIDADE.md`).

Esta proposta não modifica `VISAO.md`, não congela o escopo por decisão unilateral e não aprova novo limite de jogadores. Próximo corte concreto: medição de fluidez e primeiro uso no Hangar/GLB, dentro do território Codex.
