'use client';
// Adapted from GitBook SearchInput: labeled input, search icon, clear control and shortcut.
// Native GET keeps navigation and browser history usable without JavaScript.
import {useEffect,useId,useRef,useState} from 'react';
import {parseSearchQuery} from '../../../reader/search';
export function SearchInput({query=''}:{query?:string}) {
 const inputRef=useRef<HTMLInputElement>(null);
 const composing=useRef(false);
 const [value,setValue]=useState(query);
 const [pending,setPending]=useState(false);
 const [invalid,setInvalid]=useState(false);const errorId=useId();
 useEffect(()=>{
   const shortcut=(event:KeyboardEvent)=>{
     if((event.metaKey||event.ctrlKey)&&!event.altKey&&event.key.toLowerCase()==='k'){
       event.preventDefault();inputRef.current?.focus();inputRef.current?.select();
     }
   };
   const restored=()=>setPending(false);
   window.addEventListener('keydown',shortcut);window.addEventListener('pageshow',restored);
   return()=>{window.removeEventListener('keydown',shortcut);window.removeEventListener('pageshow',restored);};
 },[]);
 const clear=()=>{setValue('');setInvalid(false);setPending(false);inputRef.current?.focus();};
 return <form action="/help-centre" method="get" role="search" aria-label="资料库搜索" className="gitbook-search-form"
   onSubmit={event=>{if(composing.current){event.preventDefault();return;}if(parseSearchQuery(value).status==='invalid'){event.preventDefault();setInvalid(true);setPending(false);inputRef.current?.focus();return;}setPending(true);}}>
   <div className="gitbook-search-input">
     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>
     <input ref={inputRef} name="q" type="text" aria-label="搜索资料" placeholder="搜索资料…" value={value} aria-invalid={invalid||undefined} aria-describedby={invalid?errorId:undefined} autoComplete="off" enterKeyHint="search"
       onChange={event=>{setValue(event.target.value);setInvalid(false);setPending(false);}} onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;}}
       onKeyDown={event=>{if(event.key==='Enter'&&(composing.current||event.nativeEvent.isComposing||event.nativeEvent.keyCode===229))event.preventDefault();
         if(event.key==='Escape'&&!composing.current){event.preventDefault();clear();}}}/>
     {value?<button type="button" className="search-clear" aria-label="清空搜索" onClick={clear}>×</button>:<kbd aria-hidden="true">⌘ / Ctrl K</kbd>}
     <button type="submit" className="search-submit">搜索</button>
   </div>
   {invalid&&<span id={errorId} role="alert" className="search-input-error">最多 120 个字符，请缩短关键词并移除控制字符。</span>}
   {pending&&<span role="status" className="search-pending">正在搜索…</span>}
 </form>;
}
