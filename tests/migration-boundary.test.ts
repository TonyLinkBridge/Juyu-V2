import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import type {Pool} from 'pg';
import {migrate} from '../src/server/database/migrate.ts';

test('legacy operator command stops at its approved version and a repeat is empty',async()=>{
 const script=await readFile('scripts/t063-migrate.ts','utf8');
 assert.match(script,/await migrate\(pool,\{through:'0029_shared_revision_config_locks'\}\)/);
 const applied=new Map<string,string>();
 const checked:string[]=[];
 const client={
  async query(sql:string,params?:string[]){
   if(sql.startsWith('SELECT checksum')){
    const version=params![0];checked.push(version);
    if(version.startsWith('0029'))return {rows:applied.has(version)?[{checksum:applied.get(version)}]:[]};
    const source=await readFile(`src/server/database/migrations/${version}.sql`);
    return {rows:[{checksum:createHash('sha256').update(source).digest('hex')}]};
   }
   if(sql.startsWith('INSERT INTO juyu.schema_migrations'))applied.set(params![0],params![1]);
   return {rows:[]};
  },
  release(){},
 };
 const pool={connect:async()=>client} as unknown as Pool;
 const options={through:'0029_shared_revision_config_locks'} as const;
 assert.deepEqual(await migrate(pool,options),['0029_shared_revision_config_locks']);
 assert.deepEqual(await migrate(pool,options),[]);
 assert.ok(checked.every(version=>version<=options.through));
});
