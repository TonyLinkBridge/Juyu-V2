import assert from 'node:assert/strict';
import {test} from 'node:test';
import {annotationHref,annotationText} from '../src/editor/annotation.ts';
import {encodeEditorBody} from '../src/editor/document.ts';
import {pdfHTML} from '../src/pdf/render.ts';

test('inline annotation keeps Chinese text and refuses malformed or oversized notes',()=>{
 const href=annotationHref('给员工看的补充说明');
 assert.equal(annotationText(href),'给员工看的补充说明');
 assert.equal(annotationText('#other-anchor'),null);
 assert.equal(annotationText('#juyu-note-%%%'),null);
 assert.throws(()=>annotationHref(' '),/INVALID_ANNOTATION/);
 assert.throws(()=>annotationHref('字'.repeat(501)),/INVALID_ANNOTATION/);
});

test('inline annotation survives published body and expands safely in PDF',()=>{
 const body=encodeEditorBody([{id:'line',type:'paragraph',props:{textAlignment:'left',textColor:'default',backgroundColor:'default'},content:[{type:'text',text:'办理前请',styles:{}},{type:'link',href:annotationHref('只适用于已核验的账户 <script>'),content:[{type:'text',text:'确认身份',styles:{bold:true}}]}],children:[]}]);
 const html=pdfHTML({id:'guide',title:'处理说明',revision:1,body,blocks:[]});
 assert.match(html,/<strong>确认身份<\/strong>（注：只适用于已核验的账户 &lt;script&gt;）/);
 assert.doesNotMatch(html,/<script>/);
});
