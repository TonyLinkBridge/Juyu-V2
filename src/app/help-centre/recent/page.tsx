import {requireReaderAccount} from '../../../server/authentication/navigation';
import {applicationAuthorization} from '../../../server/authorization/application';
import {recentPage} from '../../../server/recent/http';
import type {RecentPage} from '../../../recent/model';
import {FumadocsRecentPage} from '../../../components/fumadocs/FumadocsRecentPage';
import {readReaderPresentation} from '../../../server/reader-presentation';
export const dynamic='force-dynamic';
export default async function RecentCollectionPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 await requireReaderAccount();
 let data:RecentPage|undefined,state:'ready'|'denied'|'unavailable'|'disabled'='unavailable';
 const params=await searchParams,locale=params.lang==='en'?'en':'zh-CN';
 try{const url=new URL('http://local/');for(const [key,value] of Object.entries(params)){if(key==='lang'&&value==='en')continue;if(typeof value!=='string')throw new Error('INVALID_INPUT');url.searchParams.set(key,value);}const query=recentPage(url),service=await applicationAuthorization(),features=await service.features();if(!features.recent)state='disabled';else{data=await service.recent(query,locale);state='ready';}}
 catch(error){if(error instanceof Error&&error.message.split(':')[0]==='FORBIDDEN')state='denied';}
 let menu:Awaited<ReturnType<typeof readReaderPresentation>>['items']=[],search=false;
 try{const presentation=await readReaderPresentation();menu=presentation.items;search=presentation.features.search;}catch{}
 return <FumadocsRecentPage data={data} state={state} locale={locale} menu={menu} search={search}/>;
}
