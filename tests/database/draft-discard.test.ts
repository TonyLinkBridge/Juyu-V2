import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {discardDatabase} from '../helpers/discard-database.ts';
import {migrate} from '../../src/server/database/migrate.ts';

for(const mode of ['standard','super_admin'] as const)test(`${mode}: discard restores original publication and preserves history, relationships, links and guards`,async()=>{
 const h=await discardDatabase();try{
 const {published,draft}=await h.workingDraft(mode),id=draft.id;
 const category=randomUUID(),asset=randomUUID();
 await h.fixture.pool.query("INSERT INTO juyu.categories(id,name) VALUES($1,'测试分类')",[category]);
 await h.fixture.pool.query('INSERT INTO juyu.revision_categories VALUES($1,1,$2)',[id,category]);
 await h.service(h.author).reserveUpload(id,asset,{filename:'test.txt',mime:'text/plain',size:1});
 const snapshot=async()=>({
  slug:(await h.fixture.pool.query('SELECT slug FROM juyu.documents WHERE id=$1',[id])).rows[0].slug,
  document:(await h.repo.getForManagement(id,h.author))!,
  revisions:(await h.fixture.pool.query('SELECT * FROM juyu.revisions WHERE document_id=$1 ORDER BY revision_id',[id])).rows,
  reviews:(await h.fixture.pool.query('SELECT * FROM juyu.reviews WHERE document_id=$1 ORDER BY submitted_sequence',[id])).rows,
  categories:(await h.fixture.pool.query('SELECT * FROM juyu.revision_categories WHERE document_id=$1',[id])).rows,
  references:(await h.fixture.pool.query('SELECT * FROM juyu.revision_assets WHERE document_id=$1',[id])).rows,
  assets:(await h.fixture.pool.query('SELECT * FROM juyu.assets WHERE document_id=$1',[id])).rows,
 });
 let before=await snapshot();
 await assert.rejects(h.service(h.staff).discardDraft(id,{expectedSequence:draft.sequence}),/FORBIDDEN/);
 await assert.rejects(h.service(h.author).discardDraft(id,{expectedSequence:draft.sequence-1}),/CONFLICT/);
 await assert.rejects(h.service(h.author).discardDraft(id,{expectedSequence:draft.sequence}),/UPLOAD_IN_PROGRESS/);
 assert.deepEqual(await snapshot(),before,'rejected attempts change nothing');
 await h.service(h.author).finishUpload(asset,true);
 await h.fixture.pool.query('INSERT INTO juyu.revision_assets(document_id,revision_id,asset_id) VALUES($1,1,$2)',[id,asset]);
 before=await snapshot();
 const readerBefore=await h.service(h.staff).article(id);
 const auditBefore=(await h.fixture.pool.query('SELECT * FROM juyu.audit_log WHERE document_id=$1 ORDER BY sequence',[id])).rows;
 const result=await h.service(h.author).discardDraft(id,{expectedSequence:draft.sequence});
 assert.equal(result.sequence,draft.sequence+1);assert.equal(result.revision,published.publishedRevisionId);assert.equal(result.status,'published');
 const after=await snapshot();
 assert.equal(after.document.publishedRevisionId,published.publishedRevisionId);
 assert.deepEqual(after.document.workflow,published.workflow,'restore the original publisher/reviewer, not the discard actor');
 for(const key of ['slug','revisions','reviews','categories','references','assets'] as const)assert.deepEqual(after[key],before[key],`${key} preserved`);
 assert.deepEqual(await h.service(h.staff).article(id),readerBefore,'employee content and original route stay unchanged');
 const auditAfter=(await h.fixture.pool.query('SELECT * FROM juyu.audit_log WHERE document_id=$1 ORDER BY sequence',[id])).rows;
 assert.deepEqual(auditAfter.slice(0,-1),auditBefore);assert.equal(auditAfter.at(-1).action,'discard_draft');assert.equal(auditAfter.at(-1).discarded_revision_id,draft.workflow.revisionId);
 assert.deepEqual(await h.service(h.author).discardDraft(id,{expectedSequence:draft.sequence}),result,'exact retry is idempotent');
 assert.deepEqual(await snapshot(),after);
 await assert.rejects(h.service(h.reviewer).discardDraft(id,{expectedSequence:draft.sequence}),/CONFLICT/);
 // Repeated editing must keep allocating new revision IDs, never overwrite history.
 const again=await h.repo.execute(id,{type:'edit',title:'第二次测试草稿',body:'第二次修改',audience:'staff'},h.author,{expectedSequence:result.sequence});
 assert.ok(again.workflow.revisionId>draft.workflow.revisionId);
 await h.service(h.superAdmin).discardDraft(id,{expectedSequence:again.sequence});
 assert.equal((await h.repo.getForManagement(id,h.author))?.publishedRevisionId,published.publishedRevisionId);
 }finally{await h.close();}
});

