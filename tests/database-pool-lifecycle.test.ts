import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Pool,type PoolConfig} from 'pg';
import {loadComponent} from './helpers/render-component.ts';

test('both application pools keep the request alive until idle connections can close',async t=>{
 const pools:Pool[]=[];
 class ObservedPool extends Pool {constructor(options:PoolConfig){super(options);pools.push(this);}}
 const pending:Promise<unknown>[]=[];
 const context=Symbol.for('@vercel/request-context');
 const globals=globalThis as typeof globalThis&{[key:symbol]:unknown};
 const previous=globals[context];
 const previousUrl=process.env.VERCEL_URL,previousRegion=process.env.VERCEL_REGION;
 globals[context]={get:()=>({waitUntil:(promise:Promise<unknown>)=>pending.push(promise)})};
 process.env.VERCEL_URL='fixture.vercel.app';process.env.VERCEL_REGION='fixture';
 t.mock.timers.enable({apis:['setTimeout']});
 try{
  const app=loadComponent('src/server/database/application.ts',{'server-only':{},pg:{Pool:ObservedPool},'../../config/database.ts':{databaseConfiguration:()=>({state:'configured',runtime:'postgresql://runtime:local@127.0.0.1/local',issuer:'postgresql://issuer:local@127.0.0.1/local'})}});
  const open=app.applicationDatabase as ()=>unknown;
  assert.equal(open(),open(),'a repeated request reuses its pools');
  assert.equal(pools.length,2);
  for(const pool of pools)pool.emit('release',null,{});
  assert.equal(pending.length,2,'both runtime and issuer release must register background cleanup');
  t.mock.timers.tick(20000);await Promise.all(pending);
 }finally{
  t.mock.timers.tick(20000);await Promise.all(pending);await Promise.all(pools.map(pool=>pool.end()));
  globals[context]=previous;
  if(previousUrl===undefined)delete process.env.VERCEL_URL;else process.env.VERCEL_URL=previousUrl;
  if(previousRegion===undefined)delete process.env.VERCEL_REGION;else process.env.VERCEL_REGION=previousRegion;
 }
});
