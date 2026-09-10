import assert from 'node:assert/strict';import {test} from 'node:test';
import {filterReferenceRows} from '../src/reference/filter.ts';
const table={id:'table',headers:['注册商','规则'],rows:[['Example A','转出 EPP 100%_'],['Example B','续费'],['Example A','转出需核对']]};
test('reference row filtering is literal Chinese ASCII AND and can be limited to a selected column',()=>{
 assert.equal(filterReferenceRows(table,'转出 epp').total,1);assert.equal(filterReferenceRows(table,'%_').total,1);assert.equal(filterReferenceRows(table,'[').total,0);assert.equal(filterReferenceRows(table,'example',0).total,3);assert.equal(filterReferenceRows(table,'example',1).total,0);assert.equal(filterReferenceRows(table,'').total,3);assert.deepEqual(filterReferenceRows(table,'需核对').items,[{index:2,cells:table.rows[2]}]);
});
test('reference rows retain source order and numbers, bound pages, and reject invalid filters without mutating the table',()=>{
 const large={...table,rows:Array.from({length:45},(_,i)=>['Example',String(i)])};const before=structuredClone(large);
 assert.equal(filterReferenceRows(large,'',null,2).items[0].index,20);assert.equal(filterReferenceRows(large,'',null,99).items.length,5);assert.equal(filterReferenceRows(large,'',null,99).page,3);assert.equal(filterReferenceRows(large,'不存在').total,0);assert.equal(filterReferenceRows(large,'x'.repeat(121)).status,'invalid');assert.equal(filterReferenceRows(large,'',9).status,'invalid');assert.equal(filterReferenceRows(large,'',null,0).status,'invalid');assert.deepEqual(large,before);
});
