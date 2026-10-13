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

# Um reinício que não deu (o servidor antigo não saiu, ou esta tarefa foi cortada no meio pelo limite de tempo do Agendador) deixa o
# código novo em disco e o servidor parado ou velho: na próxima rodada não há "código novo" (codigo 1), então o marcador
# `reinicio-pendente` é o que manda tentar de novo. Ele é criado ANTES de parar o servidor e só some quando o servidor responde.
$jaPendente = Test-Path $pendente
if ($codigo -eq 1 -and $jaPendente) { $codigo = 0 }

if ($codigo -eq 0) {
  # Verificado: código novo, typecheck e testes de server/+shared/ passaram. Para o servidor DE VERDADE (parar-servidor.ps1: o
  # Stop-ScheduledTask sozinho deixa o node órfão segurando a porta, e o novo não sobe) e liga de novo.
  New-Item -ItemType File -Force -Path $pendente | Out-Null
  & "$PSScriptRoot\parar-servidor.ps1"
  if ($LASTEXITCODE -eq 0) {
    # ligar-servidor.ps1 liga, confere o /status e tenta de novo (até 3 vezes) se a instância nascer e morrer.
    $saida = (& "$PSScriptRoot\ligar-servidor.ps1" *>&1 | Out-String).Trim()
    if ($LASTEXITCODE -eq 0) {
      Registrar "servidor religou no código novo: $saida"
      Remove-Item $pendente -Force -ErrorAction SilentlyContinue
    } else {
      Registrar "ATENÇÃO: o servidor NÃO voltou depois de parar (a próxima rodada tenta de novo): $saida"
    }
  } elseif (-not $jaPendente) {
    # Registra só na primeira vez; as tentativas seguintes (a cada 10 min) ficam quietas até dar certo.
    Registrar 'ATENÇÃO: o servidor antigo continua no ar: não saiu pelo pedido de parada (servidor de antes dessa vigia). O código novo já está em disco. Reiniciar uma vez exige PowerShell como administrador: Get-NetTCPConnection -LocalPort 2567 -State Listen | % { Stop-Process -Id $_.OwningProcess -Force }; Start-ScheduledTask -TaskName "CYBERMECH servidor"'
  }
} elseif ($codigo -eq 1) {
  # Nada novo e nenhum reinício pendente: confere que o servidor está de pé. Se ele caiu (ou um reinício foi cortado antes de o
  # marcador existir), liga: quem vigia o servidor é esta tarefa, que roda a cada 10 min. Não toca em servidor que responde.
  try {
    Invoke-RestMethod -Uri 'http://127.0.0.1:2567/status' -TimeoutSec 5 | Out-Null
  } catch {
    Registrar 'o servidor não responde no /status: ligando'
    $saida = (& "$PSScriptRoot\ligar-servidor.ps1" *>&1 | Out-String).Trim()
    if ($LASTEXITCODE -eq 0) { Registrar "servidor religou: $saida" } else { Registrar "ATENÇÃO: não consegui ligar o servidor: $saida" }
  }
}
# codigo 2 (falhou, já reverteu sozinho) não faz nada aqui — o log em .tmp\servidor\atualizacao.log já registrou o motivo.

# O site (13/10, P105: "publicação automática, gratuita; não quero pagar o GitHub"): o Actions não publica mais, então o PC publica. Montar o site leva mais que o limite desta tarefa (5 min),
# então o publicador roda SOLTO (pelo WMI, como o ajudante de reinício: fora da árvore desta tarefa) e só se o código mudou (--se-mudou) e há configuração (deploy-site.json).
# O processo do WMI não herda o ambiente: o PATH vai na linha de comando. O que ele fez fica em .tmp\servidor\publicar-site.log.
try {
  $nodeExe = (Get-Command node.exe).Source
  $linha = "cmd.exe /c set `"PATH=$env:PATH`" && `"$nodeExe`" scripts\publicar-site.mjs --se-mudou"
  $r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $linha; CurrentDirectory = $raiz }
  if ($r.ReturnValue -ne 0) { Registrar "o publicador do site não foi lançado (WMI devolveu $($r.ReturnValue))" }
} catch {
  Registrar "o publicador do site não foi lançado: $($_.Exception.Message)"
}
exit 0
