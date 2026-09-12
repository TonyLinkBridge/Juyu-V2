import {ReaderMenu} from '../../../components/navigation-settings/ReaderMenu';
import {redirect} from 'next/navigation';
import {clerkConfiguration} from '../../../config/clerk';
import {employeeCompanyAccess} from '../../../server/authentication/company-clerk';
import {applicationEnrollment} from '../../../server/enrollment/application';
import {bindCurrentMember} from '../../../server/members/entry';
import {applicationAuthorization} from '../../../server/authorization/application';
import {qaQuery} from '../../../server/qa/http';
import type {QaPage} from '../../../qa/model';
import {EntryShell} from '../../../components/entry-shell';
import {QaView} from '../../../components/qa/QaView';
import {EmployeeSignOut} from '../../../components/employee-sign-out';
import {FeatureSearch} from '../../../components/features/FeatureSearch';
export const dynamic='force-dynamic';
export default async function QaCollectionPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const access=await employeeCompanyAccess();if(access.status==='signed_out'||clerkConfiguration(process.env)!=='configured')redirect('/sign-in');if(access.status==='unavailable')redirect('/sign-in/error');if(access.status!=='verified')redirect('/help-centre');
 let ready=false;try{const enrollment=await(await applicationEnrollment()).inspect();if(enrollment.status==='ready'){await bindCurrentMember();ready=true;}}catch{}
 if(!ready)redirect('/help-centre');
 let data:QaPage|undefined,state:'ready'|'denied'|'unavailable'='unavailable';
 try{const params=await searchParams,url=new URL('http://local/');for(const [key,value] of Object.entries(params)){if(typeof value!=='string')throw new Error('INVALID_INPUT');url.searchParams.set(key,value);}const question=url.searchParams.get('question');url.searchParams.delete('question');const query=qaQuery(url),service=await applicationAuthorization();data=await service.qa(query.page,query.category,query.q);if(question){const answer=await service.qaAnswer(question);data={...data,items:[{id:answer.id,title:answer.title,revision:answer.revision,tags:[],category:'',position:0}],total:1,page:1,pages:1};}state='ready';}
 catch(error){if(error instanceof Error&&error.message.split(':')[0]==='FORBIDDEN')state='denied';}
 return <EntryShell navigation={<ReaderMenu currentHref="/help-centre/qa"/>} search={<FeatureSearch/>}><main id="main-content" className="editor-main search-main"><QaView data={data} state={state}/><div className="reader-actions"><EmployeeSignOut/></div></main></EntryShell>;
}
