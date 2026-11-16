# Pedidos API — Projeto B (Full Cycle Geração Tech 4.0)

[![CI](https://github.com/WandersonHonorato/pedidos-api/actions/workflows/ci.yml/badge.svg)](https://github.com/WandersonHonorato/pedidos-api/actions/workflows/ci.yml)

API de **domínio único (pedidos)** com **um fluxo principal ponta a ponta**:
**criar pedido → consultar → pagar**. Node.js 22 + Express 5 + PostgreSQL 16.

## Nível

**M4 — todos os entregáveis de M1 a M4 atendidos.**

| Nível | Entregável | Onde está |
|---|---|---|
| M1 | Compose sobe com 1 comando | [`docker-compose.yml`](docker-compose.yml) |
| M1 | SOLID | [seção SOLID](#solid) |
| M1 | 1 pattern justificado (Repository) | [`docs/adr/0001-repository-pattern.md`](docs/adr/0001-repository-pattern.md) |
| M1 | Ferramenta de qualidade (ESLint) | [`eslint.config.js`](eslint.config.js) |
| M2 | Testes unitários do domínio + 1 de integração | [`tests/unit/`](tests/unit), [`tests/integration/`](tests/integration) |
| M2 | Coverage mínimo declarado e respeitado | [`vitest.config.js`](vitest.config.js) — ver [Testes](#como-testar) |
| M3 | CI verde: install, lint, test | [`.github/workflows/ci.yml`](.github/workflows/ci.yml) |
| M3 | `.env.example`, segredos fora do repo | [`.env.example`](.env.example), [`.gitignore`](.gitignore) |
| M3 | Logs estruturados, 1 métrica, 1 SLO | [Observabilidade](#observabilidade) |
| M4 | README do primeiro dia + 1 ADR | este arquivo + [`docs/adr/`](docs/adr) |
| M4 | OpenAPI + smoke k6 com p95 medido | [`docs/openapi.yaml`](docs/openapi.yaml), [`k6/smoke.js`](k6/smoke.js), [`docs/desempenho.md`](docs/desempenho.md) |

## Primeiro dia

### Pré-requisitos

- Docker com Compose v2 (`docker compose version`)
- Para rodar testes fora do Docker: Node.js ≥ 20
- Para o smoke test: [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/)

### Como subir (1 comando)

```bash
cp .env && docker compose up --build
```

A API fica disponível em `http://localhost:3000`.
Para subir em segundo plano e esperar ficar saudável: `docker compose up -d --build --wait`.

### Testar o fluxo principal na mão

```bash
# 1) criar
curl -s -X POST localhost:3000/pedidos -H 'Content-Type: application/json' \
  -d '{"cliente":"Wanderson","itens":[{"produto":"Hedset JBL","quantidade":1,"precoUnitarioCentavos":19900}]}'

# 2) consultar (troque <ID> pelo id retornado)
curl -s localhost:3000/pedidos/<ID>

# 3) pagar  -> status PAGO   (pagar de novo -> 409)
curl -s -X POST localhost:3000/pedidos/<ID>/pagamento
```

| Método | Rota | Descrição |
|---|---|---|
| POST | `/pedidos` | cria pedido (total calculado no servidor) → 201 |
| GET | `/pedidos/{id}` | consulta → 200 / 404 |
| POST | `/pedidos/{id}/pagamento` | paga (CRIADO → PAGO) → 200 / 404 / 409 |
| GET | `/health` | liveness |
| GET | `/metrics` | métricas Prometheus |

Contrato completo: [`docs/openapi.yaml`](docs/openapi.yaml) (abra no [Swagger Editor](https://editor.swagger.io)).

### Rodar sem Docker (opcional)

```bash
npm ci
cp .env      # REPOSITORY=memory: não precisa de banco
npm start
```

### Derrubar

```bash
docker compose down -v    # -v apaga o volume do banco
```

## Como testar

```bash
npm ci
npm run lint              # ESLint (0 warnings permitidos)
npm run lint:openapi      # Spectral no docs/openapi.yaml
npm test                  # unitários + integração
npm run test:coverage     # idem + coverage com mínimo obrigatório
npm run test:smoke        # k6 contra a API rodando (BASE_URL=... para outro host)
```

- **Unitários** (`tests/unit/`): entidade `Pedido` (regras de validação, cálculo de total, transição de status), `PedidoService` e `config`.
- **Integração** (`tests/integration/pedidos.api.test.js`): Supertest faz requisições HTTP reais no app Express, passando por service, domínio e repositório. Cobre o fluxo **criar → consultar → pagar → pagar de novo (409)** e os casos 400/404/500, além do `/metrics`.
- Todo teste tem asserção explícita (`expect`) do status **e** do corpo.

### Coverage mínimo declarado

Definido em [`vitest.config.js`](vitest.config.js). A CI falha se ficar abaixo:

| Métrica | Mínimo | Obtido |
|---|---|---|
| Linhas | 90 % | 100 % |
| Statements | 90 % | 100 % |
| Funções | 90 % | 100 % |
| Branches | 85 % | 100 % |

Ficam fora da medição, de forma declarada: `src/server.js` (composition root, só faz a montagem e o `listen`) e
`src/infra/PostgresPedidoRepository.js` (depende de banco real). Esse último é exercitado de ponta a ponta
pelo job `compose-smoke` da CI, que sobe o compose com Postgres e roda o k6 contra ele.

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml), em todo push e PR:

1. **quality**: `npm ci` → `npm run lint` → `npm run lint:openapi` → `npm run test:coverage`
2. **compose-smoke**: `cp .env` → `docker compose up -d --build --wait` → `k6 run` (thresholds = SLO) → p95 publicado no *Job Summary*

Link da última execução verde: **https://github.com/WandersonHonorato/pedidos-api/actions/runs/43821969838**

## Arquitetura

```
src/
├─ domain/            Pedido (entidade + regras) e erros de domínio — sem dependências externas
├─ application/       PedidoService (casos de uso: criar, obter, pagar)
├─ infra/             Repositórios: InMemory (testes / modo dev) e Postgres (compose)
├─ http/              App Express: rotas, tradução erro de domínio → status HTTP, métricas
├─ observability/     logger (pino) e métricas (prom-client)
├─ config.js          variáveis de ambiente (dotenv), falha rápido se faltar segredo
└─ server.js          composition root: escolhe implementações e injeta
```

Dependências apontam para dentro: `http → application → domain ← infra`.

### Pattern: Repository

`PedidoService` depende de um contrato `{ salvar, buscarPorId }`, e não do Postgres.
Por isso o **mesmo** app roda no teste de integração (memória) e no compose (Postgres) sem mudar uma linha.
Justificativa completa, com alternativas descartadas: [ADR 0001](docs/adr/0001-repository-pattern.md).

### SOLID

| Princípio | Onde aparece |
|---|---|
| **S**: responsabilidade única | `Pedido` só tem regras; `PedidoService` só orquestra; `app.js` só traduz HTTP; repositórios só persistem; `config.js` só lê ambiente. |
| **O**: aberto/fechado | Trocar ou adicionar persistência = nova classe de repositório; `PedidoService` não muda. O hook `onPedidoCriado` permite reagir à criação (hoje: log de negócio) sem editar o service. |
| **L**: substituição de Liskov | `InMemoryPedidoRepository` e `PostgresPedidoRepository` são intercambiáveis: ambos devolvem cópias (o InMemory serializa, como um banco faria) e `null` para id inexistente. |
| **I**: segregação de interface | O contrato de repositório tem só os 2 métodos que o fluxo usa. Sem `findAll`, `delete` etc. "por via das dúvidas". |
| **D**: inversão de dependência | `PedidoService` recebe o repositório pelo construtor; `criarApp` recebe service/logger/métricas prontos. Só `server.js` conhece classes concretas. |

## Observabilidade

### Logs estruturados (pino)

JSON, uma linha por evento, com `service`, `time` (ISO), `level`, request/response (via `pino-http`) e eventos de negócio:

```json
{"level":30,"time":"2026-11-16T03:00:04.657Z","service":"pedidos-api","evento":"pedido_criado","pedidoId":"ef87e7fe-…","totalCentavos":28900,"msg":"pedido criado"}
```

Os headers `authorization` e `cookie` são mascarados (`redact`). Nível configurável via `LOG_LEVEL`.

### Métrica (prom-client)

`http_request_duration_seconds` (histograma), com labels `method`, `route` (em template, ex. `/pedidos/:id`, para não explodir a cardinalidade) e `status_code`. Exposta em `GET /metrics`.

### SLO

> **95 % das requisições `POST /pedidos` respondem em menos de 300 ms** (janela de 30 dias), com taxa de erro < 1 %.

- **Como é verificado hoje:** thresholds do k6 (`p(95)<300` e `http_req_failed rate<0.01`). Se violar, o k6 sai com erro e a CI fica vermelha.
- **Como seria monitorado em produção** (PromQL sobre a métrica acima):

```promql
sum(rate(http_request_duration_seconds_bucket{route="/pedidos",method="POST",le="0.3"}[30d]))
/
sum(rate(http_request_duration_seconds_count{route="/pedidos",method="POST"}[30d]))
# SLO atendido se >= 0.95
```

Medição real: [`docs/desempenho.md`](docs/desempenho.md).

## Variáveis de ambiente

| Variável | Uso | Exemplo |
|---|---|---|
| `API_PORT` | porta no host (compose) | `3000` |
| `LOG_LEVEL` | nível do pino | `info` |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | banco do compose | ver `.env.example` |
| `REPOSITORY` | `memory` ou `postgres` (fora do Docker) | `memory` |
| `DATABASE_URL` | obrigatório se `REPOSITORY=postgres` | `postgres://…` |
| `PORT` | porta do processo Node | `3000` |

Nenhum segredo tem valor padrão no código nem no compose.

## Documentação

- [`docs/README.md`](docs/README.md): índice da pasta
- [`docs/adr/0001-repository-pattern.md`](docs/adr/0001-repository-pattern.md): decisão de arquitetura (MADR)
- [`docs/openapi.yaml`](docs/openapi.yaml): contrato OpenAPI 3
- [`docs/desempenho.md`](docs/desempenho.md): smoke k6 e p95 medido
- [`docs/ia.md`](docs/ia.md): uso de IA e prompts relevantes
- [`CONTRIBUTORS.md`](CONTRIBUTORS.md)
