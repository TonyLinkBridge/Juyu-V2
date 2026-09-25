'use client';

import {TOC,TOCPopover,TOCProvider} from 'fumadocs-ui/layouts/docs/page/slots/toc';
import {createContext,useCallback,useContext,useMemo,useState,type ComponentProps} from 'react';

const BlockNoteTocReadyContext=createContext<()=>void>(()=>{});

export function FumadocsBlockNoteTocProvider({toc,children,...props}:ComponentProps<typeof TOCProvider>){
 const [revision,setRevision]=useState(0);
 const markReady=useCallback(()=>setRevision(value=>value+1),[]);
 const refreshedToc=useMemo(()=>revision===0?toc:toc.map(item=>({...item})),[toc,revision]);
 return <BlockNoteTocReadyContext value={markReady}>
  <TOCProvider {...props} toc={refreshedToc}>{children}</TOCProvider>
 </BlockNoteTocReadyContext>;
}

export function useFumadocsBlockNoteTocReady(){
 return useContext(BlockNoteTocReadyContext);
}

export const fumadocsBlockNoteTocSlots={provider:FumadocsBlockNoteTocProvider,main:TOC,popover:TOCPopover};
