import {applicationAuthorization} from '../../../../../../../../server/authorization/application';
import {historyResponse,historyRevision} from '../../../../../../../../server/history/http';
import {readBounded,requireMediaOrigin} from '../../../../../../../../server/media/upload';
import {diagramSVG,svgImage} from '../../../../../../../../server/science/render';
export const dynamic='force-dynamic';
export async function POST(request:Request,context:{params:Promise<{id:string;revision:string}>}){return historyResponse(async()=>{
 const service=await applicationAuthorization();await service.requireEditorAdmin();requireMediaOrigin(request,process.env.APP_ORIGIN);
 if(new URL(request.url).search||request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')throw new Error('INVALID_INPUT');
 const p=await context.params,revision=historyRevision(p.revision),snapshot=await service.historyVersion(p.id,revision);
 const bytes=await readBounded(request.body,20000,AbortSignal.any([request.signal,AbortSignal.timeout(5000)]));
 let input:unknown;try{input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new Error('INVALID_INPUT');}
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==1||!('source' in input)||typeof input.source!=='string')throw new Error('INVALID_INPUT');
 const source=input.source;if(!snapshot.version.blocks.some(b=>b.type==='diagram'&&b.source===source))throw new Error('INVALID_INPUT');
 const svg=await diagramSVG(source);await service.historyVersion(p.id,revision);return {image:svgImage(svg)};
});}
