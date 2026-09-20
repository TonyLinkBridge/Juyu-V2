import {measured} from '../../../server/performance';
import {ReaderMenu} from '../../../components/navigation-settings/ReaderMenu';
import {redirect} from 'next/navigation';
import {clerkConfiguration} from '../../../config/clerk';
import {employeeCompanyAccess} from '../../../server/authentication/company-clerk';
import {applicationEnrollment} from '../../../server/enrollment/application';
import {bindCurrentMember} from '../../../server/members/entry';
import {applicationAuthorization} from '../../../server/authorization/application';
import type {OpsPage} from '../../../ops/model';
import {EntryShell} from '../../../components/entry-shell';
import {OpsCollection} from '../../../components/ops/OpsCollection';
import {FeatureSearch} from '../../../components/features/FeatureSearch';
import {SearchInput} from '../../../components/gitbook/Search/SearchInput';

export const dynamic='force-dynamic';

export default async function OpsCollectionPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 return measured('page.ops',async()=>{
  const params=await searchParams,locale=params.lang==='en'?'en':'zh-CN';
  const page=typeof params.page==='string'&&/^[1-9]\d{0,4}$/.test(params.page)?Number(params.page):1;
  const access=await employeeCompanyAccess();if(access.status==='signed_out'||clerkConfiguration(process.env)!=='configured')redirect('/sign-in');if(access.status==='unavailable')redirect('/sign-in/error');if(access.status!=='verified')redirect('/help-centre');

  let ready=false;try{const enrollment=await(await applicationEnrollment()).inspect();if(enrollment.status==='ready'){await bindCurrentMember();ready=true;}}catch{}
  if(!ready)redirect('/help-centre');

  let data:OpsPage|undefined,state:'ready'|'denied'|'unavailable'='unavailable';

  let firstId:string|null=null;
  try{
   const service=await applicationAuthorization();
   firstId=page===1?await service.firstOpsId(locale):null;

   if(!firstId)data=await service.ops(page,locale);
   state='ready';
  }catch(error){
   if(error instanceof Error&&error.message.split(':')[0]==='FORBIDDEN')state='denied';
  }

  if(firstId)redirect('/help-centre?article='+encodeURIComponent(firstId)+(locale==='en'?'&lang=en':''));
  return <EntryShell account navigation={<ReaderMenu currentHref="/help-centre/ops"/>} search={locale==='en'?<SearchInput locale="en"/>:<FeatureSearch query=""/>}><main id="main-content" className="editor-main search-main"><OpsCollection data={data} state={state} locale={locale}/></main></EntryShell>;
 });
}
