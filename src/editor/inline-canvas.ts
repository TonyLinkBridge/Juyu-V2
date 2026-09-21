import {inlineEmbed,inlineEmbedHref,type InlineEmbed} from './inline-embed.ts';
import type {EditorBlock,EditorInline} from './document.ts';

export type CanvasInline={type:'juyuInline';props:{kind:InlineEmbed['type'];value:string;label:string}};
const text=(items:{text:string}[])=>items.map(item=>item.text).join('');

export function toCanvasInline(content:EditorInline[]):(EditorInline|CanvasInline)[]{
 return content.map(item=>{
  if(item.type!=='link')return item;
  const embed=inlineEmbed(item.href);if(!embed)return item;
  return {type:'juyuInline',props:{kind:embed.type,value:embed.type==='icon'?embed.icon:embed.type==='math'?embed.source:embed.assetId,label:text(item.content)}};
 });
}

export function fromCanvasInline(content:(EditorInline|CanvasInline)[]):EditorInline[]{
 return content.map(item=>{
  if(item.type!=='juyuInline')return item;
  const {kind,value,label}=item.props;
  const embed:InlineEmbed=kind==='icon'?{type:'icon',icon:value as Extract<InlineEmbed,{type:'icon'}>['icon']}:kind==='math'?{type:'math',source:value}:{type:'image',assetId:value};
  return {type:'link',href:inlineEmbedHref(embed),content:[{type:'text',text:label,styles:{}}]};
 });
}

/** The canvas format is temporary; stored and published documents keep their original format. */
export function toCanvasBlocks(blocks:EditorBlock[]):unknown[]{
 return blocks.map(block=>{
  const children=toCanvasBlocks(block.children);
  if(block.type==='juyu'){
   try{
    const payload=JSON.parse(block.props.payload) as Record<string,unknown>;
    if(payload.type==='hint'&&typeof payload.body==='string'&&payload.body){
     const legacyBody={type:'paragraph',content:[{type:'text',text:payload.body,styles:{}}],children:[]};
     return {...block,props:{payload:JSON.stringify({...payload,body:''})},children:[legacyBody,...children]};
    }
   }catch{}
   return {...block,children};
  }
  if(block.type==='table')return {...block,content:{...block.content,rows:block.content.rows.map(row=>({cells:row.cells.map(cell=>({...cell,content:toCanvasInline(cell.content)}))}))},children};
  if('content' in block)return {...block,content:toCanvasInline(block.content),children};
  return {...block,children};
 });
}

export function fromCanvasBlocks(blocks:unknown[]):unknown[]{
 return blocks.map(value=>{
  if(!value||typeof value!=='object')return value;
  const block=value as Record<string,unknown>;const children=Array.isArray(block.children)?fromCanvasBlocks(block.children):[];
  if(block.type==='table'&&block.content&&typeof block.content==='object'){
   const table=block.content as {rows:{cells:{content:(EditorInline|CanvasInline)[]}[]}[]};
   return {...block,content:{...table,rows:table.rows.map(row=>({...row,cells:row.cells.map(cell=>({...cell,content:fromCanvasInline(cell.content)}))}))},children};
  }
  if(Array.isArray(block.content))return {...block,content:fromCanvasInline(block.content),children};
  return {...block,children};
 });
}
