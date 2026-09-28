import {requireReaderAccount} from '../../../server/authentication/navigation';
import {applicationAuthorization} from '../../../server/authorization/application';
import {qaQuery} from '../../../server/qa/http';
import type {Publication} from '../../../reader/body';
import type {QaPage} from '../../../qa/model';
import {FumadocsQaPage} from '../../../components/fumadocs/FumadocsQaPage';
import {readReaderPresentation} from '../../../server/reader-presentation';
import {closedFeatureFlags,type FeatureFlags} from '../../../features/model';
export const dynamic='force-dynamic';
export default async function QaCollectionPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const access=await requireReaderAccount();
 let features:FeatureFlags=closedFeatureFlags,searchEnabled=false;
 let initialAnswer:Publication|undefined;
 let data:QaPage|undefined,state:'ready'|'denied'|'unavailable'|'invalid'='unavailable';
 const params=await searchParams,locale=params.lang==='en'?'en':'zh-CN';
 try{const url=new URL('http://local/');for(const [key,value] of Object.entries(params)){if(key==='lang'&&value==='en')continue;if(typeof value!=='string')throw new Error('INVALID_INPUT');url.searchParams.set(key,value);}const question=url.searchParams.get('question');url.searchParams.delete('question');const query=qaQuery(url),service=await applicationAuthorization();features=await service.features();searchEnabled=features.search;if(question){const answer=await service.qaAnswer(question,locale);initialAnswer=answer;data={items:[{id:answer.id,title:answer.title,revision:answer.revision,tags:[],category:'',position:0}],total:1,page:1,pages:1,canEdit:false,q:'',categories:[],topics:[]};}else data=await service.qa(query.page,query.category,searchEnabled?query.q:undefined,locale,query.topic);state='ready';}
 catch(error){if(error instanceof Error&&error.message.split(':')[0]==='FORBIDDEN')state='denied';else if(error instanceof Error&&error.message==='INVALID_INPUT')state='invalid';}
 let menu:Awaited<ReturnType<typeof readReaderPresentation>>['items']=[],knowledgeEntry:string|undefined;
 try{const presentation=await readReaderPresentation(locale);menu=presentation.items;knowledgeEntry=presentation.knowledgeEntry;}catch{}
 return <FumadocsQaPage searchEnabled={searchEnabled} features={features} data={data} state={state} viewerId={access.viewer.id} initialAnswer={state==='ready'?initialAnswer:undefined} locale={locale} menu={menu} knowledgeEntry={knowledgeEntry}/>;
}
