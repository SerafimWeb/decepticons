import { defineConfig } from 'vitest/config';

// Testes rodam no Node com o pacote compat do Rapier: este arquivo substitui o vite.config.ts
// (sem o alias de browser nem o plugin de Wasm).
export default defineConfig({
  test: {
    include: ['client/src/**/*.test.ts', 'shared/**/*.test.ts', 'server/**/*.test.ts'],
    environment: 'node',
    // Testes com física simulam dezenas de segundos de jogo: sozinhos levam ~1 s, mas com a máquina
    // ocupada (vários arquivos em paralelo, CI) passavam dos 5 s padrão e falhavam por tempo, não por erro.
    testTimeout: 30_000,
    // O mesmo vale para o preparo (beforeAll): o atualizador do servidor recusou dois deploys em 18/10 porque
    // o preparo do estudio.test.ts passou dos 10 s padrão com a máquina ocupada por outras verificações.
    hookTimeout: 30_000,
  },
});
