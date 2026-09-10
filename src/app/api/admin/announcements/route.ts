import {applicationAuthorization} from '../../../../server/authorization/application';
import {announcementResponse} from '../../../../server/announcements/http';
export const dynamic='force-dynamic';
export async function GET(){return announcementResponse(async()=>(await applicationAuthorization()).announcements(true));}
