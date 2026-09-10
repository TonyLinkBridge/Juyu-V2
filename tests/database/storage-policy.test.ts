import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { temporaryDatabase } from './fixture.ts';

test('Supabase setup policy blocks private objects even alongside a permissive legacy policy',async()=>{
  const fixture=await temporaryDatabase();const client=await fixture.pool.connect();
  try {
    // Model only the required Storage relations for SQL-policy testing; this is not a Supabase server.
    await client.query(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE SCHEMA storage;
      CREATE TABLE storage.buckets(id text PRIMARY KEY,public boolean NOT NULL);
      CREATE TABLE storage.objects(id integer PRIMARY KEY,bucket_id text REFERENCES storage.buckets(id));
      INSERT INTO storage.buckets VALUES ('juyu-private',false),('other',true);
      INSERT INTO storage.objects VALUES (1,'juyu-private'),(2,'other');
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      GRANT USAGE ON SCHEMA storage TO anon,authenticated;
      GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO anon,authenticated;
      CREATE POLICY legacy_allow ON storage.objects TO anon,authenticated USING(true) WITH CHECK(true);`);
    const policy=await readFile(new URL('../../src/server/storage/supabase-setup/private-bucket-policy.sql',import.meta.url),'utf8');
    await client.query(policy);
    for(const role of ['anon','authenticated']) {
      await client.query(`SET ROLE ${role}`);
      assert.deepEqual((await client.query('SELECT bucket_id FROM storage.objects')).rows,[{bucket_id:'other'}]);
      await assert.rejects(client.query("INSERT INTO storage.objects VALUES (3,'juyu-private')"),{code:'42501'});
      assert.equal((await client.query("DELETE FROM storage.objects WHERE bucket_id='juyu-private'")).rowCount,0);
      await client.query('RESET ROLE');
    }
    await client.query("UPDATE storage.buckets SET public=true WHERE id='juyu-private'");
    await assert.rejects(client.query(policy),/PRIVATE_BUCKET_REQUIRED/);
    await client.query('ROLLBACK');
  } finally {client.release();await fixture.close();}
});
