'use client';

import {ArrowSquareOut,CaretDown,FilePdf,TextT} from '@phosphor-icons/react';
import {buttonVariants} from 'fumadocs-ui/components/ui/button';
import {Popover,PopoverContent,PopoverTrigger} from 'fumadocs-ui/components/ui/popover';

type Props={
 english:boolean;
 markdownUrl:string;
 pdfUrl?:string;
};

const itemClass='inline-flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-fd-accent hover:text-fd-accent-foreground [&_svg]:size-4';

export function FumadocsPublicationOpenMenu({english,markdownUrl,pdfUrl}:Props){
 return <Popover>
  <PopoverTrigger className={buttonVariants({variant:'secondary',size:'sm',className:'gap-1.5'})}>
   {english?'Open':'打开'}
   <CaretDown aria-hidden="true" className="text-fd-muted-foreground"/>
  </PopoverTrigger>
  <PopoverContent align="start" className="flex min-w-56 flex-col">
   <a className={itemClass} href={markdownUrl} target="_blank" rel="noopener noreferrer">
    <TextT aria-hidden="true"/>
    <span>{english?'View Markdown':'查看 Markdown'}</span>
    <ArrowSquareOut aria-hidden="true" className="ms-auto text-fd-muted-foreground"/>
   </a>
   {pdfUrl&&<a className={itemClass} href={pdfUrl}>
    <FilePdf aria-hidden="true"/>
    <span>{english?'Read / export PDF':'PDF 阅读／导出'}</span>
   </a>}
  </PopoverContent>
 </Popover>;
}
