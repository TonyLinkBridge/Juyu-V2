'use client';
import {useId,useState} from 'react';
import type {TextBlock} from '../../../media/model';
// Adapted from GitBook DynamicTabs: tab list, stable item identity, linked panels.
// JUYU keeps selection local and adds roving keyboard focus; no global vendor state.
export function DynamicTabs({block}:{block:Extract<TextBlock,{type:'tabs'}>}){
 const prefix=useId();const [selected,setSelected]=useState(block.tabs[0]?.id);const active=block.tabs.some(t=>t.id===selected)?selected:block.tabs[0]?.id;
 function select(index:number,focus=false){const tab=block.tabs[index];if(!tab)return;setSelected(tab.id);if(focus){const button=document.getElementById(`${prefix}-tab-${tab.id}`);button?.focus({preventScroll:true});button?.scrollIntoView({block:'nearest',inline:'nearest'});}}
 return <section className="rich-tabs" aria-label="分页内容"><div role="tablist" aria-label="内容标签" className="rich-tablist">{block.tabs.map((tab,index)=><button key={tab.id} type="button" role="tab" id={`${prefix}-tab-${tab.id}`} aria-controls={`${prefix}-panel-${tab.id}`} aria-selected={active===tab.id} tabIndex={active===tab.id?0:-1} onClick={()=>select(index)} onKeyDown={event=>{const next=event.key==='ArrowRight'?(index+1)%block.tabs.length:event.key==='ArrowLeft'?(index-1+block.tabs.length)%block.tabs.length:event.key==='Home'?0:event.key==='End'?block.tabs.length-1:null;if(next!==null){event.preventDefault();select(next,true);}}}>{tab.title||`标签 ${index+1}`}</button>)}</div>{block.tabs.map((tab,index)=><div key={tab.id} role="tabpanel" id={`${prefix}-panel-${tab.id}`} aria-labelledby={`${prefix}-tab-${tab.id}`} tabIndex={0} data-active={active===tab.id}><strong className="rich-print-tab-title">{tab.title||`标签 ${index+1}`}</strong><p>{tab.body}</p></div>)}</section>;
}
