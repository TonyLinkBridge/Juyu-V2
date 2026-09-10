 'use client';
/* eslint-disable @next/next/no-img-element -- isolated generated SVG is delivered as an image, never inserted into the page DOM. */
import {adminDiagramUrl} from '../../../history/paths';
import {useState} from 'react';
import type {ScienceBlock} from '../../../media/model';
// GitBook Mermaid loading/error/source container adapted to private server rendering.
export function Diagram({block,documentId,revision,admin=false}:{block:ScienceBlock;documentId?:string;revision?:number;admin?:boolean}){
 const [retry,setRetry]=useState(0);const [image,setImage]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const url=admin?image:documentId?`/api/articles/${encodeURIComponent(documentId)}/diagram?revision=${revision}&block=${encodeURIComponent(block.id)}&retry=${retry}`:'';
 async function preview(){setBusy(true);setError('');setImage('');try{const response=await fetch(adminDiagramUrl(documentId??'',revision),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source:block.source}),signal:AbortSignal.timeout(18000)});const result=await response.json();if(!response.ok)throw new Error(result.error);if(typeof result.image!=='string'||!/^data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+$/.test(result.image))throw new Error('预览结果不可用');setImage(result.image);}catch(e){setError(e instanceof Error?e.message:'流程图暂时不可用');}finally{setBusy(false);}}
 return <figure className="science-block">{admin&&<button type="button" disabled={busy} onClick={()=>void preview()}>{busy?'正在生成…':'检查并预览流程图'}</button>}{url&&!error&&<img src={url} alt={block.caption||'文章流程图'} onError={()=>setError('流程图无法显示，请检查原文语法或重新加载。')}/>} {error&&<><p role="alert">{error}</p>{!admin&&<button type="button" onClick={()=>{setError('');setRetry(v=>v+1);}}>重新读取流程图</button>}</>}<figcaption>{block.caption}</figcaption><details><summary>查看流程图原文</summary><pre>{block.source}</pre></details></figure>;
}
