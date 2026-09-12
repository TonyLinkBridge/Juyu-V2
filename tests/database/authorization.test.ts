import {readFile} from 'node:fs/promises';
import {storageFixture} from '../storage/http-fixture.ts';
import {SupabasePrivateStorage} from '../../src/server/storage/supabase.ts';
import {uploadFile} from '../../src/server/media/upload.ts';
import {deliverAsset} from '../../src/server/storage/delivery.ts';
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { Pool } from 'pg';
import { randomBytes } from 'node:crypto';
import { temporaryDatabase, ownerTransactions } from './fixture.ts';
import { migrate } from '../../src/server/database/migrate.ts';
import { DocumentRepository } from '../../src/server/database/repository.ts';
import { ScopedDatabase } from '../../src/server/database/scoped.ts';
import { AuthorizationService } from '../../src/server/authorization/service.ts';
import type { Viewer } from '../../src/domain/model.ts';

let fixture: Awaited<ReturnType<typeof temporaryDatabase>>;
let runtime: Pool, issuer: Pool, db: ScopedDatabase, owner: DocumentRepository;
const a: Viewer = { id:'a', role:'admin', companyVerified:true }, b: Viewer = {...a,id:'b'};
const support: Viewer = { id:'support',role:'support',companyVerified:true };
const ops: Viewer = { id:'ops',role:'ops',companyVerified:true };
test('home snapshot includes only published content allowed to this reader',async()=>{
 const home=await new AuthorizationService(db,async()=>support).home();
 assert.ok(home.latest.some(item=>item.id==='regular'));
 assert.ok(home.latest.every(item=>item.id!=='internal'&&item.id!=='draft'));
 assert.ok(home.menu.every(item=>!item.href.includes('/ops')));
 await assert.rejects(new AuthorizationService(db,async()=>null).home(),/FORBIDDEN/);
});
let regular: string, internal: string, draftId: string;
async function published(id: string, kind: 'article'|'ops'='article') {
  let doc=await owner.create({id,kind,title:`title-${id}`,body:`body-${id}`,audience:kind==='ops'?'ops':'staff'},a);
  for (const type of ['submit','approve','queue','publish'] as const) doc=await owner.execute(id,{type},type==='approve'?b:a,{expectedSequence:doc.sequence,reviewer:b});
  return doc.id;
}
before(async()=>{
  fixture=await temporaryDatabase();
  await migrate(fixture.pool);
  await fixture.pool.query("INSERT INTO juyu.members(clerk_user_id,display_name,observed_role) VALUES ('a','A','admin'),('b','B','admin'),('support','Support','support'),('ops','Ops','ops')");
  // Editor configuration now requires the verified enrollment facts promised by a/b Viewer fixtures.
  await fixture.pool.query("UPDATE juyu.members SET verified_email=clerk_user_id||'@example.test',observed_at=now() WHERE clerk_user_id IN ('a','b','support','ops')");
  owner=new DocumentRepository(ownerTransactions(fixture.pool));
  regular=await published('regular'); internal=await published('internal','ops');
  draftId=(await owner.create({id:'draft',kind:'article',title:'secret draft',body:'hidden',audience:'staff'},a)).id;
  // Separate actual logins: neither inherits the other capability or migration ownership.
  const runtimePassword=randomBytes(24).toString('hex'), issuerPassword=randomBytes(24).toString('hex');
  await fixture.pool.query(`CREATE ROLE test_runtime LOGIN PASSWORD '${runtimePassword}' IN ROLE juyu_runtime`);
  await fixture.pool.query(`CREATE ROLE test_issuer LOGIN PASSWORD '${issuerPassword}' IN ROLE juyu_context_issuer`);
  runtime=fixture.connectAs('test_runtime',runtimePassword); issuer=fixture.connectAs('test_issuer',issuerPassword);
  db=new ScopedDatabase(runtime,issuer);
});
after(async()=>{ if(runtime)await runtime.end(); if(issuer)await issuer.end(); if(fixture)await fixture.close(); });

test('restricted runtime without context or with forged claims reads nothing',async()=>{
  const client=await runtime.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('request.jwt.claims','{\"role\":\"admin\"}',true),set_config('juyu.role','admin',true),set_config('juyu.token','forged',true)");
    assert.equal((await client.query('SELECT count(*)::int AS n FROM juyu.revisions')).rows[0].n,0);
    await assert.rejects(client.query("INSERT INTO juyu.request_contexts(token_hash,backend_pid,member_id,role,expires_at) VALUES ('x',pg_backend_pid(),'support','admin',now()+interval '1 minute')"),{code:'42501'});
  } finally {await client.query('ROLLBACK');client.release();}
  await assert.rejects(runtime.query('SET ROLE juyu_context_issuer'),{code:'42501'});
  await assert.rejects(runtime.query('TRUNCATE juyu.revisions'),{code:'42501'});
});

test('Support and Ops can only read their permitted published versions',async()=>{
  const service=new AuthorizationService(db,async()=>support);
  assert.equal((await service.article(regular))?.body,'body-regular');
  assert.equal(await service.article(internal),null);
  assert.equal(await service.article(draftId),null);
  assert.equal((await new AuthorizationService(db,async()=>ops).article(internal))?.body,'body-internal');
  await assert.rejects(service.management(regular),/FORBIDDEN/);
  const rows=await db.run(support,client=>client.query('SELECT title FROM juyu.revisions'));
  assert.deepEqual(rows.rows,[{title:'title-regular'}]);
  assert.equal((await db.run(support,client=>client.query('SELECT count(*)::int AS n FROM juyu.documents'))).rows[0].n,0);
});

test('Admin uses the same restricted connection for the complete secondary review transaction',async()=>{
  const repo=new DocumentRepository(db);
  let doc=await repo.create({id:'runtime-created',kind:'article',title:'runtime',body:'body',audience:'staff'},a);
  doc=await repo.execute(doc.id,{type:'submit'},a,{expectedSequence:doc.sequence,reviewer:b});
  await assert.rejects(repo.execute(doc.id,{type:'approve'},a,{expectedSequence:doc.sequence}),/NOT_REVIEWER/);
  for(const type of ['approve','queue','publish'] as const) doc=await repo.execute(doc.id,{type},type==='approve'?b:a,{expectedSequence:doc.sequence});
  assert.equal(doc.workflow.status,'published');
});

test('disabled membership and newly downgraded role are enforced on the next request',async()=>{
  await fixture.pool.query("UPDATE juyu.members SET disabled_at=now() WHERE clerk_user_id='support'");
  try {assert.equal(await new AuthorizationService(db,async()=>support).article(regular),null);}
  finally {await fixture.pool.query("UPDATE juyu.members SET disabled_at=null WHERE clerk_user_id='support'");}
  await assert.rejects(new AuthorizationService(db,async()=>({...a,role:'support'})).management(regular),/FORBIDDEN/);
  await assert.rejects(db.run({...support,companyVerified:false},client=>client.query('SELECT 1')),/FORBIDDEN/);
});

test('context is removed on success/failure and pooled connections cannot retain another identity',async()=>{
  const limits=await db.run(a,client=>client.query("SELECT current_setting('lock_timeout') AS lock, current_setting('statement_timeout') AS statement, current_setting('idle_in_transaction_session_timeout') AS idle"));
  assert.deepEqual(limits.rows[0],{lock:'5s',statement:'15s',idle:'20s'});
  await assert.rejects(db.run(a,()=>{throw new Error('injected');}),/injected/);
  assert.equal((await fixture.pool.query('SELECT count(*)::int AS n FROM juyu.request_contexts')).rows[0].n,0);
  assert.equal((await runtime.query('SELECT count(*)::int AS n FROM juyu.revisions')).rows[0].n,0);
});

test('database owner and bypass credentials cannot be used by the production authorization boundary',async()=>{
  await assert.rejects(new ScopedDatabase(fixture.pool,issuer).run(a,client=>client.query('SELECT 1')),/UNSAFE_DATABASE_ROLE/);
});

test('personal records hide other employees and disappear when the document is taken offline',async()=>{
  await fixture.pool.query("INSERT INTO juyu.favorites(member_id,document_id) VALUES ('support',$1),('ops',$1)",[regular]);
  assert.deepEqual((await db.run(support,client=>client.query('SELECT member_id FROM juyu.favorites'))).rows,[{member_id:'support'}]);
  await fixture.pool.query("UPDATE juyu.documents SET lifecycle='archived' WHERE id=$1",[regular]);
  try {
    assert.equal((await db.run(support,client=>client.query('SELECT count(*)::int AS n FROM juyu.favorites'))).rows[0].n,0);
    assert.equal(await new AuthorizationService(db,async()=>support).article(regular),null);
  } finally {await fixture.pool.query("UPDATE juyu.documents SET lifecycle='active' WHERE id=$1",[regular]);}
});


test('member row locks do not grant administrators a direct member-update bypass',async()=>{
  await assert.rejects(db.run(a,client=>client.query("UPDATE juyu.members SET display_name='changed' WHERE clerk_user_id='a'")),{code:'42501'});
  assert.equal((await fixture.pool.query("SELECT display_name FROM juyu.members WHERE clerk_user_id='a'")).rows[0].display_name,'A');
});

