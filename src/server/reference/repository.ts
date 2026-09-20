import type {PoolClient} from 'pg';
import type {ReferenceItem,ReferencePage,ReferenceDetail,ReferenceTableData} from '../../reference/model.ts';
import {positiveInteger} from '../../feedback/model.ts';
import {reviewId} from '../../review/model.ts';
import {parseReaderBody} from '../../reader/body.ts';
import type {EditorBlock} from '../../editor/document.ts';
import {nativeReferenceTable} from '../../reference/native.ts';
import {normalizeBlocks} from '../../media/model.ts';
import {readReaderSections} from '../ops/repository.ts';

async function readReferenceDetailVerified(client:PoolClient,id:string,locale:'zh-CN'|'en'='zh-CN'):Promise<ReferenceDetail>{
 reviewId(id);
 const item=(await client.query<ReferenceItem>('SELECT item.id,item.title,item.revision,item.tags,juyu.publication_number(item.id) AS "publicationNumber" FROM juyu.read_reference_publications() item WHERE item.id=$1 AND EXISTS(SELECT 1 FROM juyu.read_publication_language(item.id) l WHERE l.locale=$2)',[id,locale])).rows[0];
 if(!item)throw new Error('NOT_FOUND');
 const publication=(await client.query<{body:string}>("SELECT body FROM juyu.read_publication($1) WHERE kind='reference' AND revision_id=$2",[id,item.revision])).rows[0];
 if(!publication)throw new Error('NOT_FOUND');

 // Reuse the employee reader parser. A corrupt structured document throws;
 // its JSON is never interpreted as legacy prose or returned to the client.
 const parsed=parseReaderBody(publication.body);const tables:ReferenceTableData[]=[];

 if(parsed.editorBlocks){
  const native=(nodes:EditorBlock[])=>{for(const b of nodes){
   if(b.type==='table')tables.push(nativeReferenceTable(b));
   else if(b.type==='juyu'){const legacy=normalizeBlocks([JSON.parse(b.props.payload)])[0];if(legacy.type==='table')tables.push({id:b.id,headers:legacy.headers,rows:legacy.rows});}
   native(b.children);
  }};native(parsed.editorBlocks);
 }else{
  for(const block of parsed.blocks)if(block.type==='table')tables.push({id:`legacy:${tables.length+1}`,headers:block.headers,rows:block.rows});
  const blocks=(await client.query('SELECT juyu.read_publication_blocks($1) AS blocks',[id])).rows[0]?.blocks;
  for(const block of normalizeBlocks(blocks))if(block.type==='table')tables.push({id:block.id,headers:block.headers,rows:block.rows});
 }

 return {...item,tables};
}

export async function readReference(client:PoolClient,page=1,locale:'zh-CN'|'en'='zh-CN'):Promise<ReferencePage>{
 positiveInteger(page);await readReaderSections(client);
 // Pagination and the editing entry use the same current-identity snapshot.
 const total=(await client.query<{n:number}>('SELECT count(*)::int AS n FROM juyu.read_reference_publications() item WHERE EXISTS(SELECT 1 FROM juyu.read_publication_language(item.id) l WHERE l.locale=$1)',[locale])).rows[0].n;
 const pages=Math.max(1,Math.ceil(total/20));page=Math.min(page,pages);
 const items=(await client.query<ReferenceItem>('SELECT item.id,item.title,item.revision,item.tags,juyu.publication_number(item.id) AS "publicationNumber" FROM juyu.read_reference_publications() item WHERE EXISTS(SELECT 1 FROM juyu.read_publication_language(item.id) l WHERE l.locale=$1) ORDER BY item.title COLLATE "C",item.id COLLATE "C" LIMIT 20 OFFSET $2',[locale,(page-1)*20])).rows;
 const canEdit=(await client.query<{allowed:boolean}>('SELECT juyu.is_admin() AS allowed')).rows[0].allowed;
 return {items,total,page,pages,canEdit};
}

export async function readReferenceDetail(client:PoolClient,id:string,locale:'zh-CN'|'en'='zh-CN'):Promise<ReferenceDetail>{
 await readReaderSections(client);
 return readReferenceDetailVerified(client,id,locale);
}

export async function readReferencePage(client:PoolClient,page=1,article?:string,locale:'zh-CN'|'en'='zh-CN'):Promise<{data:ReferencePage;detail?:ReferenceDetail;detailState:'idle'|'ready'|'unavailable'}>{
 positiveInteger(page);await readReaderSections(client);

 const total=(await client.query<{n:number}>('SELECT count(*)::int AS n FROM juyu.read_reference_publications() item WHERE EXISTS(SELECT 1 FROM juyu.read_publication_language(item.id) l WHERE l.locale=$1)',[locale])).rows[0].n;
 const pages=Math.max(1,Math.ceil(total/20));page=Math.min(page,pages);
 const items=(await client.query<ReferenceItem>('SELECT item.id,item.title,item.revision,item.tags,juyu.publication_number(item.id) AS "publicationNumber" FROM juyu.read_reference_publications() item WHERE EXISTS(SELECT 1 FROM juyu.read_publication_language(item.id) l WHERE l.locale=$1) ORDER BY item.title COLLATE "C",item.id COLLATE "C" LIMIT 20 OFFSET $2',[locale,(page-1)*20])).rows;
 const canEdit=(await client.query<{allowed:boolean}>('SELECT juyu.is_admin() AS allowed')).rows[0].allowed;
 const data={items,total,page,pages,canEdit};

 const selected=article??items[0]?.id;
 if(!selected)return {data,detailState:'idle'};

 try{
  const detail=await readReferenceDetailVerified(client,selected,locale);
  return {data,detail,detailState:'ready'};
 }catch{
  return {data,detailState:'unavailable'};
 }
}
