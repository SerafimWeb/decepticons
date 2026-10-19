/**
 * Política de Privacidade (/privacidade/), P192: o que o CYBERMECH guarda de quem joga, para quê, por quanto tempo e como a pessoa exerce os direitos da LGPD.
 *
 * **Fonte única do texto.** O inventário de fatos que sustenta cada linha está em `.decepticons/PRIVACIDADE.md`; quando o código passar a guardar algo novo, o texto muda **aqui**,
 * a `POLITICA_VERSAO` (`shared/net/auth.ts`) muda junto, e o inventário também. A conta guarda a versão que a pessoa aceitou ao criá-la.
 *
 * O contato do encarregado vem da variável `CYBERMECH_CONTATO_PRIVACIDADE` ou do arquivo `.decepticons/contato-privacidade.txt` (um e-mail) na hora de montar o site: sem ela a página diz o que é verdade (os botões do jogo resolvem acesso, portabilidade,
 * apagamento e oposição sem e-mail nenhum) e que o contato será divulgado ali. **Nada de e-mail inventado numa política.**
 *
 * Uso: node scripts/privacidade.mjs --out <.tmp/site/privacidade/index.html>
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { esc, inline, pagina, topo } from './site/tema.mjs';

const argv = process.argv.slice(2);
const OUT = resolve(argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : '.tmp/site/privacidade/index.html');

const { runnerImport } = await import('vite');
const load = async (p) => (await runnerImport(resolve(p), { configFile: false, logLevel: 'silent' })).module;
const { POLITICA_VERSAO } = await load('shared/net/auth.ts');

/** O e-mail do encarregado: a variável de ambiente ou, sem ela, a primeira linha de `.decepticons/contato-privacidade.txt` (um e-mail e nada mais; o arquivo só existe quando o dono o cria). */
const ARQUIVO_CONTATO = resolve('.decepticons', 'contato-privacidade.txt');
const CONTATO = (process.env.CYBERMECH_CONTATO_PRIVACIDADE ?? (existsSync(ARQUIVO_CONTATO) ? readFileSync(ARQUIVO_CONTATO, 'utf8').split(/\r?\n/)[0] : '') ?? '').trim();
const CONTATO_VALIDO = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(CONTATO);
const [ano, mes, dia] = POLITICA_VERSAO.split('-');

const css = `
  .pol { display: grid; gap: 40px; max-width: 80ch; padding-top: 30px; }
  .pol h1 { font: 400 clamp(2.4rem, 6vw, 4.2rem)/.95 var(--fs); letter-spacing: .04em; color: var(--amber); margin: 0 0 8px; text-transform: uppercase; }
  .pol h2 { font-size: clamp(1.5rem, 3vw, 2rem); }
  .pol section { gap: 12px; }
  .pol p, .pol li { text-wrap: pretty; }
  .pol ul { margin: 0; padding-left: 20px; display: grid; gap: 6px; }
  .pol .quadro { border: 1px solid var(--line); background: var(--panel); padding: 16px 18px; display: grid; gap: 8px; }
  .pol .quadro h2 { font-size: 1.3rem; }
  .pol .versao { color: var(--muted); font-size: 13px; letter-spacing: .1em; text-transform: uppercase; }
  .rolavel { overflow-x: auto; }
  .pol table { width: 100%; border-collapse: collapse; font-size: 14px; }
  .pol th, .pol td { text-align: left; vertical-align: top; padding: 9px 10px; border-bottom: 1px solid var(--line); }
  .pol th { font-weight: 400; font-size: 11px; letter-spacing: .14em; color: var(--muted); text-transform: uppercase; white-space: nowrap; }
  .pol td:first-child { color: var(--bone); min-width: 150px; }
  .pol a { color: var(--amber); }
`;

