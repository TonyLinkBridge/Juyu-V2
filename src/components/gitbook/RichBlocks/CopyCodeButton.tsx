'use client';
import {useEffect,useState} from 'react';
import {useReaderLocale} from '../../reader-support/ArticleReferenceContext';
// Adapted from GitBook CopyCodeButton; only acknowledge a confirmed clipboard write.
export function CopyCodeButton({code}:{code:string}){
 const english=useReaderLocale()==='en';
 const [state,setState]=useState<'idle'|'pending'|'copied'|'failed'>('idle');
 useEffect(()=>{if(state!=='copied')return;const timer=setTimeout(()=>setState('idle'),2000);return()=>clearTimeout(timer);},[state]);
 async function copy(){setState('pending');let timer:ReturnType<typeof setTimeout>|undefined;try{if(!navigator.clipboard?.writeText)throw new Error('UNAVAILABLE');await Promise.race([navigator.clipboard.writeText(code),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('TIMEOUT')),5000);})]);setState('copied');}catch{setState('failed');}finally{if(timer)clearTimeout(timer);}}
 return <div className="rich-copy"><button type="button" disabled={state==='pending'} onClick={()=>void copy()}>{english?(state==='pending'?'Copying…':'Copy code'):(state==='pending'?'正在复制…':'复制代码')}</button><span role="status">{english?(state==='copied'?'Copied':state==='failed'?'Could not copy. Select the code and copy it manually.':''):(state==='copied'?'已复制':state==='failed'?'复制失败，请选中代码后手动复制。':'')}</span></div>;
}
