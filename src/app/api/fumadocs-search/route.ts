import {parseSearchQuery} from '../../../reader/search';
import {fumadocsSearchResults} from '../../../fumadocs/search';
import {applicationAuthorization} from '../../../server/authorization/application';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','Vary':'Cookie, Authorization','X-Content-Type-Options':'nosniff'};

export async function GET(request:Request){
 const url=new URL(request.url),keys=[...url.searchParams.keys()];
 if(keys.some(key=>!['query','locale'].includes(key))||url.searchParams.getAll('query').length!==1||url.searchParams.getAll('locale').length>1)return Response.json({error:'INVALID_INPUT'},{status:400,headers});
 const parsed=parseSearchQuery(url.searchParams.get('query')??undefined);
 const rawLocale=url.searchParams.get('locale'),locale=rawLocale===null||rawLocale==='zh-CN'?'zh-CN':rawLocale==='en'?'en':null;
 if(!locale||parsed.status==='invalid')return Response.json({error:'INVALID_INPUT'},{status:400,headers});
 if(parsed.status==='empty')return Response.json([],{headers});
 try{
  const {search}=await(await applicationAuthorization()).search(parsed.query,undefined,'all',locale);
  return Response.json(fumadocsSearchResults(search),{headers});
 }catch(error){
  const message=error instanceof Error?error.message:'';
  const status=message.startsWith('FORBIDDEN')?403:message==='AUTH_NOT_CONFIGURED'?503:500;
  return Response.json({error:status===403?'FORBIDDEN':status===503?'SERVICE_UNAVAILABLE':'INTERNAL_ERROR'},{status,headers});
 }
}