const linhas = (itens) => itens.map((l) => `<tr>${l.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('\n');
const lista = (itens) => `<ul>${itens.map((i) => `<li>${inline(i)}</li>`).join('')}</ul>`;

const contato = CONTATO_VALIDO
  ? `<p>Para qualquer pedido sobre os seus dados que os botões do jogo não resolvam, escreva para <a href="mailto:${esc(CONTATO)}">${esc(CONTATO)}</a> (canal do encarregado pelo tratamento de dados).</p>`
  : `<p>Acesso, cópia, apagamento e oposição à medição você resolve <b>sozinho, dentro do jogo</b> (Configurações → Conta → Meus dados), sem e-mail nem espera. O canal do encarregado pelo tratamento de dados para os outros pedidos será divulgado nesta página.</p>`;

const body = `
  ${topo({ base: '../', current: 'privacidade', left: 'CYBERMECH // PRIVACIDADE' })}
  <main class="pol">
    <header>
      <h1>Política de Privacidade</h1>
      <p class="versao">Versão ${esc(POLITICA_VERSAO)} · em vigor desde ${esc(dia)}/${esc(mes)}/${esc(ano)}</p>
    </header>

    <section class="quadro" aria-labelledby="h-resumo">
      <h2 id="h-resumo">Em poucas palavras</h2>
      ${lista([
        '**Sem conta, o jogo não sabe quem você é.** O seu progresso fica no seu navegador; o servidor só soma números (quantas partidas, quantos minutos) sem ligar nada a uma pessoa.',
        '**Com conta**, guardamos o seu e-mail, a sua senha (embaralhada, nunca em texto), o seu progresso e **quando e quanto você joga**, para o jogo funcionar em outro aparelho e para entendermos como melhorá-lo.',
        '**Você manda nos seus dados:** baixa tudo, apaga a conta, ou desliga o registro da sua atividade, direto no jogo e na hora.',
        '**Não vendemos dados e não há publicidade.** O Google Analytics do site só liga se você aceitar.',
        '**O endereço IP não é guardado.** Ele existe só na memória do servidor enquanto você está conectado, e nos registros técnicos aparece cortado (o último trecho é mascarado).',
      ])}
    </section>

    <section aria-labelledby="h-quem">
      <h2 id="h-quem">1. Quem trata os seus dados</h2>
      <p>O CYBERMECH é um jogo de navegador independente, desenvolvido e operado por <b>uma pessoa física</b> (a “gente” nesta política; não há empresa nem CNPJ por ora), controladora dos dados descritos aqui, nos termos da Lei Geral de Proteção de Dados (Lei 13.709/2018, a LGPD).</p>
      ${contato}
    </section>

    <section aria-labelledby="h-dados">
      <h2 id="h-dados">2. O que guardamos, para quê e por quanto tempo</h2>
      <div class="rolavel">
        <table>
          <thead><tr><th>Quando</th><th>O que</th><th>Para quê (base legal)</th><th>Por quanto tempo</th></tr></thead>
          <tbody>
            ${linhas([
              ['Você joga, com ou sem conta (no seu aparelho)', 'Apelido, nível, créditos, montagem do robô, configurações e as últimas rodadas; **uma data** (o dia da sua primeira visita, para o jogo saber se você é novo ou voltou) e, enquanto a aba está aberta, **de onde você chegou**. Ficam no armazenamento do navegador (`localStorage` e `sessionStorage`).', 'Fazer o jogo funcionar (execução do serviço).', 'Até você limpar os dados do site no navegador. Não saem do aparelho.'],
              ['Você joga, com ou sem conta (no servidor)', '**Somas sem identificação:** quantas visitas, cliques e partidas por dia e por país; totais de rodadas (minutos, abates, mortes, onda alcançada, duração e qualidade gráfica ao terminar) por mapa, modo e dia; e **de onde a visita veio** (digitou o endereço, busca, rede social, outro site, link marcado) e o **nome do site** de origem, o tipo de aparelho (celular, tablet ou computador), o navegador, o sistema, o idioma, se é a primeira visita ou há quantos dias foi, e o estado do Brasil.', 'Saber se o jogo funciona e onde melhorar (legítimo interesse). São números agregados: não apontam para você.', 'Contagens por dia por 120 dias; totais de rodadas sem prazo (são só somas).'],
              ['Você joga online', 'O apelido e a montagem do robô, enquanto você está na sala.', 'Mostrar você aos outros jogadores (execução do serviço).', 'Só na memória do servidor, até você sair.'],
              ['Você cria uma conta', '**E-mail**, senha (guardada com `scrypt` e sal, nunca em texto), data de criação, a versão da política que você aceitou e quando, o progresso do piloto, e as sessões abertas (o servidor guarda só o resumo `SHA-256` do código da sessão).', 'Ter conta e levar o progresso para outro aparelho (execução do contrato); prova do seu aceite.', 'Até você apagar a conta. A sessão vence em 30 dias.'],
              ['Você pede “Esqueci a senha”', 'O **e-mail** que você digitou e um **link de uso único** (guardamos só a impressão digital dele, nunca o link). O registro de segurança anota que o pedido foi feito, com o número da conta e sem o e-mail.', 'Devolver o acesso à sua conta (execução do serviço).', 'O link vale **30 minutos** e some ao ser usado; o registro de segurança, 400 dias.'],
              ['Você joga com conta', '**A sua atividade:** em que dias abriu o jogo, quantas rodadas, quantos segundos, abates e mortes por dia (sem o conteúdo das rodadas).', 'Saber quantos jogadores voltam e por quanto tempo jogam, para melhorar o jogo (legítimo interesse). **Você pode se opor** e desligar isto quando quiser.', 'Até 400 dias; desligar apaga o que já foi registrado.'],
              ['Você visita o site (landing, oficina)', '**Google Analytics:** cookies de medição, páginas vistas, origem do clique, cidade aproximada e tipo de aparelho, tratados pelo Google.', 'Entender quem chega ao site (**só com o seu consentimento**, na faixa de cookies).', 'Conforme a configuração do Google Analytics (no máximo 14 meses). Recusar ou mudar de ideia apaga os cookies.'],
              ['O servidor se protege', 'O **IP** fica só na memória (para limitar conexões e conter abusos) e some quando a conexão fecha. Os registros técnicos guardam eventos de segurança com o IP **mascarado** (`212.8.252.x`) e nunca o e-mail.', 'Manter o servidor no ar e impedir abuso (legítimo interesse em segurança).', 'Os registros técnicos são apagados sozinhos depois de 30 dias.'],
              ['Cópias de segurança', 'Uma cópia do banco de contas a cada poucas horas, para o caso de falha do computador.', 'Não perder a sua conta (execução do serviço).', 'As 14 cópias mais recentes. **Apagar a conta tira você das cópias em até 14 dias.**'],
              ['Algo quebra no seu navegador', 'A mensagem e a pilha do erro, a versão do jogo e o contexto (e-mails e o que vem depois do `?` ou `#` dos endereços são removidos antes de enviar), para o nosso sistema de erros (Serafim13).', 'Corrigir defeitos (legítimo interesse).', 'Pelo tempo de investigação do defeito.'],
            ])}
          </tbody>
        </table>
      </div>
      <p><b>Não pedimos</b> nome, CPF, telefone, localização exata nem dados de pagamento. Não há compra dentro do jogo. Não fazemos decisões automatizadas que afetem você nem perfis para publicidade.</p>
    </section>

    <section aria-labelledby="h-armazenamento">
      <h2 id="h-armazenamento">3. Cookies e armazenamento no navegador</h2>
      ${lista([
        '**Cookies:** só os do **Google Analytics** (`_ga` e `_ga_*`), e só se você aceitar na faixa do site. O jogo não grava cookies.',
        '**Armazenamento do navegador (`localStorage`):** o progresso, as configurações, o idioma, o código da sua sessão (se tiver conta), a sua escolha sobre cookies e **a data da sua primeira visita**. Servem para o jogo funcionar e ficam só no seu aparelho; **a data nunca é enviada**, só a faixa que ela produz (“novo”, “voltou há 2 a 7 dias”). Na aba (`sessionStorage`) fica de onde você chegou, e some quando a aba fecha.',
        '**O que medimos de cada visita é uma categoria, nunca uma pessoa:** “celular”, “Chrome”, “Windows”, “português”, “veio de uma rede social”. Do endereço de onde você veio guardamos só o nome do site (`instagram.com`), nunca o caminho nem a busca. O estado do Brasil vem da Cloudflare, a partir do endereço IP, e o endereço não é guardado.',
        'A escolha sobre cookies vale no site e no jogo. Para mudar, use “Preferências de cookies” no rodapé do site.',
      ])}
    </section>

    <section aria-labelledby="h-compartilha">
      <h2 id="h-compartilha">4. Com quem compartilhamos</h2>
      <p>Não vendemos nem cedemos dados para publicidade. Usamos prestadores que tratam dados em nosso nome, só para o serviço funcionar:</p>
      ${lista([
        '**Cloudflare:** protege e entrega o site e leva a conexão do jogo até o servidor. Por ser o intermediário, enxerga o endereço IP de quem conecta; o servidor lê dele só o país.',
        '**Hospedagem do site (Hostinger):** guarda as páginas e os arquivos do jogo; não recebe o seu progresso nem a sua conta.',
        '**Google Analytics:** só se você aceitar os cookies do site.',
        '**Resend (envio de e-mail):** só quando você pede “Esqueci a senha”: recebe o seu e-mail e o texto da mensagem para entregá-la, e guarda o registro de entrega pelo prazo dele.',
        '**Serafim13 (sistema de erros):** recebe os relatórios de defeito descritos acima.',
      ])}
      <p>Cloudflare, Google e Resend podem tratar dados fora do Brasil (por exemplo, nos Estados Unidos). Essas transferências seguem a LGPD (art. 33) e os termos de proteção de dados que esses prestadores oferecem.</p>
    </section>

    <section aria-labelledby="h-direitos">
      <h2 id="h-direitos">5. Os seus direitos (LGPD, art. 18) e como exercê-los</h2>
      ${lista([
        '**Saber o que guardamos e receber uma cópia** (confirmação, acesso e portabilidade): no jogo, Configurações → Conta → **Baixar meus dados**. Você recebe um arquivo com tudo o que o servidor guarda da sua conta.',
        '**Apagar:** Configurações → Conta → **Apagar minha conta** (pede a senha de novo). Some tudo da conta: o e-mail, o progresso, a atividade e as sessões. Não se desfaz. As cópias de segurança esquecem a conta em até 14 dias.',
        '**Se opor à medição da atividade:** Configurações → Conta → desmarque **Registrar minha atividade**. Apaga o que já foi registrado e para de registrar.',
        '**Corrigir:** o apelido, a montagem e o progresso você ajusta no próprio jogo e eles vão para a conta.',
        '**Retirar o consentimento:** dos cookies, em “Preferências de cookies” no rodapé; da conta, apagando-a.',
        '**Saber com quem compartilhamos:** a seção 4 desta política.',
        '**Reclamar à autoridade:** você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD), em gov.br/anpd.',
      ])}
      ${contato}
    </section>

    <section aria-labelledby="h-menores">
      <h2 id="h-menores">6. Crianças e adolescentes</h2>
      <p>O CYBERMECH não é dirigido a crianças (menores de 12 anos). Para <b>criar uma conta</b>, a pessoa declara ter 18 anos ou mais, ou ter a autorização de um responsável. <b>Jogar sem conta</b> não coleta dados pessoais. Se você é responsável por um menor que criou conta sem autorização, apague a conta no jogo ou fale com o canal do encarregado.</p>
    </section>

    <section aria-labelledby="h-seguranca">
      <h2 id="h-seguranca">7. Segurança</h2>
      <p>A senha é guardada embaralhada (scrypt com sal por conta) e as sessões, só pelo resumo do código. As conexões passam por HTTPS. O servidor limita tentativas de senha e de conexão para barrar abuso. Nenhum sistema é inviolável: se houver um incidente que possa causar risco relevante a você, avisamos você e a ANPD, como a LGPD exige.</p>
    </section>

    <section aria-labelledby="h-mudancas">
      <h2 id="h-mudancas">8. Mudanças nesta política</h2>
      <p>Quando mudarmos o que guardamos ou para quê, esta página muda, a versão e a data mudam junto, e quem for criar uma conta aceita a versão nova. A sua conta guarda a versão que você aceitou e quando. Mudanças que afetem contas já existentes serão avisadas no jogo.</p>
      <p class="versao">Versão atual: ${esc(POLITICA_VERSAO)} (primeira versão).</p>
    </section>
  </main>
`;

const html = pagina({
  title: 'Política de Privacidade · CYBERMECH',
  description: 'O que o CYBERMECH guarda de quem joga, para quê, por quanto tempo e como exercer os seus direitos da LGPD: baixar os dados, apagar a conta, desligar a medição.',
  css,
  body,
  anticopia: false,
});
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
console.log(`privacidade ${OUT} (versão ${POLITICA_VERSAO}, contato ${CONTATO_VALIDO ? 'configurado' : 'não configurado: a página usa os botões do jogo'})`);
