import { ValidationError, InvalidStateError } from './errors.js';

export const STATUS = Object.freeze({
  CRIADO: 'CRIADO',
  PAGO: 'PAGO', // na tela: "Em preparação"
  FINALIZADO: 'FINALIZADO',
  CANCELADO: 'CANCELADO',
});

/**
 * Entidade Pedido. Concentra TODAS as regras de negócio:
 * - precisa ter ao menos 1 item;
 * - quantidade inteira > 0 e preço > 0;
 * - total é calculado (nunca recebido do cliente), em centavos para evitar erro de float;
 * - ciclo de vida: CRIADO -> PAGO (em preparação) -> FINALIZADO;
 * - só é possível pagar um pedido CRIADO e finalizar um pedido PAGO.
 */
export class Pedido {
  constructor({ id, cliente, itens, status = STATUS.CRIADO, criadoEm = new Date() }) {
    Pedido.#validarCliente(cliente);
    Pedido.#validarItens(itens);

    this.id = id;
    this.cliente = cliente.trim();
    this.itens = itens.map((i) => ({
      produto: i.produto.trim(),
      quantidade: i.quantidade,
      precoUnitarioCentavos: i.precoUnitarioCentavos,
    }));
    this.status = status;
    this.criadoEm = criadoEm;
  }

  get totalCentavos() {
    return this.itens.reduce((soma, i) => soma + i.quantidade * i.precoUnitarioCentavos, 0);
  }

  pagar() {
    if (this.status !== STATUS.CRIADO) {
      throw new InvalidStateError(`Pedido ${this.id} não pode ser pago no status ${this.status}`);
    }
    this.status = STATUS.PAGO;
  }

  finalizar() {
    if (this.status !== STATUS.PAGO) {
      throw new InvalidStateError(`Pedido ${this.id} não pode ser finalizado no status ${this.status}`);
    }
    this.status = STATUS.FINALIZADO;
  }

  toJSON() {
    return {
      id: this.id,
      cliente: this.cliente,
      itens: this.itens,
      totalCentavos: this.totalCentavos,
      status: this.status,
      criadoEm: this.criadoEm.toISOString(),
    };
  }

  static #validarCliente(cliente) {
    if (typeof cliente !== 'string' || cliente.trim().length === 0) {
      throw new ValidationError('cliente é obrigatório');
    }
  }

  static #validarItens(itens) {
    if (!Array.isArray(itens) || itens.length === 0) {
      throw new ValidationError('pedido precisa ter ao menos 1 item');
    }
    for (const item of itens) {
      if (!item || typeof item.produto !== 'string' || item.produto.trim().length === 0) {
        throw new ValidationError('produto do item é obrigatório');
      }
      if (!Number.isInteger(item.quantidade) || item.quantidade <= 0) {
        throw new ValidationError('quantidade deve ser inteiro maior que zero');
      }
      if (!Number.isInteger(item.precoUnitarioCentavos) || item.precoUnitarioCentavos <= 0) {
        throw new ValidationError('precoUnitarioCentavos deve ser inteiro maior que zero');
      }
    }
  }
}
