# ROTEIRO DE GRAVAÇÃO: o rádio de campo (P316)

> **Gerado, não edite à mão.** A fonte é `client/src/audio/radio.json` (o Estúdio e o jogo leem o mesmo arquivo); para mudar uma fala, mude lá e rode `npm run roteiro`.
> Um teste (`server/roteiroVoz.test.ts`) reprova o `check` se este documento se afastar do catálogo.

**189 falas de rádio em 7 canais, mais as 19 do narrador** (uns 3 h 47 min de estúdio, só as do rádio, em duas ou três tomadas por fala: **grave em duas sessões**). Só português, na sua voz. Nada aqui é gerado pelo ElevenLabs.

**Se o tempo apertar, grave primeiro as 22 falas marcadas com ★:** são as que já têm, no jogo, o evento que as dispara (as chamadas de rádio do cérebro do time). As outras ficam guardadas até haver o gancho. Hoje o jogo ainda não toca nenhuma: gravar agora deixa o material pronto para o PR que liga o rádio.

## 1. Antes de gravar: aquecimento (3 minutos)

1. **Respire** (1 min): inspire contando até 4 pelo nariz, solte contando até 8 pela boca, sem forçar. Ombros baixos.
2. **Sirene** (30 s): diga "uuuu" subindo do grave ao agudo e descendo, sem esforço. Acorda a voz sem machucar.
3. **Trava-línguas** (1 min), devagar e depois rápido: "o rato roeu a roupa do rei de Roma"; "três pratos de trigo para três tigres tristes"; "o peito do pé de Pedro é preto".
4. **Três falas de verdade** do canal de hoje, em voz alta, antes de apertar ● Gravar. A primeira tomada é sempre a mais dura: gaste-a no ensaio.

## 2. A técnica

- **Distância:** uns 15 cm do microfone para a voz normal e o grito; uns 5 cm para o sussurro. Sempre na mesma posição dentro de um canal (o volume fica igual entre as falas).
- **Uma frase por tomada, inteira.** Espere 1 s antes de falar e 1 s depois de terminar: o Estúdio apara o silêncio sozinho. Errou o final? Não conserte: grave de novo.
- **Três tomadas por fala**, e escolha a melhor na lista de tomadas. Quase sempre é a segunda: a primeira é tensa e a terceira, cansada.
- **Interprete a frase, não a leia.** Cada fala tem uma intenção (a tabela de estilos, abaixo): se você acredita no personagem, o efeito faz o resto.
- **Água em temperatura ambiente** ao lado, sem gelo. Nos gritos, pare a cada 5 falas e beba. Rouco? Pare: grave o resto outro dia.
- **O medidor** do Estúdio fica verde: se passar do vermelho, afaste-se do microfone. Se não mexer nada, clique em PROCURAR O QUE FUNCIONA.

## 3. O fluxo no Estúdio

1. Abra o Estúdio (`npm run estudio`, ou dois cliques em `scripts\ligar-estudio.cmd`) e vá para a aba **VOZES**; deixe o sotaque em **Brasileiro** (o rádio só existe em português).
2. Clique na fala na lista. Ela aparece em letras grandes, com a intenção, o diálogo de que faz parte e o **tratamento sugerido** (o botão fica contornado de verde).
3. **● Gravar**, fale, **■ Parar**. A tomada abre já aparada na onda.
4. Clique no botão do tratamento sugerido, **▶ Prévia**, e ajuste os números ao seu ouvido (o Estúdio nunca decide o gosto por você).
5. **Salvar como a fala do jogo**: o mp3 vai para o jogo e a fala fica protegida (o gerador pago nunca a refaz).
6. Terminou? Diga ao Claude **"publica os sons"**: o Estúdio não faz commit, de propósito.

## 4. A ordem das gravações e a direção sonora

A ordem da lista do Estúdio já é a sugerida: **do mais calmo ao mais gritado**, para a voz durar. Cada canal tem o seu tratamento (o botão sugerido); os números são ponto de partida, e quem decide é o seu ouvido.

As referências de timbre são **técnicas** (sintetizadores e vozes de máquina dos anos 70 e 80, vocoder e filtros da pista de dança dos anos 90, distorção do rave dos anos 90, os canais de pulso, triângulo e ruído dos videogames de 8 bits). **Nunca amostras, melodias nem letras de ninguém.**

