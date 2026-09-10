import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseReaderBody} from '../src/reader/body.ts';
test('body headings and outline share unique stable IDs even for repeated Chinese titles',()=>{
 const source='# 操作步骤\n第一段\n\n## 操作步骤\n第二段\n\n### 注意';
 const doc=parseReaderBody(source);
 assert.deepEqual(doc.sections,[{id:'section-1',title:'操作步骤',depth:1},{id:'section-2',title:'操作步骤',depth:2},{id:'section-3',title:'注意',depth:3}]);
 assert.deepEqual(doc.blocks.filter(b=>b.type==='heading').map(b=>b.id),['section-1','section-2','section-3']);
 assert.deepEqual(parseReaderBody(source),doc);
});
test('plain paragraphs and top-level lists retain text and ordered starting number',()=>{
 const doc=parseReaderBody('第一行\r\n第二行\r\n\r\n- 事项甲\n- 事项乙\n\n3. 核对\n4. 提交');
 assert.deepEqual(doc.blocks,[{type:'paragraph',text:'第一行\n第二行'},{type:'list',ordered:false,start:1,items:['事项甲','事项乙']},{type:'list',ordered:true,start:3,items:['核对','提交']}]);
 assert.deepEqual(doc.sections,[]);assert.deepEqual(parseReaderBody(' \n\t').blocks,[]);
});
test('HTML, media syntax and fenced heading text are preserved as text without generating outline entries',()=>{
 const text='<script>alert(1)</script>\n![secret](https://outside.example/x)\n\n```html\n# not a heading\n<img src=x onerror=alert(1)>\n```\n\n# real';
 const doc=parseReaderBody(text);
 assert.deepEqual(doc.sections,[{id:'section-1',title:'real',depth:1}]);
 assert.match(JSON.stringify(doc.blocks),/<script>alert\(1\)<\/script>/);
 assert.match(JSON.stringify(doc.blocks),/# not a heading/);
});

test('simple pipe tables preserve all rows and keep literal HTML as text',()=>{
 const doc=parseReaderBody('| 项目 | 说明 |\n| --- | --- |\n| 注册 | <b>文字</b> |\n| 续费 | 费用 |');
 assert.deepEqual(doc.blocks,[{type:'table',headers:['项目','说明'],rows:[['注册','<b>文字</b>'],['续费','费用']]}]);
 assert.equal(parseReaderBody('| 不是表格 |\n没有分隔行').blocks[0].type,'paragraph');
});
