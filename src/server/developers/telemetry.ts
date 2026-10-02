import {safeTelemetry,type Telemetry} from '../../developers/model.ts';
export async function observeRequest(name:'asset'|'pdf'|'publication',work:()=>Promise<Response>,record:(event:Telemetry)=>void):Promise<Response>{
 const started=performance.now();let status=500;
 try{const response=await work();status=response.status;return response;}
 finally{const value=safeTelemetry({source:'request',name,status,durationMs:Math.max(0,Math.round(performance.now()-started)),level:status>=500?'error':status>=400?'warning':'info'});if(value)try{record(value);}catch{/* Telemetry must never change an application result. */}}
}
