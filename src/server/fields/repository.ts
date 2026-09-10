import type {PoolClient} from 'pg';
import {normalizeFieldDefinitions,parseFieldWrite,type FieldDefinition} from '../../fields/model.ts';
export async function readFieldDefinitions(c:PoolClient):Promise<FieldDefinition[]>{
 const value=(await c.query('SELECT juyu.read_field_definitions() AS fields')).rows[0].fields;
 return normalizeFieldDefinitions(value);
}
export async function writeFieldDefinition(c:PoolClient,id:string,input:unknown):Promise<FieldDefinition>{
 if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id))throw new Error('INVALID_INPUT');
 const {expectedVersion,...config}=parseFieldWrite(input);
 const result=(await c.query('SELECT juyu.write_field_definition($1,$2,$3) AS field',[id,expectedVersion,JSON.stringify(config)])).rows[0].field;
 return normalizeFieldDefinitions([result])[0];
}
