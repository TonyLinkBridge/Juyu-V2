import assert from 'node:assert/strict';
import test from 'node:test';
import {resolveAccountAccess} from '../src/server/authentication/account.ts';

const signedIn={status:'signed_in' as const,userId:'user_admin',sessionId:'sess_admin'};
const admin={id:'user_admin',role:'admin' as const,companyVerified:true as const};

test('a stored account role grants access without an external identity read',async()=>{
 let reads=0;
 const access=await resolveAccountAccess(signedIn,async id=>{reads++;assert.equal(id,'user_admin');return {status:'ready' as const,viewer:admin};});
 assert.deepEqual(access,{status:'ready',viewer:admin,sessionId:'sess_admin'});
 assert.equal(reads,1);
});

test('signed out and unavailable sessions do not read the member database',async()=>{
 for(const session of [{status:'unconfigured' as const},{status:'signed_out' as const},{status:'unavailable' as const}]){
  let reads=0;
  assert.deepEqual(await resolveAccountAccess(session,async()=>{reads++;return {status:'missing' as const};}),session);
  assert.equal(reads,0);
 }
});

test('missing, disabled and pending accounts remain blocked',async()=>{
 for(const status of ['missing','disabled','pending'] as const){
  assert.deepEqual(await resolveAccountAccess(signedIn,async()=>({status})),{status});
 }
});

test('member database failures are reported as unavailable',async()=>{
 assert.deepEqual(await resolveAccountAccess(signedIn,async()=>{throw new Error('private database detail');}),{status:'unavailable'});
});
