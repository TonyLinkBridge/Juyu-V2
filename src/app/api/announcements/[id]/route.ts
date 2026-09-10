import {applicationAuthorization} from '../../../../server/authorization/application';
import {announcementResponse,announcementBody} from '../../../../server/announcements/http';
export const dynamic='force-dynamic';
export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}){return announcementResponse(async()=>{const service=await applicationAuthorization();return service.announcementReceipt((await params).id,await announcementBody(request));});}
