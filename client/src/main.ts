import './styles.css';
import { installDiagnostics, runtimeDiagnostics } from './core/runtimeDiagnostics';
import { iniciarIdioma, ligarSeletorIdioma } from './i18n/i18n';

installDiagnostics();
const started = performance.now();
// A língua vem antes da interface (P172): em português não custa nada; nas outras, baixa o dicionário e traduz o que já está na tela.
void iniciarIdioma()
  .then(() => {
    const seletor = document.getElementById('setting-idioma');
    if (seletor instanceof HTMLSelectElement) ligarSeletorIdioma(seletor);
    return import('./core/Game');
  })
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
