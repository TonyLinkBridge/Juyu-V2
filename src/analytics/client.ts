import type {AnalyticsInput,AnalyticsReceipt} from './model.ts';
class AnalyticsRejected extends Error {}
export async function postAnalytics(input:AnalyticsInput):Promise<AnalyticsReceipt>{
 const body=JSON.stringify(input);if(new TextEncoder().encode(body).byteLength>24000)throw new AnalyticsRejected('INVALID_INPUT');
 const response=await fetch('/api/analytics',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body,signal:AbortSignal.timeout(5000)});
 if(!response.ok){if(response.status>=400&&response.status<500)throw new AnalyticsRejected('REJECTED');throw new Error('UNCONFIRMED');}
 const data=await response.json();if(!data||data.eventId!==input.eventId||data.kind!==input.kind)throw new Error('INVALID_ACK');return {eventId:data.eventId,kind:data.kind};
}
export function deliverAnalytics(input:AnalyticsInput,{delayMs=1000,onSettled=()=>{}}:{delayMs?:number;onSettled?:()=>void}={}){
 let stopped=false,finished=false,retried=false,timer:ReturnType<typeof setTimeout>|undefined;
 const finish=()=>{if(!finished){finished=true;onSettled();}};
 const send=()=>{if(stopped)return finish();void postAnalytics(input).then(finish,error=>{if(!stopped&&!retried&&!(error instanceof AnalyticsRejected)){retried=true;timer=setTimeout(send,delayMs);}else finish();});};
 send();return()=>{stopped=true;clearTimeout(timer);finish();};
}
