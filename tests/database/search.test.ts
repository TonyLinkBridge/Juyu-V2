import assert from 'node:assert/strict';
import {before,after,beforeEach,test} from 'node:test';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import type {Pool} from 'pg';
import {temporaryDatabase} from './fixture.ts';
import {migrate} from '../../src/server/database/migrate.ts';
import {ScopedDatabase} from '../../src/server/database/scoped.ts';
import {DocumentRepository} from '../../src/server/database/repository.ts';
import {AuthorizationService} from '../../src/server/authorization/service.ts';
import {encodeEditorBody,decodeEditorBody,editorMedia} from '../../src/editor/document.ts';
import {inlineTokens} from '../../src/reader/inline.ts';
import {parseReaderBody} from '../../src/reader/body.ts';
import type {Viewer,Document} from '../../src/domain/model.ts';
let fixture:Awaited<ReturnType<typeof temporaryDatabase>>,runtime:Pool,issuer:Pool,db:ScopedDatabase,repo:DocumentRepository;
const admin:Viewer={id:'a',role:'admin',companyVerified:true},reviewer:Viewer={...admin,id:'b'},ops:Viewer={id:'o',role:'ops',companyVerified:true},support:Viewer={id:'s',role:'support',companyVerified:true};
const service=(v:Viewer|null=ops)=>new AuthorizationService(db,async()=>v);
async function draft(body='正文',kind:Document['kind']='article',title='Ordinary title',tags:string[]=[]){return repo.create({id:randomUUID(),kind,title,body,audience:kind==='ops'?'ops':'staff',tags,blocks:editorMedia(decodeEditorBody(body)??[])},admin);}
async function publish(d:Document){await service(admin).submitReview(d.id,{expectedSequence:d.sequence,reviewerId:'b'});await service(reviewer).decideReview(d.id,{expectedSequence:d.sequence+1,action:'approve'});await service(admin).changePublication(d.id,{expectedSequence:d.sequence+2,action:'queue'});await service(admin).changePublication(d.id,{expectedSequence:d.sequence+3,action:'publish'});return (await repo.getForManagement(d.id,admin))!;}
before(async()=>{fixture=await temporaryDatabase();await migrate(fixture.pool);await fixture.pool.query("INSERT INTO juyu.members(clerk_user_id,display_name,observed_role,verified_email,observed_at) VALUES('a','Admin','admin','a@example.test',now()),('b','Reviewer','admin','b@example.test',now()),('o','Ops','ops','o@example.test',now()),('s','Support','support','s@example.test',now())");const rp=randomBytes(24).toString('hex'),ip=randomBytes(24).toString('hex');await fixture.pool.query(`CREATE ROLE search_runtime LOGIN PASSWORD '${rp}' IN ROLE juyu_runtime; CREATE ROLE search_issuer LOGIN PASSWORD '${ip}' IN ROLE juyu_context_issuer`);runtime=fixture.connectAs('search_runtime',rp);issuer=fixture.connectAs('search_issuer',ip);db=new ScopedDatabase(runtime,issuer);repo=new DocumentRepository(db);});
after(async()=>{await runtime?.end();await issuer?.end();await fixture?.close();});
beforeEach(async()=>{await fixture.pool.query('TRUNCATE juyu.documents CASCADE');});
test('body and tags search literal Chinese and ASCII partial words across all content kinds',async()=>{
 for(const kind of ['article','ops','reference','qa'] as const){await publish(await draft('域名续费示例 TransferDomain',kind,`${kind} title`,['专属标签']));}
 for(const query of ['续费','transFER','费','专属','域名 domain','域名 标签']){const result=(await service().search(query)).search;assert.equal(result.total,4,query);assert.equal(result.results.length,4);assert.deepEqual(new Set(result.results.map(r=>r.kind)),new Set(['article','ops','reference','qa']));assert.ok(result.results.every(r=>r.revision===1&&r.snippet?.includes('域名')));}
 assert.equal((await service(support).search('续费')).search.total,3);assert.equal((await service().search('续费 absent')).search.total,0);
});
test('search scope filters before counting and still enforces reader permissions',async()=>{
 for(const kind of ['article','ops','reference','qa'] as const)await publish(await draft('范围筛选针尖',kind,`${kind} title`));
 for(const kind of ['article','ops','reference','qa'] as const){
  const result=(await service(ops).search('针尖',undefined,kind)).search;
  assert.equal(result.total,1,kind);assert.equal(result.results[0].kind,kind);
 }
 assert.equal((await service(support).search('针尖',undefined,'ops')).search.total,0);
 assert.equal((await service(support).search('针尖',undefined,'qa')).search.total,1);
 await assert.rejects(runtime.query('SELECT * FROM juyu.search_publications_scoped($1,1,$2)',[['针尖'],'qa']),/FORBIDDEN/);
});
test('rich inline adjacency, nested blocks and display-only media text are searchable without structured IDs',async()=>{
 const body=encodeEditorBody([{id:'private-node-key',type:'paragraph',content:[{type:'text',text:'跨样',styles:{bold:true}},{type:'text',text:'式续费',styles:{}}],children:[{id:'child',type:'paragraph',content:[{type:'text',text:'NestedChild',styles:{}}]}]},
 {id:'table',type:'juyu',props:{payload:JSON.stringify({id:'table',type:'table',headers:['表头'],rows:[['单元格退款']]})}},
 {id:'diagram',type:'juyu',props:{payload:JSON.stringify({id:'diagram',type:'diagram',source:'graph TD; privateSourceA-->privateSourceB',caption:'流程图说明'})}}]);
 const d=await publish(await draft(body));
 for(const query of ['跨样式续费','nestedchild','单元格','流程图说明']){const result=(await service().search(query)).search;assert.deepEqual(result.results.map(x=>x.id),[d.id]);assert.ok(!JSON.stringify(result).includes('JUYU_BLOCKNOTE'));}
 for(const query of ['private-node-key','privateSourceA','textAlignment','跨样式续费NestedChild'])assert.equal((await service().search(query)).search.total,0,query);
});
test('literal SQL wildcard characters do not broaden search and late body matches have relevant snippets',async()=>{const d=await publish(await draft('普通文字'.repeat(2000)+' 100%under_score\\path <script>alert(1)</script> 末尾针尖'));
 for(const q of ['%','_','\\','100%under_score','末尾针尖']){const found=(await service().search(q)).search;assert.deepEqual(found.results.map(x=>x.id),[d.id]);assert.ok(found.results[0].snippet!.length<=242);assert.ok(found.results[0].snippet!.includes(q));}
 await publish(await draft('Just ordinary'));assert.equal((await service().search('%')).search.total,1);assert.equal((await service().search("' OR 1=1 --")).search.total,0);
});
test('publication pointer keeps old formal body and tags until re-publication and closes on availability changes',async()=>{
 let d=await publish(await draft('原版词语','article','Stable',['旧标签']));d=await repo.execute(d.id,{type:'edit',title:'Next',body:'新版词语',audience:'staff',tags:['新标签']},admin,{expectedSequence:d.sequence});
 assert.equal((await service().search('原版')).search.total,1);assert.equal((await service().search('新版')).search.total,0);assert.equal((await service().search('新标签')).search.total,0);
 d=await publish(d);assert.equal((await service().search('原版')).search.total,0);assert.equal((await service().search('新版')).search.results[0].revision,2);
 await service(admin).changeAvailability(d.id,{expectedSequence:d.sequence,action:'unpublish'});assert.equal((await service().search('新版')).search.total,0);assert.equal(await service().article(d.id),null);
});
test('stable pagination, full count and out-of-range pages preserve strict validation',async()=>{
 for(let i=0;i<22;i++)await publish(await draft('分页针尖','article',i<2?'A duplicate':`B ${String(i).padStart(2,'0')}`));
 const first=(await service().search('针尖')).search,last=(await service().search('针尖','2')).search,beyond=(await service().search('针尖','999999')).search;
 assert.equal(first.total,22);assert.equal(first.pages,2);assert.equal(first.results.length,20);assert.ok(first.results[0].id<first.results[1].id);assert.deepEqual(last.results.map(x=>x.title),['B 20','B 21']);assert.equal(new Set([...first.results,...last.results].map(x=>x.id)).size,22);assert.equal(beyond.total,22);assert.deepEqual(beyond.results,[]);
 for(const q of [['针尖'],'a\u0000','a'.repeat(121)])assert.equal((await service().search(q)).search.status,'invalid');for(const p of [['1'],'0','01','1.5','1000000'])assert.equal((await service().search('针尖',p)).search.status,'invalid');assert.equal((await service().search(undefined)).search.status,'empty');
});
test('search exposes only current formal tags and bounded plain snippets',async()=>{const d=await publish(await draft('公开文本','article','标签文章',['正式标签']));await repo.execute(d.id,{type:'edit',title:'Private',body:'Private',audience:'staff',tags:['私密标签']},admin,{expectedSequence:d.sequence});const result=(await service().search('正式标签')).search.results[0];assert.deepEqual(result.tags,['正式标签']);assert.deepEqual(Object.keys(result).sort(),['breadcrumbs','href','id','kind','revision','snippet','tags','title']);});
test('current membership restrictions fail closed for search and clicks',async()=>{
 const d=await publish(await draft('权限针尖','ops'));assert.equal((await service().search('针尖')).search.total,1);
 for(const state of ["observed_role='support'","disabled_at=now()"]){await fixture.pool.query(`UPDATE juyu.members SET ${state} WHERE clerk_user_id='o'`);try{await assert.rejects(service().search('针尖'),/FORBIDDEN/);assert.equal(await service().article(d.id),null);}finally{await fixture.pool.query("UPDATE juyu.members SET observed_role='ops',disabled_at=null WHERE clerk_user_id='o'");}}
 const operation=(await fixture.pool.query("INSERT INTO juyu.member_operations(actor_id,target_id,kind,requested_role) VALUES('a','o','role','support') RETURNING id")).rows[0].id;try{await assert.rejects(service().search('针尖'),/FORBIDDEN/);assert.equal(await service().article(d.id),null);}finally{await fixture.pool.query("UPDATE juyu.member_operations SET status='conflict',finished_at=now() WHERE id=$1",[operation]);}
 await fixture.pool.query("INSERT INTO juyu.role_enrollments(member_id,requested_role,purpose) VALUES('o','support','default')");try{await assert.rejects(service().search('针尖'),/FORBIDDEN/);}finally{await fixture.pool.query("UPDATE juyu.role_enrollments SET state='complete',confirmed_at=now() WHERE member_id='o'");}
 for(const v of [null,{...ops,companyVerified:false},{...ops,role:'owner'}])await assert.rejects(service(v as Viewer|null).search('针尖'),/FORBIDDEN/);
});
test('restricted category ancestors affect search results counts snippets and subsequent clicks',async()=>{
 const d=await publish(await draft('受限针尖')),parent=randomUUID(),child=randomUUID();await fixture.pool.query("INSERT INTO juyu.categories(id,name,audience,parent_id) VALUES($1,'保密父类','admin',null),($2,'子类','staff',$1)",[parent,child]);await fixture.pool.query('INSERT INTO juyu.revision_categories VALUES($1,1,$2)',[d.id,child]);
 const denied=await service().search('针尖');assert.equal(denied.search.total,0);assert.deepEqual(denied.search.results,[]);assert.ok(!JSON.stringify(denied).includes('保密'));assert.equal(await service().article(d.id),null);
 const allowed=await service(admin).search('针尖');assert.equal(allowed.search.total,1);assert.deepEqual(allowed.search.results[0].breadcrumbs,['保密父类','子类']);
 await fixture.pool.query('UPDATE juyu.categories SET enabled=false WHERE id=$1',[parent]);assert.equal((await service(admin).search('针尖')).search.total,0);assert.equal(await service(admin).article(d.id),null);
});
test('archive trash and purge remove every searchable revision without breaking purge cleanup',async()=>{
 for(const action of ['archive','trash','purge']){const d=await publish(await draft('删除针尖','article',action));assert.equal((await service().search('针尖')).search.total,1);
 if(action==='archive')await service(admin).changeAvailability(d.id,{expectedSequence:d.sequence,action:'archive'});else{await service(admin).lifecycle(d.id,{expectedSequence:d.sequence,action:'trash'});if(action==='purge')await service(admin).lifecycle(d.id,{expectedSequence:d.sequence+1,action:'purge',confirmation:action});}
 assert.equal((await service().search('针尖')).search.total,0);assert.equal(await service().article(d.id),null);if(action==='purge')assert.equal((await fixture.pool.query('SELECT count(*)::int n FROM juyu.revision_search WHERE document_id=$1',[d.id])).rows[0].n,0);
 }
});
test('search projection denies raw reads and writes and exposes only current publication rows',async()=>{
 const d=await publish(await draft('公开针尖'));await draft('草稿秘密');
 for(const v of [ops,admin])for(const sql of ['SELECT * FROM juyu.revision_search','DELETE FROM juyu.revision_search','UPDATE juyu.revision_search SET search_text=\'fake\''])await assert.rejects(db.run(v,c=>c.query(sql)),/permission denied/);
 await assert.rejects(runtime.query('SELECT * FROM juyu.search_publications($1,1)',[['针尖']]),/FORBIDDEN/);
 const rows=await db.run(ops,async c=>(await c.query('SELECT * FROM juyu.search_publications($1,1)',[['针尖']])).rows);assert.deepEqual(rows.map(x=>x.id),[d.id]);
 assert.equal((await fixture.pool.query("SELECT EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE p.oid='juyu.search_publications(text[],integer)'::regprocedure AND a.grantee=0 AND a.privilege_type='EXECUTE') ok")).rows[0].ok,false);
});
test('GIN candidate index is usable for literal Chinese search and survives migration replay',async(t)=>{
 await publish(await draft('索引针尖'));const client=await fixture.pool.connect();try{await client.query('BEGIN');await client.query('SET LOCAL enable_seqscan=off');const plan=(await client.query("EXPLAIN (FORMAT JSON) SELECT document_id FROM juyu.revision_search WHERE grams @> ARRAY['针尖']::text[]")).rows;assert.ok(JSON.stringify(plan).includes('revision_search_grams_gin'));await client.query('ROLLBACK');}finally{client.release();}
 assert.deepEqual(await migrate(fixture.pool),[]);assert.equal((await service().search('针尖')).search.total,1);
 const availability=(await fixture.pool.query("SELECT name FROM pg_available_extensions WHERE name='pg_trgm'")).rows;t.diagnostic(`Local pg_trgm available: ${availability.length===1}; native array GIN chosen for literal 1-2 character candidate lookup without extension setup.`);
});
test('existing revisions are backfilled on upgrade including rich text and malformed structured bodies fail closed',async()=>{
 const old=await temporaryDatabase();try{
  await old.pool.query('CREATE SCHEMA juyu; CREATE TABLE juyu.schema_migrations(version text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
  const directory=new URL('../../src/server/database/migrations/',import.meta.url);
  for(const file of (await readdir(directory)).filter(file=>file.endsWith('.sql')&&file<'0014').sort()){
   const sql=await readFile(new URL(file,directory),'utf8');await old.pool.query(sql);await old.pool.query('INSERT INTO juyu.schema_migrations(version,checksum) VALUES($1,$2)',[file.slice(0,-4),createHash('sha256').update(sql).digest('hex')]);
  }
  await old.pool.query("INSERT INTO juyu.members(clerk_user_id,display_name) VALUES('a','Admin')");
  const body=encodeEditorBody([{id:'private-backfill-id',type:'paragraph',content:[{type:'text',text:'回填',styles:{bold:true}},{type:'text',text:'续费',styles:{}}]}]);
  // Seed the historical schema directly; the current repository requires current columns.
  for(const [id,title,text,tags] of [['old-rich','旧资料',body,['旧标签']],['old-plain','旧纯文','ExistingBody',[]]]){
   const c=await old.pool.connect();try{await c.query('BEGIN');await c.query("INSERT INTO juyu.documents(id,kind,sequence,workflow_revision_id,workflow_state) VALUES($1,'article',0,1,'draft')",[id]);await c.query("INSERT INTO juyu.revisions(document_id,revision_id,title,body,audience,author_id,editor_id,created_at,tags) VALUES($1,1,$2,$3,'staff','a','a',now(),$4)",[id,title,text,tags]);await c.query("INSERT INTO juyu.audit_log(document_id,sequence,action,actor_id,revision_id,at) VALUES($1,0,'create','a',1,now())",[id]);await c.query('COMMIT');}finally{c.release();}
  }
  // Historical import with an unsupported body format must not index its raw JSON.
  await old.pool.query("BEGIN; INSERT INTO juyu.documents(id,kind,sequence,workflow_revision_id,workflow_state) VALUES('malformed','article',0,1,'draft'); INSERT INTO juyu.revisions(document_id,revision_id,title,body,audience,author_id,editor_id,created_at) VALUES('malformed',1,'坏格式',E'JUYU_BLOCKNOTE_V1\\n{privateMalformed','staff','a','a',now()); INSERT INTO juyu.audit_log(document_id,sequence,action,actor_id,revision_id,at) VALUES('malformed',0,'create','a',1,now()); COMMIT;");
  assert.deepEqual(await migrate(old.pool),['0014_publication_search','0015_reference', '0016_qa', '0017_favorites', '0018_recent_views', '0019_analytics', '0020_custom_fields', '0021_categories', '0022_forms', '0023_navigation_settings', '0024_feature_flags', '0025_setting_history', '0026_announcements', '0027_native_editor', '0028_qa_search', '0029_shared_revision_config_locks', '0030_publication_number', '0031_scoped_search', '0032_category_icons', '0033_publication_icons', '0034_article_description', '0035_publication_timestamp', '0036_reader_changelog', '0037_reusable_fragments', '0038_reusable_fragment_versions', '0039_release_notes', '0040_document_locales', '0041_english_review_confirmation']);
  const rows=(await old.pool.query('SELECT document_id,search_text FROM juyu.revision_search ORDER BY document_id')).rows;
  assert.deepEqual(rows,[{document_id:'malformed',search_text:'坏格式\n\n'},{document_id:'old-plain',search_text:'旧纯文\n\nExistingBody'},{document_id:'old-rich',search_text:'旧资料\n旧标签\n\n回填续费'}]);
  assert.deepEqual(await migrate(old.pool),[]);assert.equal((await old.pool.query('SELECT count(*)::int n FROM juyu.revision_search')).rows[0].n,3);
 }finally{await old.close();}
});
test('legacy rich blocks index visible hints tabs code captions and cells without asset or diagram source',async()=>{
 let d=await draft('Legacy body');const assetId=randomUUID();await fixture.pool.query("INSERT INTO juyu.assets(id,document_id,uploaded_by,filename,mime_type,byte_size,object_key,status) VALUES($1::uuid,$2,'a','private-filename.png','image/png',4,$1::text,'ready')",[assetId,d.id]);
 d=await repo.execute(d.id,{type:'edit',title:'Rich legacy',body:'Legacy body',audience:'staff',blocks:[
 {id:'hint',type:'hint',style:'info',title:'提示标题',body:'提示正文'},
 {id:'code',type:'code',language:'js',code:'visibleCode();'},
 {id:'tabs',type:'tabs',tabs:[{id:'private-tab-id',title:'页签标题',body:'页签正文'}]},
 {id:'image',type:'image',assetId,caption:'图片说明',alt:'替代文字'},
 {id:'math',type:'math',source:'privateMathSource',caption:'公式说明'},
 {id:'table',type:'table',headers:['金额'],rows:[['RefundCell']]}
 ]},admin,{expectedSequence:d.sequence});await publish(d);
 for(const query of ['提示标题','提示正文','visibleCode','页签标题','页签正文','图片说明','替代文字','公式说明','金额','refundcell'])assert.equal((await service().search(query)).search.total,1,query);
 for(const query of [assetId,'private-storage-key','private-filename','privateMathSource','private-tab-id'])assert.equal((await service().search(query)).search.total,0,query);
});
test('large Chinese body retains late literal matches within bounded snippets',async(t)=>{
 const started=performance.now();await publish(await draft('较长正文'.repeat(25000)+'终点针尖'));
 const result=(await service().search('终点针尖')).search;assert.equal(result.total,1);assert.ok(result.results[0].snippet!.includes('终点针尖'));assert.ok(result.results[0].snippet!.length<=242);t.diagnostic(`100k-character body local create/publish/search: ${Math.round(performance.now()-started)} ms; not a scale benchmark.`);
});
test('legacy visible inline phrases match across formatting while fenced code and table cells retain literal markers',async()=>{
 const d=await publish(await draft('# 标**题**词语\n\n跨**样式**续费\n\n- 列_表_内容\n\n```text\n保留**代码**符号\n```\n\n| 表**头** | 价格 |\n| --- | --- |\n| 原**样**单元 | 100 |'));
 for(const query of ['标题词语','跨样式续费','列表内容','保留**代码**符号','表**头**','原**样**单元'])assert.deepEqual((await service().search(query)).search.results.map(x=>x.id),[d.id],query);
 for(const query of ['保留代码符号','原样单元','|','---'])assert.equal((await service().search(query)).search.total,0,query);
});
test('hint and tab display fields retain their literal formatting markers',async()=>{
 let d=await draft();d=await repo.execute(d.id,{type:'edit',title:'Formatting',body:'Body',audience:'staff',blocks:[{id:'hint',type:'hint',style:'info',title:'提示**标题**',body:'跨**提示**内容'},{id:'tabs',type:'tabs',tabs:[{id:'tab',title:'页签**标题**',body:'跨_页签_内容'}]}]},admin,{expectedSequence:d.sequence});await publish(d);
 for(const query of ['跨**提示**内容','跨_页签_内容','提示**标题**','页签**标题**'])assert.equal((await service().search(query)).search.total,1,query);
});
test('legacy SQL projection agrees with the existing reader token and block adapters',async()=>{
 const examples=['跨**样式**续费','A __bold__ and _em_ then `code`','***triple***','a**b *c* d**e','``code`` and `one`','`a``b`','**unterminated','same\n**next**','```raw\n**keep**\n```','    ~~~raw\n_keep_','___nested___','x_中_y','**a**__b__*c*_d_'];
 for(const value of examples){const text=(await fixture.pool.query('SELECT juyu.search_inline_text($1) text',[value])).rows[0].text;assert.equal(text,inlineTokens(value).map(x=>x.text).join(''),value);}
 const bodies=['# Heading **joined**\n\nParagraph _joined_\nline\n\n2. second **item**\n3. next','  ```lang\n**raw**\n  ```\n\n# After','| **head** | B |\n| :--- | ---: |\n| _raw_ | cell |\n\nText','~~~~\n# raw\n**raw**\n~~~~','    ```literal\n**kept**\n\n**next**'];
 for(const body of bodies){const rendered=parseReaderBody(body).blocks.flatMap(block=>block.type==='table'?[...block.headers,...block.rows.flat()]:block.type==='list'?block.items.map(text=>inlineTokens(text).map(x=>x.text).join('')):[inlineTokens(block.text).map(x=>x.text).join('')]).join('\n');const text=(await fixture.pool.query('SELECT juyu.search_legacy_text($1) text',[body])).rows[0].text;assert.equal(text,rendered,body);}
});

test('native blocks and table link labels are indexed but destinations stay private and OPS permissions apply',async()=>{
 const link={type:'link',href:'https://example.com/secret-url-token',content:[{type:'text',text:'原生链接名称',styles:{textColor:'red'}}]};
 const body=encodeEditorBody([{id:'todo',type:'checkListItem',props:{checked:true},content:[link]}, {id:'table',type:'table',content:{type:'tableContent',rows:[{cells:[[{type:'text',text:'原生表格费用',styles:{}}]]}]}}]);
 const d=await draft(body,'ops');assert.equal((await service(ops).search('原生链接名称')).search.total,0);
 await publish(d);for(const text of ['原生链接名称','原生表格费用']){assert.equal((await service(ops).search(text)).search.total,1);assert.equal((await service(support).search(text)).search.total,0);}
 assert.equal((await service(ops).search('secret-url-token')).search.total,0);
});
test('native audio reservation is administrator scoped and still refuses unsupported MIME',async()=>{
 const d=await draft();await db.run(admin,c=>c.query('SELECT juyu.reserve_upload($1,$2,$3,$4,$5)',[randomUUID(),d.id,'sample.mp3','audio/mpeg',123]));
 await assert.rejects(db.run(support,c=>c.query('SELECT juyu.reserve_upload($1,$2,$3,$4,$5)',[randomUUID(),d.id,'sample.mp3','audio/mpeg',123])),/FORBIDDEN/);
 await assert.rejects(db.run(admin,c=>c.query('SELECT juyu.reserve_upload($1,$2,$3,$4,$5)',[randomUUID(),d.id,'sample.html','text/html',123])),/INVALID_UPLOAD/);
});

test('native file references cannot attach another document asset or mislabel audio as an image',async()=>{
 const d=await draft(),other=await draft(),id=randomUUID();await db.run(admin,async c=>{await c.query('SELECT juyu.reserve_upload($1,$2,$3,$4,$5)',[id,d.id,'sample.mp3','audio/mpeg',123]);await c.query('SELECT juyu.finish_upload($1,true)',[id]);});
 const content=(type:string)=>encodeEditorBody([{id:'file',type,props:{url:'/api/assets/'+id,name:'Sample',caption:'Audio'}}]);
 for(const [target,type] of [[other,'audio'],[d,'image']] as const){const body=content(type);await assert.rejects(repo.execute(target.id,{type:'edit',title:target.revisions[0].title,body,audience:'staff',blocks:editorMedia(decodeEditorBody(body)!)},admin,{expectedSequence:target.sequence}),/INVALID_MEDIA/);}
 const body=content('audio');const updated=await repo.execute(d.id,{type:'edit',title:'Audio',body,audience:'staff',blocks:editorMedia(decodeEditorBody(body)!)},admin,{expectedSequence:d.sequence});await publish(updated);assert.equal((await service(support).article(d.id))?.title,'Audio');
});
