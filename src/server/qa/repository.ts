import {requireFeature} from '../features/repository.ts';
import type {PoolClient} from 'pg';
import type {QaItem,QaPage} from '../../qa/model.ts';
import {positiveInteger} from '../../feedback/model.ts';
import {readReaderSections} from '../ops/repository.ts';
export async function readQa(client:PoolClient,page=1,category?:string,q=''):Promise<QaPage>{
 positiveInteger(page);
 if(category!==undefined&&(typeof category!=='string'||[...category].length>80||/[\u0000-\u001f\u007f-\u009f]/u.test(category)))throw new Error('INVALID_INPUT');
 if(typeof q!=='string'||[...q].length>120||/[\u0000-\u001f\u007f-\u009f]/u.test(q))throw new Error('INVALID_INPUT');
 await readReaderSections(client);
 if(q.trim())await requireFeature(client,'search');
 const source=q.trim()?'juyu.search_qa_publications($2)':'juyu.read_qa_publications()';
 const parameters=q.trim()?[category??null,q]:[category??null];
 const filter='($1::text IS NULL OR category=$1)';
 const total=(await client.query<{n:number}>(`SELECT count(*)::int AS n FROM ${source} WHERE ${filter}`,parameters)).rows[0].n;
 const pages=Math.max(1,Math.ceil(total/20));page=Math.min(page,pages);
 const items=(await client.query<QaItem>(`SELECT id,title,revision,tags,category,"position" FROM ${source} WHERE ${filter} ORDER BY "position",title COLLATE "C",id COLLATE "C" LIMIT 20 OFFSET $${parameters.length+1}`,[...parameters,(page-1)*20])).rows;
 const canEdit=(await client.query<{allowed:boolean}>('SELECT juyu.is_admin() AS allowed')).rows[0].allowed;
 const categories=(await client.query<{category:string}>('SELECT category FROM juyu.read_qa_publications() GROUP BY category ORDER BY category COLLATE \"C\"')).rows.map(row=>row.category);
 return {categories,q,items,total,page,pages,canEdit,...(category===undefined?{}:{category})};
}
