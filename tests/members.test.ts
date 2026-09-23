import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verifiedMember } from '../src/server/authentication/member.ts';
import { parseMemberChange } from '../src/server/members/input.ts';
import { exactClerkUserId } from '../scripts/promote-initial-super-admin.ts';
const company = { status: 'verified' as const, userId: 'a', email: 'a@company.test', slackUserId: 'U123', slackTeamId: 'T123' };
const user = { id:'a', banned:false, locked:false, publicMetadata:{role:'admin'}, primaryEmailAddressId:'email', emailAddresses:[{id:'email',emailAddress:'a@company.test',verification:{status:'verified'}}] };
test('member identity accepts only current verified provider role and matching primary email', () => {
  assert.equal(verifiedMember(company,user)?.role,'admin');
  for(const role of ['support','ops','super_admin']) assert.equal(verifiedMember(company,{...user,publicMetadata:{role}})?.role,role);
  for(const role of ['Admin','',undefined,null,{}]) assert.equal(verifiedMember(company,{...user,publicMetadata:{role}}),null);
  for(const altered of [{...user,banned:true},{...user,locked:true},{...user,id:'other'},{...user,primaryEmailAddressId:null}]) assert.equal(verifiedMember(company,altered),null);
  assert.equal(verifiedMember({status:'signed_out'},user),null);
});
test('member commands reject arbitrary metadata, unknown fields and unsafe values', () => {
  assert.deepEqual(parseMemberChange({type:'role',role:'ops',expectedRole:'support'}),{type:'role',role:'ops',expectedRole:'support'});
  assert.deepEqual(parseMemberChange({type:'role',role:'super_admin',expectedRole:'admin'}),{type:'role',role:'super_admin',expectedRole:'admin'});
  assert.deepEqual(parseMemberChange({type:'disable',disabled:true}),{type:'disable',disabled:true});
  for(const input of [null,[],{type:'role',role:'admin'},{type:'role',role:'Admin',expectedRole:'ops'},{type:'disable',disabled:'true'},{type:'disable',disabled:true,actor:'forged'},{type:'role',role:'admin',expectedRole:'ops',slackTeamId:'fake'}]) assert.throws(()=>parseMemberChange(input),/INVALID_INPUT/);
});
test('initial Super Admin promotion requires exactly one Clerk user ID and refuses email addresses',()=>{
 assert.equal(exactClerkUserId(['user_2AbC9']),'user_2AbC9');
 for(const args of [[],['tony@juming.hk'],['user_a','user_b'],[' user_a'],['user_a-']])assert.throws(()=>exactClerkUserId(args),/EXACT_CLERK_USER_ID_REQUIRED/);
});

test('database URLs require two restricted identities and verified TLS outside loopback', async()=>{
 const {databaseConfiguration}=await import('../src/config/database.ts');
 assert.equal(databaseConfiguration({}).state,'missing');
 const local={JUYU_DATABASE_RUNTIME_URL:'postgresql://runtime:secret@127.0.0.1:5432/juyu',JUYU_DATABASE_ISSUER_URL:'postgresql://issuer:secret@127.0.0.1:5432/juyu'};
 assert.equal(databaseConfiguration(local).state,'configured');
 assert.equal(databaseConfiguration({...local,JUYU_DATABASE_ISSUER_URL:local.JUYU_DATABASE_RUNTIME_URL}).state,'invalid');
 const remote=Object.fromEntries(Object.entries(local).map(([k,v])=>[k,v.replace('127.0.0.1','db.example.com')]));
 assert.equal(databaseConfiguration(remote).state,'invalid');
 assert.equal(databaseConfiguration(Object.fromEntries(Object.entries(remote).map(([k,v])=>[k,v+'?sslmode=verify-full']))).state,'configured');
});
test('member API protects writes with exact origin and maps failures without details',async()=>{
 const {memberResponse,readMemberInput}=await import('../src/server/members/http.ts');
 const req=(origin:string,body='{}')=>new Request('https://app.test/api/admin/members/a',{method:'PATCH',headers:{Origin:origin,'Content-Type':'application/json'},body});
 await assert.rejects(readMemberInput(req('https://evil.test'),'https://app.test'),/FORBIDDEN/);
 await assert.rejects(readMemberInput(req('null'),'https://app.test'),/FORBIDDEN/);
 assert.deepEqual(await readMemberInput(req('https://app.test'),'https://app.test'),{});
 await assert.rejects(readMemberInput(req('https://app.test','x'.repeat(5000)),'https://app.test'),/INVALID_INPUT/);
 for(const [error,status] of [['MEMBER_PENDING',409],['SUPER_ADMIN_REQUIRED',403],['LAST_SUPER_ADMIN',409],['FORBIDDEN: secret',403],['AUTH_NOT_CONFIGURED',503],['provider secret',503],['INVALID_INPUT',400]] as const){
  const response=await memberResponse(async()=>{throw new Error(error);});assert.equal(response.status,status);assert.ok(response.headers.get('cache-control')?.includes('no-store'));assert.equal((await response.text()).includes('secret'),false);
 }
});
