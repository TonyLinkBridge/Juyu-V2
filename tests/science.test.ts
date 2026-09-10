import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mathMarkup,validateDiagram} from '../src/science/model.ts';
import {normalizeBlocks} from '../src/media/model.ts';
import {inlineHTML} from '../src/reader/inline.ts';
test('T029 renders bounded formula MathML and rejects trusted commands and invalid formulas',()=>{
 assert.match(mathMarkup('\\frac{a}{b}+x^2'),/<math/);for(const value of ['\\frac{','\\href{https://outside.test}{go}','\\includegraphics{x}','x'.repeat(2001)])assert.throws(()=>mathMarkup(value));
 assert.deepEqual(normalizeBlocks([{id:'math',type:'math',source:'x^2',caption:'公式'}]),[{id:'math',type:'math',source:'x^2',caption:'公式'}]);
});
test('T029 diagram source cannot configure renderer, load links or add HTML',()=>{
 assert.equal(validateDiagram('flowchart TD\n A[提交] --> B[审核]'),'flowchart TD\n A[提交] --> B[审核]');
 for(const value of ['sequenceDiagram\nA->B:foo','---\nconfig: {}','flowchart TD\nclick A "javascript:alert(1)"','flowchart TD\nA[<img src=x>]','%%{init:{securityLevel:"loose"}}%%\nflowchart TD\nA-->B'])assert.throws(()=>validateDiagram(value));
});
test('T029 Chinese inline emphasis is rendered and raw markup remains escaped',()=>{
 const value=inlineHTML('中文**重要**，*注意*，`**原文**` <script>bad</script>');assert.match(value,/<strong>重要<\/strong>/);assert.match(value,/<em>注意<\/em>/);assert.match(value,/<code>\*\*原文\*\*<\/code>/);assert.doesNotMatch(value,/<script>/);
});
test('T029 rendered diagram checks published access before and after rendering',async()=>{
 const {diagramResponse}=await import('../src/server/science/response.ts');let renders=0,calls=0;const snapshot={article:{id:'d',title:'title',revision:1,body:'',blocks:normalizeBlocks([{id:'b',type:'diagram',source:'flowchart TD\nA-->B',caption:''}])},files:[]};
 const denied=await diagramResponse('d',1,'b',{pdf:async()=>{throw new Error('NOT_FOUND');}},async()=>{renders++;return '<svg/>';});assert.equal(denied.status,503);assert.equal(renders,0);
 const revoked=await diagramResponse('d',1,'b',{pdf:async()=>{if(calls++>0)throw new Error('NOT_FOUND');return snapshot;}},async()=>{renders++;return '<svg/>';});assert.equal(revoked.status,503);assert.equal(renders,1);
 const okay=await diagramResponse('d',1,'b',{pdf:async()=>snapshot},async()=>'<svg/>');assert.equal(okay.status,200);assert.equal(okay.headers.get('cache-control'),'private, no-store');assert.match(okay.headers.get('content-security-policy')!,/sandbox/);
});

test('T055 diagram preview errors distinguish access from input and never reveal backend diagnostics',async()=>{
 const {diagramPreviewResponse}=await import('../src/server/science/response.ts');
 for(const [raw,status,expected] of [['AUTH_NOT_CONFIGURED',503,'AUTH_NOT_CONFIGURED'],['FORBIDDEN: private member',403,'FORBIDDEN'],['NOT_FOUND',404,'NOT_FOUND'],['INVALID_INPUT',400,'INVALID_INPUT'],['password=private-sentinel /Users/server/browser.log',503,'流程图暂时不可用，请检查语法或稍后重试。'],['Parse error private-sentinel',503,'流程图暂时不可用，请检查语法或稍后重试。']] as const){
  const r=await diagramPreviewResponse(async()=>{throw new Error(raw);});assert.equal(r.status,status);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('vary'),'Cookie, Authorization');const body=await r.json();assert.equal(body.error,expected);assert.doesNotMatch(JSON.stringify(body),/private-sentinel|private member|browser.log/);
 }
});
