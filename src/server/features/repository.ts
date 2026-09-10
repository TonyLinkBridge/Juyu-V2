import type {PoolClient} from 'pg';
import {normalizeFeatureConfig,normalizeFeatureFlags,parseFeatureWrite,type FeatureKey} from '../../features/model.ts';
export async function readFeatureConfig(c:PoolClient){return normalizeFeatureConfig((await c.query('SELECT juyu.read_feature_config() AS config')).rows[0].config);}
export async function readFeatureFlags(c:PoolClient){return normalizeFeatureFlags((await c.query('SELECT juyu.read_feature_flags() AS flags')).rows[0].flags);}
export async function writeFeatureConfig(c:PoolClient,value:unknown){const x=parseFeatureWrite(value);return normalizeFeatureConfig((await c.query('SELECT juyu.write_feature_config($1,$2) AS config',[x.expectedVersion,JSON.stringify(x.flags)])).rows[0].config);}
/** Same transaction as the operation: feature toggles wait for accepted operations to commit. */
export async function requireFeature(c:PoolClient,key:FeatureKey){await c.query('SELECT juyu.require_feature($1)',[key]);}
