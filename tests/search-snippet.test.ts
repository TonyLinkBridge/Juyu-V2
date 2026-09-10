import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as search from '../src/reader/search.ts';
const snippet=(text:string,query:string)=>{
 const fn=(search as unknown as {searchSnippet?:(text:string,query:string)=>string}).searchSnippet;
 assert.equal(typeof fn,'function','Unified search needs a safe context snippet');return fn!(text,query);
};
test('search snippet finds late Chinese or ASCII matches and stays within the result budget',()=>{
 const body='开头说明。'.repeat(100)+'处理 EPP 转出异常，请联系运营。'+' 后续步骤。'.repeat(100);
 const value=snippet(body,'epp');assert.ok(value.includes('EPP 转出异常'));assert.ok(value.startsWith('…'));assert.ok(value.endsWith('…'));assert.ok(value.length<=242);
 assert.ok(snippet(body,'异常').includes('异常'));assert.equal(snippet('第一行\n\t第二行','第一行'),'第一行 第二行');
});
test('search snippet uses literal text preserves Unicode and does not fabricate absent text',()=>{
 assert.equal(snippet('','missing'),'');assert.equal(snippet('短正文','missing'),'短正文');assert.equal(snippet('<script>100%_&</script>','%_'),'<script>100%_&</script>');
 for(let n=0;n<6;n++){const value=snippet('😀'.repeat(150+n)+'匹配点'+'😀'.repeat(150),'匹配点');assert.ok(value.includes('匹配点'));assert.ok(value.length<=242);assert.equal(value.isWellFormed(),true);}
 assert.ok(!snippet('中'.repeat(500),'').includes('undefined'));
});
