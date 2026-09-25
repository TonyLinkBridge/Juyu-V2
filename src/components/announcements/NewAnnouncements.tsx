import {applicationAuthorization} from '../../server/authorization/application';
import type {Announcement} from '../../announcements/model';
import {AnnouncementFeed} from './AnnouncementFeed';
import '../../app/announcements.css';
export async function NewAnnouncements({silentFailure=false}:{silentFailure?:boolean}={}){let initial:Announcement[]|undefined;try{initial=await(await applicationAuthorization()).announcements();}catch{}if(initial===undefined&&silentFailure)return null;return <AnnouncementFeed initial={initial}/>;}
