'use client';
import {useEffect} from 'react';
import {deliverAnalytics} from '../../analytics/client';
import {VisibleTimeClock} from '../../analytics/visible-time';
export function ArticleAnalytics({documentId,revision}:{documentId:string;revision:number}){
 useEffect(()=>{
  let frame=0,viewId:string|null=null,clock=new VisibleTimeClock(),lastSent=-1,accepted=false;
  const stops=new Set<()=>void>();
  const report=()=>{if(!viewId||!accepted)return;const visibleMs=clock.sample(performance.now());if(visibleMs===lastSent)return;lastSent=visibleMs;
   // Keepalive delivery remains alive when navigating away; the payload contains no name or email.
   deliverAnalytics({kind:'view_time',eventId:crypto.randomUUID(),viewId,documentId,revision,visibleMs});
  };
  const visible=()=>{
   const showing=document.visibilityState==='visible';clock.setVisible(showing,performance.now());
   if(!showing){report();return;}
   if(viewId)return;cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
    if(viewId||document.visibilityState!=='visible')return;
    viewId=crypto.randomUUID();clock=new VisibleTimeClock();clock.setVisible(true,performance.now());
    // Timing is valid only after an accepted open; a rejected open must not create timing requests.
    const opening=viewId;
    stops.add(deliverAnalytics({kind:'view',eventId:viewId,documentId,revision},{onAccepted:()=>{if(viewId===opening){accepted=true;if(document.visibilityState!=='visible')report();}}}));
   });
  };
  const hide=()=>{clock.setVisible(false,performance.now());report();};
  const restored=(event:PageTransitionEvent)=>{if(event.persisted){viewId=null;lastSent=-1;accepted=false;clock=new VisibleTimeClock();visible();}};
  visible();const timer=setInterval(()=>{if(document.visibilityState==='visible')report();},15000);
  document.addEventListener('visibilitychange',visible);window.addEventListener('pagehide',hide);window.addEventListener('pageshow',restored);
  return()=>{cancelAnimationFrame(frame);clearInterval(timer);hide();for(const stop of stops)stop();document.removeEventListener('visibilitychange',visible);window.removeEventListener('pagehide',hide);window.removeEventListener('pageshow',restored);};
 },[documentId,revision]);
 return null;
}
