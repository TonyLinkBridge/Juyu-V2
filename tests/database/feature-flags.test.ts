import {defaultFeatureFlags,closedFeatureFlags,type FeatureFlags} from '../../src/features/model.ts';
import {requireFeature} from '../../src/server/features/repository.ts';
import {writeFieldDefinition} from '../../src/server/fields/repository.ts';
import assert from 'node:assert/strict';
import {before,after,beforeEach,test} from 'node:test';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import type {Pool} from 'pg';
import {temporaryDatabase} from './fixture.ts';
import {migrate} from '../../src/server/database/migrate.ts';
import {ScopedDatabase} from '../../src/server/database/scoped.ts';
import {DocumentRepository} from '../../src/server/database/repository.ts';
import {AuthorizationService} from '../../src/server/authorization/service.ts';
import {defaultNavigationEntries} from '../../src/navigation-settings/model.ts';
import type {Viewer} from '../../src/domain/model.ts';
let fixture:Awaited<ReturnType<typeof temporaryDatabase>>,runtime:Pool,issuer:Pool,db:ScopedDatabase,repo:DocumentRepository;
const admin:Viewer={id:'a',role:'admin',companyVerified:true},reviewer:Viewer={...admin,id:'b'},support:Viewer={id:'s',role:'support',companyVerified:true},ops:Viewer={id:'o',role:'ops',companyVerified:true};
const service=(v:Viewer=admin)=>new AuthorizationService(db,async()=>v);
async function published(categoryIds:string[]=[],audience:'staff'|'ops'|'admin'='staff') {const d=await repo.create({id:randomUUID(),kind:'article',title:'Formal',body:'Published body',audience,categoryIds},admin);await service().submitReview(d.id,{expectedSequence:0,reviewerId:'b'});await service(reviewer).decideReview(d.id,{expectedSequence:1,action:'approve'});await service().changePublication(d.id,{expectedSequence:2,action:'queue'});await service().changePublication(d.id,{expectedSequence:3,action:'publish'});return (await repo.getForManagement(d.id,admin))!;}
before(async()=>{fixture=await temporaryDatabase();await migrate(fixture.pool);await fixture.pool.query("INSERT INTO juyu.members(clerk_user_id,display_name,observed_role,verified_email,observed_at) VALUES('a','Admin','admin','a@example.test',now()),('b','Reviewer','admin','b@example.test',now()),('s','Support','support','s@example.test',now()),('o','Ops','ops','o@example.test',now())");const rp=randomBytes(24).toString('hex'),ip=randomBytes(24).toString('hex');await fixture.pool.query(`CREATE ROLE features_runtime LOGIN PASSWORD '${rp}' IN ROLE juyu_runtime; CREATE ROLE features_issuer LOGIN PASSWORD '${ip}' IN ROLE juyu_context_issuer`);runtime=fixture.connectAs('features_runtime',rp);issuer=fixture.connectAs('features_issuer',ip);db=new ScopedDatabase(runtime,issuer);repo=new DocumentRepository(db);});
after(async()=>{await runtime?.end();await issuer?.end();await fixture?.close();});
beforeEach(async()=>{await fixture.pool.query('TRUNCATE juyu.documents,juyu.settings,juyu.categories CASCADE');});

