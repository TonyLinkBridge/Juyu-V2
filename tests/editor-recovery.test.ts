import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recoverySnapshot,recoveryText} from '../src/editor/recovery.ts';
const snapshot={documentId:'article-1',title:'最新标题',body:'服务器正文',sequence:4,status:'draft',lifecycle:'active',blocks:[],cover:null,tags:['流程'],assets:[],kind:'article',audience:'staff',publishedRevision:2};
test('recovery accepts a validated same-document snapshot including frozen review status',()=>{
 assert.deepEqual(recoverySnapshot(snapshot,'article-1',3),snapshot);
 assert.equal(recoverySnapshot({...snapshot,status:'in_review'},'article-1',4).status,'in_review');
});
test('recovery rejects wrong article stale sequence malformed metadata and malformed body',()=>{
 for(const patch of [{documentId:'other'},{sequence:2},{sequence:null},{body:'JUYU_BLOCKNOTE_V1\ninvalid'},{status:'unknown'},{assets:null},{kind:'invalid'},{audience:'unknown'},{tags:[5]},{lifecycle:'unknown'},{publishedRevision:-1}])assert.throws(()=>recoverySnapshot({...snapshot,...patch},'article-1',3));
});
test('recovery text preserves raw invalid draft fields and whitespace without executing markup',()=>{
 const value={title:'  我的输入  ',tags:'超过规定仍须保留',body:'<script>alert(1)</script>\n原文'};
 assert.deepEqual(JSON.parse(recoveryText(value)),value);
 assert.match(recoveryText(value),/原文/);
});
test('readable comparison includes private media descriptions without generating asset URLs',async()=>{
 const {recoveryReadable}=await import('../src/editor/recovery.ts');
 const data={...snapshot,blocks:[{id:'image-1',type:'image',assetId:'a0000000-0000-4000-8000-000000000001',caption:'处理截图',alt:'操作页面'}]};
 const text=recoveryReadable(data as import('../src/editor/contract.ts').EditorData);
 assert.match(text,/服务器正文/);assert.match(text,/处理截图/);assert.match(text,/操作页面/);assert.doesNotMatch(text,/\/api\/|https?:/);
});

test('Q&A recovery preserves version classification and rejects malformed metadata',()=>{const qa={...snapshot,kind:'qa',qa:{category:'账户',position:3}};assert.deepEqual(recoverySnapshot(qa,'article-1',3),qa);for(const value of [{category:'x',position:-1},null,{category:'x',position:1,extra:true}])assert.throws(()=>recoverySnapshot({...qa,qa:value},'article-1',3));});
