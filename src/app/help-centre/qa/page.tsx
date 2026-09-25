import {redirect} from 'next/navigation';
import {clerkConfiguration} from '../../../config/clerk';
import {employeeCompanyAccess} from '../../../server/authentication/company-clerk';
import {applicationEnrollment} from '../../../server/enrollment/application';
import {bindCurrentMember} from '../../../server/members/entry';
import {applicationAuthorization} from '../../../server/authorization/application';
import {qaQuery} from '../../../server/qa/http';
import type {Publication} from '../../../reader/body';
import type {QaPage} from '../../../qa/model';
import {FumadocsQaPage} from '../../../components/fumadocs/FumadocsQaPage';
import {readReaderPresentation} from '../../../server/reader-presentation';
export const dynamic='force-dynamic';
export default async function QaCollectionPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const access=await employeeCompanyAccess();if(access.status==='signed_out'||clerkConfiguration(process.env)!=='configured')redirect('/sign-in');if(access.status==='unavailable')redirect('/sign-in/error');if(access.status!=='verified')redirect('/help-centre');
 let ready=false;try{const enrollment=await(await applicationEnrollment()).inspect();if(enrollment.status==='ready'){await bindCurrentMember();ready=true;}}catch{}
 if(!ready)redirect('/help-centre');
 let searchEnabled=false;
 let initialAnswer:Publication|undefined;
 let data:QaPage|undefined,state:'ready'|'denied'|'unavailable'|'invalid'='unavailable';
 const params=await searchParams,locale=params.lang==='en'?'en':'zh-CN';
 try{const url=new URL('http://local/');for(const [key,value] of Object.entries(params)){if(key==='lang'&&value==='en')continue;if(typeof value!=='string')throw new Error('INVALID_INPUT');url.searchParams.set(key,value);}const question=url.searchParams.get('question');url.searchParams.delete('question');const query=qaQuery(url),service=await applicationAuthorization();searchEnabled=(await service.features()).search;data=await service.qa(query.page,query.category,searchEnabled?query.q:undefined,locale,query.topic);if(question){const answer=await service.qaAnswer(question,locale);initialAnswer=answer;data={...data,items:[{id:answer.id,title:answer.title,revision:answer.revision,tags:[],category:'',position:0}],total:1,page:1,pages:1};}state='ready';}
 catch(error){if(error instanceof Error&&error.message.split(':')[0]==='FORBIDDEN')state='denied';else if(error instanceof Error&&error.message==='INVALID_INPUT')state='invalid';}
 let menu:Awaited<ReturnType<typeof readReaderPresentation>>['items']=[];
 try{const presentation=await readReaderPresentation();menu=presentation.items;}catch{}
 return <FumadocsQaPage searchEnabled={searchEnabled} data={data} state={state} viewerId={access.userId} initialAnswer={state==='ready'?initialAnswer:undefined} locale={locale} menu={menu}/>;
}
