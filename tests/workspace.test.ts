import assert from 'node:assert/strict';
import {test} from 'node:test';
import {workspaceQuery,workspaceHref,publicationLabel} from '../src/workspace/model.ts';
import {workspaceResponse} from '../src/server/workspace/http.ts';
test('workspace query rejects ambiguous filters and treats title as literal text',()=>{
 assert.equal(workspaceQuery({q:'  中文 %_  '}).q,'中文 %_');
 for(const query of [{q:['a','b']},{scope:'toString'},{status:'unknown'},{kind:'constructor'},{page:'1e3'},{page:'0'},{page:'-1'},{q:'x'.repeat(121)},{view:'grid'}])assert.throws(()=>workspaceQuery(query),/INVALID_QUERY/);
 const q=workspaceQuery({q:'费用 & <标签>',scope:'review',kind:'ops'});
 const url=new URL(workspaceHref(q,{view:'list',page:2}),'https://local.test');
 assert.equal(url.pathname,'/admin');assert.equal(url.searchParams.get('q'),q.q);assert.equal(url.searchParams.get('scope'),'review');assert.equal(url.searchParams.get('page'),'2');
});
test('workspace publication text distinguishes current workflow from published reader copy',()=>{
 assert.equal(publicationLabel({revision:3,publicationNumber:2,publishedRevision:2,status:'draft'}),'旧正式版 2 仍可阅读');
 assert.equal(publicationLabel({revision:2,publicationNumber:2,publishedRevision:2,status:'published'}),'正式版 2');
 assert.equal(publicationLabel({revision:1,publishedRevision:null,status:'approved'}),'尚未发布');
});
test('workspace responses hide service errors and never share private results',async()=>{
 for(const [message,status] of [['FORBIDDEN',403],['INVALID_QUERY',400],['AUTH_NOT_CONFIGURED',503],['private SQL secret',503]] as const){const r=await workspaceResponse(async()=>{throw new Error(message);});assert.equal(r.status,status);assert.equal(r.headers.get('Cache-Control'),'private, no-store');assert.equal((await r.text()).includes('private SQL'),false);}
 const r=await workspaceResponse(async()=>({total:0}));assert.equal(r.status,200);assert.match(r.headers.get('Vary')!,/Cookie/);assert.deepEqual(await r.json(),{total:0});
});
