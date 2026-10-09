"use client";
import {useEffect,useId,useRef,useState,useSyncExternalStore} from 'react';
export type GuideAudience='employee'|'admin';
type GuideStatus='completed'|'skipped';
interface GuideAccount {id:string;unsafeMetadata:unknown;updateMetadata:(params:{unsafeMetadata:Record<string,unknown>})=>Promise<unknown>;}
const VERSION=1;
// Fumadocs can mount desktop and mobile account slots together. One owns the automatic prompt.
const hosts=new Map<string,Set<string>>(),listeners=new Set<()=>void>(),dismissedInPage=new Set<string>();
function subscribeToSession(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
function publishSession(){for(const listener of listeners)listener();}

const subscribe=()=>()=>{};
const clientSnapshot=()=>true;
const serverSnapshot=()=>false;
function progress(metadata:unknown,audience:GuideAudience):GuideStatus|null{
 if(!metadata||typeof metadata!=='object')return null;
 const guides=(metadata as Record<string,unknown>).juyu_onboarding;
 if(!guides||typeof guides!=='object')return null;
 const entry=(guides as Record<string,unknown>)[audience];
 if(!entry||typeof entry!=='object')return null;
 const {version,status}=entry as Record<string,unknown>;
 return typeof version==='number'&&Number.isInteger(version)&&version>=VERSION&&(status==='completed'||status==='skipped')?status:null;
}
function dismissed(key:string){if(dismissedInPage.has(key))return true;try{return sessionStorage.getItem(key)==='1';}catch{return false;}}
/** Clerk's personal metadata records UI preferences only; it is never an authorization source. */
export function useUsageOnboarding(account:GuideAccount|null,audience:GuideAudience,restoreFocus:()=>void){
 const hydrated=useSyncExternalStore(subscribe,clientSnapshot,serverSnapshot);
 const [guideOpen,setGuideOpen]=useState(false),[saved,setSaved]=useState<GuideStatus|null>(null);
 const instance=useId();
 const [saving,setSaving]=useState(false),[saveFailed,setSaveFailed]=useState(false);
 const inFlight=useRef(false),active=useRef(true),lastAction=useRef<GuideStatus>('skipped');
 const key='juyu:onboarding-dismissed:v'+VERSION+':'+(account?.id||'')+':'+audience;
 const accountId=account?.id;
 useEffect(()=>{
  active.current=true;
  if(!accountId)return()=>{active.current=false;};
  const group=hosts.get(key)||new Set<string>();hosts.set(key,group);group.add(instance);publishSession();
  return()=>{active.current=false;group.delete(instance);if(!group.size)hosts.delete(key);publishSession();};
 },[key,instance,accountId]);
 const ownsPrompt=useSyncExternalStore(subscribeToSession,()=>hosts.get(key)?.values().next().value===instance,serverSnapshot);
 const tabDismissed=useSyncExternalStore(subscribeToSession,()=>dismissed(key),serverSnapshot);

 const status=progress(account?.unsafeMetadata,audience)||saved;
 const close=()=>{setGuideOpen(false);restoreFocus();};
 async function record(next:GuideStatus):Promise<boolean>{
  if(!account||inFlight.current)return false;
  if(status==='completed'||(status&&next==='skipped')){close();return true;}
  lastAction.current=next;inFlight.current=true;setSaving(true);setSaveFailed(false);
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{
   // Deep-merge only this audience; preserve other personal settings and the other guide.
   await Promise.race([account.updateMetadata({unsafeMetadata:{juyu_onboarding:{[audience]:{version:VERSION,status:next}}}}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('GUIDE_SAVE_TIMEOUT')),10000);})]);
   if(!active.current)return false;
   setSaved(next);setSaveFailed(false);close();return true;
  }catch{if(active.current)setSaveFailed(true);return false;}
  finally{clearTimeout(timer);inFlight.current=false;if(active.current)setSaving(false);}
 }
 return {
  guideOpen,saving,saveFailed,
  welcome:hydrated&&ownsPrompt&&!!account&&!status&&!tabDismissed&&!guideOpen,
  open:()=>{setSaveFailed(false);setGuideOpen(true);return true;},
  close:()=>record('skipped'),complete:()=>record('completed'),skip:()=>record('skipped'),retry:()=>record(lastAction.current),
  dismiss:()=>{try{sessionStorage.setItem(key,'1');}catch{}dismissedInPage.add(key);publishSession();setSaveFailed(false);close();},
 };
}
