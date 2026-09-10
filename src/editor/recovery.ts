import {normalizeCategoryDefinitions,normalizeCategoryIds} from '../categories/model.ts';
import {categoryState} from '../categories/editor.ts';
import {normalizeFieldSnapshots} from '../fields/model.ts';
import {fieldValueText} from '../fields/editor.ts';
import {normalizeQa} from '../qa/metadata.ts';
import type {EditorData} from './contract.ts';
import {editorInitialContent} from './legacy.ts';
import {normalizePresentation} from '../domain/presentation.ts';
import {statuses,kinds} from '../workspace/model.ts';
/** A comparison snapshot must belong to this editor and cannot roll its acknowledged sequence backwards. */
export function recoverySnapshot(value:unknown,id:string,sequence:number|null):EditorData {
 const bad=():never=>{throw new Error('INVALID_RECOVERY');};
 if(!value||typeof value!=='object'||Array.isArray(value))return bad();
 const v=value as EditorData;
 if(v.documentId!==id||!Number.isSafeInteger(v.sequence)||v.sequence<0||(sequence!==null&&v.sequence<sequence)||typeof v.title!=='string'||typeof v.body!=='string'||!statuses.some(s=>s.id===v.status)||!['active','archived','trashed'].includes(v.lifecycle)||!Object.hasOwn(kinds,v.kind)||!['staff','ops','admin'].includes(v.audience)||!(v.publishedRevision===null||(Number.isSafeInteger(v.publishedRevision)&&v.publishedRevision>=0))||!Array.isArray(v.tags)||!Array.isArray(v.blocks)||!Array.isArray(v.assets))return bad();
 for(const asset of v.assets)if(!asset||['id','filename','mime','size','status'].some(k=>typeof asset[k as keyof typeof asset]!=='string'))return bad();
 if(v.kind==='qa'||v.qa!==undefined){const qa=normalizeQa(v.qa);if(v.kind!=='qa'&&(qa.category!==''||qa.position!==0))return bad();}
 normalizeFieldSnapshots(v.customFields);
 const categoryIds=normalizeCategoryIds(v.categoryIds);const options=normalizeCategoryDefinitions(v.categoryOptions??[]);if(categoryIds.some(id=>!options.some(c=>c.id===id)))return bad();
 normalizePresentation({tags:v.tags,cover:v.cover,blocks:v.blocks});editorInitialContent(v.body,v.blocks);
 return structuredClone(v);
}
/** Preserve the exact local input, including fields currently rejected by validation. */
export function recoveryText(value:unknown):string {return JSON.stringify(value,null,2);}
export function recoveryReadable(data:EditorData):string {
 const categoryLines=normalizeCategoryIds(data.categoryIds).map(id=>{const state=categoryState(data.categoryOptions??[],id);return `目录分类：${state.path}（${state.enabled?{staff:'全体员工',ops:'运营和管理员',admin:'仅管理员'}[state.audience]:'已停用或暂不可用'}）`;});
 const lines:string[]=categoryLines.concat(normalizeFieldSnapshots(data.customFields).map(f=>`${f.name}：${fieldValueText(f.value)}`));
 const walk=(nodes:ReturnType<typeof editorInitialContent>)=>{for(const node of nodes){
  if(node.type!=='juyu'){lines.push(node.content.map(i=>i.text).join(''));walk(node.children);continue;}
  const b=JSON.parse(node.props.payload);
  if(b.type==='table')lines.push(b.headers.join(' | '),...b.rows.map((r:string[])=>r.join(' | ')));
  else if(b.type==='hint')lines.push(b.title,b.body);
  else if(b.type==='code')lines.push(b.language,b.code);
  else if(b.type==='tabs')for(const tab of b.tabs)lines.push(tab.title,tab.body);
  else if(b.type==='math'||b.type==='diagram')lines.push(b.caption,b.source);
  else lines.push(`[${b.type==='image'?'图片':b.type==='video'?'影片':'文件'}]`,b.caption,b.alt);
 }};
 walk(editorInitialContent(data.body,data.blocks));return lines.join('\n');
}
