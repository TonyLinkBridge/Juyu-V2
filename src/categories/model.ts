import {readerIconKey,type ReaderIconKey} from '../reader/icon-keys.ts';
export interface CategoryDefinition {id:string;version:number;name:string;englishName?:string|null;parentId:string|null;position:number;audience:'staff'|'ops'|'admin';enabled:boolean;iconKey?:ReaderIconKey|null}
export type CategoryWrite=Omit<CategoryDefinition,'id'|'version'>&{expectedVersion:number|null};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function bad():never{throw new Error('INVALID_INPUT');}
function config(value:unknown):Omit<CategoryDefinition,'id'|'version'>{
 if(!value||typeof value!=='object'||Array.isArray(value))return bad();const x=value as Record<string,unknown>;
 if(Object.keys(x).length!==5||!['name','parentId','position','audience','enabled'].every(k=>Object.hasOwn(x,k)))return bad();
 if(typeof x.name!=='string'||!x.name.trim()||[...x.name.trim()].length>120||/[\u0000-\u001f\u007f-\u009f]/.test(x.name)||(x.parentId!==null&&(typeof x.parentId!=='string'||!uuid.test(x.parentId)))||!Number.isSafeInteger(x.position)||Number(x.position)<0||Number(x.position)>999999||!['staff','ops','admin'].includes(String(x.audience))||typeof x.enabled!=='boolean')return bad();
 return {name:x.name.trim(),parentId:x.parentId as string|null,position:Number(x.position),audience:x.audience as CategoryDefinition['audience'],enabled:x.enabled};
}
export function parseCategoryWrite(value:unknown):CategoryWrite{
 if(!value||typeof value!=='object'||Array.isArray(value))return bad();const {expectedVersion,iconKey,englishName,...rest}=value as Record<string,unknown>;
 if(iconKey!==undefined&&iconKey!==null&&readerIconKey(iconKey)===null)return bad();
 if(englishName!==undefined&&englishName!==null&&(typeof englishName!=='string'||englishName.trim().length>120||/[\u0000-\u001f\u007f-\u009f]/.test(englishName)))return bad();
 if(expectedVersion!==null&&(!Number.isSafeInteger(expectedVersion)||Number(expectedVersion)<1||Number(expectedVersion)>=2147483647))return bad();return {...config(rest),expectedVersion:expectedVersion as number|null,...(iconKey===undefined?{}:{iconKey:iconKey as ReaderIconKey|null}),...(englishName===undefined?{}:{englishName:typeof englishName==='string'?englishName.trim()||null:null})};
}
export function normalizeCategoryDefinitions(value:unknown):CategoryDefinition[]{
 if(!Array.isArray(value)||value.length>100)return bad();const seen=new Set<string>();
 return value.map(item=>{if(!item||typeof item!=='object'||Array.isArray(item))return bad();const {id,version,iconKey,englishName,...rest}=item as Record<string,unknown>;
 if(iconKey!==undefined&&iconKey!==null&&readerIconKey(iconKey)===null)return bad();
 if(englishName!==undefined&&englishName!==null&&(typeof englishName!=='string'||!englishName.trim()||englishName.trim()!==englishName||englishName.length>120||/[\u0000-\u001f\u007f-\u009f]/.test(englishName)))return bad();
 if(typeof id!=='string'||!uuid.test(id)||seen.has(id)||!Number.isSafeInteger(version)||Number(version)<1||Number(version)>=2147483647)return bad();const normalized=config(rest);if(normalized.name!==rest.name)return bad();seen.add(id);return {id,version:Number(version),...normalized,...(iconKey===undefined?{}:{iconKey:iconKey as ReaderIconKey|null}),...(englishName===undefined?{}:{englishName:englishName as string|null})};}).sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id));
}
export function normalizeCategoryIds(value:unknown):string[]{
 if(value===undefined)return [];if(!Array.isArray(value)||value.length>20||value.some(id=>typeof id!=='string'||!uuid.test(id))||new Set(value).size!==value.length)return bad();return [...value].sort();
}
export function categoryPath(definitions:CategoryDefinition[],id:string):string{
 const names:string[]=[],seen=new Set<string>();let current=definitions.find(c=>c.id===id);
 while(current&&!seen.has(current.id)){seen.add(current.id);names.unshift(current.name);current=definitions.find(c=>c.id===current!.parentId);}return names.join(' / ');
}
