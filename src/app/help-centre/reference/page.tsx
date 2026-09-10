import {ReaderMenu} from '../../../components/navigation-settings/ReaderMenu';
import {redirect} from 'next/navigation';
import {clerkConfiguration} from '../../../config/clerk';
import {employeeCompanyAccess} from '../../../server/authentication/company-clerk';
import {applicationEnrollment} from '../../../server/enrollment/application';
import {bindCurrentMember} from '../../../server/members/entry';
import {applicationAuthorization} from '../../../server/authorization/application';
import {referenceQuery} from '../../../server/reference/http';
import type {ReferencePage,ReferenceDetail} from '../../../reference/model';
import {EntryShell} from '../../../components/entry-shell';
import {ReferenceView} from '../../../components/reference/ReferenceView';
import {EmployeeSignOut} from '../../../components/employee-sign-out';
import {FeatureSearch} from '../../../components/features/FeatureSearch';
export const dynamic='force-dynamic';
export default async function ReferenceCollectionPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const access=await employeeCompanyAccess();if(access.status==='signed_out'||clerkConfiguration(process.env)!=='configured')redirect('/sign-in');if(access.status==='unavailable')redirect('/sign-in/error');if(access.status!=='verified')redirect('/help-centre');
 let ready=false;try{const enrollment=await(await applicationEnrollment()).inspect();if(enrollment.status==='ready'){await bindCurrentMember();ready=true;}}catch{}
 if(!ready)redirect('/help-centre');
 let data:ReferencePage|undefined,detail:ReferenceDetail|undefined,state:'ready'|'denied'|'unavailable'='unavailable',detailState:'idle'|'ready'|'unavailable'='idle';
 try{const params=await searchParams,url=new URL('http://local/');for(const [key,value] of Object.entries(params)){if(typeof value!=='string')throw new Error('INVALID_INPUT');url.searchParams.set(key,value);}const query=referenceQuery(url),service=await applicationAuthorization();data=await service.reference(query.page);state='ready';if(query.article){try{detail=await service.referenceDetail(query.article);detailState='ready';}catch{detailState='unavailable';}}}
 catch(error){if(error instanceof Error&&error.message.split(':')[0]==='FORBIDDEN')state='denied';}
 return <EntryShell navigation={<ReaderMenu currentHref="/help-centre/reference"/>} search={<FeatureSearch/>}><main id="main-content" className="editor-main search-main"><ReferenceView data={data} detail={detail} state={state} detailState={detailState}/><div className="reader-actions"><EmployeeSignOut/></div></main></EntryShell>;
}
