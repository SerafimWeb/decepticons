/**
 * A página de redefinir a senha (/redefinir/), P206: onde o link do e-mail "Esqueci a senha" cai. Estática, sem bundler e **sem cookies nem Google Analytics** (`noindex`):
 * é a página que carrega um segredo de uso único.
 *
 * - **O token vem depois do `#`** do endereço (`/redefinir/?lang=en#TOKEN`): o fragmento não é enviado a servidor nenhum nem no Referer, então não cai em log da Cloudflare,
 *   da Hostinger nem do jogo. A página o lê e **o tira da barra de endereço na hora** (`history.replaceState`), antes de qualquer outra coisa.
 * - Fala com o servidor do jogo (`POST /conta/redefinir`) pelo endereço de `VITE_GAME_SERVER` do build (o mesmo da landing). Sem ele, a página diz que está indisponível.
 * - Sete línguas (as do jogo; a do e-mail vem no `?lang=`). A senha segue a regra de sempre (8 a 72 caracteres); o servidor confere de novo.
 * - Depois de trocar, **não entra sozinha na conta**: manda de volta ao jogo para entrar com a senha nova (as sessões antigas já foram encerradas pelo servidor).
 *
 * Uso: node scripts/redefinir.mjs --out <.tmp/site/redefinir/index.html>
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { esc, pagina, topo } from './site/tema.mjs';

const argv = process.argv.slice(2);
const OUT = resolve(argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : '.tmp/site/redefinir/index.html');

const { runnerImport } = await import('vite');
const load = async (p) => (await runnerImport(resolve(p), { configFile: false, logLevel: 'silent' })).module;
const { CONTA_REDEFINIR_PATH, REDEFINIR_TOKEN_RE, SENHA_MAX, SENHA_MIN, IDIOMAS_EMAIL } = await load('shared/net/auth.ts');
const { serverHttpUrl } = await load('shared/net/serverUrl.ts');
/** O endereço da API de redefinição no servidor de jogo do build, ou `''` (sem servidor neste build). */
const API = serverHttpUrl(process.env.VITE_GAME_SERVER?.trim(), CONTA_REDEFINIR_PATH) ?? '';

