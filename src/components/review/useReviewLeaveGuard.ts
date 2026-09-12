"use client";
import {useEffect} from 'react';
import {confirmAction,notify} from '../feedback/feedback';
import {registerReviewLeaveGuard,type ReviewLeaveIntent} from '../../review/leave';

type NavigateEvent=Event&{navigationType:string;destination:{url:string;key:string};hashChange:boolean;downloadRequest:string|null};
type Navigation=EventTarget&{traverseTo:(key:string)=>{finished:Promise<unknown>}};
export function useReviewLeaveGuard({dirty,busy,uncertain}:{dirty:boolean;busy:boolean;uncertain:boolean}){
 useEffect(()=>{
  if(!dirty&&!busy&&!uncertain)return;
  let leaving=false,disposed=false,asking=false;
  const check=async(intent:ReviewLeaveIntent)=>{
   if(leaving)return true;
   if(asking)return false;
   if(busy){notify('操作仍在处理中，请等待结果后再离开。','error');return false;}
   if(uncertain&&intent!=='signout'){notify('上次操作结果尚未确认，请先在本页重试原操作，避免重复处理。','error');return false;}
   asking=true;
   try{
    const message=uncertain?'上次操作可能已经成功。退出会丢失本页的原操作重试信息；再次登录后请先查看最新状态和记录，不要直接重复操作。仍要退出吗？':intent==='discard'?'本页有尚未提交的输入或选择，继续会清除它们。确定继续吗？':'本页有尚未提交的输入或选择，离开后不会保留。确定离开吗？';
    return await confirmAction(message,intent==='signout'?'确认退出登录？':intent==='discard'?'清除未提交的内容？':'离开当前操作页？')&&!disposed;
   }finally{asking=false;}
  };
  const unregister=registerReviewLeaveGuard({check,commit:()=>{leaving=true;},reset:()=>{leaving=false;}});
  const unload=(event:BeforeUnloadEvent)=>{if(!leaving){event.preventDefault();event.returnValue='';}};
  const hashOnly=(url:string)=>{const target=new URL(url,location.href);return target.origin===location.origin&&target.pathname===location.pathname&&target.search===location.search&&target.hash!==location.hash;};
  const click=(event:MouseEvent)=>{
   if(leaving||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
   const anchor=event.target instanceof Element?event.target.closest<HTMLAnchorElement>('a[href]'):null;
   if(!anchor||anchor.target&&anchor.target!=='_self'||anchor.hasAttribute('download')||!/^https?:/.test(anchor.href)||anchor.getAttribute('href')?.startsWith('#')||hashOnly(anchor.href))return;
   event.preventDefault();event.stopImmediatePropagation();
   void check('navigate').then(allowed=>{if(allowed){leaving=true;location.assign(anchor.href);}});
  };
  // Covers browser back/forward, including App Router same-document history entries.
  // Older browsers still receive click and native document-unload protection.
  const navigation=(window as unknown as {navigation?:Navigation}).navigation;
  const navigate=(event:Event)=>{
   const e=event as NavigateEvent;
   if(leaving||!e.cancelable||e.navigationType!=='traverse'||e.hashChange||e.downloadRequest)return;
   e.preventDefault();
   void check('navigate').then(allowed=>{if(allowed&&!disposed){leaving=true;void navigation!.traverseTo(e.destination.key).finished.catch(()=>{leaving=false;});}});
  };
  addEventListener('beforeunload',unload);document.addEventListener('click',click,true);navigation?.addEventListener('navigate',navigate);
  return()=>{disposed=true;unregister();removeEventListener('beforeunload',unload);document.removeEventListener('click',click,true);navigation?.removeEventListener('navigate',navigate);};
 },[dirty,busy,uncertain]);
}
