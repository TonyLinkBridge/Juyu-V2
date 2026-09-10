import assert from 'node:assert/strict';
import {test} from 'node:test';
import {normalizeEditorBlocks,encodeEditorBody,decodeEditorBody,editorMedia} from '../src/editor/document.ts';
import {editorInitialContent} from '../src/editor/legacy.ts';
import {parseReaderBody} from '../src/reader/body.ts';
import {pdfHTML} from '../src/pdf/render.ts';
const text=(id:string,value:string,type='paragraph',children:unknown[]=[])=>({id,type,props:{},content:[{type:'text',text:value,styles:{}}],children});
const hint={id:'hint',type:'hint' as const,style:'warning' as const,title:'MIDDLE',body:'Important'};
const custom={id:'hint',type:'juyu',props:{payload:JSON.stringify(hint)},children:[]};
test('structured documents roundtrip marks, hierarchy and ordered media projection',()=>{
 const input=[{...text('heading','FIRST','heading',[custom]),props:{level:2},content:[{type:'text',text:'FIRST',styles:{bold:true,italic:true,underline:true,strike:true,code:true}}]},text('last','LAST')];
 const body=encodeEditorBody(input);const result=decodeEditorBody(body)!;
 assert.equal(result[0].children[0].type,'juyu');assert.deepEqual(editorMedia(result),[hint]);assert.equal(encodeEditorBody(result),body);
 assert.deepEqual(parseReaderBody(body).sections,[{id:'heading',title:'FIRST',depth:2}]);
 const html=pdfHTML({id:'sample',title:'Sample',revision:1,body,blocks:[hint]});
 assert.ok(html.indexOf('FIRST')<html.indexOf('MIDDLE'));assert.ok(html.indexOf('MIDDLE')<html.indexOf('LAST'));assert.equal(html.match(/MIDDLE/g)?.length,1);
 assert.match(html,/<strong>/);assert.match(html,/<em>/);assert.match(html,/<u>/);assert.match(html,/<s>/);assert.match(html,/<code>/);
});
test('invalid reserved documents, executable URLs, unknown styles and duplicate nested IDs fail closed',()=>{
 assert.equal(decodeEditorBody('plain legacy'),null);
 for(const body of ['JUYU_BLOCKNOTE_V1','JUYU_BLOCKNOTE_V1\ninvalid','JUYU_BLOCKNOTE_V1\n{}'])assert.throws(()=>decodeEditorBody(body));
 const invalid=[
 [{...text('a','text'),content:[{type:'link',href:'https://outside.invalid',content:[]}]}],
 [{...text('a','text'),props:{textColor:'red'}}],
 [{...text('a','text'),content:[{type:'text',text:'text',styles:{url:'javascript:alert(1)'}}]}],
 [text('a','text','paragraph',[text('a','duplicate')])],
 [{...custom,id:'different'}],
 [{...custom,children:[text('child','invalid')]}],
 [{...text('a','text'),unexpected:'html'}],
 [{...text('a','text'),type:'image',props:{url:'https://outside.invalid'}}],
 ];
 for(const input of invalid)assert.throws(()=>normalizeEditorBlocks(input));
 const html=pdfHTML({id:'sample',title:'safe',revision:1,body:encodeEditorBody([text('a','<script>alert(1)</script> [url](https://outside.invalid)')])});
 assert.doesNotMatch(html,/<script>|href="https:/);assert.match(html,/&lt;script&gt;/);
});
test('document boundaries cap nested blocks, custom media, text and total body',()=>{
 assert.throws(()=>normalizeEditorBlocks(Array.from({length:301},(_,i)=>text('p'+i,'text'))));
 assert.throws(()=>normalizeEditorBlocks([text('a','x'.repeat(50001))]));
 assert.throws(()=>normalizeEditorBlocks(Array.from({length:41},(_,i)=>({id:'h'+i,type:'juyu',props:{payload:JSON.stringify({...hint,id:'h'+i})},children:[]}))));
 let nested:unknown=text('p0','end');for(let i=1;i<=8;i++)nested=text('p'+i,'text','paragraph',[nested]);assert.throws(()=>normalizeEditorBlocks([nested]));
 assert.throws(()=>encodeEditorBody(Array.from({length:20},(_,i)=>text('p'+i,'x'.repeat(50000)))));
});
test('legacy conversion preserves supported text marks, literal fences, tables and trailing media',()=>{
 const initial=editorInitialContent('# Heading\n\n**Bold** text\n\n```html\n# literal\n<script>safe</script>\n```\n\n| One | Two |\n| --- | --- |\n| A | B |',[hint]);
 const html=pdfHTML({id:'sample',title:'Legacy',revision:1,body:encodeEditorBody(initial),blocks:editorMedia(initial)});
 assert.match(html,/<strong>Bold<\/strong>/);assert.match(html,/# literal/);assert.match(html,/```html/);assert.match(html,/<th scope="col">One<\/th>/);assert.ok(html.indexOf('One')<html.indexOf('MIDDLE'));
 assert.equal(editorInitialContent(encodeEditorBody([text('only','existing')]),[hint]).length,1);
});
test('null and sparse schema values reject instead of silently converting data',()=>{
 for(const input of [[{...text('a','text'),props:null}],[{...text('a','text'),children:null}],[{...text('a','text'),content:null}],[{...text('a','text'),content:[{type:'text',text:'text',styles:null}]}],new Array(1)])assert.throws(()=>normalizeEditorBlocks(input));
});
test('numbered lists retain start, nested children and numbering after interruptions',()=>{
 const body=encodeEditorBody([{...text('one','Item three','numberedListItem',[text('child','Nested','bulletListItem')]),props:{start:3}},text('two','Item four','numberedListItem'),custom,{...text('five','Item nine','numberedListItem'),props:{start:9}}]);
 const html=pdfHTML({id:'sample',title:'Lists',revision:1,body,blocks:[hint]});
 assert.match(html,/<ol start="3"><li value="3"[^>]*>Item three<ul><li[^>]*>Nested<\/li><\/ul><\/li><li[^>]*>Item four<\/li><\/ol>/);
 assert.match(html,/<ol start="9"><li value="9"/);
});
test('oversized legacy tables preserve all literal cell text without applying inline markdown',()=>{
 const cell='**literal**'.repeat(5000);const initial=editorInitialContent('| One | Two |\n| --- | --- |\n| '+cell+' | B |',[]);
 const html=pdfHTML({id:'sample',title:'Legacy table',revision:1,body:encodeEditorBody(initial)});
 assert.match(html,/\*\*literal\*\*/);assert.doesNotMatch(html,/<strong>literal/);assert.equal(initial[0].type,'paragraph');
});
test('legacy conversion keeps tables readable when all forty custom slots already contain media',()=>{
 const media=Array.from({length:40},(_,i)=>({...hint,id:'h'+i}));
 const result=editorInitialContent('| One | Two |\n| --- | --- |\n| A | B |',media);
 assert.equal(result[0].type,'paragraph');assert.equal(editorMedia(result).length,40);assert.match(JSON.stringify(result[0]),/One/);
});
test('null property defaults are rejected and legacy zero-based numbering is preserved literally',()=>{
 for(const props of [{textColor:null},{backgroundColor:null},{textAlignment:null},{level:null}])assert.throws(()=>normalizeEditorBlocks([{...text('a','heading','heading'),props}]));
 const result=editorInitialContent('0. Old zero item\n1. Old next item',[]);
 assert.equal(result[0].type,'paragraph');if(result[0].type==='paragraph')assert.equal(result[0].content[0].text,'0. Old zero item\n1. Old next item');
});
test('legacy heading anchors survive conversion and later structured saves',()=>{
 const body='Opening\n\n# Repeated\nFirst\n\n## Repeated\nSecond\n\n### Last';
 const migrated=encodeEditorBody(editorInitialContent(body,[hint]));
 assert.deepEqual(parseReaderBody(migrated).sections,[{id:'section-1',title:'Repeated',depth:1},{id:'section-2',title:'Repeated',depth:2},{id:'section-3',title:'Last',depth:3}]);
 assert.equal(encodeEditorBody(editorInitialContent(migrated,[hint])),migrated);
});
test('legacy anchor collisions retain media identity and every heading with unique stable IDs',()=>{
 const body='# First\nFirst text\n\n## Second\nSecond text';
 const media=[{...hint,id:'section-1'},{...hint,id:'legacy-1'}];
 const converted=editorInitialContent(body,media);const migrated=encodeEditorBody(converted);
 assert.deepEqual(parseReaderBody(migrated).sections,[{id:'legacy-2',title:'First',depth:1},{id:'section-2',title:'Second',depth:2}]);
 assert.deepEqual(editorMedia(converted),media);assert.equal(new Set(converted.map(block=>block.id)).size,converted.length);
 assert.match(JSON.stringify(converted),/First text/);assert.match(JSON.stringify(converted),/Second text/);
 assert.equal(encodeEditorBody(editorInitialContent(body,media)),migrated);
});
for(const [name,body] of [['new article',''],['whitespace-only legacy article',' \n\t\r\n'],['saved empty structured article','JUYU_BLOCKNOTE_V1\n[]']]){
 test(`${name} opens with one valid empty paragraph and can be saved and reopened`,()=>{
  const initial=editorInitialContent(body,[]);
  assert.equal(initial.length,1);assert.equal(initial[0].type,'paragraph');
  if(initial[0].type==='paragraph'){assert.deepEqual(initial[0].content,[]);assert.deepEqual(initial[0].children,[]);assert.deepEqual(initial[0].props,{textAlignment:'left',textColor:'default',backgroundColor:'default'});}
  const saved=encodeEditorBody(initial);assert.deepEqual(editorInitialContent(saved,[]),initial);assert.deepEqual(editorMedia(initial),[]);
 });
}
test('empty structured content ignores the legacy media projection and uses the same new-document paragraph',()=>{
 assert.deepEqual(editorInitialContent('JUYU_BLOCKNOTE_V1\n[]',[hint]),editorInitialContent('',[]));
 assert.deepEqual(editorMedia(editorInitialContent('',[hint])),[hint]);
});
