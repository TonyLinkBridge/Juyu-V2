import 'server-only';
import { Pool } from 'pg';
import {attachDatabasePool} from '@vercel/functions';
import { databaseConfiguration } from '../../config/database.ts';
import { databasePoolOptions } from '../../config/database-tls.ts';
import { ScopedDatabase } from './scoped.ts';
import { MemberStore } from '../members/store.ts';
let connection:{database:ScopedDatabase;members:MemberStore;notificationPool:Pool}|undefined;
export function applicationDatabase(){
 if(connection)return connection;
 const config=databaseConfiguration(process.env);if(config.state!=='configured')throw new Error('AUTH_NOT_CONFIGURED');
 // Session-pooled connections occupy a Supabase slot even while idle.
 // Vercel must keep the instance awake until the idle timer closes them.
 const options={max:2,connectionTimeoutMillis:5000,idleTimeoutMillis:5000,maxLifetimeSeconds:60,statement_timeout:15000};
 const ca=process.env.JUYU_DATABASE_CA_CERT;
 const runtime=new Pool({...options,...databasePoolOptions(config.runtime,ca)}),issuer=new Pool({...options,...databasePoolOptions(config.issuer,ca)});
 attachDatabasePool(runtime);attachDatabasePool(issuer);
 // Do not emit connection strings or vendor errors containing credentials.
 runtime.on('error',()=>console.error('DATABASE_RUNTIME_UNAVAILABLE'));
 issuer.on('error',()=>console.error('DATABASE_ISSUER_UNAVAILABLE'));
 connection={database:new ScopedDatabase(runtime,issuer),members:new MemberStore(issuer),notificationPool:issuer};return connection;
}
