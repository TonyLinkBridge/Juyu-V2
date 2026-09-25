import {redirect} from 'next/navigation';
import {FumadocsChangelogPage} from '../../../components/fumadocs/FumadocsChangelogPage';
import {clerkConfiguration} from '../../../config/clerk';
import {employeeCompanyAccess} from '../../../server/authentication/company-clerk';
import {applicationEnrollment} from '../../../server/enrollment/application';
import {applicationAuthorization} from '../../../server/authorization/application';
import {bindCurrentMember} from '../../../server/members/entry';
import {readReaderPresentation} from '../../../server/reader-presentation';

export const dynamic='force-dynamic';
export default async function Changelog({searchParams}:{searchParams:Promise<{page?:string;lang?:string}>}){
 const access=await employeeCompanyAccess();
 if(access.status==='signed_out'||clerkConfiguration(process.env)!=='configured')redirect('/sign-in');
 if(access.status==='unavailable')redirect('/sign-in/error');
 if(access.status!=='verified')redirect('/help-centre');
 let ready=false;
 try{if((await(await applicationEnrollment()).inspect()).status==='ready'){await bindCurrentMember();ready=true;}}catch{}
 if(!ready)redirect('/help-centre');
 const params=await searchParams,raw=params.page,locale=params.lang==='en'?'en':'zh-CN';
 const page=raw===undefined?1:/^[1-9]\d{0,2}$/.test(raw)?Number(raw):null;
 let data:Awaited<ReturnType<Awaited<ReturnType<typeof applicationAuthorization>>['changelog']>>|undefined,state:'ready'|'unavailable'='unavailable';
 if(page!==null)try{data=await(await applicationAuthorization()).changelog(page,locale);state='ready';}catch{}
 let menu:Awaited<ReturnType<typeof readReaderPresentation>>['items']=[],search=false;
 try{const presentation=await readReaderPresentation();menu=presentation.items;search=presentation.features.search;}catch{}
 return <FumadocsChangelogPage data={data} state={state} menu={menu} search={search} locale={locale}/>;
}
