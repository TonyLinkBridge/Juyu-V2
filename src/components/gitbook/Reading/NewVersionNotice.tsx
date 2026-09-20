'use client';
import {useEffect,useState} from 'react';

export function NewVersionNotice({documentId,revision,locale='zh-CN'}:{documentId:string;revision:number;locale?:'zh-CN'|'en'}){
 const [newRevision,setNewRevision]=useState<number|null>(null);
 useEffect(()=>{
  let active=true,lastChecked=Date.now(),running=false;
  async function check(){
   if(!active||running||document.visibilityState!=='visible'||Date.now()-lastChecked<60_000)return;
   running=true;lastChecked=Date.now();
   try{
    const response=await fetch(`/api/articles/${encodeURIComponent(documentId)}/version`,{cache:'no-store',credentials:'same-origin'});
    if(!response.ok)return;
    const data:unknown=await response.json();
    const next=(data&&typeof data==='object'&&'revision' in data)?(data as {revision:unknown}).revision:null;
    if(active&&typeof next==='number'&&Number.isSafeInteger(next)&&next>revision)setNewRevision(next);
   }catch{/* A failed background check leaves the current article usable. */}
   finally{running=false;}
  }
  function onReturn(){void check();}
  window.addEventListener('focus',onReturn);
  document.addEventListener('visibilitychange',onReturn);
  const timer=window.setInterval(onReturn,300_000);
  return ()=>{active=false;window.clearInterval(timer);window.removeEventListener('focus',onReturn);document.removeEventListener('visibilitychange',onReturn);};
 },[documentId,revision]);
 if(newRevision===null)return null;
 return <div className="reader-new-version" role="status"><span>{locale==='en'?'A newer version is available. You’re viewing an older one.':'这篇文章已发布新版本。你现在看到的是较早的内容。'}</span><button type="button" onClick={()=>window.location.reload()}>{locale==='en'?'View latest version':'查看最新版'}</button></div>;
}
