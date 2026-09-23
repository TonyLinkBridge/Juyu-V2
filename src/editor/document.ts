import {normalizeBlocks,type MediaBlock} from '../media/model.ts';
import {invalid as bad,record,keys,boundedText,color,normalizeInline,inlineText,type EditorInline} from './inline.ts';
import {alignment,normalizeTable,normalizeTableBorderData,normalizeTableVerticalAlignData,type TableContent,type Alignment} from './table.ts';
import {inlineEmbed} from './inline-embed.ts';
export type {EditorInline,EditorStyles} from './inline.ts';
export {inlineText} from './inline.ts';
export interface EditorTextProps {textAlignment:Alignment;textColor:string;backgroundColor:string;level?:1|2|3|4|5|6;start?:number;checked?:boolean;isToggleable?:boolean;language?:string}
export type FileType='image'|'video'|'audio'|'file';
export type EditorFileProps={backgroundColor:string;textAlignment?:Alignment;name:string;url:string;caption:string;showPreview?:boolean;previewWidth?:number};
export type EditorBlock=
 |{id:string;type:'paragraph'|'heading'|'bulletListItem'|'numberedListItem'|'checkListItem'|'toggleListItem'|'quote'|'codeBlock';props:EditorTextProps;content:EditorInline[];children:EditorBlock[]}
 |{id:string;type:'table';props:{textColor:string;borderData?:string;verticalAlignData?:string};content:TableContent;children:EditorBlock[]}
 |{id:string;type:FileType;props:EditorFileProps;children:EditorBlock[]}
 |{id:string;type:'divider';props:Record<string,never>;children:EditorBlock[]}
 |{id:string;type:'juyu';props:{payload:string};children:EditorBlock[]};
