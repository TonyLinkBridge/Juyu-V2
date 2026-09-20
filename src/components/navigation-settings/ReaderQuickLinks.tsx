/* Links use server-filtered entries; destinations still authorize every request. */
'use client';
import Link from 'next/link';
import {useState} from 'react';
import {usePathname} from 'next/navigation';
import {House,Files,LinkSimple,Chats,Shield,Star,Clock,ListChecks} from '@phosphor-icons/react';
import type {MenuItem} from '../../navigation-settings/model';
export function ReaderQuickLinks({items,currentHref,unavailable=false,locale='zh-CN'}:{items?:MenuItem[];currentHref?:string;unavailable?:boolean;locale?:'zh-CN'|'en'}){
 const english=locale==='en';
 const [expanded,setExpanded]=useState(false);
 const [prefetchHref,setPrefetchHref]=useState<string>();
 const pathname=usePathname();
 const activeHref=currentHref??pathname;
 if(unavailable||!items)return <div className="reader-shortcuts reader-shortcuts-notice" role="status">{english?'Quick links are unavailable.':'快捷入口暂时无法加载。'}<button type="button" onClick={()=>location.reload()}>{english?'Reload':'重新加载'}</button></div>;
 if(items.length===0)return <div className="reader-shortcuts reader-shortcuts-notice">{english?'No quick links yet. Browse the article directory instead.':'暂无快捷入口，可从文章目录查阅资料。'}</div>;
 const label=(item:MenuItem)=>{if(!english)return item.label;const fixed:Record<string,string>={'/help-centre':'Help Centre','/help-centre/library':'Articles','/help-centre/ops':'OPS Internal','/help-centre/reference':'Reference','/help-centre/qa':'Q&A','/help-centre/favorites':'Saved articles','/help-centre/recent':'Recently viewed','/help-centre/forms':'Internal forms · Chinese only'};return fixed[item.href]??item.label;};
 const href=(item:MenuItem)=>english&&['/help-centre','/help-centre/library','/help-centre/ops','/help-centre/reference','/help-centre/qa','/help-centre/favorites','/help-centre/recent'].includes(item.href)?`${item.href}${item.href.includes('?')?'&':'?'}lang=en`:item.href;
 return <nav className="reader-shortcuts" aria-label={english?'Help Centre quick links':'资料库快捷入口'}><button className="reader-shortcuts-toggle" type="button" aria-expanded={expanded} aria-controls="reader-shortcuts-list" onClick={()=>setExpanded(!expanded)}>{english?'Quick links':'快捷入口'} <span aria-hidden="true">{expanded?'−':'＋'}</span></button><ul id="reader-shortcuts-list" className={expanded?'is-expanded':''}>{items.map(item=>{const Icon=item.href.includes('reference')?LinkSimple:item.href.includes('/qa')?Chats:item.href.includes('/ops')?Shield:item.href.includes('/favorites')?Star:item.href.includes('/recent')?Clock:item.href.includes('/forms')?ListChecks:item.id==='home'||item.href==='/help-centre'?House:Files;return <li key={item.id}><Link prefetch={prefetchHref===item.href?null:false} onMouseEnter={()=>setPrefetchHref(item.href)} onFocus={()=>setPrefetchHref(item.href)} href={href(item)} onClick={()=>setExpanded(false)} aria-current={item.href===activeHref?'page':undefined}><Icon size={20} aria-hidden="true"/><span>{label(item)}</span></Link></li>;})}</ul></nav>;
}
