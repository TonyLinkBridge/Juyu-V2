'use client';
import {useEffect,useId,useRef,useState} from 'react';
import type {TextBlock} from '../../../media/model';
import {decodeTabBody} from '../../../media/tab-body';
import {ReaderIcon} from '../../../reader/icons';
import {StructuredDocument} from '../Reading/StructuredDocument';
import {useReaderLocale} from '../Media/ArticleReferenceContext';

type TabsBlock=Extract<TextBlock,{type:'tabs'}>;
const selectionEvent='juyu:select-tab';
const slug=(title:string,id:string)=>title.trim().normalize('NFKC').toLocaleLowerCase()||id;
const linkKey=(tabs:TabsBlock['tabs'],id:string)=>{
 const tab=tabs.find(item=>item.id===id);if(!tab)return id;
 const key=slug(tab.title,tab.id);
 return tabs.filter(item=>slug(item.title,item.id)===key).length>1?tab.id:key;
};

export function DynamicTabs({block,documentId,revision,admin=false}:{block:TabsBlock;documentId?:string;revision?:number;admin?:boolean}){
 const locale=useReaderLocale(),english=locale==='en';
 const prefix=useId(),listRef=useRef<HTMLDivElement>(null),moreRef=useRef<HTMLDetailsElement>(null);
 const [selected,setSelected]=useState(block.tabs[0]?.id),[overflow,setOverflow]=useState(false),[copyState,setCopyState]=useState('');
 const active=block.tabs.some(tab=>tab.id===selected)?selected:block.tabs[0]?.id;
 useEffect(()=>{
  const receive=(event:Event)=>{const detail=(event as CustomEvent<{source:string;slug:string}>).detail;if(!detail||detail.source===prefix)return;const match=block.tabs.find(tab=>slug(tab.title,tab.id)===detail.slug);if(match)setSelected(match.id);};
  window.addEventListener(selectionEvent,receive);return()=>window.removeEventListener(selectionEvent,receive);
 },[block.tabs,prefix]);
 useEffect(()=>{
  const restore=()=>{const key=new URL(window.location.href).searchParams.get('juyuTab');if(!key)return;const match=block.tabs.find(tab=>linkKey(block.tabs,tab.id)===key);if(match)setSelected(match.id);};
  restore();window.addEventListener('popstate',restore);return()=>window.removeEventListener('popstate',restore);
 },[block.tabs]);
 useEffect(()=>{const list=listRef.current;if(!list)return;const measure=()=>setOverflow(list.scrollWidth>list.clientWidth+2);measure();const observer=new ResizeObserver(measure);observer.observe(list);return()=>observer.disconnect();},[block.tabs]);
 function tabUrl(id:string){const url=new URL(window.location.href);url.searchParams.set('juyuTab',linkKey(block.tabs,id));return url;}
 function select(index:number,focus=false){const tab=block.tabs[index];if(!tab)return;setSelected(tab.id);setCopyState('');const url=tabUrl(tab.id);window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);window.dispatchEvent(new CustomEvent(selectionEvent,{detail:{source:prefix,slug:slug(tab.title,tab.id)}}));moreRef.current?.removeAttribute('open');if(focus){const button=document.getElementById(`${prefix}-tab-${tab.id}`);button?.focus({preventScroll:true});button?.scrollIntoView({block:'nearest',inline:'nearest'});}}
 async function copyLink(){if(!active)return;try{await navigator.clipboard.writeText(tabUrl(active).toString());setCopyState(english?'Link copied':'链接已复制');}catch{setCopyState(english?'Could not copy. Copy the link from the address bar.':'复制失败，请从地址栏复制链接');}}
 const title=(value:string,index:number)=>value||(english?`Tab ${index+1}`:`标签 ${index+1}`);
 return <section className="rich-tabs" aria-label={english?'Tabbed content':'分页内容'}><div className="rich-tabs-nav"><div role="tablist" aria-label={english?'Content tabs':'内容标签'} className="rich-tablist" ref={listRef}>{block.tabs.map((tab,index)=><button key={tab.id} type="button" role="tab" id={`${prefix}-tab-${tab.id}`} aria-controls={`${prefix}-panel-${tab.id}`} aria-selected={active===tab.id} tabIndex={active===tab.id?0:-1} onClick={()=>select(index)} onKeyDown={event=>{const next=event.key==='ArrowRight'?(index+1)%block.tabs.length:event.key==='ArrowLeft'?(index-1+block.tabs.length)%block.tabs.length:event.key==='Home'?0:event.key==='End'?block.tabs.length-1:null;if(next!==null){event.preventDefault();select(next,true);}}}>{tab.iconKey&&<ReaderIcon icon={tab.iconKey} size={16} className="rich-tab-icon"/>}{title(tab.title,index)}</button>)}</div>{overflow&&<details ref={moreRef} className="rich-tabs-more"><summary>{english?'More tabs':'更多标签'}</summary><div role="group" aria-label={english?'All content tabs':'全部内容标签'}>{block.tabs.map((tab,index)=><button key={tab.id} type="button" aria-current={active===tab.id?'true':undefined} onClick={()=>select(index,true)}>{tab.iconKey&&<ReaderIcon icon={tab.iconKey} size={16} className="rich-tab-icon"/>}{title(tab.title,index)}</button>)}</div></details>}<button type="button" className="rich-tab-share" onClick={()=>void copyLink()} aria-label={english?'Copy link to this tab':'复制当前标签链接'} title={english?'Copy link to this tab':'复制当前标签链接'}>{english?'Copy link':'复制链接'}</button></div><span className="sr-only" role="status">{copyState}</span>{block.tabs.map((tab,index)=><div key={tab.id} role="tabpanel" id={`${prefix}-panel-${tab.id}`} aria-labelledby={`${prefix}-tab-${tab.id}`} tabIndex={0} data-active={active===tab.id}><strong className="rich-print-tab-title">{title(tab.title,index)}</strong>{decodeTabBody(tab.body)?<StructuredDocument blocks={decodeTabBody(tab.body)!} documentId={documentId} revision={revision} admin={admin} locale={locale}/>:<p>{tab.body}</p>}</div>)}</section>;
}
