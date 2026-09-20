import type {PoolClient} from 'pg';
import type {OpsItem,OpsPage,ReaderSections} from '../../ops/model.ts';
import {positiveInteger} from '../../feedback/model.ts';

export async function readReaderSections(client:PoolClient):Promise<ReaderSections>{
 const identity=(await client.query<{role:string}>(`SELECT i.role FROM juyu.current_identity() i
  JOIN juyu.members m ON m.clerk_user_id=i.member_id
  WHERE m.verified_email IS NOT NULL AND m.observed_at IS NOT NULL`)).rows[0];
 if(!identity)throw new Error('FORBIDDEN');
 return {ops:identity.role==='ops'||identity.role==='admin'};
}

export async function readFirstOpsId(client:PoolClient,locale:'zh-CN'|'en'='zh-CN'):Promise<string|null>{
 if(!(await readReaderSections(client)).ops)throw new Error('FORBIDDEN');
 const row=(await client.query<{id:string}>('SELECT item.id FROM juyu.read_ops_publications() item WHERE EXISTS(SELECT 1 FROM juyu.read_publication_language(item.id) l WHERE l.locale=$1) ORDER BY item.title COLLATE "C",item.id COLLATE "C" LIMIT 1',[locale])).rows[0];
 return row?.id??null;
}

export async function readOps(client:PoolClient,page=1,locale:'zh-CN'|'en'='zh-CN'):Promise<OpsPage>{
 positiveInteger(page);
 if(!(await readReaderSections(client)).ops)throw new Error('FORBIDDEN');

 // Both queries share the enclosing repeatable-read snapshot. SQL projects only
 // current allowed OPS publications without opening raw document access.
 const total=(await client.query<{n:number}>('SELECT count(*)::int AS n FROM juyu.read_ops_publications() item WHERE EXISTS(SELECT 1 FROM juyu.read_publication_language(item.id) l WHERE l.locale=$1)',[locale])).rows[0].n;
 const pages=Math.max(1,Math.ceil(total/30));page=Math.min(page,pages);
 const items=(await client.query<OpsItem>('SELECT item.id,item.title,item.revision,item.tags FROM juyu.read_ops_publications() item WHERE EXISTS(SELECT 1 FROM juyu.read_publication_language(item.id) l WHERE l.locale=$1) ORDER BY item.title COLLATE "C",item.id COLLATE "C" LIMIT 30 OFFSET $2',[locale,(page-1)*30])).rows;

 return {items,total,page,pages};
}
