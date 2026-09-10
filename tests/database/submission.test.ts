import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {randomBytes,randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
import {temporaryDatabase} from './fixture.ts';
import {migrate} from '../../src/server/database/migrate.ts';
import {ScopedDatabase} from '../../src/server/database/scoped.ts';
import {DocumentRepository} from '../../src/server/database/repository.ts';
import {AuthorizationService} from '../../src/server/authorization/service.ts';
import type {Viewer} from '../../src/domain/model.ts';
let fixture:Awaited<ReturnType<typeof temporaryDatabase>>,runtime:Pool,issuer:Pool,db:ScopedDatabase,repo:DocumentRepository;
const a:Viewer={id:'a',role:'admin',companyVerified:true},b:Viewer={...a,id:'b'},c:Viewer={...a,id:'c'},staff:Viewer={id:'staff',role:'support',companyVerified:true};
const service=(v:Viewer|null=a)=>new AuthorizationService(db,async()=>v);
async function draft(){return repo.create({id:randomUUID(),kind:'article',title:'二审资料',body:'正式内容',audience:'staff'},a);}
before(async()=>{fixture=await temporaryDatabase();await migrate(fixture.pool);await fixture.pool.query("INSERT INTO juyu.members(clerk_user_id,display_name,observed_role,verified_email,observed_at) VALUES('a','A','admin','a@example.test',now()),('b','B','admin','b@example.test',now()),('c','C','admin','c@example.test',now()),('staff','Support','support','staff@example.test',now())");const rp=randomBytes(24).toString('hex'),ip=randomBytes(24).toString('hex');await fixture.pool.query(`CREATE ROLE submission_runtime LOGIN PASSWORD '${rp}' IN ROLE juyu_runtime; CREATE ROLE submission_issuer LOGIN PASSWORD '${ip}' IN ROLE juyu_context_issuer`);runtime=fixture.connectAs('submission_runtime',rp);issuer=fixture.connectAs('submission_issuer',ip);db=new ScopedDatabase(runtime,issuer);repo=new DocumentRepository(db);});
after(async()=>{if(runtime)await runtime.end();if(issuer)await issuer.end();if(fixture)await fixture.close();});
test('submission lists independent current Admin candidates and atomically freezes a saved revision',async()=>{const d=await draft();assert.equal(typeof service().reviewers,'function');const options=await service().reviewers(d.id);assert.deepEqual(options,{documentId:d.id,sequence:0,revision:1,status:'draft',lifecycle:'active',reviewers:[{id:'b',name:'B'},{id:'c',name:'C'}],nextCursor:null});const result=await service().submitReview(d.id,{expectedSequence:0,reviewerId:'b'});assert.deepEqual(result,{documentId:d.id,sequence:1,revision:1,reviewerId:'b',status:'in_review'});const saved=await repo.getForManagement(d.id,a);assert.equal(saved?.workflow.reviewerId,'b');assert.equal(saved?.audit.at(-1)?.action,'submit');await assert.rejects(repo.execute(d.id,{type:'edit',title:'tamper',body:'tamper',audience:'staff'},a,{expectedSequence:1}),/INVALID_STATE/);assert.equal((await fixture.pool.query('SELECT count(*)::int AS n FROM juyu.reviews WHERE document_id=$1',[d.id])).rows[0].n,1);});
test('unknown, malformed, self, nonadmin, stale actor and unverified requests fail closed',async()=>{const d=await draft();for(const v of [null,staff,{...a,companyVerified:false}]){await assert.rejects(service(v).reviewers(d.id),/FORBIDDEN/);await assert.rejects(service(v).submitReview(d.id,{expectedSequence:0,reviewerId:'b'}),/FORBIDDEN/);}for(const value of [null,[],{}, {expectedSequence:0,reviewerId:'b',role:'admin'}, {expectedSequence:'0',reviewerId:'b'},{expectedSequence:2147483647,reviewerId:'b'},{expectedSequence:0,reviewerId:['b']}])await assert.rejects(service().submitReview(d.id,value),/INVALID_INPUT/);for(const reviewerId of ['a','staff','missing'])await assert.rejects(service().submitReview(d.id,{expectedSequence:0,reviewerId}),/INVALID_REVIEWER/);await assert.rejects(service().submitReview(d.id,{expectedSequence:1,reviewerId:'b'}),/CONFLICT/);await assert.rejects(service().reviewers(randomUUID()),/NOT_FOUND/);await fixture.pool.query("UPDATE juyu.members SET observed_role='support' WHERE clerk_user_id='a'");try{await assert.rejects(service().reviewers(d.id),/FORBIDDEN/);await assert.rejects(service().submitReview(d.id,{expectedSequence:0,reviewerId:'b'}),/FORBIDDEN/);}finally{await fixture.pool.query("UPDATE juyu.members SET observed_role='admin' WHERE clerk_user_id='a'");}});
test('candidate eligibility excludes author, editor, disabled, unverified and pending members',async()=>{
 let d=await draft();d=await repo.execute(d.id,{type:'edit',title:'Edited',body:'saved',audience:'staff'},b,{expectedSequence:0});
 assert.deepEqual((await service(c).reviewers(d.id)).reviewers,[]);
 for(const reviewerId of ['a','b','c'])await assert.rejects(service(c).submitReview(d.id,{expectedSequence:1,reviewerId}),/INVALID_REVIEWER/);
 const fresh=await draft();
 for(const update of ["disabled_at=now()","observed_role='support'","verified_email=null","observed_at=null"]){
  await fixture.pool.query(`UPDATE juyu.members SET ${update} WHERE clerk_user_id='b'`);
  try{assert.ok(!(await service().reviewers(fresh.id)).reviewers.some(x=>x.id==='b'));await assert.rejects(service().submitReview(fresh.id,{expectedSequence:0,reviewerId:'b'}),/INVALID_REVIEWER/);}
  finally{await fixture.pool.query("UPDATE juyu.members SET disabled_at=null,observed_role='admin',verified_email='b@example.test',observed_at=now() WHERE clerk_user_id='b'");}
 }
 const op=(await fixture.pool.query("INSERT INTO juyu.member_operations(actor_id,target_id,kind,requested_role) VALUES('a','b','role','support') RETURNING id")).rows[0].id;
 try{assert.ok(!(await service().reviewers(fresh.id)).reviewers.some(x=>x.id==='b'));await assert.rejects(service().submitReview(fresh.id,{expectedSequence:0,reviewerId:'b'}),/INVALID_REVIEWER/);}
 finally{await fixture.pool.query("UPDATE juyu.member_operations SET status='conflict',finished_at=now() WHERE id=$1",[op]);}
 await fixture.pool.query("INSERT INTO juyu.role_enrollments(member_id,requested_role,purpose) VALUES('b','support','default')");
 try{assert.ok(!(await service().reviewers(fresh.id)).reviewers.some(x=>x.id==='b'));await assert.rejects(service().submitReview(fresh.id,{expectedSequence:0,reviewerId:'b'}),/INVALID_REVIEWER/);}
 finally{await fixture.pool.query("UPDATE juyu.role_enrollments SET state='complete',confirmed_at=now() WHERE member_id='b'");}
 assert.equal((await repo.getForManagement(fresh.id,a))?.sequence,0);
});
test('candidate pages are bounded, private and expose a cursor without dropping later Admins',async()=>{
 const d=await draft();await fixture.pool.query("INSERT INTO juyu.members(clerk_user_id,display_name,observed_role,verified_email,observed_at) SELECT 'page-'||lpad(i::text,3,'0'),'Admin '||i,'admin','admin'||i||'@example.test',now() FROM generate_series(1,35) i");
 try{const one=await service().reviewers(d.id),two=await service().reviewers(d.id,one.nextCursor!);assert.equal(one.reviewers.length,30);assert.ok(one.nextCursor);assert.equal(two.reviewers.length,7);assert.equal(two.nextCursor,null);assert.equal(new Set([...one.reviewers,...two.reviewers].map(r=>r.id)).size,37);assert.ok(!JSON.stringify(one).includes('@example'));assert.ok(!JSON.stringify(one).includes('verified_email'));}
 finally{await fixture.pool.query("UPDATE juyu.members SET disabled_at=now() WHERE clerk_user_id LIKE 'page-%'");}
 assert.equal((await runtime.query("SELECT juyu.review_admin_eligible('b') AS eligible")).rows[0].eligible,false);
 assert.equal((await db.run(staff,c=>c.query("SELECT juyu.review_admin_eligible('b') AS eligible"),true)).rows[0].eligible,false);
});
test('exact acknowledgement retries are idempotent while different submissions conflict',async()=>{
 const d=await draft(),input={expectedSequence:0,reviewerId:'b'};
 const results=await Promise.all([service().submitReview(d.id,input),service().submitReview(d.id,input)]);assert.deepEqual(results[0],results[1]);
 await assert.rejects(service().submitReview(d.id,{...input,reviewerId:'c'}),/CONFLICT/);
 await assert.rejects(service(c).submitReview(d.id,input),/CONFLICT/);
 await fixture.pool.query("UPDATE juyu.members SET disabled_at=now() WHERE clerk_user_id='b'");
 try{assert.deepEqual(await service().submitReview(d.id,input),results[0]);}finally{await fixture.pool.query("UPDATE juyu.members SET disabled_at=null WHERE clerk_user_id='b'");}
 assert.equal((await fixture.pool.query("SELECT count(*)::int AS n FROM juyu.audit_log WHERE document_id=$1 AND action='submit'",[d.id])).rows[0].n,1);
 assert.equal((await fixture.pool.query('SELECT count(*)::int AS n FROM juyu.reviews WHERE document_id=$1',[d.id])).rows[0].n,1);
 await repo.execute(d.id,{type:'withdraw'},a,{expectedSequence:1});await assert.rejects(service().submitReview(d.id,input),/CONFLICT/);
});
test('submission preserves the employee publication and accepts a later rejected round',async()=>{
 let d=await draft();for(const type of ['submit','approve','queue','publish'] as const)d=await repo.execute(d.id,{type},type==='approve'?b:a,{expectedSequence:d.sequence,reviewer:b});
 d=await repo.execute(d.id,{type:'edit',title:'未审核',body:'新的机密修改',audience:'staff'},a,{expectedSequence:d.sequence});
 const ack=await service().submitReview(d.id,{expectedSequence:d.sequence,reviewerId:'b'});
 const reader=await service(staff).article(d.id);assert.equal(reader?.body,'正式内容');assert.equal(reader?.revision_id,1);
 assert.equal((await service().editor(d.id)).status,'in_review');
 d=await repo.execute(d.id,{type:'reject',reason:'补充依据'},b,{expectedSequence:ack.sequence});
 await assert.rejects(service().submitReview(d.id,{expectedSequence:d.sequence,reviewerId:'c'}),/EDIT_REQUIRED/);
 d=await repo.execute(d.id,{type:'edit',title:'补充后的版本',body:'补充依据后的内容',audience:'staff'},a,{expectedSequence:d.sequence});
 const next=await service().submitReview(d.id,{expectedSequence:d.sequence,reviewerId:'c'});assert.equal(next.revision,ack.revision+1);assert.equal(next.sequence,d.sequence+1);
 assert.deepEqual((await fixture.pool.query('SELECT status FROM juyu.reviews WHERE document_id=$1 ORDER BY submitted_sequence',[d.id])).rows.map(r=>r.status),['approved','rejected','in_review']);
 assert.equal((await service(staff).article(d.id))?.body,'正式内容');
});
test('pending upload and inactive documents reject submission without changing history',async()=>{
 const d=await draft(),asset=randomUUID();await service().reserveUpload(d.id,asset,{filename:'upload.txt',mime:'text/plain',size:1});
 await assert.rejects(service().submitReview(d.id,{expectedSequence:0,reviewerId:'b'}),/UPLOAD_IN_PROGRESS/);
 await service().finishUpload(asset,false);await service().lifecycle(d.id,{action:'trash',expectedSequence:0});
 await assert.rejects(service().submitReview(d.id,{expectedSequence:1,reviewerId:'b'}),/INACTIVE_DOCUMENT/);
 assert.equal((await fixture.pool.query('SELECT count(*)::int AS n FROM juyu.reviews WHERE document_id=$1',[d.id])).rows[0].n,0);
});
test('an audit failure rolls back submission state and reviewer receipt together',async()=>{
 const d=await draft();await fixture.pool.query("CREATE FUNCTION juyu.fail_submission_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected submission failure'; END $$; CREATE TRIGGER fail_submission BEFORE INSERT ON juyu.audit_log FOR EACH ROW EXECUTE FUNCTION juyu.fail_submission_audit()");
 try{await assert.rejects(service().submitReview(d.id,{expectedSequence:0,reviewerId:'b'}),/injected submission failure/);assert.deepEqual(await repo.getForManagement(d.id,a),d);assert.equal((await fixture.pool.query('SELECT count(*)::int AS n FROM juyu.reviews WHERE document_id=$1',[d.id])).rows[0].n,0);}
 finally{await fixture.pool.query('DROP TRIGGER fail_submission ON juyu.audit_log; DROP FUNCTION juyu.fail_submission_audit()');}
 assert.equal((await service().submitReview(d.id,{expectedSequence:0,reviewerId:'b'})).sequence,1);
});
async function waitForLock(query:string,count=1){const deadline=Date.now()+3000;let n=0;while(Date.now()<deadline){n=(await fixture.pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE $1",[query])).rows[0].n;if(n>=count)break;await new Promise(r=>setTimeout(r,5));}assert.equal(n,count,'independent real DB connections must overlap');}
test('two different reviewer submissions overlap on the real document lock with only one winner',async()=>{
 const d=await draft(),blocker=await fixture.pool.connect();await blocker.query('BEGIN');await blocker.query('SELECT id FROM juyu.documents WHERE id=$1 FOR UPDATE',[d.id]);
 const results=Promise.allSettled([service().submitReview(d.id,{expectedSequence:0,reviewerId:'b'}),service().submitReview(d.id,{expectedSequence:0,reviewerId:'c'})]);
 try{await waitForLock('SELECT id FROM juyu.documents%',1);await waitForLock('SELECT pg_advisory_xact_lock(hashtextextended%',1);}finally{await blocker.query('ROLLBACK');blocker.release();}
 const settled=await results;assert.equal(settled.filter(r=>r.status==='fulfilled').length,1);assert.match(String((settled.find(r=>r.status==='rejected') as PromiseRejectedResult).reason),/CONFLICT/);
 assert.equal((await fixture.pool.query('SELECT count(*)::int AS n FROM juyu.reviews WHERE document_id=$1',[d.id])).rows[0].n,1);
});
test('a reviewer downgraded while submission waits cannot be accepted using cached choices',async()=>{
 const d=await draft(),blocker=await fixture.pool.connect();await blocker.query('BEGIN');await blocker.query("UPDATE juyu.members SET observed_role='support' WHERE clerk_user_id='b'");
 const result=service().submitReview(d.id,{expectedSequence:0,reviewerId:'b'}).then(value=>({value,error:null}),error=>({value:null,error}));
 try{await waitForLock('SELECT clerk_user_id FROM juyu.members%');}finally{await blocker.query('COMMIT');blocker.release();}
 try{assert.match((await result).error?.message??'unexpected success',/INVALID_REVIEWER/);assert.equal((await repo.getForManagement(d.id,a))?.sequence,0);}finally{await fixture.pool.query("UPDATE juyu.members SET observed_role='admin' WHERE clerk_user_id='b'");}
});
test('member operations exclude submissions and upload reservations cannot cross the freeze',async()=>{
 const d=await draft(),blocker=await issuer.connect();await blocker.query('SELECT pg_advisory_lock(84620915)');
 try{await assert.rejects(service().submitReview(d.id,{expectedSequence:0,reviewerId:'b'}),/MEMBER_BUSY/);}finally{await blocker.query('SELECT pg_advisory_unlock(84620915)');blocker.release();}
 const asset=randomUUID();let ready!:()=>void,release!:()=>void;const started=new Promise<void>(r=>{ready=r;}),gate=new Promise<void>(r=>{release=r;});
 const upload=db.run(a,async c=>{await c.query('SELECT juyu.reserve_upload($1,$2,$3,$4,$5)',[asset,d.id,'upload.txt','text/plain',1]);ready();await gate;});await started;
 const submission=service().submitReview(d.id,{expectedSequence:0,reviewerId:'b'}).then(value=>({value,error:null}),error=>({value:null,error}));
 try{await waitForLock('SELECT id FROM juyu.documents%');}finally{release();}
 await upload;assert.match((await submission).error?.message??'unexpected success',/UPLOAD_IN_PROGRESS/);
 await service().finishUpload(asset,true);await service().submitReview(d.id,{expectedSequence:0,reviewerId:'b'});
 await assert.rejects(service().reserveUpload(d.id,randomUUID(),{filename:'late.txt',mime:'text/plain',size:1}),/INVALID_STATE/);
});
test('the BlockNote save service cannot change a submitted revision, including a lost save acknowledgement',async()=>{
 const id=randomUUID(),input={expectedSequence:null,title:'保存版本',body:'JUYU_BLOCKNOTE_V1\n[]',kind:'article',audience:'staff',tags:[],cover:null};
 await service().saveDraft(id,input);await service().submitReview(id,{expectedSequence:0,reviewerId:'b'});
 await assert.rejects(service().saveDraft(id,input),/INVALID_STATE/);
 await assert.rejects(service().saveDraft(id,{...input,expectedSequence:1,title:'new'}),/INVALID_STATE/);
 const saved=await service().editor(id);assert.equal(saved.title,'保存版本');assert.equal(saved.sequence,1);assert.equal(saved.status,'in_review');
});
test('overlapping save and submission cannot freeze an overwritten or unsaved revision',async()=>{
 const id=randomUUID(),input={expectedSequence:null,title:'Saved',body:'JUYU_BLOCKNOTE_V1\n[]',kind:'article',audience:'staff',tags:[],cover:null};await service().saveDraft(id,input);
 const blocker=await fixture.pool.connect();await blocker.query('BEGIN');await blocker.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`editor:${id}`]);
 const results=Promise.allSettled([service().saveDraft(id,{...input,expectedSequence:0,title:'New saved version'}),service().submitReview(id,{expectedSequence:0,reviewerId:'b'})]);
 try{await waitForLock('SELECT pg_advisory_xact_lock(hashtextextended%',2);}finally{await blocker.query('ROLLBACK');blocker.release();}
 const settled=await results;assert.equal(settled.filter(r=>r.status==='fulfilled').length,1);assert.match(String((settled.find(r=>r.status==='rejected') as PromiseRejectedResult).reason),/CONFLICT|INVALID_STATE/);
 const saved=await service().editor(id);assert.equal(saved.sequence,1);if(saved.status==='in_review'){assert.equal(saved.title,'Saved');assert.equal((await repo.getForManagement(id,a))?.workflow.revisionId,1);}else{assert.equal(saved.status,'draft');assert.equal(saved.title,'New saved version');assert.equal((await fixture.pool.query('SELECT count(*)::int AS n FROM juyu.reviews WHERE document_id=$1',[id])).rows[0].n,0);}
});
