import {before,after,beforeEach,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import type {Pool} from 'pg';
import type {Viewer,Document,Audience} from '../../src/domain/model.ts';
import type {AssetFile,PrivateStorage} from '../../src/server/storage/contract.ts';
import {temporaryDatabase} from './fixture.ts';
import {migrate} from '../../src/server/database/migrate.ts';
import {ScopedDatabase} from '../../src/server/database/scoped.ts';
import {DocumentRepository} from '../../src/server/database/repository.ts';
import {AuthorizationService} from '../../src/server/authorization/service.ts';
import {deliverAsset} from '../../src/server/storage/delivery.ts';
import {SupabasePrivateStorage} from '../../src/server/storage/supabase.ts';
import {exportPDF} from '../../src/server/pdf/export.ts';
import {storageFixture} from '../storage/http-fixture.ts';

let fixture:Awaited<ReturnType<typeof temporaryDatabase>>,files:Awaited<ReturnType<typeof storageFixture>>,runtime:Pool,issuer:Pool,db:ScopedDatabase,repo:DocumentRepository,store:SupabasePrivateStorage;
const admin:Viewer={id:'a',role:'admin',companyVerified:true},reviewer:Viewer={...admin,id:'b'},support:Viewer={id:'s',role:'support',companyVerified:true},ops:Viewer={id:'o',role:'ops',companyVerified:true};
const service=(viewer:Viewer)=>new AuthorizationService(db,async()=>viewer);
type Sample={doc:Document;assets:AssetFile[]};
let samples:Record<'staff'|'ops'|'admin'|'draft',Sample>;
async function publish(d:Document){
 await service(admin).submitReview(d.id,{expectedSequence:d.sequence,reviewerId:'b'});
 await service(reviewer).decideReview(d.id,{expectedSequence:d.sequence+1,action:'approve'});
 await service(admin).changePublication(d.id,{expectedSequence:d.sequence+2,action:'queue'});
 await service(admin).changePublication(d.id,{expectedSequence:d.sequence+3,action:'publish'});
 return (await repo.getForManagement(d.id,admin))!;
}
async function sample(audience:Audience,published=true):Promise<Sample>{
 let doc=await repo.create({id:randomUUID(),kind:audience==='ops'?'ops':'article',title:`T055 ${audience} ${published?'formal':'draft'}`,body:'T055 permission matrix body',audience},admin);
 const assets:AssetFile[]=[];
 for(const [filename,mime] of [['cover.png','image/png'],['movie.mp4','video/mp4'],['guide.pdf','application/pdf']]){
  const id=randomUUID(),bytes=mime==='image/png'?await readFile('tests/fixtures/article-cover.png'):Buffer.from('T055 '+filename);
  await store.put(id,new Blob([bytes]).stream(),mime);
  await fixture.pool.query("INSERT INTO juyu.assets(id,document_id,uploaded_by,filename,mime_type,byte_size,object_key,status) VALUES($1::uuid,$2,'a',$3,$4,$5,$1::text,'ready')",[id,doc.id,filename,mime,bytes.length]);
  assets.push({id,document_id:doc.id,filename,mime_type:mime,byte_size:String(bytes.length),bucket:'juyu-private',object_key:id});
 }
 doc=await repo.execute(doc.id,{type:'edit',title:`T055 ${audience} ${published?'formal':'draft'}`,body:'T055 permission matrix body',audience,cover:{assetId:assets[0].id,alt:'T055 cover',position:50},blocks:[{id:'movie',type:'video',assetId:assets[1].id,caption:'T055 movie',alt:''},{id:'file',type:'file',assetId:assets[2].id,caption:'T055 guide',alt:''}]},admin,{expectedSequence:doc.sequence});
 return {doc:published?await publish(doc):doc,assets};
}
function privateResponse(r:Response){assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('vary'),'Cookie, Authorization');assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.equal(r.headers.get('cross-origin-resource-policy'),'same-origin');}
function exported(s:AuthorizationService,d:Document,render:(html:string)=>Promise<Buffer>=async()=>Buffer.from('%PDF-T055-release-fixture')){
 return exportPDF(new Request('http://local/pdf'),d.id,d.publishedRevisionId??d.workflow.revisionId,{snapshot:(id,rev)=>s.pdf(id,rev),asset:id=>s.asset(id),storage:()=>store,render});
}
before(async()=>{
 fixture=await temporaryDatabase();await migrate(fixture.pool);files=await storageFixture();store=new SupabasePrivateStorage(files.url,'test-only-key',{allowLoopback:true});
 await fixture.pool.query("INSERT INTO juyu.members(clerk_user_id,display_name,observed_role,verified_email,observed_at) VALUES('a','Admin','admin','a@example.test',now()),('b','Reviewer','admin','b@example.test',now()),('s','Support','support','s@example.test',now()),('o','Ops','ops','o@example.test',now())");
 const rp=randomBytes(24).toString('hex'),ip=randomBytes(24).toString('hex');await fixture.pool.query(`CREATE ROLE matrix_runtime LOGIN PASSWORD '${rp}' IN ROLE juyu_runtime; CREATE ROLE matrix_issuer LOGIN PASSWORD '${ip}' IN ROLE juyu_context_issuer`);
 runtime=fixture.connectAs('matrix_runtime',rp);issuer=fixture.connectAs('matrix_issuer',ip);db=new ScopedDatabase(runtime,issuer);repo=new DocumentRepository(db);
});
after(async()=>{await runtime?.end();await issuer?.end();await fixture?.close();await files?.close();});
beforeEach(async()=>{
 await fixture.pool.query('TRUNCATE juyu.documents CASCADE');
 await fixture.pool.query("UPDATE juyu.members SET disabled_at=null,observed_role=CASE clerk_user_id WHEN 's' THEN 'support' WHEN 'o' THEN 'ops' ELSE 'admin' END");
 samples={staff:await sample('staff'),ops:await sample('ops'),admin:await sample('admin'),draft:await sample('staff',false)};
});

