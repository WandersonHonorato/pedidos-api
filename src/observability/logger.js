import pino from 'pino';

/** Logs estruturados em JSON (uma linha por evento), prontos para Loki/ELK. */
export function criarLogger(level = 'info') {
  return pino({
    level,
    base: { service: 'pedidos-api' },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: ['req.headers.authorization', 'req.headers.cookie'],
  });
}
