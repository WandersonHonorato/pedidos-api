import { randomUUID } from 'node:crypto';
import { Pedido } from '../domain/Pedido.js';
import { NotFoundError } from '../domain/errors.js';

/**
 * Casos de uso do fluxo principal: criar → consultar → pagar.
 *
 * DIP: depende da *abstração* de repositório (qualquer objeto com
 * salvar/buscarPorId), recebida por injeção no construtor. Não sabe se
 * é memória ou Postgres.
 */
export class PedidoService {
  /**
   * @param {{ salvar(p: Pedido): Promise<void>, buscarPorId(id: string): Promise<Pedido|null> }} repositorio
   * @param {{ onPedidoCriado?: (p: Pedido) => void, gerarId?: () => string }} [opcoes]
   */
  constructor(repositorio, { onPedidoCriado = () => {}, gerarId = randomUUID } = {}) {
    this.repositorio = repositorio;
    this.onPedidoCriado = onPedidoCriado;
    this.gerarId = gerarId;
  }

  async criar({ cliente, itens }) {
    const pedido = new Pedido({ id: this.gerarId(), cliente, itens });
    await this.repositorio.salvar(pedido);
    this.onPedidoCriado(pedido);
    return pedido;
  }

  async obter(id) {
    const pedido = await this.repositorio.buscarPorId(id);
    if (!pedido) throw new NotFoundError(`Pedido ${id} não encontrado`);
    return pedido;
  }

  async pagar(id) {
    const pedido = await this.obter(id);
    pedido.pagar();
    await this.repositorio.salvar(pedido);
    return pedido;
  }
}