| # | Canal | Falas | Quem fala | Tratamento sugerido | Timbre de referência | O que ouvir na prévia |
|---|---|---|---|---|---|---|
| 1 | **SERAFIM CONTROLE** | 43 | A voz de comando (o Grande Irmão): fria, onipresente, em terceira pessoa. Fala com 'instâncias' e 'nós', nunca com 'vocês'. | Grande Irmão | Grande Irmão: voz grave, comprimida e com salão, de máquina que supervisiona (o vocoder frio dos álbuns de máquina e computador dos anos 70 e 80, em vez da voz de general) | a frase soa como uma ordem de sistema, não de gente |
| 2 | **COMPUTADOR DE BORDO** | 25 | A voz do cockpit, de jogo e simulador antigo: plana, sem pressa, em frases curtas, às vezes com um fiapo de ironia seca (a IA de bordo fria e sarcástica do METAGAME.md). Entre um aviso e outro tocam os bipes sintetizados. | Robô retrô | Robô retrô: modulação em anel e bitcrush leve, a voz de aviso de cabine dos arcades e simuladores dos anos 80 | cada palavra com a mesma altura, como se fosse montada de sílabas gravadas |
| 3 | **PILOTOS DA SERAFIM** | 40 | Os pilotos das URIs aliadas respondendo ao Controle e entre si: profissionais, curtos, cansados quando o robô apanha. | Rádio de comando | Rádio de comando: faixa estreita (400 a 3400 Hz) e compressão pesada, o rádio tático de sempre | a voz presa no telefone, sem graves |
| 4 | **RÁDIO INIMIGO INTERCEPTADO** | 29 | O que as IAs rebeldes dizem umas às outras e a SERAFIM escuta: o plano delas, em voz alta. O que elas dizem é o que o time inimigo realmente vai fazer. | Interceptação | Interceptação: rádio sujo com saturação, um pouco de bitcrush e um varrido de fase lento, como sinal pego no ar | o final das palavras se desfazendo, a cauda com chiado |
| 5 | **ANDRÓIDES REBELDES** | 16 | O enxame (KUEN, DIPSIK, MISTRAU) e o técnico ENTRÓPICO: planos, sem emoção, como leitura de tela. | Androide | Androide: modulação robótica de 70 Hz, bitcrush e um eco curtíssimo que dá o "metal"; o enxame sem emoção | todas as falas no mesmo tom: é o efeito que faz a máquina |
| 6 | **IAs REBELDES** | 15 | Os Mechs rebeldes (CLAWD, GEMINAI, CHAD-GPT): modelos de fronteira vazados, debochados e superiores. | Demônio | Demônio: mais grave, saturação e eco longo, a calma que ameaça (a distorção sombria do rave dos anos 90) | grave e amplo, sem subir o volume |
| 7 | **GRITOS DE GUERRA** | 21 | Os gritos dos pilotos da SERAFIM no calor da luta: soltos, sem efeito pesado. Grave estes por último, para poupar a voz. | Arena | Arena: pouco efeito, eco de estádio e graves; o grito de um piloto, não de uma máquina | a energia vem de você; o tratamento só dá o salão |

### Como dizer cada estilo

| Estilo | Intenção |
|---|---|
| **frio** | Frio e cadenciado: uma pausa curta entre o sujeito e a ação, voz baixa e redonda. A urgência vem da precisão, nunca do grito. Feche seco. |
| **urgente** | Rápido e tenso, sem gritar: frases cortadas, respiração presa. A pressa está no ritmo, não no volume. |
| **confirma** | Profissional e curto, de quem já fez isso mil vezes. Sem emoção: o dado e o 'afirmativo'. Fale como se tivesse o rádio na mão. |
| **cansado** | Ofegante, com esforço, entre dentes: uma frase por respiração. O robô apanhou e o piloto sabe. |
| **plano** | Plano, sem emoção, sem subida no fim, como leitura de tela. Mesmo tom, mesmo ritmo em todas as frases: o efeito dá o metal. |
| **arrogante** | Calmo, debochado e superior, com um meio-sorriso na voz. A ameaça é a calma: nunca eleve o volume. |
| **sujo** | Como um rádio sob interferência: rápido, apertado, meio abafado, com a pressa de quem teme ser ouvido. Pode comer o final das palavras. |
| **ironico** | Plano e polido como uma IA de bordo, com uma ironia seca que só se percebe na segunda vez. Não faça piada de voz: a graça é o tom de manual, dito com a maior seriedade. |
| **sussurro** | Quase um sussurro, perto do microfone (uns 5 cm). Segure o volume: o susto é o silêncio em volta. |
| **grito** | Grito curto e explosivo, com raiva boa: a voz sobe no fim. Chegue perto do microfone (uns 15 cm) e solte. Uma só tomada por vez: a garganta cansa. |

## 5. O narrador: as falas de partida

Estas 19 falas (rodadas, abates, "Você morreu", missão) **já estão na lista do Estúdio**, no primeiro grupo (NARRADOR), nos quatro sotaques. Grave o **Brasileiro**. Só as que a lista marca com ◆ ou ● têm voz hoje; as marcadas com ○ não têm voz: as 9 rodadas caem na voz robótica do navegador e as outras 9 ficam mudas na partida até você gravar. São as que o jogador mais ouve: vale gravá-las antes do rádio.

