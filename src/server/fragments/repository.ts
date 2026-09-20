import type {PoolClient} from 'pg';
import {reusableFragmentInput,reusableAssetIds,type ReusableFragment} from '../../editor/reusable-fragment.ts';

async function requireReadyAssets(c:PoolClient,blocks:ReusableFragment['blocks']){
 const ids=reusableAssetIds(blocks);if(!ids.length)return;
 const available=(await c.query<{id:string}>("SELECT a.id::text AS id FROM juyu.assets a JOIN juyu.documents d ON d.id=a.document_id WHERE a.id=ANY($1::uuid[]) AND a.status='ready' AND d.lifecycle='active'",[ids])).rows;
 if(available.length!==ids.length)throw new Error('FRAGMENT_ASSET_UNAVAILABLE');
}

export async function readReusableFragments(c:PoolClient):Promise<ReusableFragment[]>{
 const rows=(await c.query<{id:string;familyId:string;version:number;title:string;blocks:ReusableFragment['blocks'];createdAt:Date;sourceDocumentId:string|null}>('SELECT id,family_id AS "familyId",version,title,blocks,created_at AS "createdAt",source_document_id AS "sourceDocumentId" FROM (SELECT DISTINCT ON (family_id) * FROM juyu.reusable_fragments ORDER BY family_id,version DESC) latest ORDER BY created_at DESC,id DESC LIMIT 50')).rows;
 return rows.map(row=>({...row,createdAt:row.createdAt.toISOString()}));
}
export async function createReusableFragment(c:PoolClient,input:unknown):Promise<ReusableFragment>{
 const value=reusableFragmentInput(input);
 await requireReadyAssets(c,value.blocks);
 const row=(await c.query<{id:string;familyId:string;version:number;title:string;blocks:ReusableFragment['blocks'];createdAt:Date;sourceDocumentId:string|null}>('INSERT INTO juyu.reusable_fragments(id,family_id,version,title,blocks,created_by) VALUES($1,$1,1,$2,$3::jsonb,juyu.actor_id()) ON CONFLICT(id) DO NOTHING RETURNING id,family_id AS "familyId",version,title,blocks,created_at AS "createdAt",source_document_id AS "sourceDocumentId"',[value.id,value.title,JSON.stringify(value.blocks)])).rows[0];
 if(!row)throw new Error('FRAGMENT_EXISTS');
 return {...row,createdAt:row.createdAt.toISOString()};
}
export async function updateReusableFragment(c:PoolClient,familyId:string,expectedVersion:number,input:unknown):Promise<ReusableFragment>{
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(familyId)||!Number.isSafeInteger(expectedVersion)||expectedVersion<1)throw new Error('INVALID_INPUT');
 const value=reusableFragmentInput(input);
 await c.query('SELECT pg_advisory_xact_lock(8457025,hashtext($1))',[familyId]);
 await requireReadyAssets(c,value.blocks);
 const current=(await c.query<{version:number;sourceDocumentId:string|null}>('SELECT version,source_document_id AS "sourceDocumentId" FROM juyu.reusable_fragments WHERE family_id=$1 ORDER BY version DESC LIMIT 1',[familyId])).rows[0];
 if(!current)throw new Error('FRAGMENT_NOT_FOUND');
 if(current.version!==expectedVersion)throw new Error('CONFLICT');
 try{
  const row=(await c.query<{id:string;familyId:string;version:number;title:string;blocks:ReusableFragment['blocks'];createdAt:Date;sourceDocumentId:string|null}>('INSERT INTO juyu.reusable_fragments(id,family_id,version,title,blocks,created_by,source_document_id) VALUES($1,$2,$3,$4,$5::jsonb,juyu.actor_id(),$6) RETURNING id,family_id AS "familyId",version,title,blocks,created_at AS "createdAt",source_document_id AS "sourceDocumentId"',[value.id,familyId,expectedVersion+1,value.title,JSON.stringify(value.blocks),current.sourceDocumentId])).rows[0];
  return {...row,createdAt:row.createdAt.toISOString()};
 }catch(error){if(error&&typeof error==='object'&&'code' in error&&error.code==='23505')throw new Error('CONFLICT');throw error;}
}
