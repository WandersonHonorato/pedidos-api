import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { criarApp } from '../../src/http/app.js';
import { PedidoService } from '../../src/application/PedidoService.js';
import { InMemoryPedidoRepository } from '../../src/infra/InMemoryPedidoRepository.js';
import { criarLogger } from '../../src/observability/logger.js';
import { criarMetricas } from '../../src/observability/metrics.js';

/**
 * Teste de integração: HTTP real (Supertest) → Express → Service → Domínio → Repository.
 * Só o banco é trocado pela implementação em memória (graças ao Repository pattern).
 */
function montarApp(repo = new InMemoryPedidoRepository()) {
  return criarApp({
    pedidoService: new PedidoService(repo),
    logger: criarLogger('silent'),
    metricas: criarMetricas(),
  });
}

const corpo = {
  cliente: 'Carla',
  itens: [
    { produto: 'Teclado', quantidade: 1, precoUnitarioCentavos: 19900 },
    { produto: 'Mouse', quantidade: 2, precoUnitarioCentavos: 4500 },
  ],
};

describe('API /pedidos — fluxo principal ponta a ponta', () => {
  let app;
  beforeEach(() => {
    app = montarApp();
  });

  it('cria → consulta → paga um pedido', async () => {
    const criado = await request(app).post('/pedidos').send(corpo).expect(201);
    expect(criado.body).toMatchObject({ cliente: 'Carla', status: 'CRIADO', totalCentavos: 28900 });
    expect(criado.headers.location).toBe(`/pedidos/${criado.body.id}`);

    const consultado = await request(app).get(`/pedidos/${criado.body.id}`).expect(200);
    expect(consultado.body).toEqual(criado.body);

    const pago = await request(app).post(`/pedidos/${criado.body.id}/pagamento`).expect(200);
    expect(pago.body.status).toBe('PAGO');

    const segundoPagamento = await request(app).post(`/pedidos/${criado.body.id}/pagamento`).expect(409);
    expect(segundoPagamento.body.erro).toMatch(/não pode ser pago/);
  });

  it('400 para pedido inválido', async () => {
    const res = await request(app).post('/pedidos').send({ cliente: 'Carla', itens: [] }).expect(400);
    expect(res.body.erro).toBe('pedido precisa ter ao menos 1 item');
  });

  it('400 para JSON malformado', async () => {
    const res = await request(app).post('/pedidos').set('Content-Type', 'application/json').send('{ruim').expect(400);
    expect(res.body.erro).toBe('JSON inválido');
  });

  it('400 quando o corpo não é enviado', async () => {
    const res = await request(app).post('/pedidos').expect(400);
    expect(res.body.erro).toBe('cliente é obrigatório');
  });

  it('404 para pedido inexistente e para rota desconhecida', async () => {
    expect((await request(app).get('/pedidos/nao-existe').expect(404)).body.erro).toMatch(/não encontrado/);
    expect((await request(app).get('/xpto').expect(404)).body.erro).toBe('rota não encontrada');
  });

  it('500 genérico (sem vazar detalhes) quando o repositório falha', async () => {
    const repoQuebrado = { salvar: async () => { throw new Error('conexão caiu'); }, buscarPorId: async () => null };
    const res = await request(montarApp(repoQuebrado)).post('/pedidos').send(corpo).expect(500);
    expect(res.body).toEqual({ erro: 'erro interno' });
  });

  it('GET /health responde ok', async () => {
    expect((await request(app).get('/health').expect(200)).body).toEqual({ status: 'ok' });
  });

  it('GET /metrics expõe o histograma de latência com a rota em template', async () => {
    const { body } = await request(app).post('/pedidos').send(corpo);
    await request(app).get(`/pedidos/${body.id}`);

    const res = await request(app).get('/metrics').expect(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toContain('http_request_duration_seconds_bucket');
    expect(res.text).toMatch(/route="\/pedidos",status_code="201"/);
    expect(res.text).toMatch(/route="\/pedidos\/:id",status_code="200"/);
  });
});
