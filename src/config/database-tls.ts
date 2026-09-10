import type { PoolConfig } from 'pg';

export function databasePoolOptions(connectionString: string, ca?: string): PoolConfig {
  if (!ca?.trim()) return { connectionString };
  const url = new URL(connectionString);
  if (url.searchParams.get('sslmode') !== 'verify-full') throw new Error('DATABASE_TLS_REQUIRED');
  // pg's URL parser overrides an explicit ssl object when sslmode is present.
  url.searchParams.delete('sslmode');
  return { connectionString: url.href, ssl: { ca, rejectUnauthorized: true } };
}