test('category ancestor restrictions and cycles fail closed for readers',async()=>{
  const {randomUUID}=await import('node:crypto');
  const parent=randomUUID(),child=randomUUID();
  await fixture.pool.query("INSERT INTO juyu.categories(id,name,audience) VALUES ($1,'运营组','ops')",[parent]);
  await fixture.pool.query("INSERT INTO juyu.categories(id,name,parent_id) VALUES ($1,'子目录',$2)",[child,parent]);
  await fixture.pool.query('INSERT INTO juyu.revision_categories(document_id,revision_id,category_id) VALUES ($1,1,$2)',[regular,child]);
  try {
    assert.equal(await new AuthorizationService(db,async()=>support).article(regular),null);
    assert.ok(await new AuthorizationService(db,async()=>ops).article(regular));
    await fixture.pool.query('UPDATE juyu.categories SET parent_id=$2 WHERE id=$1',[parent,child]);
    assert.equal(await new AuthorizationService(db,async()=>ops).article(regular),null);
  } finally {await fixture.pool.query('DELETE FROM juyu.revision_categories WHERE category_id=$1',[child]);}
});

test('attachments require a ready object attached to the permitted current publication',async()=>{
  const {randomUUID}=await import('node:crypto');
  const staffAsset=randomUUID(),opsAsset=randomUUID(),draftAsset=randomUUID();
  for(const [asset,document] of [[staffAsset,regular],[opsAsset,internal],[draftAsset,draftId]]) {
    await fixture.pool.query("INSERT INTO juyu.assets(id,document_id,uploaded_by,filename,mime_type,byte_size,object_key,status) VALUES ($1,$2,'a','file.pdf','application/pdf',1,$3,'ready')",[asset,document,asset]);
    await fixture.pool.query('INSERT INTO juyu.revision_assets(document_id,revision_id,asset_id) VALUES ($1,1,$2)',[document,asset]);
  }
  const service=new AuthorizationService(db,async()=>support);
  assert.ok(await service.asset(staffAsset));assert.equal(await service.asset(opsAsset),null);assert.equal(await service.asset(draftAsset),null);
  await fixture.pool.query("UPDATE juyu.assets SET status='quarantined' WHERE id=$1",[staffAsset]);
  assert.equal(await service.asset(staffAsset),null);
  assert.equal(await service.asset(randomUUID()),null);
});

test('a raw runtime write cannot impersonate the assigned second reviewer',async()=>{
  const repo=new DocumentRepository(db);
  let doc=await repo.create({id:'review-forgery',kind:'article',title:'review',body:'body',audience:'staff'},a);
  doc=await repo.execute(doc.id,{type:'submit'},a,{expectedSequence:doc.sequence,reviewer:b});
  await assert.rejects(db.run(a,client=>client.query("UPDATE juyu.reviews SET status='approved',decided_by='b',decided_at=now() WHERE document_id=$1",[doc.id])),{code:'42501'});
});


test('issuer credentials must also be restricted and cannot be the owner',async()=>{
  await assert.rejects(new ScopedDatabase(runtime,fixture.pool).run(a,client=>client.query('SELECT 1')),/UNSAFE_DATABASE_ROLE/);
});

test('schema CREATE privileges are rejected for runtime connections',async()=>{
  await fixture.pool.query('GRANT CREATE ON SCHEMA juyu TO test_runtime');
  try {await assert.rejects(db.run(a,client=>client.query('SELECT 1')),/UNSAFE_DATABASE_ROLE/);}
  finally {await fixture.pool.query('REVOKE CREATE ON SCHEMA juyu FROM test_runtime');}
});

test('stolen transaction token cannot authorize a different database connection',async()=>{
  await db.run(a,async client=>{
    const token=(await client.query("SELECT current_setting('juyu.token') AS token")).rows[0].token;
    const other=await runtime.connect();
    try {
      await other.query('BEGIN');
      await other.query("SELECT set_config('juyu.token',$1,true)",[token]);
      assert.equal((await other.query('SELECT count(*)::int AS n FROM juyu.revisions')).rows[0].n,0);
    } finally {await other.query('ROLLBACK');other.release();}
  });
});

