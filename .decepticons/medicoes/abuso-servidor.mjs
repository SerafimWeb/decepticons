import { mkdirSync, rmSync } from 'node:fs';
import net from 'node:net';
import { resolve } from 'node:path';
import { runnerImport } from 'vite';

// Uso: node .decepticons/medicoes/abuso-servidor.mjs  (da raiz do projeto; sobe um servidor de teste na porta 2597 com dados em .tmp/fuzz-dados e o derruba no fim).
// Abuso contra um servidor de verdade (auditoria de segurança P194): requisições HTTP malformadas e frames de WebSocket lixo. O servidor tem de SOBREVIVER (responder /status depois) e nunca vazar erro interno.
const dados = resolve('.tmp/fuzz-dados');
rmSync(dados, { recursive: true, force: true });
mkdirSync(dados, { recursive: true });
const { startServer } = (await runnerImport(resolve('server/Server.ts'), { configFile: false, logLevel: 'warn' })).module;
const { WebSocket } = await import('ws');
const linhasDoLog = [];
const s = await startServer({ port: 2597, host: '127.0.0.1', dbContas: resolve(dados, 'contas.db'), dirDados: dados, metricasToken: 'token-fuzz-metricas-123456', guard: { perIp: 1000, total: 2000, msgs: 60, burst: 120 }, limiteLogin: { teto: 100000 }, log: (l) => linhasDoLog.push(l) });
const base = 'http://127.0.0.1:2597';
let queda = false;
process.on('uncaughtException', (e) => { queda = true; console.log('!! uncaughtException:', e.message); });
process.on('unhandledRejection', (e) => { queda = true; console.log('!! unhandledRejection:', e); });

