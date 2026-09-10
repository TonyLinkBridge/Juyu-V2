import {normalizeForms,parseFormWrite,type FormDefinition,type FormWrite} from './model.ts';
import {normalizeFieldDefinitions,type FieldDefinition} from '../fields/model.ts';

export class FormWriteRejected extends Error {}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const rejectionCodes=new Set(['FORM_CONFLICT','FIELD_CONFLICT','FORM_LIMIT','INVALID_INPUT','FORBIDDEN']);
function forms(value:unknown):FormDefinition[]{try{return normalizeForms(value);}catch{throw new Error('INVALID_ACK');}}
function definitions(value:unknown):FieldDefinition[]{try{return normalizeFieldDefinitions(value);}catch{throw new Error('INVALID_ACK');}}
function sameField(left:FieldDefinition,right:FieldDefinition){return left.id===right.id&&left.version===right.version&&left.name===right.name&&left.type===right.type&&left.required===right.required&&left.enabled===right.enabled&&JSON.stringify(left.options)===JSON.stringify(right.options);}
async function read(url:string){
 const response=await fetch(url,{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error(response.status===403?'FORBIDDEN':'FORMS_UNAVAILABLE');
 return response.json() as Promise<unknown>;
}
export async function readFormSettings():Promise<{forms:FormDefinition[];definitions:FieldDefinition[]}>{
 const [formData,fieldData]=await Promise.all([read('/api/admin/forms'),read('/api/admin/fields')]);
 return {forms:forms(formData),definitions:definitions(fieldData)};
}
export async function saveForm(id:string,input:FormWrite,expectedFields:FieldDefinition[]):Promise<FormDefinition>{
 let write:FormWrite;let chosen:FieldDefinition[];
 try{
  if(!uuid.test(id))throw new Error('INVALID_INPUT');
  write=parseFormWrite(input);chosen=normalizeFieldDefinitions(expectedFields);
  if(chosen.length!==write.fields.length || chosen.some((field,index)=>field.id!==write.fields[index].id||field.version!==write.fields[index].version))throw new Error('INVALID_INPUT');
 }catch{throw new FormWriteRejected('INVALID_INPUT');}
 const response=await fetch(`/api/admin/forms/${encodeURIComponent(id)}`,{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(write),signal:AbortSignal.timeout(20000)});
 if(!response.ok){
  if(response.status>=400&&response.status<500){
   const body=await response.json().catch(()=>null);
   const fallback=response.status===403?'FORBIDDEN':response.status===409?'FORM_CONFLICT':'WRITE_REJECTED';
   throw new FormWriteRejected(rejectionCodes.has(body?.error)?body.error:fallback);
  }
  throw new Error('UNKNOWN_RESULT');
 }
 const saved=forms([await response.json()])[0];
 if(!saved||saved.id!==id||saved.version!==(write.expectedVersion??0)+1||saved.title!==write.title||saved.description!==write.description||saved.audience!==write.audience||saved.enabled!==write.enabled||saved.fields.length!==write.fields.length||saved.fields.some((item,index)=>item.required!==write.fields[index].required||item.width!==write.fields[index].width||!sameField(item.field,chosen[index])))throw new Error('INVALID_ACK');
 return saved;
}
