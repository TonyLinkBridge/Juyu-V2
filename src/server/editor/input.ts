import {normalizeCategoryIds} from '../../categories/model.ts';
import {normalizeFieldSnapshots} from '../../fields/model.ts';
import {qaForKind} from '../../qa/metadata.ts';
import type {SaveDraftInput} from '../../editor/contract.ts';
import {decodeEditorBody,encodeEditorBody} from '../../editor/document.ts';
import {normalizePresentation} from '../../domain/presentation.ts';
export function editorInput(value:unknown):SaveDraftInput {
 const bad=()=>{throw new Error('INVALID_INPUT');};
 if(!value||typeof value!=='object'||Array.isArray(value))return bad();
 const x=value as Record<string,unknown>;
 const keys=['expectedSequence','title','body','kind','audience','tags','cover'];
 if(keys.some(k=>!Object.hasOwn(x,k))||Object.keys(x).some(k=>!keys.includes(k)&&k!=='qa'&&k!=='customFields'&&k!=='categoryIds'))return bad();
 if(x.expectedSequence!==null&&(!Number.isSafeInteger(x.expectedSequence)||Number(x.expectedSequence)<0))return bad();
 if(typeof x.title!=='string'||!x.title.trim()||[...x.title.trim()].length>200||/[\u0000-\u001f\u007f]/.test(x.title)||typeof x.body!=='string'||Buffer.byteLength(x.body,'utf8')>1400000)return bad();
 if(!['article','ops','reference','qa'].includes(String(x.kind))||!['staff','ops','admin'].includes(String(x.audience))||(x.kind==='ops'&&x.audience==='staff'))return bad();
 if(!Array.isArray(x.tags)||(x.cover!==null&&(!x.cover||typeof x.cover!=='object'||Array.isArray(x.cover))))return bad();
 let body:string;try{const blocks=decodeEditorBody(x.body);if(blocks===null)return bad();body=encodeEditorBody(blocks);}catch{return bad();}
 const {tags,cover}=normalizePresentation({tags:x.tags,cover:x.cover as SaveDraftInput['cover']});
 return {...(x.categoryIds===undefined?{}:{categoryIds:normalizeCategoryIds(x.categoryIds)}),...(x.customFields===undefined?{}:{customFields:normalizeFieldSnapshots(x.customFields)}),...(x.qa===undefined?{}:qaForKind(String(x.kind),x.qa)),expectedSequence:x.expectedSequence as number|null,title:x.title.trim(),body,kind:x.kind as SaveDraftInput['kind'],audience:x.audience as SaveDraftInput['audience'],tags,cover};
}
