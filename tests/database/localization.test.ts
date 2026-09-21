import assert from 'node:assert/strict';
import {after,before,test} from 'node:test';
import {randomBytes,randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
import {temporaryDatabase} from './fixture.ts';
import {migrate} from '../../src/server/database/migrate.ts';
import {DocumentRepository} from '../../src/server/database/repository.ts';
import {ScopedDatabase} from '../../src/server/database/scoped.ts';
import {AuthorizationService} from '../../src/server/authorization/service.ts';
import {encodeEditorBody} from '../../src/editor/document.ts';

let fixture:Awaited<ReturnType<typeof temporaryDatabase>>;
let runtime:Pool,issuer:Pool,db:ScopedDatabase;
before(async()=>{
 fixture=await temporaryDatabase();
 await migrate(fixture.pool);
 await fixture.pool.query("INSERT INTO juyu.members(clerk_user_id,display_name,observed_role,verified_email,observed_at) VALUES('writer','Writer','admin','writer@example.test',now()),('reviewer','Reviewer','admin','reviewer@example.test',now()),('employee','Employee','support','employee@example.test',now())");
 const rp=randomBytes(24).toString('hex'),ip=randomBytes(24).toString('hex');
 await fixture.pool.query(`CREATE ROLE locale_runtime LOGIN PASSWORD '${rp}' IN ROLE juyu_runtime;CREATE ROLE locale_issuer LOGIN PASSWORD '${ip}' IN ROLE juyu_context_issuer`);
 runtime=fixture.connectAs('locale_runtime',rp);issuer=fixture.connectAs('locale_issuer',ip);db=new ScopedDatabase(runtime,issuer);
});
after(async()=>{await runtime?.end();await issuer?.end();await fixture?.close();});

async function document(id:string,kind:'article'|'ops'='article',locale='zh-CN',translationOf:string|null=null){
 const c=await fixture.pool.connect();
 try{
  await c.query('BEGIN');
  await c.query(`INSERT INTO juyu.documents(id,kind,sequence,workflow_revision_id,workflow_state,locale,translation_of)
  VALUES($1,$2,0,1,'draft',$3,$4)`,[id,kind,locale,translationOf]);
  await c.query(`INSERT INTO juyu.revisions(document_id,revision_id,title,body,audience,author_id,editor_id,created_at)
  VALUES($1,1,$2,'',$3,'writer','writer',now())`,[id,`title-${id}`,kind==='ops'?'ops':'staff']);
  await c.query(`INSERT INTO juyu.audit_log(document_id,sequence,action,actor_id,revision_id,at)
  VALUES($1,0,'create','writer',1,now())`,[id]);
  await c.query('COMMIT');
 }catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}
}

test('existing Chinese documents remain the source and English documents require a matching source',async()=>{
 const source=randomUUID(),english=randomUUID();
 await document(source);
 await document(english,'article','en',source);
 assert.deepEqual((await fixture.pool.query('SELECT locale,translation_of FROM juyu.documents WHERE id=$1',[english])).rows,[{locale:'en',translation_of:source}]);
 await assert.rejects(document(randomUUID(),'article','en',source),{code:'23505'});
 const secondSource=randomUUID();await document(secondSource);
 await assert.rejects(document(randomUUID(),'ops','en',secondSource),/TRANSLATION_KIND_MISMATCH/);
 await assert.rejects(document(randomUUID(),'article','en',randomUUID()),{code:'23503'});
 await assert.rejects(document(randomUUID(),'article','fr',source),{code:'23514'});
});

