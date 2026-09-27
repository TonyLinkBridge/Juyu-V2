import assert from 'node:assert/strict';
import test from 'node:test';
import {adminForAccount} from '../src/server/authentication/admin.ts';

test('admin and super admin account roles receive admin access',()=>{
 for(const role of ['admin','super_admin'] as const){
  assert.deepEqual(adminForAccount({status:'ready',sessionId:'sess',viewer:{id:'user',role,companyVerified:true}}),{status:'admin',userId:'user'});
 }
});

test('non-admin and blocked accounts cannot enter the admin console',()=>{
 for(const role of ['support','ops'] as const){
  assert.deepEqual(adminForAccount({status:'ready',sessionId:'sess',viewer:{id:'user',role,companyVerified:true}}),{status:'denied'});
 }
 for(const status of ['missing','disabled','pending'] as const)assert.deepEqual(adminForAccount({status}),{status:'denied'});
 for(const status of ['unconfigured','signed_out','unavailable'] as const)assert.deepEqual(adminForAccount({status}),{status});
});
