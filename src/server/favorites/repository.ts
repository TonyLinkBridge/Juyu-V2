import {requireFeature} from '../features/repository.ts';
import type {PoolClient} from 'pg';
import {favoriteInput,type FavoriteState,type FavoriteItem,type FavoritesPage} from '../../favorites/model.ts';
import {positiveInteger} from '../../feedback/model.ts';
function documentId(id:string):void {
 if(typeof id!=='string'||!id.trim()||id!==id.trim()||[...id].length>200||/[\u0000-\u001f\u007f-\u009f]/u.test(id))throw new Error('INVALID_INPUT');
}
async function verifiedIdentity(c:PoolClient):Promise<void>{
 const allowed=(await c.query<{allowed:boolean}>(`SELECT EXISTS(SELECT 1 FROM juyu.current_identity() i
 JOIN juyu.members m ON m.clerk_user_id=i.member_id
 WHERE nullif(btrim(m.verified_email),'') IS NOT NULL AND m.observed_at IS NOT NULL) AS allowed`)).rows[0].allowed;
 if(!allowed)throw new Error('FORBIDDEN');
}
export async function readFavorite(c:PoolClient,id:string,revision:number):Promise<FavoriteState>{await requireFeature(c,'favorites');
 documentId(id);positiveInteger(revision);await verifiedIdentity(c);
 const permission=(await c.query('SELECT juyu.can_read_document($1) AS allowed,juyu.can_read_revision($1,$2) AS current',[id,revision])).rows[0];
 if(!permission.allowed)throw new Error('NOT_FOUND');if(!permission.current)throw new Error('VERSION_CHANGED');
 const saved=(await c.query<{saved:boolean}>('SELECT EXISTS(SELECT 1 FROM juyu.favorites WHERE member_id=juyu.actor_id() AND document_id=$1) AS saved',[id])).rows[0].saved;
 return {documentId:id,revision,saved};
}
export async function writeFavorite(c:PoolClient,id:string,input:unknown):Promise<FavoriteState>{await requireFeature(c,'favorites');
 documentId(id);const x=favoriteInput(input);
 return (await c.query<FavoriteState>('SELECT document_id AS "documentId",revision,saved FROM juyu.save_favorite($1,$2,$3)',[id,x.revision,x.saved])).rows[0];
}
export async function readFavorites(c:PoolClient,page=1):Promise<FavoritesPage>{await requireFeature(c,'favorites');
 positiveInteger(page);await verifiedIdentity(c);
 // The caller uses a repeatable-read transaction, so count and page share access decisions.
 const total=(await c.query<{n:number}>('SELECT count(*)::int AS n FROM juyu.read_favorite_publications()')).rows[0].n;
 const pages=Math.max(1,Math.ceil(total/20));page=Math.min(page,pages);
 const rows=(await c.query<Omit<FavoriteItem,'savedAt'>&{savedAt:Date}>('SELECT id,title,kind,revision,tags,saved_at AS "savedAt" FROM juyu.read_favorite_publications() ORDER BY saved_at DESC,id COLLATE "C" LIMIT 20 OFFSET $1',[(page-1)*20])).rows;
 return {items:rows.map(row=>({...row,savedAt:row.savedAt.toISOString()})),total,page,pages};
}
