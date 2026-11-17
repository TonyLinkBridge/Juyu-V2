import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {randomBytes,randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
import {temporaryDatabase} from './fixture.ts';
import {migrate} from '../../src/server/database/migrate.ts';
import {ScopedDatabase} from '../../src/server/database/scoped.ts';
import {DocumentRepository} from '../../src/server/database/repository.ts';
import {AuthorizationService} from '../../src/server/authorization/service.ts';
import {withdrawSavedReviews} from '../../src/server/review/bulk-withdraw.ts';
import type {Viewer,Document} from '../../src/domain/model.ts';
let fixture:Awaited<ReturnType<typeof temporaryDatabase>>,runtime:Pool,issuer:Pool,db:ScopedDatabase,repo:DocumentRepository;
const a:Viewer={id:'a',role:'admin',companyVerified:true},b:Viewer={...a,id:'b'},manager:Viewer={...a,id:'manager',role:'super_admin'},staff:Viewer={id:'staff',role:'support',companyVerified:true};
const service=(v:Viewer|null=manager)=>new AuthorizationService(db,async()=>v);
async function pending(){const d=await repo.create({id:randomUUID(),kind:'article',title:'批量权限测试',body:'正式内容',audience:'staff'},a);await service(a).submitReview(d.id,{expectedSequence:0,reviewerId:'b'});return d;}
async function receipt(id:string){return (await fixture.pool.query('SELECT * FROM juyu.reviews WHERE document_id=$1 ORDER BY submitted_sequence DESC LIMIT 1',[id])).rows[0];}
async function restoreMember(id:string){await fixture.pool.query("UPDATE juyu.members SET disabled_at=null,observed_role=$3,verified_email=$2,observed_at=now() WHERE clerk_user_id=$1",[id,`${id}@example.test`,id==='manager'?'super_admin':'admin']);}
before(async()=>{fixture=await temporaryDatabase();await migrate(fixture.pool);await fixture.pool.query("INSERT INTO juyu.members(clerk_user_id,display_name,observed_role,verified_email,observed_at) VALUES('a','A','admin','a@example.test',now()),('b','B','admin','b@example.test',now()),('manager','Super','super_admin','manager@example.test',now()),('staff','Support','support','staff@example.test',now())");const rp=randomBytes(24).toString('hex'),ip=randomBytes(24).toString('hex');await fixture.pool.query(`CREATE ROLE batch_runtime LOGIN PASSWORD '${rp}' IN ROLE juyu_runtime; CREATE ROLE batch_issuer LOGIN PASSWORD '${ip}' IN ROLE juyu_context_issuer`);runtime=fixture.connectAs('batch_runtime',rp);issuer=fixture.connectAs('batch_issuer',ip);db=new ScopedDatabase(runtime,issuer);repo=new DocumentRepository(db);});
after(async()=>{if(runtime)await runtime.end();if(issuer)await issuer.end();if(fixture)await fixture.close();});
async function waitForLock(query:string,count=1){const deadline=Date.now()+3000;let n=0;while(Date.now()<deadline){n=(await fixture.pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE $1",[query])).rows[0].n;if(n>=count)break;await new Promise(r=>setTimeout(r,5));}assert.equal(n,count,'independent real DB connections must overlap');}
const batchSnapshot=(d:{id:string;sequence:number;publishedRevisionId:number|null;workflow:{revisionId:number}})=>({documentId:d.id,expectedSequence:d.sequence,revision:d.workflow.revisionId,publishedRevision:d.publishedRevisionId});
test('bulk withdrawal covers all four content kinds, retaining old publications, contents, authors and immutable history',async()=>{
 const snapshots=[];const before=[];
 for(const kind of ['article','ops','reference','qa'] as const){let d=await repo.create({id:randomUUID(),kind,title:`批量测试 ${kind}`,body:'正式内容',audience:kind==='ops'?'ops':'staff'},a);for(const type of ['submit','approve','queue','publish'] as const)d=await repo.execute(d.id,{type},type==='approve'?b:a,{expectedSequence:d.sequence,reviewer:b});d=await repo.execute(d.id,{type:'edit',title:`待审 ${kind}`,body:'保留的草稿',audience:kind==='ops'?'ops':'staff'},a,{expectedSequence:d.sequence});await service(a).submitReview(d.id,{expectedSequence:d.sequence,reviewerId:'b'});const current=(await repo.getForManagement(d.id,a))!;snapshots.push(batchSnapshot(current));before.push(current);}
 const result=await service().withdrawReviews({items:snapshots});assert.equal(result.items.length,4);
 for(let i=0;i<snapshots.length;i++){const saved:Document=(await repo.getForManagement(snapshots[i].documentId,a))!;assert.equal(saved.workflow.status,'draft');assert.equal(saved.sequence,before[i].sequence+1);assert.deepEqual(saved.revisions,before[i].revisions);assert.equal(saved.publishedRevisionId,1);assert.deepEqual(saved.audit.slice(0,-1),before[i].audit);assert.equal(saved.audit.at(-1)?.action,'withdraw');assert.equal(saved.audit.at(-1)?.actorId,manager.id);assert.equal((await service().article(saved.id))?.body,'正式内容');assert.equal((await receipt(saved.id)).status,'withdrawn');}
 assert.deepEqual(await service().withdrawReviews({items:snapshots}),result);
});
test('bulk withdrawal rejects forbidden users and one stale selection rolls back the entire batch',async()=>{
 const docs=[await pending(),await pending()];const current=await Promise.all(docs.map(d=>repo.getForManagement(d.id,a)));const input={items:current.map(d=>batchSnapshot(d!))};
 for(const v of [null,a,b,staff,{...manager,role:'admin' as const},{...manager,companyVerified:false}])await assert.rejects(service(v).withdrawReviews(input),/FORBIDDEN/);
 await service(b).decideReview(docs[1].id,{expectedSequence:1,action:'approve'});const firstBefore=await repo.getForManagement(docs[0].id,a);await assert.rejects(service().withdrawReviews(input),/CONFLICT|INVALID_STATE/);assert.deepEqual(await repo.getForManagement(docs[0].id,a),firstBefore);
 await fixture.pool.query("UPDATE juyu.members SET observed_role='support' WHERE clerk_user_id='manager'");try{await assert.rejects(service().withdrawReviews({items:[input.items[0]]}),/FORBIDDEN/);}finally{await restoreMember('manager');}
});
test('bulk withdrawal rolls back all audit and receipt updates after a later database failure',async()=>{
 const docs=[await pending(),await pending()].sort((x,y)=>x.id.localeCompare(y.id));const current=await Promise.all(docs.map(d=>repo.getForManagement(d.id,a)));const input={items:current.map(d=>batchSnapshot(d!))};
 await fixture.pool.query(`CREATE FUNCTION juyu.fail_batch_withdraw() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.document_id='${docs[1].id}' AND NEW.action='withdraw' THEN RAISE EXCEPTION 'injected batch failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_batch_withdraw BEFORE INSERT ON juyu.audit_log FOR EACH ROW EXECUTE FUNCTION juyu.fail_batch_withdraw()`);
 try{await assert.rejects(service().withdrawReviews(input),/injected batch failure/);for(let i=0;i<docs.length;i++){assert.deepEqual(await repo.getForManagement(docs[i].id,a),current[i]);assert.equal((await receipt(docs[i].id)).status,'in_review');}}finally{await fixture.pool.query('DROP TRIGGER fail_batch_withdraw ON juyu.audit_log; DROP FUNCTION juyu.fail_batch_withdraw()');}
});
test('concurrent overlapping bulk retries do not deadlock or repeat history and cannot withdraw a resubmission',async()=>{
 const docs=[await pending(),await pending()];const input={items:await Promise.all(docs.map(async d=>batchSnapshot((await repo.getForManagement(d.id,a))!)))};
 const [first,second]=await Promise.all([service().withdrawReviews(input),service().withdrawReviews({items:[...input.items].reverse()})]);assert.deepEqual(first.items.map(x=>x.documentId).sort(),second.items.map(x=>x.documentId).sort());for(const d of docs)assert.equal((await service().controlReviewDetail(d.id)).history.length,1);
 await service(a).submitReview(docs[0].id,{expectedSequence:2,reviewerId:'b'});await assert.rejects(service().withdrawReviews(input),/CONFLICT/);assert.equal((await service().controlReviewDetail(docs[0].id)).status,'in_review');
});

test('bulk withdrawal rechecks a demoted actor after locks and refuses mixed fresh/replayed selections',async()=>{
 const docs=[await pending(),await pending()];const input={items:await Promise.all(docs.map(async d=>batchSnapshot((await repo.getForManagement(d.id,a))!)))};
 await service().changeReviewControl(docs[0].id,{expectedSequence:1,action:'withdraw'});await assert.rejects(service().withdrawReviews(input),/CONFLICT/);assert.equal((await service().controlReviewDetail(docs[1].id)).status,'in_review');
 const blocker=await fixture.pool.connect();await blocker.query('BEGIN');await blocker.query("UPDATE juyu.members SET observed_role='support' WHERE clerk_user_id='manager'");const work=service().withdrawReviews({items:[input.items[1]]}).then(value=>({value,error:null}),error=>({value:null,error}));
 try{await waitForLock('SELECT clerk_user_id FROM juyu.members%');}finally{await blocker.query('COMMIT');blocker.release();}
 try{assert.match((await work).error?.message??'unexpected success',/FORBIDDEN/);assert.equal((await service(a).controlReviewDetail(docs[1].id)).status,'in_review');}finally{await restoreMember('manager');}
});

test('the full thirty-document page withdraws atomically and a thirty-first item is rejected without changes',async()=>{
 const docs=[];for(let i=0;i<31;i++)docs.push(await pending());const snapshots=await Promise.all(docs.map(async d=>batchSnapshot((await repo.getForManagement(d.id,a))!)));
 await assert.rejects(service().withdrawReviews({items:snapshots}),/INVALID_INPUT/);assert.equal((await service().controlReviewDetail(docs[0].id)).status,'in_review');
 const result=await service().withdrawReviews({items:snapshots.slice(0,30)});assert.equal(result.items.length,30);for(const row of result.items){assert.equal(row.status,'draft');assert.equal(row.sequence,2);assert.equal((await receipt(row.documentId)).status,'withdrawn');}assert.equal((await service().controlReviewDetail(docs[30].id)).status,'in_review');
});

test('ordinary Admin cannot use bulk withdrawal even though single-document withdrawal remains available',async()=>{
 const doc=await pending();const input={items:[batchSnapshot((await repo.getForManagement(doc.id,a))!)]};
 await assert.rejects(service(a).withdrawReviews(input),/FORBIDDEN/);
 assert.equal((await service().controlReviewDetail(doc.id)).status,'in_review');
 await service(a).changeReviewControl(doc.id,{expectedSequence:1,action:'withdraw'});
 assert.equal((await service().controlReviewDetail(doc.id)).status,'draft');
});

test('workspace only grants batch capability to a current eligible Super Admin and raw runtime calls cannot bypass it',async()=>{
 assert.equal((await service(a).workspace()).canBulkWithdraw,false);assert.equal((await service().workspace()).canBulkWithdraw,true);
 await service().requireBulkWithdrawSuperAdmin();await assert.rejects(service(a).requireBulkWithdrawSuperAdmin(),/FORBIDDEN/);
 const d=await pending(),input={items:[batchSnapshot((await repo.getForManagement(d.id,a))!)]};await assert.rejects(db.run(a,c=>withdrawSavedReviews(c,input,a)),/FORBIDDEN/);assert.equal((await service().controlReviewDetail(d.id)).status,'in_review');
});
test('Super Admin downgrade to ordinary Admin during document locking rejects the entire batch',async()=>{
 const d=await pending(),input={items:[batchSnapshot((await repo.getForManagement(d.id,a))!)]};const blocker=await fixture.pool.connect();await blocker.query('BEGIN');await blocker.query('SELECT id FROM juyu.documents WHERE id=$1 FOR UPDATE',[d.id]);
 const work=service().withdrawReviews(input).then(value=>({value,error:null}),error=>({value:null,error}));try{await waitForLock('SELECT id FROM juyu.documents%');await fixture.pool.query("UPDATE juyu.members SET observed_role='admin' WHERE clerk_user_id='manager'");}finally{await blocker.query('COMMIT');blocker.release();}
 try{assert.match((await work).error?.message??'unexpected success',/FORBIDDEN/);assert.equal((await service(a).controlReviewDetail(d.id)).status,'in_review');assert.equal((await service(a).controlReviewDetail(d.id)).history.length,0);}finally{await restoreMember('manager');}
});

test('ordinary Admin only gets an own-submission shortcut for pending versions, in all four content types',async()=>{
 for(const kind of ['article','ops','reference','qa'] as const){let d=await repo.create({id:randomUUID(),kind,title:`本人送审 ${kind}`,body:'原正式正文',audience:kind==='ops'?'ops':'staff'},a);for(const type of ['submit','approve','queue','publish'] as const)d=await repo.execute(d.id,{type},type==='approve'?b:a,{expectedSequence:d.sequence,reviewer:b});d=await repo.execute(d.id,{type:'edit',title:`本人送审 ${kind}`,body:'保留的待审正文',audience:kind==='ops'?'ops':'staff'},a,{expectedSequence:d.sequence});await service(a).submitReview(d.id,{expectedSequence:d.sequence,reviewerId:'b'});const before=(await repo.getForManagement(d.id,a))!;assert.equal((await service(a).controlReviewDetail(d.id)).kind,kind);
 assert.equal((await service(a).workspace({kind})).items.find(row=>row.id===d.id)?.canWithdrawSubmission,true);assert.equal((await service(b).workspace({kind})).items.find(row=>row.id===d.id)?.canWithdrawSubmission,false);assert.equal((await service().workspace({kind})).items.find(row=>row.id===d.id)?.canWithdrawSubmission,false);
 await service(a).changeReviewControl(d.id,{expectedSequence:before.sequence,action:'withdraw'});const after=(await repo.getForManagement(d.id,a))!;assert.deepEqual(after.revisions,before.revisions);assert.equal(after.publishedRevisionId,1);assert.deepEqual(after.audit.slice(0,-1),before.audit);assert.equal(after.audit.at(-1)?.actorId,'a');assert.equal((await service(a).article(d.id))?.body,'原正式正文');assert.equal((await service(a).workspace({kind})).items.find(row=>row.id===d.id)?.canWithdrawSubmission,false);
 }
});
