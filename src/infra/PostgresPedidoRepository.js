import { Pedido } from '../domain/Pedido.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Implementação do Repository em PostgreSQL. Mesmo contrato do
 * InMemoryPedidoRepository (salvar / buscarPorId), então o PedidoService
 * funciona com qualquer um dos dois sem alteração (OCP + LSP).
 *
 * Itens ficam em JSONB: o domínio não exige consulta por item, e isso
 * mantém o escopo pequeno (uma tabela).
 */
export class PostgresPedidoRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async migrar() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS pedidos (
        id          UUID PRIMARY KEY,
        cliente     TEXT        NOT NULL,
        itens       JSONB       NOT NULL,
        status      TEXT        NOT NULL,
        criado_em   TIMESTAMPTZ NOT NULL
      )`);
  }

  async salvar(pedido) {
    await this.pool.query(
      `INSERT INTO pedidos (id, cliente, itens, status, criado_em)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
      [pedido.id, pedido.cliente, JSON.stringify(pedido.itens), pedido.status, pedido.criadoEm],
    );
  }

  async buscarPorId(id) {
    // id fora do formato UUID não existe — evita erro de cast do Postgres (que viraria 500)
    if (!UUID_RE.test(id)) return null;
    const { rows } = await this.pool.query(
      'SELECT id, cliente, itens, status, criado_em FROM pedidos WHERE id = $1',
      [id],
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return new Pedido({
      id: r.id,
      cliente: r.cliente,
      itens: r.itens,
      status: r.status,
      criadoEm: r.criado_em,
    });
  }
}
