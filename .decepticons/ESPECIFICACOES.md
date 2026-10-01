# ESPECIFICAÇÕES TÉCNICAS — CYBERMECH

Índice de especificações por sistema. Cada spec é um documento técnico independente que define **contrato, limites, testes** de um módulo ou subsistema.

## Formato do Spec

Cada arquivo `SPECS_*.md` segue este template:

```markdown
# SPECS: [SISTEMA] — CYBERMECH

## Objetivo
Um parágrafo: o que o sistema faz, a quem serve, por que existe.

## Decisões de Design
Tabela: decisão | razão | trade-off.
Referências a GAME_DESIGN.md, VISION.md, ROADMAP.md, ADRs.

## Contrato (API Pública)
Entrada: tipos, limites, chamadores.
Saída: tipos, invariantes.
Exemplo de uso.

## Custo
- CPU: operações / tick, sem alocação no caminho quente.
- Memória: pool fixo, typed arrays.
- Rede: bytes/s (se aplicável).
- Draw calls: quantos, quando.

## Testes
Arquivo de teste (padrão `[SISTEMA].test.ts` no Node).
Cobertura: casos críticos + limites + edge cases.
Metas: % de cobertura, regressão.

## Conhecimento
Documentação relacionada: links para HISTORICO_DE_DECISOES.md, ADRs, etc.
Achados reais (R17): bug conhecido, workaround, recomendação.

## Próximos Passos
- Aberto: O que ainda falta.
- Bloqueador: O que bloqueia outros sistemas.
```

---

## Specs Prontas para Escrever

| Spec | Prioridade | Status | Dono |
|---|---|---|---|
| **SPECS_MechBase.ts** | Alta | TODO | Claude |
| **SPECS_Physics.ts** | Alta | TODO | Claude |
| **SPECS_Combat.ts** | Alta | TODO | Claude |
| **SPECS_Network.ts** | Alta | TODO | Claude |
| **SPECS_Hangar.ts** | Média | PARCIAL (HANGAR.md existe) | Claude |
| **SPECS_HUD.ts** | Média | TODO | Gemini |
| **SPECS_AudioSystem.ts** | Média | TODO | Gemini |
| **SPECS_Render.ts** | Média | TODO | Codex |

---

## Como Adicionar um Spec

1. Crie `SPECS_[SISTEMA].md` nesta pasta
2. Siga o template acima
3. Teste coberto em `client/src/[sistema]/[sistema].test.ts`
4. Link de volta aqui, nesta tabela
5. Referência em `PROTOCOLO_UNIVERSAL.md` (seção "Ligado")

---

*Versão 1.0 | 2026-10-01*
