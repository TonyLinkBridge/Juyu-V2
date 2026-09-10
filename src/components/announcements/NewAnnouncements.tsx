import {applicationAuthorization} from '../../server/authorization/application';
import type {Announcement} from '../../announcements/model';
import {AnnouncementFeed} from './AnnouncementFeed';
import '../../app/announcements.css';
export async function NewAnnouncements(){let initial:Announcement[]|undefined;try{initial=await(await applicationAuthorization()).announcements();}catch{}return <AnnouncementFeed initial={initial}/>;}
