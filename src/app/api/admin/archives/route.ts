import {applicationAuthorization} from '../../../../server/authorization/application';
import {availabilityResponse} from '../../../../server/availability/http';
export const dynamic='force-dynamic';
export async function GET(request:Request){return availabilityResponse(async()=>{
 const service=await applicationAuthorization();await service.requireEditorAdmin();const params=new URL(request.url).searchParams;
 if([...params.keys()].some(k=>k!=='page')||params.getAll('page').length>1)throw new Error('INVALID_INPUT');
 const page=params.get('page')??'1';if(!/^[1-9]\d{0,5}$/.test(page))throw new Error('INVALID_INPUT');return service.archives(Number(page));
});}
