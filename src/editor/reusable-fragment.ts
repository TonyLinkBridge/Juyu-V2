import {editorMedia,normalizeEditorBlocks,type EditorBlock} from './document.ts';
import {blockAssetIds} from '../media/model.ts';

export interface ReusableFragment {id:string;familyId:string;version:number;title:string;blocks:EditorBlock[];createdAt:string;sourceDocumentId:string|null}
export function reusableAssetIds(blocks:EditorBlock[]):string[]{return [...new Set(editorMedia(blocks).flatMap(blockAssetIds))];}
export function reusableFragmentInput(value:unknown):{id:string;title:string;blocks:EditorBlock[]}{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('INVALID_INPUT');
 const input=value as Record<string,unknown>;
 if(Object.keys(input).some(key=>!['id','title','blocks'].includes(key)))throw new Error('INVALID_INPUT');
 if(typeof input.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(input.id))throw new Error('INVALID_INPUT');
 if(typeof input.title!=='string'||!input.title.trim()||input.title.trim().length>120)throw new Error('INVALID_INPUT');
 if(!Array.isArray(input.blocks)||input.blocks.length<1||input.blocks.length>20||JSON.stringify(input.blocks).length>100_000)throw new Error('INVALID_INPUT');
 const blocks=normalizeEditorBlocks(input.blocks);
 return {id:input.id,title:input.title.trim(),blocks};
}
/** Every insertion gets new block identities; the selected article still goes through its own review. */
export function copyReusableBlocks(blocks:EditorBlock[],newId:()=>string,assetIds:Record<string,string>={}):EditorBlock[]{
 const safe=normalizeEditorBlocks(blocks);
 for(const source of reusableAssetIds(safe))if(!assetIds[source])throw new Error('FRAGMENT_ASSET_NOT_COPIED');
 const remap=(value:unknown,key=''):unknown=>{
  if(Array.isArray(value))return value.map(item=>remap(item));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([name,item])=>[name,remap(item,name)]));
  if(typeof value!=='string')return value;
  if((key==='assetId'||key==='darkAssetId')&&assetIds[value])return assetIds[value];
  if(['url','href','body','payload'].includes(key)){let result=value;for(const [source,target] of Object.entries(assetIds))result=result.replaceAll(source,target);return result;}
  return value;
 };
 const copy=(block:EditorBlock):EditorBlock=>{const cloned=remap(block) as EditorBlock;const id=newId();if(cloned.type==='juyu'){const payload=JSON.parse(cloned.props.payload);cloned.props.payload=JSON.stringify({...payload,id});}return {...cloned,id,children:cloned.children.map(copy)} as EditorBlock;};
 return safe.map(copy);
}
export function createReusableWrapper(fragment:ReusableFragment,newId:()=>string,assetIds:Record<string,string>={}):EditorBlock {
 if(!Number.isSafeInteger(fragment.version)||fragment.version<1)throw new Error('INVALID_FRAGMENT_VERSION');
 const id=newId();
 const payload={id,type:'reusableContent',familyId:fragment.familyId,version:fragment.version,title:fragment.title};
 return {id,type:'juyu',props:{payload:JSON.stringify(payload)},children:copyReusableBlocks(fragment.blocks,newId,assetIds)};
}
export function refreshReusableWrapper(block:EditorBlock,fragment:ReusableFragment,newId:()=>string,assetIds:Record<string,string>={}):EditorBlock {
 if(block.type!=='juyu')throw new Error('INVALID_FRAGMENT_REFERENCE');
 const current:unknown=JSON.parse(block.props.payload);
 if(!current||typeof current!=='object'||!('type' in current)||current.type!=='reusableContent'||!('familyId' in current)||current.familyId!==fragment.familyId)throw new Error('INVALID_FRAGMENT_REFERENCE');
 const updated=createReusableWrapper(fragment,newId,assetIds);
 if(updated.type!=='juyu')throw new Error('INVALID_FRAGMENT_REFERENCE');
 return {...updated,id:block.id,props:{payload:JSON.stringify({...JSON.parse(updated.props.payload),id:block.id})}};
}
export function reusableReferences(blocks:EditorBlock[]):{blockId:string;familyId:string;version:number;title:string}[]{
 const result:{blockId:string;familyId:string;version:number;title:string}[]=[];
 const visit=(nodes:EditorBlock[])=>{for(const block of nodes){
  if(block.type==='juyu')try{const data=JSON.parse(block.props.payload);if(data.type==='reusableContent'&&typeof data.familyId==='string'&&Number.isSafeInteger(data.version))result.push({blockId:block.id,familyId:data.familyId,version:data.version,title:data.title});}catch{}
  visit(block.children);
 }};visit(blocks);return result;
}
