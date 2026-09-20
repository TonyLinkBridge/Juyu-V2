import {applicationAuthorization} from '../../../../server/authorization/application';
import {qaResponse} from '../../../../server/qa/http';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){return qaResponse(async()=>{const {id}=await params;const locale=new URL(request.url).searchParams.get('lang')==='en'?'en':'zh-CN';return (await applicationAuthorization()).qaAnswer(id,locale);});}
