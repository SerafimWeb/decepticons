# Rodado pela tarefa "CYBERMECH atualizar" a cada 10 min (registrada por servidor-atualizar.ps1).
# Chama o verificador (atualizar-servidor.mjs); só reinicia o servidor se ele disser que passou no gate.
# Autônomo por design: sem intervenção do dono, e sem nunca reiniciar para um código que não foi verificado.
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node.exe).Source

# Diz ao atualizador qual tarefa parar e religar quando o package-lock.json mudar (o npm ci precisa do servidor parado).
$env:CYBERMECH_TAREFA = 'CYBERMECH servidor'

Push-Location $raiz
try {
  & $node scripts\atualizar-servidor.mjs
  $codigo = $LASTEXITCODE
} finally {
  Pop-Location
}

$log = Join-Path $raiz '.tmp\servidor\atualizacao.log'
$pendente = Join-Path $raiz '.tmp\servidor\reinicio-pendente'
function Registrar([string]$linha) { Add-Content -Path $log -Value ('[{0}] {1}' -f (Get-Date).ToUniversalTime().ToString('o'), $linha) -Encoding utf8 }

# Um reinício que não deu (o servidor antigo não saiu) deixa o código novo em disco e o servidor velho no ar: na próxima rodada
# não há "código novo" (codigo 1), então o marcador `reinicio-pendente` é o que manda tentar de novo.
if ($codigo -eq 1 -and (Test-Path $pendente)) { $codigo = 0 }

if ($codigo -eq 0) {
  # Verificado: código novo, typecheck e testes de server/+shared/ passaram. Para o servidor DE VERDADE (parar-servidor.ps1: o
  # Stop-ScheduledTask sozinho deixa o node órfão segurando a porta, e o novo não sobe) e liga de novo.
  & "$PSScriptRoot\parar-servidor.ps1"
  if ($LASTEXITCODE -eq 0) {
    # ligar-servidor.ps1 liga, confere o /status e tenta de novo (até 3 vezes) se a instância nascer e morrer.
    $saida = (& "$PSScriptRoot\ligar-servidor.ps1" 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -eq 0) {
      Registrar "servidor religou no código novo: $saida"
      Remove-Item $pendente -Force -ErrorAction SilentlyContinue
    } else {
      Registrar "ATENÇÃO: o servidor NÃO voltou depois de parar: $saida"
      New-Item -ItemType File -Force -Path $pendente | Out-Null # a próxima rodada tenta de novo
    }
  } elseif (-not (Test-Path $pendente)) {
    # Registra só na primeira vez; as tentativas seguintes (a cada 10 min) ficam quietas até dar certo.
    Registrar 'ATENÇÃO: o servidor antigo continua no ar: não saiu pelo pedido de parada (servidor de antes dessa vigia). O código novo já está em disco. Reiniciar uma vez exige PowerShell como administrador: Get-NetTCPConnection -LocalPort 2567 -State Listen | % { Stop-Process -Id $_.OwningProcess -Force }; Start-ScheduledTask -TaskName "CYBERMECH servidor"'
    New-Item -ItemType File -Force -Path $pendente | Out-Null
  }
}
# codigo 1 (nada novo) e 2 (falhou, já reverteu sozinho) não fazem nada aqui — o log em
# .tmp\servidor\atualizacao.log já registrou o motivo.
exit 0
