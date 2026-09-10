import type {PoolClient} from 'pg';
import {normalizeCategoryDefinitions,parseCategoryWrite,type CategoryDefinition} from '../../categories/model.ts';
export async function readCategoryDefinitions(c:PoolClient):Promise<CategoryDefinition[]>{return normalizeCategoryDefinitions((await c.query('SELECT juyu.read_category_definitions() AS categories')).rows[0].categories);}
export async function writeCategoryDefinition(c:PoolClient,id:string,input:unknown):Promise<CategoryDefinition>{
 if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id))throw new Error('INVALID_INPUT');
 const {expectedVersion,...config}=parseCategoryWrite(input);return normalizeCategoryDefinitions([(await c.query('SELECT juyu.write_category_definition($1,$2,$3) AS category',[id,expectedVersion,JSON.stringify(config)])).rows[0].category])[0];
}
