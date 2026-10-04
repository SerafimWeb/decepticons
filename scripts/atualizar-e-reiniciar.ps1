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

if ($codigo -eq 0) {
  # Verificado: código novo, typecheck e testes de server/+shared/ passaram. Reinicia o processo do jogo
  # (não é Restart-ScheduledTask — esse cmdlet não existe no módulo ScheduledTasks; é Stop + Start).
  Stop-ScheduledTask -TaskName 'CYBERMECH servidor' -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
  Start-ScheduledTask -TaskName 'CYBERMECH servidor'
}
# codigo 1 (nada novo) e 2 (falhou, já reverteu sozinho) não fazem nada aqui — o log em
# .tmp\servidor\atualizacao.log já registrou o motivo.
exit 0
