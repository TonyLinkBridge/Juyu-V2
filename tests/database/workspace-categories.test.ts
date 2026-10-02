import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {randomUUID,randomBytes} from 'node:crypto';
import type {Pool} from 'pg';
import {temporaryDatabase,ownerTransactions} from './fixture.ts';
import {migrate} from '../../src/server/database/migrate.ts';
import {DocumentRepository} from '../../src/server/database/repository.ts';
import {ScopedDatabase} from '../../src/server/database/scoped.ts';
import {AuthorizationService} from '../../src/server/authorization/service.ts';
import type {Viewer,ContentKind} from '../../src/domain/model.ts';
let fixture:Awaited<ReturnType<typeof temporaryDatabase>>,runtime:Pool,issuer:Pool,owner:DocumentRepository,db:ScopedDatabase;
const admin:Viewer={id:'workspace-admin',role:'admin',companyVerified:true},reviewer:Viewer={...admin,id:'workspace-reviewer'};
const rootId=randomUUID(),childId=randomUUID(),otherId=randomUUID();
before(async()=>{
 fixture=await temporaryDatabase();await migrate(fixture.pool,{through:'0055_analytics_visible_time'});
 await fixture.pool.query("INSERT INTO juyu.members(clerk_user_id,display_name,observed_role,verified_email,observed_at) VALUES('workspace-admin','Admin','admin','admin@example.test',now()),('workspace-reviewer','Reviewer','admin','reviewer@example.test',now())");
 await fixture.pool.query("INSERT INTO juyu.categories(id,name,position) VALUES($1,'账户管理',0),($2,'会员',1)",[rootId,otherId]);
 await fixture.pool.query("INSERT INTO juyu.categories(id,name,parent_id,position) VALUES($1,'账户安全',$2,0)",[childId,rootId]);
 const runtimePassword=randomBytes(24).toString('hex'),issuerPassword=randomBytes(24).toString('hex');
 await fixture.pool.query(`CREATE ROLE workspace_runtime LOGIN PASSWORD '${runtimePassword}' IN ROLE juyu_runtime`);
 await fixture.pool.query(`CREATE ROLE workspace_issuer LOGIN PASSWORD '${issuerPassword}' IN ROLE juyu_context_issuer`);
 runtime=fixture.connectAs('workspace_runtime',runtimePassword);issuer=fixture.connectAs('workspace_issuer',issuerPassword);db=new ScopedDatabase(runtime,issuer);owner=new DocumentRepository(ownerTransactions(fixture.pool));
});
after(async()=>{if(runtime)await runtime.end();if(issuer)await issuer.end();if(fixture)await fixture.close();});
async function draft(kind:ContentKind,categoryIds:string[]=[]){return owner.create({id:randomUUID(),kind,title:`分类核对 ${kind}`,body:'内容',audience:kind==='ops'?'ops':'staff',categoryIds},admin);}
test('workspace supplies full directory paths for article OPS and Reference without duplicating rows',async()=>{
 const docs=await Promise.all(['article','ops','reference'].map(kind=>draft(kind as ContentKind,[childId,otherId])));await draft('article');
 const data=await new AuthorizationService(db,async()=>admin).workspace({q:'分类核对'});
 assert.equal(data.total,4);assert.equal(data.items.length,4);
 for(const doc of docs){const item=data.items.find(x=>x.id===doc.id)!;assert.deepEqual(item.categoryPaths,['账户管理 / 账户安全','会员']);assert.deepEqual(item.publishedCategoryPaths,[]);}
 assert.deepEqual(data.items.find(x=>!docs.some(d=>d.id===x.id))!.categoryPaths,[]);
 await fixture.pool.query("UPDATE juyu.categories SET name='账号安全',enabled=false WHERE id=$1",[childId]);
 const renamed=await new AuthorizationService(db,async()=>admin).workspace({q:'分类核对',kind:'ops'});assert.deepEqual(renamed.items[0].categoryPaths,['账户管理 / 账号安全','会员']);
 await fixture.pool.query("UPDATE juyu.categories SET name='账户安全',enabled=true WHERE id=$1",[childId]);
});
test('workspace separates draft categories from formal categories and restores formal ones after discard',async()=>{
 let doc=await draft('article',[childId]);
 for(const type of ['submit','approve','queue','publish'] as const)doc=await owner.execute(doc.id,{type},type==='approve'?reviewer:admin,{expectedSequence:doc.sequence,reviewer});
 doc=await owner.execute(doc.id,{type:'edit',title:'分类核对新修订',body:'新内容',audience:'staff',categoryIds:[otherId]},admin,{expectedSequence:doc.sequence});
 const service=new AuthorizationService(db,async()=>admin),item=(await service.workspace({q:'分类核对新修订'})).items[0];
 assert.deepEqual(item.categoryPaths,['会员']);assert.deepEqual(item.publishedCategoryPaths,['账户管理 / 账户安全']);
 await service.discardDraft(doc.id,{expectedSequence:doc.sequence});
 const restored=(await service.workspace({q:'分类核对'})).items.find(x=>x.id===doc.id)!;assert.equal(restored.status,'published');assert.deepEqual(restored.categoryPaths,['账户管理 / 账户安全']);
});
test('workspace retains Q&A discovery category and denies readers and stale administrators',async()=>{
 const doc=await owner.create({id:randomUUID(),kind:'qa',title:'问答分类核对',body:'标准答案',audience:'staff',qa:{category:'信用额度',position:3}},admin);
 const service=new AuthorizationService(db,async()=>admin),item=(await service.workspace({kind:'qa'})).items.find(x=>x.id===doc.id)!;
 assert.equal(item.qaCategory,'信用额度');assert.equal(item.qaPosition,3);
 await assert.rejects(new AuthorizationService(db,async()=>({...admin,role:'support'})).workspace({}),/FORBIDDEN/);
 await fixture.pool.query("UPDATE juyu.members SET observed_role='support' WHERE clerk_user_id='workspace-admin'");
 try{await assert.rejects(service.workspace({}),/FORBIDDEN/);}finally{await fixture.pool.query("UPDATE juyu.members SET observed_role='admin' WHERE clerk_user_id='workspace-admin'");}
});
