import assert from 'node:assert/strict';
import {test,type TestContext} from 'node:test';
import {randomBytes} from 'node:crypto';
import {temporaryDatabase} from './fixture.ts';
import {migrate} from '../../src/server/database/migrate.ts';
import {MemberStore} from '../../src/server/members/store.ts';
import {ScopedDatabase} from '../../src/server/database/scoped.ts';
import type {EnrollmentResult} from '../../src/server/enrollment/service.ts';
import {EnrollmentService} from '../../src/server/enrollment/service.ts';
import type {Role} from '../../src/domain/model.ts';
function readyRole(result:EnrollmentResult){assert.ok(result.status==='ready');return result.role;}
async function setup(t:TestContext){
 const db=await temporaryDatabase(),pools:import('pg').Pool[]=[];
 t.after(async()=>{for(const pool of pools)await pool.end();await db.close();});await migrate(db.pool);
 const pass=randomBytes(16).toString('hex');
 await db.pool.query(`CREATE ROLE enroll_issuer LOGIN PASSWORD '${pass}' IN ROLE juyu_context_issuer;CREATE ROLE enroll_runtime LOGIN PASSWORD '${pass}' IN ROLE juyu_runtime`);
 const issuer=db.connectAs('enroll_issuer',pass),runtime=db.connectAs('enroll_runtime',pass);pools.push(issuer,runtime);
 const store=new MemberStore(issuer),people=new Map(['a','b','c'].map(id=>[id,{id,displayName:id,email:`${id}@company.test`,role:undefined as Role|undefined}]));
 const writes:{id:string;role:Role}[]=[];let mode:'ok'|'after'|'before'='ok';let allowed=true;
 const provider={async setRole(id:string,role:Role){writes.push({id,role});if(mode==='before')throw new Error('network');people.get(id)!.role=role;if(mode==='after')throw new Error('network');}};
 const service=(id:string)=>new EnrollmentService(store,async()=>allowed?people.get(id)!:null,provider);
 return {db,issuer,runtime,store,people,writes,service,setMode(value:typeof mode){mode=value;},revoke(){allowed=false;}};
}
test('read-only enrollment inspection does not reserve ownership or write Clerk',async t=>{
 const f=await setup(t);assert.equal((await f.service('a').inspect()).status,'required');assert.equal(f.writes.length,0);
 assert.equal((await f.db.pool.query('SELECT state FROM juyu.initialization')).rows[0].state,'empty');
});
test('concurrent first sign-ins reserve exactly one admin and later arrivals become Support',async t=>{
 const f=await setup(t),results=await Promise.allSettled([f.service('a').run(),f.service('b').run()]);
 assert.ok(results.some(result=>result.status==='fulfilled'));
 for(const id of ['a','b'])await f.service(id).run();
 assert.equal(f.writes.filter(w=>w.role==='admin').length,1);assert.equal(f.writes.filter(w=>w.role==='support').length,1);
 assert.equal(readyRole(await f.service('c').run()),'support');
 const initial=(await f.db.pool.query('SELECT * FROM juyu.initialization')).rows[0];assert.equal(initial.state,'complete');assert.ok(['a','b'].includes(initial.owner_id));
});
test('failed company proof cannot reserve first admin or create members',async t=>{
 const f=await setup(t);f.revoke();await assert.rejects(f.service('a').run(),/FORBIDDEN/);
 assert.equal(f.writes.length,0);assert.equal((await f.db.pool.query('SELECT state FROM juyu.initialization')).rows[0].state,'empty');
 assert.equal((await f.db.pool.query('SELECT count(*)::int AS n FROM juyu.members')).rows[0].n,0);
});
test('uncertain first assignment is durable and only its owner can confirm it without another write',async t=>{
 const f=await setup(t);f.setMode('after');assert.equal((await f.service('a').run()).status,'pending');
 assert.equal((await f.service('b').run()).status,'waiting');assert.equal(f.writes.length,1);
 await assert.rejects(f.store.bind({...f.people.get('a')!,role:'admin'}),/MEMBER_PENDING/);
 assert.equal(readyRole(await f.service('a').run()),'admin');assert.equal(f.writes.length,1);
 f.setMode('ok');assert.equal(readyRole(await f.service('b').run()),'support');
});
test('nonmatching readback never releases first ownership or retries the remote write',async t=>{
 const f=await setup(t);f.setMode('before');assert.equal((await f.service('a').run()).status,'pending');
 assert.equal((await f.service('a').run()).status,'pending');assert.equal((await f.service('b').run()).status,'waiting');assert.equal(f.writes.length,1);
 f.people.get('a')!.role='admin';assert.equal((await f.service('a').run()).status,'ready');assert.equal(f.writes.length,1);
});
test('removed or downgraded first admin is never automatically promoted again',async t=>{
 const f=await setup(t);await f.service('a').run();f.people.get('a')!.role='support';assert.equal(readyRole(await f.service('a').run()),'support');
 f.people.get('a')!.role=undefined;await assert.rejects(f.service('a').run(),/FORBIDDEN/);
 assert.equal(readyRole(await f.service('b').run()),'support');assert.equal(f.writes.filter(w=>w.role==='admin').length,1);
});
test('pre-existing members and manually assigned roles are preserved without auto escalation',async t=>{
 const f=await setup(t);await f.db.pool.query("INSERT INTO juyu.members(clerk_user_id,display_name) VALUES ('legacy','Existing')");
 f.people.get('a')!.role='ops';assert.equal(readyRole(await f.service('a').run()),'ops');assert.equal(f.writes.length,0);
 assert.equal(readyRole(await f.service('b').run()),'support');assert.equal(f.writes.some(w=>w.role==='admin'),false);
});
test('initialization history cannot be reset and runtime cannot claim ownership',async t=>{
 const f=await setup(t);await f.service('a').run();
 await assert.rejects(f.runtime.query("UPDATE juyu.initialization SET state='empty'"),{code:'42501'});
 await assert.rejects(f.issuer.query("UPDATE juyu.initialization SET state='empty',owner_id=NULL,completed_at=NULL"),/IMMUTABLE/);
 await assert.rejects(f.db.pool.query('DELETE FROM juyu.role_enrollments'),/IMMUTABLE/);
 const scoped=new ScopedDatabase(f.runtime,f.issuer);assert.equal((await scoped.run({id:'a',role:'admin',companyVerified:true},c=>c.query('SELECT juyu.is_admin() AS ok'))).rows[0].ok,true);
});

