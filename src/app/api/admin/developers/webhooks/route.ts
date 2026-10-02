import {after} from 'next/server';
import {developerRoute,developerInput} from '../../../../../server/developers/http';
import {deliverSlackNotificationsSafely} from '../../../../../server/slack/service';
export const dynamic='force-dynamic';
export function GET(request:Request){return developerRoute(service=>service.notifications(new URL(request.url).searchParams));}
export function POST(request:Request){return developerRoute(async service=>{const input=await developerInput(request);if(Object.keys(input).length!==3||Object.keys(input).some(k=>!['documentId','sequence','requestId'].includes(k))||typeof input.documentId!=='string'||typeof input.sequence!=='number'||typeof input.requestId!=='string')throw Error('INVALID_INPUT');const result=await service.retry(input.documentId,input.sequence,input.requestId);if(result.scheduled)after(deliverSlackNotificationsSafely);return result;});}
