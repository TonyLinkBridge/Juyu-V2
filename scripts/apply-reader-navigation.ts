/** Explicit operator entry point; adds a read-only, permission-filtered projection. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {Pool} from 'pg';
import {migrate} from '../src/server/database/migrate.ts';

const env=parseEnv(await readFile('.env.local','utf8'));
const ref='zscxaqjqjoouiolkoxbi';
assert.equal(new URL(env.NEXT_PUBLIC_SUPABASE_URL??'https://invalid.local').hostname,`${ref}.supabase.co`);
assert.ok(env.JUYU_DATABASE_ADMIN_PASSWORD&&env.JUYU_DATABASE_CA_CERT,'MISSING_CONFIGURATION');
const pool=new Pool({host:'aws-0-ap-southeast-1.pooler.supabase.com',port:5432,user:`postgres.${ref}`,password:env.JUYU_DATABASE_ADMIN_PASSWORD,database:'postgres',ssl:{rejectUnauthorized:true,ca:env.JUYU_DATABASE_CA_CERT},max:1,connectionTimeoutMillis:10000,statement_timeout:20000});
try{
 const latest=(await pool.query<{version:string}>('SELECT version FROM juyu.schema_migrations ORDER BY version DESC LIMIT 1')).rows[0]?.version;
 assert.ok(latest==='0056_developers'||latest==='0057_reader_navigation','UNEXPECTED_SCHEMA');
 console.log(JSON.stringify({project:ref,latest,pending:latest!=='0057_reader_navigation'}));
 if(process.argv.includes('--apply')){
  const applied=await migrate(pool,{through:'0057_reader_navigation'});
  assert.ok(applied.length===0||(applied.length===1&&applied[0]==='0057_reader_navigation'),'UNEXPECTED_MIGRATION');
  const verified=(await pool.query("SELECT to_regprocedure('juyu.read_publication_navigation(text)') IS NOT NULL AND NOT has_function_privilege('public','juyu.read_publication_navigation(text)','EXECUTE') AS safe")).rows[0]?.safe;
  assert.equal(verified,true);
  console.log(JSON.stringify({applied,verified}));
 }
}catch{console.error('READER_NAVIGATION_MIGRATION_FAILED');process.exitCode=1;}finally{await pool.end();}
