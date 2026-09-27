import test from 'node:test';
import assert from 'node:assert/strict';
import {loadComponent} from './helpers/render-component.ts';

test('a signed-in administrator reaches admin without rechecking enrollment',async()=>{
 let enrollmentReads=0;
 const {default:AdminSignIn}=loadComponent('src/app/admin/sign-in/[[...sign-in]]/page.tsx',{
  '../../../../server/authentication/account-clerk':{currentAccountAccess:async()=>({status:'ready',sessionId:'sess',viewer:{id:'admin',role:'admin',companyVerified:true}})},
  '../../../../server/authentication/admin':{
   adminForAccount:()=>({status:'admin',userId:'admin'}),
   adminDestination:()=>'/admin',
  },
  '../../../../server/enrollment/application':{applicationEnrollment:async()=>({inspect:async()=>{enrollmentReads++;return {status:'ready',role:'admin',initialAdmin:false};}})},
  '../../../../server/enrollment/navigation':{enrollmentRedirect:async(read:()=>Promise<unknown>)=>{await read();return null;}},
  '../../../../components/login-screen':{LoginScreen:'LoginScreen'},
  '../../../../components/employee-login':{EmployeeLogin:'EmployeeLogin'},
  '../../../../components/employee-sign-out':{EmployeeSignOut:'EmployeeSignOut'},
  '../../../../server/authentication/clerk':{employeeSession:async()=>({status:'signed_in',userId:'admin',sessionId:'sess'})},
  '../../../../server/authentication/admin-entry':{currentAdminAccess:async()=>({status:'admin',userId:'admin'})},
  'next/navigation':{redirect:(url:string)=>{throw Error('REDIRECT:'+url);}},
 });
 await assert.rejects(()=>((AdminSignIn as ()=>Promise<unknown>)()),/REDIRECT:\/admin/);
 assert.equal(enrollmentReads,0);
});
