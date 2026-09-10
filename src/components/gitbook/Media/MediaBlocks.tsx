'use client';
import {mediaAssetUrl} from '../../../history/paths';
import {MathFormula} from '../RichBlocks/Math';
import {Diagram} from '../RichBlocks/Diagram';
import {Hint} from '../RichBlocks/Hint';
import {CodeBlock} from '../RichBlocks/CodeBlock';
import {DynamicTabs} from '../RichBlocks/DynamicTabs';
/* eslint-disable @next/next/no-img-element -- private images must carry the current session directly, without an image optimization cache. */
import {useEffect,useRef,useState} from 'react';
import {normalizeBlocks,type MediaBlock} from '../../../media/model';
// Image figures/captions and file card actions adapted from GitBook Images/File.
// Private native video and structured table rendering are JUYU additions.
export function MediaBlocks({blocks,admin=false,documentId,revision}:{blocks?:MediaBlock[];admin?:boolean;documentId?:string;revision?:number}){
 return <div className="media-blocks">{normalizeBlocks(blocks).map(b=>b.type==='math'?<MathFormula key={b.id} block={b}/>:b.type==='diagram'?<Diagram key={b.id+':'+b.source} block={b} documentId={documentId} revision={revision} admin={admin}/>:b.type==='hint'?<Hint key={b.id} block={b}/>:b.type==='code'?<CodeBlock key={b.id} block={b}/>:b.type==='tabs'?<DynamicTabs key={b.id} block={b}/>:b.type==='table'?<div key={b.id} className="reader-scroll-region" role="region" tabIndex={0} aria-label="资料表格，可横向滚动"><table><thead><tr>{b.headers.map((v,i)=><th scope="col" key={i}>{v}</th>)}</tr></thead><tbody>{b.rows.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j}>{v}</td>)}</tr>)}</tbody></table></div>:<Media key={b.id} block={b} admin={admin} documentId={documentId} revision={revision}/>)}</div>;
}
function Media({block:b,admin,documentId,revision}:{block:Extract<MediaBlock,{type:'image'|'video'|'file'}>;admin:boolean;documentId?:string;revision?:number}){
 const [failed,setFailed]=useState(false);const ref=useRef<HTMLImageElement>(null);
 const url=mediaAssetUrl(b.assetId,admin,documentId,revision);
 useEffect(()=>{const img=ref.current;if(img?.complete&&img.naturalWidth===0)queueMicrotask(()=>setFailed(true));},[]);
 return <figure className={`media-item media-${b.type}`}>
  {b.type==='image'&&!failed&&<img ref={ref} src={url} alt={b.alt} loading="lazy" onError={()=>setFailed(true)}/>}
  {b.type==='video'&&!failed&&<video src={url} controls playsInline preload="metadata" aria-label={b.alt||b.caption||'文章影片'} onError={()=>setFailed(true)}><track kind="captions"/></video>}
  {failed&&<p role="status">{b.type==='image'?'图片':'影片'}暂时无法读取。请重新加载页面，或打开文件查看。</p>}
  <figcaption>{b.caption&&<p>{b.caption}</p>}{b.type==='video'&&b.alt&&<p>{b.alt}</p>}<div className="media-file-actions"><a href={url} target="_blank" rel="noopener noreferrer">{b.type==='file'?'打开文件':'打开原文件'}</a><a href={`${url}?download=1`} download>下载文件</a></div></figcaption>
 </figure>;
}
