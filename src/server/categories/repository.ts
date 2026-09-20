import type {PoolClient} from 'pg';
import {normalizeCategoryDefinitions,parseCategoryWrite,type CategoryDefinition} from '../../categories/model.ts';
export async function readCategoryDefinitions(c:PoolClient):Promise<CategoryDefinition[]>{
 const definitions=normalizeCategoryDefinitions((await c.query('SELECT juyu.read_category_definitions() AS categories')).rows[0].categories);
 const icons=await c.query<{category_id:string;icon_key:CategoryDefinition['iconKey']}>('SELECT category_id,icon_key FROM juyu.category_icons');
 const byId=new Map(icons.rows.map(row=>[row.category_id,row.icon_key]));
 const names=await c.query<{category_id:string;name:string|null}>('SELECT category_id,name FROM juyu.read_category_english_names()');
 const english=new Map(names.rows.map(row=>[row.category_id,row.name]));
 return definitions.map(category=>({...category,...(byId.has(category.id)?{iconKey:byId.get(category.id)}:{}),...(english.has(category.id)?{englishName:english.get(category.id)}:{})}));
}
export async function writeCategoryDefinition(c:PoolClient,id:string,input:unknown):Promise<CategoryDefinition>{
 if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id))throw new Error('INVALID_INPUT');
 const {expectedVersion,iconKey,englishName,...config}=parseCategoryWrite(input);
 const saved=normalizeCategoryDefinitions([(await c.query('SELECT juyu.write_category_definition($1,$2,$3) AS category',[id,expectedVersion,JSON.stringify(config)])).rows[0].category])[0];
 if(iconKey!==undefined)await c.query('SELECT juyu.set_category_icon($1,$2,$3)',[id,saved.version,iconKey]);
 if(englishName!==undefined)await c.query('SELECT juyu.set_category_english_name($1,$2,$3)',[id,saved.version,englishName]);
 return {...saved,...(iconKey===undefined?{}:{iconKey}),...(englishName===undefined?{}:{englishName})};
}
