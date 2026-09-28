import assert from 'node:assert/strict';
import test from 'node:test';
import {encodeEditorBody,type EditorBlock} from '../src/editor/document.ts';
import {publicationDescription} from '../src/reader/body.ts';

const props={textAlignment:'left' as const,textColor:'default',backgroundColor:'default'};

test('published description keeps an explicit summary',()=>{
 assert.equal(publicationDescription('正文内容','后台摘要'),'后台摘要');
});

test('published description uses the first existing paragraph when the summary is empty',()=>{
 const blocks:EditorBlock[]=[
  {id:'heading',type:'heading',props:{...props,level:2},content:[{type:'text',text:'一、标题',styles:{}}],children:[]},
  {id:'paragraph',type:'paragraph',props,content:[{type:'text',text:'这是正文已经写好的第一段。',styles:{}}],children:[]},
  {id:'later',type:'paragraph',props,content:[{type:'text',text:'第二段不应取代第一段。',styles:{}}],children:[]},
 ];
 assert.equal(publicationDescription(encodeEditorBody(blocks),''),'这是正文已经写好的第一段。');
 assert.equal(publicationDescription('# 标题\n\n这是旧版正文第一段。\n\n第二段。'),'这是旧版正文第一段。');
});

test('published description remains absent when the article has no paragraph',()=>{
 const blocks:EditorBlock[]=[{id:'heading',type:'heading',props:{...props,level:2},content:[{type:'text',text:'只有标题',styles:{}}],children:[]}];
 assert.equal(publicationDescription(encodeEditorBody(blocks),''),undefined);
});
