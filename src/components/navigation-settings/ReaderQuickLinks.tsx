/* Full requests refresh server-filtered menu and destination authorization. */
'use client';
import {useState} from 'react';
import type {MenuItem} from '../../navigation-settings/model';
export function ReaderQuickLinks({items,currentHref,unavailable=false}:{items?:MenuItem[];currentHref?:string;unavailable?:boolean}){
 const [expanded,setExpanded]=useState(false);
 if(unavailable||!items)return <div className="reader-shortcuts reader-shortcuts-notice" role="status">快捷入口暂时无法加载。<button type="button" onClick={()=>location.reload()}>重新加载</button></div>;
 if(items.length===0)return <div className="reader-shortcuts reader-shortcuts-notice">暂无快捷入口，可从文章目录查阅资料。</div>;
 return <nav className="reader-shortcuts" aria-label="资料库快捷入口"><button className="reader-shortcuts-toggle" type="button" aria-expanded={expanded} aria-controls="reader-shortcuts-list" onClick={()=>setExpanded(!expanded)}>快捷入口 <span aria-hidden="true">{expanded?'−':'＋'}</span></button><ul id="reader-shortcuts-list" className={expanded?'is-expanded':''}>{items.map(item=><li key={item.id}><a href={item.href} aria-current={item.href===currentHref?'page':undefined}>{item.label}</a></li>)}</ul></nav>;
}
