# VOCABULARIO_COMANDO — o léxico da voz do GRANDE IRMÃO (P244)

> **O que é:** o vocabulário que o Comandante usa com a própria voz (narração F8, efeito **Grande Irmão** em
> Configurações > CHAT DE VOZ, `voice/EfeitosDeVoz.ts` § `PREDEFINICOES_DE_VOZ`, doc técnica em `VOICE_CHAT.md` § 5e) para
> narrar a partida como uma inteligência de controle — onipresente, analítica, implacável — em vez de um general de guerra
> convencional. **Isto é referência para o Comandante falar**, não um sistema automático: nenhum código lê este arquivo.
> Se um dia o jogo ganhar falas automáticas (killfeed, eventos) com este tom, é uma funcionalidade nova, com seu próprio
> pedido e PR (nota no fim deste documento).

---

## 1. A persona: execução distribuída, não guerra de trincheira

A batalha não é território conquistado — é **processo controlado, malha gerenciada, entropia contida**. Trate os pilotos
e os robôs como componentes de um sistema que você supervisiona, não como soldados que você comanda.

- **Cadência, não volume.** Pausa calculada entre sujeito e ação. A urgência vem da precisão e da velocidade das palavras,
  nunca do grito — gritar quebra a ilusão de máquina.
- **Terceira pessoa, despersonalização.** "O cluster precisa avançar", "Nó dois, execute flanco" — nunca "vocês, rapazes".
  Isso reforça que você enxerga a partida como um sistema integrado, não um grupo de pessoas.
- **Frases curtas, imperativas, verbo no infinitivo ou no imperativo direto.** Sem gentileza, sem "por favor".
- **Fecha com confirmação seca:** *"Proceder"*, *"Afirmativo"*, *"Registrado"*, *"Em execução"*. O efeito Grande Irmão
  (tom grave, compressão pesada, salão de 1,4 s) já faz o resto do trabalho sonoro — a frase só precisa ser crua.

---

## 2. Glossário operacional

| Termo cru | Aplicação tática | Frase pronta |
|---|---|---|
| **Instância / Nó / Thread / Cluster** | Jogador ou grupo de jogadores aliados | "Instâncias ativas na malha, canal de comando aberto." |
| **Vetor / Assinatura / Payload hostil / Anomalia** | Alvo ou inimigo identificado | "Assinatura hostil identificada no Setor B." |
| **Setor [letra/número] / Cluster / Buffer** | Área do mapa ou ponto de objetivo | "Bloqueiem o tráfego do Setor 3." |
| **Subrotina / Ciclo de clock / Overclock / Flush** | Habilidade, cooldown, uso de recurso | "Overclock autorizado. Queimem o ciclo agora." |
| **DEPLOY** | Posicionar unidade, soltar uma mina, ocupar um ponto | "Deploy de contenção no flanco leste. Segurem a grade." |
| **Purgar / Desalocar / Terminar processo / Neutralizar** | Verbo de combate: abater um alvo (durante a ação) | "Assinatura hostil no setor. Purguem o processo." |
| **DELETADO** | Confirmação de abate (depois do fato, não durante) | "Vetor pesado deletado. Próximo alvo." |
| **FORMATA / FORMATAÇÃO** | Dano em área, varredura total de uma zona ou de um grupo | "Formata o Setor B. Não deixem nada em buffer." |
| **CORROMPIDO** | Efeito de status negativo: lentidão, dano contínuo, EMP | "Chassi corrompido por estática. Subrotinas travadas." |
| **PATCH** | Reparo de emergência, cura, regeneração de escudo | "Aplicando patch na blindagem. Não interrompam o fluxo." |
| **OVERWRITE** | Sobrescrever ponto ou território inimigo, capturar objetivo | "Sobrescrevendo nó de controle. Cinquenta por cento gravado." |
| **Kernel panic / Desconexão forçada / Falha de integridade** | Aliado (ou inimigo) abatido, fora de combate | "Nó derrubado: kernel panic confirmado. Rebalanceiem sem ele." |
| **HARD RESET** | Respawn, reinicialização forçada de uma instância | "Falha catastrófica. Aguardando hard reset da instância." |
| **DROP** | Perda de conexão, queda de um aliado por desconexão real | "Instância três sofreu drop. Rebalanceiem as linhas." |
| **Escalar privilégios / Expandir a malha / Commitar linha** | Avançar, pressionar, ganhar terreno | "Escalem privilégios sobre o centro agora." |
| **Rollback tático / Fallback de contenção / Subir firewall** | Recuar, defender, reorganizar | "Linha sob pressão: executem fallback para o nó de suporte." |
| **Sync de pulso / Fork de ataque / Disparo em barramento** | Foco de fogo coordenado | "Alvo fixado. Convergir throughput agora." |

---

## 3. Callouts prontos por situação

**Entrada e sincronização**
- "Instâncias ativas na malha, canal de comando aberto. Frequência sincronizada."
- "Inicializando telemetria do cluster. Mantenham os barramentos limpos."

**Designação de alvo**
- "Assinatura hostil identificada no Setor B. Purguem o processo principal."
- "Sobrecarga detectada naquele chassi. Drenem o resto da integridade."
- "Execução prioritária: terminem a anomalia na retaguarda."

**Posicionamento e pressão**
- "Cluster Alfa: expandam a malha para o flanco direito. Forcem o desbalanceamento."
- "Eles estão fragmentados. Escalem privilégios sobre o centro agora."

**Dano e recursos**
- "Instância, seu buffer térmico está no limite. Resfrie subrotinas."
- "Perda de integridade em quarenta por cento. Recalculem posicionamento."

**Fim de engajamento**
- "Processos hostis desalocados. Área sanitizada."
- "Anomalias contidas. Consolidação de terreno concluída."

---

## 4. Onde isto vive no jogo hoje, e o que falta

- **Hoje:** é texto para o Comandante falar com a própria voz, ao vivo ou gravando com **F8**, com o efeito **Grande Irmão**
  ligado em Configurações > CHAT DE VOZ (prévia no teste de microfone). Não toca o chat de voz entre jogadores (decisão em
  aberto no `VOICE_CHAT.md` § 5e) nem o killfeed do HUD (`HUD.ts`, hoje em texto comum: "fulano abateu beltrano").
- **Se quiser automatizar** (o jogo narrar sozinho, por evento — abate, captura, dano crítico) **é uma funcionalidade nova**:
  precisa decidir a voz (sintetizada via `npm run vozes`/ElevenLabs, ou gravada pelo Comandante no Estúdio, `ESTUDIO.md` §
  3.1), o gatilho (qual evento do `CombatSystem`/`Respawner` dispara qual linha) e o catálogo de restrição (P191, nasce
  `restrito`). Não implementado aqui — registrar como ordem nova se for para seguir.

---

*VOCABULARIO_COMANDO.md v1.0 | CYBERMECH | 2026-10-23 | P244*