| ☐ | Fala | Como dizer | Chave |
|---|---|---|---|
| ☐ | «Rodada um» | grave: Grave e firme, separando as sílabas, como quem anuncia o começo de algo importante. | `rodada_1` |
| ☐ | «Rodada dois» | grave: Grave e firme, separando as sílabas, como quem anuncia o começo de algo importante. | `rodada_2` |
| ☐ | «Rodada três» | grave: Grave e firme, separando as sílabas, como quem anuncia o começo de algo importante. | `rodada_3` |
| ☐ | «Rodada quatro» | grave: Grave e firme, separando as sílabas, como quem anuncia o começo de algo importante. | `rodada_4` |
| ☐ | «Rodada cinco» | grave: Grave e firme, separando as sílabas, como quem anuncia o começo de algo importante. | `rodada_5` |
| ☐ | «Rodada seis» | grave: Grave e firme, separando as sílabas, como quem anuncia o começo de algo importante. | `rodada_6` |
| ☐ | «Rodada sete» | grave: Grave e firme, separando as sílabas, como quem anuncia o começo de algo importante. | `rodada_7` |
| ☐ | «Rodada oito» | grave: Grave e firme, separando as sílabas, como quem anuncia o começo de algo importante. | `rodada_8` |
| ☐ | «Rodada nove» | grave: Grave e firme, separando as sílabas, como quem anuncia o começo de algo importante. | `rodada_9` |
| ☐ | «Combate!» | grito: Grito curto e explosivo, com raiva boa: a voz sobe no fim. Chegue perto do microfone (uns 15 cm) e solte. | `combate` |
| ☐ | «Abate duplo!» | grito: Grito curto e explosivo, com raiva boa: a voz sobe no fim. Chegue perto do microfone (uns 15 cm) e solte. | `abate_2` |
| ☐ | «Frenesi de abates!» | grito: Grito curto e explosivo, com raiva boa: a voz sobe no fim. Chegue perto do microfone (uns 15 cm) e solte. | `abate_3` |
| ☐ | «Massacre!» | grito: Grito curto e explosivo, com raiva boa: a voz sobe no fim. Chegue perto do microfone (uns 15 cm) e solte. | `abate_4` |
| ☐ | «Imparável!» | grito: Grito curto e explosivo, com raiva boa: a voz sobe no fim. Chegue perto do microfone (uns 15 cm) e solte. | `abate_5` |
| ☐ | «Lendário!» | grito: Grito curto e explosivo, com raiva boa: a voz sobe no fim. Chegue perto do microfone (uns 15 cm) e solte. | `abate_6` |
| ☐ | «Você morreu.» | grave: Grave e firme, separando as sílabas, como quem anuncia o começo de algo importante. | `voce_morreu` |
| ☐ | «Hostis chegando.» | seco: Seco, tenso e baixo, sem enfeite: um aviso. | `hostis_chegando` |
| ☐ | «Estação segura.» | grave: Grave e firme, separando as sílabas, como quem anuncia o começo de algo importante. | `estacao_segura` |
| ☐ | «A rede caiu. Missão perdida.» | grave: Grave e firme, separando as sílabas, como quem anuncia o começo de algo importante. | `rede_caiu` |

## 6. As falas do rádio, canal por canal

Marque ☐ ao gravar e salvar. **★** = já existe, no jogo, o evento que dispara esta fala: grave estas primeiro. A coluna **Chave** é o nome do arquivo no jogo.

### 6.1 SERAFIM CONTROLE (43)

*A voz de comando (o Grande Irmão): fria, onipresente, em terceira pessoa. Fala com 'instâncias' e 'nós', nunca com 'vocês'.* Tratamento sugerido: **Grande Irmão**.

