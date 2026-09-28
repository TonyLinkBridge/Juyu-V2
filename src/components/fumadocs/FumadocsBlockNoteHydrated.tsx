'use client';

import dynamic from 'next/dynamic';
import {useCallback,useState,type ReactNode} from 'react';
import type {NavigationPage} from '../../reader/navigation';

const Reader=dynamic(()=>import('./FumadocsBlockNoteReaderClient').then(module=>module.FumadocsBlockNoteReaderClient),{ssr:false});

export function FumadocsBlockNoteHydrated({blocks,published,locale,documentId,revision,referencePages,referenceAliases,fallback}:{blocks:unknown[];published:boolean;locale:'zh-CN'|'en';documentId?:string;revision?:number;referencePages?:NavigationPage[];referenceAliases?:Record<string,string>;fallback:ReactNode}){
 const [ready,setReady]=useState(false);
 const markReady=useCallback(()=>setReady(true),[]);
 return <div className="fumadocs-blocknote-hydration" data-reader-ready={ready?'true':'false'}>
  {!ready&&fallback}
  <div className="fumadocs-blocknote-client" aria-hidden={ready?undefined:true}>
   <Reader blocks={blocks} published={published} locale={locale} documentId={documentId} revision={revision} referencePages={referencePages} referenceAliases={referenceAliases} onReady={markReady}/>
  </div>
 </div>;
}
