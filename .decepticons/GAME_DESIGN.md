# GAME DESIGN — Cyber-Mech Protocol

> O que o jogo é e por que cada decisão existe. As regras técnicas derivadas
> (G11–G14: economia de dados, requisitos, resiliência, código) moram em `PROTOCOLO_UNIVERSAL.md`.
> v1 — sessão de definição de 2026-09-23 (o dono aceitou os padrões propostos).

---

## PITCH

Abre o link, está jogando em segundos. Sem instalar, sem conta. Um shooter de Mechs em que você
arranca o inimigo peça por peça e derruba a cobertura dele.

**Diferencial:** destruição do cenário + dano por parte do Mech (perna quebrada = lento, cabeça = cego).
Toda prioridade de feature passa por aqui.

---

## DECISÕES

| Tema | Decisão | O que isso fixa na engenharia |
|---|---|---|
| Jogadores por sala | **8** | Servidor simula 8 Mechs a 60 Hz; orçamento de rede por sala (G11) |
| Modo inicial | **Todos contra todos, rodadas de 5 min** | Placar por rodada; sem times, sem objetivo |
| Entrada | **Entra e sai a qualquer hora, sem lobby** | Sala sempre aberta até 8; respawn rápido; sem matchmaking complexo |
| Contas | **Convidado com apelido** | Sem banco de dados, sem LGPD pesada na Fase 1 |
| Plataforma | **Desktop (mouse + teclado)** | Sem controles touch |
| Distribuição | **Portal de jogos primeiro + link próprio** | SDK do portal, download pequeno |

**A definir no playtest:** tempo de respawn, dano e vida por parte, mapa (1 arena por enquanto).

---

## LOOP DE JOGO

Entra pelo link → nasce → acha um inimigo → mira nas partes (perna, cabeça, braço) → derruba a
cobertura dele → morre ou mata → renasce em segundos → fim da rodada: placar → próxima começa sozinha.

---

## VIRALIZAÇÃO E RECEITA

O melhor de cada modelo, em ordem. Cada etapa só entra quando a anterior provar tração.

1. **Link de sala compartilhável:** "joga comigo" = uma URL com o código da sala. Zero fricção: sem conta, sem download.
2. **Modo streamer** (o dono vai fazer lives): sala com código fixo para a audiência entrar, câmera de espectador e HUD que some com uma tecla para tela limpa.
3. **Portal de jogos** (CrazyGames, Poki etc.): o portal traz o tráfego que um multiplayer novo não tem. Anúncios pelo SDK do portal **só entre rodadas**, nunca no meio do combate.
4. **Cosméticos** (pintura, neon, decalques, efeito de dash; **nunca atributo de combate**): quando a retenção justificar contas e pagamento.
5. **Passe de temporada:** depois dos cosméticos, se houver ritmo de conteúdo.

**Por que a destruição ajuda a viralizar:** parede explodindo e Mech perdendo a perna rendem clipe curto por si só. Não precisa de sistema de replay.

**Métrica de sucesso:** volta no dia seguinte (D1) e joga 3+ rodadas na primeira sessão.

---

## PRINCÍPIOS DE ARQUITETURA (pedido do dono)

Economia de dados, requisitos baixos, leveza, resiliência, código estratégico. As regras
mensuráveis estão em `PROTOCOLO_UNIVERSAL.md`:
- **G11:** economia de dados (orçamento de banda, snapshots, quantização)
- **G12:** requisitos mínimos e qualidade adaptativa
- **G13:** resiliência (reconexão, autoridade, falha isolada)
- **G14:** código estratégico (simulação única, teste por regra, custo explícito)
