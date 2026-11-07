import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * As peças do Blender (a Prova Blender, P329; `MODELADOR.md` § 10): roda o Blender SEM janela (`-b --factory-startup`) com o script `scripts/blender/kit-gaviao.py` e grava o peito, a ombreira e o
 * capacete do Gavião-H3 em `.decepticons/pecas/*.glb` (a aba MECHS 3D os lê dali: botão "DO BLENDER"). Fotos de conferência do Workbench em `.tmp/blender/fotos/`.
 *
 *   npm run mech:pecas                      # as três peças
 *   npm run mech:pecas -- --parte ombreira  # só uma (ombreira, capacete ou peito)
 *
 * O Blender é achado em `D:\blender\blender.exe` (ou na variável `BLENDER`). Sempre caminho ABSOLUTO (o Blender resolve caminho relativo a partir da raiz do drive: G15), e o TEMP vai para
 * `.tmp/` (o addon do Tripo, se carregasse, escreveria o log dele no TEMP; `--factory-startup` já o deixa de fora).
 */
const BLENDER = process.env.BLENDER ?? 'D:\\blender\\blender.exe';
if (!existsSync(BLENDER)) {
  console.error(`Blender não encontrado em ${BLENDER} (defina a variável BLENDER com o caminho do blender.exe)`);
  process.exit(2);
}
const TMP = resolve('.tmp', 'blender');
mkdirSync(TMP, { recursive: true });
const saida = resolve('.decepticons', 'pecas');
const fotos = resolve(TMP, 'fotos');
const script = resolve('scripts', 'blender', 'kit-gaviao.py');
const r = spawnSync(BLENDER, ['-b', '--factory-startup', '-P', script, '--', '--saida', saida, '--fotos', fotos, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, TEMP: TMP, TMP, TMPDIR: TMP },
});
process.exit(r.status ?? 1);