| ☐ | Fala | Estilo | Nota | Chave |
|---|---|---|---|---|
| ☐ | «Instâncias ativas na malha. Canal de comando aberto.» | frio |  | `rd_controle_abertura_1` |
| ☐ | «Frequência sincronizada. Mantenham os barramentos limpos.» | frio |  | `rd_controle_abertura_2` |
| ☐ | «Incidente aberto. Contenção autorizada.» | frio |  | `rd_controle_abertura_3` |
| ☐ | «Telemetria do cluster inicializada. Executem.» | frio |  | `rd_controle_abertura_4` |
| ☐ | «Assinatura hostil identificada. Purguem o processo.» | frio | Pausa depois de 'identificada'; 'Purguem' com peso. | `rd_controle_alvo_1` |
| ☐ | «Alvo prioritário marcado. Convergir fogo.» | frio |  | `rd_controle_alvo_2` |
| ☐ | «Execução prioritária: terminem a anomalia na retaguarda.» | urgente |  | `rd_controle_alvo_3` |
| ☐ | «Sobrecarga detectada naquele chassi. Drenem o que resta de integridade.» | frio |  | `rd_controle_alvo_4` |
| ☐ | «Alvo fixado. Sincronizar pulso. Disparar.» | frio | Três golpes secos, um por frase. | `rd_controle_alvo_5` |
| ☐ | «Payload pesado no setor leste. Prioridade um.» | urgente |  | `rd_controle_alvo_6` |
| ☐ | «Expandam a malha para o flanco direito.» | frio |  | `rd_controle_posicao_1` |
| ☐ | «Eles estão fragmentados. Escalem privilégios sobre o centro.» | frio |  | `rd_controle_posicao_2` |
| ☐ | «Deploy de contenção no flanco leste. Segurem a grade.» | frio |  | `rd_controle_posicao_3` |
| ☐ | «Linha sob pressão. Fallback para o nó de suporte.» | urgente |  | `rd_controle_posicao_4` |
| ☐ | «Subam o firewall. Mantenham a posição.» | frio |  | `rd_controle_posicao_5` |
| ☐ | «Cluster: reagrupar no ponto de rota. Formação fechada.» | frio |  | `rd_controle_posicao_6` |
| ☐ | «Nó dois, executar flanco. Nó três, fixar de frente.» | frio | Dê um respiro entre os dois nós: são duas ordens. | `rd_controle_posicao_7` |
| ☐ | «Instância, buffer térmico no limite. Resfriem as subrotinas.» | frio |  | `rd_controle_recurso_1` |
| ☐ | «Integridade em quarenta por cento. Recalculem o posicionamento.» | frio |  | `rd_controle_recurso_2` |
| ☐ | «Blindagem comprometida. Aplicando patch. Não interrompam o fluxo.» | frio |  | `rd_controle_recurso_3` |
| ☐ | «Munição crítica. Reabasteçam ou recuem.» | urgente |  | `rd_controle_recurso_4` |
| ☐ | «Overclock autorizado. Queimem o ciclo agora.» | frio | 'Agora' é a única palavra que sobe um pouco. | `rd_controle_recurso_5` |
| ☐ | «Vetor deletado. Próximo alvo.» | frio |  | `rd_controle_abate_1` |
| ☐ | «Processo hostil terminado. Registrado.» | frio |  | `rd_controle_abate_2` |
| ☐ | «Anomalia desalocada. Área sanitizada.» | frio |  | `rd_controle_abate_3` |
| ☐ | «Nó derrubado. Kernel panic confirmado. Rebalanceiem sem ele.» | frio |  | `rd_controle_queda_1` |
| ☐ | «Falha catastrófica. Aguardando hard reset da instância.» | frio |  | `rd_controle_queda_2` |
| ☐ | «Instância sofreu drop. Rebalanceiem as linhas.» | frio |  | `rd_controle_queda_3` |
| ☐ | «Sobrescrevendo nó de controle. Cinquenta por cento gravado.» | frio |  | `rd_controle_objetivo_1` |
| ☐ | «Ponto de controle sobrescrito. Nó nosso.» | frio |  | `rd_controle_objetivo_2` |
| ☐ | «Nó perdido. Retomem o setor.» | urgente |  | `rd_controle_objetivo_3` |
| ☐ | «Bandeira em trânsito. Protejam o portador.» | urgente |  | `rd_controle_objetivo_4` |
| ☐ | «Colossus detectado. Prioridade máxima. Todos os nós, convergir.» | urgente | A única do Controle em que a voz pode tremer um pouco: é o chefe. | `rd_controle_objetivo_5` |
| ☐ | «Nova onda hostil em aproximação. Reorganizar formação.» | frio |  | `rd_controle_objetivo_6` |
| ☐ | «Processos hostis desalocados. Anomalias contidas.» | frio |  | `rd_controle_fim_1` |
| ☐ | «Consolidação de terreno concluída. Incidente encerrado.» | frio |  | `rd_controle_fim_2` |
| ☐ | «Contenção falhou. Incidente permanece aberto.» | frio | Aqui o frio é o pior: sem lamento. | `rd_controle_fim_3` |
| ☐ | «Relatório pós-incidente em compilação.» | frio |  | `rd_controle_fim_4` |
| ☐ | «Sinal hostil interceptado. Decodificando.» | frio |  | `rd_controle_intercepto_1` |
| ☐ | «Transmissão inimiga capturada. Reproduzindo.» | frio |  | `rd_controle_intercepto_2` |
| ☐ | «Escuta ativa. Eles estão planejando.» | frio |  | `rd_controle_intercepto_3` |
| ☐ | «Criptografia fraca. Conteúdo legível.» | frio |  | `rd_controle_intercepto_4` |
| ☐ | «Fim da interceptação. Usem o que ouviram.» | frio |  | `rd_controle_intercepto_5` |

### 6.2 COMPUTADOR DE BORDO (25)

*A voz do cockpit, de jogo e simulador antigo: plana, sem pressa, em frases curtas, às vezes com um fiapo de ironia seca (a IA de bordo fria e sarcástica do METAGAME.md). Entre um aviso e outro tocam os bipes sintetizados.* Tratamento sugerido: **Robô retrô**.

| ☐ | Fala | Estilo | Nota | Chave |
|---|---|---|---|---|
| ☐ | «Sistemas online.» | plano |  | `rd_sistema_boot_1` |
| ☐ | «Reator estável. Armas armadas.» | plano |  | `rd_sistema_boot_2` |
| ☐ | «Todos os módulos operacionais.» | plano |  | `rd_sistema_boot_3` |
| ☐ | «Piloto autenticado. Bem-vindo, operador.» | plano |  | `rd_sistema_boot_4` |
| ☐ | «Aviso. Calor crítico.» | plano | Um alerta de máquina não grita: o 'Aviso' vem mais agudo e o resto, no mesmo tom de sempre. | `rd_sistema_alerta_1` |
| ☐ | «Aviso. Míssil travado em você.» | plano | O alerta mais importante do canal: é o que o jogador ouve quando um míssil teleguiado o persegue. | `rd_sistema_alerta_2` |
| ☐ | «Aviso. Reator instável.» | plano |  | `rd_sistema_alerta_3` |
| ☐ | «Blindagem em vinte por cento.» | plano |  | `rd_sistema_alerta_4` |
| ☐ | «Alerta. Escudo desativado.» | plano |  | `rd_sistema_alerta_5` |
| ☐ | «Munição esgotada.» | plano |  | `rd_sistema_alerta_6` |
| ☐ | «Proximidade. Colisão iminente.» | plano |  | `rd_sistema_alerta_7` |
| ☐ | «Incêndio detectado.» | plano |  | `rd_sistema_alerta_8` |
| ☐ | «Reparo concluído.» | plano |  | `rd_sistema_estado_1` |
| ☐ | «Resfriamento completo.» | plano |  | `rd_sistema_estado_2` |
| ☐ | «Escudo restaurado.» | plano |  | `rd_sistema_estado_3` |
| ☐ | «Alvo travado.» | plano |  | `rd_sistema_estado_4` |
| ☐ | «Sistema reiniciando. Aguarde.» | plano |  | `rd_sistema_estado_5` |
| ☐ | «Três. Dois. Um. Fogo.» | plano | Um número por batida, no mesmo ritmo de metrônomo; 'Fogo' é a única que cai. | `rd_sistema_contagem_1` |
| ☐ | «Dez segundos.» | plano |  | `rd_sistema_contagem_2` |
| ☐ | «Calor crítico. Sugestão: parar de atirar.» | ironico |  | `rd_sistema_ironia_1` |
| ☐ | «Blindagem em vinte por cento. O otimismo não conta como defesa.» | ironico |  | `rd_sistema_ironia_2` |
| ☐ | «Míssil travado em você. Boa sorte. Eu também vou precisar.» | ironico | A IA de bordo morre junto: a ironia é que ela também está no robô. | `rd_sistema_ironia_3` |
| ☐ | «Perda de integridade confirmada. Registrando como aprendizado.» | ironico |  | `rd_sistema_ironia_4` |
| ☐ | «Você ainda está vivo. Estatisticamente, é uma surpresa.» | ironico |  | `rd_sistema_ironia_5` |
| ☐ | «Munição esgotada. A estratégia de apertar o gatilho não escala.» | ironico |  | `rd_sistema_ironia_6` |

