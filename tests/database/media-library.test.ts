import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID,randomBytes} from 'node:crypto';
import {temporaryDatabase} from './fixture.ts';
import {migrate} from '../../src/server/database/migrate.ts';
import {ScopedDatabase} from '../../src/server/database/scoped.ts';
import {AuthorizationService} from '../../src/server/authorization/service.ts';
import {encodeEditorBody} from '../../src/editor/document.ts';

test('media search finds filenames, article titles and uploaders without widening access',async()=>{
 const fixture=await temporaryDatabase();let runtime,issuer;
 try{
  await migrate(fixture.pool);
  await fixture.pool.query("INSERT INTO juyu.members(clerk_user_id,display_name,observed_role,verified_email,observed_at) VALUES('a','本地上传者','admin','a@example.test',now()),('s','员工','support','s@example.test',now())");
  const rp=randomBytes(24).toString('hex'),ip=randomBytes(24).toString('hex');
  await fixture.pool.query(`CREATE ROLE media_runtime LOGIN PASSWORD '${rp}' IN ROLE juyu_runtime;CREATE ROLE media_issuer LOGIN PASSWORD '${ip}' IN ROLE juyu_context_issuer`);
  runtime=fixture.connectAs('media_runtime',rp);issuer=fixture.connectAs('media_issuer',ip);
  runtime.options.max=2;issuer.options.max=2;
  const db=new ScopedDatabase(runtime,issuer),service=new AuthorizationService(db,async()=>({id:'a',role:'admin',companyVerified:true}));
  const document=randomUUID(),asset=randomUUID();
  await service.saveDraft(document,{expectedSequence:null,title:'MFA 登录教程',body:encodeEditorBody([{id:'text',type:'paragraph',content:[{type:'text',text:'正文',styles:{}}]}]),kind:'article',audience:'staff',tags:[],cover:null});
  await service.reserveUpload(document,asset,{filename:'image.png',mime:'image/png',size:1024});await service.finishUpload(asset,true);
  for(const q of ['image.png','MFA','本地上传者']){
   const result=await service.mediaLibrary({q});assert.equal(result.total,1,q);assert.equal(result.items[0]?.id,asset);
  }
  const ids:string[]=[];
  for(let i=0;i<31;i++){const id=randomUUID();ids.push(id);await service.reserveUpload(document,id,{filename:`sort-${String(i).padStart(2,'0')}.png`,mime:'image/png',size:2000+i});await service.finishUpload(id,true);}
  const asc=await service.mediaLibrary({q:'sort-',sort:'size',direction:'asc',view:'list'}),next=await service.mediaLibrary({q:'sort-',sort:'size',direction:'asc',view:'list',page:'2'}),desc=await service.mediaLibrary({q:'sort-',sort:'size',direction:'desc'});
  assert.equal(asc.items[0].id,ids[0]);assert.equal(asc.items[29].id,ids[29]);assert.equal(next.items[0].id,ids[30]);assert.equal(desc.items[0].id,ids[30]);assert.equal(asc.total,31);
  const concurrent=await Promise.all(Array.from({length:20},()=>service.mediaLibrary({q:'image.png'})));
  assert.ok(concurrent.every(result=>result.total===1));
  assert.equal((await service.mediaLibrary({q:'%'})).total,0,'a wildcard is a literal search');
  assert.equal((await service.mediaLibrary({q:'_'})).total,0,'underscore must not match every character');
  const employee=new AuthorizationService(db,async()=>({id:'s',role:'support',companyVerified:true}));
  await assert.rejects(employee.mediaLibrary({q:'MFA'}),/FORBIDDEN/);
 }finally{await runtime?.end();await issuer?.end();await fixture.close();}
});
