/**
 * A cópia de segurança do banco de contas (`contas.db`). O banco é um arquivo só, no PC do servidor (`pastaDados`), fora do git: sem cópia, um arquivo corrompido ou apagado por engano leva
 * as contas e o progresso de todos os pilotos. Uma cópia **consistente** (o `VACUUM INTO` do SQLite, que não pega o banco no meio de uma escrita) por dia, na pasta `backups/` da própria pasta
 * de dados, guardando as últimas `GUARDAR` (a mais antiga sai). Vale G15: nada fora da pasta do projeto, então isto protege de arquivo corrompido ou apagado, **não** de o disco do PC morrer:
 * para isso, o dono leva a pasta `backups/` para outro lugar (`.decepticons/DEPLOY.md`, "Contas: onde estão e como restaurar").
 * Módulo independente (G3): só o `Server` o chama. Custo de CPU: uma cópia de arquivo pequeno a cada poucas horas.
 */
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

export const BACKUPS_PASTA = 'backups';
/** Quantos dias de cópia ficam (a mais antiga sai quando entra uma nova). */
export const GUARDAR = 14;

const PADRAO = /^contas-(\d{4}-\d{2}-\d{2})\.db$/;

/** O nome da cópia do dia (data em UTC): uma por dia, e as rodadas seguintes do mesmo dia a substituem pela mais nova. */
export const nomeDoBackup = (agora: Date): string => `contas-${agora.toISOString().slice(0, 10)}.db`;

/** Das cópias que existem, quais apagar para ficarem só as `guardar` mais novas. Só mexe em nomes `contas-AAAA-MM-DD.db`: qualquer outro arquivo da pasta é ignorado. */
export function aposentar(nomes: readonly string[], guardar: number = GUARDAR): string[] {
  const nossos = nomes.filter((n) => PADRAO.test(n)).sort();
  return nossos.slice(0, Math.max(0, nossos.length - guardar));
}

/** O mínimo do banco que a cópia usa (a classe `Contas` o cumpre; o teste entrega um falso). */
export interface CopiavelParaArquivo {
  copiarPara(caminho: string): void;
}

export interface ResultadoDoBackup {
  readonly arquivo: string;
  readonly apagados: readonly string[];
}

/** Faz a cópia do dia em `<pasta>/backups/` e apaga as que passaram do limite. Lança se a cópia falhar (quem chama registra e segue: o jogo não cai por causa disto). */
export function fazerBackup(banco: CopiavelParaArquivo, pastaDeDados: string, agora: Date, guardar: number = GUARDAR): ResultadoDoBackup {
  const pasta = join(pastaDeDados, BACKUPS_PASTA);
  mkdirSync(pasta, { recursive: true });
  const nome = nomeDoBackup(agora);
  const destino = join(pasta, nome);
  rmSync(destino, { force: true }); // o VACUUM INTO não escreve por cima de um arquivo que já existe
  banco.copiarPara(destino);
  const apagados = aposentar(readdirSync(pasta), guardar);
  for (const velho of apagados) rmSync(join(pasta, velho), { force: true });
  return { arquivo: destino, apagados };
}
