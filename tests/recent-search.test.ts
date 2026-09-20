import assert from 'node:assert/strict';
import {test} from 'node:test';
import {clearRecentSearch,recentSearches,recordRecentSearch} from '../src/reader/recent-search.ts';

test('recent search is bounded, deduplicated, scoped, expiring and clearable',()=>{
 const data=new Map<string,string>();const storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);},removeItem:(key:string)=>{data.delete(key);}};
 for(let i=0;i<7;i++)recordRecentSearch(storage,`查询 ${i}`,'all',1000+i);
 assert.equal(recentSearches(storage,1007).length,5);
 recordRecentSearch(storage,' 查询 6 ','qa',2000);assert.deepEqual(recentSearches(storage,2000)[0],{query:'查询 6',scope:'qa',at:2000});
 recordRecentSearch(storage,'查询 6','qa',3000);assert.equal(recentSearches(storage,3000).filter(entry=>entry.query==='查询 6'&&entry.scope==='qa').length,1);
 assert.deepEqual(recentSearches(storage,30*60*1000+4000),[]);
 clearRecentSearch(storage);assert.deepEqual(recentSearches(storage),[]);
});
test('recent search rejects malformed or sensitive storage payloads',()=>{
 const data=new Map<string,string>();const storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);},removeItem:(key:string)=>{data.delete(key);}};
 recordRecentSearch(storage,'有效','article',1000);
 data.set('juyu-recent-search-v1',JSON.stringify([{query:'bad\nline',scope:'all',at:1000},{query:'有效',scope:'invalid',at:1000},{query:'合规',scope:'qa',at:1000}]));
 assert.deepEqual(recentSearches(storage,1001),[{query:'合规',scope:'qa',at:1000}]);
 data.set('juyu-recent-search-v1','{');assert.deepEqual(recentSearches(storage,1001),[]);
});
test('English and Chinese recent searches stay in separate browser lists',()=>{
 const data=new Map<string,string>();const storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);},removeItem:(key:string)=>{data.delete(key);}};
 recordRecentSearch(storage,'account email','article',1000,'en');
 recordRecentSearch(storage,'账户邮箱','article',1000,'zh-CN');
 assert.deepEqual(recentSearches(storage,1001,'en').map(item=>item.query),['account email']);
 assert.deepEqual(recentSearches(storage,1001,'zh-CN').map(item=>item.query),['账户邮箱']);
 clearRecentSearch(storage,'en');
 assert.deepEqual(recentSearches(storage,1001,'en'),[]);
 assert.equal(recentSearches(storage,1001,'zh-CN').length,1);
});