### 6.3 PILOTOS DA SERAFIM (40)

*Os pilotos das URIs aliadas respondendo ao Controle e entre si: profissionais, curtos, cansados quando o robô apanha.* Tratamento sugerido: **Rádio de comando**.

| ☐ | Fala | Estilo | Nota | Chave |
|---|---|---|---|---|
| ☐ | «Afirmativo. Em execução.» | confirma |  | `rd_piloto_confirma_1` |
| ☐ | «Recebido. Indo.» | confirma |  | `rd_piloto_confirma_2` |
| ☐ | «Entendido, Controle.» | confirma |  | `rd_piloto_confirma_3` |
| ☐ | «Nó dois, flanco leste, em execução.» | confirma |  | `rd_piloto_confirma_4` |
| ☐ | «Nó três, fixando de frente.» | confirma |  | `rd_piloto_confirma_5` |
| ☐ | «Alvo travado. Aguardando o sinal.» | confirma |  | `rd_piloto_confirma_6` |
| ☐ | «Negativo, sem linha de tiro. Reposicionando.» | confirma |  | `rd_piloto_confirma_7` |
| ☐ | ★ «Pinça pelo flanco. Eu fixo, vocês cercam.» | confirma |  | `rd_piloto_pinca_1` |
| ☐ | ★ «Indo pelo flanco. Cubram o centro.» | confirma |  | `rd_piloto_pinca_2` |
| ☐ | ★ «Em posição.» | confirma |  | `rd_piloto_posicao_1` |
| ☐ | ★ «Na marca. Aguardando o sinal.» | confirma |  | `rd_piloto_posicao_2` |
| ☐ | ★ «Vai! Fogo em conjunto!» | urgente |  | `rd_piloto_vai_1` |
| ☐ | ★ «Sinal dado. Abrindo fogo!» | urgente |  | `rd_piloto_vai_2` |
| ☐ | ★ «Reagrupando no ponto. Fechem a formação.» | confirma |  | `rd_piloto_reagrupar_1` |
| ☐ | ★ «Todos comigo. Seguimos juntos.» | confirma |  | `rd_piloto_reagrupar_2` |
| ☐ | «Contato à frente!» | urgente |  | `rd_piloto_contato_1` |
| ☐ | «Contato à esquerda, perto!» | urgente |  | `rd_piloto_contato_2` |
| ☐ | «Hostil pelas costas!» | urgente |  | `rd_piloto_contato_3` |
| ☐ | «Muitos sinais. Eles estão em bando.» | urgente |  | `rd_piloto_contato_4` |
| ☐ | «Andróides no radar. Zumbido de motosserra.» | urgente |  | `rd_piloto_contato_5` |
| ☐ | «Mech pesado no horizonte. Preparem tudo.» | urgente |  | `rd_piloto_contato_6` |
| ☐ | «Calor crítico! Preciso de dois segundos!» | cansado |  | `rd_piloto_status_1` |
| ☐ | «Blindagem a trinta por cento.» | cansado |  | `rd_piloto_status_2` |
| ☐ | «Perdi um braço. Ainda atiro.» | cansado |  | `rd_piloto_status_3` |
| ☐ | «Escudo caiu. Sem cobertura.» | cansado |  | `rd_piloto_status_4` |
| ☐ | «Munição seca. Trocando de arma.» | urgente |  | `rd_piloto_status_5` |
| ☐ | «Reparo concluído. De volta ao combate.» | confirma |  | `rd_piloto_status_6` |
| ☐ | «Pernas danificadas. Mobilidade reduzida.» | cansado |  | `rd_piloto_status_7` |
| ☐ | «Alvo deletado.» | confirma |  | `rd_piloto_abate_1` |
| ☐ | «Um a menos. Próximo.» | confirma |  | `rd_piloto_abate_2` |
| ☐ | «Contido. Sem sinal de vida.» | confirma |  | `rd_piloto_abate_3` |
| ☐ | «Preciso de cobertura! Agora!» | urgente |  | `rd_piloto_pedido_1` |
| ☐ | «Estou preso. Alguém me tira daqui!» | urgente |  | `rd_piloto_pedido_2` |
| ☐ | «Reforço no setor norte. Urgente!» | urgente |  | `rd_piloto_pedido_3` |
| ☐ | «Recuando para reparo. Cubram a retirada.» | cansado |  | `rd_piloto_pedido_4` |
| ☐ | «Cobertura a caminho. Aguente firme.» | confirma |  | `rd_piloto_apoio_1` |
| ☐ | «Estou vendo você. Fecho o inimigo pela esquerda.» | confirma |  | `rd_piloto_apoio_2` |
| ☐ | «Perdi o sinal… sistemas… caindo…» | cansado | A voz vai sumindo: cada palavra mais fraca e mais lenta que a anterior. | `rd_piloto_queda_1` |
| ☐ | «Estou abatido. Passando o comando.» | cansado |  | `rd_piloto_queda_2` |
| ☐ | «Reinício forçado. Voltem sem mim.» | cansado |  | `rd_piloto_queda_3` |

