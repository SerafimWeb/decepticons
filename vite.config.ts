import { execFileSync } from 'node:child_process';
import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';

/**
 * O código importa `@dimforge/rapier3d-simd-compat` (Wasm em base64, roda direto no
 * Node: servidor e testes). No browser trocamos pelo pacote com `.wasm` separado,
 * que o browser compila em streaming e cacheia à parte (~1 MB gzip a menos no JS).
 * As duas versões ficam fixadas iguais no package.json.
 */
const RAPIER_BROWSER = { find: /^@dimforge\/rapier3d-simd-compat$/, replacement: '@dimforge/rapier3d-simd' };

const revision = (() => {try{return execFileSync('git',['rev-parse','--short=12','HEAD'],{encoding:'utf8'}).trim();}catch{return 'local';}})();
export default defineConfig({
  define: { __CYBERMECH_REVISION__: JSON.stringify(revision) },
  root: 'client',
  // Caminhos relativos: o mesmo build roda na raiz (smoke) e em subpasta (cybermech.online/jogar/).
  base: './',
  plugins: [wasm()],
  resolve: { alias: [RAPIER_BROWSER] },
  // O pre-bundle do dev server quebraria o import do .wasm.
  optimizeDeps: { exclude: ['@dimforge/rapier3d-simd'] },
  server: { port: 5173, open: true },
  // Aviso em tamanho bruto (three.js sozinho passa de 500 kB). O budget que vale é gzip,
  // checado em scripts/smoke.mjs.
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2022', chunkSizeWarningLimit: 1000 },
});
