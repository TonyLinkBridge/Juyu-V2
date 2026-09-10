export type FieldType='text'|'number'|'date'|'select'|'boolean';
export interface FieldDefinition {id:string;version:number;enabled:boolean;name:string;type:FieldType;required:boolean;options:string[]}
export interface FieldSnapshot extends FieldDefinition {value:string|number|boolean|null}
export interface FieldWrite {expectedVersion:number|null;enabled:boolean;name:string;type:FieldType;required:boolean;options:string[]}
const types:FieldType[]=['text','number','date','select','boolean'];
const bad=():never=>{throw new Error('INVALID_INPUT: 自定义字段不正确，请刷新后检查字段');};
const record=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))return bad();return value as Record<string,unknown>;};
const exact=(x:Record<string,unknown>,keys:string[])=>{if(Object.keys(x).length!==keys.length||keys.some(k=>!Object.hasOwn(x,k)))bad();};
const positive=(x:unknown)=>Number.isSafeInteger(x)&&Number(x)>0&&Number(x)<2147483647;
const uuid=(x:unknown)=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(x);
function label(x:unknown):string {if(typeof x!=='string'||!x.trim()||[...x.trim()].length>80||/[\u0000-\u001f\u007f]/.test(x))return bad();return x.trim();}
function config(x:Record<string,unknown>){
 if(!types.includes(x.type as FieldType)||typeof x.required!=='boolean'||typeof x.enabled!=='boolean'||!Array.isArray(x.options))return bad();
 const options=x.options.map(label);if(x.type==='select'?(options.length<1||options.length>30||new Set(options).size!==options.length):options.length!==0)return bad();
 return {enabled:x.enabled,name:label(x.name),type:x.type as FieldType,required:x.required,options};
}
export function parseFieldWrite(value:unknown):FieldWrite {const x=record(value);exact(x,['expectedVersion','enabled','name','type','required','options']);if(x.expectedVersion!==null&&!positive(x.expectedVersion))return bad();return {expectedVersion:x.expectedVersion as number|null,...config(x)};}
function definition(x:Record<string,unknown>):FieldDefinition {if(!uuid(x.id)||!positive(x.version))return bad();const d={id:x.id as string,version:x.version as number,...config(x)};if(d.name!==x.name||JSON.stringify(d.options)!==JSON.stringify(x.options))return bad();return d;}
export function normalizeFieldDefinitions(value:unknown):FieldDefinition[]{if(!Array.isArray(value)||value.length>30)return bad();const out=value.map(item=>{const x=record(item);exact(x,['id','version','enabled','name','type','required','options']);return definition(x);});if(new Set(out.map(f=>f.id)).size!==out.length)return bad();return out;}
function primitive(d:FieldDefinition,value:unknown):FieldSnapshot['value'] {if(value===null)return null;if(d.type==='number'){if(typeof value!=='number'||!Number.isFinite(value))return bad();return value;}if(d.type==='boolean'){if(typeof value!=='boolean')return bad();return value;}if(typeof value!=='string'||[...value].length>2000||/\u0000/.test(value))return bad();return value;}
export function normalizeFieldSnapshots(value:unknown):FieldSnapshot[]{if(value===undefined)return [];if(!Array.isArray(value)||value.length>30)return bad();const out=value.map(item=>{const x=record(item);exact(x,['id','version','enabled','name','type','required','options','value']);const d=definition(x);return {...d,value:primitive(d,x.value)};});if(new Set(out.map(f=>f.id)).size!==out.length)return bad();return out;}
export function prepareFieldSnapshots(definitions:FieldDefinition[],saved:FieldSnapshot[]=[]):FieldSnapshot[]{
 const defs=normalizeFieldDefinitions(definitions),old=normalizeFieldSnapshots(saved);const byId=new Map(old.map(f=>[f.id,f]));
 return defs.flatMap(d=>{const previous=byId.get(d.id);if(!d.enabled)return previous?[previous]:[];return [{...d,value:previous?.value??null}];});
}
function realDate(value:string){if(value.startsWith('0000-'))return false;if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(`${value}T00:00:00.000Z`);return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;}
export function validateFieldSnapshots(definitions:FieldDefinition[],snapshots:unknown,previous:FieldSnapshot[]=[]):FieldSnapshot[]{
 const defs=normalizeFieldDefinitions(definitions),values=normalizeFieldSnapshots(snapshots),old=normalizeFieldSnapshots(previous);const byId=new Map(values.map(f=>[f.id,f])),oldById=new Map(old.map(f=>[f.id,f]));
 if(values.some(f=>!defs.some(d=>d.id===f.id)))return bad();
 for(const d of defs){const current=byId.get(d.id),saved=oldById.get(d.id);if(!d.enabled){if(JSON.stringify(current)!==JSON.stringify(saved))return bad();continue;}
  if(!current)return bad();if(current.version!==d.version)throw new Error('FIELD_CONFLICT: 字段设置已经变化，请刷新后重试');const {value,...metadata}=current;if(JSON.stringify(metadata)!==JSON.stringify(d))return bad();
  const missing=value===null||(typeof value==='string'&&!value.trim());if(missing){if(d.required||value!==null)return bad();continue;}
  if(d.type==='date'&&!realDate(value as string))return bad();if(d.type==='select'&&!d.options.includes(value as string))return bad();
 }
 return values;
}
