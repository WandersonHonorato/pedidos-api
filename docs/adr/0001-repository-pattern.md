# 0001 — Usar Repository pattern para isolar a persistência de pedidos

- **Status:** aceito
- **Data:** 2026-11-16
- **Decisores:** Lucas

## Contexto e problema

A API precisa de duas coisas que puxam em direções opostas:

1. **Rodar com banco real** (PostgreSQL) quando sobe pelo `docker compose`, para que o fluxo ponta a ponta seja verdadeiro.
2. **Testes rápidos e determinísticos** do domínio e da API (unitários e integração com Supertest), que rodem na CI sem depender de um banco disponível.

Se o caso de uso (`PedidoService`) chamar `pg` diretamente, todo teste precisa de um Postgres de pé, ou de mocks frágeis da biblioteca `pg`. E as regras de negócio ficam misturadas com SQL.

## Fatores de decisão

- Testes de domínio e de integração HTTP sem banco (velocidade e estabilidade da CI)
- Regras de negócio sem conhecer SQL (SRP)
- Possibilidade de trocar o mecanismo de persistência sem tocar no caso de uso (OCP/DIP)
- Escopo pequeno: o trabalho pede um domínio, sem inflar a arquitetura

## Opções consideradas

1. **Repository pattern** com injeção de dependência pelo construtor
2. **SQL direto no service** (`pg` dentro do `PedidoService`)
3. **ORM** (Prisma/TypeORM) usado diretamente no service

## Decisão

**Opção 1: Repository pattern.**

`PedidoService` depende só do contrato `{ salvar(pedido), buscarPorId(id) }`. Há duas implementações:

- `InMemoryPedidoRepository`: usada nos testes e no modo `REPOSITORY=memory`;
- `PostgresPedidoRepository`: usada no `docker compose`.

A escolha acontece em um único lugar, o *composition root* (`src/server.js`).

### Consequências

- ✅ Os 36 testes (unitários e integração HTTP) rodam em menos de 1 s, sem banco, com 100 % de coverage do código medido.
- ✅ `Pedido` e `PedidoService` não importam nada de infraestrutura.
- ✅ O teste de integração exercita o app Express **real**; só a persistência é trocada.
- ⚠️ Risco: o InMemory se comportar diferente do Postgres. Mitigações:
  - o InMemory devolve **cópias** (serializa/deserializa), como um banco faria;
  - o job `compose-smoke` da CI roda o fluxo completo contra o Postgres real (k6).
  - Divergência real já encontrada e corrigida: id que não é UUID gerava erro de cast no Postgres (500). Agora o repositório devolve `null`, que vira 404, igual ao InMemory.
- ⚠️ Um arquivo a mais por implementação, custo aceitável para 2 métodos.

## Prós e contras das opções

### SQL direto no service
- ✅ Menos arquivos
- ❌ Todo teste do caso de uso precisa de Postgres ou de mock do `pg`
- ❌ Regras de negócio misturadas com SQL

### ORM direto no service
- ✅ Menos SQL escrito à mão
- ❌ Dependência pesada (geração de client, migrations) para uma tabela só, o que infla o escopo
- ❌ O service continua acoplado à ferramenta; testar ainda exigiria banco ou mocks do ORM
