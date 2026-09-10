import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import type {Pool} from 'pg';
import type {Viewer,Status,Document} from '../../src/domain/model.ts';
import type {SaveDraftInput} from '../../src/editor/contract.ts';
import {encodeEditorBody} from '../../src/editor/document.ts';
import {statuses} from '../../src/workspace/model.ts';
import {AuthorizationService} from '../../src/server/authorization/service.ts';
import {ScopedDatabase} from '../../src/server/database/scoped.ts';
import {migrate} from '../../src/server/database/migrate.ts';
import {temporaryDatabase} from './fixture.ts';
import {storageFixture} from '../storage/http-fixture.ts';
import {SupabasePrivateStorage} from '../../src/server/storage/supabase.ts';
import {uploadFile} from '../../src/server/media/upload.ts';
import {deliverAsset} from '../../src/server/storage/delivery.ts';

// Test-only trusted identities: no environment switch, production route or Clerk bypass.
const a:Viewer={id:'a',role:'admin',companyVerified:true},b:Viewer={...a,id:'b'},c:Viewer={...a,id:'c'};
const support:Viewer={id:'support',role:'support',companyVerified:true},ops:Viewer={id:'ops',role:'ops',companyVerified:true};
let fixture:Awaited<ReturnType<typeof temporaryDatabase>>,files:Awaited<ReturnType<typeof storageFixture>>,runtime:Pool,issuer:Pool,db:ScopedDatabase,store:SupabasePrivateStorage;
const service=(viewer:Viewer)=>new AuthorizationService(db,async()=>viewer);
const evidence='output/verification/T056-two-admin-workflow.json';
before(async()=>{
 await rm(evidence,{force:true});fixture=await temporaryDatabase();await migrate(fixture.pool);
 await fixture.pool.query("INSERT INTO juyu.members(clerk_user_id,display_name,observed_role,verified_email,observed_at) VALUES ('a','管理员 A','admin','a@example.test',now()),('b','管理员 B','admin','b@example.test',now()),('c','未指定的管理员 C','admin','c@example.test',now()),('support','客服','support','support@example.test',now()),('ops','运营','ops','ops@example.test',now())");
 const rp=randomBytes(24).toString('hex'),ip=randomBytes(24).toString('hex');
 await fixture.pool.query(`CREATE ROLE journey_runtime LOGIN PASSWORD '${rp}' IN ROLE juyu_runtime; CREATE ROLE journey_issuer LOGIN PASSWORD '${ip}' IN ROLE juyu_context_issuer`);
 runtime=fixture.connectAs('journey_runtime',rp);issuer=fixture.connectAs('journey_issuer',ip);db=new ScopedDatabase(runtime,issuer);
 files=await storageFixture();store=new SupabasePrivateStorage(files.url,'test-only-key',{allowLoopback:true});
});
after(async()=>{await runtime?.end();await issuer?.end();await fixture?.close();await files?.close();});

