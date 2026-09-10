import {FeaturePage} from '../../../components/features/FeaturePage';
import {ReaderMenu} from '../../../components/navigation-settings/ReaderMenu';
import {redirect} from 'next/navigation';
import {clerkConfiguration} from '../../../config/clerk';
import {employeeCompanyAccess} from '../../../server/authentication/company-clerk';
import {applicationEnrollment} from '../../../server/enrollment/application';
import {bindCurrentMember} from '../../../server/members/entry';
import {applicationAuthorization} from '../../../server/authorization/application';
import {favoritesPage} from '../../../server/favorites/http';
import type {FavoritesPage} from '../../../favorites/model';
import {EntryShell} from '../../../components/entry-shell';
import {FavoritesView} from '../../../components/favorites/FavoritesView';
import {EmployeeSignOut} from '../../../components/employee-sign-out';
import {FeatureSearch} from '../../../components/features/FeatureSearch';
export const dynamic='force-dynamic';
export default async function FavoritesCollectionPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const access=await employeeCompanyAccess();if(access.status==='signed_out'||clerkConfiguration(process.env)!=='configured')redirect('/sign-in');if(access.status==='unavailable')redirect('/sign-in/error');if(access.status!=='verified')redirect('/help-centre');
 let ready=false;try{const enrollment=await(await applicationEnrollment()).inspect();if(enrollment.status==='ready'){await bindCurrentMember();ready=true;}}catch{}
 if(!ready)redirect('/help-centre');
 let data:FavoritesPage|undefined,state:'ready'|'denied'|'unavailable'='unavailable';
 try{const params=await searchParams,url=new URL('http://local/');for(const [key,value] of Object.entries(params)){if(typeof value!=='string')throw new Error('INVALID_INPUT');url.searchParams.set(key,value);}const query=favoritesPage(url),service=await applicationAuthorization();data=await service.favorites(query);state='ready';}
 catch(error){if(error instanceof Error&&error.message.split(':')[0]==='FORBIDDEN')state='denied';}
 return <FeaturePage feature="favorites"><EntryShell navigation={<ReaderMenu currentHref="/help-centre/favorites"/>} search={<FeatureSearch/>}><main id="main-content" className="editor-main search-main"><FavoritesView data={data} state={state}/><div className="reader-actions"><EmployeeSignOut/></div></main></EntryShell></FeaturePage>;
}
