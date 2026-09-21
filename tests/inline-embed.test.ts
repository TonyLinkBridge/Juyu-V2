import assert from 'node:assert/strict';
import {test} from 'node:test';
import {inlineEmbed,inlineEmbedHref} from '../src/editor/inline-embed.ts';
import {toCanvasBlocks,fromCanvasBlocks} from '../src/editor/inline-canvas.ts';
import {normalizeInline} from '../src/editor/inline.ts';
import {encodeEditorBody,editorMedia} from '../src/editor/document.ts';
import {pdfHTML} from '../src/pdf/render.ts';

const assetId='00000000-0000-4000-8000-000000000081';
test('editing canvas renders inline embeds without changing stored paragraphs, tables or nested blocks',()=>{
 const icon={type:'link' as const,href:inlineEmbedHref({type:'icon',icon:'shield'}),content:[{type:'text' as const,text:'安全',styles:{}}]};
 const image={type:'link' as const,href:inlineEmbedHref({type:'image',assetId}),content:[{type:'text' as const,text:'验证截图',styles:{}}]};
 const formula={type:'link' as const,href:inlineEmbedHref({type:'math',source:'x^2'}),content:[{type:'text' as const,text:'公式',styles:{}}]};
 const paragraph={id:'nested',type:'paragraph' as const,props:{textAlignment:'left' as const,textColor:'default',backgroundColor:'default'},content:[icon,formula,image],children:[]};
 const table={id:'table',type:'table' as const,props:{textColor:'default'},content:{type:'tableContent' as const,columnWidths:[undefined],rows:[{cells:[{type:'tableCell' as const,props:{textColor:'default',backgroundColor:'default',textAlignment:'left' as const},content:[image]}]}]},children:[paragraph]};
 const canvas=toCanvasBlocks([table]);
 assert.equal((canvas[0] as {content:{rows:{cells:{content:{type:string}[]}[]}[]}}).content.rows[0].cells[0].content[0].type,'juyuInline');
 assert.deepEqual(fromCanvasBlocks(canvas),[table]);
});
test('legacy callout body becomes an editable nested paragraph without losing its text',()=>{
 const legacy={id:'legacy-hint',type:'juyu' as const,props:{payload:JSON.stringify({id:'legacy-hint',type:'hint',style:'info',title:'请注意',body:'先核实员工身份'})},children:[]};
 const [canvas]=toCanvasBlocks([legacy]) as {props:{payload:string};children:{type:string;content:{type:string;text:string}[]}[]}[];
 assert.equal(JSON.parse(canvas.props.payload).body,'');
 assert.equal(canvas.children[0].type,'paragraph');
 assert.deepEqual(canvas.children[0].content,[{type:'text',text:'先核实员工身份',styles:{}}]);
});
test('inline icon, formula and private image keep typed payloads',()=>{
 for(const item of [{type:'icon' as const,icon:'shield' as const},{type:'math' as const,source:'x^2+y^2'},{type:'image' as const,assetId}])assert.deepEqual(inlineEmbed(inlineEmbedHref(item)),item);
 assert.throws(()=>normalizeInline([{type:'link',href:'#juyu-image-../../secret',content:[{type:'text',text:'x',styles:{}}]}]),/INVALID_EDITOR_DOCUMENT/);
 assert.throws(()=>inlineEmbedHref({type:'math',source:'x'.repeat(351)}),/INVALID_INLINE_EMBED/);
});
test('inline image becomes a protected article asset and prints with the authorized image bytes',()=>{
 const imageHref=inlineEmbedHref({type:'image',assetId});
 const body=encodeEditorBody([{id:'line',type:'paragraph',props:{textAlignment:'left',textColor:'default',backgroundColor:'default'},content:[
  {type:'text',text:'先查看 ',styles:{}},
  {type:'link',href:inlineEmbedHref({type:'icon',icon:'shield'}),content:[{type:'text',text:'安全',styles:{}}]},
  {type:'link',href:inlineEmbedHref({type:'math',source:'x^2'}),content:[{type:'text',text:'公式',styles:{}}]},
  {type:'link',href:imageHref,content:[{type:'text',text:'验证截图',styles:{}}]},
 ],children:[]}]);
 const nodes=JSON.parse(body.slice(body.indexOf('\n')+1));
 assert.deepEqual(editorMedia(nodes),[{id:expectId(editorMedia(nodes)[0].id),type:'image',assetId,caption:'',alt:'验证截图'}]);
 const html=pdfHTML({id:'guide',title:'行内资料',revision:1,body,blocks:editorMedia(nodes)},undefined,{[assetId]:'data:image/png;base64,aGVsbG8='});
 assert.match(html,/pdf-inline-icon/);assert.match(html,/pdf-inline-math/);assert.match(html,/class="pdf-inline-image" src="data:image\/png;base64,aGVsbG8=" alt="验证截图"/);
});
function expectId(id:string){assert.match(id,/^inlineasset-[0-9a-f]{8}-1$/);return id;}
