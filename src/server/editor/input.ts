import {normalizeCategoryIds} from '../../categories/model.ts';
import {normalizeFieldSnapshots} from '../../fields/model.ts';
import {qaForKind} from '../../qa/metadata.ts';
import type {SaveDraftInput} from '../../editor/contract.ts';
import {decodeEditorBody,encodeEditorBody} from '../../editor/document.ts';
import {normalizeDescription,normalizeReleaseNote,normalizePresentation} from '../../domain/presentation.ts';
export function editorInput(value:unknown):SaveDraftInput {
 const bad=()=>{throw new Error('INVALID_INPUT');};
 const invalid=(code:string):never=>{throw new Error(code);};
 if(!value||typeof value!=='object'||Array.isArray(value))return bad();
 const x=value as Record<string,unknown>;
 const keys=['expectedSequence','title','body','kind','audience','tags','cover'];
 if(keys.some(k=>!Object.hasOwn(x,k))||Object.keys(x).some(k=>!keys.includes(k)&&k!=='qa'&&k!=='customFields'&&k!=='categoryIds'&&k!=='iconKey'&&k!=='description'&&k!=='releaseNote'&&k!=='locale'&&k!=='translationOf'))return bad();
 if(x.expectedSequence!==null&&(!Number.isSafeInteger(x.expectedSequence)||Number(x.expectedSequence)<0))return bad();
 if(typeof x.title!=='string'||!x.title.trim()||[...x.title.trim()].length>200||/[\u0000-\u001f\u007f]/.test(x.title))return invalid('INVALID_TITLE');
 const locale=x.locale===undefined?'zh-CN':x.locale;
 const translationOf=x.translationOf===undefined?null:x.translationOf;
 if((locale!=='zh-CN'&&locale!=='en')||(locale==='zh-CN'&&translationOf!==null)||(locale==='en'&&(typeof translationOf!=='string'||!translationOf.trim()||translationOf.length>200)))return invalid('INVALID_LOCALE');
 let description:string;try{description=normalizeDescription(x.description);}catch{return invalid('INVALID_DESCRIPTION');}
 let releaseNote:string;try{releaseNote=normalizeReleaseNote(x.releaseNote);}catch{return invalid('INVALID_RELEASE_NOTE');}
 if(typeof x.body!=='string'||Buffer.byteLength(x.body,'utf8')>1400000)return invalid('INVALID_BODY');
 if(!['article','ops','reference','qa'].includes(String(x.kind))||!['staff','ops','admin'].includes(String(x.audience))||(x.kind==='ops'&&x.audience==='staff'))return bad();
 if(!Array.isArray(x.tags)||(x.cover!==null&&(!x.cover||typeof x.cover!=='object'||Array.isArray(x.cover))))return invalid('INVALID_PRESENTATION');
 let body:string;try{const blocks=decodeEditorBody(x.body);if(blocks===null)return invalid('INVALID_BODY');body=encodeEditorBody(blocks);}catch{return invalid('INVALID_BODY');}
 const {tags,cover,iconKey}=normalizePresentation({tags:x.tags,cover:x.cover as SaveDraftInput['cover'],...(x.iconKey===undefined?{}:{iconKey:x.iconKey as SaveDraftInput['iconKey']})});
 if(x.kind==='qa'&&tags.length>5)return invalid('INVALID_QA');
 let categoryIds:ReturnType<typeof normalizeCategoryIds>|undefined,customFields:ReturnType<typeof normalizeFieldSnapshots>|undefined,qa:ReturnType<typeof qaForKind>={};
 try{if(x.categoryIds!==undefined)categoryIds=normalizeCategoryIds(x.categoryIds);}catch{return invalid('INVALID_CATEGORY');}
 try{if(x.customFields!==undefined)customFields=normalizeFieldSnapshots(x.customFields);}catch{return invalid('INVALID_FIELDS');}
 try{if(x.qa!==undefined)qa=qaForKind(String(x.kind),x.qa);}catch{return invalid('INVALID_QA');}
 return {locale,translationOf:translationOf as string|null,...(categoryIds===undefined?{}:{categoryIds}),...(customFields===undefined?{}:{customFields}),...qa,...(iconKey===undefined?{}:{iconKey}),expectedSequence:x.expectedSequence as number|null,title:x.title.trim(),description,releaseNote,body,kind:x.kind as SaveDraftInput['kind'],audience:x.audience as SaveDraftInput['audience'],tags,cover};
}
