import 'server-only';
import { Pool } from 'pg';
import { databaseConfiguration } from '../../config/database.ts';
import { ScopedDatabase } from './scoped.ts';
import { MemberStore } from '../members/store.ts';
let connection:{database:ScopedDatabase;members:MemberStore}|undefined;
export function applicationDatabase(){
 if(connection)return connection;
 const config=databaseConfiguration(process.env);if(config.state!=='configured')throw new Error('AUTH_NOT_CONFIGURED');
 const options={max:5,connectionTimeoutMillis:5000,idleTimeoutMillis:10000,statement_timeout:15000};
 const runtime=new Pool({...options,connectionString:config.runtime}),issuer=new Pool({...options,connectionString:config.issuer});
 // Do not emit connection strings or vendor errors containing credentials.
 runtime.on('error',()=>console.error('DATABASE_RUNTIME_UNAVAILABLE'));
 issuer.on('error',()=>console.error('DATABASE_ISSUER_UNAVAILABLE'));
 connection={database:new ScopedDatabase(runtime,issuer),members:new MemberStore(issuer)};return connection;
}
