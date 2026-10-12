import './styles.css';
import { installDiagnostics, runtimeDiagnostics } from './core/runtimeDiagnostics';

installDiagnostics();
const started = performance.now();
void import('./core/Game')
  .then(({ Game }) => Game.create(document.getElementById('app')!))
  .then((game) => {
    runtimeDiagnostics.bootMs = performance.now() - started;
    game.start();
  })
  .catch((err: unknown) => {
    runtimeDiagnostics.error(err, 'boot');
    console.error(err);
    document.getElementById('cta')!.textContent = '[ erro ao iniciar — tente recarregar ]';
  });