export const EDITOR_BODY_PREFIX='JUYU_BLOCKNOTE_V1\n';
export const privateAssetId=(url:string)=>url.match(/^\/api\/assets\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/)?.[1];
export const isFileBlock=(b:EditorBlock):b is Extract<EditorBlock,{type:FileType}>=>['image','video','audio','file'].includes(b.type);
export function normalizeEditorBlocks(value:unknown):EditorBlock[]{
 if(!Array.isArray(value))return bad();const ids=new Set<string>();let count=0;const media:MediaBlock[]=[];
 const visit=(input:unknown,depth:number):EditorBlock=>{
  if(depth>8||++count>300)return bad();const b=record(input);keys(b,['id','type','props','content','children']);
  if(typeof b.id!=='string'||!/^[-a-zA-Z0-9]{1,64}$/.test(b.id)||ids.has(b.id))return bad();ids.add(b.id);const id=b.id;
  const child=b.children===undefined?[]:b.children;if(!Array.isArray(child))return bad();const p=record(b.props===undefined?{}:b.props);
  if(b.type==='juyu'){keys(p,['payload']);if(b.content!==undefined||typeof p.payload!=='string'||p.payload.length>250000)return bad();let raw:unknown;try{raw=JSON.parse(p.payload);}catch{return bad();}
   if(raw&&typeof raw==='object'&&!Array.isArray(raw)&&'type' in raw&&raw.type==='reusableContent'){
    const ref=record(raw);keys(ref,['id','type','familyId','version','title']);
    if(ref.id!==id||typeof ref.familyId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(ref.familyId)||!Number.isSafeInteger(ref.version)||Number(ref.version)<1||Number(ref.version)>100000||typeof ref.title!=='string'||!ref.title.trim()||ref.title.length>120||child.length<1)return bad();
    return {id,type:'juyu',props:{payload:JSON.stringify({id,type:'reusableContent',familyId:ref.familyId,version:ref.version,title:ref.title.trim()})},children:Array.from(child,c=>visit(c,depth+1))};
   }
   let m:MediaBlock;try{m=normalizeBlocks([raw])[0];}catch{return bad();}if(m.id!==id)return bad();media.push(m);return {id,type:'juyu',props:{payload:JSON.stringify(m)},children:Array.from(child,c=>visit(c,depth+1))};}
  const children=Array.from(child,c=>visit(c,depth+1));
  if(b.type==='divider'){keys(p,[]);if(b.content!==undefined)return bad();return {id,type:'divider',props:{},children};}
  if(b.type==='table'){keys(p,['textColor','borderData','verticalAlignData']);return {id,type:'table',props:{textColor:color(p.textColor===undefined?'default':p.textColor),borderData:normalizeTableBorderData(p.borderData),verticalAlignData:normalizeTableVerticalAlignData(p.verticalAlignData)},content:normalizeTable(b.content),children};}
  if(['image','video','audio','file'].includes(String(b.type))){
   const type=b.type as FileType;keys(p,['backgroundColor','name','url','caption',...(['image','video'].includes(type)?['textAlignment','previewWidth']:[]),...(type!=='file'?['showPreview']:[])]);if(b.content!==undefined)return bad();
   const url=boundedText(p.url===undefined?'':p.url,200);if(url&&!privateAssetId(url))throw new Error('PRIVATE_EDITOR_FILE_REQUIRED');
   const props:EditorFileProps={backgroundColor:color(p.backgroundColor===undefined?'default':p.backgroundColor),name:boundedText(p.name===undefined?'':p.name,200),url,caption:boundedText(p.caption===undefined?'':p.caption,500)};
   if(type==='image'||type==='video'){props.textAlignment=alignment(p.textAlignment);if(p.previewWidth!==undefined){if(typeof p.previewWidth!=='number'||!Number.isFinite(p.previewWidth)||p.previewWidth<1||p.previewWidth>10000)return bad();props.previewWidth=p.previewWidth;}}
   if(type!=='file'){if(p.showPreview!==undefined&&typeof p.showPreview!=='boolean')return bad();props.showPreview=p.showPreview===undefined?true:p.showPreview;}
   if(url)media.push({id,type,assetId:privateAssetId(url)!,caption:props.caption,alt:props.name});return {id,type,props,children};
  }
  if(!['paragraph','heading','bulletListItem','numberedListItem','checkListItem','toggleListItem','quote','codeBlock'].includes(String(b.type)))return bad();
  const type=b.type as Extract<EditorBlock,{content:EditorInline[]}>['type'];
  keys(p,type==='codeBlock'?['language']:['textAlignment','textColor','backgroundColor',...(type==='heading'?['level','isToggleable']:[]),...(type==='numberedListItem'?['start']:[]),...(type==='checkListItem'?['checked']:[])]);
  const props:EditorTextProps=type==='codeBlock'?{language:boundedText(p.language===undefined?'text':p.language,60)} as EditorTextProps:{textAlignment:alignment(p.textAlignment),textColor:color(p.textColor===undefined?'default':p.textColor),backgroundColor:color(p.backgroundColor===undefined?'default':p.backgroundColor)};
  if(type==='heading'){const level=p.level===undefined?1:p.level;if(![1,2,3,4,5,6].includes(Number(level))||typeof level!=='number')return bad();props.level=level as EditorTextProps['level'];if(p.isToggleable!==undefined){if(typeof p.isToggleable!=='boolean')return bad();props.isToggleable=p.isToggleable;}}
  if(type==='checkListItem'){if(p.checked!==undefined&&typeof p.checked!=='boolean')return bad();props.checked=p.checked===undefined?false:p.checked;}
  if(type==='numberedListItem'&&p.start!==undefined){if(!Number.isSafeInteger(p.start)||Math.abs(Number(p.start))>2147483647)return bad();props.start=Number(p.start);}
  return {id,type,props,content:normalizeInline(b.content===undefined?[]:b.content,type==='codeBlock'),children};
 };
 const result=Array.from(value,b=>visit(b,1));normalizeBlocks(media);if(EDITOR_BODY_PREFIX.length+JSON.stringify(result).length>750000)return bad();return result;
}
export function encodeEditorBody(value:unknown):string{return EDITOR_BODY_PREFIX+JSON.stringify(normalizeEditorBlocks(value));}
export function decodeEditorBody(body:string):EditorBlock[]|null{if(!body.startsWith('JUYU_BLOCKNOTE_'))return null;if(!body.startsWith(EDITOR_BODY_PREFIX)||body.length>750000)return bad();let parsed:unknown;try{parsed=JSON.parse(body.slice(EDITOR_BODY_PREFIX.length));}catch{return bad();}return normalizeEditorBlocks(parsed);}
/** Preserve asset identity and order for draft/revision ownership checks, search and PDF. */
export function editorMedia(blocks:EditorBlock[]):MediaBlock[]{
 const result:MediaBlock[]=[];let inlineIndex=0;
 const scan=(content:EditorInline[])=>{for(const item of content){if(item.type!=='link')continue;const embed=inlineEmbed(item.href);if(embed?.type==='image')result.push({id:`inlineasset-${embed.assetId.slice(0,8)}-${++inlineIndex}`,type:'image',assetId:embed.assetId,caption:'',alt:inlineText(item.content)});}};
 const visit=(nodes:EditorBlock[])=>{for(const b of nodes){
  if(b.type==='juyu'){const payload=JSON.parse(b.props.payload);if(payload.type!=='reusableContent')result.push(payload);}
  else if(isFileBlock(b)&&b.props.url)result.push({id:b.id,type:b.type,assetId:privateAssetId(b.props.url)!,caption:b.props.caption,alt:b.props.name});
  else if(b.type==='table')for(const row of b.content.rows)for(const cell of row.cells)scan(cell.content);
  else if('content' in b)scan(b.content);
  visit(b.children);
 }};visit(normalizeEditorBlocks(blocks));return normalizeBlocks(result);
}
