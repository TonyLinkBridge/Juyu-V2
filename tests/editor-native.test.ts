import {nativeEditorContent} from '../src/editor/native.ts';
import {normalizeTable,tableTextGrid} from '../src/editor/table.ts';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {normalizeEditorBlocks,encodeEditorBody,decodeEditorBody,editorMedia} from '../src/editor/document.ts';
import {parseReaderBody} from '../src/reader/body.ts';
import {pdfHTML} from '../src/pdf/render.ts';
const inline=[{type:'text',text:'Native text',styles:{bold:true,textColor:'red',backgroundColor:'yellow'}},{type:'link',href:'https://example.com/docs?a=1&b=2',content:[{type:'text',text:'Linked label',styles:{italic:true}}]}];
const p=(id:string,type='paragraph',props={},content:unknown=inline,children:unknown[]=[])=>({id,type,props,content:content===null?undefined:content,children});
const aid='12345678-1234-1234-1234-123456789abc';
export const nativeSample=[p('h','heading',{level:6,isToggleable:true}),p('check','checkListItem',{checked:true}),p('toggle','toggleListItem',{},inline,[p('nested','quote')]),p('divider','divider',{},null),p('code','codeBlock',{language:'javascript'},[{type:'text',text:'const x = 1 < 2;',styles:{}}]),p('table','table',{}, {type:'tableContent',columnWidths:[120,240],headerRows:1,headerCols:0,rows:[{cells:[{type:'tableCell',props:{colspan:2,rowspan:1,textColor:'default',backgroundColor:'blue',textAlignment:'center'},content:inline}]},{cells:[[...inline],[{type:'text',text:'Cell two',styles:{}}]]}]}),...(['image','video','audio','file'] as const).map(type=>p(type,type,{url:'/api/assets/'+aid,name:'Private '+type,caption:'Caption'},null))];
test('all native structures, linked text and colors roundtrip with private asset projection',()=>{
 const body=encodeEditorBody(nativeSample);assert.equal(encodeEditorBody(decodeEditorBody(body)),body);
 assert.equal(editorMedia(decodeEditorBody(body)!).filter(b=>'assetId' in b).length,4);
 assert.deepEqual(parseReaderBody(body).sections,[{id:'h',title:'Native textLinked label',depth:6}]);
 const html=pdfHTML({id:'doc',title:'Native',revision:1,body});
 assert.match(html,/Linked label/);assert.match(html,/href="https:\/\/example.com\/docs\?a=1&amp;b=2"/);
 assert.match(html,/colspan="2"/);assert.match(html,/Cell two/);assert.match(html,/const x = 1 &lt; 2;/);assert.match(html,/Caption/);
});
test('untrusted links, media URLs, colors and malformed table spans fail closed',()=>{
 for(const href of ['javascript:alert(1)','data:text/html,x','//evil.invalid','https://user:password@example.com','java\nscript:alert(1)'])assert.throws(()=>normalizeEditorBlocks([p('a','paragraph',{},[{type:'link',href,content:[]}])]));
 for(const color of ['red; background:url(https://evil.invalid)','url(x)','expression(x)'])assert.throws(()=>normalizeEditorBlocks([p('a','paragraph',{textColor:color})]));
 for(const url of ['https://outside.invalid/a.png','/api/admin/assets/'+aid,'data:image/png;base64,aaaa'])assert.throws(()=>normalizeEditorBlocks([p('a','image',{url},null)]));
 assert.throws(()=>normalizeEditorBlocks([p('table','table',{}, {type:'tableContent',rows:[{cells:[{type:'tableCell',props:{colspan:0},content:[]}]}]})]));
});

test('native nesting retains children under custom blocks and print expands them',()=>{
 const custom={id:'custom',type:'juyu',props:{payload:JSON.stringify({id:'custom',type:'hint',title:'Hint',style:'info',body:'Parent'})},children:[p('child','paragraph',{},[{type:'text',text:'Child preserved',styles:{}}])]};
 const body=encodeEditorBody([custom]);assert.equal(decodeEditorBody(body)![0].children.length,1);assert.match(pdfHTML({id:'doc',revision:1,title:'Nested',body}),/Child preserved/);
});

