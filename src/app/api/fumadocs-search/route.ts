import {fumadocsSearchResults} from '../../../fumadocs/search';
import {parseFumadocsSearchRequest} from '../../../fumadocs/search-options';
import {applicationAuthorization} from '../../../server/authorization/application';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','Vary':'Cookie, Authorization','X-Content-Type-Options':'nosniff'};

export async function GET(request:Request){
 let parsed;
 try{parsed=parseFumadocsSearchRequest(new URL(request.url));}
 catch{return Response.json({error:'INVALID_INPUT'},{status:400,headers});}
 if(parsed.status==='empty')return Response.json([],{headers});
 try{
  const {search}=await(await applicationAuthorization()).search(parsed.query,undefined,parsed.scope,parsed.locale);
  return Response.json(fumadocsSearchResults(search,parsed.locale),{headers});
 }catch(error){
  const message=error instanceof Error?error.message:'';
  const status=message.startsWith('FORBIDDEN')?403:message==='AUTH_NOT_CONFIGURED'?503:500;
  return Response.json({error:status===403?'FORBIDDEN':status===503?'SERVICE_UNAVAILABLE':'INTERNAL_ERROR'},{status,headers});
 }
}
