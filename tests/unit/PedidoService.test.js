import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PedidoService, LIMITE_LISTAGEM } from '../../src/application/PedidoService.js';
import { InMemoryPedidoRepository } from '../../src/infra/InMemoryPedidoRepository.js';
import { NotFoundError, InvalidStateError, ValidationError } from '../../src/domain/errors.js';

const entrada = { cliente: 'Bruno', itens: [{ produto: 'Livro', quantidade: 1, precoUnitarioCentavos: 8900 }] };

describe('PedidoService (casos de uso)', () => {
  let repo;
  let service;
  let onPedidoCriado;

  beforeEach(() => {
    repo = new InMemoryPedidoRepository();
    onPedidoCriado = vi.fn();
    service = new PedidoService(repo, { onPedidoCriado, gerarId: () => 'id-fixo' });
  });

  it('cria pedido, persiste no repositório e dispara o hook', async () => {
    const pedido = await service.criar(entrada);

    expect(pedido.id).toBe('id-fixo');
    expect(pedido.totalCentavos).toBe(8900);
    expect(await repo.buscarPorId('id-fixo')).toMatchObject({ cliente: 'Bruno', status: 'CRIADO' });
    expect(onPedidoCriado).toHaveBeenCalledWith(pedido);
  });

  it('não persiste nem dispara hook quando a entrada é inválida', async () => {
    await expect(service.criar({ cliente: 'Bruno', itens: [] })).rejects.toThrow(ValidationError);
    expect(await repo.buscarPorId('id-fixo')).toBeNull();
    expect(onPedidoCriado).not.toHaveBeenCalled();
  });

  it('obtém um pedido existente', async () => {
    await service.criar(entrada);
    const pedido = await service.obter('id-fixo');
    expect(pedido.cliente).toBe('Bruno');
  });

  it('lança NotFoundError para id inexistente', async () => {
    await expect(service.obter('nao-existe')).rejects.toThrow(NotFoundError);
  });

  it('paga o pedido e persiste o novo status', async () => {
    await service.criar(entrada);
    const pago = await service.pagar('id-fixo');

    expect(pago.status).toBe('PAGO');
    expect((await repo.buscarPorId('id-fixo')).status).toBe('PAGO');
  });

  it('impede pagamento duplicado', async () => {
    await service.criar(entrada);
    await service.pagar('id-fixo');
    await expect(service.pagar('id-fixo')).rejects.toThrow(InvalidStateError);
  });

  it('finaliza um pedido pago e persiste o novo status', async () => {
    await service.criar(entrada);
    await service.pagar('id-fixo');
    const finalizado = await service.finalizar('id-fixo');

    expect(finalizado.status).toBe('FINALIZADO');
    expect((await repo.buscarPorId('id-fixo')).status).toBe('FINALIZADO');
  });

  it('impede finalizar pedido que não foi pago', async () => {
    await service.criar(entrada);
    await expect(service.finalizar('id-fixo')).rejects.toThrow(InvalidStateError);
    expect((await repo.buscarPorId('id-fixo')).status).toBe('CRIADO');
  });

  describe('listar', () => {
    let ids;
    beforeEach(async () => {
      ids = ['a', 'b', 'c'];
      let n = 0;
      service = new PedidoService(repo, { gerarId: () => ids[n++] });
      vi.useFakeTimers();
      for (const minuto of [0, 1, 2]) {
        vi.setSystemTime(new Date(Date.UTC(2026, 0, 1, 12, minuto)));
        await service.criar(entrada);
      }
      vi.useRealTimers();
      await service.pagar('b');
    });

    it('lista todos, do mais recente para o mais antigo', async () => {
      const lista = await service.listar();
      expect(lista.map((p) => p.id)).toEqual(['c', 'b', 'a']);
    });

    it('filtra por status', async () => {
      expect((await service.listar({ status: 'CRIADO' })).map((p) => p.id)).toEqual(['c', 'a']);
      expect((await service.listar({ status: 'PAGO' })).map((p) => p.id)).toEqual(['b']);
      expect(await service.listar({ status: 'FINALIZADO' })).toEqual([]);
    });

    it('rejeita status desconhecido', async () => {
      await expect(service.listar({ status: 'ENTREGUE' })).rejects.toThrow(ValidationError);
    });

    it('repassa o limite de listagem ao repositório', async () => {
      const listar = vi.fn().mockResolvedValue([]);
      await new PedidoService({ listar }).listar({ status: 'PAGO' });
      expect(listar).toHaveBeenCalledWith({ status: 'PAGO', limite: LIMITE_LISTAGEM });
    });

    it('respeita o limite no repositório em memória', async () => {
      expect((await repo.listar({ limite: 2 })).map((p) => p.id)).toEqual(['c', 'b']);
    });
  });

  it('usa UUID e hook vazio por padrão', async () => {
    const padrao = new PedidoService(new InMemoryPedidoRepository());
    const pedido = await padrao.criar(entrada);
    expect(pedido.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