/** Os textos, por língua. `{min}` e `{max}` entram pelo script. */
const T = {
  pt: {
    titulo: 'Nova senha',
    intro: 'Escolha a senha nova da sua conta do CYBERMECH.',
    l1: 'Nova senha',
    l2: 'Repita a senha',
    ok: 'DEFINIR NOVA SENHA',
    enviando: 'ENVIANDO…',
    curta: 'A senha precisa ter de {min} a {max} caracteres.',
    diferente: 'As duas senhas não são iguais.',
    token: 'Este link não vale mais: ele vence em 30 minutos e só funciona uma vez. Peça outro em “Esqueci a senha”, na tela de conta do jogo.',
    limite: 'Tentativas demais. Espere um pouco e tente de novo.',
    servidor: 'Não consegui falar com o servidor. Tente de novo em instantes.',
    indisponivel: 'Esta página não está ligada a um servidor. Use o link do e-mail pelo endereço oficial do jogo.',
    feitoTitulo: 'Senha trocada',
    feito: 'Pronto: a senha da sua conta foi trocada e as sessões abertas foram encerradas. Entre no jogo com a senha nova.',
    voltar: 'VOLTAR AO JOGO',
  },
  en: {
    titulo: 'New password',
    intro: 'Choose the new password for your CYBERMECH account.',
    l1: 'New password',
    l2: 'Repeat the password',
    ok: 'SET NEW PASSWORD',
    enviando: 'SENDING…',
    curta: 'The password must be {min} to {max} characters long.',
    diferente: 'The two passwords do not match.',
    token: 'This link is no longer valid: it expires in 30 minutes and works only once. Ask for another one with “Forgot password” on the game’s account screen.',
    limite: 'Too many attempts. Wait a moment and try again.',
    servidor: 'Could not reach the server. Try again in a moment.',
    indisponivel: 'This page is not connected to a server. Use the e-mail link on the official game address.',
    feitoTitulo: 'Password changed',
    feito: 'Done: your account password was changed and all open sessions were ended. Sign in to the game with the new password.',
    voltar: 'BACK TO THE GAME',
  },
  es: {
    titulo: 'Contraseña nueva',
    intro: 'Elige la contraseña nueva de tu cuenta de CYBERMECH.',
    l1: 'Contraseña nueva',
    l2: 'Repite la contraseña',
    ok: 'DEFINIR CONTRASEÑA NUEVA',
    enviando: 'ENVIANDO…',
    curta: 'La contraseña debe tener de {min} a {max} caracteres.',
    diferente: 'Las dos contraseñas no coinciden.',
    token: 'Este enlace ya no vale: caduca en 30 minutos y solo funciona una vez. Pide otro en “Olvidé mi contraseña”, en la pantalla de cuenta del juego.',
    limite: 'Demasiados intentos. Espera un poco y vuelve a intentarlo.',
    servidor: 'No pude hablar con el servidor. Inténtalo de nuevo en un momento.',
    indisponivel: 'Esta página no está conectada a un servidor. Usa el enlace del correo en la dirección oficial del juego.',
    feitoTitulo: 'Contraseña cambiada',
    feito: 'Listo: la contraseña de tu cuenta se cambió y se cerraron las sesiones abiertas. Entra al juego con la contraseña nueva.',
    voltar: 'VOLVER AL JUEGO',
  },
  fr: {
    titulo: 'Nouveau mot de passe',
    intro: 'Choisissez le nouveau mot de passe de votre compte CYBERMECH.',
    l1: 'Nouveau mot de passe',
    l2: 'Répétez le mot de passe',
    ok: 'DÉFINIR LE MOT DE PASSE',
    enviando: 'ENVOI…',
    curta: 'Le mot de passe doit contenir de {min} à {max} caractères.',
    diferente: 'Les deux mots de passe ne sont pas identiques.',
    token: 'Ce lien n’est plus valable : il expire au bout de 30 minutes et ne fonctionne qu’une fois. Demandez-en un autre avec « Mot de passe oublié », sur l’écran de compte du jeu.',
    limite: 'Trop de tentatives. Patientez un instant et réessayez.',
    servidor: 'Impossible de joindre le serveur. Réessayez dans un instant.',
    indisponivel: 'Cette page n’est pas reliée à un serveur. Utilisez le lien de l’e-mail sur l’adresse officielle du jeu.',
    feitoTitulo: 'Mot de passe changé',
    feito: 'C’est fait : le mot de passe de votre compte a été changé et les sessions ouvertes ont été fermées. Connectez-vous au jeu avec le nouveau mot de passe.',
    voltar: 'RETOUR AU JEU',
  },
  ja: {
    titulo: '新しいパスワード',
    intro: 'CYBERMECHアカウントの新しいパスワードを決めてください。',
    l1: '新しいパスワード',
    l2: 'パスワードをもう一度',
    ok: '新しいパスワードを設定',
    enviando: '送信中…',
    curta: 'パスワードは{min}〜{max}文字にしてください。',
    diferente: '2つのパスワードが一致しません。',
    token: 'このリンクは無効です。有効期限は30分で、一度しか使えません。ゲームのアカウント画面の「パスワードを忘れた場合」から再発行してください。',
    limite: '試行回数が多すぎます。しばらく待ってからもう一度お試しください。',
    servidor: 'サーバーに接続できませんでした。少し待ってからもう一度お試しください。',
    indisponivel: 'このページはサーバーに接続されていません。ゲームの公式アドレスでメールのリンクを開いてください。',
    feitoTitulo: 'パスワードを変更しました',
    feito: '完了:アカウントのパスワードを変更し、開いていたセッションを終了しました。新しいパスワードでゲームにログインしてください。',
    voltar: 'ゲームに戻る',
  },
  zh: {
    titulo: '新密码',
    intro: '请为你的 CYBERMECH 账号设置新密码。',
    l1: '新密码',
    l2: '再次输入密码',
    ok: '设置新密码',
    enviando: '发送中…',
    curta: '密码长度需为 {min} 到 {max} 个字符。',
    diferente: '两次输入的密码不一致。',
    token: '此链接已失效:它 30 分钟后过期,且只能使用一次。请在游戏的账号界面通过“忘记密码”重新申请。',
    limite: '尝试次数过多。请稍候再试。',
    servidor: '无法连接服务器。请稍后再试。',
    indisponivel: '此页面未连接服务器。请在游戏的官方地址打开邮件中的链接。',
    feitoTitulo: '密码已更改',
    feito: '完成:你的账号密码已更改,已打开的会话已被结束。请用新密码登录游戏。',
    voltar: '返回游戏',
  },
  ru: {
    titulo: 'Новый пароль',
    intro: 'Задайте новый пароль для вашей учётной записи CYBERMECH.',
    l1: 'Новый пароль',
    l2: 'Повторите пароль',
    ok: 'ЗАДАТЬ НОВЫЙ ПАРОЛЬ',
    enviando: 'ОТПРАВКА…',
    curta: 'Пароль должен содержать от {min} до {max} символов.',
    diferente: 'Пароли не совпадают.',
    token: 'Эта ссылка больше не действует: она истекает через 30 минут и работает только один раз. Запросите новую через «Забыли пароль» на экране учётной записи в игре.',
    limite: 'Слишком много попыток. Подождите немного и повторите.',
    servidor: 'Не удалось связаться с сервером. Повторите чуть позже.',
    indisponivel: 'Эта страница не подключена к серверу. Откройте ссылку из письма на официальном адресе игры.',
    feitoTitulo: 'Пароль изменён',
    feito: 'Готово: пароль вашей учётной записи изменён, открытые сеансы завершены. Войдите в игру с новым паролем.',
    voltar: 'ВЕРНУТЬСЯ В ИГРУ',
  },
};
for (const l of IDIOMAS_EMAIL) if (!T[l]) throw new Error(`falta a língua ${l} na página de redefinição`);
const pt = T.pt;

