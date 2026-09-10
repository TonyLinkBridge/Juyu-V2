import type {PoolClient} from 'pg';
import type {ReferenceItem,ReferencePage,ReferenceDetail,ReferenceTableData} from '../../reference/model.ts';
import {positiveInteger} from '../../feedback/model.ts';
import {reviewId} from '../../review/model.ts';
import {parseReaderBody} from '../../reader/body.ts';
import {editorMedia} from '../../editor/document.ts';
import {normalizeBlocks} from '../../media/model.ts';
import {readReaderSections} from '../ops/repository.ts';

export async function readReference(client:PoolClient,page=1):Promise<ReferencePage>{
 positiveInteger(page);await readReaderSections(client);
 // Pagination and the editing entry use the same current-identity snapshot.
 const total=(await client.query<{n:number}>('SELECT count(*)::int AS n FROM juyu.read_reference_publications()')).rows[0].n;
 const pages=Math.max(1,Math.ceil(total/20));page=Math.min(page,pages);
 const items=(await client.query<ReferenceItem>('SELECT id,title,revision,tags FROM juyu.read_reference_publications() ORDER BY title COLLATE "C",id COLLATE "C" LIMIT 20 OFFSET $1',[(page-1)*20])).rows;
 const canEdit=(await client.query<{allowed:boolean}>('SELECT juyu.is_admin() AS allowed')).rows[0].allowed;
 return {items,total,page,pages,canEdit};
}

export async function readReferenceDetail(client:PoolClient,id:string):Promise<ReferenceDetail>{
 reviewId(id);await readReaderSections(client);
 const item=(await client.query<ReferenceItem>('SELECT id,title,revision,tags FROM juyu.read_reference_publications() WHERE id=$1',[id])).rows[0];
 if(!item)throw new Error('NOT_FOUND');
 const publication=(await client.query<{body:string}>('SELECT body FROM juyu.read_publication($1) WHERE kind=\'reference\' AND revision_id=$2',[id,item.revision])).rows[0];
 if(!publication)throw new Error('NOT_FOUND');
 // Reuse the employee reader parser. A corrupt structured document throws;
 // its JSON is never interpreted as legacy prose or returned to the client.
 const parsed=parseReaderBody(publication.body);const tables:ReferenceTableData[]=[];
 if(parsed.editorBlocks){
  for(const block of editorMedia(parsed.editorBlocks))if(block.type==='table')tables.push({id:block.id,headers:block.headers,rows:block.rows});
 }else{
  for(const block of parsed.blocks)if(block.type==='table')tables.push({id:`legacy:${tables.length+1}`,headers:block.headers,rows:block.rows});
  const blocks=(await client.query('SELECT juyu.read_publication_blocks($1) AS blocks',[id])).rows[0]?.blocks;
  for(const block of normalizeBlocks(blocks))if(block.type==='table')tables.push({id:block.id,headers:block.headers,rows:block.rows});
 }
 return {...item,tables};
}
