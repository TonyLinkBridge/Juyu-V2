import test from 'node:test';
import assert from 'node:assert/strict';
import {loadComponent} from './helpers/render-component.ts';

test('readiness coalesces probes, checks both roles, and sends no secret to signing-key endpoint',async()=>{
 const oldFetch=globalThis.fetch,oldKey=process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,oldOrigin=process.env.APP_ORIGIN;
 process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY='pk_test_'+Buffer.from('auth.example.test$').toString('base64');
 process.env.APP_ORIGIN='https://app.example.test';
 let requests=0,connections=0,closed=0;const roles:string[]=[];
 globalThis.fetch=async(url,options)=>{requests++;assert.equal(String(url),'https://auth.example.test/.well-known/jwks.json');assert.equal(new Headers(options?.headers).has('authorization'),false);assert.equal(options?.redirect,'error');return Response.json({keys:[{kty:'RSA',kid:'fixture',n:'fixture',e:'AQAB'}]});};
 class Client {on(){}async connect(){connections++;}async query(){return {rows:[{ready:true}]};}async end(){closed++;}}
 try{
  const probeModule=loadComponent('src/server/readiness.ts',{'server-only':{},pg:{Client},'../config/clerk':{clerkConfiguration:()=> 'configured'},'../config/database':{databaseConfiguration:()=>({state:'configured',runtime:'local-runtime',issuer:'local-issuer'})},'../config/database-tls':{databasePoolOptions:()=>({})},'../config/readiness':{getReadinessReport:(_env:unknown,checks:Record<string,string>)=>({...checks,status:checks.authentication==='ok'&&checks.database==='ok'?'ready':'not_ready'})},'./database/scoped':{checkRole:async(_client:unknown,role:string)=>{roles.push(role);}}});
  const read=probeModule.applicationReadiness as ()=>Promise<Record<string,unknown>>;
  const results=await Promise.all([read(),read(),read()]);assert.equal(results[0].status,'ready');assert.equal(results[0].loginVerified,false);assert.equal(requests,1);assert.equal(connections,2);assert.equal(closed,2);assert.deepEqual(roles.sort(),['juyu_context_issuer','juyu_runtime']);await read();assert.equal(requests,1);
 }finally{globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;else process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=oldKey;if(oldOrigin===undefined)delete process.env.APP_ORIGIN;else process.env.APP_ORIGIN=oldOrigin;}
});
test('readiness checks Clerk through the verified Vercel proxy',async()=>{
 const oldFetch=globalThis.fetch,oldKey=process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,oldOrigin=process.env.APP_ORIGIN;
 process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY='pk_live_'+Buffer.from('clerk.help.example.vercel.app$').toString('base64');
 process.env.APP_ORIGIN='https://help.example.vercel.app';
 let requested='';
 globalThis.fetch=async(url,options)=>{requested=String(url);assert.equal(new Headers(options?.headers).has('authorization'),false);return Response.json({keys:[{kty:'RSA',kid:'fixture',n:'fixture',e:'AQAB'}]});};
 class Client {on(){}async connect(){}async query(){return {rows:[{ready:true}]};}async end(){}}
 try{
  const probeModule=loadComponent('src/server/readiness.ts',{'server-only':{},pg:{Client},'../config/clerk':{clerkConfiguration:()=> 'configured'},'../config/database':{databaseConfiguration:()=>({state:'configured',runtime:'local-runtime',issuer:'local-issuer'})},'../config/database-tls':{databasePoolOptions:()=>({})},'../config/readiness':{getReadinessReport:(_env:unknown,checks:Record<string,string>)=>({...checks,status:checks.authentication==='ok'&&checks.database==='ok'?'ready':'not_ready'})},'./database/scoped':{checkRole:async()=>{}}});
  const result=await (probeModule.applicationReadiness as ()=>Promise<Record<string,unknown>>)();
  assert.equal(result.status,'ready');
  assert.equal(requested,'https://help.example.vercel.app/__clerk/.well-known/jwks.json');
 }finally{
  globalThis.fetch=oldFetch;
  if(oldKey===undefined)delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;else process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=oldKey;
  if(oldOrigin===undefined)delete process.env.APP_ORIGIN;else process.env.APP_ORIGIN=oldOrigin;
 }
});
test('readiness returns failed for unreachable database and still closes every client',async()=>{
 let closed=0;
 class Client {on(){}async connect(){throw Error('private vendor failure');}async end(){closed++;}}
 const probeModule=loadComponent('src/server/readiness.ts',{'server-only':{},pg:{Client},'../config/clerk':{clerkConfiguration:()=> 'missing'},'../config/database':{databaseConfiguration:()=>({state:'configured',runtime:'local-runtime',issuer:'local-issuer'})},'../config/database-tls':{databasePoolOptions:()=>({})},'../config/readiness':{getReadinessReport:(_env:unknown,checks:Record<string,string>)=>({...checks,status:'not_ready'})},'./database/scoped':{checkRole:async()=>{throw Error('must not reach');}}});
 const read=probeModule.applicationReadiness as ()=>Promise<Record<string,unknown>>;const result=await read();assert.equal(result.database,'failed');assert.equal(result.status,'not_ready');assert.equal(closed,2);assert.ok(!JSON.stringify(result).includes('private vendor'));
});
