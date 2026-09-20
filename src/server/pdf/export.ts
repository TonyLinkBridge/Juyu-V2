import {measured,measuredRequest} from '../performance.ts';
import {diagramSVG,svgImage} from '../science/render.ts';
import {mathMarkup} from '../../science/model.ts';
import {blockAssetIds,normalizeBlocks} from '../../media/model.ts';
import {readBounded} from '../media/upload.ts';
import {pdfHTML} from '../../pdf/render.ts';
import type {PDFSnapshot} from '../../pdf/model.ts';
import {positiveInteger} from '../../feedback/model.ts';
import {validateAsset,type AssetFile,type PrivateStorage} from '../storage/contract.ts';
const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin','Content-Security-Policy':'sandbox'};
interface Dependencies {snapshot:(id:string,revision:number)=>Promise<PDFSnapshot>;asset:(id:string)=>Promise<AssetFile|null>;storage:()=>PrivateStorage;render:(html:string)=>Promise<Buffer>}
export async function exportPDF(request:Request,id:string,revision:number,deps:Dependencies):Promise<Response>{
 return measuredRequest('pdf',()=>exportAuthorizedPDF(request,id,revision,deps));
}
async function exportAuthorizedPDF(request:Request,id:string,revision:number,deps:Dependencies):Promise<Response>{
 try{
  positiveInteger(revision);if(request.headers.get('sec-fetch-site')==='cross-site')throw new Error('FORBIDDEN');
  const snapshot=await measured('pdf.snapshot',()=>deps.snapshot(id,revision));if(snapshot.article.id!==id||snapshot.article.revision!==revision)throw new Error('VERSION_CHANGED');
  const blocks=normalizeBlocks(snapshot.article.blocks);const imageIds=new Set(blocks.flatMap(b=>b.type==='image'?[b.assetId]:b.type==='tabs'||b.type==='steps'||b.type==='columns'?blockAssetIds(b):[]));if(snapshot.article.cover)imageIds.add(snapshot.article.cover.assetId);
  const assetIds=new Set([...imageIds,...blocks.flatMap(blockAssetIds)]);const assets:AssetFile[]=[];
  for(const assetId of assetIds){const asset=await measured('pdf.asset',()=>deps.asset(assetId));if(!asset||asset.id!==assetId||asset.document_id!==id||(imageIds.has(assetId)&&!['image/png','image/jpeg','image/webp','image/gif'].includes(asset.mime_type)))throw new Error('IMAGE_UNAVAILABLE');validateAsset(asset);assets.push(asset);}
  for(const block of blocks)if(block.type==='math')mathMarkup(block.source);
  if(new URL(request.url).searchParams.get('check')==='1')return Response.json({revision,coverId:snapshot.article.cover?.assetId??null},{headers});
  if(snapshot.article.body.length+JSON.stringify(blocks).length>250000)throw new Error('PDF_TOO_LARGE');
  request.signal.throwIfAborted();const images:Record<string,string>={};let total=0;
  for(const asset of assets.filter(a=>imageIds.has(a.id))){
   const size=validateAsset(asset);total+=size;if(size>5*1024*1024||total>20*1024*1024)throw new Error('PDF_TOO_LARGE');
   const signal=AbortSignal.any([request.signal,AbortSignal.timeout(15000)]);const response=await measured('storage.headers',()=>deps.storage().read(asset.object_key,undefined,signal));
   if(response.status!==200||response.headers.get('content-length')!==String(size)||!response.body){await response.body?.cancel();throw new Error('IMAGE_UNAVAILABLE');}
   let bytes:Buffer;try{bytes=await measured('storage.body',()=>readBounded(response.body!,size,signal));}catch{throw new Error('IMAGE_UNAVAILABLE');}if(bytes.length!==size)throw new Error('IMAGE_UNAVAILABLE');images[asset.id]=`data:${asset.mime_type};base64,${bytes.toString('base64')}`;
  }
  for(const block of blocks){if(block.type==='math')mathMarkup(block.source);if(block.type==='diagram')images['diagram:'+block.id]=svgImage(await diagramSVG(block.source));}
  const cover=snapshot.article.cover?images[snapshot.article.cover.assetId]:undefined;
  const bytes=await measured('pdf.render',()=>deps.render(pdfHTML(snapshot.article,cover,images)));request.signal.throwIfAborted();
  // Generation can take seconds. Re-read current identity, publication and assets before release.
  const current=await measured('pdf.recheck',()=>deps.snapshot(id,revision));if(JSON.stringify(current)!==JSON.stringify(snapshot))throw new Error('VERSION_CHANGED');
  for(const asset of assets)if(JSON.stringify(await measured('pdf.asset-recheck',()=>deps.asset(asset.id)))!==JSON.stringify(asset))throw new Error('IMAGE_UNAVAILABLE');
  if(bytes.length>20*1024*1024)throw new Error('PDF_TOO_LARGE');if(bytes.subarray(0,5).toString()!=='%PDF-')throw new Error('PDF_UNAVAILABLE');
  const name=encodeURIComponent(snapshot.article.title.slice(0,100).replace(/[\x00-\x1f\x7f/\\]/g,'')+'.pdf').replace(/['()*]/g,c=>`%${c.charCodeAt(0).toString(16)}`);
  return new Response(new Uint8Array(bytes),{headers:{...headers,'Content-Type':'application/pdf','Content-Length':String(bytes.length),'Content-Disposition':`${new URL(request.url).searchParams.get('download')==='1'?'attachment':'inline'}; filename="article.pdf"; filename*=UTF-8''${name}`}});
 }catch(error){const raw=error instanceof Error?error.message:'';const code=raw.startsWith('FORBIDDEN')?'FORBIDDEN':['FEATURE_DISABLED','AUTH_NOT_CONFIGURED','NOT_FOUND','VERSION_CHANGED','INVALID_INPUT','PDF_TOO_LARGE','PDF_BUSY','IMAGE_UNAVAILABLE'].includes(raw)?raw:'PDF_UNAVAILABLE';return Response.json({error:code},{status:(code==='FORBIDDEN'||code==='FEATURE_DISABLED')?403:code==='NOT_FOUND'?404:code==='VERSION_CHANGED'?409:code==='INVALID_INPUT'?400:code==='PDF_TOO_LARGE'?413:code==='PDF_BUSY'?429:503,headers});}
}
