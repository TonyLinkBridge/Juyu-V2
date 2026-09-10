import {applicationAuthorization} from '../../../../server/authorization/application';
import {recentResponse} from '../../../../server/recent/http';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
export async function POST(request:Request,{params}:Context){return recentResponse(async()=>{if(new URL(request.url).search)throw new Error('INVALID_INPUT');const {id}=await params,service=await applicationAuthorization();let input:unknown;try{input=await request.json();}catch{throw new Error('INVALID_INPUT');}return service.recordRecent(id,input);});}
