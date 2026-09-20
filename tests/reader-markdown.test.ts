import assert from 'node:assert/strict';
import {test} from 'node:test';
import {encodeEditorBody} from '../src/editor/document.ts';
import {annotationHref} from '../src/editor/annotation.ts';
import {inlineEmbedHref} from '../src/editor/inline-embed.ts';
import {publicationMarkdown} from '../src/reader/markdown.ts';

test('whole-article Markdown keeps heading, marks, annotation and private image reference',()=>{
 const assetId='00000000-0000-4000-8000-000000000081';
 const body=encodeEditorBody([
  {id:'heading',type:'heading',props:{level:1},content:[{type:'text',text:'处理步骤',styles:{}}]},
  {id:'paragraph',type:'paragraph',props:{},content:[{type:'text',text:'先',styles:{}},{type:'text',text:'核验',styles:{bold:true}},{type:'link',href:annotationHref('仅限本人'),content:[{type:'text',text:'身份',styles:{}}]},{type:'link',href:inlineEmbedHref({type:'image',assetId}),content:[{type:'text',text:'身份截图',styles:{}}]}]},
  {id:'check',type:'checkListItem',props:{checked:true},content:[{type:'text',text:'确认资料',styles:{}}]},
 ]);
 const markdown=publicationMarkdown({id:'guide',title:'员工指南',description:'一句话说明',revision:1,body});
 assert.match(markdown,/^# 员工指南\n\n一句话说明\n\n## 处理步骤/m);
 assert.match(markdown,/先\*\*核验\*\*身份（注：仅限本人）!\[身份截图\]\(\/api\/assets\/00000000-0000-4000-8000-000000000081\)/);
 assert.match(markdown,/- \[x\] 确认资料/);
});
test('Markdown does not disclose the target of a reference card that needs separate permission',()=>{
 const body=encodeEditorBody([{id:'ref',type:'juyu',props:{payload:JSON.stringify({id:'ref',type:'articleReference',targetId:'restricted-guide'})}}]);
 const markdown=publicationMarkdown({id:'source',title:'来源资料',revision:1,body});
 assert.match(markdown,/引用文章（请在资料库内按权限打开）/);
 assert.doesNotMatch(markdown,/restricted-guide/);
});
test('legacy Markdown remains readable and media appears after it',()=>{
 const markdown=publicationMarkdown({id:'old',title:'旧版资料',revision:1,body:'原有文字\n\n- 第一步',blocks:[{id:'button',type:'button',label:'填写表单',href:'/help-centre/forms',variant:'primary'}]});
 assert.match(markdown,/# 旧版资料[\s\S]*原有文字[\s\S]*- 第一步[\s\S]*\[填写表单\]\(\/help-centre\/forms\)/);
});