for(const viewer of [support,ops,admin])test(`T055 ${viewer.role}: same content permissions across reader, search, files, PDF and personal lists`,async()=>{
 const s=service(viewer),allowed=new Set([samples.staff.doc.id,...(viewer.role!=='support'?[samples.ops.doc.id]:[]),...(viewer.role==='admin'?[samples.admin.doc.id]:[])]);
 const search=await s.search('T055');assert.equal(search.search.total,allowed.size);assert.deepEqual(new Set(search.search.results.map(x=>x.id)),allowed);
 assert.deepEqual(new Set((await s.navigation()).map(x=>x.id)),allowed);
 for(const {doc,assets} of Object.values(samples)){
  const canRead=allowed.has(doc.id);assert.equal(Boolean(await s.article(doc.id)),canRead);assert.equal(Boolean((await s.reader(doc.id)).article),canRead);
  for(const asset of assets){
   const reads=files.reads,r=await deliverAsset(new Request('http://local/file',{headers:{range:'bytes=0-3','if-none-match':'"previous-account"'}}),asset.id,id=>s.asset(id),store);privateResponse(r);
   assert.equal(r.status,canRead?206:404);if(canRead){assert.equal((await r.arrayBuffer()).byteLength,4);assert.equal(r.headers.get('content-type'),asset.mime_type);}else{assert.equal(files.reads,reads);assert.deepEqual(await r.json(),{error:'NOT_FOUND'});}
  }
  let renders=0;const result=await exported(s,doc,async html=>{renders++;assert.match(html,/T055/);return Buffer.from('%PDF-T055-release-fixture');});privateResponse(result);
  assert.equal(result.status,canRead?200:404);assert.equal(renders,canRead?1:0);await result.arrayBuffer();
  if(canRead){await s.saveFavorite(doc.id,{revision:doc.publishedRevisionId,saved:true});await s.recordRecent(doc.id,{revision:doc.publishedRevisionId});}
  else{await assert.rejects(s.saveFavorite(doc.id,{revision:doc.workflow.revisionId,saved:true}),/NOT_FOUND/);await assert.rejects(s.recordRecent(doc.id,{revision:doc.workflow.revisionId}),/NOT_FOUND/);}
 }
 assert.deepEqual(new Set((await s.favorites()).items.map(x=>x.id)),allowed);assert.deepEqual(new Set((await s.recent()).items.map(x=>x.id)),allowed);
 const another=viewer.id==='s'?ops:support;assert.equal((await service(another).favorites()).total,0);assert.equal((await service(another).recent()).total,0);
 if(viewer.role==='support')await assert.rejects(s.ops(),/FORBIDDEN/);else assert.equal((await s.ops()).total,1);
});

