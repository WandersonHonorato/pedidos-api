import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov'],
      include: ['src/**/*.js'],
      // Excluídos (justificativa no README, seção "Testes"):
      // - server.js: composition root, só faz wiring e listen();
      // - PostgresPedidoRepository.js: depende de banco real; é exercitado
      //   pelo job "compose-smoke" da CI (docker compose + k6).
      exclude: ['src/server.js', 'src/infra/PostgresPedidoRepository.js'],
      // Coverage mínimo DECLARADO: a CI falha se qualquer métrica ficar abaixo.
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 85,
      },
    },
  },
});
