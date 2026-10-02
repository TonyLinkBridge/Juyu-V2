import {observeRequest} from './telemetry.ts';
/** Keep closed/unconfigured route entry points free of runtime identity dependencies. */
export async function observeDeveloperRequest(name:'asset'|'pdf'|'publication',work:()=>Promise<Response>){
 if(process.env.JUYU_DEVELOPER_LOGGING!=='true')return work();
 let record:Parameters<typeof observeRequest>[2]=()=>{};
 try{record=(await import('./application.ts')).queueTelemetry;}catch{/* Observability must not prevent the original operation. */}
 return observeRequest(name,work,record);
}
