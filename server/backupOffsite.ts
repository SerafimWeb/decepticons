/**
 * A cópia da cópia, fora do disco do PC do servidor (`AUDITORIA_SEGURANCA.md`, achado A13: hoje o backup de 14 dias
 * fica no mesmo disco do banco — disco morto, ransomware ou apagão no PC perde as contas de todos sem volta).
 *
 * **Desligado por padrão.** Sem `.tmp/servidor/backup-remoto.json`, `configurar()` devolve `null` e o `Server.ts` nem
 * chama o resto: o servidor segue exatamente como antes. O dono liga criando esse arquivo (`DEPLOY.md`, "Backup fora
 * do disco"), reaproveitando a mesma conta SSH da Hostinger que já publica o site (`deploy-site.json`), só que numa
 * pasta **fora** de qualquer `public_html` — `caminhoRemotoSeguro` recusa o caminho se ela aparecer, e recusa
 * qualquer caractere que o shell remoto pudesse interpretar (G7: nunca confiar em texto de configuração para montar
 * um comando).
 *
 * **Cifra antes de sair do PC** (AES-256-GCM; a chave vem de uma frase-secreta só do dono, nunca da chave SSH): o
 * arquivo que chega ao servidor remoto não se lê sem a frase, mesmo que alguém tenha acesso à pasta. Sal e IV
 * aleatórios por arquivo, guardados junto do cifrado (`sal(16) || iv(12) || tag(16) || cifrado`); decifrar é a
 * função inversa, para restaurar (`DEPLOY.md`).
 *
 * **Nunca derruba o servidor** (G3: módulo independente, só o `Server` o chama, e só depois de uma cópia local que já
 * deu certo): qualquer falha no envio — rede fora, SSH recusado, pasta remota errada — só vai para o log; a cópia
 * local (`backupContas.ts`) já aconteceu e é o que protege de arquivo corrompido. Envio por `scp`/`ssh` (os mesmos
 * binários que `scripts/publicar-site.mjs` já usa para o site: nenhuma biblioteca nova).
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { execFile } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const BACKUP_REMOTO_ARQUIVO = 'backup-remoto.json';

export interface BackupRemotoConfig {
  host: string;
  port?: number;
  user: string;
  /** Caminho da chave privada SSH no PC do servidor (a mesma do deploy, se o dono copiar o valor). */
  key: string;
  /** Pasta no servidor remoto para os backups cifrados — nunca sob `public_html` (`caminhoRemotoSeguro`). */
  path: string;
  /** Frase-secreta que cifra os backups. Perdeu a frase, perdeu a cópia: ela não vai para lugar nenhum além deste arquivo. */
  chave: string;
  /** Quantas cópias remotas ficam (padrão 14, como a cópia local). */
  guardar?: number;
}

