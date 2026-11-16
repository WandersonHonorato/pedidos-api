# Contribuidores

| Nome | Papel | Contato |
|---|---|---|
| Lucas | Autor: domínio, API, testes, infraestrutura, CI e documentação | [GitHub](https://github.com/SEU_USUARIO) |

## Assistência de IA

- **Claude (Anthropic)**: assistente de código, usado conforme declarado em [`docs/ia.md`](docs/ia.md).

## Como contribuir

1. Crie uma branch a partir de `main`.
2. Antes de abrir o PR, rode: `npm run lint && npm run lint:openapi && npm run test:coverage`.
3. A CI precisa estar verde (lint, testes com coverage mínimo e smoke k6 via compose).
4. Mudança de arquitetura → registre um novo ADR em `docs/adr/` (template MADR).
