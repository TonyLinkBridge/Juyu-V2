import type {QaMetadata} from './model.ts';
export function normalizeQa(value:unknown):QaMetadata {
 if(value===undefined)return {category:'',position:0};
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('INVALID_INPUT');
 const x=value as Record<string,unknown>;
 if(Object.keys(x).length!==2||!Object.hasOwn(x,'category')||!Object.hasOwn(x,'position')||typeof x.category!=='string'||/[\u0000-\u001f\u007f-\u009f]/u.test(x.category)||[...x.category.trim()].length>80||!Number.isSafeInteger(x.position)||Number(x.position)<0||Number(x.position)>999999)throw new Error('INVALID_INPUT');
 return {category:x.category.trim(),position:Number(x.position)};
}
export function qaForKind(kind:string,value:unknown):{qa?:QaMetadata}{
 const qa=normalizeQa(value);
 if(kind==='qa')return {qa};
 if(qa.category!==''||qa.position!==0)throw new Error('INVALID_INPUT');
 return {};
}
