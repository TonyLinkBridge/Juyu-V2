import test from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { databasePoolOptions } from '../src/config/database-tls.ts';

test('CA survives pg URL parsing and retains strict verification', async () => {
  const pool = new Pool(databasePoolOptions('postgresql://user:password@db.example:5432/postgres?sslmode=verify-full', 'certificate'));
  try {
    assert.deepEqual(pool.options.ssl, { ca: 'certificate', rejectUnauthorized: true });
    assert.equal(new URL(pool.options.connectionString!).search, '');
  } finally { await pool.end(); }
});

test('without a custom CA retain the original verify-full connection', () => {
  const url = 'postgresql://user:password@db.example/postgres?sslmode=verify-full';
  assert.deepEqual(databasePoolOptions(url), { connectionString: url });
});

test('custom CA cannot downgrade an insecure connection', () => {
  assert.throws(() => databasePoolOptions('postgresql://user:password@db.example/postgres?sslmode=no-verify', 'certificate'));
});
