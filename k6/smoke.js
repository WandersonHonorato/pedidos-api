// Smoke test k6 do fluxo principal: criar → consultar → pagar.
// Rodar:  k6 run k6/smoke.js            (padrão: http://localhost:3000)
//         BASE_URL=http://host:porta k6 run k6/smoke.js
//
// Os thresholds abaixo SÃO o SLO: se o p95 de POST /pedidos passar de 300 ms,
// ou houver mais de 1% de erro, o k6 sai com código != 0 e a CI fica vermelha.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const JSON_HEADERS = { headers: { 'Content-Type': 'application/json' } };

export const options = {
  vus: 5,
  duration: '30s',
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds: {
    'http_req_duration{endpoint:criar_pedido}': ['p(95)<300'],
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  const corpo = JSON.stringify({
    cliente: `cliente-vu${__VU}`,
    itens: [
      { produto: 'Teclado', quantidade: 1, precoUnitarioCentavos: 19900 },
      { produto: 'Mouse', quantidade: 2, precoUnitarioCentavos: 4500 },
    ],
  });

  const criado = http.post(`${BASE_URL}/pedidos`, corpo, { ...JSON_HEADERS, tags: { endpoint: 'criar_pedido' } });
  check(criado, {
    'POST /pedidos -> 201': (r) => r.status === 201,
    'total calculado = 28900': (r) => r.json('totalCentavos') === 28900,
  });
  const id = criado.json('id');

  const consultado = http.get(`${BASE_URL}/pedidos/${id}`, { tags: { endpoint: 'obter_pedido', name: 'GET /pedidos/:id' } });
  check(consultado, { 'GET /pedidos/:id -> 200': (r) => r.status === 200 });

  const pago = http.post(`${BASE_URL}/pedidos/${id}/pagamento`, null, {
    tags: { endpoint: 'pagar_pedido', name: 'POST /pedidos/:id/pagamento' },
  });
  check(pago, { 'pagamento -> PAGO': (r) => r.status === 200 && r.json('status') === 'PAGO' });

  sleep(0.1);
}
