import client from 'prom-client';

/**
 * Métrica: histograma de latência HTTP. É a base do SLO
 * (p95 de POST /pedidos < 300 ms — ver README, seção Observabilidade).
 * Os buckets cobrem o limiar do SLO (0.3 s) com precisão.
 */
export function criarMetricas() {
  const registry = new client.Registry();
  client.collectDefaultMetrics({ register: registry });

  const httpDuracao = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duração das requisições HTTP em segundos',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.2, 0.3, 0.5, 1, 2],
    registers: [registry],
  });

  return { registry, httpDuracao };
}
