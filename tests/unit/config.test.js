import { describe, it, expect } from 'vitest';
import { carregarConfig } from '../../src/config.js';

describe('carregarConfig', () => {
  it('usa padrões seguros (sem segredos) quando nada é informado', () => {
    expect(carregarConfig({})).toEqual({ port: 3000, logLevel: 'info', repository: 'memory', databaseUrl: undefined });
  });

  it('lê valores do ambiente', () => {
    const cfg = carregarConfig({ PORT: '8080', LOG_LEVEL: 'debug', REPOSITORY: 'postgres', DATABASE_URL: 'postgres://x' });
    expect(cfg).toEqual({ port: 8080, logLevel: 'debug', repository: 'postgres', databaseUrl: 'postgres://x' });
  });

  it('falha rápido se postgres for escolhido sem DATABASE_URL', () => {
    expect(() => carregarConfig({ REPOSITORY: 'postgres' })).toThrow('DATABASE_URL é obrigatório');
  });

  it('rejeita repositório desconhecido', () => {
    expect(() => carregarConfig({ REPOSITORY: 'mongo' })).toThrow('REPOSITORY inválido');
  });
});
