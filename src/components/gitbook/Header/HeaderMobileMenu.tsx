'use client';
// Adapted from GitBook HeaderMobileMenu: mobile trigger and close on navigation.
// JUYU adds a native modal dialog around the existing authorized TOC instead of
// GitBook's global body class / SideSheet controller. Desktop keeps its sidebar.
import {useCallback,useEffect,useId,useRef,useState,useSyncExternalStore,type ReactNode} from 'react';
const subscribe=()=>()=>{};
const dialogSupported=()=>typeof HTMLDialogElement!=='undefined'&&typeof HTMLDialogElement.prototype.showModal==='function'&&typeof HTMLDialogElement.prototype.close==='function';
const serverSnapshot=()=>false;
function positionCurrent(root:HTMLElement|null) {
 const active=root?.querySelector<HTMLElement>('[aria-current="page"]');
 const scroller=active?.closest<HTMLElement>('[data-testid="toc-scroll-container"]');
 if(active&&scroller&&scroller.clientHeight>0&&active.getClientRects().length)scroller.scrollTop+=active.getBoundingClientRect().top-scroller.getBoundingClientRect().top-scroller.clientHeight/2+active.offsetHeight/2;
}
export function HeaderMobileMenu({children,currentPagePath,title='文章目录菜单'}:{children:ReactNode;currentPagePath:string;title?:string}) {
 const enhanced=useSyncExternalStore(subscribe,dialogSupported,serverSnapshot);
 const id=useId();const titleId=useId();
 const trigger=useRef<HTMLButtonElement>(null);const dialog=useRef<HTMLDialogElement>(null);
 const desktop=useRef<HTMLDivElement>(null);const closeButton=useRef<HTMLButtonElement>(null);
 const release=useRef<()=>void>(()=>{});const outsideDown=useRef(false);
 const [open,setOpen]=useState(false);
 const restore=useCallback(()=>{release.current();release.current=()=>{};},[]);
 useEffect(()=>{
   const screen=window.matchMedia('(min-width: 1024px)');
   const resize=()=>{if(screen.matches){dialog.current?.close?.();positionCurrent(desktop.current);}};
   screen.addEventListener('change',resize);
   return()=>{screen.removeEventListener('change',resize);restore();};
 },[restore]);
 // Includes article query selection; path-only routing would miss these changes.
 useEffect(()=>{dialog.current?.close?.();},[currentPagePath]);
 const show=()=>{
   const panel=dialog.current;if(!panel||panel.open||!enhanced)return;
   const body=document.body;const x=window.scrollX,y=window.scrollY;
   const saved={position:body.style.position,top:body.style.top,left:body.style.left,width:body.style.width,overflow:body.style.overflow};
   release.current=()=>{Object.assign(body.style,saved);window.scrollTo(x,y);};
   Object.assign(body.style,{position:'fixed',top:`-${y}px`,left:`-${x}px`,width:'100%',overflow:'hidden'});
   panel.showModal();setOpen(true);closeButton.current?.focus({preventScroll:true});
   // Hidden dialogs have no layout at mount, so position the active item on open.
   positionCurrent(panel);
 };
 const closed=()=>{
   restore();setOpen(false);
   if(window.matchMedia('(max-width: 1023px)').matches)trigger.current?.focus({preventScroll:true});
   else (desktop.current?.querySelector<HTMLElement>('[aria-current="page"]')??desktop.current?.querySelector<HTMLElement>('h2'))?.focus({preventScroll:true});
 };
 const outside=(event:{clientX:number;clientY:number})=>{
   const rect=dialog.current!.getBoundingClientRect();
   return event.clientX<rect.left||event.clientX>=rect.right||event.clientY<rect.top||event.clientY>=rect.bottom;
 };
 return <div className="reader-navigation-shell" data-enhanced={enhanced}>
   <div ref={desktop} className="desktop-navigation">{children}</div>
   <details className="mobile-navigation-fallback"><summary>文章目录</summary>{children}</details>
   <div className="mobile-navigation-bar">
     <button ref={trigger} type="button" className="mobile-toc-trigger" data-testid="toc-button" aria-label="打开文章目录" aria-expanded={open} aria-controls={id} aria-haspopup="dialog" onClick={show}>
       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg><span>文章目录</span>
     </button>
   </div>
   <dialog onKeyDown={event=>{
     // Adapted from GitBook SideSheet's first/last Tab loop. Native modal inertness
     // blocks background controls; this also prevents a jump into browser chrome.
     if(event.key!=='Tab')return;
     const focusable=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(element=>element.getClientRects().length>0);
     const first=focusable[0],last=focusable[focusable.length-1],current=document.activeElement;
     if(event.shiftKey&&current===first){event.preventDefault();last?.focus();}
     else if(!event.shiftKey&&current===last){event.preventDefault();first?.focus();}
   }} ref={dialog} id={id} className="mobile-toc-dialog" aria-labelledby={titleId} onClose={closed}
     onPointerDown={event=>{outsideDown.current=event.target===event.currentTarget&&outside(event);}}
     onClick={event=>{
       if(outsideDown.current&&event.target===event.currentTarget&&outside(event)){dialog.current?.close?.();outsideDown.current=false;return;}
       if(event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey&&!event.defaultPrevented&&(event.target as Element).closest('a[href]'))dialog.current?.close?.();
     }}>
     <div className="mobile-toc-header"><h2 id={titleId}>{title}</h2><button ref={closeButton} type="button" aria-label="关闭文章目录" onClick={()=>dialog.current?.close?.()}>×</button></div>
     {children}
   </dialog>
 </div>;
}
