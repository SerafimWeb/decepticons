import './styles.css';
import { installDiagnostics, runtimeDiagnostics } from './core/runtimeDiagnostics';
import { iniciarIdioma, ligarSeletorIdioma } from './i18n/i18n';
import { definirVisibilidadeGlobal, sanearLink, Visibilidade } from './core/Visibilidade';
import { COMANDANTE_KEY } from './ui/consoleData';
import { decidirComandante, definirModoComandante, linkPermitido } from './core/ModoComandante';
import { browserStorage } from './core/Settings';
import { ContaCliente } from './net/auth';
import { chaveDoToken } from './net/sessao';
import { defaultServer } from './net/onlineConfig';

installDiagnostics();
const started = performance.now();
/**
 * O que o jogador vê (P191): o que o Comandante liberou ou segurou no painel de visibilidade. O padrão do código e a última resposta guardada no navegador valem na hora; o servidor é perguntado
 * (1,5 s de espera, sem travar a largada) e, se um link aponta para uma fase ou um modo restrito, volta ao padrão antes de o jogo montar.
 */
/**
 * Esta conta é de administrador? **Só pergunta se há uma conta** (o token do navegador, um por servidor) e espera até 1,5 s; qualquer falha é "não". O servidor é quem diz (`/conta/eu`).
 */
async function contaDeAdministrador(servidor: string | null | undefined): Promise<boolean> {
  try {
    const token = servidor ? browserStorage()?.getItem(chaveDoToken(servidor)) : null;
    if (!servidor || !token) return false;
    const eu = await Promise.race([new ContaCliente(servidor).eu(token), new Promise<null>((fim) => setTimeout(() => fim(null), 1500))]);
    return eu?.is_admin === true;
  } catch {
    return false;
  }
}

/**
 * O modo Comandante (P224): o link só vale em desenvolvimento, no próprio PC e no site publicado enquanto o interruptor estiver ligado (`core/ModoComandante.ts`); fora disso, só a conta de administrador.
 * Decidido **uma vez, no início**: o jogo, o console e a visibilidade leem o mesmo valor.
 */
async function decidirModoComandante(servidor: string | null | undefined): Promise<boolean> {
  const armazem = browserStorage();
  let lembrado: string | null = null;
  try {
    lembrado = armazem?.getItem(COMANDANTE_KEY) ?? null;
  } catch {
    /* sem armazenamento */
  }
  const permitido = linkPermitido(location.hostname, import.meta.env.DEV, import.meta.env.VITE_COMANDANTE_POR_LINK);
  const entrada = { search: location.search, lembrado, linkPermitido: permitido, admin: false };
  let d = decidirComandante(entrada);
  if (!d.ligado) d = decidirComandante({ ...entrada, admin: await contaDeAdministrador(servidor) });
  try {
    if (d.gravar === '1') armazem?.setItem(COMANDANTE_KEY, '1');
    else if (d.gravar === 'apagar') armazem?.removeItem(COMANDANTE_KEY);
  } catch {
    /* sem armazenamento */
  }
  definirModoComandante(d.ligado);
  return d.ligado;
}

async function prepararVisibilidade(): Promise<void> {
  const armazem = browserStorage();
  const servidor = new URLSearchParams(location.search).get('servidor') || defaultServer(location.hostname, import.meta.env.VITE_GAME_SERVER);
  const comandante = await decidirModoComandante(servidor);
  const v = new Visibilidade(comandante, armazem);
  definirVisibilidadeGlobal(v);
  if (servidor) await Promise.race([v.carregar(servidor), new Promise<boolean>((fim) => setTimeout(() => fim(false), 1500))]);
  const limpo = sanearLink(location.search, v);
  if (limpo !== null) history.replaceState(null, '', `${location.pathname}${limpo ? `?${limpo}` : ''}${location.hash}`);
}

// A língua vem antes da interface (P172): em português não custa nada; nas outras, baixa o dicionário e traduz o que já está na tela.
void iniciarIdioma()
  .then(() => prepararVisibilidade().catch(() => undefined))
  .then(() => {
    // O do canto da primeira tela e o das Configurações (P176): dois lugares para a mesma escolha.
    for (const id of ['idioma-rapido', 'setting-idioma']) {
      const seletor = document.getElementById(id);
      if (seletor instanceof HTMLSelectElement) ligarSeletorIdioma(seletor);
    }
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