test('an expired context stops authorizing further statements',async()=>{
  await db.run(a,async client=>{
    const pid=(await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    await fixture.pool.query("UPDATE juyu.request_contexts SET expires_at=created_at+interval '1 millisecond' WHERE backend_pid=$1",[pid]);
    await new Promise(resolve=>setTimeout(resolve,10));
    assert.equal((await client.query('SELECT count(*)::int AS n FROM juyu.revisions')).rows[0].n,0);
  });
});

test('file byte requests recheck real database permissions after role downgrade, unpublish and revision replacement',async()=>{
  const {storageFixture}=await import('../storage/http-fixture.ts');
  const {SupabasePrivateStorage}=await import('../../src/server/storage/supabase.ts');
  const {deliverAsset}=await import('../../src/server/storage/delivery.ts');
  const {randomUUID}=await import('node:crypto');
  const files=await storageFixture();
  const store=new SupabasePrivateStorage(files.url,'test-only-key',{allowLoopback:true});
  try {
    const document=await published('byte-ops','ops'),id=randomUUID(),bytes=Buffer.from('protected actual bytes');
    await store.put(id,new Blob([bytes]).stream(),'application/pdf');
    await fixture.pool.query("INSERT INTO juyu.assets(id,document_id,uploaded_by,filename,mime_type,byte_size,object_key,status) VALUES ($1,$2,'a','file.pdf','application/pdf',$3,$4,'ready')",[id,document,bytes.length,id]);
    await fixture.pool.query('INSERT INTO juyu.revision_assets(document_id,revision_id,asset_id) VALUES ($1,1,$2)',[document,id]);
    let viewer=ops;const service=new AuthorizationService(db,async()=>viewer);
    const request=()=>deliverAsset(new Request('http://local/file'),id,x=>service.asset(x),store);
    assert.deepEqual(Buffer.from(await (await request()).arrayBuffer()),bytes);
    viewer=support;const reads=files.reads;
    assert.equal((await request()).status,404);assert.equal(files.reads,reads);
    viewer=ops;await fixture.pool.query("UPDATE juyu.documents SET lifecycle='archived' WHERE id=$1",[document]);
    assert.equal((await request()).status,404);assert.equal(files.reads,reads);
    await fixture.pool.query("UPDATE juyu.documents SET lifecycle='active' WHERE id=$1",[document]);
    let doc=(await owner.getForManagement(document,a))!;
    doc=await owner.execute(document,{type:'edit',title:'new',body:'new',audience:'ops'},a,{expectedSequence:doc.sequence});
    // This fixture explicitly removes an attachment; ordinary edits now preserve it.
    await fixture.pool.query('DELETE FROM juyu.revision_assets WHERE document_id=$1 AND revision_id=$2 AND asset_id=$3',[document,doc.workflow.revisionId,id]);
    // Old formal version stays readable while the new revision is a draft.
    assert.equal((await request()).status,200);
    for(const type of ['submit','approve','queue','publish'] as const)doc=await owner.execute(document,{type},type==='approve'?b:a,{expectedSequence:doc.sequence,reviewer:b});
    const before=files.reads;assert.equal((await request()).status,404);assert.equal(files.reads,before);
  } finally {await files.close();}
});

test('reader navigation exposes only permitted published titles, including for Admin',async()=>{
  const staffPages=await new AuthorizationService(db,async()=>support).navigation();
  assert.ok(staffPages.some(page=>page.id===regular));
  assert.ok(!staffPages.some(page=>page.id===internal||page.id===draftId));
  for(const viewer of [ops,a]) {
    const pages=await new AuthorizationService(db,async()=>viewer).navigation();
    assert.ok(pages.some(page=>page.id===internal));
    assert.ok(!pages.some(page=>page.id===draftId));
    assert.ok(pages.every(page=>Object.keys(page).sort().join(',')==='href,id,title'));
  }
  await assert.rejects(new AuthorizationService(db,async()=>null).navigation(),/FORBIDDEN/);
});

test('navigation retains the formal title during edits and removes offline documents',async()=>{
  const id=await published('nav-edit');
  const original=(await owner.getForManagement(id,a))!;
  await owner.execute(id,{type:'edit',title:'private next title',body:'private body',audience:'staff'},a,{expectedSequence:original.sequence});
  for(const viewer of [support,a]) {
    const pages=await new AuthorizationService(db,async()=>viewer).navigation();
    assert.equal(pages.find(page=>page.id===id)?.title,'title-nav-edit');
    assert.doesNotMatch(JSON.stringify(pages),/private next title|private body/);
  }
  await fixture.pool.query("UPDATE juyu.documents SET lifecycle='archived' WHERE id=$1",[id]);
  assert.ok(!(await new AuthorizationService(db,async()=>a).navigation()).some(page=>page.id===id));
});

test('navigation honors restricted and disabled category ancestors before sending titles',async()=>{
  const {randomUUID}=await import('node:crypto');const parent=randomUUID(),child=randomUUID();
  const id=await published('nav-category');
  await fixture.pool.query("INSERT INTO juyu.categories(id,name,audience) VALUES ($1,'private category','ops')",[parent]);
  await fixture.pool.query("INSERT INTO juyu.categories(id,name,parent_id) VALUES ($1,'child',$2)",[child,parent]);
  await fixture.pool.query('INSERT INTO juyu.revision_categories(document_id,revision_id,category_id) VALUES ($1,1,$2)',[id,child]);
  assert.ok(!(await new AuthorizationService(db,async()=>support).navigation()).some(page=>page.id===id));
  assert.ok((await new AuthorizationService(db,async()=>ops).navigation()).some(page=>page.id===id));
  await fixture.pool.query('UPDATE juyu.categories SET enabled=false WHERE id=$1',[parent]);
  assert.ok(!(await new AuthorizationService(db,async()=>a).navigation()).some(page=>page.id===id));
});

test('group tree uses formal memberships and stable IDs, then responds to rename, order and disabled ancestors',async()=>{
 const {randomUUID}=await import('node:crypto');const root=randomUUID(),child=randomUUID(),other=randomUUID(),draftGroup=randomUUID();
 const id=await published('tree-formal');
 await fixture.pool.query("INSERT INTO juyu.categories(id,name,position) VALUES ($1,'tree root',8),($2,'tree other',1),($3,'draft-only category',0)",[root,other,draftGroup]);
 await fixture.pool.query("INSERT INTO juyu.categories(id,name,parent_id) VALUES ($1,'tree child',$2)",[child,root]);
 await fixture.pool.query('INSERT INTO juyu.revision_categories(document_id,revision_id,category_id) VALUES ($1,1,$2)',[id,child]);
 let tree=await new AuthorizationService(db,async()=>support).navigationTree();
 const {selectTreePage}=await import('../../src/reader/tree.ts');
 assert.equal(selectTreePage(tree,id)?.title,'title-tree-formal');
 assert.match(JSON.stringify(tree),/tree root/);assert.match(JSON.stringify(tree),/tree child/);
 assert.doesNotMatch(JSON.stringify(tree),/tree other|draft-only category/);
 const original=(await owner.getForManagement(id,a))!;
 const edited=await owner.execute(id,{type:'edit',title:'tree secret draft',body:'secret',audience:'staff'},a,{expectedSequence:original.sequence});
 await fixture.pool.query('INSERT INTO juyu.revision_categories(document_id,revision_id,category_id) VALUES ($1,$2,$3)',[id,edited.workflow.revisionId,draftGroup]);
 tree=await new AuthorizationService(db,async()=>a).navigationTree();
 assert.doesNotMatch(JSON.stringify(tree),/tree secret draft|draft-only category/);
 await fixture.pool.query("UPDATE juyu.categories SET name='renamed root' WHERE id=$1",[root]);
 tree=await new AuthorizationService(db,async()=>support).navigationTree();
 assert.ok(tree.some(n=>n.id===root&&n.title==='renamed root'));assert.equal(selectTreePage(tree,id)?.title,'title-tree-formal');
 const id2=await published('tree-second');
 await fixture.pool.query('INSERT INTO juyu.revision_categories(document_id,revision_id,category_id) VALUES ($1,1,$2)',[id2,other]);
 tree=await new AuthorizationService(db,async()=>support).navigationTree();
 assert.ok(tree.findIndex(n=>n.id===other)<tree.findIndex(n=>n.id===root));
 await fixture.pool.query('UPDATE juyu.categories SET position=0 WHERE id=$1',[root]);
 tree=await new AuthorizationService(db,async()=>support).navigationTree();
 assert.ok(tree.findIndex(n=>n.id===root)<tree.findIndex(n=>n.id===other));
 await fixture.pool.query('UPDATE juyu.categories SET enabled=false WHERE id=$1',[root]);
 for(const viewer of [support,ops,a]) {
   tree=await new AuthorizationService(db,async()=>viewer).navigationTree();
   assert.equal(selectTreePage(tree,id),null);assert.doesNotMatch(JSON.stringify(tree),/renamed root|tree child/);
 }
});

test('group tree reveals no restricted category names and does not escape restrictions through a second membership',async()=>{
 const {randomUUID}=await import('node:crypto');const staff=randomUUID(),privateGroup=randomUUID();
 const id=await published('tree-private');
 await fixture.pool.query("INSERT INTO juyu.categories(id,name,audience) VALUES ($1,'staff group','staff'),($2,'private OPS name','ops')",[staff,privateGroup]);
 for(const category of [staff,privateGroup])await fixture.pool.query('INSERT INTO juyu.revision_categories(document_id,revision_id,category_id) VALUES ($1,1,$2)',[id,category]);
 const {selectTreePage}=await import('../../src/reader/tree.ts');
 const supportTree=await new AuthorizationService(db,async()=>support).navigationTree();
 assert.equal(selectTreePage(supportTree,id),null);assert.doesNotMatch(JSON.stringify(supportTree),/private OPS name|tree-private/);
 const opsTree=await new AuthorizationService(db,async()=>ops).navigationTree();assert.ok(selectTreePage(opsTree,id));
 assert.equal(JSON.stringify(opsTree).split('"id":"tree-private"').length-1,1);
 await fixture.pool.query("UPDATE juyu.documents SET lifecycle='trashed' WHERE id=$1",[id]);
 assert.equal(selectTreePage(await new AuthorizationService(db,async()=>a).navigationTree(),id),null);
 await assert.rejects(new AuthorizationService(db,async()=>null).navigationTree(),/FORBIDDEN/);
});

test('reader snapshot joins authorized directory with only the current formal body',async()=>{
 const id=await published('reader-snapshot');
 const original=(await owner.getForManagement(id,a))!;
 await owner.execute(id,{type:'edit',title:'private future heading',body:'# private future body',audience:'ops'},a,{expectedSequence:original.sequence});
 for(const viewer of [support,a]){
   const snapshot=await new AuthorizationService(db,async()=>viewer).reader(id);
   assert.deepEqual(snapshot.article,{id,title:'title-reader-snapshot',revision:1,body:'body-reader-snapshot',feedback:{memberId:viewer.id,value:null}});
   assert.doesNotMatch(JSON.stringify(snapshot),/private future/);
 }
 const service=new AuthorizationService(db,async()=>support);
 assert.equal((await service.reader(internal)).article,null);
 assert.equal((await service.reader(draftId)).article,null);
 assert.equal((await service.reader('unknown')).article,null);
 assert.equal((await service.reader([id,internal])).article,null);
 assert.equal((await service.reader(undefined)).article,null);
 await fixture.pool.query("UPDATE juyu.documents SET lifecycle='archived' WHERE id=$1",[id]);
 assert.equal((await new AuthorizationService(db,async()=>a).reader(id)).article,null);
 await assert.rejects(new AuthorizationService(db,async()=>null).reader(id),/FORBIDDEN/);
});


test('publication search protects counts, formal titles and categories across role and publication changes',async()=>{
 const publicId=await published('searchscope-public'),privateId=await published('searchscope-ops','ops');
 await owner.create({id:'searchscope-draft',kind:'article',title:'searchscope secret draft',body:'not public',audience:'staff'},a);
 let viewer:Viewer=ops;const service=new AuthorizationService(db,async()=>viewer);
 let result=await service.search('searchscope');assert.equal(result.search.total,2);
 viewer=support;result=await service.search('searchscope');assert.equal(result.search.total,1);assert.equal(result.search.results[0].id,publicId);
 assert.doesNotMatch(JSON.stringify(result),/searchscope-ops|searchscope-draft|not public/);
 const original=(await owner.getForManagement(publicId,a))!;
 await owner.execute(publicId,{type:'edit',title:'private future searchscope heading',body:'private future body',audience:'ops'},a,{expectedSequence:original.sequence});
 for(const current of [support,ops,a]) {
   viewer=current;const snapshot=await service.search('searchscope');
   assert.equal(snapshot.search.results.find(item=>item.id===publicId)?.title,'title-searchscope-public');
   assert.doesNotMatch(JSON.stringify(snapshot),/private future|searchscope-draft/);
   assert.match(snapshot.search.results.find(item=>item.id===publicId)?.snippet??'',/body-searchscope-public/);
 }
 const {randomUUID}=await import('node:crypto');const parent=randomUUID(),child=randomUUID();
 await fixture.pool.query("INSERT INTO juyu.categories(id,name,audience) VALUES ($1,'searchscope restricted category','ops')",[parent]);
 await fixture.pool.query("INSERT INTO juyu.categories(id,name,parent_id) VALUES ($1,'searchscope child',$2)",[child,parent]);
 await fixture.pool.query('INSERT INTO juyu.revision_categories(document_id,revision_id,category_id) VALUES ($1,1,$2)',[publicId,child]);
 viewer=support;result=await service.search('searchscope');assert.equal(result.search.total,0);assert.doesNotMatch(JSON.stringify(result),/searchscope restricted category|searchscope child|title-searchscope/);
 viewer=ops;result=await service.search('searchscope');assert.equal(result.search.total,2);assert.deepEqual(result.search.results.find(item=>item.id===publicId)?.breadcrumbs,['searchscope restricted category','searchscope child']);
 await fixture.pool.query('UPDATE juyu.categories SET enabled=false WHERE id=$1',[parent]);
 await fixture.pool.query("UPDATE juyu.documents SET lifecycle='archived' WHERE id=$1",[privateId]);
 viewer=a;result=await service.search('searchscope');assert.equal(result.search.total,0);
 await assert.rejects(new AuthorizationService(db,async()=>null).search('searchscope'),/FORBIDDEN/);
});


test('page links derive only from the current role publication snapshot and stop exposing withdrawn neighbours',async()=>{
 const {pageNavigation}=await import('../../src/reader/page-navigation.ts');
 const {randomUUID}=await import('node:crypto');const group=randomUUID();
 const first=await published('t022-0'),privateId=await published('t022-1','ops'),last=await published('t022-2');
 await fixture.pool.query("INSERT INTO juyu.categories(id,name) VALUES ($1,'正式业务流程')",[group]);
 for(const id of [first,privateId,last])await fixture.pool.query('INSERT INTO juyu.revision_categories(document_id,revision_id,category_id) VALUES ($1,1,$2)',[id,group]);
 let viewer:Viewer=support;const service=new AuthorizationService(db,async()=>viewer);
 const current=(await owner.getForManagement(last,a))!;
 await owner.execute(last,{type:'edit',title:'未来草稿标题',body:'未公开',audience:'ops'},a,{expectedSequence:current.sequence});
 const snapshot=await service.reader(first);const links=pageNavigation(snapshot.pages,first)!;
 assert.equal(links.next?.id,last);assert.equal(links.next?.title,'title-t022-2');assert.deepEqual(links.ancestors,[{id:group,title:'正式业务流程'}]);
 assert.doesNotMatch(JSON.stringify(links),/t022-1|未来草稿标题|未公开/);
 assert.equal(pageNavigation(snapshot.pages,privateId),null);
 for(const role of [ops,a]){viewer=role;const reader=await service.reader(first);assert.equal(pageNavigation(reader.pages,first)?.next?.id,last);assert.equal(pageNavigation(reader.pages,privateId),null);assert.equal((await service.reader(privateId)).article?.id,privateId);}
 await fixture.pool.query("UPDATE juyu.documents SET lifecycle='archived' WHERE id=$1",[privateId]);
 assert.equal(pageNavigation((await service.reader(first)).pages,first)?.next?.id,last);
 await fixture.pool.query('UPDATE juyu.categories SET enabled=false WHERE id=$1',[group]);
 const hidden=await service.reader(first);assert.equal(hidden.article,null);assert.equal(pageNavigation(hidden.pages,first),null);assert.doesNotMatch(JSON.stringify(hidden),/正式业务流程|t022-/);
});

async function coverAsset(documentId:string,mime='image/png',status='ready') {
 const id=(await fixture.pool.query("INSERT INTO juyu.assets(id,document_id,uploaded_by,filename,mime_type,byte_size,object_key,status) SELECT x,$1,'a','cover.png',$2,4,x::text,$3 FROM (SELECT gen_random_uuid() x) q RETURNING id",[documentId,mime,status])).rows[0].id as string;
 return {assetId:id,alt:'本地封面说明',position:30};
}
test('T024 saved cover and tags stay behind review and replace the old publication atomically',async()=>{
 const repo=new DocumentRepository(db),service=new AuthorizationService(db,async()=>support);
 let doc=await repo.create({id:'cover-cycle',kind:'article',title:'封面版本',body:'原正文',audience:'staff'},a);
 const first=await coverAsset(doc.id),second=await coverAsset(doc.id);
 doc=await repo.execute(doc.id,{type:'edit',title:'封面版本',body:'原正文',audience:'staff',tags:[' 客服 ','域名','客服'],cover:first},a,{expectedSequence:doc.sequence});
 assert.deepEqual(await repo.getForManagement(doc.id,a),doc);
 assert.equal((await service.reader(doc.id)).article,null);assert.equal(await service.asset(first.assetId),null);
 for(const type of ['submit','approve','queue','publish'] as const)doc=await repo.execute(doc.id,{type},type==='approve'?b:a,{expectedSequence:doc.sequence,reviewer:b});
 assert.deepEqual((await service.reader(doc.id)).article?.tags,['客服','域名']);assert.deepEqual((await service.reader(doc.id)).article?.cover,first);
 doc=await repo.execute(doc.id,{type:'edit',title:'新标题',body:'新正文',audience:'staff',tags:['新标签'],cover:second},a,{expectedSequence:doc.sequence});
 assert.deepEqual((await service.reader(doc.id)).article?.cover,first);assert.equal(await service.asset(second.assetId),null);
 for(const type of ['submit','approve','queue','publish'] as const)doc=await repo.execute(doc.id,{type},type==='approve'?b:a,{expectedSequence:doc.sequence,reviewer:b});
 assert.deepEqual((await service.reader(doc.id)).article?.cover,second);assert.deepEqual((await service.article(doc.id))?.tags,['新标签']);
 assert.equal(await service.asset(first.assetId),null);assert.ok(await service.asset(second.assetId));
 doc=await repo.execute(doc.id,{type:'edit',title:'移除封面',body:'正文',audience:'staff',tags:[],cover:null},a,{expectedSequence:doc.sequence});
 for(const type of ['submit','approve','queue','publish'] as const)doc=await repo.execute(doc.id,{type},type==='approve'?b:a,{expectedSequence:doc.sequence,reviewer:b});
 assert.equal((await service.reader(doc.id)).article?.cover,undefined);assert.equal((await service.reader(doc.id)).article?.tags,undefined);assert.equal(await service.asset(second.assetId),null);
});

test('T024 cover saving rejects other documents, quarantined files and active MIME with no partial version',async()=>{
 const repo=new DocumentRepository(db);const doc=await repo.create({id:'cover-invalid',kind:'article',title:'封面校验',body:'正文',audience:'staff'},a);
 const other=await coverAsset(regular),quarantined=await coverAsset(doc.id,'image/png','quarantined'),svg=await coverAsset(doc.id,'image/svg+xml');
 for(const cover of [other,quarantined,svg]){
  await assert.rejects(repo.execute(doc.id,{type:'edit',title:'错误',body:'正文',audience:'staff',cover},a,{expectedSequence:0}),/INVALID_COVER/);
  assert.equal((await repo.getForManagement(doc.id,a))?.sequence,0);
 }
});

test('T024 metadata edits preserve restricted categories and other attachments',async()=>{
 const repo=new DocumentRepository(db);let doc=await repo.create({id:'cover-category',kind:'article',title:'受限分类资料',body:'正文',audience:'staff'},a);
 const cat=(await fixture.pool.query("INSERT INTO juyu.categories(name,audience) VALUES ('仅运营分类','ops') RETURNING id")).rows[0].id;
 const cover=await coverAsset(doc.id),attachment=await coverAsset(doc.id);
 await fixture.pool.query('INSERT INTO juyu.revision_categories(document_id,revision_id,category_id) VALUES($1,1,$2)',[doc.id,cat]);
 await fixture.pool.query("INSERT INTO juyu.revision_assets(document_id,revision_id,asset_id,usage) VALUES($1,1,$2,'attachment')",[doc.id,attachment.assetId]);
 doc=await repo.execute(doc.id,{type:'edit',title:'受限分类资料',body:'正文',audience:'staff',tags:['运营'],cover},a,{expectedSequence:0});
 for(const type of ['submit','approve','queue','publish'] as const)doc=await repo.execute(doc.id,{type},type==='approve'?b:a,{expectedSequence:doc.sequence,reviewer:b});
 const staffService=new AuthorizationService(db,async()=>support),opsService=new AuthorizationService(db,async()=>ops);
 assert.equal((await staffService.reader(doc.id)).article,null);assert.equal(await staffService.asset(cover.assetId),null);
 assert.deepEqual((await opsService.reader(doc.id)).article?.tags,['运营']);assert.ok(await opsService.asset(cover.assetId));assert.ok(await opsService.asset(attachment.assetId));
 await fixture.pool.query("UPDATE juyu.assets SET status='quarantined' WHERE id=$1",[cover.assetId]);
 assert.equal((await opsService.reader(doc.id)).article?.cover,undefined);assert.equal(await opsService.asset(cover.assetId),null);
});

test('T024 immutable submitted metadata and stale edits cannot alter a reviewed snapshot',async()=>{
 const repo=new DocumentRepository(db);let doc=await repo.create({id:'cover-frozen',kind:'article',title:'冻结检查',body:'正文',audience:'staff',tags:['旧标签']},a);
 const cover=await coverAsset(doc.id);
 doc=await repo.execute(doc.id,{type:'submit'},a,{expectedSequence:0,reviewer:b});
 await assert.rejects(repo.execute(doc.id,{type:'edit',title:'绕过',body:'正文',audience:'staff',tags:['新标签'],cover},a,{expectedSequence:1}),/INVALID_STATE/);
 await assert.rejects(repo.execute(doc.id,{type:'edit',title:'过期',body:'正文',audience:'staff'},a,{expectedSequence:0}),/CONFLICT/);
 await assert.rejects(db.run(a,client=>client.query("UPDATE juyu.revisions SET tags=ARRAY['改写'] WHERE document_id=$1",[doc.id])));
 await assert.rejects(db.run(a,client=>client.query("INSERT INTO juyu.revision_assets(document_id,revision_id,asset_id,usage) VALUES($1,1,$2,'cover')",[doc.id,cover.assetId])),{code:'42501'});
 await assert.rejects(repo.execute(doc.id,{type:'edit',title:'客服修改',body:'正文',audience:'staff'},support,{expectedSequence:1}),/FORBIDDEN/);
 assert.deepEqual((await repo.getForManagement(doc.id,a))?.revisions[0].tags,['旧标签']);
});

test('T025 feedback persists per employee and version, retries do not duplicate and stale changes conflict',async()=>{
 const id=await published('feedback-cycle'),s=new AuthorizationService(db,async()=>support);
 assert.equal(await s.feedback(id,1),null);
 const input={revision:1,helpful:true,comment:'很清楚',expectedVersion:0};
 const both=await Promise.all([s.saveFeedback(id,input),s.saveFeedback(id,input)]);
 assert.equal(both[0].version,1);assert.deepEqual(both[0],both[1]);
 const updated=await s.saveFeedback(id,{...input,helpful:false,comment:'请补充步骤',expectedVersion:1});
 assert.equal(updated.version,2);assert.equal((await s.feedback(id,1))?.helpful,false);
 await assert.rejects(s.saveFeedback(id,input),/CONFLICT/);
 await new AuthorizationService(db,async()=>ops).saveFeedback(id,input);
 const admin=new AuthorizationService(db,async()=>a),details=await admin.feedbackDetails(id,1,1);
 assert.equal(details.summary.total,2);assert.equal(details.summary.helpful,1);assert.equal(details.summary.unhelpful,1);assert.equal(details.entries.length,2);
 await assert.rejects(s.feedbackOverview(1),/FORBIDDEN/);
 const own=await db.run(support,c=>c.query('SELECT member_id FROM juyu.feedback WHERE document_id=$1',[id]));assert.deepEqual(own.rows,[{member_id:'support'}]);
});
test('T025 feedback rejects forbidden documents, old publication pages and forged writes',async()=>{
 const s=new AuthorizationService(db,async()=>support);
 await assert.rejects(s.saveFeedback(internal,{revision:1,helpful:true,comment:'',expectedVersion:0}),/NOT_FOUND/);
 await assert.rejects(s.feedback(draftId,1),/NOT_FOUND/);
 const id=await published('feedback-version');await s.saveFeedback(id,{revision:1,helpful:false,comment:'旧版说明',expectedVersion:0});
 let doc=(await owner.getForManagement(id,a))!;doc=await owner.execute(id,{type:'edit',title:'新版',body:'新正文',audience:'staff'},a,{expectedSequence:doc.sequence});
 for(const type of ['submit','approve','queue','publish'] as const)doc=await owner.execute(id,{type},type==='approve'?b:a,{expectedSequence:doc.sequence,reviewer:b});
 await assert.rejects(s.saveFeedback(id,{revision:1,helpful:true,comment:'过期页面',expectedVersion:1}),/VERSION_CHANGED/);
 assert.equal(await s.feedback(id,2),null);const old=await new AuthorizationService(db,async()=>a).feedbackDetails(id,1,1);assert.equal(old.summary.total,1);assert.equal(old.summary.current,false);
 await assert.rejects(db.run(support,c=>c.query("INSERT INTO juyu.feedback(member_id,document_id,revision_id,helpful) VALUES('ops',$1,2,true)",[id])),{code:'42501'});
 await fixture.pool.query("UPDATE juyu.documents SET lifecycle='archived' WHERE id=$1",[id]);await assert.rejects(s.saveFeedback(id,{revision:2,helpful:true,comment:'',expectedVersion:0}),/NOT_FOUND/);
});

test('T025 admin detail pagination and feedback access react to member and category restrictions',async()=>{
 const id=await published('feedback-pagination'),s=new AuthorizationService(db,async()=>support),admin=new AuthorizationService(db,async()=>a);
 await fixture.pool.query("INSERT INTO juyu.members(clerk_user_id,display_name,observed_role) SELECT 'feedback-member-'||n,'Member '||n,'support' FROM generate_series(1,26) n");
 await fixture.pool.query("INSERT INTO juyu.feedback(member_id,document_id,revision_id,helpful,comment) SELECT 'feedback-member-'||n,$1,1,n%2=0,'comment-'||n FROM generate_series(1,26) n",[id]);
 const first=await admin.feedbackDetails(id,1,1),second=await admin.feedbackDetails(id,1,2);
 assert.equal(first.summary.total,26);assert.equal(first.summary.helpful,13);assert.equal(first.entries.length,25);assert.equal(second.entries.length,1);assert.equal(first.pages,2);
 assert.equal(new Set([...first.entries,...second.entries].map(e=>e.memberId)).size,26);
 assert.deepEqual(await admin.feedbackDetails(id,1,999),second);
 for(const viewer of [support,ops])await assert.rejects(new AuthorizationService(db,async()=>viewer).feedbackDetails(id,1,1),/FORBIDDEN/);
 await fixture.pool.query("UPDATE juyu.members SET disabled_at=now() WHERE clerk_user_id='support'");
 try {await assert.rejects(s.saveFeedback(id,{revision:1,helpful:true,comment:'',expectedVersion:0}),/FORBIDDEN/);}
 finally {await fixture.pool.query("UPDATE juyu.members SET disabled_at=null WHERE clerk_user_id='support'");}
 const cat=(await fixture.pool.query("INSERT INTO juyu.categories(name,audience) VALUES ('反馈受限分类','ops') RETURNING id")).rows[0].id;
 await fixture.pool.query('INSERT INTO juyu.revision_categories(document_id,revision_id,category_id) VALUES($1,1,$2)',[id,cat]);
 await assert.rejects(s.feedback(id,1),/NOT_FOUND/);await assert.rejects(s.saveFeedback(id,{revision:1,helpful:true,comment:'',expectedVersion:0}),/NOT_FOUND/);
 const op=new AuthorizationService(db,async()=>ops);await op.saveFeedback(id,{revision:1,helpful:true,comment:'',expectedVersion:0});
 await fixture.pool.query('UPDATE juyu.categories SET enabled=false WHERE id=$1',[cat]);await assert.rejects(op.feedback(id,1),/NOT_FOUND/);
});

test('T026 PDF snapshots only expose current permitted publications and associated PDF files',async()=>{
 const id=await published('pdf-export'),s=new AuthorizationService(db,async()=>support);
 const asset=await coverAsset(id,'application/pdf');
 await fixture.pool.query("INSERT INTO juyu.revision_assets(document_id,revision_id,asset_id,usage) VALUES($1,1,$2,'attachment')",[id,asset.assetId]);
 const result=await s.pdf(id,1);assert.equal(result.article.id,id);assert.equal(result.files.length,1);assert.equal(result.files[0].id,asset.assetId);
 assert.doesNotMatch(JSON.stringify(result),/object_key|bucket/);
 await assert.rejects(s.pdf(internal,1),/NOT_FOUND/);await assert.rejects(s.pdf(draftId,1),/NOT_FOUND/);await assert.rejects(s.pdf(id,2),/VERSION_CHANGED/);
 let doc=(await owner.getForManagement(id,a))!;doc=await owner.execute(id,{type:'edit',title:'未发布标题',body:'未发布正文',audience:'ops'},a,{expectedSequence:doc.sequence});
 assert.doesNotMatch(JSON.stringify(await s.pdf(id,1)),/未发布/);
 for(const type of ['submit','approve','queue','publish'] as const)doc=await owner.execute(id,{type},type==='approve'?b:a,{expectedSequence:doc.sequence,reviewer:b});
 await assert.rejects(s.pdf(id,1),/NOT_FOUND/);assert.equal((await new AuthorizationService(db,async()=>ops).pdf(id,2)).article.revision,2);
 await fixture.pool.query("UPDATE juyu.documents SET lifecycle='archived' WHERE id=$1",[id]);await assert.rejects(new AuthorizationService(db,async()=>a).pdf(id,2),/NOT_FOUND/);
});

test('T027 blocks round trip as reviewed revisions, preserve old publication and remove obsolete access',async()=>{
 const service=new AuthorizationService(db,async()=>a),staff=new AuthorizationService(db,async()=>support);const id=await published('media-cycle');
 const image=await coverAsset(id),video=await coverAsset(id,'video/mp4'),file=await coverAsset(id,'application/pdf');
 const blocks=[{id:'image1',type:'image' as const,assetId:image.assetId,caption:'截图',alt:'中文说明'},{id:'video1',type:'video' as const,assetId:video.assetId,caption:'步骤影片',alt:'影片说明'},{id:'file1',type:'file' as const,assetId:file.assetId,caption:'附件',alt:''},{id:'table1',type:'table' as const,headers:['项目','说明'],rows:[['注册','中文\n多行']]}];
 let state=await service.media(id);state=await service.saveMedia(id,{expectedSequence:state.sequence,blocks});assert.deepEqual(state.blocks,blocks);assert.equal((await staff.reader(id)).article?.blocks,undefined);assert.equal(await staff.asset(image.assetId),null);assert.ok(await service.managementAsset(image.assetId));
 let doc=(await owner.getForManagement(id,a))!;for(const type of ['submit','approve','queue','publish'] as const)doc=await owner.execute(id,{type},type==='approve'?b:a,{expectedSequence:doc.sequence,reviewer:b});
 assert.deepEqual((await staff.reader(id)).article?.blocks,blocks);assert.ok(await staff.asset(video.assetId));assert.deepEqual((await staff.pdf(id,2)).article.blocks,blocks);
 state=await service.media(id);state=await service.saveMedia(id,{expectedSequence:state.sequence,blocks:[]});assert.deepEqual((await staff.reader(id)).article?.blocks,blocks);
 doc=(await owner.getForManagement(id,a))!;for(const type of ['submit','approve','queue','publish'] as const)doc=await owner.execute(id,{type},type==='approve'?b:a,{expectedSequence:doc.sequence,reviewer:b});assert.equal((await staff.reader(id)).article?.blocks,undefined);assert.equal(await staff.asset(file.assetId),null);assert.deepEqual((await owner.getForManagement(id,a))?.revisions[1].blocks,blocks);
 await assert.rejects(staff.media(id),/FORBIDDEN/);await assert.rejects(staff.managementAsset(image.assetId),/FORBIDDEN/);
});
test('T027 asset ownership, pending uploads, frozen reviews and stale saves cannot be bypassed',async()=>{
 const service=new AuthorizationService(db,async()=>a);const doc=await owner.create({id:'media-reject',kind:'article',title:'附件检查',body:'正文',audience:'staff'},a);const own=await coverAsset(doc.id);const other=await coverAsset(regular);const pending=await coverAsset(doc.id,'image/png','pending');
 const block=(assetId:string)=>[{id:'item',type:'image' as const,assetId,caption:'',alt:''}];
 for(const x of [other,pending])await assert.rejects(service.saveMedia(doc.id,{expectedSequence:0,blocks:block(x.assetId)}),/INVALID_MEDIA/);
 assert.equal((await service.media(doc.id)).sequence,0);await service.saveMedia(doc.id,{expectedSequence:0,blocks:block(own.assetId)});await assert.rejects(service.saveMedia(doc.id,{expectedSequence:0,blocks:[]}),/CONFLICT/);
 await owner.execute(doc.id,{type:'submit'},a,{expectedSequence:1,reviewer:b});await assert.rejects(service.saveMedia(doc.id,{expectedSequence:2,blocks:[]}),/INVALID_STATE/);
});
test('T027 uploaded files remain private until confirmed and selected, with immutable upload events',async()=>{
 const service=new AuthorizationService(db,async()=>a),staff=new AuthorizationService(db,async()=>support);const doc=await owner.create({id:'upload-flow',kind:'article',title:'上传检查',body:'正文',audience:'staff'},a);const id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';const metadata={filename:'demo.png',mime:'image/png',size:8};
 await assert.rejects(staff.reserveUpload(doc.id,id,metadata),/FORBIDDEN/);await service.reserveUpload(doc.id,id,metadata);assert.equal(await service.managementAsset(id),null);await assert.rejects(new AuthorizationService(db,async()=>b).finishUpload(id,true),/CONFLICT/);await service.finishUpload(id,true);assert.ok(await service.managementAsset(id));assert.equal(await staff.asset(id),null);
 await assert.rejects(db.run(a,c=>c.query("UPDATE juyu.assets SET status='ready' WHERE id=$1",[id])),{code:'42501'});
 assert.equal((await fixture.pool.query('SELECT count(*)::int AS n FROM juyu.upload_events WHERE asset_id=$1',[id])).rows[0].n,2);
 await assert.rejects(fixture.pool.query('DELETE FROM juyu.upload_events WHERE asset_id=$1',[id]),/IMMUTABLE/);
});

test('T027 actual private HTTP upload is verified, attached and delivered only after publication',async()=>{
 const local=await storageFixture();try{
 const service=new AuthorizationService(db,async()=>a),staff=new AuthorizationService(db,async()=>support);const id=await published('media-storage');const store=new SupabasePrivateStorage(local.url,'test-only-key',{allowLoopback:true});const bytes=await readFile('tests/fixtures/article-cover.png');
 const request=new Request('http://local/upload',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent('真实读写.png')},body:bytes});
 const result=await uploadFile(request,id,{authorize:()=>service.media(id),reserve:(asset,metadata)=>service.reserveUpload(id,asset,metadata),finish:(asset,ready)=>service.finishUpload(asset,ready),storage:()=>store});
 assert.equal(result.status,'ready');assert.equal(local.reads,1);assert.equal(await staff.asset(result.id),null);
 const state=await service.media(id);await service.saveMedia(id,{expectedSequence:state.sequence,blocks:[{id:'uploaded',type:'image',assetId:result.id,caption:'真实私有读写',alt:'示例'}]});
 let doc=(await owner.getForManagement(id,a))!;for(const type of ['submit','approve','queue','publish'] as const)doc=await owner.execute(id,{type},type==='approve'?b:a,{expectedSequence:doc.sequence,reviewer:b});
 const response=await deliverAsset(new Request('http://local?download=1'),result.id,x=>staff.asset(x),store);assert.equal(response.status,200);assert.match(response.headers.get('content-disposition')!,/^attachment;/);assert.equal(response.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
 const range=await deliverAsset(new Request('http://local',{headers:{Range:'bytes=0-7'}}),result.id,x=>staff.asset(x),store);assert.equal(range.status,206);assert.deepEqual(Buffer.from(await range.arrayBuffer()),bytes.subarray(0,8));
 await fixture.pool.query("UPDATE juyu.documents SET lifecycle='archived' WHERE id=$1",[id]);const reads=local.reads;const denied=await deliverAsset(new Request('http://local'),result.id,x=>staff.asset(x),store);assert.equal(denied.status,404);assert.equal(local.reads,reads);
 }finally{await local.close();}
});

