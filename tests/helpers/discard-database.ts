import {randomBytes,randomUUID} from 'node:crypto';
import {temporaryDatabase} from '../database/fixture.ts';
import {migrate} from '../../src/server/database/migrate.ts';
import {ScopedDatabase} from '../../src/server/database/scoped.ts';
import {DocumentRepository} from '../../src/server/database/repository.ts';
import {AuthorizationService} from '../../src/server/authorization/service.ts';
import type {Viewer} from '../../src/domain/model.ts';
/** Ephemeral PostgreSQL only: never accepts a production connection string. */
export async function discardDatabase(legacy=false){
 const fixture=await temporaryDatabase();
 try{
 await migrate(fixture.pool,legacy?{through:'0057_reader_navigation'}:undefined);
 await fixture.pool.query("INSERT INTO juyu.members(clerk_user_id,display_name,observed_role,verified_email,observed_at) VALUES('author','Author','admin','author@example.test',now()),('reviewer','Reviewer','admin','reviewer@example.test',now()),('super','Super','super_admin','super@example.test',now()),('staff','Staff','support','staff@example.test',now())");
 const rp=randomBytes(24).toString('hex'),ip=randomBytes(24).toString('hex');
 await fixture.pool.query(`CREATE ROLE discard_runtime LOGIN PASSWORD '${rp}' IN ROLE juyu_runtime; CREATE ROLE discard_issuer LOGIN PASSWORD '${ip}' IN ROLE juyu_context_issuer`);
 const runtime=fixture.connectAs('discard_runtime',rp),issuer=fixture.connectAs('discard_issuer',ip),db=new ScopedDatabase(runtime,issuer),repo=new DocumentRepository(db);
 const author:Viewer={id:'author',role:'admin',companyVerified:true},reviewer:Viewer={...author,id:'reviewer'},superAdmin:Viewer={...author,id:'super',role:'super_admin'},staff:Viewer={...author,id:'staff',role:'support'};
 const service=(viewer:Viewer)=>new AuthorizationService(db,async()=>viewer);
 async function workingDraft(mode:'standard'|'super_admin'){
  let d=await repo.create({id:randomUUID(),kind:'article',title:`测试资料 · ${mode}`,body:'正式内容：保留不变',audience:'staff'},mode==='standard'?author:superAdmin);
  if(mode==='standard')for(const type of ['submit','approve','queue','publish'] as const)d=await repo.execute(d.id,{type},type==='approve'?reviewer:author,{expectedSequence:d.sequence,reviewer});
  else {await service(superAdmin).changePublication(d.id,{action:'direct_publish',expectedSequence:d.sequence});d=(await repo.getForManagement(d.id,author))!;}
  const published=d;
  d=await repo.execute(d.id,{type:'edit',title:`测试草稿 · ${mode}`,body:'未发布测试修改',audience:'staff'},author,{expectedSequence:d.sequence});
  return {published,draft:d};
 }
 return {fixture,db,repo,author,reviewer,superAdmin,staff,service,workingDraft,close:async()=>{await runtime.end();await issuer.end();await fixture.close();}};
 }catch(error){await fixture.close();throw error;}
}
