'use client';
import {useEffect,useState} from 'react';

type Size='compact'|'default'|'large';
type Width='comfortable'|'wide';
type Font='sans'|'serif';
type Preference={size:Size;width:Width;font:Font};
const KEY='juyu-reader-appearance-v1';
const DEFAULT:Preference={size:'default',width:'comfortable',font:'sans'};
function valid(value:unknown):Preference{
 if(!value||typeof value!=='object')return DEFAULT;
 const input=value as Record<string,unknown>;
 return {size:input.size==='compact'||input.size==='large'?input.size:'default',width:input.width==='wide'?'wide':'comfortable',font:input.font==='serif'?'serif':'sans'};
}
function apply(value:Preference){
 const root=document.documentElement;
 root.dataset.readerSize=value.size;
 root.dataset.readerWidth=value.width;
 root.dataset.readerFont=value.font;
}
export function ReaderAppearance({locale='zh-CN'}:{locale?:'zh-CN'|'en'}){
 const [value,setValue]=useState<Preference>(DEFAULT);
 useEffect(()=>{
  let saved=DEFAULT;
  try{saved=valid(JSON.parse(localStorage.getItem(KEY)||'null'));}catch{/* Use default when stored data is invalid. */}
  apply(saved);
  const timer=window.setTimeout(()=>setValue(saved),0);
  return ()=>window.clearTimeout(timer);
 },[]);
 function choose(next:Preference){setValue(next);apply(next);try{localStorage.setItem(KEY,JSON.stringify(next));}catch{/* Browsers may disable storage. Current view still updates. */}}
 return <details className="reader-appearance"><summary>{locale==='en'?'Reading preferences':'阅读外观'}</summary><div className="reader-appearance-panel">
  <fieldset><legend>{locale==='en'?'Text size':'文字大小'}</legend><div className="reader-appearance-options">{([['compact','小','Small'],['default','标准','Default'],['large','大','Large']] as const).map(([key,zh,en])=><button key={key} type="button" aria-pressed={value.size===key} onClick={()=>choose({...value,size:key})}>{locale==='en'?en:zh}</button>)}</div></fieldset>
  <fieldset><legend>{locale==='en'?'Page width (large screens)':'正文宽度（大屏生效）'}</legend><div className="reader-appearance-options">{([['comfortable','标准','Default'],['wide','宽','Wide']] as const).map(([key,zh,en])=><button key={key} type="button" aria-pressed={value.width===key} onClick={()=>choose({...value,width:key})}>{locale==='en'?en:zh}</button>)}</div></fieldset>
  <fieldset><legend>{locale==='en'?'Font':'正文字体'}</legend><div className="reader-appearance-options">{([['sans','无衬线','Sans serif'],['serif','衬线','Serif']] as const).map(([key,zh,en])=><button key={key} type="button" aria-pressed={value.font===key} onClick={()=>choose({...value,font:key})}>{locale==='en'?en:zh}</button>)}</div></fieldset>
  <button type="button" className="reader-appearance-reset" onClick={()=>choose(DEFAULT)}>{locale==='en'?'Reset preferences':'恢复默认'}</button>
 </div></details>;
}
