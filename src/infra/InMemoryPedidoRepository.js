import { Pedido } from '../domain/Pedido.js';

/**
 * Implementação do Repository em memória. Usada nos testes e no modo
 * REPOSITORY=memory. Guarda snapshots (JSON) para não vazar referência
 * mutável, imitando o comportamento de um banco real (LSP).
 */
export class InMemoryPedidoRepository {
  #dados = new Map();

  async salvar(pedido) {
    this.#dados.set(pedido.id, JSON.parse(JSON.stringify(pedido)));
  }

  async buscarPorId(id) {
    const raw = this.#dados.get(id);
    return raw ? InMemoryPedidoRepository.#hidratar(raw) : null;
  }

  /** Mesma semântica do Postgres: mais recentes primeiro, filtro opcional, limite. */
  async listar({ status, limite }) {
    return [...this.#dados.values()]
      .filter((raw) => status === undefined || raw.status === status)
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
      .slice(0, limite)
      .map(InMemoryPedidoRepository.#hidratar);
  }

  static #hidratar(raw) {
    return new Pedido({ ...raw, criadoEm: new Date(raw.criadoEm) });
  }
}
