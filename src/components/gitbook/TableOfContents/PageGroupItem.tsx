'use client';
// Adapted from GitBook PageGroupItem.tsx (GPL-3.0): group state, button,
// descendants and recursive PagesList. JUYU replaces vendor theme/icon adapters.
// Native hidden removes collapsed links from keyboard and accessibility trees.
import React from 'react';
import type {NavigationGroup} from '../../../reader/tree';
import {PagesList} from './PagesList';
import {ToCButtonItemStyles} from './styles';

export function PageGroupItem(props:{page:NavigationGroup;currentPagePath:string;isFirst?:boolean}) {
 const {page,currentPagePath,isFirst}=props;
 const descendants=page.descendants??[];
 const hasDescendants=descendants.length>0;
 const [isOpen,setIsOpen]=React.useState(true);
 const panelId=React.useId();
 const handleToggle=()=>{if(hasDescendants)setIsOpen(prev=>!prev);};
 return <li className="page-group-item flex flex-col">
   <div className={isFirst?'gitbook-group-heading first-group':'gitbook-group-heading'}>
     <button type="button" disabled={!hasDescendants}
       aria-expanded={hasDescendants?isOpen:undefined} aria-controls={panelId}
       onClick={handleToggle}
       className={['ToCButtonItemStyles',...ToCButtonItemStyles.flat(),'toc-group min-h-8 w-full border-0 text-left'].join(' ')}>
       <span className="min-w-0 flex-1">{page.title}</span>
       {hasDescendants&&<svg className="toc-group-chevron" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" data-open={isOpen}><path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>}
     </button>
   </div>
   {hasDescendants&&<div id={panelId} hidden={!isOpen} className="gitbook-group-descendants">
     <PagesList pages={descendants} currentPagePath={currentPagePath}/>
   </div>}
 </li>;
}
