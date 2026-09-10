import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createDocument,transition} from '../src/domain/workflow.ts';
import type {Viewer} from '../src/domain/model.ts';
const a:Viewer={id:'a',role:'admin',companyVerified:true};
const input={id:'presentation',kind:'article' as const,title:'正式资料',body:'正文',audience:'staff' as const};
const cover={assetId:'11111111-1111-4111-8111-111111111111',alt:'步骤说明封面',position:35};
test('cover and normalized tags are immutable revision snapshots and omitted edits preserve them',()=>{
 const doc=createDocument({...input,tags:[' 域名 ','客服','域名'],cover},a,'2026-09-08');
 assert.deepEqual(doc.revisions[0].tags,['域名','客服']);assert.deepEqual(doc.revisions[0].cover,cover);
 const next=transition(doc,{type:'edit',title:'修订',body:'新正文',audience:'staff'},a,{expectedSequence:0,now:'2026-09-09'});
 assert.deepEqual(next.revisions[1].tags,['域名','客服']);assert.deepEqual(next.revisions[1].cover,cover);
 const removed=transition(next,{type:'edit',title:'无封面',body:'正文',audience:'staff',tags:[],cover:null},a,{expectedSequence:1,now:'2026-09-09'});
 assert.deepEqual(removed.revisions[2].tags,[]);assert.equal(removed.revisions[2].cover,null);assert.deepEqual(removed.revisions[0].cover,cover);
});
test('malformed tags and external or invalid covers cannot enter a draft',()=>{
 for(const tags of [[''],['x'.repeat(41)],Array.from({length:13},(_,i)=>String(i)),['a\nb'],[42],null,'tag']){
  assert.throws(()=>createDocument({...input,tags} as never,a,'now'),/INVALID_PRESENTATION/);
 }
 for(const c of [{...cover,assetId:'https://outside/private.png'},{...cover,position:101},{...cover,position:NaN},{...cover,alt:'a'.repeat(201)},'url']){
  assert.throws(()=>createDocument({...input,cover:c} as never,a,'now'),/INVALID_PRESENTATION/);
 }
});