test('T056 one article completes A/B return, resubmit, publication, revision, trash and restoration with continuous reader checks',async()=>{
 const id=randomUUID(),A=service(a),B=service(b),C=service(c),journal:Record<string,unknown>[]=[];
 const immutable=new Map<number,Document['revisions'][number]>();let coverId:string|undefined=undefined;
 const png=await readFile('tests/fixtures/article-cover.png');
 const current=async()=>{const d=await A.management(id);assert.ok(d);return d;};
 function input(title:string,text:string,sequence:number|null):SaveDraftInput{
  return {expectedSequence:sequence,title,kind:'article',audience:'staff',tags:['T056'],cover:coverId?{assetId:coverId,alt:'演练封面',position:50}:null,
   body:encodeEditorBody([{id:'text',type:'paragraph',content:[{type:'text',text,styles:{}}]}])};
 }
 async function state(label:string,actor:string,status:Status,revision:number,published:number|null,lifecycle:Document['lifecycle']='active'){
  const d=await current();assert.equal(d.workflow.status,status,label);assert.equal(d.workflow.revisionId,revision,label);assert.equal(d.publishedRevisionId,published,label);assert.equal(d.lifecycle,lifecycle,label);
  for(const r of d.revisions){if(immutable.has(r.id))assert.deepEqual(r,immutable.get(r.id),'Earlier content revisions are immutable');else immutable.set(r.id,structuredClone(r));}
  const board=await A.workspace();assert.equal(board.total,lifecycle==='active'?1:0);
  for(const item of statuses)assert.equal(board.counts[item.id],lifecycle==='active'&&item.id===status?1:0,label+' '+item.name);
  for(const viewer of [support,ops]){
   const s=service(viewer),publication=await s.article(id),search=await s.search('T056'),reader=await s.reader(id);
   if(published===null){assert.equal(publication,null,label);assert.equal(reader.article,null,label);assert.equal(search.search.total,0,label);await assert.rejects(s.pdf(id,revision),/NOT_FOUND/);}
   else{
    const expected=immutable.get(published)!;assert.equal(publication?.revision_id,published,label);assert.equal(publication?.body,expected.body,label);assert.equal(publication?.title,expected.title,label);assert.equal(reader.article?.revision,published,label);
    assert.equal(search.search.total,1,label);assert.equal(search.search.results[0].title,expected.title,label);assert.equal((await s.pdf(id,published)).article.body,expected.body,label);
   }
   if(coverId){const response=await deliverAsset(new Request('http://local/asset'),coverId,x=>s.asset(x),store);assert.equal(response.status,published===null?404:200,label);assert.equal(response.headers.get('cache-control'),'private, no-store');if(published!==null)assert.deepEqual(Buffer.from(await response.arrayBuffer()),png);else await response.arrayBuffer();}
  }
  journal.push({step:journal.length+1,label,actor,result:'passed',sequence:d.sequence,status,statusLabel:statuses.find(x=>x.id===status)!.name,revision,publishedRevision:published,lifecycle,readerChecks:['Support','Ops'],at:new Date().toISOString()});
 }
 async function unchanged(label:string,actor:string,work:()=>Promise<unknown>,error:RegExp){
  const before=await current(),reviews=(await fixture.pool.query('SELECT * FROM juyu.reviews WHERE document_id=$1 ORDER BY submitted_sequence',[id])).rows;
  await assert.rejects(work,error,label);assert.deepEqual(await current(),before,label);assert.deepEqual((await fixture.pool.query('SELECT * FROM juyu.reviews WHERE document_id=$1 ORDER BY submitted_sequence',[id])).rows,reviews,label);
  journal.push({step:journal.length+1,label,actor,result:'rejected_without_mutation',sequence:before.sequence,expectedError:error.source,at:new Date().toISOString()});
 }
 async function submit(revision:number,published:number|null){
  const d=await current();await A.submitReview(id,{expectedSequence:d.sequence,reviewerId:'b'});
  assert.equal((await B.workspace({scope:'review'})).total,1);assert.equal((await C.workspace({scope:'review'})).total,0);assert.equal((await A.workspace({scope:'review'})).total,0);
  assert.equal((await B.reviewDetail(id)).canDecide,true);assert.equal((await A.reviewDetail(id)).canDecide,false);assert.equal((await C.reviewDetail(id)).canDecide,false);
  await state('A 指定 B 提交二审','a','in_review',revision,published);
 }
 async function approveAndPublish(revision:number,oldPublication:number|null){
  let d=await current();const approval={expectedSequence:d.sequence,action:'approve' as const};const receipt=await B.decideReview(id,approval);assert.deepEqual(await B.decideReview(id,approval),receipt);
  await state('B 批准；原请求重试不重复审批','b','approved',revision,oldPublication);
  d=await current();await unchanged('批准后不能跳过等待发布','a',()=>A.changePublication(id,{expectedSequence:d.sequence,action:'publish'}),/INVALID_STATE/);
  await A.changePublication(id,{expectedSequence:d.sequence,action:'queue'});await state('A 安排等待发布','a','queued',revision,oldPublication);
  d=await current();await A.changePublication(id,{expectedSequence:d.sequence,action:'publish'});await state('A 发布；员工正式版本原子替换','a','published',revision,revision);
 }

 const first=input('T056 初稿','T056 仍缺少处理依据',null);const created=await A.saveDraft(id,first);assert.deepEqual(await A.saveDraft(id,first),created);
 await state('A 新建 BlockNote 草稿；重试不重复建稿','a','draft',1,null);
 const uploaded=await uploadFile(new Request('http://local/upload',{method:'POST',headers:{'content-type':'application/octet-stream','x-file-name':'cover.png'},body:new Uint8Array(png)}),id,{authorize:()=>A.media(id),reserve:(asset,metadata)=>A.reserveUpload(id,asset,metadata),finish:(asset,ready)=>A.finishUpload(asset,ready),storage:()=>store});coverId=uploaded.id;
 assert.ok(await A.managementAsset(coverId));assert.equal(await service(support).asset(coverId),null);
 await A.saveDraft(id,input('T056 待审初稿','T056 仍缺少处理依据',(await current()).sequence));await state('A 上传私有封面并保存','a','draft',2,null);
 let d=await current();await unchanged('A 不能选择自己做二审','a',()=>A.submitReview(id,{expectedSequence:d.sequence,reviewerId:'a'}),/INVALID_REVIEWER/);
 await submit(2,null);d=await current();
 await unchanged('提交者 A 不能代替 B 批准','a',()=>A.decideReview(id,{expectedSequence:d.sequence,action:'approve'}),/NOT_REVIEWER/);
 await unchanged('未指定的管理员 C 不能批准','c',()=>C.decideReview(id,{expectedSequence:d.sequence,action:'approve'}),/NOT_REVIEWER/);
 await unchanged('审核期间不能修改被审正文','a',()=>A.saveDraft(id,input('T056 试图偷改','未经确认的新内容',d.sequence)),/FROZEN|INVALID_STATE/);
 await unchanged('未批准不能进入等待发布','a',()=>A.changePublication(id,{expectedSequence:d.sequence,action:'queue'}),/INVALID_STATE/);
 await unchanged('B 退回时必须填写原因','b',()=>B.decideReview(id,{expectedSequence:d.sequence,action:'reject',reason:' '}),/REASON_REQUIRED/);
 await B.decideReview(id,{expectedSequence:d.sequence,action:'reject',reason:'请补充异常处理依据'});await state('B 填原因退回 A','b','changes_requested',2,null);assert.equal((await A.workspace({scope:'returned'})).total,1);
 assert.equal((await A.reviewDetail(id)).review?.reason,'请补充异常处理依据');d=await current();
 await unchanged('未修改不能直接重新提交','a',()=>A.submitReview(id,{expectedSequence:d.sequence,reviewerId:'b'}),/EDIT_REQUIRED/);
 await A.saveDraft(id,input('T056 第一份正式内容','T056 已补充异常处理依据',d.sequence));await state('A 修改并保存新草稿','a','draft',3,null);
 await submit(3,null);await approveAndPublish(3,null);

 const firstPublished=await A.historyVersion(id,3);d=await current();
 await A.saveDraft(id,input('T056 第二份正式内容','T056 新增升级处理说明',d.sequence));await state('A 修改已发布文章；员工继续读第三版','a','draft',4,3);
 d=await current();await unchanged('新草稿不能沿用上一次批准直接发布','a',()=>A.changePublication(id,{expectedSequence:d.sequence,action:'queue'}),/INVALID_STATE/);
 await submit(4,3);await approveAndPublish(4,3);
 assert.deepEqual((await A.historyVersion(id,3)).version,firstPublished.version);
 d=await current();await unchanged('旧页面不能覆盖已经发布的新状态','a',()=>A.saveDraft(id,input('T056 旧页面覆盖','不得覆盖',d.sequence-1)),/CONFLICT/);
 await A.lifecycle(id,{expectedSequence:d.sequence,action:'trash'});await state('A 删除；正文搜索封面及PDF同时下线','a','draft',4,null,'trashed');assert.equal((await A.trash()).total,1);
 d=await current();await A.lifecycle(id,{expectedSequence:d.sequence,action:'restore'});await state('A 从回收站恢复；只恢复成未发布草稿','a','draft',4,null);assert.equal((await A.trash()).total,0);
 d=await current();await unchanged('恢复后不能凭历史批准直接排队','a',()=>A.changePublication(id,{expectedSequence:d.sequence,action:'queue'}),/INVALID_STATE/);
 await submit(4,null);await approveAndPublish(4,null);

 d=await current();const restored=await A.restoreVersion(id,{expectedSequence:d.sequence,sourceRevision:3});assert.equal(restored.revision,5);
 await state('A 恢复历史第三版为新草稿；第四版仍正式可读','a','draft',5,4);assert.equal((await A.historyVersion(id,5)).version.body,firstPublished.version.body);
 await submit(5,4);await approveAndPublish(5,4);
 const final=await current(),history=await A.history(id);
 assert.equal(history.eventTotal,final.sequence+1);assert.equal(history.versionTotal,5);
 const events=[...history.events];for(let page=2;page<=history.eventPages;page++)events.push(...(await A.history(id,page)).events);
 assert.deepEqual(events.map(e=>e.sequence),Array.from({length:final.sequence+1},(_,i)=>final.sequence-i));
 assert.equal(events.filter(e=>e.action==='reject').length,1);assert.equal(events.filter(e=>e.action==='approve').length,4);assert.equal(events.filter(e=>e.action==='publish').length,4);
 for(const e of events.filter(e=>e.action==='approve'||e.action==='reject'))assert.equal(e.actorId,'b');
 assert.equal(events.find(e=>e.action==='reject')?.reason,'请补充异常处理依据');assert.equal(events.find(e=>e.action==='restore_version')?.sourceRevision,3);
 const reviews=(await fixture.pool.query('SELECT revision_id,submitted_by,reviewer_id,status,reason FROM juyu.reviews WHERE document_id=$1 ORDER BY submitted_sequence',[id])).rows;
 assert.deepEqual(reviews.map(r=>r.status),['rejected','approved','approved','approved','approved']);for(const r of reviews){assert.equal(r.submitted_by,'a');assert.equal(r.reviewer_id,'b');}
 assert.equal((await fixture.pool.query('SELECT count(*)::int n FROM juyu.request_contexts')).rows[0].n,0);
 assert.deepEqual(new Set(journal.filter(x=>x.result==='passed').map(x=>x.status)),new Set(statuses.map(x=>x.id)));
 await mkdir('output/verification',{recursive:true});await writeFile(evidence,JSON.stringify({task:'T056',result:'local_passed',realAccountAcceptance:'pending_configuration',identity:'test-only trusted adapters; no actual Clerk session',database:'temporary PostgreSQL with production restricted runtime/issuer',storage:'local HTTP Supabase-shaped fixture with actual bytes',documentId:id,generatedAt:new Date().toISOString(),checkpoints:journal,final:{sequence:final.sequence,revision:5,publishedRevision:5,versionCount:history.versionTotal,eventCount:history.eventTotal,reviewCount:reviews.length},reviews,history:events},null,2)+'\n');
});
