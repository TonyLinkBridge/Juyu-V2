import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAnswerCache} from '../src/qa/answer-cache.ts';
test('answers survive remount but never cross sessions, versions or expiry',()=>{
 const cache=createAnswerCache<string>(30,2);
 cache.put('session-a','q',1,'answer',100);
 assert.equal(cache.get('session-a','q',1,110),'answer');
 assert.equal(cache.get('session-a','q',2,110),undefined);
 assert.equal(cache.get('session-b','q',1,110),undefined);
 assert.equal(cache.get('session-a','q',1,131),undefined);
 assert.equal(cache.peek('session-a','q',1),'answer');
 cache.clear();assert.equal(cache.get('session-a','q',1,110),undefined);
});
test('cache is bounded and clearing removes every session',()=>{
 const cache=createAnswerCache<string>(30,2);
 for(const id of ['a','b','c'])cache.put('s',id,1,id,100);
 assert.equal(cache.get('s','a',1,101),undefined);
 assert.equal(cache.get('s','c',1,101),'c');
 cache.clear();assert.equal(cache.get('s','c',1,101),undefined);
});
