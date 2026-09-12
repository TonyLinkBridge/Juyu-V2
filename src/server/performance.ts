import {AsyncLocalStorage} from 'node:async_hooks';
type Stage='clerk.session'|'company.verify'|'clerk.user'|'clerk.tokens'|'slack.userinfo'|'database.scope'|'member.bind'|'reader.frame'|'database.pool'|'database.work'|'enrollment.inspect'|'page.ops'|'page.admin'|'identity.verify'|'asset.authorize'|'asset.recheck'|'storage.body'|'storage.headers'|'pdf.snapshot'|'pdf.recheck'|'pdf.asset'|'pdf.asset-recheck'|'pdf.render';
type Totals=Partial<Record<Stage,{count:number;ms:number;failures:number}>>;
const requests=new AsyncLocalStorage<Totals>();
/** Fixed route labels; duration ends when response headers/body are ready, not stream completion. */
export async function measuredRequest(route:'asset'|'pdf',work:()=>Promise<Response>):Promise<Response>{
 if(process.env.JUYU_PERFORMANCE_LOGGING!=='true')return work();
 const stages:Totals={};const start=performance.now();let status=500;
 return requests.run(stages,async()=>{try{const response=await work();status=response.status;return response;}finally{console.info(JSON.stringify({event:'juyu.request-performance',route,ms:Math.round(performance.now()-start),status,stages}));}});
}
/** Fixed labels and durations only: never log IDs, SQL, tokens or vendor errors. */
export async function measured<T>(stage:Stage,work:()=>Promise<T>):Promise<T>{
 const start=performance.now();let ok=false;
 try{const result=await work();ok=true;return result;}
 finally{const ms=Math.round(performance.now()-start);const totals=requests.getStore();if(totals){const item=totals[stage]??{count:0,ms:0,failures:0};item.count++;item.ms+=ms;item.failures+=ok?0:1;totals[stage]=item;}else if(process.env.JUYU_PERFORMANCE_LOGGING==='true')console.info(JSON.stringify({event:'juyu.performance',stage,ms,ok}));}
}
