'use client';
import {mediaAssetUrl} from '../../../history/paths';
import {MathFormula} from '../RichBlocks/Math';
import {Diagram} from '../RichBlocks/Diagram';
import {Hint} from '../RichBlocks/Hint';
import {CodeBlock} from '../RichBlocks/CodeBlock';
import {DynamicTabs} from '../RichBlocks/DynamicTabs';
import {Steps} from '../RichBlocks/Steps';
import {Columns} from '../RichBlocks/Columns';
import {ImageGallery} from './ImageGallery';
import {TableExplorer} from '../../reader-support/TableExplorer';
import {ArticleReference} from './ArticleReference';
import {useReaderLocale} from '../../reader-support/ArticleReferenceContext';
import {ActionButton} from '../RichBlocks/ActionButton';
import {ExternalEmbed} from './ExternalEmbed';
import type {ReactNode} from 'react';
/* eslint-disable @next/next/no-img-element -- private images must carry the current session directly, without an image optimization cache. */
import {useEffect,useRef,useState} from 'react';
import {normalizeBlocks,type MediaBlock} from '../../../media/model';
// Image figures/captions and file card actions adapted from GitBook Images/File.
// Private native video and structured table rendering are JUYU additions.
export function MediaBlocks({blocks,admin=false,documentId,revision,locale:requestedLocale}:{blocks?:MediaBlock[];admin?:boolean;documentId?:string;revision?:number;locale?:'zh-CN'|'en'}){
 const contextLocale=useReaderLocale(),locale=requestedLocale??contextLocale;
 const items=normalizeBlocks(blocks),rendered:ReactNode[]=[];
 for(let i=0;i<items.length;i++){
  const b=items[i];
  if(b.type==='image'){const group:{id:string;assetId:string;alt:string;caption:string;darkAssetId?:string|null}[]=[];while(i<items.length&&items[i].type==='image'){group.push(items[i] as typeof b);i++;}i--;rendered.push(<ImageGallery key={group[0].id} images={group.map(item=>({id:item.id,src:mediaAssetUrl(item.assetId,admin,documentId,revision),darkSrc:item.darkAssetId?mediaAssetUrl(item.darkAssetId,admin,documentId,revision):undefined,alt:item.alt,caption:item.caption}))}/>);continue;}
  rendered.push(b.type==='math'?<MathFormula key={b.id} block={b} locale={locale}/>:b.type==='diagram'?<Diagram key={b.id+':'+b.source} block={b} documentId={documentId} revision={revision} admin={admin}/>:b.type==='hint'?<Hint key={b.id} block={b}/>:b.type==='code'?<CodeBlock key={b.id} block={b}/>:b.type==='tabs'?<DynamicTabs key={b.id} block={b} documentId={documentId} revision={revision} admin={admin}/>:b.type==='steps'?<Steps key={b.id} block={b} documentId={documentId} revision={revision} admin={admin} locale={locale}/>:b.type==='columns'?<Columns key={b.id} block={b} documentId={documentId} revision={revision} admin={admin} locale={locale}/>:b.type==='table'?<TableExplorer key={b.id} block={b}/>:b.type==='button'?<ActionButton key={b.id} block={b}/>:b.type==='externalEmbed'?<ExternalEmbed key={b.id} block={b}/>:b.type==='articleReference'?<ArticleReference key={b.id} block={b} admin={admin}/>:<Media key={b.id} block={b} admin={admin} documentId={documentId} revision={revision}/>);
 }
 return <div className="media-blocks">{rendered}</div>;
}
function Media({block:b,admin,documentId,revision}:{block:Extract<MediaBlock,{type:'image'|'video'|'audio'|'file'}>;admin:boolean;documentId?:string;revision?:number}){
 const [failed,setFailed]=useState(false);const ref=useRef<HTMLImageElement>(null);
 const english=useReaderLocale()==='en';
 const url=mediaAssetUrl(b.assetId,admin,documentId,revision);
 useEffect(()=>{const img=ref.current;if(img?.complete&&img.naturalWidth===0)queueMicrotask(()=>setFailed(true));},[]);
 return <figure className={`media-item media-${b.type}`}>
  {b.type==='image'&&!failed&&<img ref={ref} src={url} alt={b.alt} loading="lazy" onError={()=>setFailed(true)}/>}
  {b.type==='video'&&!failed&&<video src={url} controls playsInline preload="metadata" aria-label={b.alt||b.caption||(english?'Article video':'文章影片')} onError={()=>setFailed(true)}><track kind="captions"/></video>}
  {b.type==='audio'&&!failed&&<audio src={url} controls preload="metadata" aria-label={b.alt||b.caption||(english?'Article audio':'文章音频')} onError={()=>setFailed(true)}/>}
  {failed&&<p role="status">{english?'This file could not be loaded. Reload the page or open the original file.':`${b.type==='image'?'图片':'影片'}暂时无法读取。请重新加载页面，或打开文件查看。`}</p>}
  <figcaption>{b.caption&&<p>{b.caption}</p>}{b.type==='video'&&b.alt&&<p>{b.alt}</p>}<div className="media-file-actions"><a href={url} target="_blank" rel="noopener noreferrer">{english?'Open original':b.type==='file'?'打开文件':'打开原文件'}</a><a href={`${url}?download=1`} download>{english?'Download':'下载文件'}</a></div></figcaption>
 </figure>;
}