test('T028 rich blocks persist through independent review and publish without fabricated asset relations',async()=>{
 const admin=new AuthorizationService(db,async()=>a),staff=new AuthorizationService(db,async()=>support);const id=await published('rich-cycle');const original=await admin.media(id);
 const blocks=[{id:'hint',type:'hint',style:'danger',title:'核对',body:'先确认身份'},{id:'code',type:'code',language:'bash',code:'echo "中文"\n  # literal\n'},{id:'tabs',type:'tabs',tabs:[{id:'a',title:'注册',body:'步骤A'},{id:'b',title:'转入',body:'步骤B'}]}];
 const state=await admin.saveMedia(id,{expectedSequence:original.sequence,blocks});assert.deepEqual(state.blocks,blocks);assert.equal((await staff.reader(id)).article?.blocks,undefined);assert.equal((await fixture.pool.query('SELECT count(*)::int n FROM juyu.revision_assets WHERE document_id=$1',[id])).rows[0].n,0);
 await assert.rejects(staff.saveMedia(id,{expectedSequence:state.sequence,blocks:[]}),/FORBIDDEN/);await assert.rejects(admin.saveMedia(id,{expectedSequence:original.sequence,blocks:[]}),/CONFLICT/);
 let doc=(await owner.getForManagement(id,a))!;doc=await owner.execute(id,{type:'submit'},a,{expectedSequence:doc.sequence,reviewer:b});await assert.rejects(admin.saveMedia(id,{expectedSequence:doc.sequence,blocks:[]}),/INVALID_STATE/);
 for(const type of ['approve','queue','publish'] as const)doc=await owner.execute(id,{type},type==='approve'?b:a,{expectedSequence:doc.sequence});
 assert.deepEqual((await staff.reader(id)).article?.blocks,blocks);assert.deepEqual((await staff.pdf(id,2)).article.blocks,blocks);
 await admin.saveMedia(id,{expectedSequence:doc.sequence,blocks:[]});assert.deepEqual((await staff.reader(id)).article?.blocks,blocks);
 await fixture.pool.query("UPDATE juyu.documents SET lifecycle='archived' WHERE id=$1",[id]);await assert.rejects(staff.pdf(id,2),/NOT_FOUND/);
});
test('T029 science revisions stay private until independently reviewed and published',async()=>{
 const admin=new AuthorizationService(db,async()=>a),staff=new AuthorizationService(db,async()=>support);const id=await published('science-cycle');const state=await admin.media(id);const blocks=[{id:'m',type:'math',source:'x^2',caption:'公式'},{id:'d',type:'diagram',source:'flowchart TD\nA-->B',caption:'流程'}];
 const draft=await admin.saveMedia(id,{expectedSequence:state.sequence,blocks});assert.deepEqual(draft.blocks,blocks);assert.equal((await staff.pdf(id,1)).article.blocks,undefined);await assert.rejects(staff.media(id),/FORBIDDEN/);
 let doc=(await owner.getForManagement(id,a))!;for(const type of ['submit','approve','queue','publish'] as const)doc=await owner.execute(id,{type},type==='approve'?b:a,{expectedSequence:doc.sequence,reviewer:b});assert.deepEqual((await staff.pdf(id,2)).article.blocks,blocks);await assert.rejects(staff.pdf(internal,1),/NOT_FOUND/);
 await admin.saveMedia(id,{expectedSequence:doc.sequence,blocks:[]});assert.deepEqual((await staff.pdf(id,2)).article.blocks,blocks);
});

