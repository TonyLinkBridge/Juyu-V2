import assert from 'node:assert/strict';
import {after,before,test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {temporaryDatabase,ownerTransactions} from './fixture.ts';
import {migrate} from '../../src/server/database/migrate.ts';
import {DocumentRepository} from '../../src/server/database/repository.ts';

const actor={id:'admin',role:'admin' as const,companyVerified:true};
let fixture:Awaited<ReturnType<typeof temporaryDatabase>>;
let repository:DocumentRepository;

before(async()=>{
 fixture=await temporaryDatabase();
 await migrate(fixture.pool);
 await fixture.pool.query("INSERT INTO juyu.members(clerk_user_id,display_name) VALUES('admin','Admin')");
 repository=new DocumentRepository(ownerTransactions(fixture.pool));
});
after(async()=>{if(fixture)await fixture.close();});

test('new publications receive unique stable page slugs while title edits keep their URL',async()=>{
 const first=await repository.create({id:randomUUID(),title:'普通会员',body:'正文',kind:'article',audience:'staff'},actor);
 const second=await repository.create({id:randomUUID(),title:'普通会员',body:'正文',kind:'article',audience:'staff'},actor);
 const rows=(await fixture.pool.query<{id:string;slug:string}>('SELECT id,slug FROM juyu.documents WHERE id=ANY($1::text[]) ORDER BY id',[[first.id,second.id]])).rows;
 const slugs=new Map(rows.map(row=>[row.id,row.slug]));
 assert.equal(slugs.get(first.id),'普通会员');
 assert.equal(slugs.get(second.id),'普通会员-2');
 await repository.execute(first.id,{type:'edit',title:'普通会员新标题',body:'正文',audience:'staff'},actor,{expectedSequence:first.sequence});
 assert.equal((await fixture.pool.query('SELECT slug FROM juyu.documents WHERE id=$1',[first.id])).rows[0].slug,'普通会员');
});

test('article and OPS routes may use the same slug because they have separate Fumadocs roots',async()=>{
 const article=await repository.create({id:randomUUID(),title:'升级处理',body:'正文',kind:'article',audience:'staff'},actor);
 const ops=await repository.create({id:randomUUID(),title:'升级处理',body:'正文',kind:'ops',audience:'ops'},actor);
 const rows=(await fixture.pool.query<{kind:string;slug:string}>('SELECT kind,slug FROM juyu.documents WHERE id=ANY($1::text[]) ORDER BY kind',[[article.id,ops.id]])).rows;
 assert.deepEqual(rows,[{kind:'article',slug:'升级处理'},{kind:'ops',slug:'升级处理'}]);
});
