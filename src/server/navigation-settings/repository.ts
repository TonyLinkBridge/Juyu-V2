import {readFeatureFlags} from '../features/repository.ts';
import type {PoolClient} from 'pg';
import {normalizeNavigationConfig,parseNavigationWrite,normalizeMenuItems,type NavigationConfig,type MenuItem} from '../../navigation-settings/model.ts';
export async function readNavigationSettings(c:PoolClient):Promise<NavigationConfig>{return normalizeNavigationConfig((await c.query('SELECT juyu.read_navigation_settings() AS config')).rows[0].config);}
export async function writeNavigationSettings(c:PoolClient,input:unknown):Promise<NavigationConfig>{const value=parseNavigationWrite(input);return normalizeNavigationConfig((await c.query('SELECT juyu.write_navigation_settings($1,$2) AS config',[value.expectedVersion,JSON.stringify(value.entries)])).rows[0].config);}
export async function readReaderMenu(c:PoolClient):Promise<MenuItem[]>{const flags=await readFeatureFlags(c);return normalizeMenuItems((await c.query('SELECT juyu.read_reader_menu() AS items')).rows[0].items).filter(item=>!(item.href==='/help-centre/favorites'&&!flags.favorites||item.href==='/help-centre/recent'&&!flags.recent||item.href==='/help-centre/forms'&&!flags.forms));}
