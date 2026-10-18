# Liga o servidor de jogo (tarefa do Windows) e CONFERE que ele respondeu; tenta de novo se a instância nascer e morrer.
#
# Religar logo depois de parar bate numa corrida do Agendador: a instância nova nasce e morre na hora, com resultado 1 e sem
# escrever nada no log (09/10). `parar-servidor.ps1` já espera a tarefa parar; aqui, se mesmo assim o servidor não responde, a
# tarefa é parada de vez e religada, até 3 vezes. Pode ser chamado à mão, sem administrador.
#
# Uso: .\scripts\ligar-servidor.ps1            (tarefa 'CYBERMECH servidor', porta 2567)
# Saída: 0 = o /status respondeu (imprime o protocolo); 1 = não respondeu depois de 3 tentativas.

param([string]$Tarefa = 'CYBERMECH servidor', [int]$Porta = 2567)
$ErrorActionPreference = 'Continue'

function TarefaRodando { $t = Get-ScheduledTask -TaskName $Tarefa -ErrorAction SilentlyContinue; return ($t -and $t.State -eq 'Running') }

for ($tentativa = 1; $tentativa -le 3; $tentativa++) {
  # Uma instância ainda "Running" faria o Start ser ignorado: se não terminou sozinha, para.
  $fim = (Get-Date).AddSeconds(10)
  while ((TarefaRodando) -and (Get-Date) -lt $fim) { Start-Sleep -Milliseconds 500 }
  if (TarefaRodando) { Stop-ScheduledTask -TaskName $Tarefa -ErrorAction SilentlyContinue; Start-Sleep -Seconds 3 }
  Start-Sleep -Seconds 2
  Start-ScheduledTask -TaskName $Tarefa

  $fim = (Get-Date).AddSeconds(60)
  while ((Get-Date) -lt $fim) {
    Start-Sleep -Seconds 3
    try {
      $s = Invoke-RestMethod -Uri "http://127.0.0.1:$Porta/status" -TimeoutSec 4
      Write-Host "servidor no ar: protocolo $($s.protocol) (tentativa $tentativa)"
      exit 0
    } catch { }
  }
  Write-Host "tentativa ${tentativa}: o servidor não respondeu em 60 s; tento de novo"
}
Write-Host 'FALHOU: o servidor não subiu depois de 3 tentativas; veja D:\DECEPTICONS\.tmp\servidor\servidor.log (erros do Node) e a pasta registro\ (o dia a dia do servidor)'
exit 1
