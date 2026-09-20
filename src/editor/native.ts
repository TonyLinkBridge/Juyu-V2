import {normalizeEditorBlocks,type EditorBlock} from './document.ts';
import type {ManagedAsset,MediaBlock} from '../media/model.ts';
/** Upgrade only the editable copy. Saved and published revisions remain immutable. */
export function nativeEditorContent(nodes:EditorBlock[],assets:ManagedAsset[]):EditorBlock[]{
 const convert=(nodes:EditorBlock[]):unknown[]=>nodes.map(b=>{
  if(b.type!=='juyu')return {...b,children:convert(b.children)};
  const m=JSON.parse(b.props.payload) as MediaBlock;
  if((m.type==='image'&&!m.darkAssetId)||(m.type==='video'||m.type==='audio'||m.type==='file'))return {id:b.id,type:m.type,props:{url:'/api/assets/'+m.assetId,name:m.alt||assets.find(a=>a.id===m.assetId)?.filename||'',caption:m.caption},children:convert(b.children)};
  if(m.type==='code'){
   if(m.title||m.lineNumbers!==undefined||m.wrap!==undefined||m.expandable!==undefined||m.collapsedLines!==undefined)return b;
   return {id:b.id,type:'codeBlock',props:{language:m.language||'text'},content:[{type:'text',text:m.code,styles:{}}],children:convert(b.children)};
  }
  if(m.type==='table'){
   if(m.view||m.searchable!==undefined||m.stickyHeader||m.stickyFirstColumn)return b;
   return {id:b.id,type:'table',props:{},content:{type:'tableContent',headerRows:1,rows:[m.headers,...m.rows].map(row=>({cells:row.map(text=>[{type:'text',text,styles:{}}])}))},children:convert(b.children)};
  }
  return b;
 });return normalizeEditorBlocks(convert(nodes));
}
