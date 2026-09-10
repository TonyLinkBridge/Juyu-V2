import assert from 'node:assert/strict';
import {test} from 'node:test';
import {defaultNavigationEntries,navigationPages,parseNavigationWrite,normalizeNavigationConfig,normalizeMenuItems,navigationHref} from '../src/navigation-settings/model.ts';
const id='00000000-0000-4000-8000-000000000099';
const entry={id,label:'首页',enabled:true,roles:['support','ops','admin'],target:{type:'page',page:'home'}};
test('navigation settings parse exact bounded entries and canonical roles',()=>{
 assert.deepEqual(parseNavigationWrite({expectedVersion:0,entries:[{...entry,label:' 首页 ',roles:['admin','support']}]}),{expectedVersion:0,entries:[{...entry,roles:['support','admin']}]});
 for(const patch of [{id:'bad'},{label:''},{label:'x'.repeat(81)},{label:'A\nB'},{enabled:1},{roles:[]},{roles:['support','support']},{roles:['owner']},{target:{type:'url',url:'https://example.com'}},{target:{type:'page',page:'admin'}},{target:{type:'category',categoryId:'bad'}},{extra:true}])assert.throws(()=>parseNavigationWrite({expectedVersion:0,entries:[{...entry,...patch}]}),/INVALID_INPUT/);
 for(const value of [{expectedVersion:null,entries:[]},{expectedVersion:-1,entries:[]},{expectedVersion:2147483647,entries:[]},{expectedVersion:0,entries:[entry,entry]},{expectedVersion:0,entries:Array.from({length:41},(_,n)=>({...entry,id:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`}))},{expectedVersion:0,entries:[],extra:true}])assert.throws(()=>parseNavigationWrite(value),/INVALID_INPUT/);
 assert.deepEqual(parseNavigationWrite({expectedVersion:0,entries:[]}),{expectedVersion:0,entries:[]});
});
test('configuration and menu acknowledgements reject noncanonical or external destinations',()=>{
 assert.equal(normalizeNavigationConfig({version:0,entries:defaultNavigationEntries}).version,0);assert.equal(defaultNavigationEntries.length,navigationPages.length);
 for(const entries of [[{...entry,label:' spaced '}],[{...entry,roles:['admin','support']}],[entry,entry]])assert.throws(()=>normalizeNavigationConfig({version:1,entries}),/INVALID_INPUT/);
 assert.equal(navigationHref({type:'page',page:'home'}),'/help-centre');assert.equal(navigationHref({type:'category',categoryId:id}),`/help-centre/categories/${id}`);
 const item={id,label:'入口',href:'/help-centre'};assert.deepEqual(normalizeMenuItems([item]),[item]);
 for(const href of ['https://evil.test','//evil.test','/admin','javascript:alert(1)','/help-centre?admin=1','/help-centre/categories/not-a-uuid'])assert.throws(()=>normalizeMenuItems([{...item,href}]),/INVALID_INPUT/);
 assert.throws(()=>normalizeMenuItems([item,item]),/INVALID_INPUT/);
});
test('navigation HTTP errors never disclose internals and every response is private no-store',async()=>{
 const {navigationResponse,readNavigationBody,requireNavigationOrigin}=await import('../src/server/navigation-settings/http.ts');
 for(const [code,status] of [['FORBIDDEN',403],['INVALID_INPUT',400],['NAVIGATION_CONFLICT',409],['NAVIGATION_LIMIT',409],['MEMBER_BUSY',503],['SECRET_DATABASE',503]] as const){const result=await navigationResponse(async()=>{throw new Error(`${code}: private data`);});assert.equal(result.status,status);assert.equal(result.headers.get('cache-control'),'private, no-store');assert.equal(result.headers.get('vary'),'Cookie, Authorization');assert.deepEqual(await result.json(),{error:status===503?'NAVIGATION_UNAVAILABLE':code});}
 const success=await navigationResponse(async()=>({config:{version:1,entries:[]}}));assert.equal(success.status,200);assert.equal(success.headers.get('cache-control'),'private, no-store');
 assert.deepEqual(await readNavigationBody(new Request('http://localhost/api',{method:'PUT',body:'{"expectedVersion":0,"entries":[]}'})),{expectedVersion:0,entries:[]});await assert.rejects(readNavigationBody(new Request('http://localhost/api',{method:'PUT',body:'x'.repeat(65537)})),/INVALID_INPUT/);await assert.rejects(readNavigationBody(new Request('http://localhost/api',{method:'PUT',body:'{invalid'})),/INVALID_INPUT/);
 const saved=process.env.APP_ORIGIN;process.env.APP_ORIGIN='https://example.test';try{assert.throws(()=>requireNavigationOrigin(new Request('https://example.test/api/admin/navigation',{method:'PUT',headers:{origin:'https://evil.test','content-type':'application/json'}})),/FORBIDDEN/);requireNavigationOrigin(new Request('https://example.test/api/admin/navigation',{method:'PUT',headers:{origin:'https://example.test','content-type':'application/json'}}));}finally{if(saved===undefined)delete process.env.APP_ORIGIN;else process.env.APP_ORIGIN=saved;}
});