test('disabled or revoked first owner keeps reservation and cannot finish or transfer it',async t=>{
 const f=await setup(t);f.setMode('after');assert.equal((await f.service('a').run()).status,'pending');
 await f.db.pool.query("UPDATE juyu.members SET disabled_at=clock_timestamp() WHERE clerk_user_id='a'");
 await assert.rejects(f.service('a').run(),/FORBIDDEN/);assert.equal((await f.service('b').run()).status,'waiting');
 assert.equal((await f.db.pool.query('SELECT owner_id FROM juyu.initialization')).rows[0].owner_id,'a');assert.equal(f.writes.length,1);
});
test('pending enrollment blocks database access and cannot be edited as an ordinary member role',async t=>{
 const f=await setup(t);f.setMode('after');await f.service('a').run();
 const scoped=new ScopedDatabase(f.runtime,f.issuer);
 await f.db.pool.query("UPDATE juyu.members SET observed_role='admin' WHERE clerk_user_id='a'");
 assert.equal((await scoped.run({id:'a',role:'admin',companyVerified:true},c=>c.query('SELECT juyu.is_admin() AS ok'))).rows[0].ok,false);
 await assert.rejects(f.issuer.query("UPDATE juyu.role_enrollments SET member_id='b' WHERE member_id='a'"),/IMMUTABLE/);
});

test('administrator directory identifies pending enrollment and refuses ordinary role edits',async t=>{
 const f=await setup(t);await f.service('a').run();f.setMode('after');await f.service('b').run();
 const {MemberService}=await import('../../src/server/members/service.ts');
 const current=async()=>({...f.people.get('a')!,role:'admin' as const});
 const members=new MemberService(f.store,current,{
  async verified(id){const p=f.people.get(id);return p?.role?{...p,role:p.role}:null;},
  async user(id){const p=f.people.get(id)!;return {id,banned:false,locked:false,publicMetadata:{role:p.role},primaryEmailAddressId:'e',emailAddresses:[{id:'e',emailAddress:p.email,verification:{status:'verified'}}]};},
  async setRole(){assert.fail('pending enrollment cannot be edited');}
 });
 const row=(await members.list()).members.find(m=>m.clerk_user_id==='b');
 assert.equal(row?.pending,true);
 await assert.rejects(members.change('b',{type:'role',role:'ops',expectedRole:'support'}),/MEMBER_PENDING/);
});
