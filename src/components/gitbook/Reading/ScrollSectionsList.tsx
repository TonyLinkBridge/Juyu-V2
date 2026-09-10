'use client';
// Adapted from GitBook PageAside/ScrollSectionsList.tsx (GPL-3.0).
// Preserve outline mapping, depth, active refs and scrolling; omit API/tag filters.
import React from 'react';
import type {DocumentSection} from '../../../reader/body';
import {useScrollActiveId} from './useScrollActiveId';
export function ScrollSectionsList({sections}:{sections:DocumentSection[]}) {
 const ids=React.useMemo(()=>sections.map(({id})=>id),[sections]);
 const activeId=useScrollActiveId(ids);
 const scrollContainerRef=React.useRef<HTMLUListElement>(null);
 const activeItemRef=React.useRef<HTMLLIElement>(null);
 React.useEffect(()=>{
   if(activeId&&activeItemRef.current&&scrollContainerRef.current) {
     scrollContainerRef.current.scrollTo({top:activeItemRef.current.offsetTop-100,behavior:'auto'});
   }
 },[activeId]);
 return <ul className="gitbook-outline-list relative flex flex-col" ref={scrollContainerRef}>
   {sections.map(section=><li key={section.id} className="outline-item flex relative" data-depth={section.depth}
     ref={activeId===section.id?activeItemRef:null}>
     <a href={`#${section.id}`} aria-current={activeId===section.id?'location':undefined}
       className={activeId===section.id?'outline-link active':'outline-link'}><span>{section.title}</span></a>
   </li>)}
 </ul>;
}
