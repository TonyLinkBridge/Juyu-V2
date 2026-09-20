'use client';
// Adapted from GitBook SearchInput: labeled input, search icon, clear control and shortcut.
// Native GET keeps navigation and browser history usable without JavaScript.
import {useEffect,useId,useRef,useState} from 'react';
import {parseSearchQuery,searchHref,searchScopeLabels,englishSearchScopeLabels,type SearchScope,type SearchResult,type TitleSearch} from '../../../reader/search';
import {clearRecentSearch,recentSearches,recordRecentSearch,type RecentSearch} from '../../../reader/recent-search';
export function SearchInput({query='',scope='all',locale='zh-CN'}:{query?:string;scope?:SearchScope;locale?:'zh-CN'|'en'}) {
 const formRef=useRef<HTMLFormElement>(null);
 const inputRef=useRef<HTMLInputElement>(null);
 const composing=useRef(false);
 const [value,setValue]=useState(query);
 const [pending,setPending]=useState(false);
 const [invalid,setInvalid]=useState(false);const errorId=useId();
 const listId=useId();
 const [open,setOpen]=useState(false);
 const [suggestions,setSuggestions]=useState<TitleSearch|null>(null);
 const [suggestionError,setSuggestionError]=useState(false);
 const [active,setActive]=useState(-1);
 const [selectedScope,setSelectedScope]=useState<SearchScope>(scope);
 const [recent,setRecent]=useState<RecentSearch[]>([]);
 useEffect(()=>{const refresh=()=>{try{setRecent(recentSearches(sessionStorage,undefined,locale));}catch{setRecent([]);}};refresh();window.addEventListener('juyu-recent-search-change',refresh);return()=>window.removeEventListener('juyu-recent-search-change',refresh);},[locale]);
 const remember=(term:string,termScope=selectedScope)=>{try{setRecent(recordRecentSearch(sessionStorage,term,termScope,undefined,locale));window.dispatchEvent(new Event('juyu-recent-search-change'));}catch{}};
 const forget=()=>{try{clearRecentSearch(sessionStorage,locale);setRecent([]);window.dispatchEvent(new Event('juyu-recent-search-change'));}catch{setRecent([]);}};
 const visible=suggestions?.query===parseSearchQuery(value).query?suggestions:null;
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
 useEffect(()=>{
  if(!open||parseSearchQuery(value).status!=='ready'){return;}
  const controller=new AbortController();
  const timer=window.setTimeout(()=>{
   void fetch(`/api/search?q=${encodeURIComponent(parseSearchQuery(value).query)}&scope=${selectedScope}${locale==='en'?'&lang=en':''}`,{credentials:'same-origin',cache:'no-store',signal:controller.signal})
    .then(async response=>{if(!response.ok)throw new Error('SEARCH_UNAVAILABLE');return response.json() as Promise<TitleSearch>;})
    .then(data=>{if(!controller.signal.aborted){setSuggestions(data);setSuggestionError(false);setActive(-1);}})
    .catch(()=>{if(!controller.signal.aborted){setSuggestions(null);setSuggestionError(true);}});
  },180);
  return()=>{window.clearTimeout(timer);controller.abort();};
 },[open,value,selectedScope,locale]);
 useEffect(()=>{
  const outside=(event:PointerEvent)=>{if(formRef.current&&!formRef.current.contains(event.target as Node))setOpen(false);};
  document.addEventListener('pointerdown',outside);
  return()=>document.removeEventListener('pointerdown',outside);
 },[]);
 const clear=()=>{setValue('');setInvalid(false);setPending(false);setSuggestions(null);setOpen(false);setActive(-1);inputRef.current?.focus();};
 const items=(visible?.results??[]).filter((result:SearchResult)=>result.href.startsWith('/help-centre')&&!result.href.startsWith('//'));
 return <form ref={formRef} action="/help-centre" method="get" role="search" aria-label={locale==='en'?'Search the knowledge base':'资料库搜索'} className="gitbook-search-form"
   onSubmit={event=>{if(composing.current){event.preventDefault();return;}if(parseSearchQuery(value).status==='invalid'){event.preventDefault();setInvalid(true);setPending(false);inputRef.current?.focus();return;}if(parseSearchQuery(value).status==='ready')remember(value);if(open&&active>=0&&items[active]){event.preventDefault();window.location.assign(items[active].href);return;}setOpen(false);setPending(true);}}>
   <div className="gitbook-search-input">
     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>
     <input ref={inputRef} name="q" type="text" role="combobox" aria-label={locale==='en'?'Search articles':'搜索资料'} aria-autocomplete="list" aria-expanded={open&&(parseSearchQuery(value).status==='ready'||recent.length>0)} aria-controls={listId} aria-activedescendant={open&&active>=0?`${listId}-${active}`:undefined} placeholder={locale==='en'?'Search articles…':'搜索资料…'} value={value} aria-invalid={invalid||undefined} aria-describedby={invalid?errorId:undefined} autoComplete="off" enterKeyHint="search"
       onFocus={()=>{if(parseSearchQuery(value).status==='ready'||recent.length)setOpen(true);}}
       onChange={event=>{setValue(event.target.value);setInvalid(false);setPending(false);setSuggestions(null);setSuggestionError(false);setActive(-1);setOpen(true);}} onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;}}
       onKeyDown={event=>{if(event.key==='Enter'&&(composing.current||event.nativeEvent.isComposing||event.nativeEvent.keyCode===229))event.preventDefault();
         if(event.key==='Escape'&&!composing.current){event.preventDefault();if(open){setOpen(false);setActive(-1);}else clear();}
         if(open&&items.length&&event.key==='ArrowDown'){event.preventDefault();setActive(index=>(index+1)%items.length);}
         if(open&&items.length&&event.key==='ArrowUp'){event.preventDefault();setActive(index=>index<0?items.length-1:(index-1+items.length)%items.length);}}}/>
     {value?<button type="button" className="search-clear" aria-label={locale==='en'?'Clear search':'清空搜索'} onClick={clear}>×</button>:<kbd aria-hidden="true">⌘ / Ctrl K</kbd>}
     <button type="submit" className="search-submit">{locale==='en'?'Search':'搜索'}</button>
   </div>
   <input type="hidden" name="scope" value={selectedScope}/>
   {locale==='en'&&<input type="hidden" name="lang" value="en"/>}
   {open&&parseSearchQuery(value).status==='empty'&&recent.length>0&&<div className="search-popover recent-search-popover"><div className="recent-search-heading"><strong>{locale==='en'?'Recent searches':'最近搜索'}</strong><button type="button" onClick={forget}>{locale==='en'?'Clear':'清除记录'}</button></div><ul id={listId} role="listbox" aria-label={locale==='en'?'Recent searches':'最近搜索'}>{recent.map(entry=><li key={`${entry.scope}:${entry.query}`}><a role="option" aria-selected={false} href={searchHref(entry.query,1,entry.scope,locale)} onClick={()=>remember(entry.query,entry.scope)}>{entry.query}<small>{(locale==='en'?englishSearchScopeLabels:searchScopeLabels)[entry.scope]}</small></a></li>)}</ul></div>}
   {open&&parseSearchQuery(value).status==='ready'&&<div className="search-popover"><div className="search-scope-picker" aria-label={locale==='en'?'Search within':'搜索范围'}>{(Object.keys(searchScopeLabels) as SearchScope[]).map(option=><button key={option} type="button" className={selectedScope===option?'is-selected':''} aria-pressed={selectedScope===option} onClick={()=>{setSelectedScope(option);setSuggestions(null);setSuggestionError(false);setActive(-1);}}>{(locale==='en'?englishSearchScopeLabels:searchScopeLabels)[option]}</button>)}</div><div className="search-suggestions" role="listbox" id={listId} aria-label={locale==='en'?'Suggestions':'即时搜索结果'}>
     {suggestionError?<p role="status">{locale==='en'?'Suggestions are unavailable. Press Search to see full results.':'即时结果暂时无法读取。按搜索可查看完整结果。'}</p>
       :!visible?<p role="status">{locale==='en'?'Searching…':'正在查找…'}</p>
       :items.length?<>{items.map((item,index)=><a key={item.id} id={`${listId}-${index}`} role="option" aria-selected={active===index} className={active===index?'is-active':''} href={item.href} onMouseEnter={()=>setActive(index)} onClick={()=>{remember(value);setOpen(false);}}><span>{(locale==='en'?{article:'Article',ops:'OPS Internal',reference:'Reference',qa:'Q&A'}:{article:'知识文章',ops:'OPS Internal',reference:'Reference 速查',qa:'Q&A 问答'})[item.kind??'article']}</span><strong>{item.title}</strong>{item.snippet&&<small>{item.snippet}</small>}</a>)}<a className="search-suggestions-all" href={searchHref(visible.query,1,selectedScope,locale)} onClick={()=>remember(value)}>{locale==='en'?`View all ${visible.total} results →`:`查看全部 ${visible.total} 项结果 →`}</a></>
       :<><p>{locale==='en'?'No matching articles yet.':'没有找到相关资料。'}</p><a className="search-suggestions-all" href={searchHref(visible.query,1,selectedScope,locale)} onClick={()=>remember(value)}>{locale==='en'?'Open full search →':'打开完整搜索 →'}</a></>}
   </div></div>}
   {invalid&&<span id={errorId} role="alert" className="search-input-error">{locale==='en'?'Use 120 characters or fewer, without control characters.':'最多 120 个字符，请缩短关键词并移除控制字符。'}</span>}
   {pending&&<span role="status" className="search-pending">{locale==='en'?'Searching…':'正在搜索…'}</span>}
 </form>;
}
