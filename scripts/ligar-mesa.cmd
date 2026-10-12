@echo off
rem Liga a mesa de video (dois cliques). Fecha a janela ou aperte Ctrl+C para desligar.
cd /d "%~dp0.."
echo Ligando a mesa de video...
call npm run mesa
echo.
echo A mesa foi desligada (ou nao conseguiu ligar). Veja a mensagem acima.
pause
