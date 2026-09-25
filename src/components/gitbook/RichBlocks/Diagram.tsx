'use client';
/* eslint-disable @next/next/no-img-element -- generated SVG remains isolated as an image, never inserted into the page DOM. */
import {adminDiagramUrl} from '../../../history/paths';
import {useRef,useState} from 'react';
import type {PointerEvent} from 'react';
import type {ScienceBlock} from '../../../media/model';
import {useReaderLocale} from '../../reader-support/ArticleReferenceContext';

function ZoomableDiagram({url,alt,large=false,onError}:{url:string;alt:string;large?:boolean;onError:()=>void}){
 const english=useReaderLocale()==='en';
 const [scale,setScale]=useState(1),[offset,setOffset]=useState({x:0,y:0});
 const start=useRef<{x:number;y:number;left:number;top:number}|null>(null);
 function reset(){setScale(1);setOffset({x:0,y:0});}
 function zoom(direction:1|-1){setScale(current=>Math.min(4,Math.max(.5,Math.round((current+direction*.25)*100)/100)));}
 function down(event:PointerEvent<HTMLDivElement>){if(event.button!==0)return;start.current={x:event.clientX,y:event.clientY,left:offset.x,top:offset.y};event.currentTarget.setPointerCapture(event.pointerId);}
 function move(event:PointerEvent<HTMLDivElement>){if(!start.current)return;setOffset({x:start.current.left+event.clientX-start.current.x,y:start.current.top+event.clientY-start.current.y});}
 function up(event:PointerEvent<HTMLDivElement>){start.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}
 return <div className={`diagram-viewer${large?' is-large':''}`}><div className="diagram-viewport" role="region" aria-label={english?'Diagram; drag to pan':'流程图，可拖动查看'} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}><img src={url} alt={alt} onError={onError} draggable={false} style={{transform:`translate(${offset.x}px,${offset.y}px) scale(${scale})`}}/></div><div className="diagram-controls" aria-label={english?'Diagram zoom':'流程图缩放'}><button type="button" aria-label={english?'Zoom in':'放大流程图'} disabled={scale>=4} onClick={()=>zoom(1)}>＋</button><button type="button" aria-label={english?'Zoom out':'缩小流程图'} disabled={scale<=.5} onClick={()=>zoom(-1)}>－</button><button type="button" aria-label={english?'Reset diagram view':'重置流程图位置'} onClick={reset}>{english?'Reset':'重置'}</button><span>{Math.round(scale*100)}%</span></div></div>;
}

// Preserve server-side authorization: even the expanded viewer loads the protected image URL.
export function Diagram({block,documentId,revision,admin=false,locale}:{block:ScienceBlock;documentId?:string;revision?:number;admin?:boolean;locale?:'zh-CN'|'en'}){
 const contextLocale=useReaderLocale(),english=(locale??contextLocale)==='en';
 const [retry,setRetry]=useState(0),[image,setImage]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[open,setOpen]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null),expand=useRef<HTMLButtonElement>(null);
 const url=admin?image:documentId?`/api/articles/${encodeURIComponent(documentId)}/diagram?revision=${revision}&block=${encodeURIComponent(block.id)}&retry=${retry}`:'';
 async function preview(){setBusy(true);setError('');setImage('');try{const response=await fetch(adminDiagramUrl(documentId??'',revision),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source:block.source}),signal:AbortSignal.timeout(18000)});const result=await response.json();if(!response.ok)throw new Error(result.error);if(typeof result.image!=='string'||!/^data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+$/.test(result.image))throw new Error('预览结果不可用');setImage(result.image);}catch(e){setError(e instanceof Error?e.message:'流程图暂时不可用');}finally{setBusy(false);}}
 return <figure className="science-block diagram-block">{admin&&<button type="button" disabled={busy} onClick={()=>void preview()}>{busy?'正在生成…':'检查并预览流程图'}</button>}{url&&!error&&<><ZoomableDiagram key={url} url={url} alt={block.caption||(english?'Article diagram':'文章流程图')} onError={()=>setError(english?'The diagram could not be displayed. Check the source or reload the page.':'流程图无法显示，请检查原文语法或重新加载。')}/><button type="button" ref={expand} className="diagram-expand" onClick={()=>{setOpen(true);dialog.current?.showModal();}}>{english?'View full screen':'全屏查看流程图'}</button><dialog ref={dialog} className="diagram-dialog" aria-label={english?'Full-screen diagram':'全屏流程图'} onClose={()=>{setOpen(false);expand.current?.focus();}}><div className="diagram-dialog-heading"><strong>{block.caption||(english?'Diagram':'流程图')}</strong><button type="button" aria-label={english?'Close diagram':'关闭全屏流程图'} onClick={()=>dialog.current?.close()}>{english?'Close':'关闭'}</button></div>{open&&<ZoomableDiagram key={url+':large'} url={url} alt={english?`Full screen: ${block.caption||'article diagram'}`:`全屏：${block.caption||'文章流程图'}`} large onError={()=>setError(english?'The diagram could not be displayed. Check the source or reload the page.':'流程图无法显示，请检查原文语法或重新加载。')}/>}</dialog></>}{error&&<><p role="alert">{error}</p>{!admin&&<button type="button" onClick={()=>{setError('');setRetry(v=>v+1);}}>{english?'Reload diagram':'重新读取流程图'}</button>}</>}<figcaption>{block.caption}</figcaption><details><summary>{english?'View diagram source':'查看流程图原文'}</summary><pre>{block.source}</pre></details></figure>;
}
