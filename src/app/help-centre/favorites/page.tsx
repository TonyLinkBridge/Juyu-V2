import {redirect} from 'next/navigation';
import {clerkConfiguration} from '../../../config/clerk';
import {employeeCompanyAccess} from '../../../server/authentication/company-clerk';
import {applicationEnrollment} from '../../../server/enrollment/application';
import {bindCurrentMember} from '../../../server/members/entry';
import {applicationAuthorization} from '../../../server/authorization/application';
import {favoritesPage} from '../../../server/favorites/http';
import type {FavoritesPage} from '../../../favorites/model';
import {FumadocsFavoritesPage} from '../../../components/fumadocs/FumadocsFavoritesPage';
import {readReaderPresentation} from '../../../server/reader-presentation';
export const dynamic='force-dynamic';
export default async function FavoritesCollectionPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const access=await employeeCompanyAccess();if(access.status==='signed_out'||clerkConfiguration(process.env)!=='configured')redirect('/sign-in');if(access.status==='unavailable')redirect('/sign-in/error');if(access.status!=='verified')redirect('/help-centre');
 let ready=false;try{const enrollment=await(await applicationEnrollment()).inspect();if(enrollment.status==='ready'){await bindCurrentMember();ready=true;}}catch{}
 if(!ready)redirect('/help-centre');
 let data:FavoritesPage|undefined,state:'ready'|'denied'|'unavailable'|'disabled'='unavailable';
 const params=await searchParams,locale=params.lang==='en'?'en':'zh-CN';
 try{const url=new URL('http://local/');for(const [key,value] of Object.entries(params)){if(key==='lang'&&value==='en')continue;if(typeof value!=='string')throw new Error('INVALID_INPUT');url.searchParams.set(key,value);}const query=favoritesPage(url),service=await applicationAuthorization(),features=await service.features();if(!features.favorites)state='disabled';else{data=await service.favorites(query,locale);state='ready';}}
 catch(error){if(error instanceof Error&&error.message.split(':')[0]==='FORBIDDEN')state='denied';}
 let menu:Awaited<ReturnType<typeof readReaderPresentation>>['items']=[],search=false;
 try{const presentation=await readReaderPresentation();menu=presentation.items;search=presentation.features.search;}catch{}
 return <FumadocsFavoritesPage viewerId={access.userId} data={data} state={state} locale={locale} menu={menu} search={search}/>;
}
