# Registra a atualização automática do servidor de jogo (DEPLOY.md, "Atualização automática").
#
# A cada 10 min, confere se a `main` avançou, e só troca o código depois de passar por typecheck e pelos
# testes de server/ e shared/ (o mesmo portão do CI, só que local e rápido). Roda numa worktree separada da
# pasta onde você edita (G15 + segurança: um `git reset --hard` automático nunca pode tocar seu trabalho em
# andamento) — este script RECUSA rodar fora de uma worktree.
#
# Uso, no PowerShell como administrador, de DENTRO da worktree do servidor (não da pasta principal):
#   .\scripts\servidor-atualizar.ps1            registra e já liga
#   .\scripts\servidor-atualizar.ps1 -Remover   desliga e tira do Windows
#
# Configuração de uma vez só (a partir da pasta principal do projeto):
#   git worktree add .tmp\wt-servidor-prod origin/main
#   New-Item -ItemType Junction -Path .tmp\wt-servidor-prod\node_modules -Target node_modules
#   cd .tmp\wt-servidor-prod
#   .\scripts\servidor-windows.ps1       # registra "CYBERMECH servidor" (o processo do jogo)
#   .\scripts\servidor-atualizar.ps1     # registra esta tarefa (a atualização automática)

param([switch]$Remover)
$ErrorActionPreference = 'Stop'
$nome = 'CYBERMECH atualizar'

if ($Remover) {
  Stop-ScheduledTask -TaskName $nome -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $nome -Confirm:$false
  Write-Host "Removido: a atualização automática não roda mais (o servidor de jogo continua no ar, sem trocar de código sozinho)."
  exit 0
}

# Confere de dentro de uma worktree separada antes de registrar qualquer coisa: registrar isto na pasta
# principal (onde o dono edita) seria perigoso — está aqui, não só dentro do .mjs, para falhar cedo e claro.
$gitDir = git rev-parse --git-dir
$commonDir = git rev-parse --git-common-dir
if ($gitDir -eq $commonDir) {
  Write-Error "Esta pasta não é uma worktree separada. Rode de dentro de .tmp\wt-servidor-prod\ (veja o cabeçalho deste arquivo)."
  exit 1
}

$raiz = Split-Path -Parent $PSScriptRoot
$pwsh = (Get-Command powershell.exe).Source
New-Item -ItemType Directory -Force -Path (Join-Path $raiz '.tmp\servidor') | Out-Null

$acao = New-ScheduledTaskAction -Execute $pwsh -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$raiz\scripts\atualizar-e-reiniciar.ps1`""
$gatilho = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 10) -RepetitionDuration ([TimeSpan]::MaxValue)
$ajustes = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew
$quem = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U -RunLevel Limited

Register-ScheduledTask -TaskName $nome -Action $acao -Trigger $gatilho -Settings $ajustes -Principal $quem -Force | Out-Null
Start-ScheduledTask -TaskName $nome
Write-Host "Pronto: a cada 10 min confere a main, verifica (typecheck + testes) antes de trocar o código, e só reinicia o servidor se passar."
Write-Host "Log: $raiz\.tmp\servidor\atualizacao.log"
