'use client';
import {useMemo,useState} from 'react';
import type {QaItem} from '../../qa/model';
import type {Publication} from '../../reader/body';
import {AuthenticatedQaAnswer} from './AuthenticatedQaAnswer';
import {QaAnswer} from './QaAnswer';

function questionNumber(index:number){
 return String(index+1).padStart(2,'0');
}

export function QaEditorialIndex({items,viewerId,initialAnswer,previewAnswers,canEdit=false,locale='zh-CN'}:{items:QaItem[];viewerId?:string;initialAnswer?:Publication;previewAnswers?:Record<string,Publication>;canEdit?:boolean;locale?:'zh-CN'|'en'}){
 const initialId=useMemo(()=>items.some(item=>item.id===initialAnswer?.id)?initialAnswer!.id:items[0]?.id,[items,initialAnswer]);
 const [selectedId,setSelectedId]=useState(initialId);
 const selectedIndex=Math.max(0,items.findIndex(item=>item.id===selectedId));
 const selected=items[selectedIndex]??items[0];
 if(!selected)return null;
 const english=locale==='en';
 const select=(id:string)=>{
  setSelectedId(id);
  const url=new URL(window.location.href);
  url.searchParams.set('question',id);
  url.hash='qa-'+encodeURIComponent(id);
  window.history.replaceState(window.history.state,'',url);
 };
 return <div className="qa-editorial-layout">
  <nav className="qa-editorial-index" aria-label={english?'Question index':'问题索引'}>
   <ol>{items.map((item,index)=><li key={item.id}>
    <button type="button" aria-pressed={item.id===selected.id} onClick={()=>select(item.id)}>
     <span className="qa-editorial-number" aria-hidden="true">{questionNumber(index)}</span>
     <span>{item.title}</span>
    </button>
   </li>)}</ol>
  </nav>
  <div className="qa-editorial-detail" aria-live="polite">
   {previewAnswers?.[selected.id]?<QaAnswer
    key={selected.id}
    initial={previewAnswers[selected.id]}
    id={selected.id}
    title={selected.title}
    revision={selected.revision}
    topics={selected.tags}
    canEdit={canEdit}
    locale={locale}
    editorial
   />:<AuthenticatedQaAnswer
    key={selected.id}
    viewerId={viewerId}
    initial={initialAnswer?.id===selected.id?initialAnswer:undefined}
    id={selected.id}
    title={selected.title}
    revision={selected.revision}
    topics={selected.tags}
    canEdit={canEdit}
    locale={locale}
    editorial
   />}
  </div>
 </div>;
}
