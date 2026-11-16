import 'dotenv/config';

/**
 * Única fonte de configuração. Lê variáveis de ambiente (ou .env via dotenv).
 * Segredos (senha do banco) NUNCA têm valor padrão aqui: se faltarem, a
 * aplicação falha rápido na subida.
 */
export function carregarConfig(env = process.env) {
  const repository = env.REPOSITORY ?? 'memory';
  if (!['memory', 'postgres'].includes(repository)) {
    throw new Error(`REPOSITORY inválido: "${repository}" (use memory ou postgres)`);
  }
  if (repository === 'postgres' && !env.DATABASE_URL) {
    throw new Error('DATABASE_URL é obrigatório quando REPOSITORY=postgres');
  }
  return {
    port: Number(env.PORT ?? 3000),
    logLevel: env.LOG_LEVEL ?? 'info',
    repository,
    databaseUrl: env.DATABASE_URL,
  };
}
