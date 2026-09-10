import type {AuthorizationService} from '../authorization/service.ts';
import {diagramSVG} from './render.ts';
export async function diagramResponse(id:string,revision:number,blockId:string,service:Pick<AuthorizationService,'pdf'>,render=diagramSVG){
 const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization','Content-Type':'image/svg+xml','Content-Security-Policy':"sandbox; default-src 'none'; style-src 'unsafe-inline'",'X-Content-Type-Options':'nosniff'};
 try{const snapshot=await service.pdf(id,revision);const block=snapshot.article.blocks?.find(b=>b.id===blockId&&b.type==='diagram');if(!block||block.type!=='diagram')return new Response(null,{status:404,headers});const svg=await render(block.source);const current=await service.pdf(id,revision);if(JSON.stringify(current)!==JSON.stringify(snapshot))throw new Error('VERSION_CHANGED');return new Response(svg,{headers});}
 catch(e){const message=e instanceof Error?e.message:'';return Response.json({error:message==='VERSION_CHANGED'?'版本已改变，请刷新文章。':'流程图不可读取，请检查权限或图形语法。'},{status:message==='VERSION_CHANGED'?409:503,headers:{...headers,'Content-Type':'application/json'}});}
}

// Preview failures can originate in authentication, SQL or Chromium. Never send
// their raw messages (including filesystem paths and provider diagnostics).
export async function diagramPreviewResponse(action:()=>Promise<unknown>):Promise<Response>{
 const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization','X-Content-Type-Options':'nosniff'};
 try{return Response.json(await action(),{headers});}
 catch(error){
  const raw=error instanceof Error?error.message.split(':')[0]:'';
  const status=raw==='FORBIDDEN'?403:raw==='NOT_FOUND'?404:raw==='INVALID_INPUT'?400:raw==='UPLOAD_TOO_LARGE'?413:503;
  const code=['FORBIDDEN','NOT_FOUND','INVALID_INPUT','UPLOAD_TOO_LARGE','AUTH_NOT_CONFIGURED'].includes(raw)?raw:'流程图暂时不可用，请检查语法或稍后重试。';
  return Response.json({error:code},{status,headers});
 }
}
