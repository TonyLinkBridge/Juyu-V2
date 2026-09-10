import {applicationAuthorization} from '../../../../../../server/authorization/application';
import {readBounded,requireMediaOrigin} from '../../../../../../server/media/upload';
import {diagramSVG,svgImage} from '../../../../../../server/science/render';
import {diagramPreviewResponse} from '../../../../../../server/science/response';
export const dynamic='force-dynamic';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
 return diagramPreviewResponse(async()=>{
  const service=await applicationAuthorization(),id=(await context.params).id;
  await service.media(id);requireMediaOrigin(request,process.env.APP_ORIGIN);
  if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')throw new Error('INVALID_INPUT');
  const bytes=await readBounded(request.body,20000,AbortSignal.any([request.signal,AbortSignal.timeout(5000)]));
  let input:unknown;try{input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new Error('INVALID_INPUT');}
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==1||!('source' in input)||typeof input.source!=='string')throw new Error('INVALID_INPUT');
  const svg=await diagramSVG(input.source);
  await service.media(id);
  return {image:svgImage(svg)};
 });
}
