# GEMINI.md — CYBERMECH

As instruções do projeto são as mesmas para todos os agentes e vivem no `AGENTS.md` (fonte única). Leia-o inteiro antes de qualquer ação:

@AGENTS.md

## Só para o Gemini

- Você é o **Gemini**: assine assim no histórico, no estado e no branch (`gemini/<tarefa>`), nunca como outro agente.
- Parta sempre da `main` atualizada: `git fetch origin && git switch -c gemini/<tarefa> origin/main`.
- Temporários só em `.tmp/` do projeto (G15). Antes do commit, confira o `git status`.