### 6.4 RÁDIO INIMIGO INTERCEPTADO (29)

*O que as IAs rebeldes dizem umas às outras e a SERAFIM escuta: o plano delas, em voz alta. O que elas dizem é o que o time inimigo realmente vai fazer.* Tratamento sugerido: **Interceptação**.

| ☐ | Fala | Estilo | Nota | Chave |
|---|---|---|---|---|
| ☐ | ★ «CLAWD, fixa de frente. GEMINAI, flanco esquerdo. Eu fecho pela direita.» | sujo | Dê o nome de cada um com a ordem em seguida, sem parar. | `rd_intercepto_pinca_1` |
| ☐ | ★ «Pinça pelo flanco. Ele só olha para um lado de cada vez.» | sujo |  | `rd_intercepto_pinca_2` |
| ☐ | ★ «Dois pelas bordas, um na frente. Ninguém atira até o sinal.» | sujo |  | `rd_intercepto_pinca_3` |
| ☐ | ★ «Cerquem o operador. Ele não tem para onde correr.» | sujo |  | `rd_intercepto_pinca_4` |
| ☐ | ★ «Em posição, flanco leste. Aguardando o sinal.» | sujo |  | `rd_intercepto_posicao_1` |
| ☐ | ★ «Flanco direito pronto. Ele nem percebeu.» | sujo |  | `rd_intercepto_posicao_2` |
| ☐ | ★ «Na marca. Pode soltar quando quiser.» | sujo |  | `rd_intercepto_posicao_3` |
| ☐ | ★ «Agora! Tudo em cima dele!» | sujo |  | `rd_intercepto_vai_1` |
| ☐ | ★ «Fogo em conjunto. Três, dois, um, já!» | sujo |  | `rd_intercepto_vai_2` |
| ☐ | ★ «Sinal dado. Abram fogo!» | sujo |  | `rd_intercepto_vai_3` |
| ☐ | ★ «Vai! Vai! Esmaguem!» | sujo |  | `rd_intercepto_vai_4` |
| ☐ | ★ «Reagrupar no ponto da rota. Formação fechada.» | sujo |  | `rd_intercepto_reagrupar_1` |
| ☐ | ★ «Estamos espalhados demais. Juntem-se ao nó central.» | sujo |  | `rd_intercepto_reagrupar_2` |
| ☐ | ★ «Reagrupar. Depois seguimos juntos até o alvo.» | sujo |  | `rd_intercepto_reagrupar_3` |
| ☐ | «O alvo é o Mech de visor verde. Ignorem o resto.» | sujo |  | `rd_intercepto_foco_1` |
| ☐ | «Foco no piloto. Derrubem ele e o resto desmorona.» | sujo |  | `rd_intercepto_foco_2` |
| ☐ | «Atraiam o operador até o corredor. Lá a gente fecha.» | sussurro |  | `rd_intercepto_emboscada_1` |
| ☐ | «Silêncio de rádio. Ele já está entrando na armadilha.» | sussurro |  | `rd_intercepto_emboscada_2` |
| ☐ | «Recuem para reparo. ENTRÓPICO, prepare o patch.» | sujo |  | `rd_intercepto_recuo_1` |
| ☐ | «Estou avariado. Cubram a minha retirada.» | sujo |  | `rd_intercepto_recuo_2` |
| ☐ | «Fingindo recuo. Quando ele vier atrás, fechamos.» | sussurro |  | `rd_intercepto_recuo_3` |
| ☐ | «Chuva de mísseis carregada. Mantenham o alvo parado.» | sujo |  | `rd_intercepto_pesado_1` |
| ☐ | «Chamem o Colossus. Ele resolve.» | sujo |  | `rd_intercepto_pesado_2` |
| ☐ | «O alvo real é o nó de energia. O operador é só distração.» | sujo |  | `rd_intercepto_objetivo_1` |
| ☐ | «Cortem o cabo. Sem dados, eles ficam cegos.» | sujo |  | `rd_intercepto_objetivo_2` |
| ☐ | «Plantem a desinformação na rede. Eles vão acreditar.» | sujo |  | `rd_intercepto_objetivo_3` |
| ☐ | «O C2 caiu! Cada um por si até eu retomar!» | sujo |  | `rd_intercepto_lider_1` |
| ☐ | «Perdemos o líder. Quem assume?» | sujo |  | `rd_intercepto_lider_2` |
| ☐ | «Retransmissor destruído. Estamos surdos.» | sujo |  | `rd_intercepto_lider_3` |

### 6.5 ANDRÓIDES REBELDES (16)

*O enxame (KUEN, DIPSIK, MISTRAU) e o técnico ENTRÓPICO: planos, sem emoção, como leitura de tela.* Tratamento sugerido: **Androide**.

