import assert from 'node:assert/strict';
import {test} from 'node:test';
import {enrollmentCandidate} from '../src/server/enrollment/candidate.ts';
const company={status:'verified' as const,userId:'a',email:'a@company.test',slackUserId:'U123',slackTeamId:'T123'};
const user={id:'a',banned:false,locked:false,publicMetadata:{},primaryEmailAddressId:'e',emailAddresses:[{id:'e',emailAddress:'a@company.test',verification:{status:'verified'}}]};
test('only company verified current accounts with missing or valid roles qualify for enrollment',()=>{
 assert.deepEqual(enrollmentCandidate(company,user),{id:'a',email:'a@company.test',displayName:'a@company.test',role:undefined});
 for(const role of ['support','ops','admin'])assert.equal(enrollmentCandidate(company,{...user,publicMetadata:{role}})?.role,role);
 for(const role of ['Admin','',null,{},false])assert.equal(enrollmentCandidate(company,{...user,publicMetadata:{role}}),null);
 for(const proof of [{status:'unconfigured' as const},{status:'signed_out' as const},{...company,userId:'other'}])assert.equal(enrollmentCandidate(proof,user),null);
 for(const altered of [{...user,banned:true},{...user,locked:true},{...user,primaryEmailAddressId:null},{...user,emailAddresses:[{id:'e',emailAddress:'other@company.test',verification:{status:'verified'}}]}])assert.equal(enrollmentCandidate(company,altered),null);
});

test('real enrollment route stays closed without services and ignores forged roles',async()=>{
 const {GET,POST}=await import('../src/app/api/auth/enrollment/route.ts');
 for(const response of [await GET(),await POST(new Request('http://local/api/auth/enrollment',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://local'},body:JSON.stringify({userId:'attacker',role:'admin'})}))]){
  assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'AUTH_NOT_CONFIGURED'});assert.ok(response.headers.get('cache-control')?.includes('no-store'));
 }
});

test('both admin landing and login can send unenrolled accounts to the fixed employee setup flow',async()=>{
 const {enrollmentRedirect}=await import('../src/server/enrollment/navigation.ts');
 for(const status of ['required','pending','waiting'] as const)assert.equal(await enrollmentRedirect(async()=>({status})),'/help-centre');
 assert.equal(await enrollmentRedirect(async()=>({status:'ready',role:'admin',initialAdmin:true})),null);
 assert.equal(await enrollmentRedirect(async()=>{throw new Error('unavailable');}),null);
});
