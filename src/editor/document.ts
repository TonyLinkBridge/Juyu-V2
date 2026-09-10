import {normalizeBlocks,type MediaBlock} from '../media/model.ts';
export type EditorStyles=Partial<Record<'bold'|'italic'|'underline'|'strike'|'code',boolean>>;
export interface EditorInline {type:'text';text:string;styles:EditorStyles}
export interface EditorTextProps {textAlignment:'left'|'center'|'right'|'justify';textColor:'default';backgroundColor:'default';level?:1|2|3;start?:number}
export type EditorBlock={id:string;type:'paragraph'|'heading'|'bulletListItem'|'numberedListItem';props:EditorTextProps;content:EditorInline[];children:EditorBlock[]}|{id:string;type:'juyu';props:{payload:string};children:[]};
export const EDITOR_BODY_PREFIX='JUYU_BLOCKNOTE_V1\n';
const bad=():never=>{throw new Error('INVALID_EDITOR_DOCUMENT');};
const record=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))return bad();return value as Record<string,unknown>;};
const keys=(value:Record<string,unknown>,allowed:string[])=>{if(Object.keys(value).some(key=>!allowed.includes(key)))bad();};
/** Validate the complete tree before it is saved or rendered. No HTML, URLs or external block types are interpreted. */
export function normalizeEditorBlocks(value:unknown):EditorBlock[]{
 if(!Array.isArray(value))return bad();
 const ids=new Set<string>();let count=0;const media:MediaBlock[]=[];
 const visit=(input:unknown,depth:number):EditorBlock=>{
  if(depth>8||++count>300)return bad();const block=record(input);keys(block,['id','type','props','content','children']);
  if(typeof block.id!=='string'||!/^[-a-zA-Z0-9]{1,64}$/.test(block.id)||ids.has(block.id))return bad();ids.add(block.id);
  const children=block.children===undefined?[]:block.children;if(!Array.isArray(children))return bad();const props=record(block.props===undefined?{}:block.props);
  if(block.type==='juyu'){
   keys(props,['payload']);if('content' in block||children.length||typeof props.payload!=='string'||props.payload.length>250000)return bad();
   let normalized:MediaBlock;try{normalized=normalizeBlocks([JSON.parse(props.payload)])[0];}catch{return bad();}
   if(normalized.id!==block.id)return bad();media.push(normalized);if(media.length>40)return bad();
   return {id:block.id,type:'juyu',props:{payload:JSON.stringify(normalized)},children:[]};
  }
  if(typeof block.type!=='string'||!['paragraph','heading','bulletListItem','numberedListItem'].includes(block.type))return bad();
  keys(props,['textAlignment','textColor','backgroundColor',...(block.type==='heading'?['level']:[]),...(block.type==='numberedListItem'?['start']:[])]);
  const alignment=props.textAlignment===undefined?'left':props.textAlignment;if(typeof alignment!=='string'||!['left','center','right','justify'].includes(alignment)||(props.textColor!==undefined&&props.textColor!=='default')||(props.backgroundColor!==undefined&&props.backgroundColor!=='default'))return bad();
  const normalizedProps:EditorTextProps={textAlignment:alignment as EditorTextProps['textAlignment'],textColor:'default',backgroundColor:'default'};
  if(block.type==='heading'){const level=props.level===undefined?1:props.level;if(level!==1&&level!==2&&level!==3)return bad();normalizedProps.level=level;}
  if(block.type==='numberedListItem'&&props.start!==undefined){if(!Number.isSafeInteger(props.start)||Number(props.start)<1)return bad();normalizedProps.start=Number(props.start);}
  const inlines=block.content===undefined?[]:block.content;if(!Array.isArray(inlines))return bad();
  const content=Array.from(inlines,value=>{
   const inline=record(value);keys(inline,['type','text','styles']);if(inline.type!=='text'||typeof inline.text!=='string'||inline.text.length>50000||inline.text.includes('\0'))return bad();
   const styles=record(inline.styles===undefined?{}:inline.styles);keys(styles,['bold','italic','underline','strike','code']);const normalizedStyles:EditorStyles={};
   for(const [key,mark] of Object.entries(styles)){if(typeof mark!=='boolean')return bad();normalizedStyles[key as keyof EditorStyles]=mark;}
   return {type:'text' as const,text:inline.text,styles:normalizedStyles};
  });
  return {id:block.id,type:block.type as Exclude<EditorBlock['type'],'juyu'>,props:normalizedProps,content,children:Array.from(children,child=>visit(child,depth+1))};
 };
 const result=Array.from(value,block=>visit(block,1));
 try{normalizeBlocks(media);}catch{return bad();}
 if(EDITOR_BODY_PREFIX.length+JSON.stringify(result).length>750000)return bad();return result;
}
export function encodeEditorBody(value:unknown):string{return EDITOR_BODY_PREFIX+JSON.stringify(normalizeEditorBlocks(value));}
export function decodeEditorBody(body:string):EditorBlock[]|null{
 if(!body.startsWith('JUYU_BLOCKNOTE_'))return null;
 if(!body.startsWith(EDITOR_BODY_PREFIX)||body.length>750000)return bad();
 let parsed:unknown;try{parsed=JSON.parse(body.slice(EDITOR_BODY_PREFIX.length));}catch{return bad();}return normalizeEditorBlocks(parsed);
}
/** Preserve traversal order for private asset authorization, diagram rendering and PDF export. */
export function editorMedia(blocks:EditorBlock[]):MediaBlock[]{
 const media:MediaBlock[]=[];const visit=(nodes:EditorBlock[])=>{for(const node of nodes){if(node.type==='juyu')media.push(JSON.parse(node.props.payload) as MediaBlock);visit(node.children);}};visit(normalizeEditorBlocks(blocks));return normalizeBlocks(media);
}