test('legacy custom media upgrades only the editable copy and preserves IDs, captions and descendants',()=>{
 const media=[{id:'old-code',type:'code',language:'sql',code:'SELECT 1;'}, {id:'old-table',type:'table',headers:['费用','说明'],rows:[['10','保留']]}, {id:'old-image',type:'image',assetId:aid,alt:'图片',caption:'说明'}];
 const old=normalizeEditorBlocks(media.map(m=>({id:m.id,type:'juyu',props:{payload:JSON.stringify(m)},children:m.type==='code'?[p('nested-old')]:[]})));
 const snapshot=encodeEditorBody(old),next=nativeEditorContent(old,[]);
 assert.deepEqual(next.map(b=>b.type),['codeBlock','table','image']);
 assert.deepEqual(next.map(b=>b.id),media.map(m=>m.id));assert.equal(next[0].children[0].id,'nested-old');
 assert.equal(encodeEditorBody(old),snapshot);assert.equal(decodeEditorBody(snapshot)![0].type,'juyu');
 assert.deepEqual(editorMedia(next),[{id:'old-image',type:'image',assetId:aid,alt:'图片',caption:'说明'}]);
});
test('Reference table text projection preserves columns across row and column spans',()=>{
 const text=(text:string)=>[{type:'text',text,styles:{}}];
 const table=normalizeTable({type:'tableContent',headerRows:0,rows:[{cells:[{type:'tableCell',props:{rowspan:2},content:text('第一列')},text('第二列')]},{cells:[text('仍是第二列')]},{cells:[{type:'tableCell',props:{colspan:2},content:text('合并')}]}]});
 assert.deepEqual(tableTextGrid(table),[['第一列','第二列'],['','仍是第二列'],['合并','']]);
});

test('native table border settings survive validation and structured saves',()=>{
 const borderData=JSON.stringify({'0:0':{top:{width:2,color:'#111111'},right:null,bottom:{width:1,color:'#cc2233'},left:{width:2,color:'#111111'}}});
 const table=p('bordered-table','table',{borderData},{type:'tableContent',rows:[{cells:[[{type:'text',text:'有边框',styles:{}}]]}]});
 const [normalized]=normalizeEditorBlocks([table]);
 assert.equal(normalized.type,'table');
 if(normalized.type==='table')assert.equal(normalized.props.borderData,borderData);
 assert.equal(decodeEditorBody(encodeEditorBody([table]))?.[0].type,'table');
 assert.equal((decodeEditorBody(encodeEditorBody([table]))?.[0] as {props:{borderData:string}}).props.borderData,borderData);
});

