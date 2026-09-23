import './styles.css';
import { Game } from './core/Game';

Game.create(document.getElementById('app')!)
  .then((game) => game.start())
  .catch((err: unknown) => {
    console.error(err);
    document.getElementById('cta')!.textContent = '[ erro ao iniciar — veja o console ]';
  });
