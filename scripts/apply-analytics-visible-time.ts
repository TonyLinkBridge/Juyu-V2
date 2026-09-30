/** Explicit production migration for the visible article time. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {Pool} from 'pg';
import {migrate} from '../src/server/database/migrate.ts';

const env=parseEnv(await readFile('.env.local','utf8'));
const ref='zscxaqjqjoouiolkoxbi';
assert.equal(new URL(env.NEXT_PUBLIC_SUPABASE_URL??'https://invalid.local').hostname,`${ref}.supabase.co`);
assert.ok(env.JUYU_DATABASE_ADMIN_PASSWORD&&env.JUYU_DATABASE_CA_CERT,'MISSING_CONFIGURATION');
const pool=new Pool({
 host:'aws-0-ap-southeast-1.pooler.supabase.com',port:5432,user:`postgres.${ref}`,
 password:env.JUYU_DATABASE_ADMIN_PASSWORD,database:'postgres',
 ssl:{rejectUnauthorized:true,ca:env.JUYU_DATABASE_CA_CERT},
 max:1,connectionTimeoutMillis:10000,statement_timeout:20000,
});
try{
 const versions=(await pool.query<{version:string}>('SELECT version FROM juyu.schema_migrations ORDER BY version')).rows.map(row=>row.version);
 assert.ok(['0054_slack_outbox','0055_analytics_visible_time'].includes(versions.at(-1)??''),'UNEXPECTED_SCHEMA');
 console.log(JSON.stringify({project:ref,latest:versions.at(-1),pending:!versions.includes('0055_analytics_visible_time')}));
 if(process.argv.includes('--apply')){
  const applied=await migrate(pool,{through:'0055_analytics_visible_time'});
  assert.ok(applied.length===0||(applied.length===1&&applied[0]==='0055_analytics_visible_time'),'UNEXPECTED_MIGRATION');
  const verified=(await pool.query<{installed:boolean}>("SELECT to_regclass('juyu.analytics_visible_time') IS NOT NULL AS installed")).rows[0]?.installed;
  assert.equal(verified,true);
  console.log(JSON.stringify({applied,verified}));
 }
}catch(error){
 console.error(error instanceof Error&&/^[A-Z_]+(?:: [a-z0-9_]+)?$/.test(error.message)?error.message:'ANALYTICS_MIGRATION_FAILED');
 process.exitCode=1;
}finally{await pool.end();}
