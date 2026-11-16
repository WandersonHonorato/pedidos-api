import { describe, it, expect } from 'vitest';
import { Pedido, STATUS } from '../../src/domain/Pedido.js';
import { ValidationError, InvalidStateError } from '../../src/domain/errors.js';

const itemValido = { produto: 'Caneca', quantidade: 2, precoUnitarioCentavos: 2500 };
const novo = (overrides = {}) => new Pedido({ id: 'p1', cliente: 'Ana', itens: [itemValido], ...overrides });

describe('Pedido (entidade de domínio)', () => {
  it('nasce com status CRIADO', () => {
    expect(novo().status).toBe(STATUS.CRIADO);
  });

  it('calcula o total em centavos somando quantidade x preço de cada item', () => {
    const pedido = novo({
      itens: [itemValido, { produto: 'Camiseta', quantidade: 1, precoUnitarioCentavos: 4990 }],
    });
    expect(pedido.totalCentavos).toBe(2 * 2500 + 4990);
  });

  it('remove espaços do nome do cliente e do produto', () => {
    const pedido = novo({ cliente: '  Ana  ', itens: [{ ...itemValido, produto: ' Caneca ' }] });
    expect(pedido.cliente).toBe('Ana');
    expect(pedido.itens[0].produto).toBe('Caneca');
  });

  it.each([
    ['cliente vazio', { cliente: '   ' }, 'cliente é obrigatório'],
    ['cliente ausente', { cliente: undefined }, 'cliente é obrigatório'],
    ['sem itens', { itens: [] }, 'ao menos 1 item'],
    ['itens não é lista', { itens: 'x' }, 'ao menos 1 item'],
    ['item nulo', { itens: [null] }, 'produto do item é obrigatório'],
    ['produto vazio', { itens: [{ ...itemValido, produto: '' }] }, 'produto do item é obrigatório'],
    ['quantidade zero', { itens: [{ ...itemValido, quantidade: 0 }] }, 'quantidade'],
    ['quantidade fracionada', { itens: [{ ...itemValido, quantidade: 1.5 }] }, 'quantidade'],
    ['preço negativo', { itens: [{ ...itemValido, precoUnitarioCentavos: -1 }] }, 'precoUnitarioCentavos'],
    ['preço em float', { itens: [{ ...itemValido, precoUnitarioCentavos: 10.5 }] }, 'precoUnitarioCentavos'],
  ])('rejeita %s', (_caso, overrides, mensagem) => {
    expect(() => novo(overrides)).toThrow(ValidationError);
    expect(() => novo(overrides)).toThrow(mensagem);
  });

  it('pagar muda o status de CRIADO para PAGO', () => {
    const pedido = novo();
    pedido.pagar();
    expect(pedido.status).toBe(STATUS.PAGO);
  });

  it('não permite pagar duas vezes', () => {
    const pedido = novo();
    pedido.pagar();
    expect(() => pedido.pagar()).toThrow(InvalidStateError);
    expect(pedido.status).toBe(STATUS.PAGO);
  });

  it('não permite pagar pedido cancelado', () => {
    expect(() => novo({ status: STATUS.CANCELADO }).pagar()).toThrow(InvalidStateError);
  });

  it('serializa com total calculado e data em ISO 8601', () => {
    const criadoEm = new Date('2026-01-01T12:00:00.000Z');
    expect(novo({ criadoEm }).toJSON()).toEqual({
      id: 'p1',
      cliente: 'Ana',
      itens: [itemValido],
      totalCentavos: 5000,
      status: 'CRIADO',
      criadoEm: '2026-01-01T12:00:00.000Z',
    });
  });
});
