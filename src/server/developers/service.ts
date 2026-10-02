import type {Transactions} from '../database/scoped.ts';
import type {Viewer} from '../../domain/model.ts';
import type {PoolClient} from 'pg';
import {isSuperAdmin} from '../../domain/access.ts';
import {parseEventFilter} from '../../developers/model.ts';
import {requireDeveloper} from './guard.ts';
import {requireDeveloperSchema,readDeveloperOverview,readDeveloperEvents,readDeveloperNotifications,readIntegrations} from './repository.ts';
export class DeveloperService {
 private database:Transactions;private authenticate:()=>Promise<Viewer|null>;private env:Record<string,string|undefined>;
 constructor(database:Transactions,authenticate:()=>Promise<Viewer|null>,env:Record<string,string|undefined>){this.database=database;this.authenticate=authenticate;this.env=env;}
 async run<T>(work:(c:PoolClient)=>Promise<T>,readOnly=true,schema=true){const viewer=await this.authenticate();if(!viewer||!isSuperAdmin(viewer))throw Error('FORBIDDEN');return this.database.run(viewer,async c=>{await requireDeveloper(c,viewer);if(schema)await requireDeveloperSchema(c);return work(c);},readOnly);}
 async access(){return this.run(async()=>({authorized:true}),true,false);}
 async integrations(){return this.run(c=>readIntegrations(c,this.env),true,false);}
 async overview(value:unknown=30){if(value!==7&&value!==30)throw Error('INVALID_INPUT');return this.run(c=>readDeveloperOverview(c,value,this.env));}
 async events(params:URLSearchParams){const filter=parseEventFilter(params);return this.run(c=>readDeveloperEvents(c,filter));}
 async notifications(params:URLSearchParams){return this.run(c=>readDeveloperNotifications(c,params,this.env));}
 async retry(documentId:string,sequence:number,requestId:string){if(!/^[a-f0-9-]{36}$/.test(documentId)||!Number.isSafeInteger(sequence)||sequence<0||!/^([a-f0-9]{8}-)([a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(requestId))throw Error('INVALID_INPUT');return this.run(async c=>({scheduled:(await c.query('SELECT juyu.retry_slack_notification($1,$2,$3) AS scheduled',[documentId,sequence,requestId])).rows[0].scheduled as boolean}),false);}
}
