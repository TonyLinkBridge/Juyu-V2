import {applicationAuthorization} from '../../../../../server/authorization/application';
import {announcementResponse,announcementBody} from '../../../../../server/announcements/http';
export const dynamic='force-dynamic';
export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}){return announcementResponse(async()=>{const service=await applicationAuthorization();await service.requireEditorAdmin();return service.saveAnnouncement((await params).id,await announcementBody(request));});}
