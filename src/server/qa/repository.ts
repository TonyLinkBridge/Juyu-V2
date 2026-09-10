import type {PoolClient} from 'pg';
import type {QaItem,QaPage} from '../../qa/model.ts';
import {positiveInteger} from '../../feedback/model.ts';
import {readReaderSections} from '../ops/repository.ts';
export async function readQa(client:PoolClient,page=1,category?:string):Promise<QaPage>{
 positiveInteger(page);
 if(category!==undefined&&(typeof category!=='string'||[...category].length>80||/[\u0000-\u001f\u007f-\u009f]/u.test(category)))throw new Error('INVALID_INPUT');
 await readReaderSections(client);
 const filter='($1::text IS NULL OR category=$1)';
 const total=(await client.query<{n:number}>(`SELECT count(*)::int AS n FROM juyu.read_qa_publications() WHERE ${filter}`,[category??null])).rows[0].n;
 const pages=Math.max(1,Math.ceil(total/20));page=Math.min(page,pages);
 const items=(await client.query<QaItem>(`SELECT id,title,revision,tags,category,"position" FROM juyu.read_qa_publications() WHERE ${filter} ORDER BY "position",title COLLATE "C",id COLLATE "C" LIMIT 20 OFFSET $2`,[category??null,(page-1)*20])).rows;
 const canEdit=(await client.query<{allowed:boolean}>('SELECT juyu.is_admin() AS allowed')).rows[0].allowed;
 return {items,total,page,pages,canEdit,...(category===undefined?{}:{category})};
}
