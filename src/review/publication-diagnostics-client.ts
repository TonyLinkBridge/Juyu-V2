import type {PublicationDiagnostic,PublicationDiagnosticReason,PublicationDiagnosticStage} from './publication-diagnostics.ts';
/** Logging is best effort, deduplicated and bounded; a failed log must never delay publication. */
export class PublicationDiagnostics {
 private attempt=crypto.randomUUID();private count=0;private blocked=new Set<string>();
 private documentId:string;
 constructor(documentId:string){this.documentId=documentId;}
 begin(){this.attempt=crypto.randomUUID();this.count=0;this.blocked.clear();}
 note(stage:PublicationDiagnosticStage,sequence:number|null,reason:PublicationDiagnosticReason='none'){
  const key=reason;if(this.count>=24||stage==='blocked'&&this.blocked.has(key))return;
  if(stage==='blocked')this.blocked.add(key);this.count++;
  const value:PublicationDiagnostic={attempt:this.attempt,stage,sequence,reason,online:typeof navigator==='undefined'||navigator.onLine!==false};
  console.info(JSON.stringify({event:'juyu.publication-client',...value}));
  try{void fetch(`/api/admin/review/${encodeURIComponent(this.documentId)}/publication/diagnostics`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value),keepalive:true,signal:AbortSignal.timeout(5000)}).catch(()=>{});}catch{/* Best effort, including browsers without timeout support. */}
 }
}