test('T030 workspace counts current workflow, filters assignments and preserves old publication',async()=>{
 const service=new AuthorizationService(db,async()=>a);
 assert.equal(typeof service.workspace,'function','workspace query must exist');
 let doc=await owner.create({id:'board-review',kind:'article',title:'看板核对 %_ 标题',body:'private body excluded',audience:'staff'},a);
 doc=await owner.execute(doc.id,{type:'submit'},a,{expectedSequence:doc.sequence,reviewer:b});
 const view=await service.workspace({q:'看板核对'});
 assert.equal(view.total,1);assert.equal(view.counts.in_review,1);assert.equal(view.items[0].reviewer,'B');assert.equal('body' in view.items[0],false);
 assert.equal((await service.workspace({q:'%_'})).total,1);
 assert.equal((await service.workspace({q:'看板核对',scope:'review'})).total,0);
 assert.equal((await new AuthorizationService(db,async()=>b).workspace({q:'看板核对',scope:'review'})).total,1);
 assert.equal(view.items[0].canReview,false);
 assert.equal((await new AuthorizationService(db,async()=>b).workspace({q:'看板核对'})).items[0].canReview,true);
 assert.equal((await service.workspace({q:'看板核对',scope:'submitted'})).total,1);
 doc=await owner.execute(doc.id,{type:'reject',reason:'补充说明'},b,{expectedSequence:doc.sequence});
 assert.equal((await service.workspace({q:'看板核对',scope:'returned'})).total,1);
 doc=await owner.execute(doc.id,{type:'edit',title:'看板核对新稿',body:'new',audience:'staff'},a,{expectedSequence:doc.sequence});
 assert.equal((await service.workspace({q:'看板核对',scope:'returned'})).total,0);
 for(const type of ['submit','approve','queue','publish'] as const)doc=await owner.execute(doc.id,{type},type==='approve'?b:a,{expectedSequence:doc.sequence,reviewer:b});
 const publishedRevision=doc.publishedRevisionId;
 doc=await owner.execute(doc.id,{type:'edit',title:'看板核对第三稿',body:'newer',audience:'staff'},a,{expectedSequence:doc.sequence});
 const edited=await service.workspace({q:'看板核对'});
 assert.equal(edited.items[0].status,'draft');assert.equal(edited.items[0].publishedRevision,publishedRevision);
 assert.equal(edited.counts.published,0);assert.equal((await service.workspace({q:'看板核对',status:'published'})).total,0);
 assert.equal((await service.workspace({q:'看板核对',kind:'ops'})).total,0);
 for(const viewer of [support,ops])await assert.rejects(new AuthorizationService(db,async()=>viewer).workspace({}),/FORBIDDEN/);
 await fixture.pool.query("UPDATE juyu.members SET observed_role='support' WHERE clerk_user_id='a'");
 try{await assert.rejects(service.workspace({}),/FORBIDDEN/);}finally{await fixture.pool.query("UPDATE juyu.members SET observed_role='admin' WHERE clerk_user_id='a'");}
});

