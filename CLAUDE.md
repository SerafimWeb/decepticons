# CLAUDE.md — Cyber-Mech Protocol

As instruções do projeto são as mesmas para todos os agentes e vivem no `AGENTS.md` (fonte única):

@AGENTS.md

## Só para o Claude

- A memória automática do Claude não é vista pelo Codex. Tudo que importa para o projeto vai para `.decepticons/` ou para o `AGENTS.md`.
- Branch de trabalho: `claude/<tarefa>`.
- Painel de missão: ao fim de cada sessão, `npm run painel` e republicar `.tmp/painel/painel.html` no artefato https://claude.ai/artifact/T3X9EjnXvXNrvz1DnnrsHC (passe esse `url`; publicar sem ele cria outra página).
- Temporários vão para `.tmp/` do projeto, **nunca** para o scratchpad que o Claude Code oferece (ele fica no temp do Windows, fora do projeto: G15).
