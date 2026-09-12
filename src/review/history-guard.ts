/** Same-document back/forward protection for browsers without Navigation API. */
export function installHistoryGuard(check:()=>null|(()=>Promise<boolean>),commit:()=>void){
 const key='__juyuReviewPosition';const token=crypto.randomUUID();
 const push=history.pushState,replace=history.replaceState;
 let index=0,disposed=false,bypass=false,pending=false;
 let current={url:location.href,state:history.state};
 let restored:(()=>void)|null=null;
 const stamp=(state:unknown,n:number)=>({...((state&&typeof state==='object')?state:{}),[key]:{token,index:n}});
 replace.call(history,stamp(current.state,index),'');current.state=history.state;
 const patchedPush:History['pushState']=function(state,unused,url){push.call(history,stamp(state,++index),unused,url);current={url:location.href,state:history.state};};
 const patchedReplace:History['replaceState']=function(state,unused,url){replace.call(history,stamp(state,index),unused,url);current={url:location.href,state:history.state};};
 history.pushState=patchedPush;history.replaceState=patchedReplace;
 const pop=(event:PopStateEvent)=>{
  if(restored){event.stopImmediatePropagation();const done=restored;restored=null;done();return;}
  const destination={url:location.href,state:event.state};const marker=event.state?.[key];
  const previousURL=new URL(current.url),nextURL=new URL(destination.url);
  const hashOnly=previousURL.origin===nextURL.origin&&previousURL.pathname===nextURL.pathname&&previousURL.search===nextURL.search&&previousURL.hash!==nextURL.hash;
  const ask=hashOnly?null:check();
  if(bypass||!ask){bypass=false;if(marker?.token===token)index=marker.index;current=destination;return;}
  // Stop App Router from unmounting the editor before the decision is known.
  event.stopImmediatePropagation();
  const delta=marker?.token===token?index-marker.index:0;
  const decide=()=>{if(pending||disposed)return;pending=true;void ask().then(allowed=>{pending=false;if(!allowed||disposed)return;commit();bypass=true;if(delta)history.go(-delta);else location.assign(destination.url);});};
  if(delta){restored=decide;history.go(delta);}
  else{
   // An entry predating this mounted guard has no position. Preserve input and
   // restore the current URL; an approved departure uses a full navigation.
   push.call(history,current.state,'',current.url);decide();
  }
 };
 addEventListener('popstate',pop,true);
 return()=>{disposed=true;removeEventListener('popstate',pop,true);if(history.pushState===patchedPush)history.pushState=push;if(history.replaceState===patchedReplace)history.replaceState=replace;};
}