test('T030 workspace pagination is bounded, stable and excludes archived documents',async()=>{
 const service=new AuthorizationService(db,async()=>a);
 assert.equal(typeof service.workspace,'function','workspace query must exist');
 for(let i=0;i<32;i++)await owner.create({id:`board-page-${i}`,kind:'reference',title:`分页测试 ${i}`,body:'hidden',audience:'staff'},a);
 await fixture.pool.query("UPDATE juyu.documents SET updated_at='2026-01-01' WHERE id LIKE 'board-page-%'");
 const first=await service.workspace({q:'分页测试'});const last=await service.workspace({q:'分页测试',page:'999999'});
 assert.equal(first.total,32);assert.equal(first.items.length,30);assert.equal(last.page,2);assert.equal(last.items.length,2);
 assert.equal(new Set([...first.items,...last.items].map(r=>r.id)).size,32);assert.equal(first.counts.draft,32);
 await fixture.pool.query("UPDATE juyu.documents SET lifecycle='archived' WHERE id='board-page-0'");
 assert.equal((await service.workspace({q:'分页测试'})).total,31);
 await assert.rejects(service.workspace({page:'-1'}),/INVALID_QUERY/);
 await assert.rejects(service.workspace({scope:'admin',q:['one','two']}),/INVALID_QUERY/);
});

