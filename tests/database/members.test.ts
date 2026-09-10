import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { randomBytes } from 'node:crypto';
import { temporaryDatabase } from './fixture.ts';
import { migrate } from '../../src/server/database/migrate.ts';
import { MemberStore } from '../../src/server/members/store.ts';
import { MemberService } from '../../src/server/members/service.ts';
import { ScopedDatabase } from '../../src/server/database/scoped.ts';
let fixture: Awaited<ReturnType<typeof temporaryDatabase>>;
let runtime: import('pg').Pool, issuer: import('pg').Pool;
before(async()=>{
 fixture=await temporaryDatabase(); await migrate(fixture.pool);
 const password=randomBytes(16).toString('hex');
 await fixture.pool.query(`CREATE ROLE member_runtime LOGIN PASSWORD '${password}' IN ROLE juyu_runtime; CREATE ROLE member_issuer LOGIN PASSWORD '${password}' IN ROLE juyu_context_issuer`);
 runtime=fixture.connectAs('member_runtime',password);issuer=fixture.connectAs('member_issuer',password);
});
after(async()=>{await runtime?.end();await issuer?.end();await fixture?.close();});
test('member migration provides durable pending operations and denies runtime writes',async()=>{
 const tables=await fixture.pool.query("SELECT to_regclass('juyu.member_operations') AS operations");
 assert.equal(tables.rows[0].operations,'juyu.member_operations');
 await assert.rejects(runtime.query("INSERT INTO juyu.members(clerk_user_id,display_name) VALUES ('forged','Forged')"),{code:'42501'});
 await assert.rejects(runtime.query('DELETE FROM juyu.member_operations'),{code:'42501'});
});
test('pending member changes block an otherwise valid database context',async()=>{
 await fixture.pool.query("INSERT INTO juyu.members(clerk_user_id,display_name,observed_role) VALUES ('admin-a','A','admin'),('admin-b','B','admin')");
 const db=new ScopedDatabase(runtime,issuer),viewer={id:'admin-b',role:'admin' as const,companyVerified:true};
 assert.equal((await db.run(viewer,c=>c.query('SELECT juyu.is_admin() AS allowed'))).rows[0].allowed,true);
 await fixture.pool.query("INSERT INTO juyu.member_operations(actor_id,target_id,kind,before_role,requested_role) VALUES ('admin-a','admin-b','role','admin','ops')");
 assert.equal((await db.run(viewer,c=>c.query('SELECT juyu.is_admin() AS allowed'))).rows[0].allowed,false);
 await fixture.pool.query("UPDATE juyu.member_operations SET status='applied',finished_at=now() WHERE target_id='admin-b'");
 assert.equal((await db.run(viewer,c=>c.query('SELECT juyu.is_admin() AS allowed'))).rows[0].allowed,true);
});

