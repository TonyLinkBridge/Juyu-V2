import {positiveInteger} from '../../../../../feedback/model';
import {publicationMarkdown} from '../../../../../reader/markdown';
import {applicationAuthorization} from '../../../../../server/authorization/application';

export const dynamic='force-dynamic';

const headers={
 'Cache-Control':'private, no-store',
 Vary:'Cookie, Authorization',
 'Content-Type':'text/markdown; charset=utf-8',
 'X-Content-Type-Options':'nosniff',
};

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const url=new URL(request.url);
  if([...url.searchParams.keys()].some(key=>key!=='revision')||url.searchParams.getAll('revision').length!==1)throw new Error('INVALID_INPUT');
  const revision=positiveInteger(Number(url.searchParams.get('revision')));
  const service=await applicationAuthorization();
  const result=await service.reader((await params).id);
  if(!result.article)throw new Error('NOT_FOUND');
  if(result.article.revision!==revision)throw new Error('VERSION_CHANGED');
  return new Response(publicationMarkdown(result.article),{status:200,headers});
 }catch(error){
  const raw=error instanceof Error?error.message.split(':')[0]:'';
  const statuses:Record<string,number>={INVALID_INPUT:400,FORBIDDEN:403,NOT_FOUND:404,VERSION_CHANGED:409,AUTH_NOT_CONFIGURED:503};
  const code=Object.hasOwn(statuses,raw)?raw:'SERVICE_UNAVAILABLE';
  return Response.json({error:code},{status:statuses[code]??503,headers:{'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}});
 }
}
