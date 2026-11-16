# Desempenho — smoke test k6

## Objetivo

Verificar que o fluxo principal funciona sob carga leve e **medir o p95** de `POST /pedidos` contra o SLO:

> 95 % das requisições `POST /pedidos` em menos de 300 ms, com taxa de erro < 1 %.

## Cenário (`k6/smoke.js`)

- **5 VUs por 30 s**, com pausa de 100 ms entre iterações
- Cada iteração executa o fluxo principal completo e valida com `check`:
  1. `POST /pedidos` → 201, com `totalCentavos === 28900` (total calculado pelo servidor)
  2. `GET /pedidos/:id` → 200
  3. `POST /pedidos/:id/pagamento` → 200, com `status === "PAGO"`
- **Thresholds** (fazem o k6 falhar e deixar a CI vermelha):
  - `http_req_duration{endpoint:criar_pedido}`: `p(95) < 300` ms ← **SLO**
  - `http_req_duration` (todas): `p(95) < 500` ms
  - `http_req_failed`: `rate < 1 %`
  - `checks`: `rate > 99 %`

Como rodar:

```bash
cp .env.example .env && docker compose up -d --build --wait
k6 run --summary-export=k6-summary.json k6/smoke.js
```

## Medição 1: local

- **Data:** 2026-11-16
- **Ambiente:** Linux, 2 vCPU Intel Xeon @ 2.10 GHz, Node.js 22, k6 v0.54.0
- **API:** `node src/server.js` com `REPOSITORY=postgres`, PostgreSQL 16 local (mesma máquina do k6)
- **Saída real do k6** (trecho):

```
✓ checks.........................: 100.00% 5536 out of 5536
✓ http_req_duration..............: avg=2.57ms min=523.81µs med=2.19ms p(90)=4.13ms p(95)=5.4ms  p(99)=10.29ms max=28.07ms
  ✓ { endpoint:criar_pedido }....: avg=3.03ms min=835.37µs med=2.63ms p(90)=4.37ms p(95)=5.53ms p(99)=15.37ms max=28.07ms
✓ http_req_failed................: 0.00%   0 out of 4152
  http_reqs......................: 4152    137.929242/s
  iterations.....................: 1384    45.976414/s
```

| Métrica (`POST /pedidos`) | Valor |
|---|---|
| Requisições | 1384 |
| Mediana | 2,63 ms |
| **p95** | **5,53 ms** |
| p99 | 15,37 ms |
| Máximo | 28,07 ms |
| Taxa de erro (todas as rotas) | 0,00 % (0 de 4152) |
| Checks | 100 % (5536 de 5536) |

**Confirmação pelo lado do servidor** (histograma `/metrics` logo após o teste):

```
http_request_duration_seconds_bucket{le="0.005",method="POST",route="/pedidos",status_code="201"} 1359
http_request_duration_seconds_bucket{le="0.3",  method="POST",route="/pedidos",status_code="201"} 1384
http_request_duration_seconds_count{            method="POST",route="/pedidos",status_code="201"} 1384
```

→ 1384/1384 = **100 % abaixo de 300 ms** (meta: ≥ 95 %). 98,2 % ficaram abaixo de 5 ms.

## Medição 2: CI (GitHub Actions, via docker compose)

O job `compose-smoke` repete o mesmo teste contra a stack do `docker compose` (API em container + Postgres em container)
e publica p95, p99, mediana e taxa de erro no **Job Summary** da execução, além do artefato `k6-summary.json`.

| Métrica (`POST /pedidos`) | Valor |
|---|---|
| p95 | _preencher com o valor do Job Summary_ |
| Link da execução | _COLE_AQUI_O_LINK_DO_RUN_ |

## Conclusão

- **SLO atendido** com folga de ~54×: p95 = 5,53 ms contra meta de 300 ms, e 0 % de erro.
- O p99 (15 ms) e o máximo (28 ms) mostram cauda curta; os picos coincidem com o *warm-up* do pool de conexões do Postgres.
- **Limites desta medição:** é um *smoke test* (carga leve, k6 e banco na mesma máquina, sem latência de rede). Ele prova que o fluxo funciona e dá uma linha de base; **não** é teste de capacidade. Para dimensionar seria preciso um teste de carga/estresse com rampa de VUs em ambiente separado.