const rotas = ['/', '/status', '/eventos/resumo', '/evento', '/partida-metricas', '/metricas', '/config', '/admin/config', '/admin/estado', '/admin/reiniciar', '/conta/criar', '/conta/entrar', '/conta/sair', '/conta/eu', '/conta/progresso', '/conta/dados', '/conta/apagar', '/conta/medicao', '/nao-existe', '/%00', '/..%2f..%2fetc%2fpasswd', '/config?chave=' + 'a'.repeat(5000), '/%E0%A4%A', '/' + 'x'.repeat(20000)];
const metodos = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS', 'PATCH'];
const corpos = ['', '{', '{}', '[]', 'null', '"x"', '{"email":1,"senha":[]}', '{"nome":"boot_ok","aba":"x"}', 'x'.repeat(100000), '\u0000\u0001\u0002', JSON.stringify({ chave: 'a'.repeat(100000), valor: 'b' })];
let pedidos = 0;
let respostas5xx = 0;
let vazamentos = 0;
const cabecalhosHostis = [{}, { 'x-cybermech-sessao': 'x'.repeat(5000) }, { 'x-cybermech-sessao': '\u00e9\u00e9' }.constructor === Object ? { 'x-cybermech-metricas': 'a' } : {}, { origin: 'https://evil.example' }, { 'content-type': 'application/json', 'content-length': '999999' }, { 'cf-connecting-ip': 'nao-sou-ip', 'cf-ipcountry': '<script>' }, { 'content-type': 'text/plain; charset=utf-7' }];
for (const rota of rotas) {
  for (const metodo of metodos) {
    for (const corpo of corpos.slice(0, metodo === 'GET' || metodo === 'HEAD' ? 1 : corpos.length)) {
      const h = cabecalhosHostis[pedidos % cabecalhosHostis.length];
      try {
        const r = await fetch(base + rota, { method: metodo, body: ['GET', 'HEAD'].includes(metodo) || corpo === '' ? undefined : corpo, headers: { 'content-type': 'application/json', ...h }, signal: AbortSignal.timeout(4000) });
        pedidos++;
        if (r.status >= 500) respostas5xx++;
        const t = await r.text().catch(() => '');
        if (/at .*\.(ts|js):\d+|node_modules|C:\\|D:\\|stack/i.test(t)) { vazamentos++; console.log('vazamento em', metodo, rota, t.slice(0, 120)); }
      } catch {
        pedidos++; // pedido recusado/cortado pelo servidor ou pela própria biblioteca: tudo bem
      }
    }
  }
}
// Pedidos crus e quebrados direto no socket (cabeçalho sem fim, método inventado, content-length mentiroso, corpo menor que o anunciado).
const crus = [
  'GET / HTTP/1.1\r\nHost: x\r\n',
  'XYZZY /status HTTP/1.1\r\nHost: x\r\n\r\n',
  'POST /conta/entrar HTTP/1.1\r\nHost: x\r\nContent-Length: 500\r\n\r\n{"email":"a@b.c"',
  'POST /evento HTTP/1.1\r\nHost: x\r\nContent-Length: -5\r\n\r\n',
  'GET /' + 'a'.repeat(70000) + ' HTTP/1.1\r\nHost: x\r\n\r\n',
  'GET /status HTTP/1.1\r\n' + 'X-Lixo: y\r\n'.repeat(5000) + '\r\n',
  '\u0000\u0001\u0002\u0003',
  'POST /conta/criar HTTP/1.1\r\nHost: x\r\nTransfer-Encoding: chunked\r\n\r\nZZZ\r\n',
];
for (const cru of crus) {
  await new Promise((ok) => {
    const sock = net.connect(2597, '127.0.0.1', () => sock.write(cru));
    sock.on('error', () => ok());
    sock.on('close', () => ok());
    setTimeout(() => { sock.destroy(); ok(); }, 800);
  });
}
// WebSocket: frames lixo, grande demais, protocolo errado, sala inventada, nome gigante.
const ws = (url, enviar, ms = 400) => new Promise((ok) => {
  let w;
  try { w = new WebSocket(url, { headers: { origin: 'http://localhost:5173' } }); } catch { return ok(); }
  w.on('open', () => { try { enviar(w); } catch {} });
  w.on('error', () => {});
  w.on('close', () => ok());
  setTimeout(() => { try { w.terminate(); } catch {} ok(); }, ms);
});
await ws(`ws://127.0.0.1:2597/?sala=ARENA`, (w) => w.send(Buffer.from([0xff, 0xfe, 0x00, 0x01])));
await ws(`ws://127.0.0.1:2597/?sala=ARENA`, (w) => w.send(Buffer.alloc(200000, 1)));
await ws(`ws://127.0.0.1:2597/?sala=${'A'.repeat(5000)}`, (w) => w.send('texto em vez de binário'));
await ws(`ws://127.0.0.1:2597/?sala=%00%01`, (w) => w.send(Buffer.alloc(10)));
await ws(`ws://127.0.0.1:2597/?mural=1`, (w) => w.send(Buffer.alloc(10)));
await ws(`ws://127.0.0.1:2597/?sala=ARENA`, (w) => { for (let i = 0; i < 400; i++) w.send(Buffer.from([1, 2, 3])); }, 800);
await new Promise((ok) => {
  const w = new WebSocket('ws://127.0.0.1:2597/?sala=ARENA', { headers: { origin: 'https://evil.example' } });
  w.on('open', () => { console.log('!! o WebSocket aceitou origem de fora'); queda = true; w.close(); ok(); });
  w.on('error', () => ok());
  w.on('unexpected-response', () => ok());
  setTimeout(ok, 800);
});

// O servidor está de pé?
const status = await fetch(base + '/status', { signal: AbortSignal.timeout(4000) }).then((r) => r.status).catch(() => 0);
console.log(JSON.stringify({ pedidos, respostas5xx, vazamentos, statusDepois: status, queda, linhasDoLog: linhasDoLog.length }));
await s.close();
rmSync(dados, { recursive: true, force: true });
process.exit(status === 200 && !queda && !vazamentos ? 0 : 1);
