import {requireFeature} from '../features/repository.ts';
import type {PoolClient} from 'pg';
import {recentInput,type RecentReceipt,type RecentItem,type RecentPage} from '../../recent/model.ts';
import {positiveInteger} from '../../feedback/model.ts';
export async function recordRecent(c:PoolClient,id:string,input:unknown):Promise<RecentReceipt>{await requireFeature(c,'recent');
 if(typeof id!=='string'||!id.trim()||id!==id.trim()||[...id].length>200||/[\u0000-\u001f\u007f-\u009f]/u.test(id))throw new Error('INVALID_INPUT');
 const x=recentInput(input);
 const row=(await c.query<Omit<RecentReceipt,'viewedAt'>&{viewedAt:Date}>('SELECT document_id AS "documentId",revision,viewed_at AS "viewedAt" FROM juyu.record_recent_view($1,$2)',[id,x.revision])).rows[0];
 return {...row,viewedAt:row.viewedAt.toISOString()};
}
export async function readRecent(c:PoolClient,page=1,locale:'zh-CN'|'en'='zh-CN'):Promise<RecentPage>{await requireFeature(c,'recent');
 positiveInteger(page);
 // A repeatable-read read-only caller keeps counts, access decisions and page rows in one snapshot.
 const total=(await c.query<{n:number}>('SELECT count(*)::int AS n FROM juyu.read_recent_publications() item WHERE EXISTS(SELECT 1 FROM juyu.read_publication_language(item.id) l WHERE l.locale=$1)',[locale])).rows[0].n;
 const pages=Math.max(1,Math.ceil(total/20));page=Math.min(page,pages);
 const rows=(await c.query<Omit<RecentItem,'viewedAt'>&{viewedAt:Date}>('SELECT juyu.publication_number(item.id) AS "publicationNumber",item.id,item.title,item.kind,item.revision,item.tags,item.viewed_revision AS "viewedRevision",item.viewed_at AS "viewedAt" FROM juyu.read_recent_publications() item WHERE EXISTS(SELECT 1 FROM juyu.read_publication_language(item.id) l WHERE l.locale=$1) ORDER BY item.viewed_at DESC,item.id COLLATE "C" LIMIT 20 OFFSET $2',[locale,(page-1)*20])).rows;
 return {items:rows.map(row=>({...row,viewedAt:row.viewedAt.toISOString()})),total,page,pages};
}
