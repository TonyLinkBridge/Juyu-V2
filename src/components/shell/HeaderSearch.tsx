'use client';
import {useEffect,useId,useRef,useState,type ReactNode} from 'react';
/** Keeps the existing authorized search form; only its small-screen presentation changes. */
export function HeaderSearch({children}:{children:ReactNode}){
 const [open,setOpen]=useState(false);const id=useId();const root=useRef<HTMLDivElement>(null);const trigger=useRef<HTMLButtonElement>(null);
 const focus=()=>requestAnimationFrame(()=>root.current?.querySelector('input')?.focus());
 useEffect(()=>{
  const outside=(e:PointerEvent)=>{if(root.current&&!root.current.contains(e.target as Node))setOpen(false);};
  const shortcut=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&!e.altKey&&e.key.toLowerCase()==='k'&&matchMedia('(max-width:760px)').matches){e.preventDefault();setOpen(true);focus();}};
  document.addEventListener('pointerdown',outside);window.addEventListener('keydown',shortcut);
  return()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('keydown',shortcut);};
 },[]);
 if(!children)return null;
 return <div ref={root} className={`header-search${open?' is-open':''}`} onKeyDown={e=>{if(e.key==='Escape'&&!e.nativeEvent.isComposing&&matchMedia('(max-width:760px)').matches){setOpen(false);trigger.current?.focus();}}}>
  <button ref={trigger} type="button" className="header-search-toggle" aria-label={open?'关闭搜索':'打开搜索'} aria-expanded={open} aria-controls={id} onClick={()=>{setOpen(!open);if(!open)focus();}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg></button>
  <div id={id} className="header-search-panel">{children}</div>
 </div>;
}
