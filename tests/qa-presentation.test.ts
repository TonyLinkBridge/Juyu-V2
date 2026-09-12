import assert from 'node:assert/strict';
import {test} from 'node:test';
import {answerDocument} from '../src/qa/presentation.ts';
import {encodeEditorBody} from '../src/editor/document.ts';
test('inline answers keep formatting but isolate their heading anchors',()=>{
 const body=encodeEditorBody([{id:'heading',type:'heading',props:{level:2},content:[{type:'text',text:'红色答案',styles:{textColor:'red',bold:true}}]}]);
 const a=answerDocument(body,'one'),b=answerDocument(body,'two');
 assert.notEqual(a.sections[0].id,b.sections[0].id);
 const first=a.editorBlocks![0],second=b.editorBlocks![0];assert.ok('content' in first&&'content' in second);assert.deepEqual(first.content,second.content);
 assert.equal(answerDocument('## 步骤','one').sections[0].id,'qa-one-section-1');
});