const css = `
  .red { display: grid; gap: 22px; max-width: 460px; margin: 6vh auto 0; }
  .red h1 { font: 400 clamp(2.2rem, 7vw, 3.4rem)/.95 var(--fs); letter-spacing: .04em; color: var(--amber); text-transform: uppercase; }
  .red .intro { color: var(--muted); }
  .red form, .red .feito { display: grid; gap: 16px; border: 1px solid var(--line); background: var(--panel); padding: 20px; }
  .red label { display: grid; gap: 6px; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
  .red input { font: inherit; font-size: 16px; letter-spacing: normal; text-transform: none; color: var(--bone); background: #0a0e11; border: 1px solid var(--line2); padding: 11px 12px; }
  .red input:focus-visible { outline: 2px solid var(--amber); outline-offset: 1px; }
  .red .erro { color: var(--red); font-size: 14px; }
  .red button, .red .voltar { font: 400 1.05rem/1 var(--fd); letter-spacing: .12em; text-transform: uppercase; text-align: center; text-decoration: none; color: #120d00; background: var(--amber); border: 0; padding: 13px 16px; cursor: pointer; }
  .red button[disabled] { opacity: .55; cursor: progress; }
  .red [hidden] { display: none; }
`;

const body = `
  ${topo({ base: '../', current: '', left: 'CYBERMECH // CONTA' })}
  <main class="red">
    <header>
      <h1 id="titulo">${esc(pt.titulo)}</h1>
      <p class="intro" id="intro">${esc(pt.intro)}</p>
    </header>
    <form id="form" novalidate>
      <label><span id="l1">${esc(pt.l1)}</span><input id="s1" type="password" autocomplete="new-password" minlength="${SENHA_MIN}" maxlength="${SENHA_MAX}" required></label>
      <label><span id="l2">${esc(pt.l2)}</span><input id="s2" type="password" autocomplete="new-password" minlength="${SENHA_MIN}" maxlength="${SENHA_MAX}" required></label>
      <p class="erro" id="erro" role="alert" hidden></p>
      <button id="ok" type="submit">${esc(pt.ok)}</button>
    </form>
    <section class="feito" id="feito" role="status" hidden>
      <h2 id="feitoTitulo">${esc(pt.feitoTitulo)}</h2>
      <p id="feitoTexto">${esc(pt.feito)}</p>
      <a class="voltar" id="voltar" href="../jogar/">${esc(pt.voltar)}</a>
    </section>
    <noscript><p class="erro">JavaScript is required.</p></noscript>
  </main>
`;

