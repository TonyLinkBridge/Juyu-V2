'use client';
/** Shared feedback. Text is never interpreted as HTML. Native unload warnings stay native. */
let active:Promise<boolean>|null=null;
export function confirmAction(message:string,title='确认此操作'):Promise<boolean>{
 if(active)return Promise.resolve(false);
 const previous=document.activeElement as HTMLElement|null;
 const dialog=document.createElement('dialog');dialog.className='juyu-confirm';
 const heading=document.createElement('h2');heading.id='juyu-confirm-title';heading.textContent=title;
 const body=document.createElement('p');body.id='juyu-confirm-message';body.textContent=message;
 dialog.setAttribute('aria-labelledby',heading.id);dialog.setAttribute('aria-describedby',body.id);
 const actions=document.createElement('div');actions.className='juyu-confirm-actions';
 const cancel=document.createElement('button');cancel.type='button';cancel.textContent='取消';cancel.autofocus=true;
 const accept=document.createElement('button');accept.type='button';accept.className='juyu-confirm-primary';accept.textContent='确认继续';
 actions.append(cancel,accept);dialog.append(heading,body,actions);document.body.append(dialog);
 active=new Promise<boolean>(resolve=>{
  const finish=(value:boolean)=>{dialog.close();dialog.remove();active=null;previous?.focus();resolve(value);};
  cancel.onclick=()=>finish(false);accept.onclick=()=>finish(true);
  dialog.oncancel=e=>{e.preventDefault();finish(false);};
  dialog.showModal();
 });return active;
}
export function notify(message:string,tone:'success'|'error'='success'){
 if(!message)return;
 let area=document.querySelector<HTMLElement>('.juyu-toasts');
 if(!area){area=document.createElement('section');area.className='juyu-toasts';area.setAttribute('aria-label','操作通知');document.body.append(area);}
 const host=document.querySelector('dialog[open]')??document.body;if(area.parentElement!==host)host.append(area);
 while(area.childElementCount>=3)area.firstElementChild?.remove();
 const item=document.createElement('div');item.className='juyu-toast '+tone;
 const text=document.createElement('div');text.setAttribute('role',tone==='error'?'alert':'status');text.textContent=message;
 const close=document.createElement('button');close.type='button';close.textContent='关闭';close.setAttribute('aria-label','关闭通知');
 item.append(text,close);area.append(item);
 let timer:ReturnType<typeof setTimeout>|undefined;
 const dismiss=()=>{clearTimeout(timer);item.remove();if(!area?.childElementCount)area?.remove();};
 const schedule=()=>{clearTimeout(timer);if(tone==='success')timer=setTimeout(dismiss,6000);};
 close.onclick=dismiss;item.onmouseenter=()=>clearTimeout(timer);item.onmouseleave=schedule;item.addEventListener('focusin',()=>clearTimeout(timer));item.addEventListener('focusout',schedule);schedule();
}