test('T055 existing service cannot retain revoked access to content, search, files or personal records',async()=>{
 let current=ops;const s=new AuthorizationService(db,async()=>current),{doc,assets}=samples.ops;
 await s.saveFavorite(doc.id,{revision:doc.publishedRevisionId,saved:true});await s.recordRecent(doc.id,{revision:doc.publishedRevisionId});assert.ok(await s.article(doc.id));
 await fixture.pool.query("UPDATE juyu.members SET observed_role='support' WHERE clerk_user_id='o'");
 assert.equal(await s.article(doc.id),null);assert.equal(await s.asset(assets[0].id),null);await assert.rejects(s.favorites(),/FORBIDDEN/);
 current={...ops,role:'support'};assert.equal((await s.search('T055')).search.total,1);assert.equal((await s.favorites()).total,0);assert.equal((await s.recent()).total,0);
 assert.equal((await exported(s,doc)).status,404);
 await fixture.pool.query("UPDATE juyu.members SET disabled_at=now() WHERE clerk_user_id='o'");assert.equal(await s.article(samples.staff.doc.id),null);await assert.rejects(s.readerMenu(),/FORBIDDEN/);
 assert.equal((await fixture.pool.query("SELECT count(*)::int n FROM juyu.favorites WHERE member_id='o'")).rows[0].n,1);
});

test('T055 current published snapshot survives drafts but is withdrawn consistently by restricted categories',async()=>{
 const s=service(support),{doc,assets}=samples.staff;
 await s.saveFavorite(doc.id,{revision:doc.publishedRevisionId,saved:true});await s.recordRecent(doc.id,{revision:doc.publishedRevisionId});
 await repo.execute(doc.id,{type:'edit',title:'UNREVIEWED_MARKER',body:'UNREVIEWED_MARKER',audience:'admin'},admin,{expectedSequence:doc.sequence});
 for(const data of [await s.reader(doc.id),await s.search('T055'),await s.favorites(),await s.recent(),await s.pdf(doc.id,doc.publishedRevisionId!)])assert.doesNotMatch(JSON.stringify(data),/UNREVIEWED_MARKER/);
 const category=randomUUID();await fixture.pool.query("INSERT INTO juyu.categories(id,name,audience) VALUES($1,'Restricted','ops')",[category]);await fixture.pool.query('INSERT INTO juyu.revision_categories(document_id,revision_id,category_id) VALUES($1,$2,$3)',[doc.id,doc.publishedRevisionId,category]);
 assert.equal(await s.article(doc.id),null);assert.equal((await s.search('T055')).search.total,0);assert.equal((await s.favorites()).total,0);assert.equal((await s.recent()).total,0);assert.equal(await s.asset(assets[0].id),null);assert.equal((await exported(s,doc)).status,404);
 assert.ok(await service(ops).article(doc.id));
});

test('T055 file response drops downloaded bytes when membership is revoked during storage read',async()=>{
 const {assets}=samples.ops,s=service(ops);let upstream:Response|undefined;
 const delayed:PrivateStorage={...store,async read(key,range,signal){upstream=await store.read(key,range,signal);await fixture.pool.query("UPDATE juyu.members SET disabled_at=now() WHERE clerk_user_id='o'");return upstream;},put:store.put.bind(store)};
 const r=await deliverAsset(new Request('http://local/file'),assets[0].id,id=>s.asset(id),delayed);assert.equal(r.status,404);privateResponse(r);assert.deepEqual(await r.json(),{error:'NOT_FOUND'});assert.ok(upstream?.bodyUsed);
});

test('T055 PDF response discards generated bytes after database revocation during rendering',async()=>{
 const {doc}=samples.ops,s=service(ops);let renders=0;
 const r=await exported(s,doc,async()=>{renders++;await fixture.pool.query("UPDATE juyu.members SET disabled_at=now() WHERE clerk_user_id='o'");return Buffer.from('%PDF-PRIVATE_CONTENT');});
 assert.equal(renders,1);assert.equal(r.status,403);privateResponse(r);assert.doesNotMatch(await r.text(),/PRIVATE_CONTENT/);
});
