# Religa o servidor de jogo depois de um REINICIAR do painel (POST /admin/reiniciar).
#
# Rodado pelo PRÓPRIO servidor, como processo solto, logo antes de ele sair (server/religar.ts). O Agendador NÃO religa uma tarefa cujo programa
# saiu com código diferente de 0 (medido em 12/10: ela ficou "Ready" com resultado 75 e o servidor ficou 4 min fora), e a tarefa só aceita o Start
# depois que a instância velha terminou ("Running" ignora o Start). Por isso este script espera o servidor sair (a porta ficar livre) e chama o
# ligar-servidor.ps1, o mesmo caminho do atualizador: liga, confere o /status e tenta de novo até 3 vezes.
# Se o servidor não sair, ou o ligar falhar, o vigia do atualizador (a cada 10 min) liga o servidor que não responde.
# O que ele fez fica em religar.log, na pasta de dados do servidor (CYBERMECH_DADOS).
#
# O ajudante é criado pelo WMI (server/religar.ts), e um processo do WMI NÃO herda o ambiente do servidor: a pasta de dados vem em -Dados.
#
# Uso (o servidor chama): powershell -File scripts\religar-servidor.ps1 -Porta 2567 -Dados <pasta de dados> [-Tarefa 'CYBERMECH servidor']

param([string]$Tarefa = 'CYBERMECH servidor', [int]$Porta = 2567, [string]$Dados)
$ErrorActionPreference = 'Continue'

$dados = if ($Dados) { $Dados } elseif ($env:CYBERMECH_DADOS) { $env:CYBERMECH_DADOS } else { Join-Path (Split-Path -Parent $PSScriptRoot) '.tmp\servidor' }
$log = Join-Path $dados 'religar.log'
function Registrar([string]$linha) {
  try { Add-Content -Path $log -Value ('[{0}] {1}' -f (Get-Date).ToUniversalTime().ToString('o'), $linha) -Encoding utf8 } catch { }
}
function PortaOcupada { @(Get-NetTCPConnection -LocalPort $Porta -State Listen -ErrorAction SilentlyContinue).Count -gt 0 }

Registrar "ajudante de reinício começou (PID $PID, usuário $env:USERNAME, porta $Porta, tarefa '$Tarefa')"

# 1. Espera o servidor sair: a porta livre (ele fecha o HTTP primeiro e sai logo depois). Até 60 s.
$fim = (Get-Date).AddSeconds(60)
while ((PortaOcupada) -and (Get-Date) -lt $fim) { Start-Sleep -Milliseconds 500 }
if (PortaOcupada) {
  Registrar 'o servidor não saiu em 60 s: desisto (o vigia do atualizador cuida)'
  exit 1
}

# 2. Liga de novo e confere que respondeu (o ligar-servidor.ps1 espera a tarefa descansar e tenta até 3 vezes).
$saida = (& "$PSScriptRoot\ligar-servidor.ps1" -Tarefa $Tarefa -Porta $Porta *>&1 | Out-String).Trim()
if ($LASTEXITCODE -eq 0) {
  Registrar "religou: $saida"
  exit 0
}
Registrar "FALHOU: $saida"
exit 1
