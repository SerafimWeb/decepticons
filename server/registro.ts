/**
 * O registro técnico do servidor (P192, LGPD): o que o servidor conta de si mesmo (salas, conexões, recusas, avisos), **um arquivo por dia** (`registro/servidor-AAAA-MM-DD.log`, dia de Brasília)
 * e **apagado sozinho depois de 30 dias**.
 *
 * **Por que não o `servidor.log`:** esse é o arquivo para onde a tarefa do Windows redireciona a saída do processo (`cmd /c ... >> servidor.log`); enquanto o servidor roda, o Windows não deixa
 * ninguém renomear, esvaziar ou apagar um arquivo que um redirecionamento mantém aberto (medido em 18/10: EBUSY nas três operações). Um registro que o próprio servidor abre, escreve e fecha a
 * cada linha não tem esse problema: dá para apagar os dias velhos sem parar nada. O `servidor.log` passa a receber só o que o Node escreve sozinho (aviso de módulo experimental, queda com erro).
 *
 * O que entra aqui já não leva e-mail nem IP inteiro (`ipParaLog` em `guard.ts`). Falha de disco nunca derruba o servidor: a linha se perde e a vida segue.
 */
import { appendFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { diaDe } from './telemetria';

export const REGISTRO_PASTA = 'registro';
/** Quantos dias o registro guarda. O texto da política de privacidade diz o mesmo número. */
export const REGISTRO_DIAS = 30;
const NOME = /^servidor-(\d{4}-\d{2}-\d{2})\.log$/;

export const arquivoDoRegistro = (dia: string): string => `servidor-${dia}.log`;

/** Os arquivos do registro que existem em `pasta`, do mais velho ao mais novo (só os que têm o nome do registro: o resto da pasta ninguém toca). */
export function arquivosDoRegistro(pasta: string): string[] {
  try {
    return readdirSync(pasta)
      .filter((n) => NOME.test(n))
      .sort();
  } catch {
    return [];
  }
}

/** Soma `n` dias a um AAAA-MM-DD (calendário, sem fuso: o dia já é o de Brasília). */
function diaMenos(dia: string, n: number): string {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export class Registro {
  private pronta = false;

  constructor(
    readonly pasta: string,
    private readonly agora: () => number = Date.now,
  ) {}

  /** Acrescenta uma linha ao arquivo de hoje, com a hora do relógio do PC (o servidor está no fuso do dono). Nunca lança. */
  escrever(linha: string): void {
    try {
      if (!this.pronta) {
        mkdirSync(this.pasta, { recursive: true });
        this.pronta = true;
      }
      const agora = new Date(this.agora());
      const dois = (n: number) => String(n).padStart(2, '0');
      appendFileSync(join(this.pasta, arquivoDoRegistro(diaDe(agora.getTime()))), `${dois(agora.getHours())}:${dois(agora.getMinutes())}:${dois(agora.getSeconds())} ${linha}\n`);
    } catch {
      this.pronta = false; // a pasta pode ter sumido: tenta criá-la de novo na próxima
    }
  }

  /** Apaga os dias com mais de `REGISTRO_DIAS` (pelo dia do nome do arquivo, não pela data de gravação). Devolve o que apagou. Nunca lança. */
  podar(): string[] {
    const limite = diaMenos(diaDe(this.agora()), REGISTRO_DIAS);
    const apagados: string[] = [];
    for (const nome of arquivosDoRegistro(this.pasta)) {
      const dia = NOME.exec(nome)![1]!;
      if (dia >= limite) continue;
      try {
        unlinkSync(join(this.pasta, nome));
        apagados.push(nome);
      } catch {
        // em uso ou sem permissão: fica para a próxima poda
      }
    }
    return apagados;
  }
}
