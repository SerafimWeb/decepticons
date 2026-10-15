import './styles.css';
import { installDiagnostics, runtimeDiagnostics } from './core/runtimeDiagnostics';

installDiagnostics();
const started = performance.now();
void import('./core/Game')
  .then(({ Game }) => Game.create(document.getElementById('app')!))
  .then((game) => {
    runtimeDiagnostics.bootMs = performance.now() - started;
    // `?depurar` expõe o jogo às bancadas na GPU real (`.decepticons/medicoes/varrer-nan.mjs`): só leitura e câmera, nenhuma regra.
    if (new URLSearchParams(location.search).has('depurar')) (window as unknown as Record<string, unknown>).__game = game;
    game.start();
  })
  .catch((err: unknown) => {
    runtimeDiagnostics.error(err, 'boot');
    console.error(err);
    document.getElementById('cta')!.textContent = '[ erro ao iniciar — tente recarregar ]';
  });
