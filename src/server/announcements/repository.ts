import type {PoolClient} from 'pg';
import {announcementId,parseAnnouncementWrite,parseReceipt,normalizeAnnouncements,normalizeReceipt} from '../../announcements/model.ts';
export async function readAnnouncements(c:PoolClient,admin=false){return normalizeAnnouncements((await c.query('SELECT juyu.read_announcements($1) AS result',[admin])).rows[0].result);}
export async function writeAnnouncement(c:PoolClient,id:string,input:unknown){const x=parseAnnouncementWrite(input),{expectedVersion,...config}=x;return normalizeAnnouncements([(await c.query('SELECT juyu.write_announcement($1,$2,$3) AS result',[announcementId(id),expectedVersion,JSON.stringify(config)])).rows[0].result])[0];}
export async function recordReceipt(c:PoolClient,id:string,input:unknown){const x=parseReceipt(input);return normalizeReceipt((await c.query('SELECT juyu.record_announcement_receipt($1,$2,$3) AS result',[announcementId(id),x.revision,x.action])).rows[0].result);}