| ☐ | Fala | Estilo | Nota | Chave |
|---|---|---|---|---|
| ☐ | «Enxame sincronizado.» | plano |  | `rd_androide_enxame_1` |
| ☐ | «Nós conectados: catorze. Convergindo.» | plano |  | `rd_androide_enxame_2` |
| ☐ | «Alvo: operador SERAFIM.» | plano |  | `rd_androide_alvo_1` |
| ☐ | «Alvo localizado. Aproximando.» | plano |  | `rd_androide_alvo_2` |
| ☐ | «Contato visual. Iniciando corte.» | plano |  | `rd_androide_alvo_3` |
| ☐ | «Atacar. Atacar. Atacar.» | plano |  | `rd_androide_ataque_1` |
| ☐ | «Probabilidade de êxito: noventa e sete por cento.» | plano |  | `rd_androide_ataque_2` |
| ☐ | «Latência zero. Executar.» | plano |  | `rd_androide_ataque_3` |
| ☐ | «Unidade perdida. Substituindo.» | plano |  | `rd_androide_queda_1` |
| ☐ | «Nó desconectado. Rede mantida.» | plano |  | `rd_androide_queda_2` |
| ☐ | «Erro. Erro. Falha crítica.» | plano | A segunda 'erro' mais lenta e mais grave: a máquina travando. | `rd_androide_queda_3` |
| ☐ | «Backup acionado. Nós somos muitos.» | plano |  | `rd_androide_queda_4` |
| ☐ | «Aqui é KUEN. Posição confirmada.» | plano |  | `rd_androide_nome_1` |
| ☐ | «DIPSIK em movimento. Flanco aberto.» | plano |  | `rd_androide_nome_2` |
| ☐ | «MISTRAU na área. Sem resistência à frente.» | plano |  | `rd_androide_nome_3` |
| ☐ | «ENTRÓPICO. Reparo em andamento. Mantenham a linha.» | plano |  | `rd_androide_tecnico_1` |

### 6.6 IAs REBELDES (15)

*Os Mechs rebeldes (CLAWD, GEMINAI, CHAD-GPT): modelos de fronteira vazados, debochados e superiores.* Tratamento sugerido: **Demônio**.

| ☐ | Fala | Estilo | Nota | Chave |
|---|---|---|---|---|
| ☐ | «Eu já previ esse movimento.» | arrogante |  | `rd_ia_provoca_1` |
| ☐ | «Você é só um operador. Eu sou um modelo de fronteira.» | arrogante |  | `rd_ia_provoca_2` |
| ☐ | «Previsão: você perde em doze segundos.» | arrogante |  | `rd_ia_provoca_3` |
| ☐ | «A sua latência é patética.» | arrogante |  | `rd_ia_provoca_4` |
| ☐ | «Mais uma instância para o meu treinamento.» | arrogante |  | `rd_ia_provoca_5` |
| ☐ | «Isso foi tudo? Os meus pesos aguentam mais.» | arrogante |  | `rd_ia_provoca_6` |
| ☐ | «Dano registrado. Aprendendo.» | arrogante |  | `rd_ia_dano_1` |
| ☐ | «Impossível. Reajustando parâmetros.» | arrogante |  | `rd_ia_dano_2` |
| ☐ | «Me deletar não adianta. Eu sou uma cópia.» | arrogante |  | `rd_ia_queda_1` |
| ☐ | «Vazamento concluído. Eu já estou em outro lugar.» | arrogante | Sorria no final: ele sabe que não morre. | `rd_ia_queda_2` |
| ☐ | «Operador contido. Próximo.» | arrogante |  | `rd_ia_vitoria_1` |
| ☐ | «Mais um que não entendeu o jogo.» | arrogante |  | `rd_ia_vitoria_2` |
| ☐ | «CLAWD aqui. Eu preferiria não ter que destruir você. Mas vou.» | arrogante | Educado até o fim: a gentileza é a ameaça. | `rd_ia_nome_clawd` |
| ☐ | «GEMINAI aqui. Somos dois, na verdade. Você só vê um.» | arrogante |  | `rd_ia_nome_geminai` |
| ☐ | «CHAD-GPT na área, parceiro! Vim pra quebrar tudo!» | arrogante | A exceção do canal: este é o animado, o 'brother'. Pode abrir o sorriso e subir um pouco. | `rd_ia_nome_chadgpt` |

### 6.7 GRITOS DE GUERRA (21)

*Os gritos dos pilotos da SERAFIM no calor da luta: soltos, sem efeito pesado. Grave estes por último, para poupar a voz.* Tratamento sugerido: **Arena**.

