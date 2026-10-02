/** Only fixed workflow labels reach logs; never accept editor text, user IDs or tokens. */
const stages=['confirm_open','confirm_click','blocked','preflight_start','preflight_failed','publish_start','publish_failed','publish_success','recheck_start','recheck_failed','recheck_success'] as const;
const reasons=['none','missing_draft','missing_sequence','permission','save_error','saving','uploading','validation','recovered_input','unsaved','locked','busy','uncertain','recheck_required','FORBIDDEN','CONFLICT','INVALID_STATE','INACTIVE_DOCUMENT','INVALID_MEDIA','UPLOAD_IN_PROGRESS','READ_FAILED','INVALID_RECOVERY','REVIEW_UNAVAILABLE','INVALID_ACK','ENGLISH_REVIEW_REQUIRED','unknown'] as const;
export type PublicationDiagnosticStage=typeof stages[number];
export type PublicationDiagnosticReason=typeof reasons[number];
export type PublicationDiagnostic={attempt:string;stage:PublicationDiagnosticStage;sequence:number|null;reason:PublicationDiagnosticReason;online:boolean};
export function publicationDiagnosticReason(error:unknown):PublicationDiagnosticReason {
 const code=error instanceof Error?error.message:'';
 return reasons.includes(code as PublicationDiagnosticReason)?code as PublicationDiagnosticReason:'unknown';
}
export function parsePublicationDiagnostic(value:unknown):PublicationDiagnostic {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('INVALID_INPUT');
 const v=value as Record<string,unknown>;
 if(Object.keys(v).length!==5||Object.keys(v).some(k=>!['attempt','stage','sequence','reason','online'].includes(k))
  ||typeof v.attempt!=='string'||!/^[-a-f0-9]{36}$/.test(v.attempt)||!/^\w{8}-\w{4}-4\w{3}-[89ab]\w{3}-\w{12}$/.test(v.attempt)
  ||!stages.includes(v.stage as PublicationDiagnosticStage)||!reasons.includes(v.reason as PublicationDiagnosticReason)
  ||!(v.sequence===null||Number.isSafeInteger(v.sequence)&&Number(v.sequence)>=0)||typeof v.online!=='boolean')throw new Error('INVALID_INPUT');
 return {attempt:v.attempt,stage:v.stage as PublicationDiagnosticStage,sequence:v.sequence as number|null,reason:v.reason as PublicationDiagnosticReason,online:v.online};
}