test('T031 editor rejects unstructured body without creating a draft',async()=>{
 const service=new AuthorizationService(db,async()=>a);
 await assert.rejects(service.saveDraft('31111111-1111-4111-8111-111111111111',{expectedSequence:null,title:'编辑草稿',body:'plain text',kind:'article',audience:'staff',tags:[],cover:null}),/INVALID_INPUT/);
 assert.equal(await new DocumentRepository(db).getForManagement('31111111-1111-4111-8111-111111111111',a),null);
});

async function editorDraft(title='编辑草稿'){
 const {encodeEditorBody}=await import('../../src/editor/document.ts');
 return {expectedSequence:null as number|null,title,body:encodeEditorBody([{id:'p1',type:'paragraph',props:{},content:[{type:'text',text:'正文',styles:{}}],children:[]}]),kind:'article' as const,audience:'staff' as const,tags:['客服'],cover:null};
}
test('T031 create and save retries acknowledge only the exact actor snapshot without duplicate revisions',async()=>{
 const service=new AuthorizationService(db,async()=>a),other=new AuthorizationService(db,async()=>b),id='31111111-1111-4111-8111-111111111112';
 const input=await editorDraft();const created=await service.saveDraft(id,input);
 assert.equal(created.sequence,0);assert.equal(created.publishedRevision,null);assert.deepEqual(await service.saveDraft(id,input),created);
 await assert.rejects(other.saveDraft(id,input),/CONFLICT/);
 const edit={...input,expectedSequence:0,title:'编辑更新'};const saved=await service.saveDraft(id,edit);
 assert.equal(saved.sequence,1);assert.deepEqual(await service.saveDraft(id,edit),saved);assert.deepEqual(await service.editor(id),saved);
 await assert.rejects(service.saveDraft(id,{...edit,title:'不同内容'}),/CONFLICT/);
 assert.equal((await new DocumentRepository(db).getForManagement(id,a))?.revisions.length,2);
});
test('T031 concurrent different saves allow one winner and preserve the exact committed acknowledgement',async()=>{
 const service=new AuthorizationService(db,async()=>a),id='31111111-1111-4111-8111-111111111113',input=await editorDraft();
 await service.saveDraft(id,input);
 const results=await Promise.allSettled(['版本甲','版本乙'].map(title=>service.saveDraft(id,{...input,title,expectedSequence:0})));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);const failed=results.find(r=>r.status==='rejected');assert.match(String(failed?.status==='rejected'&&failed.reason),/CONFLICT/);
 const saved=results.find(r=>r.status==='fulfilled');assert.equal(saved?.status==='fulfilled'&&saved.value.sequence,1);
});
test('T031 frozen, inactive, non-admin, kind changes and old media writes are refused',async()=>{
 const service=new AuthorizationService(db,async()=>a),id='31111111-1111-4111-8111-111111111114',input=await editorDraft();const repo=new DocumentRepository(db);
 await service.saveDraft(id,input);
 await assert.rejects(service.saveDraft(id,{...input,expectedSequence:0,kind:'qa'}),/INVALID_INPUT/);
 await assert.rejects(service.saveMedia(id,{expectedSequence:0,blocks:[]}),/USE_EDITOR/);
 for(const viewer of [support,ops]){const blocked=new AuthorizationService(db,async()=>viewer);await assert.rejects(blocked.editor(id),/FORBIDDEN/);await assert.rejects(blocked.saveDraft(id,input),/FORBIDDEN/);}
 await repo.execute(id,{type:'submit'},a,{expectedSequence:0,reviewer:b});
 await assert.rejects(service.saveDraft(id,{...input,expectedSequence:1}),/INVALID_STATE/);
 await fixture.pool.query("UPDATE juyu.documents SET lifecycle='archived' WHERE id=$1",[id]);
 await assert.rejects(service.saveDraft(id,{...input,expectedSequence:1}),/INACTIVE_DOCUMENT/);
});
test('T031 new structured draft preserves publication, restricted categories and legacy attachments',async()=>{
 const repo=new DocumentRepository(db),service=new AuthorizationService(db,async()=>a),id='editor-legacy';
 let doc=await repo.create({id,kind:'article',title:'旧正文',body:'旧版纯文本',audience:'staff'},a);
 const cat=(await fixture.pool.query("INSERT INTO juyu.categories(name,audience) VALUES ('编辑器运营','ops') RETURNING id")).rows[0].id;
 const file=await coverAsset(id);
 await fixture.pool.query('INSERT INTO juyu.revision_categories(document_id,revision_id,category_id) VALUES($1,1,$2)',[id,cat]);
 await fixture.pool.query("INSERT INTO juyu.revision_assets(document_id,revision_id,asset_id,usage) VALUES($1,1,$2,'attachment')",[id,file.assetId]);
 for(const type of ['submit','approve','queue','publish'] as const)doc=await repo.execute(id,{type},type==='approve'?b:a,{expectedSequence:doc.sequence,reviewer:b});
 const saved=await service.saveDraft(id,{...await editorDraft(),expectedSequence:doc.sequence});assert.equal(saved.publishedRevision,1);
 const current=await repo.getForManagement(id,a);assert.equal(current?.revisions[0].body,'旧版纯文本');
 assert.equal((await fixture.pool.query('SELECT count(*)::int n FROM juyu.revision_categories WHERE document_id=$1 AND revision_id=$2',[id,current!.workflow.revisionId])).rows[0].n,1);
 assert.equal((await fixture.pool.query("SELECT count(*)::int n FROM juyu.revision_assets WHERE document_id=$1 AND revision_id=$2 AND usage='attachment'",[id,current!.workflow.revisionId])).rows[0].n,1);
});

