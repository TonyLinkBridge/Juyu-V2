import {requireReaderAccount} from '../../../server/authentication/navigation';
import {applicationAuthorization} from '../../../server/authorization/application';
import {favoritesPage} from '../../../server/favorites/http';
import type {FavoritesPage} from '../../../favorites/model';
import {FumadocsFavoritesPage} from '../../../components/fumadocs/FumadocsFavoritesPage';
import {readReaderPresentation} from '../../../server/reader-presentation';
export const dynamic='force-dynamic';
export default async function FavoritesCollectionPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const access=await requireReaderAccount();
 let data:FavoritesPage|undefined,state:'ready'|'denied'|'unavailable'|'disabled'='unavailable';
 const params=await searchParams,locale=params.lang==='en'?'en':'zh-CN';
 try{const url=new URL('http://local/');for(const [key,value] of Object.entries(params)){if(key==='lang'&&value==='en')continue;if(typeof value!=='string')throw new Error('INVALID_INPUT');url.searchParams.set(key,value);}const query=favoritesPage(url),service=await applicationAuthorization(),features=await service.features();if(!features.favorites)state='disabled';else{data=await service.favorites(query,locale);state='ready';}}
 catch(error){if(error instanceof Error&&error.message.split(':')[0]==='FORBIDDEN')state='denied';}
 let menu:Awaited<ReturnType<typeof readReaderPresentation>>['items']=[],search=false;
 try{const presentation=await readReaderPresentation();menu=presentation.items;search=presentation.features.search;}catch{}
 return <FumadocsFavoritesPage viewerId={access.viewer.id} data={data} state={state} locale={locale} menu={menu} search={search}/>;
}