for(const mode of ['standard','super_admin'] as const)test(`${mode}: a discarded revision can be restored as a new draft without changing the formal version`,async()=>{
 const h=await discardDatabase();try{
  const {published,draft}=await h.workingDraft(mode),id=draft.id;
  const discardedRevision=draft.workflow.revisionId;
  const discardedBody=(await h.service(h.author).historyVersion(id,discardedRevision)).version.body;
  const readerBefore=await h.service(h.staff).article(id);
  const discard=await h.service(h.author).discardDraft(id,{expectedSequence:draft.sequence});
  const detail=await h.service(h.author).historyVersion(id,discardedRevision);
  assert.equal(detail.currentRevision,published.publishedRevisionId);
  assert.equal(detail.highestRevision,discardedRevision);
  assert.equal(detail.canRestore,true);
  const restored=await h.service(h.author).restoreVersion(id,{expectedSequence:discard.sequence,sourceRevision:discardedRevision});
  assert.equal(restored.revision,discardedRevision+1);
  assert.equal(restored.publishedRevision,published.publishedRevisionId);
  assert.equal((await h.service(h.author).historyVersion(id,restored.revision)).version.body,discardedBody);
  assert.deepEqual(await h.service(h.staff).article(id),readerBefore,'the employee-facing formal version and route stay unchanged');
  assert.deepEqual(await h.service(h.author).restoreVersion(id,{expectedSequence:discard.sequence,sourceRevision:discardedRevision}),restored,'exact retry remains idempotent');
 }finally{await h.close();}
});

test('upgrade fixes existing direct-publication drafts without modifying data and migration replay is safe',async()=>{
 const h=await discardDatabase(true);try{
 const {draft}=await h.workingDraft('super_admin');
 const before=await h.repo.getForManagement(draft.id,h.author);
 await assert.rejects(h.service(h.author).discardDraft(draft.id,{expectedSequence:draft.sequence}),/INVALID_STATE/);
 assert.deepEqual(await migrate(h.fixture.pool),['0058_discard_direct_publication','0059_restore_discarded_revision']);
 assert.deepEqual(await h.repo.getForManagement(draft.id,h.author),before,'installing the function never discards a draft');
 assert.deepEqual(await migrate(h.fixture.pool),[]);
 assert.equal((await h.service(h.author).discardDraft(draft.id,{expectedSequence:draft.sequence})).status,'published');
 }finally{await h.close();}
});

test('historical direct publication survives publisher demotion while current action permissions remain enforced',async()=>{
 const h=await discardDatabase();try{
 const {draft,published}=await h.workingDraft('super_admin');
 await h.fixture.pool.query("UPDATE juyu.members SET observed_role='support',disabled_at=now() WHERE clerk_user_id='super'");
 await assert.rejects(h.service(h.superAdmin).discardDraft(draft.id,{expectedSequence:draft.sequence}),/FORBIDDEN/);
 const result=await h.service(h.author).discardDraft(draft.id,{expectedSequence:draft.sequence});
 assert.equal(result.status,'published');
 assert.deepEqual((await h.repo.getForManagement(draft.id,h.author))?.workflow,published.workflow);
 assert.equal((await h.service(h.staff).article(draft.id))?.body,'正式内容：保留不变');
 // Demoted publisher still cannot create a new direct publication.
 const fresh=await h.repo.create({id:randomUUID(),kind:'article',title:'新的测试草稿',body:'新的内容',audience:'staff'},h.author);
 await assert.rejects(h.service(h.superAdmin).changePublication(fresh.id,{action:'direct_publish',expectedSequence:0}),/FORBIDDEN/);
 }finally{await h.close();}
});

test('runtime Admin cannot forge immutable direct-publication evidence',async()=>{
 const h=await discardDatabase();try{
 const d=await h.repo.create({id:randomUUID(),kind:'article',title:'伪造发布测试',body:'保持草稿',audience:'staff'},h.author);
 await assert.rejects(h.db.run(h.author,c=>c.query("INSERT INTO juyu.audit_log(document_id,sequence,action,actor_id,revision_id,at,reviewer_id) VALUES($1,1,'direct_publish','author',1,now(),'author')",[d.id])),/missing super admin publication evidence/);
 assert.equal((await h.repo.getForManagement(d.id,h.author))?.workflow.status,'draft');
 assert.equal((await h.fixture.pool.query('SELECT count(*)::int AS n FROM juyu.audit_log WHERE document_id=$1',[d.id])).rows[0].n,1);
 }finally{await h.close();}
});
