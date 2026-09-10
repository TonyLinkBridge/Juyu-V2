/* Links use server-filtered entries; destinations still authorize every request. */
'use client';
import Link from 'next/link';
import {useState} from 'react';
import {usePathname} from 'next/navigation';
import {House,Files,LinkSimple,Chats,Shield,Star,Clock,ListChecks} from '@phosphor-icons/react';
import type {MenuItem} from '../../navigation-settings/model';
export function ReaderQuickLinks({items,currentHref,unavailable=false}:{items?:MenuItem[];currentHref?:string;unavailable?:boolean}){
 const [expanded,setExpanded]=useState(false);
 const [prefetchHref,setPrefetchHref]=useState<string>();
 const pathname=usePathname();
 const activeHref=currentHref??pathname;
 if(unavailable||!items)return <div className="reader-shortcuts reader-shortcuts-notice" role="status">快捷入口暂时无法加载。<button type="button" onClick={()=>location.reload()}>重新加载</button></div>;
 if(items.length===0)return <div className="reader-shortcuts reader-shortcuts-notice">暂无快捷入口，可从文章目录查阅资料。</div>;
 return <nav className="reader-shortcuts" aria-label="资料库快捷入口"><button className="reader-shortcuts-toggle" type="button" aria-expanded={expanded} aria-controls="reader-shortcuts-list" onClick={()=>setExpanded(!expanded)}>快捷入口 <span aria-hidden="true">{expanded?'−':'＋'}</span></button><ul id="reader-shortcuts-list" className={expanded?'is-expanded':''}>{items.map(item=>{const Icon=item.href.includes('reference')?LinkSimple:item.href.includes('/qa')?Chats:item.href.includes('/ops')?Shield:item.href.includes('/favorites')?Star:item.href.includes('/recent')?Clock:item.href.includes('/forms')?ListChecks:item.id==='home'||item.href==='/help-centre'?House:Files;return <li key={item.id}><Link prefetch={prefetchHref===item.href?null:false} onMouseEnter={()=>setPrefetchHref(item.href)} onFocus={()=>setPrefetchHref(item.href)} href={item.href} onClick={()=>setExpanded(false)} aria-current={item.href===activeHref?'page':undefined}><Icon size={20} aria-hidden="true"/><span>{item.label}</span></Link></li>;})}</ul></nav>;
}
