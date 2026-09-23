import {normalizeEditorBlocks,type EditorBlock,type EditorInline} from './document.ts';
import {isNeutralBlack} from './inline.ts';
import type {ManagedAsset,MediaBlock} from '../media/model.ts';

const neutralBackground=(value:string|undefined)=>!value||value==='default'||value.toLowerCase()==='transparent'||/^rgba?\(0(?:\s*,\s*0){2}\s*(?:,|\/)\s*0(?:\.0+)?%?\s*\)$/i.test(value);
function themeInline(content:EditorInline[],containerBackground:string|undefined):EditorInline[]{
 return content.map(item=>{
  if(item.type==='link')return {...item,content:themeInline(item.content,containerBackground) as Extract<EditorInline,{type:'text'}>[]};
  const styles={...item.styles};
  const effectiveBackground=neutralBackground(styles.backgroundColor)?containerBackground:styles.backgroundColor;
  if(isNeutralBlack(styles.textColor)&&neutralBackground(effectiveBackground))delete styles.textColor;
  return {...item,styles};
 });
}
/** BlockNote's native `default` text colour follows the selected light or dark theme. */
export function editorThemeDefaults(value:unknown):EditorBlock[]{
 const visit=(blocks:EditorBlock[]):EditorBlock[]=>blocks.map(block=>{
  const children=visit(block.children);
  if(block.type==='table')return {...block,props:{...block.props,textColor:isNeutralBlack(block.props.textColor)?'default':block.props.textColor},content:{...block.content,rows:block.content.rows.map(row=>({cells:row.cells.map(cell=>{
   const neutral=neutralBackground(cell.props.backgroundColor);
   return {...cell,props:{...cell.props,textColor:isNeutralBlack(cell.props.textColor)&&neutral?'default':cell.props.textColor},content:themeInline(cell.content,cell.props.backgroundColor)};
  })}))},children};
  if('content' in block){
   if(block.type==='codeBlock')return {...block,children};
   const neutral=neutralBackground(block.props.backgroundColor);
   return {...block,props:{...block.props,textColor:isNeutralBlack(block.props.textColor)&&neutral?'default':block.props.textColor},content:themeInline(block.content,block.props.backgroundColor),children};
  }
  return {...block,children};
 });
 return visit(normalizeEditorBlocks(value));
}
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
 });return editorThemeDefaults(convert(nodes));
}
