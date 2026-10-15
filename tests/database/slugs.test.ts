import assert from 'node:assert/strict';
import {after,before,test} from 'node:test';
import {randomBytes,randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
import {ScopedDatabase,type Transactions} from '../../src/server/database/scoped.ts';
import {AuthorizationService} from '../../src/server/authorization/service.ts';
import {publicationPathValue} from '../../src/fumadocs/slugs.ts';
import {articleContentPath} from '../../src/reader/content-path.ts';
import {temporaryDatabase,ownerTransactions} from './fixture.ts';
import {migrate} from '../../src/server/database/migrate.ts';
import {DocumentRepository} from '../../src/server/database/repository.ts';

const actor={id:'admin',role:'admin' as const,companyVerified:true};
let fixture:Awaited<ReturnType<typeof temporaryDatabase>>;
let repository:DocumentRepository;
let runtime:Pool,issuer:Pool,database:ScopedDatabase;
const superAdmin={id:'super',role:'super_admin' as const,companyVerified:true};
const support={id:'support',role:'support' as const,companyVerified:true};
const legacy=[
 {id:'legacy-shop',title:'签约店铺（个人/企业）',slug:'签约店铺（个人-企业）',kind:'article' as const,audience:'staff'},
 {id:'legacy-login',title:'为什么触发强制登录验证？',slug:'为什么触发强制登录验证？',kind:'article' as const,audience:'staff'},
 {id:'legacy-ops',title:'内部／流程（旧版）',slug:'内部／流程（旧版）',kind:'ops' as const,audience:'ops'},
];

before(async()=>{
 fixture=await temporaryDatabase();
 await migrate(fixture.pool,{through:'0052_document_navigation_positions'});
 await fixture.pool.query("INSERT INTO juyu.members(clerk_user_id,display_name,observed_role,verified_email,observed_at) VALUES('admin','Admin','admin','admin@example.test',now()),('super','Super','super_admin','super@example.test',now()),('support','Support','support','support@example.test',now())");
 // Seed pre-slug records, then let the real historical migration derive their URLs.
 const client=await fixture.pool.connect();
 try{
  await client.query('BEGIN');
  for(const item of legacy){
   await client.query("INSERT INTO juyu.documents(id,kind,sequence,lifecycle,workflow_revision_id,workflow_state) VALUES($1,$2,0,'active',1,'draft')",[item.id,item.kind]);
   await client.query("INSERT INTO juyu.revisions(document_id,revision_id,title,body,audience,author_id,editor_id,created_at) VALUES($1,1,$2,'旧版正文',$3,'super','super',now())",[item.id,item.title,item.audience]);
   await client.query("INSERT INTO juyu.audit_log(document_id,sequence,action,actor_id,revision_id,at) VALUES($1,0,'create','super',1,now())",[item.id]);
  }
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 await migrate(fixture.pool);
 repository=new DocumentRepository(ownerTransactions(fixture.pool));
 for(const item of legacy)await repository.execute(item.id,{type:'direct_publish'},superAdmin,{expectedSequence:0});
 const runtimePassword=randomBytes(24).toString('hex'),issuerPassword=randomBytes(24).toString('hex');
 await fixture.pool.query(`CREATE ROLE slug_test_runtime LOGIN PASSWORD '${runtimePassword}' IN ROLE juyu_runtime`);
 await fixture.pool.query(`CREATE ROLE slug_test_issuer LOGIN PASSWORD '${issuerPassword}' IN ROLE juyu_context_issuer`);
 runtime=fixture.connectAs('slug_test_runtime',runtimePassword);issuer=fixture.connectAs('slug_test_issuer',issuerPassword);
 database=new ScopedDatabase(runtime,issuer);
});
after(async()=>{if(runtime)await runtime.end();if(issuer)await issuer.end();if(fixture)await fixture.close();});

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

test('publication slugs use the canonical application rule for fullwidth punctuation',async()=>{
 const document=await repository.create({id:randomUUID(),title:'如何绑定手机认证？',body:'正文',kind:'article',audience:'staff'},actor);
 const row=(await fixture.pool.query<{slug:string}>('SELECT slug FROM juyu.documents WHERE id=$1',[document.id])).rows[0];
 assert.equal(row.slug,'如何绑定手机认证');
});

test('article and OPS routes may use the same slug because they have separate Fumadocs roots',async()=>{
 const article=await repository.create({id:randomUUID(),title:'升级处理',body:'正文',kind:'article',audience:'staff'},actor);
 const ops=await repository.create({id:randomUUID(),title:'升级处理',body:'正文',kind:'ops',audience:'ops'},actor);
 const rows=(await fixture.pool.query<{kind:string;slug:string}>('SELECT kind,slug FROM juyu.documents WHERE id=ANY($1::text[]) ORDER BY kind',[[article.id,ops.id]])).rows;
 assert.deepEqual(rows,[{kind:'article',slug:'升级处理'},{kind:'ops',slug:'升级处理'}]);
});

for(const item of legacy){
 test(`historical migration links resolve to the same published document: ${item.id}`,async()=>{
  const before=(await fixture.pool.query('SELECT slug,sequence,published_revision_id FROM juyu.documents WHERE id=$1',[item.id])).rows[0];
  assert.equal(before.slug,item.slug);
  const reader=new AuthorizationService(database,async()=>item.kind==='ops'?superAdmin:support);
  for(const value of [item.slug,encodeURIComponent(item.slug),item.id]){
   const result=await reader.reader(publicationPathValue(value),item.kind);
   assert.equal(result.article?.id,item.id);
   assert.equal(result.article?.slug,item.slug);
   assert.equal(result.article?.body,'旧版正文');
   assert.equal(result.article?.title,item.title);
  }
  assert.deepEqual((await fixture.pool.query('SELECT slug,sequence,published_revision_id FROM juyu.documents WHERE id=$1',[item.id])).rows[0],before);
 });
}

test('legacy slug compatibility does not bypass section, publication or audience permissions',async()=>{
 const staff=new AuthorizationService(database,async()=>support);
 assert.equal((await staff.reader(publicationPathValue(encodeURIComponent('内部／流程（旧版）')),'ops')).article,null);
 assert.equal((await staff.reader(publicationPathValue(encodeURIComponent('签约店铺（个人-企业）')),'ops')).article,null);
 assert.equal((await staff.reader('不存在的旧文章？','article')).article,null);
 const draft=await repository.create({id:randomUUID(),title:'尚未发布',body:'私有草稿',kind:'article',audience:'staff'},superAdmin);
 assert.equal((await staff.reader(draft.id,'article')).article,null);
 await assert.rejects(new AuthorizationService(database,async()=>null).reader('签约店铺（个人-企业）','article'),/FORBIDDEN/);
 const result=await staff.reader('签约店铺（个人-企业）','article');
 const page=result.pages.find(page=>page.type==='document'&&page.id==='legacy-shop');
 assert.equal(page?.type==='document'?page.href:null,articleContentPath('签约店铺（个人-企业）'));
});

for(const [id,title,original,canonical] of [
 ['legacy-shop','签约店铺（个人/企业）','签约店铺（个人-企业）','签约店铺(个人-企业)'],
 ['legacy-login','为什么触发强制登录验证？','为什么触发强制登录验证？','为什么触发强制登录验证'],
]){
 test(`old and new slug rules cannot resolve the same title to the wrong document: ${id}`,async()=>{
  let current=await repository.create({id:randomUUID(),title,body:'新文章正文',kind:'article',audience:'staff'},superAdmin);
  current=await repository.execute(current.id,{type:'direct_publish'},superAdmin,{expectedSequence:current.sequence});
  const reader=new AuthorizationService(database,async()=>support);
  assert.equal((await reader.reader(publicationPathValue(encodeURIComponent(original)),'article')).article?.id,id);
  assert.equal((await reader.reader(publicationPathValue(encodeURIComponent(canonical)),'article')).article?.id,current.id);
  assert.equal((await fixture.pool.query('SELECT slug FROM juyu.documents WHERE id=$1',[id])).rows[0].slug,original);
 });
}


test('formal article reads its directory, menu and presentation in one authorized snapshot',async()=>{
 let scopes=0;
 const queries:string[]=[];
 const counted:Transactions={async run(viewer,work,readOnly){
  scopes++;
  return database.run(viewer,client=>work(new Proxy(client,{get(target,key,receiver){
   if(key==='query')return (...args:unknown[])=>{if(typeof args[0]==='string')queries.push(args[0]);return Reflect.apply(target.query,target,args);};
   return Reflect.get(target,key,receiver);
  }})),readOnly);
 }};
 const reader=new AuthorizationService(counted,async()=>support);
 const expectedChrome=await new AuthorizationService(database,async()=>support).readerChrome();
 const result=await reader.reader('签约店铺（个人-企业）','article');
 assert.equal(result.article?.id,'legacy-shop');
 assert.deepEqual(result.chrome,expectedChrome);
 assert.equal(scopes,1);
 assert.equal(queries.filter(sql=>sql.includes('read_feature_flags()')).length,1);
 assert.equal(queries.filter(sql=>sql.includes('FROM juyu.read_publication_navigation(')).length,1);
 // Includes seven unchanged feedback/favorite feature and permission queries.
 assert.ok(queries.length<=18,`Repeated directory/flags or metadata round trips returned: ${queries.length}`);
});

test('directory reads skip large bodies when an explicit description already exists',async()=>{
 let document=await repository.create({id:randomUUID(),title:'独立简介检查',description:'已填写的简介',body:'完整正文保留',kind:'article',audience:'staff'},superAdmin);
 document=await repository.execute(document.id,{type:'direct_publish'},superAdmin,{expectedSequence:document.sequence});
 let capturedBody:string|undefined;
 const counted:Transactions={async run(viewer,work,readOnly){
  return database.run(viewer,client=>work(new Proxy(client,{get(target,key,receiver){
   if(key==='query')return async(...args:unknown[])=>{
    const result=await Reflect.apply(target.query,target,args);
    if(typeof args[0]==='string'&&args[0].includes('FROM juyu.read_publication_navigation('))capturedBody=result.rows.find((row:{id:string})=>row.id===document.id)?.body;
    return result;
   };
   return Reflect.get(target,key,receiver);
  }})),readOnly);
 }};
 const result=await new AuthorizationService(counted,async()=>support).reader(document.id,'article');
 assert.equal(capturedBody,'');
 assert.equal(result.article?.body,'完整正文保留');
 const flatten=(nodes:typeof result.pages):Extract<typeof nodes[number],{type:'document'}>[]=>nodes.flatMap(node=>node.type==='group'?flatten(node.descendants):[node]);
 assert.equal(flatten(result.pages).find(page=>page.id===document.id)?.description,'已填写的简介');
 assert.equal(flatten(result.pages).find(page=>page.id==='legacy-login')?.description,'旧版正文');
});

test('repeated reads recheck each viewer and the latest publication instead of sharing cached access',async()=>{
 let document=await repository.create({id:randomUUID(),title:'权限实时检查（内部）',body:'内部原文',kind:'article',audience:'ops'},superAdmin);
 document=await repository.execute(document.id,{type:'direct_publish'},superAdmin,{expectedSequence:document.sequence});
 let viewer:typeof support|typeof superAdmin=support;
 const reader=new AuthorizationService(database,async()=>viewer);
 assert.equal((await reader.reader(document.id,'article')).article,null);
 viewer=superAdmin;
 assert.equal((await reader.reader(document.id,'article')).article?.body,'内部原文');
 document=await repository.execute(document.id,{type:'edit',title:'权限实时检查（已更新）',body:'内部新正文',audience:'ops'},superAdmin,{expectedSequence:document.sequence});
 await repository.execute(document.id,{type:'direct_publish'},superAdmin,{expectedSequence:document.sequence});
 const updated=await reader.reader(document.id,'article');
 assert.equal(updated.article?.body,'内部新正文');
 viewer=support;
 assert.equal((await reader.reader(document.id,'article')).article,null);
});

test('directory projection emits only current publications rather than historical revisions',async()=>{
 let document=await repository.create({id:randomUUID(),title:'历史目录查询',body:'正式正文',kind:'article',audience:'staff'},superAdmin);
 document=await repository.execute(document.id,{type:'direct_publish'},superAdmin,{expectedSequence:document.sequence});
 for(let revision=0;revision<40;revision++)document=await repository.execute(document.id,{type:'edit',title:`历史目录草稿 ${revision}`,body:'不应进入目录的草稿',audience:'staff'},superAdmin,{expectedSequence:document.sequence});
 let directoryRows=0,directoryLoops=0,readablePublications=0;
 const inspected:Transactions={async run(viewer,work,readOnly){
  return database.run(viewer,async client=>{
   readablePublications=Number((await client.query('SELECT count(*) AS n FROM juyu.revisions WHERE juyu.can_read_revision(document_id,revision_id)')).rows[0].n);
   return work(new Proxy(client,{get(target,key,receiver){
    if(key==='query')return async(...args:unknown[])=>{
     if(typeof args[0]==='string'&&args[0].includes('FROM juyu.read_publication_navigation(')){
      const plan=(await target.query('EXPLAIN (ANALYZE,FORMAT JSON) '+args[0],args[1] as unknown[])).rows[0]['QUERY PLAN'][0].Plan;
      const visit=(node:Record<string,unknown>)=>{if(node['Function Name']==='read_publication_navigation'){directoryRows+=Number(node['Actual Rows']);directoryLoops+=Number(node['Actual Loops']);}for(const child of (node.Plans??[]) as Record<string,unknown>[])visit(child);};visit(plan);
     }
     return Reflect.apply(target.query,target,args);
    };
    return Reflect.get(target,key,receiver);
   }}));
  },readOnly);
 }};
 const result=await new AuthorizationService(inspected,async()=>superAdmin).reader(document.id,'article');
 assert.equal(result.article?.title,'历史目录查询');
 assert.equal(result.article?.body,'正式正文');
 assert.equal(directoryLoops,1,'One authorized directory projection per read');
 assert.equal(directoryRows,readablePublications,'Historical revisions must not enter the directory payload');
});

test('the compact directory projection exposes only current authorized publications and their original metadata',async()=>{
 const rows=await database.run(support,async client=>(await client.query('SELECT * FROM juyu.read_publication_navigation($1)',['zh-CN'])).rows,true);
 assert.ok(rows.some(row=>row.id==='legacy-shop'&&row.slug==='签约店铺（个人-企业）'&&row.body==='旧版正文'));
 assert.ok(rows.some(row=>row.id==='legacy-login'&&row.slug==='为什么触发强制登录验证？'));
 assert.equal(rows.some(row=>row.id==='legacy-ops'),false);
 assert.equal(rows.some(row=>row.title.startsWith('历史目录草稿')),false);
 assert.equal(rows.some(row=>row.title.startsWith('权限实时检查')),false);
 await database.run(support,async client=>{
  assert.equal((await client.query("SELECT count(*)::int AS n FROM juyu.documents")).rows[0].n,0);
 },true);
 assert.equal((await fixture.pool.query("SELECT has_function_privilege('public','juyu.read_publication_navigation(text)','EXECUTE') AS granted")).rows[0].granted,false);
});
