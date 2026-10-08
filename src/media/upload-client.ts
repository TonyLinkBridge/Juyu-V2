import {uploadExtensions} from './model.ts';
export class MediaUploadError extends Error {
 retryable:boolean;
 constructor(message:string,retryable=false){super(message);this.name='MediaUploadError';this.retryable=retryable;}
}
export function validateMediaFile(file:{name:string;size:number}){
 const extension=file.name.split('.').at(-1)?.toLowerCase()??'',rule=uploadExtensions[extension];
 if(!rule)throw new MediaUploadError('此文件类型暂不支持，请选择图片、视频、音频、PDF、TXT 或 CSV。',true);
 if(file.size===0||file.size>rule.max*1024*1024)throw new MediaUploadError(`文件为空或超过限制：此类型最多 ${rule.max} MB。`,true);
}
const uncertain='上传结果未确认。请关闭窗口并刷新文件列表，确认是否已上传，再重新选择文件。';
export function uploadMediaFile(articleId:string,file:File,{onProgress,signal,createRequest=()=>new XMLHttpRequest()}:{onProgress?:(percent:number)=>void;signal?:AbortSignal;createRequest?:()=>XMLHttpRequest}={}):Promise<string>{
 validateMediaFile(file);
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(new MediaUploadError(uncertain));return;}
  const xhr=createRequest();let settled=false;
  const finish=(error?:MediaUploadError,id?:string)=>{if(settled)return;settled=true;signal?.removeEventListener('abort',abort);if(error)reject(error);else{onProgress?.(100);resolve(id!);}};
  const abort=()=>xhr.abort();signal?.addEventListener('abort',abort,{once:true});
  xhr.open('POST',`/api/admin/media/${encodeURIComponent(articleId)}/upload`);xhr.withCredentials=true;xhr.timeout=120000;
  xhr.setRequestHeader('Content-Type','application/octet-stream');xhr.setRequestHeader('X-File-Name',encodeURIComponent(file.name));
  xhr.upload.onprogress=event=>{if(event.lengthComputable)onProgress?.(Math.min(99,Math.round(event.loaded/event.total*100)));};
  xhr.onload=()=>{
   let result:{id?:unknown;status?:unknown;error?:unknown};try{result=JSON.parse(xhr.responseText);}catch{finish(new MediaUploadError(uncertain));return;}
   if(xhr.status>=200&&xhr.status<300&&result.status==='ready'&&typeof result.id==='string'&&result.id){finish(undefined,result.id);return;}
   const errors:Record<string,string>={INVALID_STATE:'文章已进入审核，暂时不能上传。请选择其他可编辑文章。',INVALID_UPLOAD:'文件内容与扩展名不符，或类型不支持。',UPLOAD_TOO_LARGE:'文件超过该类型的大小限制。'};
   const safe=xhr.status>=400&&xhr.status<500&&typeof result.error==='string'&&result.error in errors;
   finish(new MediaUploadError(safe?errors[String(result.error)]:uncertain,safe));
  };
  xhr.onerror=xhr.ontimeout=xhr.onabort=()=>finish(new MediaUploadError(uncertain));
  try{xhr.send(file);}catch{finish(new MediaUploadError(uncertain));}
 });
}
