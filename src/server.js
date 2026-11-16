import pg from 'pg';
import { carregarConfig } from './config.js';
import { criarLogger } from './observability/logger.js';
import { criarMetricas } from './observability/metrics.js';
import { PedidoService } from './application/PedidoService.js';
import { InMemoryPedidoRepository } from './infra/InMemoryPedidoRepository.js';
import { PostgresPedidoRepository } from './infra/PostgresPedidoRepository.js';
import { criarApp } from './http/app.js';

/**
 * Composition root: o ÚNICO lugar que conhece as implementações concretas.
 * Escolhe o repositório pela variável REPOSITORY e injeta no service.
 */
const config = carregarConfig();
const logger = criarLogger(config.logLevel);

async function criarRepositorio() {
  if (config.repository === 'memory') return { repo: new InMemoryPedidoRepository(), fechar: async () => {} };
  const pool = new pg.Pool({ connectionString: config.databaseUrl });
  const repo = new PostgresPedidoRepository(pool);
  await repo.migrar();
  return { repo, fechar: () => pool.end() };
}

const { repo, fechar } = await criarRepositorio();
const pedidoService = new PedidoService(repo, {
  onPedidoCriado: (p) => logger.info({ evento: 'pedido_criado', pedidoId: p.id, totalCentavos: p.totalCentavos }, 'pedido criado'),
});
const app = criarApp({ pedidoService, logger, metricas: criarMetricas() });

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, repository: config.repository }, 'pedidos-api no ar');
});

for (const sinal of ['SIGINT', 'SIGTERM']) {
  process.on(sinal, () => {
    logger.info({ sinal }, 'encerrando');
    server.close(async () => {
      await fechar();
      process.exit(0);
    });
  });
}
