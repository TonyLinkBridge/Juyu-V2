import {applicationAuthorization} from '../../../../../server/authorization/application';
import {diagramResponse} from '../../../../../server/science/response';
export const dynamic='force-dynamic';
export async function GET(request:Request,context:{params:Promise<{id:string}>}){try{const service=await applicationAuthorization();const p=new URL(request.url).searchParams;return diagramResponse((await context.params).id,Number(p.get('revision')),p.get('block')??'',service);}catch{return Response.json({error:'流程图不可读取。'},{status:503,headers:{'Cache-Control':'private, no-store'}});}}