test('an English draft saves separately without copying or changing Chinese content',async()=>{
 const source=randomUUID(),english=randomUUID();await document(source);
 const repo=new DocumentRepository(db);
 const input={expectedSequence:null,locale:'en',translationOf:source,title:'How to update your email',description:'A clear path for account owners.',body:encodeEditorBody([{id:'step',type:'paragraph',content:[{type:'text',text:'Contact support with your account ID.',styles:{}}]}]),kind:'article',audience:'staff',tags:[],cover:null};
 const actor={id:'writer',role:'admin' as const,companyVerified:true};
 const draft=await repo.saveEditor(english,input,actor);
 assert.equal(draft.locale,'en');assert.equal(draft.translationOf,source);assert.equal(draft.status,'draft');
 assert.equal(draft.title,'How to update your email');
 assert.equal((await repo.getEditor(source,actor)).title,`title-${source}`);
 assert.equal((await repo.getEditor(source,actor)).translation?.documentId,english);
 await assert.rejects(repo.saveEditor(english,{...input,expectedSequence:draft.sequence,locale:'zh-CN',translationOf:null},actor),/INVALID_LOCALE/);
 await assert.rejects(repo.saveEditor(randomUUID(),{...input,translationOf:randomUUID()},actor),/INVALID_TRANSLATION_SOURCE/);
});

test('English publication requires the independent reviewer to confirm a natural-language review',async()=>{
 const source=randomUUID(),english=randomUUID(),repo=new DocumentRepository(db);
 const writer={id:'writer',role:'admin' as const,companyVerified:true},reviewer={...writer,id:'reviewer'};
 await document(source);
 const saved=await repo.saveEditor(english,{expectedSequence:null,locale:'en',translationOf:source,title:'Update your account email',body:encodeEditorBody([{id:'step',type:'paragraph',content:[{type:'text',text:'Ask the account owner to contact support.',styles:{}}]}]),kind:'article',audience:'staff',tags:[],cover:null},writer);
 const authorService=new AuthorizationService(db,async()=>writer),reviewerService=new AuthorizationService(db,async()=>reviewer);
 await authorService.submitReview(english,{expectedSequence:saved.sequence,reviewerId:reviewer.id});
 await assert.rejects(reviewerService.decideReview(english,{expectedSequence:saved.sequence+1,action:'approve'}),/ENGLISH_REVIEW_REQUIRED/);
 await reviewerService.decideReview(english,{expectedSequence:saved.sequence+1,action:'approve',englishReviewConfirmed:true});
 assert.equal((await fixture.pool.query('SELECT english_quality_confirmed FROM juyu.reviews WHERE document_id=$1',[english])).rows[0]?.english_quality_confirmed,true);
 const detail=await authorService.publicationDetail(english);
 assert.equal(detail.canQueue,true);
});

test('an older English approval without a quality attestation cannot be queued',async()=>{
 const source=randomUUID(),english=randomUUID(),repo=new DocumentRepository(db);
 const writer={id:'writer',role:'admin' as const,companyVerified:true},reviewer={...writer,id:'reviewer'};
 await document(source);
 const saved=await repo.saveEditor(english,{expectedSequence:null,locale:'en',translationOf:source,title:'Account email',body:encodeEditorBody([{id:'step',type:'paragraph',content:[{type:'text',text:'Contact support.',styles:{}}]}]),kind:'article',audience:'staff',tags:[],cover:null},writer);
 const submitted=await repo.execute(english,{type:'submit'},writer,{expectedSequence:saved.sequence,reviewer});
 await repo.execute(english,{type:'approve'},reviewer,{expectedSequence:submitted.sequence,reviewer});
 const authorService=new AuthorizationService(db,async()=>writer);
 const detail=await authorService.publicationDetail(english);
 assert.equal(detail.canQueue,false);
 await assert.rejects(authorService.changePublication(english,{expectedSequence:submitted.sequence+1,action:'queue'}),/CONFLICT|INVALID_STATE|APPROVAL/);
});

