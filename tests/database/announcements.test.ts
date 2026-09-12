import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {before,after,beforeEach,test} from 'node:test';
import {randomBytes,randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
import {temporaryDatabase} from './fixture.ts';
import {migrate} from '../../src/server/database/migrate.ts';
import {ScopedDatabase} from '../../src/server/database/scoped.ts';
import {AuthorizationService} from '../../src/server/authorization/service.ts';
import {defaultFeatureFlags} from '../../src/features/model.ts';
import {readAnnouncements,writeAnnouncement,recordReceipt} from '../../src/server/announcements/repository.ts';
import type {Viewer} from '../../src/domain/model.ts';
let fixture:Awaited<ReturnType<typeof temporaryDatabase>>,runtime:Pool,issuer:Pool,db:ScopedDatabase;
const admin:Viewer={id:'a',role:'admin',companyVerified:true},reviewer:Viewer={...admin,id:'b'},support:Viewer={id:'s',role:'support',companyVerified:true},ops:Viewer={id:'o',role:'ops',companyVerified:true};
const service=(v:Viewer=admin)=>new AuthorizationService(db,async()=>v);
before(async()=>{fixture=await temporaryDatabase();await migrate(fixture.pool);await fixture.pool.query("INSERT INTO juyu.members(clerk_user_id,display_name,observed_role,verified_email,observed_at) VALUES('a','Admin','admin','a@example.test',now()),('b','Reviewer','admin','b@example.test',now()),('s','Support','support','s@example.test',now()),('o','Ops','ops','o@example.test',now())");const rp=randomBytes(24).toString('hex'),ip=randomBytes(24).toString('hex');await fixture.pool.query(`CREATE ROLE features_runtime LOGIN PASSWORD '${rp}' IN ROLE juyu_runtime; CREATE ROLE features_issuer LOGIN PASSWORD '${ip}' IN ROLE juyu_context_issuer`);runtime=fixture.connectAs('features_runtime',rp);issuer=fixture.connectAs('features_issuer',ip);db=new ScopedDatabase(runtime,issuer);});
after(async()=>{await runtime?.end();await issuer?.end();await fixture?.close();});
beforeEach(async()=>{await fixture.pool.query('TRUNCATE juyu.documents,juyu.settings,juyu.categories,juyu.forms,juyu.setting_restorations,juyu.notifications CASCADE');});



const list=(v=admin,manage=false)=>db.run(v,c=>readAnnouncements(c,manage),true);
const config={title:'New feature',body:'Clear description',target:'favorites',audience:'staff',enabled:true};
const save=(id:string=randomUUID(),expectedVersion=0,extra={},v=admin)=>db.run(v,c=>writeAnnouncement(c,id,{expectedVersion,...config,...extra}));
const receipt=(id:string,revision:number,action='seen',v=support)=>db.run(v,c=>recordReceipt(c,id,{revision,action}));
test('administrator creates edits and pauses versioned notices with exact retries and immutable history',async()=>{
 const n=await save();assert.equal(n.revision,1);assert.deepEqual(await save(n.id),n);assert.equal((await list(support)).length,1);await assert.rejects(save(n.id,0,{},reviewer),/ANNOUNCEMENT_CONFLICT/);const changed=await save(n.id,1,{body:'Updated'});assert.equal(changed.revision,2);await assert.rejects(save(n.id,0,{body:'Stale'}),/ANNOUNCEMENT_CONFLICT/);await save(n.id,2,{enabled:false});assert.equal((await list(support)).length,0);assert.equal((await list(admin,true))[0].enabled,false);assert.equal((await fixture.pool.query('SELECT count(*)::int n FROM juyu.announcement_versions')).rows[0].n,3);await assert.rejects(fixture.pool.query("UPDATE juyu.announcement_versions SET config='{}'"),/IMMUTABLE/);
});
test('reader role and active target feature filter titles bodies counts raw reads and receipt writes',async()=>{
 const opsNotice=await save(undefined,0,{target:'ops'}),adminNotice=await save(undefined,0,{target:'editor'}),favorite=await save();assert.deepEqual((await list(support)).map(x=>x.id),[favorite.id]);assert.equal((await list(ops)).length,2);assert.equal((await list()).length,3);for(const n of [opsNotice,adminNotice])await assert.rejects(receipt(n.id,1),/NOT_FOUND/);assert.equal((await db.run(support,c=>c.query('SELECT title FROM juyu.notifications'),true)).rows.length,1);
 await service().saveFeatureConfig({expectedVersion:0,flags:{...defaultFeatureFlags,favorites:false}});assert.equal((await list(support)).length,0);await assert.rejects(receipt(favorite.id,1),/NOT_FOUND/);assert.equal((await db.run(support,c=>c.query('SELECT title FROM juyu.notifications'),true)).rows.length,0);assert.equal((await list(admin,true)).length,3);
});
test('seen and dismiss follow the member and revision, duplicate actions are monotone and edits reappear',async()=>{
 const n=await save();assert.equal((await list(support))[0].seen,false);const first=await receipt(n.id,1);assert.equal(first.seen,true);assert.deepEqual(await receipt(n.id,1),first);assert.equal((await list(support))[0].seen,true);assert.equal((await list(ops))[0].seen,false);const closed=await receipt(n.id,1,'dismiss');assert.equal(closed.dismissed,true);assert.deepEqual(await receipt(n.id,1,'dismiss'),closed);assert.equal((await list(support)).length,0);assert.equal((await list(ops)).length,1);await save(n.id,1,{body:'New version'});assert.equal((await list(support))[0].seen,false);await assert.rejects(receipt(n.id,1,'dismiss'),/ANNOUNCEMENT_CONFLICT/);assert.equal((await fixture.pool.query('SELECT count(*)::int n FROM juyu.notification_receipts')).rows[0].n,1);
});
test('ineligible administrators, anonymous SQL and runtime raw writes cannot manage or forge receipts',async()=>{
 const n=await save();for(const v of [support,ops]){await assert.rejects(save(undefined,0,{},v),/FORBIDDEN/);await assert.rejects(list(v,true),/FORBIDDEN/);}await assert.rejects(runtime.query('SELECT juyu.read_announcements(false)'),/FORBIDDEN/);await assert.rejects(db.run(support,c=>c.query("UPDATE juyu.notifications SET enabled=false WHERE id=$1",[n.id])),/permission denied/);await assert.rejects(db.run(support,c=>c.query("INSERT INTO juyu.notification_receipts(notification_id,member_id,seen_at,revision) VALUES($1,'o',now(),1)",[n.id])),/permission denied/);
 await fixture.pool.query("UPDATE juyu.members SET observed_role='ops' WHERE clerk_user_id='a'");try{await assert.rejects(save(n.id,1),/FORBIDDEN/);await assert.rejects(list(admin,true),/FORBIDDEN/);}finally{await fixture.pool.query("UPDATE juyu.members SET observed_role='admin' WHERE clerk_user_id='a'");}
});
test('concurrent changes have one winner, old receipts cannot hide a newly edited version',async()=>{
 const n=await save();const result=await Promise.allSettled([save(n.id,1,{body:'A'}),save(n.id,1,{body:'B'})]);assert.equal(result.filter(x=>x.status==='fulfilled').length,1);await assert.rejects(receipt(n.id,1,'dismiss'),/ANNOUNCEMENT_CONFLICT/);assert.equal((await list(support))[0].revision,2);
});

test('raw fixed configuration validation rejects forged fields, targets and invisible label characters',async()=>{for(const extra of [{target:'https://evil.test'},{role:'admin'},{title:'\u00a0Untrimmed'},{body:'Bad\u0085text'}])await assert.rejects(db.run(admin,c=>c.query('SELECT juyu.write_announcement($1,0,$2)',[randomUUID(),JSON.stringify({...config,...extra})])),/INVALID_INPUT/);});

test('upgrade from25 preserves legacy notification contents and receipt timestamps while adding revision identities',async()=>{
 const old=await temporaryDatabase();try{await old.pool.query('CREATE SCHEMA juyu;CREATE TABLE juyu.schema_migrations(version text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');const versions=(await fixture.pool.query("SELECT version FROM juyu.schema_migrations WHERE version<'0026_announcements' ORDER BY version")).rows;for(const {version} of versions){const sql=await readFile(new URL(`../../src/server/database/migrations/${version}.sql`,import.meta.url),'utf8');await old.pool.query(sql);await old.pool.query('INSERT INTO juyu.schema_migrations(version,checksum) VALUES($1,$2)',[version,createHash('sha256').update(sql).digest('hex')]);}
 await old.pool.query("INSERT INTO juyu.members(clerk_user_id,display_name) VALUES('legacy','Legacy')");const id=randomUUID();await old.pool.query("INSERT INTO juyu.notifications(id,title,body,created_by) VALUES($1,'Old notice','Old body','legacy')",[id]);await old.pool.query("INSERT INTO juyu.notification_receipts(notification_id,member_id,seen_at,dismissed_at) VALUES($1,'legacy',now(),now())",[id]);const before=(await old.pool.query('SELECT notification_id,member_id,seen_at,dismissed_at FROM juyu.notification_receipts')).rows;assert.deepEqual(await migrate(old.pool),['0026_announcements', '0027_native_editor', '0028_qa_search', '0029_shared_revision_config_locks', '0030_publication_number']);assert.deepEqual(await migrate(old.pool),[]);assert.deepEqual((await old.pool.query('SELECT notification_id,member_id,seen_at,dismissed_at FROM juyu.notification_receipts')).rows,before);assert.deepEqual((await old.pool.query('SELECT title,body,announcement_target,revision FROM juyu.notifications')).rows,[{title:'Old notice',body:'Old body',announcement_target:null,revision:1}]);
 }finally{await old.close();}
});
test('waiting announcement edits recheck administrator after member demotion',async()=>{
 const n=await save(),c=await fixture.pool.connect();await c.query('BEGIN');await c.query("UPDATE juyu.members SET observed_role='ops' WHERE clerk_user_id='a'");const updating=save(n.id,1,{body:'Blocked'}).then(()=>null,e=>e);try{const deadline=Date.now()+3000;let waited=false;while(Date.now()<deadline){if((await fixture.pool.query("SELECT count(*)::int n FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE 'SELECT juyu.write_announcement%' ")).rows[0].n>0){waited=true;break;}await new Promise(r=>setTimeout(r,10));}assert.ok(waited);}finally{await c.query('COMMIT');c.release();}try{assert.match((await updating)?.message??'unexpected success',/FORBIDDEN/);assert.equal((await list(reviewer,true))[0].revision,1);}finally{await fixture.pool.query("UPDATE juyu.members SET observed_role='admin' WHERE clerk_user_id='a'");}
});
test('management caps announcement creation while permitting pause and existing-notice edits',async()=>{for(let i=0;i<50;i++)await save(undefined,0,{title:'Notice '+i});await assert.rejects(save(),/ANNOUNCEMENT_LIMIT/);const all=await list(admin,true);assert.equal(all.length,50);await save(all[0].id,1,{enabled:false});assert.equal((await list(support)).length,49);assert.equal((await list(admin,true)).length,50);});
