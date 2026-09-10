import {redirect} from 'next/navigation';
import {currentAdminAccess} from '../../../server/authentication/admin-entry';
import {adminDestination} from '../../../server/authentication/admin';
import {applicationAuthorization} from '../../../server/authorization/application';
import {EntryShell} from '../../../components/entry-shell';
import {DeletedHistoryList} from '../../../components/history/DeletedHistoryList';
import {HistoryTimeline} from '../../../components/history/HistoryTimeline';
import {HistoryVersionPanel} from '../../../components/history/HistoryVersionPanel';
import {historyRevision,historyQuery} from '../../../server/history/http';
import type {DeletedHistoryPage,HistoryPage as HistoryData,HistoryVersion} from '../../../history/model';
type HistoryResult={kind:'deleted';data:DeletedHistoryPage}|{kind:'timeline';data:HistoryData}|{kind:'version';data:HistoryVersion}|{kind:'unavailable'};
export const dynamic='force-dynamic';
export default async function HistoryPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const access=await currentAdminAccess();if(access.status!=='admin')redirect(adminDestination(access));
 const params=await searchParams;let result:HistoryResult;
 try{
  if(Object.entries(params).some(([k,v])=>!['article','revision','eventPage','versionPage','page'].includes(k)||Array.isArray(v)))throw new Error('INVALID_INPUT');
  const service=await applicationAuthorization(),article=params.article as string|undefined;
  if(!article){
   if(params.revision||params.eventPage||params.versionPage)throw new Error('INVALID_INPUT');const page=params.page??'1';if(typeof page!=='string'||!/^[1-9]\d{0,5}$/.test(page))throw new Error('INVALID_INPUT');
   const data=await service.deletedHistory(Number(page));
   result={kind:'deleted',data};
  }else if(params.revision!==undefined){
   if(params.page||params.eventPage||params.versionPage||typeof params.revision!=='string')throw new Error('INVALID_INPUT');
   result={kind:'version',data:await service.historyVersion(article,historyRevision(params.revision))};
  }else{
   if(params.page)throw new Error('INVALID_INPUT');const url=new URL('http://local/');for(const key of ['eventPage','versionPage'])if(typeof params[key]==='string')url.searchParams.set(key,params[key]);const q=historyQuery(url);
   result={kind:'timeline',data:await service.history(article,q.eventPage,q.versionPage)};
  }
 }catch{result={kind:'unavailable'};}
 const content=result.kind==='deleted'?<DeletedHistoryList data={result.data}/>:result.kind==='timeline'?<HistoryTimeline data={result.data}/>:result.kind==='version'?<HistoryVersionPanel key={`${result.data.documentId}:${result.data.version.revision}`} initial={result.data}/>:<section role="alert"><p>历史记录暂时无法读取，请核对文章、版本和管理员权限后重试。</p><a href={typeof params.article==='string'?`/admin/history?article=${encodeURIComponent(params.article)}`:'/admin/history'}>重新读取历史记录</a></section>;
 return <EntryShell><main id="main-content" className="editor-main"><h1>历史记录与版本</h1><nav className="review-decision-links"><a href="/admin">返回内容工作台</a><a href="/admin/trash">回收站</a><a href="/admin/history">永久删除记录</a></nav>{content}</main></EntryShell>;
}
