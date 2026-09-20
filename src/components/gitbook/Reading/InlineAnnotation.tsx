'use client';
import {useId,useState,type ReactNode} from 'react';
import {useReaderLocale} from '../Media/ArticleReferenceContext';
export function InlineAnnotation({note,children}:{note:string;children:ReactNode}){
 const english=useReaderLocale()==='en';
 const id=useId(),[open,setOpen]=useState(false);
 return <span className="inline-annotation" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false);}} onKeyDown={event=>{if(event.key==='Escape'){setOpen(false);(event.currentTarget.querySelector('button') as HTMLButtonElement|null)?.focus();}}}>
  <button type="button" className="inline-annotation-trigger" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(value=>!value)}>{children}<sup aria-hidden="true">{english?'Note':'注'}</sup></button>
  {open&&<span id={id} role="note" className="inline-annotation-popover" tabIndex={-1}>{note}</span>}
 </span>;
}
