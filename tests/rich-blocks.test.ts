import assert from 'node:assert/strict';
import {test} from 'node:test';
import {blockAssetIds,normalizeBlocks,type MediaBlock} from '../src/media/model.ts';
import {pdfHTML} from '../src/pdf/render.ts';
import {encodeEditorBody} from '../src/editor/document.ts';
import {decodeTabBody,encodeTabBody} from '../src/media/tab-body.ts';
import {codeLineNumbers} from '../src/media/code-lines.ts';
import {buildNavigationTree} from '../src/reader/tree.ts';
test('ordered steps preserve rich content and appear completely in PDF',()=>{
 const rich=encodeTabBody([{id:'step-line',type:'paragraph',props:{textAlignment:'left',textColor:'default',backgroundColor:'default'},content:[{type:'text',text:'确认身份',styles:{bold:true}}],children:[]}]);
 const steps:Extract<MediaBlock,{type:'steps'}>={id:'steps-one',type:'steps',steps:[{id:'one',title:'核对资料',body:rich},{id:'two',title:'提交结果',body:'保留回执 <script>'}]};
 assert.deepEqual(normalizeBlocks([steps]),[steps]);
 const html=pdfHTML({id:'guide',title:'办理步骤',revision:1,body:'',blocks:[steps]});
 assert.match(html,/<ol class="pdf-steps">[\s\S]*核对资料[\s\S]*<strong>确认身份<\/strong>[\s\S]*提交结果[\s\S]*&lt;script&gt;[\s\S]*<\/ol>/);
 for(const value of [{...steps,steps:[]},{...steps,steps:[steps.steps[0],{...steps.steps[1],id:'one'}]},{...steps,steps:[{...steps.steps[0],body:'a'.repeat(20001)}]}])assert.throws(()=>normalizeBlocks([value]),/INVALID_MEDIA/);
});
test('two or three columns preserve every body in PDF and reject malformed layouts',()=>{
 const columns:Extract<MediaBlock,{type:'columns'}>={id:'columns-one',type:'columns',columns:[{id:'left',title:'条件',body:'核对账号'},{id:'right',title:'处理',body:'提交工单'}]};
 assert.deepEqual(normalizeBlocks([columns]),[columns]);
 const html=pdfHTML({id:'guide',title:'双栏',revision:1,body:'',blocks:[columns]});
 assert.match(html,/<div class="pdf-columns">[\s\S]*条件[\s\S]*核对账号[\s\S]*处理[\s\S]*提交工单[\s\S]*<\/div>/);
 for(const bad of [{...columns,columns:[columns.columns[0]]},{...columns,columns:[...columns.columns,...columns.columns]},{...columns,columns:[columns.columns[0],{...columns.columns[1],id:'left'}]}])assert.throws(()=>normalizeBlocks([bad]),/INVALID_MEDIA/);
});
const blocks=[{id:'hint',type:'hint',style:'warning',title:'先核实',body:'中文\n不可遗漏'}, {id:'code',type:'code',language:'html',code:'<script>alert(1)</script>\n  保留空格\n'}, {id:'tabs',type:'tabs',tabs:[{id:'one',title:'注册',body:'注册步骤'},{id:'two',title:'转入',body:'转入步骤'}]}];
test('T028 rich blocks preserve literal text, order and independent tab identity',()=>{
 assert.deepEqual(normalizeBlocks(blocks),blocks);const copy=normalizeBlocks(blocks);assert.notEqual(copy[2],blocks[2]);assert.deepEqual(normalizeBlocks([{...blocks[2],tabs:[{id:'one',title:'同名',body:'甲'},{id:'two',title:'同名',body:'乙'}]}])[0].type,'tabs');
});
test('T028 invalid styles, oversized content, nested payloads and duplicate tab IDs fail closed',()=>{
 for(const value of [[{...blocks[0],style:'script'}],[{...blocks[0],body:'字'.repeat(20001)}],[{...blocks[1],code:'x'.repeat(50001)}],[{...blocks[1],language:'<script>'}],[{...blocks[2],tabs:[]}],[{...blocks[2],tabs:[{id:'one',title:'A',body:'A'},{id:'one',title:'B',body:'B'}]}],[{...blocks[2],tabs:[{id:'one',title:'A',body:'A',blocks:[{type:'file',assetId:'forged'}]}]}]])assert.throws(()=>normalizeBlocks(value),/INVALID_MEDIA/);
});
test('T028 PDF includes every tab and literal escaped code, without interactive-only content',()=>{
 const html=pdfHTML({id:'rich',title:'内容',revision:1,body:'',blocks:normalizeBlocks(blocks)});assert.match(html,/先核实/);assert.match(html,/注册步骤/);assert.match(html,/转入步骤/);assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);assert.doesNotMatch(html,/<script>|role="tab"|hidden/);
});
test('advanced code settings survive validation and print without interactive collapse',()=>{
 const code={id:'example',type:'code',language:'json',code:'{\n  "ok": true\n}',title:'config.json',lineNumbers:true,wrap:true,expandable:true,collapsedLines:2};
 assert.deepEqual(normalizeBlocks([code]),[code]);
 const html=pdfHTML({id:'code-example',title:'示例',revision:1,body:'',blocks:normalizeBlocks([code])});
 assert.match(html,/config\.json/);assert.match(html,/1  \{/);assert.match(html,/2    &quot;ok&quot;: true/);assert.doesNotMatch(html,/展开全部/);
 for(const invalid of [{collapsedLines:1},{collapsedLines:41},{wrap:'yes'},{title:'a'.repeat(121)}])assert.throws(()=>normalizeBlocks([{...code,...invalid}]),/INVALID_MEDIA/);
});
test('code line emphasis and diff markers survive validation and PDF output',()=>{
 const code:Extract<MediaBlock,{type:'code'}>={id:'diff',type:'code',language:'text',code:'保留\n新增\n移除\n重点',lineNumbers:true,highlightLines:'4',addedLines:'2',removedLines:'3'};
 assert.deepEqual(normalizeBlocks([code]),[code]);
 assert.deepEqual([...codeLineNumbers('1,3-5')],[1,3,4,5]);
 const html=pdfHTML({id:'diff',title:'差异',revision:1,body:'',blocks:[code]});
 assert.match(html,/pdf-code-added[^>]*>  2  新增/);
 assert.match(html,/pdf-code-removed[^>]*>  3  移除/);
 assert.match(html,/pdf-code-highlighted[^>]*>  4  重点/);
 assert.throws(()=>normalizeBlocks([{...code,addedLines:'<script>'}]),/INVALID_MEDIA/);
});
test('article reference stores only a target ID and PDF does not reveal a restricted title',()=>{
 const reference:MediaBlock={id:'internal-link',type:'articleReference',targetId:'target-guide'};
 assert.deepEqual(normalizeBlocks([reference]),[reference]);
 assert.throws(()=>normalizeBlocks([{...reference,targetId:'../secret'}]),/INVALID_MEDIA/);
 assert.throws(()=>normalizeBlocks([{...reference,targetId:'target-guide',title:'未经授权的标题'}]),/INVALID_MEDIA/);
 const html=pdfHTML({id:'source',title:'来源文章',revision:1,body:'',blocks:[reference]});
 assert.match(html,/这处引用请在资料库内按当前权限查看/);
 assert.doesNotMatch(html,/target-guide/);
 const pages=buildNavigationTree([{id:'source',title:'来源文章'},{id:'target-guide',title:'仅授权者可见',description:'受权限保护的简介'}],[],[]);
 const target=pages.find(page=>page.type==='document'&&page.id==='target-guide');
 assert.ok(target?.type==='document');
 assert.equal(target.description,'受权限保护的简介');
});
test('in-content action button keeps a safe link in reader and PDF',()=>{
 const button:MediaBlock={id:'next',type:'button',label:'查看申请表',href:'/help-centre/forms',variant:'primary'};
 assert.deepEqual(normalizeBlocks([button]),[button]);
 const html=pdfHTML({id:'action',title:'操作',revision:1,body:'',blocks:[button]});
 assert.match(html,/href="\/help-centre\/forms">查看申请表/);
 for(const href of ['javascript:alert(1)','//evil.example','https://user:secret@example.com'])assert.throws(()=>normalizeBlocks([{...button,href}]),/INVALID_MEDIA/);
 assert.throws(()=>normalizeBlocks([{...button,label:''}]),/INVALID_MEDIA/);
});
test('hint keeps a validated custom icon and prints nested formatted links inside the callout',()=>{
 const hint:Extract<MediaBlock,{type:'hint'}>={id:'hint',type:'hint',style:'warning',title:'操作前核对',body:'',iconKey:'shield'};
 assert.deepEqual(normalizeBlocks([hint]),[hint]);
 assert.throws(()=>normalizeBlocks([{...hint,iconKey:'<script>'}]),/INVALID_MEDIA/);
 const body=encodeEditorBody([{id:'hint',type:'juyu',props:{payload:JSON.stringify(hint)},children:[{id:'line',type:'paragraph',props:{textAlignment:'left',textColor:'default',backgroundColor:'default'},content:[{type:'text',text:'先核实',styles:{bold:true}},{type:'link',href:'https://example.com/help',content:[{type:'text',text:'处理规则',styles:{}}]}],children:[]}]}]);
 const html=pdfHTML({id:'rich-hint',title:'提示框',revision:1,body,blocks:[]});
 assert.match(html,/<aside class="pdf-hint"[\s\S]*<strong>操作前核对<\/strong>[\s\S]*<strong>先核实<\/strong>[\s\S]*href="https:\/\/example.com\/help"[\s\S]*<\/aside>/);
 const hidden={...hint,showTitle:false};assert.deepEqual(normalizeBlocks([hidden]),[hidden]);
 const hiddenHTML=pdfHTML({id:'hidden-hint',title:'隐藏标题',revision:1,body:'',blocks:[hidden]});assert.doesNotMatch(hiddenHTML,/操作前核对/);
});
test('tabs accept only known decorative icons while retaining stable tab identities',()=>{
 const richTabs={id:'tabs',type:'tabs',tabs:[{id:'one',title:'注册',body:'步骤',iconKey:'book'},{id:'two',title:'转入',body:'说明',iconKey:null}]};
 assert.deepEqual(normalizeBlocks([richTabs]),[richTabs]);
 assert.throws(()=>normalizeBlocks([{...richTabs,tabs:[{...richTabs.tabs[0],iconKey:'<script>'}]}]),/INVALID_MEDIA/);
});
test('tab body retains native text marks, links and private images while rejecting external files and custom media',()=>{
 const content=[{id:'tab-line',type:'paragraph',props:{textAlignment:'left',textColor:'default',backgroundColor:'default'},content:[{type:'text',text:'先核实',styles:{bold:true}},{type:'link',href:'https://example.com/rule',content:[{type:'text',text:'规则',styles:{}}]}],children:[]}];
 const body=encodeTabBody(content);
 assert.deepEqual(decodeTabBody(body),content);
 assert.deepEqual(normalizeBlocks([{id:'tabs',type:'tabs',tabs:[{id:'one',title:'操作',body}]}])[0].type,'tabs');
 assert.throws(()=>encodeTabBody([{id:'unsafe',type:'juyu',props:{payload:'{}'},children:[]}]),/INVALID_MEDIA/);
 const imageId='00000000-0000-4000-8000-000000000001';
 const imageBody=encodeTabBody([{id:'private-image',type:'image',props:{url:`/api/assets/${imageId}`,name:'截图'},children:[]}]);
 assert.deepEqual(blockAssetIds(normalizeBlocks([{id:'with-image',type:'tabs',tabs:[{id:'one',title:'截图',body:imageBody}]}])[0]),[imageId]);
 const columns:Extract<MediaBlock,{type:'columns'}>={id:'picture-columns',type:'columns',columns:[{id:'left',title:'说明',body:'左栏说明'},{id:'right',title:'截图',body:imageBody}]};
 assert.match(pdfHTML({id:'picture-guide',title:'图文对照',revision:1,body:'',blocks:[columns]},undefined,{[imageId]:'data:image/png;base64,aGVsbG8='}),/pdf-columns[\s\S]*data:image\/png;base64,aGVsbG8=/);
 assert.throws(()=>encodeTabBody([{id:'unsafe',type:'image',props:{url:'https://example.com/external.png'},children:[]}]),/PRIVATE_EDITOR_FILE_REQUIRED|INVALID_MEDIA/);
 assert.throws(()=>encodeTabBody([{id:'unsafe',type:'file',props:{url:`/api/assets/${imageId}`},children:[]}]),/INVALID_MEDIA/);
 const html=pdfHTML({id:'tab-rich',title:'排版标签',revision:1,body:'',blocks:normalizeBlocks([{id:'tabs',type:'tabs',tabs:[{id:'one',title:'操作',body},{id:'two',title:'说明',body:'原来的文字仍保留'}]}])});
 assert.match(html,/<section class="pdf-tabs">[\s\S]*<strong>先核实<\/strong>[\s\S]*href="https:\/\/example.com\/rule"[\s\S]*原来的文字仍保留/);
 assert.doesNotMatch(html,/JUYU_TAB_BLOCKNOTE_V1/);
});