const script = `
(() => {
  const T = ${JSON.stringify(T)};
  const API = ${JSON.stringify(API)};
  const TOKEN_RE = ${REDEFINIR_TOKEN_RE.toString()};
  const MIN = ${SENHA_MIN}, MAX = ${SENHA_MAX};
  const $ = (id) => document.getElementById(id);
  // 1) O token sai da barra de endereço ANTES de qualquer outra coisa: não fica no histórico nem num atalho copiado.
  const token = location.hash.slice(1);
  history.replaceState(null, '', location.pathname + location.search);
  const pedida = new URLSearchParams(location.search).get('lang') || (navigator.language || 'pt').slice(0, 2);
  const lang = T[pedida] ? pedida : 'pt';
  const t = (k) => T[lang][k].replace('{min}', MIN).replace('{max}', MAX);
  document.documentElement.lang = lang === 'pt' ? 'pt-BR' : lang === 'zh' ? 'zh-CN' : lang;
  for (const [id, k] of [['titulo', 'titulo'], ['intro', 'intro'], ['l1', 'l1'], ['l2', 'l2'], ['ok', 'ok'], ['feitoTitulo', 'feitoTitulo'], ['feitoTexto', 'feito'], ['voltar', 'voltar']]) $(id).textContent = t(k);
  const erro = (k) => { $('erro').textContent = k ? t(k) : ''; $('erro').hidden = !k; };
  if (!API) { $('form').hidden = true; $('erro').hidden = false; $('erro').textContent = t('indisponivel'); $('form').after($('erro')); return; }
  if (!TOKEN_RE.test(token)) { $('form').hidden = true; $('intro').textContent = t('token'); return; }
  $('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const a = $('s1').value, b = $('s2').value;
    if (a.length < MIN || a.length > MAX) return erro('curta');
    if (a !== b) return erro('diferente');
    erro(null);
    $('ok').disabled = true; $('ok').textContent = t('enviando');
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, senha: a }), credentials: 'omit' });
      if (r.ok) { $('form').hidden = true; $('intro').hidden = true; $('titulo').hidden = true; $('feito').hidden = false; return; }
      const dado = await r.json().catch(() => null);
      erro(r.status === 429 ? 'limite' : dado && dado.codigo === 'senha' ? 'curta' : dado && dado.codigo === 'token' ? 'token' : 'servidor');
    } catch { erro('servidor'); }
    $('ok').disabled = false; $('ok').textContent = t('ok');
  });
})();
`;

const html = pagina({
  title: 'Nova senha · CYBERMECH',
  description: 'Escolha a senha nova da sua conta do CYBERMECH.',
  css,
  body,
  script,
  anticopia: false,
  noindex: true,
});
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
console.log(`redefinir ${OUT} (${API ? 'servidor: ' + new URL(API).host : 'sem servidor neste build: a página diz que está indisponível'})`);