const toggle=(flags:FeatureFlags,expectedVersion=0,v=admin)=>service(v).saveFeatureConfig({expectedVersion,flags});
test('fixed feature defaults, exact same-actor retries and immutable history persist disabled states',async()=>{
 assert.deepEqual(await service(support).features(),defaultFeatureFlags);assert.deepEqual(await service().featureConfig(),{version:0,flags:defaultFeatureFlags});
 const first=await toggle(closedFeatureFlags);assert.equal(first.version,1);assert.deepEqual(await toggle(closedFeatureFlags),first);assert.deepEqual(await service(support).features(),closedFeatureFlags);
 await assert.rejects(toggle(closedFeatureFlags,0,reviewer),/FEATURE_CONFLICT/);await assert.rejects(toggle(defaultFeatureFlags),/FEATURE_CONFLICT/);
 const next=await toggle(defaultFeatureFlags,1);assert.equal(next.version,2);assert.equal((await fixture.pool.query("SELECT count(*)::int n FROM juyu.setting_versions v JOIN juyu.settings s ON s.id=v.setting_id WHERE s.key='feature-flags'")).rows[0].n,2);
 await assert.rejects(fixture.pool.query("UPDATE juyu.setting_versions SET config='{}' WHERE setting_id=(SELECT id FROM juyu.settings WHERE key='feature-flags')"),/IMMUTABLE/);
});
test('only currently eligible administrators configure; runtime raw payloads and helpers fail closed',async()=>{
 for(const v of [support,ops]){await assert.rejects(service(v).featureConfig(),/FORBIDDEN/);await assert.rejects(toggle(defaultFeatureFlags,0,v),/FORBIDDEN/);}
 for(const flags of [{},{...defaultFeatureFlags,search:'false'},{...defaultFeatureFlags,extra:true},null])await assert.rejects(db.run(admin,c=>c.query('SELECT juyu.write_feature_config(0,$1)',[JSON.stringify(flags)])),/INVALID_INPUT/);
 await assert.rejects(db.run(admin,c=>c.query('SELECT juyu.require_feature($1)',['execute_script'])),/INVALID_INPUT/);await assert.rejects(runtime.query('SELECT juyu.read_feature_flags()'),/FORBIDDEN/);await assert.rejects(db.run(support,c=>c.query('SELECT juyu.feature_config()')),/permission denied/);
 await toggle(defaultFeatureFlags);assert.equal((await db.run(support,c=>c.query("SELECT * FROM juyu.settings WHERE key='feature-flags'"),true)).rows.length,0);
 for(const state of ["observed_role='ops'","verified_email=null","disabled_at=now()"]){await fixture.pool.query(`UPDATE juyu.members SET ${state} WHERE clerk_user_id='a'`);try{await assert.rejects(service().featureConfig(),/FORBIDDEN/);await assert.rejects(toggle(defaultFeatureFlags,1),/FORBIDDEN/);}finally{await fixture.pool.query("UPDATE juyu.members SET observed_role='admin',verified_email='a@example.test',disabled_at=null WHERE clerk_user_id='a'");}}
});
test('all seven disabled features reject their server entry points without hiding core publications or settings',async()=>{
 const d=await published();await toggle(closedFeatureFlags);const s=service(support),a=service(),id=randomUUID();
 const actions=[()=>s.search('Formal'),()=>s.pdf(d.id,1),()=>s.favorites(),()=>s.favorite(d.id,1),()=>s.saveFavorite(d.id,{revision:1,saved:true}),()=>s.recent(),()=>s.recordRecent(d.id,{revision:1}),()=>s.feedback(d.id,1),()=>s.saveFeedback(d.id,{revision:1,helpful:true,comment:'',expectedVersion:0}),()=>a.feedbackOverview(),()=>a.feedbackDetails(d.id,1),()=>s.captureAnalytics({}),()=>a.analyticsDashboard(),()=>s.forms(),()=>s.form(id),()=>a.forms(true),()=>a.form(id,true),()=>a.saveForm(id,{}),()=>s.submitForm(id,{}),()=>a.formRecords(),()=>a.formRecord(id),()=>a.processFormRecord(id,{})];
 for(const action of actions)await assert.rejects(action(),/FEATURE_DISABLED/);assert.ok(await s.article(d.id));assert.ok((await s.reader(d.id)).article);assert.equal((await s.readerMenu()).some(x=>['/help-centre/forms','/help-centre/recent','/help-centre/favorites'].includes(x.href)),false);assert.equal((await a.featureConfig()).version,1);assert.ok(await a.navigationSettings());
});
test('closing and reopening preserves favorites feedback recent and submitted forms; each flag operates independently',async()=>{
 const d=await published(),s=service(support);await s.saveFavorite(d.id,{revision:1,saved:true});await s.recordRecent(d.id,{revision:1});await s.saveFeedback(d.id,{revision:1,helpful:true,comment:'Keep this',expectedVersion:0});
 const f=await db.run(admin,c=>writeFieldDefinition(c,randomUUID(),{expectedVersion:null,name:'Question',type:'text',required:false,enabled:true,options:[]}));const form=await service().saveForm(randomUUID(),{expectedVersion:null,title:'Request',description:'Keep',audience:'staff',enabled:true,fields:[{id:f.id,version:1,required:true,width:'full'}]});const receipt=await s.submitForm(form.id,{id:randomUUID(),formVersion:1,values:[{fieldId:f.id,value:'Saved answer'}]});
 const before=await Promise.all(['favorites','recent_views','feedback','forms','form_versions','form_submissions','form_record_states'].map(async table=>(await fixture.pool.query('SELECT * FROM juyu.'+table)).rows));
 await toggle({...defaultFeatureFlags,favorites:false});await assert.rejects(s.favorites(),/FEATURE_DISABLED/);assert.ok(await s.pdf(d.id,1));assert.equal((await s.recent()).total,1);
 await toggle(closedFeatureFlags,1);await assert.rejects(s.submitForm(form.id,{id:receipt.id,formVersion:1,values:[{fieldId:f.id,value:'Saved answer'}]}),/FEATURE_DISABLED/);
 const after=await Promise.all(['favorites','recent_views','feedback','forms','form_versions','form_submissions','form_record_states'].map(async table=>(await fixture.pool.query('SELECT * FROM juyu.'+table)).rows));assert.deepEqual(after,before);
 await toggle(defaultFeatureFlags,2);assert.equal((await s.favorites()).total,1);assert.equal((await s.recent()).total,1);assert.equal((await s.feedback(d.id,1))?.comment,'Keep this');assert.equal((await service().formRecord(receipt.id)).values[0].value,'Saved answer');
});
test('concurrent different whole-config changes have one winner and equal requests only append one version',async()=>{
 const results=await Promise.allSettled([toggle({...defaultFeatureFlags,search:false}),toggle({...defaultFeatureFlags,forms:false})]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.match(String((results.find(x=>x.status==='rejected') as PromiseRejectedResult).reason),/FEATURE_CONFLICT/);
 const results2=await Promise.all([toggle(closedFeatureFlags,1),toggle(closedFeatureFlags,1)]);assert.deepEqual(results2[0],results2[1]);assert.equal(results2[0].version,2);
});
async function waitLock(query:string){const deadline=Date.now()+4000;while(Date.now()<deadline){if((await fixture.pool.query("SELECT count(*)::int n FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE $1",[query])).rows[0].n>0)return;await new Promise(r=>setTimeout(r,10));}assert.fail('expected database lock not reached');}
test('closing waits for an accepted operation; new operations reject after toggle commit',async()=>{
 let release!:()=>void,acquired!:()=>void;const locked=new Promise<void>(r=>acquired=r),unlock=new Promise<void>(r=>release=r);
 const ongoing=db.run(support,async c=>{await requireFeature(c,'favorites');acquired();await unlock;});await locked;
 const closing=toggle({...defaultFeatureFlags,favorites:false});try{await waitLock('SELECT juyu.write_feature_config%');}finally{release();}await ongoing;await closing;await assert.rejects(service(support).favorites(),/FEATURE_DISABLED/);
});
test('configuration changes recheck administrator after waiting for a member demotion',async()=>{
 const c=await fixture.pool.connect();await c.query('BEGIN');await c.query("UPDATE juyu.members SET observed_role='ops' WHERE clerk_user_id='a'");const updating=toggle(closedFeatureFlags).then(()=>null,e=>e);
 try{await waitLock('SELECT juyu.write_feature_config%');}finally{await c.query('COMMIT');c.release();}try{assert.match((await updating)?.message??'unexpected success',/FORBIDDEN/);assert.equal((await service(reviewer).featureConfig()).version,0);}finally{await fixture.pool.query("UPDATE juyu.members SET observed_role='admin' WHERE clerk_user_id='a'");}
});

test('migration24 preserves generic legacy settings categories and replay state',async()=>{
 const old=await temporaryDatabase();try{await old.pool.query('CREATE SCHEMA juyu; CREATE TABLE juyu.schema_migrations(version text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');const versions=(await fixture.pool.query("SELECT version FROM juyu.schema_migrations WHERE version<'0024_feature_flags' ORDER BY version")).rows;
 for(const {version} of versions){const sql=await readFile(new URL(`../../src/server/database/migrations/${version}.sql`,import.meta.url),'utf8');await old.pool.query(sql);await old.pool.query('INSERT INTO juyu.schema_migrations(version,checksum) VALUES($1,$2)',[version,createHash('sha256').update(sql).digest('hex')]);}
 await old.pool.query("INSERT INTO juyu.members(clerk_user_id,display_name) VALUES('legacy','Legacy');INSERT INTO juyu.categories(name) VALUES('Existing category')");const setting=randomUUID(),c=await old.pool.connect();try{await c.query('BEGIN');await c.query("INSERT INTO juyu.settings(id,key,kind,current_version) VALUES($1,'legacy-navigation','navigation',1)",[setting]);await c.query("INSERT INTO juyu.setting_versions(setting_id,version,config,changed_by) VALUES($1,1,'{}','legacy')",[setting]);await c.query('COMMIT');}finally{c.release();}
 const before=(await old.pool.query('SELECT * FROM juyu.setting_versions')).rows,categories=(await old.pool.query('SELECT * FROM juyu.categories')).rows;assert.deepEqual(await migrate(old.pool),['0024_feature_flags', '0025_setting_history', '0026_announcements', '0027_native_editor', '0028_qa_search', '0029_shared_revision_config_locks', '0030_publication_number', '0031_scoped_search', '0032_category_icons', '0033_publication_icons', '0034_article_description', '0035_publication_timestamp', '0036_reader_changelog', '0037_reusable_fragments', '0038_reusable_fragment_versions', '0039_release_notes', '0040_document_locales', '0041_english_review_confirmation']);assert.deepEqual(await migrate(old.pool),[]);assert.deepEqual((await old.pool.query('SELECT * FROM juyu.setting_versions')).rows,before);assert.deepEqual((await old.pool.query('SELECT * FROM juyu.categories')).rows,categories);assert.deepEqual((await old.pool.query('SELECT juyu.navigation_config() AS config')).rows[0].config,{version:0,entries:defaultNavigationEntries});
 }finally{await old.close();}
});
