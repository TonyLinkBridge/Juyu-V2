import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseFeedback,feedbackPage} from '../src/feedback/model.ts';
import {readFeedbackInput,feedbackResponse} from '../src/server/feedback/http.ts';
const input={revision:1,helpful:true,comment:'  中文说明  ',expectedVersion:0};
test('feedback input rejects forged identity, invalid versions and oversized comments',()=>{
 assert.deepEqual(parseFeedback(input),{...input,comment:'中文说明'});
 for(const invalid of [{...input,memberId:'other'},{...input,helpful:'yes'},{...input,revision:0},{...input,expectedVersion:-1},{...input,comment:'文'.repeat(1001)},null])assert.throws(()=>parseFeedback(invalid),/INVALID_INPUT/);
 assert.equal(feedbackPage(undefined),1);for(const page of [-1,'1e2',['2'],'1.5'])assert.throws(()=>feedbackPage(page),/INVALID_INPUT/);
});
test('feedback writes require same origin JSON and a bounded body',async()=>{
 const request=(headers:Record<string,string>,body=JSON.stringify(input))=>new Request('https://internal.test/api/feedback',{method:'PUT',headers,body});
 const headers={origin:'https://internal.test','content-type':'application/json'};
 assert.deepEqual(await readFeedbackInput(request(headers),'https://internal.test'),input);
 for(const bad of [{...headers,origin:'https://outside.test'},{...headers,'sec-fetch-site':'cross-site'},{...headers,'content-type':'text/plain'}])await assert.rejects(readFeedbackInput(request(bad),'https://internal.test'));
 await assert.rejects(readFeedbackInput(request(headers,'x'.repeat(9000)),'https://internal.test'),/INVALID_INPUT/);
});
test('feedback errors have explicit status and no private diagnostic leakage or caching',async()=>{
 for(const [message,status] of [['INVALID_INPUT',400],['CONFLICT',409],['VERSION_CHANGED',409],['NOT_FOUND',404],['FORBIDDEN: role',403],['sql secret',503]] as const){
  const response=await feedbackResponse(async()=>{throw new Error(message)});assert.equal(response.status,status);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.ok(!(await response.text()).includes('sql secret'));
 }
});
