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
import {defaultNavigationEntries} from '../../src/navigation-settings/model.ts';
import {writeFieldDefinition} from '../../src/server/fields/repository.ts';
import {defaultFeatureFlags} from '../../src/features/model.ts';
import {readHistory,readHistoryDetail,restoreSetting} from '../../src/server/setting-history/repository.ts';
import type {Viewer} from '../../src/domain/model.ts';
let fixture:Awaited<ReturnType<typeof temporaryDatabase>>,runtime:Pool,issuer:Pool,db:ScopedDatabase;
const admin:Viewer={id:'a',role:'admin',companyVerified:true},reviewer:Viewer={...admin,id:'b'},support:Viewer={id:'s',role:'support',companyVerified:true},ops:Viewer={id:'o',role:'ops',companyVerified:true};
const service=(v:Viewer=admin)=>new AuthorizationService(db,async()=>v);
before(async()=>{fixture=await temporaryDatabase();await migrate(fixture.pool);await fixture.pool.query("INSERT INTO juyu.members(clerk_user_id,display_name,observed_role,verified_email,observed_at) VALUES('a','Admin','admin','a@example.test',now()),('b','Reviewer','admin','b@example.test',now()),('s','Support','support','s@example.test',now()),('o','Ops','ops','o@example.test',now())");const rp=randomBytes(24).toString('hex'),ip=randomBytes(24).toString('hex');await fixture.pool.query(`CREATE ROLE features_runtime LOGIN PASSWORD '${rp}' IN ROLE juyu_runtime; CREATE ROLE features_issuer LOGIN PASSWORD '${ip}' IN ROLE juyu_context_issuer`);runtime=fixture.connectAs('features_runtime',rp);issuer=fixture.connectAs('features_issuer',ip);db=new ScopedDatabase(runtime,issuer);});
after(async()=>{await runtime?.end();await issuer?.end();await fixture?.close();});
beforeEach(async()=>{await fixture.pool.query('TRUNCATE juyu.documents,juyu.settings,juyu.categories,juyu.forms,juyu.setting_restorations CASCADE');});


