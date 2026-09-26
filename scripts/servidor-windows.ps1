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

Register-ScheduledTask -TaskName $nome -Action $acao -Trigger $gatilho -Settings $ajustes -Principal $quem -Force | Out-Null
Start-ScheduledTask -TaskName $nome
Write-Host "Pronto: o servidor sobe com o Windows e reinicia se cair."
Write-Host "Log: $raiz\.tmp\servidor\servidor.log"
Write-Host "Para o PC não dormir na tomada: powercfg /change standby-timeout-ac 0"