test('native table border settings render in PDF without losing hidden edges',()=>{
 const borderData=JSON.stringify({'0:0':{top:{width:2,color:'#111111'},right:null,bottom:{width:1,color:'#cc2233'},left:{width:3,color:'#334455'}}});
 const table=p('bordered-table','table',{borderData},{type:'tableContent',rows:[{cells:[[{type:'text',text:'边框测试',styles:{}}]]}]});
 const html=pdfHTML({id:'bordered',title:'表格边框',revision:1,body:encodeEditorBody([table])});
 assert.match(html,/border-top:2px solid #111111/);
 assert.match(html,/border-right:none/);
 assert.match(html,/border-bottom:1px solid #cc2233/);
 assert.match(html,/border-left:3px solid #334455/);
});

test('native table vertical alignment survives saves and renders in PDF',()=>{
 const verticalAlignData=JSON.stringify({'0:0':'middle'});
 const table=p('aligned-table','table',{verticalAlignData},{type:'tableContent',rows:[{cells:[{type:'tableCell',props:{rowspan:2},content:[{type:'text',text:'垂直居中',styles:{}}]},[{type:'text',text:'右上',styles:{}}]]},{cells:[[{type:'text',text:'右下',styles:{}}]]}]});
 const [normalized]=normalizeEditorBlocks([table]);
 assert.equal(normalized.type,'table');
 if(normalized.type==='table')assert.equal(normalized.props.verticalAlignData,verticalAlignData);
 assert.equal((decodeEditorBody(encodeEditorBody([table]))?.[0] as {props:{verticalAlignData:string}}).props.verticalAlignData,verticalAlignData);
 assert.match(pdfHTML({id:'aligned',title:'表格垂直对齐',revision:1,body:encodeEditorBody([table])}),/vertical-align:middle/);
});

test('native numbered lists retain zero and negative starting numbers from pasted HTML',()=>{
 for(const start of [0,-3,4]){
  const body=encodeEditorBody([p('number','numberedListItem',{start})]);
  assert.match(pdfHTML({id:'doc',title:'Numbering',revision:1,body}),new RegExp('start="'+start+'"'));
 }
});

test('saved reader content preserves all palette colors and combined inline formatting',()=>{
 const colors=['gray','brown','red','orange','yellow','green','blue','purple','pink','#12ab34','rgb(12, 34, 56)'];
 const original=normalizeEditorBlocks(colors.map((textColor,index)=>p('color-'+index,'paragraph',{textAlignment:'center',backgroundColor:'blue'},[{type:'text',text:'样例 '+index,styles:{textColor,backgroundColor:'yellow',bold:true,italic:true,underline:true,strike:true}}])));
 const saved=encodeEditorBody(original);
 const read=parseReaderBody(saved).editorBlocks;
 assert.deepEqual(read,original);
 assert.deepEqual(nativeEditorContent(read!,[]),original);
 assert.equal(encodeEditorBody(nativeEditorContent(read!,[])),saved);
});

test('editable copy restores neutral black text to BlockNote default without losing authored colour contrast',()=>{
 const black='rgb(0, 0, 0)';
 const blocks=normalizeEditorBlocks([
  p('neutral','paragraph',{textColor:black,backgroundColor:'default'},[
   {type:'text',text:'普通正文',styles:{textColor:black}},
   {type:'text',text:'红色强调',styles:{textColor:'red'}},
   {type:'text',text:'有底色黑字',styles:{textColor:black,backgroundColor:'yellow'}},
  ]),
  p('table-theme','table',{textColor:black},{type:'tableContent',rows:[{cells:[
   {type:'tableCell',props:{textColor:black,backgroundColor:'default'},content:[{type:'text',text:'普通表格字',styles:{textColor:'#000000'}}]},
   {type:'tableCell',props:{textColor:black,backgroundColor:'yellow'},content:[{type:'text',text:'保留黑字',styles:{textColor:black}}]}
  ]}]})
 ]);
 const editable=nativeEditorContent(blocks,[]);
 const paragraph=editable[0];
 assert.equal(paragraph.type,'paragraph');
 if(paragraph.type!=='paragraph')return;
 assert.equal(paragraph.props.textColor,'default');
 assert.deepEqual(paragraph.content[0],{type:'text',text:'普通正文',styles:{}});
 assert.deepEqual(paragraph.content[1],{type:'text',text:'红色强调',styles:{textColor:'red'}});
 assert.deepEqual(paragraph.content[2],{type:'text',text:'有底色黑字',styles:{textColor:black,backgroundColor:'yellow'}});
 const table=editable[1];
 assert.equal(table.type,'table');
 if(table.type!=='table')return;
 assert.equal(table.props.textColor,'default');
 assert.equal(table.content.rows[0].cells[0].props.textColor,'default');
 assert.deepEqual(table.content.rows[0].cells[0].content[0],{type:'text',text:'普通表格字',styles:{}});
 assert.equal(table.content.rows[0].cells[1].props.textColor,black);
 const preserved=table.content.rows[0].cells[1].content[0];
 assert.equal(preserved.type,'text');
 if(preserved.type==='text')assert.equal(preserved.styles.textColor,black);
});
