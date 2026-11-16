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
    if (!raw) return null;
    return new Pedido({ ...raw, criadoEm: new Date(raw.criadoEm) });
  }
}
