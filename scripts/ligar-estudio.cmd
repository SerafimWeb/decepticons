@echo off
rem Liga o estudio de sons (dois cliques). Fecha a janela ou aperte Ctrl+C para desligar.
cd /d "%~dp0.."
echo Ligando o estudio...
call npm run estudio
echo.
echo O estudio foi desligado (ou nao conseguiu ligar). Veja a mensagem acima.
pause
