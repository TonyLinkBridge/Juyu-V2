'use client';
// Adapted from GitBook PDF/PrintButton.tsx; current access is checked before printing.
import {useState} from 'react';
export function PrintButton({disabled,documentId,revision,coverId}:{disabled:boolean;documentId:string;revision:number;coverId:string|null}){
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function print(){
  if(busy)return;setBusy(true);setError('');
  try{const response=await fetch(`/api/articles/${encodeURIComponent(documentId)}/pdf?revision=${revision}&check=1`,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('denied');const data=await response.json();if(data.revision!==revision||data.coverId!==coverId)throw new Error('changed');window.print();}
  catch{setError('无法确认当前文章权限或版本，请返回文章重新打开后打印。');}
  finally{setBusy(false);}
 }
 return <div><button className="secondary-link" type="button" disabled={disabled||busy} onClick={()=>void print()}>{busy?'正在核对…':'打印此页'}</button>{error&&<p role="alert">{error}</p>}</div>;
}
