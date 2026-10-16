import assert from 'node:assert/strict';
import {test} from 'node:test';
import {normalizeEditorBlocks} from '../src/editor/document.ts';
import {isBlankParagraph} from '../src/fumadocs/paragraphs.ts';
import {printEditor} from '../src/editor/print.ts';
test('server reading copy and print preserve empty paragraphs as visible lines without rewriting quoted content',()=>{
 const blocks=normalizeEditorBlocks([
  {id:'quote',type:'quote',content:[{type:'text',text:'温馨提示：',styles:{bold:true,textColor:'pink'}},{type:'text',text:'保留  两个空格。',styles:{}}]},
  {id:'blank-one',type:'paragraph',content:[]},
  {id:'blank-two',type:'paragraph',content:[],children:[{id:'nested-blank',type:'paragraph',content:[]}]},
  {id:'number-four',type:'numberedListItem',props:{start:4},content:[{type:'text',text:'第四条',styles:{}}]},
 ]);
 const before=structuredClone(blocks),html=printEditor(blocks,()=>{throw Error('NO_MEDIA');});
 assert.equal((html.match(/data-reader-empty-paragraph/g)??[]).length,3);
 assert.equal((html.match(/<br>/g)??[]).length,3);
 assert.match(html,/保留  两个空格。/);assert.match(html,/<strong>温馨提示：<\/strong>/);assert.match(html,/<ol start="4">/);assert.deepEqual(blocks,before);
});

test('soft line breaks remain content while a spaces-only paragraph is an authored blank',()=>{
 const blocks=normalizeEditorBlocks([{id:'soft',type:'paragraph',content:[{type:'text',text:'\n',styles:{}}]},{id:'spaces',type:'paragraph',content:[{type:'text',text:'   ',styles:{}}]}]);
 assert.equal(isBlankParagraph(blocks[0]),false);assert.equal(isBlankParagraph(blocks[1]),true);
 const html=printEditor(blocks,()=>{throw Error('NO_MEDIA');});
 assert.equal((html.match(/data-reader-empty-paragraph/g)??[]).length,1);assert.match(html,/>\n<\/p>/);
});
