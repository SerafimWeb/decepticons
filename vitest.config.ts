import { defineConfig } from 'vitest/config';

// Testes rodam no Node com o pacote compat do Rapier: este arquivo substitui o vite.config.ts
// (sem o alias de browser nem o plugin de Wasm).
export default defineConfig({
  test: {
    include: ['client/src/**/*.test.ts'],
    environment: 'node',
  },
});