const SAL_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** Só caminho absoluto, sem `..`, sem caractere que o shell remoto possa interpretar, e nunca dentro de um `public_html` (onde o site publicado o serviria para qualquer um). */
export function caminhoRemotoSeguro(caminho: string): boolean {
  const c = caminho.trim();
  if (!c || c.includes('..')) return false;
  if (/["'$`\\;&|<>(){}*?~\s]/.test(c)) return false;
  if (c.toLowerCase().includes('public_html')) return false;
  return /^\/[a-zA-Z0-9_\-./]+$/.test(c);
}

/** AES-256-GCM com a chave derivada por `scrypt` da frase-secreta; sal e IV novos a cada chamada (nunca reaproveitados). */
export function cifrar(dados: Buffer, fraseSecreta: string): Buffer {
  const sal = randomBytes(SAL_BYTES);
  const iv = randomBytes(IV_BYTES);
  const chave = scryptSync(fraseSecreta, sal, 32);
  const c = createCipheriv('aes-256-gcm', chave, iv);
  const corpo = Buffer.concat([c.update(dados), c.final()]);
  return Buffer.concat([sal, iv, c.getAuthTag(), corpo]);
}

/** A função inversa de `cifrar` (para restaurar, `DEPLOY.md`). Frase errada ou arquivo adulterado lança (a tag do GCM não confere). */
export function decifrar(pacote: Buffer, fraseSecreta: string): Buffer {
  const sal = pacote.subarray(0, SAL_BYTES);
  const iv = pacote.subarray(SAL_BYTES, SAL_BYTES + IV_BYTES);
  const tag = pacote.subarray(SAL_BYTES + IV_BYTES, SAL_BYTES + IV_BYTES + TAG_BYTES);
  const corpo = pacote.subarray(SAL_BYTES + IV_BYTES + TAG_BYTES);
  const chave = scryptSync(fraseSecreta, sal, 32);
  const d = createDecipheriv('aes-256-gcm', chave, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(corpo), d.final()]);
}

/** Lê `backup-remoto.json` da pasta de dados. `null` = o recurso está desligado (arquivo ausente, ilegível, ou caminho remoto inseguro — e avisa por quê). */
export function configurar(dirDados: string, anotar: (linha: string) => void = () => {}): BackupRemotoConfig | null {
  const arquivo = join(dirDados, BACKUP_REMOTO_ARQUIVO);
  if (!existsSync(arquivo)) return null;
  try {
    const j = JSON.parse(readFileSync(arquivo, 'utf8')) as Partial<BackupRemotoConfig>;
    if (typeof j.host !== 'string' || typeof j.user !== 'string' || typeof j.key !== 'string' || typeof j.path !== 'string' || typeof j.chave !== 'string' || !j.host || !j.user || !j.key || !j.chave) {
      anotar('backup fora do disco: backup-remoto.json incompleto (precisa de host, user, key, path e chave)');
      return null;
    }
    if (!caminhoRemotoSeguro(j.path)) {
      anotar(`backup fora do disco: caminho remoto recusado ("${j.path}" — não pode estar sob public_html nem ter caractere especial)`);
      return null;
    }
    return { host: j.host, port: j.port, user: j.user, key: j.key, path: j.path, chave: j.chave, guardar: j.guardar };
  } catch {
    anotar('backup fora do disco: backup-remoto.json ilegível (JSON inválido)');
    return null;
  }
}

/** O que executa um comando externo (injetável para o teste nunca chamar `ssh`/`scp` de verdade). */
export type Executor = (cmd: string, args: readonly string[]) => Promise<void>;

export const execFileAsync: Executor = (cmd, args) =>
  new Promise((ok, erro) => {
    execFile(cmd, args as string[], { timeout: 60_000 }, (e) => (e ? erro(e) : ok()));
  });

/** Cifra o backup local e sobe por `scp` para a pasta remota; depois pede, por `ssh`, para apagar as cópias remotas além de `guardar`. Lança se algo falhar — quem chama (`Server.ts`) só registra, nunca deixa o jogo cair por isto. */
export async function enviarBackupOffsite(caminhoLocal: string, nomeArquivo: string, cfg: BackupRemotoConfig, exec: Executor = execFileAsync): Promise<void> {
  if (!caminhoRemotoSeguro(cfg.path)) throw new Error(`caminho remoto inseguro: ${cfg.path}`);
  const dados = readFileSync(caminhoLocal);
  const cifrado = cifrar(dados, cfg.chave);
  const tmp = `${caminhoLocal}.enc`;
  writeFileSync(tmp, cifrado);
  const porta = String(cfg.port ?? 22);
  try {
    await exec('scp', ['-P', porta, '-i', cfg.key, '-o', 'StrictHostKeyChecking=accept-new', '-o', 'BatchMode=yes', tmp, `${cfg.user}@${cfg.host}:${cfg.path}/${nomeArquivo}.enc`]);
    const guardar = Math.max(1, cfg.guardar ?? 14);
    // `ls -t` (mais novo primeiro) + `tail -n +N+1` (o que passa do limite) + `xargs -r rm --`: sem rm se não houver nada (evita "rm: faltando operando").
    const comando = `cd '${cfg.path}' && ls -t contas-*.db.enc 2>/dev/null | tail -n +${guardar + 1} | xargs -r rm --`;
    await exec('ssh', ['-p', porta, '-i', cfg.key, '-o', 'BatchMode=yes', `${cfg.user}@${cfg.host}`, comando]);
  } finally {
    rmSync(tmp, { force: true });
  }
}
