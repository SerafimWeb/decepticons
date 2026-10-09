# Para o servidor de jogo DE VERDADE (usado pela atualização automática e à mão).
#
# O `Stop-ScheduledTask` só mata o cmd.exe da tarefa: o node filho sobrevive órfão, segura a porta do jogo e os binários nativos
# (o `npm ci` dá EPERM e o servidor novo não sobe, porque a porta está ocupada), e quem não é administrador não consegue
# encerrá-lo (o processo roda numa sessão própria da tarefa e nega acesso até ao mesmo usuário). Achado em 04/10 e de novo em 09/10.
#
# Por isso o servidor se encerra sozinho (server/parada.ts): este script cria `parar.flag` na pasta de dados, o servidor salva os
# números e sai. O encerramento à força é só o último recurso (serve com administrador, ou contra um servidor de antes desta
# vigia, que ignora o arquivo).
#
# Uso: .\scripts\parar-servidor.ps1            (tarefa 'CYBERMECH servidor', porta 2567, pasta de dados lida da tarefa)
# Saída: 0 = a porta está livre; 1 = continua ocupada (quem chamou NÃO deve religar o servidor).

param([string]$Tarefa = 'CYBERMECH servidor', [int]$Porta = 2567, [string]$Dados)
$ErrorActionPreference = 'Continue'

function PortaOcupada { @(Get-NetTCPConnection -LocalPort $Porta -State Listen -ErrorAction SilentlyContinue).Count -gt 0 }
function EsperarLivre([int]$segundos) {
  $fim = (Get-Date).AddSeconds($segundos)
  while ((Get-Date) -lt $fim) {
    if (-not (PortaOcupada)) { return $true }
    Start-Sleep -Milliseconds 500
  }
  return -not (PortaOcupada)
}

if (-not (PortaOcupada)) {
  Stop-ScheduledTask -TaskName $Tarefa -ErrorAction SilentlyContinue # a tarefa pode estar "rodando" sem servidor: limpa
  exit 0
}

# A pasta de dados é a que a própria tarefa usa (CYBERMECH_DADOS no comando dela); sem isso, a de sempre ao lado do código.
if (-not $Dados) {
  $acao = (Get-ScheduledTask -TaskName $Tarefa -ErrorAction SilentlyContinue).Actions | Select-Object -First 1
  if ($acao -and $acao.Arguments -match 'CYBERMECH_DADOS=([^"]+)"') { $Dados = $Matches[1] }
}
if (-not $Dados) { $Dados = Join-Path (Split-Path -Parent $PSScriptRoot) '.tmp\servidor' }

# 1. Pede a parada: o servidor vê o arquivo (a cada 2 s), salva os números e sai.
try {
  New-Item -ItemType Directory -Force -Path $Dados | Out-Null
  New-Item -ItemType File -Force -Path (Join-Path $Dados 'parar.flag') | Out-Null
  Write-Host "pedi a parada ao servidor (parar.flag em $Dados)"
} catch {
  Write-Host "não consegui criar o pedido de parada em ${Dados}: $($_.Exception.Message)"
}
if (EsperarLivre 25) {
  Stop-ScheduledTask -TaskName $Tarefa -ErrorAction SilentlyContinue # a tarefa termina sozinha quando o node sai; isto só limpa o estado
  exit 0
}

# 2. Último recurso: o servidor não saiu (servidor de antes desta vigia, ou travado). À força: só administrador consegue.
Stop-ScheduledTask -TaskName $Tarefa -ErrorAction SilentlyContinue
foreach ($o in @(Get-NetTCPConnection -LocalPort $Porta -State Listen -ErrorAction SilentlyContinue)) {
  $p = Get-Process -Id $o.OwningProcess -ErrorAction SilentlyContinue
  # Só encerra node: a porta do jogo é do servidor; outro programa nela não é da nossa conta.
  if ($p -and $p.ProcessName -eq 'node') {
    try { Stop-Process -Id $p.Id -Force -ErrorAction Stop; Write-Host "encerrei à força o node $($p.Id)" }
    catch { Write-Host "não consegui encerrar o node $($p.Id): $($_.Exception.Message) (precisa de PowerShell como administrador)" }
  }
}
if (EsperarLivre 8) { exit 0 }
Write-Host "FALHOU: a porta $Porta continua ocupada."
exit 1
