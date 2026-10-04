# Servidor de jogo do CYBERMECH ligado 24 horas no PC com Windows (DEPLOY.md, "Servidor de jogo").
#
# Registra uma tarefa no Agendador de Tarefas: o servidor sobe junto com o Windows (mesmo sem ninguém logado),
# reinicia sozinho se cair e grava o log em .tmp\servidor\ (G15: nada fora da pasta do projeto).
#
# Uso, no PowerShell como administrador, na pasta do projeto:
#   .\scripts\servidor-windows.ps1            registra e já liga
#   .\scripts\servidor-windows.ps1 -Remover   desliga e tira do Windows
#
# O túnel da Cloudflare (o endereço público) é um serviço à parte, instalado pelo próprio cloudflared.

param([switch]$Remover)
$ErrorActionPreference = 'Stop'
$nome = 'CYBERMECH servidor'

if ($Remover) {
  Stop-ScheduledTask -TaskName $nome -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $nome -Confirm:$false
  Write-Host "Removido: o servidor não sobe mais com o Windows."
  exit 0
}

$raiz = Split-Path -Parent $PSScriptRoot
# O servidor roda do CÓDIGO desta pasta. Na pasta onde se edita, o branch muda a cada `git switch` de qualquer agente (04/10:
# a outra conversa trocou o branch e o servidor foi reiniciado com código velho). Por isso: worktree própria, com node_modules próprio.
$gitDir = git -C $raiz rev-parse --git-dir
$commonDir = git -C $raiz rev-parse --git-common-dir
if ($gitDir -eq $commonDir) {
  Write-Host "FALHOU: esta é a pasta principal do projeto, onde se edita. O servidor deve rodar de uma worktree própria:"
  Write-Host "  git worktree add .tmpwt-servidor-prod origin/main   e rode este script de DENTRO dela (veja o cabeçalho de servidor-atualizar.ps1)."
  exit 1
}
$nm = Get-Item (Join-Path $raiz 'node_modules') -Force -ErrorAction SilentlyContinue
if ($nm -and $nm.LinkType) {
  Write-Host "FALHOU: node_modules desta pasta é um atalho ($($nm.LinkType)) para $($nm.Target). O servidor precisa de node_modules PRÓPRIO: cmd /c rmdir node_modules; npm ci"
  exit 1
}
$node = (Get-Command node.exe).Source
New-Item -ItemType Directory -Force -Path (Join-Path $raiz '.tmp\servidor') | Out-Null

# cmd.exe só para redirecionar a saída para o log (o Agendador não guarda o que o programa escreve).
$comando = "/c cd /d `"$raiz`" && `"$node`" scripts\server.mjs >> .tmp\servidor\servidor.log 2>&1"
$acao = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument $comando
$gatilho = New-ScheduledTaskTrigger -AtStartup
$ajustes = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
# S4U: roda com o seu usuário, logado ou não, sem guardar senha.
$quem = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U -RunLevel Limited

try {
  Register-ScheduledTask -TaskName $nome -Action $acao -Trigger $gatilho -Settings $ajustes -Principal $quem -Force | Out-Null
} catch {
  Write-Host "FALHOU: não deu para registrar a tarefa ($($_.Exception.Message))."
  Write-Host "A causa mais comum: este script precisa de PowerShell COMO ADMINISTRADOR — registrar tarefa no Agendador exige elevação."
  Write-Host "Nada foi alterado: a tarefa antiga (se existir) segue como estava. Abra o PowerShell como administrador e rode de novo."
  exit 1
}
# O `Register` pode não lançar e ainda assim não registrar (foi o que aconteceu em 29/09 com acesso negado):
# conferir antes de cantar vitória — o script chegou a dizer "Pronto" sem tarefa nenhuma registrada.
if (-not (Get-ScheduledTask -TaskName $nome -ErrorAction SilentlyContinue)) {
  Write-Host "FALHOU: a tarefa '$nome' não existe no Agendador depois do registro — rode como administrador."
  exit 1
}
Start-ScheduledTask -TaskName $nome
Write-Host "Pronto: o servidor sobe com o Windows e reinicia se cair."
Write-Host "Pasta de onde ele roda: $raiz"
Write-Host "Log: $raiz\.tmp\servidor\servidor.log"
Write-Host "Para o PC não dormir na tomada: powercfg /change standby-timeout-ac 0"
