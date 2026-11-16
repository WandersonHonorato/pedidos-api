import { randomUUID } from 'node:crypto';
import { Pedido, STATUS } from '../domain/Pedido.js';
import { NotFoundError, ValidationError } from '../domain/errors.js';

/** Limite de itens por listagem: a tela mostra os mais recentes, sem paginação. */
export const LIMITE_LISTAGEM = 100;

/**
 * Casos de uso do fluxo principal: criar → consultar → pagar → finalizar,
 * mais a listagem usada pelo painel (frontend).
 *
 * DIP: depende da *abstração* de repositório (qualquer objeto com
 * salvar/buscarPorId/listar), recebida por injeção no construtor. Não sabe
 * se é memória ou Postgres.
 */
export class PedidoService {
  /**
   * @param {{
   *   salvar(p: Pedido): Promise<void>,
   *   buscarPorId(id: string): Promise<Pedido|null>,
   *   listar(filtro: { status?: string, limite: number }): Promise<Pedido[]>
   * }} repositorio
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

  /** Lista os pedidos mais recentes primeiro, opcionalmente filtrando por status. */
  async listar({ status } = {}) {
    if (status !== undefined && !Object.values(STATUS).includes(status)) {
      throw new ValidationError(`status inválido: ${status}`);
    }
    return this.repositorio.listar({ status, limite: LIMITE_LISTAGEM });
  }

  async pagar(id) {
    return this.#transicionar(id, (pedido) => pedido.pagar());
  }

  async finalizar(id) {
    return this.#transicionar(id, (pedido) => pedido.finalizar());
  }

  async #transicionar(id, acao) {
    const pedido = await this.obter(id);
    acao(pedido);
    await this.repositorio.salvar(pedido);
    return pedido;
  }
}