test('employee language switch exposes only separately published and currently authorized versions',async()=>{
 const source=randomUUID(),english=randomUUID(),repo=new DocumentRepository(db);
 const writer={id:'writer',role:'admin' as const,companyVerified:true},reviewer={...writer,id:'reviewer'},employee={id:'employee',role:'support' as const,companyVerified:true};
 const body=(text:string)=>encodeEditorBody([{id:'step',type:'paragraph',content:[{type:'text' as const,text,styles:{}}]}]);
 await repo.saveEditor(source,{expectedSequence:null,locale:'zh-CN',translationOf:null,title:'修改账户邮箱',body:body('请联系人工客服'),kind:'article',audience:'staff',tags:[],cover:null},writer);
 for(const type of ['submit','approve','queue','publish'] as const){
  const doc=await repo.getForManagement(source,writer);assert.ok(doc);
  await repo.execute(source,{type},type==='approve'?reviewer:writer,{expectedSequence:doc.sequence,reviewer});
 }
 await repo.saveEditor(english,{expectedSequence:null,locale:'en',translationOf:source,title:'How to change your account email',body:body('Contact our support team.'),kind:'article',audience:'staff',tags:[],cover:null},writer);
 const translation=(id:string,locale:string)=>db.run(employee,c=>c.query<{id:string}>('SELECT id FROM juyu.read_translation_variant($1,$2)',[id,locale]),true);
 const reader=new AuthorizationService(db,async()=>employee);
 assert.deepEqual((await translation(source,'en')).rows,[]);
 assert.equal(await reader.article(english),null);
 assert.equal((await reader.reader(english)).article,null);
 assert.equal((await reader.article(source))?.title,'修改账户邮箱');
 for(const type of ['submit','approve','queue','publish'] as const){
  const doc=await repo.getForManagement(english,writer);assert.ok(doc);
  await repo.execute(english,{type},type==='approve'?reviewer:writer,{expectedSequence:doc.sequence,reviewer});
 }
 assert.deepEqual((await translation(source,'en')).rows,[{id:english}]);
 assert.deepEqual((await translation(english,'zh-CN')).rows,[{id:source}]);
 assert.equal((await reader.article(english))?.title,'How to change your account email');
 assert.equal((await reader.article(source))?.title,'修改账户邮箱');
 const englishPage=await reader.reader(english),chinesePage=await reader.reader(source);
 assert.equal(englishPage.article?.locale,'en');assert.equal(englishPage.article?.sourceId,source);
 assert.equal(englishPage.referenceAliases?.[source],english);
 assert.equal(chinesePage.article?.englishId,english);
 assert.equal(englishPage.pages.some(item=>item.type==='document'&&item.id===source),false);
 assert.equal(chinesePage.pages.some(item=>item.type==='document'&&item.id===english),false);
 const englishSearch=await reader.search('Contact',undefined,'all','en');
 assert.equal(englishSearch.search.total,1);assert.equal(englishSearch.search.results[0]?.id,english);
 assert.equal((await reader.search('Contact',undefined,'all','zh-CN')).search.total,0);
 assert.equal((await reader.search('修改账户邮箱',undefined,'all','zh-CN')).search.results[0]?.id,source);
 assert.deepEqual((await reader.changelog(1,'en')).items.map(item=>item.id),[english]);
 assert.deepEqual((await reader.changelog(1,'zh-CN')).items.map(item=>item.id),[source]);
 await reader.saveFavorite(source,{revision:1,saved:true});
 await reader.saveFavorite(english,{revision:1,saved:true});
 assert.deepEqual((await reader.favorites(1,'en')).items.map(item=>item.id),[english]);
 assert.deepEqual((await reader.favorites(1,'zh-CN')).items.map(item=>item.id),[source]);
 await reader.recordRecent(source,{revision:1});
 await reader.recordRecent(english,{revision:1});
 assert.deepEqual((await reader.recent(1,'en')).items.map(item=>item.id),[english]);
 assert.deepEqual((await reader.recent(1,'zh-CN')).items.map(item=>item.id),[source]);
 await assert.rejects(translation(source,'fr'),/INVALID_LOCALE/);
});

