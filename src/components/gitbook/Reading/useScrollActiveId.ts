'use client';
// Adapted from GitBook hooks/useScrollActiveId.ts (GPL-3.0).
// Keep observer-driven heading state; supplement it with document-position
// tracking for long paragraphs, reverse scrolling, and the document bottom.
import React from 'react';
export function useScrollActiveId(ids:string[]):string|undefined {
 const [activeId,setActiveId]=React.useState<string|undefined>(ids[0]);
 React.useEffect(()=>{
   if(!ids.length)return;
   let frame=0;
   let pinned:{id:string;y:number}|null=null;
   const update=()=>{
     frame=0;
     // A clicked/deep-linked heading remains selected at the clamped end position.
     // Any subsequent scroll movement releases that choice to normal scroll tracking.
     if(pinned&&Math.abs(window.scrollY-pinned.y)<1){setActiveId(pinned.id);return;}
     pinned=null;
     const maximum=document.documentElement.scrollHeight-window.innerHeight;
     if(maximum>1&&window.scrollY>=maximum-2){setActiveId(ids[ids.length-1]);return;}
     let current=ids[0];
     for(const id of ids){const element=document.getElementById(id);if(element&&element.getBoundingClientRect().top<=48)current=id;}
     setActiveId(current);
   };
   const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
   const restoreHash=()=>{
     const id=window.location.hash.slice(1);
     if(ids.includes(id)) {
       document.getElementById(id)?.scrollIntoView({block:'start',behavior:'auto'});
       pinned={id,y:window.scrollY};setActiveId(id);
     }else{pinned=null;schedule();}
   };
   const click=(event:MouseEvent)=>{
     if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return;
     const target=event.target;
     const anchor=target instanceof Element?target.closest('a[href]'):null;
     // Same-hash native anchor navigation does not dispatch hashchange.
     if(anchor?.getAttribute('href')===window.location.hash&&ids.includes(window.location.hash.slice(1)))restoreHash();
   };
   const resize=()=>{pinned=null;schedule();};
   const initial=requestAnimationFrame(()=>{restoreHash();schedule();});
   window.addEventListener('hashchange',restoreHash);
   document.addEventListener('click',click);
   window.addEventListener('scroll',schedule,{passive:true});
   window.addEventListener('resize',resize);
   const observer=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(schedule,{rootMargin:'-16px 0px -55% 0px',threshold:0.9});
   ids.forEach(id=>{const element=document.getElementById(id);if(element)observer?.observe(element);});
   return ()=>{
     observer?.disconnect();cancelAnimationFrame(initial);cancelAnimationFrame(frame);
     window.removeEventListener('hashchange',restoreHash);window.removeEventListener('scroll',schedule);window.removeEventListener('resize',resize);document.removeEventListener('click',click);
   };
 },[ids]);
 return activeId;
}
