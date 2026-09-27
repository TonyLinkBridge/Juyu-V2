import {FumadocsChangelogPage} from '../../../components/fumadocs/FumadocsChangelogPage';
import {applicationAuthorization} from '../../../server/authorization/application';
import {readReaderPresentation} from '../../../server/reader-presentation';
import {requireReaderAccount} from '../../../server/authentication/navigation';

export const dynamic='force-dynamic';
export default async function Changelog({searchParams}:{searchParams:Promise<{page?:string;lang?:string}>}){
 await requireReaderAccount();
 const params=await searchParams,raw=params.page,locale=params.lang==='en'?'en':'zh-CN';
 const page=raw===undefined?1:/^[1-9]\d{0,2}$/.test(raw)?Number(raw):null;
 let data:Awaited<ReturnType<Awaited<ReturnType<typeof applicationAuthorization>>['changelog']>>|undefined,state:'ready'|'unavailable'='unavailable';
 if(page!==null)try{data=await(await applicationAuthorization()).changelog(page,locale);state='ready';}catch{}
 let menu:Awaited<ReturnType<typeof readReaderPresentation>>['items']=[],search=false;
 try{const presentation=await readReaderPresentation();menu=presentation.items;search=presentation.features.search;}catch{}
 return <FumadocsChangelogPage data={data} state={state} menu={menu} search={search} locale={locale}/>;
}
