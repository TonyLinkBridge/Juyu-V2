import {applicationAuthorization} from '../../../../server/authorization/application';
import {workspaceResponse} from '../../../../server/workspace/http';
import type {QueryInput} from '../../../../workspace/model';
export const dynamic='force-dynamic';
export async function GET(request:Request){return workspaceResponse(async()=>{
 const service=await applicationAuthorization();const params=new URL(request.url).searchParams;const input:QueryInput={};
 for(const key of ['q','scope','status','kind','page','view']){const values=params.getAll(key);if(values.length)input[key]=values.length===1?values[0]:values;}
 return service.workspace(input);
});}
