import express from 'express';
import { pinoHttp } from 'pino-http';
import { ValidationError, NotFoundError, InvalidStateError } from '../domain/errors.js';

const STATUS_POR_ERRO = new Map([
  [ValidationError, 400],
  [NotFoundError, 404],
  [InvalidStateError, 409],
]);

/**
 * Monta o app Express. Recebe as dependências prontas (service, logger,
 * métricas) — por isso o mesmo app roda no teste de integração com
 * repositório em memória e em produção com Postgres.
 */
export function criarApp({ pedidoService, logger, metricas }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/metrics' } }));

  // Métrica de latência por rota (rota em template, ex: /pedidos/:id, para não explodir cardinalidade)
  app.use((req, res, next) => {
    const fim = metricas.httpDuracao.startTimer();
    res.on('finish', () => {
      const route = req.route ? req.baseUrl + req.route.path : 'nao_mapeada';
      fim({ method: req.method, route, status_code: res.statusCode });
    });
    next();
  });

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', metricas.registry.contentType);
    res.send(await metricas.registry.metrics());
  });

  app.post('/pedidos', async (req, res) => {
    const pedido = await pedidoService.criar(req.body ?? {});
    res.status(201).location(`/pedidos/${pedido.id}`).json(pedido);
  });

  app.get('/pedidos/:id', async (req, res) => {
    res.json(await pedidoService.obter(req.params.id));
  });

  app.post('/pedidos/:id/pagamento', async (req, res) => {
    res.json(await pedidoService.pagar(req.params.id));
  });

  app.use((_req, res) => res.status(404).json({ erro: 'rota não encontrada' }));

  // Express identifica o error handler pelos 4 parâmetros (_next precisa existir)
  app.use((err, req, res, _next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ erro: 'JSON inválido' });
    }
    for (const [Tipo, status] of STATUS_POR_ERRO) {
      if (err instanceof Tipo) return res.status(status).json({ erro: err.message });
    }
    req.log.error({ err }, 'erro inesperado');
    return res.status(500).json({ erro: 'erro interno' });
  });

  return app;
}
