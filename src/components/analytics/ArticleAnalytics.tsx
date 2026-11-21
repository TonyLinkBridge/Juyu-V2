'use client';
import {useEffect} from 'react';
import {deliverAnalytics} from '../../analytics/client';
import {VisibleTimeClock} from '../../analytics/visible-time';
export function ArticleAnalytics({documentId,revision,targetId}:{documentId:string;revision:number;targetId?:string}){
 useEffect(()=>{
  let frame=0,viewId:string|null=null,clock=new VisibleTimeClock(),lastSent=-1,accepted=false;
  const stops=new Set<()=>void>();
  // Standalone articles track foreground time. Embedded answers and reference
  // panels also need to be on screen so several open panels don't all accrue time.
  const observe=targetId!==undefined&&typeof IntersectionObserver!=='undefined';
  let inViewport=!observe;
  const showing=()=>inViewport&&document.visibilityState==='visible';
  const report=()=>{if(!viewId||!accepted)return;const visibleMs=clock.sample(performance.now());if(visibleMs===lastSent)return;lastSent=visibleMs;
   // Keepalive delivery remains alive when navigating away; the payload contains no name or email.
   deliverAnalytics({kind:'view_time',eventId:crypto.randomUUID(),viewId,documentId,revision,visibleMs});
  };
  const visible=()=>{
   clock.setVisible(showing(),performance.now());
   if(!showing()){report();return;}
   if(viewId)return;cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
    if(viewId||!showing())return;
    viewId=crypto.randomUUID();clock=new VisibleTimeClock();clock.setVisible(true,performance.now());
    // Timing is valid only after an accepted open; a rejected open must not create timing requests.
    const opening=viewId;
    stops.add(deliverAnalytics({kind:'view',eventId:viewId,documentId,revision},{onAccepted:()=>{if(viewId===opening){accepted=true;if(!showing())report();}}}));
   });
  };
  const hide=()=>{clock.setVisible(false,performance.now());report();};
  const restored=(event:PageTransitionEvent)=>{if(event.persisted){viewId=null;lastSent=-1;accepted=false;clock=new VisibleTimeClock();visible();}};
  const target=observe?document.getElementById(targetId):null;
  const observer=target?new IntersectionObserver(([entry])=>{
   inViewport=entry.isIntersecting&&entry.intersectionRatio>0;
   visible();
  }):null;
  if(observer&&target)observer.observe(target);
  visible();const timer=setInterval(()=>{if(showing())report();},15000);
  document.addEventListener('visibilitychange',visible);window.addEventListener('pagehide',hide);window.addEventListener('pageshow',restored);
  return()=>{observer?.disconnect();cancelAnimationFrame(frame);clearInterval(timer);hide();for(const stop of stops)stop();document.removeEventListener('visibilitychange',visible);window.removeEventListener('pagehide',hide);window.removeEventListener('pageshow',restored);};
 },[documentId,revision,targetId]);
 return null;
}