test('T031 foreign media and mismatched projections roll back without consuming a sequence',async()=>{
 const {encodeEditorBody}=await import('../../src/editor/document.ts');const repo=new DocumentRepository(db),service=new AuthorizationService(db,async()=>a);
 const id='31111111-1111-4111-8111-111111111115',input=await editorDraft();await service.saveDraft(id,input);
 const foreign=await coverAsset(regular);const block={id:'photo',type:'image' as const,assetId:foreign.assetId,caption:'',alt:'图'};
 const body=encodeEditorBody([{id:block.id,type:'juyu',props:{payload:JSON.stringify(block)},children:[]}]);
 await assert.rejects(service.saveDraft(id,{...input,expectedSequence:0,body}),/INVALID_MEDIA/);
 await assert.rejects(repo.execute(id,{type:'edit',title:'错误投影',body,audience:'staff',blocks:[]},a,{expectedSequence:0}),/INVALID_INPUT/);
 assert.equal((await service.editor(id)).sequence,0);assert.equal((await repo.getForManagement(id,a))?.revisions.length,1);
});
test('T031 removing inline media retains separately attached copy and stale older requests still conflict',async()=>{
 const {encodeEditorBody}=await import('../../src/editor/document.ts');const repo=new DocumentRepository(db),service=new AuthorizationService(db,async()=>a);
 const id='31111111-1111-4111-8111-111111111116',input=await editorDraft();await service.saveDraft(id,input);
 const asset=await coverAsset(id);await fixture.pool.query("INSERT INTO juyu.revision_assets(document_id,revision_id,asset_id,usage) VALUES($1,1,$2,'attachment')",[id,asset.assetId]);
 const block={id:'photo',type:'image' as const,assetId:asset.assetId,caption:'',alt:'图'};
 const body=encodeEditorBody([{id:'photo',type:'juyu',props:{payload:JSON.stringify(block)},children:[]}]);
 await service.saveDraft(id,{...input,expectedSequence:0,body});const removed=await service.saveDraft(id,{...input,expectedSequence:1});
 const doc=await repo.getForManagement(id,a);const refs=(await fixture.pool.query('SELECT usage FROM juyu.revision_assets WHERE document_id=$1 AND revision_id=$2',[id,doc!.workflow.revisionId])).rows;
 assert.deepEqual(refs,[{usage:'attachment'}]);assert.deepEqual(removed.blocks,[]);
 await assert.rejects(service.saveDraft(id,{...input,expectedSequence:0,body}),/CONFLICT/);
 assert.equal(doc?.audit.length,3);
});
test('T031 simultaneous duplicate creates are one revision and title/body limits fail closed',async()=>{
 const service=new AuthorizationService(db,async()=>a),input=await editorDraft(),id='31111111-1111-4111-8111-111111111117';
 const [first,retry]=await Promise.all([service.saveDraft(id,input),service.saveDraft(id,input)]);assert.deepEqual(first,retry);
 for(const invalid of [{title:'x'.repeat(201)},{tags:undefined},{body:'JUYU_BLOCKNOTE_V2\n[]'},{body:'JUYU_BLOCKNOTE_V1\n{'},{kind:'ops',audience:'staff'},{extra:true}])await assert.rejects(service.saveDraft(id,{...input,expectedSequence:0,...invalid}),/INVALID_INPUT/);
 assert.equal((await service.editor(id)).sequence,0);
});

test('R14 reader feedback belongs to the current member and published revision',async()=>{
 const id=await published('feedback-snapshot-r14');
 const staff=new AuthorizationService(db,async()=>support),operations=new AuthorizationService(db,async()=>ops);
 await staff.saveFeedback(id,{revision:1,helpful:false,comment:'Support private feedback',expectedVersion:0});
 await operations.saveFeedback(id,{revision:1,helpful:true,comment:'Ops private feedback',expectedVersion:0});
 assert.equal((await staff.reader(id)).article?.feedback?.value?.comment,'Support private feedback');
 assert.equal((await operations.reader(id)).article?.feedback?.value?.comment,'Ops private feedback');
 assert.equal((await new AuthorizationService(db,async()=>a).reader(id)).article?.feedback?.value,null);
 let doc=(await owner.getForManagement(id,a))!;doc=await owner.execute(id,{type:'edit',title:'New formal',body:'New body',audience:'staff'},a,{expectedSequence:doc.sequence});
 for(const type of ['submit','approve','queue','publish'] as const)doc=await owner.execute(id,{type},type==='approve'?b:a,{expectedSequence:doc.sequence,reviewer:b});
 assert.equal((await staff.reader(id)).article?.revision,2);assert.equal((await staff.reader(id)).article?.feedback?.value,null);
});


test('R22 editor reads bounded history, keeps old publication and preserves all versions on save/retry',async()=>{
 const {encodeEditorBody}=await import('../../src/editor/document.ts');
 const input=await editorDraft('R22 当前草稿');
 const id='r22-history';await published(id);
 // Build genuine immutable history through the existing workflow boundary.
 let doc=(await owner.getForManagement(id,a))!;
 for(let i=0;i<35;i++)doc=await owner.execute(id,{type:'edit',title:'R22 '+i,body:encodeEditorBody([{id:'p',type:'paragraph',props:{},content:[{type:'text',text:'历史正文'.repeat(1000),styles:{}}],children:[]}]),audience:'staff' },a,{expectedSequence:doc.sequence});
 const reads:{sql:string;count:number}[]=[];
 const measured:import('../../src/server/database/scoped.ts').Transactions={run(viewer,work,readOnly){return db.run(viewer,c=>work(new Proxy(c,{get(target,key){if(key!=='query')return Reflect.get(target,key);return async(...args:unknown[])=>{const result=await Reflect.apply(target.query,target,args);if(typeof args[0]==='string'&&args[0].startsWith('SELECT'))reads.push({sql:args[0],count:result.rows.length});return result;};}})),readOnly);}};
 const repo=new DocumentRepository(measured);
 const bounded=()=>{const versions=reads.filter(r=>r.sql.includes('r.body')&&r.sql.includes('FROM juyu.revisions r'));assert.ok(versions.length);assert.ok(versions.every(r=>r.count<=3));const audits=reads.filter(r=>r.sql.includes('FROM juyu.audit_log'));assert.ok(audits.length);assert.ok(audits.every(r=>r.count<=1));reads.length=0;};
 const current=await repo.getEditor(id,a);assert.equal(current.title,'R22 34');bounded();
 const save={...input,expectedSequence:current.sequence};const saved=await repo.saveEditor(id,save,a);bounded();
 const retry=await repo.saveEditor(id,save,a);bounded();assert.equal(retry.sequence,saved.sequence);
 await assert.rejects(repo.saveEditor(id,{...save,title:'冲突'},a),/CONFLICT/);
 const full=(await owner.getForManagement(id,a))!;assert.equal(full.revisions.length,37);assert.equal(full.audit.length,41);assert.equal(full.publishedRevisionId,1);assert.equal(full.workflow.revisionId,37);assert.equal(full.revisions[1].title,'R22 0');
 assert.equal((await new AuthorizationService(db,async()=>support).article(id))?.body,'body-'+id);
 await assert.rejects(repo.getEditor(id,support),/FORBIDDEN/);
});