const history=(kind='all',page=1,v=admin)=>db.run(v,c=>readHistory(c,{kind,page}),true);
const detail=(kind:string,id:string,version:number,v=admin)=>db.run(v,c=>readHistoryDetail(c,{kind,id,version}),true);
const restore=(kind:string,id:string,version:number,expectedVersion:number,requestId=randomUUID(),v=admin)=>db.run(v,c=>restoreSetting(c,{kind,id,version,expectedVersion,requestId}));
async function seed(){
 const field=await db.run(admin,c=>writeFieldDefinition(c,randomUUID(),{expectedVersion:null,name:'Original field',type:'text',required:false,enabled:true,options:[]}));
 const category=await service().saveCategory(randomUUID(),{expectedVersion:null,name:'Original category',parentId:null,position:0,audience:'staff',enabled:true});
 const form=await service().saveForm(randomUUID(),{expectedVersion:null,title:'Original form',description:'Saved description',audience:'staff',enabled:true,fields:[{id:field.id,version:1,required:true,width:'full'}]});
 await service().saveNavigationSettings({expectedVersion:0,entries:defaultNavigationEntries});await service().saveFeatureConfig({expectedVersion:0,flags:defaultFeatureFlags});
 return {field,category,form};
}
test('unified history reads all five kinds, before/current snapshots and stable pages without inventing missing actors',async()=>{
 assert.equal((await history()).total,0);const {field}=await seed();assert.equal((await history()).total,5);assert.equal((await history('field')).total,1);
 await db.run(admin,c=>writeFieldDefinition(c,field.id,{expectedVersion:1,name:'Changed field',type:'text',required:false,enabled:true,options:[]}));const d=await detail('field',field.id,2);assert.equal(d.before?.name,'Original field');assert.equal(d.after.name,'Changed field');assert.equal(d.current.version,2);assert.equal(d.entry.actor?.id,'a');
 await fixture.pool.query("INSERT INTO juyu.categories(name) VALUES('Imported')");const imported=(await history('category')).items.find(x=>x.label==='Imported')!;assert.equal(imported.actor,null);
 for(let i=2;i<23;i++)await db.run(admin,c=>writeFieldDefinition(c,field.id,{expectedVersion:i,name:'Version '+i,type:'text',required:false,enabled:true,options:[]}));
 const a=await history('field'),b=await history('field',2);assert.equal(a.items.length,20);assert.equal(b.items.length,3);assert.equal(new Set([...a.items,...b.items].map(x=>x.version)).size,23);assert.equal((await history('field',999)).page,2);
});
test('restores every supported kind into new audited versions, exact retry survives later edits and old evidence remains intact',async()=>{
 const {field,category,form}=await seed();
 await db.run(admin,c=>writeFieldDefinition(c,field.id,{expectedVersion:1,name:'Changed field',type:'text',required:false,enabled:true,options:[]}));
 await service().saveCategory(category.id,{expectedVersion:1,name:'Changed category',parentId:null,position:2,audience:'ops',enabled:true});
 await service().saveForm(form.id,{expectedVersion:1,title:'Changed form',description:'New',audience:'ops',enabled:true,fields:[{id:field.id,version:1,required:false,width:'half'}]});
 await service().saveNavigationSettings({expectedVersion:1,entries:[]});await service().saveFeatureConfig({expectedVersion:1,flags:{...defaultFeatureFlags,search:false}});
 const entries=(await history()).items.filter(x=>x.version===1);assert.equal(entries.length,5);
 for(const e of entries){const prior=await detail(e.kind,e.id,1),requestId=randomUUID();const ack=await restore(e.kind,e.id,1,2,requestId);assert.equal(ack.newVersion,3);assert.deepEqual(await restore(e.kind,e.id,1,2,requestId),ack);const now=await detail(e.kind,e.id,3);assert.deepEqual(now.after,prior.after);assert.equal(now.entry.restoredFrom,1);assert.deepEqual((await detail(e.kind,e.id,1)).after,prior.after);await assert.rejects(restore(e.kind,e.id,1,2,requestId,reviewer),/HISTORY_CONFLICT/);}
 assert.equal((await fixture.pool.query('SELECT count(*)::int n FROM juyu.setting_restorations')).rows[0].n,5);
 await assert.rejects(fixture.pool.query('DELETE FROM juyu.setting_restorations'),/IMMUTABLE/);
 const req=randomUUID();await db.run(admin,c=>writeFieldDefinition(c,field.id,{expectedVersion:3,name:'Later',type:'text',required:false,enabled:true,options:[]}));const ack=await restore('field',field.id,1,4,req);await db.run(admin,c=>writeFieldDefinition(c,field.id,{expectedVersion:5,name:'Even later',type:'text',required:false,enabled:true,options:[]}));assert.deepEqual(await restore('field',field.id,1,4,req),ack);assert.equal((await detail('field',field.id,1)).current.version,6);
});
test('current administrator eligibility and fixed SQL dispatch guard history and restore',async()=>{
 const {field}=await seed();for(const v of [support,ops]){await assert.rejects(history('all',1,v),/FORBIDDEN/);await assert.rejects(detail('field',field.id,1,v),/FORBIDDEN/);await assert.rejects(restore('field',field.id,1,2,randomUUID(),v),/FORBIDDEN/);}
 await assert.rejects(runtime.query("SELECT juyu.read_setting_history('all',1)"),/FORBIDDEN/);await assert.rejects(db.run(admin,c=>c.query("SELECT juyu.restore_setting('sql',$1,1,2,$2)",[field.id,randomUUID()])),/INVALID_INPUT/);
 await assert.rejects(db.run(admin,c=>c.query('SELECT * FROM juyu.setting_history_rows()')),/permission denied/);
 await fixture.pool.query("UPDATE juyu.members SET verified_email=null WHERE clerk_user_id='a'");try{await assert.rejects(history(),/FORBIDDEN/);await assert.rejects(restore('field',field.id,1,2),/FORBIDDEN/);}finally{await fixture.pool.query("UPDATE juyu.members SET verified_email='a@example.test' WHERE clerk_user_id='a'");}
});
test('stale restores never overwrite normal edits and competing restores append at most one version',async()=>{
 const {field}=await seed();await db.run(admin,c=>writeFieldDefinition(c,field.id,{expectedVersion:1,name:'Changed',type:'text',required:false,enabled:true,options:[]}));
 const results=await Promise.allSettled([restore('field',field.id,1,2),restore('field',field.id,1,2)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.match(String((results.find(r=>r.status==='rejected') as PromiseRejectedResult).reason),/HISTORY_(BUSY|CONFLICT)/);
 await assert.rejects(restore('field',field.id,1,2),/HISTORY_CONFLICT/);assert.equal((await detail('field',field.id,1)).current.version,3);
});
test('restoration revalidates category cycles, form field dependencies and forms switch, rolling back failed audit',async()=>{
 const {field,category,form}=await seed();const child=await service().saveCategory(randomUUID(),{expectedVersion:null,name:'Child',parentId:category.id,position:0,audience:'staff',enabled:true});await service().saveCategory(child.id,{expectedVersion:1,name:'Child',parentId:null,position:0,audience:'staff',enabled:true});await service().saveCategory(category.id,{expectedVersion:1,name:'Parent moved',parentId:child.id,position:0,audience:'staff',enabled:true});await assert.rejects(restore('category',child.id,1,2),/CATEGORY_CYCLE/);assert.equal((await detail('category',child.id,1)).current.version,2);
 const second=await db.run(admin,c=>writeFieldDefinition(c,randomUUID(),{expectedVersion:null,name:'Second',type:'text',required:false,enabled:true,options:[]}));await service().saveForm(form.id,{expectedVersion:1,title:'Other fields',description:'',audience:'staff',enabled:true,fields:[{id:second.id,version:1,required:true,width:'full'}]});await db.run(admin,c=>writeFieldDefinition(c,field.id,{expectedVersion:1,name:'Changed dependency',type:'text',required:false,enabled:true,options:[]}));await assert.rejects(restore('form',form.id,1,2),/FIELD_CONFLICT/);
 await service().saveFeatureConfig({expectedVersion:1,flags:{...defaultFeatureFlags,forms:false}});assert.equal((await history('form')).total,2);await assert.rejects(restore('form',form.id,1,2),/FEATURE_DISABLED/);assert.equal((await fixture.pool.query('SELECT count(*)::int n FROM juyu.setting_restorations')).rows[0].n,0);
});

test('migration25 preserves generic legacy settings categories and replay state',async()=>{
 const old=await temporaryDatabase();try{await old.pool.query('CREATE SCHEMA juyu; CREATE TABLE juyu.schema_migrations(version text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');const versions=(await fixture.pool.query("SELECT version FROM juyu.schema_migrations WHERE version<'0025_setting_history' ORDER BY version")).rows;
 for(const {version} of versions){const sql=await readFile(new URL(`../../src/server/database/migrations/${version}.sql`,import.meta.url),'utf8');await old.pool.query(sql);await old.pool.query('INSERT INTO juyu.schema_migrations(version,checksum) VALUES($1,$2)',[version,createHash('sha256').update(sql).digest('hex')]);}
 await old.pool.query("INSERT INTO juyu.members(clerk_user_id,display_name) VALUES('legacy','Legacy');INSERT INTO juyu.categories(name) VALUES('Existing category')");const setting=randomUUID(),c=await old.pool.connect();try{await c.query('BEGIN');await c.query("INSERT INTO juyu.settings(id,key,kind,current_version) VALUES($1,'legacy-navigation','navigation',1)",[setting]);await c.query("INSERT INTO juyu.setting_versions(setting_id,version,config,changed_by) VALUES($1,1,'{}','legacy')",[setting]);await c.query('COMMIT');}finally{c.release();}
 const before=(await old.pool.query('SELECT * FROM juyu.setting_versions')).rows,categories=(await old.pool.query('SELECT * FROM juyu.categories')).rows;assert.deepEqual(await migrate(old.pool),['0025_setting_history', '0026_announcements', '0027_native_editor', '0028_qa_search', '0029_shared_revision_config_locks', '0030_publication_number', '0031_scoped_search', '0032_category_icons', '0033_publication_icons', '0034_article_description', '0035_publication_timestamp', '0036_reader_changelog', '0037_reusable_fragments', '0038_reusable_fragment_versions', '0039_release_notes', '0040_document_locales', '0041_english_review_confirmation', '0042_draft_actions', '0043_super_admin_role', '0044_super_admin_direct_publish', '0045_search_relevance']);assert.deepEqual(await migrate(old.pool),[]);assert.deepEqual((await old.pool.query('SELECT * FROM juyu.setting_versions')).rows,before);assert.deepEqual((await old.pool.query('SELECT * FROM juyu.categories')).rows,categories);assert.deepEqual((await old.pool.query('SELECT juyu.navigation_config() AS config')).rows[0].config,{version:0,entries:defaultNavigationEntries});
 }finally{await old.close();}
});

async function waitForLock(){const deadline=Date.now()+4000;while(Date.now()<deadline){if((await fixture.pool.query("SELECT count(*)::int n FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE 'SELECT juyu.restore_setting%'")).rows[0].n>0)return;await new Promise(r=>setTimeout(r,10));}assert.fail('restore did not reach expected member lock');}
test('restore rechecks administrator qualification after a concurrent demotion commits',async()=>{
 const {field}=await seed();await db.run(admin,c=>writeFieldDefinition(c,field.id,{expectedVersion:1,name:'Changed',type:'text',required:false,enabled:true,options:[]}));const c=await fixture.pool.connect();await c.query('BEGIN');await c.query("UPDATE juyu.members SET observed_role='ops' WHERE clerk_user_id='a'");const restoring=restore('field',field.id,1,2).then(()=>null,e=>e);
 try{await waitForLock();}finally{await c.query('COMMIT');c.release();}try{assert.match((await restoring)?.message??'unexpected success',/FORBIDDEN/);assert.equal((await detail('field',field.id,1,reviewer)).current.version,2);}finally{await fixture.pool.query("UPDATE juyu.members SET observed_role='admin' WHERE clerk_user_id='a'");}
});
test('successful restore leaves submitted records intact and request reuse cannot change its target',async()=>{
 const {field,form}=await seed();const receipt=await service(support).submitForm(form.id,{id:randomUUID(),formVersion:1,values:[{fieldId:field.id,value:'Permanent submitted answer'}]});const saved=await service().formRecord(receipt.id);await service().saveForm(form.id,{expectedVersion:1,title:'Changed title',description:'New description',audience:'staff',enabled:true,fields:[{id:field.id,version:1,required:false,width:'half'}]});const requestId=randomUUID();await restore('form',form.id,1,2,requestId);assert.deepEqual(await service().formRecord(receipt.id),saved);await assert.rejects(restore('field',field.id,1,2,requestId),/HISTORY_CONFLICT/);assert.equal((await detail('field',field.id,1)).current.version,1);
});
