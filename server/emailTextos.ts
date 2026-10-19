import { REDEFINIR_VALE_MIN, type IdiomaEmail } from '../shared/net/auth';

/**
 * O texto do e-mail de redefinição de senha, nas sete línguas do jogo. Curto de propósito: o link, por quanto tempo vale e o que fazer se não foi a pessoa que pediu
 * (nada: ninguém entra sem o link, e ele vence sozinho). Sem imagem e sem rastreador: texto puro e uma versão HTML mínima.
 */
const T: Record<IdiomaEmail, { assunto: string; oi: string; corpo: string; ignore: string; rodape: string }> = {
  pt: {
    assunto: 'CYBERMECH: redefina a sua senha',
    oi: 'Piloto,',
    corpo: 'Alguém (esperamos que você) pediu para redefinir a senha da sua conta do CYBERMECH. Abra o link, escolha a senha nova e pronto. O link vale por {min} minutos e só funciona uma vez:',
    ignore: 'Se não foi você, ignore esta mensagem: a sua senha continua a mesma e o link vence sozinho.',
    rodape: 'Esta mensagem foi enviada porque alguém digitou este e-mail em "Esqueci a senha" no CYBERMECH.',
  },
  en: {
    assunto: 'CYBERMECH: reset your password',
    oi: 'Pilot,',
    corpo: 'Someone (we hope you) asked to reset the password of your CYBERMECH account. Open the link, choose a new password and you are done. The link is valid for {min} minutes and works only once:',
    ignore: 'If this was not you, ignore this message: your password stays the same and the link expires on its own.',
    rodape: 'This message was sent because someone entered this e-mail in "Forgot password" on CYBERMECH.',
  },
  es: {
    assunto: 'CYBERMECH: restablece tu contraseña',
    oi: 'Piloto,',
    corpo: 'Alguien (esperamos que tú) pidió restablecer la contraseña de tu cuenta de CYBERMECH. Abre el enlace, elige la contraseña nueva y listo. El enlace vale {min} minutos y solo funciona una vez:',
    ignore: 'Si no fuiste tú, ignora este mensaje: tu contraseña sigue igual y el enlace caduca solo.',
    rodape: 'Este mensaje se envió porque alguien escribió este correo en "Olvidé mi contraseña" en CYBERMECH.',
  },
  fr: {
    assunto: 'CYBERMECH : réinitialisez votre mot de passe',
    oi: 'Pilote,',
    corpo: "Quelqu'un (nous espérons que c'est vous) a demandé la réinitialisation du mot de passe de votre compte CYBERMECH. Ouvrez le lien, choisissez un nouveau mot de passe et c'est fini. Le lien est valable {min} minutes et ne fonctionne qu'une fois :",
    ignore: "Si ce n'était pas vous, ignorez ce message : votre mot de passe reste le même et le lien expire tout seul.",
    rodape: 'Ce message a été envoyé parce que quelqu\'un a saisi cette adresse dans « Mot de passe oublié » sur CYBERMECH.',
  },
  ja: {
    assunto: 'CYBERMECH:パスワードの再設定',
    oi: 'パイロットさん、',
    corpo: 'CYBERMECHアカウントのパスワード再設定がリクエストされました(ご本人であれば幸いです)。リンクを開いて新しいパスワードを決めてください。リンクの有効期限は{min}分で、一度しか使えません:',
    ignore: 'お心当たりがない場合は、このメッセージを無視してください。パスワードは変わらず、リンクは自動的に失効します。',
    rodape: 'このメッセージは、CYBERMECHの「パスワードを忘れた場合」にこのメールアドレスが入力されたため送信されました。',
  },
  zh: {
    assunto: 'CYBERMECH:重置你的密码',
    oi: '飞行员,',
    corpo: '有人(希望是你)请求重置你的 CYBERMECH 账号密码。打开链接,设置新密码即可。链接 {min} 分钟内有效,且只能使用一次:',
    ignore: '如果不是你本人,请忽略这封邮件:你的密码不会改变,链接会自动失效。',
    rodape: '发送此邮件是因为有人在 CYBERMECH 的"忘记密码"中输入了这个邮箱。',
  },
  ru: {
    assunto: 'CYBERMECH: сброс пароля',
    oi: 'Пилот,',
    corpo: 'Кто-то (надеемся, вы) запросил сброс пароля вашей учётной записи CYBERMECH. Откройте ссылку и задайте новый пароль. Ссылка действует {min} минут и работает только один раз:',
    ignore: 'Если это были не вы, просто проигнорируйте письмо: пароль не изменится, а ссылка истечёт сама.',
    rodape: 'Письмо отправлено, потому что кто-то ввёл этот адрес в «Забыли пароль» на CYBERMECH.',
  },
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function emailDeRedefinicao(lang: IdiomaEmail, link: string): { assunto: string; texto: string; html: string } {
  const t = T[lang];
  const corpo = t.corpo.replace('{min}', String(REDEFINIR_VALE_MIN));
  return {
    assunto: t.assunto,
    texto: `${t.oi}\n\n${corpo}\n\n${link}\n\n${t.ignore}\n\n--\n${t.rodape}\n`,
    html: `<p>${esc(t.oi)}</p><p>${esc(corpo)}</p><p><a href="${esc(link)}">${esc(link)}</a></p><p>${esc(t.ignore)}</p><hr><p style="color:#777;font-size:12px">${esc(t.rodape)}</p>`,
  };
}