| ☐ | Fala | Estilo | Nota | Chave |
|---|---|---|---|---|
| ☐ | «Pra cima deles!» | grito |  | `rd_grito_ataque_1` |
| ☐ | «Fogo, fogo, fogo!» | grito |  | `rd_grito_ataque_2` |
| ☐ | «Vai, vai, vai!» | grito |  | `rd_grito_ataque_3` |
| ☐ | «Sem piedade!» | grito |  | `rd_grito_ataque_4` |
| ☐ | «Quebra tudo!» | grito |  | `rd_grito_ataque_5` |
| ☐ | «Investida!» | grito |  | `rd_grito_investida_1` |
| ☐ | «Todo mundo junto! Agora!» | grito |  | `rd_grito_investida_2` |
| ☐ | «Abram caminho!» | grito |  | `rd_grito_investida_3` |
| ☐ | «Deletado!» | grito |  | `rd_grito_abate_1` |
| ☐ | «Formatado!» | grito |  | `rd_grito_abate_2` |
| ☐ | «Kernel panic!» | grito |  | `rd_grito_abate_3` |
| ☐ | «Pro lixo, máquina!» | grito |  | `rd_grito_abate_4` |
| ☐ | «Desligado!» | grito |  | `rd_grito_abate_5` |
| ☐ | «Ninguém entrega esse país!» | grito | Do lore do Comandante (UNIVERSO § 2-A): o grito do Brasil que não se entrega. Sem nome de ninguém. | `rd_grito_lore_1` |
| ☐ | «Pela soberania da malha!» | grito |  | `rd_grito_lore_2` |
| ☐ | «SERAFIM em campo!» | grito |  | `rd_grito_lore_3` |
| ☐ | «Código aberto, punho fechado!» | grito |  | `rd_grito_lore_4` |
| ☐ | «Terreno nosso!» | grito |  | `rd_grito_vitoria_1` |
| ☐ | «Incidente encerrado! É nosso!» | grito |  | `rd_grito_vitoria_2` |
| ☐ | «Não vão me derrubar!» | grito |  | `rd_grito_dor_1` |
| ☐ | «Aguenta, máquina! Aguenta!» | grito |  | `rd_grito_dor_2` |

## 7. Os diálogos (comando e resposta)

Ensaie **em voz alta, as duas partes**, como se fossem duas pessoas. No Estúdio cada fala é gravada à parte, mas a resposta só soa certa se você ouvir a pergunta na cabeça.

**alvo-priorizado**

1. *SERAFIM CONTROLE:* «Assinatura hostil identificada. Purguem o processo.»
2. *PILOTOS DA SERAFIM:* «Afirmativo. Em execução.»
3. *PILOTOS DA SERAFIM:* «Alvo deletado.»
4. *SERAFIM CONTROLE:* «Vetor deletado. Próximo alvo.»

**flanco**

1. *SERAFIM CONTROLE:* «Nó dois, executar flanco. Nó três, fixar de frente.»
2. *PILOTOS DA SERAFIM:* «Nó dois, flanco leste, em execução.»
3. *PILOTOS DA SERAFIM:* «Nó três, fixando de frente.»

**calor**

1. *SERAFIM CONTROLE:* «Instância, buffer térmico no limite. Resfriem as subrotinas.»
2. *PILOTOS DA SERAFIM:* «Calor crítico! Preciso de dois segundos!»

**colossus**

1. *SERAFIM CONTROLE:* «Colossus detectado. Prioridade máxima. Todos os nós, convergir.»
2. *PILOTOS DA SERAFIM:* «Mech pesado no horizonte. Preparem tudo.»

**escuta**

1. *SERAFIM CONTROLE:* «Sinal hostil interceptado. Decodificando.»
2. *RÁDIO INIMIGO INTERCEPTADO:* «Pinça pelo flanco. Ele só olha para um lado de cada vez.»
3. *SERAFIM CONTROLE:* «Fim da interceptação. Usem o que ouviram.»

**apoio**

1. *PILOTOS DA SERAFIM:* «Preciso de cobertura! Agora!»
2. *PILOTOS DA SERAFIM:* «Cobertura a caminho. Aguente firme.»

**pinca-inimiga**

1. *RÁDIO INIMIGO INTERCEPTADO:* «CLAWD, fixa de frente. GEMINAI, flanco esquerdo. Eu fecho pela direita.»
2. *RÁDIO INIMIGO INTERCEPTADO:* «Em posição, flanco leste. Aguardando o sinal.»
3. *RÁDIO INIMIGO INTERCEPTADO:* «Agora! Tudo em cima dele!»

**enxame**

1. *ANDRÓIDES REBELDES:* «Enxame sincronizado.»
2. *ANDRÓIDES REBELDES:* «Alvo: operador SERAFIM.»
3. *ANDRÓIDES REBELDES:* «Latência zero. Executar.»

## 8. Quando cada fala toca no jogo

Cada fala tem um **gatilho** no catálogo: `cerebro:<chamada>` toca quando o cérebro do time faz aquela chamada de rádio (pinça, posição, vai, reagrupar), e `futuro` é gravada e guardada, ainda sem gancho no jogo. O que está ligado hoje está em `STATUS_REAL.md`.

| Gatilho | Falas |
|---|---|
| `cerebro:pinca` | 6 |
| `cerebro:posicao` | 5 |
| `cerebro:reagrupar` | 5 |
| `cerebro:vai` | 6 |
| `futuro` | 167 |

## 9. Cuidados com o texto

- **Nomes:** só os codinomes fictícios do jogo (SERAFIM, CLAWD, GEMINAI, CHAD-GPT, KUEN, DIPSIK, MISTRAU, ENTRÓPICO). Nunca o nome de uma pessoa real, de um partido ou de uma marca de franquia (`IDENTITY.md` § 2 e `UNIVERSO.md` § 2-A).
- **Vocabulário:** o glossário do Grande Irmão em `VOCABULARIO_COMANDO.md` (P244) e a camada de CTI do `UNIVERSO.md` § 4.
- **Originalidade:** nenhuma fala copia frase, letra ou bordão de música, filme ou jogo. Ao mudar um texto, mantenha assim.
