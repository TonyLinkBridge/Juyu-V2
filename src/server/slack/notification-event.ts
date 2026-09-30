export type NotificationEvent='revision_started'|'submitted'|'approved'|'changes_requested'|'published'|'updated';

export function notificationEvent(action:string,previousStatus:string,previousPublishedRevision:number|null):NotificationEvent|null {
 if(action==='edit')return previousStatus==='published'&&previousPublishedRevision!==null?'revision_started':null;
 if(action==='submit')return 'submitted';
 if(action==='approve')return 'approved';
 if(action==='reject')return 'changes_requested';
 if(action==='publish'||action==='direct_publish')return previousPublishedRevision===null?'published':'updated';
 return null;
}
