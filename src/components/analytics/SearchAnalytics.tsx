'use client';
import {useCallback,useEffect,useRef,type ReactNode,type MouseEvent} from 'react';
import type {TitleSearch} from '../../reader/search';
import {deliverAnalytics} from '../../analytics/client';
import {analyticsSearchSnapshot,clickedSearchResult,type SearchSnapshot} from '../../analytics/search';
export function SearchAnalytics({search,enabled=true,children}:{search:TitleSearch;enabled?:boolean;children:ReactNode}){
 return <Tracker key={JSON.stringify([enabled,search.query,search.page,search.total,search.results.map(x=>[x.id,x.revision,x.href])])} search={search} enabled={enabled}>{children}</Tracker>;
}
function Tracker({search,enabled,children}:{search:TitleSearch;enabled:boolean;children:ReactNode}){
 const current=useRef({snapshot:null as SearchSnapshot|null,stops:new Set<()=>void>()});
 const snapshot=useCallback(()=>{if(!enabled||document.visibilityState!=='visible')return null;if(!current.current.snapshot)current.current.snapshot=analyticsSearchSnapshot(search,crypto.randomUUID());return current.current.snapshot;},[enabled,search]);
 useEffect(()=>{
  const state=current.current;let frame=0,attempted=false;
  const visible=()=>{if(attempted||document.visibilityState!=='visible')return;cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(attempted)return;try{const payload=snapshot();if(payload){attempted=true;state.stops.add(deliverAnalytics({kind:'search',...payload}));}}catch{}});};
  const restored=(event:PageTransitionEvent)=>{if(event.persisted){for(const stop of state.stops)stop();state.stops.clear();state.snapshot=null;attempted=false;visible();}};
  visible();document.addEventListener('visibilitychange',visible);window.addEventListener('pageshow',restored);
  return()=>{cancelAnimationFrame(frame);for(const stop of state.stops)stop();state.stops.clear();document.removeEventListener('visibilitychange',visible);window.removeEventListener('pageshow',restored);};
 },[snapshot]);
 function clicked(event:MouseEvent<HTMLDivElement>){
  if((event.type==='click'&&event.button!==0)||(event.type==='auxclick'&&event.button!==1))return;
  try{const target=event.target instanceof Element?event.target.closest('a'):null;if(!target||!event.currentTarget.contains(target))return;const result=clickedSearchResult(search,target.href,location.origin);if(!result)return;const query=snapshot();if(!query)return;current.current.stops.add(deliverAnalytics({kind:'search_click',eventId:crypto.randomUUID(),...result,search:query}));}catch{}
 }
 return <div className="search-analytics" onClickCapture={clicked} onAuxClickCapture={clicked}>{children}</div>;
}
