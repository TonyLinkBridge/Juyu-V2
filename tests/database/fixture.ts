import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import EmbeddedPostgres from 'embedded-postgres';
import { Pool } from 'pg';

const rawPoolEnds=new WeakMap<Pool,()=>Promise<void>>();
const poolEndings=new WeakMap<Pool,Promise<void>>();

export function endPool(pool:Pool):Promise<void>{
 const existing=poolEndings.get(pool);if(existing)return existing;
 const target=pool.totalCount;
 let removed=0,resolveRemoved:()=>void=()=>{};
 const removedAll=target===0?Promise.resolve():new Promise<void>(resolve=>{resolveRemoved=resolve;});
 const onRemove=()=>{removed++;if(removed>=target)resolveRemoved();};
 pool.on('remove',onRemove);
 const rawEnd=rawPoolEnds.get(pool)??pool.end.bind(pool);
 const ending=(async()=>{try{await rawEnd();await removedAll;}finally{pool.off('remove',onRemove);}})();
 poolEndings.set(pool,ending);return ending;
}

function trackedPool(options:ConstructorParameters<typeof Pool>[0]){
 const pool=new Pool(options),rawEnd=pool.end.bind(pool);rawPoolEnds.set(pool,rawEnd);
 pool.end=((callback?:((error?:Error)=>void))=>{const ending=endPool(pool);if(callback){void ending.then(()=>callback(),error=>callback(error instanceof Error?error:new Error(String(error))));return;}return ending;}) as Pool['end'];
 return pool;
}

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
  const pools=new Set<Pool>();
  const pool = trackedPool({ host: '127.0.0.1', port, user: 'postgres', password, database: 'postgres', max: 8, connectionTimeoutMillis: 5000 });pools.add(pool);
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
    connectAs(user: string, password: string) { const connected=trackedPool({ host: '127.0.0.1', port, user, password, database: 'postgres', max: 4, connectionTimeoutMillis: 5000 });pools.add(connected);return connected; },
    async close() {
      await Promise.all([...pools].map(endPool));
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
