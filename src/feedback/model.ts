export interface SavedFeedback {helpful:boolean;comment:string|null;version:number;updatedAt:string}
export interface FeedbackInput {revision:number;helpful:boolean;comment:string;expectedVersion:number}
export interface FeedbackSummary {documentId:string;title:string;revision:number;total:number;helpful:number;unhelpful:number;current:boolean;latestAt:string}
export interface FeedbackOverview {items:FeedbackSummary[];total:number;page:number;pages:number}
export interface FeedbackDetails {summary:FeedbackSummary;entries:{memberId:string;memberName:string;helpful:boolean;comment:string|null;updatedAt:string}[];page:number;pages:number}
export function positiveInteger(value:unknown):number {
 if(typeof value!=='number'||!Number.isInteger(value)||value<1||value>2147483647)throw new Error('INVALID_INPUT');return value;
}
export function parseFeedback(value:unknown):FeedbackInput {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('INVALID_INPUT');
 const input=value as Record<string,unknown>;
 if(Object.keys(input).some(k=>!['revision','helpful','comment','expectedVersion'].includes(k))||typeof input.helpful!=='boolean'||typeof input.comment!=='string'||[...input.comment].length>1000||input.comment.includes('\0')||typeof input.expectedVersion!=='number'||!Number.isInteger(input.expectedVersion)||input.expectedVersion<0||input.expectedVersion>2147483646)throw new Error('INVALID_INPUT');
 return {revision:positiveInteger(input.revision),helpful:input.helpful,comment:input.comment.trim(),expectedVersion:input.expectedVersion};
}
export function feedbackPage(value:unknown):number {if(value===undefined||value===null||value==='')return 1;if(typeof value!=='string'&&typeof value!=='number')throw new Error('INVALID_INPUT');if(typeof value==='string'&&!/^[1-9][0-9]{0,4}$/.test(value))throw new Error('INVALID_INPUT');const n=Number(value);if(!Number.isInteger(n)||n<1||n>10000)throw new Error('INVALID_INPUT');return n;}
