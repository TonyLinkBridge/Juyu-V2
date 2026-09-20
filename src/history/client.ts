import {normalizeFieldSnapshots} from '../fields/model.ts';
import {normalizeQa} from '../qa/metadata.ts';
import type {HistoryVersion,RestoreVersionInput,RestoreVersionAck} from './model.ts';
import {normalizeDescription,normalizePresentation,normalizeReleaseNote} from '../domain/presentation.ts';
export class HistoryRestoreRejected extends Error {}
const record=(v:unknown):v is Record<string,unknown>=>Boolean(v)&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown,min=1)=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=2147483647;
const text=(v:unknown)=>typeof v==='string';
const id=(v:unknown)=>text(v)&&Boolean(String(v).trim());
const date=(v:unknown)=>text(v)&&Number.isFinite(Date.parse(String(v)));
export async function readHistoryVersion(documentId:string,revision:number,minimumSequence:number,minimumRevision=revision):Promise<HistoryVersion>{
 const response=await fetch(`/api/admin/history/${encodeURIComponent(documentId)}/versions/${revision}`,{cache:'no-store',signal:AbortSignal.timeout(15000)}),data:unknown=await response.json();
 if(!response.ok)throw new Error(record(data)&&text(data.error)?String(data.error):'READ_FAILED');
 const bad=()=>{throw new Error('READ_FAILED');};
 if(!record(data)||data.documentId!==documentId||!integer(data.sequence,minimumSequence)||!integer(data.currentRevision,minimumRevision)||!['active','archived','trashed'].includes(String(data.lifecycle))||!['draft','in_review','changes_requested','approved','queued','published'].includes(String(data.status))||!(data.publishedRevision===null||integer(data.publishedRevision)&&Number(data.publishedRevision)<=Number(data.currentRevision))||typeof data.canRestore!=='boolean')return bad();
 const version=data.version;
 if(!record(version)||version.revision!==revision||revision>Number(data.currentRevision)||!text(version.title)||!text(version.body)||!id(version.authorId)||!text(version.authorName)||!id(version.editorId)||!text(version.editorName)||!date(version.createdAt)||!['staff','ops','admin'].includes(String(version.audience))||!Array.isArray(version.tags)||!Array.isArray(version.blocks)||!(version.cover===null||record(version.cover)))return bad();
 try{if(version.description!==undefined&&(typeof version.description!=='string'||normalizeDescription(version.description)!==version.description))return bad();if(version.releaseNote!==undefined&&(typeof version.releaseNote!=='string'||normalizeReleaseNote(version.releaseNote)!==version.releaseNote))return bad();normalizeFieldSnapshots(version.customFields);if(version.qa!==undefined)normalizeQa(version.qa);normalizePresentation({tags:version.tags,blocks:version.blocks,cover:version.cover as HistoryVersion['version']['cover']});}catch{return bad();}
 if(!Array.isArray(data.categories)||!data.categories.every(c=>record(c)&&id(c.id)&&text(c.name))||!Array.isArray(data.assets)||!data.assets.every(a=>record(a)&&id(a.id)&&text(a.filename)&&text(a.mime)&&typeof a.size==='string'&&/^\d+$/.test(a.size)&&text(a.status)))return bad();
 if(data.canRestore&&(data.lifecycle!=='active'||data.status==='in_review'||revision>=Number(data.currentRevision)||data.assets.some(a=>a.status!=='ready')))return bad();
 return data as unknown as HistoryVersion;
}
export async function restoreHistoryVersion(documentId:string,input:RestoreVersionInput,currentRevision:number,publishedRevision:number|null):Promise<RestoreVersionAck>{
 const response=await fetch(`/api/admin/history/${encodeURIComponent(documentId)}/versions/${input.sourceRevision}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(20000)}),data:unknown=await response.json();
 if(!response.ok){if(response.status>=400&&response.status<500&&record(data)&&id(data.error))throw new HistoryRestoreRejected(String(data.error));throw new Error('UNKNOWN_RESULT');}
 if(!record(data)||data.documentId!==documentId||data.sequence!==input.expectedSequence+1||data.revision!==currentRevision+1||data.sourceRevision!==input.sourceRevision||data.status!=='draft'||data.publishedRevision!==publishedRevision)throw new Error('INVALID_ACK');
 return data as unknown as RestoreVersionAck;
}
export function historyRestoreError(error:unknown,reading=false){
 const code=error instanceof Error?error.message:'';
 if(reading)return code==='FORBIDDEN'?'当前账号没有历史记录管理权限，已暂停操作。':'未能读取最新版本状态，已暂停操作。请重新读取后核对。';
 if(error instanceof HistoryRestoreRejected){
  if(code==='MEMBER_BUSY')return '成员状态正在更新，恢复未执行。请稍后重新读取版本状态再确认。';
  if(code==='UPLOAD_IN_PROGRESS')return '本篇资料仍有未完成的上传，恢复未执行。请处理上传后重新读取。';
  if(code==='SOURCE_ASSET_UNAVAILABLE'||code==='ASSET_NOT_READY'||code==='INVALID_MEDIA'||code==='INVALID_COVER')return '来源版本有文件无法读取或尚未就绪，恢复未执行。请重新读取后核对。';
  return '账号权限或资料状态已改变，恢复未执行。请重新读取后再确认。';
 }
 return '恢复结果尚未确认。原操作及来源版本已保留，请重试原操作完成核对。';
}