test('OPS entry keeps Chinese and English publications in separate authorized lists',async()=>{
 const source=randomUUID(),english=randomUUID(),repo=new DocumentRepository(db);
 const writer={id:'writer',role:'admin' as const,companyVerified:true},reviewer={...writer,id:'reviewer'};
 const input={expectedSequence:null,locale:'zh-CN' as const,translationOf:null,title:'运营升级流程',body:encodeEditorBody([{id:'step',type:'paragraph',content:[{type:'text' as const,text:'交给值班人员处理。',styles:{}}]}]),kind:'ops' as const,audience:'ops' as const,tags:[],cover:null};
 await repo.saveEditor(source,input,writer);
 await repo.saveEditor(english,{...input,locale:'en',translationOf:source,title:'Escalating an operations issue'},writer);
 const publish=async(id:string)=>{for(const type of ['submit','approve','queue','publish'] as const){const doc=await repo.getForManagement(id,writer);assert.ok(doc);await repo.execute(id,{type},type==='approve'?reviewer:writer,{expectedSequence:doc.sequence,reviewer});}};
 await publish(source);
 const service=new AuthorizationService(db,async()=>writer);
 assert.equal(await service.firstOpsId(),source);
 assert.equal(await service.firstOpsId('en'),null);
 await publish(english);
 assert.equal(await service.firstOpsId('en'),english);
 assert.deepEqual((await service.ops(1,'en')).items.map(item=>item.id),[english]);
 assert.deepEqual((await service.ops(1,'zh-CN')).items.map(item=>item.id),[source]);
});

test('Reference and Q&A show only published entries in the requested language',async()=>{
 const repo=new DocumentRepository(db);
 const writer={id:'writer',role:'admin' as const,companyVerified:true},reviewer={...writer,id:'reviewer'};
 const reader=new AuthorizationService(db,async()=>({id:'employee',role:'support' as const,companyVerified:true}));
 const body=encodeEditorBody([{id:'answer',type:'paragraph',content:[{type:'text' as const,text:'Contact support.',styles:{}}]}]);
 const publish=async(id:string)=>{for(const type of ['submit','approve','queue','publish'] as const){const doc=await repo.getForManagement(id,writer);assert.ok(doc);await repo.execute(id,{type},type==='approve'?reviewer:writer,{expectedSequence:doc.sequence,reviewer});}};
 for(const kind of ['reference','qa'] as const){
  const source=randomUUID(),english=randomUUID();
  const input={expectedSequence:null,locale:'zh-CN' as const,translationOf:null,title:kind==='qa'?'如何修改邮箱？':'账户费用速查',body,kind,audience:'staff' as const,tags:[],cover:null,...(kind==='qa'?{qa:{category:'账户',position:0}}:{})};
  await repo.saveEditor(source,input,writer);
  await repo.saveEditor(english,{...input,locale:'en',translationOf:source,title:kind==='qa'?'How do I change my email?':'Account fees at a glance',...(kind==='qa'?{qa:{category:'Account',position:0}}:{})},writer);
  await publish(source);
  if(kind==='qa'){
   assert.deepEqual((await reader.qa(1,undefined,'','zh-CN')).items.map(item=>item.id),[source]);
   assert.equal((await reader.qa(1,undefined,'','en')).total,0);
   await assert.rejects(reader.qaAnswer(source,'en'),/FORBIDDEN/);
  }else{
   assert.deepEqual((await reader.reference(1,'zh-CN')).items.map(item=>item.id),[source]);
   assert.equal((await reader.reference(1,'en')).total,0);
   await assert.rejects(reader.referenceDetail(source,'en'),/NOT_FOUND/);
  }
  await publish(english);
  if(kind==='qa'){
   assert.deepEqual((await reader.qa(1,undefined,'','en')).items.map(item=>item.id),[english]);
   assert.equal((await reader.qaAnswer(english,'en')).title,'How do I change my email?');
   assert.equal((await reader.reader(english)).destination,`/help-centre/qa?question=${encodeURIComponent(english)}&lang=en#qa-${encodeURIComponent(english)}`);
   await assert.rejects(reader.qaAnswer(english,'zh-CN'),/FORBIDDEN/);
  }else{
   assert.deepEqual((await reader.reference(1,'en')).items.map(item=>item.id),[english]);
   assert.equal((await reader.referenceDetail(english,'en')).title,'Account fees at a glance');
   await assert.rejects(reader.referenceDetail(english,'zh-CN'),/NOT_FOUND/);
  }
 }
});
