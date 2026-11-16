import { Pedido } from '../domain/Pedido.js';

const SELECT = 'SELECT id, cliente, itens, status, criado_em FROM pedidos';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Implementação do Repository em PostgreSQL. Mesmo contrato do
 * InMemoryPedidoRepository (salvar / buscarPorId / listar), então o PedidoService
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
    // Índice para a listagem do painel (filtro por status, ordenada por data)
    await this.pool.query('CREATE INDEX IF NOT EXISTS pedidos_status_criado_em_idx ON pedidos (status, criado_em DESC)');
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
    const { rows } = await this.pool.query(`${SELECT} WHERE id = $1`, [id]);
    return rows.length === 0 ? null : PostgresPedidoRepository.#hidratar(rows[0]);
  }

  /** Mais recentes primeiro, filtro opcional por status, com limite. */
  async listar({ status, limite }) {
    const { rows } = status === undefined
      ? await this.pool.query(`${SELECT} ORDER BY criado_em DESC LIMIT $1`, [limite])
      : await this.pool.query(`${SELECT} WHERE status = $1 ORDER BY criado_em DESC LIMIT $2`, [status, limite]);
    return rows.map(PostgresPedidoRepository.#hidratar);
  }

  static #hidratar(r) {
    return new Pedido({
      id: r.id,
      cliente: r.cliente,
      itens: r.itens,
      status: r.status,
      criadoEm: r.criado_em,
    });
  }
}