function setupService(actor='a') {
 const people = new Map(['a','b','c'].map(id=>[id,{id,role:id==='c'?'support':'admin',email:`${id}@company.test`,displayName:id}]));
 let failWrite=false;
 const provider={
  async user(id:string){const p=people.get(id)!;return {id,banned:false,locked:false,publicMetadata:{role:p.role},primaryEmailAddressId:'e',emailAddresses:[{id:'e',emailAddress:p.email,verification:{status:'verified'}}]};},
  async verified(id:string){return people.get(id)! as import('../../src/server/authentication/member.ts').VerifiedMember;},
  async setRole(id:string,role:import('../../src/domain/model.ts').Role){people.get(id)!.role=role;if(failWrite)throw new Error('provider timed out after applying');}
 };
 const store=new MemberStore(issuer);
 const service=new MemberService(store,()=>provider.verified(actor),provider);
 return {people,provider,store,service,setFail(){failWrite=true;}};
}
test('verified identities bind through restricted issuer; disabled and pending targets cannot bind',async()=>{
 const {store,provider}=setupService();
 for(const id of ['a','b','c'])await store.bind(await provider.verified(id));
 const member=await store.bind(await provider.verified('c')); assert.equal(member.id,'c');
 await fixture.pool.query("UPDATE juyu.members SET disabled_at=now() WHERE clerk_user_id='c'");
 await assert.rejects(store.bind(await provider.verified('c')),/FORBIDDEN/);
 await fixture.pool.query("UPDATE juyu.members SET disabled_at=NULL WHERE clerk_user_id='c'");
 await assert.rejects(new MemberStore(fixture.pool).bind(await provider.verified('a')),/UNSAFE_DATABASE_ROLE/);
});
test('role writes audit before and after and take effect on next request',async()=>{
 const {store,provider,service}=setupService();
 for(const id of ['a','b','c'])await store.bind(await provider.verified(id));
 assert.equal((await service.change('c',{type:'role',role:'ops',expectedRole:'support'})).status,'applied');
 const row=(await fixture.pool.query("SELECT * FROM juyu.member_operations WHERE target_id='c' ORDER BY created_at DESC LIMIT 1")).rows[0];
 assert.equal(row.before_role,'support');assert.equal(row.observed_role,'ops');assert.equal(row.actor_id,'a');
 assert.equal((await store.bind(await provider.verified('c'))).role,'ops');
 await assert.rejects(service.change('c',{type:'role',role:'admin',expectedRole:'support'}),/CONFLICT/);
});
test('self-demotion and self-disable are blocked and cross-demotions serialize',async()=>{
 const {store,provider,service}=setupService();for(const id of ['a','b'])await store.bind(await provider.verified(id));
 await assert.rejects(service.change('a',{type:'role',role:'ops',expectedRole:'admin'}),/SELF_CHANGE/);
 await assert.rejects(service.change('a',{type:'disable',disabled:true}),/SELF_CHANGE/);
 const other=new MemberService(store,()=>provider.verified('b'),provider);
 const results=await Promise.allSettled([service.change('b',{type:'role',role:'ops',expectedRole:'admin'}),other.change('a',{type:'role',role:'ops',expectedRole:'admin'})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const roles=await Promise.all(['a','b'].map(id=>provider.verified(id)));assert.equal(roles.filter(p=>p.role==='admin').length,1);
});
test('uncertain Clerk write persists denial until read-only reconciliation records actual result',async()=>{
 const {store,provider,service,setFail}=setupService();for(const id of ['a','c'])await store.bind(await provider.verified(id));
 setFail();const result=await service.change('c',{type:'role',role:'ops',expectedRole:'support'});assert.equal(result.status,'pending');
 await assert.rejects(store.bind(await provider.verified('c')),/MEMBER_PENDING/);
 await assert.rejects(service.change('b',{type:'disable',disabled:true}),/MEMBER_PENDING/);
 assert.equal((await service.reconcile(result.id)).status,'applied');
 assert.equal((await store.bind(await provider.verified('c'))).role,'ops');
 const op=(await fixture.pool.query('SELECT reconciled_by FROM juyu.member_operations WHERE id=$1',[result.id])).rows[0];assert.equal(op.reconciled_by,'a');
});
test('local suspension is audited, blocks business identity and can be restored by another admin',async()=>{
 const {store,provider,service}=setupService();for(const id of ['a','c'])await store.bind(await provider.verified(id));
 await service.change('c',{type:'disable',disabled:true});
 await assert.rejects(store.bind(await provider.verified('c')),/FORBIDDEN/);
 await service.change('c',{type:'disable',disabled:false});assert.equal((await store.bind(await provider.verified('c'))).id,'c');
});

test('role downgrade invalidates a database context already issued with the old role',async()=>{
 const {store,provider}=setupService();await store.bind(await provider.verified('b'));
 const db=new ScopedDatabase(runtime,issuer),viewer=await store.bind(await provider.verified('b'));
 await db.run(viewer,async client=>{
  assert.equal((await client.query('SELECT juyu.is_admin() AS allowed')).rows[0].allowed,true);
  await fixture.pool.query("UPDATE juyu.members SET observed_role='support' WHERE clerk_user_id='b'");
  assert.equal((await client.query('SELECT juyu.is_admin() AS allowed')).rows[0].allowed,false);
 });
});
test('reconciliation cannot release an uncertain write while the target value has not arrived',async()=>{
 const {store,provider,service}=setupService();for(const id of ['a','c'])await store.bind(await provider.verified(id));
 provider.setRole=async()=>{throw new Error('connection lost before response');};
 const op=await service.change('c',{type:'role',role:'ops',expectedRole:'support'});
 assert.equal(op.status,'pending');assert.equal((await service.reconcile(op.id)).status,'pending');
 await assert.rejects(store.bind(await provider.verified('c')),/MEMBER_PENDING/);
 // Simulate the original provider write completing later; reconciliation is read-only.
 const person=await provider.verified('c');person.role='ops';
 assert.equal((await service.reconcile(op.id)).status,'applied');
});

test('unchanged role commands never create a remote write or pending operation',async()=>{
 const {store,provider,service}=setupService();for(const id of ['a','b'])await store.bind(await provider.verified(id));
 provider.setRole=async()=>{assert.fail('unchanged role must never reach provider');};
 const before=(await fixture.pool.query('SELECT count(*)::int AS n FROM juyu.member_operations')).rows[0].n;
 await assert.rejects(service.change('b',{type:'role',role:'admin',expectedRole:'admin'}),/NO_CHANGE/);
 assert.equal((await fixture.pool.query('SELECT count(*)::int AS n FROM juyu.member_operations')).rows[0].n,before);
});
test('ordinary identity checks run concurrently but exclude member writes',async()=>{
 const {store}=setupService();
 await store.locked(async()=>{
  await store.locked(async()=>{assert.ok(true);},true);
  await assert.rejects(store.locked(async()=>{assert.fail('exclusive write must wait');}),/MEMBER_BUSY/);
 },true);
});
test('Support cannot list or mutate members and unavailable provider roles are explicit',async()=>{
 const {store,provider}=setupService('c');for(const id of ['a','b','c'])await store.bind(await provider.verified(id));
 const staff=new MemberService(store,()=>provider.verified('c'),provider);
 await assert.rejects(staff.list(),/FORBIDDEN/);await assert.rejects(staff.change('a',{type:'disable',disabled:true}),/FORBIDDEN/);
 const admin=new MemberService(store,()=>provider.verified('a'),provider);
 provider.user=async()=>{throw new Error('provider secret');};
 const list=await admin.list();assert.ok(list.members.length>=3);assert.ok(list.members.every(m=>m.role===null&&m.providerStatus==='unavailable'));
});

test('completed member history cannot be rewritten',async()=>{
 const {store,provider,service}=setupService();for(const id of ['a','c'])await store.bind(await provider.verified(id));
 const op=await service.change('c',{type:'disable',disabled:true});
 await assert.rejects(issuer.query("UPDATE juyu.member_operations SET actor_id='b' WHERE id=$1",[op.id]),/IMMUTABLE/);
 await assert.rejects(fixture.pool.query('DELETE FROM juyu.member_operations WHERE id=$1',[op.id]),/IMMUTABLE/);
 await service.change('c',{type:'disable',disabled:false});
});
