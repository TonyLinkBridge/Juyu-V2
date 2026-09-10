'use client';
import {useEffect} from 'react';
import {deliverAnalytics} from '../../analytics/client';
export function ArticleAnalytics({documentId,revision}:{documentId:string;revision:number}){
 useEffect(()=>{
  let attempted=false,frame=0;const stops=new Set<()=>void>();
  const visible=()=>{if(attempted||document.visibilityState!=='visible')return;cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(attempted||document.visibilityState!=='visible')return;attempted=true;try{stops.add(deliverAnalytics({kind:'view',eventId:crypto.randomUUID(),documentId,revision}));}catch{}});};
  const restored=(event:PageTransitionEvent)=>{if(event.persisted){for(const stop of stops)stop();stops.clear();attempted=false;visible();}};
  visible();document.addEventListener('visibilitychange',visible);window.addEventListener('pageshow',restored);
  return()=>{cancelAnimationFrame(frame);for(const stop of stops)stop();document.removeEventListener('visibilitychange',visible);window.removeEventListener('pageshow',restored);};
 },[documentId,revision]);
 return null;
}
