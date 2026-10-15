import {measured} from '../../../server/performance';
import {requireReaderAccount} from '../../../server/authentication/navigation';
import {applicationAuthorization} from '../../../server/authorization/application';
import {FumadocsOpsPage} from '../../../components/fumadocs/FumadocsOpsPage';
import {sectionQuery} from '../../../reader/section-directory';
import type {CollectionDirectoryData} from '../../../components/home/CollectionDirectory';
import {readReaderPresentation} from '../../../server/reader-presentation';
export const dynamic='force-dynamic';
export default async function OpsCollectionPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 return measured('page.ops',async()=>{
  await requireReaderAccount();
  const params=await searchParams,locale=params.lang==='en'?'en':'zh-CN';
  let directory:CollectionDirectoryData|undefined,state:'ready'|'denied'|'unavailable'|'invalid'='unavailable',menu:Awaited<ReturnType<typeof readReaderPresentation>>['items']=[],search=false;
  try{
   const query=sectionQuery(params),result=await(await applicationAuthorization()).collectionDirectory('ops',locale);
   search=result.features.search;menu=result.menu;
   directory={pages:result.pages,query:{...query,q:search?query.q:''}};state='ready';
  }catch(error){const code=error instanceof Error?error.message.split(':')[0]:'';if(code==='FORBIDDEN')state='denied';else if(code==='INVALID_INPUT')state='invalid';}
  if(state!=='ready')try{const presentation=await readReaderPresentation(locale);menu=presentation.items;}catch{}
  return <FumadocsOpsPage collection directory={directory} state={state} locale={locale} menu={menu} search={search}/>;
 });
}
