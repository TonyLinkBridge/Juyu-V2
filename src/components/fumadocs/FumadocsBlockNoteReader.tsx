'use client';

import dynamic from 'next/dynamic';
import type {NavigationPage} from '../../reader/navigation';

const Reader=dynamic(()=>import('./FumadocsBlockNoteReaderClient').then(module=>module.FumadocsBlockNoteReaderClient),{
 ssr:false,
 loading:()=> <p role="status">Loading article preview…</p>,
});

export function FumadocsBlockNoteReader({blocks,published=false,locale='zh-CN',documentId,revision,referencePages,referenceAliases}:{blocks:unknown[];published?:boolean;locale?:'zh-CN'|'en';documentId?:string;revision?:number;referencePages?:NavigationPage[];referenceAliases?:Record<string,string>}){
 return <Reader blocks={blocks} published={published} locale={locale} documentId={documentId} revision={revision} referencePages={referencePages} referenceAliases={referenceAliases}/>;
}
