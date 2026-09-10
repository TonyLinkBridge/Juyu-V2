import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import EmbeddedPostgres from 'embedded-postgres';
import { Pool } from 'pg';

export async function temporaryDatabase() {
  // Never accepts an external URL or credentials. This cluster is owned by this test.
  const directory = await mkdtemp(join(tmpdir(), 'juyu-db-test-'));
  const port = await new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') return reject(new Error('No test port'));
      server.close(() => resolve(address.port));
    });
  });
  const password = randomBytes(24).toString('hex');
  const database = new EmbeddedPostgres({
    databaseDir: join(directory, 'data'), port, user: 'postgres', password,
    authMethod: 'scram-sha-256', persistent: true, createPostgresUser: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    postgresFlags: ['-c', 'listen_addresses=127.0.0.1', '-c', 'unix_socket_directories=', '-c', 'fsync=on'],
    onLog: () => {}, onError: () => {},
  });
  let started = false;
  const pool = new Pool({ host: '127.0.0.1', port, user: 'postgres', password, database: 'postgres', max: 8, connectionTimeoutMillis: 5000 });
  try {
    await database.initialise();
    await database.start();
    started = true;
    await pool.query('SELECT 1');
  } catch (error) {
    await pool.end();
    if (started) await database.stop();
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  return {
    pool,
    connectAs(user: string, password: string) { return new Pool({ host: '127.0.0.1', port, user, password, database: 'postgres', max: 4, connectionTimeoutMillis: 5000 }); },
    async close() {
      await pool.end();
      await database.stop();
      await rm(directory, { recursive: true, force: true });
    },
  };
}

export function ownerTransactions(pool: Pool) {
  return {
    async run<T>(_viewer: unknown, work: (client: import('pg').PoolClient) => Promise<T>, readOnly=false): Promise<T> {
      const client=await pool.connect();
      try {await client.query(readOnly?'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY':'BEGIN'); const result=await work(client);await client.query('COMMIT');return result;}
      catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    },
  };
}
