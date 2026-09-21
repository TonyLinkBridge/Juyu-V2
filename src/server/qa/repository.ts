import {requireFeature} from '../features/repository.ts';
import type {PoolClient} from 'pg';
import type {QaItem,QaPage} from '../../qa/model.ts';
import {positiveInteger} from '../../feedback/model.ts';
import {readReaderSections} from '../ops/repository.ts';
export async function readQa(client:PoolClient,page=1,category?:string,q='',locale:'zh-CN'|'en'='zh-CN',topic?:string):Promise<QaPage>{
 positiveInteger(page);
 if(category!==undefined&&(typeof category!=='string'||[...category].length>80||/[\u0000-\u001f\u007f-\u009f]/u.test(category)))throw new Error('INVALID_INPUT');
 if(topic!==undefined){if(typeof topic!=='string'||!topic.trim()||[...topic].length>40||/[\u0000-\u001f\u007f-\u009f]/u.test(topic))throw new Error('INVALID_INPUT');topic=topic.trim();}
 if(typeof q!=='string'||[...q].length>120||/[\u0000-\u001f\u007f-\u009f]/u.test(q))throw new Error('INVALID_INPUT');
 await readReaderSections(client);
 if(q.trim())await requireFeature(client,'search');
 const source=q.trim()?'juyu.search_qa_publications($3)':'juyu.read_qa_publications()';
 const parameters=q.trim()?[category??null,topic??null,q,locale]:[category??null,topic??null,locale];
 const filter=`($1::text IS NULL OR qa.category=$1) AND ($2::text IS NULL OR $2=ANY(qa.tags)) AND EXISTS(SELECT 1 FROM juyu.read_publication_language(qa.id) l WHERE l.locale=$${parameters.length})`;
 const total=(await client.query<{n:number}>(`SELECT count(*)::int AS n FROM ${source} qa WHERE ${filter}`,parameters)).rows[0].n;
 const pages=Math.max(1,Math.ceil(total/20));page=Math.min(page,pages);
 const items=(await client.query<QaItem>(`SELECT qa.id,qa.title,qa.revision,qa.tags,qa.category,qa."position" FROM ${source} qa WHERE ${filter} ORDER BY qa."position",qa.title COLLATE "C",qa.id COLLATE "C" LIMIT 20 OFFSET $${parameters.length+1}`,[...parameters,(page-1)*20])).rows;
 const canEdit=(await client.query<{allowed:boolean}>('SELECT juyu.is_admin() AS allowed')).rows[0].allowed;
 const categories=(await client.query<{category:string}>('SELECT qa.category FROM juyu.read_qa_publications() qa WHERE EXISTS(SELECT 1 FROM juyu.read_publication_language(qa.id) l WHERE l.locale=$1) GROUP BY qa.category ORDER BY qa.category COLLATE \"C\"',[locale])).rows.map(row=>row.category);
 const topics=(await client.query<{topic:string}>('SELECT topic FROM (SELECT DISTINCT topic FROM juyu.read_qa_publications() qa CROSS JOIN LATERAL unnest(qa.tags) topic WHERE EXISTS(SELECT 1 FROM juyu.read_publication_language(qa.id) l WHERE l.locale=$1)) published_topics ORDER BY topic COLLATE \"C\"',[locale])).rows.map(row=>row.topic);
 return {categories,topics,q,items,total,page,pages,canEdit,...(category===undefined?{}:{category}),...(topic===undefined?{}:{topic})};
}
