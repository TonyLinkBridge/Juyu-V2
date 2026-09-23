export interface DraftActionInput {expectedSequence:number}
export interface DraftActionResult {documentId:string;sequence:number;revision:number;publishedRevision:number;status:'published'}
export function draftActionInput(value:unknown):DraftActionInput {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('INVALID_INPUT');
 const x=value as Record<string,unknown>;
 if(Object.keys(x).some(key=>key!=='expectedSequence')||!Number.isSafeInteger(x.expectedSequence)||Number(x.expectedSequence)<0||Number(x.expectedSequence)>=2147483647)throw new Error('INVALID_INPUT');
 return {expectedSequence:Number(x.expectedSequence)};
}
