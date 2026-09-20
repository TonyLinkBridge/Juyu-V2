import {applicationAuthorization} from '../../../server/authorization/application';
import {favoritesPage,favoritesResponse} from '../../../server/favorites/http';
export const dynamic='force-dynamic';
export async function GET(request:Request){return favoritesResponse(async()=>{const url=new URL(request.url),lang=url.searchParams.get('lang');if(lang!==null&&lang!=='en')throw new Error('INVALID_INPUT');url.searchParams.delete('lang');const page=favoritesPage(url),service=await applicationAuthorization();return service.favorites(page,lang==='en'?'en':'zh-CN');});}
